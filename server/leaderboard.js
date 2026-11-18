/**
 * Community Leaderboard & Hall of Fame Manager
 * Persists player match statistics, winrates, streaks, unified identities and monthly seasons
 * in server/data/leaderboard.json and server/data/seasons.json (+ SQLite mirror).
 */

import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';
import { getDataFilePath } from './dataDir.js';
import { accountLinkService } from './accountLinks.js';
import { sqliteStore } from './storage/sqliteStore.js';

const LEADERBOARD_FILE = getDataFilePath('leaderboard.json');
const SEASONS_FILE = getDataFilePath('seasons.json');
const SQLITE_SEASONS_NS = 'seasons';

const PT_BR_MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

let memoryLeaderboard = [];
let memorySeasons = {};

function filterValidEntries(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item) =>
      item &&
      !String(item.id || '').startsWith('seed-') &&
      !String(item.id || '').startsWith('bot-') &&
      !String(item.id || '').startsWith('user_test_')
  );
}

function loadFromFile() {
  const parsed = readJsonSafe(LEADERBOARD_FILE, null);
  if (Array.isArray(parsed)) {
    memoryLeaderboard = filterValidEntries(parsed);
    return;
  }
  saveToFile();
}

function saveToFile() {
  writeJsonAtomic(LEADERBOARD_FILE, memoryLeaderboard);
}

function loadSeasonsFromFile() {
  const parsed = readJsonSafe(SEASONS_FILE, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const clean = {};
    for (const [k, list] of Object.entries(parsed)) {
      if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(list)) {
        clean[k] = filterValidEntries(list);
      }
    }
    memorySeasons = clean;
    return;
  }
  memorySeasons = {};
}

function saveSeasonsToFile() {
  writeJsonAtomic(SEASONS_FILE, memorySeasons);
  if (sqliteStore) {
    for (const [seasonKey, entries] of Object.entries(memorySeasons)) {
      sqliteStore.setJson(SQLITE_SEASONS_NS, seasonKey, entries);
    }
  }
}

// Initialize on boot
loadFromFile();
loadSeasonsFromFile();

