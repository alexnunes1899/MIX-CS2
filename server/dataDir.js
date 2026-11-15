import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLED_DATA_DIR = path.join(__dirname, 'data');

export function getDataDir() {
  const configured = process.env.DATA_DIR && process.env.DATA_DIR.trim()
    ? path.resolve(process.env.DATA_DIR.trim())
    : BUNDLED_DATA_DIR;
  if (!fs.existsSync(configured)) {
    fs.mkdirSync(configured, { recursive: true });
  }
  return configured;
}

export function getBundledDataDir() {
  return BUNDLED_DATA_DIR;
}

export function getDataFilePath(filename) {
  return path.join(getDataDir(), filename);
}

export function getBundledDataFilePath(filename) {
  return path.join(BUNDLED_DATA_DIR, filename);
}

/**
 * Ensures a writable JSON file exists inside getDataDir() by copying a bundled default if needed.
 * Returns the resolved writable file path.
 */
export function resolveSeededDataFile(filename, bundledFallbackName = filename) {
  const targetPath = getDataFilePath(filename);
  if (!fs.existsSync(targetPath)) {
    const bundledPath = getBundledDataFilePath(bundledFallbackName);
    if (fs.existsSync(bundledPath)) {
      try {
        fs.copyFileSync(bundledPath, targetPath);
      } catch (err) {
        console.warn(`[DATA_DIR] Não foi possível copiar seed ${bundledFallbackName}:`, err.message);
      }
    }
  }
  return targetPath;
}
