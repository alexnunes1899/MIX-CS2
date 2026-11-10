import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_DIR = path.join(DATA_DIR, 'whatsapp_auth');
const CONFIG_PATH = path.join(DATA_DIR, 'whatsappConfig.json');
const CONFIG_DEFAULT_PATH = path.join(DATA_DIR, 'whatsappConfig.default.json');
const PROFILES_PATH = path.join(DATA_DIR, 'playerProfiles.json');
const GROUPS_PATH = path.join(DATA_DIR, 'whatsappGroups.json');
import { scheduleSave, clearMixPersistence } from './mixPersistence.js';

class WhatsAppBotManager {
  constructor() {
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qrcode' | 'connected'
    this.qrCode = null; // Data URL for <img>
    this.qrRaw = null;
    this.pairingCode = null;
    this.user = null;
    this.groups = new Map(); // id -> { id, subject, size }
    this.reconnectTimeout = null;
    this.config = this.loadConfig();
    this.recentAlerts = new Map(); // key -> timestamp to avoid spam
    this.isConnecting = false;
    this.discordBotRef = null;
    this.webRoomsRef = null;
    this.loadCachedGroups();
  }

  setStoreRefs(discordBot, webRooms) {
    if (discordBot) this.discordBotRef = discordBot;
    if (webRooms) this.webRoomsRef = webRooms;
  }

