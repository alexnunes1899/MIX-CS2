import fs from 'fs';
import { getDataDir, getDataFilePath } from '../dataDir.js';
import { getSessionUser, isAdminRequest, requireAdmin } from '../authSession.js';
import { economyDb } from '../db.js';
import { getLeaderboard, recordMatch } from '../leaderboard.js';
import { getMatchHistoryState } from '../matchHistory.js';
import { sendDiscordWebhook, isValidDiscordWebhookUrl } from '../discordWebhook.js';
import { moveGuildMember, testDiscordBotVoiceChannels } from '../discordVoiceMover.js';
import { writeJsonAtomic } from '../utils/atomicJson.js';
import { logger } from '../utils/logger.js';

const BACKUPABLE_FILES = [
  'leaderboard.json',
  'matchHistory.json',
  'activeMixStore.json',
  'playerProfiles.json',
  'mapRouletteState.json',
  'economyStore.json',
  'linkedClipsStore.json',
  'bagreVotesStore.json',
  'commendationsStore.json',
  'discordBotConfig.json',
];

export function registerAdminAndSocialRoutes(app, { io, rooms, discordBotManager, sensitiveLimiter }) {
  // Commendations (Post-match honors persisted cleanly)
  app.get('/api/commendations', (req, res) => {
    const ids = req.query.ids
      ? String(req.query.ids)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    return res.json({ success: true, commendations: economyDb.getCommendations(ids) });
  });

  app.post('/api/commendations', sensitiveLimiter, (req, res) => {
    const { targetId, type = 'friendly', matchId = 'global' } = req.body || {};
    if (!targetId) {
      return res.status(400).json({ error: 'targetId é obrigatório.' });
    }
    const sessionUser = getSessionUser(req);
    const clientIp = String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'anon')
      .split(',')[0]
      .trim();
    const effectiveVoter = (sessionUser?.steamId || `ip:${clientIp}`).slice(0, 64);
    const result = economyDb.commendPlayer(targetId, type, effectiveVoter, matchId);
    if (!result) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }
    if (io) {
      io.emit('commendations_updated', economyDb.getCommendations());
    }
    return res.json({ success: true, ...result });
  });

  // Leaderboard API
  app.get('/api/leaderboard', (req, res) => {
    res.json(getLeaderboard());
  });

  app.post('/api/leaderboard/record', sensitiveLimiter, requireAdmin, (req, res) => {
    const { winners, losers, map, scoreWinners, scoreLosers } = req.body || {};
    if (!Array.isArray(winners) || !Array.isArray(losers)) {
      return res.status(400).json({ error: 'Arrays de winners e losers são obrigatórios.' });
    }
    const updated = recordMatch({ winners, losers, map, scoreWinners, scoreLosers });
    io.emit('leaderboard_updated', updated);
    res.json({ success: true, leaderboard: updated });
  });

  // Unified Match History API
  app.get('/api/matches', (req, res) => {
    const { source, map, search, limit } = req.query;
    const state = getMatchHistoryState({ source, map, search, limit: parseInt(limit, 10) || 100 });
    res.json(state);
  });

  app.get('/api/matches/:id', (req, res) => {
    const state = getMatchHistoryState({ limit: 500 });
    const match = (state.matches || []).find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: 'Partida não encontrada' });
    res.json(match);
  });

  // Admin JSON Snapshot Backup & Restore (for safe DATA_DIR migration)
  app.get('/api/admin/backup', requireAdmin, (req, res) => {
    const includeSecrets = req.query.includeSecrets === '1';
    const dataDir = getDataDir();
    const files = {};

    for (const filename of BACKUPABLE_FILES) {
      const fullPath = getDataFilePath(filename);
      if (!fs.existsSync(fullPath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (filename === 'discordBotConfig.json' && !includeSecrets && parsed && typeof parsed === 'object') {
          const { token, geminiApiKey, rconPassword, ...redacted } = parsed;
          files[filename] = {
            ...redacted,
            hasToken: Boolean(token),
            hasGeminiKey: Boolean(geminiApiKey),
            hasRconPassword: Boolean(rconPassword),
          };
        } else {
          files[filename] = parsed;
        }
      } catch (err) {
        logger.warn('ADMIN_BACKUP', `Falha ao ler ${filename}`, err);
      }
    }

    return res.json({
      exportedAt: new Date().toISOString(),
      dataDir,
      files,
    });
  });

  app.post('/api/admin/restore', requireAdmin, (req, res) => {
    const files = req.body?.files;
    if (!files || typeof files !== 'object') {
      return res.status(400).json({ error: 'Payload inválido. Envie { files: { ... } }.' });
    }
    const allowed = new Set(BACKUPABLE_FILES);
    const restored = [];
    for (const [filename, content] of Object.entries(files)) {
      if (!allowed.has(filename)) continue;
      const target = getDataFilePath(filename);
      if (writeJsonAtomic(target, content)) {
        restored.push(filename);
      }
    }
    return res.json({
      success: true,
      restored,
      message: 'Snapshot gravado no DATA_DIR. Reinicie o processo se precisar recarregar caches em memória.',
    });
  });

  // Discord Webhook & Bot Endpoints
  app.post('/api/discord/webhook', sensitiveLimiter, async (req, res) => {
    if (!getSessionUser(req) && !isAdminRequest(req)) {
      return res.status(401).json({ error: 'Faça login com a Steam ou forneça chave Admin para enviar webhooks.' });
    }
    const { webhookUrl, eventType, data } = req.body || {};
    if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
      return res.status(400).json({ error: 'URL do Webhook do Discord inválida.' });
    }
    try {
      const result = await sendDiscordWebhook({ webhookUrl, eventType, data });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/discord/test-voice-channel', sensitiveLimiter, requireAdmin, async (req, res) => {
    const { botToken, guildId, channelId } = req.body || {};
    if (!botToken || !guildId || !channelId) {
      return res.status(400).json({ error: 'Token, Guild ID e Channel ID são obrigatórios.' });
    }
    try {
      const result = await testDiscordBotVoiceChannels({ botToken, guildId, channelId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/discord/move-members', sensitiveLimiter, requireAdmin, async (req, res) => {
    const { botToken, guildId, moves } = req.body || {};
    if (!botToken || !guildId || !Array.isArray(moves)) {
      return res.status(400).json({ error: 'Token, Guild ID e lista de jogadores são obrigatórios.' });
    }
    const results = [];
    for (const move of moves) {
      try {
        await moveGuildMember({ botToken, guildId, userId: move.userId, targetChannelId: move.targetChannelId });
        results.push({ userId: move.userId, success: true });
      } catch (err) {
        results.push({ userId: move.userId, success: false, error: err.message });
      }
    }
    res.json({ results });
  });

  app.post('/api/discord/announce-match', sensitiveLimiter, requireAdmin, async (req, res) => {
    try {
      const mixId = req.body?.mixId;
      if (!mixId) {
        return res.status(400).json({ success: false, error: 'mixId é obrigatório.' });
      }
      let mix = null;
      if (discordBotManager?.activeMixes) {
        for (const m of discordBotManager.activeMixes.values()) {
          if (m && m.id === mixId) {
            mix = m;
            break;
          }
        }
      }
      if (!mix && rooms) {
        const room = rooms.get(String(mixId).trim().toUpperCase());
        if (room) mix = room;
      }
      if (!mix) {
        return res.status(404).json({ success: false, error: 'mix_not_found' });
      }

      const channelId = req.body?.channelId || mix.channelId || discordBotManager.config.defaultChannelId || process.env.DISCORD_CHANNEL_ID;
      if (!channelId) {
        return res.status(400).json({ success: false, error: 'channel_not_configured' });
      }
      const channel = await discordBotManager.client?.channels?.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ success: false, error: 'channel_not_found' });
      }

      const embed = discordBotManager.buildMatchReadyEmbed(mix);
      const components = discordBotManager.buildMatchReadyButtons(mix);
      const mapTitle = mix.finalMap?.name ? `${mix.finalMap.name.toUpperCase()} (${mix.finalMap.file || mix.finalMap.id || ''})` : 'A Definir';
      const serverConn = (mix.serverIp || discordBotManager.config.serverConnect || process.env.DEFAULT_SERVER_CONNECT || '').replace(/^connect\s+/i, '');
      const capA = mix.teamA?.captain?.id ? `<@${mix.teamA.captain.id}>` : (mix.teamA?.[0]?.nick || 'Capitão A');
      const capB = mix.teamB?.captain?.id ? `<@${mix.teamB.captain.id}>` : (mix.teamB?.[0]?.nick || 'Capitão B');

      const sent = await channel.send({
        content:
          `🚨 **ATENÇÃO TODOS OS JOGADORES — PARTIDA CONFIGURADA!**\n\n` +
          `🗺️ **MAPA OFICIAL:** **${mapTitle}**\n` +
          `🛡️ **Time A (CT):** ${capA}\n` +
          `💣 **Time B (TR):** ${capB}\n` +
          (serverConn ? `\n💻 **Comando de Conexão no CS2:** \`connect ${serverConn}\`` : ''),
        embeds: [embed],
        components,
      });

      return res.json({ success: true, messageId: sent.id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/discord/bot/status', (req, res) => {
    res.json({
      ...discordBotManager.getStatus(),
      canManageBot: isAdminRequest(req),
    });
  });

  app.get('/api/discord/status', (req, res) => {
    res.json({
      ...discordBotManager.getStatus(),
      canManageBot: isAdminRequest(req),
    });
  });

  app.post('/api/discord/bot/config', sensitiveLimiter, requireAdmin, async (req, res) => {
    const {
      token,
      clientId,
      guildId,
      defaultChannelId,
      lobbyVoiceId,
      teamAVoiceId,
      teamBVoiceId,
      autoMoveVoice,
      serverConnect,
      dealsChannelId,
      dealsChannels,
      autoPostDeals,
      lastDealsDropAt,
      geminiApiKey,
    } = req.body || {};

    discordBotManager.saveConfig({
      ...(token !== undefined ? { token: String(token).trim() } : {}),
      ...(clientId !== undefined ? { clientId: String(clientId).trim() } : {}),
      ...(guildId !== undefined ? { guildId: String(guildId).trim() } : {}),
      ...(defaultChannelId !== undefined ? { defaultChannelId: String(defaultChannelId).trim() } : {}),
      ...(lobbyVoiceId !== undefined ? { lobbyVoiceId: String(lobbyVoiceId).trim() } : {}),
      ...(teamAVoiceId !== undefined ? { teamAVoiceId: String(teamAVoiceId).trim() } : {}),
      ...(teamBVoiceId !== undefined ? { teamBVoiceId: String(teamBVoiceId).trim() } : {}),
      ...(autoMoveVoice !== undefined ? { autoMoveVoice: Boolean(autoMoveVoice) } : {}),
      ...(serverConnect !== undefined ? { serverConnect: String(serverConnect || '').trim() } : {}),
      ...(dealsChannelId !== undefined ? { dealsChannelId: String(dealsChannelId || '').trim() } : {}),
      ...(dealsChannels !== undefined && typeof dealsChannels === 'object' ? { dealsChannels } : {}),
      ...(autoPostDeals !== undefined ? { autoPostDeals: Boolean(autoPostDeals) } : {}),
      ...(lastDealsDropAt !== undefined ? { lastDealsDropAt: Number(lastDealsDropAt) || Date.now() } : {}),
      ...(geminiApiKey !== undefined && String(geminiApiKey).trim() ? { geminiApiKey: String(geminiApiKey).trim() } : {}),
    });

    res.json({ success: true, status: discordBotManager.getStatus() });
  });

  app.post('/api/discord/bot/start', sensitiveLimiter, requireAdmin, async (req, res) => {
    const result = await discordBotManager.start();
    res.json(result);
  });

  app.post('/api/discord/bot/stop', sensitiveLimiter, requireAdmin, async (req, res) => {
    const result = await discordBotManager.stop();
    res.json(result);
  });

  app.post('/api/discord/bot/panel', sensitiveLimiter, requireAdmin, async (req, res) => {
    const { channelId } = req.body || {};
    const targetChannelId = channelId || discordBotManager.config.defaultChannelId;
    if (!discordBotManager.client || !discordBotManager.client.isReady()) {
      return res.status(400).json({ error: 'O Bot do Discord não está conectado ou online.' });
    }
    if (!targetChannelId) {
      return res.status(400).json({ error: 'ID do canal de texto não fornecido.' });
    }
    try {
      const channel = await discordBotManager.client.channels.fetch(targetChannelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ error: 'Canal de texto inválido ou inacessível pelo bot.' });
      }
      await discordBotManager.cmdSendPermanentPanel({
        channel,
        user: discordBotManager.client.user,
        reply: async () => {},
      });
      return res.json({ success: true, channelName: channel.name });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });
}
