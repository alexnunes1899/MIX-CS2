/**
 * Lightweight structured logger with opt-in debug output (DEBUG_LOGS=1).
 */

function formatErr(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  return err?.message || String(err);
}

function logLine(levelFn, levelLabel, scope, msg, err) {
  const ts = new Date().toISOString();
  const detail = formatErr(err);
  const suffix = detail ? ` (${detail})` : '';
  levelFn(`[${ts}] [${levelLabel}] [${scope}] ${msg}${suffix}`);
}

export const logger = {
  info(scope, msg, err) {
    logLine(console.log, 'INFO', scope, msg, err);
  },
  warn(scope, msg, err) {
    logLine(console.warn, 'WARN', scope, msg, err);
  },
  error(scope, msg, err) {
    logLine(console.error, 'ERROR', scope, msg, err);
  },
  debug(scope, msg, err) {
    if (process.env.DEBUG_LOGS === '1') {
      logLine(console.debug, 'DEBUG', scope, msg, err);
    }
  },
};
