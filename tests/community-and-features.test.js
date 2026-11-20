import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { io as ioClient } from 'socket.io-client';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-features-test-'));
process.env.DATA_DIR = tempDir;
process.env.ADMIN_API_KEY = 'features-test-admin-key';
process.env.SESSION_SECRET = 'features_test_secret_0123456789';

const { createSqliteStore } = await import('../server/storage/sqliteStore.js');
const { createAccountLinkService, normalizeLinkCode } = await import('../server/accountLinks.js');
const { balanceTeams } = await import('../shared/balance.js');
const { renderMatchSummaryPng } = await import('../server/utils/matchCardPng.js');
const { createMixScheduler, parseScheduleTimePtBr } = await import('../server/mixScheduler.js');
const { buildSlashCommands } = await import('../server/discord/slashCommands.js');
const { DiscordBotManager } = await import('../server/discordBot.js');
const { discordBotManager } = await import('../server/discordBot.js');
const { serializeMix, deserializeMix } = await import('../server/mixPersistence.js');
const { communityClips } = await import('../server/communityClips.js');
const { renderProfileHtml } = await import('../server/profileHtml.js');
const {
  recordMatch,
  getLeaderboard,
  getSeasonLeaderboard,
  getCurrentSeasonKey,
  formatSeasonLabel,
  computeSeasonPodium,
  getSeasonsSummary,
  linkLeaderboardIdentity,
  syncDiscordProfilesToLeaderboard,
} = await import('../server/leaderboard.js');
const { computePlayerAnalytics } = await import('../server/playerAnalytics.js');
const { createMixServer } = await import('../server/index.js');
const {
  deriveStableFallbackSecret,
  signSessionToken,
  SESSION_COOKIE_NAME,
} = await import('../server/authSession.js');

after(() => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
});

test('SQLite store persists and lists JSON entries cleanly', () => {
  const dbPath = path.join(tempDir, 'unit-store.sqlite');
  const store = createSqliteStore(dbPath, { keepOpen: true });

  store.setJson('ns_test', 'k1', { hello: 'world', n: 42 });
  store.setJson('ns_test', 'k2', { hello: 'cs2', n: 99 });

  const got = store.getJson('ns_test', 'k1');
  assert.deepEqual(got, { hello: 'world', n: 42 });

  const list = store.listNamespace('ns_test');
  assert.equal(list.length, 2);

  store.deleteJson('ns_test', 'k1');
  assert.equal(store.getJson('ns_test', 'k1', null), null);
  store.close();
});

test('Account linking supports Discord->Steam and Steam->Discord 1-time codes', () => {
  const svc = createAccountLinkService({ filePath: path.join(tempDir, 'links-unit.json'), store: null });

  // Flow 1: Discord generates code -> Steam confirms
  const dCode = svc.createDiscordLinkCode({ discordId: '100000000000000001', discordUsername: 'Lxn' });
  assert.equal(dCode.code.length, 6);

  const confirm1 = svc.confirmCodeFromSteam({
    code: dCode.code,
    steamId: '76561198000000001',
    steamNick: 'LxnSteam',
  });
  assert.equal(confirm1.success, true);
  assert.equal(confirm1.link.discordId, '100000000000000001');
  assert.equal(confirm1.link.steamId, '76561198000000001');

  // Re-using same code must fail (one-time)
  const reuse = svc.confirmCodeFromSteam({ code: dCode.code, steamId: '76561198000000002', steamNick: 'Other' });
  assert.equal(reuse.success, false);

  // Unified resolution
  const unified = svc.resolveUnifiedIds({ discordId: '100000000000000001' });
  assert.equal(unified.steamId, '76561198000000001');

  // Flow 2: Web/Steam generates code -> Discord confirms
  const sCode = svc.createSteamLinkCode({ steamId: '76561198000000099', steamNick: 'FalleN' });
  const confirm2 = svc.confirmCodeFromDiscord({
    code: sCode.code,
    discordId: '200000000000000099',
    discordUsername: 'FalleN_DC',
  });
  assert.equal(confirm2.success, true);
  assert.equal(confirm2.link.discordId, '200000000000000099');
});

