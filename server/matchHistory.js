/**
 * Unified Match History Manager (CS2 Mix Hub)
 * Persists, normalizes and serves matches recorded via Discord Bot and Web Site.
 * Stored in server/data/matchHistory.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'matchHistory.json');
const DEFAULT_MATCH_HISTORY_FILE = path.join(__dirname, 'data', 'matchHistory.default.json');

const MAP_IMAGES = {
  de_mirage: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png',
  mirage: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png',
  de_inferno: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_1_png.png',
  inferno: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_1_png.png',
  de_nuke: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_nuke_1_png.png',
  nuke: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_nuke_1_png.png',
  de_dust2: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
  dust2: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
  'dust ii': 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
  'dust 2': 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
  de_ancient: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
  ancient: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
  de_anubis: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
  anubis: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
  de_cache: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
  cache: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
  de_vertigo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_vertigo_1_png.png',
  vertigo: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_vertigo_1_png.png',
  de_overpass: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_overpass_1_png.png',
  overpass: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_overpass_1_png.png',
  de_train: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_train_1_png.png',
  train: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_train_1_png.png',
};

export function normalizeMapName(mapName = '') {
  if (typeof mapName === 'object' && mapName !== null) {
    mapName = mapName.name || mapName.id || mapName.file || '';
  }
  const raw = String(mapName || '').trim();
  const lower = raw.toLowerCase().replace(/^de_/, '');
  if (lower.includes('dust')) return 'Dust II';
  if (lower.includes('mirage')) return 'Mirage';
  if (lower.includes('inferno')) return 'Inferno';
  if (lower.includes('nuke')) return 'Nuke';
  if (lower.includes('ancient')) return 'Ancient';
  if (lower.includes('anubis')) return 'Anubis';
  if (lower.includes('cache')) return 'Cache';
  if (lower.includes('vertigo')) return 'Vertigo';
  if (lower.includes('overpass')) return 'Overpass';
  if (lower.includes('train')) return 'Train';
  return raw || 'Mirage';
}

let listeners = [];

function ensureDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('[MATCH_HISTORY] Falha ao criar pasta data:', e.message);
  }
}

export function getMapImageUrl(mapName = '') {
  const norm = normalizeMapName(mapName).toLowerCase();
  const key = String(mapName || '').toLowerCase().trim();
  return MAP_IMAGES[norm] || MAP_IMAGES[key] || MAP_IMAGES[key.replace('de_', '')] || MAP_IMAGES.mirage;
}

export function normalizePlayerName(raw = '') {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics/accents
    .toLowerCase()
    .replace(/[\[\(\{].*?[\]\)\}]/g, '') // remove clan tags like [TAG] or (Clan)
    .replace(/[^a-z0-9]/g, '') // strip emojis, symbols, flags, spaces
    .trim();
}

export function extractNameTokens(raw = '') {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\[\(\{].*?[\]\)\}]/g, ' ')
    .split(/[^a-z0-9]+/)
    .map((t) => t.replace(/\d+$/, '').trim())
    .filter((t) => t.length >= 3);
}

/**
 * Accurately determines the winning team (Team A or Team B) in CS2,
 * correctly taking into account side switches (MR12 regulation half-time)
 * and player active team rosters at the moment of gameover.
 */
