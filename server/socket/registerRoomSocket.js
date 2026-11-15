import {
  getConfiguredAdminSteamIds,
  getSessionUser,
  hashRoomPassword,
  verifyRoomPassword,
} from '../authSession.js';
import { economyDb } from '../db.js';
import { getVetoSchedule } from '../../shared/proVeto.js';
import {
  MOCK_BOTS,
  buildPublicRoomsList,
  getRoomAdminId,
  hasRealHumanTeams,
  isRoomAdmin,
  isRoomParticipant,
  isSocketTurnAuthorized,
  isValidMapName,
  parseHostPort,
  refreshTurnDeadline,
  resetRoomVetoState,
  sanitizeInput,
  sanitizeRconCommand,
} from '../roomHelpers.js';

function advanceVetoToDeciderOrNext(room, schedule, actionIdx, remaining) {
  const nextStep = schedule[actionIdx + 1];
  if (remaining.length === 1 || !nextStep || nextStep.type === 'decider') {
    room.finalMap = remaining[0] || room.maps[0];
    room.phase = 'side_pick';
    room.currentTurn = nextStep?.sidePickBy || 'teamB';
  } else {
    room.currentTurn = nextStep.team;
  }
  refreshTurnDeadline(room);
}

function executeMapAction(room, mapId, { io, lifecycle }) {
  if (!room || room.phase !== 'veto' || room.pendingSidePick) return false;
  if (!Array.isArray(room.bannedMaps)) room.bannedMaps = [];
  if (!Array.isArray(room.pickedMaps)) room.pickedMaps = [];
  if (!Array.isArray(room.vetoLog)) room.vetoLog = [];

  if (room.bannedMaps.some((b) => b.mapId === mapId) || room.pickedMaps.some((p) => p.mapId === mapId)) {
    return false;
  }

  const mapObj = room.maps.find((m) => m.id === mapId);
  if (!mapObj) return false;

  const schedule = getVetoSchedule(room.matchFormat || 'MD1', room.vetoFirstTeam || 'teamA', room.bo1Order || 'ABABAB');
  const actionIdx = room.bannedMaps.length + room.pickedMaps.length;
  const currentStep = schedule[actionIdx];
  if (!currentStep) return false;

  if (currentStep.type === 'pick') {
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
    refreshTurnDeadline(room);
    lifecycle.emitRoomState(room.id, room);
    return true;
  }

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
  advanceVetoToDeciderOrNext(room, schedule, actionIdx, remaining);
  lifecycle.emitRoomState(room.id, room);
  return true;
}

function executeSelectSide(room, side, { lifecycle }) {
  if (!room) return false;
  if (!Array.isArray(room.pickedMaps)) room.pickedMaps = [];
  if (!Array.isArray(room.vetoLog)) room.vetoLog = [];

  const cleanSide = side === 'TR' ? 'TR' : side === 'KNIFE' ? 'KNIFE' : 'CT';
  const schedule = getVetoSchedule(room.matchFormat || 'MD1', room.vetoFirstTeam || 'teamA', room.bo1Order || 'ABABAB');

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
    advanceVetoToDeciderOrNext(room, schedule, nextActionIdx - 1, remaining);
    lifecycle.emitRoomState(room.id, room);
    return true;
  }

  if (room.phase !== 'side_pick') return false;

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
  room.turnDeadline = null;
  lifecycle.dispatchAutoDiscordVeto(room);
  lifecycle.emitRoomState(room.id, room);
  lifecycle.broadcastRoomsList();
  return true;
}

function executeCaptainPick(room, playerId, { lifecycle }) {
  if (!room || room.phase !== 'captains_draft') return false;
  const playerIdx = room.unassignedPlayers.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return false;

  const chosenPlayer = room.unassignedPlayers.splice(playerIdx, 1)[0];

  if (room.captainTurn === 'captainA') {
    room.teamA.push(chosenPlayer);
    room.captainTurn = 'captainB';
  } else {
    room.teamB.push(chosenPlayer);
    room.captainTurn = 'captainA';
  }

  if (room.unassignedPlayers.length === 0) {
    room.metrics = lifecycle.calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem || 'gc');
    room.phase = 'teams';
    room.turnDeadline = null;
  } else {
    refreshTurnDeadline(room);
  }

  lifecycle.emitRoomState(room.id, room);
  return true;
}

function pushSystemChat(io, room, text) {
  const chatMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: { nick: 'Sistema', avatar: '👑', level: 20, faceitLevel: 10 },
    text,
    timestamp: Date.now(),
  };
  room.chat.push(chatMsg);
  if (room.chat.length > 50) room.chat.shift();
  io.to(room.id).emit('chat_message', chatMsg);
}

