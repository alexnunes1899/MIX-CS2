import { economyDb } from './db.js';
import { executeRconCommand } from './rcon.js';
import { recordMatchHistoryEntry } from './matchHistory.js';
import { recordMatch, getLeaderboard } from './leaderboard.js';

export function registerMatchAutomationRoutes(app, { io }) {
  app.post('/api/automation/veto-complete', async (req, res) => {
    try {
      const { mapName, serverIp, rconPassword } = req.body;
      const rawMap = String(mapName || 'mirage').toLowerCase().replace(/^de_/, '');
      const cleanMap = `de_${rawMap}`;
      if (serverIp && rconPassword) {
        const [host, portStr] = String(serverIp).split(':');
        const port = Number(portStr) || 27015;
        await executeRconCommand({ host, port, password: rconPassword, command: `changelevel ${cleanMap}` });
      }
      if (io) io.emit('mix:server_ready', { map: cleanMap, connectString: serverIp ? `connect ${serverIp}` : '' });
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
      const matchId = String(payload.matchid || `mix_${Date.now()}`);
      const mapName = payload.map_name || 'Mirage';
      const team1 = payload.team1 || { name: 'Time A', score: 0, players: [] };
      const team2 = payload.team2 || { name: 'Time B', score: 0, players: [] };
      const scoreA = Number(team1.score || 0);
      const scoreB = Number(team2.score || 0);
      const teamAWon = scoreA >= scoreB;

      const mapPlayers = (list, won) => (list || []).map((p) => ({
        steamId: p.steamid || p.steamId || '',
        nick: p.name || p.nick || 'Jogador',
        kills: Number(p.stats?.kills || p.kills || 0),
        deaths: Number(p.stats?.deaths || p.deaths || 0),
        damage: Number(p.stats?.damage || 0),
        won,
      }));

      const playersA = mapPlayers(team1.players, teamAWon);
      const playersB = mapPlayers(team2.players, !teamAWon);
      const allPlayers = [...playersA, ...playersB];

      let mvpPlayer = allPlayers[0] || null;
      for (const p of allPlayers) {
        if (mvpPlayer && p.kills > mvpPlayer.kills) mvpPlayer = p;
      }

      for (const p of allPlayers) {
        const isMvp = mvpPlayer && mvpPlayer.nick === p.nick;
        economyDb.rewardPlayer(p.steamId || p.nick, p.nick, 25 + (p.won ? 35 : 0) + (isMvp ? 25 : 0), p.won ? 1 : 0);
      }

      recordMatchHistoryEntry({
        id: matchId,
        map: mapName,
        scoreA,
        scoreB,
        teamAName: team1.name || 'Time A',
        teamBName: team2.name || 'Time B',
        mvpNick: mvpPlayer?.nick || '',
        source: 'MatchZy Auto',
      });

      recordMatch({
        winners: teamAWon ? playersA : playersB,
        losers: teamAWon ? playersB : playersA,
        map: mapName,
        scoreWinners: Math.max(scoreA, scoreB),
        scoreLosers: Math.min(scoreA, scoreB),
      });

      if (io) {
        io.emit('leaderboard_updated', getLeaderboard());
        io.emit('mix:match_finished', { matchId, map: mapName, scoreA, scoreB, mvp: mvpPlayer, openBagreVote: true });
      }
      return res.json({ success: true, matchId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/economy/:steamId', (req, res) => res.json(economyDb.getPlayer(req.params.steamId, req.query.name)));
  app.post('/api/economy/:steamId/featured-skin', (req, res) => res.json(economyDb.setFeaturedSkin(req.params.steamId, req.body?.skin)));
  app.post('/api/bagre/vote-reward', (req, res) => {
    const r = economyDb.recordBagreVote(req.body?.matchId, req.body?.voterSteamId, req.body?.voterName, req.body?.targetSteamId, req.body?.targetName);
    if (r.alreadyVoted) return res.status(400).json({ error: 'Ja votou nesta partida.' });
    res.json({ success: true, ...r });
  });
  app.post('/api/clips/linked', (req, res) => res.json({ success: true, clip: economyDb.addLinkedClip(req.body || {}) }));
  app.get('/api/clips/by-match/:matchId', (req, res) => res.json(economyDb.getClipsByMatch(req.params.matchId)));
}