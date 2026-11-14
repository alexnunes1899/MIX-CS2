import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  safeJsonForHtml,
  sanitizeInput,
  isValidRoomId,
  normalizeRoomId,
  isValidMapName,
  sanitizeRconCommand,
  sanitizeRconTextArg,
  isSnowflake,
  isValidDiscordWebhookUrl,
  isBlockedMetadataHost,
  resolveSafeBaseUrl,
  isValidServerAddress,
} from '../server/utils/security.js';

test('escapeHtml neutralizes HTML and quote characters', () => {
  assert.equal(
    escapeHtml(`<script>alert("xss" & 'test')</script>`),
    '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;test&#39;)&lt;&#x2F;script&gt;'
  );
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('safeJsonForHtml escapes closing script tags and line separators', () => {
  const serialized = safeJsonForHtml({ html: '</script><img src=x>&\u2028\u2029' });
  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('>'), false);
  assert.equal(serialized.includes('&'), false);
  assert.match(serialized, /\\u003c\/script\\u003e/);
});

test('sanitizeInput strips HTML tags, control chars, trims and truncates', () => {
  assert.equal(sanitizeInput('  <b>Alex</b>\x00\x07  ', 20), 'Alex');
  assert.equal(sanitizeInput('abcdef', 3), 'abc');
  assert.equal(sanitizeInput(12345), '');
});

test('isValidRoomId and normalizeRoomId enforce safe identifiers', () => {
  assert.equal(isValidRoomId('MIX-PRO_1'), true);
  assert.equal(isValidRoomId('../etc/passwd'), false);
  assert.equal(isValidRoomId('room with space'), false);
  assert.equal(normalizeRoomId('  mix$pro/.. '), 'MIXPRO');
  assert.equal(normalizeRoomId('!!!', 'DEFAULT-ROOM'), 'DEFAULT-ROOM');
});

test('isValidMapName validates CS2 map names', () => {
  assert.equal(isValidMapName('de_mirage'), true);
  assert.equal(isValidMapName('cs_office'), true);
  assert.equal(isValidMapName('de_mirage; quit'), false);
  assert.equal(isValidMapName('ab'), false);
});

test('sanitizeRconCommand blocks dangerous commands and command chaining', () => {
  assert.equal(sanitizeRconCommand('rcon_password secret'), '');
  assert.equal(sanitizeRconCommand('QUIT'), '');
  assert.equal(sanitizeRconCommand('exit'), '');
  assert.equal(sanitizeRconCommand('_restart'), '');
  assert.equal(sanitizeRconCommand('killserver'), '');
  assert.equal(sanitizeRconCommand('sv_rcon_banpenalty 0'), '');
  assert.equal(sanitizeRconCommand('changelevel de_mirage; mp_restartgame 1'), 'changelevel de_mirage mp_restartgame 1');
  assert.equal(sanitizeRconCommand('mp_pause_match\nquit'), 'mp_pause_match quit');
});

test('sanitizeRconTextArg strips quotes, semicolons and command tokens', () => {
  assert.equal(sanitizeRconTextArg('Time "Alpha"; quit\\$test', 40), 'Time Alpha quittest');
});

test('isSnowflake validates Discord snowflake IDs', () => {
  assert.equal(isSnowflake('123456789012345678'), true);
  assert.equal(isSnowflake('12345'), false);
  assert.equal(isSnowflake('abc123456789012345'), false);
});

test('isValidDiscordWebhookUrl permits only HTTPS Discord webhook endpoints', () => {
  assert.equal(
    isValidDiscordWebhookUrl('https://discord.com/api/webhooks/123456789012345678/AbCdEf_123-xyz'),
    true
  );
  assert.equal(
    isValidDiscordWebhookUrl('https://canary.discord.com/api/webhooks/123456789012345678/token'),
    true
  );
  assert.equal(
    isValidDiscordWebhookUrl('http://discord.com/api/webhooks/123456789012345678/token'),
    false
  );
  assert.equal(
    isValidDiscordWebhookUrl('https://evil.example/api/webhooks/123456789012345678/token'),
    false
  );
});

test('isBlockedMetadataHost blocks cloud metadata IPs while allowing LAN/loopback CS2 hosts', () => {
  assert.equal(isBlockedMetadataHost('169.254.169.254'), true);
  assert.equal(isBlockedMetadataHost('169.254.10.20'), true);
  assert.equal(isBlockedMetadataHost('metadata.google.internal'), true);
  assert.equal(isBlockedMetadataHost('0.0.0.0'), true);
  assert.equal(isBlockedMetadataHost('192.168.1.10'), false);
  assert.equal(isBlockedMetadataHost('127.0.0.1'), false);
  assert.equal(isBlockedMetadataHost('play.cs2mix.local'), false);
});

test('resolveSafeBaseUrl validates host header and falls back cleanly', () => {
  const prevPublic = process.env.PUBLIC_URL;
  const prevRender = process.env.RENDER_EXTERNAL_URL;
  delete process.env.PUBLIC_URL;
  delete process.env.RENDER_EXTERNAL_URL;

  try {
    const validReq = {
      headers: { 'x-forwarded-proto': 'https' },
      protocol: 'http',
      get: (k) => (k.toLowerCase() === 'host' ? 'mix.example.com:8443' : ''),
    };
    assert.equal(resolveSafeBaseUrl(validReq), 'https://mix.example.com:8443');

    const badReq = {
      headers: {},
      protocol: 'http',
      get: () => 'evil.com/path?x=1',
    };
    assert.equal(resolveSafeBaseUrl(badReq, 'http://localhost:3000'), 'http://localhost:3000');
  } finally {
    if (prevPublic !== undefined) process.env.PUBLIC_URL = prevPublic;
    if (prevRender !== undefined) process.env.RENDER_EXTERNAL_URL = prevRender;
  }
});

test('isValidServerAddress validates CS2 server host[:port]', () => {
  assert.equal(isValidServerAddress('189.1.168.10:27015'), true);
  assert.equal(isValidServerAddress('server.cs2.gg'), true);
  assert.equal(isValidServerAddress('189.1.168.10:27015; quit'), false);
  assert.equal(isValidServerAddress(''), false);
});
