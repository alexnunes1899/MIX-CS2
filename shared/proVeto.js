/**
 * CS2 Mix Hub - Official HLTV / Valve Major Veto Schedule Engine
 */

export function getOppositeTeam(team) {
  return team === 'teamA' ? 'teamB' : 'teamA';
}

export function getVetoSchedule(matchFormat = 'MD1', firstTeam = 'teamA', bo1Order = 'ABABAB') {
  const t1 = firstTeam === 'teamB' ? 'teamB' : 'teamA';
  const t2 = getOppositeTeam(t1);

  if (matchFormat === 'MD3') {
    return [
      { step: 1, team: t1, type: 'ban', label: '1º Ban' },
      { step: 2, team: t2, type: 'ban', label: '2º Ban' },
      { step: 3, team: t1, type: 'pick', sidePickBy: t2, mapNumber: 1, label: 'Pick Mapa 1', role: 'Mapa 1 (Pick)' },
      { step: 4, team: t2, type: 'pick', sidePickBy: t1, mapNumber: 2, label: 'Pick Mapa 2', role: 'Mapa 2 (Pick)' },
      { step: 5, team: t1, type: 'ban', label: '3º Ban' },
      { step: 6, team: t2, type: 'ban', label: '4º Ban' },
      { step: 7, team: 'decider', type: 'decider', sidePickBy: t2, mapNumber: 3, label: 'Decider (Mapa 3)', role: 'Mapa 3 (Decider)' },
    ];
  }

  if (matchFormat === 'MD5') {
    return [
      { step: 1, team: t1, type: 'ban', label: '1º Ban' },
      { step: 2, team: t2, type: 'ban', label: '2º Ban' },
      { step: 3, team: t1, type: 'pick', sidePickBy: t2, mapNumber: 1, label: 'Pick Mapa 1', role: 'Mapa 1 (Pick)' },
      { step: 4, team: t2, type: 'pick', sidePickBy: t1, mapNumber: 2, label: 'Pick Mapa 2', role: 'Mapa 2 (Pick)' },
      { step: 5, team: t1, type: 'pick', sidePickBy: t2, mapNumber: 3, label: 'Pick Mapa 3', role: 'Mapa 3 (Pick)' },
      { step: 6, team: t2, type: 'pick', sidePickBy: t1, mapNumber: 4, label: 'Pick Mapa 4', role: 'Mapa 4 (Pick)' },
      { step: 7, team: 'decider', type: 'decider', sidePickBy: t2, mapNumber: 5, label: 'Decider (Mapa 5)', role: 'Mapa 5 (Decider)' },
    ];
  }

  // Standard MD1 (6 Bans + 1 Decider)
  const chars = bo1Order === 'ABBAAB' ? ['A', 'B', 'B', 'A', 'A', 'B'] : ['A', 'B', 'A', 'B', 'A', 'B'];
  return [
    ...chars.map((char, idx) => ({
      step: idx + 1,
      team: char === 'A' ? t1 : t2,
      type: 'ban',
      label: `${idx + 1}º Ban`,
    })),
    { step: 7, team: 'decider', type: 'decider', sidePickBy: t2, mapNumber: 1, label: 'Decider (MD1)', role: 'Mapa da Partida (Decider)' },
  ];
}
