import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Use isolated temp DATA_DIR before importing authSession/db
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2mix-core-test-'));
process.env.DATA_DIR = tempDir;
process.env.SESSION_SECRET = 'test_session_secret_0123456789abcdef';

const { balanceTeams, shuffleTeams, calculateMetricsForTeams, getPlayerScore } = await import('../shared/balance.js');
const { getVetoSchedule, getOppositeTeam } = await import('../shared/proVeto.js');
const { handleGsiPayload, getGsiState, clearGsiRoomState } = await import('../server/gsi.js');
const {
  signSessionToken,
  verifySessionToken,
  hashRoomPassword,
  verifyRoomPassword,
} = await import('../server/authSession.js');
const { sanitizeRconCommand, isValidMapName } = await import('../server/roomHelpers.js');
const { collectStoryPlayers, isImageUrl, buildAvatarProxyUrl } = await import('../src/utils/canvasHelpers.js');
const { isAllowedAvatarProxyUrl } = await import('../server/routes/infraRoutes.js');

test('shared/balance: GC e FACEIT respeitam preferências e dividem 10 jogadores equilibradamente', () => {
  const players = [
    { id: 'p1', nick: 'P1', level: 21, faceitLevel: 10, faceitElo: 2500, side: 'CT' },
    { id: 'p2', nick: 'P2', level: 20, faceitLevel: 10, faceitElo: 2400, side: 'TR' },
    { id: 'p3', nick: 'P3', level: 18, faceitLevel: 9, faceitElo: 2100, side: 'ANY' },
    { id: 'p4', nick: 'P4', level: 17, faceitLevel: 8, faceitElo: 1850, side: 'CT' },
    { id: 'p5', nick: 'P5', level: 16, faceitLevel: 8, faceitElo: 1780, side: 'TR' },
    { id: 'p6', nick: 'P6', level: 15, faceitLevel: 7, faceitElo: 1620, side: 'ANY' },
    { id: 'p7', nick: 'P7', level: 14, faceitLevel: 6, faceitElo: 1480, side: 'CT' },
    { id: 'p8', nick: 'P8', level: 12, faceitLevel: 5, faceitElo: 1320, side: 'TR' },
    { id: 'p9', nick: 'P9', level: 10, faceitLevel: 4, faceitElo: 1120, side: 'ANY' },
    { id: 'p10', nick: 'P10', level: 8, faceitLevel: 3, faceitElo: 950, side: 'ANY' },
  ];

  const gcRes = balanceTeams(players, 'gc');
  assert.equal(gcRes.teamA.length, 5);
  assert.equal(gcRes.teamB.length, 5);
  assert.ok(gcRes.metrics.diff <= 3, `Expected diff <= 3, got ${gcRes.metrics.diff}`);

  const faceitRes = balanceTeams(players, 'faceit');
  assert.equal(faceitRes.teamA.length, 5);
  assert.equal(faceitRes.teamB.length, 5);
  assert.ok(getPlayerScore(players[0], 'faceit') >= getPlayerScore(players[9], 'faceit'));

  const metrics = calculateMetricsForTeams(faceitRes.teamA, faceitRes.teamB, 'faceit');
  assert.equal(metrics.rankingSystem, 'faceit');

  const shuffled = shuffleTeams(players, 'gc');
  assert.equal(shuffled.teamA.length + shuffled.teamB.length, 10);
});

test('shared/balance: fallback greedy funciona para > 16 jogadores sem explosão combinatória', () => {
  const bigPool = Array.from({ length: 20 }, (_, i) => ({
    id: `b-${i}`,
    nick: `Player${i}`,
    level: (i % 21) + 1,
    side: 'ANY',
  }));
  const res = balanceTeams(bigPool, 'gc');
  assert.equal(res.teamA.length, 10);
  assert.equal(res.teamB.length, 10);
});

test('shared/proVeto: retorna sequências oficiais consistentes para MD1, MD3 e MD5', () => {
  assert.equal(getOppositeTeam('teamA'), 'teamB');
  assert.equal(getOppositeTeam('teamB'), 'teamA');

  const md1 = getVetoSchedule('MD1', 'teamA', 'ABABAB');
  assert.equal(md1.length, 7);
  assert.equal(md1[0].type, 'ban');
  assert.equal(md1[6].type, 'decider');
  assert.equal(md1[6].sidePickBy, 'teamB');

  const md1Reversed = getVetoSchedule('MD1', 'teamB', 'ABBAAB');
  assert.equal(md1Reversed[0].team, 'teamB');
  assert.equal(md1Reversed[1].team, 'teamA');
  assert.equal(md1Reversed[2].team, 'teamA');
  assert.equal(md1Reversed[6].sidePickBy, 'teamA');

  const md3 = getVetoSchedule('MD3', 'teamA');
  assert.equal(md3.filter((s) => s.type === 'pick').length, 2);
  assert.equal(md3[2].type, 'pick');
  assert.equal(md3[2].sidePickBy, 'teamB');
  assert.equal(md3[6].type, 'decider');

  const md5 = getVetoSchedule('MD5', 'teamA');
  assert.equal(md5.filter((s) => s.type === 'pick').length, 4);
  assert.equal(md5[6].type, 'decider');
});

