import fs from 'fs';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { resolveSeededDataFile } from './dataDir.js';
import { writeJsonAtomic } from './utils/atomicJson.js';
import { setBounded } from './utils/boundedMap.js';
import { logger } from './utils/logger.js';

const STATE_FILE = resolveSeededDataFile('cs2NewsState.json');
const CACHE_SCHEMA_VERSION = 3;

const STEAM_PAGEABLE_EVENTS_URL =
  'https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=730&offset=0&count=12&l=brazilian&origin=https://store.steampowered.com';

const STEAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  Cookie: 'Steam_Language=brazilian;',
};

// Ordered longest-first so multi-word and hyphenated game terms match before shorter fragments.
const CS2_PROTECTED_TERMS = [
  'Counter-Strike 2',
  'Steam Workshop',
  'Dual Berettas',
  'Desert Eagle',
  'HE Grenade',
  'R8 Revolver',
  'CZ75-Auto',
  'Five-SeveN',
  'Sawed-Off',
  'Galil AR',
  'Bombsite A',
  'Bombsite B',
  'Buy Menu',
  'Arms Race',
  'Deathmatch',
  'Pool Day',
  'VAC Live',
  'Zeus x27',
  'Glock-18',
  'PP-Bizon',
  'SCAR-20',
  'Cobblestone',
  'Flashbang',
  'Incendiary',
  'Jumpthrow',
  'Crosshair',
  'Killfeed',
  'Overtime',
  'Sub-tick',
  'StatTrak',
  'Dust II',
  'Overpass',
  'Anubis',
  'Ancient',
  'Inferno',
  'Mirage',
  'Vertigo',
  'Baggage',
  'Workshop',
  'Bombsite',
  'Tickrate',
  'Premier',
  'Retakes',
  'Wingman',
  'Molotov',
  'Loadout',
  'Hitboxes',
  'Hitbox',
  'XM1014',
  'MP5-SD',
  'SG 553',
  'SSG 08',
  'UMP-45',
  'M4A1-S',
  'AK-47',
  'G3SG1',
  'MAG-7',
  'M4A4',
  'M249',
  'P2000',
  'P250',
  'Tec-9',
  'USP-S',
  'MAC-10',
  'FAMAS',
  'Negev',
  'Skybox',
  'Noclip',
  'Armory',
  'Shoots',
  'Basalt',
  'Palais',
  'Whistle',
  'Agency',
  'Brewery',
  'Dogtown',
  'Train',
  'Cache',
  'Italy',
  'Office',
  'Thera',
  'Mills',
  'Nuke',
  'Edin',
  'Jura',
  'Grail',
  'Smoke',
  'Decoy',
  'Spawn',
  'Radar',
  'Recoil',
  'Clutch',
  'Kevlar',
  'Charms',
  'Charm',
  'Sticker',
  'Stickers',
  'CSTV',
  'GOTV',
  'CS2',
  'AWP',
  'AUG',
  'MP9',
  'MP7',
  'P90',
  'HUD',
  'FPS',
  'VAC',
  'C4',
];

const UNIQUE_PROTECTED_TERMS = [...new Set(CS2_PROTECTED_TERMS)].sort((a, b) => b.length - a.length);

const HEADER_TRANSLATIONS = {
  GAMEPLAY: '🎯 [JOGABILIDADE]',
  JOGABILIDADE: '🎯 [JOGABILIDADE]',
  MAPS: '🗺️ [MAPAS]',
  MAPAS: '🗺️ [MAPAS]',
  MISC: '⚙️ [DIVERSOS & CORREÇÕES]',
  MISCELLANEOUS: '⚙️ [DIVERSOS & CORREÇÕES]',
  DIVERSOS: '⚙️ [DIVERSOS & CORREÇÕES]',
  GRAPHICS: '🎨 [GRÁFICOS & VISUAL]',
  GRÁFICOS: '🎨 [GRÁFICOS & VISUAL]',
  GRAFICOS: '🎨 [GRÁFICOS & VISUAL]',
  AUDIO: '🎧 [ÁUDIO & SONS]',
  ÁUDIO: '🎧 [ÁUDIO & SONS]',
  SOM: '🎧 [ÁUDIO & SONS]',
  SOUND: '🎧 [ÁUDIO & SONS]',
  MÚSICA: '🎵 [MÚSICA]',
  MUSICA: '🎵 [MÚSICA]',
  ANIMATION: '🏃 [ANIMAÇÃO]',
  ANIMAÇÃO: '🏃 [ANIMAÇÃO]',
  ANIMACAO: '🏃 [ANIMAÇÃO]',
  'MAP SCRIPTING': '🛠️ [SCRIPTS DE MAPAS]',
  'SCRIPTS DE MAPA': '🛠️ [SCRIPTS DE MAPAS]',
  'SCRIPTS DE MAPAS': '🛠️ [SCRIPTS DE MAPAS]',
  WORKSHOP: '📦 [OFICINA STEAM / WORKSHOP]',
  UI: '🖥️ [INTERFACE / HUD]',
  INTERFACE: '🖥️ [INTERFACE / HUD]',
  NETWORKING: '📡 [REDE & SUB-TICK]',
  NETWORK: '📡 [REDE & SUB-TICK]',
  ARMORY: '🛡️ [ARSENAL / ARMORY]',
  ARSENAL: '🛡️ [ARSENAL / ARMORY]',
  PREMIER: '🏆 [MODO PREMIER]',
  INPUT: '⌨️ [CONTROLES & INPUT]',
  SERVER: '🖥️ [SERVIDORES]',
  SERVERS: '🖥️ [SERVIDORES]',
  SERVIDORES: '🖥️ [SERVIDORES]',
  LINUX: '🐧 [LINUX]',
  MACOS: '🍎 [MACOS]',
  STEAM: '🎮 [STEAM]',
};

