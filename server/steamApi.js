/**
 * Valve Steam Web API & Public Profile Service
 * Retrieves CS2 playtime, VAC ban history, and account longevity.
 */

export async function getSteamPlayerDetails(steamId) {
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    throw new Error('Steam ID 64 inválido.');
  }

  const apiKey = process.env.STEAM_API_KEY;

  let result = {
    steamId,
    cs2Hours: null,
    vacBanned: false,
    vacBansCount: 0,
    communityBanned: false,
    economyBanned: 'none',
    accountAgeYears: null,
    createdYear: null,
    countryCode: null,
    source: 'Steam Community',
  };

  // 1. Try official Steam Web API if key is available
  if (apiKey) {
    try {
      // Get VAC / Community Bans
      const bansRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${apiKey}&steamids=${steamId}`
      );
      if (bansRes.ok) {
        const bansData = await bansRes.json();
        const playerBan = bansData.players?.[0];
        if (playerBan) {
          result.vacBanned = Boolean(playerBan.VACBanned);
          result.vacBansCount = Number(playerBan.NumberOfVACBans) || 0;
          result.communityBanned = Boolean(playerBan.CommunityBanned);
          result.economyBanned = playerBan.EconomyBan || 'none';
        }
      }

      // Get CS2 Playtime (AppID 730)
      try {
        const gamesRes = await fetch(
          `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`
        );
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          const cs2Game = gamesData.response?.games?.find((g) => g.appid === 730 || g.appid === '730');
          if (cs2Game && typeof cs2Game.playtime_forever === 'number') {
            result.cs2Hours = Math.round(cs2Game.playtime_forever / 60);
          }
        }
      } catch (e) {}

      // Get Account Creation Date & Country
      const summaryRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`
      );
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        const p = summaryData.response?.players?.[0];
        if (p) {
          if (p.timecreated) {
            const createdDate = new Date(p.timecreated * 1000);
            result.createdYear = createdDate.getFullYear();
            result.accountAgeYears = Math.max(1, new Date().getFullYear() - result.createdYear);
          }
          if (p.loccountrycode) {
            result.countryCode = p.loccountrycode;
          }
        }
      }

      result.source = 'Steam Web API Oficial';
      return result;
    } catch (err) {
      console.warn('[STEAM_API] Erro ao consultar Web API oficial:', err.message);
    }
  }

  // 2. Fallback to Steam Community Public XML (Free, no API key required)
  try {
    const xmlRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
    if (xmlRes.ok) {
      const xml = await xmlRes.text();

      // VAC status
      const vacBanned = xml.includes('<vacBanned>1</vacBanned>');
      result.vacBanned = vacBanned;

      // Member since
      const memberSinceMatch = xml.match(/<memberSince>(.*?)<\/memberSince>/);
      if (memberSinceMatch) {
        const rawDate = memberSinceMatch[1];
        const yearMatch = rawDate.match(/\b(20\d\d)\b/);
        if (yearMatch) {
          result.createdYear = Number(yearMatch[1]);
          result.accountAgeYears = Math.max(1, new Date().getFullYear() - result.createdYear);
        }
      }

      // Location
      const locationMatch = xml.match(/<location><!\[CDATA\[(.*?)\]\]><\/location>/) || xml.match(/<location>(.*?)<\/location>/);
      if (locationMatch && locationMatch[1]) {
        result.countryCode = locationMatch[1].slice(-2).toUpperCase();
      }

      // Most played games / CS2 in XML (Matches <mostPlayedGame> or <game>)
      const cs2Match = xml.match(/(?:<mostPlayedGame>|<game>)[\s\S]*?(?:730|Counter-Strike)[\s\S]*?<hoursOnRecord>(.*?)<\/hoursOnRecord>[\s\S]*?(?:<\/mostPlayedGame>|<\/game>)/i);
      if (cs2Match) {
        const hoursStr = cs2Match[1].replace(/,/g, '');
        result.cs2Hours = Math.round(Number(hoursStr)) || null;
      }

      // Custom Vanity URL
      const customUrlMatch = xml.match(/<customURL><!\[CDATA\[(.*?)\]\]><\/customURL>/) || xml.match(/<customURL>(.*?)<\/customURL>/);
      const customUrl = customUrlMatch ? customUrlMatch[1].trim() : null;

      // If hours not found yet, check customURL XML
      if (!result.cs2Hours && customUrl) {
        try {
          const vanityRes = await fetch(`https://steamcommunity.com/id/${customUrl}/?xml=1`);
          if (vanityRes.ok) {
            const vXml = await vanityRes.text();
            const vMatch = vXml.match(/(?:<mostPlayedGame>|<game>)[\s\S]*?(?:730|Counter-Strike)[\s\S]*?<hoursOnRecord>(.*?)<\/hoursOnRecord>[\s\S]*?(?:<\/mostPlayedGame>|<\/game>)/i);
            if (vMatch) {
              result.cs2Hours = Math.round(Number(vMatch[1].replace(/,/g, ''))) || null;
            }
          }
        } catch (e) {}
      }

      // Check stats XML endpoint
      if (!result.cs2Hours) {
        try {
          const statsUrl = customUrl
            ? `https://steamcommunity.com/id/${customUrl}/stats/CSGO/?xml=1`
            : `https://steamcommunity.com/profiles/${steamId}/stats/CSGO/?xml=1`;
          const statsRes = await fetch(statsUrl);
          if (statsRes.ok) {
            const statsXml = await statsRes.text();
            const hMatch = statsXml.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/) || statsXml.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
            if (hMatch && Number(hMatch[1]) > 0) {
              result.cs2Hours = Math.round(Number(hMatch[1].replace(/,/g, ''))) || null;
            }
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[STEAM_API] Erro ao consultar Steam XML:', err.message);
  }

  return result;
}
