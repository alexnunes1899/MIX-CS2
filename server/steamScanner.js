import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getSteamPlayerDetails } from './steamApi.js';

/**
 * Steam Profile & Anti-Smurf Scanner Service
 * Resolves Steam IDs, Vanity URLs, checks VAC/Economy bans, CS2 playtime,
 * calculates Smurf Risk Score, and generates rich Discord embeds.
 */

export class SteamScannerService {
  /**
   * Resolves raw user input (link, ID64, vanity name) into a valid SteamID64 or vanity query
   */
  static parseInput(input) {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();

    // 1. Direct SteamID64 (17 digits starting with 7656119)
    if (/^7656119\d{10}$/.test(clean)) {
      return { type: 'steamid64', value: clean };
    }

    // 2. Full profiles URL: https://steamcommunity.com/profiles/7656119...
    const profilesMatch = clean.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
    if (profilesMatch) {
      return { type: 'steamid64', value: profilesMatch[1] };
    }

    // 3. Vanity URL: https://steamcommunity.com/id/custom_name
    const idMatch = clean.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
    if (idMatch) {
      return { type: 'vanity', value: idMatch[1].replace(/\/$/, '') };
    }

    // 4. STEAM_0:X:Y format
    const steam2Match = clean.match(/^STEAM_[0-5]:([0-1]):(\d+)$/i);
    if (steam2Match) {
      const authServer = BigInt(steam2Match[1]);
      const authId = BigInt(steam2Match[2]);
      const steam64 = BigInt('76561197960265728') + (authId * 2n) + authServer;
      return { type: 'steamid64', value: steam64.toString() };
    }

    // 5. Default assume it is a vanity name if no spaces
    if (/^[a-zA-Z0-9_-]{2,32}$/.test(clean)) {
      return { type: 'vanity', value: clean };
    }

    return null;
  }

