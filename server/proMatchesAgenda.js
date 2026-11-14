import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Pro Matches & Esports Agenda Service
 * Fetches real upcoming/live CS2 matches via PandaScore API (when configured) or
 * public Liquipedia Counter-Strike feed, converts timestamps to Brasília Time (BRT),
 * prioritizes Brazilian rosters, and fails transparently with official links when feeds are unavailable.
 */

const BR_TEAM_KEYWORDS = [
  'furia',
  'mibr',
  'pain',
  'imperial',
  'legacy',
  'red canids',
  'fluxo',
  'oddik',
  'sharks',
  'solid',
  '9z',
  'case',
  'bounty hunters',
  'hype',
  'galorys',
  'w7m',
  'yawara',
];

function isBrTeamName(name) {
  const lower = String(name || '').toLowerCase();
  return BR_TEAM_KEYWORDS.some((kw) => lower.includes(kw));
}

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatBrtDateTime(epochMs) {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) {
    return { timeBRT: 'A confirmar', dateBRT: '' };
  }
  const timeStr = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  });
  return { timeBRT: `${timeStr} BRT`, dateBRT: dateStr };
}

function countryCodeToFlag(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
  return String.fromCodePoint(...[...clean].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export class ProMatchesAgendaService {
  constructor() {
    this.cachedMatches = null;
    this.lastFetched = 0;
    this.cacheTtlMs = 5 * 60 * 1000;
    this.errorCacheTtlMs = 60 * 1000;
    this.lastFetchMeta = {
      source: 'none',
      error: null,
      fetchedAt: 0,
    };
  }

  _sortAndPrioritize(matches) {
    return [...matches].sort((a, b) => {
      const brDiff = (b.isBrMatch ? 1 : 0) - (a.isBrMatch ? 1 : 0);
      if (brDiff !== 0) return brDiff;
      const statusWeight = { LIVE: 0, UPCOMING: 1, FINISHED: 2 };
      const sw = (statusWeight[a.status] ?? 3) - (statusWeight[b.status] ?? 3);
      if (sw !== 0) return sw;
      return (a.beginAtTs || Number.MAX_SAFE_INTEGER) - (b.beginAtTs || Number.MAX_SAFE_INTEGER);
    });
  }

  normalizePandaScoreMatch(m) {
    if (!m) return null;
    const opps = Array.isArray(m.opponents) ? m.opponents : [];
    const oppA = opps[0]?.opponent || {};
    const oppB = opps[1]?.opponent || {};
    const nameA = oppA.name || 'TBD';
    const nameB = oppB.name || 'TBD';
    const flagA = isBrTeamName(nameA) ? '🇧🇷' : countryCodeToFlag(oppA.location);
    const flagB = isBrTeamName(nameB) ? '🇧🇷' : countryCodeToFlag(oppB.location);

    const results = Array.isArray(m.results) ? m.results : [];
    const scoreA = results.find((r) => r.team_id === oppA.id)?.score ?? 0;
    const scoreB = results.find((r) => r.team_id === oppB.id)?.score ?? 0;

    const status = m.status === 'running' ? 'LIVE' : m.status === 'finished' ? 'FINISHED' : 'UPCOMING';
    const beginAtTs = m.begin_at ? Date.parse(m.begin_at) : (m.scheduled_at ? Date.parse(m.scheduled_at) : Date.now());
    const { timeBRT, dateBRT } = formatBrtDateTime(beginAtTs);

    const officialStream =
      (Array.isArray(m.streams_list) && (m.streams_list.find((s) => s.language === 'pt')?.raw_url || m.streams_list[0]?.raw_url)) ||
      m.official_stream_url ||
      'https://www.twitch.tv/gaules';

    const format = m.number_of_games ? `MD${m.number_of_games}` : 'MD3';
    const tournament = [m.league?.name, m.serie?.full_name || m.tournament?.name].filter(Boolean).join(' • ') || 'Campeonato CS2';

    return {
      id: `ps-${m.id}`,
      teamA: { name: nameA, flag: flagA, score: scoreA },
      teamB: { name: nameB, flag: flagB, score: scoreB },
      status,
      currentMap: status === 'LIVE' ? `${format} (${scoreA}-${scoreB})` : format,
      format,
      tournament,
      timeBRT,
      dateBRT,
      streamUrl: officialStream,
      hltvUrl: 'https://www.hltv.org/matches',
      isBrMatch: isBrTeamName(nameA) || isBrTeamName(nameB),
      beginAtTs,
    };
  }

  async _fetchFromPandaScore(token) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    const [runningRes, upcomingRes] = await Promise.all([
      fetch('https://api.pandascore.co/csgo/matches/running?per_page=15', {
        headers,
        signal: AbortSignal.timeout(5000),
      }),
      fetch('https://api.pandascore.co/csgo/matches/upcoming?per_page=25', {
        headers,
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (!runningRes.ok && !upcomingRes.ok) {
      throw new Error(`PandaScore HTTP ${runningRes.status}/${upcomingRes.status}`);
    }

    const running = runningRes.ok ? await runningRes.json() : [];
    const upcoming = upcomingRes.ok ? await upcomingRes.json() : [];
    const combined = [...(Array.isArray(running) ? running : []), ...(Array.isArray(upcoming) ? upcoming : [])]
      .map((m) => this.normalizePandaScoreMatch(m))
      .filter(Boolean);

    return this._sortAndPrioritize(combined).slice(0, 10);
  }

  parseLiquipediaMatchesHtml(html, nowMs = Date.now()) {
    if (!html || typeof html !== 'string') return [];
    const tableBlocks = html.match(/<table[^>]*class="[^"]*infobox_matches_content[^"]*"[\s\S]*?<\/table>/gi) || [];
    const parsed = [];

    for (let i = 0; i < tableBlocks.length; i++) {
      const block = tableBlocks[i];
      const leftMatch = block.match(/class="team-left"[\s\S]*?(?:title="([^"]+)"|>([^<]+)<\/a>)/i);
      const rightMatch = block.match(/class="team-right"[\s\S]*?(?:title="([^"]+)"|>([^<]+)<\/a>)/i);

      const leftRaw = stripHtmlTags(
        (block.match(/<td[^>]*class="[^"]*team-left[^"]*"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || ''
      );
      const rightRaw = stripHtmlTags(
        (block.match(/<td[^>]*class="[^"]*team-right[^"]*"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || ''
      );

      const teamAName = leftRaw || (leftMatch?.[2] || leftMatch?.[1] || '').trim();
      const teamBName = rightRaw || (rightMatch?.[2] || rightMatch?.[1] || '').trim();
      if (!teamAName || !teamBName) continue;

      const tsMatch = block.match(/data-timestamp="(\d+)"/i);
      const epochMs = tsMatch ? Number(tsMatch[1]) * 1000 : nowMs;
      if (epochMs < nowMs - 4 * 60 * 60 * 1000) continue;

      const versusRaw = stripHtmlTags(
        (block.match(/<td[^>]*class="[^"]*versus[^"]*"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || ''
      );
      const scoreMatch = versusRaw.match(/(\d+)\s*[:\-]\s*(\d+)/);
      const scoreA = scoreMatch ? Number(scoreMatch[1]) : 0;
      const scoreB = scoreMatch ? Number(scoreMatch[2]) : 0;

      const isExplicitLive = /timer-object-countdown-live/i.test(block) || (epochMs <= nowMs && epochMs >= nowMs - 3 * 60 * 60 * 1000);
      const status = isExplicitLive ? 'LIVE' : 'UPCOMING';

      const formatMatch = versusRaw.match(/Bo\d+/i) || block.match(/\((Bo\d+)\)/i);
      const format = formatMatch ? formatMatch[0].toUpperCase().replace('BO', 'MD') : 'MD3';

      const tourneyBlock =
        (block.match(/<div[^>]*class="[^"]*league-icon-small-image[^"]*"[\s\S]*?title="([^"]+)"/i) || [])[1] ||
        stripHtmlTags((block.match(/<td[^>]*class="[^"]*match-filler[^"]*"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] || '');
      const tournament = (tourneyBlock || 'Campeonato CS2').slice(0, 70);

      const { timeBRT, dateBRT } = formatBrtDateTime(epochMs);
      const isBrMatch = isBrTeamName(teamAName) || isBrTeamName(teamBName);

      parsed.push({
        id: `lp-${epochMs}-${i}`,
        teamA: { name: teamAName, flag: isBrTeamName(teamAName) ? '🇧🇷' : '🌐', score: scoreA },
        teamB: { name: teamBName, flag: isBrTeamName(teamBName) ? '🇧🇷' : '🌐', score: scoreB },
        status,
        currentMap: status === 'LIVE' && scoreMatch ? `${format} (${scoreA}-${scoreB})` : format,
        format,
        tournament,
        timeBRT,
        dateBRT,
        streamUrl: isBrMatch ? 'https://www.twitch.tv/gaules' : 'https://liquipedia.net/counterstrike/Liquipedia:Matches',
        hltvUrl: 'https://www.hltv.org/matches',
        isBrMatch,
        beginAtTs: epochMs,
      });
    }

    return this._sortAndPrioritize(parsed).slice(0, 10);
  }

  async _fetchFromLiquipedia() {
    const res = await fetch(
      'https://liquipedia.net/counterstrike/api.php?action=parse&page=Liquipedia:Matches&prop=text&format=json',
      {
        headers: {
          'User-Agent': 'CS2MixHubBot/1.0 (https://github.com/alexnunes1899/MIX-CS2)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) {
      throw new Error(`Liquipedia HTTP ${res.status}`);
    }
    const json = await res.json();
    const html = json?.parse?.text?.['*'] || '';
    return this.parseLiquipediaMatchesHtml(html);
  }

  async getUpcomingMatches({ forceRefresh = false } = {}) {
    const now = Date.now();
    const activeTtl = this.lastFetchMeta.source === 'unavailable' ? this.errorCacheTtlMs : this.cacheTtlMs;
    if (!forceRefresh && Array.isArray(this.cachedMatches) && now - this.lastFetched < activeTtl) {
      return this.cachedMatches;
    }

    const pandaToken = (process.env.PANDASCORE_API_KEY || process.env.PANDASCORE_TOKEN || '').trim();
    if (pandaToken) {
      try {
        const matches = await this._fetchFromPandaScore(pandaToken);
        this.cachedMatches = matches;
        this.lastFetched = now;
        this.lastFetchMeta = { source: 'pandascore', error: null, fetchedAt: now };
        return matches;
      } catch (err) {
        this.lastFetchMeta = { source: 'pandascore_error', error: err.message, fetchedAt: now };
      }
    }

    try {
      const matches = await this._fetchFromLiquipedia();
      this.cachedMatches = matches;
      this.lastFetched = now;
      this.lastFetchMeta = {
        source: matches.length > 0 ? 'liquipedia' : 'empty',
        error: null,
        fetchedAt: now,
      };
      return matches;
    } catch (err) {
      this.cachedMatches = [];
      this.lastFetched = now;
      this.lastFetchMeta = { source: 'unavailable', error: err.message, fetchedAt: now };
      return [];
    }
  }

  buildEmbed(matches = [], meta = this.lastFetchMeta) {
    const safeMatches = Array.isArray(matches) ? matches : [];
    const embed = new EmbedBuilder()
      .setTitle('🏆 AGENDA DE JOGOS PRO CS2 — TIMES BRASILEIROS & MUNDIAL')
      .setColor(0x0284c7)
      .setThumbnail('https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg');

    if (safeMatches.length === 0) {
      const hasPandaKey = Boolean((process.env.PANDASCORE_API_KEY || process.env.PANDASCORE_TOKEN || '').trim());
      const detailReason = meta?.error
        ? `Não foi possível consultar o feed externo de partidas no momento (\`${String(meta.error).slice(0, 120)}\`).`
        : 'Nenhuma partida ao vivo ou agendada foi retornada pelo feed público neste momento.';

      embed.setDescription(
        `ℹ️ **Status do Feed:** ${detailReason}\n\n` +
        `Para não exibir placares ou horários falsos, a agenda mostra apenas jogos reais obtidos da **Liquipedia**` +
        `${hasPandaKey ? ' / **PandaScore API**' : ' (ou configure `PANDASCORE_API_KEY` no servidor para cobertura completa)'}.\n\n` +
        `Use os botões abaixo para conferir a agenda atualizada ao vivo na **HLTV**, **Draft5 (BR)**, **Liquipedia** ou assistir direto no **Gaules**!`
      );
    } else {
      const sourceLabel = meta?.source === 'pandascore' ? 'PandaScore API' : 'Liquipedia CS2';
      embed.setDescription(
        `Partidas reais ao vivo e programadas (priorizando **times brasileiros 🇧🇷**) • Fonte: **${sourceLabel}**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );

      const liveMatches = safeMatches.filter((m) => m.status === 'LIVE').slice(0, 5);
      const upcomingMatches = safeMatches.filter((m) => m.status === 'UPCOMING').slice(0, 6);
      const finishedMatches = safeMatches.filter((m) => m.status === 'FINISHED').slice(0, 3);

      if (liveMatches.length > 0) {
        const liveText = liveMatches
          .map(
            (m) =>
              `🔴 **[AO VIVO] ${m.teamA.flag} ${m.teamA.name} ${m.teamA.score} vs ${m.teamB.score} ${m.teamB.name} ${m.teamB.flag}**\n` +
              `📍 *${m.tournament}* • **Formato:** \`${m.currentMap}\` • [Assistir](${m.streamUrl})`
          )
          .join('\n\n')
          .slice(0, 1020);
        embed.addFields({ name: '🔥 PARTIDAS ACONTECENDO AGORA', value: liveText, inline: false });
      }

      if (upcomingMatches.length > 0) {
        const upText = upcomingMatches
          .map(
            (m) =>
              `🕒 **\`${m.dateBRT ? `${m.dateBRT} ` : ''}${m.timeBRT}\`** — ${m.teamA.flag} **${m.teamA.name}** vs **${m.teamB.name}** ${m.teamB.flag}\n` +
              `🏆 *${m.tournament}* (${m.format}) • [Stream](${m.streamUrl})`
          )
          .join('\n\n')
          .slice(0, 1020);
        embed.addFields({ name: '📅 PRÓXIMOS CONFRONTOS', value: upText, inline: false });
      }

      if (finishedMatches.length > 0) {
        const finText = finishedMatches
          .map(
            (m) =>
              `✅ **\`${m.timeBRT}\`** — ${m.teamA.flag} **${m.teamA.name}** **${m.teamA.score} x ${m.teamB.score}** ${m.teamB.name} ${m.teamB.flag} (*${m.tournament}*)`
          )
          .join('\n')
          .slice(0, 1020);
        embed.addFields({ name: '🏁 RESULTADOS RECENTES', value: finText, inline: false });
      }
    }

    embed.setFooter({
      text: 'CS2 Mix Hub Esports • Horários em Horário de Brasília (BRT / UTC-3)',
      iconURL: 'https://static.wikia.nocookie.net/cswikia/images/d/df/Twitch_glitch_purple.png',
    });
    embed.setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Assistir no Gaules')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.twitch.tv/gaules')
        .setEmoji('📺'),
      new ButtonBuilder()
        .setLabel('HLTV Match Center')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.hltv.org/matches')
        .setEmoji('📊'),
      new ButtonBuilder()
        .setLabel('Draft5 Agenda BR')
        .setStyle(ButtonStyle.Link)
        .setURL('https://draft5.gg/proximas-partidas')
        .setEmoji('🇧🇷'),
      new ButtonBuilder()
        .setLabel('Liquipedia CS2')
        .setStyle(ButtonStyle.Link)
        .setURL('https://liquipedia.net/counterstrike/Liquipedia:Matches')
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setLabel('BTS Brasil CS')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.twitch.tv/btsbrasilcs')
        .setEmoji('🎙️')
    );

    return { embeds: [embed], components: [row] };
  }
}

export const proMatchesAgenda = new ProMatchesAgendaService();
