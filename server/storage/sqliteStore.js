import fs from 'fs';
import path from 'path';
import { getDataFilePath } from '../dataDir.js';
import { logger } from '../utils/logger.js';

let DatabaseSyncClass = null;
try {
  if (process.env.USE_SQLITE !== '0') {
    const mod = await import('node:sqlite');
    DatabaseSyncClass = mod.DatabaseSync || null;
  }
} catch {
  DatabaseSyncClass = null;
}

/**
 * Lightweight unified persistence layer backed by Node's built-in `node:sqlite`
 * with automatic in-memory fallback when SQLite is unavailable or disabled.
 */
export function createSqliteStore(dbPath = getDataFilePath('mixhub.sqlite'), { keepOpen } = {}) {
  const shouldKeepOpen = keepOpen !== undefined ? Boolean(keepOpen) : !process.env.NODE_TEST_CONTEXT;
  let db = null;
  let sqliteReady = false;
  let initialized = false;
  const fallbackMap = new Map();

  function openConnection() {
    if (!DatabaseSyncClass || !dbPath) return null;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const conn = new DatabaseSyncClass(dbPath);
    conn.exec(`
      ${shouldKeepOpen ? 'PRAGMA journal_mode = WAL;\n      PRAGMA synchronous = NORMAL;' : 'PRAGMA journal_mode = DELETE;'}
      CREATE TABLE IF NOT EXISTS kv_store (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (namespace, key)
      );
      CREATE INDEX IF NOT EXISTS idx_kv_store_ns ON kv_store (namespace, updated_at DESC);
    `);
    return conn;
  }

  function ensureInitialized() {
    if (initialized) return;
    initialized = true;
    if (!DatabaseSyncClass || !dbPath) return;
    try {
      const initial = openConnection();
      if (initial) {
        sqliteReady = true;
        if (shouldKeepOpen) {
          db = initial;
        } else {
          initial.close();
        }
      }
    } catch (err) {
      logger.warn('SQLITE', 'Falha ao inicializar SQLite; usando fallback em memória/JSON', err);
      db = null;
      sqliteReady = false;
    }
  }

  function withConnection(fn, fallbackResult) {
    ensureInitialized();
    if (!sqliteReady) return fallbackResult;
    if (shouldKeepOpen && db) {
      return fn(db);
    }
    let conn = null;
    try {
      conn = openConnection();
      if (!conn) return fallbackResult;
      return fn(conn);
    } finally {
      if (conn && !shouldKeepOpen) {
        try {
          conn.close();
        } catch {}
      }
    }
  }

  function memNs(namespace) {
    const ns = String(namespace || 'default');
    let map = fallbackMap.get(ns);
    if (!map) {
      map = new Map();
      fallbackMap.set(ns, map);
    }
    return map;
  }

  function isSqliteEnabled() {
    ensureInitialized();
    return sqliteReady;
  }

  function getJson(namespace, key, fallback = null) {
    const ns = String(namespace || 'default');
    const k = String(key || '');
    if (!k) return fallback;
    ensureInitialized();

    if (sqliteReady) {
      try {
        return withConnection((conn) => {
          const stmt = conn.prepare('SELECT value FROM kv_store WHERE namespace = ? AND key = ?');
          const row = stmt.get(ns, k);
          if (!row) return fallback;
          return JSON.parse(row.value);
        }, fallback);
      } catch {
        return fallback;
      }
    }

    const entry = memNs(ns).get(k);
    return entry ? entry.value : fallback;
  }

  function setJson(namespace, key, value) {
    const ns = String(namespace || 'default');
    const k = String(key || '');
    if (!k) return false;
    const now = Date.now();
    ensureInitialized();

    if (sqliteReady) {
      try {
        const serialized = JSON.stringify(value);
        return withConnection((conn) => {
          const stmt = conn.prepare(`
            INSERT INTO kv_store (namespace, key, value, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(namespace, key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at
          `);
          stmt.run(ns, k, serialized, now);
          return true;
        }, false);
      } catch (err) {
        logger.warn('SQLITE', `Falha ao salvar ${ns}/${k}`, err);
        return false;
      }
    }

    memNs(ns).set(k, { key: k, value, updatedAt: now });
    return true;
  }

  function deleteJson(namespace, key) {
    const ns = String(namespace || 'default');
    const k = String(key || '');
    if (!k) return false;
    ensureInitialized();

    if (sqliteReady) {
      try {
        return withConnection((conn) => {
          const stmt = conn.prepare('DELETE FROM kv_store WHERE namespace = ? AND key = ?');
          stmt.run(ns, k);
          return true;
        }, false);
      } catch {
        return false;
      }
    }

    return memNs(ns).delete(k);
  }

  function listNamespace(namespace) {
    const ns = String(namespace || 'default');
    ensureInitialized();
    if (sqliteReady) {
      try {
        return withConnection((conn) => {
          const stmt = conn.prepare('SELECT key, value, updated_at FROM kv_store WHERE namespace = ? ORDER BY updated_at DESC');
          const rows = stmt.all(ns);
          return rows.map((row) => {
            let parsed = null;
            try {
              parsed = JSON.parse(row.value);
            } catch {}
            return {
              key: row.key,
              value: parsed,
              updatedAt: Number(row.updated_at) || 0,
            };
          });
        }, []);
      } catch {
        return [];
      }
    }

    return Array.from(memNs(ns).values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function close() {
    if (db) {
      try {
        db.close();
      } catch {}
      db = null;
    }
  }

  return {
    dbPath,
    isSqliteEnabled,
    getJson,
    setJson,
    deleteJson,
    listNamespace,
    close,
  };
}

let defaultStore = null;

export function getSqliteStore() {
  if (!defaultStore) {
    defaultStore = createSqliteStore();
  }
  return defaultStore;
}

export const sqliteStore = getSqliteStore();
