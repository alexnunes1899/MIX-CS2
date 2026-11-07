import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLiveOfficialRotation, getCurrentRotationState, ALL_MAPS_CATALOGUE } from './mapSync.js';
import { executeRconCommand } from './rcon.js';
import { handleGsiPayload, getGsiState, generateGsiConfig } from './gsi.js';
import { getSteamPlayerDetails } from './steamApi.js';
import { fetchFaceitPlayer } from './faceit.js';
import { sendDiscordWebhook, isValidDiscordWebhookUrl } from './discordWebhook.js';
import { getLeaderboard, recordMatch } from './leaderboard.js';
import { pingCs2Server } from './serverQuery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// In-memory rooms
const rooms = new Map();

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
      currentTurn: 'teamA',
      finalMap: null,
      startingSideTeamB: null,
      serverIp: serverIp ? serverIp.trim() : '',
      rconPassword: '',
      password: (password || '').trim(),
      isPrivate: Boolean(isPrivate),
      inviteKey: finalInviteKey,
      discordWebhook: '',
      discordAutoLobby: true,
      discordAutoVeto: true,
      discordGsiRounds: true,
      discordGsiBomb: false,
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
  sendDiscordWebhook({
    webhookUrl: room.discordWebhook,
    eventType: 'mix_ready',
    data: {
      roomName: room.name || 'MIX',
      mapName: room.finalMap?.name || 'Mirage',
      mapFile: room.finalMap?.file || 'de_mirage',
      mapImage: room.finalMap?.image || '',
      mapLogo: room.finalMap?.logo || '',
      matchFormat: room.matchFormat || 'MD1',
      nameA: `Time ${creatorNick}`,
      nameB: `Time Oponente`,
      sideA,
      sideB,
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
      // 1. Gamers Club style Private Room check: ONLY enters via direct invite link or matching key
      if (existingRoom.isPrivate) {
        const matchesKey = cleanKey && existingRoom.inviteKey && cleanKey === existingRoom.inviteKey;
        const matchesPassword = cleanPassword && existingRoom.password && cleanPassword === existingRoom.password;
        const isKnownPlayer = player?.id && existingRoom.players.some((p) => p.id === player.id);
        const isCreator = (socket.playerId && existingRoom.creatorId === socket.playerId) ||
                          (player?.steamId && existingRoom.creatorSteamId === player.steamId);

        if (!matchesKey && !matchesPassword && !isKnownPlayer && !isCreator) {
          socket.emit('room_auth_error', {
            roomId: cleanRoomId,
            roomName: existingRoom.name,
            error: 'private_room',
            message: 'Esta sala é privada (estilo Gamers Club). O acesso é exclusivo via link direto de convite.',
          });
          return;
        }
      } else if (existingRoom.password) {
        // Public room with password (if configured)
        if (cleanPassword !== existingRoom.password) {
          socket.emit('room_auth_error', {
            roomId: cleanRoomId,
            roomName: existingRoom.name,
            error: 'wrong_password',
            message: cleanPassword ? 'Senha incorreta para esta sala.' : 'Esta sala requer uma senha para entrar.',
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

  // Winner of coin picks to ban first or pass
  socket.on('coin_choice', ({ roomId, choice }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'coin_flip' || !room.coin) return;

    room.coin.choice = choice; // 'first' or 'pass'
    if (choice === 'first') {
      room.currentTurn = room.coin.winner;
    } else {
      room.currentTurn = room.coin.winner === 'teamA' ? 'teamB' : 'teamA';
    }
    room.phase = 'veto';
    room.bannedMaps = [];
    room.finalMap = null;
    room.startingSideTeamB = null;

    emitRoomState(roomId, room);
  });

  // Start Veto Phase directly
  socket.on('start_veto', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    room.phase = 'veto';
    room.bannedMaps = [];
    room.currentTurn = 'teamA';
    room.finalMap = null;
    room.startingSideTeamB = null;

    emitRoomState(roomId, room);
  });

  // Quick Start Veto (when teams are already formed)
  socket.on('quick_start_veto', ({ roomId, teamAName, teamBName }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    room.phase = 'veto';
    room.bannedMaps = [];
    room.currentTurn = 'teamA';
    room.finalMap = null;
    room.startingSideTeamB = null;

    if (room.teamA.length === 0) {
      room.teamA = [{ id: 't1', nick: teamAName || 'Time A', level: 15, avatar: '🛡️' }];
    }
    if (room.teamB.length === 0) {
      room.teamB = [{ id: 't2', nick: teamBName || 'Time B', level: 15, avatar: '⚔️' }];
    }
    emitRoomState(roomId, room);
  });

  // Quick Random Map Draw (Supports MD1, MD3, MD5)
  socket.on('quick_random_map', ({ roomId, map, startingSide, matchFormat = 'MD1', drawnSeries = [] }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const chosenMap = map || room.maps[Math.floor(Math.random() * room.maps.length)];
    room.finalMap = chosenMap;
    room.startingSideTeamB = startingSide || (Math.random() < 0.5 ? 'CT' : 'TR');
    room.matchFormat = matchFormat || 'MD1';
    room.drawnSeries = Array.isArray(drawnSeries) && drawnSeries.length > 0
      ? drawnSeries
      : [{ map: chosenMap, sideTimeA: startingSide || 'CT', role: 'Mapa 1' }];
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

  // Ban Map
  socket.on('ban_map', ({ roomId, mapId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'veto') return;
    if (room.bannedMaps.some((b) => b.mapId === mapId)) return;

    room.bannedMaps.push({
      mapId,
      bannedBy: room.currentTurn,
      timestamp: Date.now(),
    });

    const remaining = room.maps.filter((m) => !room.bannedMaps.some((b) => b.mapId === m.id));

    if (remaining.length === 1) {
      room.finalMap = remaining[0];
      room.phase = 'side_pick';
    } else {
      room.currentTurn = room.currentTurn === 'teamA' ? 'teamB' : 'teamA';
    }

    emitRoomState(roomId, room);
  });

  // Side Pick (CT / TR) on decider map
  socket.on('select_side', ({ roomId, side }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'side_pick') return;

    room.startingSideTeamB = side;
    room.phase = 'finished';

    dispatchAutoDiscordVeto(room);
    emitRoomState(roomId, room);
  });

  // Save match score to history
  socket.on('save_score', ({ roomId, scoreA, scoreB }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const numA = Number(scoreA) || 0;
    const numB = Number(scoreB) || 0;

    room.history.unshift({
      id: `match-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      map: room.finalMap?.name || 'Indefinido',
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
        map: room.finalMap?.name || 'Indefinido',
        scoreWinners: numA,
        scoreLosers: numB,
      });
      io.emit('leaderboard_updated', updated);
    } else if (numB > numA && room.teamB.length > 0) {
      const updated = recordMatch({
        winners: room.teamB,
        losers: room.teamA,
        map: room.finalMap?.name || 'Indefinido',
        scoreWinners: numB,
        scoreLosers: numA,
      });
      io.emit('leaderboard_updated', updated);
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

  // Reset to Lobby
  socket.on('reset_mix', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    room.phase = 'lobby';
    room.teamA = [];
    room.teamB = [];
    room.metrics = null;
    room.bannedMaps = [];
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
  socket.on('set_discord_webhook', ({ roomId, webhookUrl, autoLobby = true, autoVeto = true, autoGsiRounds = true, autoGsiBomb = false }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.discordWebhook = (webhookUrl || '').trim();
    room.discordAutoLobby = Boolean(autoLobby);
    room.discordAutoVeto = Boolean(autoVeto);
    room.discordGsiRounds = Boolean(autoGsiRounds);
    room.discordGsiBomb = Boolean(autoGsiBomb);
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
app.use(express.static(distPath, {
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

app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString(), activeRooms: rooms.size });
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

    const winner = liveState.scoreCT > liveState.scoreTR ? 'Time CT' : liveState.scoreTR > liveState.scoreCT ? 'Time TR' : 'Empate';
    sendDiscordWebhook({
      webhookUrl: room.discordWebhook,
      eventType: 'gsi_gameover',
      data: {
        roomName: room.name || roomId,
        mapName: liveState.mapName || 'CS2 Map',
        winner,
        scoreCT: liveState.scoreCT,
        scoreTR: liveState.scoreTR,
        roomUrl,
      },
    }).catch((err) => console.error('[DISCORD GSI GAMEOVER ERROR]:', err.message));
  }
}

// 1. Valve CS2 Game State Integration (GSI) Webhook
app.post('/api/gsi/:roomId', (req, res) => {
  const roomId = (req.params.roomId || req.body?.auth?.token || 'MIX-PRO').trim().toUpperCase();
  const room = getRoomAndTouch(roomId);

  const liveState = handleGsiPayload(roomId, req.body);
  if (room && liveState) {
    room.liveMatch = liveState;

    // Broadcast GSI real-time event to everyone in this room
    io.to(roomId).emit('gsi_update', liveState);

    // Dispara notificações automáticas de round, C4 e vitória no Discord
    processGsiDiscordNotifications(room, liveState, req);

    // If game ended, record score automatically in history
    if (liveState.isGameOver && liveState.phase === 'gameover') {
      const matchKey = `${liveState.mapName}-${liveState.scoreCT}-${liveState.scoreTR}`;
      const lastMatch = room.history[0];
      if (!lastMatch || lastMatch.key !== matchKey) {
        room.history.unshift({
          id: `match-gsi-${Date.now()}`,
          key: matchKey,
          date: new Date().toLocaleDateString('pt-BR'),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          map: liveState.mapName,
          scoreA: liveState.scoreCT,
          scoreB: liveState.scoreTR,
          winner: liveState.scoreCT > liveState.scoreTR ? 'Time CT' : liveState.scoreTR > liveState.scoreCT ? 'Time TR' : 'Empate',
          source: 'Valve CS2 GSI',
        });
        if (room.history.length > 20) room.history.pop();
        emitRoomState(roomId, room);
      }
    }
  }

  res.json({ success: true });
});

// Fallback GSI endpoint (CS2 sent without roomId in path)
app.post('/api/gsi', (req, res) => {
  const token = (req.body?.auth?.token || 'MIX-PRO').trim().toUpperCase();
  const liveState = handleGsiPayload(token, req.body);
  if (liveState) {
    rooms.forEach((room) => {
      room.liveMatch = liveState;
      io.to(room.id).emit('gsi_update', liveState);
      processGsiDiscordNotifications(room, liveState, req);
    });
  }
  res.json({ success: true });
});

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

// Check GSI connection status for a room
app.get('/api/gsi/status/:roomId', (req, res) => {
  const state = getGsiState(req.params.roomId);
  res.json(state);
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

app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <html>
          <body style="background:#090d16;color:#f1f5f9;font-family:sans-serif;text-align:center;padding:50px;">
            <h1>CS2 Mix Hub Backend Running!</h1>
            <p>Port: ${PORT}</p>
          </body>
        </html>
      `);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 [CS2 MIX HUB] Servidor rodando na porta ${PORT} em 0.0.0.0`);
});

// Graceful shutdown for Railway & container orchestrators
const shutdown = (signal) => {
  console.log(`🛑 [CS2 MIX HUB] Recebido ${signal}, encerrando servidor graciosamente...`);
  server.close(() => {
    console.log('✓ Servidor encerrado com sucesso.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 4000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
