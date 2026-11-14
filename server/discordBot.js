/**
 * CS2 Mix Hub • Official Discord Bot Engine (Ultra-Refined & Dynamic eSports Edition)
 * Full-featured competitive Discord Bot with Slash Commands, interactive Buttons,
 * 10/10 Ready Check (Anti-AFK), automatic Snake-Draft Elo balancing,
 * Valve Major Map Pick & Ban with Side Pick (CT/TR), map thumbnails,
 * Web Room synchronization, practice CFGs, Grenade guides, Coin flip, and Voice Mover.
 */

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  AttachmentBuilder,
  ChannelType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  loadMatchHistory as loadUnifiedMatchHistory,
  saveMatchHistory as saveUnifiedMatchHistory,
  recordMatchHistoryEntry,
  computeMatchMvp,
  computeMatchPerformers,
  determineMatchWinner,
  getMapImageUrl,
  normalizeMapName,
} from './matchHistory.js';
import { scheduleSave, clearMixPersistence } from './mixPersistence.js';
import { hardwareDealsManager, CATEGORY_LABELS } from './hardwareDeals.js';
import { SteamScannerService } from './steamScanner.js';
import { cs2NewsRadar } from './cs2NewsRadar.js';
import { proMatchesAgenda } from './proMatchesAgenda.js';
import { freeGamesRadar } from './freeGamesRadar.js';
import { communityClips } from './communityClips.js';
import { bagreVoteService } from './bagreVote.js';
import { executeRconCommand } from './rcon.js';
import { getLeaderboard, syncDiscordProfilesToLeaderboard } from './leaderboard.js';
import { generateGsiConfig, installGsiLocally } from './gsi.js';
import { sanitizeRconTextArg, isValidServerAddress, normalizeRoomId, parseServerConnect } from './utils/security.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'discordBotConfig.json');
const PROFILES_FILE = path.join(DATA_DIR, 'playerProfiles.json');
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'matchHistory.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const ROULETTE_STATE_FILE = path.join(DATA_DIR, 'mapRouletteState.json');

// Validates numeric Discord Snowflake ID (17 to 20 digits)
export const isSnowflake = (id) => typeof id === 'string' && /^\d{17,20}$/.test(id);

// Default Active Duty Maps for Pick & Ban with official CDN images
const OFFICIAL_MAPS = [
  {
    id: 'de_mirage',
    name: 'Mirage',
    emoji: '🏜️',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png',
  },
  {
    id: 'de_inferno',
    name: 'Inferno',
    emoji: '🔥',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_1_png.png',
  },
  {
    id: 'de_nuke',
    name: 'Nuke',
    emoji: '☢️',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_nuke_1_png.png',
  },
  {
    id: 'de_dust2',
    name: 'Dust II',
    emoji: '☀️',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
  },
  {
    id: 'de_ancient',
    name: 'Ancient',
    emoji: '🌿',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
  },
  {
    id: 'de_anubis',
    name: 'Anubis',
    emoji: '🏺',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
  },
  {
    id: 'de_cache',
    name: 'Cache',
    emoji: '🏭',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
  },
];

// Tactical Grenade Lineups by Map
const GRENADE_GUIDES = {
  mirage: [
    { title: 'Smoke Janela (Window)', desc: 'Spawn TR ➔ Encoste na lixeira, agache, mire no topo da grade e solte com Jumpthrow + tecla D.' },
    { title: 'Smoke Cabecinha (Top Mid / Cat)', desc: 'Spawn TR ➔ Encoste na porta, mire na ponta da antena e solte com Jumpthrow normal.' },
    { title: 'Smoke Passagem (B Short / Jungle)', desc: 'Spawn TR ➔ Encoste no pilar, mire na quina da torre e clique com o botão esquerdo.' },
    { title: 'Smoke CT (Bomb A)', desc: 'Caverna (A Main) ➔ Suba na madeira, mire no topo do prédio e Jumpthrow.' },
  ],
  inferno: [
    { title: 'Smoke Caixão (Coffin B)', desc: 'Banana ➔ Encoste nos sacos de areia, mire na quina do telhado e clique com botão esquerdo.' },
    { title: 'Smoke CT (Bomb B)', desc: 'Banana ➔ Atrás do tronco de madeira, mire no topo da torre e solte com Jumpthrow.' },
    { title: 'Smoke Meio / Moto (A)', desc: 'Segundo Meio ➔ Mire na viga do telhado da casa e solte em corrida suave.' },
  ],
  nuke: [
    { title: 'Smoke Fora 1 (Secret Wall)', desc: 'Fora TR ➔ Encoste na grade do caminhão, mire no topo da caixa amarela e Jumpthrow.' },
    { title: 'Smoke Fora 2 (Red Box)', desc: 'Fora TR ➔ Alinhe na quina da cerca e mire na chaminé alta com Jumpthrow.' },
    { title: 'Smoke Main / Céu (Bomb A)', desc: 'Lobby / Telhado ➔ Quebre o vidro, mire na quina da caixa de ventilação e solte com botão esquerdo.' },
  ],
  dust2: [
    { title: 'Smoke Porta Meio (Mid Doors)', desc: 'Spawn TR ➔ Alinhe no portão de ferro, mire na ponta da antena e solte com botão esquerdo.' },
    { title: 'Smoke Fundo / Long A (Corner)', desc: 'Long Doors ➔ Encoste no barril azul, mire na beirada da parede e Jumpthrow.' },
    { title: 'Smoke Passagem B (B Doors)', desc: 'Túnel Superior ➔ Encoste na quina da caixa e Jumpthrow na fresta do teto.' },
  ],
  ancient: [
    { title: 'Smoke Donut', desc: 'Pátio A ➔ Suba no degrau, mire na ponta da folha e solte com Jumpthrow.' },
    { title: 'Smoke Red / Meio', desc: 'Spawn TR ➔ Mire no topo da estátua de pedra e solte em movimento suave.' },
    { title: 'Smoke Caverna / Ramp B', desc: 'Fora B ➔ Encoste na parede esquerda do pilar, mire acima da moldura de pedra e solte com Jumpthrow.' },
  ],
  anubis: [
    { title: 'Smoke Conector / B', desc: 'Ruínas B ➔ Encoste no pilar de pedra, mire no topo do arco e Jumpthrow.' },
    { title: 'Smoke Meio / Canal', desc: 'Canal ➔ Alinhe na escada de madeira e mire na quina da parede.' },
    { title: 'Smoke Heaven / Câmera A', desc: 'Main A ➔ Encoste na porta dupla e alinhe no topo da pilastra direita com Jumpthrow.' },
  ],
  overpass: [
    { title: 'Smoke Lixeira / Dumpster (A)', desc: 'Fundo / Long A ➔ Encoste no poste da cerca, mire acima do poste elétrico e solte com Jumpthrow.' },
    { title: 'Smoke Banco (A Site)', desc: 'Banheiro A ➔ Encoste na quina antes da saída, mire no topo do letreiro e Jumpthrow.' },
    { title: 'Smoke Céu / Passarela (B)', desc: 'Água / Sapo ➔ Alinhe no corrimão de ferro, mire na antena do prédio e solte com Jumpthrow.' },
  ],
  train: [
    { title: 'Smoke Ivy / Olof (A)', desc: 'Saída T-Main ➔ Encoste na parede da direita, mire na quina do prédio industrial e Jumpthrow.' },
    { title: 'Smoke Z / Conector (A)', desc: 'Pombo / T-Main ➔ Alinhe na caixa elétrica e mire no fio superior direito com Jumpthrow.' },
    { title: 'Smoke Bomb B (Upper)', desc: 'Rampa B ➔ Encoste na porta antes da passarela, mire na janela alta e clique com botão esquerdo.' },
  ],
  cache: [
    { title: 'Smoke Cruz (Main A)', desc: 'Galpão A ➔ Encoste no muro branco, mire no canto da claraboia e clique com botão esquerdo.' },
    { title: 'Smoke Empilhadeira / Quad (A)', desc: 'Squeaky ➔ Mire no topo da estrutura de metal à esquerda e solte em passo curto.' },
    { title: 'Smoke CT / Passarela (B)', desc: 'Checkers / Rampa B ➔ Encoste no engradado, mire na barra de ferro superior e Jumpthrow.' },
  ],
  vertigo: [
    { title: 'Smoke CT / Elevador (A)', desc: 'Rampa A ➔ Encoste no saco de cimento, mire acima do guindaste vermelho e clique com botão esquerdo.' },
    { title: 'Smoke Sandbag / Esquerda (A)', desc: 'Rampa A ➔ Encoste na parede amarela e alinhe no topo da viga metálica.' },
    { title: 'Smoke Gerador (B)', desc: 'Escada B ➔ Alinhe no degrau médio, mire na borda da caixa elétrica e clique com botão esquerdo.' },
  ],
};

const GRENADE_MAP_ALIASES = {
  mir: 'mirage',
  mirage: 'mirage',
  inf: 'inferno',
  infer: 'inferno',
  inferno: 'inferno',
  nuk: 'nuke',
  nuke: 'nuke',
  d2: 'dust2',
  dd2: 'dust2',
  dust: 'dust2',
  dust2: 'dust2',
  dustii: 'dust2',
  anc: 'ancient',
  ancient: 'ancient',
  anu: 'anubis',
  anubis: 'anubis',
  ovp: 'overpass',
  over: 'overpass',
  overpass: 'overpass',
  trn: 'train',
  train: 'train',
  cac: 'cache',
  cache: 'cache',
  vrg: 'vertigo',
  vert: 'vertigo',
  vertigo: 'vertigo',
};

export function resolveGrenadeMapKey(query) {
  const raw = String(query || '').toLowerCase().trim();
  if (!raw) return 'mirage';
  const normalized = raw.replace(/^de_/, '').replace(/[^a-z0-9]/g, '');
  if (!normalized) return 'mirage';
  if (GRENADE_MAP_ALIASES[normalized]) return GRENADE_MAP_ALIASES[normalized];
  const exact = Object.keys(GRENADE_GUIDES).find((k) => k === normalized);
  if (exact) return exact;
  const partial = Object.keys(GRENADE_GUIDES).find((k) => k.startsWith(normalized) || normalized.includes(k));
  return partial || null;
}

export function extractHostAndPort(rawServer) {
  const parsed = parseServerConnect(rawServer || '');
  if (parsed.valid) {
    return {
      host: parsed.host,
      port: parsed.port,
      hostPort: parsed.hostPort,
      normalized: parsed.normalized,
      password: parsed.password,
    };
  }
  const stripped = String(rawServer || '')
    .replace(/^connect\s+/i, '')
    .split(';')[0]
    .replace(/["']/g, '')
    .trim();
  const colonIdx = stripped.lastIndexOf(':');
  const host = colonIdx !== -1 ? stripped.slice(0, colonIdx).trim() : stripped;
  const portCandidate = colonIdx !== -1 ? parseInt(stripped.slice(colonIdx + 1), 10) : 27015;
  const port = !Number.isNaN(portCandidate) && portCandidate >= 1 && portCandidate <= 65535 ? portCandidate : 27015;
  return {
    host,
    port,
    hostPort: host ? `${host}:${port}` : '',
    normalized: host ? `${host}:${port}` : '',
    password: '',
  };
}

/**
 * Steam A2S_INFO UDP Server Query Protocol
 * Queries live CS2 dedicated server status (ping, current map, players count).
 */
export function queryA2SServer(hostWithPort, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const { host, port } = extractHostAndPort(hostWithPort);

    if (!host) {
      return resolve({ online: false, error: 'Endereço de IP inválido.' });
    }

    const socket = dgram.createSocket('udp4');
    const startTime = Date.now();
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch (e) {}
    };

    timer = setTimeout(() => {
      cleanup();
      resolve({
        online: false,
        host,
        port,
        error: 'Tempo limite esgotado (servidor offline ou porta UDP bloqueada).',
      });
    }, timeoutMs);

    const basePacket = Buffer.from([
      0xff, 0xff, 0xff, 0xff,
      0x54, // 'T'
      0x53, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6e, 0x67, 0x69, 0x6e, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00,
    ]);

    socket.on('error', (err) => {
      cleanup();
      resolve({ online: false, host, port, error: err.message });
    });

    socket.on('message', (msg) => {
      if (msg.length < 5) return;
      const header = msg.readInt32LE(0);
      if (header !== -1) return;
      const type = msg.readUInt8(4);

      // Challenge response (0x41)
      if (type === 0x41 && msg.length >= 9) {
        const challenge = msg.subarray(5, 9);
        const challengePacket = Buffer.concat([basePacket, challenge]);
        socket.send(challengePacket, port, host, (err) => {
          if (err) {
            cleanup();
            resolve({ online: false, host, port, error: err.message });
          }
        });
        return;
      }

      // A2S_INFO Response (0x49)
      if (type === 0x49) {
        const ping = Date.now() - startTime;
        cleanup();
        try {
          let offset = 5;
          const protocol = msg.readUInt8(offset++);

          const readString = () => {
            const nullIdx = msg.indexOf(0x00, offset);
            if (nullIdx === -1) return '';
            const str = msg.toString('utf8', offset, nullIdx);
            offset = nullIdx + 1;
            return str;
          };

          const name = readString();
          const map = readString();
          const folder = readString();
          const game = readString();
          offset += 2; // Steam App ID
          const players = msg.readUInt8(offset++);
          const maxPlayers = msg.readUInt8(offset++);
          const bots = msg.readUInt8(offset++);

          resolve({
            online: true,
            host,
            port,
            ping,
            name,
            map,
            players,
            maxPlayers,
            bots,
          });
        } catch (e) {
          resolve({
            online: true,
            host,
            port,
            ping,
            name: 'Servidor CS2',
            map: 'de_mirage',
            players: 0,
            maxPlayers: 10,
            bots: 0,
          });
        }
      }
    });

    try {
      socket.send(basePacket, port, host, (err) => {
        if (err) {
          cleanup();
          resolve({ online: false, host, port, error: err.message });
        }
      });
    } catch (err) {
      cleanup();
      resolve({ online: false, host, port, error: err.message });
    }
  });
}

export class DiscordBotManager {
  constructor() {
    this.client = null;
    this.config = this.loadConfig();
    this.status = {
      running: false,
      tag: null,
      id: null,
      guildCount: 0,
      ping: null,
      lastError: null,
      startedAt: null,
    };
    // In-memory active mixes keyed by channelId
    this.activeMixes = new Map();
    this.mixes = this.activeMixes;
    this.lastFinishedMixes = new Map();
    // Reference to Web Hub rooms store
    this.webRoomsRef = null;
    // Valve CS2 Game State Integration cache
    this.lastGsiState = null;
    this.lastBestGsiState = null;
    this.narrationEnabled = false;
    this.channelNarrationEnabled = new Map();
    this._hlTrackers = new Map();
    // Multi-player GSI state tracking (keyed by steamId)
    this.playersGsiStates = new Map();
    // Active Live Match Discord message trackers for real-time round-by-round auto-editing
    this.liveTrackers = new Map();
    this.liveTrackersSyncInterval = null;
    this._isSyncingLiveTrackers = false;
    this._isDispatchingDeals = false;
    this._isCheckingCs2Updates = false;
    this._initialDealsTimeout = null;
    this._initialUpdatesTimeout = null;

    this.startLiveTrackersSyncLoop();
  }

  startLiveTrackersSyncLoop() {
    if (this.liveTrackersSyncInterval) {
      clearInterval(this.liveTrackersSyncInterval);
    }
    // Auto-sync live trackers periodically every 1.0 second (real-time Discord rate)
    this.liveTrackersSyncInterval = setInterval(() => {
      if (this.liveTrackers && this.liveTrackers.size > 0 && this.lastGsiState) {
        this.syncLiveTrackers(this.lastGsiState).catch(() => {});
      }
    }, 1000);
    this.liveTrackersSyncInterval.unref?.();
  }

  getUniqueActiveMixes() {
    const seen = new Set();
    const list = [];
    for (const m of this.activeMixes.values()) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      list.push(m);
    }
    return list;
  }

  isGuildModerator(member, guild, mix = null, userId = null) {
    const uid = userId || member?.id || member?.user?.id;
    if (mix && uid && mix.creatorId === uid) return true;
    if (guild && uid && guild.ownerId === uid) return true;
    const perms = member?.permissions;
    if (perms && typeof perms.has === 'function') {
      if (perms.has(PermissionsBitField.Flags.ManageGuild) || perms.has(PermissionsBitField.Flags.Administrator)) {
        return true;
      }
    }
    return false;
  }

  setWebRoomsReference(roomsRef) {
    this.webRoomsRef = roomsRef;
  }

  getPublicWebUrl(path = '') {
    const base = (
      this.config.publicWebUrl ||
      process.env.PUBLIC_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : 'https://mix-cs2.onrender.com')
    ).replace(/\/+$/, '');
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    return `${base}${cleanPath}`;
  }

  isGsiOnline(state = this.lastGsiState) {
    if (!state) return false;
    const lastTime = state.receivedAt || state.lastUpdate || 0;
    return Boolean(
      Date.now() - lastTime < 90000 &&
        (state.player?.name || state.rawPlayer?.name)
    );
  }

  isLocalWindowsHost() {
    return (
      process.platform === 'win32' &&
      !process.env.RENDER &&
      !process.env.RAILWAY_ENVIRONMENT
    );
  }

  buildGsiAttachment(roomId = 'MIX-PRO') {
    const safeRoomId = normalizeRoomId(roomId, 'MIX-PRO');
    const cfgContent = generateGsiConfig(this.getPublicWebUrl(''), safeRoomId);
    return new AttachmentBuilder(Buffer.from(cfgContent, 'utf8'), {
      name: 'gamestate_integration_cs2mixhub.cfg',
    });
  }

  buildGsiInstallReplyPayload(
    roomId = 'MIX-PRO',
    { isHostModerator = false, tryLocalInstall = false } = {}
  ) {
    const safeRoomId = normalizeRoomId(roomId, 'MIX-PRO');
    const baseUrl = this.getPublicWebUrl('');
    const cfgUrl = `${baseUrl}/api/gsi/cfg/${safeRoomId}`;
    const ps1Url = `${baseUrl}/api/gsi/installer/ps1/${safeRoomId}`;
    const webGsiUrl =
      safeRoomId !== 'MIX-PRO'
        ? `${baseUrl}/?room=${encodeURIComponent(safeRoomId)}&gsi=1`
        : `${baseUrl}/?gsi=1`;
    const ps1Cmd = `powershell -NoP -ExecutionPolicy Bypass -Command "irm '${ps1Url}' | iex"`;
    const cs2CfgPath =
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg';

    let localRes = null;
    if (tryLocalInstall && this.isLocalWindowsHost() && isHostModerator) {
      localRes = installGsiLocally(baseUrl, safeRoomId);
    }

    const embed = new EmbedBuilder().setTimestamp();

    if (localRes?.success) {
      embed
        .setTitle('✅ GSI INSTALADO NO SEU CS2 (PC HOST)!')
        .setColor(0x10b981)
        .setDescription(
          `O arquivo oficial foi gravado diretamente na pasta do seu Counter-Strike 2 (sem precisar baixar \`.bat\`):\n` +
            `\`${localRes.primaryPath || `${cs2CfgPath}\\gamestate_integration_cs2mixhub.cfg`}\`\n\n` +
            `🎮 **Agora é só abrir o CS2 e jogar!** O card do \`/aovivo\` será atualizado automaticamente.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👥 **Quer passar para um amigo instalar no PC dele (sem \`.bat\`)?**\n` +
            `• **Automático em 1 comando:** aperte **Win + R**, cole e dê **Enter**:\n` +
            `\`\`\`powershell\n${ps1Cmd}\n\`\`\`\n` +
            `• **Ou baixe o \`.cfg\` anexado acima** e salve em:\n\`${cs2CfgPath}\``
        )
        .setFooter({ text: `Sala GSI: ${safeRoomId} • Zero .bat` });
    } else {
      embed
        .setTitle('⚡ INSTALAR VALVE GSI (SEM .BAT E SEM BLOQUEIOS)')
        .setColor(0x38bdf8)
        .setDescription(
          `Escolha o jeito mais rápido — **sem arquivo \`.bat\`** e **sem bloqueio do Windows Defender**:\n\n` +
            `**1️⃣ Instalação Automática em 1 Comando (detecta a Steam sozinho):**\n` +
            `Pressione **Win + R** no Windows, cole o comando abaixo e aperte **Enter**:\n` +
            `\`\`\`powershell\n${ps1Cmd}\n\`\`\`\n` +
            `*(Encontra sua pasta do CS2 em qualquer HD/SSD e instala o \`.cfg\` em 1 segundo!)*\n\n` +
            `**2️⃣ Baixar o \`.cfg\` Direto aqui no Discord (1 Clique):**\n` +
            `Clique no ícone de download do arquivo **\`gamestate_integration_cs2mixhub.cfg\`** anexado acima (ou no botão **Baixar .cfg Direto** abaixo) e coloque em:\n` +
            `\`${cs2CfgPath}\`\n\n` +
            `💡 *Basta **1 jogador** da partida ter o GSI ativo para o placar, HP, economia e MVP funcionarem ao vivo para todos!*`
        )
        .setFooter({ text: `Sala GSI: ${safeRoomId} • Oficial Valve & VAC-Safe` });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Baixar .cfg Direto')
        .setEmoji('📥')
        .setStyle(ButtonStyle.Link)
        .setURL(cfgUrl),
      new ButtonBuilder()
        .setLabel('Painel Web GSI')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(webGsiUrl)
    );

    if (this.isLocalWindowsHost() && !localRes?.success && isHostModerator) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`gsi_install_host:${safeRoomId}`)
          .setLabel('Instalar no PC Host')
          .setEmoji('💻')
          .setStyle(ButtonStyle.Success)
      );
    }

    const attachment = this.buildGsiAttachment(safeRoomId);
    return { embeds: [embed], components: [row], files: [attachment] };
  }

  isOfficialCompetitiveMap(rawMapName = '') {
    const clean = String(rawMapName || '').toLowerCase().trim().replace(/^workshop\/\d+\//, '');
    if (!clean || clean === 'indefinido') return false;
    if (clean.startsWith('aim_') || clean.startsWith('fy_') || clean.startsWith('gg_') || clean.startsWith('surf_') || clean.startsWith('kz_')) {
      return false;
    }
    return /^(de_)?(mirage|inferno|nuke|dust2|ancient|anubis|vertigo|overpass|train|cache)$/.test(clean);
  }

  isNarrationActive(mix = null, channelId = null) {
    if (mix && typeof mix.narrationEnabled === 'boolean') {
      return mix.narrationEnabled;
    }
    const chId = channelId || mix?.channelId;
    if (chId) {
      return Boolean(this.channelNarrationEnabled?.get(chId));
    }
    return Boolean(this.narrationEnabled);
  }

  toggleNarration(mix = null, channelId = null) {
    const chId = channelId || mix?.channelId || null;
    const nextState = !this.isNarrationActive(mix, chId);
    if (mix) {
      mix.narrationEnabled = nextState;
      if (mix.channelId && this.channelNarrationEnabled) {
        this.channelNarrationEnabled.set(mix.channelId, nextState);
      }
    } else if (chId && this.channelNarrationEnabled) {
      this.channelNarrationEnabled.set(chId, nextState);
    } else {
      this.narrationEnabled = nextState;
    }
    return nextState;
  }

  stopMixNarration(mix = null, channelId = null) {
    if (mix) {
      mix.narrationEnabled = false;
    }
    const chId = channelId || mix?.channelId;
    if (chId && this.channelNarrationEnabled) {
      this.channelNarrationEnabled.set(chId, false);
    }
  }

  getActiveLiveMix(roomOrChannelId = null, currentCs2Map = null, liveState = null) {
    const now = Date.now();
    const maxMixAgeMs = 4 * 3600 * 1000;

    const isValidLiveMix = (m) => {
      if (!m || m.phase === 'finished' || m.phase === 'cancelled' || m.phase === 'lobby' || m.phase === 'ready_check') return false;
      if (!m.teamA?.players?.length || !m.teamB?.players?.length) return false;
      if (m.createdAt && (now - m.createdAt > maxMixAgeMs)) return false;
      if (currentCs2Map && !this.isOfficialCompetitiveMap(currentCs2Map)) return false;
      return true;
    };

    const explicitId = roomOrChannelId && roomOrChannelId !== 'MIX-PRO' ? String(roomOrChannelId) : null;
    if (explicitId) {
      const direct =
        this.activeMixes.get(explicitId) ||
        this.getUniqueActiveMixes().find((m) => m.id === explicitId || m.channelId === explicitId);
      return isValidLiveMix(direct) ? direct : null;
    }

    const validMixes = this.getUniqueActiveMixes().filter(isValidLiveMix);
    if (validMixes.length === 0) return null;

    if (liveState) {
      const gsiNames = new Set();
      const gsiSteamIds = new Set();
      const addId = (sid, name) => {
        const s = String(sid || '').trim();
        if (s) gsiSteamIds.add(s);
        const n = String(name || '').toLowerCase().trim();
        if (n && n.length >= 2) gsiNames.add(n);
      };
      if (liveState.player) addId(liveState.player.steamId || liveState.player.steamid, liveState.player.name);
      if (liveState.rawPlayer) addId(liveState.rawPlayer.steamId || liveState.rawPlayer.steamid, liveState.rawPlayer.name);
      if (Array.isArray(liveState.allPlayersStats)) {
        liveState.allPlayersStats.forEach((p) => addId(p?.steamId || p?.steamid, p?.name));
      }

      if (gsiNames.size > 0 || gsiSteamIds.size > 0) {
        let bestMix = null;
        let bestScore = 0;
        for (const m of validMixes) {
          let score = 0;
          const roster = [...(m.teamA?.players || []), ...(m.teamB?.players || [])];
          for (const pl of roster) {
            if (!pl) continue;
            const pSid = String(pl.steamId || pl.steamid || '').trim();
            if (pSid && gsiSteamIds.has(pSid)) {
              score += 3;
              continue;
            }
            const names = [pl.displayName, pl.username, pl.nick, pl.name]
              .map((x) => String(x || '').toLowerCase().trim())
              .filter((x) => x.length >= 2);
            if (names.some((pn) => gsiNames.has(pn) || Array.from(gsiNames).some((gn) => gn.includes(pn) || pn.includes(gn)))) {
              score += 1;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestMix = m;
          }
        }
        if (bestMix && bestScore > 0) return bestMix;
      }
    }

    return validMixes.length === 1 ? validMixes[0] : null;
  }

  stopAllLiveMonitoring() {
    this.narrationEnabled = false;
    this.channelNarrationEnabled?.clear?.();
    for (const m of this.getUniqueActiveMixes()) {
      if (m) m.narrationEnabled = false;
    }
  }

  processLiveHighlightsAndHalftime(liveState, activeMix) {
    try {
      const targetCh = activeMix?.channelId || null;
      // SO NARRA SE O BOTAO DE NARRACAO TIVER SIDO ATIVADO PELO USUARIO!
      if (!this.isNarrationActive(activeMix, targetCh)) return;
      if (!liveState || liveState.phase === 'warmup' || !this.isOfficialCompetitiveMap(liveState.mapName)) return;

      this._hlTrackers = this._hlTrackers || new Map();
      const trackerKey = activeMix?.id || activeMix?.channelId || liveState?.roomId || 'global';
      if (!this._hlTrackers.has(trackerKey)) {
        this._hlTrackers.set(trackerKey, {
          mapName: '',
          roundNumber: -1,
          killsAtRoundStart: new Map(),
          clutchCandidateCT: null,
          clutchCandidateTR: null,
          announcedRound: -1,
          sentEvents: new Set(),
        });
      }
      const trk = this._hlTrackers.get(trackerKey);
      const sCT = Number(liveState.scoreCT || 0);
      const sTR = Number(liveState.scoreTR || 0);
      const totalRounds = sCT + sTR;
      const rNum = Number(liveState.roundNumber || totalRounds + 1);
      const allStats = Array.isArray(liveState.allPlayersStats) ? liveState.allPlayersStats : [];

      if (trk.mapName !== liveState.mapName || (totalRounds === 0 && liveState.roundPhase === 'freezetime')) {
        trk.mapName = liveState.mapName;
        trk.roundNumber = rNum;
        trk.killsAtRoundStart.clear();
        allStats.forEach((p) => trk.killsAtRoundStart.set(p.steamId || p.name, p.kills || 0));
        trk.clutchCandidateCT = null;
        trk.clutchCandidateTR = null;
        trk.announcedRound = -1;
        trk.sentEvents.clear();
      }

      if (liveState.roundPhase === 'freezetime' && trk.roundNumber !== rNum) {
        trk.roundNumber = rNum;
        trk.killsAtRoundStart.clear();
        allStats.forEach((p) => trk.killsAtRoundStart.set(p.steamId || p.name, p.kills || 0));
        trk.clutchCandidateCT = null;
        trk.clutchCandidateTR = null;
      }

      if (liveState.roundPhase === 'live') {
        const aliveCT = (liveState.teamCT || []).filter((p) => p.isAlive);
        const aliveTR = (liveState.teamTR || []).filter((p) => p.isAlive);

        if (aliveCT.length === 1 && aliveTR.length >= 2) {
          if (!trk.clutchCandidateCT || aliveTR.length > trk.clutchCandidateCT.enemies) {
            trk.clutchCandidateCT = { player: aliveCT[0], enemies: aliveTR.length };
          }
        }
        if (aliveTR.length === 1 && aliveCT.length >= 2) {
          if (!trk.clutchCandidateTR || aliveCT.length > trk.clutchCandidateTR.enemies) {
            trk.clutchCandidateTR = { player: aliveTR[0], enemies: aliveCT.length };
          }
        }
      }

      let targetChannelId = activeMix?.channelId || null;
      if (!targetChannelId && this.liveTrackers && this.liveTrackers.size === 1) {
        const onlyTracker = Array.from(this.liveTrackers.values())[0];
        targetChannelId = onlyTracker?.channelId || null;
      }
      const channel = targetChannelId ? this.client?.channels?.cache?.get(targetChannelId) : null;
      const cleanMap = normalizeMapName(liveState.mapName);
      const mixKey = trackerKey;

      if (liveState.roundPhase === 'over' && trk.announcedRound !== totalRounds && totalRounds > 0) {
        trk.announcedRound = totalRounds;
        const winSide = liveState.winTeam === 'CT' ? 'CT' : liveState.winTeam === 'T' || liveState.winTeam === 'TR' ? 'TR' : null;
        const messages = [];

        if (winSide === 'CT' && trk.clutchCandidateCT) {
          const c = trk.clutchCandidateCT;
          const evKey = `${mixKey}:R${totalRounds}:clutch:${c.player.name}`;
          if (!trk.sentEvents.has(evKey)) {
            trk.sentEvents.add(evKey);
            messages.push(`\ud83e\uddca \ud83d\udd25 **[CLUTCH 1v${c.enemies}!]** **${c.player.name}** garantiu o round sozinho de CT em **${cleanMap}**! (\`CT ${sCT} x ${sTR} TR\`)`);
          }
        } else if (winSide === 'TR' && trk.clutchCandidateTR) {
          const c = trk.clutchCandidateTR;
          const evKey = `${mixKey}:R${totalRounds}:clutch:${c.player.name}`;
          if (!trk.sentEvents.has(evKey)) {
            trk.sentEvents.add(evKey);
            messages.push(`\ud83e\uddca \ud83d\udd25 **[CLUTCH 1v${c.enemies}!]** **${c.player.name}** garantiu o round sozinho de TR em **${cleanMap}**! (\`CT ${sCT} x ${sTR} TR\`)`);
          }
        }

        const roundKillers = [];
        if (liveState.player && liveState.player.roundKills >= 4) {
          roundKillers.push({
            name: liveState.player.name,
            rk: liveState.player.roundKills,
            hs: liveState.player.roundKillHs || 0,
            weapon: liveState.player.activeWeapon?.name || 'Arma',
          });
        }

        allStats.forEach((p) => {
          const key = p.steamId || p.name;
          if (trk.killsAtRoundStart.has(key)) {
            const delta = (p.kills || 0) - (trk.killsAtRoundStart.get(key) || 0);
            if (delta >= 4 && delta <= 5 && !roundKillers.some((rk) => rk.name === p.name)) {
              roundKillers.push({ name: p.name, rk: delta, hs: 0, weapon: p.activeWeapon || 'Arma' });
            }
          }
          trk.killsAtRoundStart.set(key, p.kills || 0);
        });

        roundKillers.forEach((k) => {
          const evKey = `${mixKey}:R${totalRounds}:mk:${k.name}`;
          if (trk.sentEvents.has(evKey)) return;
          trk.sentEvents.add(evKey);
          const hsTxt = k.hs > 0 ? ` (${k.hs} HS \ud83c\udfaf)` : '';
          if (k.rk >= 5) {
            messages.push(`\ud83d\udd25 \ud83d\udc80 **[ACE NO SERVIDOR! 5 KILLS]** **${k.name}** varreu o time inteiro com **${k.weapon}**${hsTxt} em **${cleanMap}**!`);
          } else if (k.rk === 4) {
            messages.push(`\ud83d\udca5 \ud83c\udfaf **[QUADRA KILL - 4K!]** **${k.name}** levou **4 advers\u00e1rios** no round com **${k.weapon}**${hsTxt}!`);
          }
        });

        trk.clutchCandidateCT = null;
        trk.clutchCandidateTR = null;

        if (channel && messages.length > 0) {
          channel.send(messages.join('\n')).catch(() => {});
        }

        const halfKey = `${mixKey}:${liveState.mapName}:half12`;
        if (totalRounds === 12 && !trk.sentEvents.has(halfKey) && activeMix) {
          trk.sentEvents.add(halfKey);
          const oldSideA = (activeMix.teamA?.side || 'CT').toUpperCase();
          if (!activeMix.teamA.startingSide) {
            activeMix.teamA.startingSide = oldSideA;
          }
          if (!activeMix.teamB.startingSide) {
            activeMix.teamB.startingSide = (activeMix.teamB?.side || (oldSideA === 'CT' ? 'TR' : 'CT')).toUpperCase();
          }
          activeMix.teamA.halftimeSwapped = true;
          activeMix.teamB.halftimeSwapped = true;
          activeMix.teamA.side = oldSideA === 'CT' ? 'TR' : 'CT';
          activeMix.teamB.side = activeMix.teamA.side === 'CT' ? 'TR' : 'CT';
          this.syncToWebRoom(activeMix);

          if (channel) {
            channel.send(
              `\ud83d\udd04 \u23f1\ufe0f **[FIM DO 1\u00ba TEMPO \u2022 VIRADA DE LADO (HALF-TIME)]**\n` +
              `Placar parcial em **${cleanMap}**: **CT ${sCT} x ${sTR} TR**!\n` +
              `Os lados foram invertidos para o 2\u00ba tempo: **${activeMix.teamA.name}** (${activeMix.teamA.side}) vs **${activeMix.teamB.name}** (${activeMix.teamB.side})!`
            ).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[HIGHLIGHTS WARN]:', err.message);
    }
  }

  handleGsiEvent(roomId, liveState) {
    if (!liveState) return;

    const now = Date.now();
    const safeRoom = roomId || 'MIX-PRO';
    // SEMPRE atualiza o estado GSI para que o comando !aovivo / /aovivo funcione instantaneamente!
    this.lastGsiState = {
      ...liveState,
      roomId: safeRoom,
      receivedAt: now,
    };

    const steamId = liveState.player?.steamId || liveState.rawPlayer?.steamId;
    if (steamId) {
      this.playersGsiStates.set(steamId, {
        ...liveState,
        roomId: safeRoom,
        receivedAt: now,
      });
      if (this.playersGsiStates.size > 200) {
        const cutoff = now - 6 * 3600 * 1000;
        for (const [k, v] of this.playersGsiStates.entries()) {
          if (!v || (v.receivedAt || 0) < cutoff) {
            this.playersGsiStates.delete(k);
          }
        }
      }
    }

    // SEMPRE atualiza em tempo real os cards do !aovivo / /aovivo que estiverem abertos no Discord!
    if (this.liveTrackers && this.liveTrackers.size > 0) {
      this.syncLiveTrackers(this.lastGsiState).catch(() => {});
    }

    const explicitRoom = safeRoom !== 'MIX-PRO' ? safeRoom : null;
    const activeMix = this.getActiveLiveMix(explicitRoom, liveState.mapName, liveState);

    if (
      Array.isArray(liveState.allPlayersStats) &&
      liveState.allPlayersStats.length > 0 &&
      liveState.phase !== 'warmup' &&
      ((liveState.scoreCT || 0) + (liveState.scoreTR || 0) >= 1 || (liveState.roundNumber || 0) >= 1)
    ) {
      const bestSnapshot = {
        ...liveState,
        allPlayersStats: [...liveState.allPlayersStats],
        roomId: safeRoom,
        receivedAt: now,
      };
      this.lastBestGsiState = bestSnapshot;
      if (activeMix) {
        activeMix.liveState = bestSnapshot;
        activeMix.gsi = bestSnapshot;
      }
    }

    // So narra no chat se o Botao de Narracao tiver sido clicado (ON)!
    if (this.isNarrationActive(activeMix, activeMix?.channelId)) {
      this.processLiveHighlightsAndHalftime(this.lastGsiState, activeMix);
    }

    // Finalizacao automatica quando um Mix ativo atinge 13+ pontos ou gameover em mapa competitivo
    if (
      activeMix &&
      this.isOfficialCompetitiveMap(liveState.mapName) &&
      liveState.isGameOver &&
      ((liveState.scoreCT || 0) >= 13 || (liveState.scoreTR || 0) >= 13 || liveState.phase === 'gameover')
    ) {
      const matchingLastBest =
        this.lastBestGsiState &&
        !this.lastBestGsiState._consumedByMixId &&
        (!activeMix._minGsiTimestamp || (this.lastBestGsiState.receivedAt || 0) >= activeMix._minGsiTimestamp) &&
        (this.lastBestGsiState.roomId === activeMix.id || (!explicitRoom && this.lastBestGsiState.roomId === 'MIX-PRO'))
          ? this.lastBestGsiState
          : null;
      const statsSnapshot = activeMix.gsi || activeMix.liveState || matchingLastBest || liveState;
      const maxS = Math.max(statsSnapshot.scoreCT || 0, statsSnapshot.scoreTR || 0);
      const minS = Math.min(statsSnapshot.scoreCT || 0, statsSnapshot.scoreTR || 0);
      const matchFinishKey = `${activeMix.id}:${statsSnapshot.mapName || 'cs2'}:${maxS}-${minS}`;

      if (activeMix._autoFinalizedKey !== matchFinishKey) {
        activeMix._autoFinalizedKey = matchFinishKey;
        activeMix.liveState = statsSnapshot;
        activeMix.gsi = statsSnapshot;

        const winnerRes = determineMatchWinner(activeMix, statsSnapshot);
        const score = `${maxS}-${minS}`;
        const targetChannelId = activeMix.channelId;

        (async () => {
          try {
            let channel = targetChannelId ? this.client?.channels?.cache?.get(targetChannelId) : null;
            if (!channel && targetChannelId && this.client?.channels?.fetch) {
              channel = await this.client.channels.fetch(targetChannelId).catch(() => null);
            }
            const res = await this.recordMatchResult(
              activeMix,
              winnerRes.winnerLetter,
              score,
              { id: 'gsi_system', username: 'Valve CS2 GSI (Autom\u00e1tico)' },
              channel,
              statsSnapshot.mapName
            );
            if (res.success && channel) {
              await channel.send({
                content: `\ud83c\udfc6 **[FIM DO MIX DETECTADO NO CS2]** Partida finalizada automaticamente no mapa **${normalizeMapName(statsSnapshot.mapName || 'CS2')}** (\`${score}\`)!`,
                embeds: res.embeds,
                components: res.components,
              });
            }
            this.stopMixNarration(activeMix, targetChannelId);
            if (this.config.autoMoveVoice && channel?.guild) {
              await this.executeVoiceReturnToLobby(channel.guild, activeMix).catch(() => {});
            }
          } catch (err) {
            console.warn('[DISCORD BOT GSI AUTO-RESULT ERROR]:', err.message);
          }
        })();
      }
    }
  }
  buildGsiEmbed(roomId = 'MIX-PRO') {
    const safeRoomId = normalizeRoomId(roomId, 'MIX-PRO');
    const isOnline = this.isGsiOnline();
    const state = this.lastGsiState || {};
    const ps1Url = this.getPublicWebUrl(`/api/gsi/installer/ps1/${safeRoomId}`);
    const ps1Cmd = `powershell -NoP -ExecutionPolicy Bypass -Command "irm '${ps1Url}' | iex"`;

    const embed = new EmbedBuilder()
      .setTitle('📡 VALVE CS2 GAME STATE INTEGRATION (GSI)')
      .setColor(isOnline ? 0x22c55e : 0x38bdf8)
      .setDescription(
        `O **Valve GSI** permite ao bot monitorar e encerrar os mixes **ao vivo**, diretamente pelo CS2 de um dos jogadores!\n\n` +
          `**Status da Transmissão:** ${isOnline ? '🟢 **ONLINE (CS2 Conectado e Transmitindo)**' : '🔴 **AGUARDANDO CONEXÃO DO CS2**'}\n` +
          (isOnline
            ? `• **Mapa Atual:** \`${state.mapName || 'de_mirage'}\`\n` +
              `• **Placar ao Vivo:** **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** (Round ${state.roundNumber || 0})\n` +
              `• **Fase do Jogo:** \`${state.phase || 'live'}\`\n` +
              `• **Status da C4:** \`${state.bomb || 'none'}\`\n\n`
            : '\n') +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⭐ **COMO FUNCIONA (APENAS 1 JOGADOR PRECISA INSTALAR):**\n` +
          `• Não precisa de todos os 10 jogadores! Apenas **1 pessoa** (jogador, admin ou espectador) coloca o arquivo no CS2.\n` +
          `• O CS2 dele transmite automaticamente cada round para o bot via protocolo oficial da Valve.\n` +
          `• O bot encerra o mix **automaticamente** ao final do jogo (\`13-9\`, \`13-11\`) e computa o Ranking e Patentes sem ninguém precisar digitar \`!vitoria\`!\n\n` +
          `⚡ **COMO INSTALAR (ZERO \`.bat\`, ZERO BLOQUEIOS DO WINDOWS):**\n` +
          `• **Opção 1 (1 Clique no Discord):** Clique no botão verde **[⚡ Instalar GSI (1 Clique)]** abaixo ou baixe o arquivo **\`gamestate_integration_cs2mixhub.cfg\`** anexado acima.\n` +
          `• **Opção 2 (Automático via Win + R):** Aperte **Win + R**, cole o comando abaixo e aperte **Enter** (detecta sua pasta da Steam sozinho):\n` +
          `\`\`\`powershell\n${ps1Cmd}\n\`\`\`\n` +
          `🛡️ **100% SEGURO & VAC-SAFE:** O GSI é uma funcionalidade nativa oficial desenvolvida pela Valve (usada pela ESL, BLAST e HLTV). Zero risco de ban.`
      )
      .setFooter({ text: `CS2 Mix Hub • Engine Oficial Valve GSI • Sala: ${safeRoomId}` })
      .setTimestamp();

    return embed;
  }

  buildGsiGuidePayload(roomId = 'MIX-PRO') {
    const safeRoomId = normalizeRoomId(roomId, 'MIX-PRO');
    const embed = this.buildGsiEmbed(safeRoomId);
    const webGsiUrl =
      safeRoomId !== 'MIX-PRO'
        ? this.getPublicWebUrl(`/?room=${encodeURIComponent(safeRoomId)}&gsi=1`)
        : this.getPublicWebUrl('/?gsi=1');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`live_install_gsi:${safeRoomId}`)
        .setLabel('Instalar GSI (1 Clique)')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('Baixar .cfg Direto')
        .setEmoji('📥')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/api/gsi/cfg/${encodeURIComponent(safeRoomId)}`)),
      new ButtonBuilder()
        .setLabel('Painel Web GSI')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(webGsiUrl),
      new ButtonBuilder()
        .setCustomId('gsi_help_info')
        .setLabel('Como Funciona?')
        .setEmoji('❓')
        .setStyle(ButtonStyle.Secondary)
    );
    const attachment = this.buildGsiAttachment(safeRoomId);
    return { embeds: [embed], components: [row], files: [attachment] };
  }

  buildLiveMatchEmbed(requesterName = 'Jogador', targetPlayerQuery = null, isExpanded = false, mix = null) {
    let state = this.lastGsiState || {};

    // If specific player requested by name or steamId
    if (targetPlayerQuery && this.playersGsiStates && this.playersGsiStates.size > 0) {
      const q = targetPlayerQuery.toLowerCase().trim();
      for (const [sId, pState] of this.playersGsiStates.entries()) {
        const pName = (pState.player?.name || pState.rawPlayer?.name || '').toLowerCase();
        if (pName.includes(q) || sId === targetPlayerQuery) {
          state = pState;
          break;
        }
      }
    }

    const lastTime = state.receivedAt || state.lastUpdate || 0;
    const isOnline = Boolean(
      state && Date.now() - lastTime < 90000
    );
    const player = state.player || {};
    const playerName = player.name || state.rawPlayer?.name || requesterName || 'Jogador';

    const embed = new EmbedBuilder().setTimestamp();

    if (!isOnline || (!player.name && !state.rawPlayer?.name)) {
      embed
        .setTitle('📡 MONITORAR PARTIDA • AGUARDANDO CS2')
        .setColor(0x6366f1);

      if (isExpanded) {
        embed
          .setDescription(
            `⏳ **Monitoramento ativado com sucesso! Aguardando início da partida no CS2...**\n\n` +
              `O bot está em modo de escuta ativa. **Assim que você conectar no servidor e o round começar, este card será atualizado automaticamente em tempo real!**\n\n` +
              `Seus amigos já podem deixar este card aberto no Discord ou no Hub Web para acompanhar:\n` +
              `• 🛡️ / 💣 **Lado da Equipe:** CT ou TR (com mudança de cores)\n` +
              `• 🔢 **Placar da Partida:** Contagem de rounds e round atual\n` +
              `• ❤️ **Sua Vida (HP):** Barra gráfica dinâmica atualizada em tempo real\n` +
              `• 🛡️ **Proteção:** Colete leve, capacete ou sem colete\n` +
              `• 🔫 **Armamento:** Arma ativa em mãos e munição exata\n` +
              `• 💣 **Granadas & Utilitários:** Smokes, flashes e molotovs no inventário\n` +
              `• 💰 **Economia ($):** Dinheiro atual e valor de equipamento\n` +
              `• 📊 **Desempenho:** Kills, Mortes, Assists, MVPs e K/D\n` +
              `• 🚨 **C4 Status:** Avisos ao vivo de bomba armada ou defusada\n\n` +
              `⚡ *Ainda não ativou o GSI no CS2? Clique em **Instalar GSI (1 Clique)** ou **Baixar .cfg Direto** logo abaixo (zero \`.bat\`).*`
          )
          .addFields(
            {
              name: '📡 Status do Monitoramento',
              value: '🟢 **Monitoramento Ativo** (Auto-Sync Ligado)',
              inline: true,
            },
            {
              name: '🕹️ Solicitado por',
              value: `**${requesterName}**`,
              inline: true,
            },
            {
              name: '⚙️ Arquivo GSI',
              value: '`gamestate_integration_cs2mixhub.cfg`',
              inline: true,
            }
          )
          .setFooter({ text: 'CS2 Mix Hub • Modo Expandido • Atualização Automática no 1º Round' });
      } else {
        embed
          .setDescription(
            `⏳ **Monitoramento ativado com sucesso!** Aguardando início da partida no CS2 de **${playerName}**...\n` +
            `*Assim que entrar no servidor, este card será atualizado automaticamente em tempo real.*\n\n` +
            `⚡ *Ainda não ativou o GSI? Clique em **Instalar GSI (1 Clique)** ou **Baixar .cfg Direto** logo abaixo (zero \`.bat\`).*`
          )
          .setFooter({ text: '📡 Painel Discreto • Clique em "Ver Detalhes (+)" para expandir' });
      }
      return embed;
    }

    const isInMenu = (player.activity === 'menu' || state.activity === 'menu' || !state.mapName || state.mapName === 'Indefinido' || state.phase === 'unknown');

    if (isInMenu) {
      embed
        .setTitle(`🎮 CS2 CONECTADO • ${playerName.toUpperCase()} NO MENU`)
        .setColor(0x10b981);

      if (isExpanded) {
        embed
          .setDescription(
            `🟢 **CS2 Detectado e Conectado com Sucesso!**\n\n` +
              `O jogador **${playerName}** está com o Counter-Strike 2 aberto no **Menu Principal**.\n\n` +
              `📡 **O monitoramento em tempo real já está sincronizado!**\n` +
              `Assim que você entrar em um servidor (seja casual, competitivo ou servidor de mix) e o round começar, este card mudará automaticamente para exibir:\n` +
              `• 🗺️ Mapa e Lado da equipe (CT ou TR)\n` +
              `• 🔢 Placar do jogo e contagem de rounds\n` +
              `• ❤️ Barra gráfica de vida (HP) e colete\n` +
              `• 🔫 Armas equipadas, munição e granadas\n` +
              `• 💣 Status da C4 em tempo real`
          )
          .addFields(
            {
              name: '🟢 Status da Conexão',
              value: '✅ **GSI CS2 Ativo e Recebendo Dados**',
              inline: true,
            },
            {
              name: '🕹️ Jogador',
              value: `**${playerName}**`,
              inline: true,
            },
            {
              name: '⚡ Auto-Sync',
              value: '🔄 **Atualização a cada 2.5s**',
              inline: true,
            }
          )
          .setFooter({ text: 'CS2 Mix Hub • Modo Expandido • Conectado' });
      } else {
        embed
          .setDescription(
            `🟢 **CS2 Conectado!** O jogador **${playerName}** está no Menu Principal do jogo.\n` +
            `*O monitoramento atualizará sozinho assim que a partida começar.*`
          )
          .setFooter({ text: '📡 Painel Discreto • Clique em "Ver Detalhes (+)" para expandir' });
      }
      return embed;
    }

    if (state.isGameOver) {
      const isCtWinner = (state.scoreCT || 0) > (state.scoreTR || 0);
      const isTie = (state.scoreCT || 0) === (state.scoreTR || 0);
      const winnerText = isTie
        ? '🤝 **PARTIDA EMPATADA!**'
        : isCtWinner
        ? '🛡️ **VITÓRIA DOS CONTRA-TERRORISTAS (CT)!**'
        : '💣 **VITÓRIA DOS TERRORISTAS (TR)!**';

      embed
        .setTitle(`🏆 PARTIDA FINALIZADA • ${playerName.toUpperCase()}`)
        .setColor(isTie ? 0xf59e0b : 0x10b981);

      // Extract best stats for player
      let kills = typeof player.kills === 'number' ? player.kills : 0;
      let deaths = typeof player.deaths === 'number' ? player.deaths : 0;
      let assists = typeof player.assists === 'number' ? player.assists : 0;
      let mvps = typeof player.mvps === 'number' ? player.mvps : 0;
      let score = typeof player.score === 'number' ? player.score : 0;
      let kd = player.kd;

      if (kills === 0 && deaths === 0 && Array.isArray(state.allPlayersStats) && state.allPlayersStats.length > 0) {
        const found = state.allPlayersStats.find(
          (p) =>
            (player.steamId && p.steamId === player.steamId) ||
            (p.name && p.name.toLowerCase() === playerName.toLowerCase())
        );
        if (found && (found.kills > 0 || found.score > 0)) {
          kills = found.kills;
          deaths = found.deaths;
          assists = found.assists;
          mvps = found.mvps;
          score = found.score;
          kd = found.kd;
        } else if (state.topFragger && state.topFragger.kills > 0) {
          kills = state.topFragger.kills;
          deaths = state.topFragger.deaths;
          assists = state.topFragger.assists;
          mvps = state.topFragger.mvps;
          score = state.topFragger.score;
          kd = state.topFragger.kd;
        }
      }

      if (kd === undefined || kd === null) {
        kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));
      }

      if (isExpanded) {
        embed
          .setDescription(
            `Partida concluída no mapa **${state.mapName || 'CS2'}**!\n\n` +
              `🔢 **Placar Final:** 🛡️ **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** 💣\n` +
              `${winnerText}\n\n` +
              `📊 **Desempenho Final de ${playerName}:**\n` +
              `🎯 **${kills} Kills** • 💀 **${deaths} Mortes** • 🤝 **${assists} Assists** • ⭐ **${mvps} MVPs**\n` +
              `🔥 **K/D Final:** **${kd}** • ⚡ **Pontuação:** **${score}**`
          )
          .setFooter({ text: 'CS2 Mix Hub • Partida Concluída' });
      } else {
        embed
          .setDescription(
            `Partida encerrada em **${state.mapName || 'CS2'}**!\n` +
            `🔢 **Placar Final:** 🛡️ **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** 💣 (${winnerText})\n` +
            `📊 **Estatísticas:** 🎯 **${kills} Kills** • 💀 **${deaths} Mortes** (K/D **${kd}**) • 🤝 **${assists}A** • ⭐ **${mvps} MVPs** • ⚡ **${score} pts**`
          )
          .setFooter({ text: '📡 Painel Discreto • Partida Concluída' });
      }
      return embed;
    }

    const isCt = (player.team === 'CT' || state.rawPlayer?.team === 'CT');
    const sideBadge = isCt ? '🛡️ **Counter-Terrorists (CT)**' : '💣 **Terrorists (TR)**';
    const sideColor = isCt ? 0x38bdf8 : 0xf59e0b;
    const healthBar = player.isAlive
      ? `${'🟩'.repeat(Math.max(1, Math.round(player.health / 10)))}${'⬛'.repeat(Math.max(0, 10 - Math.round(player.health / 10)))} **${player.health} HP**`
      : '💀 **ELIMINADO / MORTO NESTE ROUND**';
    const armorBadge = player.hasHelmet
      ? `🛡️ ${player.armor}% + Capacete`
      : player.armor > 0
      ? `🛡️ ${player.armor}% Colete`
      : '❌ Sem Colete';

    let bombStatusText = '🟢 Round em Andamento';
    if (state.bomb === 'planted') bombStatusText = '🚨 💣 **C4 PLANTADA! TEMPO CORRENDO!**';
    else if (state.bomb === 'defused') bombStatusText = '🛡️ **C4 DEFUSADA PELOS CTs!**';
    else if (state.bomb === 'exploded') bombStatusText = '💥 **C4 DETONADA! VITÓRIA DOS TRs!**';

    const weaponName = player.activeWeapon?.name || player.primaryWeapon?.name || 'Faca';
    const ammoText =
      player.activeWeapon?.ammoClip !== null && player.activeWeapon?.ammoClip !== undefined
        ? `\`[${player.activeWeapon.ammoClip}/${player.activeWeapon.ammoReserve || 0}]\``
        : '';
    const nadesText = (player.grenades || []).length > 0 ? player.grenades.join(', ') : 'Nenhum';

    // Keep active mix strictly scoped to the provided channel context
    const activeMix = mix || null;

    const allStats = Array.isArray(state.allPlayersStats) ? state.allPlayersStats : [];

    function resolvePlayerGsi(p) {
      if (!p) return null;
      const pName = (p.displayName || p.username || p.nick || p.name || '').toLowerCase();
      return allStats.find((s) => {
        const sName = (s.name || '').toLowerCase();
        return sName === pName || (pName.length >= 3 && sName.includes(pName)) || (sName.length >= 3 && pName.includes(sName));
      });
    }

    // Build dedicated dual team lists for Time A and Time B (or CT & TR)
    let teamAField = null;
    let teamBField = null;

    if (activeMix && activeMix.teamA?.players?.length > 0 && activeMix.teamB?.players?.length > 0) {
      const isTeamACt = (activeMix.teamA.side || 'CT') === 'CT';
      const capA = activeMix.teamA.captain || activeMix.teamA.players[0];
      const capB = activeMix.teamB.captain || activeMix.teamB.players[0];
      const moneyA = isTeamACt ? (state.totalMoneyCT || 0) : (state.totalMoneyTR || 0);
      const moneyB = isTeamACt ? (state.totalMoneyTR || 0) : (state.totalMoneyCT || 0);
      const aliveA = isTeamACt ? (state.aliveCountCT ?? 5) : (state.aliveCountTR ?? 5);
      const aliveB = isTeamACt ? (state.aliveCountTR ?? 5) : (state.aliveCountCT ?? 5);

      const linesA = activeMix.teamA.players.map((p) => {
        const isCap = p.id === capA?.id;
        const gsi = resolvePlayerGsi(p);
        const hp = gsi ? gsi.health : 100;
        const isAlive = gsi ? gsi.isAlive : true;
        const money = gsi ? gsi.money : 0;
        const kills = gsi ? gsi.kills : 0;
        const deaths = gsi ? gsi.deaths : 0;
        const weapon = gsi?.activeWeapon || 'Faca';
        const hpBadge = isAlive ? `❤️ \`${hp} HP\`` : '💀 `MORTO`';
        const capIcon = isCap ? '👑 ' : '• ';
        return `${capIcon}<@${p.id}> \`[Lvl ${p.level || 16} GC]\`\n  └ ${hpBadge} | 💰 \`$${money}\` | 🎯 \`${kills}/${deaths}\` | 🔫 \`${weapon}\``;
      }).join('\n');

      const linesB = activeMix.teamB.players.map((p) => {
        const isCap = p.id === capB?.id;
        const gsi = resolvePlayerGsi(p);
        const hp = gsi ? gsi.health : 100;
        const isAlive = gsi ? gsi.isAlive : true;
        const money = gsi ? gsi.money : 0;
        const kills = gsi ? gsi.kills : 0;
        const deaths = gsi ? gsi.deaths : 0;
        const weapon = gsi?.activeWeapon || 'Faca';
        const hpBadge = isAlive ? `❤️ \`${hp} HP\`` : '💀 `MORTO`';
        const capIcon = isCap ? '👑 ' : '• ';
        return `${capIcon}<@${p.id}> \`[Lvl ${p.level || 16} GC]\`\n  └ ${hpBadge} | 💰 \`$${money}\` | 🎯 \`${kills}/${deaths}\` | 🔫 \`${weapon}\``;
      }).join('\n');

      teamAField = {
        name: `🛡️ TIME A (${activeMix.teamA.side || 'CT'}) • 💵 $${moneyA} • 🛡️ ${aliveA}/5 Vivos`,
        value: `👑 **Capitão do Time A:** <@${capA?.id}> \`[Lvl ${capA?.level || 16} GC]\`\n${linesA}`,
        inline: true,
      };

      teamBField = {
        name: `🔥 TIME B (${activeMix.teamB.side || 'TR'}) • 💵 $${moneyB} • 🛡️ ${aliveB}/5 Vivos`,
        value: `👑 **Capitão do Time B:** <@${capB?.id}> \`[Lvl ${capB?.level || 16} GC]\`\n${linesB}`,
        inline: true,
      };
    } else if (state.teamCT?.length > 0 || state.teamTR?.length > 0) {
      const ctLines = (state.teamCT || []).map((p, i) => {
        const hpBadge = p.isAlive ? `❤️ \`${p.health} HP\`` : '💀 `MORTO`';
        const capBadge = i === 0 ? '👑 ' : '• ';
        return `${capBadge}**${p.name}**\n  └ ${hpBadge} | 💰 \`$${p.money || 0}\` | 🎯 \`${p.kills}/${p.deaths}\` | 🔫 \`${p.activeWeapon || 'Faca'}\``;
      }).join('\n') || '*Aguardando jogadores*';

      const trLines = (state.teamTR || []).map((p, i) => {
        const hpBadge = p.isAlive ? `❤️ \`${p.health} HP\`` : '💀 `MORTO`';
        const capBadge = i === 0 ? '👑 ' : '• ';
        return `${capBadge}**${p.name}**\n  └ ${hpBadge} | 💰 \`$${p.money || 0}\` | 🎯 \`${p.kills}/${p.deaths}\` | 🔫 \`${p.activeWeapon || 'Faca'}\``;
      }).join('\n') || '*Aguardando jogadores*';

      teamAField = {
        name: `🛡️ CONTRA-TERRORISTAS (CT) • 💵 $${state.totalMoneyCT || 0} • 🛡️ ${state.aliveCountCT ?? 0} Vivos`,
        value: ctLines,
        inline: true,
      };

      teamBField = {
        name: `💣 TERRORISTAS (TR) • 💵 $${state.totalMoneyTR || 0} • 🛡️ ${state.aliveCountTR ?? 0} Vivos`,
        value: trLines,
        inline: true,
      };
    }

    if (!isExpanded) {
      // ==========================================
      // MODO DISCRETO / COMPACTO (PAINEL PEQUENO)
      // ==========================================
      const hpBadge = player.isAlive ? `❤️ **${player.health} HP**` : '💀 **ELIMINADO**';
      const armorShort = player.hasHelmet ? `🛡️ ${player.armor}%+Cap.` : player.armor > 0 ? `🛡️ ${player.armor}%` : '❌ Sem Colete';
      const weaponShort = `🔫 **${weaponName}** ${ammoText}`.trim();
      const moneyShort = `💰 **$${player.money || 0}**`;
      const kdaShort = `🎯 **${player.kills || 0}K/${player.deaths || 0}D** (K/D **${player.kd || 0}**) • ⭐ **${player.mvps || 0}**`;
      const nadesShort = (player.grenades || []).length > 0 ? `💣 ${(player.grenades || []).join(', ')}` : '';

      embed
        .setTitle(`🔴 AO VIVO • ${playerName.toUpperCase()} [${isCt ? 'CT' : 'TR'}] • ${state.mapName || 'CS2'} • CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR (R${state.roundNumber || 1})`)
        .setColor(sideColor);

      if (teamAField && teamBField) {
        embed
          .setDescription(
            `⏱️ **Situação:** ${bombStatusText}\n` +
            `${hpBadge} • ${weaponShort} • ${moneyShort}`
          )
          .addFields(teamAField, teamBField);
      } else {
        embed.setDescription(
          `${hpBadge} • ${armorShort} • ${weaponShort}\n` +
          `${moneyShort} • ${kdaShort}${nadesShort ? ` • ${nadesShort}` : ''}\n` +
          `⏱️ **Situação:** ${bombStatusText}`
        );
      }

      embed.setFooter({ text: '📡 Painel Discreto • Clique em "Ver Detalhes (+)" para expandir' });
      return embed;
    }

    // ==========================================
    // MODO DETALHADO / EXPANDIDO
    // ==========================================
    embed
      .setTitle(`🔴 AO VIVO • MONITORAMENTO DE PARTIDA CS2`)
      .setColor(sideColor)
      .setDescription(
        `Acompanhe a partida em tempo real com telemetria direta do CS2:\n\n` +
          `🗺️ **Mapa:** **${state.mapName || 'Mirage'}** • *Fase: ${state.phase || 'live'}*\n` +
          `⚖️ **Perspectiva:** ${sideBadge} (${playerName})\n` +
          `🔢 **Placar Oficial:** 🛡️ **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** 💣 (Round **${state.roundNumber || 1}**)\n` +
          `⏱️ **Situação:** ${bombStatusText}`
      );

    if (teamAField && teamBField) {
      embed.addFields(teamAField, teamBField);
    }

    embed.addFields(
      {
        name: `❤️ Vida & Proteção de ${playerName}`,
        value: `${healthBar}\n${armorBadge}`,
        inline: true,
      },
      {
        name: '💵 Economia Pessoal',
        value: `💰 **$${player.money || 0}**\nEquipamento: \`$${player.equipValue || 0}\``,
        inline: true,
      },
      {
        name: '🔫 Armamento Atual',
        value: `🎯 **${weaponName}** ${ammoText}\nUtilitários: \`${nadesText}\``,
        inline: true,
      },
      {
        name: `📊 Estatísticas na Partida (Score: ${player.score || 0})`,
        value: `🎯 **${player.kills || 0} Kills** • 💀 **${player.deaths || 0} Mortes** • 🤝 **${player.assists || 0} Assists** • ⭐ **${player.mvps || 0} MVPs**`,
        inline: false,
      },
      {
        name: '📈 Eficiência de Combate',
        value: `🔥 **K/D Ratio:** **${player.kd || 0}**\n⚡ **Kills neste Round:** **${player.roundKills || 0}** (${player.roundKillHs || 0} Headshots)`,
        inline: false,
      }
    );

    // List other online players if multiple people installed the GSI
    const otherPlayers = [];
    if (this.playersGsiStates && this.playersGsiStates.size > 1) {
      const now = Date.now();
      for (const [sId, pState] of this.playersGsiStates.entries()) {
        if (now - (pState.receivedAt || pState.lastUpdate || 0) < 90000) {
          const otherName = pState.player?.name || pState.rawPlayer?.name;
          if (otherName && otherName.toLowerCase() !== playerName.toLowerCase()) {
            const side = pState.player?.team === 'CT' || pState.rawPlayer?.team === 'CT' ? 'CT' : 'TR';
            otherPlayers.push(`**${otherName}** (${side})`);
          }
        }
      }
    }

    if (otherPlayers.length > 0) {
      embed.addFields({
        name: '👥 Outros Jogadores com Monitoramento Ativo',
        value: `📡 ${otherPlayers.join(' • ')}\n*(Dica: digite \`!monitorar <nome>\` para alternar de jogador)*`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'CS2 Mix Hub • Modo Expandido • Clique em "Modo Compacto" para recolher' });

    return embed;
  }

  buildLiveMatchButtons(isOnline = false, isExpanded = false, roomId = 'MIX-PRO', mix = null, channelId = null) {
    const narrOn = this.isNarrationActive(mix, channelId || mix?.channelId);
    const safeRoomId = normalizeRoomId(roomId, 'MIX-PRO');
    const hubWebUrl =
      safeRoomId !== 'MIX-PRO'
        ? this.getPublicWebUrl(`/?room=${encodeURIComponent(safeRoomId)}`)
        : this.getPublicWebUrl('/');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('live_toggle_expand')
        .setLabel(isExpanded ? 'Modo Compacto' : 'Ver Detalhes (+)')
        .setEmoji(isExpanded ? '\ud83d\udd3d' : '\ud83d\udd0d')
        .setStyle(isExpanded ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('live_toggle_narration')
        .setLabel(narrOn ? 'Narra\u00e7\u00e3o: ON' : 'Narra\u00e7\u00e3o: OFF')
        .setEmoji(narrOn ? '\ud83c\udf99\ufe0f' : '\ud83d\udd07')
        .setStyle(narrOn ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('live_refresh')
        .setLabel('Atualizar')
        .setEmoji('\ud83d\udd04')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Hub Web')
        .setEmoji('\ud83c\udf10')
        .setStyle(ButtonStyle.Link)
        .setURL(hubWebUrl),
      new ButtonBuilder()
        .setCustomId('live_stop')
        .setLabel('Parar')
        .setEmoji('\u23f9\ufe0f')
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`live_install_gsi:${safeRoomId}`)
        .setLabel('Instalar GSI (1 Clique)')
        .setEmoji('⚡')
        .setStyle(isOnline ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('Baixar .cfg Direto')
        .setEmoji('📥')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/api/gsi/cfg/${encodeURIComponent(safeRoomId)}`)),
      new ButtonBuilder()
        .setCustomId('gsi_help_info')
        .setLabel('Como Funciona?')
        .setEmoji('❓')
        .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
  }

  registerLiveTracker(messageOrReply, requesterName = 'Jogador', targetQuery = null, isExpanded = false) {
    const msgId = messageOrReply?.id;
    const chId = messageOrReply?.channelId || messageOrReply?.channel?.id;
    if (!msgId || !chId) return;

    if (this.liveTrackers) {
      for (const [id, t] of this.liveTrackers.entries()) {
        if (t.channelId === chId) {
          this.liveTrackers.delete(id);
        }
      }

      const initialOnline = this.isGsiOnline();
      this.liveTrackers.set(msgId, {
        messageId: msgId,
        channelId: chId,
        requester: requesterName,
        targetQuery: targetQuery,
        isExpanded: Boolean(isExpanded),
        startedAt: Date.now(),
        lastEditedAt: 0,
        lastSignature: '',
        state: initialOnline ? (this.lastGsiState?.isGameOver ? 'finished' : 'in_game') : 'waiting',
        consecutiveErrors: 0,
      });
    }
  }

  async syncLiveTrackers(liveState) {
    if (this._isSyncingLiveTrackers) return;
    if (!this.liveTrackers || this.liveTrackers.size === 0) return;
    const stateToUse = liveState || this.lastGsiState;
    if (!stateToUse) return;

    this._isSyncingLiveTrackers = true;
    try {
      const now = Date.now();
      const isStateFresh = this.isGsiOnline(stateToUse);
      const baseSig = `${isStateFresh}_${stateToUse?.roundNumber}_${stateToUse?.scoreCT}_${stateToUse?.scoreTR}_${stateToUse?.bomb}_${stateToUse?.player?.isAlive}_${stateToUse?.player?.health}_${stateToUse?.player?.kills}_${stateToUse?.player?.deaths}_${stateToUse?.aliveCountCT}_${stateToUse?.aliveCountTR}_${stateToUse?.totalMoneyCT}_${stateToUse?.totalMoneyTR}_${stateToUse?.player?.roundKills}_${stateToUse?.player?.activeWeapon?.name}_${stateToUse?.player?.team}_${stateToUse?.phase}_${stateToUse?.isGameOver}_${stateToUse?.player?.name || stateToUse?.rawPlayer?.name || ''}`;

      for (const [msgId, tracker] of this.liveTrackers.entries()) {
        if (now - tracker.startedAt > 2.5 * 3600 * 1000) {
          this.liveTrackers.delete(msgId);
          continue;
        }
        if (tracker.state === 'finished' && now - tracker.lastEditedAt > 5 * 60 * 1000) {
          this.liveTrackers.delete(msgId);
          continue;
        }

        if (now - tracker.lastEditedAt < 1000) continue;
        if (!isStateFresh && tracker.state === 'waiting') continue;

        const isExpanded = Boolean(tracker.isExpanded);
        const mix = this.resolveActiveMixForChannel(tracker.channelId);
        const narrOn = this.isNarrationActive(mix, tracker.channelId);
        const sig = `${baseSig}_${narrOn}_${mix?.id || ''}_${isExpanded}`;
        if (tracker.lastSignature === sig && tracker.state !== 'waiting') continue;

        try {
          const channel =
            this.client?.channels?.cache?.get(tracker.channelId) ||
            (await this.client?.channels?.fetch(tracker.channelId).catch(() => null));
          if (!channel) {
            this.liveTrackers.delete(msgId);
            continue;
          }

          const msg = await channel.messages.fetch(msgId).catch(() => null);
          if (!msg) {
            this.liveTrackers.delete(msgId);
            continue;
          }

          const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
          const embed = this.buildLiveMatchEmbed(tracker.requester, tracker.targetQuery, isExpanded, mix);
          const components = this.buildLiveMatchButtons(isStateFresh, isExpanded, roomId, mix, tracker.channelId);

          await msg.edit({ embeds: [embed], components }).catch((e) => {
            if (e.code === 10008) {
              this.liveTrackers.delete(msgId);
            } else {
              console.warn('[DISCORD BOT LIVE TRACKER EDIT WARNING]:', e.message);
            }
          });

          tracker.lastEditedAt = Date.now();
          tracker.lastSignature = sig;
          if (!isStateFresh) {
            tracker.state = 'waiting';
          } else if (stateToUse?.isGameOver) {
            tracker.state = 'finished';
          } else {
            tracker.state = 'in_game';
          }
        } catch (err) {
          tracker.consecutiveErrors = (tracker.consecutiveErrors || 0) + 1;
          if (tracker.consecutiveErrors > 5) {
            this.liveTrackers.delete(msgId);
          }
        }
      }
    } finally {
      this._isSyncingLiveTrackers = false;
    }
  }
  loadPlayerProfiles() {
    try {
      if (fs.existsSync(PROFILES_FILE)) {
        const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao ler playerProfiles.json:', e.message);
    }
    return {};
  }

  savePlayerProfiles(profiles) {
    try {
      const dataDir = path.dirname(PROFILES_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
    } catch (e) {
      console.error('[DISCORD BOT] Falha ao salvar playerProfiles.json:', e.message);
    }
  }

  hasSavedLevel(userId) {
    if (!userId) return false;
    const profiles = this.loadPlayerProfiles();
    const lvl = profiles[userId]?.level;
    return typeof lvl === 'number' && lvl >= 1 && lvl <= 21;
  }

  getPlayerLevel(userId) {
    const profiles = this.loadPlayerProfiles();
    return profiles[userId]?.level || 16;
  }

  setPlayerProfile(userId, data) {
    const profiles = this.loadPlayerProfiles();
    profiles[userId] = {
      ...(profiles[userId] || {}),
      ...data,
      updatedAt: Date.now(),
    };
    this.savePlayerProfiles(profiles);
    this.updateLeaderboardFile(profiles);
  }

  loadMatchHistory() {
    return loadUnifiedMatchHistory();
  }

  saveMatchHistory(matches) {
    return saveUnifiedMatchHistory(matches);
  }

  updateLeaderboardFile(profiles) {
    try {
      syncDiscordProfilesToLeaderboard(profiles);
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao atualizar leaderboard.json:', e.message);
    }
  }

  loadConfig() {
    let base = {
      token: process.env.DISCORD_BOT_TOKEN || '',
      clientId: process.env.DISCORD_CLIENT_ID || '1569029813518336030',
      guildId: process.env.DISCORD_GUILD_ID || '',
      defaultChannelId: process.env.DISCORD_CHANNEL_ID || '',
      lobbyVoiceId: process.env.DISCORD_LOBBY_VOICE || '',
      teamAVoiceId: process.env.DISCORD_TEAMA_VOICE || '1569515077269459129',
      teamBVoiceId: process.env.DISCORD_TEAMB_VOICE || '1569515079248908358',
      autoMoveVoice: true,
      autoStartVetoOnFull: false,
      serverConnect: 'connect 103.14.27.41:25054',
      dealsChannelId: process.env.DISCORD_DEALS_CHANNEL || '',
      dealsChannels: {},
      autoPostDeals: true,
      dealsIntervalMinutes: 60,
    };
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        base = { ...base, ...JSON.parse(raw) };
      } else {
        const DEFAULT_CONFIG_FILE = path.join(DATA_DIR, 'discordBotConfig.default.json');
        if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
          const raw = fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf8');
          base = { ...base, ...JSON.parse(raw) };
        }
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao ler discordBotConfig.json:', e.message);
    }
    if (process.env.DISCORD_BOT_TOKEN) base.token = process.env.DISCORD_BOT_TOKEN;
    if (process.env.DISCORD_CLIENT_ID) base.clientId = process.env.DISCORD_CLIENT_ID;
    return base;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('[DISCORD BOT] Falha ao salvar discordBotConfig.json:', e.message);
    }
  }

  getStatus() {
    const isReady = Boolean(this.client && this.client.isReady());
    const uniqueMixesCount = this.getUniqueActiveMixes().length;
    const safeConfig = {
      hasToken: Boolean(this.config.token),
      clientId: this.config.clientId || '',
      guildId: this.config.guildId || '',
      defaultChannelId: this.config.defaultChannelId || '',
      lobbyVoiceId: this.config.lobbyVoiceId || '',
      teamAVoiceId: this.config.teamAVoiceId || '',
      teamBVoiceId: this.config.teamBVoiceId || '',
      autoMoveVoice: this.config.autoMoveVoice ?? true,
      autoStartVetoOnFull: this.config.autoStartVetoOnFull ?? false,
      serverConnect: this.config.serverConnect || '',
    };

    if (isReady) {
      return {
        ...this.status,
        running: true,
        tag: this.client.user?.tag || null,
        id: this.client.user?.id || null,
        guildCount: this.client.guilds.cache.size,
        ping: this.client.ws.ping,
        config: safeConfig,
        activeMixesCount: uniqueMixesCount,
      };
    }
    return {
      ...this.status,
      running: false,
      config: safeConfig,
      activeMixesCount: uniqueMixesCount,
    };
  }

  async start() {
    const token = (this.config.token || process.env.DISCORD_BOT_TOKEN || '').trim();
    if (!token) {
      this.status.lastError = 'Token do Bot Discord não configurado.';
      return { success: false, error: this.status.lastError };
    }

    if (this.client) {
      await this.stop();
    }

    const baseIntents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
    ];

    try {
      // First attempt: try with MessageContent & GuildMembers (full privileged capabilities)
      try {
        this.client = new Client({
          intents: [
            ...baseIntents,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
          ],
        });
        this.setupEventHandlers();
        await this.client.login(token);
        console.log(`🎮 [DISCORD BOT] Conectado com sucesso (com suporte a prefixo ! e Membros) como ${this.client.user.tag}!`);
      } catch (intentErr) {
        if (intentErr.message?.includes('disallowed intents')) {
          console.warn('⚠️ [DISCORD BOT] Tentando conexão sem GuildMembers...');
          try {
            if (this.client) {
              try { this.client.destroy(); } catch (e) {}
            }
            this.client = new Client({
              intents: [...baseIntents, GatewayIntentBits.MessageContent],
            });
            this.setupEventHandlers();
            await this.client.login(token);
            console.log(`🎮 [DISCORD BOT] Conectado com suporte a prefixo ! como ${this.client.user.tag}!`);
          } catch (intentErr2) {
            if (intentErr2.message?.includes('disallowed intents')) {
              console.warn('⚠️ [DISCORD BOT] Intents privilegiadas desativadas no Portal. Conectando em modo básico...');
              if (this.client) {
                try { this.client.destroy(); } catch (e) {}
              }
              this.client = new Client({ intents: baseIntents });
              this.setupEventHandlers();
              await this.client.login(token);
              console.log(`🎮 [DISCORD BOT] Conectado em modo básico como ${this.client.user.tag}!`);
            } else {
              throw intentErr2;
            }
          }
        } else {
          throw intentErr;
        }
      }

      this.status.running = true;
      this.status.startedAt = new Date().toISOString();
      this.status.lastError = null;
      this.startLiveTrackersSyncLoop();

      // Register or update Slash Commands
      await this.registerSlashCommands();

      return { success: true, tag: this.client.user.tag, id: this.client.user.id };
    } catch (err) {
      console.error('❌ [DISCORD BOT] Erro ao iniciar bot:', err.message);
      this.status.running = false;
      this.status.lastError = err.message;
      return { success: false, error: err.message };
    }
  }

  async stop() {
    if (this.dealsMonitorInterval) {
      clearInterval(this.dealsMonitorInterval);
      this.dealsMonitorInterval = null;
    }
    if (this.cs2UpdateRadarInterval) {
      clearInterval(this.cs2UpdateRadarInterval);
      this.cs2UpdateRadarInterval = null;
    }
    if (this.liveTrackersSyncInterval) {
      clearInterval(this.liveTrackersSyncInterval);
      this.liveTrackersSyncInterval = null;
    }
    if (this._initialDealsTimeout) {
      clearTimeout(this._initialDealsTimeout);
      this._initialDealsTimeout = null;
    }
    if (this._initialUpdatesTimeout) {
      clearTimeout(this._initialUpdatesTimeout);
      this._initialUpdatesTimeout = null;
    }
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {}
      this.client = null;
    }
    this.status.running = false;
    this.status.tag = null;
    this.status.id = null;
    console.log('🛑 [DISCORD BOT] Bot desconectado.');
    return { success: true };
  }

  async registerSlashCommands() {
    if (!this.client || !this.client.user) return;
    const token = (this.config.token || process.env.DISCORD_BOT_TOKEN || '').trim();
    const clientId = (this.client.user?.id || this.config.clientId || '').trim();

    const commands = [
      new SlashCommandBuilder()
        .setName('mix')
        .setDescription('Comandos de Mix CS2 5v5 oficial')
        .addSubcommand((sub) =>
          sub
            .setName('criar')
            .setDescription('Cria um novo lobby de Mix 5v5 com botões interativos')
            .addStringOption((opt) =>
              opt.setName('nome').setDescription('Nome personalizado para o Mix (ex: Mix dos Primos)').setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName('formato')
                .setDescription('Formato da Partida')
                .setRequired(false)
                .addChoices({ name: 'Melhor de 1 (MD1)', value: 'MD1' }, { name: 'Melhor de 3 (MD3)', value: 'MD3' })
            )
        )
        .addSubcommand((sub) => sub.setName('entrar').setDescription('Entra na fila do Mix ativo neste canal'))
        .addSubcommand((sub) => sub.setName('sair').setDescription('Sai da fila do Mix'))
        .addSubcommand((sub) => sub.setName('sortear').setDescription('Sorteia e balanceia os dois times (Time A vs Time B)'))
        .addSubcommand((sub) => sub.setName('veto').setDescription('Inicia o Pick & Ban (Veto) oficial de mapas'))
        .addSubcommand((sub) => sub.setName('roleta').setDescription('Sorteia um mapa na roleta rápida do CS2'))
        .addSubcommand((sub) => sub.setName('status').setDescription('Exibe o status do mix atual'))
        .addSubcommand((sub) => sub.setName('cancelar').setDescription('Cancela o mix atual do canal')),

      new SlashCommandBuilder()
        .setName('painel')
        .setDescription('Cria o Painel Permanente do CS2 Mix Hub com botão de criar mix em 1 clique'),

      new SlashCommandBuilder()
        .setName('roleta')
        .setDescription('Roleta justa de mapas (não repete até sair todos) ou escolha um mapa')
        .addStringOption((opt) =>
          opt
            .setName('mapa')
            .setDescription('Opcional: escolher um mapa específico em vez de sortear')
            .setRequired(false)
            .addChoices(...OFFICIAL_MAPS.map((m) => ({ name: m.name, value: m.id })))
        ),

      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Consulta as estatísticas competitivas e nível GC/FACEIT de um jogador')
        .addUserOption((opt) => opt.setName('jogador').setDescription('Jogador a consultar').setRequired(false)),

      new SlashCommandBuilder()
        .setName('granada')
        .setDescription('Guia tático de granadas e smokes essenciais')
        .addStringOption((opt) =>
          opt
            .setName('mapa')
            .setDescription('Mapa desejado')
            .setRequired(false)
            .addChoices(
              { name: 'Mirage', value: 'mirage' },
              { name: 'Inferno', value: 'inferno' },
              { name: 'Nuke', value: 'nuke' },
              { name: 'Dust II', value: 'dust2' },
              { name: 'Ancient', value: 'ancient' },
              { name: 'Anubis', value: 'anubis' },
              { name: 'Overpass', value: 'overpass' },
              { name: 'Train', value: 'train' },
              { name: 'Cache', value: 'cache' },
              { name: 'Vertigo', value: 'vertigo' }
            )
        ),

      new SlashCommandBuilder()
        .setName('treino')
        .setDescription('Gera a CFG oficial de treino do CS2 com cheats, granadas e dinheiro infinito'),

      new SlashCommandBuilder()
        .setName('moeda')
        .setDescription('Gira uma moeda (Cara ou Coroa) com algoritmo criptográfico'),

      new SlashCommandBuilder()
        .setName('servidor')
        .setDescription('Exibe ou configura o endereço IP do servidor de CS2 para o mix')
        .addStringOption((opt) =>
          opt.setName('ip_porta').setDescription('Ex: 189.1.168.20:27015 (ou connect com senha)').setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Exibe os melhores jogadores e o Hall da Fama do CS2 Mix Hub'),

      new SlashCommandBuilder()
        .setName('level')
        .setDescription('Configura o seu nível da Gamers Club (1 a 21) para o balanceamento de times')
        .addIntegerOption((opt) =>
          opt
            .setName('nivel')
            .setDescription('Seu nível na Gamers Club (de 1 a 21)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(21)
        ),

      new SlashCommandBuilder()
        .setName('lvl')
        .setDescription('Atalho rápido para definir seu nível da Gamers Club (1 a 21)')
        .addIntegerOption((opt) =>
          opt
            .setName('nivel')
            .setDescription('Seu nível na Gamers Club (de 1 a 21)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(21)
        ),

      new SlashCommandBuilder()
        .setName('vitoria')
        .setDescription('Registra o resultado da partida (Time A ou B) e atualiza o ranking')
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setDescription('Qual time venceu a partida?')
            .setRequired(true)
            .addChoices({ name: 'Time A', value: 'A' }, { name: 'Time B', value: 'B' })
        )
        .addStringOption((opt) =>
          opt
            .setName('placar')
            .setDescription('Placar final do jogo (ex: 13-9, 13-11, 16-14)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('mapa')
            .setDescription('Mapa jogado (ex: Mirage, Dust II, Inferno, Nuke, Ancient, Anubis, Cache)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('sub')
        .setDescription('Substitui um jogador ausente ou desconectado por um reserva')
        .addUserOption((opt) => opt.setName('novo').setDescription('Novo jogador que vai entrar').setRequired(true))
        .addUserOption((opt) => opt.setName('antigo').setDescription('Jogador que saiu (opcional)').setRequired(false)),

      new SlashCommandBuilder()
        .setName('cargo')
        .setDescription('Ativa ou desativa notificações do cargo @Mix CS2 para ser avisado quando faltarem vagas'),

      new SlashCommandBuilder()
        .setName('historico')
        .setDescription('Exibe o histórico das últimas partidas finalizadas no servidor'),

      new SlashCommandBuilder()
        .setName('x1')
        .setDescription('Compara o confronto direto (Head-to-Head) e sinergia entre dois jogadores')
        .addUserOption((opt) =>
          opt
            .setName('adversario')
            .setDescription('Jogador adversário para comparar estatísticas mútuas')
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('mapas')
        .setDescription('Estatísticas dos mapas mais disputados e populares no servidor'),

      new SlashCommandBuilder()
        .setName('status-servidor')
        .setDescription('Consulta ao vivo o servidor CS2 (A2S_INFO Steam UDP: Ping, mapa e players online)')
        .addStringOption((opt) =>
          opt
            .setName('endereco')
            .setDescription('IP:Porta do servidor CS2 (opcional; usa o servidor do mix/padrão)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('gsi')
        .setDescription('Instruções e download do Valve GSI para monitorar partidas ao vivo do CS2'),

      new SlashCommandBuilder()
        .setName('aovivo')
        .setDescription('Acompanha a partida de CS2 ao vivo em tempo real (placar, lado CT/TR, vida e armas)')
        .addStringOption((opt) =>
          opt
            .setName('jogador')
            .setDescription('Nome ou SteamID do jogador para monitorar (opcional)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('monitorar')
        .setDescription('Monitorar Partida de CS2 ao vivo: placar, lado CT/TR, vida e armas em tempo real')
        .addStringOption((opt) =>
          opt
            .setName('jogador')
            .setDescription('Nome ou SteamID do jogador para monitorar (opcional)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('monitorar-partida')
        .setDescription('Monitorar Partida de CS2 ao vivo: placar, lado CT/TR, vida e armas em tempo real')
        .addStringOption((opt) =>
          opt
            .setName('jogador')
            .setDescription('Nome ou SteamID do jogador para monitorar (opcional)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('ofertas')
        .setDescription('Busca ofertas de hardware e setup gamer (KaBuM!, Pichau, Terabyte)')
        .addStringOption((opt) =>
          opt.setName('busca').setDescription('Peça a buscar (ex: cadeira, mesa, mouse, teclado, rtx 4060, ryzen)').setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('categoria')
            .setDescription('Filtrar por categoria de hardware ou setup')
            .setRequired(false)
            .addChoices(
              { name: 'Placas de Vídeo (GPUs)', value: 'gpu' },
              { name: 'Processadores (CPUs)', value: 'cpu' },
              { name: 'Memórias RAM & SSDs', value: 'ram_ssd' },
              { name: 'Placas-Mãe, Fontes & Gabinetes', value: 'placa_mae_fonte' },
              { name: 'Monitores Gamer (144Hz a 240Hz)', value: 'monitor' },
              { name: 'Mouses & Teclados Mecânicos', value: 'mouse_teclado' },
              { name: 'Headsets & Áudio Gamer', value: 'audio' },
              { name: 'Cadeiras Gamer', value: 'cadeira' },
              { name: 'Mesas Gamer & Setup', value: 'mesa' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('loja')
            .setDescription('Filtrar por loja confiável')
            .setRequired(false)
            .addChoices(
              { name: '🟠 KaBuM!', value: 'kabum' },
              { name: '🔴 Pichau Informática', value: 'pichau' },
              { name: '🟢 TerabyteShop', value: 'terabyte' }
            )
        ),

      new SlashCommandBuilder()
        .setName('alertas-hardware')
        .setDescription('Configura o canal de alertas automáticos de promoções de hardware')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal de texto para postar promoções').setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('ativar').setDescription('Ativar ou desativar postagens automáticas').setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('steam')
        .setDescription('Scanner Steam & Anti-Smurf: Horas de CS2, VAC bans e integridade da conta')
        .addStringOption((opt) =>
          opt.setName('perfil').setDescription('Link do perfil, SteamID64 ou Vanity URL (ex: gaules ou 7656119...)').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('patchnotes')
        .setDescription('Últimas notas de atualização e patches oficiais do CS2 lançados pela Valve'),

      new SlashCommandBuilder()
        .setName('att')
        .setDescription('Atalho rápido para as notas de atualização oficiais do CS2 pela Valve'),

      new SlashCommandBuilder()
        .setName('pro')
        .setDescription('Agenda de jogos dos times brasileiros de CS2 (FURIA, MIBR, paiN, Imperial)'),

      new SlashCommandBuilder()
        .setName('jogos')
        .setDescription('Agenda e horários de jogos dos times brasileiros de CS2 (FURIA, MIBR, paiN)'),

      new SlashCommandBuilder()
        .setName('bagre')
        .setDescription('Inicia ou consulta a votação do Bagre da Partida (o jogador que mais pinou no mix)'),

      new SlashCommandBuilder()
        .setName('jogosgratis')
        .setDescription('Radar de jogos para PC gratuitos para resgatar na Epic Games Store e Steam'),

      new SlashCommandBuilder()
        .setName('clip')
        .setDescription('Envia um clipe de jogada no canal com votação da comunidade')
        .addStringOption((opt) => opt.setName('link').setDescription('Link do clipe (Medal.tv, Twitch, YouTube, etc)').setRequired(true))
        .addStringOption((opt) => opt.setName('titulo').setDescription('Título ou descrição da jogada (opcional)').setRequired(false)),

      new SlashCommandBuilder()
        .setName('calls')
        .setDescription('Configura ou move os jogadores do mix para as calls de voz oficiais Time A e Time B')
        .addChannelOption((opt) =>
          opt
            .setName('time_a')
            .setDescription('Selecione o canal de voz oficial do Time A')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('time_b')
            .setDescription('Selecione o canal de voz oficial do Time B')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('lobby')
            .setDescription('Selecione o canal de voz do Lobby / Geral')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        ),

      new SlashCommandBuilder().setName('ajuda').setDescription('Manual completo de comandos do Bot do Mix'),
    ];

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const bodyPayload = commands.map((c) => c.toJSON());
      console.log(`[DISCORD BOT] Registrando ${commands.length} Slash Commands...`);

      // Register globally
      await rest.put(Routes.applicationCommands(clientId), {
        body: bodyPayload,
      }).catch((e) => console.warn('[DISCORD BOT] Aviso registro global:', e.message));

      // Also register on every connected guild for instant 0-second propagation
      const guildIds = new Set();
      if (this.config.guildId && this.config.guildId.trim()) {
        guildIds.add(this.config.guildId.trim());
      }
      if (this.client?.guilds?.cache) {
        for (const [gId] of this.client.guilds.cache) {
          guildIds.add(gId);
        }
      }
      for (const gId of guildIds) {
        await rest.put(Routes.applicationGuildCommands(clientId, gId), {
          body: bodyPayload,
        }).catch(() => {});
      }
      console.log(`✅ [DISCORD BOT] ${commands.length} Slash commands registrados com sucesso (${guildIds.size} servidor(es) ativo(s))!`);
    } catch (err) {
      console.warn('[DISCORD BOT] Aviso ao registrar comandos slash:', err.message);
    }
  }

  setupEventHandlers() {
    const readyEvent = Events.ClientReady || 'clientReady';
    this.client.on(readyEvent, () => {
      this.client.user?.setActivity('CS2 Mix 5v5 \u2022 /mix ou @cs hub', { type: 0 });
      this.registerSlashCommands().catch(() => {});
      this.startScheduledDealsMonitor();
      if (typeof this.startCs2UpdateRadarMonitor === 'function') {
        this.startCs2UpdateRadarMonitor();
      }
    });
    // Handle Text Messages with Prefix '!'
    this.client.on('messageCreate', async (message) => {
      try {
        await this.handlePrefixCommand(message);
      } catch (err) {
        console.error('[DISCORD BOT] Erro ao processar mensagem prefixo !:', err);
        message.reply(`❌ Ocorreu um erro ao processar o comando: ${err.message}`).catch(() => {});
      }
    });

    // Handle Slash Commands, Buttons, and Modals
    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleChatCommand(interaction);
        } else if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction);
        } else if (interaction.isModalSubmit()) {
          await this.handleModalSubmit(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this.handleSelectMenuInteraction(interaction);
        } else if (interaction.isUserSelectMenu()) {
          await this.handleUserSelectMenuInteraction(interaction);
        }
      } catch (err) {
        console.error('[DISCORD BOT] Erro ao processar interação:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Ocorreu um erro interno: ${err.message}`,
            ephemeral: true,
          }).catch(() => {});
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: `❌ Ocorreu um erro interno: ${err.message}`,
          }).catch(() => {});
        }
      }
    });
  }

  // ==========================================
  // PREFIX COMMAND (!) ENGINE
  // ==========================================

  async handlePrefixCommand(message) {
    if (!message || message.author?.bot) return;

    let content = message.content?.trim() || '';
    if (!content) return;

    const botMention = `<@${this.client.user.id}>`;
    const botNickMention = `<@!${this.client.user.id}>`;

    let isMentioned = false;
    if (content.startsWith(botMention)) {
      content = content.slice(botMention.length).trim();
      isMentioned = true;
    } else if (content.startsWith(botNickMention)) {
      content = content.slice(botNickMention.length).trim();
      isMentioned = true;
    }

    if (!content.startsWith('!') && !content.startsWith('.') && !isMentioned) return;

    if (content.startsWith('!') || content.startsWith('.')) {
      content = content.slice(1).trim();
    }

    const args = content.split(/\s+/);
    const command = (args[0] || '').toLowerCase();
    const subArg = (args[1] || '').toLowerCase();

    console.log(`💬 [DISCORD CMD] De ${message.author?.username} em #${message.channel?.name || message.channelId}: "!${command} ${args.slice(1).join(' ')}"`);

    if (command === 'mix' || command === 'criar' || command === 'lobby') {
      if (subArg === 'fila' || subArg === 'status' || subArg === 'jogadores') return this.prefixFila(message);
      if (subArg === 'entrar') return this.prefixJoin(message);
      if (subArg === 'sair') return this.prefixLeave(message);
      if (subArg === 'sortear' || subArg === 'times') return this.prefixDraw(message);
      if (subArg === 'veto' || subArg === 'ban') return this.prefixVeto(message);
      if (subArg === 'roleta' || subArg === 'mapa' || subArg === 'map') return this.prefixRoulette(message);
      if (subArg === 'cancelar') return this.prefixCancel(message);
      return this.prefixCreateMix(message, args.slice(1).join(' '));
    }

    if (command === 'painel') return this.prefixPainel(message);
    if (command === 'fila' || command === 'status' || command === 'jogadores') return this.prefixFila(message);
    if (command === 'entrar') return this.prefixJoin(message);
    if (command === 'sair') return this.prefixLeave(message);
    if (command === 'sortear' || command === 'times') {
      if (subArg === 'mapa' || subArg === 'map' || subArg === 'roleta') {
        return this.prefixRoulette(message);
      }
      return this.prefixDraw(message);
    }
    if (
      command === 'escolher' ||
      command === 'escolhermapa' ||
      command === 'escolher-mapa' ||
      command === 'pickmapa' ||
      command === 'setmapa'
    ) {
      return this.prefixChooseMap(message, args.slice(1).join(' ').replace(/^mapa\s*/i, '').trim());
    }
    if ((command === 'mapa' || command === 'map') && subArg && this.findOfficialMap(args.slice(1).join(' '))) {
      return this.prefixChooseMap(message, args.slice(1).join(' '));
    }
    if (
      command === 'sortearmapa' ||
      command === 'sortear-mapa' ||
      command === 'sorteiomapa' ||
      command === 'roleta' ||
      command === 'mapa' ||
      command === 'map'
    ) {
      return this.prefixRoulette(message);
    }
    if (command === 'veto' || command === 'ban' || command === 'pick') return this.prefixVeto(message);
    if (command === 'ranking' || command === 'top' || command === 'leaderboard') return this.prefixRanking(message);
    if (command === 'historico' || command === 'history') return this.prefixHistory(message, args.slice(1));
    if (command === 'x1' || command === 'confronto' || command === 'duelo' || command === 'headtohead') return this.prefixHeadToHead(message, args.slice(1));
    if (command === 'mapas' || command === 'mapstats') return this.prefixMapStats(message);
    if (command === 'status-server' || command === 'status-servidor') return this.prefixServerStatus(message, args.slice(1));
    if (command === 'gsi') return this.prefixGsi(message);
    if (command === 'ao' && subArg === 'vivo') return this.prefixLive(message, args.slice(2));
    if (
      command === 'aovivo' ||
      command === 'live' ||
      command === 'partida' ||
      command === 'hud' ||
      command === 'monitorar' ||
      command === 'monitor' ||
      command === 'monitorar-partida' ||
      command === 'radar'
    ) return this.prefixLive(message, args.slice(1));
    if (command === 'vitoria' || command === 'resultado' || command === 'ganhador') return this.prefixMatchResult(message, args.slice(1));
    if (command === 'sub' || command === 'substituto' || command === 'reserva') return this.prefixSubstitute(message, args.slice(1));
    if (command === 'cargo' || command === 'notificar' || command === 'notificacao') return this.prefixToggleRole(message);
    if (command === 'level' || command === 'lvl' || command === 'gc') return this.prefixSetLevel(message, args[1]);
    if (command === 'stats' || command === 'perfil') return this.prefixStats(message, args[1]);
    if (command === 'smoke' || command === 'granada' || command === 'lineup') return this.prefixGrenade(message, args.slice(1).join(' '));
    if (command === 'treino' || command === 'cfg' || command === 'praticar') return this.prefixTreino(message);
    if (command === 'moeda' || command === 'coinflip' || command === 'flip') return this.prefixCoinflip(message);
    if (command === 'ping' || command === 'bot' || command === 'uptime') return this.prefixPing(message);
    if (command === 'servidor') {
      if (subArg === 'status') {
        return this.prefixServerStatus(message, args.slice(2));
      }
      const mix = this.resolveActiveMixForChannel(message.channelId);
      const ip = args.slice(1).join(' ').trim();
      if (ip) {
        if (!this.isGuildModerator(message.member, message.guild, mix, message.author?.id)) {
          return message.reply('🚫 Apenas administradores do servidor ou o criador do mix podem alterar o IP do servidor.');
        }
        const parsed = parseServerConnect(ip);
        if (!parsed.valid) {
          return message.reply(`⚠️ ${parsed.error || 'Endereço de servidor inválido.'} Use o formato \`ip:porta\` (ex: \`189.1.168.20:27015\` ou \`connect 189.1.168.20:27015; password mix\`).`);
        }
        this.config.serverConnect = parsed.normalized;
        this.saveConfig({ serverConnect: parsed.normalized });
        if (mix) {
          mix.serverIp = parsed.normalized;
          this.syncToWebRoom(mix);
          this.updateLobbyInChannels(mix);
        }
        return message.reply(`✅ Servidor CS2 configurado com sucesso para os mixes: \`${parsed.consoleCommand}\``);
      }
      const conn = this.resolveMixDisplayConnect(mix);
      return message.reply(
        conn
          ? `💻 **Servidor Atual:** \`${conn.normalized}\`\n👉 Para conectar: \`${conn.consoleCommand}\``
          : '⚠️ Nenhum servidor configurado. Use `!servidor 189.1.168.20:27015` para configurar!'
      );
    }
    if (command === 'ajuda' || command === 'help') return this.prefixHelp(message);
    if (command === 'ofertas' || command === 'hardware' || command === 'promo' || command === 'promocao' || command === 'promocoes') {
      return this.prefixDeals(message, args.slice(1));
    }
    if (command === 'steam' || command === 'antismurf' || command === 'smurf') {
      return this.prefixSteam(message, args.slice(1).join(' '));
    }
    if (command === 'att' || command === 'patchnotes' || command === 'update' || command === 'atualizacao' || command === 'patch') {
      return this.prefixPatchNotes(message);
    }
    if (command === 'pro' || command === 'jogos' || command === 'agenda' || command === 'hltv') {
      return this.prefixProMatches(message);
    }
    if (command === 'bagre' || command === 'bagredomix') {
      return this.prefixBagre(message);
    }
    if (command === 'jogosgratis' || command === 'freegames' || command === 'jogosfree' || command === 'epic') {
      return this.prefixFreeGames(message);
    }
    if (command === 'clip' || command === 'clipe' || command === 'highlight' || command === 'jogada') {
      return this.prefixClip(message, args.slice(1));
    }
    if (command === 'revanche' || command === 'rematch') {
      return this.prefixRematch(message);
    }
    if (command === 'cancelar') return this.prefixCancel(message);
    if (command === 'ip' || command === 'connect') return this.prefixIp(message);
    if (command === 'comandos') return this.prefixHelp(message);
    if (command === 'reset') return this.prefixCancel(message);

    // If the user mentioned the bot directly (e.g. "@cs hub" or "@cs hub oi"), always respond with the interactive panel
    if (isMentioned) {
      return this.prefixPainel(message);
    }
  }

  async prefixCreateMix(message, customName) {
    try {
      const user = message.author;
      const existing = this.resolveActiveMixForChannel(message.channelId);
      if (existing && existing.phase === 'live') {
        const mapName = existing.finalMap?.name || existing.veto?.deciderMap?.name || 'CS2';
        const conn = this.resolveMixDisplayConnect(existing);
        return message.reply(
          `⚔️ **Já existe uma partida 5v5 em andamento neste canal!** (${existing.name})\n` +
          `🗺️ **Mapa:** **${mapName}** • Conectar: \`${conn ? conn.consoleCommand : 'A definir (!servidor ip:porta)'}\`\n\n` +
          `👉 Para acompanhar ao vivo: \`!aovivo\` ou \`!fila\`\n` +
          `👉 Para declarar vitória: \`!vitoria A\` ou \`!vitoria B\`\n` +
          `👉 Para encerrar ou cancelar: \`!cancelar\``
        );
      }

      if (existing && existing.phase === 'lobby' && existing.players.length > 0) {
        const tutorialEmbed = this.buildMixTutorialEmbed();
        const embed = this.buildLobbyEmbed(existing);
        const components = this.buildLobbyButtons(existing);
        const sent = await message.channel.send({
          content: `🎮 <@${user.id}> chamou para o **Lobby de Mix CS2 5v5**! (${existing.players.length}/10 confirmados)`,
          embeds: [tutorialEmbed, embed],
          components,
        });
        if (sent) {
          existing.lobbyMessageId = sent.id;
          existing.channelId = message.channelId;
        }
        return sent;
      }

      const name = customName || `Mix 5v5 de ${user.username}`;
      const mix = this.getOrCreateMix(message.channelId, user, { name, forceNew: true });

      if (mix.players.length === 0 && this.hasSavedLevel(user.id)) {
        mix.players.push({
          id: user.id,
          username: user.username,
          displayName: message.member?.displayName || user.username,
          avatar: user.displayAvatarURL({ dynamic: true }),
          level: this.getPlayerLevel(user.id),
          ready: true,
        });
        this.syncToWebRoom(mix);
      }

      const tutorialEmbed = this.buildMixTutorialEmbed();
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      const sent = await message.channel.send({
        content: `🎮 <@${user.id}> abriu o **Lobby de Mix CS2 5v5**! (${mix.players.length}/10 confirmados)`,
        embeds: [tutorialEmbed, embed],
        components,
      });
      if (sent) {
        mix.lobbyMessageId = sent.id;
        mix.channelId = message.channelId;
      }
      return sent;
    } catch (err) {
      console.error('[DISCORD BOT] Erro em prefixCreateMix:', err);
      return message.reply(`❌ Erro ao abrir lobby no Discord: ${err.message}. Verifique se o bot tem permissão de "Inserir Links" (Embeds) neste canal!`);
    }
  }

  async prefixPainel(message) {
    const embed = new EmbedBuilder()
      .setTitle('🏆 CS2 MIX HUB • PAINEL OFICIAL DA COMUNIDADE')
      .setDescription(
        `Bem-vindo à central de partidas 5v5 da comunidade!\n\n` +
          `• **Lobbies Automáticos:** Clique em **Criar Mix** ou digite \`!mix\` para abrir uma fila 5v5.\n` +
          `• **Check-in Anti-AFK:** Confirmação em 60 segundos para partidas sem ausentes.\n` +
          `• **Balanceamento Snake-Draft:** Algoritmo Gamers Club e FACEIT oficial.\n` +
          `• **Pick & Ban:** Veto oficial da Valve com escolha de lados CT/TR.\n` +
          `• **Canais de Voz:** Movimentação automática para calls CT e TR na hora do jogo!\n\n` +
          `*Pressione o botão verde abaixo para iniciar um Mix agora:*`
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Plataforma Competitiva eSports' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('🎮 Criar Mix 5v5')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel_set_level')
        .setLabel('Meu Nível GC')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_live_radar')
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🌐 Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/'))
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  async prefixFila(message) {
    let mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix && this.webRoomsRef && this.webRoomsRef.size > 0) {
      for (const r of this.webRoomsRef.values()) {
        if (r && r.channelId === message.channelId && r.phase !== 'finished' && r.phase !== 'cancelled') {
          mix = r;
          break;
        }
      }
    }
    if (!mix) {
      return message.reply('ℹ️ Nenhum mix ativo neste canal. Use `!mix` ou `/mix criar` para abrir um!');
    }
    const payload = this.buildStatusPayloadForMix(mix);
    const sent = await message.channel.send(payload);
    if (sent && (mix.phase === 'lobby' || !mix.phase)) {
      mix.lobbyMessageId = sent.id;
      mix.channelId = message.channelId;
    }
    return sent;
  }

  async updateLobbyInChannels(mix) {
    if (!mix || !this.client) return;
    try {
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      const editedTargets = new Set();

      const targets = this.getUniqueActiveMixes().filter(
        (m) => m && m.channelId && m.lobbyMessageId && m.channelId !== 'whatsapp-mix' && m.id === mix.id
      );
      if (mix.channelId && mix.lobbyMessageId && mix.channelId !== 'whatsapp-mix') {
        targets.push(mix);
      }

      for (const m of targets) {
        const key = `${m.channelId}:${m.lobbyMessageId}`;
        if (editedTargets.has(key)) continue;
        editedTargets.add(key);
        const channel = await this.client.channels.fetch(m.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(m.lobbyMessageId).catch(() => null);
          if (msg) {
            await msg.edit({ embeds: [embed], components }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao atualizar lobby nos canais:', e.message);
    }
  }

  async prefixJoin(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo neste canal. Crie um agora com `!mix` ou clicando no botão verde!');
    }
    mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
    const alreadyIn = mix.players.some((p) => p.id === message.author.id) || mix.waitlist.some((p) => p.id === message.author.id);
    if (alreadyIn) {
      return message.reply('⚠️ Você já está inscrito neste mix (titular ou reserva)!');
    }
    if (mix.players.length >= 10 && mix.waitlist.length >= 3) {
      return message.reply('🚫 O lobby (10/10) e a Fila de Reserva (3/3) já estão lotados!');
    }

    if (!this.hasSavedLevel(message.author.id)) {
      return message.reply(
        '⚠️ **Você precisa cadastrar seu Nível da Gamers Club antes de entrar no mix!**\n' +
        '👉 Digite `!lvl <1 a 21>` (ex: `!lvl 16`) ou clique no botão **`[⭐ Meu Nível GC]`** na mensagem do lobby.\n' +
        'O seu nível ficará salvo no seu perfil para todas as próximas partidas!'
      );
    }
    const playerLvl = this.getPlayerLevel(message.author.id);
    const pName = message.member?.displayName || message.author.username;
    const newEntry = {
      id: message.author.id,
      username: message.author.username,
      displayName: pName,
      avatar: message.author.displayAvatarURL({ dynamic: true }),
      level: playerLvl,
      ready: true,
    };

    if (mix.players.length >= 10) {
      mix.waitlist.push(newEntry);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      return message.reply(
        `📋 <@${message.author.id}> entrou na **Fila de Reserva (Suplente #${mix.waitlist.length}/3)**! Se alguém sair ou ficar AFK no check-in, você assume a vaga automaticamente.`
      );
    }

    mix.players.push(newEntry);
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);

    if (mix.players.length === 8 || mix.players.length === 9) {
      this.notifyMissingSlots(mix, message.guild, message.channel).catch(() => {});
    }

    if (mix.players.length === 10) {
      this.startReadyCheck(mix, message.channel);
      const embed = this.buildReadyCheckEmbed(mix);
      const components = this.buildReadyCheckButtons(mix);
      return message.channel.send({ embeds: [embed], components });
    }

    return message.reply(`✅ <@${message.author.id}> entrou no mix! (${mix.players.length}/10)`);
  }

  async prefixLeave(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];

    const waitIdx = mix.waitlist.findIndex((p) => p.id === message.author.id);
    if (waitIdx !== -1) {
      mix.waitlist.splice(waitIdx, 1);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      return message.reply(`🚪 <@${message.author.id}> saiu da Fila de Reserva (${mix.waitlist.length}/3).`);
    }

    const idx = mix.players.findIndex((p) => p.id === message.author.id);
    if (idx === -1) return message.reply('⚠️ Você não está no mix.');
    mix.players.splice(idx, 1);
    if (mix.readyCheck?.confirmed) {
      mix.readyCheck.confirmed.delete(message.author.id);
    }

    let promotedMsg = '';
    if (mix.waitlist.length > 0 && mix.players.length < 10) {
      const nextSub = mix.waitlist.shift();
      mix.players.push(nextSub);
      promotedMsg = `\n🔄 <@${nextSub.id}> foi promovido automaticamente da **Fila de Reserva** para titular!`;
    }

    if (mix.phase === 'ready_check' && mix.players.length < 10) {
      if (mix.readyCheck?.timer) {
        clearTimeout(mix.readyCheck.timer);
        mix.readyCheck.timer = null;
      }
      mix.readyCheck.active = false;
      mix.phase = 'lobby';
    }

    if (mix.players.length <= 7 && mix.notifiedMissing) {
      mix.notifiedMissing.clear();
    }
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);
    return message.reply(`🚪 <@${message.author.id}> saiu do mix. (${mix.players.length}/10)${promotedMsg}`);
  }

  async prefixDraw(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal. Use `!mix` para abrir uma fila!');
    if (mix.players.length < 2) return message.reply('⚠️ É necessário pelo menos 2 jogadores para sortear os times!');

    if (mix.readyCheck?.timer) {
      clearTimeout(mix.readyCheck.timer);
      mix.readyCheck.timer = null;
    }
    if (mix.readyCheck) {
      mix.readyCheck.active = false;
    }

    this.balanceTeams(mix);
    this.updateLobbyInChannels(mix);
    const embed = this.buildTeamsEmbed(mix);
    return message.reply({ embeds: [embed], components: [this.buildTeamsActionButtons(mix)] });
  }

  async prefixVeto(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal. Use `!mix` para abrir uma fila!');
    if (mix.teamA.players.length === 0 || mix.teamB.players.length === 0) {
      this.balanceTeams(mix);
    }
    mix.phase = 'veto';
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);
    const embed = this.buildVetoEmbed(mix);
    const components = this.buildVetoButtons(mix);
    const turnCap = mix.veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
    const capATag = isSnowflake(mix.teamA.captain?.id) ? `<@${mix.teamA.captain.id}>` : `**${mix.teamA.captain?.displayName || mix.teamA.captain?.username || 'Capitão A'}**`;
    const capBTag = isSnowflake(mix.teamB.captain?.id) ? `<@${mix.teamB.captain.id}>` : `**${mix.teamB.captain?.displayName || mix.teamB.captain?.username || 'Capitão B'}**`;
    const turnTag = isSnowflake(turnCap?.id) ? `<@${turnCap.id}>` : `**${turnCap?.displayName || turnCap?.username || 'Capitão'}**`;
    return message.reply({
      content: `🗳️ **VETO DE MAPAS INICIADO!**\n👑 Capitão A: ${capATag} | 👑 Capitão B: ${capBTag}\n👉 Vez de: ${turnTag} banir um mapa!`,
      embeds: [embed],
      components,
    });
  }

  // ==========================================
  // ROLETA JUSTA DE MAPAS (SEM REPETIÇÃO) + ESCOLHA MANUAL
  // ==========================================

  loadRouletteState() {
    try {
      if (fs.existsSync(ROULETTE_STATE_FILE)) {
        return JSON.parse(fs.readFileSync(ROULETTE_STATE_FILE, 'utf8')) || {};
      }
    } catch (e) {
      console.warn('[ROLETA] Falha ao ler estado da roleta:', e.message);
    }
    return {};
  }

  saveRouletteState(state) {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ROULETTE_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
      console.warn('[ROLETA] Falha ao salvar estado da roleta:', e.message);
    }
  }

  getRouletteScope(guildOrChannelId) {
    return String(guildOrChannelId || 'global');
  }

  shuffleMapIds() {
    const ids = OFFICIAL_MAPS.map((m) => m.id);
    // Fisher-Yates com gerador criptográfico (crypto.randomInt)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  /**
   * Sorteio justo estilo "saco de mapas": todos os mapas da rotação saem
   * uma vez antes de qualquer mapa poder repetir, e o primeiro mapa de um
   * novo ciclo nunca é igual ao último mapa jogado.
   */
  drawFairMap(scopeId) {
    const scope = this.getRouletteScope(scopeId);
    const state = this.loadRouletteState();
    const entry = state[scope] || { bag: [], lastMap: null, history: [] };
    const validIds = new Set(OFFICIAL_MAPS.map((m) => m.id));

    entry.bag = (Array.isArray(entry.bag) ? entry.bag : []).filter((id) => validIds.has(id));
    if (entry.bag.length === 0) {
      entry.bag = this.shuffleMapIds();
      if (entry.bag.length > 1 && entry.bag[0] === entry.lastMap) {
        const swapIdx = crypto.randomInt(1, entry.bag.length);
        [entry.bag[0], entry.bag[swapIdx]] = [entry.bag[swapIdx], entry.bag[0]];
      }
    }

    const mapId = entry.bag.shift();
    entry.lastMap = mapId;
    entry.history = [mapId, ...(Array.isArray(entry.history) ? entry.history : [])].slice(0, 20);
    state[scope] = entry;
    this.saveRouletteState(state);

    const drawn = OFFICIAL_MAPS.find((m) => m.id === mapId) || OFFICIAL_MAPS[0];
    return { drawn, remainingInCycle: entry.bag.length };
  }

  /** Marca um mapa escolhido manualmente como jogado, para a roleta não repeti-lo no ciclo atual. */
  registerMapPlayed(scopeId, mapId) {
    if (!mapId) return;
    const scope = this.getRouletteScope(scopeId);
    const state = this.loadRouletteState();
    const entry = state[scope] || { bag: [], lastMap: null, history: [] };
    entry.bag = (Array.isArray(entry.bag) ? entry.bag : []).filter((id) => id !== mapId);
    entry.lastMap = mapId;
    entry.history = [mapId, ...(Array.isArray(entry.history) ? entry.history : [])].slice(0, 20);
    state[scope] = entry;
    this.saveRouletteState(state);
  }

  findOfficialMap(input) {
    const q = String(input || '').toLowerCase().replace(/^de_/, '').replace(/[^a-z0-9]/g, '');
    if (!q) return null;
    const aliases = { d2: 'dust2', dust: 'dust2', dustii: 'dust2', dust2: 'dust2' };
    const target = aliases[q] || q;
    return (
      OFFICIAL_MAPS.find((m) => m.id.replace(/^de_/, '') === target) ||
      OFFICIAL_MAPS.find((m) => m.name.toLowerCase().replace(/[^a-z0-9]/g, '') === target) ||
      OFFICIAL_MAPS.find((m) => m.id.replace(/^de_/, '').startsWith(target) || m.name.toLowerCase().startsWith(target)) ||
      null
    );
  }

  buildMapPickMenu(mix) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`mix_map_select:${mix?.id || 'none'}`)
      .setPlaceholder('🗺️ Escolha o mapa da partida...')
      .addOptions([
        { label: 'Sortear na Roleta (sem repetir)', value: 'random', description: 'Sorteio justo: não repete mapa até sair todos', emoji: '🎲' },
        ...OFFICIAL_MAPS.map((m) => ({ label: m.name, value: m.id, description: `Jogar em ${m.id}`, emoji: m.emoji })),
      ]);
    return [new ActionRowBuilder().addComponents(select)];
  }

  canChooseMap(mix, userId) {
    if (!mix || !userId) return false;
    if (userId === mix.creatorId) return true;
    if (userId === mix.teamA?.captain?.id || userId === mix.teamB?.captain?.id) return true;
    return (mix.players || []).some((p) => p.id === userId);
  }

  resolveMixDisplayConnect(mix, rawOverride = null) {
    const raw = rawOverride || mix?.serverIp || this.config?.serverConnect || '';
    if (!String(raw).trim()) return null;
    const parsed = parseServerConnect(raw);
    if (parsed.valid) {
      return {
        normalized: parsed.normalized,
        host: parsed.host,
        port: parsed.port,
        hostPort: parsed.hostPort,
        password: parsed.password,
        consoleCommand: parsed.consoleCommand,
      };
    }
    const fallback = extractHostAndPort(raw);
    if (!fallback.host) return null;
    return {
      normalized: fallback.normalized,
      host: fallback.host,
      port: fallback.port,
      hostPort: fallback.hostPort,
      password: fallback.password,
      consoleCommand: fallback.password
        ? `connect ${fallback.hostPort}; password ${fallback.password}`
        : `connect ${fallback.hostPort}`,
    };
  }

  buildTeamsActionButtons(mix) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mix_veto:${mix.id}`).setLabel('Iniciar Pick & Ban').setEmoji('🗳️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`mix_captain_draft:${mix.id}`).setLabel('Draft 1v1 Capitães').setEmoji('👑').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mix_roulette:${mix.id}`).setLabel('Roleta Rápida').setEmoji('🎲').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mix_pick_map:${mix.id}`).setLabel('Escolher Mapa').setEmoji('🗺️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mix_voice:${mix.id}`).setLabel('Mover para Calls').setEmoji('📞').setStyle(ButtonStyle.Secondary)
    );
  }

  /**
   * Fluxo único para definir o mapa do mix (roleta ou escolha manual) e liberar a partida.
   * Sempre envia o anúncio com o mapa no canal para ninguém ficar sem ver o resultado.
   */
  async startMatchWithMap(mix, drawn, { channel, guild, source = 'roleta', user = null, remainingInCycle = null } = {}) {
    if (mix.players?.length >= 2 && (!mix.teamA?.players?.length || !mix.teamB?.players?.length)) {
      this.balanceTeams(mix);
    }

    if (mix.teamA) {
      mix.teamA.startingSide = mix.teamA.startingSide || mix.teamA.side || 'CT';
      mix.teamA.halftimeSwapped = false;
    }
    if (mix.teamB) {
      mix.teamB.startingSide = mix.teamB.startingSide || mix.teamB.side || 'TR';
      mix.teamB.halftimeSwapped = false;
    }

    mix.veto = mix.veto || { currentTurn: 'teamA', bannedMaps: [], remainingMaps: [...OFFICIAL_MAPS], history: [] };
    mix.veto.deciderMap = drawn;
    mix.finalMap = { id: drawn.id, name: drawn.name, file: drawn.id, image: drawn.image };
    mix.matchMap = drawn.name;
    mix.phase = 'live';

    if (source !== 'roleta') {
      this.registerMapPlayed(guild?.id || channel?.id, drawn.id);
    }

    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);

    if (this.config.autoMoveVoice && guild) {
      this.executeVoiceMover(guild, mix, channel).catch(() => {});
    }
    this.triggerAutoRconMapChange(mix, drawn, channel).catch(() => {});
    const readyEmbed = this.buildMatchReadyEmbed(mix);
    readyEmbed.setImage(drawn.image);
    const components = this.buildMatchReadyButtons(mix);

    const conn = this.resolveMixDisplayConnect(mix);
    const tag = (cap, fallback) =>
      isSnowflake(cap?.id) ? `<@${cap.id}>` : `**${cap?.displayName || cap?.username || cap?.nick || fallback}**`;

    const header =
      source === 'roleta'
        ? `🎲 **MAPA SORTEADO PELA ROLETA:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)!` +
          (remainingInCycle !== null ? `\n♻️ Roleta justa: faltam **${remainingInCycle}** mapa(s) para sair antes de qualquer repetição.` : '')
        : `🗺️ **MAPA ESCOLHIDO${user ? ` POR ${isSnowflake(user.id) ? `<@${user.id}>` : user.username}` : ''}:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)!`;

    const sent = await channel
      ?.send({
        content:
          `${header}\n\n` +
          `🛡️ **${mix.teamA?.name || 'Time A'} (${mix.teamA?.side || 'CT'}):** Capitão ${tag(mix.teamA?.captain, 'Capitão A')}\n` +
          `💣 **${mix.teamB?.name || 'Time B'} (${mix.teamB?.side || 'TR'}):** Capitão ${tag(mix.teamB?.captain, 'Capitão B')}\n\n` +
          `💻 **Comando Console CS2:** \`${conn ? conn.consoleCommand : 'A definir (!servidor ip:porta)'}\``,
        embeds: [readyEmbed],
        components,
      })
      .catch((err) => {
        console.warn('[ROLETA] Falha ao anunciar mapa no canal:', err.message);
        return null;
      });

    this.startAutomaticLiveMonitoring(mix, channel, guild).catch((err) => {
      console.warn('[BOT] Erro ao iniciar monitoramento automático:', err.message);
    });
    return sent;
  }

  resolveActiveMixForChannel(channelId, { includeFinished = false } = {}) {
    if (!channelId) return null;
    const mix = this.activeMixes.get(channelId) || null;
    if (mix && mix.phase !== 'cancelled' && (includeFinished || mix.phase !== 'finished')) {
      return mix;
    }
    if (includeFinished && this.lastFinishedMixes?.has(`ch:${channelId}`)) {
      return this.lastFinishedMixes.get(`ch:${channelId}`);
    }
    return null;
  }

  async prefixRoulette(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    const { drawn, remainingInCycle } = this.drawFairMap(message.guild?.id || message.channelId);

    if (mix) {
      return this.startMatchWithMap(mix, drawn, {
        channel: message.channel,
        guild: message.guild,
        source: 'roleta',
        remainingInCycle,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎲 ROLETA OFICIAL DE MAPAS CS2')
      .setColor(0xf59e0b)
      .setDescription(
        `🗺️ **MAPA SORTEADO:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)\n` +
        `♻️ Roleta justa: faltam **${remainingInCycle}** mapa(s) para sair antes de qualquer repetição.\n` +
        `GL & HF!`
      )
      .setImage(drawn.image)
      .setFooter({ text: 'CS2 Mix Hub • Roleta justa sem repetição' })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  async prefixChooseMap(message, mapArg) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal. Use `!mix` para abrir uma fila!');

    if (!mapArg) {
      return message.reply({
        content: `🗺️ **Escolha o mapa da partida** (${mix.name}):\nOu digite direto, ex: \`!escolher mirage\``,
        components: this.buildMapPickMenu(mix),
      });
    }

    const drawn = this.findOfficialMap(mapArg);
    if (!drawn) {
      return message.reply(
        `⚠️ Mapa **${mapArg}** não encontrado. Mapas disponíveis: ${OFFICIAL_MAPS.map((m) => `\`${m.name}\``).join(', ')}`
      );
    }
    if (!this.canChooseMap(mix, message.author.id)) {
      return message.reply('🚫 Apenas jogadores do mix, capitães ou o criador podem escolher o mapa.');
    }
    return this.startMatchWithMap(mix, drawn, {
      channel: message.channel,
      guild: message.guild,
      source: 'escolha',
      user: message.author,
    });
  }

  async prefixCancel(message) {
    const existing = this.activeMixes.get(message.channelId);
    if (!existing) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    if (!this.isGuildModerator(message.member, message.guild, existing, message.author?.id)) {
      return message.reply('🚫 Apenas o **Criador do Mix** ou um **Administrador** pode cancelar este mix.');
    }
    const mix = this.deleteMix(message.channelId);
    return message.reply(`❌ O mix **${mix?.name || existing.name}** foi cancelado com sucesso.`);
  }

  async prefixRematch(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId, { includeFinished: true });
    if (!mix) {
      return message.reply('⚠️ Nenhum mix encontrado para iniciar uma revanche neste canal. Crie um mix com `!mix`!');
    }
    return this.handleRematch(mix, null, message.author, message.channel, message.guild);
  }

  async prefixRanking(message) {
    const embed = this.buildRankingEmbed();
    return message.reply({ embeds: [embed] });
  }

  async prefixHistory(message, args) {
    const limit = parseInt(args[0], 10) || 6;
    const embed = this.buildMatchHistoryEmbed(Math.min(15, Math.max(1, limit)));
    return message.reply({ embeds: [embed] });
  }

  async prefixHeadToHead(message, args) {
    let target = message.mentions.users.first();
    if (!target && args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '').trim();
      target = this.client?.users.cache.get(cleanId);
    }
    if (!target) {
      return message.reply(
        '👉 Para comparar o confronto direto, mencione o jogador ou passe o ID:\n' +
        'Exemplo: `!x1 @amigo` ou `!duelo @amigo`'
      );
    }
    if (target.id === message.author.id) {
      return message.reply('😅 Você não pode disputar um X1 contra você mesmo! Mencione outro jogador do servidor.');
    }
    const embed = this.buildHeadToHeadEmbed(message.author, target);
    return message.reply({ embeds: [embed] });
  }

  async prefixMapStats(message) {
    const embed = this.buildMapStatsEmbed();
    return message.reply({ embeds: [embed] });
  }

  async prefixIp(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    const conn = this.resolveMixDisplayConnect(mix);
    if (!conn) {
      return message.reply('⚠️ Nenhum servidor CS2 configurado no momento. Use `!servidor <ip:porta>` para definir o IP!');
    }
    const connectUrl = this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(conn.normalized)}`);
    const embed = new EmbedBuilder()
      .setTitle('💻 SERVIDOR CS2 DO MIX')
      .setDescription(
        `🌐 **Comando de Conexão no Console do CS2:**\n\`\`\`bash\n${conn.consoleCommand}\n\`\`\`\n` +
        `🚀 **Steam 1-Clique:** Clique no botão abaixo para abrir o Counter-Strike 2 e conectar diretamente!`
      )
      .setColor(0x10b981)
      .setFooter({ text: 'CS2 Mix Hub • Conexão Instantânea' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Conectar Direto no CS2 (Steam)')
        .setStyle(ButtonStyle.Link)
        .setURL(connectUrl)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  async prefixServerStatus(message, args) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    const rawAddress = (args && args.length > 0 ? args.join(' ') : '') || mix?.serverIp || this.config.serverConnect || '';
    if (!rawAddress.trim()) {
      return message.reply('⚠️ Nenhum servidor configurado. Use `!servidor <ip:porta>` ou `!status-server <ip:porta>`.');
    }
    const { hostPort, normalized } = extractHostAndPort(rawAddress);
    if (!hostPort) {
      return message.reply('⚠️ Endereço de servidor inválido. Use `!status-server <ip:porta>`.');
    }
    const res = await queryA2SServer(hostPort, 3000);
    const embed = this.buildServerStatusEmbed(res, hostPort);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Conectar no CS2')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(normalized || hostPort)}`))
    );
    return message.reply({ embeds: [embed], components: [row] });
  }

  async prefixGsi(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
    return message.reply(this.buildGsiGuidePayload(roomId));
  }

  async prefixLive(message, args = []) {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'parar' || sub === 'stop') {
      let stopped = 0;
      if (this.liveTrackers) {
        for (const [id, t] of this.liveTrackers.entries()) {
          if (t.channelId === message.channelId) {
            this.liveTrackers.delete(id);
            stopped++;
          }
        }
      }
      this.stopMixNarration(this.activeMixes?.get(message.channelId), message.channelId);
      return message.reply(`\u23f9\ufe0f Monitoramento de partida desativado neste canal (${stopped} rastreador(es) removido(s)).`);
    }

    const targetQuery = args.length > 0 ? args.join(' ') : null;
    const requester = message.author?.username || 'Jogador';
    const mix = this.resolveActiveMixForChannel(message.channelId);
    const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
    const embed = this.buildLiveMatchEmbed(requester, targetQuery, false, mix);
    const components = this.buildLiveMatchButtons(this.isGsiOnline(), false, roomId, mix, message.channelId);
    const sent = await message.reply({ embeds: [embed], components });
    this.registerLiveTracker(sent, requester, targetQuery, false);
    return sent;
  }
  async prefixMatchResult(message, args) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo encontrado neste canal para registrar vitória.');
    }
    const winner = (args[0] || '').toUpperCase();
    if (winner !== 'A' && winner !== 'B') {
      return message.reply('👉 Uso correto: `!vitoria A 13-9 [mapa]` ou `!vitoria B 13-11 [mapa]` (ex: `!vitoria A 13-9 Dust II`).');
    }
    const score = args[1] || '13-9';
    const map = args.slice(2).join(' ').trim() || '';
    const res = await this.recordMatchResult(mix, winner, score, message.author, message.channel, map);
    if (!res.success) return message.reply(`⚠️ ${res.error}`);
    return message.channel.send({ embeds: res.embeds, components: res.components });
  }

  async prefixSubstitute(message, args) {
    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo neste canal para fazer substituição.');
    }
    if (!args[0]) {
      return message.reply('👉 Uso correto: `!sub @novo_jogador` ou `!sub @jogador_antigo @novo_jogador`');
    }
    const outArg = args.length >= 2 ? args[0] : message.author.id;
    const inArg = args.length >= 2 ? args[1] : args[0];
    const res = await this.executeSubstitute(mix, outArg, inArg, message.guild, message.channel);
    return message.channel.send(res.message);
  }

  async prefixToggleRole(message) {
    if (!message.guild || !message.member) return;
    const res = await this.toggleMixRole(message.guild, message.member);
    return message.reply(res.message);
  }

  async prefixSetLevel(message, levelArg) {
    const raw = (levelArg || '').trim();
    const parsed = parseInt(raw, 10);
    if (!raw || isNaN(parsed) || parsed < 1 || parsed > 21) {
      const current = this.getPlayerLevel(message.author.id);
      return message.reply(
        `ℹ️ Seu nível atual da Gamers Club é **Lvl ${current || 16}**.\n` +
        `👉 Para alterar, digite: \`!lvl <1 a 21>\` (Exemplo: \`!lvl 19\` ou \`!gc 18\`).`
      );
    }

    this.setPlayerProfile(message.author.id, {
      level: parsed,
      username: message.author.username,
    });

    const mix = this.resolveActiveMixForChannel(message.channelId);
    if (mix) {
      let changed = false;
      const p = (mix.players || []).find((pl) => pl.id === message.author.id);
      if (p) { p.level = parsed; changed = true; }
      const w = (mix.waitlist || []).find((pl) => pl.id === message.author.id);
      if (w) { w.level = parsed; changed = true; }
      if (changed) {
        this.recomputeTeamAverages(mix, message.author.id, parsed);
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
      }
    }

    const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';
    return message.reply(
      `✅ <@${message.author.id}>, seu nível da Gamers Club foi configurado para **Lvl ${parsed}** (\`${badge}\`)!\n` +
      `Os próximos sorteios de times balancearão as equipes com base no seu nível real.`
    );
  }

  async prefixStats(message, userArg) {
    let target = message.author;
    if (message.mentions.users.first()) {
      target = message.mentions.users.first();
    }
    const embed = this.buildUserStatsEmbed(target);
    return message.reply({ embeds: [embed] });
  }

  async prefixGrenade(message, query) {
    const mapKey = resolveGrenadeMapKey(query);
    if (!mapKey || !GRENADE_GUIDES[mapKey]) {
      const supported = Object.keys(GRENADE_GUIDES).map((k) => `\`${k}\``).join(', ');
      return message.reply(
        `⚠️ Mapa **"${query}"** não encontrado no guia de granadas.\n` +
        `🗺️ **10 mapas disponíveis:** ${supported}\n` +
        `👉 Aceita atalhos como \`!smoke d2\`, \`!smoke ovp\`, \`!smoke trn\`, \`!smoke vrg\`, \`!smoke cac\`.`
      );
    }
    const guides = GRENADE_GUIDES[mapKey];
    const list = guides.map((g, i) => `**${i + 1}. ${g.title}**\n👉 ${g.desc}`).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`💨 GUIA DE GRANADAS E SMOKES • ${mapKey.toUpperCase()}`)
      .setDescription(`Lineups essenciais para dominar a **${mapKey.toUpperCase()}** no CS2:\n\n${list}`)
      .setColor(0x38bdf8)
      .setFooter({ text: 'CS2 Mix Hub • 10 Mapas • Guia Tático Oficial' });

    return message.reply({ embeds: [embed] });
  }

  async prefixTreino(message) {
    const cfg = `sv_cheats 1;\nmp_warmup_end;\nmp_roundtime_defuse 60;\nmp_buy_anywhere 1;\nmp_buytime 9999;\nmp_maxmoney 60000;\nmp_startmoney 60000;\nsv_infinite_ammo 1;\nammo_grenade_limit_total 6;\nsv_grenade_trajectory_prac_pipreview 1;\nsv_showimpacts 1;\nbot_kick;\nmp_restartgame 1;`;

    const embed = new EmbedBuilder()
      .setTitle('🎯 CFG OFICIAL DE TREINO • CS2')
      .setDescription(
        `Copie o bloco abaixo e cole no seu **Console do CS2** (tecla \` ou ') para iniciar um servidor de treino perfeito com dinheiro infinito, trajetória de granadas e tempo ilimitado:\n\n` +
        `\`\`\`cfg\n${cfg}\n\`\`\``
      )
      .setColor(0xf59e0b)
      .setFooter({ text: 'CS2 Mix Hub • Treino & Utilitários' });

    return message.reply({ embeds: [embed] });
  }

  async prefixCoinflip(message) {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? '🦅 CARA' : '👑 COROA';
    const color = isHeads ? 0x38bdf8 : 0xf59e0b;

    const embed = new EmbedBuilder()
      .setTitle('🪙 CARA OU COROA')
      .setDescription(`A moeda girou no ar e caiu em...\n\n# **${result}**!`)
      .setColor(color)
      .setFooter({ text: 'CS2 Mix Hub • Randomizer' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  async prefixPing(message) {
    const ping = this.client?.ws.ping || 0;
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;
    const activeCount = this.getUniqueActiveMixes().filter(
      (m) => m && m.phase !== 'finished' && m.phase !== 'cancelled'
    ).length;

    const embed = new EmbedBuilder()
      .setTitle('⚡ STATUS OPERACIONAL • CS2 MIX HUB BOT')
      .setColor(0x10b981)
      .addFields(
        { name: '📶 Latência (Ping)', value: `\`${ping}ms\``, inline: true },
        { name: '⏱️ Tempo Online', value: `\`${hours}h ${mins}m ${secs}s\``, inline: true },
        { name: '🌐 Servidores Conectados', value: `\`${this.client?.guilds.cache.size || 0}\``, inline: true },
        { name: '🎮 Mixes Ativos', value: `\`${activeCount}\``, inline: true }
      )
      .setFooter({ text: 'CS2 Mix Hub • Engine v14' });

    return message.reply({ embeds: [embed] });
  }

  async prefixHelp(message) {
    const embed = new EmbedBuilder()
      .setTitle('📖 GUIA DE COMANDOS • CS2 MIX HUB')
      .setColor(0x38bdf8)
      .setDescription(
        `Você pode usar o prefixo \`!\` ou barra \`/\` para tudo:\n\n` +
          `• \`!painel\` — Painel fixo com botão verde para abrir mix\n` +
          `• \`!mix\` ou \`!criar\` — Abre uma nova fila 5v5 com botões interativos e modo Equilibrado/Capitães\n` +
          `• \`!entrar\` / \`!sair\` — Entra no lobby (ou Fila de Reserva até 3/3 quando 10/10)\n` +
          `• \`!sortear\` — Sorteio inteligente e balanceamento snake-draft\n` +
          `• \`!roleta\` — Roleta rápida de mapas justa (não repete até sair todos os 7 mapas)\n` +
          `• \`!escolher [mapa]\` ou \`!mapa [nome]\` — Escolhe diretamente o mapa do mix (ex: \`!mapa mirage\` ou menu interativo)\n` +
          `• \`!veto\` — Pick & Ban oficial da Valve com escolha de lados CT/TR\n` +
          `• \`!revanche\` — Inicia revanche imediata mantendo os 10 jogadores com lados invertidos\n` +
          `• \`!vitoria [A|B] [placar]\` — Registra a vitória no ranking, calcula MVP/Bagre via GSI (ou abre voto no Bagre)\n` +
          `• \`!aovivo\` [parar] — Monitorar Partida com auto-atualização round a round (ou \`!ao vivo\`)\n` +
          `• \`!gsi\` — Instalação 1-comando ou download direto do \`.cfg\` do Valve GSI (zero \`.bat\`)\n` +
          `• \`!historico [qtde]\` — Histórico das últimas partidas finalizadas\n` +
          `• \`!x1 @amigo\` — Duelo direto Head-to-Head e sinergia de duo\n` +
          `• \`!mapas\` — Estatísticas dos mapas mais disputados no servidor\n` +
          `• \`!status-server\` — Consulta ping, mapa e players online no CS2 (A2S_INFO)\n` +
          `• \`!ranking\` / \`!top\` — Hall da Fama e Top 10 de vitórias e MVPs\n` +
          `• \`!sub [@antigo] @novo\` — Substitui um jogador (ou use o botão 🔄 Substituir no lobby)\n` +
          `• \`!cargo\` — Ativa/desativa notificações do cargo @Mix CS2 quando faltarem vagas\n` +
          `• \`!stats [@jogador]\` — Perfil competitivo, vitórias reais e medalhas de MVP\n` +
          `• \`!lvl <1-21>\` — Configura seu nível da Gamers Club (GC)\n` +
          `• \`!smoke [mapa]\` — Lineups de granadas em 10 mapas (Mirage, Inferno, Nuke, D2, Ancient, Anubis, Overpass, Train, Cache, Vertigo)\n` +
          `• \`!treino\` — CFG completa de treino para console do CS2\n` +
          `• \`!moeda\` — Sorteio de cara ou coroa para desempates rápidos\n` +
          `• \`!servidor [ip:porta [senha]]\` — Define ou consulta o IP/senha do servidor CS2\n` +
          `• \`!steam [link/id]\` — Scanner Steam & Anti-Smurf (horas CS2, VAC bans, idade da conta)\n` +
          `• \`!att\` ou \`!patchnotes\` — Últimas notas de atualização oficiais do CS2 pela Valve\n` +
          `• \`!pro\` ou \`!jogos\` — Agenda ao vivo dos times BR e internacionais (PandaScore / Liquipedia)\n` +
          `• \`!bagre\` — Votação bem-humorada do Bagre da Partida (com contagem real e desduplicação)\n` +
          `• \`!jogosgratis\` — Radar de jogos grátis para PC da semana (Epic Games & Steam)\n` +
          `• \`!clip [link]\` — Envia clipes de jogadas da comunidade com votação interativa\n` +
          `• \`!ofertas [busca]\` — Radar de promoções gamer (KaBuM!, Pichau, Terabyte: GPU, CPU, mesas, cadeiras)`
      )
      .setFooter({ text: 'CS2 Mix Hub • Powered by Discord.js' });
    return message.reply({ embeds: [embed] });
  }

  buildUserStatsEmbed(targetUser) {
    const profiles = this.loadPlayerProfiles();
    const prof = profiles[targetUser.id] || {};
    const level = prof.level || this.getPlayerLevel(targetUser.id) || 16;
    const wins = prof.wins || 0;
    const losses = prof.losses || 0;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const mvps = prof.mvps || 0;
    const streak = prof.streak || 0;
    const gcBadge = level >= 20 ? '👑 Major Lvl 20+' : level >= 18 ? '🏆 Lvl 18-19' : level >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';

    const embed = new EmbedBuilder()
      .setTitle(`📊 CARD DO COMPETIDOR • ${targetUser.username.toUpperCase()}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(0x38bdf8)
      .setDescription(
        `🏆 **Nível Gamers Club:** **Lvl ${level}** (\`${gcBadge}\`)\n` +
        `⚔️ **Classificação:** FACEIT Lvl ${Math.min(10, Math.max(5, Math.floor(level / 2)))} • Veterano da Comunidade CS2`
      )
      .addFields(
        { name: '🎮 Partidas Oficiais', value: `${total}`, inline: true },
        { name: '🏆 Vitórias', value: `${wins}`, inline: true },
        { name: '💀 Derrotas', value: `${losses}`, inline: true },
        { name: '🎯 Win Rate', value: `${winRate}%`, inline: true },
        { name: '⭐ MVPs de Partida', value: `${mvps}`, inline: true },
        { name: '🔥 Win Streak', value: streak > 0 ? `${streak} Seguidas` : '0', inline: true }
      )
      .setFooter({ text: 'CS2 Mix Hub • Perfil Competitivo Atualizado' })
      .setTimestamp();

    return embed;
  }

  buildRankingEmbed() {
    const profiles = this.loadPlayerProfiles();
    const list = Object.entries(profiles)
      .map(([id, p]) => {
        const wins = p.wins || 0;
        const losses = p.losses || 0;
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        return {
          id,
          username: p.username || 'Competidor',
          level: p.level || 16,
          wins,
          losses,
          total,
          winRate,
          mvps: p.mvps || 0,
          streak: p.streak || 0,
        };
      })
      .filter((p) => p.total > 0 || p.wins > 0 || p.mvps > 0)
      .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.winRate || 0) - (a.winRate || 0) || (b.mvps || 0) - (a.mvps || 0));

    if (list.length === 0) {
      return new EmbedBuilder()
        .setTitle('🏆 CS2 MIX HUB • HALL DA FAMA & RANKING')
        .setDescription(
          `Ainda não há partidas com resultado registrado neste servidor!\n\n` +
          `👉 **Como pontuar no Ranking:**\n` +
          `1. Crie uma partida com \`!mix\`\n` +
          `2. Jogue com seus amigos (10/10)\n` +
          `3. Ao final, use o botão **\`[🏆 Declarar Placar]\`** ou digite \`!vitoria A 13-9\`!\n\n` +
          `O ranking registrará automaticamente suas vitórias, taxa de win rate e MVPs!`
        )
        .setColor(0x38bdf8)
        .setFooter({ text: 'CS2 Mix Hub • Seja o primeiro campeão!' });
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines = list.slice(0, 10).map((p, i) => {
      const medal = medals[i] || `**#${i + 1}**`;
      const mvpBadge = p.mvps > 0 ? ` • ⭐ **${p.mvps}x MVP**` : '';
      const streakBadge = p.streak >= 2 ? ` • 🔥 **${p.streak} Win Streak**` : '';
      const userTag = isSnowflake(p.id) ? `<@${p.id}>` : `**${p.username}** 💬`;
      return `${medal} ${userTag} — **${p.wins}V** / ${p.losses}D (\`${p.winRate}%\` Win Rate)${mvpBadge}${streakBadge} • \`Lvl ${p.level} GC\``;
    });

    return new EmbedBuilder()
      .setTitle('🏆 HALL DA FAMA & RANKING GERAL • TOP 10 CS2')
      .setDescription(
        `Confira os maiores vencedores da comunidade nos Mixes 5v5:\n\n` +
        lines.join('\n\n') +
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *Para subir de posição, jogue mixes e registre a vitória com \`!vitoria A\` ou pelo botão!*`
      )
      .setColor(0xf59e0b)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Atualizado em tempo real' })
      .setTimestamp();
  }

  buildMatchHistoryEmbed(limit = 6) {
    const rawHistory = this.loadMatchHistory() || [];
    // Only matches with 10 players (5v5) that were finalized
    const history = rawHistory.filter(
      (m) => (m.winnerPlayers?.length || 0) + (m.loserPlayers?.length || 0) === 10
    );

    const embed = new EmbedBuilder()
      .setTitle('📜 HISTÓRICO DE PARTIDAS 5v5 • CS2 MIX HUB')
      .setColor(0x3b82f6)
      .setFooter({ text: 'CS2 Mix Hub • Apenas Partidas Oficiais 5v5 (10 Jogadores)' })
      .setTimestamp();

    if (!history || history.length === 0) {
      embed.setDescription(
        '🛡️ **Nenhuma partida oficial de 10 jogadores finalizada ainda!**\n\n' +
        'O histórico de partidas do servidor mantém **exclusivamente** partidas completas (5v5 com 10 jogadores) que foram concluídas.\n' +
        'Lobbies incompletos ou partidas sem estatísticas foram descartados para não lotar o histórico.\n\n' +
        '👉 Para registrar o placar de um mix 5v5 finalizado, use o botão **`[🏆 Declarar Placar]`** no lobby ou digite no chat:\n' +
        '`!vitoria A 13-9` ou `!vitoria B 13-11`.'
      );
      return embed;
    }

    const recent = history.slice(0, limit);
    embed.setDescription(`Exibindo as últimas **${recent.length}** partidas 5v5 completas (10 jogadores) finalizadas com mapas oficiais:`);

    recent.forEach((m, idx) => {
      const dateStr = m.timestamp
        ? new Date(m.timestamp).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Recente';
      const winNames = (m.winnerPlayers || []).map((p) => p.nick || p.username).join(', ') || 'Equipe';
      const loseNames = (m.loserPlayers || []).map((p) => p.nick || p.username).join(', ') || 'Equipe';
      const mvpBadge = m.mvpNick ? ` • ⭐ MVP: **${m.mvpNick}**` : '';
      const mapEmoji =
        m.map === 'Nuke' ? '☢️' :
        m.map === 'Inferno' ? '🏰' :
        m.map === 'Dust II' ? '🏜️' :
        m.map === 'Ancient' ? '🏛️' :
        m.map === 'Anubis' ? '🏺' :
        m.map === 'Vertigo' ? '🏢' :
        m.map === 'Overpass' ? '🌉' :
        m.map === 'Cache' ? '☣️' : '🎯';

      embed.addFields({
        name: `#${idx + 1} • ${mapEmoji} **${m.map || 'Mirage'}** [${m.score || '13-9'}] • 🏆 ${m.winner || 'Time A'}`,
        value:
          `📅 *${dateStr}*${mvpBadge}\n` +
          `👑 **Vencedores (5):** \`${winNames}\`\n` +
          `💀 **Derrotados (5):** \`${loseNames}\`\n` +
          `👤 *Declarado por: **${m.declaredBy || 'Admin'}***`,
        inline: false,
      });
    });

    return embed;
  }

  buildHeadToHeadEmbed(user1, user2) {
    const history = this.loadMatchHistory();
    const u1Id = String(user1.id);
    const u2Id = String(user2.id);
    const u1Name = user1.displayName || user1.username || 'Jogador 1';
    const u2Name = user2.displayName || user2.username || 'Jogador 2';

    let directDuels = 0;
    let u1Wins = 0;
    let u2Wins = 0;
    let teammatesCount = 0;
    let teammateWins = 0;

    history.forEach((m) => {
      const u1InWinners = (m.winnerPlayers || []).some((p) => String(p.id) === u1Id);
      const u1InLosers = (m.loserPlayers || []).some((p) => String(p.id) === u1Id);
      const u2InWinners = (m.winnerPlayers || []).some((p) => String(p.id) === u2Id);
      const u2InLosers = (m.loserPlayers || []).some((p) => String(p.id) === u2Id);

      // Direct duel (opposite teams)
      if ((u1InWinners && u2InLosers) || (u1InLosers && u2InWinners)) {
        directDuels++;
        if (u1InWinners) u1Wins++;
        else if (u2InWinners) u2Wins++;
      }
      // Teammates (same team)
      else if ((u1InWinners && u2InWinners) || (u1InLosers && u2InLosers)) {
        teammatesCount++;
        if (u1InWinners) teammateWins++;
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ CONFRONTO DIRETO • HEAD-TO-HEAD`)
      .setDescription(`Comparativo oficial de partidas entre **${u1Name}** vs **${u2Name}** no CS2 Mix Hub.`)
      .setColor(0x8b5cf6)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Estatísticas Head-to-Head' })
      .setTimestamp();

    if (directDuels === 0 && teammatesCount === 0) {
      embed.addFields({
        name: '🤝 Sem histórico mútuo',
        value: `Estes dois jogadores ainda não disputaram partidas juntos ou como adversários em mixes finalizados no servidor.`,
        inline: false,
      });
      return embed;
    }

    const u1Pct = directDuels > 0 ? Math.round((u1Wins / directDuels) * 100) : 50;
    const u2Pct = directDuels > 0 ? 100 - u1Pct : 50;
    const barBlocks = 10;
    const u1Blocks = Math.round((u1Pct / 100) * barBlocks);
    const u2Blocks = barBlocks - u1Blocks;
    const duelBar = `🟦`.repeat(Math.max(0, u1Blocks)) + `🟧`.repeat(Math.max(0, u2Blocks));

    embed.addFields(
      {
        name: `🥊 Duelos Diretos (Adversários): ${directDuels} jogos`,
        value: `${duelBar}\n\n` +
          `🟦 **${u1Name}:** **${u1Wins} vitórias** (${u1Pct}%)\n` +
          `🟧 **${u2Name}:** **${u2Wins} vitórias** (${u2Pct}%)`,
        inline: false,
      },
      {
        name: `🤝 Jogando no Mesmo Time (Duo / Parceiros): ${teammatesCount} jogos`,
        value: teammatesCount > 0
          ? `🏆 **Vitórias Juntos:** **${teammateWins} / ${teammatesCount}** (${Math.round((teammateWins / teammatesCount) * 100)}% de taxa de vitória conjunta)`
          : `*Ainda não jogaram na mesma equipe.*`,
        inline: false,
      }
    );

    return embed;
  }

  buildMapStatsEmbed() {
    const history = this.loadMatchHistory();
    const embed = new EmbedBuilder()
      .setTitle('🗺️ ESTATÍSTICAS DE MAPAS DO SERVIDOR • CS2')
      .setColor(0x10b981)
      .setFooter({ text: 'CS2 Mix Hub • Active Duty Analytics' })
      .setTimestamp();

    if (!history || history.length === 0) {
      embed.setDescription(
        'Nenhuma partida foi registrada ainda para calcular estatísticas de mapas!\n\n' +
        'O pool ativo da Valve inclui: **Mirage, Inferno, Nuke, Dust II, Ancient, Anubis e Cache**.'
      );
      return embed;
    }

    const mapCounts = {};
    history.forEach((m) => {
      const clean = (m.map || 'Mirage').replace(/^de_/, '');
      const mapName = clean.charAt(0).toUpperCase() + clean.slice(1);
      mapCounts[mapName] = (mapCounts[mapName] || 0) + 1;
    });

    const total = history.length;
    const sorted = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]);

    let desc = `Total de **${total}** partidas analisadas no servidor:\n\n`;
    sorted.forEach(([map, count], idx) => {
      const pct = Math.round((count / total) * 100);
      const medal = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📍';
      const greenBlocks = Math.max(1, Math.round(pct / 10));
      const darkBlocks = Math.max(0, 10 - greenBlocks);
      const bar = '🟩'.repeat(greenBlocks) + '⬛'.repeat(darkBlocks);
      desc += `${medal} **${map}**: **${count} jogos** (\`${pct}%\`)\n${bar}\n\n`;
    });

    embed.setDescription(desc);
    return embed;
  }

  buildServerStatusEmbed(queryResult, serverAddress) {
    const address = serverAddress || this.config.serverConnect || 'Não configurado';
    const embed = new EmbedBuilder().setTimestamp();

    if (queryResult.online) {
      embed
        .setTitle('📡 STATUS DO SERVIDOR CS2 • ONLINE 🟢')
        .setDescription(
          `O servidor de CS2 está online e respondendo via protocolo Valve A2S_INFO!\n\n` +
          `🏷️ **Nome do Servidor:** **${queryResult.name || 'Servidor CS2'}**\n` +
          `🗺️ **Mapa Atual:** \`${queryResult.map || 'de_mirage'}\`\n` +
          `👥 **Jogadores:** **${queryResult.players} / ${queryResult.maxPlayers}** ${queryResult.bots ? `(${queryResult.bots} bots)` : ''}\n` +
          `📶 **Latência (Ping UDP):** **${queryResult.ping} ms**\n` +
          `🔗 **Endereço IP:** \`${queryResult.host}:${queryResult.port}\`\n\n` +
          `👉 Para entrar, clique no botão abaixo ou digite no console:\n\`connect ${queryResult.host}:${queryResult.port}\``
        )
        .setColor(0x22c55e)
        .setFooter({ text: 'CS2 Mix Hub • Live Server Query Engine' });
    } else {
      embed
        .setTitle('📡 STATUS DO SERVIDOR CS2 • INACESSÍVEL / OFFLINE 🔴')
        .setDescription(
          `Não foi possível obter resposta UDP do servidor CS2 no endereço \`${address}\`.\n\n` +
          `⚠️ **Motivo:** ${queryResult.error || 'Tempo limite esgotado'}\n\n` +
          `💡 **Dicas para Conectar:**\n` +
          `• Verifique se o servidor dedicado de CS2 está aberto e ativo.\n` +
          `• Verifique se a porta UDP 27015 está liberada no firewall.\n` +
          `• Configure o IP correto usando \`!servidor <ip:porta>\`.`
        )
        .setColor(0xef4444)
        .setFooter({ text: 'CS2 Mix Hub • Live Server Query Engine' });
    }

    return embed;
  }

  async checkAndAwardTierRoles(guild, players, profiles) {
    if (!guild || !players || !Array.isArray(players)) return [];
    const awarded = [];

    const TIERS = [
      {
        name: 'Rei do Servidor',
        color: 0xffd700,
        check: (p, all) => {
          const list = Object.values(all).sort((a, b) => (b.wins || 0) - (a.wins || 0));
          return list[0] && list[0].username === p.username && (p.wins || 0) >= 10;
        },
      },
      { name: 'Major Champion', minWins: 30, color: 0xf59e0b },
      { name: 'Veterano do Mix', minWins: 15, color: 0x8b5cf6 },
      { name: 'Competidor', minWins: 5, color: 0x3b82f6 },
    ];

    try {
      const me = guild.members.me;
      const canManageRoles = me && me.permissions && me.permissions.has(PermissionsBitField.Flags.ManageRoles);
      if (!canManageRoles) return [];

      for (const p of players) {
        if (!p || !p.id || !isSnowflake(p.id)) continue;
        const prof = profiles[p.id];
        if (!prof) continue;
        const wins = prof.wins || 0;

        const member = await guild.members.fetch(p.id).catch(() => null);
        if (!member) continue;

        for (const tier of TIERS) {
          let qualifies = false;
          if (tier.check) {
            qualifies = tier.check(prof, profiles);
          } else if (wins >= tier.minWins) {
            qualifies = true;
          }

          if (qualifies) {
            let role = guild.roles.cache.find(
              (r) => r.name.toLowerCase() === tier.name.toLowerCase()
            );
            if (!role) {
              role = await guild.roles
                .create({
                  name: tier.name,
                  color: tier.color,
                  reason: 'Cargo automático por conquistas competitivas no CS2 Mix Hub',
                })
                .catch(() => null);
            }
            if (role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role).catch(() => {});
              awarded.push({ member, roleName: tier.name });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao verificar/atribuir patentes:', e.message);
    }
    return awarded;
  }

  async awardAutomaticBagre(guild, bagrePlayer, profiles) {
    if (!bagrePlayer || !bagrePlayer.id) return null;
    const bagreId = bagrePlayer.id;

    const prof = profiles[bagreId] || { level: bagrePlayer.level || 16, username: bagrePlayer.nick };
    prof.bagres = (prof.bagres || 0) + 1;
    profiles[bagreId] = prof;

    if (guild && isSnowflake(bagreId)) {
      try {
        let role = guild.roles.cache.find((r) => r.name.toLowerCase().includes('bagre do mix'));
        if (!role && guild.roles.create) {
          role = await guild.roles.create({
            name: 'Bagre do Mix 🐟',
            color: 0x94a3b8,
            reason: 'Cargo automático de Bagre da Partida (estatísticas CS2)',
          }).catch(() => null);
        }
        if (role) {
          const prevHolders = guild.members.cache.filter((m) => m.roles.cache.has(role.id));
          for (const [, prevMember] of prevHolders) {
            if (prevMember.id !== bagreId) {
              await prevMember.roles.remove(role).catch(() => {});
            }
          }
          const member = await guild.members.fetch(bagreId).catch(() => null);
          if (member) {
            await member.roles.add(role).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[BAGRE ROLE ERROR]:', err.message);
      }
    }
    return prof;
  }

  async handleRematch(mix, interaction, user, channel, guild) {
    if (!mix.teamA?.players || mix.teamA.players.length === 0 || !mix.teamB?.players || mix.teamB.players.length === 0) {
      const msg = '⚠️ Os times precisam estar definidos para jogar uma revanche.';
      if (interaction) return interaction.reply({ content: msg, ephemeral: true });
      if (channel) return channel.send(msg);
      return;
    }

    // Invert starting sides between Team A and Team B
    const prevStartA = (mix.teamA.startingSide || mix.teamA.side || 'CT').toUpperCase();
    const newSideA = prevStartA === 'CT' ? 'TR' : 'CT';
    const newSideB = newSideA === 'CT' ? 'TR' : 'CT';
    mix.teamA.side = newSideA;
    mix.teamB.side = newSideB;
    mix.teamA.startingSide = newSideA;
    mix.teamB.startingSide = newSideB;
    mix.teamA.halftimeSwapped = false;
    mix.teamB.halftimeSwapped = false;

    // Reset match and veto state while preserving all 10 players and captains
    mix.phase = 'veto';
    mix.winner = null;
    mix.finalScore = null;
    mix.matchMap = null;
    mix.matchMapImage = null;
    mix.finalMap = null;
    mix.mvp = null;
    mix.mvpVote = null;
    mix.bagre = null;
    mix.gsi = null;
    mix.liveState = null;
    mix._autoFinalizedKey = null;
    mix._minGsiTimestamp = Date.now();
    mix.rematchCount = (mix.rematchCount || 0) + 1;
    mix.narrationEnabled = false;
    if (mix.narrationChannels && mix.channelId) {
      mix.narrationChannels.delete(mix.channelId);
    }
    mix.veto = {
      currentTurn: 'teamA',
      bannedMaps: [],
      remainingMaps: [...OFFICIAL_MAPS],
      deciderMap: null,
      history: [],
    };

    if (mix.channelId) this.activeMixes.set(mix.channelId, mix);
    if (mix.id) this.activeMixes.set(mix.id, mix);

    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);

    const embed = this.buildVetoEmbed(mix);
    const components = this.buildVetoButtons(mix);

    const capAId = mix.teamA.captain?.id;
    const capBId = mix.teamB.captain?.id;
    const content =
      `🔄 🔥 **REVANCHE CONFIRMADA! (MESMOS TIMES)**\n\n` +
      `⚔️ Os mesmos 10 jogadores continuam na disputa com **lados invertidos**!\n` +
      `🛡️ **${mix.teamA.name} (${mix.teamA.side}):** Capitão ${isSnowflake(capAId) ? `<@${capAId}>` : `**${mix.teamA.captain?.displayName || mix.teamA.captain?.username || 'Capitão A'}**`}\n` +
      `💣 **${mix.teamB.name} (${mix.teamB.side}):** Capitão ${isSnowflake(capBId) ? `<@${capBId}>` : `**${mix.teamB.captain?.displayName || mix.teamB.captain?.username || 'Capitão B'}**`}\n\n` +
      `🗳️ **VETO DE MAPAS REINICIADO:** ${isSnowflake(capAId) ? `<@${capAId}>` : 'Capitão A'}, escolha um mapa para banir!`;

    if (interaction) {
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content, embeds: [embed], components }).catch(() => {});
      }
      return interaction.reply({ content, embeds: [embed], components }).catch(() => {});
    } else if (channel) {
      return channel.send({ content, embeds: [embed], components }).catch(() => {});
    }
  }

  resolveGsiSnapshotForMix(mix, { allowConsumedForSameMix = false } = {}) {
    if (!mix) return null;
    const minTs = mix._minGsiTimestamp || (mix.createdAt ? mix.createdAt - 60000 : 0);

    const isSnapshotValidForMix = (snap) => {
      if (!snap || typeof snap !== 'object') return false;
      if (snap._consumedByMixId && (!allowConsumedForSameMix || snap._consumedByMixId !== mix.id)) {
        return false;
      }
      if (mix._minGsiTimestamp) {
        if (typeof snap.receivedAt !== 'number' || snap.receivedAt < mix._minGsiTimestamp) {
          return false;
        }
      } else if (typeof snap.receivedAt === 'number' && minTs > 0 && snap.receivedAt < minTs) {
        return false;
      }

      const snapRoom = normalizeRoomId(snap.roomId, '');
      const mixRoom = normalizeRoomId(mix.id, '');
      if (snapRoom && snapRoom !== 'MIX-PRO' && mixRoom && snapRoom !== mixRoom) {
        return false;
      }
      if (snapRoom && mixRoom && snapRoom === mixRoom) {
        return true;
      }

      // Generic or untagged GSI payload: verify roster overlap when multiple mixes are active
      const mixNames = new Set(
        [
          ...(mix.players || []),
          ...(mix.teamA?.players || []),
          ...(mix.teamB?.players || []),
        ]
          .map((p) => String(p?.displayName || p?.nick || p?.username || p?.name || '').toLowerCase().trim())
          .filter((s) => s.length >= 2)
      );
      const gsiPlayers = Array.isArray(snap.allPlayersStats)
        ? snap.allPlayersStats
        : Array.isArray(snap.players)
        ? snap.players
        : snap.allplayers
        ? Object.values(snap.allplayers)
        : [];
      const hasRosterOverlap = gsiPlayers.some((gp) => {
        const gn = String(gp?.name || gp?.nick || '').toLowerCase().trim();
        return gn.length >= 2 && (mixNames.has(gn) || Array.from(mixNames).some((mn) => gn.includes(mn) || mn.includes(gn)));
      });
      if (hasRosterOverlap) return true;

      const activeCount = this.getUniqueActiveMixes
        ? this.getUniqueActiveMixes().filter((m) => m && m.phase !== 'finished' && m.phase !== 'cancelled').length
        : 1;
      return activeCount <= 1;
    };

    if (isSnapshotValidForMix(mix.gsi)) return mix.gsi;
    if (isSnapshotValidForMix(mix.liveState)) return mix.liveState;
    if (isSnapshotValidForMix(this.lastBestGsiState)) return this.lastBestGsiState;
    if (isSnapshotValidForMix(this.lastGsiState)) return this.lastGsiState;
    return null;
  }

  async recordMatchResult(mix, winnerTeamLetter, scoreInput, declaredByUser, channel, mapInput = null) {
    const rawWinner = String(winnerTeamLetter || '').trim().toUpperCase();
    const isA = rawWinner === 'A' || rawWinner.includes('TIME A') || rawWinner === '1' || rawWinner.includes('TIME 1');
    const isB = rawWinner === 'B' || rawWinner.includes('TIME B') || rawWinner === '2' || rawWinner.includes('TIME 2');
    if (!isA && !isB) {
      return { success: false, error: 'O vencedor deve ser Time A ou Time B (ex: `!vitoria A 13-9`).' };
    }

    if (!mix.teamA?.players || mix.teamA.players.length === 0 || !mix.teamB?.players || mix.teamB.players.length === 0) {
      return { success: false, error: 'Os times ainda não foram sorteados! Use `!sortear` antes de registrar o placar da partida.' };
    }

    const totalPlayers = (mix.teamA.players.length || 0) + (mix.teamB.players.length || 0);
    if (totalPlayers < 2) {
      return {
        success: false,
        error: `⚠️ Este mix possui apenas **${totalPlayers} jogador(es)**!\nPara registrar uma partida no histórico oficial, é necessário haver pelo menos 2 jogadores divididos entre os times.`,
      };
    }

    const winnerTeam = isA ? mix.teamA : mix.teamB;
    const loserTeam = isA ? mix.teamB : mix.teamA;
    const score = (scoreInput || '13-9').trim();

    const gsiState = this.resolveGsiSnapshotForMix(mix);

    // Accurately resolve map
    let candidateMap =
      mapInput ||
      mix.veto?.deciderMap?.name ||
      mix.veto?.deciderMap?.id ||
      mix.matchMap ||
      mix.finalMap?.name ||
      mix.finalMap?.id;

    if (!candidateMap && gsiState?.mapName && gsiState.mapName !== 'Indefinido') {
      candidateMap = gsiState.mapName;
    }

    const resolvedMap = normalizeMapName(candidateMap || 'Mirage');
    const resolvedImage = getMapImageUrl(resolvedMap);

    mix.phase = 'finished';
    mix.winner = winnerTeam.name;
    mix.finalScore = score;
    mix.matchMap = resolvedMap;
    mix.matchMapImage = resolvedImage;

    // Cache finished mix so post-match Bagre vote, Rematch & Voice Return work cleanly
    this.lastFinishedMixes = this.lastFinishedMixes || new Map();
    if (mix.id) {
      this.lastFinishedMixes.set(mix.id, mix);
    }
    if (mix.channelId) {
      this.lastFinishedMixes.set(`ch:${mix.channelId}`, mix);
    }
    while (this.lastFinishedMixes.size > 100) {
      const oldestKey = this.lastFinishedMixes.keys().next().value;
      if (oldestKey === undefined) break;
      this.lastFinishedMixes.delete(oldestKey);
    }
    this.syncToWebRoom(mix);

    const profiles = this.loadPlayerProfiles();

    // Update winners
    winnerTeam.players.forEach((p) => {
      const prof = profiles[p.id] || { level: p.level || 16, username: p.username };
      prof.wins = (prof.wins || 0) + 1;
      prof.totalMatches = (prof.totalMatches || 0) + 1;
      prof.streak = (prof.streak || 0) + 1;
      prof.username = p.username || prof.username;
      profiles[p.id] = prof;
    });

    // Update losers
    loserTeam.players.forEach((p) => {
      const prof = profiles[p.id] || { level: p.level || 16, username: p.username };
      prof.losses = (prof.losses || 0) + 1;
      prof.totalMatches = (prof.totalMatches || 0) + 1;
      prof.streak = 0;
      prof.username = p.username || prof.username;
      profiles[p.id] = prof;
    });

    const displayConn = this.resolveMixDisplayConnect(mix);

    // Save match to match history with full rich metadata
    const parsedWinner = parseInt(String(score).split('-')[0], 10) || 13;
    const parsedLoser = parseInt(String(score).split('-')[1], 10) || 8;
    const matchRecord = {
      id: mix.id,
      source: 'discord',
      platform: 'Discord Bot',
      sourceLabel: 'Via Discord',
      guildName: channel?.guild?.name || 'Servidor Discord Oficial',
      guildId: channel?.guild?.id || '',
      channelName: channel?.name ? `#${channel.name}` : '#mix-5v5',
      channelId: channel?.id || '',
      format: mix.format || 'MD1',
      balancePct: mix.balancePct || 95,
      serverConnect: displayConn?.normalized || '',
      timestamp: Date.now(),
      map: resolvedMap,
      mapImage: resolvedImage,
      winner: winnerTeam.name,
      loser: loserTeam.name,
      score,
      scoreWinner: parsedWinner,
      scoreLoser: parsedLoser,
      declaredBy: declaredByUser.displayName || declaredByUser.username,
      declaredById: declaredByUser.id,
      winnerPlayers: winnerTeam.players.map((p, idx) => ({
        id: p.id,
        nick: p.displayName || p.username || `Jogador ${idx + 1}`,
        level: p.level || 16,
        avatar: typeof p.displayAvatarURL === 'function' ? p.displayAvatarURL() : (p.avatar || ''),
        role: p.id === winnerTeam.captain?.id ? 'Capitão' : 'Jogador',
      })),
      loserPlayers: loserTeam.players.map((p, idx) => ({
        id: p.id,
        nick: p.displayName || p.username || `Jogador ${idx + 1}`,
        level: p.level || 16,
        avatar: typeof p.displayAvatarURL === 'function' ? p.displayAvatarURL() : (p.avatar || ''),
        role: p.id === loserTeam.captain?.id ? 'Capitão' : 'Jogador',
      })),
      vetoBans: Array.isArray(mix.veto?.bannedMaps) ? mix.veto.bannedMaps : [],
    };

    // Compute MVP & Bagre ONLY when genuine Valve GSI stats were captured
    const { mvp: computedMvp, bagre: computedBagre, evaluatedPlayers, hasRealGsiStats } = computeMatchPerformers(matchRecord, gsiState);

    if (hasRealGsiStats && gsiState) {
      gsiState._consumedByMixId = mix.id;
      if (this.lastBestGsiState && this.lastBestGsiState.receivedAt === gsiState.receivedAt) {
        this.lastBestGsiState._consumedByMixId = mix.id;
      }
      if (this.lastGsiState && this.lastGsiState.receivedAt === gsiState.receivedAt) {
        this.lastGsiState._consumedByMixId = mix.id;
      }
      mix.gsi = gsiState;
      mix.liveState = gsiState;
    }

    if (hasRealGsiStats && computedMvp) {
      matchRecord.mvpId = computedMvp.id;
      matchRecord.mvpNick = computedMvp.nick;
      matchRecord.mvp = computedMvp;
      matchRecord.mvpStats = computedMvp;

      const mvpProf = profiles[computedMvp.id] || { level: computedMvp.level || 16, username: computedMvp.nick };
      mvpProf.mvps = (mvpProf.mvps || 0) + 1;
      profiles[computedMvp.id] = mvpProf;
    }

    if (hasRealGsiStats && computedBagre) {
      matchRecord.bagreId = computedBagre.id;
      matchRecord.bagreNick = computedBagre.nick;
      matchRecord.bagre = computedBagre;
      matchRecord.bagreStats = computedBagre;

      await this.awardAutomaticBagre(channel?.guild, computedBagre, profiles);
    }

    matchRecord.hasRealGsiStats = Boolean(hasRealGsiStats);
    matchRecord.evaluatedPlayers = hasRealGsiStats ? evaluatedPlayers : [];

    this.savePlayerProfiles(profiles);
    recordMatchHistoryEntry(matchRecord);
    this.updateLeaderboardFile(profiles);
    if (typeof this.onMatchRecorded === 'function') {
      try { this.onMatchRecorded(matchRecord); } catch (e) {}
    }

    this.checkAndAwardTierRoles(channel?.guild, winnerTeam.players, profiles).catch((err) => {
      console.warn('[DISCORD BOT] Falha ao atribuir patentes automaticas:', err.message);
    });

    const mvpUserTag = computedMvp
      ? (isSnowflake(computedMvp.id) ? `<@${computedMvp.id}>` : `**${computedMvp.nick || computedMvp.username}**`)
      : '';
    const bagreUserTag = computedBagre
      ? (isSnowflake(computedBagre.id) ? `<@${computedBagre.id}>` : `**${computedBagre.nick || computedBagre.username}**`)
      : '';

    const mvpDescription = hasRealGsiStats && computedMvp
      ? `\n\n\ud83d\udc51 **MVP DA PARTIDA (AUTOM\u00c1TICO - CS2 STATS):** ${mvpUserTag}\n` +
        `\u2b50 **Desempenho:** \ud83c\udfaf **${computedMvp.kills} Kills** \u2022 \ud83d\udc80 **${computedMvp.deaths} Mortes** (\ud83d\udd1d **${computedMvp.assists}A**) \u2022 K/D **${computedMvp.kd}** \u2022 \u2b50 **${computedMvp.mvps} MVPs** \u2022 \ud83d\udcca Rating **${computedMvp.rating}**\n`
      : '';

    const bagreQuote = bagreVoteService.getRandomQuote();
    const bagreDescription = hasRealGsiStats && computedBagre
      ? `\n\ud83d\udc1f **BAGRE DO MIX (AUTOM\u00c1TICO - CS2 STATS):** ${bagreUserTag}\n` +
        `\ud83c\udfa3 **Desempenho:** \ud83c\udfaf **${computedBagre.kills} Kills** \u2022 \ud83d\udc80 **${computedBagre.deaths} Mortes** (\ud83d\udd1d **${computedBagre.assists}A**) \u2022 K/D **${computedBagre.kd}** \u2022 \ud83d\udcca Rating **${computedBagre.rating}**\n` +
        `*${bagreQuote}*`
      : '';

    const declaredTag = isSnowflake(declaredByUser.id) ? `<@${declaredByUser.id}>` : `**${declaredByUser.username || declaredByUser.displayName}**`;

    const scoreboardLines = hasRealGsiStats
      ? (evaluatedPlayers || []).slice(0, 10).map((ep, idx) => {
          const medal = idx === 0 ? '\ud83d\udc51' : (computedBagre && ep.id === computedBagre.id ? '\ud83d\udc1f' : `**${idx + 1}.**`);
          const pTag = isSnowflake(ep.id) ? `<@${ep.id}>` : `**${ep.nick}**`;
          const cs2Alias = ep.cs2Name && ep.cs2Name.toLowerCase() !== ep.nick.toLowerCase() ? ` (\`${ep.cs2Name}\`)` : '';
          return `${medal} ${pTag}${cs2Alias} \u2014 \ud83c\udfaf **${ep.kills}/${ep.deaths}/${ep.assists}** \u2022 K/D \`${ep.kd}\` \u2022 \u2b50 \`${ep.mvps} MVP\` \u2022 Rating **\`${ep.rating}\`**`;
        }).join('\n')
      : '';

    const victoryEmbed = new EmbedBuilder()
      .setTitle(`\ud83c\udfc6 VIT\u00d3RIA DO ${winnerTeam.name.toUpperCase()}! \u2022 PLACAR ${score}`)
      .setDescription(
        `A partida foi encerrada e as vit\u00f3rias/derrotas oficiais foram computadas no **Ranking Geral**!\n\n` +
        `\ud83d\uddfa\ufe0f **Mapa:** **${resolvedMap}**\n` +
        `\u2694\ufe0f **Resultado Oficial:** **${winnerTeam.name}** venceu por **${score}**!\n` +
        `\ud83d\udce1 **Fonte dos Dados:** ${hasRealGsiStats ? '\ud83d\udfe2 **Telemetria Real CS2 (Valve GSI)**' : `Placares manuais (${declaredTag})`}` +
        mvpDescription +
        bagreDescription
      )
      .setColor(0x22c55e)
      .addFields(
        ...(scoreboardLines
          ? [
              {
                name: '\ud83d\udcca Scoreboard Geral da Partida (Kills / Mortes / Assists / Rating)',
                value: scoreboardLines,
                inline: false,
              },
            ]
          : [
              {
                name: '\ud83d\udce1 Telemetria / Estat\u00edsticas CS2',
                value: '\u26a0\ufe0f **Valve GSI n\u00e3o estava ativo nesta partida** \u2014 K/D, MVP e Bagre n\u00e3o foram inventados.\nUse **`[\ud83d\udc1f Votar Bagre do Mix]`** abaixo (ou `!bagre`) para a galera eleger o Bagre!',
                inline: false,
              },
            ]),
        ...(hasRealGsiStats && computedMvp
          ? [
              {
                name: `\ud83d\udc51 Destaque MVP \u2022 ${computedMvp.nick}`,
                value: `\ud83c\udfaf **${computedMvp.kills}K / ${computedMvp.deaths}D / ${computedMvp.assists}A** \u2022 \u26a1 **${computedMvp.kd} K/D** \u2022 \u2b50 **${computedMvp.mvps} MVPs** \u2022 \ud83d\udcc8 **${computedMvp.rating} Rating**\n\ud83c\udfc6 Total na carreira: **${profiles[computedMvp.id]?.mvps || 1}x MVP**`,
                inline: true,
              },
            ]
          : []),
        ...(hasRealGsiStats && computedBagre
          ? [
              {
                name: `\ud83d\udc1f Bagre Coroado \u2022 ${computedBagre.nick}`,
                value: `\ud83c\udfaf **${computedBagre.kills}K / ${computedBagre.deaths}D / ${computedBagre.assists}A** \u2022 \u26a1 **${computedBagre.kd} K/D** \u2022 \ud83d\udcc9 **${computedBagre.rating} Rating**\n\ud83d\udc1f Total na carreira: **${profiles[computedBagre.id]?.bagres || 1}x Bagre**`,
                inline: true,
              },
            ]
          : []),
        {
          name: `\ud83e\udd47 Campe\u00f5es \u2022 ${winnerTeam.name} (+1 Vit\u00f3ria)`,
          value: winnerTeam.players.map((p) => `\ud83d\udc51 ${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.username || 'Jogador'}**`} \`[Lvl ${p.level || 16}]\``).join('\n') || '*Sem jogadores*',
          inline: false,
        },
        {
          name: `\ud83e\udd48 Vice-Campe\u00f5es \u2022 ${loserTeam.name}`,
          value: loserTeam.players.map((p) => `\ud83d\udc80 ${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.username || 'Jogador'}**`} \`[Lvl ${p.level || 16}]\``).join('\n') || '*Sem jogadores*',
          inline: false,
        }
      )
      .setFooter({
        text: hasRealGsiStats
          ? 'CS2 Mix Hub \u2022 MVP e Bagre Eleitos via Telemetria Real (Valve GSI)'
          : 'CS2 Mix Hub \u2022 Vit\u00f3ria Registrada (Use Votar Bagre do Mix abaixo)',
      })
      .setTimestamp();

    if (resolvedImage) {
      victoryEmbed.setThumbnail(resolvedImage);
    }

    const components = [];
    const finishBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bagre_open:${mix.id}`)
        .setLabel('Votar Bagre do Mix')
        .setEmoji('\ud83d\udc1f')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_rematch:${mix.id}`)
        .setLabel('Revanche (Mesmos Times)')
        .setEmoji('\ud83d\udd04')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mix_voice_lobby:${mix.id}`)
        .setLabel('Voltar para o Geral')
        .setEmoji('\ud83d\udd0a')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('Novo Mix (Zerar)')
        .setEmoji('\ud83c\udfae')
        .setStyle(ButtonStyle.Primary)
    );
    components.push(finishBtn);

    return { success: true, embeds: [victoryEmbed], components };
  }

  async notifyMissingSlots(mix, guild, channel) {
    if (!guild || !channel) return;
    const missing = 10 - (mix.players?.length || 0);
    if (missing !== 1 && missing !== 2) return;

    if (!mix.notifiedMissing) {
      mix.notifiedMissing = new Set();
    }
    if (mix.notifiedMissing.has(missing)) return;
    mix.notifiedMissing.add(missing);

    try {
      const role = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'mix cs2' || r.name.toLowerCase() === 'mix'
      );
      const roleMention = role ? `<@&${role.id}> ` : '';
      const plural = missing === 1 ? 'VAGA RESTANTE' : 'VAGAS RESTANTES';
      const msg = `📢 ${roleMention}**FALTA(M) APENAS ${missing} ${plural} PARA FECHAR O MIX 5v5!**\n` +
        `👉 Quem vai jogar? Clique no botão verde **\`[➕ Entrar]\`** ou digite \`!entrar\` agora!`;
      await channel.send(msg);
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao notificar vagas:', e.message);
    }
  }

  async toggleMixRole(guild, member) {
    if (!guild || !member) return { success: false, message: 'Servidor ou membro inválido.' };
    try {
      let role = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'mix cs2' || r.name.toLowerCase() === 'mix'
      );
      if (!role) {
        try {
          role = await guild.roles.create({
            name: 'Mix CS2',
            color: 0x38bdf8,
            reason: 'Cargo de notificações para partidas de CS2 Mix Hub',
          });
        } catch (roleCreateErr) {
          return { success: false, message: '⚠️ Não foi possível encontrar ou criar o cargo `@Mix CS2`. Verifique se o bot tem permissão de gerenciar cargos!' };
        }
      }

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id);
        return { success: true, added: false, roleId: role.id, message: `🔕 Você removeu o cargo <@&${role.id}>. Você não será mais notificado quando faltarem vagas nos mixes.` };
      } else {
        await member.roles.add(role.id);
        return { success: true, added: true, roleId: role.id, message: `🔔 Sucesso! Você recebeu o cargo <@&${role.id}>! Você será avisado automaticamente quando faltarem 1 ou 2 vagas para iniciar o 5v5!` };
      }
    } catch (e) {
      return { success: false, message: `❌ Erro ao gerenciar cargo: ${e.message}` };
    }
  }

  async executeSubstitute(mix, outArg, inArg, guild, channel) {
    if (!mix) return { success: false, message: 'Nenhum mix ativo encontrado neste canal.' };
    const cleanOut = (outArg || '').replace(/[<@!>]/g, '').trim().toLowerCase();
    const cleanIn = (inArg || '').replace(/[<@!>]/g, '').trim().toLowerCase();

    if (!cleanOut || !cleanIn) {
      return { success: false, message: '⚠️ Informe quem sai e quem entra na substituição.' };
    }

    let outIdx = mix.players.findIndex(
      (p) =>
        String(p.id).toLowerCase() === cleanOut ||
        (p.displayName || '').toLowerCase() === cleanOut ||
        (p.username || '').toLowerCase() === cleanOut
    );
    if (outIdx === -1) {
      outIdx = mix.players.findIndex(
        (p) => (p.displayName || p.username || '').toLowerCase().includes(cleanOut)
      );
    }
    if (outIdx === -1) {
      return { success: false, message: `❌ Não foi possível encontrar o jogador que vai sair: "${outArg}".` };
    }
    const oldPlayer = mix.players[outIdx];

    let newMember = null;
    if (guild) {
      if (isSnowflake(cleanIn) && typeof guild.members?.fetch === 'function') {
        newMember = await guild.members.fetch(cleanIn).catch(() => null);
      }
      if (!newMember && guild.members?.cache) {
        newMember =
          guild.members.cache.find(
            (m) =>
              m.id === cleanIn ||
              (m.user?.username || '').toLowerCase() === cleanIn ||
              (m.displayName || '').toLowerCase() === cleanIn
          ) ||
          guild.members.cache.find(
            (m) =>
              (m.user?.username || '').toLowerCase().includes(cleanIn) ||
              (m.displayName || '').toLowerCase().includes(cleanIn)
          );
      }
    }

    const newId = newMember ? newMember.id : cleanIn;
    const newUsername = newMember ? newMember.user.username : inArg;
    const newDisplayName = newMember ? newMember.displayName : inArg;
    const newAvatar = newMember ? newMember.user.displayAvatarURL({ dynamic: true }) : null;

    if (mix.players.some((p) => p.id === newId)) {
      return { success: false, message: `⚠️ O substituto ${isSnowflake(newId) ? `<@${newId}>` : `**${newDisplayName}**`} já está participando deste mix!` };
    }

    const newLevel = this.getPlayerLevel(newId);
    const newPlayerObj = {
      id: newId,
      username: newUsername,
      displayName: newDisplayName,
      avatar: newAvatar,
      level: newLevel,
      ready: true,
    };

    mix.players.splice(outIdx, 1, newPlayerObj);
    if (mix.readyCheck?.confirmed) {
      mix.readyCheck.confirmed.delete(oldPlayer.id);
    }
    if (Array.isArray(mix.waitlist)) {
      mix.waitlist = mix.waitlist.filter((w) => w.id !== newId);
    }
    if (Array.isArray(mix.captainDraft?.pool)) {
      const poolIdx = mix.captainDraft.pool.findIndex((p) => p.id === oldPlayer.id);
      if (poolIdx !== -1) mix.captainDraft.pool.splice(poolIdx, 1, newPlayerObj);
    }

    let teamName = 'Lobby';
    let targetTeam = null;
    const idxA = (mix.teamA?.players || []).findIndex((p) => p.id === oldPlayer.id);
    if (idxA !== -1) {
      mix.teamA.players.splice(idxA, 1, newPlayerObj);
      teamName = mix.teamA.name;
      targetTeam = 'teamA';
      if (mix.teamA.captain?.id === oldPlayer.id) mix.teamA.captain = newPlayerObj;
    }

    const idxB = (mix.teamB?.players || []).findIndex((p) => p.id === oldPlayer.id);
    if (idxB !== -1) {
      mix.teamB.players.splice(idxB, 1, newPlayerObj);
      teamName = mix.teamB.name;
      targetTeam = 'teamB';
      if (mix.teamB.captain?.id === oldPlayer.id) mix.teamB.captain = newPlayerObj;
    }

    this.recomputeTeamAverages(mix);

    if (guild?.id && this._voiceOverwriteCache) {
      for (const k of Array.from(this._voiceOverwriteCache.keys())) {
        if (k.startsWith(`${guild.id}:`)) {
          this._voiceOverwriteCache.delete(k);
        }
      }
    }

    if (this.config.autoMoveVoice && targetTeam && guild && newMember) {
      const gVoice = this.config.guildVoiceChannels?.[guild.id] || {};
      const voiceId = targetTeam === 'teamA'
        ? (gVoice.teamAVoiceId || this.config.teamAVoiceId)
        : (gVoice.teamBVoiceId || this.config.teamBVoiceId);
      if (voiceId && newMember.voice?.channelId) {
        newMember.voice.setChannel(voiceId).catch(() => {});
      }
    }

    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);

    const oldTag = isSnowflake(oldPlayer.id) ? `<@${oldPlayer.id}>` : `**${oldPlayer.displayName || oldPlayer.username}**`;
    const newTag = isSnowflake(newPlayerObj.id) ? `<@${newPlayerObj.id}>` : `**${newPlayerObj.displayName}**`;

    return {
      success: true,
      message: `🔄 **SUBSTITUIÇÃO EFETUADA!**\n${oldTag} foi substituído por ${newTag} \`[Lvl ${newLevel} GC]\` no **${teamName}**!`,
    };
  }

  // ==========================================
  // MIX MANAGEMENT & ENGINE
  // ==========================================

  resolveMixFromInteraction(interaction, customId = null) {
    const rawId = customId || (interaction && interaction.customId) || '';
    const targetMixId = rawId.includes(':') ? rawId.split(':')[1] : null;
    const chanId = interaction?.channelId || null;

    if (targetMixId) {
      const direct = this.activeMixes.get(targetMixId);
      if (direct && (!chanId || !direct.channelId || direct.channelId === chanId)) {
        return direct;
      }
      const byId = Array.from(this.activeMixes.values()).find(
        (m) => m && m.id === targetMixId && (!chanId || !m.channelId || m.channelId === chanId)
      );
      if (byId) return byId;
      if (this.webRoomsRef && this.webRoomsRef.has(targetMixId)) {
        const wr = this.webRoomsRef.get(targetMixId);
        if (wr && (!chanId || !wr.channelId || wr.channelId === chanId)) {
          return wr;
        }
      }
      return null;
    }

    if (chanId && this.activeMixes.has(chanId)) {
      return this.activeMixes.get(chanId);
    }

    if (chanId && this.webRoomsRef && this.webRoomsRef.size > 0) {
      const active = Array.from(this.webRoomsRef.values()).find(
        (r) => r && r.channelId === chanId && r.phase !== 'cancelled' && r.phase !== 'finished'
      );
      if (active) return active;
    }

    return null;
  }

  resolveMixIncludingFinished(mixId, channelId = null) {
    if (mixId) {
      const direct = this.activeMixes.get(mixId);
      if (direct && (!channelId || !direct.channelId || direct.channelId === channelId)) {
        return direct;
      }
      const activeById = Array.from(this.activeMixes.values()).find(
        (m) => m && m.id === mixId && (!channelId || !m.channelId || m.channelId === channelId)
      );
      if (activeById) return activeById;
      const finished = this.lastFinishedMixes?.get(mixId);
      if (finished && (!channelId || !finished.channelId || finished.channelId === channelId)) {
        return finished;
      }
    }
    if (channelId) {
      const activeCh = this.activeMixes.get(channelId);
      if (activeCh) return activeCh;
      const finishedCh = this.lastFinishedMixes?.get(`ch:${channelId}`);
      if (finishedCh) return finishedCh;
    }
    return null;
  }

  getOrCreateMix(channelId, creator, options = {}) {
    let mix = options.forceNew ? null : this.activeMixes.get(channelId);
    if (mix && (mix.phase === 'finished' || mix.phase === 'cancelled')) {
      mix = null;
    }
    if (!mix) {
      const mixId = options.id || `MIX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      mix = {
        id: mixId,
        channelId,
        name: options.name || `Mix CS2 #${mixId}`,
        format: options.format || 'MD1',
        balanceMode: options.balanceMode || 'balanced',
        creatorId: creator.id,
        creatorNick: creator.username,
        players: Array.isArray(options.players) ? options.players : [],
        waitlist: [],
        phase: 'lobby', // 'lobby' | 'ready_check' | 'captain_draft' | 'teams' | 'veto' | 'side_pick' | 'live' | 'finished'
        readyCheck: {
          active: false,
          confirmed: new Set(),
          expiresAt: null,
          timer: null,
        },
        teamA: { name: 'Time A', captain: null, players: [], side: 'CT', startingSide: 'CT', halftimeSwapped: false, avgLevel: 16 },
        teamB: { name: 'Time B', captain: null, players: [], side: 'TR', startingSide: 'TR', halftimeSwapped: false, avgLevel: 16 },
        balancePct: 95,
        veto: {
          currentTurn: 'teamA',
          bannedMaps: [],
          remainingMaps: [...OFFICIAL_MAPS],
          deciderMap: null,
          history: [],
        },
        serverIp: extractHostAndPort(this.config.serverConnect || '').normalized || '',
        messageId: null,
        createdAt: Date.now(),
      };
      this.activeMixes.set(channelId, mix);
      if (mix.id) this.activeMixes.set(mix.id, mix);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      scheduleSave(100);
    }
    return mix;
  }

  recoverMixFromMessage(interaction, mixId) {
    if (!interaction?.channelId || !mixId) return null;
    if (this.lastFinishedMixes?.has(mixId)) return null;

    const embeds = interaction.message?.embeds || [];
    const MIX_HUB_TITLES = [
      'CS2 MIX HUB',
      'CHECK-IN ANTI-AFK',
      'TIMES FORMADOS',
      'DRAFT DE CAPITÃES',
      'PICK & BAN',
      'ESCOLHA DE LADO',
      'PARTIDA CONFIRMADA',
    ];
    const hasMixHubEmbed = embeds.some((emb) => {
      const t = String(emb?.title || '').toUpperCase();
      return MIX_HUB_TITLES.some((prefix) => t.includes(prefix));
    });
    if (!hasMixHubEmbed) return null;

    let recoveredName = `Mix 5v5 #${mixId}`;
    const recoveredPlayers = [];
    const seenIds = new Set();

    for (const emb of embeds) {
      if (emb.title && emb.title.includes('•')) {
        const parts = emb.title.split('•');
        const candidate = parts[parts.length - 1]?.trim();
        if (candidate && !candidate.includes('COMO MEXER')) {
          recoveredName = candidate;
        }
      }
      for (const field of emb.fields || []) {
        if (field.name?.includes('Jogadores') || field.name?.includes('Titulares') || field.name === '\u200B') {
          const matches = String(field.value || '').matchAll(/<@!?(\d+)>[^\n]*?(?:Lvl|Lv\.?|N[ií]vel)\s*[:.]?\s*(\d+)/gi);
          for (const m of matches) {
            const pId = m[1];
            const pLvl = parseInt(m[2], 10) || this.getPlayerLevel(pId) || 16;
            if (pId && !seenIds.has(pId)) {
              seenIds.add(pId);
              const cachedUser = this.client?.users?.cache?.get(pId);
              recoveredPlayers.push({
                id: pId,
                username: cachedUser?.username || `Player_${pId.slice(-4)}`,
                displayName: cachedUser?.displayName || cachedUser?.username || `Player_${pId.slice(-4)}`,
                avatar: cachedUser ? cachedUser.displayAvatarURL({ dynamic: true }) : null,
                level: pLvl,
                ready: true,
              });
            }
          }
        }
      }
    }

    return this.getOrCreateMix(interaction.channelId, interaction.user, {
      id: mixId,
      name: recoveredName,
      players: recoveredPlayers,
      forceNew: true,
    });
  }

  deleteMix(channelId) {
    const mix = this.activeMixes.get(channelId);
    if (!mix) return null;
    if (mix.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
    this.activeMixes.delete(channelId);
    if (mix.id) this.activeMixes.delete(mix.id);
    if (this.webRoomsRef && mix.id) {
      this.webRoomsRef.delete(mix.id);
      if (typeof this.onRoomUpdated === 'function') {
        try {
          this.onRoomUpdated(mix.id, null);
        } catch (_) {}
      }
    }
    clearMixPersistence(mix.id);
    scheduleSave(50);
    return mix;
  }

  getEffectivePlayerScore(p) {
    const baseLvl = Number(p.level || this.getPlayerLevel(p.id) || 16);
    try {
      const lb = typeof getLeaderboard === 'function' ? getLeaderboard() : [];
      const entry = lb.find(
        (item) => item.id === p.id || (item.nick && p.username && item.nick.toLowerCase() === p.username.toLowerCase())
      );
      if (entry && entry.matchesPlayed >= 3) {
        const confidence = Math.min(1, entry.matchesPlayed / 8);
        const winRateDelta = ((Number(entry.winRate ?? 50) - 50) / 50) * 1.8;
        return Math.max(1, Number((baseLvl + winRateDelta * confidence).toFixed(2)));
      }
    } catch (_) {}
    return baseLvl;
  }

  recomputeTeamAverages(mix, updatedUserId = null, newLevel = null) {
    if (!mix) return;
    const applyUpdate = (arr) => {
      if (!Array.isArray(arr)) return;
      for (const p of arr) {
        if (!p) continue;
        if (updatedUserId && p.id === updatedUserId && newLevel !== null) {
          p.level = newLevel;
        }
        p.effectiveScore = this.getEffectivePlayerScore(p);
      }
    };
    applyUpdate(mix.players);
    applyUpdate(mix.waitlist);
    applyUpdate(mix.teamA?.players);
    applyUpdate(mix.teamB?.players);
    applyUpdate(mix.captainDraft?.pool);
    if (updatedUserId && newLevel !== null) {
      if (mix.teamA?.captain?.id === updatedUserId) mix.teamA.captain.level = newLevel;
      if (mix.teamB?.captain?.id === updatedUserId) mix.teamB.captain.level = newLevel;
    }

    const aPlayers = mix.teamA?.players || [];
    const bPlayers = mix.teamB?.players || [];
    if (aPlayers.length > 0 && bPlayers.length > 0) {
      const sumA = aPlayers.reduce((acc, p) => acc + (Number(p.level) || 16), 0);
      const sumB = bPlayers.reduce((acc, p) => acc + (Number(p.level) || 16), 0);
      mix.teamA.avgLevel = (sumA / aPlayers.length).toFixed(1);
      mix.teamB.avgLevel = (sumB / bPlayers.length).toFixed(1);
      const diff = Math.abs(sumA - sumB);
      mix.balancePct = Math.max(75, Math.min(100, Math.round(100 - diff * 3.5)));
    }
  }

  balanceTeams(mix) {
    if (!mix.players || mix.players.length < 2) return;

    mix.players.forEach((p) => {
      if (this.hasSavedLevel(p.id)) {
        p.level = this.getPlayerLevel(p.id);
      } else {
        p.level = p.level || 16;
      }
      p.effectiveScore = this.getEffectivePlayerScore(p);
    });

    const players = [...mix.players];
    const n = players.length;
    const half = Math.floor(n / 2);

    const combinations = [];
    const backtrack = (start, combo) => {
      if (combo.length === half) {
        combinations.push([...combo]);
        return;
      }
      for (let i = start; i < n; i++) {
        combo.push(players[i]);
        backtrack(i + 1, combo);
        combo.pop();
      }
    };
    backtrack(0, []);

    let bestA = [];
    let bestB = [];
    let minPenalty = Infinity;

    for (const comboA of combinations) {
      const idsA = new Set(comboA.map((p) => p.id));
      const comboB = players.filter((p) => !idsA.has(p.id));

      const sumEffA = comboA.reduce((acc, p) => acc + (p.effectiveScore || p.level || 16), 0);
      const sumEffB = comboB.reduce((acc, p) => acc + (p.effectiveScore || p.level || 16), 0);
      const maxA = Math.max(...comboA.map((p) => p.effectiveScore || p.level || 16), 0);
      const maxB = Math.max(...comboB.map((p) => p.effectiveScore || p.level || 16), 0);

      const starDiffPenalty = Math.abs(maxA - maxB) * 0.2;
      const totalPenalty = Math.abs(sumEffA - sumEffB) + starDiffPenalty;

      if (totalPenalty < minPenalty) {
        minPenalty = totalPenalty;
        bestA = [...comboA];
        bestB = [...comboB];
      }
    }

    bestA.sort((a, b) => (b.level || 16) - (a.level || 16));
    bestB.sort((a, b) => (b.level || 16) - (a.level || 16));

    const sumA = bestA.reduce((acc, p) => acc + (p.level || 16), 0);
    const sumB = bestB.reduce((acc, p) => acc + (p.level || 16), 0);
    const avgA = (sumA / (bestA.length || 1)).toFixed(1);
    const avgB = (sumB / (bestB.length || 1)).toFixed(1);
    const diff = Math.abs(sumA - sumB);
    const balancePct = Math.max(75, Math.min(100, Math.round(100 - diff * 3.5)));

    mix.teamA.players = bestA;
    mix.teamA.captain = bestA[0] || null;
    mix.teamA.avgLevel = avgA;
    mix.teamA.startingSide = mix.teamA.side || 'CT';
    mix.teamA.halftimeSwapped = false;
    mix.teamB.players = bestB;
    mix.teamB.captain = bestB[0] || null;
    mix.teamB.avgLevel = avgB;
    mix.teamB.startingSide = mix.teamB.side || 'TR';
    mix.teamB.halftimeSwapped = false;
    mix.balancePct = balancePct;
    mix.phase = 'teams';

    this.syncToWebRoom(mix);
  }

  startCaptainDraft1v1(mix) {
    if (!mix.players || mix.players.length < 4) return false;
    mix.players.forEach((p) => {
      if (this.hasSavedLevel(p.id)) p.level = this.getPlayerLevel(p.id);
      else p.level = p.level || 16;
    });
    const sorted = [...mix.players].sort((a, b) => (b.level || 16) - (a.level || 16));
    const capA = sorted[0];
    const capB = sorted[1];
    const pool = sorted.slice(2);

    mix.phase = 'captain_draft';
    mix.teamA.captain = capA;
    mix.teamA.players = [capA];
    mix.teamB.captain = capB;
    mix.teamB.players = [capB];
    mix.captainDraft = {
      pool,
      turnOrder: ['teamA', 'teamB', 'teamB', 'teamA', 'teamA', 'teamB', 'teamB', 'teamA'],
      step: 0,
    };
    this.syncToWebRoom(mix);
    return true;
  }

  buildCaptainDraftEmbedAndComponents(mix) {
    const draft = mix.captainDraft || { pool: [], turnOrder: ['teamA'], step: 0 };
    const currentTeamKey = draft.turnOrder[draft.step] || (mix.teamA.players.length <= mix.teamB.players.length ? 'teamA' : 'teamB');
    const currentCap = currentTeamKey === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
    const capMention = isSnowflake(currentCap?.id) ? `<@${currentCap.id}>` : `**${currentCap?.displayName || currentCap?.username || 'Capitao'}**`;

    const fmtPlayer = (p) => {
      const lvl = p.level || 16;
      return isSnowflake(p.id) ? `<@${p.id}> (Lvl ${lvl})` : `**${p.displayName || p.username}** (Lvl ${lvl})`;
    };

    const embed = new EmbedBuilder()
      .setTitle(`\ud83d\udc51 DRAFT DE CAPIT\u00c3ES 1v1 \u2022 ${mix.name.toUpperCase()}`)
      .setColor(currentTeamKey === 'teamA' ? 0x38bdf8 : 0xf59e0b)
      .setDescription(
        `\u26a1 **Vez de escolher:** ${currentTeamKey === 'teamA' ? '\ud83d\udee1\ufe0f **Time A**' : '\ud83d\udca3 **Time B**'} \u2014 Capit\u00e3o ${capMention}\n` +
        `Selecione no menu abaixo o pr\u00f3ximo jogador para o seu time!`
      )
      .addFields(
        {
          name: `\ud83d\udee1\ufe0f ${mix.teamA.name} (${mix.teamA.players.length}/5)`,
          value: mix.teamA.players.map((p, i) => `${i === 0 ? '\ud83d\udc51' : '\u2022'} ${fmtPlayer(p)}`).join('\n') || '*Vazio*',
          inline: true,
        },
        {
          name: `\ud83d\udca3 ${mix.teamB.name} (${mix.teamB.players.length}/5)`,
          value: mix.teamB.players.map((p, i) => `${i === 0 ? '\ud83d\udc51' : '\u2022'} ${fmtPlayer(p)}`).join('\n') || '*Vazio*',
          inline: true,
        },
        {
          name: `\ud83d\udccb Jogadores Dispon\u00edveis no Pool (${draft.pool.length})`,
          value: draft.pool.map((p) => `\u2022 ${fmtPlayer(p)}`).join('\n') || '*Nenhum*',
          inline: false,
        }
      )
      .setFooter({ text: 'Ordem Oficial Snake Draft: A -> B -> B -> A -> A -> B -> B' })
      .setTimestamp();

    const options = draft.pool.slice(0, 25).map((p) => ({
      label: `${(p.displayName || p.username || 'Jogador').slice(0, 45)} (Lvl ${p.level || 16} GC)`,
      value: String(p.id),
      description: `Escolher para o ${currentTeamKey === 'teamA' ? mix.teamA.name : mix.teamB.name}`,
      emoji: '\ud83c\udfaf',
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`captain_pick_select:${mix.id}`)
        .setPlaceholder(`Vez de ${currentCap?.displayName || currentCap?.username || 'Capitao'}: escolha um jogador...`)
        .addOptions(options)
    );

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_teams:${mix.id}`)
        .setLabel('Auto-Completar Equilibrado')
        .setEmoji('\u2696\ufe0f')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [selectRow, btnRow] };
  }

  async applyCs2TeamNamesRcon(mix) {
    try {
      const rawServer = mix.serverIp || this.config.serverConnect || '';
      const rconPwd = (mix.rconPassword || this.config.rconPassword || process.env.CS2_RCON_PASSWORD || '').trim();
      const { host, port } = extractHostAndPort(rawServer);
      if (!host || !rconPwd) return false;

      const capA = mix.teamA?.captain?.displayName || mix.teamA?.captain?.username || mix.teamA?.captain?.nick || 'A';
      const capB = mix.teamB?.captain?.displayName || mix.teamB?.captain?.username || mix.teamB?.captain?.nick || 'B';
      const cleanNameA = sanitizeRconTextArg(`TIME ${capA}`, 24).toUpperCase() || 'TIME A';
      const cleanNameB = sanitizeRconTextArg(`TIME ${capB}`, 24).toUpperCase() || 'TIME B';

      const isACt = (mix.teamA?.side || 'CT').toUpperCase() === 'CT';
      const ctName = isACt ? cleanNameA : cleanNameB;
      const trName = isACt ? cleanNameB : cleanNameA;

      await executeRconCommand({
        host,
        port,
        password: rconPwd,
        command: `mp_teamname_1 "${ctName}"; mp_teamname_2 "${trName}"`,
      }).catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  async triggerAutoRconMapChange(mix, mapObj, channel) {
    try {
      const rawServer = mix.serverIp || this.config.serverConnect || '';
      const rconPwd = (mix.rconPassword || this.config.rconPassword || process.env.CS2_RCON_PASSWORD || '').trim();
      const { host, port, hostPort } = extractHostAndPort(rawServer);
      if (!host || !rconPwd || !mapObj?.id) return false;

      const cleanMap = (mapObj.id.startsWith('de_') ? mapObj.id : `de_${mapObj.id}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const safeMapLabel = sanitizeRconTextArg(mapObj.name || cleanMap, 24).toUpperCase();

      await executeRconCommand({
        host,
        port,
        password: rconPwd,
        command: `say ">>> [CS2 MIX HUB] Mapa definido: ${safeMapLabel} (${cleanMap}) | Trocando mapa automaticamente..."`,
      }).catch(() => {});

      await executeRconCommand({
        host,
        port,
        password: rconPwd,
        command: `changelevel ${cleanMap}`,
      });

      // Aplica os nomes dos times no TAB do CS2 apos carregar o mapa (8s)
      const t = setTimeout(() => {
        this.applyCs2TeamNamesRcon(mix).catch(() => {});
      }, 8000);
      t.unref?.();

      if (channel) {
        channel.send(`\ud83d\udfe2 \u26a1 **[RCON AUTOM\u00c1TICO]** Servidor CS2 (\`${hostPort}\`) alterado para **${mapObj.emoji || '\ud83d\uddfa\ufe0f'} ${mapObj.name}** (\`${cleanMap}\`) com placar oficial dos times configurado!`).catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn('[AUTO RCON MAP CHANGE] Aviso:', err.message);
      return false;
    }
  }
  syncToWebRoom(mix) {
    if (!this.webRoomsRef || !mix) return null;
    try {
      const roomId = mix.id;
      const existing = this.webRoomsRef.get(roomId) || {};
      const phaseMap = {
        lobby: 'lobby',
        ready_check: 'lobby',
        captain_draft: 'captains_draft',
        captains_draft: 'captains_draft',
        teams: existing.phase === 'coin_flip' ? 'coin_flip' : 'teams',
        veto: 'veto',
        side_pick: 'side_pick',
        live: 'finished',
        finished: 'finished',
      };
      const nextPhase = phaseMap[mix.phase] || 'lobby';

      const sumA = (mix.teamA?.players || []).reduce((acc, p) => acc + (Number(p.level) || 16), 0);
      const sumB = (mix.teamB?.players || []).reduce((acc, p) => acc + (Number(p.level) || 16), 0);
      const lenA = Math.max(1, (mix.teamA?.players || []).length);
      const lenB = Math.max(1, (mix.teamB?.players || []).length);
      const avgA = Number(mix.teamA?.avgLevel || (sumA / lenA).toFixed(1));
      const avgB = Number(mix.teamB?.avgLevel || (sumB / lenB).toFixed(1));
      const diff = Number(Math.abs(sumA - sumB).toFixed(1));

      const bannedMaps = (mix.veto?.bannedMaps || []).map((b) => ({
        mapId: b.map?.id,
        mapName: b.map?.name,
        by: b.by,
        bannedBy: b.team || (b.by === mix.teamB?.captain?.id ? 'teamB' : 'teamA'),
      }));

      const vetoLog = bannedMaps.map((b) => ({
        type: 'ban',
        team: b.bannedBy === 'teamB' ? (mix.teamB?.name || 'Time B') : (mix.teamA?.name || 'Time A'),
        mapName: b.mapName || b.mapId || 'Mapa',
        mapId: b.mapId || '',
      }));
      if (mix.veto?.deciderMap) {
        vetoLog.push({
          type: 'decider',
          team: 'DECIDER',
          mapName: mix.veto.deciderMap.name,
          mapId: mix.veto.deciderMap.id,
        });
      }

      const displayConn = this.resolveMixDisplayConnect(mix);

      const room = {
        ...existing,
        id: roomId,
        channelId: mix.channelId || existing.channelId || '',
        name: mix.name,
        createdAt: mix.createdAt || Date.now(),
        lastActivity: Date.now(),
        creatorId: mix.creatorId,
        creatorNick: mix.creatorNick,
        source: 'discord',
        sourceLabel: 'Via Discord',
        phase: nextPhase,
        balanceMode: mix.balanceMode || 'balanced',
        players: (mix.players || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: (mix.teamA?.players || []).some((a) => a.id === p.id) ? (mix.teamA?.side || 'CT') : (mix.teamB?.side || 'TR'),
          ready: true,
        })),
        waitlist: (mix.waitlist || []).map((w) => ({
          id: w.id,
          nick: w.displayName || w.username,
          avatar: w.avatar,
          level: w.level || 16,
        })),
        teamA: (mix.teamA?.players || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamA?.side || 'CT',
          isCaptain: mix.teamA?.captain?.id === p.id,
        })),
        teamB: (mix.teamB?.players || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamB?.side || 'TR',
          isCaptain: mix.teamB?.captain?.id === p.id,
        })),
        captainA: mix.teamA?.captain
          ? {
              id: mix.teamA.captain.id,
              nick: mix.teamA.captain.displayName || mix.teamA.captain.username,
              level: mix.teamA.captain.level || 16,
            }
          : null,
        captainB: mix.teamB?.captain
          ? {
              id: mix.teamB.captain.id,
              nick: mix.teamB.captain.displayName || mix.teamB.captain.username,
              level: mix.teamB.captain.level || 16,
            }
          : null,
        captainTurn: mix.captainDraft?.turnOrder?.[mix.captainDraft.step] === 'teamB' ? 'captainB' : 'captainA',
        unassignedPlayers: (mix.captainDraft?.pool || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.nick || p.username,
          avatar: p.avatar,
          level: p.level || 16,
        })),
        teamAName: mix.teamA?.name || 'Time A',
        teamBName: mix.teamB?.name || 'Time B',
        metrics: {
          sumA,
          sumB,
          avgA,
          avgB,
          diff,
          balancePercentage: mix.balancePct || 95,
          rankingSystem: 'gc',
        },
        maps: OFFICIAL_MAPS.map((m) => ({ id: m.id, name: m.name, file: m.id, image: m.image })),
        bannedMaps,
        vetoLog,
        currentTurn: mix.veto?.currentTurn || 'teamA',
        startingSideTeamB: (mix.teamB?.startingSide || mix.teamB?.side || 'TR').toUpperCase(),
        finalMap: mix.veto?.deciderMap
          ? {
              id: mix.veto.deciderMap.id,
              name: mix.veto.deciderMap.name,
              file: mix.veto.deciderMap.id,
              image: mix.veto.deciderMap.image,
            }
          : (mix.finalMap || null),
        serverIp: displayConn?.normalized || '',
        matchFormat: mix.format || 'MD1',
      };
      this.webRoomsRef.set(roomId, room);
      scheduleSave(100);
      if (typeof this.onRoomUpdated === 'function') {
        try {
          this.onRoomUpdated(roomId, room);
        } catch (callErr) {
          console.warn('[DISCORD BOT] Erro ao chamar onRoomUpdated:', callErr.message);
        }
      }
      return room;
    } catch (e) {
      console.warn('[DISCORD BOT] Erro ao sincronizar sala web:', e.message);
      return null;
    }
  }

  startReadyCheck(mix, channel) {
    if (mix.readyCheck?.timer) {
      clearTimeout(mix.readyCheck.timer);
    }
    const expiresAt = Date.now() + 60000;
    mix.phase = 'ready_check';
    mix.readyCheck = {
      active: true,
      confirmed: new Set(),
      expiresAt,
      timer: null,
    };

    const unixExpire = Math.floor(expiresAt / 1000);
    const mentions = mix.players.map((p) => `<@${p.id}>`).join(' ');
    channel.send({
      content: `\ud83d\udea8 **LOBBY CHEIO (10/10)!** ${mentions}\n\u23f1\ufe0f Voc\u00eas t\u00eam **60 segundos** (expira <t:${unixExpire}:R>) para clicar em **Confirmar Presen\u00e7a** abaixo! Quem ficar AFK dar\u00e1 vaga para a Fila de Reserva.`,
    }).catch(() => {});

    mix.readyCheck.timer = setTimeout(async () => {
      try {
        if (!mix || mix.phase !== 'ready_check' || !mix.readyCheck?.active) return;
        mix.readyCheck.active = false;
        mix.readyCheck.timer = null;

        const confirmedIds = mix.readyCheck.confirmed || new Set();
        const afkPlayers = mix.players.filter((p) => !confirmedIds.has(p.id) && !String(p.id).startsWith('wa_'));

        if (afkPlayers.length === 0) {
          if (mix.balanceMode === 'captains' && mix.players.length >= 4) {
            this.startCaptainDraft1v1(mix);
            this.updateLobbyInChannels(mix);
            const { embed, components } = this.buildCaptainDraftEmbedAndComponents(mix);
            await channel.send({
              content: '\u26a1 **Check-in encerrado!** Draft 1v1 de Capit\u00e3es iniciado:',
              embeds: [embed],
              components,
            }).catch(() => {});
            return;
          }
          this.balanceTeams(mix);
          this.updateLobbyInChannels(mix);
          const embed = this.buildTeamsEmbed(mix);
          await channel.send({
            content: '\u26a1 **Check-in encerrado!** Times sorteados:',
            embeds: [embed],
            components: [this.buildTeamsActionButtons(mix)],
          }).catch(() => {});
          return;
        }

        mix.players = mix.players.filter((p) => confirmedIds.has(p.id) || String(p.id).startsWith('wa_'));
        mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
        const promoted = [];
        while (mix.players.length < 10 && mix.waitlist.length > 0) {
          const nextSub = mix.waitlist.shift();
          mix.players.push(nextSub);
          promoted.push(nextSub);
        }

        const afkMentions = afkPlayers.map((p) => `<@${p.id}>`).join(', ');
        const promoText = promoted.length > 0
          ? `\n\ud83d\udd04 **Suplente(s) promovido(s) da Reserva:** ${promoted.map((p) => `<@${p.id}>`).join(', ')}!`
          : '';

        if (mix.players.length === 10) {
          this.startReadyCheck(mix, channel);
          this.syncToWebRoom(mix);
          this.updateLobbyInChannels(mix);
          await channel.send({
            content: `\u23f0 **TEMPO DE CHECK-IN ESGOTADO!**\n\ud83d\udeab Removido(s) por inatividade (AFK): ${afkMentions}${promoText}\n\ud83d\udd04 Lobby completado novamente (**10/10**)! Novo check-in iniciado:`,
            embeds: [this.buildReadyCheckEmbed(mix)],
            components: this.buildReadyCheckButtons(mix),
          }).catch(() => {});
          return;
        }

        mix.phase = 'lobby';
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);

        const embed = this.buildLobbyEmbed(mix);
        const components = this.buildLobbyButtons(mix);
        await channel.send({
          content: `\u23f0 **TEMPO DE CHECK-IN ESGOTADO!**\n\ud83d\udeab Removido(s) por inatividade (AFK): ${afkMentions}${promoText}\n\ud83d\udd13 O lobby voltou para **${mix.players.length}/10** jogadores!`,
          embeds: [embed],
          components,
        }).catch(() => {});
      } catch (e) {
        console.warn('[READY CHECK TIMEOUT]', e.message);
      }
    }, 60000);
    mix.readyCheck.timer.unref?.();
  }

  buildReadyCheckEmbed(mix) {
    const confirmedCount = mix.readyCheck?.confirmed?.size || 0;
    const unixExpire = Math.floor((mix.readyCheck?.expiresAt || Date.now() + 60000) / 1000);

    const statusList = mix.players.map((p) => {
      const isConfirmed = mix.readyCheck?.confirmed?.has(p.id) || String(p.id).startsWith('wa_');
      return `${isConfirmed ? '\ud83d\udfe2' : '\u23f3'} <@${p.id}> - ${isConfirmed ? '**CONFIRMADO**' : '*Aguardando clique...*'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`\ud83d\udea8 CHECK-IN ANTI-AFK (60s) \u2022 ${mix.name.toUpperCase()}`)
      .setDescription(
        `O lobby atingiu 10 jogadores! Confirmem presen\u00e7a antes que o tempo acabe.\n\n` +
        `\ud83d\udcca **Confirmados:** \`${confirmedCount}/10\` \u2022 \u23f1\ufe0f **Expira:** <t:${unixExpire}:R>`
      )
      .setColor(confirmedCount === 10 ? 0x10b981 : 0xeab308)
      .addFields(
        {
          name: '\ud83d\udc65 Titulares (1 a 5)',
          value: statusList.slice(0, 5).join('\n') || '*Nenhum*',
          inline: true,
        },
        {
          name: '\ud83d\udc65 Titulares (6 a 10)',
          value: statusList.slice(5, 10).join('\n') || '*Nenhum*',
          inline: true,
        }
      )
      .setFooter({ text: 'CS2 Mix Hub \u2022 Quem n\u00e3o confirmar em 60s cede a vaga para a Reserva' })
      .setTimestamp();

    return embed;
  }

  buildReadyCheckButtons(mix) {
    const confirmedCount = mix.readyCheck?.confirmed?.size || 0;
    const isCaptainsMode = mix.balanceMode === 'captains';
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ready_confirm:${mix.id}`)
          .setLabel(`Confirmar Presen\u00e7a (${confirmedCount}/10)`)
          .setEmoji('\u2705')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`mix_teams:${mix.id}`)
          .setLabel('Sortear Equilibrado')
          .setEmoji('\u2694\ufe0f')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`mix_captain_draft:${mix.id}`)
          .setLabel('Draft 1v1 Capit\u00e3es')
          .setEmoji('\ud83d\udc51')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`mix_toggle_mode:${mix.id}`)
          .setLabel(isCaptainsMode ? 'Modo: Capit\u00e3es' : 'Modo: Equilibrado')
          .setEmoji('\ud83c\udfb2')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`mix_leave:${mix.id}`)
          .setLabel('Desistir / Sair')
          .setEmoji('\ud83d\udeaa')
          .setStyle(ButtonStyle.Danger)
      ),
    ];
  }
  async startAutomaticLiveMonitoring(mix, channel, guild) {
    if (!channel || !mix) return;
    try {
      const currentIp = (mix.serverIp || this.config.serverConnect || '').trim();
      if (!currentIp) {
        const ipEmbed = new EmbedBuilder()
          .setColor(0xeab308)
          .setTitle('\u26a0\ufe0f IP do Servidor CS2 N\u00e3o Definido')
          .setDescription(
            'Para liberar a conex\u00e3o 1-Clique (Steam Direct) e o controle RCON, informe o IP abaixo ou digite `!servidor <ip:porta>`.'
          );

        const ipRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mix_set_ip:${mix.id}`)
            .setLabel('Definir IP do Servidor')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('\u2699\ufe0f')
        );

        await channel.send({ embeds: [ipEmbed], components: [ipRow] }).catch(() => {});
      }
    } catch (err) {
      console.warn('[BOT] Aviso ao verificar IP da partida:', err.message);
    }
  }
  buildMixTutorialEmbed() {
    return new EmbedBuilder()
      .setTitle('📖 GUIA RÁPIDO DO CS2 MIX HUB • COMO MEXER NO BOT')
      .setDescription(
        `Seja bem-vindo ao sistema oficial de Mix 5v5 da comunidade!\n` +
          `Aqui está o passo a passo de como funciona a fila e os comandos:\n\n` +
          `**1️⃣ Como Entrar e Sair da Fila (Titular ou Reserva):**\n` +
          `• Clique no botão **\`[➕ Entrar]\`** ou digite \`!entrar\` no chat. Se fechar 10/10, abre **Fila de Reserva (até 3/3)**!\n` +
          `• Se precisar desmarcar, clique em **\`[➖ Sair]\`** ou digite \`!sair\` (o primeiro suplente sobe na hora).\n\n` +
          `**2️⃣ Cadastre seu Nível da Gamers Club (GC):**\n` +
          `• Clique no botão **\`[⭐ Meu Nível GC]\`** ou digite \`!lvl <1 a 21>\` (ex: \`!lvl 16\`).\n` +
          `• O bot salva seu nível para sempre e usa no sorteio equilibrado.\n\n` +
          `**3️⃣ Check-in Anti-AFK (60 segundos):**\n` +
          `• Ao atingir **10/10 jogadores**, abre um Check-in de **60s**. Quem não confirmar dá lugar automaticamente à Fila de Reserva (ou os capitães podem sortear na hora).\n\n` +
          `**4️⃣ Sorteio Equilibrado ou Draft 1v1 de Capitães:**\n` +
          `• Alterne no lobby com **\`[🎲 Modo]\`**, ou clique em **\`[⚔️ Sortear Times]\`** / **\`[👑 Draft 1v1]\`** (\`!sortear\`).\n` +
          `• No modo Equilibrado, os dois maiores níveis viram Capitães 👑 e o Snake-Draft equilibra os times automaticamente.\n\n` +
          `**5️⃣ Veto de Mapas (Pick & Ban), Roleta ou Escolha Manual:**\n` +
          `• Use **\`[🗳️ Pick & Ban]\`** (\`!veto\`), **\`[🎲 Roleta]\`** ou **\`[🗺️ Escolher Mapa]\`**.\n` +
          `• No mapa final do veto, o Capitão B escolhe começar de **CT** 🛡️ ou **TR** 💣!\n\n` +
          `**6️⃣ Conectar no Servidor & Mover Calls:**\n` +
          `• Clique em **\`[🚀 Conectar Direto no CS2]\`** ou copie o comando \`connect\` exibido no card.\n` +
          `• Clique em **\`[📞 Mover Calls]\`** para o bot puxar cada time para sua sala de voz oficial.\n\n` +
          `**7️⃣ Placar, MVP & Votação do Bagre do Mix:**\n` +
          `• Ao final do jogo, clique em **\`[🏆 Declarar Placar]\`** ou digite \`!vitoria A 13-9\`.\n` +
          `• Com Valve GSI ativo, MVP e Bagre são calculados por stats reais; sem GSI, use **\`[🐟 Votar Bagre do Mix]\`** ou \`!bagre\`!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ **Comandos Oficiais no Chat:**\n` +
          `• \`!mix\` — Abre um novo lobby 5v5 | \`!fila\` — Mostra o card do mix atual\n` +
          `• \`!vitoria [A|B] [placar]\` — Registra vitória no ranking e histórico\n` +
          `• \`!aovivo\` [parar] — Radar da partida em tempo real (Valve GSI)\n` +
          `• \`!servidor <ip:porta [senha]>\` — Define servidor CS2 (aceita \`password\`)\n` +
          `• \`!sub @antigo @novo\` — Substituição | \`!bagre\` — Votação do Bagre\n` +
          `• \`!historico\` | \`!ranking\` | \`!x1 @amigo\` | \`!mapas\` | \`!status-server\`\n` +
          `• \`!smoke <mapa>\` (10 mapas) | \`!treino\` | \`!moeda\` | \`!cargo\``
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png')
      .setFooter({ text: 'Dica: Todos os botões do Mix estão disponíveis logo abaixo deste card! 👇' });
  }

  buildLobbyEmbed(mix) {
    const total = (mix.players || []).length;
    const waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
    const isFull = total >= 10;
    const color = isFull ? 0x10b981 : 0xf59e0b;

    const playerList = [];
    for (let i = 0; i < 10; i++) {
      const p = mix.players[i];
      if (p) {
        const lvl = p.level || this.getPlayerLevel(p.id) || 16;
        const gcEmoji = lvl >= 20 ? '\ud83d\udc51' : lvl >= 18 ? '\ud83c\udfc6' : lvl >= 14 ? '\ud83e\udd47' : '\ud83e\udd48';
        const isWa = p.source === 'whatsapp' || String(p.id).startsWith('wa_') || Boolean(p.phone);
        const capTag = (i === 0 || p.isCaptain) ? '\ud83d\udc51 ' : '';
        const name = p.displayName || p.nick || p.name || p.username || 'Jogador';
        if (isWa) {
          playerList.push(`**${i + 1}.** ${capTag}\ud83d\udcac **${name}** \`[WhatsApp \u2022 Lvl ${lvl} GC ${gcEmoji}]\``);
        } else {
          playerList.push(`**${i + 1}.** ${capTag}\ud83c\udfae <@${p.id}> \`[Discord \u2022 Lvl ${lvl} GC ${gcEmoji}]\``);
        }
      } else {
        playerList.push(`**${i + 1}.** \u23f3 *[Vazio - Dispon\u00edvel]*`);
      }
    }

    const creatorDisplay = mix.creatorNick || (String(mix.creatorId).startsWith('wa_') ? '\ud83d\udcac WhatsApp' : `<@${mix.creatorId}>`);

    const fields = [
      {
        name: `\ud83d\udc65 Jogadores Conectados (${total}/10)`,
        value: playerList.slice(0, 5).join('\n'),
        inline: true,
      },
      {
        name: '\u200B',
        value: playerList.slice(5, 10).join('\n'),
        inline: true,
      },
    ];

    if (waitlist.length > 0) {
      fields.push({
        name: `\ud83d\udccb Fila de Reserva / Suplentes (${waitlist.length}/3)`,
        value: waitlist.map((w, idx) => `**R${idx + 1}.** <@${w.id}> \`[Lvl ${w.level || 16} GC]\``).join(' \u2022 '),
        inline: false,
      });
    }

    const conn = this.resolveMixDisplayConnect(mix);
    const modeLabel = mix.balanceMode === 'captains' ? '👑 Draft de Capitães 1v1' : '⚖️ Snake-Draft Equilibrado';

    fields.push({
      name: '\u2699\ufe0f Configura\u00e7\u00f5es da Partida',
      value:
        `\ud83c\udfc6 **Formato:** ${mix.format || 'MD1'} \u2022 **Modo:** ${modeLabel}\n` +
        `\ud83d\udee1\ufe0f **Status:** ${isFull ? '\ud83d\udfe2 **LOBBY LOTADO (10/10)! Vagas abertas na Reserva**' : `\ud83d\udfe1 Aguardando jogadores (${10 - total} restante(s))`}\n` +
        `\ud83d\udcbb **Servidor:** ${conn ? `\`${conn.consoleCommand}\`` : '*A definir ou host local*'}\n` +
        `\ud83d\udc51 **Criador:** ${creatorDisplay}`,
      inline: false,
    });

    const embed = new EmbedBuilder()
      .setTitle(`\ud83c\udfae CS2 MIX HUB \u2022 ${(mix.name || 'Mix CS2').toUpperCase()}`)
      .setDescription(
        `Fila oficial de Mix 5v5 para Counter-Strike 2.\n` +
        `\ud83c\udf10 **Sincroniza\u00e7\u00e3o Ativa:** Jogadores do **Discord** e **Web Hub** jogam no mesmo lobby!\n` +
        `Clique nos bot\u00f5es abaixo para entrar como titular, entrar na reserva ou sortear!`
      )
      .setColor(color)
      .addFields(fields)
      .setFooter({
        text: `ID do Mix: ${mix.id} \u2022 Sincronizado Discord + Web`,
      })
      .setTimestamp();

    return embed;
  }

  buildLobbyButtons(mix) {
    const total = (mix.players || []).length;
    const waitlistCount = Array.isArray(mix.waitlist) ? mix.waitlist.length : 0;
    const isFull = total >= 10;
    const isWaitlistFull = waitlistCount >= 3;
    const isCaptainsMode = mix.balanceMode === 'captains';

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_join:${mix.id}`)
        .setLabel(isFull ? `Reserva (${waitlistCount}/3)` : `Entrar (${total}/10)`)
        .setEmoji(isFull ? '\ud83d\udccb' : '\u2795')
        .setStyle(isFull ? ButtonStyle.Primary : ButtonStyle.Success)
        .setDisabled(isFull && isWaitlistFull),
      new ButtonBuilder()
        .setCustomId(`mix_leave:${mix.id}`)
        .setLabel('Sair')
        .setEmoji('\u2796')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(total === 0 && waitlistCount === 0),
      new ButtonBuilder()
        .setCustomId(`mix_teams:${mix.id}`)
        .setLabel('Sortear Times')
        .setEmoji('\u2694\ufe0f')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(total < 2),
      new ButtonBuilder()
        .setCustomId(`mix_captain_draft:${mix.id}`)
        .setLabel('Draft 1v1')
        .setEmoji('\ud83d\udc51')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(total < 4),
      new ButtonBuilder()
        .setCustomId(`mix_veto:${mix.id}`)
        .setLabel('Pick & Ban')
        .setEmoji('\ud83d\uddf3\ufe0f')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_set_level:${mix.id}`)
        .setLabel('Meu N\u00edvel GC')
        .setEmoji('\u2b50')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_pick_map:${mix.id}`)
        .setLabel('Escolher Mapa')
        .setEmoji('\ud83d\uddfa\ufe0f')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_roulette:${mix.id}`)
        .setLabel('Roleta de Mapa')
        .setEmoji('\ud83c\udfb2')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_voice:${mix.id}`)
        .setLabel('Mover Calls')
        .setEmoji('\ud83d\udcde')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_cancel:${mix.id}`)
        .setLabel('Cancelar')
        .setEmoji('\u274c')
        .setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_toggle_mode:${mix.id}`)
        .setLabel(isCaptainsMode ? 'Modo: Capit\u00e3es 1v1' : 'Modo: Equilibrado')
        .setEmoji('\ud83c\udfb2')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_sub:${mix.id}`)
        .setLabel('Substituir')
        .setEmoji('\ud83d\udd04')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(total === 0)
    );

    return [row1, row2, row3];
  }
  buildTeamsEmbed(mix) {
    const teamA = mix.teamA;
    const teamB = mix.teamB;
    const pct = mix.balancePct || 95;

    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const captainA = teamA.captain || teamA.players?.[0];
    const captainB = teamB.captain || teamB.players?.[0];

    const formatPlayer = (p, isCap) => {
      const capTag = isCap ? '👑 **Capitão:** ' : '• ';
      const lvl = p.level || 16;
      const isWa = p.source === 'whatsapp' || String(p.id).startsWith('wa_') || Boolean(p.phone);
      const name = p.displayName || p.nick || p.name || p.username || 'Jogador';
      if (isWa) {
        return `${capTag}💬 **${name}** \`[WhatsApp • Lvl ${lvl} GC]\``;
      }
      return `${capTag}🎮 <@${p.id}> \`[Discord • Lvl ${lvl} GC]\``;
    };

    const aPlayers = (teamA.players || [])
      .map((p) => formatPlayer(p, p.id === captainA?.id))
      .join('\n') || '*Nenhum jogador*';

    const bPlayers = (teamB.players || [])
      .map((p) => formatPlayer(p, p.id === captainB?.id))
      .join('\n') || '*Nenhum jogador*';

    const capAName = captainA ? (String(captainA.id).startsWith('wa_') ? `💬 ${captainA.nick || captainA.name}` : `<@${captainA.id}>`) : 'A definir';
    const capBName = captainB ? (String(captainB.id).startsWith('wa_') ? `💬 ${captainB.nick || captainB.name}` : `<@${captainB.id}>`) : 'A definir';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ TIMES FORMADOS • ${mix.name.toUpperCase()}`)
      .setDescription(
        `Os dois esquadrões foram balanceados pelo algoritmo Snake-Draft Gamers Club!\n\n` +
        `👑 **Capitão Time A:** ${capAName} \`[Lvl ${captainA?.level || 16} GC]\`\n` +
        `👑 **Capitão Time B:** ${capBName} \`[Lvl ${captainB?.level || 16} GC]\`\n\n` +
        `⚖️ **Equilíbrio:** \`[${bar}] ${pct}%\` (Média A: **${teamA.avgLevel || 16}** | Média B: **${teamB.avgLevel || 16}**)`
      )
      .setColor(0xf59e0b)
      .addFields(
        {
          name: `🛡️ ${teamA.name} (${teamA.side || 'CT'})`,
          value: aPlayers,
          inline: true,
        },
        {
          name: `🔥 ${teamB.name} (${teamB.side || 'TR'})`,
          value: bPlayers,
          inline: true,
        },
        {
          name: '🎯 Próxima Etapa',
          value: 'Capitães definidos! Escolham entre **Iniciar Pick & Ban**, **Draft 1v1**, **Roleta Rápida** ou **Escolher Mapa**.',
          inline: false,
        }
      )
      .setFooter({ text: 'Sincronizado em tempo real entre Discord, WhatsApp e Web Hub' })
      .setTimestamp();

    return embed;
  }

  buildVetoEmbed(mix) {
    const veto = mix.veto;
    const isFinished = Boolean(veto.deciderMap);
    const turnCaptain = veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
    const turnTeamName = veto.currentTurn === 'teamA' ? mix.teamA.name : mix.teamB.name;

    const remainingList = veto.remainingMaps
      .map((m) => `${m.emoji} **${m.name}** (\`${m.id}\`)`)
      .join('\n') || '*Nenhum*';

    const bannedList = veto.bannedMaps
      .map((b) => `❌ ~~${b.map.name}~~ (Banido por ${isSnowflake(b.by) ? `<@${b.by}>` : '💬 **WhatsApp**'})`)
      .join('\n') || '*Nenhum mapa banido ainda*';

    const embed = new EmbedBuilder()
      .setTitle(`🗳️ PICK & BAN DE MAPAS • ${mix.name.toUpperCase()}`)
      .setColor(isFinished ? 0x10b981 : 0x38bdf8);

    if (isFinished) {
      const conn = this.resolveMixDisplayConnect(mix);
      embed.setDescription(
        `🏆 **MAPA DEFINIDO COM SUCESSO!**\n\n` +
          `🗺️ **Mapa:** \`${veto.deciderMap.name}\` (${veto.deciderMap.id})\n` +
          `🛡️ **${mix.teamA.name}:** Inicia de **${mix.teamA.side}**\n` +
          `🔥 **${mix.teamB.name}:** Inicia de **${mix.teamB.side}**\n\n` +
          (conn ? `💻 **Conectar no CS2:**\n\`${conn.consoleCommand}\`\n\n` : '') +
          `GL & HF! Bom jogo a todos!`
      );
      if (veto.deciderMap.image) embed.setImage(veto.deciderMap.image);
    } else {
      const turnCapTag = isSnowflake(turnCaptain?.id)
        ? `<@${turnCaptain?.id}>`
        : (turnCaptain ? `💬 **${turnCaptain.displayName || turnCaptain.nick || turnCaptain.name || turnCaptain.username || 'Capitão'}**` : (isSnowflake(mix.creatorId) ? `<@${mix.creatorId}>` : '💬 **Capitão**'));

      embed.setDescription(
        `Formato: **${mix.format}** • Rotação Oficial Valve\n\n` +
          `👉 **Vez de Banir:** ${turnCapTag} (${turnTeamName})`
      );
    }

    embed.addFields(
      {
        name: `🗺️ Mapas no Pool (${veto.remainingMaps.length})`,
        value: remainingList,
        inline: true,
      },
      {
        name: `🚫 Mapas Banidos (${veto.bannedMaps.length})`,
        value: bannedList,
        inline: true,
      }
    );

    return embed;
  }

  buildVetoButtons(mix) {
    const veto = mix.veto;
    if (veto.deciderMap || veto.remainingMaps.length <= 1) {
      return [];
    }

    const rows = [];
    let currentRow = new ActionRowBuilder();

    veto.remainingMaps.forEach((map, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`veto_ban:${mix.id}:${map.id}`)
          .setLabel(`Banir ${map.name}`)
          .setEmoji(map.emoji || '❌')
          .setStyle(ButtonStyle.Danger)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  buildSidePickPayload(mix) {
    const decider = mix.veto?.deciderMap || mix.finalMap || OFFICIAL_MAPS[0];
    const captainB = mix.teamB?.captain || mix.players?.[1] || mix.players?.[0];
    const capBTag = isSnowflake(captainB?.id)
      ? `<@${captainB.id}>`
      : `**${captainB?.displayName || captainB?.nick || captainB?.name || captainB?.username || 'Capitão B'}**`;

    const embed = new EmbedBuilder()
      .setTitle(`🪙 ESCOLHA DE LADO (CT / TR) • ${(mix.name || 'Mix CS2').toUpperCase()}`)
      .setColor(0xf59e0b)
      .setDescription(
        `🗺️ **Mapa Definido (Decider):** ${decider?.emoji || '🎯'} **${(decider?.name || 'Mirage').toUpperCase()}** (\`${decider?.id || 'de_mirage'}\`)\n\n` +
        `👑 **Vez do ${mix.teamB?.name || 'Time B'} escolher o lado inicial!**\n` +
        `👉 Capitão ${capBTag}, clique abaixo para começar de **CT (Contra-Terrorista)** ou **TR (Terrorista)**:`
      )
      .setFooter({ text: 'O lado oposto será atribuído automaticamente ao Time A' })
      .setTimestamp();

    if (decider?.image) {
      embed.setImage(decider.image);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`side_pick:${mix.id}:CT`)
        .setLabel('Começar de CT (Contra-Terrorista)')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`side_pick:${mix.id}:TR`)
        .setLabel('Começar de TR (Terrorista)')
        .setEmoji('💣')
        .setStyle(ButtonStyle.Danger)
    );

    return {
      content: `🪙 **Pick & Ban finalizado!** ${capBTag}, escolha o lado do **${mix.teamB?.name || 'Time B'}** no mapa **${decider?.name || 'Mirage'}**!`,
      embeds: [embed],
      components: [row],
    };
  }

  buildStatusPayloadForMix(mix) {
    if (!mix) return null;
    const phase = mix.phase || 'lobby';

    if (phase === 'ready_check') {
      return {
        embeds: [this.buildReadyCheckEmbed(mix)],
        components: this.buildReadyCheckButtons(mix),
      };
    }

    if (phase === 'captain_draft' || phase === 'captains_draft') {
      if (mix.captainDraft?.pool?.length) {
        const { embed, components } = this.buildCaptainDraftEmbedAndComponents(mix);
        return { embeds: [embed], components };
      }
    }

    if (phase === 'teams') {
      return {
        embeds: [this.buildTeamsEmbed(mix)],
        components: [this.buildTeamsActionButtons(mix)],
      };
    }

    if (phase === 'veto') {
      return {
        embeds: [this.buildVetoEmbed(mix)],
        components: this.buildVetoButtons(mix),
      };
    }

    if (phase === 'side_pick') {
      return this.buildSidePickPayload(mix);
    }

    if (phase === 'live') {
      return {
        embeds: [this.buildMatchReadyEmbed(mix)],
        components: this.buildMatchReadyButtons(mix),
      };
    }

    return {
      embeds: [this.buildLobbyEmbed(mix)],
      components: this.buildLobbyButtons(mix),
    };
  }

  buildMatchReadyEmbed(mix) {
    const veto = mix.veto || {};
    const map = veto.deciderMap || { name: 'Mirage', id: 'de_mirage', emoji: '🏜️', image: OFFICIAL_MAPS[0].image };
    const conn = this.resolveMixDisplayConnect(mix);
    const connectCmd = conn ? conn.consoleCommand : null;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 PARTIDA CONFIRMADA • ${mix.name.toUpperCase()}`)
      .setDescription(
        `A fase de Pick & Ban e escolha de lados foi concluída com sucesso!\n\n` +
        `🗺️ **MAPA OFICIAL:** ${map.emoji || '🎯'} **${map.name.toUpperCase()}** (\`${map.id}\`)\n` +
        `🛡️ **${mix.teamA.name}:** Inicia de **${mix.teamA.side || 'CT'}**\n` +
        `🔥 **${mix.teamB.name}:** Inicia de **${mix.teamB.side || 'TR'}**\n\n` +
        (connectCmd
          ? `💻 **Comando de Conexão no Console do CS2:**\n\`\`\`bash\n${connectCmd}\n\`\`\`\n*Abra o console com aspas (\`) ou (') e cole o comando acima!*`
          : `⚠️ *IP do servidor não configurado. Use \`!servidor ip:porta\` para definir.*`)
      )
      .setColor(0x10b981)
      .addFields(
        {
          name: `🛡️ ${mix.teamA.name} (${mix.teamA.side || 'CT'})`,
          value: mix.teamA.players.map((p) => `${p.id === mix.teamA.captain?.id ? '👑 **Capitão:** ' : '• '}${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.displayName || p.nick || p.name || p.username}** 💬`} \`[Lvl ${p.level || 16} GC]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        },
        {
          name: `🔥 ${mix.teamB.name} (${mix.teamB.side || 'TR'})`,
          value: mix.teamB.players.map((p) => `${p.id === mix.teamB.captain?.id ? '👑 **Capitão:** ' : '• '}${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.displayName || p.nick || p.name || p.username}** 💬`} \`[Lvl ${p.level || 16} GC]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        }
      )
      .setFooter({ text: `ID: ${mix.id} • CS2 Mix Hub • Que vença o melhor time!` })
      .setTimestamp();

    if (map.image) embed.setImage(map.image);

    return embed;
  }

  buildMatchReadyButtons(mix) {
    const rows = [];
    const row1 = new ActionRowBuilder();
    const narrOn = this.isNarrationActive(mix, mix?.channelId);
    const conn = this.resolveMixDisplayConnect(mix);

    if (conn) {
      row1.addComponents(
        new ButtonBuilder()
          .setLabel('Conectar Direto no CS2')
          .setEmoji('🚀')
          .setStyle(ButtonStyle.Link)
          .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(conn.normalized)}`))
      );
    }

    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`match_result:${mix.id}`)
        .setLabel('Declarar Placar')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mix_toggle_narration:${mix.id}`)
        .setLabel(narrOn ? 'Narração: ON' : 'Narração: OFF')
        .setEmoji(narrOn ? '🎙️' : '🔇')
        .setStyle(narrOn ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_sub:${mix.id}`)
        .setLabel('Substituto')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_voice:${mix.id}`)
        .setLabel('Mover Calls')
        .setEmoji('📞')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(row1);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_live_tracker:${mix.id}`)
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('Acompanhar no Site')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/?room=${mix.id}`)),
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('Novo Mix')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Primary)
    );
    rows.push(row2);

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rcon_pause:${mix.id}`)
        .setLabel('Pausar CS2')
        .setEmoji('⏸️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rcon_unpause:${mix.id}`)
        .setLabel('Despausar')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rcon_live:${mix.id}`)
        .setLabel('Forçar Live/RR')
        .setEmoji('🔥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rcon_say_modal:${mix.id}`)
        .setLabel('Aviso no CS2')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary)
    );
    rows.push(row3);

    return rows;
  }

  // ==========================================
  // BUTTON INTERACTION HANDLERS
  // ==========================================

  async handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const user = interaction.user;

    // Botao de Ligar / Desligar Narracao sob demanda (Padrao: OFF)
    if (customId === 'live_toggle_narration' || customId.startsWith('mix_toggle_narration:')) {
      const tMixId = customId.includes(':') ? customId.split(':')[1] : '';
      const byExplicit = tMixId ? this.activeMixes.get(tMixId) : null;
      const mix =
        (byExplicit && (!byExplicit.channelId || byExplicit.channelId === interaction.channelId) ? byExplicit : null) ||
        this.resolveActiveMixForChannel(interaction.channelId);
      const isNowOn = this.toggleNarration(mix, interaction.channelId);

      if (customId === 'live_toggle_narration') {
        const tracker = this.liveTrackers?.get(interaction.message?.id);
        const isExpanded = tracker ? Boolean(tracker.isExpanded) : false;
        const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
        const components = this.buildLiveMatchButtons(this.isGsiOnline(), isExpanded, roomId, mix, interaction.channelId);
        await interaction.update({ components }).catch(() => {});
      } else if (mix) {
        const components = this.buildMatchReadyButtons(mix);
        await interaction.update({ components }).catch(() => {});
      } else {
        await interaction.deferUpdate().catch(() => {});
      }

      return interaction.followUp({
        content: isNowOn
          ? `🎙️ **Narração do Mix ATIVADA por <@${user.id}>!** O bot vai narrar Aces (5K), Quadra Kills (4K), Clutches e Virada de Half desta partida!`
          : `🔇 **Narração do Mix DESATIVADA por <@${user.id}>!** O bot ficará 100% silencioso durante os rounds.`,
        ephemeral: false,
      }).catch(() => {});
    }

    // RCON In-Game Controls (Pause, Unpause, Restart/Live, Chat Broadcast)
    if (
      customId.startsWith('rcon_pause:') ||
      customId.startsWith('rcon_unpause:') ||
      customId.startsWith('rcon_live:') ||
      customId.startsWith('rcon_say_modal:')
    ) {
      const [rconAct, rMixId] = customId.split(':');
      const byExplicit = rMixId ? this.activeMixes.get(rMixId) : null;
      const mix =
        (byExplicit && (!byExplicit.channelId || byExplicit.channelId === interaction.channelId) ? byExplicit : null) ||
        this.resolveActiveMixForChannel(interaction.channelId);
      const isCapOrAdmin =
        !mix ||
        user.id === mix.creatorId ||
        user.id === mix.teamA?.captain?.id ||
        user.id === mix.teamB?.captain?.id ||
        Boolean(interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator));

      if (!isCapOrAdmin) {
        return interaction.reply({
          content: '🚫 Apenas os **Capitães**, o **Criador do Mix** ou **Admins** podem controlar o servidor CS2!',
          ephemeral: true,
        });
      }

      if (rconAct === 'rcon_say_modal') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_rcon_say:${mix?.id || 'global'}`)
          .setTitle('Enviar Aviso na Tela do CS2');
        const msgInput = new TextInputBuilder()
          .setCustomId('rcon_say_text')
          .setLabel('Mensagem para exibir no chat do servidor CS2')
          .setPlaceholder('Ex: Bora entrar no servidor! Faltam 2 no CT!')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
        return interaction.showModal(modal);
      }

      const rawServer = mix?.serverIp || this.config.serverConnect || '';
      const rconPwd = (mix?.rconPassword || this.config.rconPassword || process.env.CS2_RCON_PASSWORD || '').trim();
      const { host, port } = extractHostAndPort(rawServer);
      if (!host || !rconPwd) {
        return interaction.reply({
          content: '⚠️ IP do servidor ou senha RCON ainda não configurados no painel!',
          ephemeral: true,
        });
      }

      const safeActor = sanitizeRconTextArg(user.username, 24) || 'Admin';
      try {
        if (rconAct === 'rcon_pause') {
          await executeRconCommand({
            host,
            port,
            password: rconPwd,
            command: `mp_pause_match; say ">>> [DISCORD MIX HUB] Partida PAUSADA por ${safeActor} no proximo freezetime!"`,
          });
          return interaction.reply({ content: `⏸️ <@${user.id}> enviou **Pause Tático (\`mp_pause_match\`)** para o servidor CS2!` });
        }
        if (rconAct === 'rcon_unpause') {
          await executeRconCommand({
            host,
            port,
            password: rconPwd,
            command: `mp_unpause_match; say ">>> [DISCORD MIX HUB] Partida DESPAUSADA por ${safeActor}! GL & HF!"`,
          });
          return interaction.reply({ content: `▶️ <@${user.id}> **despausou (\`mp_unpause_match\`)** a partida no servidor CS2!` });
        }
        if (rconAct === 'rcon_live') {
          if (mix && typeof this.applyCs2TeamNamesRcon === 'function') await this.applyCs2TeamNamesRcon(mix).catch(() => {});
          await executeRconCommand({
            host,
            port,
            password: rconPwd,
            command: `mp_warmup_end; mp_restartgame 1; say ">>> [DISCORD MIX HUB] LIVE! Partida iniciada/reiniciada por ${safeActor}!"`,
          });
          return interaction.reply({ content: `🔥 <@${user.id}> encerrou o aquecimento e puxou **LIVE (\`mp_restartgame 1\`)** no CS2!` });
        }
      } catch (err) {
        return interaction.reply({ content: `❌ Falha RCON: ${err.message}`, ephemeral: true });
      }
    }
    // Community Clip Voting
    if (customId.startsWith('clip_vote_fire_') || customId.startsWith('clip_vote_bagre_')) {
      const isFire = customId.startsWith('clip_vote_fire_');
      const clipId = customId.replace(isFire ? 'clip_vote_fire_' : 'clip_vote_bagre_', '');
      const updated = communityClips.voteClip(clipId, user.id, isFire ? 'fire' : 'bagre');
      if (updated) {
        const { embeds, components } = communityClips.buildEmbed(updated);
        return interaction.update({ embeds, components });
      }
      return interaction.reply({ content: 'Clipe não encontrado.', ephemeral: true });
    }

    // Mix Set IP Modal Trigger
    if (customId.startsWith('mix_set_ip:') || customId === 'mix_set_ip') {
      const mixId = customId.includes(':') ? customId.split(':')[1] : '';
      const modal = new ModalBuilder()
        .setCustomId(`modal_set_ip:${mixId}`)
        .setTitle('⚙️ Definir IP do Servidor CS2');

      const ipInput = new TextInputBuilder()
        .setCustomId('server_ip_input')
        .setLabel('Endereço IP:Porta do Servidor')
        .setPlaceholder('Ex: 177.54.152.82:27015 ou connect 177.54.152.82:27015')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(ipInput));
      return interaction.showModal(modal);
    }

    // 1-Click GSI Install Button (on Live Match card or /gsi embed)
    if (
      customId === 'live_install_gsi' ||
      customId.startsWith('live_install_gsi:') ||
      customId === 'gsi_install_host' ||
      customId.startsWith('gsi_install_host:')
    ) {
      const requestedRoom = customId.includes(':') ? customId.split(':')[1] : '';
      const explicitRoom = requestedRoom && requestedRoom !== 'MIX-PRO' ? requestedRoom : '';
      const resolvedMix =
        (explicitRoom && this.activeMixes?.get(explicitRoom)) ||
        this.activeMixes?.get(interaction.channelId) ||
        this.resolveActiveMixForChannel(interaction.channelId);
      const roomId = normalizeRoomId(explicitRoom || resolvedMix?.id, 'MIX-PRO');
      const isHostModerator = this.isGuildModerator(
        interaction.member,
        interaction.guild,
        resolvedMix,
        interaction.user?.id
      );
      const payload = this.buildGsiInstallReplyPayload(roomId, {
        isHostModerator,
        tryLocalInstall: true,
      });
      return interaction.reply({ ...payload, ephemeral: true });
    }

    // GSI Help Information Button
    if (customId === 'gsi_help_info') {
      return interaction.reply({
        content:
          `ℹ️ **O que é Valve GSI e como funciona?**\n\n` +
          `• O **Game State Integration (GSI)** é um recurso nativo e oficial da Valve no CS2 que transmite eventos do jogo em tempo real (vida, colete, dinheiro, kills, rounds, bombas).\n` +
          `• **Basta 1 jogador** da partida estar conectado com o GSI ativo para todo o servidor/Discord e o Hub Web acompanharem o radar e estatísticas ao vivo!\n` +
          `• **Instalação sem \`.bat\`:** Clique em **\`⚡ Instalar GSI (1 Clique)\`** para baixar o \`.cfg\` direto aqui no Discord ou copiar o comando automático de 1 linha (\`Win + R\`). Se o bot estiver rodando no seu PC Windows, ele instala direto na pasta do CS2!\n` +
          `• Pasta de destino no CS2: \`.../steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg/gamestate_integration_cs2mixhub.cfg\` — 100% oficial pela Valve (VAC-Safe).`,
        ephemeral: true,
      });
    }

    // Permanent Panel Trigger
    if (customId === 'panel_create_mix') {
      const mix = this.getOrCreateMix(interaction.channelId, user, { name: `Mix 5v5 de ${user.username}` });
      const tutorialEmbed = this.buildMixTutorialEmbed();
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      const reply = await interaction.reply({
        content: `🎮 <@${user.id}> abriu um novo **Lobby de Mix CS2**!`,
        embeds: [tutorialEmbed, embed],
        components,
        fetchReply: true,
      });
      if (reply) {
        mix.lobbyMessageId = reply.id;
        mix.channelId = interaction.channelId;
      }
      return reply;
    }

    // Permanent Panel GC Level Modal
    if (customId === 'panel_set_level') {
      const current = this.getPlayerLevel(user.id);
      const modal = new ModalBuilder()
        .setCustomId('modal_set_level:panel')
        .setTitle('Nível Gamers Club (GC)');

      const levelInput = new TextInputBuilder()
        .setCustomId('gc_level_input')
        .setLabel('Seu Nível na Gamers Club (1 a 21)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 18')
        .setValue(String(current || 16))
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(levelInput);
      modal.addComponents(actionRow);
      return interaction.showModal(modal);
    }

    // Permanent Panel Live Match Monitor Trigger
    if (customId === 'panel_live_radar') {
      const requester = user.username || 'Jogador';
      const mix = this.resolveActiveMixForChannel(interaction.channelId);
      const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
      const embed = this.buildLiveMatchEmbed(requester, null, false, mix);
      const components = this.buildLiveMatchButtons(this.isGsiOnline(), false, roomId, mix, interaction.channelId);
      await interaction.reply({
        content: `📡 <@${user.id}> ativou o **Monitorar Partida**!`,
        embeds: [embed],
        components,
      });
      const sent = await interaction.fetchReply();
      this.registerLiveTracker(sent, requester, null, false);
      return;
    }
    // Refresh Hardware Deals
    if (customId === 'deals_refresh_hot') {
      const deals = await hardwareDealsManager.getDeals({ limit: 5 });
      const embed = hardwareDealsManager.buildDealsEmbed(deals);
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals);
      return interaction.update({ embeds: [embed], components: [selectMenu, ...actionButtons] });
    }

    // Live Match Tracker Controls
    if (customId === 'live_toggle_expand') {
      const tracker = this.liveTrackers?.get(interaction.message?.id);
      const isExpanded = tracker ? !tracker.isExpanded : true;
      if (tracker) {
        tracker.isExpanded = isExpanded;
      }
      const requester = interaction.user?.username || tracker?.requester || 'Jogador';
      const mix = this.resolveActiveMixForChannel(interaction.channelId);
      const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
      const embed = this.buildLiveMatchEmbed(requester, tracker?.targetQuery, isExpanded, mix);
      const components = this.buildLiveMatchButtons(this.isGsiOnline(), isExpanded, roomId, mix, interaction.channelId);
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'live_refresh') {
      const tracker = this.liveTrackers?.get(interaction.message?.id);
      const requester = interaction.user?.username || tracker?.requester || 'Jogador';
      const isExpanded = tracker ? Boolean(tracker.isExpanded) : false;
      const mix = this.resolveActiveMixForChannel(interaction.channelId);
      const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
      const embed = this.buildLiveMatchEmbed(requester, tracker?.targetQuery, isExpanded, mix);
      const components = this.buildLiveMatchButtons(this.isGsiOnline(), isExpanded, roomId, mix, interaction.channelId);
      if (interaction.message?.id) {
        this.registerLiveTracker(interaction.message, requester, tracker?.targetQuery, isExpanded);
      }
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'live_stop') {
      if (this.liveTrackers && interaction.message?.id) {
        this.liveTrackers.delete(interaction.message.id);
      }
      const embed = new EmbedBuilder()
        .setTitle('⏹️ MONITOR AO VIVO ENCERRADO')
        .setDescription(
          `O monitoramento de partida ao vivo foi desativado por <@${user.id}>.\n` +
            `Para iniciar novamente a qualquer momento antes ou durante uma partida, digite \`!aovivo\` ou \`/aovivo\`.`
        )
        .setColor(0x64748b)
        .setTimestamp();
      return interaction.update({ embeds: [embed], components: [] });
    }

    const [action, mixId, param] = customId.split(':');

    // Interactive Bagre Vote handlers (work on active OR recently finished mixes)
    if (action === 'bagre_open') {
      const targetMix = this.resolveMixIncludingFinished(mixId, interaction.channelId);
      const candCount = targetMix
        ? (targetMix.players?.length || ((targetMix.teamA?.players?.length || 0) + (targetMix.teamB?.players?.length || 0)))
        : 0;
      if (!targetMix || candCount < 2) {
        return interaction.reply({
          content: '⚠️ Não foi possível abrir a votação de Bagre (lobby inválido ou com menos de 2 jogadores).',
          ephemeral: true,
        });
      }
      const voteEmbed = bagreVoteService.buildVoteEmbed(targetMix);
      const voteComponents = bagreVoteService.buildVoteMenu(targetMix);
      return interaction.reply({ embeds: [voteEmbed], components: voteComponents });
    }

    if (action === 'bagre_finish') {
      const session = bagreVoteService.activeVotes.get(mixId);
      if (!session) {
        return interaction.reply({ content: '⚠️ Esta votação de Bagre já foi encerrada ou expirou.', ephemeral: true });
      }
      const targetMix = this.resolveMixIncludingFinished(mixId, interaction.channelId);
      const canFinish =
        this.isGuildModerator(interaction.member, interaction.guild, targetMix || { creatorId: session.creatorId }, user.id) ||
        (!session.creatorId && !targetMix?.creatorId);
      if (!canFinish) {
        return interaction.reply({
          content: '🚫 Apenas o **Criador do Mix** ou **Administradores** podem encerrar a votação e coroar o Bagre.',
          ephemeral: true,
        });
      }
      await interaction.update({ components: [] }).catch(() => interaction.deferUpdate().catch(() => {}));
      const profiles = this.loadPlayerProfiles();
      await bagreVoteService.finishVote(
        targetMix || mixId,
        interaction.channel,
        interaction.guild,
        profiles,
        (updatedProfiles) => {
          this.savePlayerProfiles(updatedProfiles);
          this.updateLeaderboardFile(updatedProfiles);
        }
      );
      return;
    }

    // Mix Live Tracker Trigger from Lobby or Match Ready Screen
    if (action === 'mix_live_tracker') {
      const requester = user.username || 'Jogador';
      const byExplicit = mixId ? this.activeMixes?.get(mixId) : null;
      const mix =
        (byExplicit && (!byExplicit.channelId || byExplicit.channelId === interaction.channelId) ? byExplicit : null) ||
        this.resolveActiveMixForChannel(interaction.channelId);
      const roomId = normalizeRoomId(mix?.id || mixId, 'MIX-PRO');
      const embed = this.buildLiveMatchEmbed(requester, null, false, mix);
      const components = this.buildLiveMatchButtons(this.isGsiOnline(), false, roomId, mix, interaction.channelId);
      await interaction.reply({
        content: `📡 <@${user.id}> ativou o **Monitorar Partida**!`,
        embeds: [embed],
        components,
      });
      const sent = await interaction.fetchReply();
      this.registerLiveTracker(sent, requester, null, false);
      return;
    }

    let mix = this.activeMixes.get(interaction.channelId);
    const byId = mixId ? this.activeMixes.get(mixId) : null;
    if ((!mix || (mixId && mix.id !== mixId)) && byId && (!byId.channelId || byId.channelId === interaction.channelId)) {
      mix = byId;
    }

    const isFinishedMix = Boolean(mixId && this.lastFinishedMixes?.has(mixId));
    if ((!mix || (mixId && mix.id !== mixId)) && mixId && action !== 'mix_cancel' && action !== 'mix_rematch' && !isFinishedMix) {
      mix = this.recoverMixFromMessage(interaction, mixId) || mix;
    }
    if ((!mix || (mixId && mix.id !== mixId)) && mixId && (action === 'mix_rematch' || action === 'mix_voice_lobby')) {
      const finishedMix = this.resolveMixIncludingFinished(mixId, interaction.channelId);
      if (finishedMix && finishedMix.id === mixId) {
        mix = finishedMix;
        if (action === 'mix_rematch') {
          this.activeMixes.set(interaction.channelId, mix);
          if (mix.id) this.activeMixes.set(mix.id, mix);
        }
      }
    }

    if (!mix || (mixId && mix.id !== mixId)) {
      return interaction.reply({
        content: '⚠️ Este mix já foi finalizado ou expirou. Use `/mix criar` para começar outro!',
        ephemeral: true,
      });
    }

    // TOGGLE DRAFT MODE (BALANCED SNAKE-DRAFT VS CAPTAINS 1V1)
    if (action === 'mix_toggle_mode') {
      if (mix.phase !== 'lobby' && mix.phase !== 'ready_check') {
        return interaction.reply({
          content: '⚠️ O modo de divisão só pode ser alterado antes dos times serem formados.',
          ephemeral: true,
        });
      }
      const isParticipant = (mix.players || []).some((p) => p.id === user.id);
      if (!this.isGuildModerator(interaction.member, interaction.guild, mix, user.id) && !isParticipant) {
        return interaction.reply({
          content: '🚫 Entre no lobby ou seja o criador/admin para alternar o modo de sorteio!',
          ephemeral: true,
        });
      }
      mix.balanceMode = mix.balanceMode === 'captains' ? 'balanced' : 'captains';
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      const embed = mix.phase === 'ready_check' ? this.buildReadyCheckEmbed(mix) : this.buildLobbyEmbed(mix);
      const components = mix.phase === 'ready_check' ? this.buildReadyCheckButtons(mix) : this.buildLobbyButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 1. JOIN MIX (TITULAR OU FILA DE RESERVA)
    if (action === 'mix_join') {
      mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
      const alreadyIn = mix.players.some((p) => p.id === user.id) || mix.waitlist.some((p) => p.id === user.id);
      if (alreadyIn) {
        return interaction.reply({
          content: '⚠️ Você já está inscrito neste mix (titular ou reserva)!',
          ephemeral: true,
        });
      }

      if (mix.players.length >= 10 && mix.waitlist.length >= 3) {
        return interaction.reply({
          content: '🚫 O lobby (10/10) e a Fila de Reserva (3/3) já estão lotados!',
          ephemeral: true,
        });
      }

      if (!this.hasSavedLevel(user.id)) {
        const modal = new ModalBuilder()
          .setCustomId(`modal_join_set_level:${mix.id}`)
          .setTitle('Cadastre seu Nível GC (1 a 21)');

        const levelInput = new TextInputBuilder()
          .setCustomId('gc_level_input')
          .setLabel('Seu Nível Gamers Club (1 a 21)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 16 (ficará salvo no seu perfil)')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(2);

        const firstActionRow = new ActionRowBuilder().addComponents(levelInput);
        modal.addComponents(firstActionRow);
        return interaction.showModal(modal);
      }

      const userLvl = this.getPlayerLevel(user.id);
      const newEntry = {
        id: user.id,
        username: user.username,
        displayName: interaction.member?.displayName || user.username,
        avatar: user.displayAvatarURL({ dynamic: true }),
        level: userLvl,
        ready: true,
      };

      if (mix.players.length >= 10) {
        mix.waitlist.push(newEntry);
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
        const embed = mix.phase === 'ready_check' ? this.buildReadyCheckEmbed(mix) : this.buildLobbyEmbed(mix);
        const components = mix.phase === 'ready_check' ? this.buildReadyCheckButtons(mix) : this.buildLobbyButtons(mix);
        await interaction.update({ embeds: [embed], components });
        return interaction.followUp({
          content: `📋 <@${user.id}> entrou na **Fila de Reserva (Suplente #${mix.waitlist.length}/3)**! Se alguém sair ou ficar AFK no check-in, você assume a vaga automaticamente.`,
          ephemeral: true,
        });
      }

      mix.players.push(newEntry);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);

      if (mix.players.length === 8 || mix.players.length === 9) {
        this.notifyMissingSlots(mix, interaction.guild, interaction.channel).catch(() => {});
      }

      if (mix.players.length === 10) {
        this.startReadyCheck(mix, interaction.channel);
        const embed = this.buildReadyCheckEmbed(mix);
        const components = this.buildReadyCheckButtons(mix);
        return interaction.update({ embeds: [embed], components });
      }

      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // SET LEVEL MODAL POPUP
    if (action === 'mix_set_level') {
      const current = this.getPlayerLevel(user.id);
      const modal = new ModalBuilder()
        .setCustomId(`modal_set_level:${mix.id}`)
        .setTitle('Nível Gamers Club (GC)');

      const levelInput = new TextInputBuilder()
        .setCustomId('gc_level_input')
        .setLabel('Seu Nível na Gamers Club (1 a 21)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 18')
        .setValue(String(current || 16))
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(levelInput);
      modal.addComponents(actionRow);

      return interaction.showModal(modal);
    }

    // 2. READY CONFIRM (ANTI-AFK CHECK-IN)
    if (action === 'ready_confirm') {
      if (mix.phase !== 'ready_check') {
        return interaction.reply({ content: '⚠️ O check-in deste lobby já foi finalizado!', ephemeral: true });
      }
      const isPlayer = mix.players.some((p) => p.id === user.id);
      if (!isPlayer) {
        return interaction.reply({ content: '🚫 Você não está entre os 10 titulares deste mix!', ephemeral: true });
      }

      mix.readyCheck.confirmed.add(user.id);
      const confirmedCount = mix.readyCheck.confirmed.size;

      if (confirmedCount >= 10 || confirmedCount >= mix.players.length) {
        if (mix.readyCheck.timer) {
          clearTimeout(mix.readyCheck.timer);
          mix.readyCheck.timer = null;
        }
        mix.readyCheck.active = false;

        if (mix.balanceMode === 'captains' && mix.players.length >= 4) {
          this.startCaptainDraft1v1(mix);
          this.updateLobbyInChannels(mix);
          const { embed, components } = this.buildCaptainDraftEmbedAndComponents(mix);
          return interaction.update({
            content: '🎉 **TODOS OS JOGADORES CONFIRMARAM PRESENÇA!**\nModo **Draft 1v1 de Capitães** iniciado!',
            embeds: [embed],
            components,
          });
        }

        this.balanceTeams(mix);
        this.updateLobbyInChannels(mix);
        const embed = this.buildTeamsEmbed(mix);
        return interaction.update({
          content: '🎉 **TODOS OS JOGADORES CONFIRMARAM PRESENÇA!**\nTimes equilibrados matematicamente (Nível GC + Winrate Histórico). Capitães, podem iniciar o Veto ou mudar para Draft 1v1!',
          embeds: [embed],
          components: [this.buildTeamsActionButtons(mix)],
        });
      }

      const embed = this.buildReadyCheckEmbed(mix);
      const components = this.buildReadyCheckButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 3. LEAVE MIX (PROMOVE SUPLENTE DA RESERVA AUTOMATICAMENTE)
    if (action === 'mix_leave') {
      mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
      const idx = mix.players.findIndex((p) => p.id === user.id);
      const waitIdx = mix.waitlist.findIndex((p) => p.id === user.id);

      if (idx === -1 && waitIdx === -1) {
        return interaction.reply({ content: '⚠️ Você não está na fila deste mix.', ephemeral: true });
      }

      if (waitIdx !== -1) {
        mix.waitlist.splice(waitIdx, 1);
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
        const isRC = mix.phase === 'ready_check';
        const embed = isRC ? this.buildReadyCheckEmbed(mix) : this.buildLobbyEmbed(mix);
        const components = isRC ? this.buildReadyCheckButtons(mix) : this.buildLobbyButtons(mix);
        return interaction.update({ embeds: [embed], components });
      }

      mix.players.splice(idx, 1);
      if (mix.readyCheck?.confirmed) {
        mix.readyCheck.confirmed.delete(user.id);
      }

      let promotedMsg = '';
      if (mix.waitlist.length > 0 && mix.players.length < 10) {
        const nextSub = mix.waitlist.shift();
        mix.players.push(nextSub);
        promotedMsg = `🔄 <@${nextSub.id}> foi promovido automaticamente da **Fila de Reserva** para titular!`;
      }

      if (mix.players.length <= 7 && mix.notifiedMissing) {
        mix.notifiedMissing.clear();
      }

      if (mix.phase === 'ready_check' && mix.players.length < 10) {
        if (mix.readyCheck?.timer) {
          clearTimeout(mix.readyCheck.timer);
          mix.readyCheck.timer = null;
        }
        mix.phase = 'lobby';
        mix.readyCheck.active = false;
      }

      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);

      const embed = mix.phase === 'ready_check' ? this.buildReadyCheckEmbed(mix) : this.buildLobbyEmbed(mix);
      const components = mix.phase === 'ready_check' ? this.buildReadyCheckButtons(mix) : this.buildLobbyButtons(mix);
      await interaction.update({ content: promotedMsg || undefined, embeds: [embed], components });
      return;
    }

    // 4. DRAW TEAMS (COMBINATORIO EXATO) & CAPTAIN DRAFT 1V1
    if (action === 'mix_captain_draft') {
      if (mix.players.length < 4) {
        return interaction.reply({
          content: '⚠️ São necessários pelo menos 4 jogadores no lobby para iniciar o Draft 1v1 de Capitães!',
          ephemeral: true,
        });
      }
      if (mix.readyCheck?.timer) {
        clearTimeout(mix.readyCheck.timer);
        mix.readyCheck.timer = null;
      }
      if (mix.readyCheck) {
        mix.readyCheck.active = false;
      }
      this.startCaptainDraft1v1(mix);
      this.updateLobbyInChannels(mix);
      const { embed, components } = this.buildCaptainDraftEmbedAndComponents(mix);
      return interaction.update({
        content: '👑 **MODO DRAFT DE CAPITÃES 1v1 INICIADO!**\nOs dois maiores níveis foram eleitos Capitães. Escolham seus jogadores no menu abaixo!',
        embeds: [embed],
        components,
      });
    }

    if (action === 'mix_teams') {
      if (mix.players.length < 2) {
        return interaction.reply({
          content: '⚠️ É necessário pelo menos 2 jogadores para formar times!',
          ephemeral: true,
        });
      }

      if (mix.readyCheck?.timer) {
        clearTimeout(mix.readyCheck.timer);
        mix.readyCheck.timer = null;
      }
      if (mix.readyCheck) {
        mix.readyCheck.active = false;
      }
      this.balanceTeams(mix);
      this.updateLobbyInChannels(mix);
      const embed = this.buildTeamsEmbed(mix);
      return interaction.update({ embeds: [embed], components: [this.buildTeamsActionButtons(mix)] });
    }

    // 5. START VETO
    if (action === 'mix_veto') {
      if (mix.teamA.players.length === 0 || mix.teamB.players.length === 0) {
        this.balanceTeams(mix);
      }
      mix.phase = 'veto';
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      const embed = this.buildVetoEmbed(mix);
      const components = this.buildVetoButtons(mix);

      return interaction.update({
        content: '🎯 **Iniciando Pick & Ban de Mapas!**',
        embeds: [embed],
        components,
      });
    }

    // 6. BAN MAP (DURING VETO)
    if (action === 'veto_ban') {
      const mapId = param;
      const veto = mix.veto;

      const currentCaptain = veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
      const isWaCaptain = String(currentCaptain?.id).startsWith('wa_');
      const isCurrentTeam = (veto.currentTurn === 'teamA' ? mix.teamA.players : mix.teamB.players).some((p) => p.id === user.id);
      const isAllowed = user.id === currentCaptain?.id || user.id === mix.creatorId || (isWaCaptain && isCurrentTeam);

      if (!isAllowed) {
        const capTag = isSnowflake(currentCaptain?.id)
          ? `<@${currentCaptain?.id}>`
          : `**${currentCaptain?.displayName || currentCaptain?.nick || currentCaptain?.name || currentCaptain?.username || 'Capitão'}** (WhatsApp)`;
        return interaction.reply({
          content: `🚫 Não é a sua vez! Apenas o Capitão ${capTag} pode banir agora.`,
          ephemeral: true,
        });
      }

      const mapIndex = veto.remainingMaps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) {
        return interaction.reply({
          content: '⚠️ Este mapa já foi banido!',
          ephemeral: true,
        });
      }

      const [banned] = veto.remainingMaps.splice(mapIndex, 1);
      veto.bannedMaps.push({ map: banned, by: user.id, team: veto.currentTurn });

      // Alternate turn
      veto.currentTurn = veto.currentTurn === 'teamA' ? 'teamB' : 'teamA';

      // Check if 1 map left (decider) -> Trigger Side Pick!
      if (veto.remainingMaps.length === 1) {
        veto.deciderMap = veto.remainingMaps[0];
        this.registerMapPlayed(interaction.guild?.id || interaction.channelId, veto.deciderMap?.id);
        mix.finalMap = {
          id: veto.deciderMap.id,
          name: veto.deciderMap.name,
          file: veto.deciderMap.id,
          image: veto.deciderMap.image,
        };
        mix.matchMap = veto.deciderMap.name;
        mix.phase = 'side_pick';
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);

        return interaction.update(this.buildSidePickPayload(mix));
      }

      this.syncToWebRoom(mix);
      const embed = this.buildVetoEmbed(mix);
      const components = this.buildVetoButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 7. SIDE PICK (CT OR TR SELECTION)
    if (action === 'side_pick') {
      if (mix.phase === 'live') {
        return interaction.reply({ content: '⚠️ Os lados já foram escolhidos e a partida já está ao vivo!', ephemeral: true });
      }
      const chosenSide = param; // 'CT' or 'TR'
      const oppSide = chosenSide === 'CT' ? 'TR' : 'CT';

      const captainB = mix.teamB.captain || mix.players[1] || mix.players[0];
      const isWaCaptain = String(captainB?.id).startsWith('wa_');
      const isTeamBMember = (mix.teamB.players || []).some((p) => p.id === user.id);
      const isAllowed = user.id === captainB?.id || user.id === mix.creatorId || (isWaCaptain && isTeamBMember);

      if (!isAllowed) {
        const capTag = isSnowflake(captainB?.id)
          ? `<@${captainB?.id}>`
          : `**${captainB?.displayName || captainB?.nick || captainB?.name || 'Capitão'}** (WhatsApp)`;
        return interaction.reply({
          content: `🚫 Apenas o Capitão ${capTag} pode escolher o lado!`,
          ephemeral: true,
        });
      }

      mix.teamB.side = chosenSide;
      mix.teamA.side = oppSide;
      mix.teamB.startingSide = chosenSide;
      mix.teamA.startingSide = oppSide;
      mix.teamA.halftimeSwapped = false;
      mix.teamB.halftimeSwapped = false;
      mix.phase = 'live';

      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);

      if (this.config.autoMoveVoice) {
        this.executeVoiceMover(interaction.guild, mix, interaction.channel).catch(() => {});
      }
      if (mix.veto?.deciderMap) {
        this.triggerAutoRconMapChange(mix, mix.veto.deciderMap, interaction.channel).catch(() => {});
      }
      const finalEmbed = this.buildMatchReadyEmbed(mix);
      const components = this.buildMatchReadyButtons(mix);
      const conn = this.resolveMixDisplayConnect(mix);

      await interaction.update({
        content: `🔥 **PARTIDA CONFIRMADA NO CS2!** Mapa: **${mix.veto?.deciderMap?.name?.toUpperCase() || 'CS2'}** • Comando: \`${conn ? conn.consoleCommand : 'A definir (!servidor ip:porta)'}\` • GL & HF!`,
        embeds: [finalEmbed],
        components,
      });
      // INICIAR MONITORAMENTO AUTOMÁTICO EM TEMPO REAL
      this.startAutomaticLiveMonitoring(mix, interaction.channel, interaction.guild).catch((err) => {
        console.warn('[BOT] Erro ao iniciar monitoramento automático:', err.message);
      });
      return;
    }

    // 8. ROULETTE (sorteio justo, sem repetir mapa até sair todos)
    if (action === 'mix_roulette') {
      const { drawn, remainingInCycle } = this.drawFairMap(interaction.guild?.id || interaction.channelId);

      if (interaction.message?.id && interaction.message.id !== mix.lobbyMessageId) {
        await interaction.update({ components: [] }).catch(() => {});
      } else {
        await interaction.deferUpdate().catch(() => {});
      }

      await this.startMatchWithMap(mix, drawn, {
        channel: interaction.channel,
        guild: interaction.guild,
        source: 'roleta',
        remainingInCycle,
      });
      return;
    }

    // 8.1 ESCOLHER MAPA MANUALMENTE
    if (action === 'mix_pick_map') {
      if (!this.canChooseMap(mix, user.id)) {
        return interaction.reply({
          content: '🚫 Apenas jogadores do mix, capitães ou o criador podem escolher o mapa.',
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: `🗺️ **Escolha o mapa da partida** (${mix.name}):`,
        components: this.buildMapPickMenu(mix),
        ephemeral: true,
      });
    }

    // 9. VOICE MOVER
    if (action === 'mix_voice') {
      const result = await this.executeVoiceMover(interaction.guild, mix, interaction.channel);
      return interaction.reply({ content: result.message, ephemeral: false });
    }

    if (action === 'mix_voice_lobby') {
      const result = await this.executeVoiceReturnToLobby(interaction.guild, mix);
      return interaction.reply({ content: result.message, ephemeral: false });
    }

    // 10. DECLARE MATCH RESULT (MODAL)
    if (action === 'match_result') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_match_result:${mix.id}`)
        .setTitle('🏆 Declarar Placar da Partida');

      const defaultMap = mix.matchMap || mix.veto?.deciderMap?.name || 'Mirage';

      const winnerInput = new TextInputBuilder()
        .setCustomId('winner_input')
        .setLabel('Time Vencedor (digite A ou B)')
        .setPlaceholder('Ex: A ou B')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(1)
        .setRequired(true);

      const scoreInput = new TextInputBuilder()
        .setCustomId('score_input')
        .setLabel('Placar Final do Confronto')
        .setPlaceholder('Ex: 13-9, 13-11, 16-14')
        .setValue('13-9')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(10)
        .setRequired(true);

      const mapInput = new TextInputBuilder()
        .setCustomId('map_input')
        .setLabel('Mapa Jogado no CS2')
        .setPlaceholder('Ex: Mirage, Inferno, Nuke, Dust II, Ancient, Anubis...')
        .setValue(defaultMap)
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(30)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(winnerInput),
        new ActionRowBuilder().addComponents(scoreInput),
        new ActionRowBuilder().addComponents(mapInput)
      );

      return interaction.showModal(modal);
    }

    // 11. SUBSTITUTE INTERACTIVE PICKER OR MANUAL MODAL
    if (action === 'mix_sub') {
      const candidates = (mix.players || []).slice(0, 25);
      if (candidates.length === 0) {
        return interaction.reply({ content: '⚠️ Não há jogadores no lobby para substituir.', ephemeral: true });
      }
      const outSelect = new StringSelectMenuBuilder()
        .setCustomId(`sub_pick_out:${mix.id}`)
        .setPlaceholder('1️⃣ Selecione quem vai SAIR do mix...')
        .addOptions(
          candidates.map((p) => {
            const teamTag = (mix.teamA?.players || []).some((a) => a.id === p.id)
              ? mix.teamA?.name || 'Time A'
              : (mix.teamB?.players || []).some((b) => b.id === p.id)
              ? mix.teamB?.name || 'Time B'
              : 'Lobby';
            return {
              label: `${(p.displayName || p.username || 'Jogador').slice(0, 50)} (Lvl ${p.level || 16})`,
              value: String(p.id),
              description: `${teamTag} • Clique para substituir`,
              emoji: '🚪',
            };
          })
        );
      const manualRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`sub_manual_modal:${mix.id}`)
          .setLabel('Digitar Nick/ID Manualmente')
          .setEmoji('⌨️')
          .setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({
        content: `🔄 **Substituição de Jogador (${mix.name})**\nSelecione primeiro quem vai **sair**:`,
        components: [new ActionRowBuilder().addComponents(outSelect), manualRow],
        ephemeral: true,
      });
    }

    if (action === 'sub_manual_modal') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_mix_sub:${mix.id}`)
        .setTitle('🔄 Substituição de Jogador');

      const outInput = new TextInputBuilder()
        .setCustomId('sub_out')
        .setLabel('Quem vai sair do mix? (Nick ou ID)')
        .setPlaceholder('Ex: nick_do_jogador ou ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inInput = new TextInputBuilder()
        .setCustomId('sub_in')
        .setLabel('Quem vai entrar como reserva? (Nick ou ID)')
        .setPlaceholder('Ex: novo_jogador ou ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(outInput),
        new ActionRowBuilder().addComponents(inInput)
      );

      return interaction.showModal(modal);
    }

    // 13. REMATCH WITH THE SAME TEAMS
    if (action === 'mix_rematch') {
      return this.handleRematch(mix, interaction, user, interaction.channel, interaction.guild);
    }

    // 10. CANCEL MIX
    if (action === 'mix_cancel') {
      if (!this.isGuildModerator(interaction.member, interaction.guild, mix, user.id)) {
        return interaction.reply({
          content: '🚫 Apenas o **Criador do Mix** ou um **Administrador** pode cancelar este mix.',
          ephemeral: true,
        });
      }
      this.deleteMix(mix.channelId || interaction.channelId);
      return interaction.update({
        content: `❌ O mix **${mix.name}** foi cancelado por <@${user.id}>.`,
        embeds: [],
        components: [],
      });
    }
  }

  async resolveVoiceChannelsForGuild(guild, contextChannel = null) {
    if (!guild) return null;

    if (!this.config.guildVoiceChannels) {
      this.config.guildVoiceChannels = {};
    }

    const guildVoice = this.config.guildVoiceChannels[guild.id] || {};
    let channelA = null;
    let channelB = null;

    // 1. Check if configured IDs exist in the guild
    if (guildVoice.teamAVoiceId) {
      channelA = await guild.channels.fetch(guildVoice.teamAVoiceId).catch(() => null);
    }
    if (guildVoice.teamBVoiceId) {
      channelB = await guild.channels.fetch(guildVoice.teamBVoiceId).catch(() => null);
    }

    // Fallback to legacy global config if not found in per-guild config
    if (!channelA && this.config.teamAVoiceId) {
      channelA = await guild.channels.fetch(this.config.teamAVoiceId).catch(() => null);
    }
    if (!channelB && this.config.teamBVoiceId) {
      channelB = await guild.channels.fetch(this.config.teamBVoiceId).catch(() => null);
    }

    // 2. Search existing channels in this guild by name pattern if missing
    if (!channelA || !channelB) {
      try {
        const channels = await guild.channels.fetch();
        const voiceChannels = channels.filter((c) => c && c.type === ChannelType.GuildVoice);

        if (!channelA) {
          channelA =
            voiceChannels.find((c) => /^(🔊\s*)?(time\s*a|team\s*a|call\s*a|mix\s*a)/i.test(c.name)) || null;
        }

        if (!channelB) {
          channelB =
            voiceChannels.find((c) => /^(🔊\s*)?(time\s*b|team\s*b|call\s*b|mix\s*b)/i.test(c.name)) || null;
        }
      } catch (err) {
        console.warn(`[VOICE RESOLVER] Erro ao buscar canais no servidor ${guild.name}:`, err.message);
      }
    }

    // 3. If still missing, AUTO-CREATE THEM in the server!
    const me = await guild.members.fetchMe().catch(() => null);
    const canManage = me && me.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if ((!channelA || !channelB) && canManage) {
      try {
        let parentCategoryId = contextChannel?.parentId || guildVoice.categoryId || null;
        if (!parentCategoryId) {
          const channels = await guild.channels.fetch();
          const existingCat = channels.find(
            (c) => c && c.type === ChannelType.GuildCategory && /cs2 mix hub|calls do mix/i.test(c.name)
          );
          if (existingCat) {
            parentCategoryId = existingCat.id;
          } else {
            const newCat = await guild.channels.create({
              name: '🏆 CS2 MIX HUB',
              type: ChannelType.GuildCategory,
            });
            parentCategoryId = newCat.id;
          }
        }

        if (!channelA) {
          channelA = await guild.channels.create({
            name: '🔊 Time A (Mix CS2)',
            type: ChannelType.GuildVoice,
            parent: parentCategoryId,
            userLimit: 5,
          });
          console.log(`[VOICE MOVER] Canal Time A criado em ${guild.name} (ID: ${channelA.id})`);
        }

        if (!channelB) {
          channelB = await guild.channels.create({
            name: '🔊 Time B (Mix CS2)',
            type: ChannelType.GuildVoice,
            parent: parentCategoryId,
            userLimit: 5,
          });
          console.log(`[VOICE MOVER] Canal Time B criado em ${guild.name} (ID: ${channelB.id})`);
        }
      } catch (err) {
        console.warn(`[VOICE MOVER] Falha ao auto-criar canais de voz em ${guild.name}:`, err.message);
      }
    }

    // 4. Save the resolved channels in config for this guild
    if (channelA && channelB) {
      this.config.guildVoiceChannels[guild.id] = {
        teamAVoiceId: channelA.id,
        teamBVoiceId: channelB.id,
        categoryId: channelA.parentId || guildVoice.categoryId || '',
      };
      if (!this.config.teamAVoiceId) this.config.teamAVoiceId = channelA.id;
      if (!this.config.teamBVoiceId) this.config.teamBVoiceId = channelB.id;
      this.saveConfig({
        guildVoiceChannels: this.config.guildVoiceChannels,
        teamAVoiceId: this.config.teamAVoiceId,
        teamBVoiceId: this.config.teamBVoiceId,
      });
    }

    return { channelA, channelB };
  }

  async executeVoiceMover(guild, mix, contextChannel = null) {
    if (!guild) return { success: false, message: 'Servidor não encontrado.' };

    const resolved = await this.resolveVoiceChannelsForGuild(guild, contextChannel);
    if (!resolved || !resolved.channelA || !resolved.channelB) {
      return {
        success: false,
        message: '⚠️ Não foi possível encontrar ou criar os canais de voz **Time A** e **Time B**. Verifique se o bot possui a permissão de **Gerenciar Canais** ou configure os canais manualmente com `/calls`.',
      };
    }

    const { channelA, channelB } = resolved;

    this._voiceOverwriteCache = this._voiceOverwriteCache || new Map();
    const nowTs = Date.now();
    const cacheKey = `${guild.id}:${channelA.id}:${channelB.id}`;
    const rosterSig = [
      ...(mix.teamA?.players || []).map((p) => String(p.id || '')).sort(),
      '|',
      ...(mix.teamB?.players || []).map((p) => String(p.id || '')).sort(),
    ].join(',');
    const prevCache = this._voiceOverwriteCache.get(cacheKey);
    const prevTs = typeof prevCache === 'number' ? prevCache : (prevCache?.ts || 0);
    const prevSig = typeof prevCache === 'object' && prevCache ? prevCache.signature : '';
    const canEditOverwrites = (nowTs - prevTs) > 10 * 60 * 1000 || prevSig !== rosterSig;

    if (canEditOverwrites) {
      this._voiceOverwriteCache.set(cacheKey, { ts: nowTs, signature: rosterSig });
      if (this._voiceOverwriteCache.size > 200) {
        const cutoff = nowTs - 30 * 60 * 1000;
        for (const [k, v] of this._voiceOverwriteCache.entries()) {
          const tsVal = typeof v === 'number' ? v : (v?.ts || 0);
          if (tsVal < cutoff) this._voiceOverwriteCache.delete(k);
        }
      }
      try {
        if (channelA && channelA.manageable) {
          const overwritesA = [
            {
              id: guild.id,
              deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages],
              allow: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: this.client.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.MoveMembers,
                PermissionsBitField.Flags.ManageChannels,
              ],
            },
            ...(mix.teamA.players || []).filter((p) => isSnowflake(p.id)).map((p) => ({
              id: p.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
              ],
            })),
          ];
          await Promise.race([
            channelA.permissionOverwrites.set(overwritesA),
            new Promise((r) => setTimeout(r, 1500)),
          ]).catch(() => {});
        }

        if (channelB && channelB.manageable) {
          const overwritesB = [
            {
              id: guild.id,
              deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages],
              allow: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: this.client.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.MoveMembers,
                PermissionsBitField.Flags.ManageChannels,
              ],
            },
            ...(mix.teamB.players || []).filter((p) => isSnowflake(p.id)).map((p) => ({
              id: p.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
              ],
            })),
          ];
          await Promise.race([
            channelB.permissionOverwrites.set(overwritesB),
            new Promise((r) => setTimeout(r, 1500)),
          ]).catch(() => {});
        }
      } catch (err) {
        console.warn('[VOICE MOVER] Aviso ao aplicar overwrites:', err.message);
      }
    }
    let movedCount = 0;
    const movedA = [];
    const movedB = [];
    const notInVoice = [];
    const errors = [];

    const movePlayer = async (p, targetChannel, teamLetter) => {
      if (!p || !isSnowflake(p.id)) {
        return; // WhatsApp/Web player, skip Discord voice fetch
      }
      try {
        const member = await guild.members.fetch(p.id).catch(() => null);
        if (!member) {
          errors.push(`Membro <@${p.id}> não encontrado no servidor.`);
          return;
        }

        if (member.voice && member.voice.channelId) {
          if (member.voice.channelId === targetChannel.id) {
            if (teamLetter === 'A') movedA.push(member);
            else movedB.push(member);
            movedCount++;
          } else {
            await member.voice.setChannel(targetChannel.id);
            if (teamLetter === 'A') movedA.push(member);
            else movedB.push(member);
            movedCount++;
          }
        } else {
          notInVoice.push({ p, teamLetter });
        }
      } catch (e) {
        console.warn(`[VOICE MOVER] Falha ao mover membro ${p.id}:`, e.message);
        errors.push(`<@${p.id}>: ${e.message}`);
      }
    };

    const promises = [];
    (mix.teamA.players || []).forEach((p) => promises.push(movePlayer(p, channelA, 'A')));
    (mix.teamB.players || []).forEach((p) => promises.push(movePlayer(p, channelB, 'B')));

    await Promise.all(promises);

    let msg = '';
    if (movedCount > 0) {
      msg += `✅ **${movedCount} jogador(es) nas calls de voz oficiais:**\n`;
      msg += `• **Time A:** <#${channelA.id}> (${movedA.length}/5)\n`;
      msg += `• **Time B:** <#${channelB.id}> (${movedB.length}/5)\n`;
    }

    if (notInVoice.length > 0) {
      msg += `\n⚠️ **${notInVoice.length} jogador(es) não estão conectados em nenhuma call de voz:**\n`;
      msg += notInVoice.map((item) => `• ${isSnowflake(item.p.id) ? `<@${item.p.id}>` : `**${item.p.displayName || item.p.username}**`} (${item.teamLetter === 'A' ? 'Time A' : 'Time B'})`).join('\n');
      msg += `\n\n👉 *Entrem em qualquer canal de voz do servidor e cliquem novamente no botão **[📞 Mover para Calls]** para o bot puxar vocês automaticamente!*`;
    }

    if (movedCount === 0 && notInVoice.length > 0) {
      msg = `⚠️ **Nenhum jogador dos times está conectado em canal de voz no momento!**\n\n`;
      msg += `As calls oficiais da partida estão prontas:\n`;
      msg += `• **Time A:** <#${channelA.id}>\n`;
      msg += `• **Time B:** <#${channelB.id}>\n\n`;
      msg += `👉 Entrem em qualquer canal de voz do servidor e cliquem em **[📞 Mover para Calls]** para serem transferidos automaticamente!`;
    }

    return {
      success: true,
      movedCount,
      channelA,
      channelB,
      message: msg,
    };
  }

  async executeVoiceReturnToLobby(guild, mix) {
    if (!guild) return { success: false, message: 'Servidor não encontrado.' };

    let lobbyChannel = null;
    const guildVoice = this.config.guildVoiceChannels?.[guild.id] || {};

    if (guildVoice.lobbyVoiceId) {
      lobbyChannel = await guild.channels.fetch(guildVoice.lobbyVoiceId).catch(() => null);
    }
    if (!lobbyChannel && this.config.lobbyVoiceId) {
      lobbyChannel = await guild.channels.fetch(this.config.lobbyVoiceId).catch(() => null);
    }

    if (!lobbyChannel) {
      try {
        const channels = await guild.channels.fetch();
        const voiceChannels = channels.filter((c) => c && c.type === ChannelType.GuildVoice);
        lobbyChannel =
          voiceChannels.find((c) => /^(geral|lobby|cszin|counter\s*strike)/i.test(c.name)) || null;
      } catch (_) {}
    }

    if (!lobbyChannel) {
      return {
        success: false,
        message: '⚠️ Canal de voz do Lobby/Geral não foi encontrado no servidor.',
      };
    }

    let movedCount = 0;
    const allPlayers = [...(mix.teamA?.players || []), ...(mix.teamB?.players || []), ...(mix.players || [])];
    const uniqueIds = [...new Set(allPlayers.map((p) => p.id))].filter(isSnowflake);

    for (const playerId of uniqueIds) {
      try {
        const member = await guild.members.fetch(playerId).catch(() => null);
        if (member && member.voice && member.voice.channelId) {
          if (member.voice.channelId !== lobbyChannel.id) {
            await member.voice.setChannel(lobbyChannel.id);
            movedCount++;
          }
        }
      } catch (_) {}
    }

    await this.resetVoicePermissions(guild);

    return {
      success: true,
      message: `🔊 **${movedCount} jogador(es)** foram movidos de volta para o canal <#${lobbyChannel.id}>!\n🔓 Permissões das calls dos times foram liberadas.`,
    };
  }

  async resetVoicePermissions(guild) {
    if (!guild) return;
    if (this._voiceOverwriteCache) {
      const prefix = `${guild.id}:`;
      for (const key of this._voiceOverwriteCache.keys()) {
        if (key.startsWith(prefix)) this._voiceOverwriteCache.delete(key);
      }
    }
    try {
      const guildVoice = this.config.guildVoiceChannels?.[guild.id] || {};
      if (guildVoice.teamAVoiceId) {
        const cA = await guild.channels.fetch(guildVoice.teamAVoiceId).catch(() => null);
        if (cA && cA.manageable) {
          await cA.permissionOverwrites.set([
            {
              id: guild.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.SendMessages,
              ],
            },
          ]).catch(() => {});
        }
      }
      if (guildVoice.teamBVoiceId) {
        const cB = await guild.channels.fetch(guildVoice.teamBVoiceId).catch(() => null);
        if (cB && cB.manageable) {
          await cB.permissionOverwrites.set([
            {
              id: guild.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.SendMessages,
              ],
            },
          ]).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[VOICE RESET] Falha ao restaurar permissões:', err.message);
    }
  }

  // ==========================================
  // SPECIFIC SLASH COMMAND HANDLERS
  // ==========================================

  async handleChatCommand(interaction) {
    const { commandName } = interaction;

    if (commandName === 'mix') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'criar') return this.cmdCreateMix(interaction);
      if (sub === 'entrar') return this.cmdJoinMix(interaction);
      if (sub === 'sair') return this.cmdLeaveMix(interaction);
      if (sub === 'sortear') return this.cmdDrawTeams(interaction);
      if (sub === 'veto') return this.cmdStartVeto(interaction);
      if (sub === 'roleta') return this.cmdRoulette(interaction);
      if (sub === 'status') return this.cmdStatus(interaction);
      if (sub === 'cancelar') return this.cmdCancelMix(interaction);
    }

    if (commandName === 'painel') return this.cmdSendPermanentPanel(interaction);
    if (commandName === 'roleta') return this.cmdRoulette(interaction);
    if (commandName === 'calls') return this.cmdCalls(interaction);
    if (commandName === 'stats') {
      const user = interaction.options.getUser('jogador') || interaction.user;
      const embed = this.buildUserStatsEmbed(user);
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'granada') {
      const requestedMap = interaction.options.getString('mapa') || 'mirage';
      const mapKey = resolveGrenadeMapKey(requestedMap) || 'mirage';
      const guides = GRENADE_GUIDES[mapKey] || GRENADE_GUIDES.mirage;
      const list = guides.map((g, i) => `**${i + 1}. ${g.title}**\n👉 ${g.desc}`).join('\n\n');
      const embed = new EmbedBuilder()
        .setTitle(`💨 GUIA DE GRANADAS E SMOKES • ${mapKey.toUpperCase()}`)
        .setDescription(`Lineups essenciais para dominar a ${mapKey.toUpperCase()} no CS2:\n\n${list}`)
        .setColor(0x38bdf8)
        .setFooter({ text: 'CS2 Mix Hub • Guia Tático Oficial • 10 Mapas Suportados' });
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'treino') {
      const cfg = `sv_cheats 1;\nmp_warmup_end;\nmp_roundtime_defuse 60;\nmp_buy_anywhere 1;\nmp_buytime 9999;\nmp_maxmoney 60000;\nmp_startmoney 60000;\nsv_infinite_ammo 1;\nammo_grenade_limit_total 6;\nsv_grenade_trajectory_prac_pipreview 1;\nsv_showimpacts 1;\nbot_kick;\nmp_restartgame 1;`;
      const embed = new EmbedBuilder()
        .setTitle('🎯 CFG OFICIAL DE TREINO • CS2')
        .setDescription(`Copie o bloco abaixo e cole no seu **Console do CS2**:\n\n\`\`\`cfg\n${cfg}\n\`\`\``)
        .setColor(0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Treino & Utilitários' });
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'moeda') {
      const isHeads = Math.random() < 0.5;
      const result = isHeads ? '🦅 CARA' : '👑 COROA';
      const embed = new EmbedBuilder()
        .setTitle('🪙 CARA OU COROA')
        .setDescription(`A moeda girou no ar e caiu em...\n\n# **${result}**!`)
        .setColor(isHeads ? 0x38bdf8 : 0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Randomizer' });
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'level' || commandName === 'lvl') return this.cmdSetLevel(interaction);
    if (commandName === 'servidor') return this.cmdServer(interaction);
    if (commandName === 'ranking') return this.cmdRanking(interaction);
    if (commandName === 'historico') return this.cmdHistory(interaction);
    if (commandName === 'x1') return this.cmdHeadToHead(interaction);
    if (commandName === 'mapas') return this.cmdMapStats(interaction);
    if (commandName === 'status-servidor') return this.cmdServerStatus(interaction);
    if (commandName === 'gsi') return this.cmdGsi(interaction);
    if (commandName === 'aovivo' || commandName === 'monitorar' || commandName === 'monitorar-partida') return this.cmdLive(interaction);
    if (commandName === 'vitoria' || commandName === 'resultado') return this.cmdMatchResult(interaction);
    if (commandName === 'sub') return this.cmdSubstitute(interaction);
    if (commandName === 'cargo') return this.cmdToggleRole(interaction);
    if (commandName === 'ofertas') return this.cmdDeals(interaction);
    if (commandName === 'alertas-hardware') return this.cmdHardwareAlerts(interaction);
    if (commandName === 'steam') return this.cmdSteam(interaction);
    if (commandName === 'patchnotes' || commandName === 'att') return this.cmdPatchNotes(interaction);
    if (commandName === 'pro' || commandName === 'jogos') return this.cmdProMatches(interaction);
    if (commandName === 'bagre') return this.cmdBagre(interaction);
    if (commandName === 'jogosgratis' || commandName === 'freegames') return this.cmdFreeGames(interaction);
    if (commandName === 'clip') return this.cmdClip(interaction);
    if (commandName === 'ajuda') return this.cmdHelp(interaction);
  }

  async handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    if (customId.startsWith('captain_pick_select:')) {
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix || mix.phase !== 'captain_draft' || !mix.captainDraft) {
        return interaction.reply({ content: '⚠️ Este Draft de Capitães já foi encerrado.', ephemeral: true });
      }
      const draft = mix.captainDraft;
      const currentTeamKey = draft.turnOrder[draft.step] || (mix.teamA.players.length <= mix.teamB.players.length ? 'teamA' : 'teamB');
      const currentCap = currentTeamKey === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
      const isAllowed = interaction.user.id === currentCap?.id || interaction.user.id === mix.creatorId;
      if (!isAllowed) {
        return interaction.reply({
          content: `🚫 Apenas o Capitão <@${currentCap?.id}> (ou o criador do mix) pode escolher neste turno!`,
          ephemeral: true,
        });
      }

      const pickedId = interaction.values?.[0];
      const pIdx = draft.pool.findIndex((p) => String(p.id) === String(pickedId));
      if (pIdx === -1) {
        return interaction.reply({ content: '⚠️ Jogador já foi escolhido!', ephemeral: true });
      }
      const [pickedPlayer] = draft.pool.splice(pIdx, 1);
      if (currentTeamKey === 'teamA') mix.teamA.players.push(pickedPlayer);
      else mix.teamB.players.push(pickedPlayer);
      draft.step += 1;

      if (draft.pool.length === 1) {
        const [lastPlayer] = draft.pool.splice(0, 1);
        if (mix.teamA.players.length <= mix.teamB.players.length) mix.teamA.players.push(lastPlayer);
        else mix.teamB.players.push(lastPlayer);
      }

      if (draft.pool.length === 0) {
        const sumA = mix.teamA.players.reduce((acc, p) => acc + (p.level || 16), 0);
        const sumB = mix.teamB.players.reduce((acc, p) => acc + (p.level || 16), 0);
        mix.teamA.avgLevel = (sumA / (mix.teamA.players.length || 1)).toFixed(1);
        mix.teamB.avgLevel = (sumB / (mix.teamB.players.length || 1)).toFixed(1);
        const diff = Math.abs(sumA - sumB);
        mix.balancePct = Math.max(75, Math.min(100, Math.round(100 - diff * 3.5)));
        mix.teamA.halftimeSwapped = false;
        mix.teamB.halftimeSwapped = false;
        mix.phase = 'teams';
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);

        const embed = this.buildTeamsEmbed(mix);
        return interaction.update({
          content: '✅ **DRAFT 1v1 CONCLUÍDO PELOS CAPITÃES!** Agora escolham o mapa no Veto ou na Roleta:',
          embeds: [embed],
          components: [this.buildTeamsActionButtons(mix)],
        });
      }

      this.syncToWebRoom(mix);
      const { embed, components } = this.buildCaptainDraftEmbedAndComponents(mix);
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'hardware_category_filter') {
      const selected = interaction.values[0];
      const category = selected === 'all' ? null : selected;
      const deals = await hardwareDealsManager.getDeals({ category, limit: 5 });
      const embed = hardwareDealsManager.buildDealsEmbed(deals, {
        title: selected === 'all' ? undefined : `🔥 OFERTAS DE HARDWARE • ${deals[0]?.categoryLabel || selected.toUpperCase()}`,
      });
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals, { category });
      return interaction.update({ embeds: [embed], components: [selectMenu, ...actionButtons] });
    }

    if (customId.startsWith('sub_pick_out:')) {
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Mix não encontrado ou já encerrado.', ephemeral: true });
      }
      const oldId = interaction.values?.[0];
      if (!oldId) {
        return interaction.reply({ content: '⚠️ Jogador inválido selecionado.', ephemeral: true });
      }
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`sub_pick_in:${mix.id}:${oldId}`)
        .setPlaceholder('Agora selecione quem vai ENTRAR no lugar...')
        .setMinValues(1)
        .setMaxValues(1);
      const manualRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`sub_manual_modal:${mix.id}`)
          .setLabel('Digitar Nick/ID Manualmente')
          .setEmoji('⌨️')
          .setStyle(ButtonStyle.Secondary)
      );
      const oldTag = isSnowflake(oldId) ? `<@${oldId}>` : `**${oldId}**`;
      return interaction.update({
        content: `🔄 **Substituir ${oldTag}:**\nSelecione abaixo o **novo jogador (substituto)** do servidor:`,
        components: [new ActionRowBuilder().addComponents(userSelect), manualRow],
      });
    }

    if (customId.startsWith('bagre_select:')) {
      const mixId = customId.split(':')[1];
      const candidateId = interaction.values?.[0];
      const res = bagreVoteService.castVote(mixId, interaction.user.id, candidateId);
      if (!res.success) {
        return interaction.reply({ content: `⚠️ ${res.reason}`, ephemeral: true });
      }
      const mix = this.resolveMixIncludingFinished(mixId, interaction.channelId) || { id: mixId };
      const embed = bagreVoteService.buildVoteEmbed(mix);
      const components = bagreVoteService.buildVoteMenu(mix);
      if (embed) {
        await interaction.update({ embeds: [embed], components }).catch(() => interaction.deferUpdate().catch(() => {}));
      } else {
        await interaction.deferUpdate().catch(() => {});
      }
      return interaction.followUp({
        content: `🐟 Seu voto foi computado em **${res.candidateName}**! (Total de votos: \`${res.totalVotes}\`)`,
        ephemeral: true,
      });
    }

    if (customId.startsWith('mix_map_select')) {
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Mix não encontrado ou já encerrado.', ephemeral: true });
      }
      if (!this.canChooseMap(mix, interaction.user.id)) {
        return interaction.reply({ content: '🚫 Apenas jogadores do mix, capitães ou o criador podem escolher o mapa.', ephemeral: true });
      }
      const value = interaction.values?.[0];
      let drawn;
      let remainingInCycle = null;
      let source = 'escolha';
      if (value === 'random') {
        ({ drawn, remainingInCycle } = this.drawFairMap(interaction.guild?.id || interaction.channelId));
        source = 'roleta';
      } else {
        drawn = OFFICIAL_MAPS.find((m) => m.id === value);
      }
      if (!drawn) {
        return interaction.reply({ content: '⚠️ Mapa inválido.', ephemeral: true });
      }
      await interaction
        .update({ content: `✅ Mapa definido: ${drawn.emoji} **${drawn.name}**`, components: [] })
        .catch(() => interaction.deferUpdate().catch(() => {}));
      await this.startMatchWithMap(mix, drawn, {
        channel: interaction.channel,
        guild: interaction.guild,
        source,
        user: interaction.user,
        remainingInCycle,
      });
      return;
    }
  }

  async handleUserSelectMenuInteraction(interaction) {
    const customId = interaction.customId || '';
    if (customId.startsWith('sub_pick_in:')) {
      const parts = customId.split(':');
      const oldId = parts.slice(2).join(':');
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Mix não encontrado ou já encerrado.', ephemeral: true });
      }
      const newUserId = interaction.values?.[0];
      if (!newUserId) {
        return interaction.reply({ content: '⚠️ Nenhum jogador selecionado.', ephemeral: true });
      }
      const res = await this.executeSubstitute(mix, oldId, newUserId, interaction.guild, interaction.channel);
      if (!res.success) {
        return interaction
          .update({ content: `⚠️ ${res.message}`, components: [] })
          .catch(() => interaction.reply({ content: res.message, ephemeral: true }));
      }
      await interaction.update({ content: '✅ Substituição realizada com sucesso!', components: [] }).catch(() => {});
      if (interaction.channel?.send) {
        await interaction.channel.send(res.message).catch(() => {});
      }
      return;
    }
  }

  async handleModalSubmit(interaction) {
    const customId = interaction.customId;
    if (customId.startsWith('modal_rcon_say:')) {
      const mix = this.resolveMixFromInteraction(interaction, customId);
      const text = (interaction.fields.getTextInputValue('rcon_say_text') || '').replace(/["';\r\n]/g, ' ').trim();
      const rawServer = mix?.serverIp || this.config.serverConnect || '';
      const rconPwd = (mix?.rconPassword || this.config.rconPassword || process.env.CS2_RCON_PASSWORD || '').trim();
      const { host, port } = extractHostAndPort(rawServer);

      if (!host || !rconPwd) {
        return interaction.reply({ content: '\u26a0\ufe0f Servidor ou senha RCON n\u00e3o configurados.', ephemeral: true });
      }

      try {
        await executeRconCommand({
          host,
          port,
          password: rconPwd,
          command: `say ">>> [DISCORD - ${interaction.user.username}]: ${text}"`,
        });
        return interaction.reply({
          content: `\ud83d\udce2 **Mensagem enviada para o chat do CS2 por <@${interaction.user.id}>:** \`${text}\``,
        });
      } catch (err) {
        return interaction.reply({ content: `\u274c Erro ao enviar para o CS2: ${err.message}`, ephemeral: true });
      }
    }
    if (customId.startsWith('modal_set_level')) {
      const raw = interaction.fields.getTextInputValue('gc_level_input');
      const parsed = parseInt(raw?.trim(), 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 21) {
        return interaction.reply({
          content: '⚠️ Nível inválido! Insira um número de **1 a 21** correspondente ao seu nível na Gamers Club.',
          ephemeral: true,
        });
      }

      this.setPlayerProfile(interaction.user.id, {
        level: parsed,
        username: interaction.user.username,
      });

      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (mix) {
        let changed = false;
        const p = (mix.players || []).find((pl) => pl.id === interaction.user.id);
        if (p) { p.level = parsed; changed = true; }
        const w = (mix.waitlist || []).find((pl) => pl.id === interaction.user.id);
        if (w) { w.level = parsed; changed = true; }
        if (changed) {
          this.recomputeTeamAverages(mix, interaction.user.id, parsed);
          this.syncToWebRoom(mix);
          this.updateLobbyInChannels(mix);
          const embed = this.buildLobbyEmbed(mix);
          const components = this.buildLobbyButtons(mix);
          if (mix.phase === 'lobby' && interaction.message) {
            await interaction.message.edit({ embeds: [embed], components }).catch(() => {});
          }
        }
      }

      const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';
      return interaction.reply({
        content: `✅ <@${interaction.user.id}>, seu nível da Gamers Club foi salvo com sucesso como **Lvl ${parsed}** (\`${badge}\`)!\nTodos os sorteios de times balancearão as equipes com base no seu nível real.`,
        ephemeral: true,
      });
    }

    if (customId.startsWith('modal_join_set_level')) {
      const raw = interaction.fields.getTextInputValue('gc_level_input');
      const parsed = parseInt(raw?.trim(), 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 21) {
        return interaction.reply({
          content: '⚠️ Nível inválido! Insira um número de **1 a 21** correspondente ao seu nível na Gamers Club.',
          ephemeral: true,
        });
      }

      this.setPlayerProfile(interaction.user.id, {
        level: parsed,
        username: interaction.user.username,
      });

      const mix = this.resolveMixFromInteraction(interaction, customId);
      const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';

      if (!mix) {
        return interaction.reply({
          content: `✅ Seu nível GC foi salvo como **Lvl ${parsed}** (\`${badge}\`) no seu perfil com sucesso!`,
          ephemeral: true,
        });
      }

      mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
      const existingPlayer = mix.players.find((pl) => pl.id === interaction.user.id);
      const existingWaiter = mix.waitlist.find((pl) => pl.id === interaction.user.id);
      if (existingPlayer || existingWaiter) {
        if (existingPlayer) existingPlayer.level = parsed;
        if (existingWaiter) existingWaiter.level = parsed;
        this.recomputeTeamAverages(mix, interaction.user.id, parsed);
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
        return interaction.reply({
          content: `✅ Seu nível GC foi salvo como **Lvl ${parsed}** (\`${badge}\`) e atualizado no seu slot do Mix!`,
          ephemeral: true,
        });
      }

      if (mix.players.length >= 10 && mix.waitlist.length >= 3) {
        return interaction.reply({
          content: `✅ Nível GC **Lvl ${parsed}** (\`${badge}\`) salvo com sucesso no seu perfil! Porém, o lobby (10/10) e a Fila de Reserva (3/3) já estão lotados!`,
          ephemeral: true,
        });
      }

      const newEntry = {
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ dynamic: true }),
        level: parsed,
        ready: true,
      };

      if (mix.players.length >= 10) {
        mix.waitlist.push(newEntry);
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
        if (mix.lobbyMessageId && interaction.channel?.messages) {
          const embed = mix.phase === 'ready_check' ? this.buildReadyCheckEmbed(mix) : this.buildLobbyEmbed(mix);
          const components = mix.phase === 'ready_check' ? this.buildReadyCheckButtons(mix) : this.buildLobbyButtons(mix);
          const msg = await interaction.channel.messages.fetch(mix.lobbyMessageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components }).catch(() => {});
        }
        return interaction.reply({
          content: `✅ Nível GC salvo como **Lvl ${parsed}** (\`${badge}\`) e você entrou na **Fila de Reserva (Suplente #${mix.waitlist.length}/3)**! Se alguém sair ou ficar AFK no check-in, você assume a vaga automaticamente.`,
          ephemeral: true,
        });
      }

      mix.players.push(newEntry);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);

      if (mix.players.length === 8 || mix.players.length === 9) {
        this.notifyMissingSlots(mix, interaction.guild, interaction.channel).catch(() => {});
      }

      if (mix.players.length === 10) {
        this.startReadyCheck(mix, interaction.channel);
        const embed = this.buildReadyCheckEmbed(mix);
        const components = this.buildReadyCheckButtons(mix);
        if (mix.lobbyMessageId && interaction.channel?.messages) {
          const msg = await interaction.channel.messages.fetch(mix.lobbyMessageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components }).catch(() => {});
        }
        return interaction.reply({
          content: `✅ Nível GC salvo como **Lvl ${parsed}** (\`${badge}\`) e você entrou no Mix! 🎯 O lobby atingiu **10/10 jogadores**!`,
          ephemeral: true,
        });
      }

      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      if (mix.lobbyMessageId && interaction.channel?.messages) {
        const msg = await interaction.channel.messages.fetch(mix.lobbyMessageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [embed], components }).catch(() => {});
      }

      return interaction.reply({
        content: `✅ Nível GC salvo como **Lvl ${parsed}** (\`${badge}\`) e você acabou de entrar no Mix! 🎯 Vaga confirmada (${mix.players.length}/10).`,
        ephemeral: true,
      });
    }

    if (customId.startsWith('modal_match_result')) {
      const winner = interaction.fields.getTextInputValue('winner_input');
      const score = interaction.fields.getTextInputValue('score_input');
      let map = '';
      try {
        map = interaction.fields.getTextInputValue('map_input') || '';
      } catch (_) {}
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal.', ephemeral: true });
      }
      const result = await this.recordMatchResult(mix, winner, score, interaction.user, interaction.channel, map);
      if (!result.success) {
        return interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
      }
      return interaction.reply({ embeds: result.embeds, components: result.components });
    }

    if (customId.startsWith('modal_mix_sub')) {
      const outNick = interaction.fields.getTextInputValue('sub_out');
      const inNick = interaction.fields.getTextInputValue('sub_in');
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal.', ephemeral: true });
      }
      const res = await this.executeSubstitute(mix, outNick, inNick, interaction.guild, interaction.channel);
      return interaction.reply({ content: res.message, ephemeral: !res.success });
    }

    if (customId.startsWith('modal_set_ip')) {
      const rawIp = interaction.fields.getTextInputValue('server_ip_input');
      const parsed = parseServerConnect(rawIp);

      if (!parsed.valid) {
        return interaction.reply({
          content: `⚠️ ${parsed.error || 'Formato de IP inválido!'} Use o formato \`ip:porta\` (ex: \`177.54.152.82:27015\` ou \`connect 177.54.152.82:27015; password mix\`).`,
          ephemeral: true,
        });
      }

      const mix = this.resolveMixFromInteraction(interaction, customId);

      if (mix) {
        mix.serverIp = parsed.normalized;
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
      }
      this.config.serverConnect = parsed.normalized;
      this.saveConfig({ serverConnect: parsed.normalized });

      const connectUrl = this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(parsed.normalized)}`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🚀 Conectar Direto no CS2')
          .setStyle(ButtonStyle.Link)
          .setURL(connectUrl)
      );

      return interaction.reply({
        content:
          `✅ **IP do Servidor CS2 Definido com Sucesso por <@${interaction.user.id}>!**\n\n` +
          `🌐 **Endereço:** \`${parsed.consoleCommand}\`\n\n` +
          `Clique no botão abaixo ou use o console do CS2 (\`~\`) para entrar no servidor!`,
        components: [row],
      });
    }
  }

  async cmdMatchResult(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal para registrar vitória.', ephemeral: true });
    }
    const winner = interaction.options.getString('time');
    const score = interaction.options.getString('placar') || '13-9';
    const map = interaction.options.getString('mapa') || '';
    const res = await this.recordMatchResult(mix, winner, score, interaction.user, interaction.channel, map);
    if (!res.success) {
      return interaction.reply({ content: `⚠️ ${res.error}`, ephemeral: true });
    }
    return interaction.reply({ embeds: res.embeds, components: res.components });
  }

  async cmdSubstitute(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal para fazer substituição.', ephemeral: true });
    }
    const newUser = interaction.options.getUser('novo');
    const oldUser = interaction.options.getUser('antigo') || interaction.user;
    const res = await this.executeSubstitute(mix, oldUser.id, newUser.id, interaction.guild, interaction.channel);
    return interaction.reply({ content: res.message, ephemeral: !res.success });
  }

  async cmdToggleRole(interaction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({ content: '⚠️ Este comando só pode ser usado em um servidor.', ephemeral: true });
    }
    const res = await this.toggleMixRole(interaction.guild, interaction.member);
    return interaction.reply({ content: res.message, ephemeral: true });
  }

  async cmdCalls(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '⚠️ Este comando só pode ser usado em um servidor.', ephemeral: true });
    }

    const timeA = interaction.options.getChannel('time_a');
    const timeB = interaction.options.getChannel('time_b');
    const lobby = interaction.options.getChannel('lobby');

    if (timeA || timeB || lobby) {
      if (!this.config.guildVoiceChannels) this.config.guildVoiceChannels = {};
      const current = this.config.guildVoiceChannels[interaction.guildId] || {};
      if (timeA) current.teamAVoiceId = timeA.id;
      if (timeB) current.teamBVoiceId = timeB.id;
      if (lobby) current.lobbyVoiceId = lobby.id;
      this.config.guildVoiceChannels[interaction.guildId] = current;
      this.saveConfig({ guildVoiceChannels: this.config.guildVoiceChannels });

      return interaction.reply({
        content: `✅ **Canais de voz configurados para este servidor:**\n` +
          `• **Time A:** ${current.teamAVoiceId ? `<#${current.teamAVoiceId}>` : '*Não alterado*'}\n` +
          `• **Time B:** ${current.teamBVoiceId ? `<#${current.teamBVoiceId}>` : '*Não alterado*'}\n` +
          `• **Lobby Geral:** ${current.lobbyVoiceId ? `<#${current.lobbyVoiceId}>` : '*Não alterado*'}\n\n` +
          `Os sorteios e o botão **[📞 Mover para Calls]** usarão estes canais automaticamente!`,
        ephemeral: false,
      });
    }

    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (mix && (mix.teamA?.players?.length > 0 || mix.teamB?.players?.length > 0)) {
      await interaction.deferReply();
      const res = await this.executeVoiceMover(interaction.guild, mix, interaction.channel);
      return interaction.editReply({ content: res.message });
    }

    await interaction.deferReply({ ephemeral: true });
    const resolved = await this.resolveVoiceChannelsForGuild(interaction.guild, interaction.channel);
    if (!resolved || !resolved.channelA || !resolved.channelB) {
      return interaction.editReply({
        content: `⚠️ Não foi possível encontrar ou criar as calls no servidor. Verifique se o bot tem permissão de **Gerenciar Canais**.`,
      });
    }

    return interaction.editReply({
      content: `📞 **Canais de Voz Oficiais do Servidor:**\n` +
        `• **Time A:** <#${resolved.channelA.id}>\n` +
        `• **Time B:** <#${resolved.channelB.id}>\n\n` +
        `✅ As calls estão 100% configuradas e prontas para receber os jogadores nos mixes!`,
    });
  }

  async cmdSetLevel(interaction) {
    const parsed = interaction.options.getInteger('nivel');
    if (!parsed || parsed < 1 || parsed > 21) {
      const current = this.getPlayerLevel(interaction.user.id);
      return interaction.reply({
        content: `ℹ️ Seu nível atual da Gamers Club é **Lvl ${current || 16}**.\nPara alterar, use: \`/level nivel: 19\`.`,
        ephemeral: true,
      });
    }

    this.setPlayerProfile(interaction.user.id, {
      level: parsed,
      username: interaction.user.username,
    });

    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (mix) {
      let changed = false;
      const p = (mix.players || []).find((pl) => pl.id === interaction.user.id);
      if (p) { p.level = parsed; changed = true; }
      const w = (mix.waitlist || []).find((pl) => pl.id === interaction.user.id);
      if (w) { w.level = parsed; changed = true; }
      if (changed) {
        this.recomputeTeamAverages(mix, interaction.user.id, parsed);
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
      }
    }

    const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';
    return interaction.reply({
      content: `✅ Seu nível da Gamers Club foi salvo com sucesso como **Lvl ${parsed}** (\`${badge}\`)! O sorteio de times será balanceado com base no seu nível.`,
      ephemeral: true,
    });
  }

  async cmdCreateMix(interaction) {
    try {
      const name = interaction.options.getString('nome') || `Mix 5v5 de ${interaction.user.username}`;
      const format = interaction.options.getString('formato') || 'MD1';
      const mix = this.getOrCreateMix(interaction.channelId, interaction.user, { name, format });

      if (mix.players.length === 0 && this.hasSavedLevel(interaction.user.id)) {
        mix.players.push({
          id: interaction.user.id,
          username: interaction.user.username,
          displayName: interaction.member?.displayName || interaction.user.username,
          avatar: interaction.user.displayAvatarURL({ dynamic: true }),
          level: this.getPlayerLevel(interaction.user.id),
          ready: true,
        });
        this.syncToWebRoom(mix);
      }

      const tutorialEmbed = this.buildMixTutorialEmbed();
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);

      const reply = await interaction.reply({
        content: `🎮 <@${interaction.user.id}> abriu o **Lobby de Mix CS2 5v5**! (${mix.players.length}/10 confirmados)`,
        embeds: [tutorialEmbed, embed],
        components,
        fetchReply: true,
      });
      if (reply) {
        mix.lobbyMessageId = reply.id;
        mix.channelId = interaction.channelId;
      }
      return reply;
    } catch (err) {
      console.error('[DISCORD BOT] Erro em cmdCreateMix:', err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Erro ao criar o mix: ${err.message}`, ephemeral: true });
      }
    }
  }

  async cmdJoinMix(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal. Crie um com `/mix criar`!', ephemeral: true });
    }
    mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];
    const alreadyIn = mix.players.some((p) => p.id === interaction.user.id) || mix.waitlist.some((p) => p.id === interaction.user.id);
    if (alreadyIn) {
      return interaction.reply({ content: '⚠️ Você já está inscrito neste mix (titular ou reserva)!', ephemeral: true });
    }
    if (mix.players.length >= 10 && mix.waitlist.length >= 3) {
      return interaction.reply({ content: '🚫 O lobby (10/10) e a Fila de Reserva (3/3) já estão lotados!', ephemeral: true });
    }

    if (!this.hasSavedLevel(interaction.user.id)) {
      const modal = new ModalBuilder()
        .setCustomId(`modal_join_set_level:${mix.id}`)
        .setTitle('Cadastre seu Nível GC (1 a 21)');

      const levelInput = new TextInputBuilder()
        .setCustomId('gc_level_input')
        .setLabel('Seu Nível Gamers Club (1 a 21)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 16 (ficará salvo no seu perfil)')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);

      const firstActionRow = new ActionRowBuilder().addComponents(levelInput);
      modal.addComponents(firstActionRow);
      return interaction.showModal(modal);
    }

    const newEntry = {
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.username,
      avatar: interaction.user.displayAvatarURL({ dynamic: true }),
      level: this.getPlayerLevel(interaction.user.id),
      ready: true,
    };

    if (mix.players.length >= 10) {
      mix.waitlist.push(newEntry);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      return interaction.reply({
        content: `📋 <@${interaction.user.id}> entrou na **Fila de Reserva (Suplente #${mix.waitlist.length}/3)**! Se alguém sair ou ficar AFK no check-in, você assume a vaga automaticamente.`,
      });
    }

    mix.players.push(newEntry);
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);

    if (mix.players.length === 8 || mix.players.length === 9) {
      this.notifyMissingSlots(mix, interaction.guild, interaction.channel).catch(() => {});
    }

    if (mix.players.length === 10) {
      this.startReadyCheck(mix, interaction.channel);
      const embed = this.buildReadyCheckEmbed(mix);
      const components = this.buildReadyCheckButtons(mix);
      return interaction.reply({ embeds: [embed], components });
    }

    return interaction.reply({ content: `✅ <@${interaction.user.id}> entrou no mix! (${mix.players.length}/10)` });
  }

  async cmdLeaveMix(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    mix.waitlist = Array.isArray(mix.waitlist) ? mix.waitlist : [];

    const waitIdx = mix.waitlist.findIndex((p) => p.id === interaction.user.id);
    if (waitIdx !== -1) {
      mix.waitlist.splice(waitIdx, 1);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      return interaction.reply({ content: `🚪 <@${interaction.user.id}> saiu da Fila de Reserva (${mix.waitlist.length}/3).` });
    }

    const idx = mix.players.findIndex((p) => p.id === interaction.user.id);
    if (idx === -1) return interaction.reply({ content: '⚠️ Você não está no mix.', ephemeral: true });
    mix.players.splice(idx, 1);
    if (mix.readyCheck?.confirmed) {
      mix.readyCheck.confirmed.delete(interaction.user.id);
    }

    let promotedMsg = '';
    if (mix.waitlist.length > 0 && mix.players.length < 10) {
      const nextSub = mix.waitlist.shift();
      mix.players.push(nextSub);
      promotedMsg = `\n🔄 <@${nextSub.id}> foi promovido da **Fila de Reserva** para titular!`;
    }

    if (mix.phase === 'ready_check' && mix.players.length < 10) {
      if (mix.readyCheck?.timer) {
        clearTimeout(mix.readyCheck.timer);
        mix.readyCheck.timer = null;
      }
      mix.readyCheck.active = false;
      mix.phase = 'lobby';
    }

    if (mix.players.length <= 7 && mix.notifiedMissing) {
      mix.notifiedMissing.clear();
    }
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);
    return interaction.reply({ content: `🚪 <@${interaction.user.id}> saiu do mix. (${mix.players.length}/10)${promotedMsg}` });
  }

  async cmdDrawTeams(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    if (mix.players.length < 2) return interaction.reply({ content: '⚠️ Mínimo de 2 jogadores para sortear!', ephemeral: true });

    if (mix.readyCheck?.timer) {
      clearTimeout(mix.readyCheck.timer);
      mix.readyCheck.timer = null;
    }
    if (mix.readyCheck) {
      mix.readyCheck.active = false;
    }

    this.balanceTeams(mix);
    this.updateLobbyInChannels(mix);
    const embed = this.buildTeamsEmbed(mix);
    return interaction.reply({ embeds: [embed], components: [this.buildTeamsActionButtons(mix)] });
  }

  async cmdStartVeto(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    if (mix.teamA.players.length === 0 || mix.teamB.players.length === 0) {
      this.balanceTeams(mix);
    }
    mix.phase = 'veto';
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);
    const embed = this.buildVetoEmbed(mix);
    const components = this.buildVetoButtons(mix);
    return interaction.reply({ embeds: [embed], components });
  }

  async cmdRoulette(interaction) {
    const chosenId = interaction.options?.getString?.('mapa') || null;
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    let drawn;
    let remainingInCycle = null;
    if (chosenId) {
      drawn = OFFICIAL_MAPS.find((m) => m.id === chosenId);
      if (!drawn) return interaction.reply({ content: '⚠️ Mapa inválido.', ephemeral: true });
      if (mix && !this.canChooseMap(mix, interaction.user.id)) {
        return interaction.reply({ content: '🚫 Apenas jogadores do mix, capitães ou o criador podem escolher o mapa.', ephemeral: true });
      }
    } else {
      ({ drawn, remainingInCycle } = this.drawFairMap(interaction.guild?.id || interaction.channelId));
    }

    if (mix) {
      await interaction.reply({
        content: chosenId
          ? `🗺️ Mapa escolhido: ${drawn.emoji} **${drawn.name}**`
          : `🎲 Roleta girada: ${drawn.emoji} **${drawn.name}**`,
      });
      await this.startMatchWithMap(mix, drawn, {
        channel: interaction.channel,
        guild: interaction.guild,
        source: chosenId ? 'escolha' : 'roleta',
        user: interaction.user,
        remainingInCycle,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(chosenId ? '🗺️ MAPA ESCOLHIDO' : '🎲 ROLETA OFICIAL DE MAPAS CS2')
      .setColor(0xf59e0b)
      .setDescription(
        `🗺️ **MAPA:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)!` +
        (remainingInCycle !== null ? `\n♻️ Faltam **${remainingInCycle}** mapa(s) para sair antes de repetir.` : '')
      )
      .setImage(drawn.image)
      .setFooter({ text: 'CS2 Mix Hub • Roleta justa sem repetição' })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  async cmdStatus(interaction) {
    let mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (!mix && this.webRoomsRef && this.webRoomsRef.size > 0) {
      for (const r of this.webRoomsRef.values()) {
        if (r && r.channelId === interaction.channelId && r.phase !== 'finished' && r.phase !== 'cancelled') {
          mix = r;
          break;
        }
      }
    }
    if (!mix) {
      return interaction.reply({ content: 'ℹ️ Nenhum mix ativo neste canal. Crie um com `/mix criar` ou digite `!mix`!', ephemeral: true });
    }
    const payload = this.buildStatusPayloadForMix(mix);
    const reply = await interaction.reply({ ...payload, fetchReply: true });
    if (reply && mix.phase === 'lobby') {
      mix.lobbyMessageId = reply.id;
      mix.channelId = interaction.channelId;
    }
    return reply;
  }

  async cmdCancelMix(interaction) {
    const existing = this.resolveActiveMixForChannel(interaction.channelId);
    if (!existing) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    if (!this.isGuildModerator(interaction.member, interaction.guild, existing, interaction.user?.id)) {
      return interaction.reply({
        content: '🚫 Apenas o **Criador do Mix** ou um **Administrador** pode cancelar este mix.',
        ephemeral: true,
      });
    }
    const mix = this.deleteMix(existing.channelId || interaction.channelId);
    return interaction.reply({ content: `❌ O mix **${mix?.name || existing.name}** foi cancelado com sucesso.` });
  }

  async cmdSendPermanentPanel(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🏆 CS2 MIX HUB • PAINEL OFICIAL DA COMUNIDADE')
      .setDescription(
        `Bem-vindo à central de partidas 5v5 da comunidade!\n\n` +
          `• **Lobbies Automáticos:** Clique em **Criar Mix** ou digite \`!mix\` para abrir uma fila 5v5.\n` +
          `• **Check-in Anti-AFK:** Confirmação em 60 segundos para partidas sem ausentes.\n` +
          `• **Balanceamento Snake-Draft:** Algoritmo competitivo Gamers Club e FACEIT.\n` +
          `• **Pick & Ban:** Veto oficial da Valve com escolha de lados CT/TR.\n` +
          `• **Canais de Voz:** Movimentação automática para calls CT e TR na hora do jogo!\n\n` +
          `*Pressione o botão verde abaixo para iniciar um Mix agora:*`
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Plataforma Competitiva eSports' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('🎮 Criar Mix 5v5')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel_set_level')
        .setLabel('Meu Nível GC')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_live_radar')
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🌐 Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/'))
    );

    await interaction.reply({
      content: '✅ Painel do Mix Hub gerado com sucesso no canal!',
      ephemeral: true,
    });

    return interaction.channel.send({ embeds: [embed], components: [row] });
  }

  async cmdServer(interaction) {
    const input = interaction.options.getString('ip_porta');
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    if (input) {
      if (!this.isGuildModerator(interaction.member, interaction.guild, mix, interaction.user?.id)) {
        return interaction.reply({
          content: '🚫 Apenas administradores do servidor ou o criador do mix podem alterar o IP do servidor.',
          ephemeral: true,
        });
      }
      const parsed = parseServerConnect(input);
      if (!parsed.valid) {
        return interaction.reply({
          content: `⚠️ ${parsed.error || 'Endereço de servidor inválido.'} Use o formato \`ip:porta\` (ex: \`189.1.168.20:27015\` ou \`connect 189.1.168.20:27015; password mix\`).`,
          ephemeral: true,
        });
      }
      this.config.serverConnect = parsed.normalized;
      this.saveConfig({ serverConnect: parsed.normalized });
      if (mix) {
        mix.serverIp = parsed.normalized;
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
      }
      return interaction.reply({
        content: `✅ Servidor CS2 configurado com sucesso para os mixes: \`${parsed.consoleCommand}\``,
      });
    }

    const conn = this.resolveMixDisplayConnect(mix);
    return interaction.reply({
      content: conn
        ? `💻 **Servidor Atual:** \`${conn.normalized}\`\n👉 Para conectar: \`${conn.consoleCommand}\``
        : '⚠️ Nenhum servidor configurado ainda. Use `/servidor ip_porta: 189.1.168.20:27015` para configurar!',
    });
  }

  async cmdRanking(interaction) {
    const embed = this.buildRankingEmbed();
    return interaction.reply({ embeds: [embed] });
  }

  async cmdHistory(interaction) {
    const embed = this.buildMatchHistoryEmbed(6);
    return interaction.reply({ embeds: [embed] });
  }

  async cmdHeadToHead(interaction) {
    const targetUser = interaction.options.getUser('adversario');
    if (!targetUser) {
      return interaction.reply({ content: '⚠️ Selecione um jogador para comparar o confronto direto.', ephemeral: true });
    }
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '😅 Você não pode disputar um X1 contra você mesmo! Escolha outro competidor.', ephemeral: true });
    }
    const embed = this.buildHeadToHeadEmbed(interaction.user, targetUser);
    return interaction.reply({ embeds: [embed] });
  }

  async cmdMapStats(interaction) {
    const embed = this.buildMapStatsEmbed();
    return interaction.reply({ embeds: [embed] });
  }

  async cmdServerStatus(interaction) {
    await interaction.deferReply();
    const mix = this.resolveActiveMixForChannel(interaction.channelId, { includeFinished: true });
    const rawAddress = interaction.options?.getString?.('endereco') || mix?.serverIp || this.config.serverConnect || '';
    if (!String(rawAddress).trim()) {
      return interaction.editReply({
        content: '⚠️ Nenhum servidor CS2 configurado. Use `/servidor ip_porta: 189.1.168.20:27015` ou informe o parâmetro `endereco`.',
      });
    }
    const { hostPort, normalized } = extractHostAndPort(rawAddress);
    if (!hostPort) {
      return interaction.editReply({
        content: '⚠️ Endereço de servidor inválido. Use o formato `ip:porta` (ex: `189.1.168.20:27015`).',
      });
    }
    const displayConnect = normalized || hostPort;
    const res = await queryA2SServer(hostPort, 3000);
    const embed = this.buildServerStatusEmbed(res, hostPort);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Conectar no CS2')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(displayConnect)}`))
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  async cmdGsi(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
    return interaction.reply(this.buildGsiGuidePayload(roomId));
  }

  async cmdLive(interaction) {
    const requester = interaction.user?.username || 'Jogador';
    const targetQuery = interaction.options?.getString('jogador') || null;
    const mix = this.resolveActiveMixForChannel(interaction.channelId);
    const roomId = normalizeRoomId(mix?.id, 'MIX-PRO');
    const embed = this.buildLiveMatchEmbed(requester, targetQuery, false, mix);
    const components = this.buildLiveMatchButtons(this.isGsiOnline(), false, roomId, mix, interaction.channelId);
    await interaction.reply({ embeds: [embed], components });
    const sent = await interaction.fetchReply();
    this.registerLiveTracker(sent, requester, targetQuery, false);
    return sent;
  }
  async cmdHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 GUIA DE COMANDOS • CS2 MIX HUB BOT')
      .setColor(0x38bdf8)
      .setDescription(
        `O bot permite organizar mixes 5v5 completos sem precisar sair do Discord!\n\n` +
          `**Comandos Principais (use com ! ou /):**\n` +
          `• \`!painel\` ou \`/painel\` - Cria o painel fixo da comunidade com botão\n` +
          `• \`!mix\` ou \`/mix criar\` - Inicia uma nova fila de mix 5v5 (suporta Reserva 3/3)\n` +
          `• \`!fila\` ou \`/mix status\` - Exibe o lobby/fase atual do mix do canal\n` +
          `• \`!entrar\` / \`!sair\` - Gerencia sua vaga no lobby ou fila de reserva\n` +
          `• \`!sortear\` - Sorteio snake-draft balanceado por elo (ou use Draft 1v1)\n` +
          `• \`!roleta\` ou \`/roleta\` - Roleta justa de mapas (sem repetir) ou escolha manual\n` +
          `• \`!veto\` - Pick & Ban de mapas oficial com escolha de lados CT/TR\n` +
          `• \`!revanche\` - Inicia revanche com os mesmos 10 jogadores e lados invertidos\n` +
          `• \`!vitoria [A|B] [placar]\` - Registra a vitória no ranking, computa MVP/Bagre (GSI) ou abre votação\n` +
          `• \`!bagre\` ou \`/bagre\` - Ranking de Bagre/MVP automático (GSI) ou votação interativa\n` +
          `• \`!aovivo\` ou \`/aovivo\` - Monitorar Partida ao vivo round a round\n` +
          `• \`!gsi\` ou \`/gsi\` - Instruções e download do arquivo CFG do Valve GSI\n` +
          `• \`!servidor [ip:porta]\` / \`!ip\` - Define ou consulta o IP/senha do servidor CS2\n` +
          `• \`!status-server\` ou \`/status-servidor\` - Consulta ping, mapa e players no servidor CS2\n` +
          `• \`!historico\` / \`!x1\` / \`!mapas\` - Histórico, confronto direto e estatísticas de mapas\n` +
          `• \`!sub [@novo]\` - Substitui jogador ausente (botão interativo ou comando)\n` +
          `• \`!cargo\` - Ativa/desativa notificações de vagas restantes (@Mix CS2)\n` +
          `• \`!ranking\` / \`!stats\` / \`!lvl <1-21>\` - Hall da Fama, perfil e nível GC\n` +
          `• \`!smoke [mapa]\` ou \`/granada\` - Lineups em 10 mapas (Mirage, Inferno, Nuke, Dust2, Ancient, Anubis, Overpass, Train, Cache, Vertigo)\n` +
          `• \`!treino\` / \`!moeda\` - CFG completa de treino e Cara ou Coroa\n` +
          `• \`!steam\` / \`!att\` / \`!pro\` / \`!clip\` / \`!ofertas\` - Scanner Steam, Patches CS2, Agenda Pro e Ofertas`
      )
      .setFooter({ text: 'CS2 Mix Hub • eSports Competitive Engine' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ==========================================
  // HARDWARE DEALS & PROMOTIONS (100% AUTOMATIC)
  // ==========================================

  async getOrCreateDealsChannel(guild) {
    if (!guild) return null;
    try {
      // 1. Explicit configured channel for this guild
      const customId = this.config.dealsChannels?.[guild.id] || (this.config.guildId === guild.id ? this.config.dealsChannelId : null);
      if (customId) {
        const customChannel = guild.channels.cache.get(customId) || await guild.channels.fetch(customId).catch(() => null);
        if (customChannel && customChannel.isTextBased()) return customChannel;
      }

      // 2. Existing text channel with relevant name
      const existing = guild.channels.cache.find((c) =>
        c.isTextBased() &&
        (c.name.includes('ofertas') || c.name.includes('promoc') || c.name.includes('hardware-deals') || c.name.includes('descontos'))
      );
      if (existing) {
        this.config.dealsChannels = this.config.dealsChannels || {};
        this.config.dealsChannels[guild.id] = existing.id;
        this.saveConfig({ dealsChannels: this.config.dealsChannels });
        return existing;
      }

      // 3. Create dedicated clean channel if bot has permission
      const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
      if (me && me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        const created = await guild.channels.create({
          name: '🏷️・ofertas-gamer',
          type: ChannelType.GuildText,
          topic: '🔥 Radar automático de promoções de hardware, periféricos, cadeiras e mesas gamer (KaBuM!, Pichau, TerabyteShop)',
          reason: 'Canal automático para promoções de computadores gamers e setup',
        });
        console.log(`[DISCORD BOT] Canal #${created.name} criado com sucesso no servidor "${guild.name}"!`);

        this.config.dealsChannels = this.config.dealsChannels || {};
        this.config.dealsChannels[guild.id] = created.id;
        this.saveConfig({ dealsChannels: this.config.dealsChannels });
        return created;
      }

      // 4. Fallback to default channel or first text channel
      const fallback =
        guild.channels.cache.get(this.config.defaultChannelId) ||
        guild.channels.cache.find((c) => c.isTextBased() && (c.name.includes('cs') || c.name === 'geral')) ||
        guild.channels.cache.filter((c) => c.isTextBased()).first();

      return fallback || null;
    } catch (e) {
      console.warn(`[DISCORD BOT] Falha ao obter/criar canal de ofertas na guild "${guild.name}":`, e.message);
      return null;
    }
  }

  async dispatchAutomaticDealsDrop(categoryType = 'all') {
    if (this._isDispatchingDeals) return;
    if (!this.client || !this.client.isReady()) return;

    this._isDispatchingDeals = true;
    try {
      let deals = [];
      let title = '🔥 RADAR AUTOMÁTICO • SUPER OFERTAS GAMER';
      let desc = '⚡ **PROMOÇÕES RELÂMPAGO DO DIA!** Oportunidades verificadas em **KaBuM!**, **Pichau** e **TerabyteShop**:';

      if (categoryType === 'cadeira_mesa') {
        const cadeiras = await hardwareDealsManager.getDeals({ category: 'cadeira', limit: 2 });
        const mesas = await hardwareDealsManager.getDeals({ category: 'mesa', limit: 2 });
        deals = [...cadeiras, ...mesas];
        title = '💺🪵 ALERTA DE OFERTAS • CADEIRAS & MESAS GAMER';
        desc = '🛋️ **CONFORTO & ERGONOMIA GAMER!** Cadeiras reclináveis e mesas reforçadas com desconto:';
      } else if (categoryType === 'gpu_cpu') {
        const gpus = await hardwareDealsManager.getDeals({ category: 'gpu', limit: 2 });
        const cpus = await hardwareDealsManager.getDeals({ category: 'cpu', limit: 2 });
        deals = [...gpus, ...cpus];
        title = '🎮⚡ ALERTA DE OFERTAS • PLACAS DE VÍDEO & PROCESSADORES';
        desc = '🚀 **MÁXIMO FPS NO CS2!** As melhores GPUs e processadores Ryzen/Intel com preço reduzido:';
      } else if (categoryType === 'mouse_teclado') {
        const mouses = await hardwareDealsManager.getDeals({ query: 'mouse gamer', limit: 2 });
        const teclados = await hardwareDealsManager.getDeals({ query: 'teclado mecanico', limit: 2 });
        deals = [...mouses, ...teclados];
        title = '🖱️⌨️ ALERTA DE OFERTAS • MOUSES & TECLADOS MECÂNICOS';
        desc = '🎯 **PRECISÃO COMPETITIVA!** Mouses ultraleves e teclados mecânicos em promoção:';
      } else if (categoryType === 'monitor_audio') {
        const monitores = await hardwareDealsManager.getDeals({ category: 'monitor', limit: 2 });
        const audio = await hardwareDealsManager.getDeals({ category: 'audio', limit: 2 });
        deals = [...monitores, ...audio];
        title = '🖥️🎧 ALERTA DE OFERTAS • MONITORES 144Hz-240Hz & HEADSETS';
        desc = '👀 **FLUIDEZ & ÁUDIO ESPACIAL!** Veja inimigos primeiro e escute passos com precisão:';
      } else if (categoryType === 'ram_ssd') {
        deals = await hardwareDealsManager.getDeals({ category: 'ram_ssd', limit: 4 });
        title = '🚀🛡️ ALERTA DE OFERTAS • MEMÓRIAS RAM & SSDs NVMe';
        desc = '⚡ **VELOCIDADE TOTAL!** Carregamento instantâneo de mapas e zero stuttering:';
      } else {
        deals = await hardwareDealsManager.getDeals({ limit: 4 });
        title = '🔥 RADAR AUTOMÁTICO • SUPER OFERTAS PC GAMER';
        desc = '⚡ **PROMOÇÕES RELÂMPAGO DO DIA!** Peças selecionadas com maiores descontos nas lojas confiáveis:';
      }

      if (!deals || deals.length === 0) return;

      const embed = hardwareDealsManager.buildDealsEmbed(deals, { title, description: desc });
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals);

      for (const [, guild] of this.client.guilds.cache) {
        try {
          const channel = await this.getOrCreateDealsChannel(guild);
          if (!channel) continue;
          await channel.send({ embeds: [embed], components: [selectMenu, ...actionButtons] }).catch(() => {});
          console.log(`[DISCORD BOT] 🏷️ Ofertas automáticas (${categoryType}) postadas no canal #${channel.name} (${guild.name})!`);
        } catch (err) {
          console.warn(`[DISCORD BOT] Erro ao postar ofertas na guild "${guild.name}":`, err.message);
        }
      }
      this.saveConfig({ lastDealsDropAt: Date.now() });
    } finally {
      this._isDispatchingDeals = false;
    }
  }

  startScheduledDealsMonitor() {
    if (this.dealsMonitorInterval) clearInterval(this.dealsMonitorInterval);
    if (this._initialDealsTimeout) clearTimeout(this._initialDealsTimeout);

    // Initial drop only if more than 45 minutes have passed since last drop (prevents duplicate spam on restarts)
    const elapsedSinceLastDrop = Date.now() - (Number(this.config.lastDealsDropAt) || 0);
    if (elapsedSinceLastDrop > 45 * 60 * 1000) {
      this._initialDealsTimeout = setTimeout(() => {
        this.dispatchAutomaticDealsDrop('all').catch((err) => {
          console.warn('[DISCORD BOT] Aviso no drop inicial de ofertas:', err.message);
        });
      }, 8000);
      this._initialDealsTimeout.unref?.();
    }

    // Rotating categories across cycles
    const categoryRotation = ['cadeira_mesa', 'gpu_cpu', 'mouse_teclado', 'monitor_audio', 'ram_ssd', 'all'];
    let rotationIndex = 0;

    // Check and post automatically every 60 minutes
    const intervalMs = (this.config.dealsIntervalMinutes || 60) * 60 * 1000;
    this.dealsMonitorInterval = setInterval(async () => {
      try {
        if (!this.client || !this.client.isReady()) return;
        if (this.config.autoPostDeals === false) return;

        const currentCat = categoryRotation[rotationIndex % categoryRotation.length];
        rotationIndex++;

        await this.dispatchAutomaticDealsDrop(currentCat);

      } catch (err) {
        console.warn('[DISCORD BOT] Erro ao disparar alertas de ofertas:', err.message);
      }
    }, intervalMs);
    this.dealsMonitorInterval.unref?.();
  }

  async prefixDeals(message, args = []) {
    const sub = (args[0] || '').toLowerCase();

    // 1. Configure deals channel: !ofertas canal #promocoes
    if (sub === 'canal' || sub === 'channel') {
      if (!this.isGuildModerator(message.member, message.guild, null, message.author?.id)) {
        return message.reply('🚫 Apenas administradores do servidor podem configurar o canal de promoções.');
      }
      const mentionedChannel = message.mentions.channels.first();
      const channelId = mentionedChannel ? mentionedChannel.id : (args[1] || message.channelId);
      if (!isSnowflake(channelId)) {
        return message.reply('⚠️ Canal inválido. Mencione um canal válido como `#promocoes`.');
      }
      this.config.dealsChannels = this.config.dealsChannels || {};
      if (message.guild?.id) {
        this.config.dealsChannels[message.guild.id] = channelId;
      }
      this.config.dealsChannelId = channelId;
      this.config.autoPostDeals = true;
      this.saveConfig({ dealsChannels: this.config.dealsChannels, dealsChannelId: channelId, autoPostDeals: true });
      return message.reply(`✅ Canal de alertas de promoções configurado com sucesso para: <#${channelId}>! O bot publicará alertas diários de hardware.`);
    }

    // 2. Force post deals to channel: !ofertas postar
    if (sub === 'postar' || sub === 'alerta') {
      if (!this.isGuildModerator(message.member, message.guild, null, message.author?.id)) {
        return message.reply('🚫 Apenas administradores do servidor podem forçar o disparo de promoções.');
      }
      await this.dispatchAutomaticDealsDrop('all');
      return message.reply(`🚀 Alerta de ofertas postado automaticamente em todos os canais configurados!`);
    }

    // 3. Search query: !ofertas rtx 4060
    if (args.length > 0) {
      const query = args.join(' ');
      const deals = await hardwareDealsManager.getDeals({ query, limit: 5 });
      const embed = hardwareDealsManager.buildDealsEmbed(deals, {
        title: `🔍 BUSCA DE HARDWARE: "${query.toUpperCase()}"`,
        description: `Resultados encontrados nas lojas oficiais parceiras (**KaBuM!**, **Pichau**, **TerabyteShop**):`,
      });
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals, { query });
      return message.reply({ embeds: [embed], components: [selectMenu, ...actionButtons] });
    }

    // 4. Default hot deals
    const deals = await hardwareDealsManager.getDeals({ limit: 5 });
    const embed = hardwareDealsManager.buildDealsEmbed(deals);
    const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
    const actionButtons = hardwareDealsManager.buildActionButtons(deals);
    return message.reply({ embeds: [embed], components: [selectMenu, ...actionButtons] });
  }

  async cmdDeals(interaction) {
    await interaction.deferReply();
    const query = interaction.options?.getString('busca');
    const category = interaction.options?.getString('categoria');
    const store = interaction.options?.getString('loja');

    const deals = await hardwareDealsManager.getDeals({ query, category, store, limit: 5 });
    const title = query
      ? `🔍 BUSCA DE HARDWARE: "${query.toUpperCase()}"`
      : category
      ? `🔥 OFERTAS DE HARDWARE • ${category.toUpperCase()}`
      : undefined;

    const embed = hardwareDealsManager.buildDealsEmbed(deals, { title });
    const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
    const actionButtons = hardwareDealsManager.buildActionButtons(deals, { query, category });

    return interaction.editReply({ embeds: [embed], components: [selectMenu, ...actionButtons] });
  }

  async cmdHardwareAlerts(interaction) {
    if (!this.isGuildModerator(interaction.member, interaction.guild, null, interaction.user?.id)) {
      return interaction.reply({ content: '🚫 Apenas administradores do servidor podem configurar alertas.', ephemeral: true });
    }
    const channel = interaction.options?.getChannel('canal');
    const activate = interaction.options?.getBoolean('ativar') ?? true;

    if (!channel) {
      return interaction.reply({ content: '⚠️ Canal inválido.', ephemeral: true });
    }

    this.config.dealsChannels = this.config.dealsChannels || {};
    if (interaction.guildId) {
      this.config.dealsChannels[interaction.guildId] = channel.id;
    }
    this.config.dealsChannelId = channel.id;
    this.config.autoPostDeals = activate;
    this.saveConfig({ dealsChannels: this.config.dealsChannels, dealsChannelId: channel.id, autoPostDeals: activate });

    return interaction.reply({
      content: activate
        ? `🔔 **Alertas de Promoções Ativados!** As melhores ofertas de hardware de **KaBuM!**, **Pichau** e **TerabyteShop** serão postadas automaticamente em <#${channel.id}>!`
        : `🔕 Alertas automáticos de promoções foram desativados.`,
    });
  }

  // ==========================================
  // STEAM SCANNER & ANTI-SMURF
  // ==========================================

  async prefixSteam(message, input) {
    if (!input || !input.trim()) {
      return message.reply('⚠️ Forneça o link ou ID da conta Steam! Exemplo: `!steam gaules` ou `!steam 76561198012345678`');
    }
    try {
      const scanData = await SteamScannerService.scanProfile(input.trim());
      const { embeds, components } = SteamScannerService.buildEmbed(scanData);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ ${err.message}`);
    }
  }

  async cmdSteam(interaction) {
    await interaction.deferReply();
    const input = interaction.options.getString('perfil');
    try {
      const scanData = await SteamScannerService.scanProfile(input.trim());
      const { embeds, components } = SteamScannerService.buildEmbed(scanData);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `❌ ${err.message}` });
    }
  }

  // ==========================================
  // CS2 VALVE PATCH NOTES & UPDATE RADAR
  // ==========================================

  async resolveGeneralChatChannel(guild) {
    if (!guild) return null;
    try {
      const customId = this.config.patchNotesChannels?.[guild.id] || this.config.defaultChannelId;
      if (customId) {
        const ch = guild.channels.cache.get(customId) || (await guild.channels.fetch(customId).catch(() => null));
        if (ch && ch.isTextBased()) return ch;
      }

      if (guild.channels.cache.size === 0) {
        await guild.channels.fetch().catch(() => {});
      }

      const textChannels = guild.channels.cache.filter(
        (c) =>
          c &&
          c.type === ChannelType.GuildText &&
          !/oferta|promoc|desconto|regra|aviso|log/i.test(c.name || '')
      );

      // Prioridade 1: Canal chamado 'geral', 'chat-geral', 'bate-papo', 'chat', 'principal'
      const generalCh =
        textChannels.find((c) => /^(chat[-_]?geral|geral|bate[-_]?papo|chat|principal)$/i.test(c.name.replace(/^[^a-zA-Z0-9]+/, ''))) ||
        textChannels.find((c) => /geral|bate[-_]?papo|principal/i.test(c.name)) ||
        textChannels.find((c) => /cs2|mix|lobby/i.test(c.name));

      if (generalCh) return generalCh;

      if (guild.systemChannel && guild.systemChannel.isTextBased()) {
        return guild.systemChannel;
      }

      return textChannels.first() || null;
    } catch (e) {
      return null;
    }
  }

  async checkAndDispatchCs2Updates(forcePost = false) {
    if (this._isCheckingCs2Updates) return false;
    this._isCheckingCs2Updates = true;
    try {
      if (!this.client || !this.client.isReady()) return false;
      const patch = await cs2NewsRadar.fetchLatestPatch();
      if (!patch || !patch.gid) return false;

      if (!forcePost && !patch.isNew) {
        if (patch.isFirstBoot) {
          cs2NewsRadar.saveState(patch.gid);
        }
        return false;
      }

      cs2NewsRadar.saveState(patch.gid);
      const { embeds, components } = cs2NewsRadar.buildEmbed(patch);

      for (const [, guild] of this.client.guilds.cache) {
        const channel = await this.resolveGeneralChatChannel(guild);
        if (channel) {
          await channel
            .send({
              content: `\ud83d\udea8 \ud83c\udfae **NOVA ATUALIZA\u00c7\u00c3O OFICIAL DO COUNTER-STRIKE 2 LAN\u00c7ADA PELA VALVE!**\nConfira abaixo todos os detalhes traduzidos para Portugu\u00eas (PT-BR):`,
              embeds,
              components,
            })
            .catch((e) => console.warn(`[CS2 NEWS] Falha ao enviar no canal #${channel.name}:`, e.message));
        }
      }
      return true;
    } catch (err) {
      console.warn('[CS2 NEWS MONITOR] Aviso:', err.message);
      return false;
    } finally {
      this._isCheckingCs2Updates = false;
    }
  }

  startCs2UpdateRadarMonitor() {
    if (this.cs2UpdateRadarInterval) clearInterval(this.cs2UpdateRadarInterval);
    if (this._initialUpdatesTimeout) clearTimeout(this._initialUpdatesTimeout);

    this._initialUpdatesTimeout = setTimeout(() => {
      this.checkAndDispatchCs2Updates(false).catch(() => {});
    }, 12000);
    this._initialUpdatesTimeout.unref?.();

    // Verifica na API Oficial da Valve a cada 10 minutos
    this.cs2UpdateRadarInterval = setInterval(() => {
      this.checkAndDispatchCs2Updates(false).catch(() => {});
    }, 10 * 60 * 1000);
    this.cs2UpdateRadarInterval.unref?.();
  }

  async prefixPatchNotes(message) {
    try {
      const rawText = (message.content || '').trim();
      const parts = rawText.split(/\s+/);
      const sub = (parts[1] || '').toLowerCase();

      if (sub === 'canal' || sub === 'channel') {
        if (!this.isGuildModerator(message.member, message.guild, null, message.author?.id)) {
          return message.reply('🚫 Apenas administradores do servidor podem configurar o canal de atualizações.');
        }
        const mentioned = message.mentions.channels.first();
        const targetCh = mentioned || message.channel;
        this.config.patchNotesChannels = this.config.patchNotesChannels || {};
        if (message.guild?.id) {
          this.config.patchNotesChannels[message.guild.id] = targetCh.id;
          this.saveConfig({ patchNotesChannels: this.config.patchNotesChannels });
        }
        return message.reply(
          `\u2705 Canal de atualiza\u00e7\u00f5es autom\u00e1ticas do CS2 definido para <#${targetCh.id}>! Assim que a Valve lan\u00e7ar qualquer update novo, o bot postar\u00e1 traduzido aqui.`
        );
      }

      if (sub === 'postar' || sub === 'geral' || sub === 'testar') {
        if (!this.isGuildModerator(message.member, message.guild, null, message.author?.id)) {
          return message.reply('🚫 Apenas administradores do servidor podem forçar o envio de atualizações.');
        }
        await this.checkAndDispatchCs2Updates(true);
        const ch = await this.resolveGeneralChatChannel(message.guild);
        return message.reply(
          `\ud83d\udce2 A \u00faltima atualiza\u00e7\u00e3o oficial da Valve traduzida para PT-BR foi publicada no canal ${ch ? `<#${ch.id}>` : 'Geral'}!`
        );
      }

      const patchData = await cs2NewsRadar.fetchLatestPatch();
      if (!patchData) return message.reply('\u26a0\ufe0f Nenhuma nota de atualiza\u00e7\u00e3o recente encontrada.');
      if (patchData.isFirstBoot && patchData.gid) {
        cs2NewsRadar.saveState(patchData.gid);
      }
      const { embeds, components } = cs2NewsRadar.buildEmbed(patchData);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`\u274c Erro ao consultar notas de atualiza\u00e7\u00e3o: ${err.message}`);
    }
  }

  async cmdPatchNotes(interaction) {
    await interaction.deferReply();
    try {
      const patchData = await cs2NewsRadar.fetchLatestPatch();
      if (!patchData) return interaction.editReply({ content: '\u26a0\ufe0f Nenhuma nota de atualiza\u00e7\u00e3o recente encontrada.' });
      if (patchData.isFirstBoot && patchData.gid) {
        cs2NewsRadar.saveState(patchData.gid);
      }
      const { embeds, components } = cs2NewsRadar.buildEmbed(patchData);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `\u274c Erro ao consultar notas de atualiza\u00e7\u00e3o: ${err.message}` });
    }
  }

  // ==========================================
  // PRO MATCHES & HLTV BR ESPORTS AGENDA
  // ==========================================
  async prefixProMatches(message) {
    try {
      const matches = await proMatchesAgenda.getUpcomingMatches();
      const { embeds, components } = proMatchesAgenda.buildEmbed(matches);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ Erro ao consultar agenda de jogos pro: ${err.message}`);
    }
  }

  async cmdProMatches(interaction) {
    await interaction.deferReply();
    try {
      const matches = await proMatchesAgenda.getUpcomingMatches();
      const { embeds, components } = proMatchesAgenda.buildEmbed(matches);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `❌ Erro ao consultar agenda: ${err.message}` });
    }
  }

  // ==========================================
  // "BAGRE DA PARTIDA" / ANTI-MVP HUMOR VOTE
  // ==========================================

  async prefixBagre(message) {
    const mix = this.resolveActiveMixForChannel(message.channelId, { includeFinished: true });
    const embed = mix ? this.buildAutoBagreAndMvpEmbed(mix) : null;
    if (embed) {
      return message.reply({ embeds: [embed] });
    }
    const candidateCount = mix
      ? (mix.players?.length || ((mix.teamA?.players?.length || 0) + (mix.teamB?.players?.length || 0)))
      : 0;
    if (mix && candidateCount >= 2) {
      const voteEmbed = bagreVoteService.buildVoteEmbed(mix);
      const components = bagreVoteService.buildVoteMenu(mix);
      if (voteEmbed) {
        return message.reply({ embeds: [voteEmbed], components });
      }
    }
    return message.reply('⚠️ Nenhum mix com estatísticas do CS2 ou jogadores suficientes neste canal. Abra um mix com `!mix` ou ative o Valve GSI (`/gsi`)!');
  }

  async cmdBagre(interaction) {
    const mix = this.resolveActiveMixForChannel(interaction.channelId, { includeFinished: true });
    const embed = mix ? this.buildAutoBagreAndMvpEmbed(mix) : null;
    if (embed) {
      return interaction.reply({ embeds: [embed] });
    }
    const candidateCount = mix
      ? (mix.players?.length || ((mix.teamA?.players?.length || 0) + (mix.teamB?.players?.length || 0)))
      : 0;
    if (mix && candidateCount >= 2) {
      const voteEmbed = bagreVoteService.buildVoteEmbed(mix);
      const components = bagreVoteService.buildVoteMenu(mix);
      if (voteEmbed) {
        return interaction.reply({ embeds: [voteEmbed], components });
      }
    }
    return interaction.reply({
      content: '⚠️ Nenhum mix com estatísticas do CS2 ou jogadores suficientes neste canal. Abra um mix com `/mix criar` ou ative o Valve GSI (`/gsi`)!',
      ephemeral: true,
    });
  }

  buildAutoBagreAndMvpEmbed(mix) {
    const gsiState = this.resolveGsiSnapshotForMix(mix, { allowConsumedForSameMix: true });
    if (!gsiState) return null;
    const scoreA = Number(gsiState?.scoreCT || 0) || 0;
    const scoreB = Number(gsiState?.scoreTR || 0) || 0;
    const dummyRecord = {
      winnerPlayers: mix?.teamA?.players || mix?.players?.slice(0, 5) || [],
      loserPlayers: mix?.teamB?.players || mix?.players?.slice(5, 10) || [],
      scoreWinner: Math.max(scoreA, scoreB),
      scoreLoser: Math.min(scoreA, scoreB),
    };

    const { mvp, bagre, evaluatedPlayers, hasRealGsiStats } = computeMatchPerformers(dummyRecord, gsiState);
    if (!hasRealGsiStats || (!mvp && !bagre)) return null;

    const quote = bagreVoteService.getRandomQuote();
    const mvpTag = mvp ? (isSnowflake(mvp.id) ? `<@${mvp.id}>` : `**${mvp.nick}**`) : 'N/A';
    const bagreTag = bagre ? (isSnowflake(bagre.id) ? `<@${bagre.id}>` : `**${bagre.nick}**`) : 'N/A';

    const lines = (evaluatedPlayers || []).slice(0, 10).map((ep, i) => {
      const icon = i === 0 ? '\ud83d\udc51' : (bagre && ep.id === bagre.id ? '\ud83d\udc1f' : `**${i + 1}.**`);
      const tag = isSnowflake(ep.id) ? `<@${ep.id}>` : `**${ep.nick}**`;
      return `${icon} ${tag} \u2014 \ud83c\udfaf **${ep.kills}/${ep.deaths}/${ep.assists}** \u2022 K/D \`${ep.kd}\` \u2022 \u2b50 \`${ep.mvps}\` \u2022 Rating **\`${ep.rating}\`**`;
    }).join('\n');

    return new EmbedBuilder()
      .setTitle(`\ud83d\udcca MVP & BAGRE AUTOM\u00c1TICO (CS2 STATS)`)
      .setColor(0xf59e0b)
      .setDescription(
        `Apura\u00e7\u00e3o **100% autom\u00e1tica** baseada nas estat\u00edsticas reais da partida (\ud83d\udfe2 **Dados Reais do CS2 via GSI**):\n\n` +
        `\ud83d\udc51 **MVP DA PARTIDA:** ${mvpTag}\n` +
        (mvp ? `└ \ud83c\udfaf **${mvp.kills} Kills** \u2022 \ud83d\udc80 **${mvp.deaths} Mortes** \u2022 K/D **${mvp.kd}** \u2022 \u2b50 **${mvp.mvps} MVPs** \u2022 Rating **${mvp.rating}**\n\n` : '\n') +
        `\ud83d\udc1f **BAGRE DO MIX:** ${bagreTag}\n` +
        (bagre ? `└ \ud83c\udfaf **${bagre.kills} Kills** \u2022 \ud83d\udc80 **${bagre.deaths} Mortes** \u2022 K/D **${bagre.kd}** \u2022 Rating **${bagre.rating}**\n*${quote}*` : '')
      )
      .addFields({
        name: '\ud83d\udccb Classifica\u00e7\u00e3o Geral de Desempenho na Partida',
        value: lines || '*Sem estat\u00edsticas registradas*',
        inline: false,
      })
      .setFooter({ text: 'CS2 Mix Hub \u2022 Definido 100% pelas estat\u00edsticas reais do CS2!' })
      .setTimestamp();
  }
  async prefixFreeGames(message) {
    try {
      const data = await freeGamesRadar.getAllFreeGames();
      const { embeds, components } = freeGamesRadar.buildEmbed(data);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ Erro ao consultar jogos gratuitos: ${err.message}`);
    }
  }

  async cmdFreeGames(interaction) {
    await interaction.deferReply();
    try {
      const data = await freeGamesRadar.getAllFreeGames();
      const { embeds, components } = freeGamesRadar.buildEmbed(data);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `❌ Erro ao consultar jogos gratuitos: ${err.message}` });
    }
  }

  // ==========================================
  // COMMUNITY CLIPS & HIGHLIGHTS SHOWCASE
  // ==========================================

  async prefixClip(message, args) {
    const url = args[0];
    const title = args.slice(1).join(' ');
    if (!url || !/^https?:\/\//i.test(url)) {
      return message.reply('⚠️ Envie um link válido de clipe! Ex: `!clip https://medal.tv/... Ace de AWP na B`');
    }
    try {
      const clip = communityClips.submitClip(message.author, url, title);
      const { embeds, components } = communityClips.buildEmbed(clip);
      return message.channel.send({
        content: `🎥 **Novo clipe da comunidade enviado por <@${message.author.id}>!**`,
        embeds,
        components,
      });
    } catch (err) {
      return message.reply(`❌ ${err.message}`);
    }
  }

  async cmdClip(interaction) {
    const url = interaction.options.getString('link');
    const title = interaction.options.getString('titulo') || '';
    try {
      const clip = communityClips.submitClip(interaction.user, url, title);
      const { embeds, components } = communityClips.buildEmbed(clip);
      return interaction.reply({
        content: `🎥 **Novo clipe da comunidade enviado por <@${interaction.user.id}>!**`,
        embeds,
        components,
      });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  }

// Singleton Export
export const discordBotManager = new DiscordBotManager();
