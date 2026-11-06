import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLiveOfficialRotation, getCurrentRotationState, ALL_MAPS_CATALOGUE } from './mapSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const isDev = process.argv.includes('--dev');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const PORT = process.env.PORT || (portArg ? Number(portArg.split('=')[1]) : (isDev ? 3001 : 3000));

// Live CS2 Active Duty Map Pool Sync (Wikipedia / Valve Esports Records)
fetchLiveOfficialRotation()
  .then(() => console.log('[SERVER] Rotação oficial inicializada com sucesso.'))
  .catch((err) => console.warn('[SERVER] Erro na rotação oficial inicial:', err.message));

// Periodic rotation re-check every 12 hours
setInterval(() => {
  fetchLiveOfficialRotation().catch(() => {});
}, 12 * 60 * 60 * 1000);

const MOCK_BOTS = [
  { id: 'bot-1', nick: 'FalleN', level: 21, faceitLevel: 10, faceitElo: 2840, side: 'CT', ready: true, avatar: '👑' },
  { id: 'bot-2', nick: 'coldzera', level: 20, faceitLevel: 10, faceitElo: 2750, side: 'TR', ready: true, avatar: '🎯' },
  { id: 'bot-3', nick: 'fer', level: 19, faceitLevel: 10, faceitElo: 2620, side: 'TR', ready: true, avatar: '⚡' },
  { id: 'bot-4', nick: 'fnx', level: 18, faceitLevel: 9, faceitElo: 2280, side: 'ANY', ready: true, avatar: '🔥' },
  { id: 'bot-5', nick: 'TACO', level: 17, faceitLevel: 9, faceitElo: 2150, side: 'CT', ready: true, avatar: '🛡️' },
  { id: 'bot-6', nick: 'kNgV-', level: 20, faceitLevel: 10, faceitElo: 2710, side: 'TR', ready: true, avatar: '💀' },
  { id: 'bot-7', nick: 'felps', level: 19, faceitLevel: 10, faceitElo: 2590, side: 'TR', ready: true, avatar: '🚀' },
  { id: 'bot-8', nick: 'boltz', level: 18, faceitLevel: 9, faceitElo: 2310, side: 'CT', ready: true, avatar: '💣' },
  { id: 'bot-9', nick: 'yel', level: 17, faceitLevel: 8, faceitElo: 1980, side: 'CT', ready: true, avatar: '🦅' },
  { id: 'bot-10', nick: 'bit', level: 16, faceitLevel: 8, faceitElo: 1920, side: 'CT', ready: true, avatar: '🧠' },
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

function getOrCreateRoom(roomId, customName = '', rankingSystem = 'gc', serverIp = '') {
  const id = roomId.trim().toUpperCase() || 'MIX-1';
  if (!rooms.has(id)) {
    const now = Date.now();
    rooms.set(id, {
      id,
      name: customName || `Mix ${id}`,
      createdAt: now,
      lastActivity: now,
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
    list.push({
      id: r.id,
      name: r.name,
      playerCount: r.players.length,
      phase: r.phase,
      rankingSystem: r.rankingSystem || 'gc',
      hasServer: Boolean(r.serverIp && r.serverIp.trim()),
      serverIp: r.serverIp || '',
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

io.on('connection', (socket) => {
  // Get active rooms list
  socket.on('get_rooms_list', () => {
    broadcastRoomsList();
  });

  // Join Room
  socket.on('join_room', ({ roomId, player, roomName, rankingSystem, serverIp }) => {
    const cleanRoomId = (roomId || 'MIX-1').trim().toUpperCase();
    if (socket.roomId && socket.roomId !== cleanRoomId) {
      socket.leave(socket.roomId);
    }
    socket.join(cleanRoomId);
    socket.roomId = cleanRoomId;

    const room = getOrCreateRoom(cleanRoomId, roomName, rankingSystem, serverIp);
    if (rankingSystem && room.players.length === 0) {
      room.rankingSystem = rankingSystem === 'faceit' ? 'faceit' : 'gc';
    }
    if (serverIp && serverIp.trim()) {
      room.serverIp = serverIp.trim();
    }

    if (player && player.nick) {
      socket.playerId = player.id || socket.id;
      const existingIdx = room.players.findIndex((p) => p.id === socket.playerId || (p.nick === player.nick && !p.id.startsWith('bot-')));
      
      const parsedLevel = Math.max(1, Math.min(21, Number(player.level) || 10));
      const parsedFaceitLvl = player.faceitLevel
        ? Math.max(1, Math.min(10, Number(player.faceitLevel)))
        : (parsedLevel <= 10 ? parsedLevel : Math.round(parsedLevel / 2.1));

      const playerData = {
        id: socket.playerId,
        nick: player.nick.trim(),
        level: parsedLevel,
        faceitLevel: parsedFaceitLvl,
        faceitElo: player.faceitElo ? Number(player.faceitElo) : null,
        side: player.side || 'ANY',
        avatar: player.avatar || '🎯',
        steamId: player.steamId || null,
        ready: player.ready !== undefined ? player.ready : false,
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
    }

    io.to(cleanRoomId).emit('room_state', room);
    broadcastRoomsList();
  });

  // Toggle Ranking System (GC vs FACEIT)
  socket.on('change_ranking_system', ({ roomId, rankingSystem }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.rankingSystem = rankingSystem === 'faceit' ? 'faceit' : 'gc';
    io.to(roomId).emit('room_state', room);
    broadcastRoomsList();
  });

  // Toggle ready status
  socket.on('toggle_ready', ({ roomId, playerId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.ready = !player.ready;
      io.to(roomId).emit('room_state', room);
    }
  });

  // Chat message
  socket.on('send_chat', ({ roomId, message }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || !message || !message.text) return;

    const chatMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: message.sender,
      text: message.text.slice(0, 200),
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
    room.serverIp = serverIp ? serverIp.trim() : '';
    io.to(roomId).emit('room_state', room);
  });

  // Add / Update Player
  socket.on('update_player', ({ roomId, player }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || !player) return;

    const idx = room.players.findIndex((p) => p.id === player.id);
    if (idx >= 0) {
      room.players[idx] = { ...room.players[idx], ...player };
      io.to(roomId).emit('room_state', room);
    }
  });

  // Remove Player
  socket.on('remove_player', ({ roomId, playerId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    io.to(roomId).emit('room_state', room);
    broadcastRoomsList();
  });

  // Fill Mock Bots for fast testing
  socket.on('fill_mock_bots', ({ roomId }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;
    room.players = JSON.parse(JSON.stringify(MOCK_BOTS));
    io.to(roomId).emit('room_state', room);
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
    io.to(roomId).emit('room_state', room);
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
    io.to(roomId).emit('room_state', room);
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

    io.to(roomId).emit('room_state', room);
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

    io.to(roomId).emit('room_state', room);
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
    io.to(roomId).emit('room_state', room);
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

    io.to(roomId).emit('room_state', room);
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

    io.to(roomId).emit('room_state', room);
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
    io.to(roomId).emit('room_state', room);
  });

  // Quick Random Map Draw
  socket.on('quick_random_map', ({ roomId, map, startingSide }) => {
    const room = getRoomAndTouch(roomId);
    if (!room) return;

    const chosenMap = map || room.maps[Math.floor(Math.random() * room.maps.length)];
    room.finalMap = chosenMap;
    room.startingSideTeamB = startingSide || (Math.random() < 0.5 ? 'CT' : 'TR');
    room.phase = 'finished';

    if (room.teamA.length === 0) {
      room.teamA = [{ id: 't1', nick: 'Time A', level: 15, avatar: '🛡️' }];
    }
    if (room.teamB.length === 0) {
      room.teamB = [{ id: 't2', nick: 'Time B', level: 15, avatar: '⚔️' }];
    }

    io.to(roomId).emit('room_state', room);
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

    io.to(roomId).emit('room_state', room);
  });

  // Side Pick (CT / TR) on decider map
  socket.on('select_side', ({ roomId, side }) => {
    const room = getRoomAndTouch(roomId);
    if (!room || room.phase !== 'side_pick') return;

    room.startingSideTeamB = side;
    room.phase = 'finished';

    io.to(roomId).emit('room_state', room);
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
    io.to(roomId).emit('room_state', room);
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
    io.to(roomId).emit('room_state', room);
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

    // unready players
    room.players.forEach((p) => { p.ready = false; });

    io.to(roomId).emit('room_state', room);
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
          io.to(r.id).emit('room_state', r);
        }
      });
    } catch (err) {
      console.warn('[SOCKET] Erro ao sincronizar rotação oficial:', err.message);
    }
  });

  socket.on('disconnect', () => {
    // Keep slots
  });
});

// Serve frontend build if dist folder exists
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), activeRooms: rooms.size });
});

