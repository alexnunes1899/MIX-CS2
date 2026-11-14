import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

export const BAGRE_QUOTES = [
  'Descarregou 30 balas de AK-47 na parede e foi eliminado de Glock sem colete!',
  'Jogou a flashbang na quina da parede, cegou os 4 companheiros e abriu caminho pro rush adversário!',
  'Errou a smoke da janela da Mirage e acabou fumando a base CT pros terroristas!',
  'Tentou dar facada no adversário defusando a C4 e tomou um no-scope na cara!',
  'Comprou Zeus no round 12-12, avançou sem info e morreu sem dar 1 de dano!',
  'Ficou moscando no Spawn olhando skin e deixou a bomba explodir no outro bombsite!',
  'Mirou no pixel por 40 segundos, piscou o olho e o adversário passou correndo dando HS!',
  'Comprou Negev achando que era partida casual e travou a economia do time todo!',
];

export class BagreVoteService {
  constructor() {
    this.activeVotes = new Map(); // mixId -> { mixId, votes: Map(voterId -> candidateId), active: true, candidates: [] }
  }

  getRandomQuote() {
    return BAGRE_QUOTES[Math.floor(Math.random() * BAGRE_QUOTES.length)];
  }

  startOrGetVote(mix) {
    if (!mix) return null;
    const now = Date.now();
    for (const [key, sess] of this.activeVotes.entries()) {
      if (!sess.active || now - (sess.createdAt || 0) > 6 * 60 * 60 * 1000) {
        this.activeVotes.delete(key);
      }
    }
    if (!this.activeVotes.has(mix.id)) {
      const candidates = (mix.players || []).map((p) => ({
        id: p.id,
        username: p.displayName || p.username || 'Jogador',
      }));

      this.activeVotes.set(mix.id, {
        mixId: mix.id,
        mixName: mix.name || 'Mix CS2',
        active: true,
        createdAt: now,
        votes: new Map(),
        candidates,
      });
    }
    return this.activeVotes.get(mix.id);
  }

  castVote(mixId, voterId, candidateId) {
    const session = this.activeVotes.get(mixId);
    if (!session || !session.active) return { success: false, reason: 'Votação de bagre encerrada ou não encontrada.' };
    session.votes.set(voterId, candidateId);
    return { success: true, totalVotes: session.votes.size };
  }

  buildVoteMenu(mix) {
    const session = this.startOrGetVote(mix);
    const options = (session.candidates || []).slice(0, 25).map((c) => ({
      label: c.username.slice(0, 50),
      value: c.id,
      description: 'Votar neste jogador como o Bagre do Mix',
      emoji: '🐟',
    }));

    if (options.length === 0) {
      options.push({
        label: 'Nenhum jogador disponível',
        value: 'none',
        description: 'Lobby vazio',
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`bagre_select:${mix.id}`)
      .setPlaceholder('Escolha quem mais pinou ou entregou a partida...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    const finishBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bagre_finish:${mix.id}`)
        .setLabel('Encerrar Votação e Coroar o Bagre')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🐟'),
      new ButtonBuilder()
        .setCustomId(`mvp_finish:${mix.id}`)
        .setLabel('Encerrar MVP')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👑')
    );

    return [row, finishBtn];
  }

  async finishVote(mix, channel, guild, profiles, saveProfilesFn) {
    const session = this.activeVotes.get(mix.id);
    if (!session) return null;
    session.active = false;
    this.activeVotes.delete(mix.id);

    const counts = new Map();
    session.votes.forEach((candidateId) => {
      counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
    });

    let bagreId = null;
    let maxVotes = -1;

    counts.forEach((count, candidateId) => {
      if (count > maxVotes) {
        maxVotes = count;
        bagreId = candidateId;
      }
    });

    if (!bagreId) {
      // Pick random player if no votes cast
      const candidates = session.candidates || [];
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      bagreId = pick ? pick.id : mix.players?.[0]?.id;
      maxVotes = 0;
    }

    // Update profile
    const prof = profiles[bagreId] || { level: 16 };
    prof.bagres = (prof.bagres || 0) + 1;
    profiles[bagreId] = prof;
    if (saveProfilesFn) saveProfilesFn(profiles);

    // Try to assign or create @Bagre do Mix role
    let roleAssigned = false;
    if (guild && guild.members) {
      try {
        let role = guild.roles.cache.find((r) => r.name.toLowerCase() === 'bagre do mix');
        if (!role && guild.roles.create) {
          role = await guild.roles.create({
            name: 'Bagre do Mix 🐟',
            color: 0x64748b,
            reason: 'Cargo comemorativo do Bagre da partida',
          }).catch(() => null);
        }

        if (role) {
          // Remove from previous holders in guild if cached
          const membersWithRole = guild.members.cache.filter((m) => m.roles.cache.has(role.id));
          for (const [, m] of membersWithRole) {
            await m.roles.remove(role).catch(() => {});
          }

          // Assign to new bagre
          const targetMember = await guild.members.fetch(bagreId).catch(() => null);
          if (targetMember) {
            await targetMember.roles.add(role).catch(() => {});
            roleAssigned = true;
          }
        }
      } catch (err) {
        // Safe fail
      }
    }

    const quote = this.getRandomQuote();

    const embed = new EmbedBuilder()
      .setTitle('🐟 BAGRE DA PARTIDA COROADO COM SUCESSO!')
      .setColor(0x94a3b8) // Slate Gray
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3075/3075977.png')
      .setDescription(
        `A bancada democrática votou e elegeu o jogador que mais colaborou com a diversão (e com os adversários):\n\n` +
        `🎣 **BAGRE ELEITO:** <@${bagreId}> (\`${maxVotes} votos\`)\n` +
        `📜 **Relatório do Lance:** *"${quote}"*\n` +
        `🐟 **Total de Bagres na Carreira:** **${prof.bagres}x Coroado**\n` +
        (roleAssigned ? `🏷️ **Cargo Atribuído:** \`@Bagre do Mix 🐟\`\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({
        text: 'Bagre do Mix • CS2 Mix Hub • Zoação 100% esportiva e saudável',
      })
      .setTimestamp();

    if (channel) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    return embed;
  }
}

export const bagreVoteService = new BagreVoteService();
