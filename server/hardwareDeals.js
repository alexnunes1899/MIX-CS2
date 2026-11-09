import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEALS_FILE = path.join(__dirname, 'data', 'hardwareDeals.json');

class HardwareDealsManager {
  constructor() {
    this.cachedDeals = null;
    this.lastLoadTime = 0;
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
        .filter((item) => item.attributes?.available)
        .map((item) => {
          const attr = item.attributes;
          const oldPrice = attr.old_price && attr.old_price > attr.price_with_discount ? attr.old_price : attr.price;
          const price = attr.price_with_discount || attr.price;
          const discountPct =
            attr.discount_percentage ||
            (oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0);

          const link = attr.product_link
            ? `https://www.kabum.com.br/produto/${item.id}/${attr.product_link}`
            : `https://www.kabum.com.br/busca?q=${clean}`;

          const image =
            attr.photos?.g?.[0] ||
            attr.photos?.m?.[0] ||
            attr.images?.[0] ||
            'https://images.kabum.com.br/produtos/fotos/fallback.jpg';

          return {
            id: `kabum-${item.id}`,
            title: attr.title,
            category: 'hardware',
            categoryLabel: 'Hardware PC Gamer',
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
            highlight: '⚡ Preço ao vivo direto da KaBuM!',
            inStock: true,
            isLive: true,
          };
        });
    } catch (e) {
      console.warn('[HARDWARE DEALS] Erro na busca ao vivo KaBuM:', e.message);
      return [];
    }
  }

  async getDeals(options = {}) {
    const { category, store, query, limit = 5 } = options;
    const curated = this.loadCuratedData();
    let results = [...(curated.deals || [])];

    if (store) {
      results = results.filter((d) => d.store?.toLowerCase() === store.toLowerCase());
    }

    if (category) {
      results = results.filter((d) => d.category?.toLowerCase() === category.toLowerCase());
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);

      const curatedMatches = results.filter((d) => {
        const fullText = `${d.title} ${d.category} ${d.categoryLabel} ${d.highlight || ''}`.toLowerCase();
        return terms.every((t) => fullText.includes(t));
      });

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
    }

    return results.slice(0, limit);
  }

  buildDealsEmbed(deals, options = {}) {
    const title = options.title || '🔥 PROMOÇÕES & OFERTAS DE HARDWARE • PC GAMER CS2';
    const description =
      options.description ||
      `Monitoramento de promoções nas melhores lojas do Brasil:\n` +
      `🟠 **KaBuM!** • 🔴 **Pichau Informática** • 🟢 **TerabyteShop**\n\n` +
      `*Aumente seu FPS e estabilize suas partidas com peças confiáveis e preços reais:*`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=256&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Radar de Hardware Oficial' })
      .setTimestamp();

    if (!deals || deals.length === 0) {
      embed.addFields({
        name: '🔍 Nenhuma oferta específica encontrada',
        value: 'Tente buscar por termos como: `rtx 4060`, `ryzen`, `monitor 144hz`, `ssd` ou use `!ofertas` para ver os destaques.',
      });
      return embed;
    }

    deals.forEach((d, idx) => {
      const oldStr = d.oldPrice ? `~~R$ ${d.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}~~ ` : '';
      const newStr = `**R$ ${d.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**`;
      const discStr = d.discountPct > 0 ? ` \`[${d.discountPct}% OFF]\`` : '';
      const couponStr = d.coupon ? ` • Cupom: \`${d.coupon}\`` : '';
      const installStr = d.installment ? `\n💳 *${d.installment}*` : '';
      const highlightStr = d.highlight ? `\n> ${d.highlight}` : '';

      embed.addFields({
        name: `${idx + 1}. ${d.storeBadge || '🛒'} • ${d.title.slice(0, 75)}`,
        value: `💰 ${oldStr}${newStr}${discStr}${couponStr}${installStr}${highlightStr}\n👉 [Clique aqui para ver a oferta na loja](${d.link})\n`,
      });
    });

    return embed;
  }

  buildCategorySelectMenu() {
    const select = new StringSelectMenuBuilder()
      .setCustomId('hardware_category_filter')
      .setPlaceholder('🎯 Filtrar Ofertas por Categoria...')
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
          label: 'Monitores Gamer (144Hz a 240Hz)',
          description: 'Monitores de alta taxa de atualização para CS2',
          value: 'monitor',
          emoji: '🖥️',
        },
        {
          label: 'SSDs NVMe e Memórias RAM',
          description: 'Armazenamento rápido e memórias de alta frequência',
          value: 'ssd_ram',
          emoji: '🚀',
        },
        {
          label: 'Periféricos (Mouse, Teclado, Fone)',
          description: 'Mouses ultraleves, teclados mecânicos e headsets 7.1',
          value: 'perifericos',
          emoji: '🎧',
        },
      ]);

    return new ActionRowBuilder().addComponents(select);
  }

  buildActionButtons(deals = []) {
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
      const label = (d.title.length > 20 ? d.title.slice(0, 18) + '...' : d.title);
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

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('deals_refresh_hot')
        .setLabel('🔄 Atualizar Ofertas')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🟠 KaBuM!')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.kabum.com.br'),
      new ButtonBuilder()
        .setLabel('🔴 Pichau')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.pichau.com.br'),
      new ButtonBuilder()
        .setLabel('🟢 TerabyteShop')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.terabyteshop.com.br')
    );
    rows.push(navRow);

    return rows;
  }
}

export const hardwareDealsManager = new HardwareDealsManager();
