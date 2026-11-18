import fs from 'fs';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { resolveSeededDataFile } from './dataDir.js';
import { writeJsonAtomic } from './utils/atomicJson.js';
import { logger } from './utils/logger.js';
import { sanitizeInput } from './utils/security.js';
import { sqliteStore } from './storage/sqliteStore.js';

const CLIPS_FILE = resolveSeededDataFile('communityClips.json');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getClipEmbedInfo(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { type: 'link', embedUrl: null };
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
        return { type: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
      }
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const vParam = parsed.searchParams.get('v');
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const id =
        vParam ||
        (pathParts[0] === 'shorts' || pathParts[0] === 'embed' ? pathParts[1] : null);
      if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
        return { type: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
      }
    }
    if (host === 'streamable.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9]{4,16}$/.test(id)) {
        return { type: 'streamable', embedUrl: `https://streamable.com/e/${id}` };
      }
    }
    if (host.includes('medal.tv')) {
      return { type: 'medal', embedUrl: null };
    }
    if (host.includes('twitch.tv')) {
      return { type: 'twitch', embedUrl: null };
    }
  } catch {}
  return { type: 'link', embedUrl: null };
}

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
    } catch (e) {
      logger.warn('CLIPS', 'Falha ao ler communityClips.json', e);
    }
  }

  saveClips() {
    try {
      const obj = {};
      for (const [id, clip] of this.clips.entries()) {
        obj[id] = clip;
        if (sqliteStore) {
          sqliteStore.setJson('community_clips', id, clip);
        }
      }
      writeJsonAtomic(CLIPS_FILE, obj);
    } catch (e) {
      logger.warn('CLIPS', 'Falha ao salvar communityClips.json', e);
    }
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

  submitClip(user, clipUrl, title = '', map = '') {
    let parsedUrl;
    try {
      parsedUrl = new URL(String(clipUrl || '').trim());
    } catch {
      throw new Error('Link de clipe inválido! Envie um link HTTP/HTTPS válido (Medal.tv, Twitch, YouTube, etc).');
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('Protocolo de clipe inválido! Use apenas links https:// ou http://.');
    }

    const cleanUrl = parsedUrl.toString();
    const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const platformInfo = this.detectPlatform(cleanUrl);
    const embedInfo = getClipEmbedInfo(cleanUrl);
    const cleanTitle = sanitizeInput(String(title || ''), 90) || 'Jogada Histórica no Mix CS2';
    const cleanAuthorName = sanitizeInput(String(user?.username || user?.nick || 'Jogador'), 40) || 'Jogador';
    const cleanMap = sanitizeInput(String(map || ''), 24);

    const clip = {
      id: clipId,
      url: cleanUrl,
      embedType: embedInfo.type,
      embedUrl: embedInfo.embedUrl,
      title: cleanTitle,
      map: cleanMap || '',
      authorId: String(user?.id || 'web-guest'),
      authorName: cleanAuthorName,
      authorAvatar: typeof user?.displayAvatarURL === 'function' ? user.displayAvatarURL() : (user?.avatar || null),
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

  listClips({ sort = 'recent', platform = 'all' } = {}) {
    const all = Array.from(this.clips.values()).map((c) => {
      const fireCount = Array.isArray(c.votes?.fire) ? c.votes.fire.length : 0;
      const bagreCount = Array.isArray(c.votes?.bagre) ? c.votes.bagre.length : 0;
      const embedInfo = c.embedUrl ? { type: c.embedType, embedUrl: c.embedUrl } : getClipEmbedInfo(c.url);
      return {
        ...c,
        embedType: embedInfo.type,
        embedUrl: embedInfo.embedUrl,
        fireCount,
        bagreCount,
        score: fireCount - bagreCount,
      };
    });

    const now = Date.now();
    const weeklyPool = all.filter((c) => {
      const ts = Date.parse(c.createdAt || '');
      return !Number.isNaN(ts) && now - ts <= WEEK_MS;
    });
    const highlightSource = weeklyPool.length > 0 ? weeklyPool : all;
    const clipOfTheWeek =
      [...highlightSource].sort(
        (a, b) => b.fireCount - a.fireCount || b.score - a.score || Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)
      )[0] || null;

    let filtered = all;
    if (platform && platform !== 'all') {
      const pLower = String(platform).toLowerCase();
      filtered = filtered.filter((c) => String(c.platform || '').toLowerCase().includes(pLower));
    }

    if (sort === 'top') {
      filtered.sort(
        (a, b) => b.fireCount - a.fireCount || b.score - a.score || Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)
      );
    } else {
      filtered.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    }

    return {
      clips: filtered,
      clipOfTheWeek,
    };
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
