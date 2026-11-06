/**
 * Utility to compute dynamic Gamers Club / CS2 mix team names based on room creator / captains.
 * Ex: Se o Alex está criando a sala, o Time A fica "Time Alex" / "TIME ALEX".
 * O Time B fica "Time [Capitão B]" (ex: "Time Fallen") ou fallback "Time B".
 */

export function getTeamNames(room) {
  // Team A (Creator / Captain A / First player of team A)
  let rawA = room?.captainA?.nick || null;
  if (!rawA && room?.creatorNick) {
    rawA = room.creatorNick;
  }
  if (!rawA && room?.name && /^time\s+/i.test(room.name)) {
    rawA = room.name.replace(/^time\s+/i, '').trim();
  }
  if (!rawA && room?.teamA?.[0]?.nick) {
    rawA = room.teamA[0].nick;
  }
  if (!rawA && room?.players?.[0]?.nick) {
    rawA = room.players[0].nick;
  }

  // Team B (Captain B / First player of team B)
  let rawB = room?.captainB?.nick || null;
  if (!rawB && room?.teamB?.[0]?.nick) {
    rawB = room.teamB[0].nick;
  }

  // If rawB equals rawA (edge case where captain B has same nick as A), pick another player from team B
  if (rawB && rawA && rawB.toLowerCase() === rawA.toLowerCase()) {
    rawB = room?.teamB?.find((p) => p.nick && p.nick.toLowerCase() !== rawA.toLowerCase())?.nick || null;
  }

  const labelA = rawA ? `Time ${rawA}` : 'Time A';
  const labelB = rawB ? `Time ${rawB}` : 'Time B';
  const upperA = rawA ? `TIME ${rawA.toUpperCase()}` : 'TIME A';
  const upperB = rawB ? `TIME ${rawB.toUpperCase()}` : 'TIME B';

  return { labelA, labelB, upperA, upperB, captainNickA: rawA, captainNickB: rawB };
}
