const EXTERNAL_HTTPS_REGEX = /^https:\/\//i;
const IMAGE_SRC_REGEX = /^(https?:\/\/|data:image\/|\/(?!\/))/i;

export function isImageUrl(src) {
  return typeof src === 'string' && IMAGE_SRC_REGEX.test(src.trim());
}

export function buildAvatarProxyUrl(src) {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!EXTERNAL_HTTPS_REGEX.test(trimmed)) return null;
  return `/api/avatar-proxy?url=${encodeURIComponent(trimmed)}`;
}

function loadSingleImage(src, { timeoutMs = 4000, crossOrigin = null } = {}) {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

/**
 * Carrega uma imagem segura para uso em Canvas (`toDataURL` sem tainting).
 * Para URLs HTTPS externas (ex.: avatars.steamstatic.com), tenta CORS direto
 * e faz fallback automático via `/api/avatar-proxy` caso o CDN ou extensão bloqueie CORS.
 */
export async function loadCanvasImage(src, { timeoutMs = 4000, useAvatarProxyFallback = true } = {}) {
  if (!isImageUrl(src)) return null;
  const trimmed = src.trim();
  const isRemote = /^https?:\/\//i.test(trimmed);

  const directImg = await loadSingleImage(trimmed, {
    timeoutMs,
    crossOrigin: isRemote ? 'anonymous' : null,
  });
  if (directImg) return directImg;

  if (useAvatarProxyFallback) {
    const proxyUrl = buildAvatarProxyUrl(trimmed);
    if (proxyUrl) {
      return loadSingleImage(proxyUrl, { timeoutMs });
    }
  }

  return null;
}

export function drawCover(ctx, img, x, y, w, h) {
  if (!img || !img.width || !img.height) return;
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function getInitials(nick) {
  const clean = String(nick || '').trim();
  if (!clean) return 'CS';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function drawCircularAvatar(
  ctx,
  {
    cx,
    cy,
    radius = 120,
    img = null,
    nick = 'Jogador',
    emojiAvatar = '',
    bgColor = '#0f172a',
    borderColor = '#f59e0b',
    borderWidth = 8,
  }
) {
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  if (img && img.width && img.height) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    const grad = ctx.createRadialGradient(cx, cy - radius * 0.25, radius * 0.1, cx, cy, radius);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hasEmojiFallback = typeof emojiAvatar === 'string' && emojiAvatar.trim() && !isImageUrl(emojiAvatar);
    if (hasEmojiFallback) {
      ctx.font = `${Math.round(radius * 0.85)}px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif`;
      ctx.fillText(emojiAvatar.trim(), cx, cy + 4);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = `900 ${Math.round(radius * 0.68)}px "Chakra Petch", system-ui, sans-serif`;
      ctx.fillText(getInitials(nick), cx, cy + 4);
    }
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function getPlayerDedupeKey(player) {
  if (!player || typeof player !== 'object') return null;
  if (player.steamId) return `steam:${String(player.steamId).trim()}`;
  if (player.id) return `id:${String(player.id).trim()}`;
  if (player.nick) return `nick:${String(player.nick).trim().toLowerCase()}`;
  return null;
}

function mergePlayerFields(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    const current = merged[key];
    const currentEmpty = current === undefined || current === null || current === '';
    const incomingPresent = value !== undefined && value !== null && value !== '';
    // Prefer HTTP avatar URLs over generic emoji fallbacks
    if (key === 'avatar' && incomingPresent && isImageUrl(value) && !isImageUrl(current)) {
      merged[key] = value;
      continue;
    }
    if (currentEmpty && incomingPresent) {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Reúne jogadores disponíveis para o Story Card (times sorteados -> lobby -> perfil atual),
 * deduplicando e preservando campos mais ricos (ex.: avatar Steam completo).
 */
export function collectStoryPlayers({ room = null, initialPlayer = null } = {}) {
  const sources = [
    ...(Array.isArray(room?.teamA) ? room.teamA : []),
    ...(Array.isArray(room?.teamB) ? room.teamB : []),
    ...(Array.isArray(room?.players) ? room.players : []),
    ...(initialPlayer && (initialPlayer.nick || initialPlayer.steamId || initialPlayer.id) ? [initialPlayer] : []),
  ];

  const orderedKeys = [];
  const byKey = new Map();
  const keyAliases = new Map();

  for (const raw of sources) {
    if (!raw || typeof raw !== 'object') continue;
    if (!raw.nick && !raw.steamId && !raw.id) continue;

    const steamAlias = raw.steamId ? `steam:${String(raw.steamId).trim()}` : null;
    const idAlias = raw.id ? `id:${String(raw.id).trim()}` : null;
    const nickAlias = raw.nick ? `nick:${String(raw.nick).trim().toLowerCase()}` : null;

    const existingKey =
      (steamAlias && keyAliases.get(steamAlias)) ||
      (idAlias && keyAliases.get(idAlias)) ||
      (nickAlias && keyAliases.get(nickAlias)) ||
      getPlayerDedupeKey(raw);

    if (!existingKey) continue;

    const normalized = {
      ...raw,
      id: raw.id || (raw.steamId ? `steam-${raw.steamId}` : `nick-${String(raw.nick || 'player').toLowerCase()}`),
      nick: raw.nick || 'Jogador',
    };

    if (!byKey.has(existingKey)) {
      orderedKeys.push(existingKey);
      byKey.set(existingKey, normalized);
    } else {
      byKey.set(existingKey, mergePlayerFields(byKey.get(existingKey), normalized));
    }

    if (steamAlias) keyAliases.set(steamAlias, existingKey);
    if (idAlias) keyAliases.set(idAlias, existingKey);
    if (nickAlias) keyAliases.set(nickAlias, existingKey);
  }

  return orderedKeys.map((k) => byKey.get(k));
}