  loadCachedGroups() {
    try {
      if (fs.existsSync(GROUPS_PATH)) {
        const raw = fs.readFileSync(GROUPS_PATH, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.id) {
              this.groups.set(item.id, item);
            }
          }
        }
      }
    } catch (_) {}
  }

  saveCachedGroups() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const list = Array.from(this.groups.values());
      fs.writeFileSync(GROUPS_PATH, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.warn('[WHATSAPP] Falha ao salvar grupos em cache:', e.message);
    }
  }

  loadPlayerProfiles() {
    try {
      if (fs.existsSync(PROFILES_PATH)) {
        const raw = fs.readFileSync(PROFILES_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (_) {}
    return {};
  }

  savePlayerProfile(userId, data) {
    try {
      const profiles = this.loadPlayerProfiles();
      profiles[userId] = {
        ...(profiles[userId] || {}),
        ...data,
        updatedAt: Date.now(),
      };
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf8');
      return profiles[userId];
    } catch (e) {
      console.warn('[WHATSAPP] Erro ao salvar perfil:', e.message);
      return null;
    }
  }

  getPlayerLevel(userId) {
    const profiles = this.loadPlayerProfiles();
    return profiles[userId]?.level || null;
  }

  getActiveMix() {
    // 1. Check active Discord mixes
    if (this.discordBotRef && this.discordBotRef.activeMixes?.size > 0) {
      for (const m of this.discordBotRef.activeMixes.values()) {
        if (m && m.phase !== 'cancelled' && m.phase !== 'finished') return { source: 'discord', mix: m };
      }
    }
    // 2. Check active Web rooms
    if (this.webRoomsRef && this.webRoomsRef.size > 0) {
      for (const r of this.webRoomsRef.values()) {
        if (r && r.phase !== 'finished' && r.phase !== 'cancelled') return { source: 'web', mix: r };
      }
    }
    return null;
  }

  createMixFromWhatsApp(creatorPhone, creatorName) {
    const creatorId = `wa_${creatorPhone}`;
    const creatorLvl = this.getPlayerLevel(creatorId) || 16;
    const mixId = `MIX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const defaultChannelId = this.discordBotRef?.config?.mixChannelId || 'whatsapp-mix';

    const creatorPlayer = {
      id: creatorId,
      nick: creatorName,
      username: creatorName,
      name: creatorName,
      displayName: creatorName,
      phone: creatorPhone,
      level: creatorLvl,
      source: 'whatsapp',
      ready: true,
    };

    const newMix = {
      id: mixId,
      channelId: defaultChannelId,
      name: `Mix 5v5 de ${creatorName}`,
      format: 'MD1',
      creatorId,
      creatorNick: creatorName,
      players: [creatorPlayer],
      phase: 'lobby',
      readyCheck: {
        active: false,
        confirmed: new Set(),
        expiresAt: null,
        timer: null,
      },
      teamA: { name: 'Time A', captain: creatorPlayer, players: [creatorPlayer], side: 'CT', avgLevel: creatorLvl },
      teamB: { name: 'Time B', captain: null, players: [], side: 'TR', avgLevel: 16 },
      balancePct: 100,
      veto: {
        currentTurn: 'teamA',
        bannedMaps: [],
        remainingMaps: ['de_mirage', 'de_inferno', 'de_nuke', 'de_ancient', 'de_anubis', 'de_dust2', 'de_vertigo'],
        deciderMap: null,
        history: [],
      },
      serverIp: this.config.serverConnect || this.discordBotRef?.config?.serverConnect || '',
      messageId: null,
      createdAt: Date.now(),
    };

    // 1. Sync to Discord activeMixes if Discord bot is available
    if (this.discordBotRef) {
      if (!this.discordBotRef.activeMixes) this.discordBotRef.activeMixes = new Map();
      this.discordBotRef.activeMixes.set(defaultChannelId, newMix);
      this.discordBotRef.activeMixes.set(mixId, newMix);
      this.notifyDiscordLobbyUpdate(newMix);
    }

    // 2. Sync to Web Rooms map
    if (this.webRoomsRef) {
      this.webRoomsRef.set(mixId, {
        id: mixId,
        name: newMix.name,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        creatorId,
        creatorNick: creatorName,
        source: 'whatsapp',
        sourceLabel: 'Via WhatsApp',
        phase: 'lobby',
        rankingSystem: 'gc',
        serverIp: newMix.serverIp,
        players: [
          {
            id: creatorId,
            nick: creatorName,
            level: creatorLvl,
            ready: true,
          },
        ],
        teamA: newMix.teamA,
        teamB: newMix.teamB,
      });

      if (this.discordBotRef && typeof this.discordBotRef.onRoomUpdated === 'function') {
        try {
          this.discordBotRef.onRoomUpdated(mixId, this.webRoomsRef.get(mixId));
        } catch (_) {}
      }
    }

    scheduleSave(100);
    return newMix;
  }

  notifyDiscordLobbyUpdate(mix) {
    if (!this.discordBotRef || !mix) return;
    try {
      if (typeof this.discordBotRef.syncToWebRoom === 'function') {
        this.discordBotRef.syncToWebRoom(mix);
      }
      if (typeof this.discordBotRef.updateLobbyInChannels === 'function') {
        this.discordBotRef.updateLobbyInChannels(mix);
      }
    } catch (e) {
      console.warn('[WHATSAPP] Falha ao sincronizar lobby com Discord:', e.message);
    }
    scheduleSave(100);
  }

  balanceTeamsLocal(mix) {
    if (!mix.players || mix.players.length < 2) return;
    mix.players.forEach((p) => {
      const profileKey = p.phone ? `wa_${p.phone}` : p.id;
      p.level = this.getPlayerLevel(profileKey) || p.level || 16;
    });

    const sorted = [...mix.players].sort((a, b) => (b.level || 16) - (a.level || 16));
    const teamA = [];
    const teamB = [];

    // Snake Draft: 0->A, 1->B, 2->B, 3->A, 4->A...
    sorted.forEach((p, i) => {
      const mod = i % 4;
      if (mod === 0 || mod === 3) teamA.push(p);
      else teamB.push(p);
    });

    const sumA = teamA.reduce((acc, p) => acc + (p.level || 16), 0);
    const sumB = teamB.reduce((acc, p) => acc + (p.level || 16), 0);
    const avgA = (sumA / (teamA.length || 1)).toFixed(1);
    const avgB = (sumB / (teamB.length || 1)).toFixed(1);
    const diff = Math.abs(sumA - sumB);
    const balancePct = Math.max(75, Math.min(100, Math.round(100 - diff * 3.5)));

    teamA.sort((a, b) => (b.level || 16) - (a.level || 16));
    teamB.sort((a, b) => (b.level || 16) - (a.level || 16));

    mix.teamA = { name: 'Time A', captain: teamA[0] || null, players: teamA, side: 'CT', avgLevel: avgA };
    mix.teamB = { name: 'Time B', captain: teamB[0] || null, players: teamB, side: 'TR', avgLevel: avgB };
    mix.balancePct = balancePct;
  }

  async sendActionPoll(from, mix) {
    if (!this.sock) return false;
    try {
      const count = mix?.players?.length || 0;
      return await this.sock.sendMessage(from, {
        poll: {
          name: `🎮 CS2 MIX 5v5 • AÇÕES RÁPIDAS (${count}/10 Vagas)`,
          values: [
            '✅ Entrar no Mix (Garantir Vaga)',
            '🚪 Sair da Fila',
            '⚔️ Sortear Times (Snake-Draft)',
            '💻 Ver IP do Servidor CS2',
          ],
          selectableCount: 1,
        },
      });
    } catch (err) {
      console.warn('[WHATSAPP] Falha ao enviar enquete de ações:', err.message);
      return false;
    }
  }

  async sendLobbyStatus(from, msg, mix, bannerNotice = null) {
    if (!mix) return false;
    const count = mix.players?.length || 0;
    const remaining = Math.max(0, 10 - count);
    const roomUrl = this.getPublicUrl(`/?room=${mix.id}`);
    const profileUrl = this.getPublicUrl(`/perfil?room=${mix.id}`);

    let listStr = '';
    for (let i = 0; i < 10; i++) {
      const p = mix.players?.[i];
      if (p) {
        const capBadge = (i === 0 || p.isCaptain) ? '👑 ' : '';
        const name = p.username || p.nick || p.name || 'Jogador';
        const lvl = p.level || p.gcLevel || 16;
        listStr += `${i + 1}. ${capBadge}*${name}* [Lvl ${lvl} GC]\n`;
      } else {
        listStr += `${i + 1}. ⏳ _[Vaga Aberta]_\n`;
      }
    }

    let header = '';
    if (bannerNotice) {
      header = `${bannerNotice}\n\n`;
    }

    let statusLine = '';
    if (count >= 10) {
      statusLine = `🎉 *LOBBY COMPLETO (10/10)!* Todos os 10 jogadores confirmados.\n👉 Digite *!sortear* ou reaja com ⚔️ para sortear os times e o mapa!`;
    } else {
      statusLine = `👥 *Vagas Restantes:* *${count}/10* (Faltam *${remaining}* para fechar a partida)\n⚠️ *Regra do Mix:* É obrigatório definir seu Nível GC antes de entrar na fila!`;
    }

    const statusText =
      `${header}` +
      `🎮 *CS2 MIX 5v5 • STATUS DA FILA ATUALIZADO*\n` +
      `📍 *Sala:* ${mix.name || `Mix #${mix.id}`}\n` +
      `${statusLine}\n\n` +
      `📋 *Escalação dos 10 Slots:*\n` +
      `${listStr}\n` +
      `⭐ *Definir Nível GC & Nick em 1 Toque (Botões 1 ao 21):*\n` +
      `👉 ${profileUrl}\n\n` +
      `🔘 *Ações Rápidas por Reação (1 Toque nesta mensagem):*\n` +
      `• 👍 = *Entrar no Mix* (precisa de nível salvo)\n` +
      `• 🚪 = *Sair da Fila*\n` +
      `• ⚔️ = *Sortear Times*\n\n` +
      `💬 *Comandos Rápidos no WhatsApp:*\n` +
      `• *!entrar* — Entra na fila (ou *!entrar <nível>*)\n` +
      `• *!sair* — Libera sua vaga\n` +
      `• *!lvl <1-21>* — Salva seu nível GC direto no chat (ex: *!lvl 18*)\n` +
      `• *!sortear* — Sorteia os times balanceados pelo Snake-Draft\n` +
      `• *!ip* — Exibe o IP do servidor CS2 e botão Steam 1-Clique\n\n` +
      `🌐 Acompanhe ao vivo pelo navegador: ${roomUrl}`;

    return this.replyMessage(from, statusText, msg);
  }

  loadConfig() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(raw);
      }
      if (fs.existsSync(CONFIG_DEFAULT_PATH)) {
        const raw = fs.readFileSync(CONFIG_DEFAULT_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        this.saveConfig(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('[WHATSAPP] Falha ao carregar whatsappConfig.json:', e.message);
    }
    return {
      enabled: true,
      targetGroupId: '',
      targetGroupName: '',
      notifyOnCreate: true,
      notifyOnMissingSlots: true,
      notifyOnReady: true,
      notifyOnResult: true,
      prefix: '!mix',
      autoReconnect: true,
    };
  }

  saveConfig(newConfig = null) {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.warn('[WHATSAPP] Falha ao salvar whatsappConfig.json:', e.message);
    }
    return this.config;
  }

  async initialize() {
    if (!this.config.enabled) {
      console.log('[WHATSAPP] Integração desativada nas configurações.');
      return;
    }
    await this.connect();
  }

  async connect() {
    if (this.isConnecting || this.status === 'connected') return;
    this.isConnecting = true;
    this.status = 'connecting';

    try {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      let version = [2, 3000, 1015901307];
      try {
        const fetched = await fetchLatestBaileysVersion();
        if (fetched?.version) version = fetched.version;
      } catch (_) {}

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('CS2 Mix Hub'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrRaw = qr;
          try {
            this.qrCode = await qrcode.toDataURL(qr, { margin: 2, scale: 7 });
            this.status = 'qrcode';
            console.log('[WHATSAPP] Novo QR Code gerado para conexão! Acesse /whatsapp para escanear.');
          } catch (e) {
            console.warn('[WHATSAPP] Erro ao converter QR code em DataURL:', e.message);
          }
        }

        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && this.config.autoReconnect !== false;

          console.warn(`[WHATSAPP] Conexão encerrada (código: ${statusCode}). Reconectar: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            this.status = 'disconnected';
            this.clearAuthState();
          } else if (shouldReconnect) {
            this.status = 'connecting';
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch(() => {});
            }, 5000);
          } else {
            this.status = 'disconnected';
          }
        } else if (connection === 'open') {
          this.isConnecting = false;
          this.status = 'connected';
          this.qrCode = null;
          this.qrRaw = null;
          this.pairingCode = null;

          const phone = this.sock.user?.id?.split(':')[0] || this.sock.user?.id?.split('@')[0] || '';
          this.user = {
            id: this.sock.user?.id,
            name: this.sock.user?.name || 'CS2 Mix Hub Bot',
            phone,
          };

          console.log(`✅ [WHATSAPP] Conectado com sucesso como: ${this.user.name} (${phone})`);

          // Fetch participating groups in background with retries to allow state sync
          this.fetchGroups().catch(() => {});
          setTimeout(() => this.fetchGroups().catch(() => {}), 2000);
          setTimeout(() => this.fetchGroups().catch(() => {}), 6000);
          setTimeout(() => this.fetchGroups().catch(() => {}), 15000);
        }
      });

      // Simple commands listener for group chats & direct messages
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
          if (!chatUpdate?.messages || !Array.isArray(chatUpdate.messages)) return;
          for (const msg of chatUpdate.messages) {
            await this.handleIncomingMessage(msg);
          }
        } catch (e) {
          console.warn('[WHATSAPP] Erro ao processar mensagem recebida:', e.message);
        }
      });

      // 1-Click Emoji Reactions Listener (👍 = Entrar, 🚪/❌ = Sair, ⚔️ = Sortear)
      this.sock.ev.on('messages.reaction', async (reactions) => {
        try {
          if (!reactions || !Array.isArray(reactions)) return;
          for (const r of reactions) {
            if (!r.reaction || !r.key) continue;
            const emoji = r.reaction.text;
            if (!emoji) continue;

            const from = r.key.remoteJid;
            if (!from || !from.endsWith('@g.us')) continue;

            const participantJid = r.key.participant || (r.key.fromMe ? this.sock.user?.id : null);
            if (!participantJid) continue;

            const senderPhone = participantJid.replace(/\D/g, '').split(':')[0] || '';
            if (!senderPhone) continue;

            const profiles = this.loadPlayerProfiles();
            const profile = profiles[`wa_${senderPhone}`] || profiles[senderPhone];
            const senderName = profile?.username || profile?.name || `Jogador_${senderPhone.slice(-4)}`;

            console.log(`👍 [WHATSAPP REACTION] ${senderName} (${senderPhone}) reagiu com "${emoji}" em ${from}`);

            if (emoji === '👍' || emoji === '✅' || emoji === '🎮' || emoji === '➕') {
              await this.handleIncomingMessage({
                key: { remoteJid: from, participant: participantJid, fromMe: false },
                message: { conversation: '!entrar' },
                pushName: senderName,
              });
            } else if (emoji === '❌' || emoji === '🚪' || emoji === '➖') {
              await this.handleIncomingMessage({
                key: { remoteJid: from, participant: participantJid, fromMe: false },
                message: { conversation: '!sair' },
                pushName: senderName,
              });
            } else if (emoji === '⚔️' || emoji === '🎲') {
              await this.handleIncomingMessage({
                key: { remoteJid: from, participant: participantJid, fromMe: false },
                message: { conversation: '!sortear' },
                pushName: senderName,
              });
            }
          }
        } catch (e) {
          console.warn('[WHATSAPP] Erro ao processar reações:', e.message);
        }
      });

    } catch (err) {
      this.isConnecting = false;
      this.status = 'disconnected';
      console.warn('[WHATSAPP] Erro ao inicializar socket do WhatsApp:', err.message);
    }
  }

  async replyMessage(from, text, msg = null) {
    if (!this.sock) return false;
    try {
      let res;
      // In groups, only quote if participant is present and not sent by me
      if (msg && !msg.key?.fromMe && msg.key?.participant) {
        res = await this.sock.sendMessage(from, { text }, { quoted: msg });
      } else {
        res = await this.sock.sendMessage(from, { text });
      }
      console.log(`📤 [WHATSAPP ENVIADO] Mensagem enviada para ${from}`);
      return res;
    } catch (err) {
      console.warn(`[WHATSAPP] Falha no reply com quoted: ${err.message}. Enviando direto.`);
      try {
        const res = await this.sock.sendMessage(from, { text });
        console.log(`📤 [WHATSAPP ENVIADO] Mensagem enviada direto para ${from}`);
        return res;
      } catch (err2) {
        console.error(`[WHATSAPP] Erro ao enviar mensagem: ${err2.message}`);
        return false;
      }
    }
  }

  async handleIncomingMessage(msg) {
    const from = msg.key.remoteJid;
    if (!from) return;

    const rawText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      '';

    const clean = rawText.trim();
    if (!clean) return;

    // Se a mensagem foi enviada pelo dono do bot (fromMe),
    // SÓ processamos se começar com '!' (comando de controle digitado pelo dono).
    // Isso evita qualquer loop com respostas automáticas do bot.
    if (msg.key?.fromMe && !clean.startsWith('!')) return;

    const senderJid = msg.key.fromMe
      ? (this.sock.user?.id || from)
      : (msg.key.participant || from);
    const senderPhone = senderJid.replace(/\D/g, '').split(':')[0] || this.user?.phone || '';
    const senderName = msg.key.fromMe
      ? (this.user?.name || 'Alex Nunes')
      : (msg.pushName || `Jogador_${senderPhone.slice(-4)}`);
    const lower = clean.toLowerCase();

    console.log(`💬 [WHATSAPP MSG] De ${senderName} (${senderPhone}) em ${from}: "${clean}"`);

    // Auto-discover and cache group when receiving messages
    if (from.endsWith('@g.us') && !this.groups.has(from) && this.sock) {
      this.sock.groupMetadata(from).then((meta) => {
        if (meta) {
          this.groups.set(from, {
            id: from,
            subject: meta.subject || 'Grupo CS2',
            size: meta.participants?.length || 0,
            desc: meta.desc || '',
          });
          this.saveCachedGroups();
        }
      }).catch(() => {});
    }

    // 0. ATIVAR / VINCULAR GRUPO DIRETAMENTE PELO WHATSAPP
    if (
      from.endsWith('@g.us') &&
      (lower === '!ativar' ||
        lower === '!vincular' ||
        lower === '!mix grupo' ||
        lower === '!mix ativar' ||
        lower === '!setgroup')
    ) {
      let groupName = 'Grupo CS2';
      try {
        if (this.sock) {
          const meta = await this.sock.groupMetadata(from);
          if (meta && meta.subject) groupName = meta.subject;
        }
      } catch (_) {}

      this.saveConfig({
        targetGroupId: from,
        targetGroupName: groupName,
      });

      this.groups.set(from, {
        id: from,
        subject: groupName,
        size: 0,
        desc: '',
      });
      this.saveCachedGroups();

      const activateMsg =
        `🎯 *CS2 MIX HUB • GRUPO VINCULADO COM SUCESSO!*\n\n` +
        `Este grupo (*${groupName}*) foi definido como o canal oficial de avisos e comandos do Mix!\n\n` +
        `📢 *O que será enviado aqui automaticamente:*\n` +
        `• Convocação ao criar novo mix\n` +
        `• Alerta de vagas restantes (8/10 e 9/10)\n` +
        `• Escalação de times, capitães e mapa sorteado\n` +
        `• IP do servidor com botão Steam 1-Clique\n` +
        `• Placar final e MVP da partida com estatísticas\n\n` +
        `🎮 *Comandos rápidos disponíveis:*\n` +
        `• *!fila* - Ver jogadores na fila e times\n` +
        `• *!entrar* - Entrar na fila do mix ativo\n` +
        `• *!sair* - Sair da fila\n` +
        `• *!ip* - Obter o IP de conexão do CS2\n` +
        `• *!lvl 15* - Salvar seu nível Gamers Club`;

      return this.replyMessage(from, activateMsg, msg);
    }

    // Normalização inteligente de comandos e suporte ao prefixo !mix <subcomando>
    let cmd = lower;
    if (cmd.startsWith('!mix ')) {
      const rest = cmd.slice(5).trim();
      if (rest.startsWith('entrar') || rest.startsWith('join') || rest.startsWith('jogar')) {
        cmd = '!entrar';
      } else if (rest.startsWith('sair') || rest.startsWith('leave')) {
        cmd = '!sair';
      } else if (rest.startsWith('sortear') || rest.startsWith('times') || rest.startsWith('draw')) {
        cmd = '!sortear';
      } else if (rest.startsWith('ip') || rest.startsWith('servidor') || rest.startsWith('connect')) {
        cmd = '!ip';
      } else if (rest.startsWith('fila') || rest.startsWith('status') || rest.startsWith('players') || rest.startsWith('jogadores')) {
        cmd = '!fila';
      } else if (rest.startsWith('cancelar') || rest.startsWith('cancel')) {
        cmd = '!cancelar';
      } else if (rest.startsWith('lvl') || rest.startsWith('gc') || rest.startsWith('level') || rest.startsWith('nivel')) {
        cmd = `!lvl ${rest.replace(/\D/g, '')}`;
      } else if (rest.startsWith('ajuda') || rest.startsWith('help') || rest.startsWith('comandos')) {
        cmd = '!ajuda';
      } else if (rest.startsWith('criar') || rest.startsWith('novo') || rest.startsWith('new')) {
        cmd = '!criar';
      } else if (rest.startsWith('perfil') || rest.startsWith('card') || rest.startsWith('link')) {
        cmd = '!perfil';
      } else if (rest.startsWith('enquete') || rest.startsWith('botoes') || rest.startsWith('poll') || rest.startsWith('painel')) {
        cmd = '!enquete';
      }
    }

    // 1. COMANDO PRINCIPAL: !mix ou !criar (Criação de Lobby 5v5 ou Exibição do Status)
    if (cmd === '!mix' || cmd === '!criar') {
      const activeData = this.getActiveMix();
      // Se já houver um mix ativo em andamento
      if (activeData && activeData.mix && activeData.mix.phase !== 'cancelled' && activeData.mix.phase !== 'finished') {
        if (cmd === '!criar') {
          return this.replyMessage(
            from,
            `⚠️ *Já existe um mix em andamento no momento!* (${activeData.mix.name || activeData.mix.id})\n\nDigite *!fila* para ver os jogadores ou *!cancelar* se desejar reiniciar a fila.`,
            msg
          );
        }
        return this.sendLobbyStatus(from, msg, activeData.mix);
      }

      // REGRA OBRIGATÓRIA: Verificar se o criador tem nível Gamers Club salvo!
      const profileKey = `wa_${senderPhone}`;
      let creatorLvl = this.getPlayerLevel(profileKey) || this.getPlayerLevel(senderPhone);

      // Suporte a criar já com nível embutido: ex: !mix 18 ou !criar 18
      const inlineLvlMatch = clean.match(/!(?:mix|criar)\s+(?:lvl\s*|level\s*|gc\s*)?(\d{1,2})/i);
      if (inlineLvlMatch) {
        const inline = parseInt(inlineLvlMatch[1], 10);
        if (inline >= 1 && inline <= 21) {
          this.savePlayerProfile(profileKey, { level: inline, username: senderName, phone: senderPhone, source: 'whatsapp' });
          this.savePlayerProfile(senderPhone, { level: inline, username: senderName, phone: senderPhone, source: 'whatsapp' });
          creatorLvl = inline;
        }
      }

      if (!creatorLvl) {
        const profileUrl = this.getPublicUrl(`/perfil?phone=${senderPhone}&nick=${encodeURIComponent(senderName)}`);
        const blockMsg =
          `⚠️ *ATENÇÃO, ${senderName.toUpperCase()}!*\n\n` +
          `🛑 *Você ainda não possui um Nível da Gamers Club cadastrado.*\n` +
          `Para não prejudicar o sorteio e o equilíbrio dos times, é *OBRIGATÓRIO* definir seu nível (1 a 21) antes de abrir a fila e assumir a vaga de Capitão!\n\n` +
          `👉 *Como definir seu nível agora (escolha uma opção):*\n` +
          `1️⃣ Digite aqui no chat: *!lvl <1-21>* (exemplo: *!lvl 18*)\n` +
          `2️⃣ Ou crie já com seu nível: *!mix <seu nível>* (exemplo: *!mix 18*)\n` +
          `3️⃣ Ou toque nos botões em 1 clique: ${profileUrl}\n\n` +
          `_Assim que definir seu nível, o lobby será aberto e sua vaga de Capitão estará garantida!_`;
        return this.replyMessage(from, blockMsg, msg);
      }

      // Criador possui nível: CRIA O LOBBY 5v5
      const mix = this.createMixFromWhatsApp(senderPhone, senderName);
      mix.players[0].level = creatorLvl;
      const notice = `🎉 *NOVO MIX 5v5 ABERTO COM SUCESSO!*\n👑 *Capitão:* *${senderName}* [Lvl ${creatorLvl} GC] criou a sala!`;
      return await this.sendLobbyStatus(from, msg, mix, notice);
    }

    // 2. IP DO SERVIDOR CS2 & CONEXÃO STEAM 1-CLIQUE (!ip, !servidor, !connect)
    if (cmd === '!ip' || cmd === '!servidor' || cmd === '!connect' || cmd === '!server') {
      const activeData = this.getActiveMix();
      const mix = activeData?.mix;
      const ip = (mix?.serverIp || this.config.serverConnect || this.discordBotRef?.config?.serverConnect || '').trim();
      const publicUrl = this.getPublicUrl();

      if (!ip) {
        return this.replyMessage(
          from,
          `⚠️ *Nenhum IP de servidor CS2 configurado no momento.*\n\nDefina o IP pelo site (${publicUrl}) ou no Discord com \`!servidor <ip:porta>\`.`,
          msg
        );
      }

      const cleanIp = ip.replace(/^connect\s+/i, '');
      const steamConnectUrl = `${publicUrl}/connect?ip=${encodeURIComponent(cleanIp)}`;

      const ipText =
        `💻 *SERVIDOR CS2 DO MIX*\n\n` +
        `🌐 *Endereço:* \`connect ${cleanIp}\`\n\n` +
        `🚀 *Conectar Direto no CS2 (Steam 1-Clique):*\n` +
        `👉 ${steamConnectUrl}\n\n` +
        `_(Basta tocar no link acima para abrir o Counter-Strike 2 automaticamente!)_`;

      return this.replyMessage(from, ipText, msg);
    }

    // 3. SALVAR NÍVEL GAMERS CLUB (!lvl, !gc, !level, !nivel)
    if (cmd.startsWith('!lvl') || cmd.startsWith('!gc') || cmd.startsWith('!level') || cmd.startsWith('!nivel')) {
      const parts = clean.split(/\s+/);
      const parsed = parseInt(parts[1] || cmd.replace(/\D/g, ''), 10);

      if (isNaN(parsed) || parsed < 1 || parsed > 21) {
        return this.replyMessage(
          from,
          `⚠️ *Nível inválido!*\nDigite um número de *1 a 21* correspondente ao seu nível na Gamers Club.\n\nExemplo: *!lvl 16*`,
          msg
        );
      }

      const profileKey = `wa_${senderPhone}`;
      this.savePlayerProfile(profileKey, {
        level: parsed,
        username: senderName,
        phone: senderPhone,
        source: 'whatsapp',
      });
      this.savePlayerProfile(senderPhone, {
        level: parsed,
        username: senderName,
        phone: senderPhone,
        source: 'whatsapp',
      });

      const badge = parsed >= 20 ? '👑 Major/Pro' : parsed >= 18 ? '🏆 Black/Elite' : parsed >= 14 ? '🥇 Ouro' : '🥈 Prata';

      // Atualiza ou insere no mix ativo se houver lobby aberto
      const activeData = this.getActiveMix();
      const mix = activeData?.mix;
      if (mix && mix.phase === 'lobby') {
        const found = mix.players?.find(p => p.id === profileKey || p.phone === senderPhone);
        if (found) {
          found.level = parsed;
          this.notifyDiscordLobbyUpdate(mix);
          const notice = `⭐ *NÍVEL ATUALIZADO NA FILA:* *${senderName}* atualizou seu perfil para *Lvl ${parsed} GC* (${badge})!`;
          return this.sendLobbyStatus(from, msg, mix, notice);
        } else if (mix.players?.length < 10) {
          // Se não estava no mix e há vagas: entra automaticamente!
          const newPlayer = {
            id: profileKey,
            nick: senderName,
            username: senderName,
            name: senderName,
            displayName: senderName,
            phone: senderPhone,
            level: parsed,
            source: 'whatsapp',
            ready: true,
          };
          mix.players.push(newPlayer);
          if (this.webRoomsRef && mix.id) {
            const room = this.webRoomsRef.get(mix.id);
            if (room && Array.isArray(room.players)) {
              room.players.push({ id: profileKey, nick: senderName, level: parsed, ready: true });
            }
          }
          this.notifyDiscordLobbyUpdate(mix);
          const notice = `🎉 *NÍVEL DEFINIDO E VAGA GARANTIDA!*\n*${senderName}* definiu seu nível como *Lvl ${parsed} GC* (${badge}) e entrou na fila!`;
          return this.sendLobbyStatus(from, msg, mix, notice);
        }
      }

      return this.replyMessage(
        from,
        `✅ *Nível Gamers Club Salvo com Sucesso!*\n\n` +
          `👤 *Jogador:* ${senderName}\n` +
          `⭐ *Nível GC:* *Lvl ${parsed}* (${badge})\n\n` +
          `Seu nível está salvo no sistema para sempre e garantirá que o sorteio forme times equilibrados!\n\n` +
          `👉 Digite *!entrar* para entrar no mix ativo ou *!mix* para ver a fila.`,
        msg
      );
    }

    // 4. MOSTRAR FILA / JOGADORES / STATUS DO LOBBY (!fila, !status, !jogadores, !players)
    if (cmd === '!fila' || cmd === '!jogadores' || cmd === '!players' || cmd === '!status') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix || activeData.mix.phase === 'cancelled' || activeData.mix.phase === 'finished') {
        const publicUrl = this.getPublicUrl();
        return this.replyMessage(
          from,
          `ℹ️ *Nenhum mix aberto no momento!*\n\nDigite *!mix* para criar um novo lobby 5v5 agora mesmo, ou acesse pelo navegador:\n👉 ${publicUrl}`,
          msg
        );
      }

      return this.sendLobbyStatus(from, msg, activeData.mix);
    }

    // 5. ENTRAR NO MIX PELO WHATSAPP (!entrar, !jogar, !join)
    if (cmd === '!entrar' || cmd === '!jogar' || cmd === '!join') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix || activeData.mix.phase === 'cancelled' || activeData.mix.phase === 'finished') {
        return this.replyMessage(
          from,
          `⚠️ *Não há nenhum mix aberto no momento.*\n\nDigite *!mix* para criar um novo lobby 5v5 agora mesmo!`,
          msg
        );
      }

      const mix = activeData.mix;
      const profileKey = `wa_${senderPhone}`;
      let savedLevel = this.getPlayerLevel(profileKey) || this.getPlayerLevel(senderPhone);

      // Suporte a entrar passando o nível direto: ex: !entrar 18 ou !entrar lvl 18
      const inlineLvlMatch = clean.match(/!(?:entrar|jogar|join)\s+(?:lvl\s*|level\s*|gc\s*)?(\d{1,2})/i);
      if (inlineLvlMatch) {
        const inline = parseInt(inlineLvlMatch[1], 10);
        if (inline >= 1 && inline <= 21) {
          this.savePlayerProfile(profileKey, { level: inline, username: senderName, phone: senderPhone, source: 'whatsapp' });
          this.savePlayerProfile(senderPhone, { level: inline, username: senderName, phone: senderPhone, source: 'whatsapp' });
          savedLevel = inline;
        }
      }

      // REGRA OBRIGATÓRIA: Bloqueia entrada se não tiver nível GC definido!
      if (!savedLevel) {
        const profileUrl = this.getPublicUrl(`/perfil?phone=${senderPhone}&nick=${encodeURIComponent(senderName)}`);
        const blockMsg =
          `⚠️ *ATENÇÃO, ${senderName.toUpperCase()}!*\n\n` +
          `🛑 *Você ainda não possui um Nível da Gamers Club cadastrado.*\n` +
          `Para não prejudicar o sorteio e manter os times equilibrados (Snake-Draft), é *OBRIGATÓRIO* definir seu nível (1 a 21) antes de entrar na fila!\n\n` +
          `👉 *Como definir seu nível agora (escolha uma opção):*\n` +
          `1️⃣ Digite aqui no chat: *!lvl <1 a 21>* (exemplo: *!lvl 18*)\n` +
          `2️⃣ Ou digite direto: *!entrar <seu nível>* (exemplo: *!entrar 18*)\n` +
          `3️⃣ Ou toque nos botões em 1 clique: ${profileUrl}\n\n` +
          `_Assim que você definir seu nível, sua vaga estará garantida na lista!_`;
        return this.replyMessage(from, blockMsg, msg);
      }

      if (mix.players?.length >= 10) {
        return this.replyMessage(
          from,
          `⚠️ *O lobby acabou de lotar (10/10 jogadores)!* Fique atento para o próximo mix ou digite *!sortear*.`,
          msg
        );
      }

      const alreadyIn = mix.players?.some(p => p.id === profileKey || p.phone === senderPhone || p.nick === senderName);
      if (alreadyIn) {
        return this.replyMessage(from, `ℹ️ Você já está confirmado nesta partida com [Lvl ${savedLevel} GC]!`, msg);
      }

      const newPlayer = {
        id: profileKey,
        nick: senderName,
        username: senderName,
        name: senderName,
        displayName: senderName,
        phone: senderPhone,
        level: savedLevel,
        source: 'whatsapp',
        ready: true,
      };

      mix.players.push(newPlayer);
      if (this.webRoomsRef && mix.id) {
        const room = this.webRoomsRef.get(mix.id);
        if (room && Array.isArray(room.players)) {
          room.players.push({
            id: profileKey,
            nick: senderName,
            level: savedLevel,
            ready: true,
          });
        }
      }
      this.notifyDiscordLobbyUpdate(mix);

      const count = mix.players.length;
      const notice = `✅ *VAGA CONFIRMADA:* *${senderName}* [Lvl ${savedLevel} GC] entrou na fila! (${count}/10 vagas ocupadas)`;
      await this.sendLobbyStatus(from, msg, mix, notice);

      if (count === 8 || count === 9) {
        this.notifyMissingSlots(mix);
      }
      return;
    }

    // 6. SAIR DO MIX (!sair, !leave)
    if (cmd === '!sair' || cmd === '!leave') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix) return;
      const mix = activeData.mix;
      const profileKey = `wa_${senderPhone}`;

      const idx = mix.players?.findIndex(p => p.id === profileKey || p.phone === senderPhone || p.nick === senderName);
      if (idx === -1 || idx === undefined) {
        return this.replyMessage(from, `⚠️ Você não está na fila deste mix.`, msg);
      }

      const removed = mix.players.splice(idx, 1)[0];
      if (this.webRoomsRef && mix.id) {
        const room = this.webRoomsRef.get(mix.id);
        if (room && Array.isArray(room.players)) {
          const rIdx = room.players.findIndex(p => p.id === profileKey);
          if (rIdx !== -1) room.players.splice(rIdx, 1);
        }
      }
      this.notifyDiscordLobbyUpdate(mix);

      const count = mix.players.length;
      const notice = `🚪 *VAGA LIBERADA:* *${removed?.nick || senderName}* saiu da fila (${count}/10 vagas ocupadas).`;
      return this.sendLobbyStatus(from, msg, mix, notice);
    }

    // 7. SORTEAR TIMES COM SNAKE-DRAFT GC (!sortear, !times)
    if (cmd === '!sortear' || cmd === '!times') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix || activeData.mix.phase === 'cancelled' || activeData.mix.phase === 'finished') {
        return this.replyMessage(
          from,
          `⚠️ *Nenhum mix ativo no momento para sortear.* Digite *!mix* para criar um!`,
          msg
        );
      }

      const mix = activeData.mix;
      if (!mix.players || mix.players.length < 2) {
        return this.replyMessage(
          from,
          `⚠️ *Jogadores insuficientes.* É necessário pelo menos 2 jogadores no lobby para sortear os times! (Atual: ${mix.players?.length || 0}/10)`,
          msg
        );
      }

      // Balance teams
      if (this.discordBotRef && typeof this.discordBotRef.balanceTeams === 'function') {
        this.discordBotRef.balanceTeams(mix);
      } else {
        this.balanceTeamsLocal(mix);
      }

      mix.phase = 'teams';

      if (this.webRoomsRef && mix.id) {
        const room = this.webRoomsRef.get(mix.id);
        if (room) {
          room.teamA = mix.teamA;
          room.teamB = mix.teamB;
          room.phase = 'teams';
        }
      }
      this.notifyDiscordLobbyUpdate(mix);

      const listA = (mix.teamA?.players || []).map((p, idx) => `${idx === 0 ? '👑 ' : ''}*${p.nick || p.username}* [Lvl ${p.level || 16}]`).join('\n• ');
      const listB = (mix.teamB?.players || []).map((p, idx) => `${idx === 0 ? '👑 ' : ''}*${p.nick || p.username}* [Lvl ${p.level || 16}]`).join('\n• ');

      const drawText =
        `⚔️ *CS2 MIX HUB • TIMES SORTEADOS (SNAKE-DRAFT GC)*\n\n` +
        `🔵 *TIME A (${mix.teamA?.side || 'CT'})* — Média Lvl ${mix.teamA?.avgLevel || 16}\n` +
        `• ${listA}\n\n` +
        `🟡 *TIME B (${mix.teamB?.side || 'TR'})* — Média Lvl ${mix.teamB?.avgLevel || 16}\n` +
        `• ${listB}\n\n` +
        `⚖️ *Equilíbrio do Confronto:* ${mix.balancePct || 95}%\n\n` +
        `👉 Digite *!ip* para receber o endereço do servidor CS2 e o link Steam 1-Clique!`;

      return this.replyMessage(from, drawText, msg);
    }

    // 8. CANCELAR O MIX ATIVO (!cancelar)
    if (cmd === '!cancelar') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix || activeData.mix.phase === 'cancelled' || activeData.mix.phase === 'finished') {
        return this.replyMessage(from, `⚠️ *Nenhum mix ativo no momento para cancelar.*`, msg);
      }

      const mix = activeData.mix;
      mix.phase = 'cancelled';

      if (this.discordBotRef && this.discordBotRef.activeMixes) {
        for (const [k, m] of this.discordBotRef.activeMixes.entries()) {
          if (m.id === mix.id) {
            this.discordBotRef.activeMixes.delete(k);
          }
        }
      }

      if (this.webRoomsRef && mix.id) {
        this.webRoomsRef.delete(mix.id);
        if (this.discordBotRef && typeof this.discordBotRef.onRoomUpdated === 'function') {
          try {
            this.discordBotRef.onRoomUpdated(mix.id, null);
          } catch (_) {}
        }
      }

      clearMixPersistence(mix.id);
      scheduleSave(50);

      return this.replyMessage(
        from,
        `❌ *O Mix 5v5 (${mix.name || mix.id}) foi cancelado!*\n\nPara iniciar uma nova partida, qualquer membro pode digitar *!mix*.`,
        msg
      );
    }

    // 9. DEFINIR PERFIL & NÍVEL GAMERS CLUB (!perfil, !card, !link)
    if (cmd === '!perfil' || cmd === '!card' || cmd === '!link') {
      const profileUrl = this.getPublicUrl(`/perfil?phone=${senderPhone}&nick=${encodeURIComponent(senderName)}`);
      const savedLvl = this.getPlayerLevel(`wa_${senderPhone}`);
      const text =
        `⭐ *DEFINIR SEU NÍVEL GAMERS CLUB & PERFIL*\n\n` +
        `👤 *Jogador:* ${senderName}\n` +
        `🏆 *Nível Atual:* ${savedLvl ? `*Lvl ${savedLvl} GC*` : '_Ainda não definido_'}\n\n` +
        `📱 *Clique no link abaixo para escolher seu nível (Botões 1 ao 21) e salvar seu perfil em 1 toque:*\n` +
        `👉 ${profileUrl}\n\n` +
        `_Ou se preferir, digite diretamente aqui no chat:_ *!lvl 18*`;
      return this.replyMessage(from, text, msg);
    }

    // 10. AJUDA E GUIA DE COMANDOS (!ajuda, !help, !comandos)
    if (cmd === '!ajuda' || cmd === '!help' || cmd === '!comandos') {
      const profileUrl = this.getPublicUrl(`/perfil?phone=${senderPhone}`);
      const helpText =
        `🤖 *COMANDOS OFICIAIS DO CS2 MIX HUB NO WHATSAPP*\n\n` +
        `• *!mix* — Cria um novo lobby 5v5 ou exibe a fila atual\n` +
        `• *!entrar* — Entra na fila do mix ativo (ou *!entrar <nível>*)\n` +
        `• *!sair* — Sai da fila e libera sua vaga\n` +
        `• *!sortear* — Sorteia os times A (CT) e B (TR) pelo Snake-Draft GC\n` +
        `• *!ip* — Envia o IP do servidor CS2 e o link Steam 1-Clique\n` +
        `• *!lvl <1-21>* — Salva seu nível Gamers Club permanente (ex: *!lvl 18*)\n` +
        `• *!perfil* — Link para abrir a tela com botões de nível GC (1 a 21)\n` +
        `• *!fila* — Exibe a lista dos 10 jogadores confirmados\n` +
        `• *!cancelar* — Cancela a partida atual para reiniciar\n\n` +
        `🔘 *Ações por Reação (1 Toque no chat):*\n` +
        `• 👍 Reagir para entrar no mix\n` +
        `• 🚪 Reagir para sair da fila\n` +
        `• ⚔️ Reagir para sortear os times\n\n` +
        `⭐ *Seu Perfil com Botões:* ${profileUrl}\n` +
        `🌐 *Hub Geral:* ${this.getPublicUrl()}`;

      return this.replyMessage(from, helpText, msg);
    }
  }

  async requestPairingCode(phoneNumber) {
    if (!this.sock) {
      await this.connect();
    }
    const cleanNumber = String(phoneNumber || '').replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      throw new Error('Número de telefone inválido. Insira com DDD (ex: 5511999998888).');
    }

    try {
      const code = await this.sock.requestPairingCode(cleanNumber);
      this.pairingCode = code;
      return code;
    } catch (e) {
      console.warn('[WHATSAPP] Erro ao solicitar Pairing Code:', e.message);
      throw e;
    }
  }

  async fetchGroups(force = false) {
    if (!this.sock || this.status !== 'connected') {
      return Array.from(this.groups.values());
    }
    try {
      const groupData = await this.sock.groupFetchAllParticipating();
      if (groupData && typeof groupData === 'object') {
        const list = [];
        for (const [id, g] of Object.entries(groupData)) {
          const item = {
            id,
            subject: g.subject || 'Grupo sem nome',
            size: g.participants?.length || 0,
            desc: g.desc || '',
          };
          this.groups.set(id, item);
          list.push(item);
        }
        this.saveCachedGroups();
        return list;
      }
      return Array.from(this.groups.values());
    } catch (e) {
      console.warn('[WHATSAPP] Falha ao listar grupos:', e.message);
      return Array.from(this.groups.values());
    }
  }

  async resolveGroupFromInput(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // 1. If it's a JID directly: 120363023456@g.us
    if (trimmed.endsWith('@g.us')) {
      const existing = this.groups.get(trimmed);
      let subject = existing?.subject || 'Grupo CS2';
      if (!existing && this.sock && this.status === 'connected') {
        try {
          const meta = await this.sock.groupMetadata(trimmed);
          if (meta?.subject) subject = meta.subject;
        } catch (_) {}
      }
      const item = { id: trimmed, subject, size: existing?.size || 0, desc: '' };
      this.groups.set(trimmed, item);
      this.saveCachedGroups();
      return item;
    }

    // 2. If it's an invite link: https://chat.whatsapp.com/XXXXX
    const match = trimmed.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
    if (match && match[1] && this.sock && this.status === 'connected') {
      try {
        const info = await this.sock.groupGetInviteInfo(match[1]);
        if (info && info.id) {
          const jid = info.id.includes('@g.us') ? info.id : `${info.id}@g.us`;
          const item = {
            id: jid,
            subject: info.subject || 'Grupo CS2',
            size: info.size || info.participants?.length || 0,
            desc: info.desc || '',
          };
          this.groups.set(jid, item);
          this.saveCachedGroups();
          return item;
        }
      } catch (e) {
        console.warn('[WHATSAPP] Erro ao resolver link de convite:', e.message);
      }
    }

    // 3. Match by name from cached groups
    for (const g of this.groups.values()) {
      if (g.subject.toLowerCase().includes(trimmed.toLowerCase())) {
        return g;
      }
    }

    return null;
  }

  async sendMessageToGroup(text, targetJid = null, mentions = []) {
    if (!this.sock || this.status !== 'connected') return false;
    const dest = typeof targetJid === 'string' && targetJid.includes('@') ? targetJid : this.config.targetGroupId;
    const mentionsList = Array.isArray(targetJid) ? targetJid : (Array.isArray(mentions) ? mentions : []);
    if (!dest) {
      console.warn('[WHATSAPP] Nenhum grupo configurado para envio de mensagens.');
      return false;
    }

    try {
      const payload = { text };
      if (mentionsList.length > 0) {
        payload.mentions = mentionsList;
      }
      await this.sock.sendMessage(dest, payload);
      return true;
    } catch (e) {
      console.warn(`[WHATSAPP] Erro ao enviar mensagem para ${dest}:`, e.message);
      return false;
    }
  }

  detectBestHostUrl() {
    if (this.config.publicUrl && this.config.publicUrl.trim()) {
      return this.config.publicUrl.trim();
    }
    if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.trim()) {
      return process.env.PUBLIC_URL.trim();
    }
    try {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
            return `http://${net.address}:3000`;
          }
        }
      }
    } catch (_) {}
    return 'http://localhost:3000';
  }

  getPublicUrl(subpath = '') {
    const base = this.detectBestHostUrl();
    return `${base.replace(/\/$/, '')}${subpath}`;
  }

  // ==========================================
  // NOTIFICATION DISPATCHERS
  // ==========================================

  async notifyMixCreated(mix) {
    if (!this.config.notifyOnCreate || !this.config.targetGroupId) return;
    const mixId = mix.id || 'MIX';
    const alertKey = `create_${mixId}`;
    if (this.recentAlerts.has(alertKey)) return;
    this.recentAlerts.set(alertKey, Date.now());

    const url = this.getPublicUrl(`/?room=${mixId}`);
    const rank = mix.rankingSystem === 'faceit' ? 'FACEIT' : 'Gamers Club';

    const msg =
      `🔥 *NOVO MIX CS2 ABERTO!*\n\n` +
      `🎮 *Sala:* ${mix.name || `Mix #${mixId}`}\n` +
      `🏆 *Equilíbrio:* Por Nível da ${rank}\n` +
      `👥 *Vagas:* 1/10 jogadores na sala\n\n` +
      `Bora fechar o 5v5! Clique no link abaixo para entrar direto no lobby pelo celular ou PC:\n` +
      `👉 ${url}`;

    await this.sendMessageToGroup(msg);
  }

  async notifyMissingSlots(mix) {
    if (!this.config.notifyOnMissingSlots || !this.config.targetGroupId) return;
    const count = mix.players?.length || 0;
    if (count !== 8 && count !== 9) return;

    const alertKey = `slots_${mix.id}_${count}`;
    if (this.recentAlerts.has(alertKey)) return;
    this.recentAlerts.set(alertKey, Date.now());

    const remaining = 10 - count;
    const url = this.getPublicUrl(`/?room=${mix.id}`);

    const msg =
      `🚨 *FALTAM APENAS ${remaining} VAGA(S) NO MIX CS2!*\n\n` +
      `🎮 *Sala:* ${mix.name || `Mix #${mix.id}`}\n` +
      `👥 *Status:* ${count}/10 jogadores confirmados!\n\n` +
      `Falta quase nada para sortear os times e começar o Pick & Ban de mapas!\n` +
      `👉 Garanta seu slot: ${url}`;

    await this.sendMessageToGroup(msg);
  }

  async notifyMatchReady(mix) {
    if (!this.config.notifyOnReady || !this.config.targetGroupId) return;
    const alertKey = `ready_${mix.id}`;
    if (this.recentAlerts.has(alertKey)) return;
    this.recentAlerts.set(alertKey, Date.now());

    const map = mix.matchMap || mix.veto?.deciderMap?.name || 'Mirage';
    const capA = mix.teamA?.captain?.username || mix.teamA?.captain?.name || mix.teamA?.players?.[0]?.name || 'Time A';
    const capB = mix.teamB?.captain?.username || mix.teamB?.captain?.name || mix.teamB?.players?.[0]?.name || 'Time B';
    const serverIp = (mix.serverIp || this.config.serverConnect || '').trim();
    const url = this.getPublicUrl(`/?room=${mix.id}`);

    let msg =
      `⚔️ *PARTIDA DE CS2 PRONTA PARA COMEÇAR!*\n\n` +
      `🗺️ *Mapa:* ${map}\n` +
      `🛡️ *Time A:* Capitão ${capA} (${mix.teamA?.side || 'CT'})\n` +
      `💣 *Time B:* Capitão ${capB} (${mix.teamB?.side || 'TR'})\n\n`;

    if (serverIp) {
      msg += `💻 *Servidor CS2:* \`connect ${serverIp}\`\n\n`;
    }

    msg +=
      `Acompanhe a vida, dinheiro e placar ao vivo pelo Hub:\n` +
      `👉 ${url}\n\n` +
      `GL & HF a todos os 10 jogadores! 🔥`;

    await this.sendMessageToGroup(msg);
  }

  async notifyMatchFinished(mix, result) {
    if (!this.config.notifyOnResult || !this.config.targetGroupId) return;
    const alertKey = `finished_${mix.id}`;
    if (this.recentAlerts.has(alertKey)) return;
    this.recentAlerts.set(alertKey, Date.now());

    const map = result.map || mix.matchMap || mix.veto?.deciderMap?.name || 'Mirage';
    const winnerSide = result.winner === 'A' ? 'Time A' : result.winner === 'B' ? 'Time B' : result.winner;
    const url = this.getPublicUrl();

    let msg =
      `🏆 *FIM DE JOGO NO MIX CS2!*\n\n` +
      `🗺️ *Mapa:* ${map}\n` +
      `📊 *Placar:* ${result.score || '13-X'}\n` +
      `👑 *Vencedor:* ${winnerSide}!\n`;

    const mentions = [];
    if (result.mvp) {
      const mvpNick = typeof result.mvp === 'object' ? (result.mvp.nick || result.mvp.name || 'Destaque') : result.mvp;
      const stats = typeof result.mvp === 'object' ? result.mvp : (result.mvpStats || null);
      const phone = stats?.phone || (typeof result.mvp === 'object' ? result.mvp.phone : null);

      msg += `\n👑 *MVP DA PARTIDA ELEITO:* ${phone ? `@${phone}` : mvpNick}\n`;
      if (stats && (stats.kills !== undefined || stats.kd !== undefined)) {
        const kda = `🎯 ${stats.kills || 0} Kills | 💀 ${stats.deaths || 0} Mortes | ⚡ K/D ${stats.kd || '1.0'}`;
        const roundMvps = stats.mvps ? ` | ⭐ ${stats.mvps} MVPs` : '';
        const ratingStr = stats.rating ? ` | 📈 Rating ${stats.rating}` : '';
        msg += `⭐ *Estatísticas:* ${kda}${roundMvps}${ratingStr}\n`;
      }
      msg += `🎖️ *Desempenho decisivo eleito automaticamente pelas estatísticas do confronto!*\n`;

      if (phone) {
        mentions.push(`${phone}@s.whatsapp.net`);
      }
    }

    msg +=
      `\nParabéns a todos os jogadores! O próximo mix já pode ser criado no site:\n` +
      `👉 ${url}`;

    await this.sendMessageToGroup(msg, this.config.targetGroupId, mentions);
  }

  async clearAuthState() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
      this.user = null;
      this.status = 'disconnected';
      this.qrCode = null;
      this.pairingCode = null;
      console.log('[WHATSAPP] Sessão limpa com sucesso.');
    } catch (e) {
      console.warn('[WHATSAPP] Erro ao limpar pasta auth:', e.message);
    }
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end(new Error('Logout manual'));
      }
    } catch (_) {}
    await this.clearAuthState();
    this.status = 'disconnected';
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      pairingCode: this.pairingCode,
      user: this.user,
      config: this.config,
      groupsCount: this.groups.size,
    };
  }
}

export const whatsappBot = new WhatsAppBotManager();
export default whatsappBot;
