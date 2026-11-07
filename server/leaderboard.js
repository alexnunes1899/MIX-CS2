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

// Initial seed players for Day-1 experience
const INITIAL_SEED = [
  {
    id: 'seed-1',
    steamId: '76561198034201417',
    nick: 'FalleN',
    avatar: 'https://avatars.steamstatic.com/fc5e0177fd430e00b38a7da30dec241d560b551b6_full.jpg',
    level: 21,
    faceitLevel: 10,
    matchesPlayed: 42,
    wins: 34,
    losses: 8,
    winRate: 81,
    streak: 6,
    bestStreak: 11,
    mvpCount: 22,
    lastPlayed: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'seed-2',
    steamId: '76561198096405844',
    nick: 'grsgod',
    avatar: 'https://avatars.steamstatic.com/fc5e0177fd430e00b38a7da30dec241d560b551b6_full.jpg',
    level: 18,
    faceitLevel: 9,
    matchesPlayed: 36,
    wins: 27,
    losses: 9,
    winRate: 75,
    streak: 4,
    bestStreak: 8,
    mvpCount: 17,
    lastPlayed: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'seed-3',
    steamId: '76561198012345678',
    nick: 'coldzera',
    avatar: 'https://avatars.steamstatic.com/b5bd56c1aa46ea50f5b73eab0ea527170ac1bcdd_full.jpg',
    level: 20,
    faceitLevel: 10,
    matchesPlayed: 31,
    wins: 23,
    losses: 8,
    winRate: 74,
    streak: 2,
    bestStreak: 9,
    mvpCount: 15,
    lastPlayed: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'seed-4',
    steamId: '76561198099887766',
    nick: 'fer',
    avatar: 'https://avatars.steamstatic.com/83907c0817342aa68c2f2187f5d475cf44e5ce67_full.jpg',
    level: 19,
    faceitLevel: 9,
    matchesPlayed: 28,
    wins: 19,
    losses: 9,
    winRate: 68,
    streak: 3,
    bestStreak: 7,
    mvpCount: 11,
    lastPlayed: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'seed-5',
    steamId: '76561198055443322',
    nick: 'fnx',
    avatar: 'https://avatars.steamstatic.com/a933ffbe12437365c197ffb00c920155b46e3422_full.jpg',
    level: 17,
    faceitLevel: 8,
    matchesPlayed: 25,
    wins: 16,
    losses: 9,
    winRate: 64,
    streak: 1,
    bestStreak: 6,
    mvpCount: 9,
    lastPlayed: new Date(Date.now() - 3600000 * 16).toISOString(),
  },
];

let memoryLeaderboard = [...INITIAL_SEED];

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryLeaderboard = parsed;
        return;
      }
    }
    // If not exists, save initial
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

  // Process winners
  winners.forEach((p) => {
    if (!p || !p.nick) return;
    const key = (p.steamId || p.nick).toLowerCase().trim();
    let entry = memoryLeaderboard.find(
      (item) => (item.steamId && item.steamId === p.steamId) || item.nick.toLowerCase() === p.nick.toLowerCase()
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

  // Process losers
  losers.forEach((p) => {
    if (!p || !p.nick) return;
    let entry = memoryLeaderboard.find(
      (item) => (item.steamId && item.steamId === p.steamId) || item.nick.toLowerCase() === p.nick.toLowerCase()
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
