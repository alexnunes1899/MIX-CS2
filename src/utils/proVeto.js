/**
 * Official Professional CS2 Pick & Ban Engine (Valve Major / HLTV / ESL / Gamers Club Standard)
 * Supports:
 * - MD1 (BO1): 6 Bans + 1 Decider (supports ABABAB standard and ABBAAB Valve Major order)
 * - MD3 (BO3): Ban A, Ban B, Pick A (Side B), Pick B (Side A), Ban A, Ban B, Decider (Side/Knife)
 * - MD5 (BO5): Ban A, Ban B, Pick A (Side B), Pick B (Side A), Pick A (Side B), Pick B (Side A), Decider (Side/Knife)
 */

export function getOppositeTeam(team) {
  return team === 'teamA' ? 'teamB' : 'teamA';
}

/**
 * Generates the 7-step official professional veto schedule for a 7-map pool.
 * @param {'MD1'|'MD3'|'MD5'} matchFormat
 * @param {'teamA'|'teamB'} firstTeam
 * @param {'ABABAB'|'ABBAAB'} bo1Order
 */
export function getVetoSchedule(matchFormat = 'MD1', firstTeam = 'teamA', bo1Order = 'ABABAB') {
  const T1 = firstTeam === 'teamB' ? 'teamB' : 'teamA';
  const T2 = getOppositeTeam(T1);

  if (matchFormat === 'MD3') {
    return [
      { step: 1, type: 'ban', team: T1, label: '1º Ban' },
      { step: 2, type: 'ban', team: T2, label: '2º Ban' },
      { step: 3, type: 'pick', team: T1, sidePickBy: T2, mapNumber: 1, label: 'Pick Mapa 1', role: 'Mapa 1 (Pick)' },
      { step: 4, type: 'pick', team: T2, sidePickBy: T1, mapNumber: 2, label: 'Pick Mapa 2', role: 'Mapa 2 (Pick)' },
      { step: 5, type: 'ban', team: T1, label: '3º Ban' },
      { step: 6, type: 'ban', team: T2, label: '4º Ban' },
      { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 3, label: 'Decider (Mapa 3)', role: 'Mapa 3 (Decider)' },
    ];
  }

  if (matchFormat === 'MD5') {
    return [
      { step: 1, type: 'ban', team: T1, label: '1º Ban' },
      { step: 2, type: 'ban', team: T2, label: '2º Ban' },
      { step: 3, type: 'pick', team: T1, sidePickBy: T2, mapNumber: 1, label: 'Pick Mapa 1', role: 'Mapa 1 (Pick)' },
      { step: 4, type: 'pick', team: T2, sidePickBy: T1, mapNumber: 2, label: 'Pick Mapa 2', role: 'Mapa 2 (Pick)' },
      { step: 5, type: 'pick', team: T1, sidePickBy: T2, mapNumber: 3, label: 'Pick Mapa 3', role: 'Mapa 3 (Pick)' },
      { step: 6, type: 'pick', team: T2, sidePickBy: T1, mapNumber: 4, label: 'Pick Mapa 4', role: 'Mapa 4 (Pick)' },
      { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 5, label: 'Decider (Mapa 5)', role: 'Mapa 5 (Decider)' },
    ];
  }

  // Default: MD1 (BO1)
  if (bo1Order === 'ABBAAB') {
    return [
      { step: 1, type: 'ban', team: T1, label: '1º Ban' },
      { step: 2, type: 'ban', team: T2, label: '2º Ban' },
      { step: 3, type: 'ban', team: T2, label: '3º Ban' },
      { step: 4, type: 'ban', team: T1, label: '4º Ban' },
      { step: 5, type: 'ban', team: T1, label: '5º Ban' },
      { step: 6, type: 'ban', team: T2, label: '6º Ban' },
      { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 1, label: 'Decider (MD1)', role: 'Mapa da Partida (Decider)' },
    ];
  }

  return [
    { step: 1, type: 'ban', team: T1, label: '1º Ban' },
    { step: 2, type: 'ban', team: T2, label: '2º Ban' },
    { step: 3, type: 'ban', team: T1, label: '3º Ban' },
    { step: 4, type: 'ban', team: T2, label: '4º Ban' },
    { step: 5, type: 'ban', team: T1, label: '5º Ban' },
    { step: 6, type: 'ban', team: T2, label: '6º Ban' },
    { step: 7, type: 'decider', team: 'auto', sidePickBy: T1, mapNumber: 1, label: 'Decider (MD1)', role: 'Mapa da Partida (Decider)' },
  ];
}
