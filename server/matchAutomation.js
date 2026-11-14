import { executeRconCommand } from './rcon.js';
import { recordMatchHistoryEntry, computeMatchPerformers } from './matchHistory.js';
import { recordMatch, getLeaderboard } from './leaderboard.js';
import { isValidMapName, isValidServerAddress } from './utils/security.js';

export function registerMatchAutomationRoutes(app, { io }) {
  app.post('/api/automation/veto-complete', async (req, res) => {
    try {
      const { mapName, serverIp, rconPassword } = req.body || {};
      const rawMap = String(mapName || 'mirage').trim().toLowerCase().replace(/^de_/, '');
      const cleanMap = `de_${rawMap}`;
      if (!isValidMapName(cleanMap)) {
        return res.status(400).json({ error: 'Nome de mapa inválido.' });
      }
      const cleanIp = serverIp ? String(serverIp).trim() : '';
      if (cleanIp && !isValidServerAddress(cleanIp)) {
        return res.status(400).json({ error: 'Endereço de servidor inválido.' });
      }
      if (cleanIp && rconPassword) {
        const [host, portStr] = cleanIp.split(':');
        const port = Number(portStr) || 27015;
        await executeRconCommand({ host, port, password: String(rconPassword), command: `changelevel ${cleanMap}` });
      }
      if (io) io.emit('mix:server_ready', { map: cleanMap, connectString: cleanIp ? `connect ${cleanIp}` : '' });
      return res.json({ success: true, map: cleanMap });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/webhooks/matchzy', async (req, res) => {
    try {
      const payload = req.body || {};
      if (payload.event && payload.event !== 'map_result' && payload.event !== 'series_end') {
        return res.json({ received: true, ignored: true });
      }
      const matchId = String(payload.matchid || `MIX-${Date.now().toString(36).toUpperCase()}`);
      const mapName = payload.map_name || 'Mirage';
      const team1 = payload.team1 || { name: 'Time A', score: 0, players: [] };
      const team2 = payload.team2 || { name: 'Time B', score: 0, players: [] };
      const scoreA = Number(team1.score || 0);
      const scoreB = Number(team2.score || 0);
      const teamAWon = scoreA >= scoreB;

      const mapPlayers = (list, won) =>
        (list || []).map((p, idx) => ({
          id: p.steamid || p.steamId || `mz-${idx}-${Date.now()}`,
          steamId: p.steamid || p.steamId || '',
          nick: p.name || p.nick || 'Jogador',
          kills: Number(p.stats?.kills || p.kills || 0),
          deaths: Number(p.stats?.deaths || p.deaths || 0),
          assists: Number(p.stats?.assists || p.assists || 0),
          mvps: Number(p.stats?.mvps || p.mvps || 0),
          score: Number(p.stats?.score || p.score || 0),
          won,
        }));

      const playersA = mapPlayers(team1.players, teamAWon);
      const playersB = mapPlayers(team2.players, !teamAWon);
      const winnerPlayers = teamAWon ? playersA : playersB;
      const loserPlayers = teamAWon ? playersB : playersA;
      const scoreWinner = Math.max(scoreA, scoreB);
      const scoreLoser = Math.min(scoreA, scoreB);
      const score = `${scoreWinner}-${scoreLoser}`;

      const matchRecord = {
        id: matchId,
        source: 'web',
        platform: 'MatchZy Auto',
        map: mapName,
        winner: teamAWon ? (team1.name || 'Time A') : (team2.name || 'Time B'),
        loser: teamAWon ? (team2.name || 'Time B') : (team1.name || 'Time A'),
        score,
        scoreWinner,
        scoreLoser,
        winnerPlayers,
        loserPlayers,
      };

      const { mvp, bagre, evaluatedPlayers } = computeMatchPerformers(matchRecord);
      matchRecord.mvp = mvp;
      matchRecord.mvpId = mvp?.id || null;
      matchRecord.mvpNick = mvp?.nick || '';
      matchRecord.bagre = bagre;
      matchRecord.bagreId = bagre?.id || null;
      matchRecord.bagreNick = bagre?.nick || '';
      matchRecord.evaluatedPlayers = evaluatedPlayers;

      recordMatchHistoryEntry(matchRecord);

      recordMatch({
        winners: winnerPlayers,
        losers: loserPlayers,
        map: mapName,
        scoreWinners: scoreWinner,
        scoreLosers: scoreLoser,
      });

      if (io) {
        io.emit('match_history_updated', matchRecord);
        io.emit('leaderboard_updated', getLeaderboard());
        io.emit('mix:match_finished', { matchId, map: mapName, scoreA, scoreB, mvp, bagre });
      }
      return res.json({ success: true, matchId, mvp: mvp?.nick || null, bagre: bagre?.nick || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}