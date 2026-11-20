import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Free PC Games Radar Service
 * Fetches free weekly PC games from Epic Games Store API and Steam 100% free promotions.
 * Formats rich embeds with title, original price, claim deadline, image thumbnails, and claim buttons.
 */

export class FreeGamesRadarService {
  constructor() {
    this.cachedGames = null;
    this.lastFetch = 0;
  }

  async fetchEpicFreeGames() {
    try {
      const url =
        'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR';
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) throw new Error(`Epic API HTTP ${res.status}`);
      const json = await res.json();
      const elements = json.data?.Catalog?.searchStore?.elements || [];

      const activeFree = [];
      const upcomingFree = [];

      for (const item of elements) {
        const title = item.title;
        const desc = item.description || '';
        const rawPrice = item.price?.totalPrice?.originalPrice || item.price?.totalPrice?.fmtPrice?.originalPrice || 0;
        const fmtOriginalPrice =
          typeof item.price?.totalPrice?.fmtPrice?.originalPrice === 'string' &&
          item.price?.totalPrice?.fmtPrice?.originalPrice !== '0'
            ? item.price.totalPrice.fmtPrice.originalPrice
            : rawPrice > 0
            ? `R$ ${(rawPrice / 100).toFixed(2).replace('.', ',')}`
            : 'Gratuito';

        // Find slug
        const slug =
          item.productSlug ||
          item.urlSlug ||
          item.offerMappings?.[0]?.pageSlug ||
          item.catalogNs?.mappings?.[0]?.pageSlug;
        const storeUrl = slug
          ? `https://store.epicgames.com/pt-BR/p/${slug}`
          : 'https://store.epicgames.com/pt-BR/free-games';

        // Find image
        const img =
          item.keyImages?.find((i) => i.type === 'OfferImageWide' || i.type === 'DieselStoreFrontWide') ||
          item.keyImages?.find((i) => i.type === 'Thumbnail' || i.type === 'VaultClosed') ||
          item.keyImages?.[0];
        const imageUrl = img?.url || null;

        // Check active promotions (discount 0 = 100% off)
        const promoOffers = item.promotions?.promotionalOffers?.[0]?.promotionalOffers || [];
        const isCurrentFree = promoOffers.some(
          (p) => p.discountSetting?.discountPercentage === 0 || item.price?.totalPrice?.discountPrice === 0
        );

        if (isCurrentFree && promoOffers.length > 0) {
          const offer = promoOffers[0];
          const endDate = new Date(offer.endDate);
          const deadlineBRT = endDate.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          activeFree.push({
            id: item.id,
            title,
            desc,
            originalPrice: fmtOriginalPrice,
            deadline: deadlineBRT,
            storeUrl,
            imageUrl,
            platform: 'Epic Games Store',
            isAvailableNow: true,
          });
          continue;
        }

        // Check upcoming free promotions
        const upcomingOffers = item.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers || [];
        const isUpcomingFree = upcomingOffers.some((p) => p.discountSetting?.discountPercentage === 0);
        if (isUpcomingFree && upcomingOffers.length > 0) {
          const offer = upcomingOffers[0];
          const startDate = new Date(offer.startDate);
          const startBRT = startDate.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });

          upcomingFree.push({
            id: item.id,
            title,
            desc,
            originalPrice: fmtOriginalPrice,
            startDate: startBRT,
            storeUrl,
            imageUrl,
            platform: 'Epic Games Store',
            isAvailableNow: false,
          });
        }
      }

      return { activeFree, upcomingFree, unavailable: false };
    } catch (err) {
      console.warn('[FREE GAMES] Falha ao consultar Epic Games:', err.message);
      return {
        activeFree: [],
        upcomingFree: [],
        unavailable: true,
      };
    }
  }

  async getAllFreeGames() {
    const now = Date.now();
    if (this.cachedGames && !this.cachedGames.unavailable && now - this.lastFetch < 300000) {
      return this.cachedGames;
    }

    const { activeFree, upcomingFree, unavailable } = await this.fetchEpicFreeGames();
    const data = {
      activeFree,
      upcomingFree,
      unavailable: Boolean(unavailable),
    };

    if (!data.unavailable) {
      this.cachedGames = data;
      this.lastFetch = now;
    }
    return data;
  }

  buildEmbed(data = {}) {
    const embed = new EmbedBuilder()
      .setTitle('🎁 RADAR DE JOGOS GRÁTIS — EPIC GAMES STORE')
      .setColor(data.unavailable ? 0xf59e0b : 0x10b981)
      .setDescription(
        'Consulta ao vivo na API oficial da **Epic Games Store** para você resgatar jogos grátis por tempo limitado.\n' +
        'Novas promoções semanais costumam entrar toda quinta-feira às **12:00 / 13:00 (BRT)**!\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

    const actionButtons = [];

    if (data.unavailable) {
      embed.addFields({
        name: '⚠️ API da Epic Games Store temporariamente indisponível',
        value:
          'Não foi possível consultar as promoções ao vivo neste instante. Nenhum jogo fictício foi exibido — tente novamente em alguns minutos ou confira diretamente na loja oficial:\n' +
          '🔗 [Abrir Jogos Grátis na Epic Games Store](https://store.epicgames.com/pt-BR/free-games)',
        inline: false,
      });
    } else if ((!data.activeFree || data.activeFree.length === 0) && (!data.upcomingFree || data.upcomingFree.length === 0)) {
      embed.addFields({
        name: 'ℹ️ Nenhum jogo grátis listado agora',
        value: 'A API oficial não retornou jogos promocionais neste momento. Confira diretamente em [store.epicgames.com](https://store.epicgames.com/pt-BR/free-games).',
        inline: false,
      });
    }

    // Active Free Games
    if (data.activeFree?.length > 0) {
      data.activeFree.slice(0, 3).forEach((g, idx) => {
        embed.addFields({
          name: `🟢 DISPONÍVEL AGORA: ${g.title} (${g.platform})`,
          value:
            `💰 **De:** ~~${g.originalPrice}~~ ➡️ **GRÁTIS (100% OFF)**\n` +
            `⏳ **Resgatar até:** \`${g.deadline}\`\n` +
            `🔗 **Link direto:** [Clique aqui para resgatar](${g.storeUrl})`,
          inline: false,
        });

        if (actionButtons.length < 4) {
          actionButtons.push(
            new ButtonBuilder()
              .setLabel(`Resgatar ${g.title.slice(0, 20)}`)
              .setStyle(ButtonStyle.Link)
              .setURL(g.storeUrl)
              .setEmoji('🎮')
          );
        }

        if (idx === 0 && g.imageUrl) {
          embed.setImage(g.imageUrl);
        }
      });
    }

    // Upcoming Free Games
    if (data.upcomingFree?.length > 0) {
      const upStr = data.upcomingFree
        .slice(0, 2)
        .map((g) => `• **${g.title}** — Disponível a partir de \`${g.startDate}\` (Epic Games)`)
        .join('\n');
      embed.addFields({ name: '🔮 EM BREVE NA PRÓXIMA SEMANA', value: upStr, inline: false });
    }

    embed.setFooter({
      text: 'Radar de Jogos Grátis • Dados ao vivo via API Epic Games Store',
      iconURL: 'https://cdn2.unrealengine.com/Epic+Games+Node%2Fxlarge_whitetext_blackback_epiclogo_504x512_1529964470588-504x512-ac791e237819038908845d6e65514f6822d2f48f.jpg',
    });
    embed.setTimestamp();

    if (actionButtons.length === 0) {
      actionButtons.push(
        new ButtonBuilder()
          .setLabel('Ver Loja Epic Games')
          .setStyle(ButtonStyle.Link)
          .setURL('https://store.epicgames.com/pt-BR/free-games')
          .setEmoji('🎁')
      );
    }

    const row = new ActionRowBuilder().addComponents(actionButtons.slice(0, 5));
    return { embeds: [embed], components: [row] };
  }
}

export const freeGamesRadar = new FreeGamesRadarService();
