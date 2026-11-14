/**
 * Community Leaderboard & Hall of Fame Manager
 * Persists player match statistics, winrates, streaks and rankings in server/data/leaderboard.json.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Starts empty until real matches are computed in the hub
let memoryLeaderboard = [];

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

// Initialize on boot
loadFromFile();

export function getLeaderboard() {
  loadFromFile();
  // Sort primarily by wins desc, then winRate desc
  return [...memoryLeaderboard].sort((a, b) => {
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    return (b.winRate || 0) - (a.winRate || 0);
  });
}

function findOrCreateEntry(p, now) {
  const pNickLower = String(p.nick || '').trim().toLowerCase();
  let entry = memoryLeaderboard.find(
    (item) =>
      (item.steamId && p.steamId && item.steamId === p.steamId) ||
      (item.discordId && p.discordId && item.discordId === p.discordId) ||
      (pNickLower && String(item.nick || '').toLowerCase() === pNickLower)
  );

  if (!entry) {
    entry = {
      id: p.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      discordId: p.discordId || '',
      steamId: p.steamId || '',
      nick: p.nick,
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
      lastPlayed: now,
    };
    memoryLeaderboard.push(entry);
  }
  return entry;
}

export function recordMatch({ winners = [], losers = [], map = '', scoreWinners = 13, scoreLosers = 11 }) {
  loadFromFile();
  const now = new Date().toISOString();

  // Process winners (ignoring mock bots)
  winners.forEach((p) => {
    if (!p || !p.nick || String(p.id || '').startsWith('bot-')) return;
    const entry = findOrCreateEntry(p, now);

    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
    entry.wins = (entry.wins || 0) + 1;
    entry.streak = (entry.streak || 0) + 1;
    entry.bestStreak = Math.max(entry.bestStreak || 0, entry.streak);
    entry.winRate = Math.round((entry.wins / entry.matchesPlayed) * 100);
    entry.lastPlayed = now;
    if (p.avatar) entry.avatar = p.avatar;
    if (p.level) entry.level = p.level;
    if (p.faceitLevel) entry.faceitLevel = p.faceitLevel;
    if (p.steamId && !entry.steamId) entry.steamId = p.steamId;
    if (p.discordId && !entry.discordId) entry.discordId = p.discordId;
  });

  // Process losers (ignoring mock bots)
  losers.forEach((p) => {
    if (!p || !p.nick || String(p.id || '').startsWith('bot-')) return;
    const entry = findOrCreateEntry(p, now);

    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
    entry.losses = (entry.losses || 0) + 1;
    entry.streak = 0;
    entry.winRate = Math.round((entry.wins / entry.matchesPlayed) * 100);
    entry.lastPlayed = now;
    if (p.avatar) entry.avatar = p.avatar;
    if (p.level) entry.level = p.level;
    if (p.faceitLevel) entry.faceitLevel = p.faceitLevel;
    if (p.steamId && !entry.steamId) entry.steamId = p.steamId;
    if (p.discordId && !entry.discordId) entry.discordId = p.discordId;
  });

  saveToFile();
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
    if (total === 0 && wins === 0 && mvps === 0) continue;

    const nick = p.username || p.name || `<@${discordId}>`;
    const entry = findOrCreateEntry(
      {
        id: `discord-${discordId}`,
        discordId,
        steamId: p.steamId || '',
        nick,
        level: p.level || 16,
      },
      now
    );

    entry.discordId = discordId;
    entry.nick = nick;
    entry.level = p.level || entry.level || 16;
    entry.wins = Math.max(entry.wins || 0, wins);
    entry.losses = Math.max(entry.losses || 0, losses);
    entry.matchesPlayed = Math.max(entry.matchesPlayed || 0, entry.wins + entry.losses);
    entry.mvpCount = Math.max(entry.mvpCount || 0, mvps);
    entry.streak = Number(p.streak ?? entry.streak ?? 0);
    entry.bestStreak = Math.max(entry.bestStreak || 0, entry.streak);
    entry.winRate = entry.matchesPlayed > 0 ? Math.round((entry.wins / entry.matchesPlayed) * 100) : 0;
    entry.lastPlayed = entry.lastPlayed || now;
  }

  saveToFile();
  return getLeaderboard();
}