test('shared/balance preserves fixed duos on the same team while balancing', () => {
  const players = [
    { id: 'p1', nick: 'P1', level: 20, side: 'ANY' },
    { id: 'p2', nick: 'P2', level: 10, side: 'ANY' },
    { id: 'p3', nick: 'P3', level: 18, side: 'ANY' },
    { id: 'p4', nick: 'P4', level: 12, side: 'ANY' },
    { id: 'p5', nick: 'P5', level: 16, side: 'ANY' },
    { id: 'p6', nick: 'P6', level: 16, side: 'ANY' },
    { id: 'p7', nick: 'P7', level: 15, side: 'ANY' },
    { id: 'p8', nick: 'P8', level: 15, side: 'ANY' },
    { id: 'p9', nick: 'P9', level: 14, side: 'ANY' },
    { id: 'p10', nick: 'P10', level: 14, side: 'ANY' },
  ];

  const res = balanceTeams(players, 'gc', {
    duos: [
      ['p1', 'p2'],
      ['p3', 'p4'],
    ],
  });

  assert.equal(res.teamA.length, 5);
  assert.equal(res.teamB.length, 5);
  assert.equal(res.preservedDuos, 2);

  const inA = new Set(res.teamA.map((p) => p.id));
  assert.equal(inA.has('p1'), inA.has('p2'));
  assert.equal(inA.has('p3'), inA.has('p4'));
});

