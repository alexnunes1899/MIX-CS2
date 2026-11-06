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
    rawPlayer: player?.name ? { name: player.name, team: player.team, steamId: player.steamid } : null,
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