export function getCurrentSeasonKey(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatSeasonLabel(seasonKey = '') {
  const match = String(seasonKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(seasonKey || 'Temporada Atual');
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const monthName = PT_BR_MONTHS[monthIdx] || match[2];
  return `${monthName} ${year}`;
}

function resolvePlayerIdentities(p = {}) {
  const rawDiscordId = p.discordId || (String(p.id || '').startsWith('discord-') ? String(p.id).replace(/^discord-/, '') : /^\d{17,22}$/.test(String(p.id || '')) ? String(p.id) : '');
  const rawSteamId = p.steamId || (/^7656119\d{10}$/.test(String(p.id || '')) ? String(p.id) : '');
  const unified = accountLinkService.resolveUnifiedIds({
    discordId: rawDiscordId,
    steamId: rawSteamId,
  });
  return {
    id: p.id || (unified.steamId || (unified.discordId ? `discord-${unified.discordId}` : '')),
    discordId: unified.discordId || '',
    steamId: unified.steamId || '',
    nick: p.nick || p.displayName || p.username || p.name || 'Jogador',
  };
}

function findOrCreateEntryInList(list, p, now) {
  const ids = resolvePlayerIdentities(p);
  const pNickLower = String(ids.nick || '').trim().toLowerCase();

  let entry = list.find(
    (item) =>
      (ids.steamId && item.steamId && item.steamId === ids.steamId) ||
      (ids.discordId && item.discordId && item.discordId === ids.discordId) ||
      (ids.id && item.id && item.id === ids.id) ||
      (!ids.steamId && !ids.discordId && pNickLower && String(item.nick || '').toLowerCase() === pNickLower) ||
      (pNickLower && String(item.nick || '').toLowerCase() === pNickLower && (!item.steamId || !ids.steamId || item.steamId === ids.steamId))
  );

  if (!entry) {
    entry = {
      id: ids.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      discordId: ids.discordId || '',
      steamId: ids.steamId || '',
      nick: ids.nick,
      avatar: p.avatar || '',
      level: p.level || 10,
      faceitLevel: p.faceitLevel || 5,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      streak: 0,
      bestStreak: 0,
      mvpCount: 0,
      bagreCount: 0,
      lastPlayed: now,
    };
    list.push(entry);
  } else {
    if (ids.steamId && !entry.steamId) entry.steamId = ids.steamId;
    if (ids.discordId && !entry.discordId) entry.discordId = ids.discordId;
  }

  return { entry, ids };
}

function sortLeaderboardEntries(list = []) {
  return [...list].sort((a, b) => {
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    if ((b.winRate || 0) !== (a.winRate || 0)) return (b.winRate || 0) - (a.winRate || 0);
    return (b.mvpCount || 0) - (a.mvpCount || 0);
  });
}

function applyMatchToList(list, { winners = [], losers = [], mvpId = null, bagreId = null, now = new Date().toISOString() }) {
  const mvpStr = mvpId ? String(mvpId) : '';
  const bagreStr = bagreId ? String(bagreId) : '';

  const matchesAwardId = (p, entry, ids, targetIdStr) => {
    if (!targetIdStr) return false;
    return [p.id, p.steamId, p.discordId, entry.id, entry.steamId, entry.discordId, ids.steamId, ids.discordId]
      .filter(Boolean)
      .some((cand) => String(cand) === targetIdStr);
  };

  winners.forEach((p) => {
    if (!p || !(p.nick || p.username || p.displayName || p.name) || String(p.id || '').startsWith('bot-')) return;
    const { entry, ids } = findOrCreateEntryInList(list, p, now);

    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
    entry.wins = (entry.wins || 0) + 1;
    entry.streak = (entry.streak || 0) + 1;
    entry.bestStreak = Math.max(entry.bestStreak || 0, entry.streak);
    entry.winRate = Math.round((entry.wins / entry.matchesPlayed) * 100);
    entry.lastPlayed = now;
    if (p.avatar) entry.avatar = p.avatar;
    if (p.level) entry.level = p.level;
    if (p.faceitLevel) entry.faceitLevel = p.faceitLevel;
    if (matchesAwardId(p, entry, ids, mvpStr)) {
      entry.mvpCount = (entry.mvpCount || 0) + 1;
    }
    if (matchesAwardId(p, entry, ids, bagreStr)) {
      entry.bagreCount = (entry.bagreCount || 0) + 1;
    }
  });

  losers.forEach((p) => {
    if (!p || !(p.nick || p.username || p.displayName || p.name) || String(p.id || '').startsWith('bot-')) return;
    const { entry, ids } = findOrCreateEntryInList(list, p, now);

    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
    entry.losses = (entry.losses || 0) + 1;
    entry.streak = 0;
    entry.winRate = Math.round((entry.wins / entry.matchesPlayed) * 100);
    entry.lastPlayed = now;
    if (p.avatar) entry.avatar = p.avatar;
    if (p.level) entry.level = p.level;
    if (p.faceitLevel) entry.faceitLevel = p.faceitLevel;
    if (matchesAwardId(p, entry, ids, mvpStr)) {
      entry.mvpCount = (entry.mvpCount || 0) + 1;
    }
    if (matchesAwardId(p, entry, ids, bagreStr)) {
      entry.bagreCount = (entry.bagreCount || 0) + 1;
    }
  });
}

export function getLeaderboard() {
  loadFromFile();
  return sortLeaderboardEntries(memoryLeaderboard);
}

export function getSeasonLeaderboard(seasonKey = getCurrentSeasonKey()) {
  loadSeasonsFromFile();
  const list = memorySeasons[seasonKey] || [];
  return sortLeaderboardEntries(list);
}

export function computeSeasonPodium(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { top3: [], bestStreak: null, mostMvps: null, bagreKing: null };
  }
  const sorted = sortLeaderboardEntries(entries);
  const top3 = sorted.slice(0, 3).map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    nick: p.nick,
    avatar: p.avatar || '',
    wins: p.wins || 0,
    matchesPlayed: p.matchesPlayed || 0,
    winRate: p.winRate || 0,
    level: p.level || 12,
    steamId: p.steamId || '',
    discordId: p.discordId || '',
  }));

  const byStreak = [...entries].filter((e) => (e.bestStreak || 0) > 0).sort((a, b) => (b.bestStreak || 0) - (a.bestStreak || 0))[0] || null;
  const byMvp = [...entries].filter((e) => (e.mvpCount || 0) > 0).sort((a, b) => (b.mvpCount || 0) - (a.mvpCount || 0))[0] || null;
  const byBagre = [...entries].filter((e) => (e.bagreCount || 0) > 0).sort((a, b) => (b.bagreCount || 0) - (a.bagreCount || 0))[0] || null;

  return {
    top3,
    bestStreak: byStreak ? { id: byStreak.id, nick: byStreak.nick, value: byStreak.bestStreak } : null,
    mostMvps: byMvp ? { id: byMvp.id, nick: byMvp.nick, value: byMvp.mvpCount } : null,
    bagreKing: byBagre ? { id: byBagre.id, nick: byBagre.nick, value: byBagre.bagreCount } : null,
  };
}

