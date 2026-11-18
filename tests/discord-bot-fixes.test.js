import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate all filesystem reads/writes made by server modules into a temp directory
const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-bot-test-'));
process.env.DATA_DIR = tmpDataDir;

const {
  DiscordBotManager,
  resolveGrenadeMapKey,
  extractHostAndPort,
  resolveSlashRegistrationTargets,
  computePlayerAchievements,
} = await import('../server/discordBot.js');
const {
  buildTreinoCfg,
  buildTreinoLeiaMeMd,
  buildTreinoRconCommands,
  resolveTreinoMapKey,
} = await import('../shared/treinoCfg.js');
const {
  detectNaturalIntent,
  buildCoachContext,
  buildDeterministicCoachReply,
  recordCoachTurn,
  getCoachConversationHistory,
  clearCoachConversationHistory,
  buildPostMatchCoachInsight,
} = await import('../server/discordAiRouter.js');
const { BagreVoteService } = await import('../server/bagreVote.js');
const { ProMatchesAgendaService } = await import('../server/proMatchesAgenda.js');

after(() => {
  fs.rmSync(tmpDataDir, { recursive: true, force: true });
});

function createBot(t) {
  const bot = new DiscordBotManager();
  bot.config.publicWebUrl = 'https://mix-cs2.onrender.com';
  bot.client = {
    user: { id: '999999999999999999', username: 'MixHubBot' },
    users: { cache: new Map() },
    channels: { cache: new Map() },
    guilds: { cache: new Map() },
  };
  t.after(() => {
    if (bot.liveTrackersSyncInterval) clearInterval(bot.liveTrackersSyncInterval);
    if (bot.dealsMonitorInterval) clearInterval(bot.dealsMonitorInterval);
    if (bot.cs2UpdateRadarInterval) clearInterval(bot.cs2UpdateRadarInterval);
    if (bot._initialDealsTimeout) clearTimeout(bot._initialDealsTimeout);
    if (bot._initialUpdatesTimeout) clearTimeout(bot._initialUpdatesTimeout);
    for (const mix of bot.activeMixes?.values?.() || []) {
      if (mix?.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
    }
  });
  return bot;
}

function makePlayers(count = 10, startLvl = 11) {
  return Array.from({ length: count }, (_, idx) => {
    const id = String(100000000000000001n + BigInt(idx));
    return {
      id,
      username: `Player${idx + 1}`,
      displayName: `Player${idx + 1}`,
      avatar: '',
      level: ((startLvl + idx - 1) % 21) + 1,
      ready: true,
    };
  });
}

test('resolveGrenadeMapKey supports all 10 maps, aliases and rejects unknown maps', () => {
  const expectedMaps = [
    ['mirage', 'mirage'],
    ['de_mirage', 'mirage'],
    ['mir', 'mirage'],
    ['inferno', 'inferno'],
    ['nuke', 'nuke'],
    ['d2', 'dust2'],
    ['dust2', 'dust2'],
    ['ancient', 'ancient'],
    ['anubis', 'anubis'],
    ['ovp', 'overpass'],
    ['de_overpass', 'overpass'],
    ['trn', 'train'],
    ['train', 'train'],
    ['cac', 'cache'],
    ['cache', 'cache'],
    ['vrg', 'vertigo'],
    ['vertigo', 'vertigo'],
  ];
  for (const [input, expected] of expectedMaps) {
    assert.equal(resolveGrenadeMapKey(input), expected, `Failed for ${input}`);
  }
  assert.equal(resolveGrenadeMapKey(''), 'mirage');
  assert.equal(resolveGrenadeMapKey('de_aztec'), null);
});

test('extractHostAndPort extracts host, port, password and normalized string', () => {
  const parsed = extractHostAndPort('connect 189.1.168.20:27020; password mixpass');
  assert.equal(parsed.host, '189.1.168.20');
  assert.equal(parsed.port, 27020);
  assert.equal(parsed.hostPort, '189.1.168.20:27020');
  assert.equal(parsed.password, 'mixpass');
  assert.equal(parsed.normalized, '189.1.168.20:27020; password mixpass');
});

test('BagreVoteService deduplicates candidates, rejects none, counts live votes, and reuses role', async () => {
  const service = new BagreVoteService();
  const emptyMix = { id: 'MIX-EMPTY', name: 'Vazio', players: [] };
  const emptyMenus = service.buildVoteMenu(emptyMix);
  assert.equal(emptyMenus.length, 2);
  assert.equal(emptyMenus[0].components[0].toJSON().disabled, true);
  assert.equal(emptyMenus[1].components[0].toJSON().disabled, true);
  const invalidVote = service.castVote('MIX-EMPTY', '100000000000000001', 'none');
  assert.equal(invalidVote.success, false);

  const p1 = { id: '100000000000000001', username: 'Fallen', displayName: 'FalleN' };
  const p2 = { id: '100000000000000002', username: 'Kscerato', displayName: 'KSCERATO' };
  const mix = {
    id: 'MIX-BAGRE-1',
    name: 'Mix Bagre',
    players: [p1, p1, p2],
    teamA: { players: [p1] },
    teamB: { players: [p2] },
  };

  const session = service.startOrGetVote(mix);
  assert.equal(session.candidates.length, 2);

  const okVote = service.castVote(mix.id, '100000000000000009', p2.id);
  assert.equal(okVote.success, true);
  assert.equal(okVote.totalVotes, 1);

  const embedJson = service.buildVoteEmbed(mix).toJSON();
  assert.match(embedJson.description, /Votos computados até agora.*1/);
  assert.match(embedJson.description, /1 voto/);

  // Mock guild with existing Bagre do Mix role currently held by p1
  let removedFromP1 = false;
  let addedToP2 = false;
  let createRoleCalled = false;
  const existingRole = { id: 'role-bagre', name: 'Bagre do Mix 🐟' };
  const memberP1 = {
    id: p1.id,
    roles: {
      cache: new Map([[existingRole.id, existingRole]]),
      remove: async (r) => {
        if (r.id === existingRole.id) removedFromP1 = true;
      },
    },
  };
  const memberP2 = {
    id: p2.id,
    roles: {
      cache: new Map(),
      add: async (r) => {
        if (r.id === existingRole.id) addedToP2 = true;
      },
    },
  };
  const guild = {
    roles: {
      cache: [existingRole],
      create: async () => {
        createRoleCalled = true;
        return existingRole;
      },
    },
    members: {
      cache: new Map([[p1.id, memberP1], [p2.id, memberP2]]),
      fetch: async (id) => (id === p2.id ? memberP2 : id === p1.id ? memberP1 : null),
    },
  };
  guild.roles.cache.find = (fn) => [existingRole].find(fn);
  guild.members.cache.filter = (fn) => {
    const out = new Map();
    for (const [k, v] of [[p1.id, memberP1], [p2.id, memberP2]]) {
      if (fn(v)) out.set(k, v);
    }
    return out;
  };

  const profiles = {};
  let saved = false;
  const sentEmbeds = [];
  const finishEmbed = await service.finishVote(
    mix,
    { send: async (payload) => sentEmbeds.push(payload) },
    guild,
    profiles,
    () => { saved = true; }
  );

  assert.ok(finishEmbed);
  assert.equal(createRoleCalled, false);
  assert.equal(removedFromP1, true);
  assert.equal(addedToP2, true);
  assert.equal(saved, true);
  assert.equal(profiles[p2.id].bagres, 1);
  assert.equal(sentEmbeds.length, 1);
});

test('recoverMixFromMessage rejects unrelated embeds and finished mixes', (t) => {
  const bot = createBot(t);

  const nonMixInteraction = {
    channelId: 'ch-recover',
    user: { id: '100000000000000001', username: 'Alex' },
    message: { embeds: [{ title: 'Resultado qualquer', fields: [] }] },
  };
  assert.equal(bot.recoverMixFromMessage(nonMixInteraction, 'MIX-FAKE'), null);

  bot.lastFinishedMixes.set('MIX-DONE', { id: 'MIX-DONE', phase: 'finished' });
  const finishedInteraction = {
    channelId: 'ch-recover',
    user: { id: '100000000000000001', username: 'Alex' },
    message: { embeds: [{ title: '🎮 CS2 MIX HUB • MIX TESTE', fields: [] }] },
  };
  assert.equal(bot.recoverMixFromMessage(finishedInteraction, 'MIX-DONE'), null);

  const validInteraction = {
    channelId: 'ch-recover',
    user: { id: '100000000000000001', username: 'Alex', displayAvatarURL: () => '' },
    message: {
      embeds: [
        {
          title: '🎮 CS2 MIX HUB • MIX DE SEXTA',
          fields: [
            {
              name: '👥 Jogadores Conectados (2/10)',
              value: '**1.** 👑🎮 <@100000000000000001> `[Discord • Lvl 18 GC 🏆]`\n**2.** 🎮 <@100000000000000002> `[Discord • Lvl 15 GC 🥇]`',
            },
          ],
        },
      ],
    },
  };
  const recovered = bot.recoverMixFromMessage(validInteraction, 'MIX-REC1');
  assert.ok(recovered);
  assert.equal(recovered.id, 'MIX-REC1');
  assert.equal(recovered.name, 'MIX DE SEXTA');
  assert.equal(recovered.players.length, 2);
  assert.equal(recovered.players[0].level, 18);
  assert.equal(recovered.players[1].level, 15);
});

test('Channel and narration isolation across multiple channels and Web rooms', (t) => {
  const bot = createBot(t);
  const webRooms = new Map();
  webRooms.set('OTHER-ROOM', { id: 'OTHER-ROOM', phase: 'lobby', players: [], name: 'Outras Salas' });
  bot.setWebRoomsReference(webRooms);

  const mixA = bot.getOrCreateMix('ch-A', { id: '100000000000000001', username: 'Alice' }, { id: 'MIX-A', name: 'Mix A' });
  const mixB = bot.getOrCreateMix('ch-B', { id: '100000000000000002', username: 'Bob' }, { id: 'MIX-B', name: 'Mix B' });

  // Unrelated WebRoom stays untouched when updating mixA
  assert.equal(webRooms.get('OTHER-ROOM').players.length, 0);
  assert.equal(bot.resolveActiveMixForChannel('ch-A')?.id, 'MIX-A');
  assert.equal(bot.resolveActiveMixForChannel('ch-B')?.id, 'MIX-B');

  // Interaction in ch-B with customId referencing MIX-A must NOT return MIX-A
  assert.equal(
    bot.resolveMixFromInteraction({ channelId: 'ch-B', customId: 'mix_join:MIX-A' }),
    null
  );
  assert.equal(
    bot.resolveMixFromInteraction({ channelId: 'ch-A', customId: 'mix_join:MIX-A' })?.id,
    'MIX-A'
  );

  // Build Live Match embed with null mix should NOT fall back to mixA
  bot.lastGsiState = { receivedAt: Date.now(), player: { name: 'FalleN', team: 'CT' } };
  mixA.phase = 'live';
  mixA.teamA.players = makePlayers(5);
  mixA.teamB.players = makePlayers(5, 6);
  const genericEmbed = bot.buildLiveMatchEmbed('Spectator', null, true, null).toJSON();
  assert.equal(
    (genericEmbed.fields || []).some((f) => f.name?.includes('TIME A (')),
    false
  );

  // Narration toggle stays scoped to ch-A
  const stateA = bot.toggleNarration(mixA, 'ch-A');
  assert.equal(stateA, true);
  assert.equal(bot.isNarrationActive(mixA, 'ch-A'), true);
  assert.equal(bot.isNarrationActive(mixB, 'ch-B'), false);
  assert.equal(bot.isNarrationActive(null, 'ch-C'), false);

  const btnsB = bot.buildLiveMatchButtons(true, false, 'MIX-B', mixB, 'ch-B')[0].components.map((b) => b.toJSON());
  assert.equal(btnsB.find((b) => b.custom_id === 'live_toggle_narration')?.label, 'Narração: OFF');
});

test('syncToWebRoom synchronizes all Discord phases and veto/map telemetry', (t) => {
  const bot = createBot(t);
  const webRooms = new Map();
  let broadcastCount = 0;
  bot.setWebRoomsReference(webRooms);
  bot.onRoomUpdated = () => { broadcastCount++; };

  const mix = bot.getOrCreateMix(
    'ch-sync',
    { id: '100000000000000001', username: 'Creator' },
    { id: 'MIX-SYNC', name: 'Mix Sync' }
  );
  mix.players = makePlayers(10);
  mix.waitlist = [{ id: '100000000000000099', username: 'Sub1', displayName: 'Sub1', level: 15 }];
  bot.balanceTeams(mix);

  let room = webRooms.get('MIX-SYNC');
  assert.equal(room.phase, 'teams');
  assert.equal(room.waitlist.length, 1);
  assert.equal(room.metrics.balancePercentage, mix.balancePct);

  bot.startCaptainDraft1v1(mix);
  room = webRooms.get('MIX-SYNC');
  assert.equal(room.phase, 'captains_draft');
  assert.equal(room.unassignedPlayers.length, 8);
  assert.equal(room.captainTurn, 'captainA');

  mix.phase = 'side_pick';
  mix.veto.bannedMaps = [{ map: { id: 'de_mirage', name: 'Mirage' }, by: mix.teamA.captain.id, team: 'teamA' }];
  mix.veto.deciderMap = { id: 'de_nuke', name: 'Nuke', image: 'img' };
  mix.finalMap = { id: 'de_nuke', name: 'Nuke', file: 'de_nuke', image: 'img' };
  bot.syncToWebRoom(mix);
  room = webRooms.get('MIX-SYNC');
  assert.equal(room.phase, 'side_pick');
  assert.equal(room.bannedMaps.length, 1);
  assert.equal(room.finalMap.id, 'de_nuke');
  assert.ok(broadcastCount > 0);
});

test('Draft mode toggle, waitlist 3/3 promotion, and 2-step interactive substitute picker work end-to-end', async (t) => {
  const bot = createBot(t);
  const players = makePlayers(10);
  const subPlayer = { id: '100000000000000099', username: 'ReserveOne', displayName: 'ReserveOne', avatar: '', level: 19, ready: true };
  for (const p of [...players, subPlayer]) {
    bot.setPlayerProfile(p.id, { level: p.level, username: p.username });
  }

  const mix = bot.getOrCreateMix('ch-sub', players[0], { id: 'MIX-SUB1', name: 'Mix Substituto' });
  mix.players = [...players];
  mix.readyCheck = { active: true, confirmed: new Set([players[0].id]), timer: null, deadline: Date.now() + 60000 };

  // Toggle mode button (balanced <-> captains)
  let toggleUpdatePayload = null;
  await bot.handleButtonInteraction({
    customId: 'mix_toggle_mode:MIX-SUB1',
    channelId: 'ch-sub',
    user: players[0],
    member: null,
    guild: null,
    update: async (p) => { toggleUpdatePayload = p; },
  });
  assert.equal(mix.balanceMode, 'captains');
  assert.ok(toggleUpdatePayload);

  // Join #11 enters waitlist
  let joinWaitReply = null;
  await bot.handleButtonInteraction({
    customId: 'mix_join:MIX-SUB1',
    channelId: 'ch-sub',
    user: { id: subPlayer.id, username: subPlayer.username, displayAvatarURL: () => '' },
    member: { displayName: subPlayer.displayName },
    guild: null,
    update: async () => {},
    followUp: async (p) => { joinWaitReply = p; },
  });
  assert.equal(mix.waitlist.length, 1);
  assert.match(joinWaitReply.content, /Suplente #1\/3/);

  // Balance teams and open mix_sub picker
  bot.balanceTeams(mix);
  let subOutPayload = null;
  await bot.handleButtonInteraction({
    customId: 'mix_sub:MIX-SUB1',
    channelId: 'ch-sub',
    user: players[0],
    update: async () => {},
    reply: async (p) => { subOutPayload = p; },
  });
  assert.equal(subOutPayload.ephemeral, true);
  assert.match(subOutPayload.components[0].components[0].toJSON().custom_id, /^sub_pick_out:MIX-SUB1/);

  // Step 1: Select player to remove -> replies with UserSelectMenuBuilder
  let userSelectPayload = null;
  const outgoing = mix.teamA.players[0];
  await bot.handleSelectMenuInteraction({
    customId: 'sub_pick_out:MIX-SUB1',
    channelId: 'ch-sub',
    values: [outgoing.id],
    user: players[0],
    update: async (p) => { userSelectPayload = p; },
  });
  assert.equal(userSelectPayload.components[0].components[0].toJSON().custom_id, `sub_pick_in:MIX-SUB1:${outgoing.id}`);

  // Step 2: Select incoming sub via handleUserSelectMenuInteraction -> substitutes, removes from waitlist, clears readyCheck, recomputes avg
  const subMember = {
    id: subPlayer.id,
    displayName: subPlayer.displayName,
    user: { username: subPlayer.username, displayAvatarURL: () => '' },
  };
  let subConfirmUpdate = null;
  let subChannelNotice = null;
  await bot.handleUserSelectMenuInteraction({
    customId: `sub_pick_in:MIX-SUB1:${outgoing.id}`,
    channelId: 'ch-sub',
    values: [subPlayer.id],
    guild: {
      id: 'guild-1',
      members: { fetch: async (id) => (id === subPlayer.id ? subMember : null), cache: new Map() },
    },
    channel: { send: async (msg) => { subChannelNotice = msg; } },
    update: async (p) => { subConfirmUpdate = p; },
  });
  assert.match(subConfirmUpdate.content, /Substituição realizada/i);
  assert.match(subChannelNotice, /SUBSTITUIÇÃO EFETUADA/);
  assert.equal(mix.players.some((p) => p.id === subPlayer.id), true);
  assert.equal(mix.players.some((p) => p.id === outgoing.id), false);
  assert.equal(mix.waitlist.length, 0);
  assert.equal(mix.readyCheck.confirmed.has(outgoing.id), false);
});

test('recordMatchResult stays honest without GSI, caches lastFinishedMixes, and guards Rematch GSI reuse', async (t) => {
  const bot = createBot(t);
  const players = makePlayers(10);
  const mix = bot.getOrCreateMix('ch-hist', players[0], { id: 'MIX-HIST1', name: 'Mix Honest' });
  mix.players = [...players];
  bot.balanceTeams(mix);
  mix.teamA.side = 'CT';
  mix.teamB.side = 'TR';
  mix.teamA.startingSide = 'CT';
  mix.teamB.startingSide = 'TR';
  mix.matchMap = 'Mirage';

  // Ensure NO GSI data -> must NOT fabricate K/D, MVP, or Bagre
  bot.lastGsiState = null;
  bot.lastBestGsiState = null;
  const res = await bot.recordMatchResult(mix, 'A', '13-7', players[0], { id: 'ch-hist', name: 'mix' });
  assert.equal(res.success, true);
  assert.equal(mix.phase, 'finished');
  assert.equal(bot.lastFinishedMixes.has('MIX-HIST1'), true);
  assert.equal(bot.lastFinishedMixes.has('ch:ch-hist'), true);

  const fields = res.embeds[0].toJSON().fields || [];
  assert.equal(fields.some((f) => f.name.includes('Destaque MVP')), false);
  assert.equal(fields.some((f) => f.name.includes('Bagre Coroado')), false);
  assert.ok(fields.some((f) => f.value.includes('Valve GSI não estava ativo')));

  const btnIds = res.components[0].components.map((b) => b.toJSON().custom_id);
  assert.ok(btnIds.includes('bagre_open:MIX-HIST1'));
  assert.ok(btnIds.includes('mix_rematch:MIX-HIST1'));

  // Clicking bagre_open after match finished finds cached mix
  let bagreReply = null;
  await bot.handleButtonInteraction({
    customId: 'bagre_open:MIX-HIST1',
    channelId: 'ch-hist',
    user: players[0],
    reply: async (p) => { bagreReply = p; },
  });
  assert.ok(bagreReply?.embeds?.[0]);
  assert.match(bagreReply.embeds[0].toJSON().title, /BAGRE DA PARTIDA/);

  // Rematch inverts starting sides and stamps _minGsiTimestamp preventing stale GSI reuse
  const staleSnap = {
    receivedAt: Date.now() - 1000,
    roomId: 'MIX-HIST1',
    scoreCT: 13,
    scoreTR: 7,
    allPlayersStats: [{ name: 'Player1', kills: 20, deaths: 10 }],
  };
  bot.lastBestGsiState = staleSnap;

  let rematchReply = null;
  await bot.handleButtonInteraction({
    customId: 'mix_rematch:MIX-HIST1',
    channelId: 'ch-hist',
    user: players[0],
    reply: async (p) => { rematchReply = p; },
  });
  assert.ok(rematchReply);
  assert.equal(mix.phase, 'veto');
  assert.equal(mix.teamA.startingSide, 'TR');
  assert.equal(mix.teamB.startingSide, 'CT');
  assert.equal(mix.rematchCount, 1);
  assert.equal(bot.resolveGsiSnapshotForMix(mix), null);
});

test('Prefix "!ao vivo" and unconfigured "!status-server" behave safely', async (t) => {
  const bot = createBot(t);
  bot.config.serverConnect = '';
  let statusReply = null;
  await bot.handlePrefixCommand({
    author: { id: '100000000000000001', username: 'Alex', bot: false },
    channelId: 'ch-cmd',
    content: '!status-server',
    mentions: { users: new Map(), channels: new Map() },
    reply: async (p) => { statusReply = p; },
  });
  assert.match(statusReply, /Nenhum servidor configurado/);

  bot.toggleNarration(null, 'ch-cmd');
  assert.equal(bot.isNarrationActive(null, 'ch-cmd'), true);
  let stopReply = null;
  await bot.handlePrefixCommand({
    author: { id: '100000000000000001', username: 'Alex', bot: false },
    channelId: 'ch-cmd',
    content: '!ao vivo parar',
    mentions: { users: new Map(), channels: new Map() },
    reply: async (p) => { stopReply = p; },
  });
  assert.match(stopReply, /Monitoramento de partida desativado/);
  assert.equal(bot.isNarrationActive(null, 'ch-cmd'), false);
});

test('ProMatchesAgendaService parses Liquipedia matches in BRT and shows honest empty state when unavailable', () => {
  const svc = new ProMatchesAgendaService();
  const futureEpoch = Math.floor((Date.now() + 3600 * 1000) / 1000);
  const sampleHtml = `
    <table class="infobox_matches_content">
      <tr>
        <td class="team-left"><a title="FURIA">FURIA</a></td>
        <td class="versus">Bo3</td>
        <td class="team-right"><a title="NAVI">NAVI</a></td>
      </tr>
      <tr>
        <td class="match-filler"><span data-timestamp="${futureEpoch}"></span>IEM Katowice</td>
      </tr>
    </table>
  `;
  const parsed = svc.parseLiquipediaMatchesHtml(sampleHtml);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].teamA.name, 'FURIA');
  assert.equal(parsed[0].isBrMatch, true);
  assert.match(parsed[0].timeBRT, /\d{2}:\d{2} BRT/);

  const emptyEmbed = svc.buildEmbed([], { source: 'unavailable', error: 'HTTP 429' });
  const desc = emptyEmbed.embeds[0].toJSON().description;
  assert.match(desc, /HTTP 429/);
  assert.doesNotMatch(desc, /2 x 0|13 x 9/);
});

