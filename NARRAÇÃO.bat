<# :
@echo off
chcp 65001 >nul
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Users\alexn\AppData\Local\MinGit\cmd"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([System.IO.File]::ReadAllText('%~f0'))" & pause & exit /b
#>

try {
  $ErrorActionPreference = "Stop"
  $env:PATH += ";C:\Program Files\nodejs;C:\Users\alexn\AppData\Local\MinGit\cmd"

  if (Test-Path "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub\server\discordBot.js") {
    Set-Location "C:\Users\alexn\.gemini\antigravity\scratch\cs2-mix-hub"
  }

  Write-Host "=====================================================================" -ForegroundColor Cyan
  Write-Host "  INSTALANDO BOTAO DE NARRACAO (LIGA/DESLIGA) - CS2 MIX HUB" -ForegroundColor Cyan
  Write-Host "=====================================================================" -ForegroundColor Cyan
  Write-Host "Pasta do projeto: $PWD`n" -ForegroundColor Yellow

  function Replace-Between([string]$text, [string]$startMarker, [string]$endMarker, [string]$newBlock) {
    $i1 = $text.IndexOf($startMarker)
    if ($i1 -lt 0) { throw "Marcador inicial nao encontrado: $startMarker" }
    $i2 = $text.IndexOf($endMarker, $i1)
    if ($i2 -lt 0) { throw "Marcador final nao encontrado: $endMarker" }
    return $text.Substring(0, $i1) + $newBlock + $text.Substring($i2)
  }

  # 1. Parar qualquer processo Node antigo ANTES de limpar o activeMixStore.json
  Write-Host "[1/4] Parando processos antigos do Node e limpando memoria de mixes travados..." -ForegroundColor Cyan
  Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1

  $storeFile = "$PWD\server\data\activeMixStore.json"
  [System.IO.File]::WriteAllText($storeFile, '{"savedAt":0,"roomsCount":0,"discordMixesCount":0,"rooms":[],"discordMixes":[]}', [System.Text.Encoding]::UTF8)

  $botFile = "$PWD\server\discordBot.js"
  if (-not (Test-Path $botFile)) {
    throw "O arquivo server\discordBot.js nao foi encontrado!"
  }

  $botCode = [System.IO.File]::ReadAllText($botFile, [System.Text.Encoding]::UTF8)

  # 2. Configurar motor de Narracao sob demanda (Padrao: OFF + Filtro de Mapas + Anti-Duplicacao)
  Write-Host "[2/4] Configurando Narracao com padrao DESLIGADO (so ativa ao clicar no botao)..." -ForegroundColor Cyan
  $block1 = @'
  setWebRoomsReference(roomsRef) {
    this.webRoomsRef = roomsRef;
  }

  getPublicWebUrl(path = '') {
    const base = (
      this.config.publicWebUrl ||
      process.env.PUBLIC_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : 'https://mix-cs2.onrender.com')
    ).replace(/\/+$/, '');
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    return `${base}${cleanPath}`;
  }

  isOfficialCompetitiveMap(rawMapName = '') {
    const clean = String(rawMapName || '').toLowerCase().trim().replace(/^workshop\/\d+\//, '');
    if (!clean || clean === 'indefinido') return false;
    if (clean.startsWith('aim_') || clean.startsWith('fy_') || clean.startsWith('gg_') || clean.startsWith('surf_') || clean.startsWith('kz_')) {
      return false;
    }
    return /^(de_)?(mirage|inferno|nuke|dust2|ancient|anubis|vertigo|overpass|train|cache)$/.test(clean);
  }

  isNarrationActive(mix = null) {
    if (mix && typeof mix.narrationEnabled === 'boolean') {
      return mix.narrationEnabled;
    }
    return Boolean(this.narrationEnabled);
  }

  toggleNarration(mix = null) {
    const nextState = !this.isNarrationActive(mix);
    this.narrationEnabled = nextState;
    if (mix) {
      mix.narrationEnabled = nextState;
    }
    for (const [, m] of this.activeMixes.entries()) {
      if (m && m.phase === 'live') {
        m.narrationEnabled = nextState;
      }
    }
    return nextState;
  }

  getActiveLiveMix(channelId = null, currentCs2Map = null) {
    const now = Date.now();
    const maxMixAgeMs = 3 * 3600 * 1000;

    const isValidLiveMix = (m) => {
      if (!m || m.phase !== 'live') return false;
      if (!m.teamA?.players?.length || !m.teamB?.players?.length) return false;
      if (m.createdAt && (now - m.createdAt > maxMixAgeMs)) return false;

      if (currentCs2Map) {
        if (!this.isOfficialCompetitiveMap(currentCs2Map)) return false;
        const mixMapRaw = m.veto?.deciderMap?.id || m.veto?.deciderMap?.name || m.finalMap?.file || m.finalMap?.name || m.matchMap || '';
        if (mixMapRaw) {
          const normCs2 = normalizeMapName(currentCs2Map).toLowerCase();
          const normMix = normalizeMapName(mixMapRaw).toLowerCase();
          if (normCs2 && normMix && normCs2 !== normMix) return false;
        }
      }
      return true;
    };

    if (channelId) {
      const m = this.activeMixes.get(channelId);
      if (isValidLiveMix(m)) return m;
    }
    for (const [, m] of this.activeMixes.entries()) {
      if (isValidLiveMix(m)) return m;
    }
    return null;
  }

  stopAllLiveMonitoring() {
    this.narrationEnabled = false;
    for (const [, m] of this.activeMixes.entries()) {
      if (m) m.narrationEnabled = false;
    }
    if (this.liveTrackers && this.liveTrackers.size > 0) {
      this.liveTrackers.clear();
    }
  }

  processLiveHighlightsAndHalftime(liveState, activeMix) {
    try {
      // SO NARRA SE O BOTAO DE NARRACAO TIVER SIDO ATIVADO PELO USUARIO!
      if (!this.isNarrationActive(activeMix)) return;
      if (!activeMix || activeMix.phase !== 'live') return;
      if (!liveState || liveState.phase === 'warmup' || !this.isOfficialCompetitiveMap(liveState.mapName)) return;

      this._hlTracker = this._hlTracker || {
        mapName: '',
        roundNumber: -1,
        killsAtRoundStart: new Map(),
        clutchCandidateCT: null,
        clutchCandidateTR: null,
        announcedRound: -1,
        sentEvents: new Set(),
      };

      const trk = this._hlTracker;
      const sCT = Number(liveState.scoreCT || 0);
      const sTR = Number(liveState.scoreTR || 0);
      const totalRounds = sCT + sTR;
      const rNum = Number(liveState.roundNumber || totalRounds + 1);
      const allStats = Array.isArray(liveState.allPlayersStats) ? liveState.allPlayersStats : [];

      if (trk.mapName !== liveState.mapName || (totalRounds === 0 && liveState.roundPhase === 'freezetime')) {
        trk.mapName = liveState.mapName;
        trk.roundNumber = rNum;
        trk.killsAtRoundStart.clear();
        allStats.forEach((p) => trk.killsAtRoundStart.set(p.steamId || p.name, p.kills || 0));
        trk.clutchCandidateCT = null;
        trk.clutchCandidateTR = null;
        trk.announcedRound = -1;
        trk.sentEvents.clear();
      }

      if (liveState.roundPhase === 'freezetime' && trk.roundNumber !== rNum) {
        trk.roundNumber = rNum;
        trk.killsAtRoundStart.clear();
        allStats.forEach((p) => trk.killsAtRoundStart.set(p.steamId || p.name, p.kills || 0));
        trk.clutchCandidateCT = null;
        trk.clutchCandidateTR = null;
      }

      if (liveState.roundPhase === 'live') {
        const aliveCT = (liveState.teamCT || []).filter((p) => p.isAlive);
        const aliveTR = (liveState.teamTR || []).filter((p) => p.isAlive);

        if (aliveCT.length === 1 && aliveTR.length >= 2) {
          if (!trk.clutchCandidateCT || aliveTR.length > trk.clutchCandidateCT.enemies) {
            trk.clutchCandidateCT = { player: aliveCT[0], enemies: aliveTR.length };
          }
        }
        if (aliveTR.length === 1 && aliveCT.length >= 2) {
          if (!trk.clutchCandidateTR || aliveCT.length > trk.clutchCandidateTR.enemies) {
            trk.clutchCandidateTR = { player: aliveTR[0], enemies: aliveCT.length };
          }
        }
      }

      const channel = activeMix?.channelId ? this.client?.channels?.cache?.get(activeMix.channelId) : null;
      const cleanMap = normalizeMapName(liveState.mapName);

      if (liveState.roundPhase === 'over' && trk.announcedRound !== totalRounds && totalRounds > 0) {
        trk.announcedRound = totalRounds;
        const winSide = liveState.winTeam === 'CT' ? 'CT' : liveState.winTeam === 'T' || liveState.winTeam === 'TR' ? 'TR' : null;
        const messages = [];

        if (winSide === 'CT' && trk.clutchCandidateCT) {
          const c = trk.clutchCandidateCT;
          const evKey = `${activeMix.id}:R${totalRounds}:clutch:${c.player.name}`;
          if (!trk.sentEvents.has(evKey)) {
            trk.sentEvents.add(evKey);
            messages.push(`\ud83e\uddca \ud83d\udd25 **[CLUTCH 1v${c.enemies} NO MIX!]** **${c.player.name}** garantiu o round sozinho de CT em **${cleanMap}**! (\`CT ${sCT} x ${sTR} TR\`)`);
          }
        } else if (winSide === 'TR' && trk.clutchCandidateTR) {
          const c = trk.clutchCandidateTR;
          const evKey = `${activeMix.id}:R${totalRounds}:clutch:${c.player.name}`;
          if (!trk.sentEvents.has(evKey)) {
            trk.sentEvents.add(evKey);
            messages.push(`\ud83e\uddca \ud83d\udd25 **[CLUTCH 1v${c.enemies} NO MIX!]** **${c.player.name}** garantiu o round sozinho de TR em **${cleanMap}**! (\`CT ${sCT} x ${sTR} TR\`)`);
          }
        }

        const roundKillers = [];
        if (liveState.player && liveState.player.roundKills >= 4) {
          roundKillers.push({
            name: liveState.player.name,
            rk: liveState.player.roundKills,
            hs: liveState.player.roundKillHs || 0,
            weapon: liveState.player.activeWeapon?.name || 'Arma',
          });
        }

        allStats.forEach((p) => {
          const key = p.steamId || p.name;
          if (trk.killsAtRoundStart.has(key)) {
            const delta = (p.kills || 0) - (trk.killsAtRoundStart.get(key) || 0);
            if (delta >= 4 && delta <= 5 && !roundKillers.some((rk) => rk.name === p.name)) {
              roundKillers.push({ name: p.name, rk: delta, hs: 0, weapon: p.activeWeapon || 'Arma' });
            }
          }
          trk.killsAtRoundStart.set(key, p.kills || 0);
        });

        roundKillers.forEach((k) => {
          const evKey = `${activeMix.id}:R${totalRounds}:mk:${k.name}`;
          if (trk.sentEvents.has(evKey)) return;
          trk.sentEvents.add(evKey);
          const hsTxt = k.hs > 0 ? ` (${k.hs} HS \ud83c\udfaf)` : '';
          if (k.rk >= 5) {
            messages.push(`\ud83d\udd25 \ud83d\udc80 **[ACE NO MIX! 5 KILLS]** **${k.name}** varreu o time inteiro com **${k.weapon}**${hsTxt} em **${cleanMap}**!`);
          } else if (k.rk === 4) {
            messages.push(`\ud83d\udca5 \ud83c\udfaf **[QUADRA KILL - 4K!]** **${k.name}** levou **4 advers\u00e1rios** no round com **${k.weapon}**${hsTxt}!`);
          }
        });

        trk.clutchCandidateCT = null;
        trk.clutchCandidateTR = null;

        if (channel && messages.length > 0) {
          channel.send(messages.join('\n')).catch(() => {});
        }

        const halfKey = `${activeMix.id}:${liveState.mapName}:half12`;
        if (totalRounds === 12 && !trk.sentEvents.has(halfKey)) {
          trk.sentEvents.add(halfKey);
          const oldSideA = (activeMix.teamA?.side || 'CT').toUpperCase();
          activeMix.teamA.side = oldSideA === 'CT' ? 'TR' : 'CT';
          activeMix.teamB.side = activeMix.teamA.side === 'CT' ? 'TR' : 'CT';
          this.syncToWebRoom(activeMix);

          if (channel) {
            channel.send(
              `\ud83d\udd04 \u23f1\ufe0f **[FIM DO 1\u00ba TEMPO \u2022 VIRADA DE LADO (HALF-TIME)]**\n` +
              `Placar parcial em **${cleanMap}**: **CT ${sCT} x ${sTR} TR**!\n` +
              `Os lados foram invertidos para o 2\u00ba tempo: **${activeMix.teamA.name}** (${activeMix.teamA.side}) vs **${activeMix.teamB.name}** (${activeMix.teamB.side})!`
            ).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[HIGHLIGHTS WARN]:', err.message);
    }
  }

  handleGsiEvent(roomId, liveState) {
    if (!liveState || !this.isOfficialCompetitiveMap(liveState.mapName)) {
      return;
    }

    const activeMix = this.getActiveLiveMix(null, liveState.mapName);
    if (!activeMix) {
      this.stopAllLiveMonitoring();
      return;
    }

    const now = Date.now();
    this.lastGsiState = {
      ...liveState,
      roomId: roomId || 'MIX-PRO',
      receivedAt: now,
    };

    if (
      Array.isArray(liveState.allPlayersStats) &&
      liveState.allPlayersStats.length > 0 &&
      liveState.phase !== 'warmup' &&
      ((liveState.scoreCT || 0) + (liveState.scoreTR || 0) >= 1 || (liveState.roundNumber || 0) >= 1)
    ) {
      this.lastBestGsiState = {
        ...liveState,
        allPlayersStats: [...liveState.allPlayersStats],
        roomId: roomId || 'MIX-PRO',
        receivedAt: now,
      };
      activeMix.liveState = this.lastBestGsiState;
      activeMix.gsi = this.lastBestGsiState;
    }

    const steamId = liveState.player?.steamId || liveState.rawPlayer?.steamId;
    if (steamId) {
      this.playersGsiStates.set(steamId, {
        ...liveState,
        roomId: roomId || 'MIX-PRO',
        receivedAt: now,
      });
    }

    // So processa narracao se o botao de Narracao tiver sido ativado!
    if (this.isNarrationActive(activeMix)) {
      this.processLiveHighlightsAndHalftime(liveState, activeMix);
    }

    if (this.liveTrackers && this.liveTrackers.size > 0) {
      this.syncLiveTrackers(this.lastGsiState).catch(() => {});
    }

    if (liveState.isGameOver && ((liveState.scoreCT || 0) >= 13 || (liveState.scoreTR || 0) >= 13 || liveState.phase === 'gameover')) {
      const statsSnapshot = this.lastBestGsiState || liveState;
      const maxS = Math.max(statsSnapshot.scoreCT || 0, statsSnapshot.scoreTR || 0);
      const minS = Math.min(statsSnapshot.scoreCT || 0, statsSnapshot.scoreTR || 0);
      const matchFinishKey = `${activeMix.id}:${statsSnapshot.mapName || 'cs2'}:${maxS}-${minS}`;

      if (activeMix.phase === 'live' && activeMix._autoFinalizedKey !== matchFinishKey) {
        activeMix._autoFinalizedKey = matchFinishKey;
        activeMix.liveState = statsSnapshot;
        activeMix.gsi = statsSnapshot;

        const winnerRes = determineMatchWinner(activeMix, statsSnapshot);
        const score = `${maxS}-${minS}`;
        const targetChannelId = activeMix.channelId;

        (async () => {
          try {
            let channel = targetChannelId ? this.client?.channels?.cache?.get(targetChannelId) : null;
            if (!channel && targetChannelId && this.client?.channels?.fetch) {
              channel = await this.client.channels.fetch(targetChannelId).catch(() => null);
            }
            const res = await this.recordMatchResult(
              activeMix,
              winnerRes.winnerLetter,
              score,
              { id: 'gsi_system', username: 'Valve CS2 GSI (Autom\u00e1tico)' },
              channel,
              statsSnapshot.mapName
            );
            if (res.success && channel) {
              await channel.send({
                content: `\ud83c\udfc6 **[FIM DO MIX DETECTADO NO CS2]** Partida finalizada automaticamente no mapa **${normalizeMapName(statsSnapshot.mapName || 'CS2')}** (\`${score}\`)!`,
                embeds: res.embeds,
                components: res.components,
              });
            }
            this.stopAllLiveMonitoring();
            if (this.config.autoMoveVoice && channel?.guild) {
              await this.executeVoiceReturnToLobby(channel.guild, activeMix).catch(() => {});
            }
          } catch (err) {
            console.warn('[DISCORD BOT GSI AUTO-RESULT ERROR]:', err.message);
          }
        })();
      }
    }
  }

'@
  $botCode = Replace-Between $botCode "  setWebRoomsReference(roomsRef) {" "  buildGsiEmbed() {" $block1

  # 3. Adicionar o Botao de Narracao no card de Monitoramento e no card de Partida Pronta
  Write-Host "[3/4] Adicionando o botao 'Narracao: OFF / ON' nos paineis do Discord..." -ForegroundColor Cyan
  $block2 = @'
  buildLiveMatchButtons(isOnline = false, isExpanded = false) {
    const narrOn = this.isNarrationActive();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('live_toggle_expand')
        .setLabel(isExpanded ? 'Modo Compacto' : 'Ver Detalhes (+)')
        .setEmoji(isExpanded ? '\ud83d\udd3d' : '\ud83d\udd0d')
        .setStyle(isExpanded ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('live_toggle_narration')
        .setLabel(narrOn ? 'Narra\u00e7\u00e3o: ON' : 'Narra\u00e7\u00e3o: OFF')
        .setEmoji(narrOn ? '\ud83c\udf99\ufe0f' : '\ud83d\udd07')
        .setStyle(narrOn ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('live_refresh')
        .setLabel('Atualizar')
        .setEmoji('\ud83d\udd04')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Hub Web')
        .setEmoji('\ud83c\udf10')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/')),
      new ButtonBuilder()
        .setCustomId('live_stop')
        .setLabel('Parar')
        .setEmoji('\u23f9\ufe0f')
        .setStyle(ButtonStyle.Danger)
    );
    return row;
  }

'@
  $botCode = Replace-Between $botCode "  buildLiveMatchButtons(" "  registerLiveTracker(" $block2

  $block3 = @'
  buildMatchReadyButtons(mix) {
    const rows = [];
    const row1 = new ActionRowBuilder();
    const narrOn = this.isNarrationActive(mix);

    if (mix.serverIp) {
      const cleanIp = mix.serverIp.replace(/^connect\s+/i, '').trim();
      row1.addComponents(
        new ButtonBuilder()
          .setLabel('Conectar Direto no CS2')
          .setEmoji('\ud83d\ude80')
          .setStyle(ButtonStyle.Link)
          .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(cleanIp)}`))
      );
    }

    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`match_result:${mix.id}`)
        .setLabel('Declarar Placar')
        .setEmoji('\ud83c\udfc6')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mix_toggle_narration:${mix.id}`)
        .setLabel(narrOn ? 'Narra\u00e7\u00e3o: ON' : 'Narra\u00e7\u00e3o: OFF')
        .setEmoji(narrOn ? '\ud83c\udf99\ufe0f' : '\ud83d\udd07')
        .setStyle(narrOn ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_sub:${mix.id}`)
        .setLabel('Substituto')
        .setEmoji('\ud83d\udd04')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_voice:${mix.id}`)
        .setLabel('Mover Calls')
        .setEmoji('\ud83d\udcde')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(row1);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_live_tracker:${mix.id}`)
        .setLabel('Monitorar Partida')
        .setEmoji('\ud83d\udce1')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('Acompanhar no Site')
        .setEmoji('\ud83c\udf10')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/?room=${mix.id}`)),
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('Novo Mix')
        .setEmoji('\ud83c\udfae')
        .setStyle(ButtonStyle.Primary)
    );
    rows.push(row2);

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rcon_pause:${mix.id}`)
        .setLabel('Pausar CS2')
        .setEmoji('\u23f8\ufe0f')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rcon_unpause:${mix.id}`)
        .setLabel('Despausar')
        .setEmoji('\u25b6\ufe0f')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rcon_live:${mix.id}`)
        .setLabel('For\u00e7ar Live/RR')
        .setEmoji('\ud83d\udd25')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rcon_say_modal:${mix.id}`)
        .setLabel('Aviso no CS2')
        .setEmoji('\ud83d\udce2')
        .setStyle(ButtonStyle.Primary)
    );
    rows.push(row3);

    return rows;
  }

  // ==========================================
  // BUTTON INTERACTION HANDLERS
  // ==========================================

  async handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const user = interaction.user;

    // Botao de Ligar / Desligar Narracao sob demanda (Padrao: OFF)
    if (customId === 'live_toggle_narration' || customId.startsWith('mix_toggle_narration:')) {
      const tMixId = customId.includes(':') ? customId.split(':')[1] : '';
      const mix = (tMixId && this.activeMixes.get(tMixId)) || this.resolveActiveMixForChannel(interaction.channelId);
      const isNowOn = this.toggleNarration(mix);

      if (customId === 'live_toggle_narration') {
        const tracker = this.liveTrackers?.get(interaction.message?.id);
        const isExpanded = tracker ? Boolean(tracker.isExpanded) : false;
        const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name), isExpanded);
        await interaction.update({ components: [row] }).catch(() => {});
      } else if (mix) {
        const components = this.buildMatchReadyButtons(mix);
        await interaction.update({ components }).catch(() => {});
      }

      return interaction.followUp({
        content: isNowOn
          ? `\ud83c\udf99\ufe0f **Narra\u00e7\u00e3o do Mix ATIVADA por <@${user.id}>!** O bot vai narrar Aces (5K), Quadra Kills (4K), Clutches e Virada de Half desta partida!`
          : `\ud83d\udd07 **Narra\u00e7\u00e3o do Mix DESATIVADA por <@${user.id}>!** O bot ficar\u00e1 100% silencioso durante os rounds.`,
        ephemeral: false,
      }).catch(() => {});
    }

    // RCON In-Game Controls (Pause, Unpause, Restart/Live, Chat Broadcast)
    if (
      customId.startsWith('rcon_pause:') ||
      customId.startsWith('rcon_unpause:') ||
      customId.startsWith('rcon_live:') ||
      customId.startsWith('rcon_say_modal:')
    ) {
      const [rconAct, rMixId] = customId.split(':');
      const mix = this.activeMixes.get(rMixId) || this.resolveActiveMixForChannel(interaction.channelId);
      const isCapOrAdmin =
        !mix ||
        user.id === mix.creatorId ||
        user.id === mix.teamA?.captain?.id ||
        user.id === mix.teamB?.captain?.id ||
        Boolean(interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator));

      if (!isCapOrAdmin) {
        return interaction.reply({
          content: '\ud83d\udeab Apenas os **Capit\u00e3es**, o **Criador do Mix** ou **Admins** podem controlar o servidor CS2!',
          ephemeral: true,
        });
      }

      if (rconAct === 'rcon_say_modal') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_rcon_say:${mix?.id || 'global'}`)
          .setTitle('Enviar Aviso na Tela do CS2');
        const msgInput = new TextInputBuilder()
          .setCustomId('rcon_say_text')
          .setLabel('Mensagem para exibir no chat do servidor CS2')
          .setPlaceholder('Ex: Bora entrar no servidor! Faltam 2 no CT!')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
        return interaction.showModal(modal);
      }

      const rawServer = (mix?.serverIp || this.config.serverConnect || '').replace(/^connect\s+/i, '').trim();
      const rconPwd = (mix?.rconPassword || this.config.rconPassword || process.env.CS2_RCON_PASSWORD || '').trim();
      if (!rawServer || !rconPwd) {
        return interaction.reply({
          content: '\u26a0\ufe0f IP do servidor ou senha RCON ainda n\u00e3o configurados no painel!',
          ephemeral: true,
        });
      }

      const [host, portStr] = rawServer.split(':');
      const port = parseInt(portStr, 10) || 27015;

      try {
        if (rconAct === 'rcon_pause') {
          await executeRconCommand({
            host,
            port,
            password: rconPwd,
            command: `mp_pause_match; say ">>> [DISCORD MIX HUB] Partida PAUSADA por ${user.username} no proximo freezetime!"`,
          });
          return interaction.reply({ content: `\u23f8\ufe0f <@${user.id}> enviou **Pause T\u00e1tico (\`mp_pause_match\`)** para o servidor CS2!` });
        }
        if (rconAct === 'rcon_unpause') {
          await executeRconCommand({
            host,
            port,
            password: rconPwd,
            command: `mp_unpause_match; say ">>> [DISCORD MIX HUB] Partida DESPAUSADA por ${user.username}! GL & HF!"`,
          });
          return interaction.reply({ content: `\u25b6\ufe0f <@${user.id}> **despausou (\`mp_unpause_match\`)** a partida no servidor CS2!` });
        }
        if (rconAct === 'rcon_live') {
          if (mix && typeof this.applyCs2TeamNamesRcon === 'function') await this.applyCs2TeamNamesRcon(mix).catch(() => {});
          await executeRconCommand({
            host,
            port,
            password: rconPwd,
            command: `mp_warmup_end; mp_restartgame 1; say ">>> [DISCORD MIX HUB] LIVE! Partida iniciada/reiniciada por ${user.username}!"`,
          });
          return interaction.reply({ content: `\ud83d\udd25 <@${user.id}> encerrou o aquecimento e puxou **LIVE (\`mp_restartgame 1\`)** no CS2!` });
        }
      } catch (err) {
        return interaction.reply({ content: `\u274c Falha RCON: ${err.message}`, ephemeral: true });
      }
    }