// Get active rooms (runs inactivity cleanup first)
app.get('/api/rooms', (req, res) => {
  cleanupInactiveRooms();
  const list = [];
  rooms.forEach((r) => {
    list.push({
      id: r.id,
      name: r.name,
      playerCount: r.players.length,
      phase: r.phase,
      rankingSystem: r.rankingSystem || 'gc',
      hasServer: Boolean(r.serverIp && r.serverIp.trim()),
      serverIp: r.serverIp || '',
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

// Live Sync from reliable web source (Wikipedia / Valve Esports Records)
app.post('/api/maps/sync-rotation', async (req, res) => {
  try {
    const updatedState = await fetchLiveOfficialRotation();
    io.emit('active_rotation_updated', updatedState);

    // Update rooms in lobby
    rooms.forEach((r) => {
      if (r.phase === 'lobby') {
        r.maps = [...updatedState.activeDutyMaps];
        io.to(r.id).emit('room_state', r);
      }
    });

    res.json({ success: true, ...updatedState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Steam OpenID Authentication Routes
app.get('/api/auth/steam', (req, res) => {
  const room = req.query.room || 'MIX-PRO';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const returnTo = `${protocol}://${host}/api/auth/steam/return?room=${encodeURIComponent(room)}`;
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
  const room = req.query.room || 'MIX-PRO';
  try {
    const claimedId = req.query['openid.claimed_id'];
    const steamIdMatch = claimedId && claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);

    if (!steamIdMatch) {
      return res.redirect(`/?room=${encodeURIComponent(room)}&steam_error=invalid_id`);
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
      return res.redirect(`/?room=${encodeURIComponent(room)}&steam_error=auth_failed`);
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

    // Attempt automatic FACEIT stats lookup via Steam ID
    let faceitLevel = 5;
    let faceitElo = 1200;
    let faceitFound = 0;
    const faceitApiKey = process.env.FACEIT_API_KEY;

    if (faceitApiKey) {
      try {
        const fRes = await fetch(`https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamId}`, {
          headers: { Authorization: `Bearer ${faceitApiKey}` },
        });
        if (fRes.ok) {
          const fData = await fRes.json();
          const cs2 = fData.games?.cs2;
          if (cs2) {
            faceitLevel = cs2.skill_level || 5;
            faceitElo = cs2.faceit_elo || 1200;
            faceitFound = 1;
          }
        }
      } catch (err) {
        console.error('Error fetching FACEIT data:', err);
      }
    }

    res.redirect(
      `/?room=${encodeURIComponent(room)}&steam_auth=1&steamId=${steamId}&nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}&faceitLevel=${faceitLevel}&faceitElo=${faceitElo}&faceitFound=${faceitFound}`
    );
  } catch (err) {
    console.error('Steam Auth Error:', err);
    res.redirect(`/?room=${encodeURIComponent(room)}&steam_error=server_error`);
  }
});

// Dedicated FACEIT lookup API by Steam ID
app.get('/api/faceit/:steamId', async (req, res) => {
  const { steamId } = req.params;
  const faceitApiKey = process.env.FACEIT_API_KEY;

  if (!faceitApiKey) {
    return res.json({
      success: true,
      found: false,
      level: 5,
      elo: 1200,
      message: 'Configure FACEIT_API_KEY nas variáveis de ambiente para sincronização oficial.',
    });
  }

  try {
    const fRes = await fetch(`https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamId}`, {
      headers: { Authorization: `Bearer ${faceitApiKey}` },
    });
    if (fRes.ok) {
      const fData = await fRes.json();
      const cs2 = fData.games?.cs2;
      return res.json({
        success: true,
        found: Boolean(cs2),
        nickname: fData.nickname,
        level: cs2?.skill_level || 5,
        elo: cs2?.faceit_elo || 1200,
      });
    }

    return res.json({
      success: true,
      found: false,
      level: 5,
      elo: 1200,
      message: 'Conta FACEIT não vinculada ou sem partidas de CS2',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => {
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
