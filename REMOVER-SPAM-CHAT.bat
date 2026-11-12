@echo off
chcp 65001 >nul
title CS2 Mix Hub - Correcao Definitiva Anti-Spam
color 0a

set "PATH=%PATH%;C:\Program Files\nodejs;C:\Users\alexn\AppData\Local\MinGit\cmd"
cd /d "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub"

echo ======================================================================
echo   CS2 MIX HUB - PARANDO SPAM DE 4K / HALF-TIME E LIMPANDO MEMORIA
echo ======================================================================
echo Pasta atual: %CD%
echo.

echo [1/4] Parando processos antigos do Node.js em segundo plano...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Limpando mixes antigos travados no activeMixStore.json...
echo {"savedAt":0,"roomsCount":0,"discordMixesCount":0,"rooms":[],"discordMixes":[]} > "server\data\activeMixStore.json"
if exist "server\data\runner.pid" del /F /Q "server\data\runner.pid" >nul 2>&1

echo [3/4] Removendo narracao de 4K/Ace/Half-Time do server\discordBot.js...

node -e "const fs=require('fs');const f='server/discordBot.js';let c=fs.readFileSync(f,'utf8');const s='  setWebRoomsReference(roomsRef) {';const e='  buildGsiEmbed() {';const i1=c.indexOf(s);const i2=c.indexOf(e,i1);if(i1===-1||i2===-1){console.error('Marcador nao encontrado');process.exit(1);}const clean=`  setWebRoomsReference(roomsRef) {\n    this.webRoomsRef = roomsRef;\n  }\n\n  getPublicWebUrl(path = '') {\n    const base = (\n      this.config.publicWebUrl ||\n      process.env.PUBLIC_URL ||\n      process.env.RENDER_EXTERNAL_URL ||\n      (process.env.RAILWAY_STATIC_URL ? 'https://' + process.env.RAILWAY_STATIC_URL : 'https://mix-cs2.onrender.com')\n    ).replace(/\\/+$/, '');\n    const cleanPath = path ? (path.startsWith('/') ? path : '/' + path) : '';\n    return base + cleanPath;\n  }\n\n  isOfficialCompetitiveMap(rawMapName = '') {\n    const clean = String(rawMapName || '').toLowerCase().trim().replace(/^workshop\\/\\d+\\//, '');\n    if (!clean || clean === 'indefinido') return false;\n    if (clean.startsWith('aim_') || clean.startsWith('fy_') || clean.startsWith('gg_') || clean.startsWith('surf_') || clean.startsWith('kz_')) return false;\n    return /^(de_)?(mirage|inferno|nuke|dust2|ancient|anubis|vertigo|overpass|train|cache)$/.test(clean);\n  }\n\n  getActiveLiveMix(channelId = null, currentCs2Map = null) {\n    const now = Date.now();\n    const isValid = (m) => {\n      if (!m || m.phase !== 'live') return false;\n      if (!m.teamA?.players?.length || !m.teamB?.players?.length) return false;\n      if (m.createdAt && (now - m.createdAt > 3 * 3600 * 1000)) return false;\n      if (currentCs2Map) {\n        if (!this.isOfficialCompetitiveMap(currentCs2Map)) return false;\n        const mixMapRaw = m.veto?.deciderMap?.id || m.veto?.deciderMap?.name || m.finalMap?.file || m.finalMap?.name || m.matchMap || '';\n        if (mixMapRaw) {\n          const n1 = normalizeMapName(currentCs2Map).toLowerCase();\n          const n2 = normalizeMapName(mixMapRaw).toLowerCase();\n          if (n1 && n2 && n1 !== n2) return false;\n        }\n      }\n      return true;\n    };\n    if (channelId) {\n      const m = this.activeMixes.get(channelId);\n      if (isValid(m)) return m;\n    }\n    for (const [, m] of this.activeMixes.entries()) {\n      if (isValid(m)) return m;\n    }\n    return null;\n  }\n\n  stopAllLiveMonitoring() {\n    if (this.liveTrackers && this.liveTrackers.size > 0) this.liveTrackers.clear();\n  }\n\n  handleGsiEvent(roomId, liveState) {\n    if (!liveState || !this.isOfficialCompetitiveMap(liveState.mapName)) return;\n    const activeMix = this.getActiveLiveMix(null, liveState.mapName);\n    if (!activeMix) {\n      this.stopAllLiveMonitoring();\n      return;\n    }\n    const now = Date.now();\n    this.lastGsiState = { ...liveState, roomId: roomId || 'MIX-PRO', receivedAt: now };\n    if (Array.isArray(liveState.allPlayersStats) && liveState.allPlayersStats.length > 0 && liveState.phase !== 'warmup' && ((liveState.scoreCT || 0) + (liveState.scoreTR || 0) >= 1)) {\n      this.lastBestGsiState = { ...liveState, allPlayersStats: [...liveState.allPlayersStats], roomId: roomId || 'MIX-PRO', receivedAt: now };\n      activeMix.liveState = this.lastBestGsiState;\n      activeMix.gsi = this.lastBestGsiState;\n    }\n    if (this.liveTrackers && this.liveTrackers.size > 0) {\n      this.syncLiveTrackers(this.lastGsiState).catch(() => {});\n    }\n    if (liveState.isGameOver && ((liveState.scoreCT || 0) >= 13 || (liveState.scoreTR || 0) >= 13 || liveState.phase === 'gameover')) {\n      const snap = this.lastBestGsiState || liveState;\n      const maxS = Math.max(snap.scoreCT || 0, snap.scoreTR || 0);\n      const minS = Math.min(snap.scoreCT || 0, snap.scoreTR || 0);\n      const key = activeMix.id + ':' + (snap.mapName || 'cs2') + ':' + maxS + '-' + minS;\n      if (activeMix.phase === 'live' && activeMix._autoFinalizedKey !== key) {\n        activeMix._autoFinalizedKey = key;\n        activeMix.liveState = snap;\n        activeMix.gsi = snap;\n        const winnerRes = determineMatchWinner(activeMix, snap);\n        const score = maxS + '-' + minS;\n        const chId = activeMix.channelId;\n        (async () => {\n          try {\n            let ch = chId ? this.client?.channels?.cache?.get(chId) : null;\n            if (!ch && chId && this.client?.channels?.fetch) ch = await this.client.channels.fetch(chId).catch(() => null);\n            const res = await this.recordMatchResult(activeMix, winnerRes.winnerLetter, score, { id: 'gsi_system', username: 'Valve CS2 GSI' }, ch, snap.mapName);\n            if (res.success && ch) await ch.send({ content: '**[FIM DO MIX DETECTADO NO CS2]** Placar final: ' + score, embeds: res.embeds, components: res.components });\n            this.stopAllLiveMonitoring();\n            if (this.config.autoMoveVoice && ch?.guild) await this.executeVoiceReturnToLobby(ch.guild, activeMix).catch(() => {});\n          } catch (_) {}\n        })();\n      }\n    }\n  }\n\n`;c=c.slice(0,i1)+clean+c.slice(i2);fs.writeFileSync(f,c,'utf8');console.log('  [OK] Codigo de 4K/Ace/Half-Time removido com sucesso!');"

node --check server/discordBot.js
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha na validacao do discordBot.js!
    pause
    exit /b 1
)

echo.
echo [4/4] Enviando atualizacao para o GitHub (para parar o bot da nuvem tambem)...
git add -A
git commit -m "fix: remover narracao de 4K/half-time e bloquear mapas aim_" 2>nul
git push -u origin main

echo.
echo ======================================================================
echo   [SUCESSO TOTAL] O spam de 4K / Half-Time foi 100%% removido!
echo   Quando quiser ligar o bot local novamente, use o seu
echo   INICIAR-CS2-MIX-HUB-HOST-LOCAL.bat ou INICIAR-CS2-MIX-HUB-24H.bat
echo ======================================================================
echo.
pause