test('handlePrefixCommand routes @Bot natural-language mentions without ReferenceError', async (t) => {
  const bot = createBot(t);
  bot.client = {
    user: { id: '999999999999999999', username: 'CS2MixBot' },
    guilds: { cache: new Map() },
  };

  let mirageReply = null;
  await bot.handlePrefixCommand({
    author: { id: '100000000000000001', username: 'Alex', bot: false },
    member: { displayName: 'Alex' },
    channelId: 'ch-mention',
    channel: { name: 'geral', sendTyping: async () => {} },
    content: '<@999999999999999999> qual smoke do CT da Mirage?',
    mentions: {
      users: new Map([['999999999999999999', bot.client.user]]),
      roles: new Map(),
      channels: new Map(),
    },
    reply: async (p) => { mirageReply = p; },
  });
  assert.ok(mirageReply?.embeds?.[0]);
  assert.match(mirageReply.embeds[0].toJSON().title, /MIRAGE/i);

  let levelReply = null;
  await bot.handlePrefixCommand({
    author: { id: '100000000000000001', username: 'Alex', bot: false },
    member: { displayName: 'Alex' },
    channelId: 'ch-mention',
    channel: { name: 'geral', sendTyping: async () => {} },
    content: 'ei <@!999999999999999999> bota meu level 18',
    mentions: {
      users: new Map([['999999999999999999', bot.client.user]]),
      roles: new Map(),
      channels: new Map(),
    },
    reply: async (p) => { levelReply = p; },
  });
  assert.match(String(levelReply), /Lvl 18/);

  let roleCoachReply = null;
  await bot.handlePrefixCommand({
    author: { id: '100000000000000001', username: 'Alex', bot: false },
    member: { displayName: 'Alex' },
    channelId: 'ch-mention',
    channel: { name: 'geral', sendTyping: async () => {} },
    content: '<@&888888888888888888> como segurar meio na Ancient de CT?',
    mentions: {
      users: new Map(),
      roles: new Map([['888888888888888888', { id: '888888888888888888', managed: true, tags: { botId: '999999999999999999' } }]]),
      channels: new Map(),
    },
    reply: async (p) => { roleCoachReply = p; },
  });
  assert.ok(roleCoachReply?.embeds?.[0]);
  assert.match(roleCoachReply.embeds[0].toJSON().title, /ANCIENT/i);
});