export function determineMatchWinner(mix = {}, liveState = {}) {
  const scoreCT = Number(liveState?.scoreCT ?? liveState?.score_ct ?? 0);
  const scoreTR = Number(liveState?.scoreTR ?? liveState?.score_t ?? 0);
  const winningSide = scoreCT > scoreTR ? 'CT' : scoreTR > scoreCT ? 'TR' : 'DRAW';

  if (winningSide === 'DRAW') {
    return { winnerLetter: 'A', scoreCT, scoreTR, winningSide, method: 'draw_default' };
  }

  const teamAPlayers = Array.isArray(mix.teamA?.players)
    ? mix.teamA.players
    : Array.isArray(mix.teamA)
    ? mix.teamA
    : [];

  const gsiStatsList = liveState.allPlayersStats || liveState.allplayers || [];
  const gsiPlayersList = Array.isArray(gsiStatsList)
    ? gsiStatsList
    : typeof gsiStatsList === 'object'
    ? Object.entries(gsiStatsList).map(([steamId, p]) => ({ steamId, ...p }))
    : [];

  // Method 1: Check active team affiliation of players in CS2 right now
  let teamACtCount = 0;
  let teamATrCount = 0;

  teamAPlayers.forEach((p) => {
    const pNick = p.nick || p.displayName || p.username || '';
    const pSteam = String(p.steamId || p.steamid || '');
    const cleanP = normalizePlayerName(pNick);
    const tokensP = extractNameTokens(pNick);

    const match = gsiPlayersList.find((g) => {
      const gSteam = String(g.steamId || g.steamid || '');
      if (pSteam && gSteam && pSteam === gSteam) return true;
      const cleanG = normalizePlayerName(g.name);
      if (cleanP && cleanG && cleanP === cleanG) return true;
      if (cleanP.length >= 3 && cleanG.length >= 3 && (cleanP.includes(cleanG) || cleanG.includes(cleanP))) return true;
      const tokensG = extractNameTokens(g.name);
      if (tokensP.length > 0 && tokensG.length > 0) {
        if (tokensP.some((tp) => tokensG.some((tg) => tp === tg || tp.startsWith(tg) || tg.startsWith(tp)))) {
          return true;
        }
      }
      return false;
    });

    if (match) {
      const team = String(match.team || '').toUpperCase();
      if (team === 'CT') teamACtCount++;
      else if (team === 'TR' || team === 'T') teamATrCount++;
    }
  });

  if (teamACtCount > 0 || teamATrCount > 0) {
    const teamACurrentSide = teamACtCount >= teamATrCount ? 'CT' : 'TR';
    const isWinnerA = teamACurrentSide === winningSide;
    return {
      winnerLetter: isWinnerA ? 'A' : 'B',
      scoreCT,
      scoreTR,
      winningSide,
      teamACurrentSide,
      method: 'player_side_inspection',
    };
  }

  // Method 2: Regulation half-time switch calculation (MR12)
  const teamACurrentOrStart =
    mix.teamA?.halftimeSwapped && mix.teamA?.side
      ? (String(mix.teamA.side).toUpperCase() === 'CT' ? 'TR' : 'CT')
      : mix.teamA?.side;
  const vetoStart = mix.veto?.sidePick?.teamBSide
    ? (String(mix.veto.sidePick.teamBSide).toUpperCase() === 'CT' ? 'TR' : 'CT')
    : null;
  const startingSideA = String(
    mix.teamA?.startingSide || mix.startingSideA || teamACurrentOrStart || vetoStart || 'CT'
  ).toUpperCase();
  const totalRounds = scoreCT + scoreTR;

  let currentSideA = startingSideA;
  if (totalRounds <= 24) {
    // Regulation MR12: sides swap after round 12
    currentSideA = totalRounds > 12 ? (startingSideA === 'CT' ? 'TR' : 'CT') : startingSideA;
  } else {
    // Overtime (MR3): 6 rounds per OT (3 rounds per half)
    const otRounds = (totalRounds - 24) % 6;
    currentSideA = (otRounds > 0 && otRounds <= 3) ? startingSideA : (startingSideA === 'CT' ? 'TR' : 'CT');
  }

  const isWinnerA = currentSideA === winningSide;
  return {
    winnerLetter: isWinnerA ? 'A' : 'B',
    scoreCT,
    scoreTR,
    winningSide,
    teamACurrentSide: currentSideA,
    method: 'halftime_math_calculation',
  };
}

/**
 * Extracts and computes official match performers (MVP and Bagre) with accurate CS2 GSI statistics.
 * Normalizes player names to match steam accounts despite emojis, clan tags and symbols.
 */