export function buildSeasonsFromHistory(matches = []) {
  const rebuilt = {};
  const validMatches = (Array.isArray(matches) ? [...matches] : [])
    .filter((m) => m && Array.isArray(m.winnerPlayers) && Array.isArray(m.loserPlayers))
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

  for (const m of validMatches) {
    const ts = Number(m.timestamp) || Date.now();
    const seasonKey = getCurrentSeasonKey(new Date(ts));
    if (!rebuilt[seasonKey]) rebuilt[seasonKey] = [];
    applyMatchToList(rebuilt[seasonKey], {
      winners: m.winnerPlayers,
      losers: m.loserPlayers,
      mvpId: m.mvpId || m.mvp?.id || null,
      bagreId: m.bagreId || m.bagre?.id || null,
      now: new Date(ts).toISOString(),
    });
  }
  return rebuilt;
}

export function getSeasonsSummary(historyFallback = []) {
  loadSeasonsFromFile();
  let sourceMap = memorySeasons;
  if (Object.keys(sourceMap).length === 0 && Array.isArray(historyFallback) && historyFallback.length > 0) {
    sourceMap = buildSeasonsFromHistory(historyFallback);
    if (Object.keys(sourceMap).length > 0) {
      memorySeasons = sourceMap;
      saveSeasonsToFile();
    }
  }

  const currentKey = getCurrentSeasonKey();
  const keys = new Set([...Object.keys(sourceMap), currentKey]);

  return Array.from(keys)
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort((a, b) => b.localeCompare(a))
    .map((seasonKey) => {
      const entries = sourceMap[seasonKey] || [];
      return {
        seasonKey,
        label: formatSeasonLabel(seasonKey),
        isCurrent: seasonKey === currentKey,
        totalPlayers: entries.length,
        podium: computeSeasonPodium(entries),
      };
    });
}

export function recordMatch({
  winners = [],
  losers = [],
  map = '',
  scoreWinners = 13,
  scoreLosers = 11,
  mvpId = null,
  bagreId = null,
  timestamp = Date.now(),
}) {
  loadFromFile();
  loadSeasonsFromFile();
  const tsNum = Number(timestamp) || Date.now();
  const now = new Date(tsNum).toISOString();
  const seasonKey = getCurrentSeasonKey(new Date(tsNum));

  applyMatchToList(memoryLeaderboard, { winners, losers, mvpId, bagreId, now });
  saveToFile();

  if (!memorySeasons[seasonKey]) {
    memorySeasons[seasonKey] = [];
  }
  applyMatchToList(memorySeasons[seasonKey], { winners, losers, mvpId, bagreId, now });
  saveSeasonsToFile();

  return getLeaderboard();
}