test('resolveSlashRegistrationTargets evita comandos duplicados no menu / do Discord', () => {
  const withGuilds = resolveSlashRegistrationTargets(['g1', 'g2', 'g1']);
  assert.equal(withGuilds.registerGlobal, false);
  assert.equal(withGuilds.clearGlobal, true);
  assert.deepEqual(withGuilds.guildIds, ['g1', 'g2']);

  const withoutGuilds = resolveSlashRegistrationTargets([]);
  assert.equal(withoutGuilds.registerGlobal, true);
  assert.equal(withoutGuilds.clearGlobal, false);
  assert.deepEqual(withoutGuilds.guildIds, []);
});

test('discordAiRouter: memória de conversa, novas intenções naturais e insight pós-jogo', () => {
  clearCoachConversationHistory({ channelId: 'c1', authorId: 'u1' });
  recordCoachTurn({ channelId: 'c1', authorId: 'u1', query: 'como segurar meio na Mirage?', replyBody: 'Jogue janela/conector', mapKey: 'mirage' });
  const hist = getCoachConversationHistory({ channelId: 'c1', authorId: 'u1' });
  assert.equal(hist.length, 1);

  const followCtx = buildCoachContext({
    query: 'e se eu atacar de TR?',
    conversationHistory: hist,
  });
  assert.equal(followCtx.mapKey, 'mirage');

  const followReply = buildDeterministicCoachReply('e se eu atacar de TR?', followCtx);
  assert.match(followReply.title, /MIRAGE/i);
  assert.match(followReply.body, /Plano TR na MIRAGE/i);

  assert.equal(detectNaturalIntent('mostra meu perfil').intent, 'stats');
  assert.equal(detectNaturalIntent('quem falta na call?').intent, 'calls_check');
  assert.equal(detectNaturalIntent('volta todo mundo pro geral').intent, 'calls_return');
  assert.equal(detectNaturalIntent('move os times pra call').intent, 'calls_move');
  assert.deepEqual(
    {
      intent: detectNaturalIntent('deu vitoria do Time B 13x11 na inferno').intent,
      winner: detectNaturalIntent('deu vitoria do Time B 13x11 na inferno').winner,
      score: detectNaturalIntent('deu vitoria do Time B 13x11 na inferno').score,
      mapQuery: detectNaturalIntent('deu vitoria do Time B 13x11 na inferno').mapQuery,
    },
    { intent: 'match_result', winner: 'B', score: '13-11', mapQuery: 'inferno' }
  );
  assert.equal(detectNaturalIntent('checa a steam 76561198000000001').steamTarget, '76561198000000001');
  assert.equal(detectNaturalIntent('substitui o @a pelo @b', { mentionsCount: 2 }).intent, 'sub');

  const insight = buildPostMatchCoachInsight({
    matchRecord: {
      map: 'Mirage',
      winner: 'Time A',
      score: '13-11',
      scoreWinner: 13,
      scoreLoser: 11,
      winnerPlayers: [{ id: '100000000000000001', nick: 'Alex' }],
      hasRealGsiStats: false,
    },
    profiles: { '100000000000000001': { streak: 3 } },
    matchHistory: [{ map: 'Mirage' }, { map: 'Mirage' }],
  });
  assert.match(insight, /Confronto equilibrado/i);
  assert.match(insight, /2º jogo/i);
  assert.match(insight, /\*\*Alex\*\* \(3x 🔥\)/);
});

