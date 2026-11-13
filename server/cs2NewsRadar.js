import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'data', 'cs2NewsState.json');

const CS2_PROTECTED_TERMS = [
  'Dust II',
  'Dust 2',
  'Mirage',
  'Inferno',
  'Nuke',
  'Ancient',
  'Anubis',
  'Vertigo',
  'Overpass',
  'Train',
  'Cache',
  'Baggage',
  'Shoots',
  'Italy',
  'Office',
  'Pool Day',
  'Thera',
  'Mills',
  'Basalt',
  'Edin',
  'Sub-tick',
  'sub-tick',
  'Jumpthrow',
  'jumpthrow',
  'Premier',
  'Retake',
  'Retakes',
  'Deathmatch',
  'Arms Race',
  'Wingman',
  'Flashbang',
  'Molotov',
  'Smoke',
  'Decoy',
  'Zeus x27',
  'Desert Eagle',
  'StatTrak',
  'Counter-Strike 2',
  'Steam Workshop',
  'Workshop',
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

  isAlreadyPortuguese(text) {
    if (!text) return false;
    const sample = text.toLowerCase();
    const ptMarkers = [
      'corrigido',
      'corrigida',
      'corrigidos',
      'adicionado',
      'adicionada',
      'adicionados',
      'atualizado',
      'atualizada',
      'atualizados',
      'ajustado',
      'ajustada',
      'melhorado',
      'melhorada',
      'reduzido',
      'aumentado',
      'removido',
      'jogadores',
      'partida',
      'partidas',
      'armas',
      'mapa',
      'arquivos de',
      'notas de',
    ];
    let hits = 0;
    for (const w of ptMarkers) {
      if (sample.includes(w)) hits++;
    }
    return hits >= 2;
  }

  protectCs2Terms(text) {
    let out = text;
    CS2_PROTECTED_TERMS.forEach((term, idx) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      out = out.replace(regex, `[T${idx}]`);
    });
    return out;
  }

  restoreCs2Terms(text) {
    let out = text;
    CS2_PROTECTED_TERMS.forEach((term, idx) => {
      const regex = new RegExp(`\\[\\s*T${idx}\\s*\\]`, 'gi');
      out = out.replace(regex, term);
    });
    return out;
  }

  offlineTranslateFallback(text) {
    return text
      .replace(/\bRelease Notes for\b/gi, 'Notas de Atualiza\u00e7\u00e3o de')
      .replace(/\bCounter-Strike 2 Update\b/gi, 'Atualiza\u00e7\u00e3o do Counter-Strike 2')
      .replace(/\bFixed a bug where\b/gi, 'Corrigido um bug em que')
      .replace(/\bFixed a case where\b/gi, 'Corrigido um caso em que')
      .replace(/\bFixed an issue where\b/gi, 'Corrigido um problema em que')
      .replace(/\bFixed an issue with\b/gi, 'Corrigido um problema com')
      .replace(/\bFixed various\b/gi, 'Corrigidos diversos')
      .replace(/\bFixed\b/gi, 'Corrigido')
      .replace(/\bAdded\b/gi, 'Adicionado')
      .replace(/\bUpdated localization files\b/gi, 'Arquivos de localiza\u00e7\u00e3o (tradu\u00e7\u00e3o) atualizados')
      .replace(/\bUpdated\b/gi, 'Atualizado')
      .replace(/\bImproved\b/gi, 'Melhorado')
      .replace(/\bAdjusted\b/gi, 'Ajustado')
      .replace(/\bReduced\b/gi, 'Reduzido')
      .replace(/\bIncreased\b/gi, 'Aumentado')
      .replace(/\bRemoved\b/gi, 'Removido')
      .replace(/\bEnabled\b/gi, 'Ativado')
      .replace(/\bDisabled\b/gi, 'Desativado')
      .replace(/\bAllowed\b/gi, 'Permitido')
      .replace(/\bPrevented\b/gi, 'Impedido')
      .replace(/\bRestored\b/gi, 'Restaurado')
      .replace(/\bReplaced\b/gi, 'Substitu\u00eddo')
      .replace(/\bplayers\b/gi, 'jogadores')
      .replace(/\bplayer\b/gi, 'jogador')
      .replace(/\bweapons\b/gi, 'armas')
      .replace(/\bweapon\b/gi, 'arma')
      .replace(/\bserver\b/gi, 'servidor')
      .replace(/\bservers\b/gi, 'servidores')
      .replace(/\bround\b/gi, 'round')
      .replace(/\bmatch\b/gi, 'partida')
      .replace(/\bmatches\b/gi, 'partidas');
  }

  async translateSingleChunkPtBr(chunkText) {
    if (!chunkText || !chunkText.trim()) return '';
    const protectedText = this.protectCs2Terms(chunkText);

    // Tentativa 1: Google Translate via POST (sem limite de tamanho de URL)
    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('client', 'gtx');
      bodyParams.append('sl', 'en');
      bodyParams.append('tl', 'pt-BR');
      bodyParams.append('dt', 't');
      bodyParams.append('q', protectedText);

      const res = await fetch('https://translate.googleapis.com/translate_a/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(5500),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((part) => (Array.isArray(part) ? part[0] : '')).join('');
          const restored = this.restoreCs2Terms(translated).trim();
          if (restored && restored.toLowerCase() !== chunkText.trim().toLowerCase()) {
            return restored;
          }
        }
      }
    } catch (_) {}

    // Tentativa 2: MyMemory Translation API (Backup gratuito e confiavel)
    try {
      const mmUrl =
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(protectedText.slice(0, 480)) +
        '&langpair=en|pt-BR';
      const mmRes = await fetch(mmUrl, {
        headers: { 'User-Agent': 'CS2-Mix-Hub-Bot' },
        signal: AbortSignal.timeout(5000),
      });
      if (mmRes.ok) {
        const mmData = await mmRes.json();
        const translatedText = mmData?.responseData?.translatedText;
        if (translatedText && !/MYMEMORY WARNING/i.test(translatedText)) {
          const restored = this.restoreCs2Terms(translatedText).trim();
          if (restored && restored.toLowerCase() !== chunkText.trim().toLowerCase()) {
            return restored;
          }
        }
      }
    } catch (_) {}

    // Tentativa 3: Dicionario offline de termos CS2
    return this.restoreCs2Terms(this.offlineTranslateFallback(protectedText));
  }

  async translateLinesToPtBr(linesArray) {
    if (!Array.isArray(linesArray) || linesArray.length === 0) return [];
    const results = new Array(linesArray.length);

    // Agrupa em lotes pequenos de ate 420 caracteres para garantir traducao linha a linha sem falha
    const batches = [];
    let currentBatch = [];
    let currentLen = 0;

    for (let i = 0; i < linesArray.length; i++) {
      const line = linesArray[i];
      if (currentBatch.length > 0 && currentLen + line.length > 420) {
        batches.push(currentBatch);
        currentBatch = [];
        currentLen = 0;
      }
      currentBatch.push({ index: i, text: line });
      currentLen += line.length + 2;
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    for (const batch of batches) {
      const joined = batch.map((item) => item.text).join('\n');
      const translatedBlock = await this.translateSingleChunkPtBr(joined);
      const splitLines = translatedBlock.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

      if (splitLines.length === batch.length) {
        for (let j = 0; j < batch.length; j++) {
          results[batch[j].index] = splitLines[j];
        }
      } else {
        for (const item of batch) {
          results[item.index] = await this.translateSingleChunkPtBr(item.text);
        }
      }
    }

    return results;
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
        const cleanBullet = line.replace(/^[-\u2022*]\s*/, '').trim();
        if (!cleanBullet) continue;
        processedLines.push(`\u2022 ${cleanBullet}`);
        linesToTranslate.push(cleanBullet);
        lineIndicesToTranslate.push(processedLines.length - 1);
      }
    }

    const alreadyPt = this.isAlreadyPortuguese(linesToTranslate.join(' '));

    if (!alreadyPt && linesToTranslate.length > 0) {
      const targetSlice = linesToTranslate.slice(0, 35);
      const translatedSplits = await this.translateLinesToPtBr(targetSlice);

      for (let idx = 0; idx < Math.min(lineIndicesToTranslate.length, translatedSplits.length); idx++) {
        const targetPos = lineIndicesToTranslate[idx];
        const trLine = (translatedSplits[idx] || '').replace(/^[-\u2022*]\s*/, '').trim();
        if (trLine) {
          processedLines[targetPos] = `\u2022 ${trLine}`;
        }
      }
    }

    let finalBody = processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (finalBody.length > 3400) {
      finalBody = finalBody.slice(0, 3320) + '\n\n*(...leia a nota completa no link oficial da Valve abaixo)*';
    }

    let translatedTitle = rawTitle || 'Atualiza\u00e7\u00e3o Oficial do Counter-Strike 2';
    if (/release notes for/i.test(translatedTitle)) {
      const datePart = translatedTitle.replace(/release notes for/i, '').trim();
      const ptDate = await this.translateSingleChunkPtBr(datePart);
      translatedTitle = `Notas de Atualiza\u00e7\u00e3o do CS2 (${ptDate || datePart})`;
    } else if (/counter-strike 2 update/i.test(translatedTitle)) {
      translatedTitle = 'Atualiza\u00e7\u00e3o Oficial do Counter-Strike 2';
    } else if (!this.isAlreadyPortuguese(translatedTitle)) {
      translatedTitle = await this.translateSingleChunkPtBr(translatedTitle);
    }

    const result = {
      translatedTitle: translatedTitle.trim(),
      formattedNotes: finalBody || 'Notas de atualiza\u00e7\u00e3o disponibilizadas pela Valve no Steam.',
    };

    if (gid && this.isAlreadyPortuguese(result.formattedNotes)) {
      this.translationCache.set(String(gid), result);
    }
    return result;
  }

  async fetchLatestPatch() {
    try {
      // 1. Consulta a API Oficial da Valve / Steam para o AppID 730 (Counter-Strike 2) com parametro l=brazilian
      const url = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=15&feeds=steam_community_announcements&l=brazilian&format=json';
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CS2-Mix-Hub-Bot', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        throw new Error(`Steam API HTTP ${res.status}`);
      }

      const json = await res.json();
      const newsitems = json.appnews?.newsitems || [];

      const officialUpdate =
        newsitems.find((item) => /release notes|notas de atualiza|counter-strike 2 update|atualiza/i.test(item.title)) ||
        newsitems.find((item) => item.feedname === 'steam_community_announcements') ||
        newsitems[0];

      if (!officialUpdate) {
        return null;
      }

      let rawContents = officialUpdate.contents || '';
      let rawTitle = officialUpdate.title || 'Counter-Strike 2 Update';

      // 2. Busca tambem no endpoint oficial Partner Events do Steam com l=brazilian (parametro nativo da Valve)
      try {
        const ptUrl = 'https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/?appid=730&count_before=0&count_after=6&l=brazilian';
        const ptRes = await fetch(ptUrl, {
          headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000),
        });
        if (ptRes.ok) {
          const ptJson = await ptRes.json();
          const events = ptJson?.events || [];
          const matchedEvent = events.find(
            (ev) =>
              String(ev.announcement_body?.gid) === String(officialUpdate.gid) ||
              String(ev.gid) === String(officialUpdate.gid) ||
              (ev.announcement_body?.posttime && Math.abs(Number(ev.announcement_body.posttime) - Number(officialUpdate.date)) < 1800)
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
        `**\ud83c\udfae Fonte Oficial:** \`Valve Corporation \u2022 Portugu\u00eas (PT-BR)\`\n` +
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
        patchData.formattedNotes
      )
      .setFooter({
        text: 'Radar Oficial Valve CS2 \u2022 Tradu\u00e7\u00e3o PT-BR',
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