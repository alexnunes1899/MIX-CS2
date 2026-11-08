/**
 * Discord Voice Channel Mover Integration
 * Uses Discord Bot REST API (requires Bot Token with MOVE_MEMBERS permission).
 * Moves players between Lobby voice channel, Team A voice channel, and Team B voice channel.
 */

export async function moveGuildMember({ botToken, guildId, userId, targetChannelId }) {
  if (!botToken || !guildId || !userId || !targetChannelId) {
    throw new Error('Parâmetros incompletos para mover membro no Discord.');
  }

  const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel_id: targetChannelId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord API error (${response.status}): ${errorBody}`);
  }

  return { success: true };
}

export async function testDiscordBotVoiceChannels({ botToken, guildId, channelId }) {
  const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
  const url = `https://discord.com/api/v10/channels/${channelId}`;

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
