// Valve CS2 & FACEIT Data API Integration
const DEFAULT_FACEIT_API_KEY = '95cbdb9a-f1d9-4768-a62e-318453b259a8';

export async function fetchFaceitPlayer({ steamId, nickname }) {
  const apiKey = process.env.FACEIT_API_KEY || DEFAULT_FACEIT_API_KEY;
  if (!apiKey) return null;

  const headers = { Authorization: `Bearer ${apiKey}` };

  // 1. Try lookup by SteamID64 (CS2)
  if (steamId) {
    try {
      const res = await fetch(`https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const cs = data.games?.cs2 || data.games?.csgo;
        if (cs) {
          return {
            found: true,
            nickname: data.nickname,
            level: cs.skill_level || 1,
            elo: cs.faceit_elo || 1000,
          };
        }
      }
    } catch (e) {}

    // 1b. Try lookup by SteamID64 (CS:GO fallback)
    try {
      const res = await fetch(`https://open.faceit.com/data/v4/players?game=csgo&game_player_id=${steamId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const cs = data.games?.cs2 || data.games?.csgo;
        if (cs) {
          return {
            found: true,
            nickname: data.nickname,
            level: cs.skill_level || 1,
            elo: cs.faceit_elo || 1000,
          };
        }
      }
    } catch (e) {}
  }

  // 2. Try lookup by Nickname if provided
  if (nickname) {
    try {
      const res = await fetch(`https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname.trim())}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const cs = data.games?.cs2 || data.games?.csgo;
        if (cs) {
          return {
            found: true,
            nickname: data.nickname,
            level: cs.skill_level || 1,
            elo: cs.faceit_elo || 1000,
          };
        }
      }
    } catch (e) {}

    // 2b. Try search players by partial nickname
    try {
      const searchRes = await fetch(`https://open.faceit.com/data/v4/search/players?nickname=${encodeURIComponent(nickname.trim())}&limit=10`, { headers });
      if (searchRes.ok) {
        const sData = await searchRes.json();
        if (sData.items && sData.items.length > 0) {
          // Prioritize Brazilian account or first match
          const targetPlayer = sData.items.find((it) => it.country === 'BR') || sData.items[0];
          const pRes = await fetch(`https://open.faceit.com/data/v4/players/${targetPlayer.player_id}`, { headers });
          if (pRes.ok) {
            const pData = await pRes.json();
            const cs = pData.games?.cs2 || pData.games?.csgo;
            if (cs) {
              return {
                found: true,
                nickname: pData.nickname,
                level: cs.skill_level || 1,
                elo: cs.faceit_elo || 1000,
              };
            }
          }
        }
      }
    } catch (e) {}
  }

  return null;
}
