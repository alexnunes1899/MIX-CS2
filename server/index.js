import { registerMatchAutomationRoutes } from './matchAutomation.js';
import express from 'express';
import http from 'http';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLiveOfficialRotation, getCurrentRotationState, ALL_MAPS_CATALOGUE } from './mapSync.js';
import { getGrenadesState, syncGrenadesPtBr, loadSavedGrenades } from './grenadeSync.js';
import { executeRconCommand } from './rcon.js';
import {
  handleGsiPayload,
  getGsiState,
  setGsiState,
  generateGsiConfig,
  generateGsiBatchInstaller,
  generateGsiPowerShellInstaller,
  installGsiLocally,
  checkGsiInstalled,
} from './gsi.js';
import { getSteamPlayerDetails } from './steamApi.js';
import { fetchFaceitPlayer } from './faceit.js';
import { sendDiscordWebhook, isValidDiscordWebhookUrl } from './discordWebhook.js';
import { getLeaderboard, recordMatch } from './leaderboard.js';
import { pingCs2Server } from './serverQuery.js';
import { moveGuildMember, testDiscordBotVoiceChannels } from './discordVoiceMover.js';
import { discordBotManager } from './discordBot.js';
import {
  getMatchHistoryState,
  recordMatchHistoryEntry,
  computeMatchMvp,
  computeMatchPerformers,
  determineMatchWinner,
  onMatchHistoryUpdated,
  getMapImageUrl,
  normalizeMapName,
} from './matchHistory.js';
import { hardwareDealsManager } from './hardwareDeals.js';
import { SteamScannerService } from './steamScanner.js';
import { cs2NewsRadar } from './cs2NewsRadar.js';
import { proMatchesAgenda } from './proMatchesAgenda.js';
import { freeGamesRadar } from './freeGamesRadar.js';
import { communityClips } from './communityClips.js';
import { renderProfileHtml } from './profileHtml.js';
import {
  setPersistenceRefs,
  loadActiveMixState,
  scheduleSave,
  saveActiveMixStateNow,
  clearMixPersistence,
} from './mixPersistence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Resilience: Prevent process termination on transient network or external API errors
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[SERVER WARN] Unhandled Rejection intercepted:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[SERVER ERROR] Uncaught Exception intercepted:', err);
});

const app = express();

// Security Hardening: Disable information disclosure
app.disable('x-powered-by');

// Security Hardening: OWASP HTTP Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Limit JSON and URL-encoded body payload to prevent DoS attacks
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: false, limit: '500kb' }));
app.use(cors());

// Ultra-fast Healthcheck for Render / Railway / Docker / Kubernetes (<1ms response, bypasses rate limiting)
app.get(['/health', '/api/health'], (req, res) => {
  return res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'cs2-mix-hub',
    activeRooms: typeof rooms !== 'undefined' ? rooms.size : 0,
    discordBot: typeof discordBotManager !== 'undefined' ? discordBotManager.getStatus().running : false,
  });
});

// In-Memory Anti-DDoS & Rate Limiting System
const ipRateLimits = new Map();
function createRateLimiter({ windowMs = 60000, max = 250, message = 'Muitas requisições. Tente novamente em breve.' }) {
  return (req, res, next) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ip = String(rawIp).split(',')[0].trim();
    const now = Date.now();
    const key = `${ip}:${req.baseUrl || req.path}`;
    let record = ipRateLimits.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      ipRateLimits.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      return res.status(429).json({ error: message, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) });
    }
    next();
  };
}

// Periodic cleanup of expired rate limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipRateLimits.entries()) {
    if (now > val.resetAt) ipRateLimits.delete(key);
  }
}, 5 * 60 * 1000);

// General & Sensitive Rate Limiters
const generalApiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300, message: 'Limite de requisições excedido na API.' });
const sensitiveLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Muitas tentativas em endpoint sensível. Aguarde 1 minuto.' });

app.use('/api', generalApiLimiter);

// Input Sanitization Utilities
function sanitizeInput(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags to eliminate XSS
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip unprintable ASCII/control chars
    .trim()
    .slice(0, maxLength);
}

function isValidMapName(map) {
  if (typeof map !== 'string') return false;
  return /^[a-zA-Z0-9_\-]{3,32}$/.test(map.trim());
}

