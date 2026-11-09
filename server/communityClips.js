import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIPS_FILE = path.join(__dirname, 'data', 'communityClips.json');

export class CommunityClipsService {
  constructor() {
    this.clips = new Map();
    this.loadClips();
  }

  loadClips() {
    try {
      if (fs.existsSync(CLIPS_FILE)) {
        const raw = fs.readFileSync(CLIPS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [id, clip] of Object.entries(data)) {
          this.clips.set(id, clip);
        }
      }
    } catch (e) {}
  }

  saveClips() {
    try {
      const dir = path.dirname(CLIPS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      for (const [id, clip] of this.clips.entries()) {
        obj[id] = clip;
      }
      fs.writeFileSync(CLIPS_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {}
  }

  detectPlatform(url) {
    if (!url) return { platform: 'Outro', icon: '🎬' };
    if (/medal\.tv/i.test(url)) return { platform: 'Medal.tv', icon: '🎖️' };
    if (/twitch\.tv/i.test(url)) return { platform: 'Twitch Clip', icon: '🟣' };
    if (/youtube\.com|youtu\.be/i.test(url)) return { platform: 'YouTube', icon: '🔴' };
    if (/streamable\.com/i.test(url)) return { platform: 'Streamable', icon: '📹' };
    if (/tiktok\.com/i.test(url)) return { platform: 'TikTok', icon: '📱' };
    return { platform: 'Link de Vídeo', icon: '🎬' };
  }

  submitClip(user, clipUrl, title = '') {
    if (!clipUrl || !/^https?:\/\//i.test(clipUrl.trim())) {
      throw new Error('Link de clipe inválido! Envie um link válido (Medal.tv, Twitch, YouTube, etc).');
    }

    const cleanUrl = clipUrl.trim();
    const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const platformInfo = this.detectPlatform(cleanUrl);

    const clip = {
      id: clipId,
      url: cleanUrl,
      title: title && title.trim() ? title.trim() : 'Jogada Histórica no Mix CS2',
      authorId: user.id,
      authorName: user.username,
      authorAvatar: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL() : null,
      platform: platformInfo.platform,
      platformIcon: platformInfo.icon,
      createdAt: new Date().toISOString(),
      votes: {
        fire: [], // user IDs
        bagre: [], // user IDs
      },
    };

    this.clips.set(clipId, clip);
    this.saveClips();
    return clip;
  }

  voteClip(clipId, userId, voteType = 'fire') {
    const clip = this.clips.get(clipId);
    if (!clip) return null;

    if (!clip.votes) clip.votes = { fire: [], bagre: [] };

    // Remove user from both arrays first (toggle/switch vote)
    const hadFire = clip.votes.fire.includes(userId);
    const hadBagre = clip.votes.bagre.includes(userId);

    clip.votes.fire = clip.votes.fire.filter((id) => id !== userId);
    clip.votes.bagre = clip.votes.bagre.filter((id) => id !== userId);

    if (voteType === 'fire') {
      if (!hadFire) clip.votes.fire.push(userId);
    } else if (voteType === 'bagre') {
      if (!hadBagre) clip.votes.bagre.push(userId);
    }

    this.saveClips();
    return clip;
  }

  buildEmbed(clip) {
    const fireCount = clip.votes?.fire?.length || 0;
    const bagreCount = clip.votes?.bagre?.length || 0;

    const embed = new EmbedBuilder()
      .setTitle(`${clip.platformIcon} CLIPE DA COMUNIDADE: ${clip.title.toUpperCase()}`)
      .setURL(clip.url)
      .setColor(0x8b5cf6) // Purple
      .setDescription(
        `🎬 Enviado por <@${clip.authorId}> (**${clip.authorName}**)\n` +
        `🌐 Plataforma: **${clip.platform}**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Assista ao clipe e vote se foi **skill pura** ou **puro milagre de bagre**!\n\n` +
        `🔗 **[CLIQUE AQUI PARA ASSISTIR AO CLIPE](${clip.url})**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '🔥 Jogou Muito / Skill',
          value: `**${fireCount} votos**`,
          inline: true,
        },
        {
          name: '💩 Foi Sorte / Bagre',
          value: `**${bagreCount} votos**`,
          inline: true,
        }
      )
      .setFooter({
        text: 'Galeria de Clipes CS2 Mix Hub • Vote usando os botões abaixo',
        iconURL: clip.authorAvatar || 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg',
      })
      .setTimestamp(new Date(clip.createdAt));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`clip_vote_fire_${clip.id}`)
        .setLabel(`🔥 Jogou Muito (${fireCount})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`clip_vote_bagre_${clip.id}`)
        .setLabel(`💩 Foi Sorte / Bagre (${bagreCount})`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setLabel('Assistir Clipe')
        .setStyle(ButtonStyle.Link)
        .setURL(clip.url)
        .setEmoji('▶️')
    );

    return { embeds: [embed], components: [row] };
  }
}

export const communityClips = new CommunityClipsService();
