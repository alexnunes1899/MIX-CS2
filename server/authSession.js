import crypto from 'crypto';
import fs from 'fs';
import { getDataFilePath } from './dataDir.js';
import { DEFAULT_PUBLIC_URL } from '../shared/appConfig.js';

export const SESSION_COOKIE_NAME = 'mixhub_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let cachedSecret = null;

export function deriveStableFallbackSecret(env = process.env) {
  const candidates = [
    env?.ADMIN_API_KEY,
    env?.DISCORD_BOT_TOKEN,
    env?.STEAM_API_KEY,
    env?.MATCHZY_WEBHOOK_SECRET,
    env?.GEMINI_API_KEY,
  ]
    .map((val) => String(val || '').trim())
    .filter((val) => val.length >= 12);

  if (candidates.length === 0) return null;
  return crypto
    .createHmac('sha256', candidates.join('|'))
    .update('cs2-mix-hub:session-secret:v1')
    .digest('hex');
}

export function getSessionSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    cachedSecret = process.env.SESSION_SECRET.trim();
    return cachedSecret;
  }

  const secretPath = getDataFilePath('.session-secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return cachedSecret;
      }
    }
  } catch (err) {
    console.warn('[AUTH] Falha ao ler .session-secret:', err.message);
  }

  const derived = deriveStableFallbackSecret(process.env);
  if (derived) {
    console.warn(
      '[AUTH] SESSION_SECRET não definido — usando chave derivada estável das credenciais do ambiente (defina SESSION_SECRET em produção).'
    );
    cachedSecret = derived;
    return cachedSecret;
  }

  try {
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { encoding: 'utf8', mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  } catch (err) {
    console.warn('[AUTH] Usando segredo efêmero em memória (configure SESSION_SECRET em produção):', err.message);
    cachedSecret = crypto.randomBytes(32).toString('hex');
    return cachedSecret;
  }
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signSessionToken(userPayload = {}) {
  const now = Date.now();
  const safePayload = {
    steamId: String(userPayload.steamId || ''),
    nick: String(userPayload.nick || 'Jogador'),
    avatar: String(userPayload.avatar || ''),
    faceitLevel: Number(userPayload.faceitLevel) || 0,
    faceitElo: Number(userPayload.faceitElo) || 0,
    faceitFound: Boolean(userPayload.faceitFound),
    cs2Hours: userPayload.cs2Hours ?? '',
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const body = base64UrlEncode(JSON.stringify(safePayload));
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!/^\d{17}$/.test(String(parsed.steamId || ''))) return null;
    if (Number(parsed.exp || 0) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signGsiInstallerToken(roomId, ttlMs = 15 * 60 * 1000) {
  const cleanRoomId = String(roomId || 'MIX-PRO').trim().toUpperCase();
  if (!cleanRoomId) return '';
  const now = Date.now();
  const payload = {
    roomId: cleanRoomId,
    scope: 'gsi_installer',
    iat: now,
    exp: now + Math.max(60_000, Number(ttlMs) || 15 * 60 * 1000),
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGsiInstallerToken(token, expectedRoomId = '') {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  if (!body || !sig) return false;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body));
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.scope !== 'gsi_installer') return false;
    if (Number(parsed.exp || 0) < Date.now()) return false;
    const cleanExpected = String(expectedRoomId || '').trim().toUpperCase();
    if (cleanExpected && parsed.roomId !== cleanExpected) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseCookies(cookieHeader = '') {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function getSessionUser(reqOrHandshake) {
  const headers = reqOrHandshake?.headers || {};
  const cookies = parseCookies(headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  return verifySessionToken(token);
}

export function isRequestSecure(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return Boolean(req?.secure || forwardedProto === 'https');
}

export function setSessionCookie(req, res, userPayload) {
  const token = signSessionToken(userPayload);
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isRequestSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
  return token;
}

export function clearSessionCookie(req, res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isRequestSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function getConfiguredAdminSteamIds() {
  return String(process.env.ADMIN_STEAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{17}$/.test(s));
}

export function isLoopbackIp(rawIp = '') {
  const ip = String(rawIp || '').trim();
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

export function isLoopbackRequest(req) {
  if (!req) return false;
  if (req.headers?.['x-forwarded-for']) return false;
  return isLoopbackIp(req.socket?.remoteAddress || req.ip || '');
}

export function timingSafeStringEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isAdminRequest(req) {
  const configuredKey = (process.env.ADMIN_API_KEY || '').trim();
  const configuredSteamIds = getConfiguredAdminSteamIds();

  const providedKey = String(
    req?.headers?.['x-admin-key'] ||
    (String(req?.headers?.authorization || '').startsWith('Bearer ')
      ? String(req.headers.authorization).slice(7)
      : '')
  ).trim();

  if (configuredKey && timingSafeStringEqual(providedKey, configuredKey)) {
    return true;
  }

  const sessionUser = getSessionUser(req);
  if (sessionUser?.steamId && configuredSteamIds.includes(sessionUser.steamId)) {
    return true;
  }

  // Safe local fallback only when no explicit admin secret/list is configured and caller is directly on local PC
  const isCloud = Boolean(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT);
  if (!configuredKey && configuredSteamIds.length === 0 && !isCloud && isLoopbackRequest(req)) {
    return true;
  }

  return false;
}

export function requireAdmin(req, res, next) {
  if (isAdminRequest(req)) return next();
  const hasExplicitConfig = Boolean((process.env.ADMIN_API_KEY || '').trim() || getConfiguredAdminSteamIds().length > 0);
  return res.status(hasExplicitConfig ? 403 : 401).json({
    error: hasExplicitConfig
      ? 'Acesso restrito a administradores (Steam Admin ou x-admin-key inválido).'
      : 'Endpoint administrativo bloqueado em servidor remoto. Defina ADMIN_API_KEY ou ADMIN_STEAM_IDS nas variáveis de ambiente.',
    requiresAdminAuth: true,
  });
}

export function verifyWebhookSecret(req, envVarName = 'MATCHZY_WEBHOOK_SECRET') {
  const secret = (process.env[envVarName] || '').trim();
  if (!secret) {
    // Require loopback when running unconfigured in cloud, or allow explicit webhook secret setup
    const isCloud = Boolean(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT);
    if (isCloud) {
      return { ok: false, status: 401, error: `${envVarName} não configurado no servidor.` };
    }
    return { ok: true };
  }
  const auth = String(req?.headers?.authorization || '').trim();
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth;
  const headerSecret = String(req?.headers?.['x-webhook-secret'] || req?.headers?.['x-matchzy-secret'] || bearer || req?.query?.secret || '').trim();
  if (!timingSafeStringEqual(headerSecret, secret)) {
    return { ok: false, status: 403, error: 'Webhook secret inválido.' };
  }
  return { ok: true };
}

export function hashRoomPassword(password = '') {
  const clean = String(password || '').trim();
  if (!clean) return '';
  if (clean.startsWith('scrypt$')) return clean;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyRoomPassword(candidate = '', stored = '') {
  const cleanStored = String(stored || '').trim();
  if (!cleanStored) return true;
  const cleanCandidate = String(candidate || '').trim();
  if (!cleanCandidate) return false;
  if (cleanStored.startsWith('scrypt$')) {
    const [, salt, expectedHex] = cleanStored.split('$');
    if (!salt || !expectedHex) return false;
    const derived = crypto.scryptSync(cleanCandidate, salt, 32);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
  return timingSafeStringEqual(cleanCandidate, cleanStored);
}

export function buildAllowedOriginChecker() {
  const envOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  for (const extraEnv of [process.env.PUBLIC_URL, process.env.RENDER_EXTERNAL_URL, process.env.CLOUD_FAILOVER_URL]) {
    if (extraEnv) {
      try {
        envOrigins.push(new URL(extraEnv).origin);
      } catch {}
    }
  }
  envOrigins.push(DEFAULT_PUBLIC_URL);
  const explicitSet = new Set(envOrigins);

  return function isOriginAllowed(origin) {
    if (!origin) return true;
    const cleanOrigin = origin.replace(/\/$/, '');
    if (explicitSet.has(cleanOrigin)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/i.test(cleanOrigin)) {
      return true;
    }
    return false;
  };
}
