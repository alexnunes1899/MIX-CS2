/**
 * Valve CS2 Game State Integration (GSI) Handler
 * Receives JSON HTTP POST updates directly from Counter-Strike 2
 * Updates room live score and match status in real time.
 */

const roomGsiStates = new Map();

export function handleGsiPayload(roomId, payload) {
  if (!roomId || !payload) return null;

  const cleanRoomId = roomId.trim().toUpperCase();
  const mapData = payload.map || {};
  const roundData = payload.round || {};
  const player = payload.player || {};

  const mapName = mapData.name || 'Indefinido';
  const phase = mapData.phase || 'unknown'; // 'warmup' | 'live' | 'intermission' | 'gameover'
  const roundNumber = typeof mapData.round === 'number' ? mapData.round : 0;
  const scoreCT = mapData.team_ct?.score || 0;
  const scoreTR = mapData.team_t?.score || 0;
  const bomb = roundData.bomb || 'none'; // 'planted' | 'exploded' | 'defused'
  const roundPhase = roundData.phase || 'unknown'; // 'freezetime' | 'live' | 'over'
  const winTeam = roundData.win_team || null;

  // Parse all players match statistics (Kills, Deaths, Assists, MVPs, Score, K/D)
  const allPlayersStats = [];
  if (payload.allplayers && typeof payload.allplayers === 'object') {
    Object.entries(payload.allplayers).forEach(([steamId, pData]) => {
      if (!pData || typeof pData !== 'object') return;
      const stats = pData.match_stats || {};
      const kills = typeof stats.kills === 'number' ? stats.kills : 0;
      const deaths = typeof stats.deaths === 'number' ? stats.deaths : 0;
      const assists = typeof stats.assists === 'number' ? stats.assists : 0;
      const mvps = typeof stats.mvps === 'number' ? stats.mvps : 0;
      const score = typeof stats.score === 'number' ? stats.score : 0;
      const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));

      allPlayersStats.push({
        steamId,
        name: pData.name || 'Jogador',
        team: pData.team === 'CT' ? 'CT' : 'T',
        kills,
        deaths,
        assists,
        mvps,
        score,
        kd,
      });
    });
  } else if (player?.steamid && player?.match_stats) {
    // Fallback: client-only GSI without allplayers
    const stats = player.match_stats;
    const kills = stats.kills || 0;
    const deaths = stats.deaths || 0;
    const assists = stats.assists || 0;
    const mvps = stats.mvps || 0;
    const score = stats.score || 0;
    const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));
    allPlayersStats.push({
      steamId: player.steamid,
      name: player.name || 'Jogador',
      team: player.team === 'CT' ? 'CT' : 'T',
      kills,
      deaths,
      assists,
      mvps,
      score,
      kd,
    });
  }

  // Sort players by score desc, then kills desc
  allPlayersStats.sort((a, b) => b.score - a.score || b.kills - a.kills);

  const topFragger = allPlayersStats.length > 0 ? allPlayersStats[0] : null;
  const matchMvp = allPlayersStats.length > 0
    ? [...allPlayersStats].sort((a, b) => (b.mvps * 10 + b.score) - (a.mvps * 10 + a.score))[0]
    : null;

  const now = Date.now();

  const liveState = {
    connected: true,
    lastUpdate: now,
    mapName,
    phase,
    roundNumber,
    scoreCT,
    scoreTR,
    bomb,
    roundPhase,
    winTeam,
    rawPlayer: player?.name ? { name: player.name, team: player.team, steamId: player.steamid, matchStats: player.match_stats } : null,
    allPlayersStats,
    topFragger,
    matchMvp,
    isGameOver: phase === 'gameover' || (scoreCT >= 13 && scoreCT - scoreTR >= 2) || (scoreTR >= 13 && scoreTR - scoreCT >= 2),
  };

  roomGsiStates.set(cleanRoomId, liveState);
  return liveState;
}

export function getGsiState(roomId) {
  if (!roomId) return { connected: false };
  const clean = roomId.trim().toUpperCase();
  const state = roomGsiStates.get(clean);

  if (!state) {
    return { connected: false, message: 'Aguardando primeira transmissão do CS2...' };
  }

  // If last update was > 60 seconds ago, mark as inactive
  const isStale = Date.now() - state.lastUpdate > 60000;
  return {
    ...state,
    connected: !isStale,
    isStale,
  };
}

/**
 * Generates official Valve CS2 Game State Integration .cfg configuration
 */
export function generateGsiConfig(serverBaseUrl, roomId) {
  const cleanRoomId = (roomId || 'MIX-PRO').trim().toUpperCase();
  const cleanUrl = (serverBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const targetUri = `${cleanUrl}/api/gsi/${cleanRoomId}`;

  return `"CS2MixHub Integration"
{
    "uri" "${targetUri}"
    "timeout" "5.0"
    "buffer"  "0.1"
    "throttle" "0.5"
    "heartbeat" "15.0"
    "data"
    {
        "map"                   "1"
        "round"                 "1"
        "player_id"             "1"
        "allplayers_id"         "1"
        "player_state"          "1"
        "allplayers_state"      "1"
        "allplayers_match_stats" "1"
    }
    "auth"
    {
        "token" "${cleanRoomId}"
    }
}
`;
}
