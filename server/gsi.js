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

  // Parse detailed individual player live telemetry (health, armor, weapons, ammo, money)
  let individualPlayer = null;
  if (player && (player.name || player.steamid)) {
    const pState = player.state || {};
    const stats = player.match_stats || {};
    const kills = typeof stats.kills === 'number' ? stats.kills : 0;
    const deaths = typeof stats.deaths === 'number' ? stats.deaths : 0;
    const assists = typeof stats.assists === 'number' ? stats.assists : 0;
    const mvps = typeof stats.mvps === 'number' ? stats.mvps : 0;
    const score = typeof stats.score === 'number' ? stats.score : 0;
    const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));

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
      kills,
      deaths,
      assists,
      mvps,
      score,
      kd,
      weapons: weaponsList,
      activeWeapon: activeWeapon || primaryWeapon || secondaryWeapon || { name: 'Faca', ammoClip: null },
      primaryWeapon,
      secondaryWeapon,
      grenades,
    };
  }

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
    player: individualPlayer,
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
        "provider"              "1"
        "map"                   "1"
        "round"                 "1"
        "player_id"             "1"
        "allplayers_id"         "1"
        "player_state"          "1"
        "player_weapons"        "1"
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

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $b64 = '${b64}'; $cfg = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)); function Get-Cs2Paths { $paths = [System.Collections.Generic.List[string]]::new(); $steamReg = (Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath; if ($steamReg) { $steamReg = $steamReg -replace '/', '\\\\'; $p1 = Join-Path $steamReg 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'; if (Test-Path $p1) { $paths.Add($p1) }; $vdf = Join-Path $steamReg 'steamapps\\libraryfolders.vdf'; if (Test-Path $vdf) { foreach ($line in (Get-Content $vdf)) { if ($line -match '\\\"path\\\"\\s+\\\"([^\\\"]+)\\\"') { $lib = $matches[1] -replace '\\\\\\\\', '\\\\' -replace '/', '\\\\'; $p2 = Join-Path $lib 'steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'; if ((Test-Path $p2) -and (-not $paths.Contains($p2))) { $paths.Add($p2) } } } } }; foreach ($d in 'C','D','E','F','G','H','I') { $chk1 = ($d + ':\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk1) -and (-not $paths.Contains($chk1))) { $paths.Add($chk1) }; $chk2 = ($d + ':\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk2) -and (-not $paths.Contains($chk2))) { $paths.Add($chk2) }; $chk3 = ($d + ':\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk3) -and (-not $paths.Contains($chk3))) { $paths.Add($chk3) }; $chk4 = ($d + ':\\Jogos\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg'); if ((Test-Path $chk4) -and (-not $paths.Contains($chk4))) { $paths.Add($chk4) } }; return $paths }; $targetDirs = Get-Cs2Paths; if ($targetDirs.Count -eq 0) { Write-Host ' [X] Nao foi possivel encontrar a pasta do CS2 automaticamente.' -ForegroundColor Yellow; Write-Host '     Verifique se o Counter-Strike 2 esta instalado via Steam neste PC.' -ForegroundColor Yellow; exit 1 }; foreach ($dir in $targetDirs) { if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; $file = Join-Path $dir 'gamestate_integration_cs2mixhub.cfg'; [System.IO.File]::WriteAllText($file, $cfg, [System.Text.Encoding]::UTF8); Write-Host (\\\" [OK] Instalado com sucesso em: \\\" + $file) -ForegroundColor Green }; Write-Host ''; Write-Host ' =======================================================================' -ForegroundColor Green; Write-Host '  TUDO PRONTO! O MONITORAMENTO FOI INSTALADO NO SEU CS2 COM SUCESSO!   ' -ForegroundColor Green; Write-Host ' =======================================================================' -ForegroundColor Green; Write-Host '  Agora e so abrir o Counter-Strike 2 e jogar normalmente!' -ForegroundColor Cyan; Write-Host '  Seus amigos ja podem acompanhar seu placar, vida e armas ao vivo!' -ForegroundColor Cyan; Write-Host ''; exit 0"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Nao foi possivel encontrar automaticamente a pasta do CS2.
    echo     Para instalar manualmente, copie o arquivo gamestate_integration_cs2mixhub.cfg
    echo     para a pasta: \\game\\csgo\\cfg\\ onde o seu Counter-Strike 2 esta instalado.
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
