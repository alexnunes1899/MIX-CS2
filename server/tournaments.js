import { getDataFilePath } from './dataDir.js';
import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';
import { sanitizeInput } from './roomHelpers.js';

const MAX_TOURNAMENTS = 100;
const TOURNAMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let tournamentsCache = null;

function ensureLoaded() {
  if (tournamentsCache) return tournamentsCache;
  const filePath = getDataFilePath('tournamentsStore.json');
  const raw = readJsonSafe(filePath, {});
  tournamentsCache = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  return tournamentsCache;
}

function persistStore() {
  const store = ensureLoaded();
  const now = Date.now();
  const entries = Object.entries(store)
    .filter(([, v]) => v && now - Number(v.updatedAt || v.createdAt || 0) <= TOURNAMENT_TTL_MS)
    .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
    .slice(0, MAX_TOURNAMENTS);

  const trimmed = {};
  for (const [k, v] of entries) {
    trimmed[k] = v;
  }
  tournamentsCache = trimmed;
  writeJsonAtomic(getDataFilePath('tournamentsStore.json'), trimmed);
}

export function normalizeTournamentCode(raw = '') {
  const clean = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return clean;
}

function sanitizeTeams(rawTeams) {
  if (!Array.isArray(rawTeams)) return [];
  return rawTeams.slice(0, 16).map((t, idx) => {
    const safePlayers = Array.isArray(t?.players)
      ? t.players.slice(0, 7).map((p, pIdx) => ({
          id: sanitizeInput(String(p?.id || `p-${idx + 1}-${pIdx + 1}`), 32) || `p-${idx + 1}-${pIdx + 1}`,
          nick: sanitizeInput(String(p?.nick || ''), 28) || 'Jogador',
          role: sanitizeInput(String(p?.role || 'Rifler'), 16) || 'Rifler',
          isCaptain: Boolean(p?.isCaptain),
        }))
      : [];
    return {
      id: sanitizeInput(String(t?.id || `team-${idx + 1}`), 32) || `team-${idx + 1}`,
      name: sanitizeInput(String(t?.name || `Time ${idx + 1}`), 36) || `Time ${idx + 1}`,
      tag: sanitizeInput(String(t?.tag || `T${idx + 1}`), 8).toUpperCase() || `T${idx + 1}`,
      color: /^#[0-9a-fA-F]{3,8}$/.test(String(t?.color || '').trim()) ? String(t.color).trim() : '#f59e0b',
      icon: sanitizeInput(String(t?.icon || '🛡️'), 12) || '🛡️',
      players: safePlayers,
    };
  });
}

function sanitizeMatches(rawMatches) {
  if (!rawMatches || typeof rawMatches !== 'object' || Array.isArray(rawMatches)) return {};
  const out = {};
  const keys = Object.keys(rawMatches).slice(0, 32);
  for (const k of keys) {
    const cleanKey = sanitizeInput(k, 20);
    if (!cleanKey) continue;
    const m = rawMatches[k];
    if (!m || typeof m !== 'object') continue;
    out[cleanKey] = {
      id: sanitizeInput(String(m.id || cleanKey), 20) || cleanKey,
      title: sanitizeInput(String(m.title || m.roundLabel || ''), 48),
      roundLabel: sanitizeInput(String(m.roundLabel || m.title || ''), 36),
      map: sanitizeInput(String(m.map || ''), 28),
      teamA: m.teamA ? sanitizeInput(String(m.teamA), 36) : null,
      teamB: m.teamB ? sanitizeInput(String(m.teamB), 36) : null,
      scoreA: Math.max(0, Math.min(99, parseInt(m.scoreA, 10) || 0)),
      scoreB: Math.max(0, Math.min(99, parseInt(m.scoreB, 10) || 0)),
      winner: m.winner ? sanitizeInput(String(m.winner), 36) : null,
      status: ['pending', 'live', 'finished'].includes(m.status) ? m.status : 'pending',
      format: ['MD1', 'MD3', 'MD5'].includes(m.format) ? m.format : 'MD3',
      date: sanitizeInput(String(m.date || ''), 24),
      time: sanitizeInput(String(m.time || ''), 16),
      serverIp: sanitizeInput(String(m.serverIp || ''), 64),
    };
  }
  return out;
}

export function getTournament(rawCode) {
  const code = normalizeTournamentCode(rawCode);
  if (!code) return null;
  const store = ensureLoaded();
  const entry = store[code];
  if (!entry) return null;
  return JSON.parse(JSON.stringify(entry));
}

export function saveTournament(rawCode, payload = {}, actor = {}) {
  const code = normalizeTournamentCode(rawCode);
  if (!code) {
    return { ok: false, status: 400, error: 'Código de torneio inválido.' };
  }

  const store = ensureLoaded();
  const existing = store[code] || null;
  const { ownerId = '', ownerSteamId = '', ownerNick = '', isSiteAdmin = false } = actor || {};

  if (existing && !isSiteAdmin) {
    const hasOwner = Boolean(existing.ownerSteamId || existing.ownerId);
    const sameSteam = Boolean(ownerSteamId && existing.ownerSteamId && ownerSteamId === existing.ownerSteamId);
    const sameId = Boolean(ownerId && existing.ownerId && ownerId === existing.ownerId);
    if (hasOwner && !sameSteam && !sameId) {
      return {
        ok: false,
        status: 403,
        error: `Apenas o organizador (${existing.ownerNick || 'criador'}) pode editar o torneio ${code}.`,
      };
    }
  }

  const now = Date.now();
  const cleanName = sanitizeInput(String(payload?.name || payload?.tournamentName || existing?.name || 'COPA DE MIX CS2 2026'), 60) || 'COPA DE MIX CS2 2026';
  const rawCount = parseInt(payload?.teamCount ?? existing?.teamCount ?? 8, 10);
  const teamCount = Number.isFinite(rawCount) ? Math.max(2, Math.min(16, rawCount)) : 8;

  const saved = {
    code,
    name: cleanName,
    teamCount,
    teams: payload?.teams ? sanitizeTeams(payload.teams) : (existing?.teams || []),
    matches: payload?.matches ? sanitizeMatches(payload.matches) : (existing?.matches || {}),
    ownerId: existing?.ownerId || ownerId || '',
    ownerSteamId: existing?.ownerSteamId || ownerSteamId || '',
    ownerNick: existing?.ownerNick || sanitizeInput(String(ownerNick || ''), 32) || 'Organizador',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  store[code] = saved;
  persistStore();
  return { ok: true, tournament: JSON.parse(JSON.stringify(saved)) };
}