function sanitizeRconCommand(cmd) {
  if (typeof cmd !== 'string') return '';
  // Strip command chain separators (; \r \n ` $) to prevent RCON command injection
  return cmd
    .replace(/[\r\n;`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const isDev = process.argv.includes('--dev');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const PORT = process.env.PORT || (portArg ? Number(portArg.split('=')[1]) : 3000);

// Live CS2 Active Duty Map Pool Sync (Wikipedia / Valve Esports Records)
fetchLiveOfficialRotation()
  .then(() => console.log('[SERVER] Rotação oficial inicializada com sucesso.'))
  .catch((err) => console.warn('[SERVER] Erro na rotação oficial inicial:', err.message));

// Periodic rotation re-check every 12 hours
setInterval(() => {
  fetchLiveOfficialRotation().catch(() => {});
}, 12 * 60 * 60 * 1000);

// Live CS2 Grenade Playbook Sync (100% Brazilian Portuguese Curated Videos)
loadSavedGrenades();
syncGrenadesPtBr()
  .then((state) => console.log(`[SERVER] 🇧🇷 Feed de vídeos PT-BR pronto (${state.totalLineups} lineups validados).`))
  .catch((err) => console.warn('[SERVER] Erro na validação de vídeos PT-BR:', err.message));

// Periodic background validation & refresh of PT-BR grenade videos every 6 hours
setInterval(() => {
  syncGrenadesPtBr().catch(() => {});
}, 6 * 60 * 60 * 1000);

const MOCK_BOTS = [
  { id: 'bot-1', nick: 'FalleN', level: 21, faceitLevel: 10, faceitElo: 2840, cs2Hours: 14800, side: 'CT', ready: true, avatar: '👑' },
  { id: 'bot-2', nick: 'coldzera', level: 20, faceitLevel: 10, faceitElo: 2750, cs2Hours: 13500, side: 'TR', ready: true, avatar: '🎯' },
  { id: 'bot-3', nick: 'fer', level: 19, faceitLevel: 10, faceitElo: 2620, cs2Hours: 12900, side: 'TR', ready: true, avatar: '⚡' },
  { id: 'bot-4', nick: 'fnx', level: 18, faceitLevel: 9, faceitElo: 2280, cs2Hours: 11400, side: 'ANY', ready: true, avatar: '🔥' },
  { id: 'bot-5', nick: 'TACO', level: 17, faceitLevel: 9, faceitElo: 2150, cs2Hours: 12100, side: 'CT', ready: true, avatar: '🛡️' },
  { id: 'bot-6', nick: 'kNgV-', level: 20, faceitLevel: 10, faceitElo: 2710, cs2Hours: 10800, side: 'TR', ready: true, avatar: '💀' },
  { id: 'bot-7', nick: 'felps', level: 19, faceitLevel: 10, faceitElo: 2590, cs2Hours: 10200, side: 'TR', ready: true, avatar: '🚀' },
  { id: 'bot-8', nick: 'boltz', level: 18, faceitLevel: 9, faceitElo: 2310, cs2Hours: 11900, side: 'CT', ready: true, avatar: '💣' },
  { id: 'bot-9', nick: 'yel', level: 17, faceitLevel: 8, faceitElo: 1980, cs2Hours: 9600, side: 'CT', ready: true, avatar: '🦅' },
  { id: 'bot-10', nick: 'bit', level: 16, faceitLevel: 8, faceitElo: 1920, cs2Hours: 13800, side: 'CT', ready: true, avatar: '🧠' },
];

// In-memory rooms (carregadas com persistência automática de disco)
const rooms = new Map();
const persistedMixState = loadActiveMixState();
if (persistedMixState && Array.isArray(persistedMixState.rooms)) {
  for (const r of persistedMixState.rooms) {
    if (r && r.id && r.phase !== 'finished' && r.phase !== 'cancelled') {
      r.lastActivity = Date.now();
      rooms.set(r.id, r);
      console.log(`💾 [PERSISTÊNCIA] Sala ${r.id} (${r.name || 'Sem nome'}, ${r.players?.length || 0}/10 jogadores) restaurada do disco!`);
    }
  }
}

function touchRoomActivity(room) {
  if (room) {
    room.lastActivity = Date.now();
  }
}

// Inactivity cleanup settings
const INACTIVITY_EMPTY_TIMEOUT = 15 * 60 * 1000; // 15 min if room has 0 players
const INACTIVITY_IDLE_TIMEOUT = 60 * 60 * 1000;  // 60 min if idle without any action

function cleanupInactiveRooms() {
  const now = Date.now();
  let changed = false;

  rooms.forEach((room, id) => {
    const empty = !room.players || room.players.length === 0;
    const idleTime = now - (room.lastActivity || room.createdAt || now);

    // Delete if empty for 15+ min or idle for 60+ min
    if ((empty && idleTime > INACTIVITY_EMPTY_TIMEOUT) || (idleTime > INACTIVITY_IDLE_TIMEOUT)) {
      console.log(`[CLEANUP] Excluindo sala ${id} por inatividade (${Math.round(idleTime / 60000)} min ociosa, ${room.players?.length || 0} jogadores).`);
      io.to(id).emit('room_deleted', {
        roomId: id,
        reason: 'inactivity',
        message: `A sala ${room.name || id} foi encerrada automaticamente por inatividade.`,
      });
      rooms.delete(id);
      changed = true;
    }
  });

  if (changed) {
    broadcastRoomsList();
  }
}

// Periodic cleanup every 60 seconds
setInterval(cleanupInactiveRooms, 60 * 1000);

function getOrCreateRoom(roomId, customName = '', rankingSystem = 'gc', serverIp = '', password = '', isPrivate = false, creatorId = null, creatorSteamId = null, inviteKey = null, creatorNick = '') {
  const id = roomId.trim().toUpperCase() || 'MIX-1';
  if (!rooms.has(id)) {
    const now = Date.now();
    const finalInviteKey = inviteKey || `gc_${Math.random().toString(36).substring(2, 9)}`;
    const effectiveNick = (creatorNick || '').trim();
    // Default name follows creator name if available (e.g. Alex -> "Time Alex")
    let defaultName = `Mix ${id}`;
    if (effectiveNick) {
      defaultName = `Time ${effectiveNick}`;
    } else if (id.startsWith('TIME-')) {
      const derived = id.replace('TIME-', '').trim();
      defaultName = `Time ${derived.charAt(0).toUpperCase() + derived.slice(1).toLowerCase()}`;
    }

    const finalName = (customName && !customName.startsWith('Mix ')) ? customName : defaultName;

    rooms.set(id, {
      id,
      name: finalName,
      createdAt: now,
      lastActivity: now,
      creatorId: creatorId || null,
      creatorSteamId: creatorSteamId || null,
      creatorNick: effectiveNick || (id.startsWith('TIME-') ? id.replace('TIME-', '') : null),
      adminId: creatorId || null,
      rankingSystem: rankingSystem === 'faceit' ? 'faceit' : 'gc', // 'gc' | 'faceit'
      phase: 'lobby', // 'lobby' | 'teams' | 'captains_draft' | 'coin_flip' | 'veto' | 'side_pick' | 'finished'
      players: [],
      teamA: [],
      teamB: [],
      metrics: null,
      maps: [...getCurrentRotationState().activeDutyMaps],
      bannedMaps: [],
      pickedMaps: [],
      vetoLog: [],
      drawnSeries: [],
      matchFormat: 'MD1',
      vetoFirstTeam: 'teamA',
      bo1Order: 'ABABAB',
      pendingSidePick: null,
      teamAName: null,
      teamBName: null,
      currentTurn: 'teamA',
      finalMap: null,
      startingSideTeamB: null,
      serverIp: serverIp ? serverIp.trim() : '',
      rconPassword: '',
      password: '',
      isPrivate: Boolean(isPrivate),
      inviteKey: finalInviteKey,
      discordWebhook: '',
      discordAutoLobby: true,
      discordAutoVeto: true,
      discordGsiRounds: true,
      discordGsiBomb: false,
      discordAutoStats: true,
      liveMatch: null,
      chat: [],
      history: [],
      coin: null, // { winner: 'teamA'|'teamB', choice: 'first'|'pass' }
      captainA: null,
      captainB: null,
      captainTurn: 'captainA',
      unassignedPlayers: [],
    });
  }
  const room = rooms.get(id);
  touchRoomActivity(room);
  return room;
}

function getRoomAdminId(room) {
  if (!room) return null;
  if (room.creatorSteamId) {
    const creatorBySteam = room.players.find((p) => p.steamId === room.creatorSteamId);
    if (creatorBySteam) return creatorBySteam.id;
  }
  if (room.creatorId) {
    const creatorById = room.players.find((p) => p.id === room.creatorId);
    if (creatorById) return creatorById.id;
  }
  if (room.adminId) {
    const adminPlayer = room.players.find((p) => p.id === room.adminId);
    if (adminPlayer) return adminPlayer.id;
  }
  return room.players.length > 0 ? room.players[0].id : null;
}

function isRoomAdmin(room, socket) {
  if (!room || !socket) return false;
  const currentAdminId = getRoomAdminId(room);
  return Boolean(
    (currentAdminId && (socket.playerId === currentAdminId || socket.id === currentAdminId)) ||
    (room.creatorId && (socket.playerId === room.creatorId || socket.id === room.creatorId))
  );
}

function calculateMetricsForTeams(teamA = [], teamB = [], rankingSystem = 'gc') {
  const sumA = teamA.reduce((acc, p) => acc + getPlayerWeight(p, rankingSystem), 0);
  const sumB = teamB.reduce((acc, p) => acc + getPlayerWeight(p, rankingSystem), 0);
  const diff = Math.abs(sumA - sumB);
  const avgA = teamA.length > 0 ? (sumA / teamA.length).toFixed(1) : '0';
  const avgB = teamB.length > 0 ? (sumB / teamB.length).toFixed(1) : '0';
  const maxPossible = Math.max(sumA, sumB) || 1;
  const balancePercentage = Math.max(0, Math.min(100, Math.round(100 - (diff / maxPossible) * 100)));

  return {
    sumA,
    sumB,
    avgA,
    avgB,
    diff,
    balancePercentage,
    rankingSystem,
  };
}

function getSafeRoomState(room) {
  if (!room) return null;
  const { password, rconPassword, ...safe } = room;
  return {
    ...safe,
    adminId: getRoomAdminId(room),
    creatorSteamId: room.creatorSteamId || null,
    creatorId: room.creatorId || null,
    creatorNick: room.creatorNick || null,
    hasPassword: Boolean(password && password.trim()),
    isPrivate: Boolean(room.isPrivate),
    inviteKey: room.inviteKey || null,
  };
}

function emitRoomState(targetRoomId, room) {
  if (!room) return;
  const safeRoom = getSafeRoomState(room);
  io.to(targetRoomId).emit('room_state', safeRoom);
  scheduleSave();
}

function getRoomAndTouch(roomId) {
  if (!roomId) return null;
  const cleanId = String(roomId).trim().toUpperCase();
  const room = rooms.get(cleanId);
  if (room) {
    room.lastActivity = Date.now();
  }
  return room;
}

function broadcastRoomsList() {
  const list = [];
  rooms.forEach((r) => {
    if (r.isPrivate) return; // Hide private/unlisted rooms from public discovery
    list.push({
      id: r.id,
      name: r.name,
      playerCount: r.players.length,
      phase: r.phase,
      rankingSystem: r.rankingSystem || 'gc',
      hasServer: Boolean(r.serverIp && r.serverIp.trim()),
      serverIp: r.serverIp || '',
      hasPassword: Boolean(r.password && r.password.trim()),
      isPrivate: false,
      creatorNick: r.creatorNick || null,
      createdAt: r.createdAt,
      lastActivity: r.lastActivity || r.createdAt,
    });
  });
  io.emit('rooms_list', list);
}

function getPlayerWeight(p, rankingSystem = 'gc') {
  if (rankingSystem === 'faceit') {
    if (p.faceitElo) return Number(p.faceitElo);
    if (p.faceitLevel) return Number(p.faceitLevel) * 200;
    return (Number(p.level) || 5) * 100;
  }
  return Number(p.level) || 12;
}

// Balance helper in node server
function calculateBalance(players, rankingSystem = 'gc') {
  if (players.length < 2) return { teamA: players, teamB: [], metrics: null };
  const half = Math.floor(players.length / 2);

  function getCombinations(arr, k) {
    const results = [];
    function backtrack(start, combo) {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        backtrack(i + 1, combo);
        combo.pop();
      }
    }
    backtrack(0, []);
    return results;
  }

  const allCombinations = getCombinations(players, half);
  let bestSplit = null;
  let minDiff = Infinity;
  let bestScore = -Infinity;

  for (const comboA of allCombinations) {
    const idsA = new Set(comboA.map((p) => p.id));
    const comboB = players.filter((p) => !idsA.has(p.id));

    const sumA = comboA.reduce((acc, p) => acc + getPlayerWeight(p, rankingSystem), 0);
    const sumB = comboB.reduce((acc, p) => acc + getPlayerWeight(p, rankingSystem), 0);
    const diff = Math.abs(sumA - sumB);

    let sideScore = 0;
    comboA.forEach((p) => { if (p.side === 'CT') sideScore += 1; });
    comboB.forEach((p) => { if (p.side === 'TR') sideScore += 1; });

    const score = -diff * 100 + sideScore;
    if (diff < minDiff || (diff === minDiff && score > bestScore)) {
      minDiff = diff;
      bestScore = score;
      bestSplit = { teamA: comboA, teamB: comboB, sumA, sumB, diff };
    }
  }

  const avgA = (bestSplit.sumA / bestSplit.teamA.length).toFixed(1);
  const avgB = (bestSplit.sumB / bestSplit.teamB.length).toFixed(1);
  const maxPossible = Math.max(bestSplit.sumA, bestSplit.sumB) || 1;
  const balancePercentage = Math.max(0, Math.min(100, Math.round(100 - (bestSplit.diff / maxPossible) * 100)));

  return {
    teamA: bestSplit.teamA,
    teamB: bestSplit.teamB,
    metrics: {
      sumA: bestSplit.sumA,
      sumB: bestSplit.sumB,
      avgA,
      avgB,
      diff: bestSplit.diff,
      balancePercentage,
      rankingSystem,
    },
  };
}

function dispatchAutoDiscordVeto(room) {
  if (!room || !room.discordWebhook || !room.discordAutoVeto) return;
  const sideB = room.startingSideTeamB || 'CT';
  const sideA = sideB === 'CT' ? 'TR' : 'CT';
  const creatorNick = room.creatorNick || 'Alex';
  const nameA = room.teamAName || (room.teamA?.[0]?.nick ? `Time ${room.teamA[0].nick}` : (creatorNick ? `Time ${creatorNick}` : 'Time A'));
  const nameB = room.teamBName || (room.teamB?.[0]?.nick ? `Time ${room.teamB[0].nick}` : 'Time B');
  const drawnSeries = Array.isArray(room.drawnSeries) && room.drawnSeries.length > 0 ? room.drawnSeries : [];
  const primaryMap = drawnSeries[0]?.map || room.finalMap || { name: 'Mirage', file: 'de_mirage' };
  const firstSideA = drawnSeries[0]?.sideTimeA || sideA;
  const firstSideB = firstSideA === 'CT' ? 'TR' : 'CT';

  sendDiscordWebhook({
    webhookUrl: room.discordWebhook,
    eventType: 'mix_ready',
    data: {
      roomName: room.name || room.id || 'MIX',
      mapName: primaryMap.name || 'Mirage',
      mapFile: primaryMap.file || 'de_mirage',
      mapImage: primaryMap.image || '',
      mapLogo: primaryMap.logo || '',
      matchFormat: room.matchFormat || 'MD1',
      drawnSeries,
      pickedMaps: room.pickedMaps || [],
      vetoLog: room.vetoLog || [],
      nameA,
      nameB,
      sideA: firstSideA,
      sideB: firstSideB,
      teamA: room.teamA,
      teamB: room.teamB,
      metrics: room.metrics,
      serverIp: room.serverIp,
      connectCommand: room.serverIp ? (room.serverIp.includes('connect') ? room.serverIp : `connect ${room.serverIp}`) : '',
    },
  }).catch((err) => console.warn('[DISCORD] Falha no webhook automático de veto:', err.message));
}

function dispatchAutoDiscordLobby(room) {
  if (!room || !room.discordWebhook || !room.discordAutoLobby || room.discordLobbyNotified) return;
  if (room.players.length === 10) {
    room.discordLobbyNotified = true;
    sendDiscordWebhook({
      webhookUrl: room.discordWebhook,
      eventType: 'lobby_full',
      data: {
        roomName: room.name || 'MIX',
        playerCount: 10,
      },
    }).catch((err) => console.warn('[DISCORD] Falha no webhook de 10/10:', err.message));
  }
}

io.on('connection', (socket) => {
  // Emit current server version/timestamp to client so client detects deployments instantly
  socket.emit('server_app_version', { version: BUILD_VERSION });

  // Emit unified match history (Discord + Web) on connection
  socket.emit('match_history_init', getMatchHistoryState());

  socket.on('get_match_history', (filters) => {
    socket.emit('match_history_updated', getMatchHistoryState(filters || {}));
  });

  // Get active rooms list
  socket.on('get_rooms_list', () => {
    broadcastRoomsList();
  });

  // Join Room
  socket.on('join_room', async ({ roomId, player, roomName, rankingSystem, serverIp, password, isPrivate, inviteKey, createIfMissing }) => {
    const cleanRoomId = sanitizeInput(roomId || '', 20).toUpperCase();
    if (!cleanRoomId) return;
    const cleanRoomName = sanitizeInput(roomName, 40);
    const cleanPassword = sanitizeInput(password || '', 32);
    const cleanKey = sanitizeInput(inviteKey || '', 32);

    // Check if room already exists
    const existingRoom = rooms.get(cleanRoomId);
    if (!existingRoom && createIfMissing === false) {
      socket.emit('room_not_found', {
        roomId: cleanRoomId,
        message: 'Esta sala não existe mais ou já foi encerrada.',
      });
      return;
    }
    if (existingRoom) {
      // Gamers Club style Private Room check: ONLY enters via direct invite link (key)
      if (existingRoom.isPrivate) {
        const matchesKey = cleanKey && existingRoom.inviteKey && cleanKey === existingRoom.inviteKey;
        const isKnownPlayer = player?.id && existingRoom.players.some((p) => p.id === player.id);
        const isCreator = (socket.playerId && existingRoom.creatorId === socket.playerId) ||
                          (player?.steamId && existingRoom.creatorSteamId === player.steamId);

        if (!matchesKey && !isKnownPlayer && !isCreator) {
          socket.emit('room_auth_error', {
            roomId: cleanRoomId,
            roomName: existingRoom.name,
            error: 'private_room',
            message: 'Esta sala é privada. O acesso é permitido somente através do Link de Convite.',
          });
          return;
        }
      }
    }

    if (socket.roomId && socket.roomId !== cleanRoomId) {
      socket.leave(socket.roomId);
    }
    socket.join(cleanRoomId);
    socket.roomId = cleanRoomId;

    const room = getOrCreateRoom(
      cleanRoomId,
      cleanRoomName,
      rankingSystem,
      serverIp,
      cleanPassword,
      isPrivate,
      socket.playerId,
      player?.steamId,
      cleanKey,
      player?.nick
    );

    // If the room was created with a default placeholder name or creator connects, ensure room name reflects creator (e.g. Time Alex)
    if (player?.nick) {
      if (!room.creatorNick) {
        room.creatorNick = player.nick;
      }
      if (room.players.length === 0 && (room.name.startsWith('Mix ') || room.name === `Mix ${cleanRoomId}`)) {
        room.name = `Time ${player.nick}`;
      }
    }
    if (rankingSystem && room.players.length === 0) {
      room.rankingSystem = rankingSystem === 'faceit' ? 'faceit' : 'gc';
    }
    if (serverIp && serverIp.trim()) {
      room.serverIp = sanitizeInput(serverIp, 64);
    }

    // Deliver authenticated room credentials and invite key to the joining client
    socket.emit('room_authenticated', {
      roomId: cleanRoomId,
      password: room.password || '',
      inviteKey: room.inviteKey || '',
      isPrivate: Boolean(room.isPrivate),
      isCreator: room.creatorId === socket.playerId,
    });

    if (player && player.nick) {
      socket.playerId = player.id || socket.id;
      const cleanNick = sanitizeInput(player.nick, 32) || 'Jogador';
      const existingIdx = room.players.findIndex((p) => p.id === socket.playerId || (p.nick === cleanNick && !p.id.startsWith('bot-')));
      
      const parsedLevel = Math.max(1, Math.min(21, Number(player.level) || 10));
      let parsedFaceitLvl = player.faceitLevel
        ? Math.max(1, Math.min(10, Number(player.faceitLevel)))
        : (parsedLevel <= 10 ? parsedLevel : Math.round(parsedLevel / 2.1));
      let parsedFaceitElo = player.faceitElo ? Number(player.faceitElo) : null;

      const validSide = ['CT', 'TR', 'ANY'].includes(player.side) ? player.side : 'ANY';

      const playerData = {
        id: socket.playerId,
        nick: cleanNick,
        level: parsedLevel,
        faceitLevel: parsedFaceitLvl,
        faceitElo: parsedFaceitElo,
        side: validSide,
        avatar: sanitizeInput(player.avatar, 120) || '🎯',
        steamId: player.steamId ? sanitizeInput(player.steamId, 32) : null,
        cs2Hours: player.cs2Hours ? Number(player.cs2Hours) : null,
        ready: player.ready !== undefined ? Boolean(player.ready) : false,
        socketId: socket.id,
      };

      if (existingIdx >= 0) {
        room.players[existingIdx] = {
          ...room.players[existingIdx],
          ...playerData,
          ready: player.ready !== undefined ? player.ready : room.players[existingIdx].ready,
        };
      } else if (room.players.length < 10) {
        room.players.push(playerData);
      }

      // Assign creator/admin if not established yet
      if (!room.creatorId) {
        room.creatorId = socket.playerId;
        room.adminId = socket.playerId;
        if (player.steamId) {
          room.creatorSteamId = player.steamId;
        }
      } else if (player.steamId && room.creatorSteamId && player.steamId === room.creatorSteamId) {
        room.adminId = socket.playerId;
      }

      // If player has Steam ID and default faceit level, attempt automatic FACEIT lookup in background
      if (player.steamId && (!player.faceitElo || player.faceitLevel === 5)) {
        fetchFaceitPlayer({ steamId: player.steamId, nickname: cleanNick }).then((faceitData) => {
          if (faceitData && faceitData.found && faceitData.level) {
            const pIdx = room.players.findIndex((p) => p.id === socket.playerId);
            if (pIdx >= 0) {
              room.players[pIdx].faceitLevel = faceitData.level;
              room.players[pIdx].faceitElo = faceitData.elo;
              emitRoomState(cleanRoomId, room);
            }
          }
        }).catch(() => {});
      }

      // If player has Steam ID but no CS2 hours registered, attempt background Steam stats lookup
      if (player.steamId && !player.cs2Hours) {
        getSteamPlayerDetails(player.steamId).then((steamDetails) => {
          if (steamDetails && steamDetails.cs2Hours) {
            const pIdx = room.players.findIndex((p) => p.id === socket.playerId);
            if (pIdx >= 0 && !room.players[pIdx].cs2Hours) {
              room.players[pIdx].cs2Hours = steamDetails.cs2Hours;
              emitRoomState(cleanRoomId, room);
            }
          }
        }).catch(() => {});
      }
    }

    dispatchAutoDiscordLobby(room);

    emitRoomState(cleanRoomId, room);
    broadcastRoomsList();
  });

  // Verify room password directly
  socket.on('verify_room_password', ({ roomId, password }, callback) => {
    const cleanRoomId = sanitizeInput(roomId || '', 20).toUpperCase();
    const room = getRoomAndTouch(cleanRoomId);
    if (!room) return callback && callback({ valid: false, error: 'not_found' });
    if (!room.password) return callback && callback({ valid: true });
    const matches = sanitizeInput(password || '', 32) === room.password;
    if (callback) {
      callback({ valid: matches, error: matches ? null : 'wrong_password' });
    }
  });

  // Toggle Ranking System (GC vs FACEIT)
  socket.on('change_ranking_system', ({ roomId, rankingSystem }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.rankingSystem = rankingSystem === 'faceit' ? 'faceit' : 'gc';
    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Toggle ready status
  socket.on('toggle_ready', ({ roomId, playerId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.ready = !player.ready;
      emitRoomState(roomId, room);
    }
  });

  // Chat message with verified sender details
  socket.on('send_chat', ({ roomId, message }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || !message || !message.text) return;

    let senderObj = {
      nick: 'Jogador',
      level: 10,
      faceitLevel: 5,
      faceitElo: null,
      avatar: '🎯',
    };

    if (typeof message.sender === 'object' && message.sender !== null) {
      senderObj = {
        nick: sanitizeInput(message.sender.nick, 32) || 'Jogador',
        level: Math.max(1, Math.min(21, Number(message.sender.level) || 10)),
        faceitLevel: Math.max(1, Math.min(10, Number(message.sender.faceitLevel) || 5)),
        faceitElo: message.sender.faceitElo ? Number(message.sender.faceitElo) : null,
        avatar: sanitizeInput(message.sender.avatar, 120) || '🎯',
      };
    } else if (typeof message.sender === 'string') {
      senderObj.nick = sanitizeInput(message.sender, 32) || 'Jogador';
    }

    const cleanText = sanitizeInput(message.text, 250);
    if (!cleanText) return;

    const chatMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: senderObj,
      text: cleanText,
      timestamp: Date.now(),
    };

    room.chat.push(chatMsg);
    if (room.chat.length > 50) room.chat.shift();

    io.to(roomId).emit('chat_message', chatMsg);
  });

  // Update Server IP
  socket.on('update_server_ip', ({ roomId, serverIp }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.serverIp = serverIp ? sanitizeInput(serverIp, 64) : '';
    emitRoomState(roomId, room);
  });

  // Add / Update Player
  socket.on('update_player', ({ roomId, player }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || !player) return;

    const idx = room.players.findIndex((p) => p.id === player.id);
    if (idx >= 0) {
      const sanitizedPlayer = { ...player };
      if (sanitizedPlayer.nick) sanitizedPlayer.nick = sanitizeInput(sanitizedPlayer.nick, 32);
      if (sanitizedPlayer.avatar) sanitizedPlayer.avatar = sanitizeInput(sanitizedPlayer.avatar, 120);
      if (sanitizedPlayer.side && !['CT', 'TR', 'ANY'].includes(sanitizedPlayer.side)) sanitizedPlayer.side = 'ANY';
      room.players[idx] = { ...room.players[idx], ...sanitizedPlayer };
      emitRoomState(roomId, room);
    }
  });

  // Remove Player
  socket.on('remove_player', ({ roomId, playerId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Admin Kick Player (Excluir jogador pelo criador/admin)
  socket.on('kick_player', ({ roomId, targetPlayerId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    if (!isRoomAdmin(room, socket)) {
      socket.emit('admin_error', { message: 'Apenas o administrador da sala pode remover jogadores.' });
      return;
    }

    const currentAdminId = getRoomAdminId(room);
    if (targetPlayerId === currentAdminId) {
      socket.emit('admin_error', { message: 'O administrador não pode remover a si mesmo.' });
      return;
    }

    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target) return;

    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    room.teamA = room.teamA.filter((p) => p.id !== targetPlayerId);
    room.teamB = room.teamB.filter((p) => p.id !== targetPlayerId);
    if (room.unassignedPlayers) {
      room.unassignedPlayers = room.unassignedPlayers.filter((p) => p.id !== targetPlayerId);
    }

    if (room.metrics && (room.phase === 'teams' || room.phase === 'veto')) {
      room.metrics = calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem);
    }

    // Direct notification & socket removal for the kicked player
    if (target.socketId) {
      const targetSock = io.sockets.sockets.get(target.socketId);
      if (targetSock) {
        targetSock.emit('kicked_from_room', {
          roomId: room.id,
          targetPlayerId,
          reason: 'Você foi removido da sala pelo administrador.',
        });
        targetSock.leave(room.id);
        targetSock.roomId = null;
      }
    }

    // Broadcast kick event to room with targetPlayerId for resilient multi-tab/reconnect handling
    io.to(room.id).emit('kicked_from_room', {
      roomId: room.id,
      targetPlayerId,
      reason: 'Você foi removido da sala pelo administrador.',
    });

    // Chat broadcast
    const chatMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: { nick: 'Sistema', avatar: '👑', level: 20, faceitLevel: 10 },
      text: `🚫 ${target.nick} foi removido da sala pelo administrador.`,
      timestamp: Date.now(),
    };
    room.chat.push(chatMsg);
    if (room.chat.length > 50) room.chat.shift();
    io.to(room.id).emit('chat_message', chatMsg);

    emitRoomState(room.id, room);
    broadcastRoomsList();
  });

  // Admin Move Player Team (Mudar jogador de lugar)
  socket.on('move_player_team', ({ roomId, playerId, targetTeam }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    if (!isRoomAdmin(room, socket)) {
      socket.emit('admin_error', { message: 'Apenas o administrador da sala pode mudar jogadores de lugar.' });
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    room.teamA = room.teamA.filter((p) => p.id !== playerId);
    room.teamB = room.teamB.filter((p) => p.id !== playerId);

    if (targetTeam === 'teamA') {
      room.teamA.push(player);
    } else {
      room.teamB.push(player);
    }

    room.metrics = calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem);

    const targetLabel = targetTeam === 'teamA' ? 'Time A (Lado 1)' : 'Time B (Lado 2)';
    const chatMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: { nick: 'Sistema', avatar: '👑', level: 20, faceitLevel: 10 },
      text: `🔄 ${player.nick} foi movido para o ${targetLabel} pelo administrador.`,
      timestamp: Date.now(),
    };
    room.chat.push(chatMsg);
    if (room.chat.length > 50) room.chat.shift();
    io.to(room.id).emit('chat_message', chatMsg);

    emitRoomState(room.id, room);
  });

  // Admin Swap Two Players (Trocar dois jogadores de lugar)
  socket.on('swap_players', ({ roomId, playerAId, playerBId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    if (!isRoomAdmin(room, socket)) {
      socket.emit('admin_error', { message: 'Apenas o administrador pode trocar jogadores de lugar.' });
      return;
    }

    let idxA = room.teamA.findIndex((p) => p.id === playerAId);
    let idxB = room.teamB.findIndex((p) => p.id === playerBId);

    // Support reverse order swap
    if (idxA === -1 || idxB === -1) {
      idxA = room.teamA.findIndex((p) => p.id === playerBId);
      idxB = room.teamB.findIndex((p) => p.id === playerAId);
    }

    if (idxA >= 0 && idxB >= 0) {
      const pA = room.teamA[idxA];
      const pB = room.teamB[idxB];
      room.teamA[idxA] = pB;
      room.teamB[idxB] = pA;
      room.metrics = calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem);

      const chatMsg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sender: { nick: 'Sistema', avatar: '👑', level: 20, faceitLevel: 10 },
        text: `🔀 ${pA.nick} e ${pB.nick} foram trocados de equipe pelo administrador.`,
        timestamp: Date.now(),
      };
      room.chat.push(chatMsg);
      if (room.chat.length > 50) room.chat.shift();
      io.to(room.id).emit('chat_message', chatMsg);

      emitRoomState(room.id, room);
    }
  });

  // Admin Change Player Side in Lobby
  socket.on('admin_change_player_side', ({ roomId, targetPlayerId, side }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    if (!isRoomAdmin(room, socket)) return;

    const p = room.players.find((it) => it.id === targetPlayerId);
    if (p) {
      p.side = ['CT', 'TR', 'ANY'].includes(side) ? side : 'ANY';
      emitRoomState(room.id, room);
    }
  });

  // Fill Mock Bots for fast testing (preserves any connected real players)
  socket.on('fill_mock_bots', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    const realPlayers = room.players
      .filter((p) => !String(p.id).startsWith('bot-'))
      .map((p) => ({ ...p, ready: true }));
    const neededBots = Math.max(0, 10 - realPlayers.length);
    const botsToAdd = JSON.parse(JSON.stringify(MOCK_BOTS.slice(0, neededBots)));
    room.players = [...realPlayers, ...botsToAdd];
    dispatchAutoDiscordLobby(room);
    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Clear Players
  socket.on('clear_players', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.players = [];
    room.phase = 'lobby';
    room.teamA = [];
    room.teamB = [];
    room.metrics = null;
    room.bannedMaps = [];
    room.finalMap = null;
    room.startingSideTeamB = null;
    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Balance & Draw Teams (Auto)
  socket.on('draw_teams', ({ roomId, mode = 'balanced' }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.players.length < 2) return;

    const rankingSys = room.rankingSystem || 'gc';

    if (mode === 'balanced') {
      const { teamA, teamB, metrics } = calculateBalance(room.players, rankingSys);
      room.teamA = teamA;
      room.teamB = teamB;
      room.metrics = metrics;
    } else {
      const shuffled = [...room.players].sort(() => Math.random() - 0.5);
      const half = Math.floor(shuffled.length / 2);
      room.teamA = shuffled.slice(0, half);
      room.teamB = shuffled.slice(half);
      const sumA = room.teamA.reduce((acc, p) => acc + getPlayerWeight(p, rankingSys), 0);
      const sumB = room.teamB.reduce((acc, p) => acc + getPlayerWeight(p, rankingSys), 0);
      const diff = Math.abs(sumA - sumB);
      room.metrics = {
        sumA,
        sumB,
        avgA: (sumA / room.teamA.length).toFixed(1),
        avgB: (sumB / room.teamB.length).toFixed(1),
        diff,
        balancePercentage: Math.max(0, Math.min(100, Math.round(100 - (diff / Math.max(sumA, sumB || 1)) * 100))),
        rankingSystem: rankingSys,
      };
    }

    room.phase = 'teams';
    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Start Captain Draft
  socket.on('start_captain_draft', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.players.length < 2) return;

    // Pick top 2 highest levels as captains
    const sorted = [...room.players].sort((a, b) => b.level - a.level);
    room.captainA = sorted[0];
    room.captainB = sorted[1];
    room.teamA = [sorted[0]];
    room.teamB = [sorted[1]];
    room.unassignedPlayers = sorted.slice(2);
    room.captainTurn = 'captainA';
    room.phase = 'captains_draft';

    emitRoomState(roomId, room);
  });

  // Captain picks player
  socket.on('captain_pick', ({ roomId, playerId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'captains_draft') return;

    const playerIdx = room.unassignedPlayers.findIndex((p) => p.id === playerId);
    if (playerIdx === -1) return;

    const chosenPlayer = room.unassignedPlayers.splice(playerIdx, 1)[0];

    if (room.captainTurn === 'captainA') {
      room.teamA.push(chosenPlayer);
      room.captainTurn = 'captainB';
    } else {
      room.teamB.push(chosenPlayer);
      room.captainTurn = 'captainA';
    }

    // Check if draft finished
    if (room.unassignedPlayers.length === 0) {
      const sumA = room.teamA.reduce((acc, p) => acc + p.level, 0);
      const sumB = room.teamB.reduce((acc, p) => acc + p.level, 0);
      const diff = Math.abs(sumA - sumB);
      room.metrics = {
        sumA,
        sumB,
        avgA: (sumA / room.teamA.length).toFixed(1),
        avgB: (sumB / room.teamB.length).toFixed(1),
        diff,
        balancePercentage: Math.max(0, Math.min(100, Math.round(100 - (diff / Math.max(sumA, sumB || 1)) * 100))),
      };
      room.phase = 'teams';
    }

    emitRoomState(roomId, room);
  });

  // Coin Flip (Cara ou Coroa CT vs TR)
  socket.on('flip_coin', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const winner = Math.random() < 0.5 ? 'teamA' : 'teamB';
    room.coin = {
      winner,
      timestamp: Date.now(),
      choice: null,
    };
    room.phase = 'coin_flip';
    emitRoomState(roomId, room);
  });

  // Helper: Official Professional CS2 Veto Schedule (Valve Major / HLTV / ESL / GC)
  function getServerVetoSchedule(matchFormat = 'MD1', firstTeam = 'teamA', bo1Order = 'ABABAB') {
    const T1 = firstTeam === 'teamB' ? 'teamB' : 'teamA';
    const T2 = T1 === 'teamA' ? 'teamB' : 'teamA';

    if (matchFormat === 'MD3') {
      return [
        { step: 1, type: 'ban', team: T1, label: '1º Ban' },
        { step: 2, type: 'ban', team: T2, label: '2º Ban' },
        { step: 3, type: 'pick', team: T1, sidePickBy: T2, mapNumber: 1, label: 'Pick Mapa 1', role: 'Mapa 1 (Pick)' },
        { step: 4, type: 'pick', team: T2, sidePickBy: T1, mapNumber: 2, label: 'Pick Mapa 2', role: 'Mapa 2 (Pick)' },
        { step: 5, type: 'ban', team: T1, label: '3º Ban' },
        { step: 6, type: 'ban', team: T2, label: '4º Ban' },
        { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 3, label: 'Decider (Mapa 3)', role: 'Mapa 3 (Decider)' },
      ];
    }

    if (matchFormat === 'MD5') {
      return [
        { step: 1, type: 'ban', team: T1, label: '1º Ban' },
        { step: 2, type: 'ban', team: T2, label: '2º Ban' },
        { step: 3, type: 'pick', team: T1, sidePickBy: T2, mapNumber: 1, label: 'Pick Mapa 1', role: 'Mapa 1 (Pick)' },
        { step: 4, type: 'pick', team: T2, sidePickBy: T1, mapNumber: 2, label: 'Pick Mapa 2', role: 'Mapa 2 (Pick)' },
        { step: 5, type: 'pick', team: T1, sidePickBy: T2, mapNumber: 3, label: 'Pick Mapa 3', role: 'Mapa 3 (Pick)' },
        { step: 6, type: 'pick', team: T2, sidePickBy: T1, mapNumber: 4, label: 'Pick Mapa 4', role: 'Mapa 4 (Pick)' },
        { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 5, label: 'Decider (Mapa 5)', role: 'Mapa 5 (Decider)' },
      ];
    }

    if (bo1Order === 'ABBAAB') {
      return [
        { step: 1, type: 'ban', team: T1, label: '1º Ban' },
        { step: 2, type: 'ban', team: T2, label: '2º Ban' },
        { step: 3, type: 'ban', team: T2, label: '3º Ban' },
        { step: 4, type: 'ban', team: T1, label: '4º Ban' },
        { step: 5, type: 'ban', team: T1, label: '5º Ban' },
        { step: 6, type: 'ban', team: T2, label: '6º Ban' },
        { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 1, label: 'Decider (MD1)', role: 'Mapa da Partida (Decider)' },
      ];
    }

    return [
      { step: 1, type: 'ban', team: T1, label: '1º Ban' },
      { step: 2, type: 'ban', team: T2, label: '2º Ban' },
      { step: 3, type: 'ban', team: T1, label: '3º Ban' },
      { step: 4, type: 'ban', team: T2, label: '4º Ban' },
      { step: 5, type: 'ban', team: T1, label: '5º Ban' },
      { step: 6, type: 'ban', team: T2, label: '6º Ban' },
      { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 1, label: 'Decider (MD1)', role: 'Mapa da Partida (Decider)' },
    ];
  }

  function resetRoomVetoState(room, { matchFormat, firstTeam, bo1Order } = {}) {
    if (matchFormat && ['MD1', 'MD3', 'MD5'].includes(matchFormat)) {
      room.matchFormat = matchFormat;
    } else if (!room.matchFormat) {
      room.matchFormat = 'MD1';
    }
    if (firstTeam === 'teamA' || firstTeam === 'teamB') {
      room.vetoFirstTeam = firstTeam;
    } else if (!room.vetoFirstTeam) {
      room.vetoFirstTeam = 'teamA';
    }
    if (bo1Order === 'ABABAB' || bo1Order === 'ABBAAB') {
      room.bo1Order = bo1Order;
    } else if (!room.bo1Order) {
      room.bo1Order = 'ABABAB';
    }

    room.phase = 'veto';
    room.bannedMaps = [];
    room.pickedMaps = [];
    room.vetoLog = [];
    room.drawnSeries = [];
    room.pendingSidePick = null;
    room.currentTurn = room.vetoFirstTeam;
    room.finalMap = null;
    room.startingSideTeamB = null;
  }

  // Winner of coin picks to ban first or pass
  socket.on('coin_choice', ({ roomId, choice }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'coin_flip' || !room.coin) return;

    room.coin.choice = choice; // 'first' or 'pass'
    const firstTeam = choice === 'first'
      ? room.coin.winner
      : (room.coin.winner === 'teamA' ? 'teamB' : 'teamA');

    resetRoomVetoState(room, { firstTeam });
    emitRoomState(roomId, room);
  });

  // Start Veto Phase directly
  socket.on('start_veto', ({ roomId, matchFormat, firstTeam, bo1Order }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    resetRoomVetoState(room, { matchFormat, firstTeam, bo1Order });
    emitRoomState(roomId, room);
  });

  // Change Veto Format (MD1 / MD3 / MD5) on the fly
  socket.on('change_veto_format', ({ roomId, matchFormat, bo1Order }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    resetRoomVetoState(room, {
      matchFormat: matchFormat || room.matchFormat,
      firstTeam: room.vetoFirstTeam || 'teamA',
      bo1Order: bo1Order || room.bo1Order,
    });
    emitRoomState(roomId, room);
  });

  // Quick Start Veto (when teams are already formed — Pro MD1 / MD3 / MD5)
  socket.on('quick_start_veto', ({ roomId, teamAName, teamBName, matchFormat = 'MD3', firstTeam = 'teamA', bo1Order = 'ABABAB' }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const cleanA = sanitizeInput(teamAName, 24) || 'Time A';
    const cleanB = sanitizeInput(teamBName, 24) || 'Time B';
    room.teamAName = cleanA;
    room.teamBName = cleanB;

    room.teamA = [{ id: 't1', nick: cleanA, level: 15, avatar: '🛡️' }];
    room.teamB = [{ id: 't2', nick: cleanB, level: 15, avatar: '⚔️' }];

    resetRoomVetoState(room, {
      matchFormat: ['MD1', 'MD3', 'MD5'].includes(matchFormat) ? matchFormat : 'MD3',
      firstTeam: firstTeam === 'teamB' ? 'teamB' : 'teamA',
      bo1Order: bo1Order === 'ABBAAB' ? 'ABBAAB' : 'ABABAB',
    });
    emitRoomState(roomId, room);
  });

  // Load Tournament Match with complete rosters (5v5)
  socket.on('load_tournament_match', ({ roomId, nameA, nameB, teamA, teamB, matchFormat = 'MD3' }) => {
    const room = getRoomAndTouch(roomId) || getOrCreateRoom(roomId, `${nameA} vs ${nameB}`);
    if (!room) return;

    const cleanA = sanitizeInput(nameA, 32) || 'Time A';
    const cleanB = sanitizeInput(nameB, 32) || 'Time B';
    room.nameA = cleanA;
    room.nameB = cleanB;
    room.teamAName = cleanA;
    room.teamBName = cleanB;
    room.matchFormat = ['MD1', 'MD3', 'MD5'].includes(matchFormat) ? matchFormat : 'MD3';

    room.teamA = Array.isArray(teamA) && teamA.length > 0 ? teamA : room.teamA;
    room.teamB = Array.isArray(teamB) && teamB.length > 0 ? teamB : room.teamB;
    room.players = [...room.teamA, ...room.teamB];
    room.phase = 'teams';

    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Quick Random Map Draw (Supports MD1, MD3, MD5 with 100% cryptographic reliability)
  socket.on('quick_random_map', ({ roomId, map, startingSide, startingSideTeamA, matchFormat = 'MD1', drawnSeries = [] }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const chosenMap = map || room.maps[Math.floor(Math.random() * room.maps.length)];
    const sideTeamB = startingSide || (Math.random() < 0.5 ? 'CT' : 'TR');
    const sideTeamA = startingSideTeamA || (sideTeamB === 'CT' ? 'TR' : 'CT');

    room.finalMap = chosenMap;
    room.startingSideTeamB = sideTeamB;
    room.startingSideTeamA = sideTeamA;
    room.matchFormat = matchFormat || 'MD1';
    room.drawnSeries = Array.isArray(drawnSeries) && drawnSeries.length > 0
      ? drawnSeries.map((s, idx) => ({
          ...s,
          sideTimeA: s.sideTimeA || 'CT',
          sideTimeB: s.sideTimeB || (s.sideTimeA === 'CT' ? 'TR' : 'CT'),
        }))
      : [{ map: chosenMap, sideTimeA: sideTeamA, sideTimeB: sideTeamB, role: 'Mapa 1' }];
    room.phase = 'finished';

    if (room.teamA.length === 0) {
      room.teamA = [{ id: 't1', nick: 'Time A', level: 15, avatar: '🛡️' }];
    }
    if (room.teamB.length === 0) {
      room.teamB = [{ id: 't2', nick: 'Time B', level: 15, avatar: '⚔️' }];
    }

    dispatchAutoDiscordVeto(room);
    emitRoomState(roomId, room);
  });

  // Ban or Pick Map according to the official 7-step schedule
  socket.on('ban_map', ({ roomId, mapId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'veto') return;
    if (room.pendingSidePick) return; // Must finish side selection for picked map first
    if (!Array.isArray(room.bannedMaps)) room.bannedMaps = [];
    if (!Array.isArray(room.pickedMaps)) room.pickedMaps = [];
    if (!Array.isArray(room.vetoLog)) room.vetoLog = [];

    if (room.bannedMaps.some((b) => b.mapId === mapId) || room.pickedMaps.some((p) => p.mapId === mapId)) {
      return;
    }

    const mapObj = room.maps.find((m) => m.id === mapId);
    if (!mapObj) return;

    const schedule = getServerVetoSchedule(room.matchFormat || 'MD1', room.vetoFirstTeam || 'teamA', room.bo1Order || 'ABABAB');
    const actionIdx = room.bannedMaps.length + room.pickedMaps.length;
    const currentStep = schedule[actionIdx];
    if (!currentStep) return;

    if (currentStep.type === 'pick') {
      // Official Map PICK (MD3 / MD5)
      room.pickedMaps.push({
        mapId,
        map: mapObj,
        pickedBy: currentStep.team,
        sidePickBy: currentStep.sidePickBy,
        mapNumber: currentStep.mapNumber,
        step: currentStep.step,
        sideTeamA: null,
        sideTeamB: null,
        knifeRound: false,
        timestamp: Date.now(),
      });

      room.vetoLog.push({
        step: currentStep.step,
        type: 'pick',
        team: currentStep.team,
        mapId,
        mapName: mapObj.name,
        mapNumber: currentStep.mapNumber,
        sideTeamA: null,
        sideTeamB: null,
        knifeRound: false,
      });

      room.pendingSidePick = {
        mapId,
        mapNumber: currentStep.mapNumber,
        pickedBy: currentStep.team,
        sidePickBy: currentStep.sidePickBy,
        step: currentStep.step,
      };
      room.currentTurn = currentStep.sidePickBy;
      emitRoomState(roomId, room);
      return;
    }

    // Official Map BAN
    room.bannedMaps.push({
      mapId,
      bannedBy: currentStep.team,
      step: currentStep.step,
      timestamp: Date.now(),
    });

    room.vetoLog.push({
      step: currentStep.step,
      type: 'ban',
      team: currentStep.team,
      mapId,
      mapName: mapObj.name,
    });

    const remaining = room.maps.filter(
      (m) => !room.bannedMaps.some((b) => b.mapId === m.id) && !room.pickedMaps.some((p) => p.mapId === m.id)
    );
    const nextStep = schedule[actionIdx + 1];

    if (remaining.length === 1 || !nextStep || nextStep.type === 'decider') {
      room.finalMap = remaining[0] || mapObj;
      room.phase = 'side_pick';
      room.currentTurn = nextStep?.sidePickBy || 'teamA';
    } else {
      room.currentTurn = nextStep.team;
    }

    emitRoomState(roomId, room);
  });

  // Side Pick (CT / TR / KNIFE) on picked map (MD3/MD5) or decider map
  socket.on('select_side', ({ roomId, side }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    if (!Array.isArray(room.pickedMaps)) room.pickedMaps = [];
    if (!Array.isArray(room.vetoLog)) room.vetoLog = [];

    const cleanSide = side === 'TR' ? 'TR' : side === 'KNIFE' ? 'KNIFE' : 'CT';
    const schedule = getServerVetoSchedule(room.matchFormat || 'MD1', room.vetoFirstTeam || 'teamA', room.bo1Order || 'ABABAB');

    // Case 1: Opponent choosing starting side right after a map PICK (MD3 / MD5)
    if (room.phase === 'veto' && room.pendingSidePick) {
      const pending = room.pendingSidePick;
      const pickerTeam = pending.sidePickBy || 'teamB';
      let sideA = 'CT';
      let sideB = 'TR';

      if (cleanSide === 'KNIFE') {
        sideA = 'FACA';
        sideB = 'FACA';
      } else if (pickerTeam === 'teamA') {
        sideA = cleanSide;
        sideB = cleanSide === 'CT' ? 'TR' : 'CT';
      } else {
        sideB = cleanSide;
        sideA = cleanSide === 'CT' ? 'TR' : 'CT';
      }

      const pIdx = room.pickedMaps.findIndex((p) => p.mapId === pending.mapId);
      if (pIdx >= 0) {
        room.pickedMaps[pIdx].sideTeamA = sideA;
        room.pickedMaps[pIdx].sideTeamB = sideB;
        room.pickedMaps[pIdx].knifeRound = cleanSide === 'KNIFE';
      }

      const logIdx = room.vetoLog.findIndex((l) => l.mapId === pending.mapId && l.type === 'pick');
      if (logIdx >= 0) {
        room.vetoLog[logIdx].sideTeamA = sideA;
        room.vetoLog[logIdx].sideTeamB = sideB;
        room.vetoLog[logIdx].knifeRound = cleanSide === 'KNIFE';
      }

      room.pendingSidePick = null;

      const remaining = room.maps.filter(
        (m) => !room.bannedMaps.some((b) => b.mapId === m.id) && !room.pickedMaps.some((p) => p.mapId === m.id)
      );
      const nextActionIdx = room.bannedMaps.length + room.pickedMaps.length;
      const nextStep = schedule[nextActionIdx];

      if (remaining.length === 1 || !nextStep || nextStep.type === 'decider') {
        room.finalMap = remaining[0];
        room.phase = 'side_pick';
        room.currentTurn = nextStep?.sidePickBy || 'teamA';
      } else {
        room.currentTurn = nextStep.team;
      }

      emitRoomState(roomId, room);
      return;
    }

    // Case 2: Side selection on the Decider map
    if (room.phase !== 'side_pick') return;

    const deciderStep = schedule[schedule.length - 1];
    const pickerTeam = deciderStep?.sidePickBy || 'teamB';
    let deciderSideA = 'CT';
    let deciderSideB = 'TR';

    if (cleanSide === 'KNIFE') {
      deciderSideA = 'CT';
      deciderSideB = 'TR';
    } else if (pickerTeam === 'teamA') {
      deciderSideA = cleanSide;
      deciderSideB = cleanSide === 'CT' ? 'TR' : 'CT';
    } else {
      deciderSideB = cleanSide;
      deciderSideA = cleanSide === 'CT' ? 'TR' : 'CT';
    }

    room.startingSideTeamB = deciderSideB;
    const deciderMap = room.finalMap;

    room.vetoLog.push({
      step: schedule.length,
      type: 'decider',
      team: 'auto',
      mapId: deciderMap?.id,
      mapName: deciderMap?.name || 'Decider',
      mapNumber: deciderStep?.mapNumber || 1,
      sideTeamA: cleanSide === 'KNIFE' ? 'FACA' : deciderSideA,
      sideTeamB: cleanSide === 'KNIFE' ? 'FACA' : deciderSideB,
      knifeRound: cleanSide === 'KNIFE',
    });

    if (room.pickedMaps.length > 0) {
      const labelA = room.teamAName || room.teamA?.[0]?.nick || 'Time A';
      const labelB = room.teamBName || room.teamB?.[0]?.nick || 'Time B';
      const series = room.pickedMaps.map((p) => ({
        map: p.map,
        sideTimeA: p.sideTeamA === 'FACA' ? 'CT' : (p.sideTeamA || 'CT'),
        knifeRound: Boolean(p.knifeRound),
        pickedBy: p.pickedBy,
        role: `Mapa ${p.mapNumber} (Pick ${p.pickedBy === 'teamA' ? labelA : labelB})`,
      }));
      series.push({
        map: deciderMap,
        sideTimeA: deciderSideA,
        knifeRound: cleanSide === 'KNIFE',
        pickedBy: 'decider',
        role: `Mapa ${series.length + 1} (Decider)`,
      });
      room.drawnSeries = series;
      // Set Map 1 as primary finalMap so server connect / RCON loads Map 1 first
      room.finalMap = series[0].map || deciderMap;
      room.startingSideTeamB = series[0].sideTimeA === 'CT' ? 'TR' : 'CT';
    } else {
      room.drawnSeries = [
        {
          map: deciderMap,
          sideTimeA: deciderSideA,
          knifeRound: cleanSide === 'KNIFE',
          pickedBy: 'decider',
          role: 'Mapa da Partida (Decider)',
        },
      ];
    }

    room.phase = 'finished';

    dispatchAutoDiscordVeto(room);
    emitRoomState(roomId, room);
  });

  // Save match score to history
  socket.on('save_score', ({ roomId, scoreA, scoreB, map, mapName }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const numA = Number(scoreA) || 0;
    const numB = Number(scoreB) || 0;

    const resolvedMap = normalizeMapName(
      mapName ||
      map ||
      room.finalMap?.name ||
      room.finalMap?.id ||
      room.finalMap ||
      room.drawnSeries?.[0]?.map?.name ||
      room.drawnSeries?.[0]?.map?.id ||
      room.drawnSeries?.[0]?.map ||
      'Mirage'
    );
    const resolvedImage = getMapImageUrl(resolvedMap);

    room.history.unshift({
      id: `match-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      map: resolvedMap,
      mapImage: resolvedImage,
      scoreA: numA,
      scoreB: numB,
      winner: numA > numB ? 'Time A' : numB > numA ? 'Time B' : 'Empate',
    });

    if (room.history.length > 20) room.history.pop();

    // Automatically update persistent Hall of Fame / Leaderboard
    if (numA > numB && room.teamA.length > 0) {
      const updated = recordMatch({
        winners: room.teamA,
        losers: room.teamB,
        map: resolvedMap,
        scoreWinners: numA,
        scoreLosers: numB,
      });
      io.emit('leaderboard_updated', updated);
    } else if (numB > numA && room.teamB.length > 0) {
      const updated = recordMatch({
        winners: room.teamB,
        losers: room.teamA,
        map: resolvedMap,
        scoreWinners: numB,
        scoreLosers: numA,
      });
      io.emit('leaderboard_updated', updated);
    }

    // Save to unified persistent match history (Discord + Web)
    const webMatchRecord = {
      id: `WEB-${roomId.toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      source: 'web',
      platform: 'Site Web (Sala)',
      sourceLabel: 'Via Site Web',
      roomId: roomId,
      roomName: room.name || `Sala ${roomId}`,
      timestamp: Date.now(),
      map: resolvedMap,
      mapImage: resolvedImage,
      winner: numA > numB ? 'Time A' : numB > numA ? 'Time B' : 'Empate',
      loser: numA > numB ? 'Time B' : numB > numA ? 'Time A' : 'Empate',
      score: `${Math.max(numA, numB)}-${Math.min(numA, numB)}`,
      scoreWinner: Math.max(numA, numB),
      scoreLoser: Math.min(numA, numB),
      declaredBy: 'Capitão da Sala',
      serverConnect: room.serverIp || '',
      winnerPlayers: (numA > numB ? room.teamA : room.teamB).map((p, idx) => ({
        id: p.id || `p-win-${idx}`,
        nick: p.nick || `Jogador ${idx + 1}`,
        level: p.level || 16,
        avatar: p.avatar || '',
        steamId: p.steamId || '',
        role: idx === 0 ? 'Capitão' : 'Jogador',
      })),
      loserPlayers: (numA > numB ? room.teamB : room.teamA).map((p, idx) => ({
        id: p.id || `p-lose-${idx}`,
        nick: p.nick || `Jogador ${idx + 1}`,
        level: p.level || 16,
        avatar: p.avatar || '',
        steamId: p.steamId || '',
        role: idx === 0 ? 'Capitão' : 'Jogador',
      })),
    };

    // Automatically compute Match MVP based on CS2 player performance statistics
    const currentGsi = getGsiState(roomId) || room.gsiState || room.liveMatch || null;
    const computedMvp = computeMatchMvp(webMatchRecord, currentGsi);
    if (computedMvp) {
      webMatchRecord.mvpId = computedMvp.id;
      webMatchRecord.mvpNick = computedMvp.nick;
      webMatchRecord.mvp = computedMvp;
      webMatchRecord.mvpStats = computedMvp;
      room.matchMvp = computedMvp;
      if (room.liveMatch) {
        room.liveMatch.matchMvp = computedMvp;
      }
    }

    // Strictly enforce 10 players (5v5) before persisting to global match history
    if (room.teamA?.length === 5 && room.teamB?.length === 5) {
      recordMatchHistoryEntry(webMatchRecord);
      io.emit('match_history_updated', getMatchHistoryState());
    }

    emitRoomState(roomId, room);
  });

  // Swap Sides (CT <-> TR / Team A <-> Team B)
  socket.on('swap_teams', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    const temp = room.teamA;
    room.teamA = room.teamB;
    room.teamB = temp;
    if (room.metrics) {
      const { sumA, sumB, avgA, avgB } = room.metrics;
      room.metrics.sumA = sumB;
      room.metrics.sumB = sumA;
      room.metrics.avgA = avgB;
      room.metrics.avgB = avgA;
    }
    emitRoomState(roomId, room);
  });

  // Restart Veto Only (keeps teams & format intact)
  socket.on('restart_veto', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    resetRoomVetoState(room, {
      matchFormat: room.matchFormat || 'MD1',
      firstTeam: room.vetoFirstTeam || 'teamA',
      bo1Order: room.bo1Order || 'ABABAB',
    });
    emitRoomState(roomId, room);
  });

  // Reset to Lobby
  socket.on('reset_mix', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    room.phase = 'lobby';
    room.teamA = [];
    room.teamB = [];
    room.teamAName = null;
    room.teamBName = null;
    room.metrics = null;
    room.bannedMaps = [];
    room.pickedMaps = [];
    room.vetoLog = [];
    room.drawnSeries = [];
    room.pendingSidePick = null;
    room.finalMap = null;
    room.startingSideTeamB = null;
    room.currentTurn = 'teamA';
    room.coin = null;
    room.unassignedPlayers = [];
    room.discordLobbyNotified = false;

    // unready players
    room.players.forEach((p) => { p.ready = false; });

    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Rematch with the exact same teams
  socket.on('rematch_same_teams', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    room.phase = 'veto';
    room.bannedMaps = [];
    room.pickedMaps = [];
    room.vetoLog = [];
    room.drawnSeries = [];
    room.pendingSidePick = null;
    room.finalMap = null;
    room.liveMatch = null;

    // Swap starting sides
    const oldSideB = room.startingSideTeamB || 'CT';
    room.startingSideTeamB = oldSideB === 'CT' ? 'TR' : 'CT';

    // Reset veto turns
    room.currentTurn = 'teamA';
    room.vetoState = {
      remainingMaps: [...CS2_MAPS],
      bannedMaps: [],
      currentTurn: 'teamA',
      mode: room.matchFormat || 'MD1',
      firstTeam: room.vetoFirstTeam || 'teamA',
      bo1Order: room.bo1Order || 'ABABAB',
    };

    emitRoomState(roomId, room);
    broadcastRoomsList();
  });

  // Delete Room Manually
  socket.on('delete_room', ({ roomId }) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    if (!rooms.has(cleanRoomId)) return;

    const room = rooms.get(cleanRoomId);
    const roomName = room.name || cleanRoomId;

    console.log(`[DELETE_ROOM] Sala ${cleanRoomId} excluída pelo usuário via socket.`);
    io.to(cleanRoomId).emit('room_deleted', {
      roomId: cleanRoomId,
      reason: 'manual',
      message: `A sala ${roomName} foi excluída.`,
    });

    rooms.delete(cleanRoomId);
    broadcastRoomsList();
  });

  // Sync Official Rotation on demand
  socket.on('sync_official_rotation', async () => {
    try {
      const updatedState = await fetchLiveOfficialRotation();
      io.emit('active_rotation_updated', updatedState);

      // Update maps in rooms that are still in lobby
      rooms.forEach((r) => {
        if (r.phase === 'lobby') {
          r.maps = [...updatedState.activeDutyMaps];
          emitRoomState(r.id, r);
        }
      });
    } catch (err) {
      console.warn('[SOCKET] Erro ao sincronizar rotação oficial:', err.message);
    }
  });

  // Set RCON Password for Room
  socket.on('set_rcon_password', ({ roomId, rconPassword }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.rconPassword = (rconPassword || '').trim();
    emitRoomState(roomId, room);
  });

  // Execute RCON Command (Sanitized against injection)
  socket.on('exec_rcon_command', async ({ roomId, command }, callback) => {
    const room = getRoomAndTouch(roomId);
    if (!room || !room.serverIp || !room.rconPassword) {
      if (typeof callback === 'function') {
        callback({ error: 'Servidor ou senha RCON não configurados nesta sala.' });
      }
      return;
    }

    const cleanCommand = sanitizeRconCommand(command);
    if (!cleanCommand) {
      if (typeof callback === 'function') {
        callback({ error: 'Comando RCON inválido ou vazio.' });
      }
      return;
    }

    const parsed = parseHostPort(room.serverIp);
    try {
      const res = await executeRconCommand({
        host: parsed.host,
        port: parsed.port,
        password: room.rconPassword,
        command: cleanCommand,
      });
      if (typeof callback === 'function') callback({ success: true, ...res });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // Change Map on Server via RCON (Strict map identifier validation)
  socket.on('change_server_map', async ({ roomId, mapFile }, callback) => {
    const room = getRoomAndTouch(roomId);
    if (!room || !room.serverIp || !room.rconPassword) {
      if (typeof callback === 'function') {
        callback({ error: 'Servidor ou senha RCON não configurados nesta sala.' });
      }
      return;
    }

    const cleanMap = (mapFile || 'de_mirage').trim().toLowerCase();
    if (!isValidMapName(cleanMap)) {
      if (typeof callback === 'function') {
        callback({ error: 'Nome de mapa inválido para execução no servidor.' });
      }
      return;
    }

    const parsed = parseHostPort(room.serverIp);
    try {
      const res = await executeRconCommand({
        host: parsed.host,
        port: parsed.port,
        password: room.rconPassword,
        command: `changelevel ${cleanMap}`,
      });
      if (typeof callback === 'function') callback({ success: true, ...res });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // Discord Webhook Settings for Room
  socket.on('set_discord_webhook', ({ roomId, webhookUrl, autoLobby = true, autoVeto = true, autoGsiRounds = true, autoGsiBomb = false, autoStats = true }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.discordWebhook = (webhookUrl || '').trim();
    room.discordAutoLobby = Boolean(autoLobby);
    room.discordAutoVeto = Boolean(autoVeto);
    room.discordGsiRounds = Boolean(autoGsiRounds);
    room.discordGsiBomb = Boolean(autoGsiBomb);
    room.discordAutoStats = Boolean(autoStats);
    emitRoomState(roomId, room);
  });

  // Trigger Discord Notification
  socket.on('send_discord_webhook', async ({ roomId, eventType, data }, callback) => {
    const room = getRoomAndTouch(roomId);
    const targetUrl = (data?.webhookUrl || room?.discordWebhook || '').trim();
    if (!targetUrl) {
      if (typeof callback === 'function') callback({ error: 'Nenhum Webhook do Discord configurado.' });
      return;
    }

    try {
      const res = await sendDiscordWebhook({
        webhookUrl: targetUrl,
        eventType: eventType || 'test',
        data: {
          ...data,
          roomName: data?.roomName || room?.name || 'MIX',
          serverIp: data?.serverIp || room?.serverIp || '',
        },
      });
      if (typeof callback === 'function') callback({ success: true, ...res });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // Leaderboard Socket Requests
  socket.on('get_leaderboard', (callback) => {
    const data = getLeaderboard();
    if (typeof callback === 'function') callback(data);
    else socket.emit('leaderboard_data', data);
  });

  socket.on('record_leaderboard_match', (matchData, callback) => {
    const updated = recordMatch(matchData);
    io.emit('leaderboard_updated', updated);
    if (typeof callback === 'function') callback({ success: true, leaderboard: updated });
  });

  socket.on('disconnect', () => {
    // Keep slots
  });
});

const BUILD_VERSION = Date.now().toString();

// Endpoint for live version detection
app.get('/api/version', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ version: BUILD_VERSION });
});

// Serve frontend build with strict anti-caching for HTML and high-performance caching for hashed assets
const distPath = path.join(__dirname, '..', 'dist');

function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serveDynamicIndexHtml(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const indexPath = path.join(distPath, 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    const rawRoom = sanitizeInput(req.query.room || '', 24).toUpperCase();

    if (rawRoom) {
      const activeRoom = rooms.get(rawRoom);
      const queryName = sanitizeInput(req.query.name || '', 50);
      const roomTitle = activeRoom?.name || queryName || `Mix ${rawRoom}`;
      const playerCount = activeRoom?.players?.length || 0;
      const remaining = Math.max(0, 10 - playerCount);
      const rankLabel = (activeRoom?.rankingSystem || req.query.rank) === 'faceit' ? 'FACEIT' : 'Gamers Club';

      const ogTitle = playerCount > 0
        ? `🔥 Convite Mix CS2: ${roomTitle} (${playerCount}/10 na sala) — Bora fechar o 5v5!`
        : `🔥 Convite Mix CS2: ${roomTitle} (#${rawRoom}) — Bora fechar o 5v5!`;

      const ogDesc = playerCount > 0 && remaining > 0
        ? `Você foi chamado para a sala "${roomTitle}" (#${rawRoom} • ${rankLabel})! Faltam ${remaining} vagas para fechar o Mix 5v5. Clique para entrar direto na sala!`
        : `Você foi chamado para a sala "${roomTitle}" (#${rawRoom} • ${rankLabel})! Clique para entrar direto no lobby em tempo real, sortear os times e fazer o Pick & Ban de mapas!`;

      const safeTitle = escapeHtmlAttr(ogTitle);
      const safeDesc = escapeHtmlAttr(ogDesc);

      html = html
        .replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`)
        .replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${safeTitle}" />`)
        .replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${safeDesc}" />`)
        .replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${safeTitle}" />`)
        .replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${safeDesc}" />`);
    }

    return res.status(200).type('html').send(html);
  } catch (err) {
    console.warn('[SERVER] Fallback sendFile index.html:', err.message);
    return res.sendFile(indexPath);
  }
}

