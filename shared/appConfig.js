/**
 * Centralized public URLs and Discord bot configuration shared between server and frontend.
 */

export const DEFAULT_PUBLIC_URL = 'https://mix-cs2.onrender.com';
export const DEFAULT_DISCORD_CLIENT_ID = '1569029813518336030';

// Minimal bot permission bitmask:
// ManageChannels (16) + ViewChannel (1024) + SendMessages (2048) + ManageMessages (8192)
// + EmbedLinks (16384) + AttachFiles (32768) + ReadMessageHistory (65536)
// + MentionEveryone (131072) + MoveMembers (16777216) + ManageRoles (268435456)
export const DISCORD_BOT_PERMISSIONS = '285477904';

/**
 * Builds the Discord OAuth2 bot invite URL using least-privilege permissions.
 */
export function buildDiscordBotInviteUrl(clientId = DEFAULT_DISCORD_CLIENT_ID) {
  const cleanId = String(clientId || '').replace(/[^0-9]/g, '') || DEFAULT_DISCORD_CLIENT_ID;
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(cleanId)}&permissions=${DISCORD_BOT_PERMISSIONS}&integration_type=0&scope=bot+applications.commands`;
}
