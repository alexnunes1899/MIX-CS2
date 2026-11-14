import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle } from 'discord.js';
import {
  handleGsiPayload,
  getGsiState,
  clearRoomGsiState,
  generateGsiConfig,
  generateGsiPowerShellInstaller,
} from '../server/gsi.js';
import { DiscordBotManager } from '../server/discordBot.js';
import {
  normalizeMapName,
  determineMatchWinner,
  computeMatchMvp,
  computeMatchPerformers,
} from '../server/matchHistory.js';

test('handleGsiPayload isolates state across rooms and clears cleanly', () => {
  clearRoomGsiState('ROOM_A');
  clearRoomGsiState('ROOM_B');

  try {
    handleGsiPayload('ROOM_A', {
      map: { name: 'de_mirage', phase: 'live', round: 5, team_ct: { score: 3 }, team_t: { score: 2 } },
      player: { steamid: '76561198000000001', name: 'PlayerA', team: 'CT', match_stats: { kills: 9, deaths: 4, assists: 2, mvps: 1, score: 20 } },
    });

    handleGsiPayload('ROOM_B', {
      map: { name: 'de_nuke', phase: 'live', round: 10, team_ct: { score: 6 }, team_t: { score: 4 } },
      player: { steamid: '76561198000000002', name: 'PlayerB', team: 'T', match_stats: { kills: 15, deaths: 6, assists: 1, mvps: 2, score: 35 } },
    });

    const stateA = getGsiState('ROOM_A');
    const stateB = getGsiState('ROOM_B');

    assert.equal(stateA.mapName, 'de_mirage');
    assert.equal(stateA.scoreCT, 3);
    assert.equal(stateA.allPlayersStats.length, 1);
    assert.equal(stateA.allPlayersStats[0].name, 'PlayerA');

    assert.equal(stateB.mapName, 'de_nuke');
    assert.equal(stateB.scoreCT, 6);
    assert.equal(stateB.allPlayersStats.length, 1);
    assert.equal(stateB.allPlayersStats[0].name, 'PlayerB');

    clearRoomGsiState('ROOM_A');
    assert.equal(getGsiState('ROOM_A').connected, false);
    assert.equal(getGsiState('ROOM_B').connected, true);
  } finally {
    clearRoomGsiState('ROOM_A');
    clearRoomGsiState('ROOM_B');
  }
});

test('normalizeMapName normalizes CS2 map names', () => {
  assert.equal(normalizeMapName('de_dust2'), 'Dust II');
  assert.equal(normalizeMapName('de_mirage'), 'Mirage');
  assert.equal(normalizeMapName({ file: 'de_inferno' }), 'Inferno');
});

test('determineMatchWinner handles MR12 half-time swap and overtime correctly', () => {
  // Team A started CT; after 12 rounds (e.g. 13-8 = 21 rounds total), Team A is now TR.
  // Score CT 8, TR 13 -> winning side TR -> Team A wins.
  const regResult = determineMatchWinner(
    { teamA: { side: 'CT', players: [] } },
    { scoreCT: 8, scoreTR: 13 }
  );
  assert.equal(regResult.winnerLetter, 'A');
  assert.equal(regResult.method, 'halftime_math_calculation');

  // Overtime (28 rounds: 16-12). Team A started CT: rounds 25-27 is CT, round 28 is TR.
  // Total = 28 -> otRounds = 4 (>3) -> Team A current side is TR. If CT=16, TR=12 -> Team B wins.
  const otResult = determineMatchWinner(
    { teamA: { side: 'CT', players: [] } },
    { scoreCT: 16, scoreTR: 12 }
  );
  assert.equal(otResult.winnerLetter, 'B');
  assert.equal(otResult.teamACurrentSide, 'TR');

  // Player-side inspection overrides math when GSI player affiliation is present
  const playerSideResult = determineMatchWinner(
    {
      teamA: {
        side: 'CT',
        players: [{ nick: 'Fallen', steamId: '1001' }],
      },
    },
    {
      scoreCT: 13,
      scoreTR: 9,
      allPlayersStats: [{ steamId: '1001', name: 'Fallen', team: 'CT', kills: 20, deaths: 10 }],
    }
  );
  assert.equal(playerSideResult.winnerLetter, 'A');
  assert.equal(playerSideResult.method, 'player_side_inspection');
});