export function processRoomDeadlines({ io, rooms, lifecycle }) {
  const now = Date.now();
  rooms.forEach((room) => {
    // 1. Check active Ready Check expiration
    if (room.readyCheck?.active && room.readyCheck.expiresAt && now >= room.readyCheck.expiresAt) {
      const confirmedSet = new Set(room.readyCheck.confirmedIds || []);
      const missingPlayers = (room.players || []).filter((p) => !confirmedSet.has(p.id) && !p.ready);
      room.readyCheck = {
        ...room.readyCheck,
        active: false,
        status: 'expired',
        expiredAt: now,
        missingIds: missingPlayers.map((p) => p.id),
      };
      const names = missingPlayers.map((p) => p.nick).join(', ') || 'nenhum';
      pushSystemChat(io, room, `⏱️ Ready Check expirou! Ausentes: ${names}.`);
      lifecycle.emitRoomState(room.id, room);
    }

    // 2. Check Veto / Captains Draft Turn Timer
    if (room.turnTimerSeconds > 0 && room.turnDeadline && now >= room.turnDeadline) {
      if (room.phase === 'captains_draft' && room.unassignedPlayers?.length > 0) {
        const autoTarget = room.unassignedPlayers[0];
        pushSystemChat(io, room, `⏱️ Tempo esgotado no Draft! Auto-pick: ${autoTarget.nick}.`);
        executeCaptainPick(room, autoTarget.id, { lifecycle });
      } else if (room.phase === 'veto' && room.pendingSidePick) {
        pushSystemChat(io, room, '⏱️ Tempo esgotado na escolha de lado! CT selecionado automaticamente.');
        executeSelectSide(room, 'CT', { lifecycle });
      } else if (room.phase === 'veto') {
        const remaining = (room.maps || []).filter(
          (m) => !room.bannedMaps?.some((b) => b.mapId === m.id) && !room.pickedMaps?.some((p) => p.mapId === m.id)
        );
        if (remaining.length > 0) {
          const picked = remaining[Math.floor(Math.random() * remaining.length)];
          pushSystemChat(io, room, `⏱️ Tempo esgotado no Veto! Ação automática em ${picked.name}.`);
          executeMapAction(room, picked.id, { io, lifecycle });
        } else {
          room.turnDeadline = null;
        }
      } else if (room.phase === 'side_pick') {
        pushSystemChat(io, room, '⏱️ Tempo esgotado na escolha de lado do Decider! CT definido.');
        executeSelectSide(room, 'CT', { lifecycle });
      }
    }
  });
}

