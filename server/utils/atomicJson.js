import fs from 'fs';
import path from 'path';

/**
 * Reads a JSON file safely, returning defaultValue if missing or corrupt.
 */
export function readJsonSafe(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[JSON READ WARN] Falha ao ler ${path.basename(filePath)}:`, err.message);
    return defaultValue;
  }
}

/**
 * Atomically writes JSON to disk using a unique temp file + rename to prevent torn writes.
 */
export function writeJsonAtomic(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    console.error(`[JSON WRITE ERROR] Falha ao salvar ${path.basename(filePath)}:`, err.message);
    return false;
  }
}