test('computeMatchMvp selects top performer from GSI stats', () => {
  const mvp = computeMatchMvp(
    {
      winnerPlayers: [
        { id: '1', nick: 'Star', steamId: '111' },
        { id: '2', nick: 'Support', steamId: '222' },
      ],
      loserPlayers: [
        { id: '3', nick: 'Opponent', steamId: '333' },
      ],
      scoreWinner: 13,
      scoreLoser: 9,
    },
    {
      scoreCT: 13,
      scoreTR: 9,
      allPlayersStats: [
        { steamId: '111', name: 'Star', team: 'CT', kills: 28, deaths: 12, assists: 5, mvps: 5, score: 65 },
        { steamId: '222', name: 'Support', team: 'CT', kills: 14, deaths: 15, assists: 8, mvps: 1, score: 34 },
        { steamId: '333', name: 'Opponent', team: 'TR', kills: 18, deaths: 18, assists: 2, mvps: 2, score: 40 },
      ],
    }
  );
  assert.ok(mvp);
  assert.equal(mvp.nick, 'Star');
});

test('generateGsiConfig and generateGsiPowerShellInstaller produce UTF-8 no-BOM config with valid Steam VDF parsing', () => {
  const cfg = generateGsiConfig('https://mix-cs2.onrender.com/', 'room-42');
  assert.match(cfg, /"uri"\s+"https:\/\/mix-cs2\.onrender\.com\/api\/gsi\/ROOM-42"/);
  assert.match(cfg, /"token"\s+"ROOM-42"/);
  assert.match(cfg, /"player_match_stats"\s+"1"/);

  const ps1 = generateGsiPowerShellInstaller('https://mix-cs2.onrender.com', 'room-42');
  assert.ok(ps1.includes('New-Object System.Text.UTF8Encoding($false)'));
  assert.ok(ps1.includes('[System.IO.File]::WriteAllText($file, $cfg, $utf8NoBom)'));
  assert.ok(ps1.includes(`$line -match '"path"\\s+"([^"]+)"'`));
  assert.ok(ps1.includes('Jogos\\SteamLibrary'));
  assert.ok(ps1.includes('Start-Sleep -Seconds 3'));
});

