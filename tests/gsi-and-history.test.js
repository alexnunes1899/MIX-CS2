import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGsiPayload, getGsiState, clearRoomGsiState } from '../server/gsi.js';
import {
  normalizeMapName,
  determineMatchWinner,
  computeMatchMvp,
} from '../server/matchHistory.js';

test('handleGsiPayload isolates state across rooms and clears cleanly', () => {
  clearRoomGsiState('ROOM_A');
  clearRoomGsiState('ROOM_B');

  try {
    handleGsiPayload('ROOM_A', {
      map: { name: 'de_mirage', phase: 'live', round: 5, team_ct: { score: 3 }, team_t: { score: 2 } },
      player: { steamid: '76561198000000001', name: 'PlayerA', team: 'CT', match_stats: { kills: 9, deaths: 4, assists: 2, mvps: 1, score: 20 } },
    });

    handleGsiPayload('ROOM_B', {
      map: { name: 'de_nuke', phase: 'live', round: 10, team_ct: { score: 6 }, team_t: { score: 4 } },
      player: { steamid: '76561198000000002', name: 'PlayerB', team: 'T', match_stats: { kills: 15, deaths: 6, assists: 1, mvps: 2, score: 35 } },
    });

    const stateA = getGsiState('ROOM_A');
    const stateB = getGsiState('ROOM_B');

    assert.equal(stateA.mapName, 'de_mirage');
    assert.equal(stateA.scoreCT, 3);
    assert.equal(stateA.allPlayersStats.length, 1);
    assert.equal(stateA.allPlayersStats[0].name, 'PlayerA');

    assert.equal(stateB.mapName, 'de_nuke');
    assert.equal(stateB.scoreCT, 6);
    assert.equal(stateB.allPlayersStats.length, 1);
    assert.equal(stateB.allPlayersStats[0].name, 'PlayerB');

    clearRoomGsiState('ROOM_A');
    assert.equal(getGsiState('ROOM_A').connected, false);
    assert.equal(getGsiState('ROOM_B').connected, true);
  } finally {
    clearRoomGsiState('ROOM_A');
    clearRoomGsiState('ROOM_B');
  }
});

test('normalizeMapName normalizes CS2 map names', () => {
  assert.equal(normalizeMapName('de_dust2'), 'Dust II');
  assert.equal(normalizeMapName('de_mirage'), 'Mirage');
  assert.equal(normalizeMapName({ file: 'de_inferno' }), 'Inferno');
});

test('determineMatchWinner handles MR12 half-time swap and overtime correctly', () => {
  // Team A started CT; after 12 rounds (e.g. 13-8 = 21 rounds total), Team A is now TR.
  // Score CT 8, TR 13 -> winning side TR -> Team A wins.
  const regResult = determineMatchWinner(
    { teamA: { side: 'CT', players: [] } },
    { scoreCT: 8, scoreTR: 13 }
  );
  assert.equal(regResult.winnerLetter, 'A');
  assert.equal(regResult.method, 'halftime_math_calculation');

  // Overtime (28 rounds: 16-12). Team A started CT: rounds 25-27 is CT, round 28 is TR.
  // Total = 28 -> otRounds = 4 (>3) -> Team A current side is TR. If CT=16, TR=12 -> Team B wins.
  const otResult = determineMatchWinner(
    { teamA: { side: 'CT', players: [] } },
    { scoreCT: 16, scoreTR: 12 }
  );
  assert.equal(otResult.winnerLetter, 'B');
  assert.equal(otResult.teamACurrentSide, 'TR');

  // Player-side inspection overrides math when GSI player affiliation is present
  const playerSideResult = determineMatchWinner(
    {
      teamA: {
        side: 'CT',
        players: [{ nick: 'Fallen', steamId: '1001' }],
      },
    },
    {
      scoreCT: 13,
      scoreTR: 9,
      allPlayersStats: [{ steamId: '1001', name: 'Fallen', team: 'CT', kills: 20, deaths: 10 }],
    }
  );
  assert.equal(playerSideResult.winnerLetter, 'A');
  assert.equal(playerSideResult.method, 'player_side_inspection');
});

test('computeMatchMvp selects top performer from GSI stats', () => {
  const mvp = computeMatchMvp(
    {
      winnerPlayers: [
        { id: '1', nick: 'Star', steamId: '111' },
        { id: '2', nick: 'Support', steamId: '222' },
      ],
      loserPlayers: [
        { id: '3', nick: 'Opponent', steamId: '333' },
      ],
      scoreWinner: 13,
      scoreLoser: 9,
    },
    {
      scoreCT: 13,
      scoreTR: 9,
      allPlayersStats: [
        { steamId: '111', name: 'Star', team: 'CT', kills: 28, deaths: 12, assists: 5, mvps: 5, score: 65 },
        { steamId: '222', name: 'Support', team: 'CT', kills: 14, deaths: 15, assists: 8, mvps: 1, score: 34 },
        { steamId: '333', name: 'Opponent', team: 'TR', kills: 18, deaths: 18, assists: 2, mvps: 2, score: 40 },
      ],
    }
  );
  assert.ok(mvp);
  assert.equal(mvp.nick, 'Star');
});
