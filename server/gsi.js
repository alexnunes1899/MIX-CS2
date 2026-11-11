/**
 * Valve CS2 Game State Integration (GSI) Handler
 * Receives JSON HTTP POST updates directly from Counter-Strike 2
 * Updates room live score and match status in real time.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const roomGsiStates = new Map();
const playerHistoricalStats = new Map();

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

  // 1. Resolve raw stats from player.match_stats or payload.allplayers[player.steamid].match_stats
  let rawStats = player.match_stats || {};
  if (
    (!rawStats.kills && !rawStats.score) &&
    payload.allplayers &&
    player.steamid &&
    payload.allplayers[player.steamid]?.match_stats
  ) {
    rawStats = payload.allplayers[player.steamid].match_stats;
  }

  const pKey = player.steamid || player.name || cleanRoomId;
  const cached = playerHistoricalStats.get(pKey) || {
    kills: 0,
    deaths: 0,
    assists: 0,
    mvps: 0,
    score: 0,
    kd: 0,
  };

  const incomingKills = typeof rawStats?.kills === 'number' ? rawStats.kills : 0;
  const incomingDeaths = typeof rawStats?.deaths === 'number' ? rawStats.deaths : 0;
  const incomingAssists = typeof rawStats?.assists === 'number' ? rawStats.assists : 0;
  const incomingMvps = typeof rawStats?.mvps === 'number' ? rawStats.mvps : 0;
  const incomingScore = typeof rawStats?.score === 'number' ? rawStats.score : 0;

  // Reset cache if a brand new map starts in warmup
  if (phase === 'warmup' && roundNumber === 0) {
    playerHistoricalStats.delete(pKey);
  }

  // Preserve accumulated stats if incoming packet has zeroes during gameover/intermission or late in game
  let finalKills = incomingKills;
  let finalDeaths = incomingDeaths;
  let finalAssists = incomingAssists;
  let finalMvps = incomingMvps;
  let finalScore = incomingScore;

  if (
    incomingKills === 0 &&
    incomingDeaths === 0 &&
    cached.kills > 0 &&
    (phase === 'gameover' || phase === 'intermission' || roundNumber > 1 || scoreCT + scoreTR > 1)
  ) {
    finalKills = cached.kills;
    finalDeaths = cached.deaths;
    finalAssists = cached.assists;
    finalMvps = cached.mvps;
    finalScore = cached.score;
  } else if (incomingKills > 0 || incomingDeaths > 0 || incomingScore > 0) {
    finalKills = Math.max(incomingKills, cached.kills);
    finalDeaths = Math.max(incomingDeaths, cached.deaths);
    finalAssists = Math.max(incomingAssists, cached.assists);
    finalMvps = Math.max(incomingMvps, cached.mvps);
    finalScore = Math.max(incomingScore, cached.score);
    playerHistoricalStats.set(pKey, {
      kills: finalKills,
      deaths: finalDeaths,
      assists: finalAssists,
      mvps: finalMvps,
      score: finalScore,
      kd: finalDeaths > 0 ? Number((finalKills / finalDeaths).toFixed(2)) : Number(finalKills.toFixed(2)),
    });
  }

  const finalKd = finalDeaths > 0 ? Number((finalKills / finalDeaths).toFixed(2)) : Number(finalKills.toFixed(2));

  // Parse all players match statistics (Kills, Deaths, Assists, MVPs, Score, K/D, Health, Money, Weapons)
  const allPlayersStats = [];
  const teamCT = [];
  const teamTR = [];

  if (payload.allplayers && typeof payload.allplayers === 'object') {
    Object.entries(payload.allplayers).forEach(([steamId, pData]) => {
      if (!pData || typeof pData !== 'object') return;
      const stats = pData.match_stats || {};
      const pState = pData.state || {};
      const kills = typeof stats.kills === 'number' ? stats.kills : 0;
      const deaths = typeof stats.deaths === 'number' ? stats.deaths : 0;
      const assists = typeof stats.assists === 'number' ? stats.assists : 0;
      const mvps = typeof stats.mvps === 'number' ? stats.mvps : 0;
      const score = typeof stats.score === 'number' ? stats.score : 0;
      const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));
      const health = typeof pState.health === 'number' ? pState.health : 100;
      const armor = typeof pState.armor === 'number' ? pState.armor : 0;
      const helmet = Boolean(pState.helmet);
      const money = typeof pState.money === 'number' ? pState.money : 0;
      const equipValue = typeof pState.equip_value === 'number' ? pState.equip_value : 0;
      const isAlive = health > 0;
      const team = pData.team === 'CT' ? 'CT' : pData.team === 'T' ? 'TR' : (pData.team || 'Indefinido');

      const weapons = [];
      let activeWeapon = null;
      if (pData.weapons && typeof pData.weapons === 'object') {
        Object.values(pData.weapons).forEach((w) => {
          if (!w || !w.name) return;
          const clean = w.name.replace(/^weapon_/, '').replace('_silencer', '-S').toUpperCase();
          weapons.push(clean);
          if (w.state === 'active') activeWeapon = clean;
        });
      }

      const pObj = {
        steamId,
        name: pData.name || 'Jogador',
        team,
        health,
        isAlive,
        armor,
        helmet,
        money,
        equipValue,
        kills,
        deaths,
        assists,
        mvps,
        score,
        kd,
        activeWeapon: activeWeapon || weapons[0] || 'Faca',
        weapons,
      };

      allPlayersStats.push(pObj);
      if (team === 'CT') teamCT.push(pObj);
      else if (team === 'TR') teamTR.push(pObj);
    });
  }

  // Include individual player in allPlayersStats if missing or update if higher stats known
  const playerInAll = allPlayersStats.find(
    (p) => (player.steamid && p.steamId === player.steamid) || (player.name && p.name === player.name)
  );
  if (!playerInAll && (player.name || player.steamid)) {
    const pState = player.state || {};
    const health = typeof pState.health === 'number' ? pState.health : 100;
    const armor = typeof pState.armor === 'number' ? pState.armor : 0;
    const helmet = Boolean(pState.helmet);
    const money = typeof pState.money === 'number' ? pState.money : 0;
    const equipValue = typeof pState.equip_value === 'number' ? pState.equip_value : 0;
    const isAlive = health > 0;
    const team = player.team === 'CT' ? 'CT' : 'TR';

    const pObj = {
      steamId: player.steamid || 'local_player',
      name: player.name || 'Jogador',
      team,
      health,
      isAlive,
      armor,
      helmet,
      money,
      equipValue,
      kills: finalKills,
      deaths: finalDeaths,
      assists: finalAssists,
      mvps: finalMvps,
      score: finalScore,
      kd: finalKd,
      activeWeapon: 'Faca',
      weapons: [],
    };
    allPlayersStats.push(pObj);
    if (team === 'CT') teamCT.push(pObj);
    else teamTR.push(pObj);
  } else if (playerInAll && playerInAll.kills === 0 && finalKills > 0) {
    playerInAll.kills = finalKills;
    playerInAll.deaths = finalDeaths;
    playerInAll.assists = finalAssists;
    playerInAll.mvps = finalMvps;
    playerInAll.score = finalScore;
    playerInAll.kd = finalKd;
  }

  // Sort players by score desc, then kills desc
  allPlayersStats.sort((a, b) => b.score - a.score || b.kills - a.kills);

  const topFragger = allPlayersStats.length > 0 ? allPlayersStats[0] : null;
  const matchMvp = allPlayersStats.length > 0
    ? [...allPlayersStats].sort((a, b) => (b.mvps * 10 + b.score) - (a.mvps * 10 + a.score))[0]
    : null;

  // Parse detailed individual player live telemetry (health, armor, weapons, ammo, money)
  let individualPlayer = null;
  if (player && (player.name || player.steamid)) {
    const pState = player.state || {};

    const weaponsList = [];
    let activeWeapon = null;
    let primaryWeapon = null;
    let secondaryWeapon = null;
    const grenades = [];

    if (player.weapons && typeof player.weapons === 'object') {
      Object.values(player.weapons).forEach((w) => {
        if (!w || !w.name) return;
        const cleanName = w.name.replace(/^weapon_/, '').replace('_silencer', '-S').toUpperCase();
        const weaponObj = {
          raw: w.name,
          name: cleanName,
          type: w.type || 'weapon',
          state: w.state || 'holstered',
          ammoClip: typeof w.ammo_clip === 'number' ? w.ammo_clip : null,
          ammoReserve: typeof w.ammo_reserve === 'number' ? w.ammo_reserve : null,
        };
        weaponsList.push(weaponObj);
        if (w.state === 'active') activeWeapon = weaponObj;
        if (
          ['rifle', 'sniperrifle', 'submachinegun', 'shotgun', 'machinegun'].includes((w.type || '').toLowerCase()) ||
          ['AK47', 'M4A1-S', 'M4A4', 'AWP', 'GALILAR', 'FAMAS', 'SG556', 'AUG', 'SSG08', 'MP9', 'MAC10'].includes(cleanName)
        ) {
          primaryWeapon = weaponObj;
        } else if (
          (w.type || '').toLowerCase() === 'pistol' ||
          ['DEAGLE', 'USP-S', 'GLOCK', 'P250', 'FIVESEVEN', 'TEC9', 'CZ75A'].includes(cleanName)
        ) {
          secondaryWeapon = weaponObj;
        } else if ((w.type || '').toLowerCase() === 'grenade') {
          grenades.push(cleanName);
        }
      });
    }

    const health = typeof pState.health === 'number' ? pState.health : 100;
    const armor = typeof pState.armor === 'number' ? pState.armor : 0;

    individualPlayer = {
      name: player.name || 'Jogador',
      steamId: player.steamid || '',
      team: player.team === 'CT' ? 'CT' : player.team === 'T' ? 'TR' : (player.team || 'Indefinido'),
      activity: player.activity || 'playing',
      health,
      isAlive: health > 0,
      armor,
      hasHelmet: Boolean(pState.helmet),
      flashed: typeof pState.flashed === 'number' ? pState.flashed : 0,
      isBurning: Boolean(pState.burning && pState.burning > 0),
      money: typeof pState.money === 'number' ? pState.money : 0,
      equipValue: typeof pState.equip_value === 'number' ? pState.equip_value : 0,
      roundKills: typeof pState.round_kills === 'number' ? pState.round_kills : 0,
      roundKillHs: typeof pState.round_killhs === 'number' ? pState.round_killhs : 0,
      kills: finalKills,
      deaths: finalDeaths,
      assists: finalAssists,
      mvps: finalMvps,
      score: finalScore,
      kd: finalKd,
      weapons: weaponsList,
      activeWeapon: activeWeapon || primaryWeapon || secondaryWeapon || { name: 'Faca', ammoClip: null },
      primaryWeapon,
      secondaryWeapon,
      grenades,
    };
  }

  const now = Date.now();
  const totalMoneyCT = teamCT.reduce((acc, p) => acc + (p.money || 0), 0);
  const totalMoneyTR = teamTR.reduce((acc, p) => acc + (p.money || 0), 0);
  const aliveCountCT = teamCT.filter((p) => p.isAlive).length;
  const aliveCountTR = teamTR.filter((p) => p.isAlive).length;

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
    rawPlayer: player?.name ? { name: player.name, team: player.team, steamId: player.steamid, matchStats: rawStats } : null,
    player: individualPlayer,
    allPlayersStats,
    teamCT,
    teamTR,
    totalMoneyCT,
    totalMoneyTR,
    aliveCountCT,
    aliveCountTR,
    topFragger,
    matchMvp,
    isGameOver: phase === 'gameover' || (scoreCT >= 13 && scoreCT - scoreTR >= 2) || (scoreTR >= 13 && scoreTR - scoreCT >= 2),
  };

  roomGsiStates.set(cleanRoomId, liveState);
  return liveState;
}

export function setGsiState(roomId, liveState) {
  if (!roomId || !liveState) return;
  const clean = roomId.trim().toUpperCase();
  roomGsiStates.set(clean, {
    ...liveState,
    lastUpdate: liveState.lastUpdate || Date.now(),
  });
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
    "timeout" "3.0"
    "buffer"  "0.05"
    "throttle" "0.1"
    "heartbeat" "2.0"
    "data"
    {
        "provider"               "1"
        "map"                    "1"
        "round"                  "1"
        "player_id"              "1"
        "allplayers_id"          "1"
        "player_state"           "1"
        "player_weapons"         "1"
        "player_match_stats"     "1"
        "allplayers_state"       "1"
        "allplayers_weapons"     "1"
        "allplayers_match_stats" "1"
    }
    "auth"
    {
        "token" "${cleanRoomId}"
    }
}
`;
}

/**
 * Finds all CS2 game\csgo\cfg directories on the host PC (Steam Registry, libraryfolders.vdf, common drives)
 */
