import test from 'node:test';
import assert from 'node:assert/strict';
import { parseServerDetails } from '../src/utils/serverParser.js';
import { getVetoSchedule } from '../src/utils/proVeto.js';
import { formatDiscordSummary } from '../src/utils/exportText.js';
import { getSecureRandomInt, cryptoShuffle } from '../src/utils/random.js';
import { getTournamentRecommendation, buildMatchesStructure } from '../src/utils/tournamentAdvisor.js';

test('parseServerDetails extracts host, numeric port, password, and Steam URI', () => {
  const parsed = parseServerDetails('connect 189.1.168.10:27025; password "mixcs"');
  assert.equal(parsed.isValid, true);
  assert.equal(parsed.host, '189.1.168.10');
  assert.equal(parsed.port, 27025);
  assert.equal(parsed.password, 'mixcs');
  assert.equal(parsed.connectCommand, 'connect 189.1.168.10:27025; password mixcs');
  assert.match(parsed.steamUrl, /^steam:\/\/rungame\/730\//);

  const defaultPort = parseServerDetails('mix.server.gg');
  assert.equal(defaultPort.isValid, true);
  assert.equal(defaultPort.host, 'mix.server.gg');
  assert.equal(defaultPort.port, 27015);

  const invalid = parseServerDetails('');
  assert.equal(invalid.isValid, false);
});

test('getVetoSchedule generates accurate 7-step schedules for MD1, MD3, and MD5', () => {
  const md1 = getVetoSchedule('MD1', 'teamA', 'ABABAB');
  assert.equal(md1.length, 7);
  assert.equal(md1.filter((s) => s.type === 'ban').length, 6);
  assert.equal(md1[6].type, 'decider');

  const md1Major = getVetoSchedule('MD1', 'teamB', 'ABBAAB');
  assert.deepEqual(
    md1Major.slice(0, 6).map((s) => s.team),
    ['teamB', 'teamA', 'teamA', 'teamB', 'teamB', 'teamA']
  );

  const md3 = getVetoSchedule('MD3', 'teamA');
  assert.equal(md3.filter((s) => s.type === 'pick').length, 2);
  assert.equal(md3.filter((s) => s.type === 'ban').length, 4);

  const md5 = getVetoSchedule('MD5', 'teamA');
  assert.equal(md5.filter((s) => s.type === 'pick').length, 4);
  assert.equal(md5.filter((s) => s.type === 'ban').length, 2);
});

test('formatDiscordSummary renders KNIFE / knifeRound rounds cleanly', () => {
  const text = formatDiscordSummary({
    roomName: 'MIX-PRO',
    teamA: [{ nick: 'Alpha', level: 18 }],
    teamB: [{ nick: 'Bravo', level: 17 }],
    metrics: { avgA: '18.0', sumA: 18, avgB: '17.0', sumB: 17, balancePercentage: 94, diff: 1 },
    matchFormat: 'MD3',
    drawnSeries: [
      { map: { name: 'Mirage' }, role: 'Mapa 1 (Pick)', sideTeamA: 'CT' },
      { map: { name: 'Inferno' }, role: 'Mapa 2 (Pick)', sideTeamA: 'TR' },
      { map: { name: 'Nuke' }, role: 'Mapa 3 (Decider)', sideTeamA: 'KNIFE', knifeRound: true },
    ],
  });
  assert.match(text, /Round Faca/);
  assert.match(text, /Mirage/);
  assert.match(text, /TIME A: \*\*CT\*\*/);
});

test('random utilities stay within bounds and preserve array elements', () => {
  for (let i = 0; i < 50; i++) {
    const r = getSecureRandomInt(7);
    assert.ok(r >= 0 && r < 7);
  }
  assert.equal(getSecureRandomInt(0), 0);

  const input = [1, 2, 3, 4, 5, 6];
  const shuffled = cryptoShuffle(input);
  assert.equal(shuffled.length, input.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
});

test('tournamentAdvisor supports team counts 2 through 16', () => {
  for (let count = 2; count <= 16; count++) {
    const rec = getTournamentRecommendation(count);
    const teams = Array.from({ length: count }, (_, idx) => ({ name: `Team ${idx + 1}` }));
    const matches = buildMatchesStructure(count, teams);
    assert.ok(rec.title.length > 0);
    assert.ok(Object.keys(matches).length >= 1);
  }
});