export function computeMatchPerformers(matchData = {}, gsiState = null) {
  const winnerPlayers = Array.isArray(matchData.winnerPlayers)
    ? matchData.winnerPlayers
    : Array.isArray(matchData.teamA)
    ? matchData.teamA
    : [];
  const loserPlayers = Array.isArray(matchData.loserPlayers)
    ? matchData.loserPlayers
    : Array.isArray(matchData.teamB)
    ? matchData.teamB
    : [];

  const allPlayers = [...winnerPlayers, ...loserPlayers];
  const rawGsi = gsiState?.allPlayersStats || matchData.allPlayersStats || gsiState?.allplayers || [];
  const gsiStatsList = (Array.isArray(rawGsi)
    ? rawGsi
    : typeof rawGsi === 'object'
    ? Object.entries(rawGsi).map(([steamId, p]) => ({ steamId, ...p }))
    : []
  ).filter((g) => g && (g.name || g.steamId));

  if (allPlayers.length === 0 && gsiStatsList.length === 0) {
    return { mvp: null, bagre: null, evaluatedPlayers: [], hasRealGsiStats: false };
  }

  const roundsPlayed = Math.max(
    1,
    (Number(matchData.scoreWinner ?? gsiState?.scoreCT) || 13) +
      (Number(matchData.scoreLoser ?? gsiState?.scoreTR) || 8)
  );

  let hasRealGsiStats = false;
  const matchedGsiSet = new Set();
  const playerToGsiMap = new Map();

  allPlayers.forEach((p, idx) => {
    const pNick = p.nick || p.displayName || p.username || p.name || `Jogador ${idx + 1}`;
    const pSteamId = String(p.steamId || p.steamid || '');
    const cleanNick = normalizePlayerName(pNick);
    const tokensP = extractNameTokens(pNick);

    let matchedGsi = null;
    if (pSteamId) {
      matchedGsi = gsiStatsList.find((g) => {
        if (matchedGsiSet.has(g)) return false;
        const gSteam = String(g.steamId || g.steamid || '');
        return gSteam && gSteam === pSteamId;
      });
    }

    if (!matchedGsi && cleanNick) {
      matchedGsi = gsiStatsList.find((g) => {
        if (matchedGsiSet.has(g)) return false;
        const cleanG = normalizePlayerName(g.name);
        return cleanG && cleanG === cleanNick;
      });

      if (!matchedGsi && cleanNick.length >= 3) {
        matchedGsi = gsiStatsList.find((g) => {
          if (matchedGsiSet.has(g)) return false;
          const cleanG = normalizePlayerName(g.name);
          return cleanG && cleanG.length >= 3 && (cleanNick.includes(cleanG) || cleanG.includes(cleanNick));
        });
      }

      if (!matchedGsi && tokensP.length > 0) {
        matchedGsi = gsiStatsList.find((g) => {
          if (matchedGsiSet.has(g)) return false;
          const tokensG = extractNameTokens(g.name);
          return (
            tokensG.length > 0 &&
            tokensP.some((tp) => tokensG.some((tg) => tp === tg || tp.startsWith(tg) || tg.startsWith(tp)))
          );
        });
      }
    }

    if (matchedGsi) {
      matchedGsiSet.add(matchedGsi);
      playerToGsiMap.set(p, matchedGsi);
      if (matchedGsi.kills > 0 || matchedGsi.deaths > 0 || matchedGsi.score > 0) {
        hasRealGsiStats = true;
      }
    }
  });

  const remainingGsi = gsiStatsList.filter((g) => !matchedGsiSet.has(g));
  if (remainingGsi.length > 0) {
    const scoreCT = Number(gsiState?.scoreCT ?? 0);
    const scoreTR = Number(gsiState?.scoreTR ?? 0);
    const winSide = scoreCT >= scoreTR ? 'CT' : 'TR';

    allPlayers.forEach((p) => {
      if (playerToGsiMap.has(p)) return;
      const isWinner = winnerPlayers.some((w) => (w.id && w.id === p.id) || (w.nick && w.nick === p.nick));
      const desiredSide = isWinner ? winSide : winSide === 'CT' ? 'TR' : 'CT';
      const idx = remainingGsi.findIndex((g) => (g.team || 'CT') === desiredSide);
      const chosen = idx !== -1 ? remainingGsi.splice(idx, 1)[0] : remainingGsi.shift();
      if (chosen) {
        matchedGsiSet.add(chosen);
        playerToGsiMap.set(p, chosen);
        if (chosen.kills > 0 || chosen.deaths > 0 || chosen.score > 0) {
          hasRealGsiStats = true;
        }
      }
    });
  }

  const hasDirectPlayerStats = allPlayers.some(
    (p) => p && (Number(p.kills) > 0 || Number(p.deaths) > 0 || Number(p.score) > 0)
  );
  const hasAnyRealStats = hasRealGsiStats || hasDirectPlayerStats;

  if (!hasAnyRealStats) {
    return { mvp: null, bagre: null, evaluatedPlayers: [], hasRealGsiStats: false };
  }

  const calcRating = (kills, deaths, assists, mvps, isWinner) => {
    const kpr = kills / roundsPlayed;
    const survivalRate = Math.max(0, (roundsPlayed - deaths) / roundsPlayed);
    const apr = assists / roundsPlayed;
    const impact = Math.max(0.2, 2.13 * kpr + 0.42 * apr - 0.41);
    const mvpBonus = (mvps / roundsPlayed) * 0.85;
    const winBonus = isWinner ? 0.05 : -0.02;

    const ratingRaw =
      (kpr / 0.679) * 0.42 +
      (survivalRate / 0.317) * 0.22 +
      impact * 0.26 +
      mvpBonus +
      winBonus;

    const rating = Number(Math.max(0.20, Math.min(2.80, ratingRaw)).toFixed(2));
    const performanceScore = rating + kills * 0.025 - deaths * 0.015 + assists * 0.005 + mvps * 0.04;
    return { rating, performanceScore };
  };

  const evaluatedPlayers = allPlayers.map((p, idx) => {
    const isWinner = winnerPlayers.some((w) => (w.id && w.id === p.id) || (w.nick && w.nick === p.nick));
    const pNick = p.nick || p.displayName || p.username || p.name || `Jogador ${idx + 1}`;
    const pSteamId = String(p.steamId || p.steamid || '');
    const matchedGsi = playerToGsiMap.get(p) || null;
    const hasPlayerStat =
      Boolean(matchedGsi && (matchedGsi.kills > 0 || matchedGsi.deaths > 0 || matchedGsi.score > 0)) ||
      Number(p.kills) > 0 ||
      Number(p.deaths) > 0 ||
      Number(p.score) > 0;

    const kills = matchedGsi ? Number(matchedGsi.kills || 0) : (typeof p.kills === 'number' ? p.kills : 0);
    const deaths = matchedGsi ? Number(matchedGsi.deaths || 0) : (typeof p.deaths === 'number' ? p.deaths : 0);
    const assists = matchedGsi ? Number(matchedGsi.assists || 0) : (typeof p.assists === 'number' ? p.assists : 0);
    const mvps = matchedGsi ? Number(matchedGsi.mvps || 0) : (typeof p.mvps === 'number' ? p.mvps : 0);
    const score = matchedGsi ? Number(matchedGsi.score || 0) : (typeof p.score === 'number' ? p.score : 0);

    const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));
    const { rating, performanceScore } = calcRating(kills, deaths, assists, mvps, isWinner);

    return {
      id: p.id || `p-${idx}`,
      nick: pNick,
      cs2Name: matchedGsi?.name || pNick,
      avatar: p.avatar || '',
      steamId: pSteamId || matchedGsi?.steamId || '',
      level: p.level || 16,
      phone: p.phone || null,
      isWinner,
      kills,
      deaths,
      assists,
      mvps,
      score,
      kd,
      rating,
      performanceScore,
      isRealGsi: hasPlayerStat,
    };
  });

  remainingGsi.forEach((g, idx) => {
    if (!g || (g.kills === 0 && g.deaths === 0 && g.score === 0)) return;
    hasRealGsiStats = true;
    const scoreCT = Number(gsiState?.scoreCT ?? 0);
    const scoreTR = Number(gsiState?.scoreTR ?? 0);
    const isWinner = (g.team === 'CT' && scoreCT >= scoreTR) || (g.team === 'TR' && scoreTR > scoreCT);
    const kills = Number(g.kills || 0);
    const deaths = Number(g.deaths || 0);
    const assists = Number(g.assists || 0);
    const mvps = Number(g.mvps || 0);
    const score = Number(g.score || 0);
    const kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));
    const { rating, performanceScore } = calcRating(kills, deaths, assists, mvps, isWinner);

    evaluatedPlayers.push({
      id: g.steamId || `cs2-${idx}`,
      nick: g.name || `Jogador CS2`,
      cs2Name: g.name || `Jogador CS2`,
      avatar: '',
      steamId: g.steamId || '',
      level: 16,
      isWinner,
      kills,
      deaths,
      assists,
      mvps,
      score,
      kd,
      rating,
      performanceScore,
      isRealGsi: true,
    });
  });

  const realEvaluated = evaluatedPlayers.filter((p) => p.isRealGsi);
  const poolForAwards = realEvaluated.length > 0 ? realEvaluated : evaluatedPlayers;

  const sortedDesc = [...poolForAwards].sort(
    (a, b) => b.performanceScore - a.performanceScore || b.kills - a.kills || b.kd - a.kd || b.mvps - a.mvps
  );
  const best = sortedDesc[0] || evaluatedPlayers[0] || null;

  const sortedAsc = [...poolForAwards].sort(
    (a, b) => a.performanceScore - b.performanceScore || a.kills - b.kills || b.deaths - a.deaths
  );
  let worst = sortedAsc.length > 1 ? sortedAsc[0] : null;
  if (worst && best && worst.id === best.id) {
    worst = sortedAsc.find((p) => p.id !== best.id) || sortedAsc[1] || null;
  }

  const allSortedDesc = [...evaluatedPlayers].sort(
    (a, b) => b.performanceScore - a.performanceScore || b.kills - a.kills || b.kd - a.kd
  );

  return {
    mvp: best,
    bagre: worst,
    evaluatedPlayers: allSortedDesc,
    hasRealGsiStats: hasRealGsiStats || hasDirectPlayerStats,
  };
}

