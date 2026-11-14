/**
 * Discord Voice Channel Mover Integration
 * Uses Discord Bot REST API (requires Bot Token with MOVE_MEMBERS permission).
 * Moves players between Lobby voice channel, Team A voice channel, and Team B voice channel.
 */

import { isSnowflake } from './utils/security.js';

export async function moveGuildMember({ botToken, guildId, userId, targetChannelId }) {
  if (!botToken || !guildId || !userId || !targetChannelId) {
    throw new Error('Parâmetros incompletos para mover membro no Discord.');
  }
  if (!isSnowflake(String(guildId)) || !isSnowflake(String(userId)) || !isSnowflake(String(targetChannelId))) {
    throw new Error('IDs do Discord inválidos (esperado formato Snowflake numérico).');
  }

  const cleanToken = String(botToken).trim().replace(/^Bot\s+/i, '');
  const url = `https://discord.com/api/v10/guilds/${String(guildId).trim()}/members/${String(userId).trim()}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel_id: String(targetChannelId).trim(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord API error (${response.status}): ${errorBody}`);
  }

  return { success: true };
}

export async function testDiscordBotVoiceChannels({ botToken, guildId, channelId }) {
  if (!botToken || !channelId) {
    throw new Error('Token e ID do canal são obrigatórios.');
  }
  if (!isSnowflake(String(channelId)) || (guildId && !isSnowflake(String(guildId)))) {
    throw new Error('IDs do Discord inválidos.');
  }
  const cleanToken = String(botToken).trim().replace(/^Bot\s+/i, '');
  const url = `https://discord.com/api/v10/channels/${String(channelId).trim()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bot ${cleanToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Canal inacessível ou token inválido (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return { success: true, channelName: data.name, channelType: data.type };
}
