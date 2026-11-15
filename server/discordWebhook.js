/**
 * Discord Webhook Notification Service for CS2 Mix Hub
 * Sends rich embeds for lobby updates, 10/10 full lobby alerts, and match decider summaries.
 */

const VALID_WEBHOOK_PREFIXES = [
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
  'https://canary.discord.com/api/webhooks/',
  'https://ptb.discord.com/api/webhooks/',
];

export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return VALID_WEBHOOK_PREFIXES.some(prefix => trimmed.startsWith(prefix));
}

export async function sendDiscordWebhook({ webhookUrl, eventType, data = {} }) {
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    throw new Error('URL de Webhook do Discord inválida. Deve começar com https://discord.com/api/webhooks/...');
  }

  let payload = null;

  if (eventType === 'test') {
    payload = {
      username: 'CS2 Mix Hub',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: '🤖 CS2 MIX HUB • Webhook Conectado com Sucesso!',
          description: 'As notificações automáticas de mix (10/10 jogadores e resultado de vetos) agora serão enviadas diretamente neste canal do Discord.',
          color: 0x38bdf8, // Sky 400
          fields: [
            {
              name: '📍 Status',
              value: '🟢 Ativo e Operacional',
              inline: true,
            },
            {
              name: '🕒 Horário',
              value: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
              inline: true,
            },
          ],
          footer: {
            text: 'CS2 Mix Hub • Sorteador GC & Pick/Ban',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else if (eventType === 'lobby_full') {
    const { roomName = 'MIX', playerCount = 10, roomUrl = '' } = data;
    payload = {
      username: 'CS2 Mix Hub',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: `🚨 LOBBY LOTADO: ${roomName.toUpperCase()} (10/10)!`,
          description: `A sala **${roomName}** atingiu **10 jogadores**! O sorteio de capitães ou capitão draft já pode começar!`,
          color: 0x10b981, // Emerald 500
          fields: [
            {
              name: '👥 Jogadores Prontos',
              value: `${playerCount} / 10`,
              inline: true,
            },
            {
              name: '🔗 Link da Sala',
              value: roomUrl ? `[Entrar no Lobby](${roomUrl})` : 'Acesse pelo Hub',
              inline: true,
            },
          ],
          footer: {
            text: 'CS2 Mix Hub • Partida Prestes a Começar',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else if (eventType === 'mix_ready') {
    const {
      roomName = 'MIX',
      mapName = 'Mirage',
      mapFile = 'de_mirage',
      mapImage = '',
      mapLogo = '',
      matchFormat = 'MD1',
      drawnSeries = [],
      pickedMaps = [],
      vetoLog = [],
      nameA = 'TIME A',
      nameB = 'TIME B',
      sideA = 'CT',
      sideB = 'TR',
      teamA = [],
      teamB = [],
      metrics = {},
      connectCommand = '',
      serverIp = '',
      roomUrl = '',
    } = data;

    const listTeam = (players) => {
      if (!players || players.length === 0) return 'Nenhum jogador';
      return players
        .map((p, idx) => {
          const cap = idx === 0 ? ' ⭐ *(Capitão)*' : '';
          const lvl = p.faceitLevel ? `[F${p.faceitLevel}]` : (p.level ? `[GC ${p.level}]` : '');
          return `\`${idx + 1}.\` **${p.nick}** ${lvl}${cap}`;
        })
        .join('\n');
    };

    const isSeries = (matchFormat === 'MD3' || matchFormat === 'MD5' || (Array.isArray(drawnSeries) && drawnSeries.length > 1));
    const sideBadgeA = sideA === 'CT' ? '🛡️ CT (Defesa)' : '🔥 TR (Ataque)';
    const sideBadgeB = sideB === 'CT' ? '🛡️ CT (Defesa)' : '🔥 TR (Ataque)';

    const fields = [];

    // Series Breakdown: Map 1, Map 2, Map 3 (Decider) with Picks and Starting Sides
    if (isSeries && drawnSeries.length > 0) {
      // 1. Visão Geral da Ordem dos Mapas
      const scheduleOverview = drawnSeries.map((item, idx) => {
        const m = item.map || {};
        const mName = m.name || item.name || 'Mapa';
        const mFile = m.file || item.file || '';
        const isDecider = item.pickedBy === 'decider' || idx === drawnSeries.length - 1;
        const sA = item.knifeRound ? 'FACA' : (item.sideTimeA || 'CT');
        const sB = item.knifeRound ? 'FACA' : (sA === 'CT' ? 'TR' : 'CT');
        const pickTag = isDecider
          ? '🎲 Decider (Sobra)'
          : (item.pickedBy === 'teamA' ? `🎯 Pick ${nameA}` : `🎯 Pick ${nameB}`);
        return `\`#${idx + 1}\` **${mName}** (\`${mFile}\`) — ${pickTag}\n    ↳ ${nameA}: **${sA}** | ${nameB}: **${sB}**`;
      }).join('\n\n');

      fields.push({
        name: `🗺️ ROTAÇÃO OFICIAL DA SÉRIE (${matchFormat} • ${drawnSeries.length} MAPAS)`,
        value: scheduleOverview || 'Mapas definidos',
        inline: false,
      });

      // 2. Detalhes Individuais de Cada Mapa (Quem deu o Pick, Quem escolheu lado e Lados iniciais)
      drawnSeries.forEach((item, idx) => {
        const m = item.map || {};
        const mName = (m.name || item.name || `Mapa #${idx + 1}`).toUpperCase();
        const mFile = m.file || item.file || '';
        const isDecider = item.pickedBy === 'decider' || idx === drawnSeries.length - 1;
        const isKnife = Boolean(item.knifeRound) || item.sideTimeA === 'KNIFE' || item.sideTimeA === 'FACA';
        const sA = isKnife ? 'Round Faca' : (item.sideTimeA || 'CT');
        const sB = isKnife ? 'Round Faca' : (sA === 'CT' ? 'TR' : 'CT');
        const pickedByTeam = item.pickedBy === 'teamA' ? nameA : item.pickedBy === 'teamB' ? nameB : (isDecider ? 'Decider (Sobra do Veto)' : 'Sorteio');
        const sideChooser = item.pickedBy === 'teamA' ? nameB : nameA;

        let sideChoiceExplanation = '';
        if (isDecider) {
          sideChoiceExplanation = isKnife ? '🔪 Definido na disputa do **Round Faca**' : 'Definido no sorteio de moeda inicial';
        } else {
          const chosenSide = item.pickedBy === 'teamA' ? sB : sA;
          sideChoiceExplanation = `👉 **${sideChooser}** escolheu começar de **${chosenSide}**`;
        }

        fields.push({
          name: `📍 MAPA #${idx + 1}: ${mName} ${isDecider ? '⭐ (DECIDER)' : `(Pick ${item.pickedBy === 'teamA' ? nameA : nameB})`}`,
          value: [
            `• **Arquivo:** \`${mFile}\``,
            `• **Origem:** ${isDecider ? '🎲 **Mapa Decisivo Restante**' : `🎯 Escolha do **${pickedByTeam}**`}`,
            `• **Lados Iniciais:**`,
            `  🛡️ **${nameA}:** Começa de **${sA === 'CT' ? 'CT (Defesa)' : sA === 'TR' ? 'TR (Ataque)' : sA}**`,
            `  🔥 **${nameB}:** Começa de **${sB === 'CT' ? 'CT (Defesa)' : sB === 'TR' ? 'TR (Ataque)' : sB}**`,
            `• **Seleção de Lado:** ${sideChoiceExplanation}`,
          ].join('\n'),
          inline: false,
        });
      });
    } else {
      // MD1 Single Map
      fields.push({
        name: '🗺️ Mapa Decidido (MD1)',
        value: `**${mapName.toUpperCase()}** (\`${mapFile}\`)\n• **${nameA}:** Começa de **${sideBadgeA}**\n• **${nameB}:** Começa de **${sideBadgeB}**`,
        inline: false,
      });
    }

    // 3. Rosters de Cada Time
    fields.push({
      name: `🔵 ${nameA}`,
      value: `${listTeam(teamA)}\n*Média de Nível: Lvl ${metrics?.avgA ?? '-'}*`,
      inline: true,
    });
    fields.push({
      name: `🟠 ${nameB}`,
      value: `${listTeam(teamB)}\n*Média de Nível: Lvl ${metrics?.avgB ?? '-'}*`,
      inline: true,
    });

    // 4. Server Connect Command (indicando o Mapa 1)
    if (connectCommand || serverIp) {
      const firstMapName = isSeries && drawnSeries.length > 0 ? (drawnSeries[0].map?.name || drawnSeries[0].name || mapName) : mapName;
      fields.push({
        name: `⚡ Conexão ao Servidor CS2 (${firstMapName})`,
        value: `\`\`\`bash\n${connectCommand || `connect ${serverIp}`}\n\`\`\``,
        inline: false,
      });
    }

    // 5. Histórico do Veto (Passo a Passo)
    if (Array.isArray(vetoLog) && vetoLog.length > 0) {
      const logLines = vetoLog.map((log, i) => {
        const teamLabel = log.team === 'teamA' ? nameA : log.team === 'teamB' ? nameB : 'Sorteio';
        if (log.type === 'ban') {
          return `\`${i + 1}.\` **${teamLabel}** removeu **${log.mapName}**`;
        }
        if (log.type === 'pick') {
          const sideText = log.knifeRound ? 'FACA' : (log.sideTeamA ? `${nameA}: ${log.sideTeamA}` : '');
          return `\`${i + 1}.\` **${teamLabel}** escolheu **${log.mapName}** ${sideText ? `(${sideText})` : ''}`;
        }
        if (log.type === 'decider') {
          return `\`${i + 1}.\` **${log.mapName}** sobrou como **Decider**`;
        }
        return `\`${i + 1}.\` ${log.mapName || 'Passo'}`;
      }).join('\n');

      if (logLines.length <= 1024) {
        fields.push({
          name: '📜 Histórico Oficial do Veto (HLTV / Major)',
          value: logLines,
          inline: false,
        });
      }
    }

    if (roomUrl) {
      fields.push({
        name: '🌐 Link da Sala',
        value: `[Ver Estatísticas e Placar no Hub](${roomUrl})`,
        inline: false,
      });
    }

    const titleText = isSeries && drawnSeries.length > 0
      ? `🏆 MIX PRONTO: ${roomName.toUpperCase()} • SÉRIE ${matchFormat} (${drawnSeries.length} MAPAS)`
      : `🏆 MIX PRONTO: ${roomName.toUpperCase()} • ${mapName.toUpperCase()}`;

    const descText = isSeries && drawnSeries.length > 0
      ? `A fase de vetos terminou! Todos os **${drawnSeries.length} mapas** da série ${matchFormat}, ordem de jogo, picks e lados iniciais de cada time foram definidos.`
      : 'O processo de veto terminou! A partida está configurada e pronta para o aquecimento.';

    const heroImage = (isSeries && drawnSeries[0]?.map?.image) ? drawnSeries[0].map.image : mapImage;
    const heroLogo = (isSeries && drawnSeries[0]?.map?.logo) ? drawnSeries[0].map.logo : mapLogo;

    payload = {
      username: 'CS2 Mix Hub',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: titleText,
          description: descText,
          color: 0xf59e0b, // Amber 500
          fields,
          thumbnail: heroLogo ? { url: heroLogo } : undefined,
          image: heroImage ? { url: heroImage } : undefined,
          footer: {
            text: `CS2 Mix Hub • Formato ${matchFormat} • Partida Competitiva`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else if (eventType === 'gsi_round') {
    const {
      roomName = 'MIX',
      mapName = 'Mirage',
      roundNumber = 1,
      scoreCT = 0,
      scoreTR = 0,
      winTeam = 'CT',
      bomb = 'none',
      roomUrl = '',
    } = data;

    const isCT = winTeam === 'CT';
    const embedColor = isCT ? 0x38bdf8 : 0xf97316; // Sky blue for CT, Orange for TR

    let reasonText = `${isCT ? 'Os Contraterroristas' : 'Os Terroristas'} eliminaram toda a equipe adversária.`;
    if (bomb === 'defused') {
      reasonText = '🛡️ A C4 foi desarmada com sucesso! Vitória dos Contraterroristas.';
    } else if (bomb === 'exploded') {
      reasonText = '🔥 A C4 detonou no bombsite! Vitória dos Terroristas.';
    }

    const totalRounds = scoreCT + scoreTR;
    let extraNote = '';
    if (totalRounds === 12) {
      extraNote = '\n\n🔄 **Fim da 1ª Metade (12º Round)!** Os times vão inverter os lados.';
    } else if (scoreCT === 12 && scoreTR === 12) {
      extraNote = '\n\n⚡ **Empate em 12x12! Partida indo para a Prorrogação (Overtime)!**';
    } else if (scoreCT === 12 || scoreTR === 12) {
      extraNote = `\n\n🎯 **Match Point para o ${scoreCT === 12 ? 'Time CT' : 'Time TR'}!**`;
    }

    payload = {
      username: 'CS2 Mix Hub • GSI Tracker',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: `⚔️ ROUND ${roundNumber} • ${isCT ? '🛡️ CT' : '🔥 TR'} VENCEU!`,
          description: `${reasonText}${extraNote}`,
          color: embedColor,
          fields: [
            {
              name: '📊 Placar Atual',
              value: `🛡️ Time CT **${scoreCT}**  ×  **${scoreTR}** Time TR 🔥`,
              inline: true,
            },
            {
              name: '🗺️ Mapa',
              value: `\`${mapName}\``,
              inline: true,
            },
            {
              name: '📍 Sala',
              value: roomUrl ? `[${roomName}](${roomUrl})` : `**${roomName}**`,
              inline: true,
            },
          ],
          footer: {
            text: `CS2 Mix Hub • GSI Monitoramento ao Vivo • Round ${roundNumber}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else if (eventType === 'gsi_bomb') {
    const {
      roomName = 'MIX',
      mapName = 'Mirage',
      roundNumber = 1,
      scoreCT = 0,
      scoreTR = 0,
      bombState = 'planted',
      roomUrl = '',
    } = data;

    const isPlanted = bombState === 'planted';
    payload = {
      username: 'CS2 Mix Hub • GSI Tracker',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: isPlanted ? '💣 C4 PLANTADA NO BOMBSITE!' : '✅ C4 DESARMADA!',
          description: isPlanted
            ? `A bomba foi armada no **Round ${roundNumber}**! Os Contraterroristas têm 40 segundos para o defuse.`
            : `Os Contraterroristas desarmaram a bomba no **Round ${roundNumber}**!`,
          color: isPlanted ? 0xef4444 : 0x10b981,
          fields: [
            {
              name: '📊 Placar',
              value: `CT **${scoreCT}** × **${scoreTR}** TR`,
              inline: true,
            },
            {
              name: '🗺️ Mapa',
              value: `\`${mapName}\``,
              inline: true,
            },
          ],
          footer: {
            text: `CS2 Mix Hub • Alerta de C4 em Tempo Real • ${roomName}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else if (eventType === 'gsi_gameover' || eventType === 'match_stats') {
    const {
      roomName = 'MIX',
      mapName = 'Mirage',
      winner = 'Time CT',
      scoreCT = 13,
      scoreTR = 0,
      nameA = 'Time A',
      nameB = 'Time B',
      allPlayersStats = [],
      topFragger = null,
      matchMvp = null,
      roomUrl = '',
    } = data;

    const formatPlayerLine = (p, idx) => {
      const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);
      const mvpBadge = p.mvps > 0 ? ` • ${p.mvps}⭐` : '';
      return `\`${idx + 1}.\` **${p.name || p.nick}** — ${p.kills}/${p.deaths}/${p.assists} (*K/D: ${kd}*)${mvpBadge}`;
    };

    const fields = [
      {
        name: '🥇 Vencedor da Partida',
        value: `**${winner}** (${scoreCT > scoreTR ? `${scoreCT} × ${scoreTR}` : `${scoreTR} × ${scoreCT}`})`,
        inline: true,
      },
      {
        name: '🗺️ Mapa Disputado',
        value: `\`${mapName}\``,
        inline: true,
      },
    ];

    if (matchMvp) {
      const mvpKd = matchMvp.deaths > 0 ? (matchMvp.kills / matchMvp.deaths).toFixed(2) : matchMvp.kills.toFixed(2);
      fields.push({
        name: '⭐ MVP da Partida',
        value: `🏆 **${matchMvp.name}**\n${matchMvp.kills} Kills • ${matchMvp.deaths} Mortes • ${matchMvp.assists} Assists • **K/D ${mvpKd}** • ${matchMvp.mvps} MVPs`,
        inline: false,
      });
    }

    if (allPlayersStats && allPlayersStats.length > 0) {
      const ctPlayers = allPlayersStats.filter(p => p.team === 'CT');
      const trPlayers = allPlayersStats.filter(p => p.team === 'T' || p.team === 'TR');

      if (ctPlayers.length > 0 || trPlayers.length > 0) {
        if (ctPlayers.length > 0) {
          fields.push({
            name: `🛡️ Contraterroristas (CT) — ${scoreCT} Rounds`,
            value: ctPlayers.map((p, i) => formatPlayerLine(p, i)).join('\n') || 'Nenhum dado',
            inline: false,
          });
        }
        if (trPlayers.length > 0) {
          fields.push({
            name: `🔥 Terroristas (TR) — ${scoreTR} Rounds`,
            value: trPlayers.map((p, i) => formatPlayerLine(p, i)).join('\n') || 'Nenhum dado',
            inline: false,
          });
        }
      } else {
        // Flat scoreboard sorted by score
        fields.push({
          name: '📊 Scoreboard Geral da Partida',
          value: allPlayersStats.slice(0, 10).map((p, i) => formatPlayerLine(p, i)).join('\n'),
          inline: false,
        });
      }
    }

    if (topFragger && (!matchMvp || topFragger.name !== matchMvp.name)) {
      fields.push({
        name: '👑 Top Fragger',
        value: `**${topFragger.name}** com **${topFragger.kills} eliminações**`,
        inline: true,
      });
    }

    if (roomUrl) {
      fields.push({
        name: '📈 Central de Partidas & Hall da Fama',
        value: `[Ver Detalhes do Mix no Hub](${roomUrl})`,
        inline: false,
      });
    }

    payload = {
      username: 'CS2 Mix Hub • Estatísticas da Partida',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: `🏆 RESULTADO & ESTATÍSTICAS DA PARTIDA: ${winner.toUpperCase()}`,
          description: `A partida competitiva no mapa **${mapName}** chegou ao fim com vitória do **${winner}**!\n\n**Placar Final:** 🛡️ CT **${scoreCT}**  ×  **${scoreTR}** TR 🔥`,
          color: 0xeab308, // Gold
          fields,
          footer: {
            text: `CS2 Mix Hub • Estatísticas Competitivas ao Vivo • ${roomName}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else {
    throw new Error(`Tipo de evento de webhook desconhecido: ${eventType}`);
  }

  const response = await fetch(webhookUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord Webhook recusou a mensagem (${response.status}): ${errorText}`);
  }

  return { success: true };
}
