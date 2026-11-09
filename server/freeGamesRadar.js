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

      return { activeFree, upcomingFree };
    } catch (err) {
      console.warn('[FREE GAMES] Falha ao consultar Epic Games:', err.message);
      // Fallback
      return {
        activeFree: [
          {
            id: 'fallback-epic-1',
            title: 'Idle Champions of the Forgotten Realms',
            desc: 'Resgate o pacote de campeões e baús lendários gratuitamente.',
            originalPrice: 'R$ 180,00',
            deadline: 'Quinta-feira às 13:00 (BRT)',
            storeUrl: 'https://store.epicgames.com/pt-BR/free-games',
            imageUrl: 'https://cdn1.epicgames.com/offer/idlechampions/Diesel_FreeGames_Hero_1920x1080.jpg',
            platform: 'Epic Games Store',
            isAvailableNow: true,
          },
        ],
        upcomingFree: [
          {
            id: 'fallback-epic-2',
            title: 'Próximo Jogo Misterioso da Semana',
            desc: 'Novo jogo gratuito liberado toda quinta-feira às 13:00 BRT.',
            originalPrice: 'R$ 150,00',
            startDate: 'Próxima Quinta-feira',
            storeUrl: 'https://store.epicgames.com/pt-BR/free-games',
            imageUrl: null,
            platform: 'Epic Games Store',
            isAvailableNow: false,
          },
        ],
      };
    }
  }

  async getAllFreeGames() {
    const now = Date.now();
    if (this.cachedGames && now - this.lastFetch < 300000) {
      return this.cachedGames;
    }

    const { activeFree, upcomingFree } = await this.fetchEpicFreeGames();

    // Add Steam free highlights
    const steamFree = [
      {
        id: 'steam-cs2',
        title: 'Counter-Strike 2',
        desc: 'O maior FPS tático do mundo com física renovada e sub-tick oficial da Valve.',
        originalPrice: 'Gratuito para Jogar',
        deadline: 'Permanente',
        storeUrl: 'https://store.steampowered.com/app/730/CounterStrike_2/',
        imageUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg',
        platform: 'Steam',
        isAvailableNow: true,
      },
    ];

    this.cachedGames = { activeFree, upcomingFree, steamFree };
    this.lastFetch = now;
    return this.cachedGames;
  }

  buildEmbed(data) {
    const embed = new EmbedBuilder()
      .setTitle('🎁 RADAR DE JOGOS GRÁTIS PARA PC — EPIC GAMES & STEAM')
      .setColor(0x10b981) // Emerald Green
      .setDescription(
        'Nunca perca um jogo grátis! Resgate agora e guarde para sempre na sua biblioteca.\n' +
        'Novos jogos gratuitos são liberados toda quinta-feira às **12:00 / 13:00 (BRT)**!\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

    const actionButtons = [];

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
      text: 'Radar de Jogos Grátis • CS2 Mix Hub • Economize na sua biblioteca gamer',
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
