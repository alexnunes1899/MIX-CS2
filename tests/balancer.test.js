import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlayerWeight,
  calculateMetricsForTeams as serverCalculateMetrics,
  calculateBalance,
} from '../server/services/teamBalancer.js';
import {
  balanceTeams,
  shuffleTeams,
  calculateMetricsForTeams as clientCalculateMetrics,
} from '../src/utils/balance.js';

function makePlayers(count, overrides = {}) {
  return Array.from({ length: count }, (_, idx) => ({
    id: overrides.duplicateIds ? 'dup-id' : `p-${idx + 1}`,
    nick: `Player${idx + 1}`,
    level: ((idx * 3) % 20) + 1,
    faceitLevel: (idx % 10) + 1,
    faceitElo: 1000 + idx * 125,
    side: idx % 2 === 0 ? 'CT' : 'TR',
  }));
}

test('server getPlayerWeight resolves GC level and FACEIT ELO weights', () => {
  assert.equal(getPlayerWeight({ level: 18 }, 'gc'), 18);
  assert.equal(getPlayerWeight({ faceitElo: 2150, level: 20 }, 'faceit'), 2150);
  assert.equal(getPlayerWeight({ faceitLevel: 7 }, 'faceit'), 1400);
});

test('server calculateBalance handles < 2 players cleanly', () => {
  const res = calculateBalance([{ id: '1', nick: 'Solo', level: 15 }], 'gc');
  assert.equal(res.teamA.length, 1);
  assert.equal(res.teamB.length, 0);
  assert.equal(res.metrics, null);
});

test('server calculateBalance splits duplicate IDs cleanly and balances 10 players', () => {
  const players = makePlayers(10, { duplicateIds: true });
  const res = calculateBalance(players, 'gc');
  assert.equal(res.teamA.length, 5);
  assert.equal(res.teamB.length, 5);
  assert.ok(res.metrics.balancePercentage >= 90);
});

test('server calculateBalance uses greedy fallback for > 14 players without combinatorial blowup', () => {
  const players = makePlayers(20);
  const res = calculateBalance(players, 'faceit');
  assert.equal(res.teamA.length, 10);
  assert.equal(res.teamB.length, 10);
  assert.equal(res.metrics.rankingSystem, 'faceit');
  assert.ok(Number.isFinite(res.metrics.diff));
});

test('server calculateMetricsForTeams computes accurate sums and diff', () => {
  const metrics = serverCalculateMetrics([{ level: 10 }, { level: 12 }], [{ level: 11 }, { level: 11 }], 'gc');
  assert.equal(metrics.sumA, 22);
  assert.equal(metrics.sumB, 22);
  assert.equal(metrics.diff, 0);
  assert.equal(metrics.balancePercentage, 100);
});

test('client balanceTeams and shuffleTeams handle < 2 players and 10+ players without NaN', () => {
  const onePlayer = [{ id: 'a', nick: 'One', level: 10 }];
  assert.equal(balanceTeams(onePlayer, 'gc').metrics, null);
  assert.equal(shuffleTeams(onePlayer, 'gc').metrics, null);

  const tenPlayers = makePlayers(10);
  const balanced = balanceTeams(tenPlayers, 'gc');
  assert.equal(balanced.teamA.length, 5);
  assert.equal(balanced.teamB.length, 5);
  assert.ok(!Number.isNaN(balanced.metrics.balancePercentage));

  const largePlayers = makePlayers(18);
  const largeBalanced = balanceTeams(largePlayers, 'faceit');
  assert.equal(largeBalanced.teamA.length, 9);
  assert.equal(largeBalanced.teamB.length, 9);

  const shuffled = shuffleTeams(tenPlayers, 'gc');
  assert.equal(shuffled.teamA.length + shuffled.teamB.length, 10);
  assert.ok(shuffled.metrics.balancePercentage >= 0 && shuffled.metrics.balancePercentage <= 100);

  const emptyMetrics = clientCalculateMetrics([], [], 'gc');
  assert.equal(emptyMetrics.balancePercentage, 100);
});
