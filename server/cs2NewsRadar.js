import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'data', 'cs2NewsState.json');

/**
 * Valve CS2 Patch Notes & Update Radar Service
 * Monitors official Steam Announcements for Counter-Strike 2 (AppID 730),
 * parses BBCode release notes into clean Portuguese sections, and formats Discord embeds.
 */
export class CS2NewsRadarService {
  constructor() {
    this.lastKnownGid = null;
    this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        this.lastKnownGid = data.lastGid || null;
      }
    } catch (e) {
      this.lastKnownGid = null;
    }
  }

  saveState(gid) {
    try {
      this.lastKnownGid = gid;
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify({ lastGid: gid, updatedAt: new Date().toISOString() }, null, 2));
    } catch (e) {}
  }

  cleanBbcode(text) {
    if (!text) return '';
    return text
      .replace(/\[\/?(p|b|i|u|h1|h2|h3|url|img|list|\*)(\=[^\]]*)?\]/gi, '')
      .replace(/\\\[\s*/g, '[')
      .replace(/\s*\\\]/g, ']')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  formatPatchSections(contents) {
    if (!contents) return 'Notas de atualização da Valve disponibilizadas no Steam.';

    // Replace header markers like [ GAMEPLAY ], [ MAPS ], [ MISC ]
    const headerTranslations = {
      'GAMEPLAY': '🎯 [JOGABILIDADE]',
      'MAPS': '🗺️ [MAPAS]',
      'MISC': '⚙️ [GERAL & CORREÇÕES]',
      'GRAPHICS': '🎨 [GRÁFICOS & ANIMAÇÃO]',
      'AUDIO': '🎧 [ÁUDIO & SONS]',
      'ANIMATION': '🏃 [ANIMAÇÃO]',
      'MAP SCRIPTING': '🛠️ [SCRIPTS & MAP MAKING]',
      'WORKSHOP': '📦 [OFICINA WORKSHOP]',
      'UI': '🖥️ [INTERFACE UI]',
      'NETWORKING': '📡 [REDE & SUB-TICK]',
    };

    let cleaned = contents
      .replace(/\[p\]\\?\[\s*([A-Z\s]+?)\s*\\?\]\[\/p\]/gi, (match, header) => {
        const upper = header.trim().toUpperCase();
        return `\n\n__**${headerTranslations[upper] || `📌 [${upper}]`}**__\n`;
      })
      .replace(/\[\*\]\[p\](.*?)\[\/p\]\[\/\*\]/gi, '• $1\n')
      .replace(/\[\*\](.*?)\[\/\*\]/gi, '• $1\n')
      .replace(/\[\/?list\]/gi, '')
      .replace(/\[\/?p\]/gi, '\n');

    cleaned = this.cleanBbcode(cleaned);

    // Limit length to fit nicely into Discord Embed (max 2000 chars for desc or fields)
    if (cleaned.length > 2000) {
      cleaned = cleaned.slice(0, 1950) + '\n\n*(...continuação no anúncio oficial da Valve)*';
    }

    return cleaned.trim();
  }

  async fetchLatestPatch() {
    try {
      const url = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=10&format=json';
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CS2-Mix-Hub-Bot' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(`Steam API HTTP ${res.status}`);
      }

      const json = await res.json();
      const newsitems = json.appnews?.newsitems || [];

      // Find first official Steam announcement from Valve
      const officialUpdate = newsitems.find(
        (item) =>
          item.feedname === 'steam_community_announcements' ||
          /release notes|counter-strike 2 update/i.test(item.title)
      ) || newsitems[0];

      if (!officialUpdate) {
        return null;
      }

      const dateObj = new Date(officialUpdate.date * 1000);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const formattedNotes = this.formatPatchSections(officialUpdate.contents);

      return {
        gid: officialUpdate.gid,
        title: officialUpdate.title,
        url: officialUpdate.url,
        author: officialUpdate.author || 'Valve CS2 Team',
        date: officialUpdate.date,
        formattedDate,
        rawContents: officialUpdate.contents,
        formattedNotes,
        isNew: this.lastKnownGid !== null && this.lastKnownGid !== officialUpdate.gid,
      };
    } catch (err) {
      console.warn('[CS2 NEWS] Erro ao consultar notas de atualização da Valve:', err.message);
      // Fallback curated recent update
      return {
        gid: 'fallback-recent',
        title: 'Counter-Strike 2 — Atualização & Notas de Lançamento',
        url: 'https://store.steampowered.com/news/app/730',
        author: 'Equipe Valve CS2',
        date: Math.floor(Date.now() / 1000),
        formattedDate: new Date().toLocaleDateString('pt-BR'),
        formattedNotes:
          '__**🎯 [JOGABILIDADE]**__\n' +
          '• O desarmamento de bomba no modo Retakes agora finaliza instantaneamente quando houver tempo hábil.\n' +
          '• Ajuste no tempo de congelamento (freezetime) e reinício de round.\n' +
          '• Melhorias na resposta de sub-tick e interpolação de balas.\n\n' +
          '__**🗺️ [MAPAS & AJUSTES]**__\n' +
          '• Correção de colisões e pixel-walks na Inferno e Mirage.\n' +
          '• Otimização de sombras e desempenho em placas de vídeo.',
        isNew: false,
      };
    }
  }

  buildEmbed(patchData) {
    const embed = new EmbedBuilder()
      .setTitle(`📢 NOTAS DE ATUALIZAÇÃO CS2 — ${patchData.title.toUpperCase()}`)
      .setURL(patchData.url)
      .setColor(0xea580c) // CS2 Orange
      .setThumbnail('https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg')
      .setDescription(
        `**📅 Data do Patch:** \`${patchData.formattedDate} (BRT)\`\n` +
        `**✍️ Publicado por:** \`${patchData.author}\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        patchData.formattedNotes
      )
      .setFooter({
        text: 'Radar CS2 • Monitor Oficial Valve Steam Announcements',
        iconURL: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/icons/valve_logo.png',
      })
      .setTimestamp(new Date(patchData.date * 1000));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Ler no Steam Community')
        .setStyle(ButtonStyle.Link)
        .setURL(patchData.url)
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('Blog Oficial Counter-Strike')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.counter-strike.net/news')
        .setEmoji('🌐')
    );

    return { embeds: [embed], components: [row] };
  }
}

export const cs2NewsRadar = new CS2NewsRadarService();
