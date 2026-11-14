/**
 * CS2 Mix Hub • 24/7 Watchdog Supervisor
 * Automatically keeps the Node server, Discord bot, and WhatsApp bot permanently alive.
 * If the process exits or encounters a transient crash, restarts it immediately.
 * Writes persistent logs to server/logs/watchdog.log for full auditing.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_SCRIPT = path.join(__dirname, 'index.js');
const LOGS_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'watchdog.log');
const PID_FILE = path.join(__dirname, 'data', 'runner.pid');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const MAX_LOG_BYTES = 5 * 1024 * 1024;

function rotateLogIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_BYTES) {
        const rotated = `${LOG_FILE}.old`;
        if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
        fs.renameSync(LOG_FILE, rotated);
      }
    }
  } catch (_) {}
}

function writeLog(line) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${line}\n`;
  try {
    rotateLogIfNeeded();
    process.stdout.write(entry);
    fs.appendFileSync(LOG_FILE, entry);
  } catch (_) {}
}

let child = null;
let isStopping = false;
let restartCount = 0;
let consecutiveFastCrashes = 0;
let lastStartAt = 0;

// Save Watchdog PID
try {
  fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
} catch (_) {}

function startServer() {
  if (isStopping) return;

  restartCount++;
  lastStartAt = Date.now();
  writeLog(`🚀 [WATCHDOG] Iniciando Servidor CS2 Mix Hub (execução #${restartCount})...`);

  child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, WATCHDOG_ACTIVE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    try {
      rotateLogIfNeeded();
      process.stdout.write(data);
      fs.appendFileSync(LOG_FILE, data);
    } catch (_) {}
  });

  child.stderr.on('data', (data) => {
    try {
      rotateLogIfNeeded();
      process.stderr.write(data);
      fs.appendFileSync(LOG_FILE, data);
    } catch (_) {}
  });

  child.on('error', (err) => {
    writeLog(`❌ [WATCHDOG ERROR] Falha ao iniciar processo filho: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    if (isStopping) {
      writeLog('🛑 [WATCHDOG] Servidor encerrado propositalmente.');
      try {
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      } catch (_) {}
      process.exit(0);
    }
    const uptimeMs = Date.now() - lastStartAt;
    if (uptimeMs < 5000) {
      consecutiveFastCrashes += 1;
    } else {
      consecutiveFastCrashes = 0;
    }
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, Math.min(consecutiveFastCrashes, 5)));
    writeLog(`⚠️ [WATCHDOG] Servidor encerrou com código ${code} / sinal ${signal} após ${Math.round(uptimeMs / 1000)}s. Reiniciando em ${Math.round(backoffMs / 1000)}s...`);
    setTimeout(startServer, backoffMs);
  });
}

function shutdown(signal) {
  isStopping = true;
  writeLog(`\n🛑 [WATCHDOG] Sinal ${signal} recebido. Finalizando processos com segurança...`);
  if (child) {
    try {
      child.kill(signal);
    } catch (_) {}
  }
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
