import {
  getSessionUser,
  isAdminRequest,
  isLoopbackRequest,
} from '../authSession.js';
import { executeRconCommand } from '../rcon.js';
import { pingCs2Server } from '../serverQuery.js';
import { sendDiscordWebhook, isValidDiscordWebhookUrl } from '../discordWebhook.js';
import { determineMatchWinner } from '../matchHistory.js';
import { recordMatch } from '../leaderboard.js';
import {
  handleGsiPayload,
  getGsiState,
  generateGsiConfig,
  generateGsiBatchInstaller,
  generateGsiPowerShellInstaller,
  buildCs2CfgPowerShellInstaller,
  installGsiLocally,
  checkGsiInstalled,
} from '../gsi.js';
import { sanitizeRconCommand } from '../roomHelpers.js';
import { buildTreinoCfg, buildTreinoLeiaMeMd } from '../../shared/treinoCfg.js';

const ALLOWED_AVATAR_PROXY_HOSTS = new Set([
  'avatars.steamstatic.com',
  'avatars.akamai.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'cdn.discordapp.com',
  'media.discordapp.net',
]);

const AVATAR_PROXY_MAX_BYTES = 2 * 1024 * 1024;

export function isAllowedAvatarProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    return ALLOWED_AVATAR_PROXY_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const gsiDiscordTracker = new Map();