  /**
   * Resolves a vanity name to steamID64 via Steam Community XML
   */
  static async resolveVanityToSteamId(vanity) {
    try {
      const url = `https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const xml = await res.text();
        const idMatch = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
        if (idMatch) {
          const nameMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
          const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || xml.match(/<avatarFull>(.*?)<\/avatarFull>/);
          return {
            steamId: idMatch[1],
            personaName: nameMatch ? nameMatch[1] : vanity,
            avatarUrl: avatarMatch ? avatarMatch[1] : null,
          };
        }
      }
    } catch (e) {
      // Fallback silently
    }
    return null;
  }

  /**
   * Fetches full profile and calculates anti-smurf metrics
   */
  static async scanProfile(rawInput) {
    const parsed = this.parseInput(rawInput);
    if (!parsed) {
      throw new Error('Formato de perfil inválido. Use um link Steam, SteamID64 ou Vanity URL (ex: `!steam gaules` ou `!steam 7656119...`).');
    }

    let steamId = null;
    let personaName = null;
    let avatarUrl = null;

    if (parsed.type === 'steamid64') {
      steamId = parsed.value;
    } else {
      const resolved = await this.resolveVanityToSteamId(parsed.value);
      if (resolved && resolved.steamId) {
        steamId = resolved.steamId;
        personaName = resolved.personaName;
        avatarUrl = resolved.avatarUrl;
      } else {
        throw new Error(`Não foi possível encontrar a conta Steam associada a "${parsed.value}". Verifique se o perfil existe.`);
      }
    }

    // Fetch details from SteamApi helper
    const details = await getSteamPlayerDetails(steamId);

    // If personaName or avatar not yet found, try XML fetch
    if (!personaName || !avatarUrl) {
      try {
        const xmlRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
          signal: AbortSignal.timeout(3500),
        });
        if (xmlRes.ok) {
          const xml = await xmlRes.text();
          const n = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
          if (n && !personaName) personaName = n[1];
          const a = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || xml.match(/<avatarFull>(.*?)<\/avatarFull>/);
          if (a && !avatarUrl) avatarUrl = a[1];
        }
      } catch (e) {}
    }

    // Calculate Smurf Risk Score (0-100)
    let smurfScore = 0;
    const reasons = [];

    // Factor 1: CS2 Playtime
    const cs2Hours = details.cs2Hours || 0;
    if (cs2Hours === 0) {
      smurfScore += 35;
      reasons.push('Nenhuma hora ou perfil privado de CS2');
    } else if (cs2Hours < 150) {
      smurfScore += 40;
      reasons.push(`Apenas ${cs2Hours}h de CS2 registradas`);
    } else if (cs2Hours < 400) {
      smurfScore += 20;
      reasons.push(`Pouco tempo de jogo (${cs2Hours}h)`);
    } else if (cs2Hours > 1200) {
      smurfScore -= 20;
    }

    // Factor 2: Account Age
    const ageYears = details.accountAgeYears || 0;
    if (ageYears <= 1) {
      smurfScore += 35;
      reasons.push('Conta recente criada há menos de 1 ano');
    } else if (ageYears <= 2) {
      smurfScore += 15;
      reasons.push('Conta com menos de 2 anos de existência');
    } else if (ageYears >= 6) {
      smurfScore -= 25;
    }

    // Factor 3: Bans
    if (details.vacBanned || details.vacBansCount > 0) {
      smurfScore += 45;
      reasons.push(`Possui ${details.vacBansCount || 1} banimento(s) VAC ativo(s)`);
    }
    if (details.communityBanned) {
      smurfScore += 25;
      reasons.push('Banimento da comunidade Steam');
    }

    // Clamp score
    smurfScore = Math.max(0, Math.min(100, smurfScore));

    // Determine status badge
    let badge = '🛡️ CONTA CONFIÁVEL / VETERANA';
    let color = 0x22c55e; // Green
    let riskLabel = 'Baixo Risco';

    if (details.vacBanned) {
      badge = '🚨 CONTA COM BANIMENTO VAC';
      color = 0xef4444; // Red
      riskLabel = 'Alerta Máximo (Banned)';
    } else if (smurfScore >= 60) {
      badge = '⚠️ ALTO RISCO DE SMURF / CONTA SECUNDÁRIA';
      color = 0xf59e0b; // Orange/Amber
      riskLabel = 'Alto Risco de Smurf';
    } else if (smurfScore >= 35) {
      badge = '🔍 ATENÇÃO: POSSÍVEL SMURF';
      color = 0xeab308; // Yellow
      riskLabel = 'Risco Moderado';
    }

    return {
      steamId,
      personaName: personaName || `SteamUser_${steamId.slice(-6)}`,
      avatarUrl: avatarUrl || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
      profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
      cs2Hours,
      vacBanned: details.vacBanned,
      vacBansCount: details.vacBansCount,
      communityBanned: details.communityBanned,
      economyBanned: details.economyBanned,
      createdYear: details.createdYear,
      accountAgeYears: ageYears,
      countryCode: details.countryCode || 'BR',
      smurfScore,
      riskLabel,
      badge,
      color,
      reasons,
    };
  }

  /**
   * Generates Discord Embed and ActionRow buttons
   */
  static buildEmbed(scanData) {
    const embed = new EmbedBuilder()
      .setTitle(`🔎 SCANNER STEAM & ANTI-SMURF: ${scanData.personaName}`)
      .setURL(scanData.profileUrl)
      .setThumbnail(scanData.avatarUrl)
      .setColor(scanData.color)
      .setDescription(
        `**Status:** \`${scanData.badge}\`\n` +
        `**Índice de Suspeita Smurf:** \`${scanData.smurfScore}%\` (${scanData.riskLabel})\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '🔫 Horas de CS2',
          value: scanData.cs2Hours > 0 ? `**${scanData.cs2Hours} horas**` : '*Privado ou 0 horas*',
          inline: true,
        },
        {
          name: '⏳ Idade da Conta',
          value: scanData.createdYear
            ? `**${scanData.accountAgeYears} anos** (Criada em ${scanData.createdYear})`
            : '*Não informada*',
          inline: true,
        },
        {
          name: '🛡️ Histórico de Bans',
          value: scanData.vacBanned
            ? `❌ **BANIMENTO VAC DETECTADO (${scanData.vacBansCount})**`
            : '✅ **Nenhum banimento VAC**',
          inline: true,
        },
        {
          name: '🌍 Região / País',
          value: `🇧🇷 **${scanData.countryCode}**`,
          inline: true,
        },
        {
          name: '🔒 Status da Comunidade',
          value: scanData.communityBanned ? '❌ Banido da Comunidade' : '✅ 100% Regular',
          inline: true,
        },
        {
          name: '🆔 SteamID 64',
          value: `\`${scanData.steamId}\``,
          inline: true,
        }
      );

    if (scanData.reasons.length > 0) {
      embed.addFields({
        name: '⚠️ Fatores Analisados pelo Scanner',
        value: scanData.reasons.map((r) => `• ${r}`).join('\n'),
        inline: false,
      });
    }

    embed.setFooter({
      text: 'CS2 Mix Hub • Detecção Inteligente Anti-Smurf & Integridade Competitiva',
      iconURL: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg',
    });
    embed.setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Ver Perfil Steam')
        .setStyle(ButtonStyle.Link)
        .setURL(scanData.profileUrl)
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setLabel('csgostats.gg')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://csgostats.gg/player/${scanData.steamId}`)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setLabel('Faceit Finder')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://faceitfinder.com/profile/${scanData.steamId}`)
        .setEmoji('🏆')
    );

    return { embeds: [embed], components: [row] };
  }
}