test('Voice check, voiceStateUpdate auto-announce, achievements no !stats e botão Mudar Mapa RCON', async (t) => {
  const bot = createBot(t);
  const players = makePlayers(4);
  const mix = bot.getOrCreateMix('ch-vc', players[0], { id: 'MIX-VC1', name: 'Mix Call' });
  mix.players = [...players];
  bot.balanceTeams(mix);
  mix.phase = 'live';

  const readyRows = bot.buildMatchReadyButtons(mix);
  const rconCustomIds = readyRows[2].components.map((c) => c.toJSON().custom_id);
  assert.ok(rconCustomIds.includes(`rcon_changemap:${mix.id}`));

  const voiceMap = new Map([
    [players[0].id, { voice: { channelId: 'vc-1' } }],
    [players[1].id, { voice: { channelId: 'vc-1' } }],
    [players[2].id, { voice: { channelId: null } }],
    [players[3].id, { voice: { channelId: null } }],
  ]);

  let sentNotice = null;
  const mockGuild = {
    id: 'g-vc',
    members: {
      cache: voiceMap,
      fetch: async (id) => voiceMap.get(id) || null,
    },
  };
  bot.client.channels.cache.set('ch-vc', {
    send: async (msg) => { sentNotice = msg; },
  });

  let checkReply = null;
  await bot.prefixVoiceCheck({
    guild: mockGuild,
    channelId: 'ch-vc',
    reply: async (msg) => { checkReply = msg; },
  });
  assert.match(checkReply, /2\/4 em call/);
  assert.match(checkReply, new RegExp(players[2].id));

  voiceMap.set(players[2].id, { voice: { channelId: 'vc-1' } });
  voiceMap.set(players[3].id, { voice: { channelId: 'vc-1' } });
  await bot.handleVoiceStateUpdate(
    { channelId: null },
    { id: players[3].id, channelId: 'vc-1', guild: mockGuild }
  );
  assert.match(String(sentNotice), /Chamada completa!.*4\/4/);

  const badges = computePlayerAchievements(
    { wins: 12, losses: 4, mvps: 6, streak: 5 },
    [
      { map: 'Mirage', winnerPlayers: [{ id: '100000000000000001' }] },
      { map: 'Mirage', winnerPlayers: [{ id: '100000000000000001' }] },
      { map: 'Mirage', winnerPlayers: [{ id: '100000000000000001' }] },
    ],
    '100000000000000001'
  );
  assert.ok(badges.some((b) => b.includes('Imparável')));
  assert.ok(badges.some((b) => b.includes('Veterano')));
  assert.ok(badges.some((b) => b.includes('Colecionador de MVPs')));
  assert.ok(badges.some((b) => b.includes('Especialista Mirage')));

  bot.setPlayerProfile(players[0].id, { level: 18, username: players[0].username, wins: 12, losses: 4, mvps: 6, streak: 5 });
  const statsEmbed = bot.buildUserStatsEmbed({
    id: players[0].id,
    username: players[0].username,
    displayName: players[0].displayName,
    displayAvatarURL: () => '',
  }).toJSON();
  assert.ok(statsEmbed.fields.some((f) => f.name.includes('Conquistas Desbloqueadas') && f.value.includes('Imparável')));
});