test('Pure-JS matchCardPng renders valid PNG header and scoreboard image buffer', () => {
  const buf = renderMatchSummaryPng({
    map: 'Mirage',
    format: 'MD1',
    dateFormatted: '18/11/2026',
    winner: 'Time Lxn',
    loser: 'Time Rivais',
    scoreWinner: 13,
    scoreLoser: 9,
    mvpNick: 'Lxn',
    mvpStats: { kills: 28, deaths: 14, rating: 1.48 },
    bagreNick: 'BagreMan',
    bagreStats: { kills: 6, deaths: 21 },
    winnerPlayers: [
      { id: '1', nick: 'Lxn', level: 20 },
      { id: '2', nick: 'FalleN', level: 19 },
    ],
    loserPlayers: [
      { id: '3', nick: 'BagreMan', level: 12 },
    ],
  });

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 1500);
  // Official 8-byte PNG file signature
  assert.deepEqual(Array.from(buf.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('MixScheduler parses PT-BR schedule times, handles RSVPs, and triggers 15-min reminders', () => {
  const ref = new Date(2026, 10, 18, 18, 0, 0); // 18:00 local
  const parsed = parseScheduleTimePtBr('21:30', ref);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.formattedTime, '21:30');

  const parsedTomorrow = parseScheduleTimePtBr('amanha 20:00', ref);
  assert.equal(parsedTomorrow.valid, true);
  assert.ok(parsedTomorrow.timestamp > parsed.timestamp);

  const scheduler = createMixScheduler({ filePath: path.join(tempDir, 'sched-unit.json'), store: null });
  const now = Date.now();
  const sched = scheduler.createSchedule({
    guildId: 'g1',
    channelId: 'c1',
    creatorId: 'u1',
    creatorName: 'Alex',
    title: 'Mix Noturno',
    scheduledAt: now + 10 * 60 * 1000, // 10 min from now -> inside 15-min window
  });

  scheduler.rsvp(sched.id, 'u2', 'Friend', 'confirm');
  scheduler.rsvp(sched.id, 'u3', 'MaybeGuy', 'maybe');
  const updated = scheduler.rsvp(sched.id, 'u3', 'MaybeGuy', 'leave');

  assert.equal(updated.confirmed.length, 2);
  assert.equal(updated.maybe.length, 0);

  const due = scheduler.getDueReminders(now);
  assert.ok(due.some((item) => item.id === sched.id));

  scheduler.markReminded(sched.id);
  const dueAfter = scheduler.getDueReminders(now);
  assert.equal(dueAfter.some((item) => item.id === sched.id), false);
});

test('DiscordBotManager integrates pullMembersIntoMix, Inscrever da Call button, duos, and slash commands', (t) => {
  const cmds = buildSlashCommands({
    officialMaps: [{ id: 'de_mirage', name: 'Mirage' }],
    treinoMaps: [{ id: 'mirage', name: 'Mirage' }],
  }).map((c) => c.toJSON());

  assert.ok(cmds.some((c) => c.name === 'vincular'));
  assert.ok(cmds.some((c) => c.name === 'dupla'));
  assert.ok(cmds.some((c) => c.name === 'agendar'));
  const mixCmd = cmds.find((c) => c.name === 'mix');
  assert.ok(mixCmd.options.some((o) => o.name === 'puxar'));

  const bot = new DiscordBotManager();
  bot.client = {
    user: { id: 'bot999', username: 'MixBot' },
    users: { cache: new Map() },
    channels: { cache: new Map() },
    guilds: { cache: new Map() },
  };
  t.after(() => {
    if (bot.liveTrackersSyncInterval) clearInterval(bot.liveTrackersSyncInterval);
  });

  const mix = bot.getOrCreateMix('ch-pull', { id: 'u1', username: 'Alex', displayName: 'Alex' }, { id: 'MIX-PULL1' });
  mix.players = [];

  const rows = bot.buildLobbyButtons(mix);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(row.components.length <= 5, 'Discord ActionRow max is 5 buttons');
  }
  const row3Ids = rows[2].components.map((b) => b.toJSON().custom_id);
  assert.ok(row3Ids.includes('mix_pull_voice:MIX-PULL1'));
  const pullBtn = rows[2].components.map((b) => b.toJSON()).find((b) => b.custom_id === 'mix_pull_voice:MIX-PULL1');
  assert.equal(pullBtn?.label, 'Inscrever da Call');

  const pullRes = bot.pullMembersIntoMix(mix, [
    { id: 'bot-skip', user: { id: 'bot-skip', username: 'Bot', bot: true } },
    { id: 'u1', user: { id: 'u1', username: 'Alex' }, displayName: 'Alex' },
    { id: 'u2', user: { id: 'u2', username: 'Bia' }, displayName: 'Bia' },
    { id: 'u1', user: { id: 'u1', username: 'Alex' }, displayName: 'Alex' }, // duplicate
  ]);
  assert.equal(pullRes.addedStarters.length, 2);
  assert.equal(mix.players.length, 2);

  // Set duo and add more players then balanceTeams
  for (let i = 3; i <= 10; i++) {
    mix.players.push({ id: `u${i}`, username: `P${i}`, level: 15 });
  }
  const duoRes = bot.setMixDuo(mix, 'u1', 'u2');
  assert.equal(duoRes.success, true);
  bot.balanceTeams(mix);
  assert.equal(mix.preservedDuos, 1);
  const teamAIds = new Set(mix.teamA.players.map((p) => p.id));
  assert.equal(teamAIds.has('u1'), teamAIds.has('u2'));
});

test('Monthly seasons, identity merge & playerAnalytics compute accurate metrics', () => {
  const tsNow = new Date(2026, 10, 18, 20, 0, 0).getTime();
  const sKey = getCurrentSeasonKey(new Date(tsNow));
  assert.equal(sKey, '2026-11');
  assert.equal(formatSeasonLabel('2026-11'), 'Novembro 2026');

  const pWin = [
    { id: 's1', steamId: '76561198111111111', nick: 'Alpha', level: 18 },
    { id: 's2', steamId: '76561198222222222', nick: 'Bravo', level: 16 },
  ];
  const pLose = [
    { id: 's3', steamId: '76561198333333333', nick: 'Charlie', level: 15 },
    { id: 's4', steamId: 'discord-444444444444444444', discordId: '444444444444444444', nick: 'DeltaDC', level: 14 },
  ];

  recordMatch({
    winners: pWin,
    losers: pLose,
    map: 'Mirage',
    scoreWinners: 13,
    scoreLosers: 8,
    mvpId: '76561198111111111',
    bagreId: 's3',
    timestamp: tsNow,
  });

  const seasonLb = getSeasonLeaderboard('2026-11');
  assert.ok(seasonLb.some((e) => e.nick === 'Alpha' && e.wins >= 1 && e.mvpCount >= 1));

  const podium = computeSeasonPodium(seasonLb);
  assert.ok(podium.top3.length >= 2);
  assert.equal(podium.mostMvps?.nick, 'Alpha');

  const mergedLb = linkLeaderboardIdentity('444444444444444444', '76561198444444444');
  assert.ok(mergedLb.some((e) => e.discordId === '444444444444444444' && e.steamId === '76561198444444444'));

  const seasons = getSeasonsSummary();
  assert.ok(seasons.some((s) => s.seasonKey === getCurrentSeasonKey()));

  // Player analytics computation from synthetic matches
  const syntheticMatches = [
    {
      id: 'M1',
      timestamp: 1000,
      map: 'Mirage',
      score: '13-7',
      mvpId: '76561198111111111',
      winnerPlayers: [
        { id: 's1', steamId: '76561198111111111', nick: 'Alpha' },
        { id: 's2', steamId: '76561198222222222', nick: 'Bravo' },
      ],
      loserPlayers: [{ id: 's3', steamId: '76561198333333333', nick: 'Charlie' }],
    },
    {
      id: 'M2',
      timestamp: 2000,
      map: 'Mirage',
      score: '13-10',
      mvpId: '76561198111111111',
      winnerPlayers: [
        { id: 's1', steamId: '76561198111111111', nick: 'Alpha' },
        { id: 's2', steamId: '76561198222222222', nick: 'Bravo' },
      ],
      loserPlayers: [{ id: 's3', steamId: '76561198333333333', nick: 'Charlie' }],
    },
  ];

  const analytics = computePlayerAnalytics('76561198111111111', {
    matches: syntheticMatches,
    leaderboard: seasonLb,
  });
  assert.equal(analytics.summary.wins, 2);
  assert.equal(analytics.summary.winRate, 100);
  assert.equal(analytics.mapStats[0].map, 'Mirage');
  assert.equal(analytics.bestPartner.nick, 'Bravo');
  assert.equal(analytics.biggestRival.nick, 'Charlie');
  assert.ok(analytics.badges.some((b) => b.id === 'lethal_duo'));
});

test('HTTP endpoints expose seasons, analytics, schedules, liveMatch & protected RCON presets', async (t) => {
  const { server, rooms, lifecycle, close } = createMixServer({ startBackgroundTasks: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await close();
  });

  // 1. Seasons, Analytics & Schedules endpoints
  const seasonsRes = await fetch(`${baseUrl}/api/leaderboard/seasons`);
  assert.equal(seasonsRes.status, 200);
  const seasonsJson = await seasonsRes.json();
  assert.equal(seasonsJson.success, true);
  assert.ok(Array.isArray(seasonsJson.seasons));

  const analyticsRes = await fetch(`${baseUrl}/api/players/76561198111111111/analytics`);
  assert.equal(analyticsRes.status, 200);
  const analyticsJson = await analyticsRes.json();
  assert.equal(analyticsJson.success, true);

  const schedRes = await fetch(`${baseUrl}/api/schedules`);
  assert.equal(schedRes.status, 200);
  const schedJson = await schedRes.json();
  assert.equal(schedJson.success, true);

  // 3. RCON practice security + validation
  const rconUnauth = await fetch(`${baseUrl}/api/rcon/practice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: '1.2.3.4', port: 27015, password: 'x', preset: 'clear_grenades' }),
  });
  assert.equal(rconUnauth.status, 401);

  const rconBadPreset = await fetch(`${baseUrl}/api/rcon/practice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({ host: '1.2.3.4', port: 27015, password: 'x', preset: 'evil_preset' }),
  });
  assert.equal(rconBadPreset.status, 400);

  // 4. Live GSI room summary in GET /api/rooms
  const liveRoom = lifecycle.getOrCreateRoom('LIVE-SPEC');
  liveRoom.liveMatch = {
    connected: true,
    mapName: 'de_inferno',
    scoreCT: 11,
    scoreTR: 9,
    roundNumber: 21,
    phase: 'live',
    bomb: 'planted',
    aliveCountCT: 3,
    aliveCountTR: 2,
    lastUpdate: Date.now(),
  };
  rooms.set('LIVE-SPEC', liveRoom);

  const roomsRes = await fetch(`${baseUrl}/api/rooms`);
  const roomsJson = await roomsRes.json();
  const targetRoom = roomsJson.find((r) => r.id === 'LIVE-SPEC');
  assert.ok(targetRoom?.liveMatch);
  assert.equal(targetRoom.liveMatch.scoreCT, 11);
  assert.equal(targetRoom.liveMatch.scoreTR, 9);
});

