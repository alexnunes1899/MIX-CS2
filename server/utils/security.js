import net from 'net';

const ALLOWED_DISCORD_WEBHOOK_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'canary.discord.com',
  'ptb.discord.com',
]);

const DANGEROUS_RCON_PREFIXES = [
  'rcon_password',
  'quit',
  'exit',
  '_restart',
  'shutdown',
  'killserver',
  'sv_rcon_',
];

/**
 * Escapes HTML special characters for safe interpolation inside HTML text and attributes.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Safely serializes a value for embedding inside an inline <script> tag.
 */
export function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Strips HTML tags and control characters, trims, and truncates.
 */
export function sanitizeInput(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates room IDs to prevent path, VDF, batch, or PowerShell injection.
 */
export function isValidRoomId(roomId) {
  if (typeof roomId !== 'string') return false;
  return /^[A-Za-z0-9_-]{1,32}$/.test(roomId.trim());
}

export function normalizeRoomId(roomId, fallback = 'MIX-PRO') {
  const cleaned = String(roomId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
  return cleaned || fallback;
}

/**
 * Validates CS2 map names (e.g. de_mirage, cs_office).
 */
export function isValidMapName(map) {
  if (typeof map !== 'string') return false;
  return /^[a-zA-Z0-9_\-]{3,32}$/.test(map.trim());
}

/**
 * Sanitizes an RCON command against chaining/injection and blocks destructive server commands.
 */
export function sanitizeRconCommand(cmd) {
  if (typeof cmd !== 'string') return '';
  const cleaned = cmd
    .replace(/[\r\n;`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  if (
    DANGEROUS_RCON_PREFIXES.some((prefix) =>
      prefix.endsWith('_')
        ? lower.startsWith(prefix)
        : lower === prefix || lower.startsWith(`${prefix} `)
    )
  ) {
    return '';
  }
  return cleaned;
}

/**
 * Sanitizes a player/user label before embedding inside an RCON say/teamname command.
 */
export function sanitizeRconTextArg(str, maxLength = 32) {
  return sanitizeInput(String(str || ''), maxLength)
    .replace(/["';\\`$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates Discord Snowflake IDs.
 */
export function isSnowflake(id) {
  return typeof id === 'string' && /^\d{17,22}$/.test(id.trim());
}

/**
 * Strict validation for Discord webhook URLs.
 */
export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    if (!ALLOWED_DISCORD_WEBHOOK_HOSTS.has(parsed.hostname.toLowerCase())) return false;
    if (parsed.username || parsed.password) return false;
    return /^\/api\/webhooks\/\d{17,22}\/[A-Za-z0-9_.-]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Checks whether a target host is a cloud metadata or link-local SSRF risk,
 * while permitting normal public IPs/domains and LAN/loopback hosts used by local CS2 servers.
 */
export function isBlockedMetadataHost(host) {
  if (!host || typeof host !== 'string') return true;
  const clean = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!clean || clean.length > 253) return true;

  const blockedHostnames = new Set([
    'metadata.google.internal',
    'metadata.goog',
    '169.254.169.254',
    '100.100.100.200',
    'fd00:ec2::254',
  ]);
  if (blockedHostnames.has(clean)) return true;

  if (net.isIPv4(clean)) {
    const parts = clean.split('.').map(Number);
    // Block 169.254.0.0/16 link-local / cloud metadata and 0.0.0.0
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0) return true;
  }

  return !/^[a-z0-9.-]+$/i.test(clean) && !net.isIP(clean);
}

/**
 * Resolves a safe external base URL from env override or validated request headers.
 */
export function resolveSafeBaseUrl(req, fallbackUrl = 'http://localhost:3000') {
  const envUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(envUrl)) {
    return envUrl;
  }
  const rawProto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http').split(',')[0].trim().toLowerCase();
  const proto = rawProto === 'https' ? 'https' : 'http';
  const rawHost = String(req?.get?.('host') || '').trim();
  if (rawHost && /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost)) {
    return `${proto}://${rawHost}`;
  }
  return fallbackUrl;
}

/**
 * Validates CS2 server IP/host:port string for /connect page.
 */
export function isValidServerAddress(addr) {
  if (typeof addr !== 'string') return false;
  const clean = addr.trim();
  if (!clean || clean.length > 100) return false;
  return /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(clean);
}