test('Pack Treino Completo LXN: shared/treinoCfg, AI Q&A e anexos do Discord (!treino)', async (t) => {
  const defaultCfg = buildTreinoCfg();
  assert.match(defaultCfg, /bind "p" "sv_rethrow_last_grenade"/);
  assert.match(defaultCfg, /alias "mirage_s12" "setpos 1296\.00 -352\.00 -164\.00; setang 0\.00 -155\.00 0\.00"/);
  assert.match(defaultCfg, /bind KP_DEL mirage_s11; bind KP_ENTER mirage_s12/);
  assert.match(defaultCfg, /alias "cache_s1" "setpos 3019\.30 225\.40 1616\.00; setang 0\.00 -176\.30 0\.00"/);
  assert.match(defaultCfg, /alias "cache" ".*unbind KP_DEL; unbind KP_ENTER;/);
  assert.match(defaultCfg, /alias "anubis_s1" "setpos -384\.00 -1552\.00 -12\.00; setang 0\.00 90\.00 0\.00"/);
  assert.match(defaultCfg, /bind KP_0 train_s10/);
  assert.match(defaultCfg, /alias "train_s1" "setpos -1568\.00 1376\.00 -200\.00; setang 0\.00 -15\.00 0\.00"/);
  assert.match(defaultCfg, /alias "office" ".*unbind KP_6; unbind KP_7; unbind KP_8; unbind KP_9; unbind KP_0; unbind KP_DEL; unbind KP_ENTER;/);
  assert.match(defaultCfg, /alias "italy_s5"/);
  assert.match(defaultCfg, /alias "reset" "unbind KP_1;.*unbind KP_DEL; unbind KP_ENTER; exec autoexec;/);

  const customCfg = buildTreinoCfg({
    rethrow: 'alt"; quit',
    noclip: 'v',
    autoexecName: 'minha_cfg; drop',
  });
  assert.match(customCfg, /bind "altquit" "sv_rethrow_last_grenade"/);
  assert.match(customCfg, /bind "v" "noclip"/);
  assert.match(customCfg, /exec minha_cfgdrop;/);
  const guiaMd = buildTreinoLeiaMeMd({ rethrow: 'alt' });
  assert.equal(guiaMd.includes('**ALT**'), true);
  assert.equal(guiaMd.includes('**todos os 12 spawns da base TR da Mirage organizados por fileira**'), true);
  assert.equal(guiaMd.includes('**12 spawns TR** (Numpad `1`–`0`, `Del` e `Enter`)'), true);
  assert.match(buildTreinoRconCommands(), /sv_cheats 1/);
  assert.equal(resolveTreinoMapKey('d2'), 'dust2');
  assert.equal(resolveTreinoMapKey('ovp'), 'overpass');
  assert.equal(resolveTreinoMapKey('office'), 'office');
  assert.equal(resolveTreinoMapKey('italy'), 'italy');

  const coachKeyReply = buildDeterministicCoachReply('qual tecla repete a smoke no treino?', {});
  assert.match(coachKeyReply.body, /Repetir última granada/);
  assert.equal(detectNaturalIntent('quero arquivo de treino na ancient').intent, 'treino');
  assert.equal(detectNaturalIntent('quero arquivo de treino na ancient').mapQuery, 'ancient');

  const bot = createBot(t);
  const sentSequence = [];
  await bot.prefixTreino(
    {
      reply: async (p) => { sentSequence.push({ kind: 'reply', payload: p }); return p; },
      channel: {
        send: async (p) => { sentSequence.push({ kind: 'channel', payload: p }); return p; },
      },
    },
    'ancient'
  );
  assert.equal(sentSequence.length, 2);
  // 1ª mensagem: Guia de instalação em texto puro (sem anexos acima)
  assert.equal(sentSequence[0].kind, 'reply');
  assert.equal(sentSequence[0].payload.files, undefined);
  assert.match(sentSequence[0].payload.content, /Instalação/);
  assert.match(sentSequence[0].payload.content, /exec treino; ancient/);
  // 2ª mensagem (última, abaixo do guia): arquivos .cfg + .txt e botões
  assert.equal(sentSequence[1].kind, 'channel');
  assert.equal(sentSequence[1].payload.files.length, 2);
  assert.equal(sentSequence[1].payload.files[0].name, 'treino.cfg');
  assert.equal(sentSequence[1].payload.files[1].name, 'LEIA-ME-Treino.txt');
  const buttons = sentSequence[1].payload.components[0].components.map((c) => c.toJSON());
  assert.ok(buttons.some((b) => String(b.url || '').includes('/?treino=1')));
  assert.ok(buttons.some((b) => b.custom_id === 'treino_rcon_apply'));

  const panelPayload = bot.buildOfficialPanelPayload();
  assert.equal(panelPayload.components[0].components.length, 4);
  assert.equal(panelPayload.components[1].components.length, 4);
  const helpPayload = bot.buildHelpPayload();
  assert.equal(helpPayload.embeds[0].toJSON().fields.length, 6);

  // Botão de treino no menu principal do !mix (buildLobbyButtons + handleButtonInteraction)
  const emptyMix = { id: 'MIX-TESTE-TREINO', channelId: 'ch-treino', players: [], waitlist: [], balanceMode: 'balanced' };
  const lobbyRows = bot.buildLobbyButtons(emptyMix);
  const row3Buttons = lobbyRows[2].components.map((c) => c.toJSON());
  const treinoBtn = row3Buttons.find((b) => b.custom_id === 'mix_treino:MIX-TESTE-TREINO');
  assert.ok(treinoBtn, 'Menu principal do !mix deve incluir botão Treino LXN');
  assert.equal(Boolean(treinoBtn.disabled), false);

  const btnCalls = [];
  await bot.handleButtonInteraction({
    customId: 'mix_treino:MIX-TESTE-TREINO',
    channelId: 'ch-treino',
    user: { id: 'u-1', username: 'Alex' },
    reply: async (p) => { btnCalls.push({ kind: 'reply', payload: p }); return p; },
    followUp: async (p) => { btnCalls.push({ kind: 'followUp', payload: p }); return p; },
  });
  assert.equal(btnCalls.length, 2);
  assert.equal(btnCalls[0].kind, 'reply');
  assert.equal(btnCalls[0].payload.ephemeral, true);
  assert.equal(btnCalls[0].payload.files, undefined);
  assert.equal(btnCalls[1].kind, 'followUp');
  assert.equal(btnCalls[1].payload.ephemeral, true);
  assert.equal(btnCalls[1].payload.files.length, 2);
  assert.equal(btnCalls[1].payload.files[0].name, 'treino.cfg');
  assert.equal(btnCalls[1].payload.files[1].name, 'LEIA-ME-Treino.txt');
});

test('CS2NewsRadar: detecta ingles disfarcado, conserva termos do CS2 e inclui botao para pagina no site', async () => {
  const { CS2NewsRadarService } = await import('../server/cs2NewsRadar.js');
  const radar = new CS2NewsRadarService();

  // Nunca considerar ingles misto com poucas palavras PT como traduzido
  const mixedPartial =
    'Corrigido a bug where players could drop weapons outside Bombsite A on Mirage.\n' +
    'Adicionado various fixes for Smoke and Flashbang when clipping.';
  assert.equal(radar.isAlreadyPortuguese(mixedPartial), false);

  const realPtBr =
    'Corrigido um problema onde os jogadores podiam ver através da Smoke na Mirage.\n' +
    'Adicionado suporte para gravação de demos no modo Premier.';
  assert.equal(radar.isAlreadyPortuguese(realPtBr), true);

  // Proteção e restauração de termos do jogo
  const rawEn = 'Fixed Sub-tick timing on Mirage when throwing Smoke or Flashbang with AK-47.';
  const masked = radar.protectCs2Terms(rawEn);
  assert.equal(masked.includes('Mirage'), false);
  assert.equal(masked.includes('Sub-tick'), false);
  assert.equal(masked.includes('AK-47'), false);
  assert.equal(radar.restoreCs2Terms(masked), rawEn);

  // Tradução via Gemini (mock fetch) preservando termos técnicos + geração de embed com link do site
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Notas de Atualização do CS2 (18/11/2026)',
                      lines: [
                        'Corrigido um problema de colisão com Smoke no Bombsite A da Mirage.',
                        'Melhorado o registro de tiros com AK-47 no sistema Sub-tick em partidas Premier.',
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  };

  try {
    radar.setGeminiApiKeyProvider(() => 'fake-test-gemini-key');
    const translated = await radar.formatAndTranslatePatch(
      'gid-test-gemini-999',
      'Release Notes for 11/18/2026',
      '[ GAMEPLAY ]\n[*]Fixed Smoke collision at Mirage Bombsite A.[/*]\n[*]Improved AK-47 hit registration on Sub-tick Premier servers.[/*]'
    );

    assert.equal(translated.translationSource, 'gemini');
    assert.match(translated.translatedTitle, /Notas de Atualização do CS2/);
    assert.match(translated.formattedNotes, /JOGABILIDADE/);
    assert.match(translated.formattedNotes, /Mirage/);
    assert.match(translated.formattedNotes, /Smoke/);
    assert.match(translated.formattedNotes, /AK-47/);
    assert.match(translated.formattedNotes, /Sub-tick/);
    assert.match(translated.formattedNotes, /Premier/);
    assert.equal(translated.sections.length, 1);
    assert.equal(translated.sections[0].items.length, 2);

    const { embeds, components } = radar.buildEmbed(
      {
        gid: 'gid-test-gemini-999',
        title: translated.translatedTitle,
        url: 'https://store.steampowered.com/news/app/730',
        date: 1763480000,
        formattedDate: '18/11/2026, 11:00',
        formattedNotes: translated.formattedNotes,
        translationSource: 'gemini',
      },
      'https://cs2mixhub.example/?view=updates'
    );
    assert.equal(embeds.length, 1);
    const embedButtons = components[0].components.map((c) => c.toJSON());
    assert.ok(embedButtons.some((b) => String(b.url || '').includes('?view=updates')));
    assert.ok(embedButtons.some((b) => b.label === 'Ler no Site (PT-BR)'));

    // Fonte primária: Steam Comunidade PT-BR (ajaxgetpartnereventspageable lang=22)
    globalThis.fetch = async (url) => {
      if (String(url).includes('ajaxgetpartnereventspageable')) {
        return {
          ok: true,
          json: async () => ({
            success: 1,
            events: [
              {
                gid: 'gid-test-steam-ptbr-777',
                event_type: 12,
                announcement_body: {
                  gid: 'gid-test-steam-ptbr-778',
                  language: 22,
                  posttime: 1794958807,
                  headline: 'Detalhes da atualização de 17/11/2026',
                  body: '[video poster="https://cdn.example/poster.png" autoplay="true"][/video]\n[b][Mundial Singapura 2026][/b][list]\n[*] Central disponível.[/list]\n[b][Mapas][/b][list]\n[*] Adição do mapa Cobblestone aos servidores oficiais.[/list]\n[b][Diversos][/b][list]\n[*] Correção de problema de navegação dos bots.[/list]',
                },
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    const officialSteam = await radar.fetchRecentUpdates({ limit: 2, forceRefresh: true });
    assert.equal(officialSteam.updates.length, 1);
    const ev = officialSteam.updates[0];
    assert.equal(ev.translationSource, 'valve-ptbr');
    assert.equal(ev.title, 'Detalhes da atualização de 17/11/2026');
    assert.equal(ev.bannerImage, 'https://cdn.example/poster.png');
    assert.match(ev.url, /store\.steampowered\.com\/news\/app\/730\/view\/gid-test-steam-ptbr-777/);
    assert.match(ev.formattedNotes, /Cobblestone/);
    assert.equal(ev.formattedNotes.includes('[video'), false);
    assert.equal(ev.formattedNotes.includes('[LIST]'), false);
    assert.equal(ev.sections.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
