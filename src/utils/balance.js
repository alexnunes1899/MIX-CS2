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
 * Evaluates all combinations of size N/2 and picks the one with the smallest difference.
 */
export function balanceTeams(players, rankingSystem = 'gc') {
  if (!players || players.length < 2) {
    return { teamA: [], teamB: [], metrics: null };
  }

  const n = players.length;
  const half = Math.floor(n / 2);

  // Helper to get all combinations of size k
  function getCombinations(arr, k) {
    const results = [];
    function backtrack(start, combo) {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        backtrack(i + 1, combo);
        combo.pop();
      }
    }
    backtrack(0, []);
    return results;
  }

  const allCombinations = getCombinations(players, half);

  let bestSplit = null;
  let minDiff = Infinity;
  let bestScore = -Infinity;

  for (const comboA of allCombinations) {
    const idsA = new Set(comboA.map((p) => p.id));
    const comboB = players.filter((p) => !idsA.has(p.id));

    const sumA = comboA.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
    const sumB = comboB.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
    const diff = Math.abs(sumA - sumB);

    // Side preference score: Team A gets +1 if CT preference, Team B gets +1 if TR preference
    let sidePrefScore = 0;
    comboA.forEach((p) => {
      if (p.side === 'CT') sidePrefScore += 1;
    });
    comboB.forEach((p) => {
      if (p.side === 'TR') sidePrefScore += 1;
    });

    // Score favors minimum diff first, then side preference
    const score = -diff * 100 + sidePrefScore;

    if (diff < minDiff || (diff === minDiff && score > bestScore)) {
      minDiff = diff;
      bestScore = score;
      bestSplit = {
        teamA: comboA,
        teamB: comboB,
        sumA,
        sumB,
        diff,
      };
    }
  }

  const avgA = (bestSplit.sumA / bestSplit.teamA.length).toFixed(1);
  const avgB = (bestSplit.sumB / bestSplit.teamB.length).toFixed(1);
  const maxPossible = Math.max(bestSplit.sumA, bestSplit.sumB) || 1;
  const balancePercentage = Math.max(0, Math.min(100, Math.round(100 - (bestSplit.diff / maxPossible) * 100)));

  return {
    teamA: bestSplit.teamA,
    teamB: bestSplit.teamB,
    metrics: {
      sumA: bestSplit.sumA,
      sumB: bestSplit.sumB,
      avgA,
      avgB,
      diff: bestSplit.diff,
      balancePercentage,
      rankingSystem,
    },
  };
}

/**
 * Pure random shuffle
 */
export function shuffleTeams(players, rankingSystem = 'gc') {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const half = Math.floor(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);

  const sumA = teamA.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
  const sumB = teamB.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
  const diff = Math.abs(sumA - sumB);
  const avgA = (sumA / teamA.length).toFixed(1);
  const avgB = (sumB / teamB.length).toFixed(1);
  const maxPossible = Math.max(sumA, sumB) || 1;
  const balancePercentage = Math.max(0, Math.min(100, Math.round(100 - (diff / maxPossible) * 100)));

  return {
    teamA,
    teamB,
    metrics: {
      sumA,
      sumB,
      avgA,
      avgB,
      diff,
      balancePercentage,
      rankingSystem,
    },
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
