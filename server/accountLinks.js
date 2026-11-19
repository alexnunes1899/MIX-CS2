import crypto from 'crypto';
import { getDataFilePath } from './dataDir.js';
import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';
import { setBounded, pruneMapByTtl } from './utils/boundedMap.js';
import { sqliteStore } from './storage/sqliteStore.js';

const DEFAULT_LINKS_FILE = getDataFilePath('accountLinks.json');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_TTL_MS = 10 * 60 * 1000;
const SQLITE_NS = 'account_links';

function generateLinkCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeLinkCode(raw = '') {
  return String(raw || '')
    .toUpperCase()
    .replace(/^CS[-_\s]+/i, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Manages Discord <-> Steam account linking with one-time confirmation codes
 * and atomic JSON + SQLite persistence.
 */
export function createAccountLinkService({ filePath = DEFAULT_LINKS_FILE, store } = {}) {
  const effectiveStore = store !== undefined ? store : (filePath === DEFAULT_LINKS_FILE ? sqliteStore : null);
  const pendingCodes = new Map();
  let links = [];

  function load() {
    const parsed = readJsonSafe(filePath, null);
    if (Array.isArray(parsed)) {
      links = parsed.filter((item) => item && item.discordId && item.steamId);
      return links;
    }
    if (effectiveStore) {
      const sqlRows = effectiveStore.listNamespace(SQLITE_NS);
      if (sqlRows.length > 0) {
        links = sqlRows.map((r) => r.value).filter((item) => item && item.discordId && item.steamId);
        return links;
      }
    }
    links = [];
    return links;
  }

  function save() {
    writeJsonAtomic(filePath, links);
    if (effectiveStore) {
      for (const item of links) {
        effectiveStore.setJson(SQLITE_NS, String(item.steamId), item);
      }
    }
  }

  load();

  function cleanupExpiredCodes(now = Date.now()) {
    pruneMapByTtl(pendingCodes, CODE_TTL_MS, (entry) => entry?.createdAt || 0);
    for (const [k, v] of pendingCodes.entries()) {
      if (v && v.expiresAt && now > v.expiresAt) {
        pendingCodes.delete(k);
      }
    }
  }

  function createDiscordLinkCode({ discordId, discordUsername = '' } = {}) {
    const cleanDiscordId = String(discordId || '').trim();
    if (!cleanDiscordId) {
      throw new Error('ID do Discord obrigatório para gerar código de vinculação.');
    }
    cleanupExpiredCodes();

    for (const [existingCode, info] of pendingCodes.entries()) {
      if (info.origin === 'discord' && info.discordId === cleanDiscordId) {
        pendingCodes.delete(existingCode);
      }
    }

    const code = generateLinkCode(6);
    const now = Date.now();
    const expiresAt = now + CODE_TTL_MS;
    setBounded(
      pendingCodes,
      code,
      {
        code,
        origin: 'discord',
        discordId: cleanDiscordId,
        discordUsername: String(discordUsername || '').trim().slice(0, 60),
        createdAt: now,
        expiresAt,
      },
      500
    );

    return { code, expiresAt };
  }

  function createSteamLinkCode({ steamId, steamNick = '' } = {}) {
    const cleanSteamId = String(steamId || '').trim();
    if (!cleanSteamId) {
      throw new Error('SteamID obrigatório para gerar código de vinculação.');
    }
    cleanupExpiredCodes();

    for (const [existingCode, info] of pendingCodes.entries()) {
      if (info.origin === 'steam' && info.steamId === cleanSteamId) {
        pendingCodes.delete(existingCode);
      }
    }

    const code = generateLinkCode(6);
    const now = Date.now();
    const expiresAt = now + CODE_TTL_MS;
    setBounded(
      pendingCodes,
      code,
      {
        code,
        origin: 'steam',
        steamId: cleanSteamId,
        steamNick: String(steamNick || '').trim().slice(0, 60),
        createdAt: now,
        expiresAt,
      },
      500
    );

    return { code, expiresAt };
  }

  function upsertLink({ discordId, steamId, discordUsername = '', steamNick = '' }) {
    load();
    const cleanDiscordId = String(discordId || '').trim();
    const cleanSteamId = String(steamId || '').trim();

    if (effectiveStore) {
      for (const old of links) {
        if (old.discordId === cleanDiscordId || old.steamId === cleanSteamId) {
          effectiveStore.deleteJson(SQLITE_NS, String(old.steamId));
        }
      }
    }

    const existing = links.find((l) => l.discordId === cleanDiscordId || l.steamId === cleanSteamId) || null;
    links = links.filter((l) => l.discordId !== cleanDiscordId && l.steamId !== cleanSteamId);

    const record = {
      discordId: cleanDiscordId,
      steamId: cleanSteamId,
      discordUsername: String(discordUsername || existing?.discordUsername || '').trim().slice(0, 60),
      steamNick: String(steamNick || existing?.steamNick || '').trim().slice(0, 60),
      linkedAt: existing?.linkedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    links.push(record);
    save();
    return record;
  }

  function confirmCodeFromSteam({ code, steamId, steamNick = '' } = {}) {
    const cleanCode = normalizeLinkCode(code);
    const cleanSteamId = String(steamId || '').trim();
    if (!cleanCode || !cleanSteamId) {
      return { success: false, error: 'Código e SteamID são obrigatórios.' };
    }
    cleanupExpiredCodes();

    const pending = pendingCodes.get(cleanCode);
    if (!pending) {
      return { success: false, error: 'Código inválido ou expirado. Gere um novo código usando /vincular no Discord.' };
    }
    if (pending.origin !== 'discord' || !pending.discordId) {
      return { success: false, error: 'Este código foi gerado no site. Use `/vincular codigo:' + cleanCode + '` no Discord.' };
    }

    pendingCodes.delete(cleanCode);
    const link = upsertLink({
      discordId: pending.discordId,
      discordUsername: pending.discordUsername,
      steamId: cleanSteamId,
      steamNick,
    });
    return { success: true, link };
  }

  function confirmCodeFromDiscord({ code, discordId, discordUsername = '' } = {}) {
    const cleanCode = normalizeLinkCode(code);
    const cleanDiscordId = String(discordId || '').trim();
    if (!cleanCode || !cleanDiscordId) {
      return { success: false, error: 'Código e ID do Discord são obrigatórios.' };
    }
    cleanupExpiredCodes();

    const pending = pendingCodes.get(cleanCode);
    if (!pending) {
      return { success: false, error: 'Código inválido ou expirado. Gere um novo código no Perfil do site.' };
    }
    if (pending.origin !== 'steam' || !pending.steamId) {
      return { success: false, error: 'Este código foi gerado no Discord. Cole-o no seu Perfil Steam no site!' };
    }

    pendingCodes.delete(cleanCode);
    const link = upsertLink({
      discordId: cleanDiscordId,
      discordUsername,
      steamId: pending.steamId,
      steamNick: pending.steamNick,
    });
    return { success: true, link };
  }

  function getLinkByDiscordId(discordId) {
    const clean = String(discordId || '').trim();
    if (!clean) return null;
    load();
    return links.find((l) => l.discordId === clean) || null;
  }

  function getLinkBySteamId(steamId) {
    const clean = String(steamId || '').trim();
    if (!clean) return null;
    load();
    return links.find((l) => l.steamId === clean) || null;
  }

  function unlinkBySteamId(steamId) {
    const clean = String(steamId || '').trim();
    if (!clean) return false;
    load();
    const before = links.length;
    links = links.filter((l) => l.steamId !== clean);
    if (links.length === before) return false;
    if (effectiveStore) effectiveStore.deleteJson(SQLITE_NS, clean);
    save();
    return true;
  }

  function unlinkByDiscordId(discordId) {
    const clean = String(discordId || '').trim();
    if (!clean) return false;
    load();
    const removed = links.filter((l) => l.discordId === clean);
    if (removed.length === 0) return false;
    links = links.filter((l) => l.discordId !== clean);
    if (effectiveStore) {
      for (const r of removed) effectiveStore.deleteJson(SQLITE_NS, String(r.steamId));
    }
    save();
    return true;
  }

  function resolveUnifiedIds({ discordId = '', steamId = '' } = {}) {
    let resolvedDiscord = String(discordId || '').trim();
    let resolvedSteam = String(steamId || '').trim();

    if (resolvedDiscord && !resolvedSteam) {
      const link = getLinkByDiscordId(resolvedDiscord);
      if (link?.steamId) resolvedSteam = link.steamId;
    }
    if (resolvedSteam && !resolvedDiscord) {
      const link = getLinkBySteamId(resolvedSteam);
      if (link?.discordId) resolvedDiscord = link.discordId;
    }

    return {
      discordId: resolvedDiscord,
      steamId: resolvedSteam,
    };
  }

  function listLinks() {
    load();
    return [...links];
  }

  return {
    createDiscordLinkCode,
    createSteamLinkCode,
    confirmCodeFromSteam,
    confirmCodeFromDiscord,
    upsertLink,
    getLinkByDiscordId,
    getLinkBySteamId,
    unlinkBySteamId,
    unlinkByDiscordId,
    resolveUnifiedIds,
    listLinks,
    _pendingCodes: pendingCodes,
  };
}

export const accountLinkService = createAccountLinkService();
