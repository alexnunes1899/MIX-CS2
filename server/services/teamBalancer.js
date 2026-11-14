/**
 * Pure server-side team balancing & metrics calculation for GC (1-21) and FACEIT (1-10 / ELO).
 */

export function getPlayerWeight(p, rankingSystem = 'gc') {
  if (!p) return rankingSystem === 'faceit' ? 1000 : 12;
  if (rankingSystem === 'faceit') {
    if (p.faceitElo) return Number(p.faceitElo);
    if (p.faceitLevel) return Number(p.faceitLevel) * 200;
    return (Number(p.level) || 5) * 100;
  }
  return Number(p.level) || 12;
}

export function calculateMetricsForTeams(teamA = [], teamB = [], rankingSystem = 'gc') {
  const sumA = teamA.reduce((acc, p) => acc + getPlayerWeight(p, rankingSystem), 0);
  const sumB = teamB.reduce((acc, p) => acc + getPlayerWeight(p, rankingSystem), 0);
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

/**
 * Computes optimal 2-team partition minimizing weight difference and respecting CT/TR preferences.
 * Uses index-based partitioning so duplicate/missing IDs never break splits, and falls back to
 * greedy snake-draft if players.length > 14 to avoid combinatorial blowup.
 */
export function calculateBalance(players = [], rankingSystem = 'gc') {
  if (!Array.isArray(players) || players.length < 2) {
    return { teamA: Array.isArray(players) ? players : [], teamB: [], metrics: null };
  }

  const half = Math.floor(players.length / 2);

  if (players.length > 14) {
    const sorted = [...players].sort(
      (a, b) => getPlayerWeight(b, rankingSystem) - getPlayerWeight(a, rankingSystem)
    );
    const teamA = [];
    const teamB = [];
    let sumA = 0;
    let sumB = 0;
    for (const p of sorted) {
      const w = getPlayerWeight(p, rankingSystem);
      if (teamA.length < half && (sumA <= sumB || teamB.length >= players.length - half)) {
        teamA.push(p);
        sumA += w;
      } else {
        teamB.push(p);
        sumB += w;
      }
    }
    return {
      teamA,
      teamB,
      metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
    };
  }

  const n = players.length;
  const indicesA = [];
  let bestIndicesA = null;
  let minDiff = Infinity;
  let bestScore = -Infinity;

  function evaluateCurrent() {
    const setA = new Set(indicesA);
    let sumA = 0;
    let sumB = 0;
    let sideScore = 0;

    for (let i = 0; i < n; i++) {
      const p = players[i];
      const w = getPlayerWeight(p, rankingSystem);
      if (setA.has(i)) {
        sumA += w;
        if (p?.side === 'CT') sideScore += 1;
      } else {
        sumB += w;
        if (p?.side === 'TR') sideScore += 1;
      }
    }

    const diff = Math.abs(sumA - sumB);
    const score = -diff * 100 + sideScore;
    if (diff < minDiff || (diff === minDiff && score > bestScore)) {
      minDiff = diff;
      bestScore = score;
      bestIndicesA = [...indicesA];
    }
  }

  function backtrack(start) {
    if (indicesA.length === half) {
      evaluateCurrent();
      return;
    }
    const needed = half - indicesA.length;
    for (let i = start; i <= n - needed; i++) {
      indicesA.push(i);
      backtrack(i + 1);
      indicesA.pop();
    }
  }

  backtrack(0);

  const chosenA = new Set(bestIndicesA || []);
  const teamA = [];
  const teamB = [];
  for (let i = 0; i < n; i++) {
    if (chosenA.has(i)) teamA.push(players[i]);
    else teamB.push(players[i]);
  }

  return {
    teamA,
    teamB,
    metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
  };
}