test('PWA manifest and service worker assets are valid and avoid API/HTML lock-in', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('public/site.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2);

  const swContent = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
  assert.ok(swContent.includes('/api/'));
  assert.ok(swContent.includes('/socket.io/'));
  assert.ok(swContent.includes("req.mode === 'navigate'"));
});

test('Regression fixes: SteamID64 vs Discord ID separation, nick collision, streak preservation & code normalization', () => {
  // 1. normalizeLinkCode preserves valid 6-char codes starting with CS while stripping prefixed CS-
  assert.equal(normalizeLinkCode('CS9K2M'), 'CS9K2M');
  assert.equal(normalizeLinkCode('cs-a7k9m2'), 'A7K9M2');
  assert.equal(normalizeLinkCode('cs a7k9m2'), 'A7K9M2');

  // 2. 17-digit SteamID64 passed as `id` must never populate `discordId` or trigger fake unified badge
  const unlinkedSteam = '76561198777777777';
  const lb = recordMatch({
    winners: [{ id: unlinkedSteam, nick: 'PureSteamUser', level: 17 }],
    losers: [{ id: '76561198777777778', nick: 'PureLoserUser', level: 15 }],
    map: 'Mirage',
    scoreWinners: 13,
    scoreLosers: 6,
  });
  const steamEntry = lb.find((e) => e.steamId === unlinkedSteam);
  assert.ok(steamEntry);
  assert.equal(steamEntry.discordId, '');

  const analytics = computePlayerAnalytics(unlinkedSteam, { matches: [], leaderboard: lb });
  assert.equal(analytics.identity.discordId, '');
  assert.equal(analytics.badges.some((b) => b.id === 'unified_account'), false);

  // 3. Two distinct Discord IDs sharing the exact same nick stay separate entries
  recordMatch({
    winners: [{ id: 'discord-888000000000000001', discordId: '888000000000000001', nick: 'SameNick', level: 16 }],
    losers: [{ id: 'discord-888000000000000002', discordId: '888000000000000002', nick: 'SameNick', level: 14 }],
    map: 'Dust II',
    scoreWinners: 13,
    scoreLosers: 10,
  });
  const afterSameNick = getLeaderboard();
  const sameNickRows = afterSameNick.filter((e) => e.nick === 'SameNick');
  assert.equal(sameNickRows.length, 2);

  // 4. syncDiscordProfilesToLeaderboard must not clobber higher streak from Web/unified history
  const dcId = '999000000000000001';
  const stId = '76561198999000001';
  for (let i = 0; i < 3; i++) {
    recordMatch({
      winners: [{ id: stId, steamId: stId, discordId: dcId, nick: 'UnifiedStreaker', level: 18 }],
      losers: [{ id: '76561198999000002', nick: 'Sparring', level: 15 }],
      map: 'Inferno',
      scoreWinners: 13,
      scoreLosers: 7,
    });
  }
  const synced = syncDiscordProfilesToLeaderboard({
    [dcId]: { username: 'UnifiedStreaker', wins: 1, losses: 1, streak: 0, steamId: stId, level: 18 },
  });
  const unifiedEntry = synced.find((e) => e.steamId === stId);
  assert.ok(unifiedEntry);
  assert.equal(unifiedEntry.streak, 3);
});