export function findCs2CfgDirs() {
  const dirs = new Set();
  try {
    const regOutput = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Valve\\Steam\' -ErrorAction SilentlyContinue).SteamPath"',
      { encoding: 'utf8', timeout: 3000 }
    ).trim();
    if (regOutput) {
      const cleanSteam = regOutput.replace(/\//g, '\\');
      const p1 = path.join(cleanSteam, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg');
      if (fs.existsSync(p1)) dirs.add(p1);

      const vdf = path.join(cleanSteam, 'steamapps', 'libraryfolders.vdf');
      if (fs.existsSync(vdf)) {
        const vdfContent = fs.readFileSync(vdf, 'utf8');
        const matches = [...vdfContent.matchAll(/"path"\s+"([^"]+)"/g)];
        for (const m of matches) {
          const libPath = m[1].replace(/\\\\/g, '\\').replace(/\//g, '\\');
          const p2 = path.join(libPath, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg');
          if (fs.existsSync(p2)) dirs.add(p2);
        }
      }
    }
  } catch (e) {
    // Silently continue to standard drive checks
  }

  const drives = ['C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const commonSubdirs = [
    ['Program Files (x86)', 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'],
    ['Program Files', 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'],
    ['Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'],
    ['SteamLibrary', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'],
    ['Jogos', 'SteamLibrary', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'],
    ['Games', 'SteamLibrary', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg'],
  ];

  for (const drive of drives) {
    for (const sub of commonSubdirs) {
      const full = path.join(`${drive}:\\`, ...sub);
      if (fs.existsSync(full)) dirs.add(full);
    }
  }

  return Array.from(dirs);
}

/**
 * Installs GSI directly to CS2 on the host PC in 1 click without downloading files
 */
export function installGsiLocally(serverBaseUrl = 'http://127.0.0.1:3000', roomId = 'MIX-PRO') {
  let dirs = findCs2CfgDirs();
  if (dirs.length === 0) {
    const defaultDir = path.join(
      'C:\\Program Files (x86)',
      'Steam',
      'steamapps',
      'common',
      'Counter-Strike Global Offensive',
      'game',
      'csgo',
      'cfg'
    );
    try {
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }
      dirs = [defaultDir];
    } catch (e) {
      return {
        success: false,
        installed: false,
        error: 'Não foi possível encontrar automaticamente a pasta do CS2. Verifique se a Steam está instalada.',
      };
    }
  }

  const cloudCfg = generateGsiConfig(process.env.RENDER_EXTERNAL_URL || 'https://mix-cs2.onrender.com', roomId);
  const localCfg = generateGsiConfig('http://127.0.0.1:3000', roomId);

  const written = [];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const mainPath = path.join(dir, 'gamestate_integration_cs2mixhub.cfg');
      const localPath = path.join(dir, 'gamestate_integration_cs2mixhub_local.cfg');
      fs.writeFileSync(mainPath, cloudCfg, 'utf8');
      fs.writeFileSync(localPath, localCfg, 'utf8');
      written.push(mainPath);
    } catch (err) {
      console.warn('[GSI DIRECT INSTALL WARN]:', err.message);
    }
  }

  return {
    success: written.length > 0,
    installed: written.length > 0,
    paths: written,
    primaryPath: written[0] || null,
    message: 'GSI instalado com sucesso diretamente no Counter-Strike 2! O CS2 já está pronto para monitorar.',
  };
}

/**
 * Checks if GSI CFG is installed in the CS2 folder on the host PC
 */
export function checkGsiInstalled() {
  const dirs = findCs2CfgDirs();
  for (const dir of dirs) {
    const cfgPath = path.join(dir, 'gamestate_integration_cs2mixhub.cfg');
    if (fs.existsSync(cfgPath)) {
      try {
        const content = fs.readFileSync(cfgPath, 'utf8');
        return {
          installed: true,
          path: cfgPath,
          hasMatchStats: content.includes('player_match_stats'),
          active: true,
        };
      } catch (e) {
        return { installed: true, path: cfgPath, hasMatchStats: false, active: true };
      }
    }
  }
  return { installed: false, path: null, hasMatchStats: false, active: false };
}

/**
 * Generates an automated 1-click Windows Batch installer (.bat)
 * Automatically detects Steam library folders across all drives and installs GSI CFG.
 */
export function generateGsiBatchInstaller(serverBaseUrl, roomId) {
  const cfgContent = generateGsiConfig(serverBaseUrl, roomId);
  const b64 = Buffer.from(cfgContent, 'utf8').toString('base64');

  return `@echo off
chcp 65001 >nul
title CS2 Mix Hub - Instalador do Monitorar Partida
color 0A
cls
echo =======================================================================
echo          CS2 MIX HUB - INSTALADOR DE MONITORAMENTO DE PARTIDA
echo =======================================================================
echo.
echo [1/2] Localizando a pasta do Counter-Strike 2 no seu computador...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $b64 = '${b64}'; $cfg = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)); function Get-Cs2Paths { $paths = [System.Collections.Generic.List[string]]::new(); $steamReg = (Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath; if ($steamReg) { $steamReg = $steamReg -replace '/', '\\\\'; $p1 = Join-Path $steamReg 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'; if (Test-Path $p1) { $paths.Add($p1) }; $vdf = Join-Path $steamReg 'steamapps\\libraryfolders.vdf'; if (Test-Path $vdf) { foreach ($line in (Get-Content $vdf)) { if ($line -match '\\\"path\\\"\\s+\\\"([^\\\"]+)\\\"') { $lib = $matches[1] -replace '\\\\\\\\', '\\\\' -replace '/', '\\\\'; $p2 = Join-Path $lib 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'; if ((Test-Path $p2) -and (-not $paths.Contains($p2))) { $paths.Add($p2) } } } } }; foreach ($d in 'C','D','E','F','G','H','I') { $chk1 = ($d + ':\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk1) -and (-not $paths.Contains($chk1))) { $paths.Add($chk1) }; $chk2 = ($d + ':\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk2) -and (-not $paths.Contains($chk2))) { $paths.Add($chk2) }; $chk3 = ($d + ':\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk3) -and (-not $paths.Contains($chk3))) { $paths.Add($chk3) }; $chk4 = ($d + ':\\Jogos\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk4) -and (-not $paths.Contains($chk4))) { $paths.Add($chk4) } }; return $paths }; $targetDirs = Get-Cs2Paths; if ($targetDirs.Count -eq 0) { Write-Host ' [X] Nao foi possivel encontrar a pasta do CS2 automaticamente.' -ForegroundColor Yellow; Write-Host '     Verifique se o Counter-Strike 2 esta instalado via Steam neste PC.' -ForegroundColor Yellow; exit 1 }; foreach ($dir in $targetDirs) { if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; $file = Join-Path $dir 'gamestate_integration_cs2mixhub.cfg'; try { [System.IO.File]::WriteAllText($file, $cfg, [System.Text.Encoding]::UTF8); Write-Host (\\\" [OK] Instalado com sucesso em: \\\" + $file) -ForegroundColor Green } catch { Write-Host (\\\" [!] Permissao negada em: \\\" + $file) -ForegroundColor Yellow; Write-Host '     Dica: Clique com o botao direito no arquivo .bat e escolha Executar como Administrador.' -ForegroundColor Cyan } }; Write-Host ''; Write-Host ' =======================================================================' -ForegroundColor Green; Write-Host '  TUDO PRONTO! O MONITORAMENTO FOI INSTALADO NO SEU CS2 COM SUCESSO!   ' -ForegroundColor Green; Write-Host ' =======================================================================' -ForegroundColor Green; Write-Host '  Agora e so abrir o Counter-Strike 2 e jogar normalmente!' -ForegroundColor Cyan; Write-Host '  Seus amigos ja podem acompanhar seu placar, vida e armas ao vivo!' -ForegroundColor Cyan; Write-Host ''; exit 0"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Nao foi possivel encontrar automaticamente a pasta do CS2 ou faltou permissao.
    echo     Dica: Clique com o botao direito no arquivo .bat e escolha "Executar como Administrador".
    echo     Ou copie o arquivo gamestate_integration_cs2mixhub.cfg para a pasta \game\csgo\cfg\ do CS2.
    echo.
)

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
`;
}

/**
 * Generates raw PowerShell script for 1-click execution (irm ... | iex)
 */
export function generateGsiPowerShellInstaller(serverBaseUrl, roomId) {
  const cfgContent = generateGsiConfig(serverBaseUrl, roomId);
  const b64 = Buffer.from(cfgContent, 'utf8').toString('base64');

  return `$ErrorActionPreference = 'SilentlyContinue';
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$b64 = '${b64}';
$cfg = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64));

function Get-Cs2Paths {
    $paths = [System.Collections.Generic.List[string]]::new();
    $steamReg = (Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath;
    if ($steamReg) {
        $steamReg = $steamReg -replace '/', '\\';
        $p1 = Join-Path $steamReg 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg';
        if (Test-Path $p1) { $paths.Add($p1) };
        $vdf = Join-Path $steamReg 'steamapps\\libraryfolders.vdf';
        if (Test-Path $vdf) {
            foreach ($line in (Get-Content $vdf)) {
                if ($line -match '"path"\s+"([^"]+)"') {
                    $lib = $matches[1] -replace '\\\\', '\\' -replace '/', '\\';
                    $p2 = Join-Path $lib 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg';
                    if ((Test-Path $p2) -and (-not $paths.Contains($p2))) { $paths.Add($p2) }
                }
            }
        }
    }
    foreach ($d in 'C','D','E','F','G','H','I') {
        $chk1 = ($d + ':\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg');
        if ((Test-Path $chk1) -and (-not $paths.Contains($chk1))) { $paths.Add($chk1) };
        $chk2 = ($d + ':\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg');
        if ((Test-Path $chk2) -and (-not $paths.Contains($chk2))) { $paths.Add($chk2) };
    }
    return $paths
};

$targetDirs = Get-Cs2Paths;
if ($targetDirs.Count -eq 0) {
    Write-Host '❌ Não foi possível encontrar a pasta do CS2 automaticamente.' -ForegroundColor Yellow;
    Write-Host '   Verifique se o Counter-Strike 2 está instalado via Steam neste computador.' -ForegroundColor Yellow;
    return;
}

foreach ($dir in $targetDirs) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null };
    $file = Join-Path $dir 'gamestate_integration_cs2mixhub.cfg';
    [System.IO.File]::WriteAllText($file, $cfg, [System.Text.Encoding]::UTF8);
    Write-Host "✅ Instalado com sucesso em: $file" -ForegroundColor Green;
}

Write-Host '';
Write-Host '========================================================================' -ForegroundColor Green;
Write-Host ' TUDO PRONTO! O MONITORAMENTO FOI INSTALADO NO SEU CS2 COM SUCESSO!    ' -ForegroundColor Green;
Write-Host '========================================================================' -ForegroundColor Green;
Write-Host ' Agora é só abrir o Counter-Strike 2 e jogar normalmente!' -ForegroundColor Cyan;
Write-Host ' Seus amigos já podem acompanhar seu placar, vida e armas ao vivo!' -ForegroundColor Cyan;
Write-Host '';
`;
}
