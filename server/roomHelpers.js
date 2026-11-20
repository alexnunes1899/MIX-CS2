import crypto from 'crypto';
import { hashRoomPassword } from './authSession.js';
import { sendDiscordWebhook } from './discordWebhook.js';
import { balanceTeams as sharedBalanceTeams, calculateMetricsForTeams, getPlayerScore } from '../shared/balance.js';
import { sanitizeRconCommand } from './utils/security.js';

export { sanitizeRconCommand };

export const INACTIVITY_EMPTY_TIMEOUT = 15 * 60 * 1000;
export const INACTIVITY_IDLE_TIMEOUT = 60 * 60 * 1000;

export const MOCK_BOTS = [
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

export function sanitizeInput(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function isValidMapName(map) {
  if (typeof map !== 'string') return false;
  return /^[a-zA-Z0-9_-]{3,32}$/.test(map.trim());
}

export function parseHostPort(raw) {
  if (!raw) return { host: '127.0.0.1', port: 27015 };
  const str = String(raw).trim().replace(/^connect\s+/i, '').replace(/;.*$/, '');
  const colonIdx = str.lastIndexOf(':');
  if (colonIdx !== -1) {
    const host = str.substring(0, colonIdx).trim();
    const port = parseInt(str.substring(colonIdx + 1).trim(), 10) || 27015;
    return { host, port };
  }
  return { host: str.trim(), port: 27015 };
}

export function touchRoomActivity(room) {
  if (room) {
    room.lastActivity = Date.now();
  }
}

export function getRoomAdminId(room) {
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
  return room.creatorId || room.adminId || (room.players.length > 0 ? room.players[0].id : null);
}

export function isRoomAdmin(room, socket) {
  if (!room || !socket) return false;
  if (socket.isSiteAdmin) return true;
  const sid = socket.playerId || socket.id;
  const currentAdminId = getRoomAdminId(room);
  return Boolean(
    (currentAdminId && (sid === currentAdminId || socket.id === currentAdminId)) ||
    (room.creatorId && (sid === room.creatorId || socket.id === room.creatorId)) ||
    (socket.sessionUser?.steamId && room.creatorSteamId && socket.sessionUser.steamId === room.creatorSteamId)
  );
}

export function isRoomParticipant(room, socket) {
  if (!room || !socket) return false;
  if (isRoomAdmin(room, socket)) return true;
  if (socket.authenticatedRooms?.has(room.id)) return true;
  const sid = socket.playerId || socket.id;
  return Boolean(room.players?.some((p) => p.id === sid || p.socketId === socket.id));
}

export function hasRealHumanTeams(room) {
  if (!room) return false;
  const realHumansInTeam = (team = []) =>
    team.some((p) => p && p.id !== 't1' && p.id !== 't2' && !String(p.id || '').startsWith('bot-'));
  return realHumansInTeam(room.teamA) && realHumansInTeam(room.teamB);
}

export function isSocketTurnAuthorized(room, socket, targetTeam) {
  if (!room || !socket) return false;
  if (isRoomAdmin(room, socket)) return true;
  if (!hasRealHumanTeams(room)) {
    return isRoomParticipant(room, socket);
  }
  const teamRoster = targetTeam === 'teamA' ? room.teamA : room.teamB;
  if (!Array.isArray(teamRoster) || teamRoster.length === 0) return isRoomParticipant(room, socket);
  const sid = socket.playerId || socket.id;
  const verifiedSteam = socket.sessionUser?.steamId;
  return teamRoster.some(
    (p) => p && (p.id === sid || p.socketId === socket.id || (verifiedSteam && p.steamId === verifiedSteam))
  );
}

export function getSafeRoomState(room) {
  if (!room) return null;
  const { password, passwordHash, rconPassword, gsiToken, ...safe } = room;
  return {
    ...safe,
    adminId: getRoomAdminId(room),
    creatorSteamId: room.creatorSteamId || null,
    creatorId: room.creatorId || null,
    creatorNick: room.creatorNick || null,
    hasPassword: Boolean(passwordHash || (password && String(password).trim())),
    hasRconPassword: Boolean(rconPassword && String(rconPassword).trim()),
    hasGsiToken: Boolean(gsiToken),
    isPrivate: Boolean(room.isPrivate),
    inviteKey: room.inviteKey || null,
  };
}

export function buildPublicRoomsList(rooms) {
  const list = [];
  const now = Date.now();
  rooms.forEach((r) => {
    if (r.isPrivate) return;
    const rawLive = r.liveMatch;
    const isFreshLive = Boolean(rawLive && rawLive.lastUpdate && now - Number(rawLive.lastUpdate) < 60000);
    const liveSummary = isFreshLive
      ? {
          connected: true,
          mapName: rawLive.mapName || 'CS2',
          scoreCT: Number(rawLive.scoreCT || 0),
          scoreTR: Number(rawLive.scoreTR || 0),
          roundNumber: Number(rawLive.roundNumber || 0),
          phase: rawLive.phase || 'live',
          bomb: rawLive.bomb || 'none',
          aliveCountCT: Number(rawLive.aliveCountCT || 0),
          aliveCountTR: Number(rawLive.aliveCountTR || 0),
          lastUpdate: Number(rawLive.lastUpdate),
        }
      : null;

    list.push({
      id: r.id,
      name: r.name,
      playerCount: r.players?.length || 0,
      phase: r.phase,
      rankingSystem: r.rankingSystem || 'gc',
      hasServer: Boolean(r.serverIp && r.serverIp.trim()),
      serverIp: r.serverIp || '',
      hasPassword: Boolean(r.passwordHash || (r.password && String(r.password).trim())),
      isPrivate: false,
      creatorId: r.creatorId || null,
      adminId: getRoomAdminId(r),
      creatorNick: r.creatorNick || null,
      createdAt: r.createdAt,
      lastActivity: r.lastActivity || r.createdAt,
      liveMatch: liveSummary,
    });
  });
  list.sort((a, b) => (b.lastActivity || b.createdAt || 0) - (a.lastActivity || a.createdAt || 0));
  return list;
}

export function resetRoomVetoState(room, { matchFormat, firstTeam, bo1Order } = {}) {
  if (!room) return;
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
  room.turnDeadline = room.turnTimerSeconds > 0 ? Date.now() + room.turnTimerSeconds * 1000 : null;
}

export function refreshTurnDeadline(room) {
  if (!room) return;
  const timedPhases = new Set(['captains_draft', 'veto', 'side_pick']);
  if (room.turnTimerSeconds > 0 && timedPhases.has(room.phase)) {
    room.turnDeadline = Date.now() + room.turnTimerSeconds * 1000;
  } else {
    room.turnDeadline = null;
  }
}

export function createRoomLifecycle({ io, rooms, getCurrentRotationState, scheduleSave }) {
  function emitRoomState(targetRoomId, room) {
    if (!room) return;
    io.to(targetRoomId).emit('room_state', getSafeRoomState(room));
    scheduleSave();
  }

  function broadcastRoomsList() {
    io.emit('rooms_list', buildPublicRoomsList(rooms));
  }

  function cleanupInactiveRooms() {
    const now = Date.now();
    let changed = false;

    rooms.forEach((room, id) => {
      const empty = !room.players || room.players.length === 0;
      const idleTime = now - (room.lastActivity || room.createdAt || now);

      if ((empty && idleTime > INACTIVITY_EMPTY_TIMEOUT) || idleTime > INACTIVITY_IDLE_TIMEOUT) {
        console.log(`[CLEANUP] Excluindo sala ${id} por inatividade (${Math.round(idleTime / 60000)} min ociosa).`);
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
      scheduleSave();
    }
  }

  function getOrCreateRoom(
    roomId,
    customName = '',
    rankingSystem = 'gc',
    serverIp = '',
    password = '',
    isPrivate = false,
    creatorId = null,
    creatorSteamId = null,
    inviteKey = null,
    creatorNick = ''
  ) {
    const id = String(roomId || '').trim().toUpperCase() || 'MIX-1';
    if (!rooms.has(id)) {
      const now = Date.now();
      const finalInviteKey = inviteKey || `gc_${Math.random().toString(36).substring(2, 9)}`;
      const effectiveNick = (creatorNick || '').trim();
      let defaultName = `Mix ${id}`;
      if (effectiveNick) {
        defaultName = `Time ${effectiveNick}`;
      } else if (id.startsWith('TIME-')) {
        const derived = id.replace('TIME-', '').trim();
        defaultName = `Time ${derived.charAt(0).toUpperCase() + derived.slice(1).toLowerCase()}`;
      }

      const finalName = customName && !customName.startsWith('Mix ') ? customName : defaultName;
      const hashedPwd = hashRoomPassword(password);

      rooms.set(id, {
        id,
        name: finalName,
        createdAt: now,
        lastActivity: now,
        creatorId: creatorId || null,
        creatorSteamId: creatorSteamId || null,
        creatorNick: effectiveNick || (id.startsWith('TIME-') ? id.replace('TIME-', '') : null),
        adminId: creatorId || null,
        rankingSystem: rankingSystem === 'faceit' ? 'faceit' : 'gc',
        phase: 'lobby',
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
        gsiToken: crypto.randomBytes(16).toString('hex'),
        passwordHash: hashedPwd,
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
        coin: null,
        captainA: null,
        captainB: null,
        captainTurn: 'captainA',
        unassignedPlayers: [],
        readyCheck: null,
        turnTimerSeconds: 0,
        turnDeadline: null,
      });
    }
    const room = rooms.get(id);
    touchRoomActivity(room);
    return room;
  }

  function dispatchAutoDiscordVeto(room) {
    if (!room || !room.discordWebhook || !room.discordAutoVeto) return;
    const sideB = room.startingSideTeamB || 'CT';
    const sideA = sideB === 'CT' ? 'TR' : 'CT';
    const creatorNick = room.creatorNick || '';
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

  return {
    emitRoomState,
    broadcastRoomsList,
    cleanupInactiveRooms,
    getOrCreateRoom,
    getRoomAndTouch: (roomId) => {
      if (!roomId) return null;
      const cleanId = String(roomId).trim().toUpperCase();
      const room = rooms.get(cleanId);
      if (room) touchRoomActivity(room);
      return room;
    },
    dispatchAutoDiscordVeto,
    dispatchAutoDiscordLobby,
    calculateBalance: sharedBalanceTeams,
    calculateMetricsForTeams,
    getPlayerWeight: getPlayerScore,
  };
}
