import express from 'express';
import http from 'http';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { buildAllowedOriginChecker, getSessionUser, isAdminRequest } from './authSession.js';
import { createRoomLifecycle, buildPublicRoomsList, sanitizeInput } from './roomHelpers.js';
import { resolveSafeBaseUrl } from './utils/security.js';
import { DEFAULT_PUBLIC_URL } from '../shared/appConfig.js';
import { registerRoomSocket, processRoomDeadlines } from './socket/registerRoomSocket.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerAdminAndSocialRoutes } from './routes/adminRoutes.js';
import { registerInfraRoutes } from './routes/infraRoutes.js';
import { registerMatchAutomationRoutes } from './matchAutomation.js';

import { fetchLiveOfficialRotation, getCurrentRotationState } from './mapSync.js';
import { getGrenadesState, syncGrenadesPtBr, loadSavedGrenades } from './grenadeSync.js';
import { executeRconCommand } from './rcon.js';
import { getGsiState, setGsiState } from './gsi.js';
import { getSteamPlayerDetails } from './steamApi.js';
import { fetchFaceitPlayer } from './faceit.js';
import { sendDiscordWebhook, isValidDiscordWebhookUrl } from './discordWebhook.js';
import { getLeaderboard, recordMatch } from './leaderboard.js';
import { discordBotManager } from './discordBot.js';
import {
  getMatchHistoryState,
  recordMatchHistoryEntry,
  computeMatchMvp,
  onMatchHistoryUpdated,
  getMapImageUrl,
  normalizeMapName,
} from './matchHistory.js';
import { hardwareDealsManager } from './hardwareDeals.js';
import { SteamScannerService } from './steamScanner.js';
import { cs2NewsRadar } from './cs2NewsRadar.js';
import { proMatchesAgenda } from './proMatchesAgenda.js';
import { freeGamesRadar } from './freeGamesRadar.js';
import { communityClips } from './communityClips.js';
import { renderProfileHtml } from './profileHtml.js';
import {
  setPersistenceRefs,
  loadActiveMixState,
  scheduleSave,
  saveActiveMixStateNow,
} from './mixPersistence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createMixServer({ startBackgroundTasks = true, buildVersion = Date.now().toString() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security Hardening: OWASP HTTP Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });

  const isOriginAllowed = buildAllowedOriginChecker();
  const corsOptions = {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`Origin não permitida pela política CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  };

  app.use(express.json({ limit: '500kb' }));
  app.use(express.urlencoded({ extended: false, limit: '500kb' }));
  app.use(cors(corsOptions));

  const rooms = new Map();

  // Ultra-fast Healthcheck for Render / Railway / Docker
  app.get(['/health', '/api/health'], (req, res) => {
    return res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'cs2-mix-hub',
      activeRooms: rooms.size,
      discordBot: discordBotManager.getStatus().running,
    });
  });

  // Rate limiting
  const ipRateLimits = new Map();
  function createRateLimiter({ windowMs = 60000, max = 250, message = 'Muitas requisições. Tente novamente em breve.' }) {
    return (req, res, next) => {
      const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const ip = String(rawIp).split(',')[0].trim();
      const now = Date.now();
      const key = `${ip}:${req.baseUrl || req.path}`;
      let record = ipRateLimits.get(key);
      if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + windowMs };
        ipRateLimits.set(key, record);
      } else {
        record.count += 1;
      }

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      if (record.count > max) {
        return res.status(429).json({ error: message, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) });
      }
      next();
    };
  }

  const generalApiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300, message: 'Limite de requisições excedido na API.' });
  const sensitiveLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Muitas tentativas em endpoint sensível. Aguarde 1 minuto.' });
  const syncCooldownLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 5, message: 'Sincronização em cooldown. Aguarde alguns minutos.' });

  app.use('/api', generalApiLimiter);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('CORS blocked'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  const persistedMixState = loadActiveMixState();
  if (persistedMixState && Array.isArray(persistedMixState.rooms)) {
    for (const r of persistedMixState.rooms) {
      if (r && r.id && r.phase !== 'finished' && r.phase !== 'cancelled') {
        r.lastActivity = Date.now();
        rooms.set(r.id, r);
      }
    }
  }

  const lifecycle = createRoomLifecycle({
    io,
    rooms,
    getCurrentRotationState,
    scheduleSave,
  });

  const CLOUD_BASE_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || DEFAULT_PUBLIC_URL).replace(/\/+$/, '');
  const CLOUD_GSI_URL = process.env.CLOUD_GSI_URL || `${CLOUD_BASE_URL}/api/gsi/status/MIX-PRO`;
  const IS_LOCAL_PC = process.platform === 'win32' && !process.env.RENDER && !process.env.RAILWAY_ENVIRONMENT;

  registerRoomSocket({
    io,
    rooms,
    lifecycle,
    buildVersion,
    getMatchHistoryState,
    recordMatchHistoryEntry,
    computeMatchMvp,
    getMapImageUrl,
    normalizeMapName,
    getGsiState,
    recordMatch,
    getLeaderboard,
    fetchFaceitPlayer,
    getSteamPlayerDetails,
    fetchLiveOfficialRotation,
    executeRconCommand,
    sendDiscordWebhook,
    isValidDiscordWebhookUrl,
  });

  // Live Version Endpoint
  app.get('/api/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ version: buildVersion });
  });

  // Dynamic OpenGraph HTML injector (with absolute URLs for Discord / WhatsApp previews)
  const distPath = path.join(__dirname, '..', 'dist');
  function serveDynamicIndexHtml(req, res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(200).type('html').send('<!doctype html><html><body>CS2 Mix Hub API</body></html>');
    }

    try {
      let html = fs.readFileSync(indexPath, 'utf8');
      const originBase = resolveSafeBaseUrl(req, CLOUD_BASE_URL);
      const absoluteOgImage = escapeHtmlAttr(`${originBase}/favicon-512x512.png?v=3`);
      const absolutePageUrl = escapeHtmlAttr(`${originBase}${req.originalUrl || '/'}`);

      html = html
        .replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i, `<meta property="og:image" content="${absoluteOgImage}" />\n    <meta property="og:url" content="${absolutePageUrl}" />`)
        .replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${absoluteOgImage}" />`);

      const rawRoom = sanitizeInput(req.query.room || '', 24).toUpperCase();
      if (rawRoom) {
        const activeRoom = rooms.get(rawRoom);
        const queryName = sanitizeInput(req.query.name || '', 50);
        const roomTitle = activeRoom?.name || queryName || `Mix ${rawRoom}`;
        const playerCount = activeRoom?.players?.length || 0;
        const remaining = Math.max(0, 10 - playerCount);
        const rankLabel = (activeRoom?.rankingSystem || req.query.rank) === 'faceit' ? 'FACEIT' : 'Gamers Club';

        const ogTitle = playerCount > 0
          ? `🔥 Convite Mix CS2: ${roomTitle} (${playerCount}/10 na sala) — Bora fechar o 5v5!`
          : `🔥 Convite Mix CS2: ${roomTitle} (#${rawRoom}) — Bora fechar o 5v5!`;

        const ogDesc = playerCount > 0 && remaining > 0
          ? `Você foi chamado para a sala "${roomTitle}" (#${rawRoom} • ${rankLabel})! Faltam ${remaining} vagas para fechar o Mix 5v5. Clique para entrar direto na sala!`
          : `Você foi chamado para a sala "${roomTitle}" (#${rawRoom} • ${rankLabel})! Clique para entrar direto no lobby em tempo real, sortear os times e fazer o Pick & Ban de mapas!`;

        const safeTitle = escapeHtmlAttr(ogTitle);
        const safeDesc = escapeHtmlAttr(ogDesc);

        html = html
          .replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`)
          .replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${safeTitle}" />`)
          .replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${safeDesc}" />`)
          .replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${safeTitle}" />`)
          .replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${safeDesc}" />`);
      }

      return res.status(200).type('html').send(html);
    } catch (err) {
      console.warn('[SERVER] Fallback sendFile index.html:', err.message);
      return res.sendFile(indexPath);
    }
  }

  app.get('/', serveDynamicIndexHtml);

  app.use(express.static(distPath, {
    index: false,
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      } else if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
      }
    },
  }));

  // Steam direct connect handler (escaped against reflected XSS)
  app.get(['/connect', '/join-cs2'], (req, res) => {
    const rawIp = String(req.query.ip || req.query.address || '').trim();
    const queryPwd = String(req.query.pwd || req.query.password || '').trim();
    if (!rawIp) {
      return res.status(400).send('IP do servidor CS2 não fornecido.');
    }

    let cleanIp = rawIp.replace(/^connect\s+/i, '').trim();
    let password = queryPwd;
    const semiParts = cleanIp.split(';');
    if (semiParts.length >= 2) {
      cleanIp = semiParts[0].trim();
      const pwPart = semiParts[1].trim();
      if (!password && pwPart.toLowerCase().startsWith('password')) {
        password = pwPart.replace(/^password\s*=?\s*/i, '').replace(/['"]/g, '').trim();
      }
    }
    cleanIp = cleanIp.replace(/[;'"]/g, '').trim();
    const consoleCmd = password ? `connect ${cleanIp}; password ${password}` : `connect ${cleanIp}`;
    const safeCmdHtml = escapeHtmlAttr(consoleCmd);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CS2 Mix Hub - IP Copiado</title>
  <style>
    body { background: #0b0f17; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131b2e; border: 1px solid #1e293b; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 480px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); width: 90%; }
    h1 { color: #10b981; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; }
    code { background: #0f172a; padding: 0.75rem 1rem; border-radius: 0.5rem; color: #fbbf24; font-size: 1.15rem; display: block; margin-bottom: 1.25rem; font-family: monospace; border: 1px solid #334155; word-break: break-all; }
    .btn { display: block; width: 100%; box-sizing: border-box; background: #3b82f6; color: #fff; padding: 0.85rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; font-size: 1rem; border: none; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #2563eb; }
    .success-badge { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: bold; font-size: 0.9rem; margin-bottom: 1rem; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="success-badge">[OK] IP COPIADO COM SUCESSO!</div>
    <h1>CONEXAO AO SERVIDOR</h1>
    <p>O comando de console foi copiado para a sua area de transferencia. Basta colar (Ctrl+V) no console do seu CS2:</p>
    <code id="ipCode">${safeCmdHtml}</code>
    <button onclick="copyIp()" class="btn">Copiar Novamente</button>
  </div>
  <script>
    function getConnectCommand() {
      var el = document.getElementById('ipCode');
      return el ? el.textContent : '';
    }
    function copyIp() {
      var text = getConnectCommand();
      navigator.clipboard.writeText(text).then(function() {
        var badge = document.querySelector('.success-badge');
        badge.textContent = '[OK] COPIADO NOVAMENTE!';
        setTimeout(function() { badge.textContent = '[OK] IP COPIADO COM SUCESSO!'; }, 2000);
      });
    }
    window.onload = function() {
      try { navigator.clipboard.writeText(getConnectCommand()); } catch (e) {}
    };
  </script>
</body>
</html>`);
  });

  app.get(['/perfil', '/gc', '/profile'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).type('html').send(renderProfileHtml({ query: req.query }));
  });

  app.get('/api/player/profile', (req, res) => {
    const id = req.query.id || req.query.userId || null;
    if (!id) return res.status(400).json({ success: false, error: 'Identificador ausente.' });
    const profiles = discordBotManager.loadPlayerProfiles();
    return res.json({ success: true, profile: profiles[id] || null });
  });

  app.post('/api/player/profile', (req, res) => {
    const { id, userId, name, username, level, steamId } = req.body || {};
    const cleanId = id || userId;
    const cleanName = sanitizeInput(String(name || username || 'Jogador'), 40) || 'Jogador';
    const parsedLevel = parseInt(level, 10);

    if (isNaN(parsedLevel) || parsedLevel < 1 || parsedLevel > 21) {
      return res.status(400).json({ success: false, error: 'O nível Gamers Club deve ser entre 1 e 21.' });
    }

    const sessionUser = getSessionUser(req);
    const profileData = {
      level: parsedLevel,
      username: cleanName,
      name: cleanName,
      steamId: sessionUser?.steamId || (steamId ? String(steamId).trim() : ''),
      source: 'web_form',
      updatedAt: Date.now(),
    };

    if (cleanId) {
      discordBotManager.setPlayerProfile(cleanId, profileData);
    }

    scheduleSave(100);
    return res.json({ success: true, profile: profileData });
  });

  // Public Rooms Endpoints (with creator/admin authorization on DELETE)
  app.get('/api/rooms', (req, res) => {
    lifecycle.cleanupInactiveRooms();
    res.json(buildPublicRoomsList(rooms));
  });

  app.delete('/api/rooms/:roomId', (req, res) => {
    const cleanRoomId = (req.params.roomId || '').trim().toUpperCase();
    if (!rooms.has(cleanRoomId)) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }

    const room = rooms.get(cleanRoomId);
    const sessionUser = getSessionUser(req);
    const headerCreatorId = String(req.headers['x-creator-id'] || '').trim();
    const isEmpty = !room.players || room.players.length === 0;
    const isSteamOwner = Boolean(sessionUser?.steamId && room.creatorSteamId && sessionUser.steamId === room.creatorSteamId);
    const isGuestOwner = Boolean(!room.creatorSteamId && headerCreatorId && room.creatorId && headerCreatorId === room.creatorId);

    if (!isAdminRequest(req) && !isSteamOwner && !isGuestOwner && !isEmpty) {
      return res.status(403).json({ error: 'Apenas o criador da sala ou administrador pode excluí-la.' });
    }

    const roomName = room.name || cleanRoomId;
    io.to(cleanRoomId).emit('room_deleted', {
      roomId: cleanRoomId,
      reason: 'manual',
      message: `A sala ${roomName} foi excluída.`,
    });

    rooms.delete(cleanRoomId);
    lifecycle.broadcastRoomsList();
    return res.json({ success: true, message: `Sala ${cleanRoomId} excluída com sucesso.` });
  });

  // Public Content Feeds & Calculators
  app.get('/api/maps/rotation', (req, res) => res.json(getCurrentRotationState()));
  app.get('/api/maps/active-duty', (req, res) => {
    const state = getCurrentRotationState();
    const formatted = state.activeDutyMaps.map((m) => ({
      name: m.name,
      map: m.file,
      code: m.file,
      image: m.image,
      isActiveDuty: true,
    }));
    res.json({ success: true, maps: formatted, activeDutyIds: state.activeDutyIds, lastSync: state.lastSync });
  });

  app.post('/api/maps/sync-rotation', syncCooldownLimiter, async (req, res) => {
    try {
      const updatedState = await fetchLiveOfficialRotation();
      io.emit('active_rotation_updated', updatedState);
      rooms.forEach((r) => {
        if (r.phase === 'lobby') {
          r.maps = [...updatedState.activeDutyMaps];
          lifecycle.emitRoomState(r.id, r);
        }
      });
      res.json({ success: true, ...updatedState });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/grenades', (req, res) => res.json(getGrenadesState()));
  app.post('/api/grenades/sync', syncCooldownLimiter, async (req, res) => {
    try {
      const updated = await syncGrenadesPtBr();
      io.emit('grenades_feed_updated', updated);
      res.json({ success: true, ...updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/hardware/deals', async (req, res) => {
    try {
      const { category, store, query, limit } = req.query;
      const deals = await hardwareDealsManager.getDeals({
        category,
        store,
        query,
        limit: Math.min(20, parseInt(limit, 10) || 8),
      });
      res.json({ success: true, count: deals.length, deals });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get('/api/deals', (req, res) => res.redirect('/api/hardware/deals'));

  app.get('/api/cs2/patchnotes', async (req, res) => {
    try {
      const patch = await cs2NewsRadar.fetchLatestPatch();
      res.json({ success: true, patch });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/cs2/updates', async (req, res) => {
    try {
      const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 8));
      const forceRefresh = req.query.force === '1' || req.query.force === 'true';
      const data = await cs2NewsRadar.fetchRecentUpdates({ limit, forceRefresh });
      res.json({
        success: true,
        count: data.updates.length,
        latest: data.updates[0] || null,
        updates: data.updates,
        lastCheckedAt: data.lastCheckedAt,
        fromCache: Boolean(data.fromCache),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/esports/pro-matches', async (req, res) => {
    try {
      const matches = await proMatchesAgenda.getUpcomingMatches();
      res.json({ success: true, count: matches.length, matches });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/games/free', async (req, res) => {
    try {
      const data = await freeGamesRadar.getAllFreeGames();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/steam/scan', async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) return res.status(400).json({ success: false, error: 'Parâmetro query é obrigatório' });
      const scan = await SteamScannerService.scanProfile(query);
      res.json({ success: true, scan });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/community/clips', (req, res) => {
    try {
      const list = Array.from(communityClips.clips.values());
      res.json({ success: true, count: list.length, clips: list });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Register Modular Routes
  registerInfraRoutes(app, {
    io,
    rooms,
    lifecycle,
    discordBotManager,
    sensitiveLimiter,
    isLocalPc: IS_LOCAL_PC,
    cloudBaseUrl: CLOUD_BASE_URL,
  });
  registerAdminAndSocialRoutes(app, {
    io,
    rooms,
    discordBotManager,
    sensitiveLimiter,
  });
  registerAuthRoutes(app);
  registerMatchAutomationRoutes(app, { io, discordBotManager });

  app.use((req, res) => serveDynamicIndexHtml(req, res));

  // Background intervals managed cleanly for zero open handles on teardown
  const intervals = [];
  const deadlineInterval = setInterval(() => {
    processRoomDeadlines({ io, rooms, lifecycle });
  }, 1000);
  intervals.push(deadlineInterval);

  const cleanupInterval = setInterval(() => {
    lifecycle.cleanupInactiveRooms();
    const now = Date.now();
    for (const [key, val] of ipRateLimits.entries()) {
      if (now > val.resetAt) ipRateLimits.delete(key);
    }
  }, 60 * 1000);
  intervals.push(cleanupInterval);

  if (startBackgroundTasks) {
    fetchLiveOfficialRotation()
      .then(() => console.log('[SERVER] Rotação oficial inicializada com sucesso.'))
      .catch((err) => console.warn('[SERVER] Erro na rotação oficial inicial:', err.message));
    intervals.push(setInterval(() => fetchLiveOfficialRotation().catch(() => {}), 12 * 60 * 60 * 1000));

    loadSavedGrenades();
    syncGrenadesPtBr()
      .then((state) => console.log(`[SERVER] 🇧🇷 Feed de vídeos PT-BR pronto (${state.totalLineups} lineups validados).`))
      .catch((err) => console.warn('[SERVER] Erro na validação de vídeos PT-BR:', err.message));
    intervals.push(setInterval(() => syncGrenadesPtBr().catch(() => {}), 6 * 60 * 60 * 1000));

    let lastWebKnownUpdateGid = cs2NewsRadar.updatesHistory[0]?.gid || null;
    const syncCs2UpdatesFeed = async (forceRefresh = false) => {
      try {
        const data = await cs2NewsRadar.fetchRecentUpdates({ limit: 8, forceRefresh });
        const newest = data?.updates?.[0];
        if (newest?.gid && lastWebKnownUpdateGid && String(newest.gid) !== String(lastWebKnownUpdateGid)) {
          io.emit('cs2_update_released', newest);
        }
        if (newest?.gid) {
          lastWebKnownUpdateGid = String(newest.gid);
        }
      } catch {}
    };
    syncCs2UpdatesFeed(false);
    intervals.push(setInterval(() => syncCs2UpdatesFeed(true), 10 * 60 * 1000));

    let lastCloudGsiSync = 0;
    const gsiSyncInterval = setInterval(async () => {
      if (discordBotManager.lastGsiState && Date.now() - (discordBotManager.lastGsiState.receivedAt || 0) < 15000) {
        return;
      }
      try {
        const res = await fetch(CLOUD_GSI_URL, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          const localLast = discordBotManager.lastGsiState?.lastUpdate || 0;
          if (data && data.connected && data.lastUpdate && data.lastUpdate > lastCloudGsiSync && data.lastUpdate > localLast) {
            lastCloudGsiSync = data.lastUpdate;
            const liveState = { ...data, receivedAt: Date.now() };
            setGsiState('MIX-PRO', liveState);
            discordBotManager.handleGsiEvent('MIX-PRO', liveState);
            io.to('MIX-PRO').emit('gsi_update', liveState);
          }
        }
      } catch {}
    }, 1500);
    intervals.push(gsiSyncInterval);

    let cloudFailCount = 0;
    const ensureBotOnline = async () => {
      const hasLocalToken = Boolean(discordBotManager.config.token || process.env.DISCORD_BOT_TOKEN);
      if (!hasLocalToken) return;
      if (IS_LOCAL_PC) {
        let onlineUp = false;
        try {
          const res = await fetch(`${CLOUD_BASE_URL}/api/health`, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            cloudFailCount = 0;
            onlineUp = true;
          }
        } catch {}
        if (!onlineUp) cloudFailCount += 1;
        if (cloudFailCount < 2 && onlineUp) {
          if (discordBotManager.getStatus().running) {
            console.log('☁️ [FAILOVER] Servidor Online Principal detectado no ar! Colocando Bot Local em Standby...');
            await discordBotManager.stop().catch(() => {});
          }
          return;
        }
        if (cloudFailCount >= 2 && !discordBotManager.getStatus().running) {
          console.warn('🚨 [FAILOVER] Servidor Online fora do ar! Servidor Local assumindo o Bot do Discord...');
          await discordBotManager.start().catch(() => {});
        }
        return;
      }
      if (!discordBotManager.getStatus().running) {
        await discordBotManager.start().catch(() => {});
      }
    };
    ensureBotOnline();
    intervals.push(setInterval(ensureBotOnline, 20000));
  }

  async function close() {
    for (const timer of intervals) clearInterval(timer);
    io.close();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return { app, server, io, rooms, lifecycle, close };
}

// Execute HTTP server when invoked directly as entrypoint
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  process.on('unhandledRejection', (reason) => {
    console.warn('[SERVER WARN] Unhandled Rejection intercepted:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[SERVER ERROR] Uncaught Exception intercepted:', err);
  });

  const portArg = process.argv.find((arg) => arg.startsWith('--port='));
  const PORT = process.env.PORT || (portArg ? Number(portArg.split('=')[1]) : 3000);
  const { server, io, rooms, lifecycle, close } = createMixServer({ startBackgroundTasks: true });

  const persistedMixState = loadActiveMixState();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 [CS2 MIX HUB] Servidor rodando na porta ${PORT} em 0.0.0.0`);
    setPersistenceRefs(rooms, discordBotManager);
    if (persistedMixState && Array.isArray(persistedMixState.discordMixes)) {
      for (const item of persistedMixState.discordMixes) {
        if (item && item.channelId && item.mix && item.mix.phase !== 'finished' && item.mix.phase !== 'cancelled') {
          discordBotManager.activeMixes.set(item.channelId, item.mix);
          if (item.mix.id) discordBotManager.activeMixes.set(item.mix.id, item.mix);
        }
      }
    }
    discordBotManager.setWebRoomsReference(rooms);
    discordBotManager.onRoomUpdated = (roomId, room) => {
      if (room) lifecycle.emitRoomState(roomId, room);
      lifecycle.broadcastRoomsList();
      scheduleSave();
    };
    discordBotManager.onMatchRecorded = () => {
      io.emit('match_history_updated', getMatchHistoryState());
      io.emit('leaderboard_updated', getLeaderboard());
    };
    discordBotManager.onCs2UpdateReleased = (patch) => {
      if (patch) io.emit('cs2_update_released', patch);
    };
    onMatchHistoryUpdated(() => {
      io.emit('match_history_updated', getMatchHistoryState());
    });
  });

  const shutdown = (signal) => {
    console.log(`🛑 [CS2 MIX HUB] Recebido ${signal}, salvando mixes e encerrando servidor...`);
    try {
      saveActiveMixStateNow();
    } catch {}
    close().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 4000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('beforeExit', () => {
    try {
      saveActiveMixStateNow();
    } catch {}
  });
}
