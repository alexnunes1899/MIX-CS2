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
} = await import('../server/discordBot.js');
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