test('DiscordBotManager Ao Vivo and GSI builders replace .bat flow with 1-click controls and attachments', async (t) => {
  const bot = new DiscordBotManager();
  bot.config.publicWebUrl = 'https://mix-cs2.onrender.com';
  t.after(() => {
    if (bot.liveTrackersSyncInterval) clearInterval(bot.liveTrackersSyncInterval);
  });

  // Freshness checks
  assert.equal(bot.isGsiOnline(), false);
  bot.lastGsiState = { receivedAt: Date.now() - 120000, player: { name: 'StalePlayer' } };
  assert.equal(bot.isGsiOnline(), false);
  bot.lastGsiState = { receivedAt: Date.now(), player: { name: 'Fallen' } };
  assert.equal(bot.isGsiOnline(), true);

  // Attachment contains sanitized room config
  const attachment = bot.buildGsiAttachment('mix-99a');
  assert.equal(attachment.name, 'gamestate_integration_cs2mixhub.cfg');
  const attachmentText = attachment.attachment.toString('utf8');
  assert.match(attachmentText, /"token"\s+"MIX-99A"/);

  // Live Match buttons: 2 rows, no .bat installer link, 1-click install + direct .cfg
  const offlineRows = bot.buildLiveMatchButtons(false, false, 'mix-99a');
  assert.equal(offlineRows.length, 2);
  const r1Buttons = offlineRows[0].components.map((b) => b.toJSON());
  const r2Buttons = offlineRows[1].components.map((b) => b.toJSON());
  assert.equal(r1Buttons.length, 5);
  assert.equal(r2Buttons.length, 3);
  assert.equal(r1Buttons.find((b) => b.label === 'Hub Web')?.url, 'https://mix-cs2.onrender.com/?room=MIX-99A');

  const installBtnOffline = r2Buttons.find((b) => b.custom_id === 'live_install_gsi:MIX-99A');
  assert.ok(installBtnOffline);
  assert.equal(installBtnOffline.style, ButtonStyle.Success);
  const cfgBtn = r2Buttons.find((b) => b.label === 'Baixar .cfg Direto');
  assert.equal(cfgBtn?.url, 'https://mix-cs2.onrender.com/api/gsi/cfg/MIX-99A');
  assert.equal(r2Buttons.some((b) => b.url?.includes('/api/gsi/installer/')), false);

  const onlineRows = bot.buildLiveMatchButtons(true, true, 'MIX-PRO');
  const installBtnOnline = onlineRows[1].components.map((b) => b.toJSON()).find((b) => b.custom_id === 'live_install_gsi:MIX-PRO');
  assert.equal(installBtnOnline?.style, ButtonStyle.Secondary);

  // /gsi guide payload
  const gsiGuide = bot.buildGsiGuidePayload('MIX-99A');
  assert.equal(gsiGuide.files.length, 1);
  assert.equal(gsiGuide.files[0].name, 'gamestate_integration_cs2mixhub.cfg');
  const gsiGuideDesc = gsiGuide.embeds[0].toJSON().description || '';
  assert.doesNotMatch(gsiGuideDesc, /\/api\/gsi\/installer\/[^p]/);
  assert.match(gsiGuideDesc, /irm 'https:\/\/mix-cs2\.onrender\.com\/api\/gsi\/installer\/ps1\/MIX-99A' \| iex/);
  const gsiGuideButtons = gsiGuide.components[0].components.map((b) => b.toJSON());
  assert.ok(gsiGuideButtons.some((b) => b.custom_id === 'live_install_gsi:MIX-99A'));
  assert.ok(gsiGuideButtons.some((b) => b.url === 'https://mix-cs2.onrender.com/?room=MIX-99A&gsi=1'));
  assert.equal(gsiGuideButtons.some((b) => b.url?.includes('/api/gsi/installer/')), false);

  // Button interaction for 1-click install replies ephemerally with .cfg attachment and PowerShell command
  let replyPayload = null;
  await bot.handleButtonInteraction({
    customId: 'live_install_gsi:MIX-99A',
    channelId: 'ch-1',
    user: { id: '100', username: 'Player1' },
    member: null,
    guild: null,
    reply: async (payload) => {
      replyPayload = payload;
    },
  });
  assert.ok(replyPayload);
  assert.equal(replyPayload.ephemeral, true);
  assert.equal(replyPayload.files.length, 1);
  assert.equal(replyPayload.files[0].name, 'gamestate_integration_cs2mixhub.cfg');
  const replyDesc = replyPayload.embeds[0].toJSON().description || '';
  assert.match(replyDesc, /irm 'https:\/\/mix-cs2\.onrender\.com\/api\/gsi\/installer\/ps1\/MIX-99A' \| iex/);

  // syncLiveTrackers skips stale waiting trackers without hitting Discord API, and updates once when fresh
  let editCalls = 0;
  let lastEditedPayload = null;
  const mockMsg = {
    id: 'msg-1',
    edit: async (payload) => {
      editCalls++;
      lastEditedPayload = payload;
    },
  };
  bot.client = {
    channels: {
      cache: new Map([
        ['ch-1', { messages: { fetch: async (id) => (id === 'msg-1' ? mockMsg : null) } }],
      ]),
    },
  };
  bot.liveTrackers.set('msg-1', {
    messageId: 'msg-1',
    channelId: 'ch-1',
    requester: 'Player1',
    targetQuery: null,
    isExpanded: false,
    startedAt: Date.now(),
    lastEditedAt: 0,
    lastSignature: '',
    state: 'waiting',
    consecutiveErrors: 0,
  });

  // Stale state while already waiting -> should not spam msg.edit
  await bot.syncLiveTrackers({ receivedAt: Date.now() - 120000, player: { name: 'Old' } });
  assert.equal(editCalls, 0);

  // Fresh live state -> edits once with 2 button rows
  const freshState = {
    receivedAt: Date.now(),
    mapName: 'de_mirage',
    phase: 'live',
    roundNumber: 4,
    scoreCT: 2,
    scoreTR: 1,
    bomb: 'none',
    player: { name: 'Fallen', team: 'CT', isAlive: true, health: 100, armor: 100, hasHelmet: true, kills: 7, deaths: 2, assists: 1, mvps: 1, score: 18, kd: 3.5, money: 4750, equipValue: 5200, grenades: [], activeWeapon: { name: 'AWP' } },
  };
  bot.lastGsiState = freshState;
  await bot.syncLiveTrackers(freshState);
  assert.equal(editCalls, 1);
  assert.equal(lastEditedPayload.components.length, 2);
  assert.equal(bot.liveTrackers.get('msg-1').state, 'in_game');

  // Identical tick -> skipped
  bot.liveTrackers.get('msg-1').lastEditedAt = 0;
  await bot.syncLiveTrackers(freshState);
  assert.equal(editCalls, 1);

  // When state goes stale again, syncLiveTrackers reverts to waiting once then stops editing
  const staleState = { ...freshState, receivedAt: Date.now() - 120000 };
  bot.lastGsiState = staleState;
  bot.liveTrackers.get('msg-1').lastEditedAt = 0;
  await bot.syncLiveTrackers(staleState);
  assert.equal(editCalls, 2);
  assert.equal(bot.liveTrackers.get('msg-1').state, 'waiting');
  bot.liveTrackers.get('msg-1').lastEditedAt = 0;
  await bot.syncLiveTrackers(staleState);
  assert.equal(editCalls, 2);

  // Prefix and Slash command handlers + button flows execute cleanly with active mix
  bot.activeMixes.set('ch-2', { id: 'MIX-Z9', channelId: 'ch-2', phase: 'live', players: [], teamA: { players: [] }, teamB: { players: [] } });
  let cmdGsiReply = null;
  await bot.cmdGsi({
    channelId: 'ch-2',
    reply: async (p) => { cmdGsiReply = p; return p; },
  });
  assert.equal(cmdGsiReply.files[0].name, 'gamestate_integration_cs2mixhub.cfg');
  assert.match(cmdGsiReply.files[0].attachment.toString('utf8'), /"token"\s+"MIX-Z9"/);
  assert.ok((cmdGsiReply.embeds[0].toJSON().description || '').length <= 4096);

  let prefixGsiReply = null;
  await bot.prefixGsi({
    channelId: 'ch-2',
    reply: async (p) => { prefixGsiReply = p; return p; },
  });
  assert.equal(prefixGsiReply.files[0].name, 'gamestate_integration_cs2mixhub.cfg');

  let cmdLiveReply = null;
  await bot.cmdLive({
    channelId: 'ch-2',
    user: { username: 'Tester' },
    options: { getString: () => null },
    reply: async (p) => { cmdLiveReply = p; },
    fetchReply: async () => ({ id: 'live-cmd-1', channelId: 'ch-2' }),
  });
  assert.equal(cmdLiveReply.components.length, 2);
  assert.equal(bot.liveTrackers.has('live-cmd-1'), true);

  let prefixLiveReply = null;
  await bot.prefixLive({
    channelId: 'ch-2',
    author: { username: 'Tester' },
    reply: async (p) => {
      prefixLiveReply = p;
      return { id: 'live-prefix-1', channelId: 'ch-2' };
    },
  });
  assert.equal(prefixLiveReply.components.length, 2);
  assert.equal(bot.liveTrackers.has('live-prefix-1'), true);

  // gsi_help_info does not direct users to a .bat installer
  let helpReply = null;
  await bot.handleButtonInteraction({
    customId: 'gsi_help_info',
    channelId: 'ch-2',
    user: { id: '100', username: 'Player1' },
    reply: async (p) => { helpReply = p; },
  });
  assert.equal(helpReply.ephemeral, true);
  assert.doesNotMatch(helpReply.content, /Instalador de 1-Clique/i);

  // panel_live_radar, live_toggle_expand, live_refresh, live_toggle_narration, mix_live_tracker
  for (const cid of ['panel_live_radar', 'mix_live_tracker:MIX-Z9']) {
    let replied = null;
    await bot.handleButtonInteraction({
      customId: cid,
      channelId: 'ch-2',
      user: { id: '100', username: 'Player1' },
      reply: async (p) => { replied = p; },
      fetchReply: async () => ({ id: `msg-${cid}`, channelId: 'ch-2' }),
    });
    assert.equal(replied.components.length, 2);
  }

  for (const cid of ['live_toggle_expand', 'live_refresh', 'live_toggle_narration']) {
    let updated = null;
    await bot.handleButtonInteraction({
      customId: cid,
      channelId: 'ch-2',
      message: { id: 'msg-mix_live_tracker:MIX-Z9', channelId: 'ch-2' },
      user: { id: '100', username: 'Player1' },
      update: async (p) => { updated = p; },
      followUp: async () => {},
    });
    assert.equal(updated.components.length, 2);
  }
});

