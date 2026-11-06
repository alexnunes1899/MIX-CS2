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
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&appids_filter[0]=730`
      );
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        const cs2Game = gamesData.response?.games?.find((g) => g.appid === 730);
        if (cs2Game && typeof cs2Game.playtime_forever === 'number') {
          result.cs2Hours = Math.round(cs2Game.playtime_forever / 60);
        }
      }

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
      const locationMatch = xml.match(/<location><!\[CDATA\[(.*?)\]\]><\/location>/);
      if (locationMatch) {
        result.countryCode = locationMatch[1].slice(-2).toUpperCase();
      }

      // Most played games / CS2 in XML
      const cs2Match = xml.match(/<game>[\s\S]*?<appID>730<\/appID>[\s\S]*?<hoursOnRecord>(.*?)<\/hoursOnRecord>[\s\S]*?<\/game>/);
      if (cs2Match) {
        const hoursStr = cs2Match[1].replace(/,/g, '');
        result.cs2Hours = Math.round(Number(hoursStr)) || null;
      }
    }
  } catch (err) {
    console.warn('[STEAM_API] Erro ao consultar Steam XML:', err.message);
  }

  return result;
}
