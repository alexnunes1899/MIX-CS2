import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'data', 'cs2NewsState.json');

const CS2_PROTECTED_TERMS = [
  { term: 'Dust II', token: '__CS2MAP_DUST2__' },
  { term: 'Dust 2', token: '__CS2MAP_DUST2B__' },
  { term: 'Mirage', token: '__CS2MAP_MIRAGE__' },
  { term: 'Inferno', token: '__CS2MAP_INFERNO__' },
  { term: 'Nuke', token: '__CS2MAP_NUKE__' },
  { term: 'Ancient', token: '__CS2MAP_ANCIENT__' },
  { term: 'Anubis', token: '__CS2MAP_ANUBIS__' },
  { term: 'Vertigo', token: '__CS2MAP_VERTIGO__' },
  { term: 'Overpass', token: '__CS2MAP_OVERPASS__' },
  { term: 'Train', token: '__CS2MAP_TRAIN__' },
  { term: 'Cache', token: '__CS2MAP_CACHE__' },
  { term: 'Baggage', token: '__CS2MAP_BAGGAGE__' },
  { term: 'Shoots', token: '__CS2MAP_SHOOTS__' },
  { term: 'Italy', token: '__CS2MAP_ITALY__' },
  { term: 'Office', token: '__CS2MAP_OFFICE__' },
  { term: 'Pool Day', token: '__CS2MAP_POOLDAY__' },
  { term: 'Thera', token: '__CS2MAP_THERA__' },
  { term: 'Mills', token: '__CS2MAP_MILLS__' },
  { term: 'Basalt', token: '__CS2MAP_BASALT__' },
  { term: 'Edin', token: '__CS2MAP_EDIN__' },
  { term: 'Sub-tick', token: '__CS2TERM_SUBTICK__' },
  { term: 'sub-tick', token: '__CS2TERM_SUBTICK_L__' },
  { term: 'Jumpthrow', token: '__CS2TERM_JUMPTHROW__' },
  { term: 'jumpthrow', token: '__CS2TERM_JUMPTHROW_L__' },
  { term: 'Premier', token: '__CS2TERM_PREMIER__' },
  { term: 'Retake', token: '__CS2TERM_RETAKE__' },
  { term: 'Retakes', token: '__CS2TERM_RETAKES__' },
  { term: 'Deathmatch', token: '__CS2TERM_DM__' },
  { term: 'Arms Race', token: '__CS2TERM_ARMSRACE__' },
  { term: 'Wingman', token: '__CS2TERM_WINGMAN__' },
  { term: 'Flashbang', token: '__CS2TERM_FLASH__' },
  { term: 'Molotov', token: '__CS2TERM_MOLOTOV__' },
  { term: 'Smoke', token: '__CS2TERM_SMOKE__' },
  { term: 'Decoy', token: '__CS2TERM_DECOY__' },
  { term: 'Zeus x27', token: '__CS2TERM_ZEUS__' },
  { term: 'Desert Eagle', token: '__CS2TERM_DEAGLE__' },
  { term: 'StatTrak', token: '__CS2TERM_STATTRAK__' },
];