test('determineMatchWinner handles halftimeSwapped flag without double-inversion', () => {
  const result = determineMatchWinner(
    {
      teamA: { side: 'TR', halftimeSwapped: true, players: [] },
    },
    { scoreCT: 8, scoreTR: 13 }
  );
  assert.equal(result.winnerLetter, 'A');
  assert.equal(result.teamACurrentSide, 'TR');
});

test('computeMatchPerformers returns null MVP/Bagre without real stats instead of fabricating K/D', () => {
  const noStats = computeMatchPerformers(
    {
      winnerPlayers: [
        { id: '1', nick: 'Alpha', level: 20 },
        { id: '2', nick: 'Beta', level: 10 },
      ],
      loserPlayers: [
        { id: '3', nick: 'Gamma', level: 18 },
      ],
      scoreWinner: 13,
      scoreLoser: 9,
    },
    null
  );
  assert.equal(noStats.hasRealGsiStats, false);
  assert.equal(noStats.mvp, null);
  assert.equal(noStats.bagre, null);
  assert.deepEqual(noStats.evaluatedPlayers, []);

  const withStats = computeMatchPerformers(
    {
      winnerPlayers: [
        { id: '1', nick: 'Star', steamId: '111' },
        { id: '2', nick: 'Support', steamId: '222' },
      ],
      loserPlayers: [
        { id: '3', nick: 'Opponent', steamId: '333' },
      ],
      scoreWinner: 13,
      scoreLoser: 9,
    },
    {
      scoreCT: 13,
      scoreTR: 9,
      allPlayersStats: [
        { steamId: '111', name: 'Star', team: 'CT', kills: 28, deaths: 12, assists: 5, mvps: 5, score: 65 },
        { steamId: '222', name: 'Support', team: 'CT', kills: 6, deaths: 18, assists: 2, mvps: 0, score: 15 },
        { steamId: '333', name: 'Opponent', team: 'TR', kills: 18, deaths: 18, assists: 2, mvps: 2, score: 40 },
      ],
    }
  );
  assert.equal(withStats.hasRealGsiStats, true);
  assert.equal(withStats.mvp?.nick, 'Star');
  assert.equal(withStats.bagre?.nick, 'Support');
});
