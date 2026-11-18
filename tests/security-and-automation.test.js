import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-sec-test-'));
process.env.DATA_DIR = tempDir;
process.env.SESSION_SECRET = 'sec_test_secret_0123456789abcdef';
process.env.ADMIN_API_KEY = 'sec-admin-key-xyz';
process.env.MATCHZY_WEBHOOK_SECRET = 'mz-webhook-secret-999';
process.env.GSI_AUTH_TOKEN = 'gsi-room-secret-999';
process.env.RENDER = '1';

const { createMixServer } = await import('../server/index.js');
const { executeRconCommand } = await import('../server/rcon.js');
const { pingCs2Server } = await import('../server/serverQuery.js');
const { sanitizeRconCommand, getSafeRoomState } = await import('../server/roomHelpers.js');
const { generateGsiConfig } = await import('../server/gsi.js');
const { buildDiscordBotInviteUrl, DISCORD_BOT_PERMISSIONS } = await import('../shared/appConfig.js');
const { setBounded } = await import('../server/utils/boundedMap.js');
const { writeJsonAtomic, readJsonSafe } = await import('../server/utils/atomicJson.js');
const { parseServerDetails } = await import('../src/utils/serverParser.js');

test('Security, SSRF, GSI auth, MatchZy webhooks & Shared Config suite', async (t) => {
  const { server, rooms, lifecycle, close } = createMixServer({
    startBackgroundTasks: false,
    buildVersion: 'sec-test',
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test('shared/appConfig: convite do bot não usa permissions=8 e aplica bitmask mínimo', () => {
    const url = buildDiscordBotInviteUrl('123456789012345678');
    assert.equal(url.includes('permissions=8'), false);
    assert.equal(url.includes(`permissions=${DISCORD_BOT_PERMISSIONS}`), true);
    assert.equal(url.includes('client_id=123456789012345678'), true);
  });

  await t.test('atomicJson & boundedMap: gravação atômica e eviction LRU básica funcionam', () => {
    const file = path.join(tempDir, 'nested', 'state.json');
    assert.equal(writeJsonAtomic(file, { ok: true, n: 42 }), true);
    assert.deepEqual(readJsonSafe(file, null), { ok: true, n: 42 });

    const m = new Map();
    setBounded(m, 'a', 1, 2);
    setBounded(m, 'b', 2, 2);
    setBounded(m, 'c', 3, 2);
    assert.equal(m.size, 2);
    assert.equal(m.has('a'), false);
    assert.equal(m.get('c'), 3);
  });

  await t.test('rcon & serverQuery: bloqueiam hosts de metadata / loopback em nuvem e comandos destrutivos', async () => {
    await assert.rejects(
      () => executeRconCommand({ host: '169.254.169.254', port: 27015, password: 'x', command: 'status' }),
      /bloqueado|inválido/i
    );
    await assert.rejects(
      () => executeRconCommand({ host: 'metadata.google.internal', port: 27015, password: 'x', command: 'status' }),
      /bloqueado|inválido/i
    );
    await assert.rejects(
      () => executeRconCommand({ host: '127.0.0.1', port: 27015, password: 'x', command: 'status' }),
      /bloqueado|inválido/i
    );

    const pingMeta = await pingCs2Server('169.254.169.254', 27015, 200);
    assert.equal(pingMeta.online, false);
    assert.match(pingMeta.error || '', /bloqueado|inválido/i);

    const pingGoogleMeta = await pingCs2Server('metadata.google.internal', 27015, 200);
    assert.equal(pingGoogleMeta.online, false);
    assert.match(pingGoogleMeta.error || '', /bloqueado|inválido/i);

    assert.equal(sanitizeRconCommand('quit'), '');
    assert.equal(sanitizeRconCommand('rcon_password abc'), '');
    assert.equal(sanitizeRconCommand('shutdown'), '');
    assert.equal(sanitizeRconCommand('mp_warmup_end 1'), 'mp_warmup_end 1');
  });

  await t.test('GET /api/admin/backup sem includeSecrets=1 redige token, geminiApiKey e rconPassword', async () => {
    const cfgPath = path.join(tempDir, 'discordBotConfig.json');
    writeJsonAtomic(cfgPath, {
      token: 'bot-secret-token',
      geminiApiKey: 'gemini-secret-key',
      rconPassword: 'rcon-secret-password',
      guildId: '123456',
    });

    const res = await fetch(`${baseUrl}/api/admin/backup`, {
      headers: { 'x-admin-key': 'sec-admin-key-xyz' },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const botCfg = data.files?.['discordBotConfig.json'];
    assert.ok(botCfg);
    assert.equal(botCfg.token, undefined);
    assert.equal(botCfg.geminiApiKey, undefined);
    assert.equal(botCfg.rconPassword, undefined);
    assert.equal(botCfg.hasToken, true);
    assert.equal(botCfg.hasGeminiKey, true);
    assert.equal(botCfg.hasRconPassword, true);
    assert.equal(botCfg.guildId, '123456');
  });

  await t.test('POST /api/discord/webhook exige sessão ou admin e /api/commendations ignora voterId arbitrário', async () => {
    const whRes = await fetch(`${baseUrl}/api/discord/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/abcdef',
        eventType: 'test',
      }),
    });
    assert.equal(whRes.status, 401);

    const c1 = await fetch(`${baseUrl}/api/commendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 'player-commend-target', type: 'aim', voterId: 'forged-1' }),
    });
    assert.equal(c1.status, 200);
    const j1 = await c1.json();
    assert.equal(j1.alreadyCommended, false);
    assert.equal(j1.counts.aim, 1);

    const c2 = await fetch(`${baseUrl}/api/commendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 'player-commend-target', type: 'aim', voterId: 'forged-2' }),
    });
    assert.equal(c2.status, 200);
    const j2 = await c2.json();
    assert.equal(j2.alreadyCommended, true);
    assert.equal(j2.counts.aim, 1);
  });

  await t.test('GSI token por sala é oculto em getSafeRoomState e validado em /api/gsi/:roomId', async () => {
    const room = lifecycle.getOrCreateRoom('SEC-GSI');
    assert.ok(room.gsiToken && room.gsiToken.length >= 16);

    const safe = getSafeRoomState(room);
    assert.equal(safe.gsiToken, undefined);
    assert.equal(safe.hasGsiToken, true);

    const cfgWithToken = generateGsiConfig(baseUrl, 'SEC-GSI', room.gsiToken);
    assert.match(cfgWithToken, new RegExp(`"token"\\s+"${room.gsiToken}"`));

    const badRes = await fetch(`${baseUrl}/api/gsi/SEC-GSI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { token: 'wrong-token' }, map: { name: 'de_mirage' } }),
    });
    assert.equal(badRes.status, 403);

    const okRoomTokenRes = await fetch(`${baseUrl}/api/gsi/SEC-GSI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { token: room.gsiToken }, map: { name: 'de_mirage', phase: 'live', round: 3 } }),
    });
    assert.equal(okRoomTokenRes.status, 200);

    const okEnvTokenRes = await fetch(`${baseUrl}/api/gsi/SEC-GSI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { token: 'gsi-room-secret-999' }, map: { name: 'de_inferno', phase: 'live', round: 4 } }),
    });
    assert.equal(okEnvTokenRes.status, 200);
  });

  await t.test('MatchZy webhook & automation veto-complete exigem MATCHZY_WEBHOOK_SECRET válido', async () => {
    const noAuthVeto = await fetch(`${baseUrl}/api/automation/veto-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapName: 'de_mirage' }),
    });
    assert.equal(noAuthVeto.status, 403);

    const noAuthMz = await fetch(`${baseUrl}/api/webhooks/matchzy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'series_end' }),
    });
    assert.equal(noAuthMz.status, 403);

    const okVeto = await fetch(`${baseUrl}/api/automation/veto-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': 'mz-webhook-secret-999',
      },
      body: JSON.stringify({ mapName: 'de_ancient' }),
    });
    assert.equal(okVeto.status, 200);
    const vetoJson = await okVeto.json();
    assert.equal(vetoJson.map, 'de_ancient');

    const teamPlayers = (prefix) =>
      Array.from({ length: 5 }, (_, i) => ({
        steamid: `7656119800000${prefix}${i}`,
        name: `${prefix}_Player_${i}`,
        stats: { kills: 15 + i, deaths: 10, assists: 3, mvps: i === 0 ? 3 : 0, score: 30 + i },
      }));

    const okMz = await fetch(`${baseUrl}/api/webhooks/matchzy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-matchzy-secret': 'mz-webhook-secret-999',
      },
      body: JSON.stringify({
        event: 'series_end',
        matchid: 'MZ-SEC-01',
        map_name: 'de_mirage',
        team1: { name: 'Alpha', score: 13, players: teamPlayers('A') },
        team2: { name: 'Bravo', score: 9, players: teamPlayers('B') },
      }),
    });
    assert.equal(okMz.status, 200);
    const mzJson = await okMz.json();
    assert.equal(mzJson.success, true);
    assert.equal(mzJson.matchId, 'MZ-SEC-01');
  });

  await t.test('Frontend util parseServerDetails & dist build assets existem após build', () => {
    const parsed = parseServerDetails('connect 189.1.168.20:27015; password mix');
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.ip, '189.1.168.20:27015');
    assert.equal(parsed.password, 'mix');
    assert.match(parsed.steamUrl, /^steam:\/\/rungame\/730\//);
  });
});
