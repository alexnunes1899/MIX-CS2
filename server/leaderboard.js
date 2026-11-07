/**
 * Community Leaderboard & Hall of Fame Manager
 * Persists player match statistics, winrates, streaks and rankings in server/data/leaderboard.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Starts empty until real matches are computed in the hub
let memoryLeaderboard = [];

function ensureDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('[LEADERBOARD] Não foi possível criar pasta data, usando memória:', e.message);
  }
}

function loadFromFile() {
  try {
    ensureDirExists();
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy fake seed entries (seed-1..seed-5) or mock bots (bot-*)
        memoryLeaderboard = parsed.filter(
          (item) => item && !String(item.id || '').startsWith('seed-') && !String(item.id || '').startsWith('bot-')
        );
        return;
      }
    }
    saveToFile();
  } catch (e) {
    console.warn('[LEADERBOARD] Falha ao carregar arquivo:', e.message);
  }
}

function saveToFile() {
  try {
    ensureDirExists();
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(memoryLeaderboard, null, 2), 'utf8');
  } catch (e) {
    console.warn('[LEADERBOARD] Falha ao salvar arquivo:', e.message);
  }
}

// Initialize on boot
loadFromFile();

export function getLeaderboard() {
  // Sort primarily by wins desc, then winRate desc
  return [...memoryLeaderboard].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.winRate - a.winRate;
  });
}

export function recordMatch({ winners = [], losers = [], map = '', scoreWinners = 13, scoreLosers = 11 }) {
  const now = new Date().toISOString();

  // Process winners (ignoring mock bots)
  winners.forEach((p) => {
    if (!p || !p.nick || String(p.id || '').startsWith('bot-')) return;
    let entry = memoryLeaderboard.find(
      (item) => (item.steamId && p.steamId && item.steamId === p.steamId) || item.nick.toLowerCase() === p.nick.toLowerCase()
    );

    if (!entry) {
      entry = {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

    entry.matchesPlayed += 1;
    entry.wins += 1;
    entry.streak = (entry.streak || 0) + 1;
    entry.bestStreak = Math.max(entry.bestStreak || 0, entry.streak);
    entry.winRate = Math.round((entry.wins / entry.matchesPlayed) * 100);
    entry.lastPlayed = now;
    if (p.avatar) entry.avatar = p.avatar;
    if (p.level) entry.level = p.level;
    if (p.faceitLevel) entry.faceitLevel = p.faceitLevel;
  });

  // Process losers (ignoring mock bots)
  losers.forEach((p) => {
    if (!p || !p.nick || String(p.id || '').startsWith('bot-')) return;
    let entry = memoryLeaderboard.find(
      (item) => (item.steamId && p.steamId && item.steamId === p.steamId) || item.nick.toLowerCase() === p.nick.toLowerCase()
    );

    if (!entry) {
      entry = {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

    entry.matchesPlayed += 1;
    entry.losses += 1;
    entry.streak = 0;
    entry.winRate = Math.round((entry.wins / entry.matchesPlayed) * 100);
    entry.lastPlayed = now;
    if (p.avatar) entry.avatar = p.avatar;
    if (p.level) entry.level = p.level;
    if (p.faceitLevel) entry.faceitLevel = p.faceitLevel;
  });

  saveToFile();
  return getLeaderboard();
}
