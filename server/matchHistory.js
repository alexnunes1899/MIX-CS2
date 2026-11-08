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
const DATA_DIR = path.join(__dirname, 'data');
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'matchHistory.json');

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
  de_ancient: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
  ancient: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
  de_anubis: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
  anubis: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
  de_cache: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
  cache: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
};

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
  const key = String(mapName || '').toLowerCase().trim();
  return MAP_IMAGES[key] || MAP_IMAGES[key.replace('de_', '')] || 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png';
}

/**
 * Normalizes any legacy or new match object so all fields are guaranteed to exist.
 */
export function normalizeMatchRecord(m = {}) {
  const ts = m.timestamp || Date.now();
  const dateObj = new Date(ts);
  const dateStr = dateObj.toLocaleDateString('pt-BR');
  const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const source = m.source || 'discord';
  const isDiscord = source === 'discord';

  return {
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
    map: m.map || 'Mirage',
    mapImage: m.mapImage || getMapImageUrl(m.map),
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
    mvpId: m.mvpId || (m.mvp ? m.mvp.id : null),
    mvpNick: m.mvpNick || (m.mvp ? m.mvp.nick : null),
    mvpVotes: m.mvpVotes || (m.mvp ? m.mvp.votes : 0),
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
}

export function loadMatchHistory() {
  try {
    ensureDirExists();
    if (fs.existsSync(MATCH_HISTORY_FILE)) {
      const raw = fs.readFileSync(MATCH_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeMatchRecord);
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
    const normalized = (Array.isArray(matches) ? matches : []).map(normalizeMatchRecord);
    fs.writeFileSync(MATCH_HISTORY_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch (e) {
    console.error('[MATCH_HISTORY] Falha ao salvar matchHistory.json:', e.message);
    return [];
  }
}

export function recordMatchHistoryEntry(match) {
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