export class CS2NewsRadarService {
  constructor() {
    this.lastKnownGid = null;
    this.translationCache = new Map();
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
      this.lastKnownGid = String(gid);
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({ lastGid: String(gid), updatedAt: new Date().toISOString() }, null, 2),
        'utf-8'
      );
    } catch (e) {}
  }

  cleanBbcode(text) {
    if (!text) return '';
    return text
      .replace(/\[\/?(p|b|i|u|h1|h2|h3|url|img|list|\*|quote|code|previewyoutube)(\=[^\]]*)?\]/gi, '')
      .replace(/\\\[\s*/g, '[')
      .replace(/\s*\\\]/g, ']')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#8211;|&#8212;/g, '-')
      .trim();
  }

  protectCs2Terms(text) {
    let out = text;
    for (const item of CS2_PROTECTED_TERMS) {
      const regex = new RegExp(`\\b${item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      out = out.replace(regex, item.token);
    }
    return out;
  }

  restoreCs2Terms(text) {
    let out = text;
    for (const item of CS2_PROTECTED_TERMS) {
      const regex = new RegExp(item.token, 'gi');
      out = out.replace(regex, item.term);
    }
    return out;
  }

  offlineTranslateFallback(text) {
    return text
      .replace(/\bRelease Notes for\b/gi, 'Notas de Atualizacao de')
      .replace(/\bCounter-Strike 2 Update\b/gi, 'Atualizacao do Counter-Strike 2')
      .replace(/\bFixed a bug where\b/gi, 'Corrigido um bug onde')
      .replace(/\bFixed a case where\b/gi, 'Corrigido um problema em que')
      .replace(/\bFixed an issue where\b/gi, 'Corrigido um erro em que')
      .replace(/\bFixed various\b/gi, 'Corrigidos diversos')
      .replace(/\bFixed\b/g, 'Corrigido:')
      .replace(/\bAdded\b/g, 'Adicionado:')
      .replace(/\bUpdated\b/g, 'Atualizado:')
      .replace(/\bImproved\b/g, 'Melhorado:')
      .replace(/\bAdjusted\b/g, 'Ajustado:')
      .replace(/\bReduced\b/g, 'Reduzido:')
      .replace(/\bIncreased\b/g, 'Aumentado:')
      .replace(/\bRemoved\b/g, 'Removido:')
      .replace(/\bEnabled\b/g, 'Ativado:')
      .replace(/\bDisabled\b/g, 'Desativado:')
      .replace(/\bUpdated localization files\b/gi, 'Arquivos de traducao e localizacao atualizados');
  }

  async translateTextToPtBr(rawText) {
    if (!rawText || !rawText.trim()) return '';
    try {
      const protectedText = this.protectCs2Terms(rawText);
      const url =
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt-BR&dt=t&q=' +
        encodeURIComponent(protectedText);

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) {
        return this.restoreCs2Terms(this.offlineTranslateFallback(protectedText));
      }

      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((part) => (Array.isArray(part) ? part[0] : '')).join('');
        return this.restoreCs2Terms(translated);
      }
      return this.restoreCs2Terms(this.offlineTranslateFallback(protectedText));
    } catch (e) {
      return this.offlineTranslateFallback(rawText);
    }
  }

  async formatAndTranslatePatch(gid, rawTitle, rawContents) {
    if (gid && this.translationCache.has(String(gid))) {
      return this.translationCache.get(String(gid));
    }

    const headerTranslations = {
      'GAMEPLAY': '\ud83c\udfaf [JOGABILIDADE]',
      'MAPS': '\ud83d\uddfa\ufe0f [MAPAS]',
      'MISC': '\u2699\ufe0f [GERAL & CORRE\u00c7\u00d5ES]',
      'MISCELLANEOUS': '\u2699\ufe0f [GERAL & CORRE\u00c7\u00d5ES]',
      'GRAPHICS': '\ud83c\udfa8 [GR\u00c1FICOS & VISUAL]',
      'AUDIO': '\ud83c\udfa7 [\u00c1UDIO & SONS]',
      'SOUND': '\ud83c\udfa7 [\u00c1UDIO & SONS]',
      'ANIMATION': '\ud83c\udfc3 [ANIMA\u00c7\u00c3O]',
      'MAP SCRIPTING': '\ud83d\udee0\ufe0f [SCRIPTS DE MAPAS]',
      'WORKSHOP': '\ud83d\udce6 [OFICINA STEAM]',
      'UI': '\ud83d\udda5\ufe0f [INTERFACE / HUD]',
      'NETWORKING': '\ud83d\udce1 [REDE & SUB-TICK]',
      'ARMORY': '\ud83d\udee1\ufe0f [ARSENAL / ARMORY]',
      'PREMIER': '\ud83c\udfc6 [MODO PREMIER]',
    };

    let structured = (rawContents || '')
      .replace(/\[p\]\\?\[\s*([A-Z0-9\s_&-]+?)\s*\\?\]\[\/p\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/\\?\[\s*(GAMEPLAY|MAPS|MISC|MISCELLANEOUS|GRAPHICS|AUDIO|SOUND|ANIMATION|UI|NETWORKING|WORKSHOP|ARMORY|PREMIER)\s*\\?\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/\[\*\]\[p\](.*?)\[\/p\]\[\/\*\]/gis, '\n\u2022 $1\n')
      .replace(/\[\*\](.*?)(?=\[\*\]|\[\/list\]|$)/gis, '\n\u2022 $1\n')
      .replace(/\[h[123]\](.*?)\[\/h[123]\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/\[\/?list\]/gi, '\n')
      .replace(/\[\/?p\]/gi, '\n');

    structured = this.cleanBbcode(structured);

    const lines = structured
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const processedLines = [];
    const linesToTranslate = [];
    const lineIndicesToTranslate = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^\[\[HEADER:(.+?)\]\]$/i);
      if (headerMatch) {
        const rawH = headerMatch[1].trim().toUpperCase();
        const mapped = headerTranslations[rawH];
        if (mapped) {
          processedLines.push(`\n__**${mapped}**__`);
        } else {
          processedLines.push(`\n__**\ud83d\udccc [${rawH}]**__`);
        }
      } else {
        const cleanBullet = line.replace(/^[-\u2022]\s*/, '').trim();
        processedLines.push(`\u2022 ${cleanBullet}`);
        linesToTranslate.push(cleanBullet);
        lineIndicesToTranslate.push(processedLines.length - 1);
      }
    }

    if (linesToTranslate.length > 0) {
      const joinedToTranslate = linesToTranslate.slice(0, 35).join('\n');
      const translatedJoined = await this.translateTextToPtBr(joinedToTranslate);
      const translatedSplits = translatedJoined.split(/\r?\n/);

      for (let idx = 0; idx < Math.min(lineIndicesToTranslate.length, translatedSplits.length); idx++) {
        const targetPos = lineIndicesToTranslate[idx];
        const trLine = (translatedSplits[idx] || '').replace(/^[-\u2022]\s*/, '').trim();
        if (trLine) {
          processedLines[targetPos] = `\u2022 ${trLine}`;
        }
      }
    }

    let finalBody = processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (finalBody.length > 3400) {
      finalBody = finalBody.slice(0, 3320) + '\n\n*(...leia a nota completa no link oficial da Valve abaixo)*';
    }

    let translatedTitle = rawTitle || 'Atualizacao Oficial do Counter-Strike 2';
    if (/release notes for/i.test(translatedTitle)) {
      const datePart = translatedTitle.replace(/release notes for/i, '').trim();
      translatedTitle = `Notas de Atualizacao do CS2 (${datePart})`;
    } else if (/counter-strike 2 update/i.test(translatedTitle)) {
      translatedTitle = 'Atualizacao Oficial do Counter-Strike 2';
    } else {
      translatedTitle = await this.translateTextToPtBr(translatedTitle);
    }

    const result = {
      translatedTitle: translatedTitle.trim(),
      formattedNotes: finalBody || 'Notas de atualizacao disponibilizadas pela Valve no Steam.',
    };

    if (gid) {
      this.translationCache.set(String(gid), result);
    }
    return result;
  }

  async fetchLatestPatch() {
    try {
      const url = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=15&feeds=steam_community_announcements&format=json';
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CS2-Mix-Hub-Bot' },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        throw new Error(`Steam API HTTP ${res.status}`);
      }

      const json = await res.json();
      const newsitems = json.appnews?.newsitems || [];

      const officialUpdate =
        newsitems.find((item) => /release notes|counter-strike 2 update|patch/i.test(item.title)) ||
        newsitems.find((item) => item.feedname === 'steam_community_announcements') ||
        newsitems[0];

      if (!officialUpdate) {
        return null;
      }

      let rawContents = officialUpdate.contents || '';
      let rawTitle = officialUpdate.title || 'Counter-Strike 2 Update';

      try {
        const ptUrl = 'https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/?appid=730&count_before=0&count_after=5&lang=brazilian';
        const ptRes = await fetch(ptUrl, {
          headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
          signal: AbortSignal.timeout(3500),
        });
        if (ptRes.ok) {
          const ptJson = await ptRes.json();
          const events = ptJson?.events || [];
          const matchedEvent = events.find(
            (ev) => String(ev.announcement_body?.gid) === String(officialUpdate.gid) || String(ev.gid) === String(officialUpdate.gid)
          );
          if (matchedEvent && matchedEvent.announcement_body?.body) {
            rawContents = matchedEvent.announcement_body.body;
            if (matchedEvent.announcement_body.headline) {
              rawTitle = matchedEvent.announcement_body.headline;
            }
          }
        }
      } catch (_) {}

      const dateObj = new Date(officialUpdate.date * 1000);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const { translatedTitle, formattedNotes } = await this.formatAndTranslatePatch(
        officialUpdate.gid,
        rawTitle,
        rawContents
      );

      const isFirstBoot = this.lastKnownGid === null;
      const isRecent24h = (Date.now() - officialUpdate.date * 1000) < 24 * 3600 * 1000;
      const isNew = isFirstBoot ? isRecent24h : String(this.lastKnownGid) !== String(officialUpdate.gid);

      return {
        gid: String(officialUpdate.gid),
        title: translatedTitle,
        originalTitle: officialUpdate.title,
        url: officialUpdate.url || 'https://www.counter-strike.net/news/updates',
        author: officialUpdate.author || 'Valve CS2 Team',
        date: officialUpdate.date,
        formattedDate,
        rawContents,
        formattedNotes,
        isNew,
        isFirstBoot,
      };
    } catch (err) {
      console.warn('[CS2 NEWS] Erro ao consultar notas de atualizacao da Valve:', err.message);
      return null;
    }
  }

  buildEmbed(patchData) {
    const embed = new EmbedBuilder()
      .setTitle(`\ud83d\udce2 ATUALIZA\u00c7\u00c3O OFICIAL CS2 \u2014 ${patchData.title.toUpperCase()}`)
      .setURL(patchData.url)
      .setColor(0xea580c)
      .setThumbnail('https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg')
      .setDescription(
        `**\ud83d\udcc5 Lan\u00e7amento:** \`${patchData.formattedDate} (Hor\u00e1rio de Bras\u00edlia)\`\n` +
        `**\ud83c\udfae Fonte Oficial:** \`Valve Corporation \u2022 Traduzido para PT-BR\`\n` +
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
        patchData.formattedNotes
      )
      .setFooter({
        text: 'Radar Oficial Valve CS2 \u2022 Tradu\u00e7\u00e3o Autom\u00e1tica PT-BR',
        iconURL: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/icons/valve_logo.png',
      })
      .setTimestamp(new Date(patchData.date * 1000));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Ver Nota Oficial no Steam')
        .setStyle(ButtonStyle.Link)
        .setURL(patchData.url)
        .setEmoji('\ud83d\udd17'),
      new ButtonBuilder()
        .setLabel('Site Oficial Counter-Strike 2')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.counter-strike.net/news/updates')
        .setEmoji('\ud83c\udf10')
    );

    return { embeds: [embed], components: [row] };
  }
}

export const cs2NewsRadar = new CS2NewsRadarService();