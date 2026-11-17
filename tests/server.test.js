import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as ioClient } from 'socket.io-client';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-srv-test-'));
process.env.DATA_DIR = tempDir;
process.env.SESSION_SECRET = 'test_server_secret_0123456789abcdef';
process.env.ADMIN_API_KEY = 'super-secret-admin-key';
process.env.RENDER = '1';

const { createMixServer } = await import('../server/index.js');

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

test('HTTP + Socket.IO server integration suite', async (t) => {
  const { server, close } = createMixServer({ startBackgroundTasks: false, buildVersion: 'test-v1' });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await close();
  });

  await t.test('GET /api/health e GET /api/lan-ip em modo cloud não vazam IP local', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');

    const lanRes = await fetch(`${baseUrl}/api/lan-ip`);
    assert.equal(lanRes.status, 200);
    const lan = await lanRes.json();
    assert.equal(lan.isCloudHosted, true);
    assert.deepEqual(lan.ips, []);
  });

  await t.test('GET /connect escapa caracteres perigosos contra XSS refletido', async () => {
    const res = await fetch(`${baseUrl}/connect?ip=${encodeURIComponent('127.0.0.1:27015</script><script>alert(1)</script>')}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!html.includes('<script>alert(1)</script>'), 'Reflected script tag must be escaped');
    assert.ok(!html.includes('</script><script>alert(1)'), 'Closing script tag breakout must be escaped');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  await t.test('GET /api/avatar-proxy rejeita URLs inválidas ou fora da allowlist contra SSRF', async () => {
    const missing = await fetch(`${baseUrl}/api/avatar-proxy`);
    assert.equal(missing.status, 400);

    const evil = await fetch(`${baseUrl}/api/avatar-proxy?url=${encodeURIComponent('http://127.0.0.1:3001/api/admin/backup')}`);
    assert.equal(evil.status, 400);

    const untrusted = await fetch(`${baseUrl}/api/avatar-proxy?url=${encodeURIComponent('https://evil.example/avatar.png')}`);
    assert.equal(untrusted.status, 400);
  });

  await t.test('Endpoints admin exigem ADMIN_API_KEY válida e liberam backup quando autorizados', async () => {
    const unauthCfg = await fetch(`${baseUrl}/api/discord/bot/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId: '123' }),
    });
    assert.equal(unauthCfg.status, 403);

    const unauthBackup = await fetch(`${baseUrl}/api/admin/backup`);
    assert.equal(unauthBackup.status, 403);

    const authBackup = await fetch(`${baseUrl}/api/admin/backup`, {
      headers: { 'x-admin-key': 'super-secret-admin-key' },
    });
    assert.equal(authBackup.status, 200);
    const backup = await authBackup.json();
    assert.ok(backup.exportedAt);
    assert.ok(backup.files && typeof backup.files === 'object');
  });

  await t.test('Sala com senha exige validação real via scrypt (password_required / wrong_password / valid)', async () => {
    const creator = await connectClient(baseUrl);
    const intruder = await connectClient(baseUrl);

    try {
      const createdPromise = waitForEvent(creator, 'room_state', (r) => r.id === 'PASS-ROOM');
      creator.emit('join_room', {
        roomId: 'PASS-ROOM',
        roomName: 'Sala Protegida',
        password: 'mix-password-99',
        player: { id: 'p-creator', nick: 'HostUser', level: 18 },
        createIfMissing: true,
      });
      const createdRoom = await createdPromise;
      assert.equal(createdRoom.hasPassword, true);
      assert.equal(createdRoom.passwordHash, undefined, 'Never leak passwordHash to clients');

      const missingErr = waitForEvent(intruder, 'room_auth_error');
      intruder.emit('join_room', {
        roomId: 'PASS-ROOM',
        player: { id: 'p-guest', nick: 'GuestUser', level: 15 },
      });
      const e1 = await missingErr;
      assert.equal(e1.error, 'password_required');

      const wrongErr = waitForEvent(intruder, 'room_auth_error');
      intruder.emit('join_room', {
        roomId: 'PASS-ROOM',
        password: 'wrong-password',
        player: { id: 'p-guest', nick: 'GuestUser', level: 15 },
      });
      const e2 = await wrongErr;
      assert.equal(e2.error, 'wrong_password');

      const okJoin = waitForEvent(intruder, 'room_state', (r) => r.id === 'PASS-ROOM' && r.players.some((p) => p.id === 'p-guest'));
      intruder.emit('join_room', {
        roomId: 'PASS-ROOM',
        password: 'mix-password-99',
        player: { id: 'p-guest', nick: 'GuestUser', level: 15 },
      });
      const joined = await okJoin;
      assert.equal(joined.players.length, 2);
    } finally {
      creator.close();
      intruder.close();
    }
  });

  await t.test('Permissões, Ready Check, Turno de Veto, Revanche e Comendações funcionam em tempo real', async () => {
    const adminSock = await connectClient(baseUrl);
    const playerBSock = await connectClient(baseUrl);

    try {
      const r1 = waitForEvent(adminSock, 'room_state', (r) => r.id === 'MIX-INTEG');
      adminSock.emit('join_room', {
        roomId: 'MIX-INTEG',
        player: { id: 'p-alpha', nick: 'AlphaCap', level: 20 },
        createIfMissing: true,
      });
      await r1;

      const r2 = waitForEvent(playerBSock, 'room_state', (r) => r.id === 'MIX-INTEG' && r.players.length === 2);
      playerBSock.emit('join_room', {
        roomId: 'MIX-INTEG',
        player: { id: 'p-bravo', nick: 'BravoCap', level: 19 },
      });
      await r2;

      // Non-admin cannot start Ready Check
      const deniedReadyCheck = waitForEvent(playerBSock, 'admin_error');
      playerBSock.emit('start_ready_check', { roomId: 'MIX-INTEG', durationSeconds: 30 });
      await deniedReadyCheck;

      // Admin starts Ready Check & playerB confirms
      const rcPending = waitForEvent(playerBSock, 'room_state', (r) => r.readyCheck?.active === true);
      adminSock.emit('start_ready_check', { roomId: 'MIX-INTEG', durationSeconds: 25 });
      await rcPending;

      const rcDone = waitForEvent(adminSock, 'room_state', (r) => r.readyCheck?.status === 'completed');
      playerBSock.emit('accept_ready_check', { roomId: 'MIX-INTEG' });
      const completedRcRoom = await rcDone;
      assert.equal(completedRcRoom.readyCheck.active, false);

      // Draw teams & enter veto (two real human players => team turn enforcement active)
      const teamsFormed = waitForEvent(adminSock, 'room_state', (r) => r.phase === 'teams' && r.teamA.length === 1 && r.teamB.length === 1);
      adminSock.emit('draw_teams', { roomId: 'MIX-INTEG', mode: 'balanced' });
      const drawnRoom = await teamsFormed;

      const isAlphaTeamA = drawnRoom.teamA.some((p) => p.id === 'p-alpha');
      const adminTeam = isAlphaTeamA ? 'teamA' : 'teamB';
      const expectedRematchFirstTeam = adminTeam === 'teamA' ? 'teamB' : 'teamA';

      const vetoStarted = waitForEvent(adminSock, 'room_state', (r) => r.phase === 'veto');
      adminSock.emit('start_veto', { roomId: 'MIX-INTEG', matchFormat: 'MD1', firstTeam: adminTeam });
      await vetoStarted;

      // Non-admin player on the opposing team cannot ban out of turn
      const turnDenied = waitForEvent(playerBSock, 'admin_error');
      playerBSock.emit('ban_map', { roomId: 'MIX-INTEG', mapId: 'de_mirage' });
      await turnDenied;

      // Finish quick_random_map then test rematch_same_teams (regression test for CS2_MAPS ReferenceError)
      const finishedState = waitForEvent(adminSock, 'room_state', (r) => r.phase === 'finished');
      adminSock.emit('quick_random_map', { roomId: 'MIX-INTEG' });
      await finishedState;

      const rematchState = waitForEvent(adminSock, 'room_state', (r) => r.phase === 'veto' && r.bannedMaps.length === 0);
      adminSock.emit('rematch_same_teams', { roomId: 'MIX-INTEG' });
      const afterRematch = await rematchState;
      assert.equal(afterRematch.vetoFirstTeam, expectedRematchFirstTeam);

      // Commend player persists to DATA_DIR
      const commendAck = await new Promise((resolve) => {
        adminSock.emit(
          'commend_player',
          { roomId: 'MIX-INTEG', targetPlayerId: 'p-bravo', targetNick: 'BravoCap', type: 'leader' },
          resolve
        );
      });
      assert.equal(commendAck.success, true);
      assert.equal(commendAck.counts.leader, 1);

      const storePath = path.join(tempDir, 'commendationsStore.json');
      assert.ok(fs.existsSync(storePath), 'commendationsStore.json should exist in DATA_DIR');
    } finally {
      adminSock.close();
      playerBSock.close();
    }
  });

  await t.test('GET /api/treino/* entrega treino.cfg, LEIA-ME.md e instalador PowerShell personalizados', async () => {
    const cfgRes = await fetch(`${baseUrl}/api/treino/cfg?rethrow=alt&autoexecName=custom_exec`);
    assert.equal(cfgRes.status, 200);
    const cfgText = await cfgRes.text();
    assert.match(cfgText, /bind "alt" "sv_rethrow_last_grenade"/);
    assert.match(cfgText, /exec custom_exec;/);

    const mdRes = await fetch(`${baseUrl}/api/treino/leia-me?rethrow=alt`);
    assert.equal(mdRes.status, 200);
    const mdText = await mdRes.text();
    assert.match(mdText, /Guia de Uso/);

    const ps1Res = await fetch(`${baseUrl}/api/treino/installer.ps1?rethrow=alt`);
    assert.equal(ps1Res.status, 200);
    const ps1Text = await ps1Res.text();
    assert.match(ps1Text, /treino\.cfg/);
    assert.match(ps1Text, /Get-Cs2Paths/);
  });
});