function mergeListEntriesByLink(list, cleanDiscordId, cleanSteamId) {
  if (!Array.isArray(list)) return list;
  const idxDiscord = list.findIndex((e) => e.discordId === cleanDiscordId || e.id === `discord-${cleanDiscordId}`);
  const idxSteam = list.findIndex((e) => e.steamId === cleanSteamId || e.id === cleanSteamId);

  if (idxDiscord === -1 && idxSteam === -1) return list;

  if (idxDiscord !== -1 && idxSteam !== -1 && idxDiscord !== idxSteam) {
    const steamEntry = list[idxSteam];
    const discordEntry = list[idxDiscord];
    const mergedWins = (steamEntry.wins || 0) + (discordEntry.wins || 0);
    const mergedLosses = (steamEntry.losses || 0) + (discordEntry.losses || 0);
    const mergedTotal = mergedWins + mergedLosses;
    const merged = {
      ...discordEntry,
      ...steamEntry,
      id: steamEntry.id || cleanSteamId,
      steamId: cleanSteamId,
      discordId: cleanDiscordId,
      nick: steamEntry.nick || discordEntry.nick,
      avatar: steamEntry.avatar || discordEntry.avatar || '',
      level: Math.max(Number(steamEntry.level || 0), Number(discordEntry.level || 0)) || 12,
      faceitLevel: steamEntry.faceitLevel || discordEntry.faceitLevel || 5,
      wins: mergedWins,
      losses: mergedLosses,
      matchesPlayed: mergedTotal,
      winRate: mergedTotal > 0 ? Math.round((mergedWins / mergedTotal) * 100) : 0,
      streak: Math.max(Number(steamEntry.streak || 0), Number(discordEntry.streak || 0)),
      bestStreak: Math.max(Number(steamEntry.bestStreak || 0), Number(discordEntry.bestStreak || 0)),
      mvpCount: (steamEntry.mvpCount || 0) + (discordEntry.mvpCount || 0),
      bagreCount: (steamEntry.bagreCount || 0) + (discordEntry.bagreCount || 0),
    };
    const removeIdx = Math.max(idxDiscord, idxSteam);
    const keepIdx = Math.min(idxDiscord, idxSteam);
    list[keepIdx] = merged;
    list.splice(removeIdx, 1);
  } else if (idxDiscord !== -1) {
    list[idxDiscord].discordId = cleanDiscordId;
    list[idxDiscord].steamId = cleanSteamId;
  } else if (idxSteam !== -1) {
    list[idxSteam].discordId = cleanDiscordId;
    list[idxSteam].steamId = cleanSteamId;
  }
  return list;
}

export function linkLeaderboardIdentity(discordId, steamId) {
  const cleanDiscordId = String(discordId || '').trim();
  const cleanSteamId = String(steamId || '').trim();
  if (!cleanDiscordId || !cleanSteamId) return getLeaderboard();

  loadFromFile();
  mergeListEntriesByLink(memoryLeaderboard, cleanDiscordId, cleanSteamId);
  saveToFile();

  loadSeasonsFromFile();
  for (const seasonKey of Object.keys(memorySeasons)) {
    mergeListEntriesByLink(memorySeasons[seasonKey], cleanDiscordId, cleanSteamId);
  }
  saveSeasonsToFile();

  return getLeaderboard();
}

/**
 * Merges Discord player profiles into the unified leaderboard without overwriting web entries.
 */
export function syncDiscordProfilesToLeaderboard(profiles = {}) {
  if (!profiles || typeof profiles !== 'object') return getLeaderboard();
  loadFromFile();
  const now = new Date().toISOString();

  for (const [discordId, p] of Object.entries(profiles)) {
    if (!p) continue;
    const wins = Number(p.wins) || 0;
    const losses = Number(p.losses) || 0;
    const total = wins + losses;
    const mvps = Number(p.mvps) || 0;
    const bagres = Number(p.bagres) || 0;
    if (total === 0 && wins === 0 && mvps === 0 && bagres === 0) continue;

    const unified = accountLinkService.resolveUnifiedIds({ discordId, steamId: p.steamId || '' });
    const nick = p.username || p.name || `<@${discordId}>`;
    const { entry } = findOrCreateEntryInList(
      memoryLeaderboard,
      {
        id: unified.steamId || `discord-${discordId}`,
        discordId,
        steamId: unified.steamId || p.steamId || '',
        nick,
        level: p.level || 16,
      },
      now
    );

    entry.discordId = discordId;
    if (unified.steamId) entry.steamId = unified.steamId;
    entry.nick = entry.nick || nick;
    entry.level = p.level || entry.level || 16;
    entry.wins = Math.max(entry.wins || 0, wins);
    entry.losses = Math.max(entry.losses || 0, losses);
    entry.matchesPlayed = Math.max(entry.matchesPlayed || 0, entry.wins + entry.losses);
    entry.mvpCount = Math.max(entry.mvpCount || 0, mvps);
    entry.bagreCount = Math.max(entry.bagreCount || 0, bagres);
    entry.streak = Number(p.streak ?? entry.streak ?? 0);
    entry.bestStreak = Math.max(entry.bestStreak || 0, entry.streak);
    entry.winRate = entry.matchesPlayed > 0 ? Math.round((entry.wins / entry.matchesPlayed) * 100) : 0;
    entry.lastPlayed = entry.lastPlayed || now;
  }

  saveToFile();
  return getLeaderboard();
}
