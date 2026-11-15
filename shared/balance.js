/**
 * CS2 Mix Hub - Shared Team Balancing Engine (Client & Server Single Source of Truth)
 */

export function getPlayerScore(p, rankingSystem = 'gc') {
  if (!p) return 12;
  if (rankingSystem === 'faceit') {
    if (p.faceitElo) return Number(p.faceitElo);
    if (p.faceitLevel) return Number(p.faceitLevel) * 200;
    return (Number(p.level) || 5) * 100;
  }
  return Number(p.level) || 12;
}

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

function greedySnakeBalance(players, rankingSystem) {
  const sorted = [...players].sort((a, b) => getPlayerScore(b, rankingSystem) - getPlayerScore(a, rankingSystem));
  const teamA = [];
  const teamB = [];
  let sumA = 0;
  let sumB = 0;

  for (const player of sorted) {
    const score = getPlayerScore(player, rankingSystem);
    if (teamA.length <= teamB.length && (sumA <= sumB || teamB.length >= Math.ceil(players.length / 2))) {
      teamA.push(player);
      sumA += score;
    } else {
      teamB.push(player);
      sumB += score;
    }
  }
  return { teamA, teamB };
}

/**
 * Balances players into two teams (teamA, teamB), honoring optional CT/TR side preferences
 * and returning metrics compatible with both UI and backend socket emissions.
 */
export function balanceTeams(players = [], rankingSystem = 'gc') {
  if (!Array.isArray(players) || players.length < 2) {
    return {
      teamA: Array.isArray(players) ? [...players] : [],
      teamB: [],
      metrics: null,
    };
  }

  const n = players.length;
  const targetA = Math.floor(n / 2);

  // Guard combinatorial blowup when > 16 players (use fast greedy split)
  if (n > 16) {
    const { teamA, teamB } = greedySnakeBalance(players, rankingSystem);
    return {
      teamA,
      teamB,
      metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
    };
  }

  const bestCandidates = [];
  let bestScore = Infinity;

  function combine(start, currentTeamA) {
    if (currentTeamA.length === targetA) {
      const teamASet = new Set(currentTeamA.map((p) => p.id));
      const currentTeamB = players.filter((p) => !teamASet.has(p.id));

      const sumA = currentTeamA.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
      const sumB = currentTeamB.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
      const diff = Math.abs(sumA - sumB);

      let sidePenalty = 0;
      for (const p of currentTeamA) {
        if (p.side === 'TR') sidePenalty += 0.25;
      }
      for (const p of currentTeamB) {
        if (p.side === 'CT') sidePenalty += 0.25;
      }

      const maxA = currentTeamA.length > 0 ? Math.max(...currentTeamA.map((p) => getPlayerScore(p, rankingSystem))) : 0;
      const maxB = currentTeamB.length > 0 ? Math.max(...currentTeamB.map((p) => getPlayerScore(p, rankingSystem))) : 0;
      const variancePenalty = rankingSystem === 'faceit' ? Math.abs(maxA - maxB) * 0.0005 : Math.abs(maxA - maxB) * 0.01;

      const totalScore = diff + sidePenalty + variancePenalty;
      const tolerance = rankingSystem === 'faceit' ? 15 : 0.2;

      if (totalScore < bestScore - 0.001) {
        bestScore = totalScore;
        bestCandidates.length = 0;
        bestCandidates.push({
          teamA: [...currentTeamA],
          teamB: [...currentTeamB],
          diff,
        });
      } else if (Math.abs(totalScore - bestScore) <= tolerance) {
        bestCandidates.push({
          teamA: [...currentTeamA],
          teamB: [...currentTeamB],
          diff,
        });
      }
      return;
    }

    for (let i = start; i < n; i++) {
      currentTeamA.push(players[i]);
      combine(i + 1, currentTeamA);
      currentTeamA.pop();
    }
  }

  combine(0, []);

  const chosen =
    bestCandidates.length > 0
      ? bestCandidates[Math.floor(Math.random() * bestCandidates.length)]
      : greedySnakeBalance(players, rankingSystem);

  return {
    teamA: chosen.teamA,
    teamB: chosen.teamB,
    metrics: calculateMetricsForTeams(chosen.teamA, chosen.teamB, rankingSystem),
  };
}

export function shuffleTeams(players = [], rankingSystem = 'gc') {
  if (!Array.isArray(players) || players.length < 2) {
    return { teamA: [...(players || [])], teamB: [], metrics: null };
  }
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const half = Math.ceil(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);
  return {
    teamA,
    teamB,
    metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
  };
}
