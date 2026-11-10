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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_DIR = path.join(DATA_DIR, 'whatsapp_auth');
const CONFIG_PATH = path.join(DATA_DIR, 'whatsappConfig.json');
const CONFIG_DEFAULT_PATH = path.join(DATA_DIR, 'whatsappConfig.default.json');
const PROFILES_PATH = path.join(DATA_DIR, 'playerProfiles.json');

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
  }

  setStoreRefs(discordBot, webRooms) {
    if (discordBot) this.discordBotRef = discordBot;
    if (webRooms) this.webRoomsRef = webRooms;
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
        if (m && m.phase !== 'cancelled') return { source: 'discord', mix: m };
      }
    }
    // 2. Check active Web rooms
    if (this.webRoomsRef && this.webRoomsRef.size > 0) {
      for (const r of this.webRoomsRef.values()) {
        if (r && r.phase !== 'finished') return { source: 'web', mix: r };
      }
    }
    return null;
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

          // Fetch participating groups in background
          this.fetchGroups().catch(() => {});
        }
      });

      // Simple commands listener for group chats
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
          if (!chatUpdate?.messages || chatUpdate.type !== 'notify') return;
          for (const msg of chatUpdate.messages) {
            if (msg.key.fromMe) continue;
            await this.handleIncomingMessage(msg);
          }
        } catch (e) {
          console.warn('[WHATSAPP] Erro ao processar mensagem recebida:', e.message);
        }
      });

    } catch (err) {
      this.isConnecting = false;
      this.status = 'disconnected';
      console.warn('[WHATSAPP] Erro ao inicializar socket do WhatsApp:', err.message);
    }
  }

  async handleIncomingMessage(msg) {
    const from = msg.key.remoteJid;
    if (!from) return;

    const rawText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    const clean = rawText.trim();
    if (!clean) return;

    const senderJid = msg.key.participant || from;
    const senderPhone = senderJid.replace(/\D/g, '');
    const senderName = msg.pushName || `Jogador_${senderPhone.slice(-4)}`;
    const lower = clean.toLowerCase();

    // 1. IP DO SERVIDOR CS2 & CONEXÃO STEAM 1-CLIQUE
    if (lower === '!ip' || lower === '!servidor' || lower === '!connect' || lower === '!server') {
      const activeData = this.getActiveMix();
      const mix = activeData?.mix;
      const ip = (mix?.serverIp || this.config.serverConnect || this.discordBotRef?.config?.serverConnect || '').trim();
      const publicUrl = this.getPublicUrl();

      if (!ip) {
        return this.sock.sendMessage(from, {
          text: `⚠️ *Nenhum IP de servidor CS2 configurado no momento.*\n\nDefina o IP pelo site (${publicUrl}) ou no Discord com \`!servidor <ip:porta>\`.`
        }, { quoted: msg }).catch(() => {});
      }

      const cleanIp = ip.replace(/^connect\s+/i, '');
      const steamConnectUrl = `${publicUrl}/connect?ip=${encodeURIComponent(cleanIp)}`;

      const ipText =
        `💻 *SERVIDOR CS2 DO MIX*\n\n` +
        `🌐 *Endereço:* \`connect ${cleanIp}\`\n\n` +
        `🚀 *Conectar Direto no CS2 (Steam 1-Clique):*\n` +
        `👉 ${steamConnectUrl}\n\n` +
        `_(Basta tocar no link acima para abrir o Counter-Strike 2 automaticamente!)_`;

      return this.sock.sendMessage(from, { text: ipText }, { quoted: msg }).catch(() => {});
    }

    // 2. SALVAR NÍVEL GAMERS CLUB (GC)
    if (lower.startsWith('!lvl') || lower.startsWith('!gc') || lower.startsWith('!level')) {
      const parts = clean.split(/\s+/);
      const parsed = parseInt(parts[1], 10);

      if (isNaN(parsed) || parsed < 1 || parsed > 21) {
        return this.sock.sendMessage(from, {
          text: `⚠️ *Nível inválido!*\nDigite um número de *1 a 21* correspondente ao seu nível na Gamers Club.\n\nExemplo: *!lvl 16*`
        }, { quoted: msg }).catch(() => {});
      }

      const profileKey = `wa_${senderPhone}`;
      this.savePlayerProfile(profileKey, {
        level: parsed,
        username: senderName,
        phone: senderPhone,
        source: 'whatsapp',
      });

      // Update in active mix if already joined
      const activeData = this.getActiveMix();
      if (activeData?.mix?.players) {
        const found = activeData.mix.players.find(p => p.id === profileKey || p.phone === senderPhone);
        if (found) {
          found.level = parsed;
        }
      }

      const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';

      return this.sock.sendMessage(from, {
        text: `✅ *Nível Gamers Club Salvo com Sucesso!*\n\n` +
          `👤 *Jogador:* ${senderName}\n` +
          `⭐ *Nível GC:* *Lvl ${parsed}* (${badge})\n\n` +
          `Seu nível está salvo no sistema e garantirá que o sorteio forme times equilibrados!`
      }, { quoted: msg }).catch(() => {});
    }

    // 3. MOSTRAR FILA / JOGADORES / STATUS DO LOBBY
    if (lower === '!fila' || lower === '!jogadores' || lower === '!players' || lower === '!mix' || lower === '!status') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix) {
        const publicUrl = this.getPublicUrl();
        return this.sock.sendMessage(from, {
          text: `ℹ️ *Nenhum mix aberto no momento!*\n\nCrie uma nova partida agora pelo Hub:\n👉 ${publicUrl}`
        }, { quoted: msg }).catch(() => {});
      }

      const mix = activeData.mix;
      const count = mix.players?.length || 0;
      const remaining = Math.max(0, 10 - count);
      const publicUrl = this.getPublicUrl(`/?room=${mix.id}`);

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

      const statusText =
        `🎮 *CS2 MIX 5v5 • STATUS DO LOBBY*\n` +
        `📍 *Sala:* ${mix.name || `Mix #${mix.id}`}\n` +
        `👥 *Vagas:* *${count}/10* (${remaining} restante(s))\n\n` +
        `📋 *Lista de Jogadores Confirmados:*\n` +
        `${listStr}\n` +
        `💬 *Comandos Rápidos no WhatsApp:*\n` +
        `• Digite *!entrar* para garantir sua vaga\n` +
        `• Digite *!sair* para liberar sua vaga\n` +
        `• Digite *!lvl <1-21>* para salvar seu nível GC\n` +
        `• Digite *!ip* para ver o servidor e conectar\n\n` +
        `👉 Ou acesse pelo navegador: ${publicUrl}`;

      return this.sock.sendMessage(from, { text: statusText }, { quoted: msg }).catch(() => {});
    }

    // 4. ENTRAR NO MIX PELO WHATSAPP
    if (lower === '!entrar' || lower === '!jogar' || lower === '!join') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix) {
        return this.sock.sendMessage(from, {
          text: `⚠️ *Não há nenhum mix aberto no momento.*\nCrie uma sala primeiro em: ${this.getPublicUrl()}`
        }, { quoted: msg }).catch(() => {});
      }

      const mix = activeData.mix;
      const profileKey = `wa_${senderPhone}`;
      const savedLevel = this.getPlayerLevel(profileKey);

      if (mix.players?.length >= 10) {
        return this.sock.sendMessage(from, {
          text: `⚠️ *O lobby acabou de lotar (10/10 jogadores)!* Fique atento para o próximo mix.`
        }, { quoted: msg }).catch(() => {});
      }

      const alreadyIn = mix.players?.some(p => p.id === profileKey || p.phone === senderPhone || p.nick === senderName);
      if (alreadyIn) {
        return this.sock.sendMessage(from, {
          text: `ℹ️ Você já está confirmado nesta partida!`
        }, { quoted: msg }).catch(() => {});
      }

      const newPlayer = {
        id: profileKey,
        nick: senderName,
        username: senderName,
        name: senderName,
        phone: senderPhone,
        level: savedLevel || 16,
        source: 'whatsapp',
        ready: true,
      };

      mix.players.push(newPlayer);
      if (activeData.source === 'discord' && typeof this.discordBotRef?.syncToWebRoom === 'function') {
        this.discordBotRef.syncToWebRoom(mix);
      }

      const count = mix.players.length;
      let reply = `✅ *Você entrou no Mix CS2!* (${count}/10)\n\n👤 *${senderName}* [Lvl ${savedLevel || 16} GC]`;
      if (!savedLevel) {
        reply += `\n\n💡 *Dica:* Digite *!lvl <1 a 21>* para salvar seu nível real da Gamers Club e equilibrar os times!`;
      }

      await this.sock.sendMessage(from, { text: reply }, { quoted: msg }).catch(() => {});

      if (count === 8 || count === 9) {
        this.notifyMissingSlots(mix);
      }
      return;
    }

    // 5. SAIR DO MIX
    if (lower === '!sair' || lower === '!leave') {
      const activeData = this.getActiveMix();
      if (!activeData || !activeData.mix) return;
      const mix = activeData.mix;
      const profileKey = `wa_${senderPhone}`;

      const idx = mix.players?.findIndex(p => p.id === profileKey || p.phone === senderPhone || p.nick === senderName);
      if (idx === -1 || idx === undefined) {
        return this.sock.sendMessage(from, {
          text: `⚠️ Você não está na fila deste mix.`
        }, { quoted: msg }).catch(() => {});
      }

      mix.players.splice(idx, 1);
      if (activeData.source === 'discord' && typeof this.discordBotRef?.syncToWebRoom === 'function') {
        this.discordBotRef.syncToWebRoom(mix);
      }

      return this.sock.sendMessage(from, {
        text: `🚪 *Você saiu da fila do Mix.* (${mix.players.length}/10 vagas ocupadas).`
      }, { quoted: msg }).catch(() => {});
    }

    // 6. AJUDA E COMANDOS
    if (lower === '!ajuda' || lower === '!help') {
      const helpText =
        `🤖 *COMANDOS DO BOT CS2 NO WHATSAPP*\n\n` +
        `• *!fila* ou *!mix* - Ver a lista dos 10 jogadores e status do lobby\n` +
        `• *!entrar* - Entrar na fila do mix direto pelo WhatsApp\n` +
        `• *!sair* - Sair da fila do mix\n` +
        `• *!ip* - Ver o IP do servidor e link para conectar pela Steam\n` +
        `• *!lvl <1-21>* - Salvar seu nível da Gamers Club (ex: *!lvl 18*)\n` +
        `• *!ajuda* - Ver esta lista de comandos\n\n` +
        `🌐 *Hub Web:* ${this.getPublicUrl()}`;

      return this.sock.sendMessage(from, { text: helpText }, { quoted: msg }).catch(() => {});
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

  async fetchGroups() {
    if (!this.sock || this.status !== 'connected') return [];
    try {
      const groupData = await this.sock.groupFetchAllParticipating();
      this.groups.clear();
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
      return list;
    } catch (e) {
      console.warn('[WHATSAPP] Falha ao listar grupos:', e.message);
      return Array.from(this.groups.values());
    }
  }

  async sendMessageToGroup(text, targetJid = null) {
    if (!this.sock || this.status !== 'connected') return false;
    const dest = targetJid || this.config.targetGroupId;
    if (!dest) {
      console.warn('[WHATSAPP] Nenhum grupo configurado para envio de mensagens.');
      return false;
    }

    try {
      await this.sock.sendMessage(dest, { text });
      return true;
    } catch (e) {
      console.warn(`[WHATSAPP] Erro ao enviar mensagem para ${dest}:`, e.message);
      return false;
    }
  }

  getPublicUrl(subpath = '') {
    const base = process.env.PUBLIC_URL || 'https://mix-cs2-production.up.railway.app';
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

    if (result.mvp) {
      msg += `⭐ *MVP da Partida:* ${result.mvp}\n`;
    }

    msg +=
      `\nParabéns a todos os jogadores! O próximo mix já pode ser criado no site:\n` +
      `👉 ${url}`;

    await this.sendMessageToGroup(msg);
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
