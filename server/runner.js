/**
 * CS2 Mix Hub • 24/7 Watchdog Supervisor
 * Automatically keeps the Node server, Discord bot, and WhatsApp bot permanently alive.
 * If the process exits or encounters a transient crash, restarts it immediately.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_SCRIPT = path.join(__dirname, 'index.js');

let child = null;
let isStopping = false;

function startServer() {
  if (isStopping) return;

  console.log(`🚀 [WATCHDOG] Iniciando Servidor CS2 Mix Hub (${new Date().toLocaleTimeString('pt-BR')})...`);
  
  child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error('❌ [WATCHDOG ERROR] Falha ao iniciar processo filho:', err);
  });

  child.on('exit', (code, signal) => {
    if (isStopping) {
      console.log('🛑 [WATCHDOG] Servidor encerrado propositalmente.');
      process.exit(0);
    }
    console.warn(`⚠️ [WATCHDOG] Servidor encerrou com código ${code} / sinal ${signal}. Reiniciando em 1 segundo...`);
    setTimeout(startServer, 1000);
  });
}

function shutdown(signal) {
  isStopping = true;
  console.log(`\n🛑 [WATCHDOG] Sinal ${signal} recebido. Finalizando processos...`);
  if (child) {
    try {
      child.kill(signal);
    } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
