/**
 * Helpers to keep in-memory Map caches bounded and free stale TTL entries.
 */

/**
 * Inserts/updates an entry in a Map while evicting oldest keys beyond maxSize.
 */
export function setBounded(map, key, value, maxSize = 200) {
  if (!(map instanceof Map)) return value;
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
  return value;
}

/**
 * Removes Map entries older than ttlMs using getTimestampFn(value).
 */
export function pruneMapByTtl(map, ttlMs, getTimestampFn = (v) => v?.updatedAt || v?.lastUpdate || 0) {
  if (!(map instanceof Map) || !ttlMs) return 0;
  const now = Date.now();
  let removed = 0;
  for (const [key, val] of map.entries()) {
    const ts = Number(getTimestampFn(val) || 0);
    if (!ts || now - ts > ttlMs) {
      map.delete(key);
      removed += 1;
    }
  }
  return removed;
}