function processGsiDiscordNotifications(room, liveState, req) {
  if (!room || !room.discordWebhook || !isValidDiscordWebhookUrl(room.discordWebhook)) return;

  const roomId = room.id;
  let tracker = gsiDiscordTracker.get(roomId);
  if (!tracker) {
    tracker = { lastRound: -1, lastBombState: 'none', gameOverSent: false };
    gsiDiscordTracker.set(roomId, tracker);
  }

  if (liveState.phase === 'warmup' || (liveState.roundNumber === 0 && liveState.roundPhase === 'freezetime')) {
    tracker.lastRound = -1;
    tracker.lastBombState = 'none';
    tracker.gameOverSent = false;
    return;
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const roomUrl = `${protocol}://${host}/?room=${encodeURIComponent(roomId)}`;

  if (
    room.discordGsiRounds !== false &&
    liveState.roundPhase === 'over' &&
    liveState.roundNumber > 0 &&
    tracker.lastRound !== liveState.roundNumber
  ) {
    tracker.lastRound = liveState.roundNumber;
    tracker.lastBombState = 'none';

    sendDiscordWebhook({
      webhookUrl: room.discordWebhook,
      eventType: 'gsi_round',
      data: {
        roomName: room.name || roomId,
        mapName: liveState.mapName || 'CS2 Map',
        roundNumber: liveState.roundNumber,
        scoreCT: liveState.scoreCT,
        scoreTR: liveState.scoreTR,
        winTeam: liveState.winTeam || (liveState.scoreCT > liveState.scoreTR ? 'CT' : 'T'),
        bomb: liveState.bomb,
        roomUrl,
      },
    }).catch((err) => console.error('[DISCORD GSI ROUND ERROR]:', err.message));
  }

  if (
    room.discordGsiBomb &&
    liveState.roundPhase === 'live' &&
    liveState.bomb !== tracker.lastBombState &&
    (liveState.bomb === 'planted' || liveState.bomb === 'defused')
  ) {
    tracker.lastBombState = liveState.bomb;

    sendDiscordWebhook({
      webhookUrl: room.discordWebhook,
      eventType: 'gsi_bomb',
      data: {
        roomName: room.name || roomId,
        mapName: liveState.mapName || 'CS2 Map',
        roundNumber: liveState.roundNumber,
        scoreCT: liveState.scoreCT,
        scoreTR: liveState.scoreTR,
        bombState: liveState.bomb,
        roomUrl,
      },
    }).catch((err) => console.error('[DISCORD GSI BOMB ERROR]:', err.message));
  }

  if (
    liveState.isGameOver &&
    !tracker.gameOverSent &&
    (liveState.phase === 'gameover' || liveState.scoreCT >= 13 || liveState.scoreTR >= 13)
  ) {
    tracker.gameOverSent = true;
    const winnerRes = determineMatchWinner({ teamA: room.teamA, teamB: room.teamB, ...room }, liveState);
    const winner = winnerRes.winnerLetter === 'A' ? (room.nameA || 'Time A') : (room.nameB || 'Time B');
    sendDiscordWebhook({
      webhookUrl: room.discordWebhook,
      eventType: 'gsi_gameover',
      data: {
        roomName: room.name || roomId,
        mapName: liveState.mapName || 'CS2 Map',
        scoreCT: liveState.scoreCT,
        scoreTR: liveState.scoreTR,
        winner,
        roomUrl,
      },
    }).catch((err) => console.error('[DISCORD GSI GAMEOVER ERROR]:', err.message));
  }
}

export function registerInfraRoutes(app, { io, rooms, lifecycle, discordBotManager, sensitiveLimiter, isLocalPc, cloudBaseUrl }) {
  function forwardGsiToCloudIfLocal(roomId, rawPayload, req) {
    if (!isLocalPc || !rawPayload) return;
    if (req?.headers?.['x-gsi-relayed']) return;
    fetch(`${cloudBaseUrl}/api/gsi/${encodeURIComponent(roomId || 'MIX-PRO')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GSI-Relayed': '1',
      },
      body: JSON.stringify(rawPayload),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  }

  function applyRoomGsiUpdate(roomId, liveState, req) {
    const room = lifecycle.getRoomAndTouch(roomId);
    if (!room) return;
    room.liveMatch = liveState;
    io.to(roomId).emit('gsi_update', liveState);
    processGsiDiscordNotifications(room, liveState, req);

    if (liveState.isGameOver && (liveState.phase === 'gameover' || (liveState.scoreCT || 0) >= 13 || (liveState.scoreTR || 0) >= 13)) {
      const winnerRes = determineMatchWinner({ teamA: room.teamA, teamB: room.teamB, ...room }, liveState);
      const isWinnerA = winnerRes.winnerLetter === 'A';
      const winnerName = isWinnerA ? (room.nameA || 'Time A') : (room.nameB || 'Time B');
      const loserName = isWinnerA ? (room.nameB || 'Time B') : (room.nameA || 'Time A');
      const winners = isWinnerA ? (room.teamA || []) : (room.teamB || []);
      const losers = isWinnerA ? (room.teamB || []) : (room.teamA || []);
      const scoreWinner = Math.max(liveState.scoreCT || 0, liveState.scoreTR || 0);
      const scoreLoser = Math.min(liveState.scoreCT || 0, liveState.scoreTR || 0);
      const matchKey = `${liveState.mapName}-${scoreWinner}-${scoreLoser}`;
      const lastMatch = room.history[0];
      if (!lastMatch || lastMatch.key !== matchKey) {
        room.history.unshift({
          id: `match-gsi-${Date.now()}`,
          key: matchKey,
          date: new Date().toLocaleDateString('pt-BR'),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          map: liveState.mapName,
          scoreA: isWinnerA ? scoreWinner : scoreLoser,
          scoreB: isWinnerA ? scoreLoser : scoreWinner,
          winner: winnerName,
          loser: loserName,
          source: 'Valve CS2 GSI',
        });
        if (room.history.length > 20) room.history.pop();
        if (winners.length > 0 || losers.length > 0) {
          try {
            recordMatch({
              winners,
              losers,
              map: liveState.mapName,
              scoreWinners: scoreWinner,
              scoreLosers: scoreLoser,
            });
          } catch (err) {
            console.warn('[LEADERBOARD GSI RECORD ERROR]:', err.message);
          }
        }
        lifecycle.emitRoomState(roomId, room);
      }
    }
  }

  app.post('/api/gsi/install-local', (req, res) => {
    if (!isLocalPc || (!isLoopbackRequest(req) && !isAdminRequest(req))) {
      return res.status(403).json({
        installed: false,
        error: 'Instalação automática de GSI só pode ser executada no PC local com o servidor local.',
      });
    }
    const roomId = (req.body?.roomId || 'MIX-PRO').trim().toUpperCase();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const serverBaseUrl = `${protocol}://${host}`;
    const result = installGsiLocally(serverBaseUrl, roomId);
    res.json(result);
  });

  app.get('/api/gsi/check-installed', (req, res) => {
    res.json(checkGsiInstalled());
  });

  app.post('/api/gsi/:roomId', (req, res) => {
    const roomId = (req.params.roomId || req.body?.auth?.token || 'MIX-PRO').trim().toUpperCase();
    forwardGsiToCloudIfLocal(roomId, req.body, req);

    const liveState = handleGsiPayload(roomId, req.body);
    if (liveState) {
      discordBotManager.handleGsiEvent(roomId, liveState);
      if (rooms.has(roomId)) {
        applyRoomGsiUpdate(roomId, liveState, req);
      } else {
        io.to(roomId).emit('gsi_update', liveState);
      }
    }
    res.json({ success: true });
  });

  // Fallback endpoint: routes strictly to the room matching auth.token (no longer clobbers all rooms)
  app.post('/api/gsi', (req, res) => {
    const token = (req.body?.auth?.token || 'MIX-PRO').trim().toUpperCase();
    forwardGsiToCloudIfLocal(token, req.body, req);

    const liveState = handleGsiPayload(token, req.body);
    if (liveState) {
      discordBotManager.handleGsiEvent(token, liveState);
      if (rooms.has(token)) {
        applyRoomGsiUpdate(token, liveState, req);
      } else {
        io.to(token).emit('gsi_update', liveState);
      }
    }
    res.json({ success: true });
  });

  app.get('/api/gsi/cfg/:roomId', (req, res) => {
    const roomId = req.params.roomId || 'MIX-PRO';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const cfgContent = generateGsiConfig(`${protocol}://${host}`, roomId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gamestate_integration_cs2mixhub.cfg"');
    res.send(cfgContent);
  });

  app.get('/api/gsi/installer/:roomId', (req, res) => {
    const roomId = req.params.roomId || 'MIX-PRO';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const batContent = generateGsiBatchInstaller(`${protocol}://${host}`, roomId);
    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="instalar_monitoramento_cs2.bat"');
    res.send(batContent);
  });

  app.get('/api/gsi/installer/ps1/:roomId', (req, res) => {
    const roomId = req.params.roomId || 'MIX-PRO';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const ps1Content = generateGsiPowerShellInstaller(`${protocol}://${host}`, roomId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(ps1Content);
  });

  app.get('/api/gsi/status/:roomId', (req, res) => {
    const state = getGsiState(req.params.roomId);
    if (!state.connected && discordBotManager.lastGsiState && Date.now() - (discordBotManager.lastGsiState.receivedAt || 0) < 60000) {
      return res.json({
        connected: true,
        lastUpdate: discordBotManager.lastGsiState.receivedAt || Date.now(),
        ...discordBotManager.lastGsiState,
      });
    }
    res.json(state);
  });

  app.get('/api/matchzy/config/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    const room = rooms.get(String(roomId || '').toUpperCase()) || lifecycle.getOrCreateRoom(roomId);

    const matchFormat = room.matchFormat || 'MD1';
    const numMaps = matchFormat === 'MD5' ? 5 : matchFormat === 'MD3' ? 3 : 1;

    let maplist = [];
    if (Array.isArray(room.drawnSeries) && room.drawnSeries.length > 0) {
      maplist = room.drawnSeries.map((s) => s.map?.file || s.file || 'de_mirage');
    } else if (room.finalMap?.file) {
      maplist = [room.finalMap.file];
    } else {
      maplist = ['de_mirage'];
    }
    while (maplist.length < numMaps) maplist.push('de_mirage');
    maplist = maplist.slice(0, numMaps);

    const buildPlayers = (players) => {
      const map = {};
      if (Array.isArray(players)) {
        players.forEach((p, idx) => {
          const id = p.steamId || `BOT_${idx + 1}`;
          map[id] = p.nick || `Jogador ${idx + 1}`;
        });
      }
      return map;
    };

    const nameA = room.teamAName || (room.teamA?.[0]?.nick ? `Time ${room.teamA[0].nick}` : 'Time A');
    const nameB = room.teamBName || (room.teamB?.[0]?.nick ? `Time ${room.teamB[0].nick}` : 'Time B');

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      matchid: room.id,
      num_maps: numMaps,
      maplist,
      map_sides: maplist.map(() => 'knife'),
      players_per_team: 5,
      min_players_to_ready: 10,
      team1: { name: nameA, tag: 'TIME_A', flag: 'BR', players: buildPlayers(room.teamA) },
      team2: { name: nameB, tag: 'TIME_B', flag: 'BR', players: buildPlayers(room.teamB) },
      cvars: {
        mp_overtime_enable: '1',
        mp_overtime_maxrounds: '6',
        mp_overtime_startmoney: '10000',
        mp_warmuptime: '300',
        sv_hibernate_when_empty: '0',
        tv_enable: '1',
        tv_record_match: '1',
      },
    });
  });

  app.get('/api/my-ip', (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || '';
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    res.json({ ip });
  });

  // Never leak cloud container private IPs as the player's PC LAN IP
  app.get('/api/lan-ip', async (req, res) => {
    if (!isLocalPc && (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || !isLoopbackRequest(req))) {
      return res.json({
        ips: [],
        isCloudHosted: true,
        message: 'Servidor hospedado na nuvem. Para detectar o IP da sua placa de rede local/Radmin, rode o servidor no seu PC ou digite seu IP manualmente.',
      });
    }
    try {
      const os = await import('os');
      const nets = os.networkInterfaces();
      const ips = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            ips.push({ name, address: net.address });
          }
        }
      }
      return res.json({ ips, isCloudHosted: false });
    } catch {
      return res.json({ ips: [], isCloudHosted: false });
    }
  });

  function requireSessionOrAdmin(req, res, next) {
    if (getSessionUser(req) || isAdminRequest(req)) return next();
    return res.status(401).json({
      error: 'Faça login com a Steam ou forneça chave Admin para executar comandos RCON remotos.',
      requiresAuth: true,
    });
  }

  app.post('/api/rcon/test', sensitiveLimiter, requireSessionOrAdmin, async (req, res) => {
    const { host, port, password } = req.body || {};
    try {
      const result = await executeRconCommand({ host, port, password, command: 'test' });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/rcon/exec', sensitiveLimiter, requireSessionOrAdmin, async (req, res) => {
    const { host, port, password, command } = req.body || {};
    const cleanCmd = sanitizeRconCommand(command);
    if (!cleanCmd) {
      return res.status(400).json({ error: 'Comando RCON inválido ou vazio.' });
    }
    try {
      const result = await executeRconCommand({ host, port, password, command: cleanCmd });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/server/ping', sensitiveLimiter, async (req, res) => {
    const { host, port } = req.body || {};
    try {
      const result = await pingCs2Server(host, port || 27015);
      res.json(result);
    } catch (err) {
      res.status(500).json({ online: false, error: err.message });
    }
  });

  app.get('/api/server/check-port', sensitiveLimiter, async (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || '';
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    const port = parseInt(req.query.port, 10) || 27015;
    try {
      const result = await pingCs2Server(ip, port, 2000);
      res.json({ clientIp: ip, port, reachable: result.online, pingMs: result.pingMs, error: result.error });
    } catch (err) {
      res.status(500).json({ clientIp: ip, port, reachable: false, error: err.message });
    }
  });

  app.get('/api/avatar-proxy', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!isAllowedAvatarProxyUrl(rawUrl)) {
      return res.status(400).json({ error: 'URL de avatar inválida ou host não permitido.' });
    }

    try {
      const upstream = await fetch(rawUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        },
      });

      if (!upstream.ok) {
        return res.status(502).json({ error: 'Não foi possível carregar o avatar remoto.' });
      }

      const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).json({ error: 'Resposta remota não é uma imagem válida.' });
      }

      const contentLength = Number(upstream.headers.get('content-length') || 0);
      if (contentLength > AVATAR_PROXY_MAX_BYTES) {
        return res.status(413).json({ error: 'Avatar excede o tamanho máximo permitido.' });
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.byteLength > AVATAR_PROXY_MAX_BYTES) {
        return res.status(413).json({ error: 'Avatar excede o tamanho máximo permitido.' });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      return res.send(buffer);
    } catch {
      return res.status(502).json({ error: 'Falha ao buscar avatar remoto.' });
    }
  });

  app.get('/api/treino/cfg', (req, res) => {
    const cfgContent = buildTreinoCfg(req.query || {});
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="treino.cfg"');
    res.send(cfgContent);
  });

  app.get('/api/treino/leia-me', (req, res) => {
    const mdContent = buildTreinoLeiaMeMd(req.query || {});
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="LEIA-ME.md"');
    res.send(mdContent);
  });

  app.get('/api/treino/installer.ps1', (req, res) => {
    const cfgContent = buildTreinoCfg(req.query || {});
    const ps1Content = buildCs2CfgPowerShellInstaller({
      cfgContent,
      fileName: 'treino.cfg',
      successHeadline: 'TUDO PRONTO! O PACK DE TREINO LXN (treino.cfg) FOI INSTALADO NO SEU CS2!',
      hintLines: [
        'Abra um mapa no modo Treino do CS2, abra o console (apostrofo) e digite: exec treino',
        'Para carregar spawns TR no Numpad 1-5 digite: mirage, inferno, dust2, ancient ou anubis!',
      ],
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(ps1Content);
  });
}
