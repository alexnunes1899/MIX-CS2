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

    const sideBadgeA = sideA === 'CT' ? '🛡️ CT (Defesa)' : '🔥 TR (Ataque)';
    const sideBadgeB = sideB === 'CT' ? '🛡️ CT (Defesa)' : '🔥 TR (Ataque)';

    const fields = [
      {
        name: '🗺️ Mapa Decidido',
        value: `**${mapName.toUpperCase()}** (\`${mapFile}\`) • Formato **${matchFormat}**`,
        inline: false,
      },
      {
        name: `🔵 ${nameA} — Começa ${sideBadgeA}`,
        value: `${listTeam(teamA)}\n*Média de Nível: Lvl ${metrics?.avgA ?? '-'}*`,
        inline: true,
      },
      {
        name: `🟠 ${nameB} — Começa ${sideBadgeB}`,
        value: `${listTeam(teamB)}\n*Média de Nível: Lvl ${metrics?.avgB ?? '-'}*`,
        inline: true,
      },
    ];

    if (connectCommand || serverIp) {
      fields.push({
        name: '⚡ Conexão ao Servidor CS2',
        value: `\`\`\`bash\n${connectCommand || `connect ${serverIp}`}\n\`\`\``,
        inline: false,
      });
    }

    if (roomUrl) {
      fields.push({
        name: '🌐 Link da Sala',
        value: `[Ver Estatísticas e Placar no Hub](${roomUrl})`,
        inline: false,
      });
    }

    payload = {
      username: 'CS2 Mix Hub',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80',
      embeds: [
        {
          title: `🏆 MIX PRONTO: ${roomName.toUpperCase()} • ${mapName.toUpperCase()}`,
          description: 'O processo de veto terminou! A partida está configurada e pronta para o aquecimento.',
          color: 0xf59e0b, // Amber 500
          fields,
          thumbnail: mapLogo ? { url: mapLogo } : undefined,
          image: mapImage ? { url: mapImage } : undefined,
          footer: {
            text: 'CS2 Mix Hub • Partida Competitiva',
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
