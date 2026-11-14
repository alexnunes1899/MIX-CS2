import { cryptoShuffle } from './random.js';

/**
 * Helper to compute player weight based on selected ranking system
 */
export function getPlayerScore(p, rankingSystem = 'gc') {
  if (!p) return 10;
  if (rankingSystem === 'faceit') {
    if (p.faceitElo) return Number(p.faceitElo);
    if (p.faceitLevel) return Number(p.faceitLevel) * 200;
    return (Number(p.level) || 5) * 100;
  }
  return Number(p.level) || 12;
}

/**
 * Balances players into two teams of equal size based on Gamers Club (1-21) or FACEIT (1-10/ELO).
 * Evaluates all combinations of size N/2 for N <= 14 using index-based matching,
 * and falls back to greedy balanced snake-draft for larger lobbies.
 */
export function balanceTeams(players, rankingSystem = 'gc') {
  if (!Array.isArray(players) || players.length < 2) {
    return { teamA: players ? [...players] : [], teamB: [], metrics: null };
  }

  const n = players.length;
  const half = Math.floor(n / 2);

  if (n > 14) {
    const sorted = [...players].sort(
      (a, b) => getPlayerScore(b, rankingSystem) - getPlayerScore(a, rankingSystem)
    );
    const teamA = [];
    const teamB = [];
    let sumA = 0;
    let sumB = 0;

    for (const p of sorted) {
      const score = getPlayerScore(p, rankingSystem);
      if (teamA.length < half && (sumA <= sumB || teamB.length >= n - half)) {
        teamA.push(p);
        sumA += score;
      } else {
        teamB.push(p);
        sumB += score;
      }
    }

    return {
      teamA,
      teamB,
      metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
    };
  }

  const allIndexCombinations = [];
  function backtrack(start, combo) {
    if (combo.length === half) {
      allIndexCombinations.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);

  let bestIndicesA = null;
  let minDiff = Infinity;
  let bestScore = -Infinity;

  for (const idxA of allIndexCombinations) {
    const setA = new Set(idxA);
    let sumA = 0;
    let sumB = 0;
    let sidePrefScore = 0;

    for (let i = 0; i < n; i++) {
      const p = players[i];
      const weight = getPlayerScore(p, rankingSystem);
      if (setA.has(i)) {
        sumA += weight;
        if (p?.side === 'CT') sidePrefScore += 1;
      } else {
        sumB += weight;
        if (p?.side === 'TR') sidePrefScore += 1;
      }
    }

    const diff = Math.abs(sumA - sumB);
    const score = -diff * 100 + sidePrefScore;

    if (diff < minDiff || (diff === minDiff && score > bestScore)) {
      minDiff = diff;
      bestScore = score;
      bestIndicesA = setA;
    }
  }

  const teamA = [];
  const teamB = [];
  for (let i = 0; i < n; i++) {
    if (bestIndicesA?.has(i)) teamA.push(players[i]);
    else teamB.push(players[i]);
  }

  return {
    teamA,
    teamB,
    metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
  };
}

/**
 * Pure random shuffle using unbiased Fisher-Yates
 */
export function shuffleTeams(players, rankingSystem = 'gc') {
  if (!Array.isArray(players) || players.length < 2) {
    return { teamA: players ? [...players] : [], teamB: [], metrics: null };
  }
  const shuffled = cryptoShuffle(players);
  const half = Math.floor(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);

  return {
    teamA,
    teamB,
    metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
  };
}

/**
 * Calculates current balance metrics for two arbitrary teams
 */
export function calculateMetricsForTeams(teamA = [], teamB = [], rankingSystem = 'gc') {
  const sumA = teamA.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
  const sumB = teamB.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
  const diff = Math.abs(sumA - sumB);
  const avgA = teamA.length > 0 ? (sumA / teamA.length).toFixed(1) : '0';
  const avgB = teamB.length > 0 ? (sumB / teamB.length).toFixed(1) : '0';
  const maxPossible = Math.max(sumA, sumB) || 1;
  const balancePercentage = Math.max(0, Math.min(100, Math.round(100 - (diff / maxPossible) * 100)));

  return {
    sumA,
    sumB,
    avgA,
    avgB,
    diff,
    balancePercentage,
    rankingSystem,
  };
}