export function computeMatchMvp(matchData = {}, gsiState = null) {
  const result = computeMatchPerformers(matchData, gsiState);
  return result.mvp;
}

export function isValidMatchRecord(m) {
  if (!m || typeof m !== 'object') return false;
  if (!m.id || !m.winner || !m.score) return false;

  const idStr = String(m.id || '');
  if (idStr.startsWith('seed-') || idStr.startsWith('test-')) return false;

  const winPlayers = Array.isArray(m.winnerPlayers) ? m.winnerPlayers : [];
  const losePlayers = Array.isArray(m.loserPlayers) ? m.loserPlayers : [];
  const total = winPlayers.length + losePlayers.length;

  if (total < 2) return false;

  const hasDummyUsers = [...winPlayers, ...losePlayers].some(
    (p) => String(p.id || '').startsWith('user_test_') || String(p.nick || '').startsWith('Player_')
  );
  if (hasDummyUsers) return false;

  return true;
}
export function normalizeMatchRecord(m = {}) {
  const ts = m.timestamp || Date.now();
  const dateObj = new Date(ts);
  const dateStr = dateObj.toLocaleDateString('pt-BR');
  const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const source = m.source || 'discord';
  const isDiscord = source === 'discord';
  const cleanMap = normalizeMapName(m.map || 'Mirage');

  const record = {
    id: m.id || `MIX-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    source,
    platform: m.platform || (isDiscord ? 'Discord Bot' : 'Site Web'),
    sourceLabel: isDiscord ? 'Via Discord' : 'Via Site Web',
    guildName: m.guildName || (isDiscord ? 'Servidor Discord' : ''),
    guildId: m.guildId || '',
    channelName: m.channelName || (isDiscord ? '#mix-5v5' : ''),
    channelId: m.channelId || '',
    roomName: m.roomName || (!isDiscord ? 'Sala Principal' : ''),
    roomId: m.roomId || '',
    timestamp: ts,
    date: m.date || dateStr,
    time: m.time || timeStr,
    dateFormatted: `${dateStr} às ${timeStr}`,
    map: cleanMap,
    mapImage: getMapImageUrl(cleanMap),
    winner: m.winner || 'Time A',
    loser: m.loser || 'Time B',
    score: m.score || '13-8',
    scoreWinner: typeof m.scoreWinner === 'number' ? m.scoreWinner : parseInt(String(m.score || '').split('-')[0], 10) || 13,
    scoreLoser: typeof m.scoreLoser === 'number' ? m.scoreLoser : parseInt(String(m.score || '').split('-')[1], 10) || 8,
    declaredBy: m.declaredBy || 'Capitão',
    declaredById: m.declaredById || '',
    format: m.format || 'MD1',
    balancePct: m.balancePct || 92,
    serverConnect: m.serverConnect || '',
    winnerPlayers: Array.isArray(m.winnerPlayers)
      ? m.winnerPlayers.map((p, idx) => ({
          id: p.id || `p-win-${idx}`,
          nick: p.nick || p.displayName || p.username || `Jogador ${idx + 1}`,
          level: p.level || 16,
          avatar: p.avatar || '',
          steamId: p.steamId || '',
          role: p.role || (idx === 0 ? 'Capitão' : 'Jogador'),
        }))
      : [],
    loserPlayers: Array.isArray(m.loserPlayers)
      ? m.loserPlayers.map((p, idx) => ({
          id: p.id || `p-lose-${idx}`,
          nick: p.nick || p.displayName || p.username || `Jogador ${idx + 1}`,
          level: p.level || 16,
          avatar: p.avatar || '',
          steamId: p.steamId || '',
          role: p.role || (idx === 0 ? 'Capitão' : 'Jogador'),
        }))
      : [],
    vetoBans: Array.isArray(m.vetoBans) ? m.vetoBans : [],
  };

  const computedPerformers = computeMatchPerformers(record, m.gsiState || null);
  const computedMvp = m.mvp || m.mvpStats || computedPerformers.mvp;
  const computedBagre = m.bagre || m.bagreStats || computedPerformers.bagre;

  record.mvpId = m.mvpId || computedMvp?.id || (m.mvp ? m.mvp.id : null);
  record.mvpNick = m.mvpNick || computedMvp?.nick || (m.mvp ? m.mvp.nick : null);
  record.mvp = computedMvp || (record.mvpNick ? { id: record.mvpId, nick: record.mvpNick } : null);
  record.mvpStats = computedMvp || null;
  record.mvpVotes = m.mvpVotes || (m.mvp ? m.mvp.votes : 0);

  record.bagreId = m.bagreId || computedBagre?.id || (m.bagre ? m.bagre.id : null);
  record.bagreNick = m.bagreNick || computedBagre?.nick || (m.bagre ? m.bagre.nick : null);
  record.bagre = computedBagre || (record.bagreNick ? { id: record.bagreId, nick: record.bagreNick } : null);
  record.bagreStats = computedBagre || null;
  record.evaluatedPlayers = Array.isArray(m.evaluatedPlayers) && m.evaluatedPlayers.length > 0 ? m.evaluatedPlayers : computedPerformers.evaluatedPlayers;

  return record;
}

export function loadMatchHistory() {
  try {
    ensureDirExists();
    if (fs.existsSync(MATCH_HISTORY_FILE)) {
      const raw = fs.readFileSync(MATCH_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidMatchRecord).map(normalizeMatchRecord);
      }
    }
  } catch (e) {
    console.warn('[MATCH_HISTORY] Falha ao ler matchHistory.json:', e.message);
  }
  return [];
}

export function saveMatchHistory(matches) {
  try {
    ensureDirExists();
    const valid = (Array.isArray(matches) ? matches : [])
      .filter(isValidMatchRecord)
      .map(normalizeMatchRecord);
    fs.writeFileSync(MATCH_HISTORY_FILE, JSON.stringify(valid, null, 2), 'utf8');
    return valid;
  } catch (e) {
    console.error('[MATCH_HISTORY] Falha ao salvar matchHistory.json:', e.message);
    return [];
  }
}

export function recordMatchHistoryEntry(match) {
  if (!isValidMatchRecord(match)) {
    console.warn('[MATCH_HISTORY] Partida rejeitada: apenas partidas com 10 jogadores finalizadas e com estatísticas são salvas.');
    return null;
  }
  const current = loadMatchHistory();
  const normalized = normalizeMatchRecord(match);
  
  // Prepend new match, avoid duplicate IDs
  const filtered = current.filter((m) => m.id !== normalized.id);
  const updated = [normalized, ...filtered].slice(0, 150);
  saveMatchHistory(updated);

  // Notify listeners
  listeners.forEach((fn) => {
    try {
      fn(normalized, updated);
    } catch (e) {
      console.warn('[MATCH_HISTORY] Erro no listener:', e.message);
    }
  });

  return normalized;
}

export function updateMatchMvp(matchId, mvpData = {}) {
  const current = loadMatchHistory();
  const match = current.find((m) => m.id === matchId);
  if (match) {
    match.mvpId = mvpData.id || match.mvpId;
    match.mvpNick = mvpData.nick || match.mvpNick;
    match.mvpVotes = mvpData.votes || match.mvpVotes;
    saveMatchHistory(current);
    
    // Notify listeners
    listeners.forEach((fn) => {
      try {
        fn(match, current);
      } catch (e) {
        console.warn('[MATCH_HISTORY] Erro no listener:', e.message);
      }
    });
    return match;
  }
  return null;
}

export function getMatchHistoryState(filters = {}) {
  const all = loadMatchHistory();
  const { source, map, search, limit = 50 } = filters;

  let filtered = all;

  if (source && source !== 'all') {
    filtered = filtered.filter((m) => m.source === source);
  }

  if (map && map !== 'all') {
    const qMap = map.toLowerCase().replace('de_', '');
    filtered = filtered.filter((m) => (m.map || '').toLowerCase().includes(qMap));
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.map || '').toLowerCase().includes(q) ||
        (m.winner || '').toLowerCase().includes(q) ||
        (m.loser || '').toLowerCase().includes(q) ||
        (m.guildName || '').toLowerCase().includes(q) ||
        (m.channelName || '').toLowerCase().includes(q) ||
        (m.roomName || '').toLowerCase().includes(q) ||
        (m.declaredBy || '').toLowerCase().includes(q) ||
        (m.mvpNick || '').toLowerCase().includes(q) ||
        m.winnerPlayers.some((p) => p.nick.toLowerCase().includes(q)) ||
        m.loserPlayers.some((p) => p.nick.toLowerCase().includes(q))
    );
  }

  const discordCount = all.filter((m) => m.source === 'discord').length;
  const webCount = all.filter((m) => m.source === 'web').length;

  return {
    total: all.length,
    discordCount,
    webCount,
    matches: filtered.slice(0, limit),
  };
}

export function onMatchHistoryUpdated(callback) {
  if (typeof callback === 'function') {
    listeners.push(callback);
  }
}
