import { getTeamNames } from './teamNames';

/**
 * Builds an official MatchZy (CounterStrikeSharp) & PugSharp match configuration JSON.
 * Compatible with CS2 dedicated servers running MatchZy.
 */
export function buildMatchZyConfig(room) {
  if (!room) return null;
  const { labelA, labelB } = getTeamNames(room);
  const roomId = room.id || `MIX-${Date.now()}`;
  const matchFormat = room.matchFormat || 'MD1';
  const numMaps = matchFormat === 'MD5' ? 5 : matchFormat === 'MD3' ? 3 : 1;

  // Determine maps list
  let maplist = [];
  if (Array.isArray(room.drawnSeries) && room.drawnSeries.length > 0) {
    maplist = room.drawnSeries.map((s) => s.map?.file || s.file || 'de_mirage');
  } else if (room.finalMap?.file) {
    maplist = [room.finalMap.file];
  } else {
    maplist = ['de_mirage'];
  }

  // Ensure maplist matches numMaps
  while (maplist.length < numMaps) {
    maplist.push('de_mirage');
  }
  maplist = maplist.slice(0, numMaps);

  // Map sides (knife round by default in MatchZy)
  const mapSides = maplist.map(() => 'knife');

  // Build team players mapping (SteamID64 -> Nickname)
  const buildTeamPlayers = (players) => {
    const map = {};
    if (Array.isArray(players)) {
      players.forEach((p, idx) => {
        const id = p.steamId || `BOT_${idx + 1}`;
        map[id] = p.nick || `Jogador ${idx + 1}`;
      });
    }
    return map;
  };

  const team1Players = buildTeamPlayers(room.teamA);
  const team2Players = buildTeamPlayers(room.teamB);

  return {
    matchid: roomId,
    num_maps: numMaps,
    maplist,
    map_sides: mapSides,
    players_per_team: 5,
    min_players_to_ready: 10,
    team1: {
      name: labelA || 'Time A',
      tag: 'TIME_A',
      flag: 'BR',
      players: team1Players,
    },
    team2: {
      name: labelB || 'Time B',
      tag: 'TIME_B',
      flag: 'BR',
      players: team2Players,
    },
    cvars: {
      mp_overtime_enable: '1',
      mp_overtime_maxrounds: '6',
      mp_overtime_startmoney: '10000',
      mp_warmuptime: '300',
      sv_hibernate_when_empty: '0',
      tv_enable: '1',
      tv_record_match: '1',
    },
  };
}

/**
 * Generates copyable RCON commands to load MatchZy match configuration.
 */
export function getMatchZyRconCommands(roomId, host) {
  const serverHost = host || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const url = `${serverHost}/api/matchzy/config/${roomId}`;
  return {
    loadUrl: `matchzy_loadmatch_url "${url}"`,
    loadLocal: `matchzy_loadmatch "match.json"`,
    restartPractice: `exec gamemode_competitive; mp_restartgame 1`,
  };
}
