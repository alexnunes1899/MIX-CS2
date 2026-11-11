<# :
@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   APLICANDO MELHORIAS NO CS2 MIX HUB...
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([System.IO.File]::ReadAllText('%~f0'))"
echo.
pause
exit /b
#>

$ErrorActionPreference = "Stop"
Write-Host "[1/5] Atualizando .gitignore..." -ForegroundColor Cyan
$gi = Get-Content -Path ".gitignore" -Raw -ErrorAction SilentlyContinue
if ($gi -notmatch "economyStore\.json") {
  Add-Content -Path ".gitignore" -Value "`r`nserver/data/*.db`r`nserver/data/economyStore.json`r`nserver/data/linkedClipsStore.json`r`nserver/data/bagreVotesStore.json"
}

Write-Host "[2/5] Criando server/db.js (Economia MixCoins + Persistencia Atomica)..." -ForegroundColor Cyan
$dbCode = @'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const ECONOMY_FILE = path.join(DATA_DIR, 'economyStore.json');
const CLIPS_LINKED_FILE = path.join(DATA_DIR, 'linkedClipsStore.json');
const BAGRE_VOTES_FILE = path.join(DATA_DIR, 'bagreVotesStore.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJsonAtomic(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {}
  return defaultVal;
}

function writeJsonAtomic(filePath, data) {
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (e) {}
}

const economyMemory = readJsonAtomic(ECONOMY_FILE, {});
const linkedClipsMemory = readJsonAtomic(CLIPS_LINKED_FILE, []);
const bagreVotesMemory = readJsonAtomic(BAGRE_VOTES_FILE, {});

export const economyDb = {
  getPlayer(steamId, name = 'Jogador') {
    const key = String(steamId || name || 'anon').trim();
    if (!economyMemory[key]) {
      economyMemory[key] = {
        steamId: key,
        name: name || 'Jogador',
        mixCoins: 100,
        freeKeys: 1,
        featuredSkin: null,
        updatedAt: new Date().toISOString(),
      };
      writeJsonAtomic(ECONOMY_FILE, economyMemory);
    }
    return economyMemory[key];
  },
  rewardPlayer(steamId, name, coinsDelta = 0, keysDelta = 0) {
    const player = this.getPlayer(steamId, name);
    player.mixCoins = Math.max(0, (Number(player.mixCoins) || 0) + Number(coinsDelta));
    player.freeKeys = Math.max(0, (Number(player.freeKeys) || 0) + Number(keysDelta));
    if (name) player.name = name;
    player.updatedAt = new Date().toISOString();
    writeJsonAtomic(ECONOMY_FILE, economyMemory);
    return player;
  },
  setFeaturedSkin(steamId, skinObj) {
    const player = this.getPlayer(steamId);
    player.featuredSkin = skinObj || null;
    player.updatedAt = new Date().toISOString();
    writeJsonAtomic(ECONOMY_FILE, economyMemory);
    return player;
  },
  recordBagreVote(matchId, voterSteamId, voterName, targetSteamId, targetName) {
    const mKey = String(matchId || 'latest');
    if (!bagreVotesMemory[mKey]) bagreVotesMemory[mKey] = {};
    if (bagreVotesMemory[mKey][voterSteamId]) return { alreadyVoted: true };
    bagreVotesMemory[mKey][voterSteamId] = { targetSteamId, targetName, votedAt: new Date().toISOString() };
    writeJsonAtomic(BAGRE_VOTES_FILE, bagreVotesMemory);
    const updated = this.rewardPlayer(voterSteamId, voterName, 10, 0);
    return { alreadyVoted: false, reward: 10, economy: updated };
  },
  addLinkedClip({ title, url, authorName, authorSteamId, matchId, map }) {
    const clip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title || 'Jogada da Noite no Mix',
      url,
      authorName: authorName || 'Jogador',
      authorSteamId: authorSteamId || '',
      matchId: String(matchId || ''),
      map: map || 'Mirage',
      createdAt: new Date().toISOString(),
    };
    linkedClipsMemory.unshift(clip);
    writeJsonAtomic(CLIPS_LINKED_FILE, linkedClipsMemory.slice(0, 500));
    if (authorSteamId) this.rewardPlayer(authorSteamId, authorName, 15, 0);
    return clip;
  },
  getClipsByMatch(matchId) {
    if (!matchId) return linkedClipsMemory.slice(0, 50);
    return linkedClipsMemory.filter((c) => String(c.matchId) === String(matchId));
  },
};
'@
[System.IO.File]::WriteAllText("$PWD\server\db.js", $dbCode, [System.Text.Encoding]::UTF8)

Write-Host "[3/5] Criando server/matchAutomation.js (RCON Pos-Veto + Webhook MatchZy)..." -ForegroundColor Cyan
$autoCode = @'
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
'@
[System.IO.File]::WriteAllText("$PWD\server\matchAutomation.js", $autoCode, [System.Text.Encoding]::UTF8)

Write-Host "[4/5] Conectando rotas no server/index.js..." -ForegroundColor Cyan
$srv = [System.IO.File]::ReadAllText("$PWD\server\index.js", [System.Text.Encoding]::UTF8)
if ($srv -notmatch "matchAutomation\.js") {
  $srv = "import { registerMatchAutomationRoutes } from './matchAutomation.js';`r`n" + $srv
  $srv = $srv.Replace("app.use((req, res) => {", "registerMatchAutomationRoutes(app, { io, discordBotManager });`r`n`r`napp.use((req, res) => {")
  [System.IO.File]::WriteAllText("$PWD\server\index.js", $srv, [System.Text.Encoding]::UTF8)
}

Write-Host "[5/5] Compilando projeto (npm run build)..." -ForegroundColor Cyan
cmd /c "npm run build"

Write-Host "`nSUCESSO TOTAL! Todas as melhorias foram instaladas!" -ForegroundColor Green
Write-Host "Agora voce ja pode clicar no seu push-to-github.bat!" -ForegroundColor Yellow