const HEADER_PATTERN_LIST = Object.keys(HEADER_TRANSLATIONS)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class CS2NewsRadarService {
  constructor() {
    this.lastKnownGid = null;
    this.translationCache = new Map();
    this.updatesHistory = [];
    this.lastCheckedAt = null;
    this._geminiApiKeyProvider = null;
    this._recentFetchPromise = null;
    this.loadState();
  }

  setGeminiApiKeyProvider(providerFn) {
    this._geminiApiKeyProvider = typeof providerFn === 'function' ? providerFn : null;
  }

  getGeminiApiKey() {
    try {
      const provided = this._geminiApiKeyProvider ? String(this._geminiApiKeyProvider() || '').trim() : '';
      if (provided) return provided;
    } catch (_) {}
    return String(process.env.GEMINI_API_KEY || '').trim();
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        this.lastKnownGid = data.lastGid || null;
        this.lastCheckedAt = data.lastCheckedAt || data.updatedAt || null;
        if (data.cacheVersion === CACHE_SCHEMA_VERSION && Array.isArray(data.updates)) {
          this.updatesHistory = data.updates.filter((u) => u && u.gid);
          for (const item of this.updatesHistory) {
            if (
              item.gid &&
              item.translationSource !== 'offline-fallback' &&
              (item.translationSource === 'valve-ptbr' ||
                item.translationSource === 'gemini' ||
                this.isAlreadyPortuguese(item.formattedNotes || ''))
            ) {
              this.translationCache.set(String(item.gid), {
                translatedTitle: item.title,
                formattedNotes: item.formattedNotes,
                sections: Array.isArray(item.sections) ? item.sections : [],
                translationSource: item.translationSource || 'cached-ptbr',
              });
            }
          }
        }
      }
    } catch (_) {
      this.lastKnownGid = null;
      this.updatesHistory = [];
    }
  }

  persistStateFile(nextLastGid = this.lastKnownGid) {
    try {
      const payload = {
        cacheVersion: CACHE_SCHEMA_VERSION,
        lastGid: nextLastGid ? String(nextLastGid) : null,
        updatedAt: new Date().toISOString(),
        lastCheckedAt: this.lastCheckedAt || new Date().toISOString(),
        updates: this.updatesHistory.slice(0, 12),
      };
      writeJsonAtomic(STATE_FILE, payload);
    } catch (err) {
      logger.warn('CS2_NEWS', 'Falha ao persistir cs2NewsState.json', err);
    }
  }

  saveState(gid) {
    if (!gid) return;
    this.lastKnownGid = String(gid);
    this.persistStateFile(this.lastKnownGid);
  }

  upsertHistoryItem(patchObj) {
    if (!patchObj || !patchObj.gid) return;
    const gid = String(patchObj.gid);
    const filtered = this.updatesHistory.filter((u) => String(u.gid) !== gid);
    filtered.unshift({
      gid,
      title: patchObj.title,
      originalTitle: patchObj.originalTitle,
      url: patchObj.url,
      author: patchObj.author,
      date: patchObj.date,
      formattedDate: patchObj.formattedDate,
      bannerImage: patchObj.bannerImage || '',
      eventType: patchObj.eventType || null,
      rawContents: patchObj.rawContents,
      formattedNotes: patchObj.formattedNotes,
      sections: Array.isArray(patchObj.sections) ? patchObj.sections : [],
      translationSource: patchObj.translationSource || 'translate',
    });
    filtered.sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
    this.updatesHistory = filtered.slice(0, 12);
    this.lastCheckedAt = new Date().toISOString();
    this.persistStateFile(this.lastKnownGid);
  }

  extractBannerImage(rawContents = '') {
    const raw = String(rawContents || '');
    const posterMatch = raw.match(/\bposter="([^"]+)"/i);
    if (posterMatch?.[1]) return posterMatch[1];

    const imgTagMatch = raw.match(/\[img\]([\s\S]*?)\[\/img\]/i);
    if (imgTagMatch?.[1]) {
      return imgTagMatch[1]
        .trim()
        .replace(/\{STEAM_CLAN_IMAGE\}/gi, 'https://clan.fastly.steamstatic.com/images');
    }
    return '';
  }

  cleanBbcode(text) {
    if (!text) return '';
    return String(text)
      .replace(/\[video\b[^\]]*\][\s\S]*?\[\/video\]/gi, '\n')
      .replace(/\[previewyoutube\b[^\]]*\][\s\S]*?\[\/previewyoutube\]/gi, '\n')
      .replace(/\[img\b[^\]]*\][\s\S]*?\[\/img\]/gi, '\n')
      .replace(/\{STEAM_CLAN_IMAGE\}[^\s\]"']*/gi, '')
      .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gi, '$2')
      .replace(/\[\/?(p|b|i|u|h1|h2|h3|h4|url|img|list|\*|quote|code|previewyoutube|video|strike|spoiler)(\=[^\]]*)?\]/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|li|ul|ol|h1|h2|h3|h4|strong|b|em|i|code|pre|span)[^>]*>/gi, '\n')
      .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\\\[\s*/g, '[')
      .replace(/\s*\\\]/g, ']')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '-')
      .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  isAlreadyPortuguese(text) {
    if (!text) return false;
    const sample = String(text).toLowerCase();

    const enMarkers = [
      /\bfixed\b/g,
      /\badded\b/g,
      /\bupdated\b/g,
      /\badjusted\b/g,
      /\bimproved\b/g,
      /\breduced\b/g,
      /\bincreased\b/g,
      /\bremoved\b/g,
      /\breleased\b/g,
      /\bplayers?\b/g,
      /\bweapons?\b/g,
      /\bwhere\b/g,
      /\bwhen\b/g,
      /\bwhich\b/g,
      /\bwhile\b/g,
      /\bduring\b/g,
      /\bissue\b/g,
      /\bincorrectly\b/g,
      /\bmissing\b/g,
      /\bvarious\b/g,
      /\bthat\b/g,
      /\bwith\b/g,
      /\bfrom\b/g,
      /\bthe\b/g,
      /\band\b/g,
      /\bfor\b/g,
      /\blocalization\b/g,
      /\brelease notes\b/g,
    ];

    const ptMarkers = [
      /\bcorrigido\b/g,
      /\bcorrigida\b/g,
      /\bcorrigidos\b/g,
      /\bcorrigidas\b/g,
      /\bcorre[çc][ãa]o\b/g,
      /\bcorre[çc][õo]es\b/g,
      /\badicionado\b/g,
      /\badicionada\b/g,
      /\badicionados\b/g,
      /\badi[çc][ãa]o\b/g,
      /\bremo[çc][ãa]o\b/g,
      /\batualizado\b/g,
      /\batualizada\b/g,
      /\batualizados\b/g,
      /\batuali[cz]a[çc][ãa]o\b/g,
      /\bajustado\b/g,
      /\bajustada\b/g,
      /\bajuste\b/g,
      /\bmelhorado\b/g,
      /\bmelhorada\b/g,
      /\baprimoramento\b/g,
      /\baprimoramentos\b/g,
      /\breduzido\b/g,
      /\bredu[çc][ãa]o\b/g,
      /\baumentado\b/g,
      /\bremovido\b/g,
      /\balterado\b/g,
      /\bjogadores?\b/g,
      /\bpartidas?\b/g,
      /\brodada\b/g,
      /\brodadas\b/g,
      /\barmas?\b/g,
      /\bmapas?\b/g,
      /\bservidores?\b/g,
      /\bproblema\b/g,
      /\barquivos?\b/g,
      /\bnotas de\b/g,
      /\bdetalhes da\b/g,
      /\bdispon[íi]vel\b/g,
      /\bpara\b/g,
      /\bcom\b/g,
      /\bquando\b/g,
      /\bonde\b/g,
      /\bn[ãa]o\b/g,
      /\bagora\b/g,
      /\bdurante\b/g,
      /\bpelo\b/g,
      /\bpela\b/g,
      /\bdos\b/g,
      /\bdas\b/g,
      /\bvoc[êe]\b/g,
      /\best[áa]\b/g,
      /\bpodem?\b/g,
    ];

    let enHits = 0;
    for (const rx of enMarkers) {
      const matches = sample.match(rx);
      if (matches) enHits += matches.length;
    }

    let ptHits = 0;
    for (const rx of ptMarkers) {
      const matches = sample.match(rx);
      if (matches) ptHits += matches.length;
    }

    if (ptHits === 0) return false;
    if (enHits >= 4 && ptHits < enHits * 2) return false;
    if (enHits >= 2 && ptHits < 4) return false;
    return ptHits >= 2 && ptHits > enHits;
  }

  protectCs2Terms(text) {
    let out = String(text || '');
    const capturedOriginals = new Map();
    UNIQUE_PROTECTED_TERMS.forEach((term, idx) => {
      const escaped = escapeRegExp(term);
      const regex = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'gi');
      out = out.replace(regex, (matched) => {
        if (!capturedOriginals.has(idx)) {
          capturedOriginals.set(idx, matched);
        }
        return `QCS2KEEP${idx}Z`;
      });
    });
    this._lastCapturedTerms = capturedOriginals;
    return out;
  }

  restoreCs2Terms(text, customCaptured = null) {
    let out = String(text || '');
    const captured = customCaptured || this._lastCapturedTerms;
    UNIQUE_PROTECTED_TERMS.forEach((term, idx) => {
      const regex = new RegExp(`\\bQ?CS2KEEP\\s*${idx}\\s*Z\\b|\\[\\s*T${idx}\\s*\\]`, 'gi');
      const replacement = (captured && captured.get(idx)) || term;
      out = out.replace(regex, replacement);
    });
    return out;
  }

  offlineTranslateFallback(text) {
    return String(text || '')
      .replace(/\bRelease Notes for\b/gi, 'Notas de Atualização de')
      .replace(/\bCounter-Strike 2 Update\b/gi, 'Atualização do Counter-Strike 2')
      .replace(/\bFixed a bug where\b/gi, 'Corrigido um bug em que')
      .replace(/\bFixed a case where\b/gi, 'Corrigido um caso em que')
      .replace(/\bFixed an issue where\b/gi, 'Corrigido um problema em que')
      .replace(/\bFixed an issue with\b/gi, 'Corrigido um problema com')
      .replace(/\bFixed an exploit where\b/gi, 'Corrigido um exploit em que')
      .replace(/\bFixed various crashes\b/gi, 'Corrigidos diversos travamentos')
      .replace(/\bFixed various bugs\b/gi, 'Corrigidos diversos bugs')
      .replace(/\bFixed various\b/gi, 'Corrigidos diversos')
      .replace(/\bFixed crash when\b/gi, 'Corrigido travamento quando')
      .replace(/\bFixed\b/gi, 'Corrigido')
      .replace(/\bAdded support for\b/gi, 'Adicionado suporte para')
      .replace(/\bAdded\b/gi, 'Adicionado')
      .replace(/\bUpdated localization files\b/gi, 'Arquivos de localização (tradução) atualizados')
      .replace(/\bUpdated to the latest version from\b/gi, 'Atualizado para a versão mais recente da')
      .replace(/\bUpdated geometry and clipping\b/gi, 'Atualizada a geometria e colisões (clipping)')
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
      .replace(/\bReplaced\b/gi, 'Substituído')
      .replace(/\bChanged\b/gi, 'Alterado')
      .replace(/\bMoved\b/gi, 'Movido')
      .replace(/\bplayers\b/gi, 'jogadores')
      .replace(/\bplayer\b/gi, 'jogador')
      .replace(/\bweapons\b/gi, 'armas')
      .replace(/\bweapon\b/gi, 'arma')
      .replace(/\bservers\b/gi, 'servidores')
      .replace(/\bserver\b/gi, 'servidor')
      .replace(/\brounds\b/gi, 'rounds')
      .replace(/\bround\b/gi, 'round')
      .replace(/\bmatches\b/gi, 'partidas')
      .replace(/\bmatchmaking\b/gi, 'matchmaking')
      .replace(/\bmatch\b/gi, 'partida');
  }

  async translateWithGemini(rawTitle, linesToTranslate, geminiKey) {
    const cleanKey = String(geminiKey || '').trim();
    if (!cleanKey || !Array.isArray(linesToTranslate) || linesToTranslate.length === 0) {
      return null;
    }

    const systemPrompt =
      'Você é o tradutor oficial de Patch Notes de Counter-Strike 2 para Português do Brasil (PT-BR). ' +
      'Traduza o título e cada linha da lista para um português natural e preciso da comunidade gamer brasileira. ' +
      'REGRA OBRIGATÓRIA DE CONSERVAÇÃO: NÃO traduza termos próprios e técnicos do jogo CS2, mantendo-os em inglês/original: ' +
      'nomes de mapas (Mirage, Inferno, Dust II, Nuke, Ancient, Anubis, Overpass, Vertigo, Train, Cache, Cobblestone, Italy, Office, Jura, Grail, Agency, etc.), ' +
      'nomes de armas e utilitários (AK-47, M4A4, M4A1-S, AWP, Desert Eagle, Zeus x27, Glock-18, USP-S, Smoke, Flashbang, Molotov, Incendiary, HE Grenade, Decoy, StatTrak, Armory, Skins, Charms), ' +
      'e termos consagrados no CS2 (Sub-tick, Premier, Wingman, Retakes, Deathmatch, Arms Race, Jumpthrow, Noclip, Hitbox, Bombsite, Spawn, Crosshair, Loadout, Buy Menu, Killfeed, Overtime, HUD, FPS, Ping, Workshop, VAC, CSTV, GOTV, Clipping). ' +
      'Traduza verbos e explicações ("Fixed", "Added", "Updated localization files", "Adjusted", "players", "server", "weapons", etc.). ' +
      'Responda SOMENTE em JSON válido no formato {"title":"...","lines":["..."]} mantendo EXATAMENTE o mesmo número de itens no array lines.';

    const payloadObj = {
      title: rawTitle || 'Counter-Strike 2 Update',
      lines: linesToTranslate,
    };

    try {
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(payloadObj) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) return null;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();
      if (!rawText) return null;

      const cleanedJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanedJson);
      if (!parsed || !Array.isArray(parsed.lines) || parsed.lines.length !== linesToTranslate.length) {
        return null;
      }

      const cleanedLines = parsed.lines.map((line, i) => String(line || linesToTranslate[i] || '').trim());
      if (!this.isAlreadyPortuguese(cleanedLines.join(' '))) {
        return null;
      }

      return {
        title: String(parsed.title || rawTitle || '').trim(),
        lines: cleanedLines,
      };
    } catch (_) {
      return null;
    }
  }

  async translateSingleChunkPtBr(chunkText, { returnMeta = false } = {}) {
    if (!chunkText || !String(chunkText).trim()) {
      return returnMeta ? { text: '', source: 'empty' } : '';
    }
    const rawChunk = String(chunkText);
    const protectedText = this.protectCs2Terms(rawChunk);
    const capturedMap = this._lastCapturedTerms;

    // 1. Google Translate GTX POST
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
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((part) => (Array.isArray(part) ? part[0] : '')).join('');
          const restored = this.restoreCs2Terms(translated, capturedMap).trim();
          if (restored && restored.toLowerCase() !== rawChunk.trim().toLowerCase()) {
            return returnMeta ? { text: restored, source: 'translate-gtx' } : restored;
          }
        }
      }
    } catch (_) {}

    // 2. Google Translate clients5 endpoint
    try {
      const g5Url =
        'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=pt-BR&q=' +
        encodeURIComponent(protectedText.slice(0, 1400));
      const g5Res = await fetch(g5Url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(5500),
      });
      if (g5Res.ok) {
        const g5Data = await g5Res.json();
        let translatedText = '';
        if (Array.isArray(g5Data) && typeof g5Data[0] === 'string') {
          translatedText = g5Data[0];
        } else if (Array.isArray(g5Data?.sentences)) {
          translatedText = g5Data.sentences.map((s) => s?.trans || '').join('');
        }
        const restored = this.restoreCs2Terms(translatedText, capturedMap).trim();
        if (restored && restored.toLowerCase() !== rawChunk.trim().toLowerCase()) {
          return returnMeta ? { text: restored, source: 'translate-g5' } : restored;
        }
      }
    } catch (_) {}

    // 3. Lingva Translate (Open-Source mirror)
    if (protectedText.length <= 900) {
      for (const host of ['https://lingva.ml', 'https://lingva.garudalinux.org']) {
        try {
          const lingvaRes = await fetch(`${host}/api/v1/en/pt/${encodeURIComponent(protectedText)}`, {
            headers: { 'User-Agent': 'CS2-Mix-Hub-Bot' },
            signal: AbortSignal.timeout(5000),
          });
          if (lingvaRes.ok) {
            const lingvaJson = await lingvaRes.json();
            const translatedText = lingvaJson?.translation;
            if (translatedText) {
              const restored = this.restoreCs2Terms(translatedText, capturedMap).trim();
              if (restored && restored.toLowerCase() !== rawChunk.trim().toLowerCase()) {
                return returnMeta ? { text: restored, source: 'lingva' } : restored;
              }
            }
          }
        } catch (_) {}
      }
    }

    // 4. MyMemory Translation API
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
          const restored = this.restoreCs2Terms(translatedText, capturedMap).trim();
          if (restored && restored.toLowerCase() !== rawChunk.trim().toLowerCase()) {
            return returnMeta ? { text: restored, source: 'mymemory' } : restored;
          }
        }
      }
    } catch (_) {}

    // 5. Dicionario offline
    const offline = this.restoreCs2Terms(this.offlineTranslateFallback(protectedText), capturedMap);
    return returnMeta ? { text: offline, source: 'offline-fallback' } : offline;
  }

  async translateLinesToPtBr(linesArray, { returnMeta = false } = {}) {
    if (!Array.isArray(linesArray) || linesArray.length === 0) {
      return returnMeta ? { lines: [], source: 'empty' } : [];
    }
    const results = new Array(linesArray.length);
    let usedNetworkTranslator = false;
    let usedOfflineFallback = false;

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
      const blockRes = await this.translateSingleChunkPtBr(joined, { returnMeta: true });
      if (blockRes.source === 'offline-fallback') {
        usedOfflineFallback = true;
      } else if (blockRes.source !== 'empty') {
        usedNetworkTranslator = true;
      }
      const splitLines = blockRes.text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

      if (splitLines.length === batch.length) {
        for (let j = 0; j < batch.length; j++) {
          results[batch[j].index] = splitLines[j];
        }
      } else {
        for (const item of batch) {
          const singleRes = await this.translateSingleChunkPtBr(item.text, { returnMeta: true });
          if (singleRes.source === 'offline-fallback') {
            usedOfflineFallback = true;
          } else if (singleRes.source !== 'empty') {
            usedNetworkTranslator = true;
          }
          results[item.index] = singleRes.text;
        }
      }
    }

    const source = usedOfflineFallback && !usedNetworkTranslator ? 'offline-fallback' : 'translate';
    return returnMeta ? { lines: results, source } : results;
  }

  buildStructuredLines(rawContents) {
    let structured = String(rawContents || '')
      // Remove media blocks before parsing tags so poster/caption strings don't bleed into body
      .replace(/\[video\b[^\]]*\][\s\S]*?\[\/video\]/gi, '\n')
      .replace(/\[previewyoutube\b[^\]]*\][\s\S]*?\[\/previewyoutube\]/gi, '\n')
      .replace(/\[img\b[^\]]*\][\s\S]*?\[\/img\]/gi, '\n')
      // Valve Partner Events PT-BR & EN headings: [p][b][Jogabilidade][/b][/p], [b][Mapas][/b], [p]\[ MISC \][/p], [h2]...[/h2]
      .replace(/\[p\]\s*\[b\]\s*\\?\[\s*([^\]\n]+?)\s*\\?\]\s*\[\/b\]\s*\[\/p\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/\[b\]\s*\\?\[\s*([^\]\n]+?)\s*\\?\]\s*\[\/b\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/\[p\]\\?\[\s*([A-ZÀ-Ÿ0-9\s_&-]+?)\s*\\?\]\[\/p\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/\[h[123]\](.*?)\[\/h[123]\]/gi, '\n[[HEADER:$1]]\n')
      .replace(/<h[123][^>]*>(.*?)<\/h[123]>/gi, '\n[[HEADER:$1]]\n')
      .replace(/(?:^|\n)###?\s+([^\n]+)/g, '\n[[HEADER:$1]]\n')
      .replace(new RegExp(`\\\\?\\[\\s*(${HEADER_PATTERN_LIST})\\s*\\\\?\\]`, 'gi'), '\n[[HEADER:$1]]\n')
      .replace(/(?:^|\n)\[\s*(?!\/?(?:list|p|b|i|u|url|img|video|quote|code|strike|h[123]|\*)\b)([A-Za-zÀ-ÿ0-9\s_&-]{2,40})\s*\](?=\s*(?:\[list\]|\n|$))/gi, '\n[[HEADER:$1]]\n')
      // Convert Valve BBCode lists cleanly (handles nested [list] safely!)
      .replace(/\[\*\]\[p\](.*?)\[\/p\]/gi, '\n• $1\n')
      .replace(/\[\*\]/gi, '\n• ')
      .replace(/\[\/\*\]/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gis, '\n• $1\n')
      .replace(/\[\/?list\]/gi, '\n')
      .replace(/\[\/?p\]/gi, '\n');

    structured = this.cleanBbcode(structured);

    return structured
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  mapHeaderLabel(rawHeader) {
    const clean = String(rawHeader || '').replace(/^\[+|\]+$/g, '').trim();
    const upper = clean.toUpperCase();
    if (HEADER_TRANSLATIONS[upper]) {
      return HEADER_TRANSLATIONS[upper];
    }
    if (/mundial|major|singapura|championship|blast|pgl|esl/i.test(clean)) {
      return `🏆 [${upper}]`;
    }
    return `📌 [${upper}]`;
  }

  async formatAndTranslatePatch(gid, rawTitle, rawContents, { isSteamOfficialPtBr = false } = {}) {
    if (gid && this.translationCache.has(String(gid))) {
      const cached = this.translationCache.get(String(gid));
      if (!isSteamOfficialPtBr || cached.translationSource === 'valve-ptbr') {
        return cached;
      }
    }

    const lines = this.buildStructuredLines(rawContents);
    const processedLines = [];
    const linesToTranslate = [];
    const lineIndicesToTranslate = [];
    const sectionItems = [];
    let currentSection = { title: '📌 [NOTAS DA ATUALIZAÇÃO]', items: [] };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^\[\[HEADER:(.+?)\]\]$/i);
      if (headerMatch) {
        const label = this.mapHeaderLabel(headerMatch[1]);
        processedLines.push(`\n__**${label}**__`);
        if (currentSection.items.length > 0) {
          sectionItems.push(currentSection);
        }
        currentSection = { title: label, items: [] };
      } else {
        const cleanBullet = line.replace(/^[-\u2022*]\s*/, '').trim();
        if (!cleanBullet) continue;
        processedLines.push(`\u2022 ${cleanBullet}`);
        const itemRef = { sectionIndex: sectionItems.length, itemIndex: currentSection.items.length };
        currentSection.items.push(cleanBullet);
        linesToTranslate.push(cleanBullet);
        lineIndicesToTranslate.push({ processedPos: processedLines.length - 1, itemRef });
      }
    }
    if (currentSection.items.length > 0) {
      sectionItems.push(currentSection);
    }

    const bodyJoined = linesToTranslate.join(' ');
    const alreadyPt = Boolean(isSteamOfficialPtBr || this.isAlreadyPortuguese(bodyJoined));
    let translationSource = alreadyPt ? 'valve-ptbr' : 'offline-fallback';
    let geminiTranslatedTitle = '';

    if (!alreadyPt && linesToTranslate.length > 0) {
      const targetSlice = linesToTranslate.slice(0, 75);
      const geminiKey = this.getGeminiApiKey();

      let translatedSplits = null;
      if (geminiKey) {
        const geminiRes = await this.translateWithGemini(rawTitle, targetSlice, geminiKey);
        if (geminiRes && Array.isArray(geminiRes.lines)) {
          translatedSplits = geminiRes.lines;
          geminiTranslatedTitle = geminiRes.title || '';
          translationSource = 'gemini';
        }
      }

      if (!translatedSplits) {
        const multiRes = await this.translateLinesToPtBr(targetSlice, { returnMeta: true });
        translatedSplits = multiRes.lines;
        translationSource = multiRes.source;
      }

      for (let idx = 0; idx < Math.min(lineIndicesToTranslate.length, translatedSplits.length); idx++) {
        const { processedPos, itemRef } = lineIndicesToTranslate[idx];
        const trLine = (translatedSplits[idx] || '').replace(/^[-\u2022*]\s*/, '').trim();
        if (trLine) {
          processedLines[processedPos] = `\u2022 ${trLine}`;
          if (sectionItems[itemRef.sectionIndex]?.items) {
            sectionItems[itemRef.sectionIndex].items[itemRef.itemIndex] = trLine;
          }
        }
      }
    }

    let finalBody = processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (finalBody.length > 3400) {
      finalBody = finalBody.slice(0, 3320) + '\n\n*(...leia a nota completa no site ou no link oficial do Steam)*';
    }

    let translatedTitle = geminiTranslatedTitle || rawTitle || 'Atualização Oficial do Counter-Strike 2';
    if (!isSteamOfficialPtBr && !geminiTranslatedTitle) {
      if (/release notes for/i.test(translatedTitle)) {
        const datePart = translatedTitle.replace(/release notes for/i, '').trim();
        const ptDate = await this.translateSingleChunkPtBr(datePart);
        translatedTitle = `Notas de Atualização do CS2 (${ptDate || datePart})`;
      } else if (/^counter-strike 2 update$/i.test(translatedTitle.trim())) {
        translatedTitle = 'Atualização Oficial do Counter-Strike 2';
      } else if (!this.isAlreadyPortuguese(translatedTitle)) {
        translatedTitle = await this.translateSingleChunkPtBr(translatedTitle);
      }
    }

    const result = {
      translatedTitle: translatedTitle.trim(),
      formattedNotes: finalBody || 'Notas de atualização disponibilizadas pela Valve no Steam.',
      sections: sectionItems,
      translationSource,
    };

    if (
      gid &&
      translationSource !== 'offline-fallback' &&
      (translationSource === 'valve-ptbr' ||
        translationSource === 'gemini' ||
        this.isAlreadyPortuguese(result.formattedNotes))
    ) {
      setBounded(this.translationCache, String(gid), result, 100);
    }
    return result;
  }

  formatBrasiliaDate(unixSeconds) {
    const dateObj = new Date(Number(unixSeconds || 0) * 1000);
    return dateObj.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async fetchSteamPageableEvents({ count = 12 } = {}) {
    try {
      const url = STEAM_PAGEABLE_EVENTS_URL.replace('count=12', `count=${Math.max(1, Math.min(20, count))}`);
      const res = await fetch(url, {
        headers: STEAM_HEADERS,
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.events) ? json.events : [];
    } catch (_) {
      return [];
    }
  }

  async normalizePartnerEvent(ev) {
    const ab = ev?.announcement_body || {};
    const gid = String(ev?.gid || ab?.gid || '');
    const posttime = Number(ab?.posttime || ev?.rtime32_start_time || 0);
    const rawTitle = ab?.headline || ev?.event_name || 'Atualização do Counter-Strike 2';
    const rawContents = ab?.body || ev?.event_notes || '';
    const langCode = Number(ab?.language);
    // Language 22 = Brazilian Portuguese on Steam Community / Valve Partner Events
    const isSteamOfficialPtBr = langCode === 22;

    const bannerImage = this.extractBannerImage(rawContents);
    const formattedDate = this.formatBrasiliaDate(posttime);

    const { translatedTitle, formattedNotes, sections, translationSource } = await this.formatAndTranslatePatch(
      gid,
      rawTitle,
      rawContents,
      { isSteamOfficialPtBr }
    );

    const isFirstBoot = this.lastKnownGid === null;
    const isRecent24h = Date.now() - posttime * 1000 < 24 * 3600 * 1000;
    const isNew = isFirstBoot ? isRecent24h : String(this.lastKnownGid) !== gid;

    const patchObj = {
      gid,
      title: translatedTitle,
      originalTitle: rawTitle,
      url: gid
        ? `https://store.steampowered.com/news/app/730/view/${gid}?l=brazilian`
        : 'https://store.steampowered.com/news/app/730?l=brazilian',
      author: 'Valve CS2 Team',
      date: posttime,
      formattedDate,
      bannerImage,
      eventType: Number(ev?.event_type || 0) || null,
      rawContents,
      formattedNotes,
      sections,
      translationSource,
      isNew,
      isFirstBoot,
    };

    if (translationSource !== 'offline-fallback') {
      this.upsertHistoryItem(patchObj);
    }

    return patchObj;
  }

  async normalizeSteamNewsItem(officialUpdate) {
    const gid = String(officialUpdate?.gid || '');
    const rawContents = officialUpdate?.contents || '';
    const rawTitle = officialUpdate?.title || 'Counter-Strike 2 Update';
    const formattedDate = this.formatBrasiliaDate(officialUpdate?.date);
    const bannerImage = this.extractBannerImage(rawContents);

    const { translatedTitle, formattedNotes, sections, translationSource } = await this.formatAndTranslatePatch(
      gid,
      rawTitle,
      rawContents,
      { isSteamOfficialPtBr: false }
    );

    const isFirstBoot = this.lastKnownGid === null;
    const isRecent24h = Date.now() - Number(officialUpdate?.date || 0) * 1000 < 24 * 3600 * 1000;
    const isNew = isFirstBoot ? isRecent24h : String(this.lastKnownGid) !== gid;

    const patchObj = {
      gid,
      title: translatedTitle,
      originalTitle: rawTitle,
      url: officialUpdate?.url || 'https://store.steampowered.com/news/app/730?l=brazilian',
      author: officialUpdate?.author || 'Valve CS2 Team',
      date: Number(officialUpdate?.date || 0),
      formattedDate,
      bannerImage,
      eventType: 12,
      rawContents,
      formattedNotes,
      sections,
      translationSource,
      isNew,
      isFirstBoot,
    };

    if (translationSource !== 'offline-fallback') {
      this.upsertHistoryItem(patchObj);
    }

    return patchObj;
  }

  async fetchLatestPatch() {
    try {
      // 1. Primary: Valve official Steam News Hub (store.steampowered.com/news/app/730) with PT-BR lang=22
      const pageableEvents = await this.fetchSteamPageableEvents({ count: 8 });
      if (pageableEvents.length > 0) {
        const officialUpdate =
          pageableEvents.find(
            (ev) =>
              Number(ev.event_type) === 12 ||
              /detalhes da atualiza|release notes|counter-strike 2 update|atualiza/i.test(
                ev.announcement_body?.headline || ''
              )
          ) || pageableEvents[0];
        return await this.normalizePartnerEvent(officialUpdate);
      }

      // 2. Fallback: ISteamNews GetNewsForApp + translation pipeline
      const url =
        'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=15&feeds=steam_community_announcements&l=brazilian&format=json';
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CS2-Mix-Hub-Bot', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(6500),
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
        return this.updatesHistory[0] || null;
      }
      return await this.normalizeSteamNewsItem(officialUpdate);
    } catch (err) {
      console.warn('[CS2 NEWS] Erro ao consultar notas de atualizacao da Valve:', err.message);
      return this.updatesHistory[0] || null;
    }
  }

  async fetchRecentUpdates({ limit = 8, forceRefresh = false } = {}) {
    const safeLimit = Math.max(1, Math.min(12, Number(limit) || 8));

    if (
      !forceRefresh &&
      this.updatesHistory.length >= Math.min(safeLimit, 3) &&
      this.updatesHistory[0]?.translationSource === 'valve-ptbr' &&
      this.lastCheckedAt &&
      Date.now() - Date.parse(this.lastCheckedAt) < 5 * 60 * 1000
    ) {
      return {
        updates: this.updatesHistory.slice(0, safeLimit),
        lastCheckedAt: this.lastCheckedAt,
        fromCache: true,
      };
    }

    if (this._recentFetchPromise) {
      return this._recentFetchPromise;
    }

    this._recentFetchPromise = (async () => {
      try {
        // 1. Primary: store.steampowered.com/news/app/730 native PT-BR feed
        const pageableEvents = await this.fetchSteamPageableEvents({ count: safeLimit + 2 });
        if (pageableEvents.length > 0) {
          const normalized = [];
          for (const ev of pageableEvents.slice(0, safeLimit)) {
            normalized.push(await this.normalizePartnerEvent(ev));
          }
          normalized.sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
          this.lastCheckedAt = new Date().toISOString();
          return {
            updates: normalized,
            lastCheckedAt: this.lastCheckedAt,
            fromCache: false,
          };
        }

        // 2. Fallback: ISteamNews API + auto-translator
        const url =
          'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=15&feeds=steam_community_announcements&l=brazilian&format=json';
        const res = await fetch(url, {
          headers: { 'User-Agent': 'CS2-Mix-Hub-Bot', 'Accept-Language': 'pt-BR,pt;q=0.9' },
          signal: AbortSignal.timeout(7000),
        });

        if (!res.ok) {
          throw new Error(`Steam API HTTP ${res.status}`);
        }

        const json = await res.json();
        const newsitems = Array.isArray(json.appnews?.newsitems) ? json.appnews.newsitems : [];
        const updateItems = newsitems.filter((item) =>
          /release notes|notas de atualiza|counter-strike 2 update|atualiza|update|patch|armory|premier|season/i.test(
            item.title || ''
          )
        );
        const selected = (updateItems.length >= 3 ? updateItems : newsitems).slice(0, safeLimit);

        const normalized = [];
        for (const item of selected) {
          normalized.push(await this.normalizeSteamNewsItem(item));
        }

        normalized.sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
        this.lastCheckedAt = new Date().toISOString();

        return {
          updates: normalized.length > 0 ? normalized : this.updatesHistory.slice(0, safeLimit),
          lastCheckedAt: this.lastCheckedAt,
          fromCache: false,
        };
      } catch (err) {
        console.warn('[CS2 NEWS] Erro ao carregar historico de atualizacoes:', err.message);
        return {
          updates: this.updatesHistory.slice(0, safeLimit),
          lastCheckedAt: this.lastCheckedAt,
          fromCache: true,
        };
      } finally {
        this._recentFetchPromise = null;
      }
    })();

    return this._recentFetchPromise;
  }

  buildEmbed(patchData, updatesPageUrl = '') {
    const sourceLabel =
      patchData.translationSource === 'valve-ptbr'
        ? 'Steam Comunidade Oficial • Português (PT-BR)'
        : patchData.translationSource === 'gemini'
        ? 'Valve Corporation • Tradução IA (PT-BR)'
        : 'Valve Corporation • Tradução Automática (PT-BR)';

    const embed = new EmbedBuilder()
      .setTitle(`📢 ATUALIZAÇÃO OFICIAL CS2 — ${patchData.title.toUpperCase()}`)
      .setURL(updatesPageUrl || patchData.url)
      .setColor(0xea580c)
      .setThumbnail('https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg')
      .setDescription(
        `**📅 Lançamento:** \`${patchData.formattedDate} (Horário de Brasília)\`\n` +
          `**🎮 Fonte Oficial:** \`${sourceLabel}\`\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          patchData.formattedNotes
      )
      .setFooter({
        text: 'Radar Oficial Steam News CS2 • Português (PT-BR)',
        iconURL: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/icons/valve_logo.png',
      })
      .setTimestamp(new Date((patchData.date || Math.floor(Date.now() / 1000)) * 1000));

    if (patchData.bannerImage) {
      embed.setImage(patchData.bannerImage);
    }

    const buttons = [];
    if (updatesPageUrl) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Ler no Site (PT-BR)')
          .setStyle(ButtonStyle.Link)
          .setURL(updatesPageUrl)
          .setEmoji('📰')
      );
    }
    buttons.push(
      new ButtonBuilder()
        .setLabel('Nota Oficial Steam')
        .setStyle(ButtonStyle.Link)
        .setURL(patchData.url)
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('Comunidade Steam CS2')
        .setStyle(ButtonStyle.Link)
        .setURL('https://store.steampowered.com/news/app/730?l=brazilian')
        .setEmoji('🌐')
    );

    const row = new ActionRowBuilder().addComponents(...buttons);
    return { embeds: [embed], components: [row] };
  }
}

export const cs2NewsRadar = new CS2NewsRadarService();
