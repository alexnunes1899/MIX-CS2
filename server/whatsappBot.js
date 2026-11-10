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

const DATA_DIR = path.join(__dirname, 'data');
const AUTH_DIR = path.join(DATA_DIR, 'whatsapp_auth');
const CONFIG_PATH = path.join(DATA_DIR, 'whatsappConfig.json');
const CONFIG_DEFAULT_PATH = path.join(DATA_DIR, 'whatsappConfig.default.json');

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

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    const clean = text.trim().toLowerCase();
    const prefix = (this.config.prefix || '!mix').toLowerCase();

    if (clean === '!mix' || clean === '!jogos' || clean === '!status' || clean === prefix) {
      const publicUrl = process.env.PUBLIC_URL || 'https://mix-cs2-production.up.railway.app';
      const replyText =
        `🎮 *CS2 MIX HUB • SALAS & COMANDOS*\n\n` +
        `Para criar ou entrar em um Mix 5v5 com sorteio balanceado de times por Level da Gamers Club e Pick & Ban oficial de mapas, acesse o link:\n` +
        `👉 ${publicUrl}\n\n` +
        `• *!mix status* - Ver status do bot\n` +
        `• *!mix ajuda* - Informações sobre o sistema`;

      await this.sock.sendMessage(from, { text: replyText }, { quoted: msg }).catch(() => {});
    } else if (clean === '!mix ajuda' || clean === '!mix help') {
      const replyText =
        `ℹ️ *CS2 MIX HUB BOT*\n\n` +
        `Eu sou o bot oficial de avisos de partidas da comunidade de CS2!\n` +
        `Aqui neste grupo eu notifico:\n` +
        `• Quando um novo mix é aberto;\n` +
        `• Quando faltam 1 ou 2 vagas para fechar o 5v5;\n` +
        `• Quando os times são sorteados e o mapa é definido;\n` +
        `• Placar final e MVP das partidas finalizadas!`;

      await this.sock.sendMessage(from, { text: replyText }, { quoted: msg }).catch(() => {});
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
