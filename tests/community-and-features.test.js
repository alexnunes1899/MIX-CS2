import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-features-test-'));
process.env.DATA_DIR = tempDir;
process.env.ADMIN_API_KEY = 'features-test-admin-key';
process.env.SESSION_SECRET = 'features_test_secret_0123456789';

const { createSqliteStore } = await import('../server/storage/sqliteStore.js');
const { createAccountLinkService } = await import('../server/accountLinks.js');
const { balanceTeams } = await import('../shared/balance.js');
const { renderMatchSummaryPng } = await import('../server/utils/matchCardPng.js');
const { createMixScheduler, parseScheduleTimePtBr } = await import('../server/mixScheduler.js');
const { buildSlashCommands } = await import('../server/discord/slashCommands.js');
const { DiscordBotManager } = await import('../server/discordBot.js');
const {
  recordMatch,
  getSeasonLeaderboard,
  getCurrentSeasonKey,
  formatSeasonLabel,
  computeSeasonPodium,
  getSeasonsSummary,
  linkLeaderboardIdentity,
} = await import('../server/leaderboard.js');
const { computePlayerAnalytics } = await import('../server/playerAnalytics.js');
const { createMixServer } = await import('../server/index.js');

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

test('DiscordBotManager integrates pullMembersIntoMix, Puxar da Call button, duos, and slash commands', (t) => {
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

test('HTTP endpoints expose clips, seasons, analytics, schedules, liveMatch & protected RCON presets', async (t) => {
  const { server, rooms, lifecycle, close } = createMixServer({ startBackgroundTasks: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await close();
  });

  // 1. Clips submit, list & vote
  const postClipRes = await fetch(`${baseUrl}/api/community/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Ace de Deagle na Mirage',
      map: 'Mirage',
    }),
  });
  assert.equal(postClipRes.status, 201);
  const clipCreated = await postClipRes.json();
  assert.equal(clipCreated.success, true);
  assert.ok(clipCreated.clip.id);

  const voteRes = await fetch(`${baseUrl}/api/community/clips/${clipCreated.clip.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voteType: 'fire' }),
  });
  assert.equal(voteRes.status, 200);
  const voteData = await voteRes.json();
  assert.equal(voteData.clip.votes.fire.length, 1);

  const clipsGet = await fetch(`${baseUrl}/api/community/clips?sort=top`);
  const clipsJson = await clipsGet.json();
  assert.ok(clipsJson.clips.length >= 1);
  assert.ok(clipsJson.clipOfTheWeek);

  // 2. Seasons, Analytics & Schedules endpoints
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
