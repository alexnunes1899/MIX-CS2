/**
 * Player Statistics Manager for CS2 Mix Hub
 * Tracks matches played, wins, losses, win rate, favorite side, and achievements.
 */

const DEFAULT_STATS = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  favoriteSide: 'CT',
  streak: 0,
};

export function getPlayerStats(steamId) {
  if (!steamId) return DEFAULT_STATS;
  try {
    const key = `cs2_stats_v2_${steamId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const winRate = parsed.matchesPlayed > 0
        ? Math.round((parsed.wins / parsed.matchesPlayed) * 100)
        : 0;
      return { ...DEFAULT_STATS, ...parsed, winRate };
    }
  } catch (e) {}

  return { ...DEFAULT_STATS };
}

export function recordMatchResult(steamId, didWin, side) {
  if (!steamId) return;
  try {
    const current = getPlayerStats(steamId);
    const updated = {
      ...current,
      matchesPlayed: current.matchesPlayed + 1,
      wins: didWin ? current.wins + 1 : current.wins,
      losses: didWin ? current.losses : current.losses + 1,
      streak: didWin ? current.streak + 1 : 0,
      favoriteSide: side || current.favoriteSide,
    };
    updated.winRate = Math.round((updated.wins / updated.matchesPlayed) * 100);
    localStorage.setItem(`cs2_stats_v2_${steamId}`, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return null;
  }
}
