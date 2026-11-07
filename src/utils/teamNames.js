/**
 * Utility to compute dynamic Gamers Club / CS2 mix team names based on room config, captains, or custom Quick Veto names.
 */

function formatTeamLabel(rawName, fallback) {
  if (!rawName || typeof rawName !== 'string') return fallback;
  const trimmed = rawName.trim();
  if (!trimmed) return fallback;
  // If user already wrote "Time ..." or "Equipe ..." or a specific org/team name in Quick Veto, preserve it cleanly
  if (/^(time|equipe|team)\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Time ${trimmed}`;
}

export function getTeamNames(room) {
  // Priority 1: Explicit custom team names (from Quick Veto or custom match setup)
  if (room?.teamAName || room?.teamBName) {
    const rawCustomA = (room.teamAName || 'Time A').trim();
    const rawCustomB = (room.teamBName || 'Time B').trim();
    const labelA = rawCustomA;
    const labelB = rawCustomB;
    return {
      labelA,
      labelB,
      upperA: labelA.toUpperCase(),
      upperB: labelB.toUpperCase(),
      captainNickA: rawCustomA.replace(/^time\s+/i, ''),
      captainNickB: rawCustomB.replace(/^time\s+/i, ''),
    };
  }

  // Team A (Captain A / First player of team A / Creator)
  let rawA = room?.captainA?.nick || null;
  if (!rawA && room?.teamA?.[0]?.nick) {
    rawA = room.teamA[0].nick;
  }
  if (!rawA && room?.creatorNick) {
    rawA = room.creatorNick;
  }
  if (!rawA && room?.name && /^time\s+/i.test(room.name)) {
    rawA = room.name.replace(/^time\s+/i, '').trim();
  }
  if (!rawA && room?.players?.[0]?.nick) {
    rawA = room.players[0].nick;
  }

  // Team B (Captain B / First player of team B)
  let rawB = room?.captainB?.nick || null;
  if (!rawB && room?.teamB?.[0]?.nick) {
    rawB = room.teamB[0].nick;
  }

  // If rawB equals rawA, pick another player from team B
  if (rawB && rawA && rawB.toLowerCase() === rawA.toLowerCase()) {
    rawB = room?.teamB?.find((p) => p.nick && p.nick.toLowerCase() !== rawA.toLowerCase())?.nick || null;
  }

  const labelA = formatTeamLabel(rawA, 'Time A');
  const labelB = formatTeamLabel(rawB, 'Time B');
  const upperA = labelA.toUpperCase();
  const upperB = labelB.toUpperCase();

  return { labelA, labelB, upperA, upperB, captainNickA: rawA, captainNickB: rawB };
}
