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

export function normalizeDuos(players = [], duos = []) {
  if (!Array.isArray(players) || !Array.isArray(duos) || duos.length === 0) return [];
  const playerById = new Map();
  for (const p of players) {
    if (!p) continue;
    if (p.id !== undefined && p.id !== null) playerById.set(String(p.id), p);
    if (p.discordId) playerById.set(String(p.discordId), p);
  }

  const usedPlayerKeys = new Set();
  const validDuos = [];

  for (const pair of duos) {
    const rawA = Array.isArray(pair) ? pair[0] : pair?.a || pair?.[0];
    const rawB = Array.isArray(pair) ? pair[1] : pair?.b || pair?.[1];
    if (!rawA || !rawB) continue;
    const pA = playerById.get(String(rawA));
    const pB = playerById.get(String(rawB));
    if (!pA || !pB || pA === pB || String(pA.id) === String(pB.id)) continue;

    const keyA = String(pA.id || rawA);
    const keyB = String(pB.id || rawB);
    if (usedPlayerKeys.has(keyA) || usedPlayerKeys.has(keyB)) continue;

    usedPlayerKeys.add(keyA);
    usedPlayerKeys.add(keyB);
    validDuos.push([pA, pB]);
  }

  return validDuos;
}

function buildBalanceUnits(players, validDuos) {
  const pairedPlayers = new Set();
  const units = [];

  for (const [pA, pB] of validDuos) {
    pairedPlayers.add(pA);
    pairedPlayers.add(pB);
    units.push([pA, pB]);
  }

  for (const p of players) {
    if (!pairedPlayers.has(p)) {
      units.push([p]);
    }
  }

  return units;
}

function countPreservedDuos(teamA = [], teamB = [], validDuos = []) {
  if (!validDuos.length) return 0;
  const setA = new Set(teamA.map((p) => String(p?.id || p?.discordId || '')));
  const setB = new Set(teamB.map((p) => String(p?.id || p?.discordId || '')));
  let preserved = 0;
  for (const [pA, pB] of validDuos) {
    const idA = String(pA?.id || pA?.discordId || '');
    const idB = String(pB?.id || pB?.discordId || '');
    if ((setA.has(idA) && setA.has(idB)) || (setB.has(idA) && setB.has(idB))) {
      preserved += 1;
    }
  }
  return preserved;
}

function greedySnakeBalance(players, rankingSystem, validDuos = []) {
  const units = validDuos.length > 0 ? buildBalanceUnits(players, validDuos) : players.map((p) => [p]);
  const unitScore = (u) => u.reduce((acc, p) => acc + getPlayerScore(p, rankingSystem), 0);
  const sortedUnits = [...units].sort((a, b) => unitScore(b) - unitScore(a));
  const targetA = Math.floor(players.length / 2);
  const targetB = players.length - targetA;

  const teamA = [];
  const teamB = [];
  let sumA = 0;
  let sumB = 0;

  for (const unit of sortedUnits) {
    const score = unitScore(unit);
    const fitsA = teamA.length + unit.length <= targetA;
    const fitsB = teamB.length + unit.length <= targetB;

    if (fitsA && (!fitsB || (sumA <= sumB && teamA.length <= teamB.length) || sumA < sumB)) {
      teamA.push(...unit);
      sumA += score;
    } else if (fitsB) {
      teamB.push(...unit);
      sumB += score;
    } else if (validDuos.length > 0) {
      return greedySnakeBalance(players, rankingSystem, []);
    } else {
      teamA.push(...unit);
      sumA += score;
    }
  }
  return { teamA, teamB };
}

/**
 * Balances players into two teams (teamA, teamB), honoring optional CT/TR side preferences
 * and optional fixed duos, returning metrics compatible with both UI and backend socket emissions.
 */
export function balanceTeams(players = [], rankingSystem = 'gc', options = {}) {
  if (!Array.isArray(players) || players.length < 2) {
    return {
      teamA: Array.isArray(players) ? [...players] : [],
      teamB: [],
      metrics: null,
      preservedDuos: 0,
    };
  }

  const n = players.length;
  const targetA = Math.floor(n / 2);
  const validDuos = normalizeDuos(players, options?.duos || []);

  // Guard combinatorial blowup when > 16 players (use fast greedy split)
  if (n > 16) {
    const { teamA, teamB } = greedySnakeBalance(players, rankingSystem, validDuos);
    return {
      teamA,
      teamB,
      metrics: calculateMetricsForTeams(teamA, teamB, rankingSystem),
      preservedDuos: countPreservedDuos(teamA, teamB, validDuos),
    };
  }

  const bestCandidates = [];
  let bestScore = Infinity;

  function evaluateTeamA(currentTeamA) {
    const teamASet = new Set(currentTeamA);
    const currentTeamB = players.filter((p) => !teamASet.has(p));

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
  }

  if (validDuos.length > 0) {
    const units = buildBalanceUnits(players, validDuos);
    function combineUnits(start, currentTeamA) {
      if (currentTeamA.length === targetA) {
        evaluateTeamA(currentTeamA);
        return;
      }
      if (currentTeamA.length > targetA) return;
      for (let i = start; i < units.length; i++) {
        const unit = units[i];
        if (currentTeamA.length + unit.length > targetA) continue;
        currentTeamA.push(...unit);
        combineUnits(i + 1, currentTeamA);
        currentTeamA.length -= unit.length;
      }
    }
    combineUnits(0, []);
  } else {
    function combine(start, currentTeamA) {
      if (currentTeamA.length === targetA) {
        evaluateTeamA(currentTeamA);
        return;
      }
      for (let i = start; i < n; i++) {
        currentTeamA.push(players[i]);
        combine(i + 1, currentTeamA);
        currentTeamA.pop();
      }
    }
    combine(0, []);
  }

  const chosen =
    bestCandidates.length > 0
      ? bestCandidates[Math.floor(Math.random() * bestCandidates.length)]
      : greedySnakeBalance(players, rankingSystem, validDuos);

  return {
    teamA: chosen.teamA,
    teamB: chosen.teamB,
    metrics: calculateMetricsForTeams(chosen.teamA, chosen.teamB, rankingSystem),
    preservedDuos: countPreservedDuos(chosen.teamA, chosen.teamB, validDuos),
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