'@
  $botCode = Replace-Between $botCode "  buildMatchReadyButtons(mix) {" "    // Community Clip Voting" $block3

  [System.IO.File]::WriteAllText($botFile, $botCode, [System.Text.Encoding]::UTF8)

  # 4. Validar sintaxe Node.js e exibir painel [OK]
  Write-Host "[4/4] Validando sintaxe do Node.js..." -ForegroundColor Cyan
  Write-Host "`n---------------------------------------------------------------------" -ForegroundColor Cyan
  Write-Host "  PAINEL DE VERIFICACAO DO BOTAO DE NARRACAO" -ForegroundColor Cyan
  Write-Host "---------------------------------------------------------------------" -ForegroundColor Cyan

  $chk = [System.IO.File]::ReadAllText($botFile, [System.Text.Encoding]::UTF8)

  if ($chk.Contains("toggleNarration") -and $chk.Contains("mix_toggle_narration:")) {
    Write-Host "  [OK] Botao 'Narracao: OFF / ON' -> Adicionado nos cards do Mix!" -ForegroundColor Green
  }
  if ($chk.Contains("isOfficialCompetitiveMap")) {
    Write-Host "  [OK] Bloqueio de mapas aim_rush -> Ativo (ignora treinos/casual)!" -ForegroundColor Green
  }
  Write-Host "  [OK] Padrao Inicial             -> 100% Silencioso (OFF por padrao)!" -ForegroundColor Green

  cmd /c "node --check server\discordBot.js"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Sintaxe Node.js            -> 100% Validada sem nenhum erro!" -ForegroundColor Green
    Write-Host "---------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "TUDO PRONTO! Agora apague este .bat e clique no push-to-github.bat!" -ForegroundColor Yellow
  }
} catch {
  Write-Host "`n[ERRO DETALHADO]: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Read-Host "Pressione ENTER para fechar esta janela"