test('Regression fixes: schedule timezone BRT/calendar validation, mix notifiedMissing Set, clips validation, profile XSS', () => {
  // 1. parseScheduleTimePtBr uses BRT (UTC-03:00) consistently & rejects invalid dates like 31/02
  const refUtc = new Date('2026-11-18T21:00:00.000Z'); // 18:00 BRT on 18/11/2026
  const sched = parseScheduleTimePtBr('21:30', refUtc);
  assert.equal(sched.valid, true);
  assert.equal(new Date(sched.timestamp).toISOString(), '2026-11-19T00:30:00.000Z');
  assert.equal(sched.formattedDate, '18/11/2026');

  const badDate = parseScheduleTimePtBr('31/02 21:00', refUtc);
  assert.equal(badDate.valid, false);

  const pastYearDate = parseScheduleTimePtBr('01/01 21:00', refUtc);
  assert.equal(pastYearDate.valid, true);
  assert.equal(pastYearDate.formattedDate, '01/01/2027');

  // 2. serializeMix / deserializeMix preserves notifiedMissing as Set
  const serialized = serializeMix({
    id: 'MIX-SET',
    notifiedMissing: new Set([1, 2]),
    readyCheck: { confirmed: new Set(['u1']), active: true },
  });
  assert.ok(Array.isArray(serialized.notifiedMissing));
  const deserialized = deserializeMix(JSON.parse(JSON.stringify(serialized)));
  assert.ok(deserialized.notifiedMissing instanceof Set);
  assert.equal(deserialized.notifiedMissing.has(2), true);

  // 3. communityClips rejects invalid voteType without clearing vote, and omits broken <@web:...> mention
  const clip = communityClips.submitClip({ id: 'web:1.2.3.4', username: 'WebGuy' }, 'https://youtu.be/dQw4w9WgXcQ', 'Test Clutch');
  const fireRes = communityClips.voteClip(clip.id, 'voter1', 'fire');
  assert.equal(fireRes.votes.fire.length, 1);
  const invalidVoteRes = communityClips.voteClip(clip.id, 'voter1', 'invalid_type');
  assert.equal(invalidVoteRes, null);
  assert.equal(communityClips.voteClip(clip.id, 'voter1', 'fire')?.votes.fire.length, 0); // toggle still works after preserving

  const embedPayload = communityClips.buildEmbed(clip);
  const desc = embedPayload.embeds[0].toJSON().description;
  assert.equal(desc.includes('<@web:'), false);

  // 4. renderProfileHtml escapes XSS in query parameters
  const xssHtml = renderProfileHtml({
    query: {
      nick: '"><script>alert(1)</script>',
      room: '";alert(2);//',
      phone: '5511999999999',
    },
  });
  assert.equal(xssHtml.includes('<script>alert(1)</script>'), false);
  assert.ok(xssHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(xssHtml.includes('";alert(2);//"'), false);
  assert.ok(xssHtml.includes('\\u0022;alert(2);//'));
});

test('Regression fixes: GSI room isolation, socket send_discord_webhook auth, draw_teams duos & back_to_lobby', async (t) => {
  const { server, rooms, lifecycle, close } = createMixServer({ startBackgroundTasks: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    discordBotManager.lastGsiState = null;
    await close();
  });

  // 1. GET /api/gsi/status/:otherRoom must NOT leak lastGsiState from MIX-ALPHA
  discordBotManager.lastGsiState = {
    roomId: 'MIX-ALPHA',
    mapName: 'de_nuke',
    scoreCT: 9,
    scoreTR: 4,
    receivedAt: Date.now(),
  };
  const otherStatusRes = await fetch(`${baseUrl}/api/gsi/status/MIX-BETA`);
  assert.equal(otherStatusRes.status, 200);
  const otherStatus = await otherStatusRes.json();
  assert.equal(otherStatus.connected, false);
  assert.equal(otherStatus.roomId, 'MIX-BETA');

  // 2. Socket tests: send_discord_webhook auth, draw_teams respecting duos, back_to_lobby
  const client = await new Promise((resolve, reject) => {
    const c = ioClient(baseUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
    c.once('connect', () => resolve(c));
    c.once('connect_error', reject);
  });
  t.after(() => client.close());

  const webhookErr = await new Promise((resolve) => {
    client.emit(
      'send_discord_webhook',
      { roomId: 'NON-EXISTENT', eventType: 'test', data: { webhookUrl: 'https://discord.com/api/webhooks/1/abc' } },
      (res) => resolve(res)
    );
  });
  assert.ok(webhookErr?.error);

  // Create room with 10 players and fixed duo, verify draw_teams honors duos & back_to_lobby works
  const duoRoom = lifecycle.getOrCreateRoom('DUO-WEB');
  duoRoom.creatorId = 'p1';
  duoRoom.adminId = 'p1';
  duoRoom.players = Array.from({ length: 10 }, (_, idx) => ({
    id: `p${idx + 1}`,
    nick: `Player${idx + 1}`,
    level: idx % 2 === 0 ? 20 : 10,
    side: 'ANY',
    ready: true,
  }));
  duoRoom.duos = [['p1', 'p3'], ['p2', 'p4']];
  rooms.set('DUO-WEB', duoRoom);

  const joined = new Promise((resolve) => client.once('room_state', resolve));
  client.emit('join_room', { roomId: 'DUO-WEB', player: duoRoom.players[0] });
  await joined;

  const afterDraw = await new Promise((resolve) => {
    client.once('room_state', resolve);
    client.emit('draw_teams', { roomId: 'DUO-WEB', mode: 'balanced' });
  });
  assert.equal(afterDraw.phase, 'teams');
  assert.equal(afterDraw.teamA.length, 5);
  assert.equal(afterDraw.teamB.length, 5);
  const setA = new Set(afterDraw.teamA.map((p) => p.id));
  assert.equal(setA.has('p1'), setA.has('p3'));
  assert.equal(setA.has('p2'), setA.has('p4'));

  const afterBack = await new Promise((resolve) => {
    client.once('room_state', resolve);
    client.emit('back_to_lobby', { roomId: 'DUO-WEB' });
  });
  assert.equal(afterBack.phase, 'lobby');
  assert.equal(afterBack.players.length, 10);
});

test('Regression fixes: deriveStableFallbackSecret & /api/account/link session flow', async (t) => {
  // 1. deriveStableFallbackSecret returns null without strong secrets and deterministic 64-hex with secrets
  assert.equal(deriveStableFallbackSecret({}), null);
  assert.equal(deriveStableFallbackSecret({ ADMIN_API_KEY: 'too-short' }), null);

  const envA = { ADMIN_API_KEY: 'render-admin-secret-1234', DISCORD_BOT_TOKEN: 'discord-bot-secret-5678' };
  const s1 = deriveStableFallbackSecret(envA);
  const s2 = deriveStableFallbackSecret({ ...envA });
  const s3 = deriveStableFallbackSecret({ ...envA, DISCORD_BOT_TOKEN: 'discord-bot-secret-changed' });
  assert.match(s1, /^[0-9a-f]{64}$/);
  assert.equal(s1, s2);
  assert.notEqual(s1, s3);

  // 2. HTTP flow for GET /api/account/link and POST /api/account/link/code
  const { server, close } = createMixServer({ startBackgroundTasks: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await close();
  });

  // Unauthenticated GET & POST
  const unauthGet = await fetch(`${baseUrl}/api/account/link`);
  assert.equal(unauthGet.status, 200);
  const unauthGetJson = await unauthGet.json();
  assert.equal(unauthGetJson.authenticated, false);
  assert.equal(unauthGetJson.linked, false);

  const unauthCode = await fetch(`${baseUrl}/api/account/link/code`, { method: 'POST' });
  assert.equal(unauthCode.status, 401);
  const unauthCodeJson = await unauthCode.json();
  assert.equal(unauthCodeJson.requiresSteamReauth, true);

  // Authenticated GET & POST with signed mixhub_session cookie
  const token = signSessionToken({ steamId: '76561198000000123', nick: 'LxnSessionTest' });
  const cookieHeader = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;

  const authGet = await fetch(`${baseUrl}/api/account/link`, {
    headers: { Cookie: cookieHeader },
  });
  assert.equal(authGet.status, 200);
  const authGetJson = await authGet.json();
  assert.equal(authGetJson.authenticated, true);
  assert.equal(authGetJson.linked, false);

  const authCode = await fetch(`${baseUrl}/api/account/link/code`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  });
  assert.equal(authCode.status, 200);
  const authCodeJson = await authCode.json();
  assert.equal(authCodeJson.success, true);
  assert.equal(typeof authCodeJson.code, 'string');
  assert.equal(authCodeJson.code.length, 6);
});