app.get('/', serveDynamicIndexHtml);

app.use(express.static(distPath, {
  index: false,
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    } else if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    }
  }
}));

// Steam direct connect handler for Discord Bot 1-click launch
app.get(['/connect', '/join-cs2'], (req, res) => {
  const ip = (req.query.ip || '').trim();
  if (!ip) {
    return res.status(400).send('IP do servidor CS2 não fornecido.');
  }
  const cleanIp = ip.replace(/^connect\s+/i, '');
  const steamUrl = `steam://connect/${cleanIp}`;
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Conectando ao CS2...</title>
  <style>
    body { background: #0b0f17; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131b2e; border: 1px solid #1e293b; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 480px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; }
    code { background: #0f172a; padding: 0.4rem 0.8rem; border-radius: 0.375rem; color: #fbbf24; font-size: 1.1rem; display: inline-block; margin-bottom: 1rem; }
    .btn { display: inline-block; margin-top: 1.25rem; background: #22c55e; color: #fff; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 CONECTANDO AO SERVIDOR CS2</h1>
    <p>Iniciando o Counter-Strike 2 pela Steam...</p>
    <code>connect ${cleanIp}</code>
    <br>
    <a href="${steamUrl}" class="btn">Abrir CS2 Novamente</a>
  </div>
  <script>
    window.location.href = "${steamUrl}";
  </script>
</body>
</html>`);
});

// ==========================================
// PLAYER PROFILE & GAMERS CLUB MODAL
// ==========================================
app.get(['/perfil', '/gc', '/profile'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).type('html').send(renderProfileHtml({ query: req.query }));
});

app.get('/api/player/profile', (req, res) => {
  const id = req.query.id || req.query.userId || null;
  if (!id) return res.status(400).json({ success: false, error: 'Identificador ausente.' });

  const profiles = discordBotManager.loadPlayerProfiles();
  const profile = profiles[id] || null;
  return res.json({ success: true, profile });
});

app.post('/api/player/profile', (req, res) => {
  const { id, userId, name, username, level, steamId } = req.body || {};
  const cleanId = id || userId;
  const cleanName = String(name || username || 'Jogador').trim();
  const parsedLevel = parseInt(level, 10);

  if (isNaN(parsedLevel) || parsedLevel < 1 || parsedLevel > 21) {
    return res.status(400).json({ success: false, error: 'O nível Gamers Club deve ser entre 1 e 21.' });
  }

  const profileData = {
    level: parsedLevel,
    username: cleanName,
    name: cleanName,
    steamId: steamId ? String(steamId).trim() : '',
    source: 'web_form',
    updatedAt: Date.now(),
  };

  if (cleanId) {
    discordBotManager.setPlayerProfile(cleanId, profileData);
  }

  scheduleSave(100);
  return res.json({ success: true, profile: profileData });
});

// WhatsApp bot foi removido permanentemente — rotas retornam 404 automaticamente

app.post('/api/discord/announce-match', async (req, res) => {
  try {
    const mixId = req.body.mixId || 'MIX-U9AOI';
    let mix = null;
    if (discordBotManager?.activeMixes) {
      for (const m of discordBotManager.activeMixes.values()) {
        if (m && m.id === mixId) {
          mix = m;
          break;
        }
      }
    }
    if (!mix && typeof rooms !== 'undefined') {
      const room = rooms.get(mixId);
      if (room) mix = room;
    }
    if (!mix) {
      return res.status(404).json({ success: false, error: 'mix_not_found' });
    }

    const channelId = req.body.channelId || mix.channelId || '933123227402797088';
    const channel = await discordBotManager.client?.channels?.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ success: false, error: 'channel_not_found' });
    }

    const embed = discordBotManager.buildMatchReadyEmbed(mix);
    const components = discordBotManager.buildMatchReadyButtons(mix);

    const sent = await channel.send({
      content:
        `🚨 **ATENÇÃO TODOS OS JOGADORES — O MAPA DA PARTIDA FOI DEFINIDO!**\n\n` +
        `🗺️ **MAPA OFICIAL:** ☢️ **NUKE (de_nuke)**\n` +
        `🛡️ **Time A (CT):** Capitão <@${mix.teamA?.captain?.id || '372168272575201290'}>\n` +
        `💣 **Time B (TR):** Capitão <@${mix.teamB?.captain?.id || '212353154531065857'}>\n\n` +
        `💻 **Comando de Conexão no CS2:** \`connect ${(mix.serverIp || '103.14.27.41:25054').replace(/^connect\s+/i, '')}\`\n` +
        `🚀 **Steam 1-Clique:** Clique no botão verde abaixo para entrar no servidor automaticamente!`,
      embeds: [embed],
      components,
    });

    res.json({ success: true, messageId: sent.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get active rooms (runs inactivity cleanup first)
app.get('/api/rooms', (req, res) => {
  cleanupInactiveRooms();
  const list = [];
  rooms.forEach((r) => {
    if (r.isPrivate) return; // Hide private/unlisted rooms from public discovery
    list.push({
      id: r.id,
      name: r.name,
      playerCount: r.players.length,
      phase: r.phase,
      rankingSystem: r.rankingSystem || 'gc',
      hasServer: Boolean(r.serverIp && r.serverIp.trim()),
      serverIp: r.serverIp || '',
      hasPassword: Boolean(r.password && r.password.trim()),
      isPrivate: false,
      creatorNick: r.creatorNick || null,
      createdAt: r.createdAt,
      lastActivity: r.lastActivity || r.createdAt,
    });
  });
  res.json(list);
});

// Delete Room via REST API
app.delete('/api/rooms/:roomId', (req, res) => {
  const cleanRoomId = (req.params.roomId || '').trim().toUpperCase();
  if (!rooms.has(cleanRoomId)) {
    return res.status(404).json({ error: 'Sala não encontrada' });
  }

  const room = rooms.get(cleanRoomId);
  const roomName = room.name || cleanRoomId;

  console.log(`[API_DELETE] Sala ${cleanRoomId} excluída via API DELETE.`);
  io.to(cleanRoomId).emit('room_deleted', {
    roomId: cleanRoomId,
    reason: 'manual',
    message: `A sala ${roomName} foi excluída.`,
  });

  rooms.delete(cleanRoomId);
  broadcastRoomsList();

  res.json({ success: true, message: `Sala ${cleanRoomId} excluída com sucesso.` });
});

// Official CS2 Active Duty Map Rotation API
app.get('/api/maps/rotation', (req, res) => {
  res.json(getCurrentRotationState());
});

app.get('/api/maps/active-duty', (req, res) => {
  const state = getCurrentRotationState();
  res.json({
    pool: 'Valve Official Active Duty',
    count: state.activeDutyMaps.length,
    description: 'Rotação Oficial Competitiva Mundial CS2',
    source: state.source,
    sourceUrl: state.sourceUrl,
    lastSync: state.lastSync,
    maps: state.activeDutyMaps,
    extraMaps: state.extraMaps,
  });
});

// Live Sync from reliable web source (Wikipedia / Valve Esports Records) with Rate Limiting
app.post('/api/maps/sync-rotation', sensitiveLimiter, async (req, res) => {
  try {
    const updatedState = await fetchLiveOfficialRotation();
    io.emit('active_rotation_updated', updatedState);

    // Update rooms in lobby
    rooms.forEach((r) => {
      if (r.phase === 'lobby') {
        r.maps = [...updatedState.activeDutyMaps];
        emitRoomState(r.id, r);
      }
    });

    res.json({ success: true, ...updatedState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Official CS2 Grenade Playbook (100% Brazilian Portuguese Curated Videos)
app.get('/api/grenades', (req, res) => {
  res.json(getGrenadesState());
});

// Official PC Gamer Hardware Deals (KaBuM!, Pichau, TerabyteShop)
app.get('/api/hardware/deals', async (req, res) => {
  try {
    const { category, store, query, limit } = req.query;
    const deals = await hardwareDealsManager.getDeals({
      category,
      store,
      query,
      limit: Math.min(20, parseInt(limit, 10) || 8),
    });
    res.json({ success: true, count: deals.length, deals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Official Valve CS2 Release Notes & Updates
app.get('/api/cs2/patchnotes', async (req, res) => {
  try {
    const patch = await cs2NewsRadar.fetchLatestPatch();
    res.json({ success: true, patch });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Esports Pro Matches Agenda (FURIA, MIBR, paiN, Imperial)
app.get('/api/esports/pro-matches', async (req, res) => {
  try {
    const matches = await proMatchesAgenda.getUpcomingMatches();
    res.json({ success: true, count: matches.length, matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Free PC Games Radar (Epic Games Store & Steam)
app.get('/api/games/free', async (req, res) => {
  try {
    const data = await freeGamesRadar.getAllFreeGames();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Steam Profile & Anti-Smurf Scanner API
app.get('/api/steam/scan', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, error: 'Parâmetro query é obrigatório' });
    const scan = await SteamScannerService.scanProfile(query);
    res.json({ success: true, scan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Community Clips Showcase
app.get('/api/community/clips', (req, res) => {
  try {
    const list = Array.from(communityClips.clips.values());
    res.json({ success: true, count: list.length, clips: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/grenades/sync', sensitiveLimiter, async (req, res) => {
  try {
    const updated = await syncGrenadesPtBr();
    io.emit('grenades_feed_updated', updated);
    res.json({ success: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function parseHostPort(raw) {
  if (!raw) return { host: '127.0.0.1', port: 27015 };
  let str = raw.trim().replace(/^connect\s+/i, '').replace(/;.*$/, '');
  const colonIdx = str.lastIndexOf(':');
  if (colonIdx !== -1) {
    const host = str.substring(0, colonIdx).trim();
    const port = Number(str.substring(colonIdx + 1).trim()) || 27015;
    return { host, port };
  }
  return { host: str, port: 27015 };
}

// ----------------------------------------------------
// VALVE OFFICIAL INTEGRATIONS: GSI, RCON & STEAM API
// ----------------------------------------------------

// GSI Discord Tracker (Evita envio duplicado de mensagens para o mesmo round/bomba)
const gsiDiscordTracker = new Map();

function processGsiDiscordNotifications(room, liveState, req) {
  if (!room || !room.discordWebhook || !isValidDiscordWebhookUrl(room.discordWebhook)) return;

  const roomId = room.id;
  let tracker = gsiDiscordTracker.get(roomId);
  if (!tracker) {
    tracker = { lastRound: -1, lastBombState: 'none', gameOverSent: false };
    gsiDiscordTracker.set(roomId, tracker);
  }

  // Se a partida estiver no aquecimento ou resetada, reinicia os estados de envio
  if (liveState.phase === 'warmup' || (liveState.roundNumber === 0 && liveState.roundPhase === 'freezetime')) {
    tracker.lastRound = -1;
    tracker.lastBombState = 'none';
    tracker.gameOverSent = false;
    return;
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const roomUrl = `${protocol}://${host}/?room=${encodeURIComponent(roomId)}`;

  // 1. Notificação de Fim de Round (Monitoramento de Placar e Vencedor)
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

  // 2. Alerta de C4 Armada / Defusada
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

  // 3. Notificação de Fim de Partida
  if (
    liveState.isGameOver &&
    !tracker.gameOverSent &&
    (liveState.phase === 'gameover' || liveState.scoreCT >= 13 || liveState.scoreTR >= 13)
  ) {
    tracker.gameOverSent = true;

    const winnerRes = determineMatchWinner(
      { teamA: room.teamA, teamB: room.teamB, ...room },
      liveState
    );
    const winner = winnerRes.winnerLetter === 'A' ? (room.nameA || 'Time A') : (room.nameB || 'Time B');
    sendDiscordWebhook({
      webhookUrl: room.discordWebhook,
      eventType: 'gsi_gameover',
      data: {
        roomName: room.name || roomId,
        mapName: liveState.mapName || 'CS2 Map',
        winner,
        scoreCT: liveState.scoreCT,
        scoreTR: liveState.scoreTR,
        nameA: room.nameA || 'Time A',
        nameB: room.nameB || 'Time B',
        allPlayersStats: liveState.allPlayersStats || [],
        topFragger: liveState.topFragger || null,
        matchMvp: liveState.matchMvp || null,
        roomUrl,
      },
    }).catch((err) => console.error('[DISCORD GSI GAMEOVER ERROR]:', err.message));
  }
}

// Direct 1-Click local PC installation without downloading files
app.post('/api/gsi/install-local', (req, res) => {
  const roomId = (req.body?.roomId || 'MIX-PRO').trim().toUpperCase();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const serverBaseUrl = `${protocol}://${host}`;

  const result = installGsiLocally(serverBaseUrl, roomId);
  res.json(result);
});

// Check if GSI is installed in CS2 on the host PC
app.get('/api/gsi/check-installed', (req, res) => {
  const result = checkGsiInstalled();
  res.json(result);
});

// 1. Valve CS2 Game State Integration (GSI) Webhook
const CLOUD_BASE_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://mix-cs2.onrender.com').replace(/\/+$/, '');
const CLOUD_HEALTH_URL = `${CLOUD_BASE_URL}/api/health`;
const CLOUD_GSI_URL = process.env.CLOUD_GSI_URL || `${CLOUD_BASE_URL}/api/gsi/status/MIX-PRO`;
const IS_LOCAL_PC = process.platform === 'win32' && !process.env.RENDER && !process.env.RAILWAY_ENVIRONMENT;
let isCloudServerOnline = true;
let cloudFailCount = 0;

async function checkCloudServerHealth() {
  if (!IS_LOCAL_PC) return true;
  try {
    const res = await fetch(CLOUD_HEALTH_URL, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      cloudFailCount = 0;
      isCloudServerOnline = true;
      return true;
    }
  } catch (_) {}
  cloudFailCount += 1;
  if (cloudFailCount >= 2) {
    isCloudServerOnline = false;
  }
  return isCloudServerOnline;
}

function forwardGsiToCloudIfLocal(roomId, rawPayload, req) {
  if (!IS_LOCAL_PC || !rawPayload) return;
  if (req?.headers?.['x-gsi-relayed']) return;
  fetch(`${CLOUD_BASE_URL}/api/gsi/${encodeURIComponent(roomId || 'MIX-PRO')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GSI-Relayed': '1',
    },
    body: JSON.stringify(rawPayload),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});
}

app.post('/api/gsi/:roomId', (req, res) => {
  const roomId = (req.params.roomId || req.body?.auth?.token || 'MIX-PRO').trim().toUpperCase();
  const room = getRoomAndTouch(roomId);

  forwardGsiToCloudIfLocal(roomId, req.body, req);

  const liveState = handleGsiPayload(roomId, req.body);
  if (liveState) {
    discordBotManager.handleGsiEvent(roomId, liveState);
    io.emit('gsi_update', liveState);

    if (room) {
      room.liveMatch = liveState;
      io.to(roomId).emit('gsi_update', liveState);
      processGsiDiscordNotifications(room, liveState, req);

      if (liveState.isGameOver && (liveState.phase === 'gameover' || (liveState.scoreCT || 0) >= 13 || (liveState.scoreTR || 0) >= 13)) {
        const winnerRes = determineMatchWinner(
          { teamA: room.teamA, teamB: room.teamB, ...room },
          liveState
        );
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
          emitRoomState(roomId, room);
        }
      }
    }
  }

  res.json({ success: true });
});

app.post('/api/gsi', (req, res) => {
  const token = (req.body?.auth?.token || 'MIX-PRO').trim().toUpperCase();
  forwardGsiToCloudIfLocal(token, req.body, req);

  const liveState = handleGsiPayload(token, req.body);
  if (liveState) {
    discordBotManager.handleGsiEvent(token, liveState);
    io.emit('gsi_update', liveState);
    rooms.forEach((room) => {
      room.liveMatch = liveState;
      io.to(room.id).emit('gsi_update', liveState);
      processGsiDiscordNotifications(room, liveState, req);
    });
  }
  res.json({ success: true });
});

let lastCloudGsiSync = 0;

async function syncCloudGsiBridge() {
  if (discordBotManager.lastGsiState && Date.now() - (discordBotManager.lastGsiState.receivedAt || 0) < 1500) {
    return;
  }
  try {
    const res = await fetch(CLOUD_GSI_URL, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.connected && data.lastUpdate && data.lastUpdate > lastCloudGsiSync) {
        lastCloudGsiSync = data.lastUpdate;
        const liveState = {
          ...data,
          receivedAt: Date.now(),
        };
        setGsiState('MIX-PRO', liveState);
        discordBotManager.handleGsiEvent('MIX-PRO', liveState);
        io.emit('gsi_update', liveState);
      }
    }
  } catch (err) {}
}

setInterval(syncCloudGsiBridge, 750);
// Download ready-to-use CS2 .cfg for FireGames or local client
app.get('/api/gsi/cfg/:roomId', (req, res) => {
  const roomId = req.params.roomId || 'MIX-PRO';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const serverBaseUrl = `${protocol}://${host}`;

  const cfgContent = generateGsiConfig(serverBaseUrl, roomId);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gamestate_integration_cs2mixhub.cfg"');
  res.send(cfgContent);
});

// Download Automated 1-Click Windows Installer (.bat)
app.get('/api/gsi/installer/:roomId', (req, res) => {
  const roomId = req.params.roomId || 'MIX-PRO';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const serverBaseUrl = `${protocol}://${host}`;

  const batContent = generateGsiBatchInstaller(serverBaseUrl, roomId);
  res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="instalar_monitoramento_cs2.bat"');
  res.send(batContent);
});

// Raw PowerShell 1-Click Script endpoint (for irm ... | iex)
app.get('/api/gsi/installer/ps1/:roomId', (req, res) => {
  const roomId = req.params.roomId || 'MIX-PRO';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const serverBaseUrl = `${protocol}://${host}`;

  const ps1Content = generateGsiPowerShellInstaller(serverBaseUrl, roomId);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(ps1Content);
});

// Check GSI connection status for a room
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

// MatchZy / PugSharp Tournament Config Provider (1-Click CS2 Dedicated Server Integration)
app.get('/api/matchzy/config/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms.get(roomId?.toUpperCase()) || getOrCreateRoom(roomId);

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

  const nameA = room.teamAName || room.teamA?.[0]?.nick ? `Time ${room.teamA[0].nick}` : 'Time A';
  const nameB = room.teamBName || room.teamB?.[0]?.nick ? `Time ${room.teamB[0].nick}` : 'Time B';

  const config = {
    matchid: room.id,
    num_maps: numMaps,
    maplist,
    map_sides: maplist.map(() => 'knife'),
    players_per_team: 5,
    min_players_to_ready: 10,
    team1: {
      name: nameA,
      tag: 'TIME_A',
      flag: 'BR',
      players: buildPlayers(room.teamA),
    },
    team2: {
      name: nameB,
      tag: 'TIME_B',
      flag: 'BR',
      players: buildPlayers(room.teamB),
    },
    cvars: {
      mp_overtime_enable: '1',
      mp_overtime_maxrounds: '6',
      mp_overtime_startmoney: '10000',
      mp_warmuptime: '300',
      sv_hibernate_when_empty: '0',
      tv_enable: '1',
      tv_record_match: '1',
    },
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(config);
});

// Detect Host Public IP for Local Server Hosting
app.get('/api/my-ip', (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  res.json({ ip });
});

// Detect Local Network (LAN) IPs for House LAN Parties
app.get('/api/lan-ip', async (req, res) => {
  try {
    const os = await import('os');
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push({ name, address: net.address });
        }
      }
    }
    return res.json({ ips });
  } catch (e) {
    return res.json({ ips: [] });
  }
});

// 2. Valve Source RCON Remote Management (FireGames / Dedicated Server) - Protected by rate limit & sanitization
app.post('/api/rcon/test', sensitiveLimiter, async (req, res) => {
  const { host, port, password } = req.body;
  try {
    const result = await executeRconCommand({ host, port, password, command: 'test' });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rcon/exec', sensitiveLimiter, async (req, res) => {
  const { host, port, password, command } = req.body;
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

// 2b. Valve CS2 Server Ping & Connectivity Status Tester
app.post('/api/server/ping', sensitiveLimiter, async (req, res) => {
  const { host, port } = req.body;
  try {
    const result = await pingCs2Server(host, port || 27015);
    res.json(result);
  } catch (err) {
    res.status(500).json({ online: false, error: err.message });
  }
});

// 2c. Port Reachability Checker (Tests if port 27015 is open on caller's public IP)
app.get('/api/server/check-port', sensitiveLimiter, async (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  const port = parseInt(req.query.port, 10) || 27015;
  try {
    const result = await pingCs2Server(ip, port, 2000);
    res.json({ clientIp: ip, port, reachable: result.online, pingMs: result.pingMs, error: result.error });
  } catch (err) {
    res.status(500).json({ clientIp: ip, port, reachable: false, error: err.message });
  }
});

// 3. Hall of Fame & Community Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  res.json(getLeaderboard());
});

app.post('/api/leaderboard/record', sensitiveLimiter, (req, res) => {
  const { winners, losers, map, scoreWinners, scoreLosers } = req.body;
  if (!Array.isArray(winners) || !Array.isArray(losers)) {
    return res.status(400).json({ error: 'Arrays de winners e losers são obrigatórios.' });
  }
  const updated = recordMatch({ winners, losers, map, scoreWinners, scoreLosers });
  io.emit('leaderboard_updated', updated);
  res.json({ success: true, leaderboard: updated });
});

// 3.1 Unified Match History API (Discord Bot + Web Platform)
app.get('/api/matches', (req, res) => {
  const { source, map, search, limit } = req.query;
  const state = getMatchHistoryState({ source, map, search, limit: parseInt(limit, 10) || 100 });
  res.json(state);
});

app.get('/api/matches/:id', (req, res) => {
  const all = getMatchHistoryState({ limit: 500 }).matches;
  const match = all.find((m) => m.id.toLowerCase() === (req.params.id || '').toLowerCase());
  if (!match) return res.status(404).json({ error: 'Mix não encontrado.' });
  res.json(match);
});

// 4. Discord Webhook Dispatcher
app.post('/api/discord/webhook', sensitiveLimiter, async (req, res) => {
  const { webhookUrl, eventType, data } = req.body;
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

// Discord Bot Voice Channel Verification & Mover
app.post('/api/discord/test-voice-channel', sensitiveLimiter, async (req, res) => {
  const { botToken, guildId, channelId } = req.body;
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

app.post('/api/discord/move-members', sensitiveLimiter, async (req, res) => {
  const { botToken, guildId, moves } = req.body;
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

// Official Discord Bot Engine Endpoints
app.get('/api/discord/bot/status', (req, res) => {
  res.json(discordBotManager.getStatus());
});
app.get('/api/discord/status', (req, res) => {
  res.json(discordBotManager.getStatus());
});
app.get('/api/deals', (req, res) => {
  res.redirect('/api/hardware/deals');
});

app.post('/api/discord/bot/config', sensitiveLimiter, async (req, res) => {
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
  } = req.body;

  discordBotManager.saveConfig({
    ...(token !== undefined ? { token: token.trim() } : {}),
    ...(clientId !== undefined ? { clientId: clientId.trim() } : {}),
    ...(guildId !== undefined ? { guildId: guildId.trim() } : {}),
    ...(defaultChannelId !== undefined ? { defaultChannelId: defaultChannelId.trim() } : {}),
    ...(lobbyVoiceId !== undefined ? { lobbyVoiceId: lobbyVoiceId.trim() } : {}),
    ...(teamAVoiceId !== undefined ? { teamAVoiceId: teamAVoiceId.trim() } : {}),
    ...(teamBVoiceId !== undefined ? { teamBVoiceId: teamBVoiceId.trim() } : {}),
    ...(autoMoveVoice !== undefined ? { autoMoveVoice: Boolean(autoMoveVoice) } : {}),
    ...(serverConnect !== undefined ? { serverConnect: (serverConnect || '').trim() } : {}),
    ...(dealsChannelId !== undefined ? { dealsChannelId: String(dealsChannelId || '').trim() } : {}),
    ...(dealsChannels !== undefined && typeof dealsChannels === 'object' ? { dealsChannels } : {}),
    ...(autoPostDeals !== undefined ? { autoPostDeals: Boolean(autoPostDeals) } : {}),
    ...(lastDealsDropAt !== undefined ? { lastDealsDropAt: Number(lastDealsDropAt) || Date.now() } : {}),
  });

  res.json({ success: true, status: discordBotManager.getStatus() });
});

app.post('/api/discord/bot/start', sensitiveLimiter, async (req, res) => {
  const result = await discordBotManager.start();
  res.json(result);
});

app.post('/api/discord/bot/stop', sensitiveLimiter, async (req, res) => {
  const result = await discordBotManager.stop();
  res.json(result);
});

app.post('/api/discord/bot/panel', sensitiveLimiter, async (req, res) => {
  const { channelId } = req.body;
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
    res.json({ success: true, channelName: channel.name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Valve Steam Web API (CS2 Hours, VAC Bans, Account Age)
app.get('/api/steam/player-stats/:steamId', async (req, res) => {
  try {
    const details = await getSteamPlayerDetails(req.params.steamId);
    res.json(details);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Steam OpenID Authentication Routes
app.get('/api/auth/steam', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const returnTo = `${protocol}://${host}/api/auth/steam/return`;
  const realm = `${protocol}://${host}/`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
});

app.get('/api/auth/steam/return', async (req, res) => {
  try {
    const claimedId = req.query['openid.claimed_id'];
    const steamIdMatch = claimedId && claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);

    if (!steamIdMatch) {
      return res.redirect(`/?steam_error=invalid_id`);
    }

    const steamId = steamIdMatch[1];

    // Validate authentication with Steam
    const validateParams = new URLSearchParams();
    for (const [key, val] of Object.entries(req.query)) {
      validateParams.append(key, val);
    }
    validateParams.set('openid.mode', 'check_authentication');

    const authRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: validateParams.toString(),
    });

    const authText = await authRes.text();
    if (!authText.includes('is_valid:true')) {
      return res.redirect(`/?steam_error=auth_failed`);
    }

    // Fetch user profile from public Steam XML feed (No API Key required)
    let nick = `Player_${steamId.slice(-4)}`;
    let avatar = '';

    try {
      const profileRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
      if (profileRes.ok) {
        const xml = await profileRes.text();
        const nickMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
        const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || xml.match(/<avatarFull>(.*?)<\/avatarFull>/);
        if (nickMatch) nick = nickMatch[1];
        if (avatarMatch) avatar = avatarMatch[1];
      }
    } catch (e) {
      console.error('Error fetching steam XML profile:', e);
    }

    // Attempt automatic FACEIT stats lookup via Steam ID & Nickname
    let faceitLevel = 5;
    let faceitElo = 1200;
    let faceitFound = 0;
    const faceitResult = await fetchFaceitPlayer({ steamId, nickname: nick });
    if (faceitResult && faceitResult.found) {
      faceitLevel = faceitResult.level;
      faceitElo = faceitResult.elo;
      faceitFound = 1;
    }

    // Attempt automatic Steam CS2 Hours & Stats lookup
    let cs2Hours = '';
    try {
      const steamDetails = await getSteamPlayerDetails(steamId);
      if (steamDetails && steamDetails.cs2Hours) {
        cs2Hours = steamDetails.cs2Hours;
      }
    } catch (e) {}

    // Redireciona sempre para a tela inicial (Landing), garantindo que ao fazer o login
    // a pessoa veja a tela inicial e não caia diretamente dentro de uma sala de mix criada.
    res.redirect(
      `/?steam_auth=1&steamId=${steamId}&nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}&faceitLevel=${faceitLevel}&faceitElo=${faceitElo}&faceitFound=${faceitFound}&cs2Hours=${encodeURIComponent(cs2Hours)}`
    );
  } catch (err) {
    console.error('Steam Auth Error:', err);
    res.redirect(`/?steam_error=server_error`);
  }
});

// Dedicated FACEIT lookup API by Steam ID or Nickname
app.get('/api/faceit/:steamId', async (req, res) => {
  const { steamId } = req.params;
  const nickname = req.query.nickname || '';
  try {
    const faceitResult = await fetchFaceitPlayer({ steamId, nickname });
    if (faceitResult && faceitResult.found) {
      return res.json({
        success: true,
        found: true,
        nickname: faceitResult.nickname,
        level: faceitResult.level,
        elo: faceitResult.elo,
      });
    }
    return res.json({
      success: true,
      found: false,
      message: 'Conta FACEIT não vinculada a este jogador.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

registerMatchAutomationRoutes(app, { io, discordBotManager });

app.use((req, res) => {
  return serveDynamicIndexHtml(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 [CS2 MIX HUB] Servidor rodando na porta ${PORT} em 0.0.0.0`);
  setPersistenceRefs(rooms, discordBotManager);
  if (persistedMixState && Array.isArray(persistedMixState.discordMixes)) {
    for (const item of persistedMixState.discordMixes) {
      if (item && item.channelId && item.mix && item.mix.phase !== 'finished' && item.mix.phase !== 'cancelled') {
        discordBotManager.activeMixes.set(item.channelId, item.mix);
        if (item.mix.id) discordBotManager.activeMixes.set(item.mix.id, item.mix);
        console.log(`💾 [PERSISTÊNCIA] Mix ${item.mix.id} (${item.mix.name}, ${item.mix.players?.length || 0}/10 jogadores) restaurado no Discord!`);
      }
    }
  }
  discordBotManager.setWebRoomsReference(rooms);
  discordBotManager.onRoomUpdated = (roomId, room) => {
    if (room) {
      emitRoomState(roomId, room);
    }
    broadcastRoomsList();
    scheduleSave();
  };
  discordBotManager.onMatchRecorded = (match) => {
    io.emit('match_history_updated', getMatchHistoryState());
    io.emit('leaderboard_updated', getLeaderboard());
  };
  onMatchHistoryUpdated(() => {
    io.emit('match_history_updated', getMatchHistoryState());
  });

  const ensureBotOnline = async () => {
    const hasLocalToken = Boolean(discordBotManager.config.token || process.env.DISCORD_BOT_TOKEN);
    if (!hasLocalToken) return;

    // Se estiver rodando no PC Local, verifica se o Servidor Online (Render/Railway) esta no ar!
    // O PC Local fica em Standby e SO assume se o Servidor Online cair!
    if (IS_LOCAL_PC) {
      const onlineUp = await checkCloudServerHealth();
      if (onlineUp) {
        if (discordBotManager.getStatus().running) {
          console.log('\u2601\ufe0f [FAILOVER] Servidor Online Principal detectado no ar! Colocando Bot Local em Standby para evitar duplicidade...');
          await discordBotManager.stop().catch(() => {});
        }
        return;
      }
      if (!discordBotManager.getStatus().running) {
        console.warn('\ud83d\udea8 [FAILOVER] Servidor Online fora do ar! Servidor Local assumindo o Bot do Discord automaticamente...');
        await discordBotManager.start().catch((err) => {
          console.warn('[DISCORD BOT] Aviso ao inicializar bot local em modo failover:', err.message);
        });
      }
      return;
    }

    // No Servidor Online (Render/Railway), ele e o Principal e fica sempre ligado
    if (!discordBotManager.getStatus().running) {
      await discordBotManager.start().catch((err) => {
        console.warn('[DISCORD BOT] Aviso ao inicializar bot principal:', err.message);
      });
    }
  };

  ensureBotOnline();
  setInterval(ensureBotOnline, 20000);
});
// Graceful shutdown for Railway & container orchestrators
const shutdown = (signal) => {
  console.log(`🛑 [CS2 MIX HUB] Recebido ${signal}, salvando mixes e encerrando servidor graciosamente...`);
  try {
    saveActiveMixStateNow();
  } catch (_) {}
  server.close(() => {
    console.log('✓ Servidor encerrado com sucesso.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 4000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('beforeExit', () => {
  try {
    saveActiveMixStateNow();
  } catch (_) {}
});
process.on('SIGINT', () => shutdown('SIGINT'));
