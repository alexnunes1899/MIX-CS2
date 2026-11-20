import fs from 'fs';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getDataFilePath, resolveSeededDataFile } from './dataDir.js';
import { readJsonSafe, writeJsonAtomic } from './utils/atomicJson.js';

const DEALS_FILE = resolveSeededDataFile('hardwareDeals.json');

export const LIVE_REPEAT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const CURATED_REPEAT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_SEEN_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SEEN_PER_GUILD = 400;
export const DEFAULT_REGULAR_SLOTS_BRT = [12, 19];
export const MIN_DROP_PCT = 5;
export const MIN_DROP_BRL = 30;
export const BLACK_FRIDAY_FLASH_MIN_DISCOUNT_PCT = 30;

const BRT_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Returns calendar date & wall-clock hour/minute in America/Sao_Paulo (BRT).
 */
export function getBrtDateParts(now = Date.now()) {
  const parts = {};
  for (const part of BRT_FORMATTER.formatToParts(new Date(now))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const hour = Number(parts.hour) % 24;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

/**
 * Returns true during Black Friday season (November in BRT or explicit BLACK_FRIDAY_MODE=1).
 */
export function isBlackFridaySeason(now = Date.now()) {
  if (process.env.BLACK_FRIDAY_MODE === '1') return true;
  if (process.env.BLACK_FRIDAY_MODE === '0') return false;
  return getBrtDateParts(now).month === 11;
}

export const CATEGORY_LABELS = {
  gpu: 'Placa de Vídeo (GPU)',
  cpu: 'Processador (CPU)',
  ram_ssd: 'Memória RAM & Armazenamento SSD',
  placa_mae_fonte: 'Placas-Mãe, Fontes & Gabinetes',
  monitor: 'Monitor Gamer (144Hz+)',
  mouse_teclado: 'Mouses & Teclados Mecânicos',
  audio: 'Headsets & Microfones',
  cadeira: 'Cadeira Gamer',
  mesa: 'Mesa Gamer & Setup',
};

const LIVE_POOL_QUERIES = {
  gpu_cpu: ['placa de video rtx', 'processador ryzen', 'placa de video rx'],
  monitor_audio: ['monitor gamer 144hz', 'monitor gamer 240hz', 'headset gamer'],
  mouse_teclado: ['mouse gamer', 'teclado mecanico', 'mousepad gamer'],
  ram_ssd: ['ssd nvme 1tb', 'memoria ram ddr4', 'memoria ram ddr5'],
  cadeira_mesa: ['cadeira gamer', 'mesa gamer'],
  all: ['placa de video rtx', 'processador ryzen', 'monitor gamer 144hz', 'mouse gamer', 'ssd nvme'],
};

const REGULAR_ROTATION_EXTRA_QUERIES = [
  'teclado mecanico',
  'headset gamer',
  'cadeira gamer',
  'memoria ram ddr4',
  'fonte 650w 80 plus',
];

export class HardwareDealsManager {
  constructor(options = {}) {
    this.stateFile = options.stateFile || null;
    this.cachedDeals = null;
    this.lastLoadTime = 0;
    this._state = null;
    this._loadedStatePath = null;
  }

  getStateFilePath() {
    return this.stateFile || getDataFilePath('hardwareDealsState.json');
  }

  loadState() {
    const filePath = this.getStateFilePath();
    if (this._state && this._loadedStatePath === filePath) {
      return this._state;
    }
    const raw = readJsonSafe(filePath, { guilds: {} });
    const normalized = raw && typeof raw === 'object' ? raw : { guilds: {} };
    if (!normalized.guilds || typeof normalized.guilds !== 'object') {
      normalized.guilds = {};
    }
    this._state = normalized;
    this._loadedStatePath = filePath;
    return this._state;
  }

  saveState() {
    if (!this._state) return false;
    const filePath = this.getStateFilePath();
    this._loadedStatePath = filePath;
    return writeJsonAtomic(filePath, this._state);
  }

  getGuildState(guildId = 'default', now = Date.now()) {
    const state = this.loadState();
    const gid = String(guildId || 'default');
    if (!state.guilds[gid] || typeof state.guilds[gid] !== 'object') {
      state.guilds[gid] = { seenDeals: {}, daily: {} };
    }
    const g = state.guilds[gid];
    if (!g.seenDeals || typeof g.seenDeals !== 'object') {
      g.seenDeals = {};
    }
    const { dateKey } = getBrtDateParts(now);
    if (!g.daily || typeof g.daily !== 'object' || g.daily.dateKey !== dateKey) {
      g.daily = {
        dateKey,
        regularCount: 0,
        priceDropCount: 0,
        lastRegularSlot: null,
        lastRegularAt: 0,
        lastPriceDropAt: 0,
      };
    }
    return g;
  }

  getDealKey(deal) {
    if (!deal) return '';
    if (deal.id !== undefined && deal.id !== null && String(deal.id).trim()) {
      return String(deal.id).trim().toLowerCase();
    }
    if (deal.link) {
      const cleanUrl = String(deal.link).split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
      if (cleanUrl) return cleanUrl;
    }
    return String(deal.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  loadCuratedData() {
    const now = Date.now();
    if (this.cachedDeals && now - this.lastLoadTime < 60000) {
      return this.cachedDeals;
    }
    try {
      if (fs.existsSync(DEALS_FILE)) {
        const raw = fs.readFileSync(DEALS_FILE, 'utf-8');
        this.cachedDeals = JSON.parse(raw);
        this.lastLoadTime = now;
        return this.cachedDeals;
      }
    } catch (e) {
      console.warn('[HARDWARE DEALS] Falha ao carregar catálogo de ofertas:', e.message);
    }
    return { stores: {}, deals: [] };
  }

  normalizeCategory(cat) {
    if (!cat) return null;
    const c = cat.toLowerCase().trim();
    if (c === 'all' || c === 'todas') return null;
    if (c === 'gpu' || c.includes('video') || c.includes('placa de video') || c.includes('rtx') || c.includes('radeon')) return 'gpu';
    if (c === 'cpu' || c.includes('processador') || c.includes('ryzen') || c.includes('intel')) return 'cpu';
    if (c === 'ram' || c === 'ssd' || c.includes('memoria') || c.includes('armazenamento') || c.includes('nvme') || c.includes('ram_ssd') || c.includes('ssd_ram')) return 'ram_ssd';
    if (c.includes('mobo') || c.includes('placa_mae') || c.includes('placa mae') || c.includes('fonte') || c.includes('cooler') || c.includes('gabinete') || c.includes('watercooler')) return 'placa_mae_fonte';
    if (c === 'monitor' || c.includes('monitore') || c.includes('tela') || c.includes('144hz') || c.includes('240hz')) return 'monitor';
    if (c.includes('mouse') || c.includes('teclado') || c.includes('mousepad') || c === 'mouse_teclado' || c === 'perifericos') return 'mouse_teclado';
    if (c.includes('headset') || c.includes('fone') || c.includes('microfone') || c.includes('audio') || c.includes('mic')) return 'audio';
    if (c.includes('cadeira') || c.includes('assento') || c.includes('ergonom')) return 'cadeira';
    if (c.includes('mesa') || c.includes('desk') || c.includes('setup') || c.includes('moveis')) return 'mesa';
    return c;
  }

  async searchKabumLive(query, limit = 4) {
    if (!query || !query.trim()) return [];
    try {
      const clean = encodeURIComponent(query.trim());
      const url = `https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products?query=${clean}&page_size=${limit}&sort=-discount`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) return [];
      const json = await res.json();
      const list = json.data || [];

      return list
        .map((item) => {
          const attr = item?.attributes;
          if (!attr?.available) return null;
          const discountPrice = Number(attr.price_with_discount || 0);
          const listPrice = Number(attr.price || 0);
          const oldCandidate = Number(attr.old_price || 0);
          const price = discountPrice > 0 ? discountPrice : listPrice;
          if (!Number.isFinite(price) || price <= 0) return null;

          const oldPrice = oldCandidate > price
            ? oldCandidate
            : (listPrice > price ? listPrice : 0);
          const discountPct = Number(attr.discount_percentage) > 0
            ? Math.round(Number(attr.discount_percentage))
            : (oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0);

          const slug = (attr.product_link || '').replace(/^\/+/, '');
          const link = item.id && slug
            ? `https://www.kabum.com.br/produto/${item.id}/${slug}`
            : item.id
            ? `https://www.kabum.com.br/produto/${item.id}`
            : `https://www.kabum.com.br/busca?q=${clean}`;

          const image =
            attr.photos?.g?.[0] ||
            attr.photos?.m?.[0] ||
            attr.images?.[0] ||
            'https://images.kabum.com.br/produtos/fotos/fallback.jpg';

          return {
            id: `kabum-${item.id}`,
            title: attr.title,
            category: this.normalizeCategory(attr.menu || query) || 'hardware',
            categoryLabel: 'Hardware & Setup PC Gamer',
            store: 'kabum',
            storeName: 'KaBuM!',
            storeBadge: '🟠 KaBuM!',
            oldPrice,
            price,
            discountPct,
            installment: attr.max_installment || '',
            coupon: null,
            link,
            image,
            highlight: '⚡ Preço ao vivo oficial da KaBuM!',
            inStock: true,
            isLive: true,
          };
        })
        .filter(Boolean);
    } catch (e) {
      console.warn('[HARDWARE DEALS] Erro na busca ao vivo KaBuM:', e.message);
      return [];
    }
  }

  /**
   * Fetches a deduplicated live pool from KaBuM! across relevant hardware queries
   * so scheduled drops surface genuinely fresh offers and real price drops.
   */
  async fetchLiveDealsPool({ categoryType = 'all', limitPerQuery = 6, now = Date.now() } = {}) {
    const baseQueries = LIVE_POOL_QUERIES[categoryType] || LIVE_POOL_QUERIES.all;
    const queries = [...baseQueries];

    if (categoryType === 'all') {
      const slotSeed = Math.floor(now / (30 * 60 * 1000));
      const extraQuery = REGULAR_ROTATION_EXTRA_QUERIES[slotSeed % REGULAR_ROTATION_EXTRA_QUERIES.length];
      if (extraQuery && !queries.includes(extraQuery)) {
        queries.push(extraQuery);
      }
    }

    if (isBlackFridaySeason(now)) {
      for (const bfQuery of ['black friday gamer', 'black friday placa de video']) {
        if (!queries.includes(bfQuery)) queries.push(bfQuery);
      }
    }

    const settled = await Promise.allSettled(
      queries.map((q) => this.searchKabumLive(q, limitPerQuery))
    );

    const byKey = new Map();
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled' || !Array.isArray(outcome.value)) continue;
      for (const deal of outcome.value) {
        if (!deal || !(Number(deal.price) > 0) || deal.inStock === false) continue;
        const key = this.getDealKey(deal);
        if (!key) continue;
        const existing = byKey.get(key);
        if (!existing || deal.price < existing.price) {
          byKey.set(key, deal);
        }
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => (Number(b.discountPct || 0) - Number(a.discountPct || 0)) || (a.price - b.price)
    );
  }

  /**
   * Enforces max 2 regular daily windows (12h & 19h BRT) and capped extra price-drop alerts
   * (max 1/day normally, max 2/day during November Black Friday season).
   */
  canSendDropToGuild(guildId, {
    kind = 'regular',
    now = Date.now(),
    regularSlots = DEFAULT_REGULAR_SLOTS_BRT,
    maxRegularPerDay = 2,
    minRegularGapHours = 6,
    minPriceDropGapHours = 3,
  } = {}) {
    const brt = getBrtDateParts(now);
    const guildState = this.getGuildState(guildId, now);
    const { daily } = guildState;
    const isBF = isBlackFridaySeason(now);

    if (kind === 'price_drop') {
      const maxPriceDropPerDay = isBF ? 2 : 1;
      if (daily.priceDropCount >= maxPriceDropPerDay) {
        return { allowed: false, reason: 'daily_price_drop_cap', isBlackFriday: isBF };
      }
      if (daily.lastPriceDropAt && (now - daily.lastPriceDropAt) < minPriceDropGapHours * 3600000) {
        return { allowed: false, reason: 'price_drop_cooldown', isBlackFriday: isBF };
      }
      return { allowed: true, slot: null, isBlackFriday: isBF };
    }

    const activeSlot = (regularSlots || DEFAULT_REGULAR_SLOTS_BRT).find((slotHour) => {
      const h = Number(slotHour);
      return brt.hour >= h && brt.hour < h + 2;
    });

    if (activeSlot === undefined) {
      return { allowed: false, reason: 'outside_window', isBlackFriday: isBF };
    }

    const slotKey = `${activeSlot}h`;
    if (daily.regularCount >= maxRegularPerDay) {
      return { allowed: false, reason: 'daily_regular_cap', isBlackFriday: isBF };
    }
    if (daily.lastRegularSlot === slotKey) {
      return { allowed: false, reason: 'slot_already_sent', isBlackFriday: isBF };
    }
    if (daily.lastRegularAt && (now - daily.lastRegularAt) < minRegularGapHours * 3600000) {
      return { allowed: false, reason: 'regular_cooldown', isBlackFriday: isBF };
    }

    return { allowed: true, slot: slotKey, isBlackFriday: isBF };
  }

  /**
   * Filters candidate deals so previously sent offers are NOT repeated within cooldown
   * UNLESS a live deal drops further in price (>= minDropPct OR >= minDropBrl).
   */
  filterFreshAndPriceDropDeals(guildId, candidateDeals = [], {
    now = Date.now(),
    liveRepeatCooldownMs = LIVE_REPEAT_COOLDOWN_MS,
    curatedRepeatCooldownMs = CURATED_REPEAT_COOLDOWN_MS,
    minDropPct = MIN_DROP_PCT,
    minDropBrl = MIN_DROP_BRL,
    limit = 4,
    priceDropOnly = false,
    includeBlackFridayFlash = true,
  } = {}) {
    const guildState = this.getGuildState(guildId, now);
    const seenDeals = guildState.seenDeals || {};
    const isBF = isBlackFridaySeason(now);

    const uniqueByKey = new Map();
    for (const deal of candidateDeals || []) {
      const price = Number(deal?.price || 0);
      if (!deal || !Number.isFinite(price) || price <= 0 || deal.inStock === false) continue;
      const key = this.getDealKey(deal);
      if (!key) continue;
      const existing = uniqueByKey.get(key);
      if (!existing || price < Number(existing.price)) {
        uniqueByKey.set(key, deal);
      }
    }

    const selected = [];
    for (const [key, deal] of uniqueByKey.entries()) {
      const prev = seenDeals[key];
      const currentPrice = Number(deal.price);
      const isLive = Boolean(deal.isLive);

      if (prev) {
        const prevPrice = Number(prev.lastPostedPrice || 0);
        const dropBrl = prevPrice > 0 ? Number((prevPrice - currentPrice).toFixed(2)) : 0;
        const dropPct = prevPrice > 0 ? Math.round((dropBrl / prevPrice) * 100) : 0;
        const hasSignificantDrop = isLive && dropBrl >= 5 && (dropPct >= minDropPct || dropBrl >= minDropBrl);

        if (hasSignificantDrop) {
          const prevLowest = Number(prev.lowestPrice || prevPrice);
          selected.push({
            ...deal,
            isPriceDrop: true,
            previousPrice: prevPrice,
            dropBrl,
            dropPct,
            isNewLowest: currentPrice < prevLowest,
          });
          continue;
        }

        const cooldownMs = isLive ? liveRepeatCooldownMs : curatedRepeatCooldownMs;
        if ((now - Number(prev.lastPostedAt || 0)) < cooldownMs) {
          continue;
        }

        if (priceDropOnly) {
          if (includeBlackFridayFlash && isBF && isLive && Number(deal.discountPct || 0) >= BLACK_FRIDAY_FLASH_MIN_DISCOUNT_PCT) {
            selected.push({ ...deal, isFlashDeal: true, isNew: true });
          }
          continue;
        }

        selected.push({ ...deal, isNew: true });
        continue;
      }

      const isFlashDeal = Boolean(isBF && isLive && Number(deal.discountPct || 0) >= BLACK_FRIDAY_FLASH_MIN_DISCOUNT_PCT);
      if (priceDropOnly) {
        if (includeBlackFridayFlash && isFlashDeal) {
          selected.push({ ...deal, isFlashDeal: true, isNew: true });
        }
        continue;
      }

      selected.push({ ...deal, isNew: true, isFlashDeal });
    }

    const scoreDeal = (d) => {
      if (d.isPriceDrop) return 4000 + Number(d.dropPct || 0) * 10 + Math.min(100, Number(d.dropBrl || 0) / 10);
      if (d.isFlashDeal) return 3000 + Number(d.discountPct || 0);
      if (d.isLive) return 2000 + Number(d.discountPct || 0);
      return 1000 + Number(d.discountPct || 0);
    };

    return selected.sort((a, b) => scoreDeal(b) - scoreDeal(a)).slice(0, limit);
  }

  /**
   * Persists sent deals & prices per guild so repeated deals are suppressed
   * and future price drops can be detected accurately.
   */
  recordPostedDeals(guildId, postedDeals = [], {
    kind = 'regular',
    slot = null,
    now = Date.now(),
    countTowardDaily = true,
  } = {}) {
    if (!postedDeals || postedDeals.length === 0) return false;
    const guildState = this.getGuildState(guildId, now);

    for (const deal of postedDeals) {
      const key = this.getDealKey(deal);
      const price = Number(deal?.price || 0);
      if (!key || !(price > 0)) continue;
      const prev = guildState.seenDeals[key];
      const prevLowest = prev && Number(prev.lowestPrice) > 0 ? Number(prev.lowestPrice) : price;
      guildState.seenDeals[key] = {
        title: String(deal.title || '').slice(0, 120),
        store: deal.store || '',
        link: deal.link || '',
        lastPostedPrice: price,
        lowestPrice: Math.min(prevLowest, price),
        lastPostedAt: now,
        lastDiscountPct: Number(deal.discountPct || 0),
      };
    }

    const entries = Object.entries(guildState.seenDeals)
      .filter(([, entry]) => entry && (now - Number(entry.lastPostedAt || 0)) <= MAX_SEEN_AGE_MS)
      .sort((a, b) => Number(b[1].lastPostedAt || 0) - Number(a[1].lastPostedAt || 0))
      .slice(0, MAX_SEEN_PER_GUILD);
    guildState.seenDeals = Object.fromEntries(entries);

    if (countTowardDaily) {
      if (kind === 'price_drop') {
        guildState.daily.priceDropCount = Number(guildState.daily.priceDropCount || 0) + 1;
        guildState.daily.lastPriceDropAt = now;
      } else {
        guildState.daily.regularCount = Number(guildState.daily.regularCount || 0) + 1;
        guildState.daily.lastRegularAt = now;
        if (slot) guildState.daily.lastRegularSlot = slot;
      }
    }

    return this.saveState();
  }

  async getDeals(options = {}) {
    const { category, store, query, limit = 5 } = options;
    const curated = this.loadCuratedData();
    let results = [...(curated.deals || [])];

    const normCat = this.normalizeCategory(category);

    if (store) {
      results = results.filter((d) => d.store?.toLowerCase() === store.toLowerCase());
    }

    if (normCat) {
      results = results.filter((d) => this.normalizeCategory(d.category) === normCat);
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);

      const curatedMatches = results
        .map((d) => {
          const titleLower = d.title.toLowerCase();
          const fullText = `${d.title} ${d.category} ${d.categoryLabel} ${d.highlight || ''}`.toLowerCase();
          let score = 0;
          if (terms.every((t) => titleLower.includes(t))) score += 100;
          else if (terms.every((t) => fullText.includes(t))) score += 50;
          else if (terms.some((t) => titleLower.includes(t))) score += 20;
          return { deal: d, score };
        })
        .filter((item) => item.score >= 50)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.deal);

      // Also search live on KaBuM!
      const liveKabum = await this.searchKabumLive(query, Math.min(4, limit));

      // Combine, prioritize curated matches if any, then live
      const combined = [...curatedMatches, ...liveKabum];
      const seen = new Set();
      results = combined.filter((item) => {
        const key = item.link || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else if (normCat && results.length < 3) {
      // If category has few curated items, supplement with live search
      const queryMap = {
        cadeira: 'cadeira gamer',
        mesa: 'mesa gamer',
        mouse_teclado: 'mouse gamer',
        audio: 'headset gamer',
        gpu: 'placa de video rtx',
        cpu: 'processador ryzen',
        ram_ssd: 'ssd nvme',
        monitor: 'monitor gamer',
        placa_mae_fonte: 'placa mae b550',
      };
      const extraQuery = queryMap[normCat];
      if (extraQuery) {
        const liveKabum = await this.searchKabumLive(extraQuery, 3);
        const seen = new Set(results.map((r) => r.link || r.id));
        liveKabum.forEach((item) => {
          if (!seen.has(item.link || item.id)) {
            item.category = normCat;
            results.push(item);
            seen.add(item.link || item.id);
          }
        });
      }
    }

    return results.slice(0, limit);
  }

  buildDealsEmbed(deals, options = {}) {
    const title = options.title || '🔥 PROMOÇÕES & OFERTAS DE HARDWARE • PC GAMER & SETUP';
    const description =
      options.description ||
      `Busca **ao vivo na KaBuM!** combinada com **catálogo curado de Pichau e TerabyteShop**:\n` +
      `🟠 **KaBuM!** (API ao vivo) • 🔴 **Pichau** & 🟢 **TerabyteShop** (Curadoria)\n\n` +
      `*Aumente seu FPS e renove seu setup (confira o preço final e estoque no link da loja):*`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(options.color ?? 0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=256&q=80')
      .setFooter({ text: 'CS2 Mix Hub • KaBuM! ao vivo + Catálogo curado Pichau/Terabyte • Confira no link' })
      .setTimestamp();

    if (!deals || deals.length === 0) {
      embed.addFields({
        name: '🔍 Nenhuma oferta específica encontrada',
        value: 'Tente buscar por termos como: `cadeira`, `mesa`, `mouse`, `teclado`, `rtx 4060`, `ryzen`, `monitor` ou selecione uma categoria abaixo.',
      });
      return embed;
    }

    const formatBrl = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    deals.forEach((d, idx) => {
      const hasHigherOldPrice = Number(d.oldPrice || 0) > Number(d.price || 0);
      const oldStr = hasHigherOldPrice ? `~~R$ ${formatBrl(d.oldPrice)}~~ ` : '';
      const newStr = `**R$ ${formatBrl(d.price)}**`;
      const discStr = d.discountPct > 0 ? ` \`[${d.discountPct}% OFF]\`` : '';
      const couponStr = d.coupon ? ` • Cupom: \`${d.coupon}\`` : '';
      const sourceBadge = d.isLive ? ' `🟢 Ao vivo`' : ' `📋 Catálogo curado`';
      const freshnessBadge = d.isNew && !d.isPriceDrop && !d.isFlashDeal ? ' `🆕 Nova`' : '';
      const priceDropStr = d.isPriceDrop
        ? `\n📉 **CAIU MAIS!** Era ~~R$ ${formatBrl(d.previousPrice)}~~ → **R$ ${formatBrl(d.price)}** (**-R$ ${formatBrl(d.dropBrl)} / -${d.dropPct}%**)${d.isNewLowest ? ' 🏆 *Menor preço registrado*' : ''}`
        : '';
      const flashStr = !d.isPriceDrop && d.isFlashDeal
        ? `\n🖤🔥 **BLACK FRIDAY RELÂMPAGO (${d.discountPct}% OFF AO VIVO)!**`
        : '';
      const installStr = d.installment ? `\n💳 *${d.installment}*` : '';
      const highlightStr = d.highlight ? `\n> ${d.highlight}` : '';

      embed.addFields({
        name: `${idx + 1}. ${d.storeBadge || '🛒'} • ${d.title.slice(0, 75)}`,
        value: `💰 ${oldStr}${newStr}${discStr}${couponStr}${sourceBadge}${freshnessBadge}${priceDropStr}${flashStr}${installStr}${highlightStr}\n👉 [Clique aqui para conferir preço e estoque na loja](${d.link})\n`,
      });
    });

    return embed;
  }

  buildCategorySelectMenu() {
    const select = new StringSelectMenuBuilder()
      .setCustomId('hardware_category_filter')
      .setPlaceholder('🎯 Filtrar Ofertas por Peça ou Setup...')
      .addOptions([
        {
          label: '🔥 Melhores Ofertas (Geral)',
          description: 'Top promoções quentes de KaBuM, Pichau e Terabyte',
          value: 'all',
          emoji: '🔥',
        },
        {
          label: 'Placas de Vídeo (GPUs)',
          description: 'GeForce RTX 4060, 4070, Radeon RX 6750 XT e mais',
          value: 'gpu',
          emoji: '🎮',
        },
        {
          label: 'Processadores (CPUs)',
          description: 'AMD Ryzen 7800X3D, 5700X3D, Ryzen 5 5600 e Intel Core',
          value: 'cpu',
          emoji: '⚡',
        },
        {
          label: 'Memórias RAM & Armazenamento SSD',
          description: 'SSDs NVMe M.2 ultra rápidos e memórias DDR4/DDR5',
          value: 'ram_ssd',
          emoji: '🚀',
        },
        {
          label: 'Placas-Mãe, Fontes & Gabinetes',
          description: 'Motherboards B550/B650, fontes 80 Plus e water coolers',
          value: 'placa_mae_fonte',
          emoji: '🛡️',
        },
        {
          label: 'Monitores Gamer (144Hz a 240Hz)',
          description: 'Monitores de alta taxa de atualização para CS2',
          value: 'monitor',
          emoji: '🖥️',
        },
        {
          label: 'Mouses & Teclados Mecânicos',
          description: 'Mouses ultraleves (Logitech G Pro, Razer) e teclados TKL',
          value: 'mouse_teclado',
          emoji: '🖱️',
        },
        {
          label: 'Headsets & Áudio Gamer',
          description: 'Headsets espaciais e microfones para Discord e CS2',
          value: 'audio',
          emoji: '🎧',
        },
        {
          label: 'Cadeiras Gamer',
          description: 'Cadeiras ergonômicas, reclináveis e tecido respirável',
          value: 'cadeira',
          emoji: '💺',
        },
        {
          label: 'Mesas Gamer & Setup',
          description: 'Mesas com espaço para 2 monitores, RGB e suporte headset',
          value: 'mesa',
          emoji: '🪵',
        },
      ]);

    return new ActionRowBuilder().addComponents(select);
  }

  buildActionButtons(deals = [], context = {}) {
    const rows = [];
    const buttonRow = new ActionRowBuilder();

    // Add up to 3 direct store buttons if available
    const topStores = [];
    deals.slice(0, 3).forEach((d) => {
      if (d.link && !topStores.some((s) => s.link === d.link)) {
        topStores.push(d);
      }
    });

    topStores.forEach((d) => {
      const label = d.title.length > 20 ? d.title.slice(0, 18) + '...' : d.title;
      buttonRow.addComponents(
        new ButtonBuilder()
          .setLabel(`${d.storeBadge || '🛒'} ${label}`)
          .setStyle(ButtonStyle.Link)
          .setURL(d.link)
      );
    });

    if (buttonRow.components.length > 0) {
      rows.push(buttonRow);
    }

    const { query, category } = context;
    const cleanQ = query && query.trim() ? query.trim() : (category ? (CATEGORY_LABELS[category] || category) : '');

    const kabumUrl = cleanQ ? `https://www.kabum.com.br/busca?q=${encodeURIComponent(cleanQ)}` : 'https://www.kabum.com.br';
    const pichauUrl = cleanQ ? `https://www.pichau.com.br/search?q=${encodeURIComponent(cleanQ)}` : 'https://www.pichau.com.br';
    const terabyteUrl = cleanQ ? `https://www.terabyteshop.com.br/busca?busca=${encodeURIComponent(cleanQ)}` : 'https://www.terabyteshop.com.br';

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('deals_refresh_hot')
        .setLabel('🔄 Atualizar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel(cleanQ ? '🟠 KaBuM! Buscar' : '🟠 KaBuM!')
        .setStyle(ButtonStyle.Link)
        .setURL(kabumUrl),
      new ButtonBuilder()
        .setLabel(cleanQ ? '🔴 Pichau Buscar' : '🔴 Pichau')
        .setStyle(ButtonStyle.Link)
        .setURL(pichauUrl),
      new ButtonBuilder()
        .setLabel(cleanQ ? '🟢 Terabyte Buscar' : '🟢 TerabyteShop')
        .setStyle(ButtonStyle.Link)
        .setURL(terabyteUrl)
    );
    rows.push(navRow);

    return rows;
  }
}

export const hardwareDealsManager = new HardwareDealsManager();
