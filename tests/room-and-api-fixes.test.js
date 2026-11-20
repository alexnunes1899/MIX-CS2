import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as ioClient } from 'socket.io-client';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-fixes-test-'));
process.env.DATA_DIR = tempDir;
process.env.SESSION_SECRET = 'test_fixes_secret_0123456789abcdef';
process.env.ADMIN_API_KEY = 'fixes-secret-admin-key';

const { createMixServer } = await import('../server/index.js');
const { getRoomAdminId } = await import('../server/roomHelpers.js');
const { recordMatch, getLeaderboard, isSyntheticPlayerId } = await import('../server/leaderboard.js');
const { getMatchHistoryState } = await import('../server/matchHistory.js');

function waitForEvent(socket, eventName, predicate = null, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timeout waiting for socket event "${eventName}"`));
    }, timeoutMs);

    function onEvent(payload) {
      if (predicate && !predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    }

    socket.on(eventName, onEvent);
  });
}

function connectClient(baseUrl) {
  return new Promise((resolve, reject) => {
    const client = ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    const timer = setTimeout(() => {
      client.close();
      reject(new Error('Socket connection timeout'));
    }, 4000);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

test('getRoomAdminId preserves creatorId when lobby is empty or uses synthetic tourney players', () => {
  assert.equal(getRoomAdminId({ creatorId: 'player-org', adminId: 'player-org', players: [] }), 'player-org');
  assert.equal(
    getRoomAdminId({
      creatorId: 'player-org',
      adminId: 'player-org',
      players: [{ id: 'tourney-a-0-123', nick: 'TourneyPlayer' }],
    }),
    'player-org'
  );
  assert.equal(
    getRoomAdminId({
      creatorId: null,
      adminId: null,
      players: [{ id: 'player-next', nick: 'NextAdmin' }],
    }),
    'player-next'
  );
});

test('leaderboard skips synthetic IDs (t1, t2, tourney-*, bot-*, seed-*, user_test_*)', () => {
  assert.equal(isSyntheticPlayerId('t1'), true);
  assert.equal(isSyntheticPlayerId('t2'), true);
  assert.equal(isSyntheticPlayerId('tourney-a-0-123'), true);
  assert.equal(isSyntheticPlayerId('bot-1'), true);
  assert.equal(isSyntheticPlayerId('seed-1'), true);
  assert.equal(isSyntheticPlayerId('user_test_1'), true);
  assert.equal(isSyntheticPlayerId('76561198000000001'), false);

  recordMatch({
    winners: [
      { id: 't1', nick: 'Time A' },
      { id: 'tourney-a-0-99', nick: 'FakeTourneyA' },
    ],
    losers: [
      { id: 't2', nick: 'Time B' },
      { id: 'bot-1', nick: 'FalleN' },
    ],
    map: 'Mirage',
    scoreWinners: 13,
    scoreLosers: 7,
  });

  const lb = getLeaderboard();
  assert.equal(lb.some((e) => ['t1', 't2', 'bot-1', 'tourney-a-0-99'].includes(e.id)), false);
});

test('Socket integration: send_chat string support, tournament admin preservation, admin transfer & save_score', async (t) => {
  const { server, close } = createMixServer({ startBackgroundTasks: false, buildVersion: 'test-fixes' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await close();
  });

  await t.test('send_chat aceita string (AimReflexModal) e objeto com fallback do jogador conectado', async () => {
    const sock = await connectClient(baseUrl);
    try {
      const joined = waitForEvent(sock, 'room_state', (r) => r.id === 'CHAT-FIX');
      sock.emit('join_room', {
        roomId: 'CHAT-FIX',
        player: { id: 'p-chat-1', nick: 'AimGod', level: 19, avatar: '⚡' },
        createIfMissing: true,
      });
      await joined;

      const strMsgPromise = waitForEvent(sock, 'chat_message', (m) => m.text.includes('185ms'));
      sock.emit('send_chat', { roomId: 'CHAT-FIX', message: '⚡ [CS2 MIX HUB] Teste de Reflexo: 185ms!' });
      const strMsg = await strMsgPromise;
      assert.equal(strMsg.sender.nick, 'AimGod');
      assert.equal(strMsg.sender.level, 19);

      const objMsgPromise = waitForEvent(sock, 'chat_message', (m) => m.text === 'GGWP');
      sock.emit('send_chat', { roomId: 'CHAT-FIX', message: { sender: { nick: 'AimGod', level: 19 }, text: 'GGWP' } });
      const objMsg = await objMsgPromise;
      assert.equal(objMsg.text, 'GGWP');
    } finally {
      sock.close();
    }
  });

  await t.test('Organizador mantém admin após load_tournament_match e remove_player transfere admin ao sair', async () => {
    const orgSock = await connectClient(baseUrl);
    const leaveSock = await connectClient(baseUrl);
    const nextSock = await connectClient(baseUrl);

    try {
      const tourneyJoined = waitForEvent(orgSock, 'room_state', (r) => r.id === 'COPA-FIX');
      orgSock.emit('join_room', {
        roomId: 'COPA-FIX',
        player: { id: 'p-organizer', nick: 'Organizador', level: 18 },
        createIfMissing: true,
      });
      await tourneyJoined;

      const tourneyLoaded = waitForEvent(orgSock, 'room_state', (r) => r.id === 'COPA-FIX' && r.phase === 'teams');
      orgSock.emit('load_tournament_match', {
        roomId: 'COPA-FIX',
        nameA: 'FURIA',
        nameB: 'MIBR',
        teamA: [{ id: 'tourney-a-0-1', nick: 'KSCERATO', level: 16 }],
        teamB: [{ id: 'tourney-b-0-1', nick: 'exit', level: 16 }],
        matchFormat: 'MD3',
      });
      const loadedState = await tourneyLoaded;
      assert.equal(loadedState.adminId, 'p-organizer');

      const vetoStarted = waitForEvent(orgSock, 'room_state', (r) => r.id === 'COPA-FIX' && r.phase === 'veto');
      orgSock.emit('start_veto', { roomId: 'COPA-FIX', matchFormat: 'MD3', firstTeam: 'teamA' });
      const vetoState = await vetoStarted;
      assert.equal(vetoState.phase, 'veto');

      // Test admin transfer on remove_player
      const j1 = waitForEvent(leaveSock, 'room_state', (r) => r.id === 'ADM-PASS');
      leaveSock.emit('join_room', {
        roomId: 'ADM-PASS',
        player: { id: 'p-first', nick: 'FirstAdmin', level: 17 },
        createIfMissing: true,
      });
      await j1;

      const j2 = waitForEvent(nextSock, 'room_state', (r) => r.id === 'ADM-PASS' && r.players.length === 2);
      nextSock.emit('join_room', {
        roomId: 'ADM-PASS',
        player: { id: 'p-second', nick: 'SecondPlayer', level: 16 },
      });
      await j2;

      const transferred = waitForEvent(nextSock, 'room_state', (r) => r.id === 'ADM-PASS' && r.players.length === 1);
      leaveSock.emit('remove_player', { roomId: 'ADM-PASS', playerId: 'p-first' });
      const afterLeave = await transferred;
      assert.equal(afterLeave.adminId, 'p-second');
    } finally {
      orgSock.close();
      leaveSock.close();
      nextSock.close();
    }
  });

  await t.test('save_score usa nomes dos times, registra partidas reais (< 5v5 inclusive) e ignora Quick Veto no ranking', async () => {
    const capSock = await connectClient(baseUrl);
    const p2Sock = await connectClient(baseUrl);

    try {
      const r1 = waitForEvent(capSock, 'room_state', (r) => r.id === 'MIX-2V2');
      capSock.emit('join_room', {
        roomId: 'MIX-2V2',
        player: { id: '76561198555000001', steamId: '76561198555000001', nick: 'AlphaWin', level: 18 },
        createIfMissing: true,
      });
      await r1;

      const r2 = waitForEvent(p2Sock, 'room_state', (r) => r.id === 'MIX-2V2' && r.players.length === 2);
      p2Sock.emit('join_room', {
        roomId: 'MIX-2V2',
        player: { id: '76561198555000002', steamId: '76561198555000002', nick: 'BravoLose', level: 16 },
      });
      await r2;

      const drawn = waitForEvent(capSock, 'room_state', (r) => r.id === 'MIX-2V2' && r.phase === 'teams');
      capSock.emit('draw_teams', { roomId: 'MIX-2V2', mode: 'balanced' });
      const drawnRoom = await drawn;

      const teamAIsAlpha = drawnRoom.teamA.some((p) => p.id === '76561198555000001');
      const scoreA = teamAIsAlpha ? 13 : 9;
      const scoreB = teamAIsAlpha ? 9 : 13;

      const vetoRoom = waitForEvent(capSock, 'room_state', (r) => r.id === 'MIX-2V2' && r.phase === 'veto');
      capSock.emit('start_veto', { roomId: 'MIX-2V2', matchFormat: 'MD1', firstTeam: 'teamA' });
      await vetoRoom;

      const expectedWinner = scoreA > scoreB ? 'Time A' : 'Time B';
      const savedPromise = waitForEvent(capSock, 'room_state', (r) => r.id === 'MIX-2V2' && r.history.length === 1);
      capSock.emit('save_score', { roomId: 'MIX-2V2', scoreA, scoreB, map: 'Inferno' });
      const savedRoom = await savedPromise;
      assert.equal(savedRoom.history[0].winner, expectedWinner);

      const lb = getLeaderboard();
      assert.ok(lb.some((e) => e.steamId === '76561198555000001' && e.wins >= 1));

      const historyState = getMatchHistoryState();
      assert.ok(historyState.matches.some((m) => m.roomId === 'MIX-2V2' && m.winner === expectedWinner));

      // Quick Veto preserves custom team names in room history, without polluting leaderboard or global matchHistory
      const qvJoined = waitForEvent(capSock, 'room_state', (r) => r.id === 'QV-ONLY');
      capSock.emit('join_room', {
        roomId: 'QV-ONLY',
        player: { id: 'p-host-qv', nick: 'HostQV', level: 15 },
        createIfMissing: true,
      });
      await qvJoined;

      const qvVeto = waitForEvent(capSock, 'room_state', (r) => r.id === 'QV-ONLY' && r.phase === 'veto');
      capSock.emit('quick_start_veto', { roomId: 'QV-ONLY', teamAName: 'Imperial', teamBName: 'paiN', matchFormat: 'MD1' });
      await qvVeto;

      const qvSaved = waitForEvent(capSock, 'room_state', (r) => r.id === 'QV-ONLY' && r.history.length === 1);
      capSock.emit('save_score', { roomId: 'QV-ONLY', scoreA: 13, scoreB: 5, map: 'Mirage' });
      const qvRoom = await qvSaved;
      assert.equal(qvRoom.history[0].winner, 'Imperial');

      const lbAfterQv = getLeaderboard();
      assert.equal(lbAfterQv.some((e) => ['t1', 't2'].includes(e.id)), false);
      const histAfterQv = getMatchHistoryState();
      assert.equal(histAfterQv.matches.some((m) => m.roomId === 'QV-ONLY'), false);
    } finally {
      capSock.close();
      p2Sock.close();
    }
  });
});