export function registerRoomSocket({
  io,
  rooms,
  lifecycle,
  buildVersion,
  getMatchHistoryState,
  recordMatchHistoryEntry,
  computeMatchMvp,
  getMapImageUrl,
  normalizeMapName,
  getGsiState,
  recordMatch,
  getLeaderboard,
  fetchFaceitPlayer,
  getSteamPlayerDetails,
  fetchLiveOfficialRotation,
  executeRconCommand,
  sendDiscordWebhook,
  isValidDiscordWebhookUrl,
}) {
  const adminSteamIds = new Set(getConfiguredAdminSteamIds());

  io.on('connection', (socket) => {
    socket.sessionUser = getSessionUser(socket.handshake);
    socket.isSiteAdmin = Boolean(socket.sessionUser?.steamId && adminSteamIds.has(socket.sessionUser.steamId));
    socket.authenticatedRooms = new Set();

    socket.emit('server_app_version', { version: buildVersion });
    socket.emit('match_history_init', getMatchHistoryState());
    socket.emit('rooms_list', buildPublicRoomsList(rooms));
    socket.emit('commendations_updated', economyDb.getCommendations());

    socket.on('get_match_history', (filters) => {
      socket.emit('match_history_updated', getMatchHistoryState(filters || {}));
    });

    socket.on('get_rooms_list', () => {
      socket.emit('rooms_list', buildPublicRoomsList(rooms));
    });

    socket.on('join_room', async ({ roomId, player, roomName, rankingSystem, serverIp, password, isPrivate, inviteKey, createIfMissing }) => {
      const cleanRoomId = sanitizeInput(roomId || '', 20).toUpperCase();
      if (!cleanRoomId) return;
      const cleanRoomName = sanitizeInput(roomName, 40);
      const cleanPassword = sanitizeInput(password || '', 64);
      const cleanKey = sanitizeInput(inviteKey || '', 32);

      // Establish caller identity BEFORE creating or checking room ownership
      const verifiedSteamId = socket.sessionUser?.steamId || null;
      const effectivePlayerId = player?.id || socket.playerId || socket.id;
      socket.playerId = effectivePlayerId;

      const existingRoom = rooms.get(cleanRoomId);
      if (!existingRoom && createIfMissing === false) {
        socket.emit('room_not_found', {
          roomId: cleanRoomId,
          message: 'Esta sala não existe mais ou já foi encerrada.',
        });
        return;
      }

      if (existingRoom) {
        const matchesKey = Boolean(cleanKey && existingRoom.inviteKey && cleanKey === existingRoom.inviteKey);
        const isKnownPlayer = Boolean(
          (effectivePlayerId && existingRoom.players.some((p) => p.id === effectivePlayerId)) ||
          (verifiedSteamId && existingRoom.players.some((p) => p.steamId === verifiedSteamId))
        );
        const isCreator = Boolean(
          socket.isSiteAdmin ||
          (existingRoom.creatorId && existingRoom.creatorId === effectivePlayerId) ||
          (verifiedSteamId && existingRoom.creatorSteamId === verifiedSteamId)
        );

        if (existingRoom.isPrivate && !matchesKey && !isKnownPlayer && !isCreator) {
          socket.emit('room_auth_error', {
            roomId: cleanRoomId,
            roomName: existingRoom.name,
            error: 'private_room',
            message: 'Esta sala é privada. O acesso é permitido somente através do Link de Convite.',
          });
          return;
        }

        if (existingRoom.passwordHash && !matchesKey && !isKnownPlayer && !isCreator) {
          const passwordOk = verifyRoomPassword(cleanPassword, existingRoom.passwordHash);
          if (!passwordOk) {
            socket.emit('room_auth_error', {
              roomId: cleanRoomId,
              roomName: existingRoom.name,
              error: cleanPassword ? 'wrong_password' : 'password_required',
              message: cleanPassword
                ? 'Senha incorreta para entrar nesta sala.'
                : 'Esta sala é protegida por senha. Digite a senha para entrar.',
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
      socket.authenticatedRooms.add(cleanRoomId);

      const room = lifecycle.getOrCreateRoom(
        cleanRoomId,
        cleanRoomName,
        rankingSystem,
        serverIp,
        cleanPassword,
        isPrivate,
        effectivePlayerId,
        verifiedSteamId,
        cleanKey,
        player?.nick
      );

      if (player?.nick) {
        if (!room.creatorNick) {
          room.creatorNick = sanitizeInput(player.nick, 32);
        }
        if (room.players.length === 0 && (room.name.startsWith('Mix ') || room.name === `Mix ${cleanRoomId}`)) {
          room.name = `Time ${sanitizeInput(player.nick, 28)}`;
        }
      }
      if (rankingSystem && room.players.length === 0) {
        room.rankingSystem = rankingSystem === 'faceit' ? 'faceit' : 'gc';
      }
      if (serverIp && serverIp.trim() && (isRoomAdmin(room, socket) || room.players.length === 0)) {
        room.serverIp = sanitizeInput(serverIp, 64);
      }

      const isAdminCaller = isRoomAdmin(room, socket);
      socket.emit('room_authenticated', {
        roomId: cleanRoomId,
        hasPassword: Boolean(room.passwordHash),
        inviteKey: room.inviteKey || '',
        isPrivate: Boolean(room.isPrivate),
        isCreator: isAdminCaller,
      });

      if (player && player.nick) {
        const cleanNick = sanitizeInput(player.nick, 32) || 'Jogador';
        const existingIdx = room.players.findIndex(
          (p) => p.id === effectivePlayerId || (p.nick === cleanNick && !String(p.id).startsWith('bot-'))
        );

        const parsedLevel = Math.max(1, Math.min(21, Number(player.level) || 10));
        const parsedFaceitLvl = player.faceitLevel
          ? Math.max(1, Math.min(10, Number(player.faceitLevel)))
          : (parsedLevel <= 10 ? parsedLevel : Math.round(parsedLevel / 2.1));
        const parsedFaceitElo = player.faceitElo ? Number(player.faceitElo) : null;
        const validSide = ['CT', 'TR', 'ANY'].includes(player.side) ? player.side : 'ANY';
        const effectiveSteamId = verifiedSteamId || (player.steamId ? sanitizeInput(String(player.steamId), 32) : null);

        const playerData = {
          id: effectivePlayerId,
          nick: cleanNick,
          level: parsedLevel,
          faceitLevel: parsedFaceitLvl,
          faceitElo: parsedFaceitElo,
          side: validSide,
          avatar: sanitizeInput(player.avatar, 240) || '🎯',
          steamId: effectiveSteamId,
          steamVerified: Boolean(verifiedSteamId),
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

        if (!room.creatorId) {
          room.creatorId = effectivePlayerId;
          room.adminId = effectivePlayerId;
          if (verifiedSteamId) {
            room.creatorSteamId = verifiedSteamId;
          }
        } else if (verifiedSteamId && room.creatorSteamId && verifiedSteamId === room.creatorSteamId) {
          // Only reclaim room admin when verified via signed Steam session cookie
          room.adminId = effectivePlayerId;
        }

        if (effectiveSteamId && (!player.faceitElo || player.faceitLevel === 5)) {
          fetchFaceitPlayer({ steamId: effectiveSteamId, nickname: cleanNick })
            .then((faceitData) => {
              if (faceitData && faceitData.found && faceitData.level) {
                const pIdx = room.players.findIndex((p) => p.id === effectivePlayerId);
                if (pIdx >= 0) {
                  room.players[pIdx].faceitLevel = faceitData.level;
                  room.players[pIdx].faceitElo = faceitData.elo;
                  lifecycle.emitRoomState(cleanRoomId, room);
                }
              }
            })
            .catch(() => {});
        }

        if (effectiveSteamId && !player.cs2Hours) {
          getSteamPlayerDetails(effectiveSteamId)
            .then((steamDetails) => {
              if (steamDetails && steamDetails.cs2Hours) {
                const pIdx = room.players.findIndex((p) => p.id === effectivePlayerId);
                if (pIdx >= 0 && !room.players[pIdx].cs2Hours) {
                  room.players[pIdx].cs2Hours = steamDetails.cs2Hours;
                  lifecycle.emitRoomState(cleanRoomId, room);
                }
              }
            })
            .catch(() => {});
        }
      }

      lifecycle.dispatchAutoDiscordLobby(room);
      lifecycle.emitRoomState(cleanRoomId, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('verify_room_password', ({ roomId, password }, callback) => {
      const cleanRoomId = sanitizeInput(roomId || '', 20).toUpperCase();
      const room = lifecycle.getRoomAndTouch(cleanRoomId);
      if (!room) return callback && callback({ valid: false, error: 'not_found' });
      if (!room.passwordHash) return callback && callback({ valid: true });
      const matches = verifyRoomPassword(sanitizeInput(password || '', 64), room.passwordHash);
      if (callback) {
        callback({ valid: matches, error: matches ? null : 'wrong_password' });
      }
    });

    socket.on('set_room_password', ({ roomId, password }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode alterar a senha.' });
        return;
      }
      const clean = sanitizeInput(password || '', 64);
      room.passwordHash = clean ? hashRoomPassword(clean) : '';
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('change_ranking_system', ({ roomId, rankingSystem }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode alterar o sistema de ranking.' });
        return;
      }
      room.rankingSystem = rankingSystem === 'faceit' ? 'faceit' : 'gc';
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('toggle_ready', ({ roomId, playerId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      const callerId = socket.playerId || socket.id;
      if (playerId !== callerId && !isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Você só pode alterar o seu próprio status de Pronto.' });
        return;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      player.ready = !player.ready;

      if (room.readyCheck?.active) {
        const set = new Set(room.readyCheck.confirmedIds || []);
        if (player.ready) set.add(player.id);
        else set.delete(player.id);
        room.readyCheck.confirmedIds = Array.from(set);

        if (room.players.length > 0 && room.players.every((p) => p.ready || set.has(p.id))) {
          room.readyCheck = {
            ...room.readyCheck,
            active: false,
            status: 'completed',
            completedAt: Date.now(),
          };
          pushSystemChat(io, room, '✅ READY CHECK COMPLETO! Todos os jogadores estão prontos para o Mix.');
        }
      }

      lifecycle.emitRoomState(room.id, room);
    });

    // Timed Ready Check Controls
    socket.on('start_ready_check', ({ roomId, durationSeconds = 30 }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode iniciar o Ready Check.' });
        return;
      }
      const secs = Math.max(15, Math.min(60, Number(durationSeconds) || 30));
      const callerId = socket.playerId || socket.id;
      const autoConfirmed = [];
      for (const p of room.players) {
        if (String(p.id).startsWith('bot-') || p.id === callerId) {
          p.ready = true;
          autoConfirmed.push(p.id);
        } else {
          p.ready = false;
        }
      }

      const allConfirmed = room.players.length > 0 && room.players.every((p) => autoConfirmed.includes(p.id));
      room.readyCheck = {
        active: !allConfirmed,
        status: allConfirmed ? 'completed' : 'pending',
        startedAt: Date.now(),
        expiresAt: Date.now() + secs * 1000,
        durationSeconds: secs,
        confirmedIds: autoConfirmed,
        initiatorId: callerId,
      };
      pushSystemChat(io, room, allConfirmed
        ? '✅ Todos já estão prontos!'
        : `🔔 READY CHECK INICIADO (${secs}s)! Clique em "Estou Pronto!" para confirmar.`);
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('accept_ready_check', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || !room.readyCheck?.active) return;
      const callerId = socket.playerId || socket.id;
      const player = room.players.find((p) => p.id === callerId || p.socketId === socket.id);
      if (!player) return;

      player.ready = true;
      const set = new Set(room.readyCheck.confirmedIds || []);
      set.add(player.id);
      room.readyCheck.confirmedIds = Array.from(set);

      if (room.players.length > 0 && room.players.every((p) => p.ready || set.has(p.id))) {
        room.readyCheck = {
          ...room.readyCheck,
          active: false,
          status: 'completed',
          completedAt: Date.now(),
        };
        pushSystemChat(io, room, '✅ READY CHECK COMPLETO! Todos confirmaram presença.');
      }

      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('cancel_ready_check', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) return;
      room.readyCheck = null;
      pushSystemChat(io, room, '🛑 Ready Check cancelado pelo administrador.');
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('kick_afk_ready_check', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) return;
      const missingIds = new Set(
        room.readyCheck?.missingIds ||
        room.players.filter((p) => !p.ready && !String(p.id).startsWith('bot-')).map((p) => p.id)
      );
      if (missingIds.size === 0) return;

      const adminId = getRoomAdminId(room);
      missingIds.delete(adminId);
      const removedNames = [];
      room.players = room.players.filter((p) => {
        if (missingIds.has(p.id)) {
          removedNames.push(p.nick);
          if (p.socketId) {
            const targetSock = io.sockets.sockets.get(p.socketId);
            if (targetSock) {
              targetSock.emit('kicked_from_room', {
                roomId: room.id,
                targetPlayerId: p.id,
                reason: 'Removido por não confirmar o Ready Check a tempo.',
              });
              targetSock.leave(room.id);
              targetSock.roomId = null;
            }
          }
          return false;
        }
        return true;
      });
      room.readyCheck = null;
      if (removedNames.length > 0) {
        pushSystemChat(io, room, `🚫 Removidos por AFK no Ready Check: ${removedNames.join(', ')}.`);
      }
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('set_turn_timer', ({ roomId, seconds = 0 }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode configurar o timer de turno.' });
        return;
      }
      const cleanSecs = [0, 15, 20, 30, 45, 60].includes(Number(seconds)) ? Number(seconds) : Math.max(0, Math.min(60, Number(seconds) || 0));
      room.turnTimerSeconds = cleanSecs;
      refreshTurnDeadline(room);
      pushSystemChat(io, room, cleanSecs > 0 ? `⏱️ Timer automático de turno definido para ${cleanSecs}s.` : '⏱️ Timer automático de turno desativado.');
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('send_chat', ({ roomId, message }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || !message || !message.text) return;
      if (!isRoomParticipant(room, socket)) return;

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
          avatar: sanitizeInput(message.sender.avatar, 240) || '🎯',
        };
      } else if (typeof message.sender === 'string') {
        senderObj.nick = sanitizeInput(message.sender, 32) || 'Jogador';
      }

      const cleanText = sanitizeInput(message.text, 250);
      if (!cleanText) return;

      const chatMsg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: senderObj,
        text: cleanText,
        timestamp: Date.now(),
      };

      room.chat.push(chatMsg);
      if (room.chat.length > 50) room.chat.shift();

      io.to(room.id).emit('chat_message', chatMsg);
    });

    socket.on('update_server_ip', ({ roomId, serverIp }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode alterar o servidor.' });
        return;
      }
      room.serverIp = serverIp ? sanitizeInput(serverIp, 64) : '';
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('update_player', ({ roomId, player }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || !player) return;
      const callerId = socket.playerId || socket.id;
      if (player.id !== callerId && !isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Você só pode editar o seu próprio perfil na sala.' });
        return;
      }

      const idx = room.players.findIndex((p) => p.id === player.id);
      if (idx >= 0) {
        const sanitizedPlayer = { ...player };
        if (sanitizedPlayer.nick) sanitizedPlayer.nick = sanitizeInput(sanitizedPlayer.nick, 32);
        if (sanitizedPlayer.avatar) sanitizedPlayer.avatar = sanitizeInput(sanitizedPlayer.avatar, 240);
        if (sanitizedPlayer.side && !['CT', 'TR', 'ANY'].includes(sanitizedPlayer.side)) sanitizedPlayer.side = 'ANY';
        // Preserve server-verified steamId if socket has signed Steam session
        if (player.id === callerId && socket.sessionUser?.steamId) {
          sanitizedPlayer.steamId = socket.sessionUser.steamId;
        }
        room.players[idx] = { ...room.players[idx], ...sanitizedPlayer };
        lifecycle.emitRoomState(room.id, room);
      }
    });

    socket.on('remove_player', ({ roomId, playerId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      const callerId = socket.playerId || socket.id;
      if (playerId !== callerId && !isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Você só pode sair com o seu próprio jogador.' });
        return;
      }
      room.players = room.players.filter((p) => p.id !== playerId);
      room.teamA = room.teamA.filter((p) => p.id !== playerId);
      room.teamB = room.teamB.filter((p) => p.id !== playerId);
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('kick_player', ({ roomId, targetPlayerId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
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
        room.metrics = lifecycle.calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem);
      }

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

      io.to(room.id).emit('kicked_from_room', {
        roomId: room.id,
        targetPlayerId,
        reason: 'Você foi removido da sala pelo administrador.',
      });

      pushSystemChat(io, room, `🚫 ${target.nick} foi removido da sala pelo administrador.`);
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('move_player_team', ({ roomId, playerId, targetTeam }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
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

      room.metrics = lifecycle.calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem);
      const targetLabel = targetTeam === 'teamA' ? 'Time A (Lado 1)' : 'Time B (Lado 2)';
      pushSystemChat(io, room, `🔄 ${player.nick} foi movido para o ${targetLabel} pelo administrador.`);
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('swap_players', ({ roomId, playerAId, playerBId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode trocar jogadores de lugar.' });
        return;
      }

      let idxA = room.teamA.findIndex((p) => p.id === playerAId);
      let idxB = room.teamB.findIndex((p) => p.id === playerBId);

      if (idxA === -1 || idxB === -1) {
        idxA = room.teamA.findIndex((p) => p.id === playerBId);
        idxB = room.teamB.findIndex((p) => p.id === playerAId);
      }

      if (idxA >= 0 && idxB >= 0) {
        const pA = room.teamA[idxA];
        const pB = room.teamB[idxB];
        room.teamA[idxA] = pB;
        room.teamB[idxB] = pA;
        room.metrics = lifecycle.calculateMetricsForTeams(room.teamA, room.teamB, room.rankingSystem);
        pushSystemChat(io, room, `🔀 ${pA.nick} e ${pB.nick} foram trocados de equipe pelo administrador.`);
        lifecycle.emitRoomState(room.id, room);
      }
    });

    socket.on('admin_change_player_side', ({ roomId, targetPlayerId, side }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode alterar o lado dos jogadores.' });
        return;
      }

      const p = room.players.find((it) => it.id === targetPlayerId);
      if (p) {
        p.side = ['CT', 'TR', 'ANY'].includes(side) ? side : 'ANY';
        lifecycle.emitRoomState(room.id, room);
      }
    });

    socket.on('fill_mock_bots', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode preencher a sala com bots.' });
        return;
      }
      const realPlayers = room.players
        .filter((p) => !String(p.id).startsWith('bot-'))
        .map((p) => ({ ...p, ready: true }));
      const neededBots = Math.max(0, 10 - realPlayers.length);
      const botsToAdd = JSON.parse(JSON.stringify(MOCK_BOTS.slice(0, neededBots)));
      room.players = [...realPlayers, ...botsToAdd];
      lifecycle.dispatchAutoDiscordLobby(room);
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('clear_players', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode limpar o lobby.' });
        return;
      }
      room.players = [];
      room.phase = 'lobby';
      room.teamA = [];
      room.teamB = [];
      room.metrics = null;
      room.bannedMaps = [];
      room.pickedMaps = [];
      room.vetoLog = [];
      room.drawnSeries = [];
      room.finalMap = null;
      room.startingSideTeamB = null;
      room.readyCheck = null;
      room.turnDeadline = null;
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('draw_teams', ({ roomId, mode = 'balanced' }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || room.players.length < 2) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode sortear os times.' });
        return;
      }

      const rankingSys = room.rankingSystem || 'gc';

      if (mode === 'balanced') {
        const { teamA, teamB, metrics } = lifecycle.calculateBalance(room.players, rankingSys);
        room.teamA = teamA;
        room.teamB = teamB;
        room.metrics = metrics;
      } else {
        const shuffled = [...room.players].sort(() => Math.random() - 0.5);
        const half = Math.floor(shuffled.length / 2);
        room.teamA = shuffled.slice(0, half);
        room.teamB = shuffled.slice(half);
        room.metrics = lifecycle.calculateMetricsForTeams(room.teamA, room.teamB, rankingSys);
      }

      room.readyCheck = null;
      room.phase = 'teams';
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('start_captain_draft', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || room.players.length < 2) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode iniciar o Modo Capitães.' });
        return;
      }

      const sorted = [...room.players].sort((a, b) => b.level - a.level);
      room.captainA = sorted[0];
      room.captainB = sorted[1];
      room.teamA = [sorted[0]];
      room.teamB = [sorted[1]];
      room.unassignedPlayers = sorted.slice(2);
      room.captainTurn = 'captainA';
      room.readyCheck = null;
      room.phase = 'captains_draft';
      refreshTurnDeadline(room);

      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('captain_pick', ({ roomId, playerId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || room.phase !== 'captains_draft') return;

      const activeCaptain = room.captainTurn === 'captainA' ? room.captainA : room.captainB;
      const callerId = socket.playerId || socket.id;
      const isCaptainBot = String(activeCaptain?.id || '').startsWith('bot-');
      const isCallerCaptain = activeCaptain && (activeCaptain.id === callerId || activeCaptain.socketId === socket.id);

      if (!isRoomAdmin(room, socket) && !isCallerCaptain && !(isCaptainBot && isRoomParticipant(room, socket))) {
        socket.emit('admin_error', { message: 'Aguarde o capitão da vez realizar a escolha!' });
        return;
      }

      executeCaptainPick(room, playerId, { lifecycle });
    });

    socket.on('flip_coin', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode girar a moeda.' });
        return;
      }

      const winner = Math.random() < 0.5 ? 'teamA' : 'teamB';
      room.coin = {
        winner,
        timestamp: Date.now(),
        choice: null,
      };
      room.phase = 'coin_flip';
      room.turnDeadline = null;
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('coin_choice', ({ roomId, choice }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || room.phase !== 'coin_flip' || !room.coin) return;
      if (!isSocketTurnAuthorized(room, socket, room.coin.winner)) {
        socket.emit('admin_error', { message: 'Apenas o time vencedor da moeda ou o administrador pode escolher.' });
        return;
      }

      room.coin.choice = choice;
      const firstTeam = choice === 'first'
        ? room.coin.winner
        : (room.coin.winner === 'teamA' ? 'teamB' : 'teamA');

      resetRoomVetoState(room, { firstTeam });
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('start_veto', ({ roomId, matchFormat, firstTeam, bo1Order }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode iniciar o Veto.' });
        return;
      }

      resetRoomVetoState(room, { matchFormat, firstTeam, bo1Order });
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('change_veto_format', ({ roomId, matchFormat, bo1Order }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode alterar o formato do Veto.' });
        return;
      }

      resetRoomVetoState(room, {
        matchFormat: matchFormat || room.matchFormat,
        firstTeam: room.vetoFirstTeam || 'teamA',
        bo1Order: bo1Order || room.bo1Order,
      });
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('quick_start_veto', ({ roomId, teamAName, teamBName, matchFormat = 'MD3', firstTeam = 'teamA', bo1Order = 'ABABAB' }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o criador da sala pode iniciar o Veto Rápido.' });
        return;
      }

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
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('load_tournament_match', ({ roomId, nameA, nameB, teamA, teamB, matchFormat = 'MD3' }) => {
      const room = lifecycle.getRoomAndTouch(roomId) || lifecycle.getOrCreateRoom(roomId, `${nameA} vs ${nameB}`, 'gc', '', '', false, socket.playerId || socket.id, socket.sessionUser?.steamId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode carregar confrontos.' });
        return;
      }

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
      room.turnDeadline = null;

      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('quick_random_map', ({ roomId, map, startingSide, startingSideTeamA, matchFormat = 'MD1', drawnSeries = [] }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode sortear o mapa direto.' });
        return;
      }

      const chosenMap = map || room.maps[Math.floor(Math.random() * room.maps.length)];
      const sideTeamB = startingSide || (Math.random() < 0.5 ? 'CT' : 'TR');
      const sideTeamA = startingSideTeamA || (sideTeamB === 'CT' ? 'TR' : 'CT');

      room.finalMap = chosenMap;
      room.startingSideTeamB = sideTeamB;
      room.startingSideTeamA = sideTeamA;
      room.matchFormat = matchFormat || 'MD1';
      room.drawnSeries = Array.isArray(drawnSeries) && drawnSeries.length > 0
        ? drawnSeries.map((s) => ({
            ...s,
            sideTimeA: s.sideTimeA || 'CT',
            sideTimeB: s.sideTimeB || (s.sideTimeA === 'CT' ? 'TR' : 'CT'),
          }))
        : [{ map: chosenMap, sideTimeA: sideTeamA, sideTimeB: sideTeamB, role: 'Mapa 1' }];
      room.phase = 'finished';
      room.turnDeadline = null;

      if (room.teamA.length === 0) {
        room.teamA = [{ id: 't1', nick: 'Time A', level: 15, avatar: '🛡️' }];
      }
      if (room.teamB.length === 0) {
        room.teamB = [{ id: 't2', nick: 'Time B', level: 15, avatar: '⚔️' }];
      }

      lifecycle.dispatchAutoDiscordVeto(room);
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('ban_map', ({ roomId, mapId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || room.phase !== 'veto' || room.pendingSidePick) return;

      const schedule = getVetoSchedule(room.matchFormat || 'MD1', room.vetoFirstTeam || 'teamA', room.bo1Order || 'ABABAB');
      const actionIdx = (room.bannedMaps?.length || 0) + (room.pickedMaps?.length || 0);
      const currentStep = schedule[actionIdx];
      if (!currentStep) return;

      if (!isSocketTurnAuthorized(room, socket, currentStep.team)) {
        socket.emit('admin_error', { message: 'Aguarde a vez do time adversário no Veto!' });
        return;
      }

      executeMapAction(room, mapId, { io, lifecycle });
    });

    socket.on('select_side', ({ roomId, side }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;

      const schedule = getVetoSchedule(room.matchFormat || 'MD1', room.vetoFirstTeam || 'teamA', room.bo1Order || 'ABABAB');
      const targetTeam = room.phase === 'veto' && room.pendingSidePick
        ? (room.pendingSidePick.sidePickBy || 'teamB')
        : (schedule[schedule.length - 1]?.sidePickBy || 'teamB');

      if (!isSocketTurnAuthorized(room, socket, targetTeam)) {
        socket.emit('admin_error', { message: 'Aguarde o time adversário escolher o lado inicial!' });
        return;
      }

      executeSelectSide(room, side, { lifecycle });
    });

    socket.on('save_score', ({ roomId, scoreA, scoreB, map, mapName }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket) && !hasRealHumanTeams(room)) {
        // Quick matches or room creators allowed, non-participants rejected
        if (!isRoomParticipant(room, socket)) {
          socket.emit('admin_error', { message: 'Apenas participantes ou admin da sala podem registrar o placar.' });
          return;
        }
      } else if (!isRoomAdmin(room, socket)) {
        const sid = socket.playerId || socket.id;
        const isCaptain = room.teamA?.[0]?.id === sid || room.teamB?.[0]?.id === sid;
        if (!isCaptain) {
          socket.emit('admin_error', { message: 'Apenas o administrador ou capitães podem registrar o placar.' });
          return;
        }
      }

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

      const webMatchRecord = {
        id: `WEB-${room.id}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        source: 'web',
        platform: 'Site Web (Sala)',
        sourceLabel: 'Via Site Web',
        roomId: room.id,
        roomName: room.name || `Sala ${room.id}`,
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

      const currentGsi = getGsiState(room.id) || room.gsiState || room.liveMatch || null;
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

      if (room.teamA?.length === 5 && room.teamB?.length === 5) {
        recordMatchHistoryEntry(webMatchRecord);
        io.emit('match_history_updated', getMatchHistoryState());
      }

      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('commend_player', ({ roomId, targetPlayerId, targetNick, type = 'friendly' }, callback) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || !targetPlayerId) return;
      if (!isRoomParticipant(room, socket)) {
        if (typeof callback === 'function') callback({ error: 'Entre na sala para elogiar jogadores.' });
        return;
      }
      const voterKey = socket.sessionUser?.steamId || socket.playerId || socket.id;
      const targetKey = String(targetPlayerId || targetNick || '').trim();
      const res = economyDb.commendPlayer(targetKey, type, voterKey, `${room.id}:${room.history?.[0]?.id || 'current'}`);
      if (!res) return;

      if (!res.alreadyCommended && targetNick) {
        pushSystemChat(io, room, `🏅 ${targetNick} recebeu uma comendação (${type})!`);
      }
      io.emit('commendations_updated', economyDb.getCommendations());
      if (typeof callback === 'function') callback({ success: true, ...res });
    });

    socket.on('swap_teams', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode inverter os times.' });
        return;
      }
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
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('restart_veto', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode reiniciar o Veto.' });
        return;
      }
      resetRoomVetoState(room, {
        matchFormat: room.matchFormat || 'MD1',
        firstTeam: room.vetoFirstTeam || 'teamA',
        bo1Order: room.bo1Order || 'ABABAB',
      });
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('reset_mix', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode reiniciar o Mix.' });
        return;
      }

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
      room.readyCheck = null;
      room.turnDeadline = null;

      room.players.forEach((p) => { p.ready = false; });

      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    // Fixed rematch_same_teams (previously crashed with ReferenceError: CS2_MAPS)
    socket.on('rematch_same_teams', ({ roomId }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador pode iniciar a revanche.' });
        return;
      }

      const oldFirst = room.vetoFirstTeam || 'teamA';
      const nextFirst = oldFirst === 'teamA' ? 'teamB' : 'teamA';
      const oldSideB = room.startingSideTeamB || 'CT';

      resetRoomVetoState(room, {
        matchFormat: room.matchFormat || 'MD1',
        firstTeam: nextFirst,
        bo1Order: room.bo1Order || 'ABABAB',
      });
      room.liveMatch = null;
      room.startingSideTeamB = oldSideB === 'CT' ? 'TR' : 'CT';

      pushSystemChat(io, room, '🔁 REVANCHE INICIADA! Mesmos times, novo Pick & Ban.');
      lifecycle.emitRoomState(room.id, room);
      lifecycle.broadcastRoomsList();
    });

    socket.on('delete_room', ({ roomId }) => {
      const cleanRoomId = String(roomId || '').trim().toUpperCase();
      if (!rooms.has(cleanRoomId)) return;

      const room = rooms.get(cleanRoomId);
      const isEmptyRoom = !room.players || room.players.length === 0;
      if (!isRoomAdmin(room, socket) && !isEmptyRoom) {
        socket.emit('admin_error', { message: 'Apenas o criador da sala pode excluí-la.' });
        return;
      }

      const roomName = room.name || cleanRoomId;
      console.log(`[DELETE_ROOM] Sala ${cleanRoomId} excluída pelo administrador via socket.`);
      io.to(cleanRoomId).emit('room_deleted', {
        roomId: cleanRoomId,
        reason: 'manual',
        message: `A sala ${roomName} foi excluída.`,
      });

      rooms.delete(cleanRoomId);
      lifecycle.broadcastRoomsList();
    });

    socket.on('sync_official_rotation', async () => {
      try {
        const updatedState = await fetchLiveOfficialRotation();
        io.emit('active_rotation_updated', updatedState);
        rooms.forEach((r) => {
          if (r.phase === 'lobby') {
            r.maps = [...updatedState.activeDutyMaps];
            lifecycle.emitRoomState(r.id, r);
          }
        });
      } catch (err) {
        console.warn('[SOCKET] Erro ao sincronizar rotação oficial:', err.message);
      }
    });

    socket.on('set_rcon_password', ({ roomId, rconPassword }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode configurar a senha RCON.' });
        return;
      }
      room.rconPassword = String(rconPassword || '').trim();
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('exec_rcon_command', async ({ roomId, command }, callback) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || !isRoomAdmin(room, socket)) {
        if (typeof callback === 'function') callback({ error: 'Apenas o administrador da sala pode executar comandos RCON.' });
        return;
      }
      if (!room.serverIp || !room.rconPassword) {
        if (typeof callback === 'function') callback({ error: 'Servidor ou senha RCON não configurados nesta sala.' });
        return;
      }

      const cleanCommand = sanitizeRconCommand(command);
      if (!cleanCommand) {
        if (typeof callback === 'function') callback({ error: 'Comando RCON inválido ou vazio.' });
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

    socket.on('change_server_map', async ({ roomId, mapFile }, callback) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room || !isRoomAdmin(room, socket)) {
        if (typeof callback === 'function') callback({ error: 'Apenas o administrador da sala pode trocar o mapa via RCON.' });
        return;
      }
      if (!room.serverIp || !room.rconPassword) {
        if (typeof callback === 'function') callback({ error: 'Servidor ou senha RCON não configurados nesta sala.' });
        return;
      }

      const cleanMap = String(mapFile || 'de_mirage').trim().toLowerCase();
      if (!isValidMapName(cleanMap)) {
        if (typeof callback === 'function') callback({ error: 'Nome de mapa inválido para execução no servidor.' });
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

    socket.on('set_discord_webhook', ({ roomId, webhookUrl, autoLobby = true, autoVeto = true, autoGsiRounds = true, autoGsiBomb = false, autoStats = true }) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (!room) return;
      if (!isRoomAdmin(room, socket)) {
        socket.emit('admin_error', { message: 'Apenas o administrador da sala pode configurar o Webhook.' });
        return;
      }
      const cleanUrl = String(webhookUrl || '').trim();
      if (cleanUrl && !isValidDiscordWebhookUrl(cleanUrl)) {
        socket.emit('admin_error', { message: 'URL de Webhook do Discord inválida.' });
        return;
      }
      room.discordWebhook = cleanUrl;
      room.discordAutoLobby = Boolean(autoLobby);
      room.discordAutoVeto = Boolean(autoVeto);
      room.discordGsiRounds = Boolean(autoGsiRounds);
      room.discordGsiBomb = Boolean(autoGsiBomb);
      room.discordAutoStats = Boolean(autoStats);
      lifecycle.emitRoomState(room.id, room);
    });

    socket.on('send_discord_webhook', async ({ roomId, eventType, data }, callback) => {
      const room = lifecycle.getRoomAndTouch(roomId);
      if (room && !isRoomAdmin(room, socket)) {
        if (typeof callback === 'function') callback({ error: 'Apenas o administrador da sala pode disparar notificações do Mix.' });
        return;
      }
      const targetUrl = String(data?.webhookUrl || room?.discordWebhook || '').trim();
      if (!targetUrl || !isValidDiscordWebhookUrl(targetUrl)) {
        if (typeof callback === 'function') callback({ error: 'Webhook do Discord ausente ou inválido.' });
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

    socket.on('get_leaderboard', (callback) => {
      const data = getLeaderboard();
      if (typeof callback === 'function') callback(data);
      else socket.emit('leaderboard_data', data);
    });

    socket.on('record_leaderboard_match', (matchData, callback) => {
      const activeRoom = socket.roomId ? rooms.get(socket.roomId) : null;
      if (!socket.isSiteAdmin && (!activeRoom || !isRoomAdmin(activeRoom, socket))) {
        if (typeof callback === 'function') callback({ error: 'Permissão insuficiente para registrar partida no ranking.' });
        return;
      }
      const updated = recordMatch(matchData);
      io.emit('leaderboard_updated', updated);
      if (typeof callback === 'function') callback({ success: true, leaderboard: updated });
    });

    socket.on('disconnect', () => {
      // Preserve player slot for brief disconnects
    });
  });
}