test('server/gsi: estado GSI e cache histórico são isolados por sala', () => {
  clearGsiRoomState('SALA-ALPHA');
  clearGsiRoomState('SALA-BETA');

  handleGsiPayload('SALA-ALPHA', {
    map: { name: 'de_mirage', phase: 'live', round: 5, team_ct: { score: 3 }, team_t: { score: 2 } },
    round: { phase: 'live', bomb: 'planted' },
    player: { steamid: '76561198000000111', name: 'AlphaPlayer', match_stats: { kills: 12, assists: 2, deaths: 4 } },
  });

  handleGsiPayload('SALA-BETA', {
    map: { name: 'de_inferno', phase: 'live', round: 10, team_ct: { score: 6 }, team_t: { score: 4 } },
    round: { phase: 'freezetime', bomb: 'none' },
    player: { steamid: '76561198000000222', name: 'BetaPlayer', match_stats: { kills: 20, assists: 1, deaths: 7 } },
  });

  const alpha = getGsiState('SALA-ALPHA');
  const beta = getGsiState('SALA-BETA');

  assert.equal(alpha.mapName, 'de_mirage');
  assert.equal(alpha.scoreCT, 3);
  assert.equal(beta.mapName, 'de_inferno');
  assert.equal(beta.scoreCT, 6);
  assert.equal(alpha.allPlayersStats.length, 1);
  assert.equal(alpha.allPlayersStats[0].name, 'AlphaPlayer');
  assert.equal(beta.allPlayersStats.length, 1);
  assert.equal(beta.allPlayersStats[0].name, 'BetaPlayer');

  clearGsiRoomState('SALA-ALPHA');
  assert.equal(getGsiState('SALA-ALPHA').connected, false);
  assert.equal(getGsiState('SALA-BETA').mapName, 'de_inferno');
});

test('server/authSession: cookie assinado HMAC-SHA256 e senha scrypt rejeitam adulteração', () => {
  const token = signSessionToken({ steamId: '76561198012345678', nick: 'JogadorTeste' });
  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.steamId, '76561198012345678');

  const tampered = `${token.slice(0, -4)}XXXX`;
  assert.equal(verifySessionToken(tampered), null);

  const pwdHash = hashRoomPassword('mix-secreta-2026');
  assert.ok(pwdHash.startsWith('scrypt$'));
  assert.equal(verifyRoomPassword('mix-secreta-2026', pwdHash), true);
  assert.equal(verifyRoomPassword('senha-errada', pwdHash), false);
});

test('server/roomHelpers: sanitização RCON e validação de nome de mapa bloqueiam injeção', () => {
  assert.equal(sanitizeRconCommand('mp_warmup_end 1; sv_cheats 1\nquit'), 'mp_warmup_end 1 sv_cheats 1 quit');
  assert.equal(isValidMapName('de_mirage'), true);
  assert.equal(isValidMapName('de_ancient'), true);
  assert.equal(isValidMapName('de_mirage; quit'), false);
  assert.equal(isValidMapName('../etc/passwd'), false);
});

test('src/utils/canvasHelpers & infraRoutes: coleta jogadores para Story Card e valida hosts do proxy de avatar', () => {
  const steamAvatar = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

  // Antes dos times sorteados, inclui room.players e initialPlayer sem cair em mock
  const lobbyPlayers = collectStoryPlayers({
    room: {
      teamA: [],
      teamB: [],
      players: [{ id: 'p1', steamId: '76561198000000001', nick: 'Alex', level: 18, avatar: '🎯' }],
    },
    initialPlayer: {
      id: 'p1',
      steamId: '76561198000000001',
      nick: 'Alex',
      level: 18,
      avatar: steamAvatar,
    },
  });

  assert.equal(lobbyPlayers.length, 1);
  assert.equal(lobbyPlayers[0].avatar, steamAvatar);

  // Sem sala, ainda inclui initialPlayer para Story Card do perfil
  const profileOnly = collectStoryPlayers({
    room: null,
    initialPlayer: { id: 'me', steamId: '76561198000000002', nick: 'Nunes', avatar: steamAvatar },
  });
  assert.equal(profileOnly.length, 1);
  assert.equal(profileOnly[0].nick, 'Nunes');

  assert.equal(isImageUrl(steamAvatar), true);
  assert.equal(isImageUrl('🎯'), false);
  assert.equal(buildAvatarProxyUrl(steamAvatar), `/api/avatar-proxy?url=${encodeURIComponent(steamAvatar)}`);

  assert.equal(isAllowedAvatarProxyUrl(steamAvatar), true);
  assert.equal(isAllowedAvatarProxyUrl('https://avatars.akamai.steamstatic.com/test_full.jpg'), true);
  assert.equal(isAllowedAvatarProxyUrl('http://avatars.steamstatic.com/test.jpg'), false);
  assert.equal(isAllowedAvatarProxyUrl('https://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isAllowedAvatarProxyUrl('https://user:pass@avatars.steamstatic.com/test.jpg'), false);
});
