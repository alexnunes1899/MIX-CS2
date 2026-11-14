import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { isSnowflake } from './utils/security.js';

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

  _extractCandidates(mix) {
    if (!mix) return [];
    const baseList = (mix.players && mix.players.length > 0)
      ? mix.players
      : [...(mix.teamA?.players || []), ...(mix.teamB?.players || [])];

    const seen = new Set();
    const candidates = [];
    for (const p of baseList) {
      if (!p || !p.id) continue;
      const pid = String(p.id);
      if (seen.has(pid)) continue;
      seen.add(pid);
      candidates.push({
        id: pid,
        username: p.displayName || p.username || p.nick || p.name || 'Jogador',
      });
    }
    return candidates;
  }

  startOrGetVote(mix) {
    if (!mix || !mix.id) return null;
    const now = Date.now();
    for (const [key, sess] of this.activeVotes.entries()) {
      if (!sess.active || now - (sess.createdAt || 0) > 6 * 60 * 60 * 1000) {
        this.activeVotes.delete(key);
      }
    }

    const candidates = this._extractCandidates(mix);
    if (!this.activeVotes.has(mix.id)) {
      this.activeVotes.set(mix.id, {
        mixId: mix.id,
        mixName: mix.name || 'Mix CS2',
        creatorId: mix.creatorId || null,
        channelId: mix.channelId || null,
        active: true,
        createdAt: now,
        votes: new Map(),
        candidates,
      });
    } else {
      const existing = this.activeVotes.get(mix.id);
      if ((!existing.candidates || existing.candidates.length === 0) && candidates.length > 0) {
        existing.candidates = candidates;
      }
      if (!existing.creatorId && mix.creatorId) existing.creatorId = mix.creatorId;
      if (!existing.channelId && mix.channelId) existing.channelId = mix.channelId;
    }

    return this.activeVotes.get(mix.id);
  }

  castVote(mixId, voterId, candidateId) {
    if (!candidateId || candidateId === 'none') {
      return { success: false, reason: 'Nenhum jogador válido disponível para votar.' };
    }
    const session = this.activeVotes.get(mixId);
    if (!session || !session.active) {
      return { success: false, reason: 'Votação de bagre encerrada ou não encontrada.' };
    }
    const cand = (session.candidates || []).find((c) => c.id === candidateId);
    if (session.candidates?.length > 0 && !cand) {
      return { success: false, reason: 'Candidato não encontrado nesta votação.' };
    }
    session.votes.set(voterId, candidateId);
    return {
      success: true,
      totalVotes: session.votes.size,
      candidateName: cand?.username || 'Jogador',
    };
  }

  buildVoteEmbed(mix) {
    const session = this.startOrGetVote(mix);
    if (!session) return null;

    const counts = new Map();
    for (const cid of session.votes.values()) {
      counts.set(cid, (counts.get(cid) || 0) + 1);
    }

    const rankingLines = (session.candidates || []).slice(0, 15).map((c) => {
      const v = counts.get(c.id) || 0;
      const mention = isSnowflake(c.id) ? `<@${c.id}>` : `**${c.username}**`;
      return `• ${mention} — **${v} ${v === 1 ? 'voto' : 'votos'}**`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🐟 VOTAÇÃO: QUEM FOI O BAGRE DA PARTIDA?')
      .setColor(0x0ea5e9)
      .setDescription(
        `A votação democrática está aberta para eleger o **Bagre do Mix**!\n` +
        `Escolha no menu abaixo quem mais pinou, errou utility ou entregou o round.\n\n` +
        `📊 **Votos computados até agora:** \`${session.votes.size}\`\n` +
        (rankingLines.length > 0
          ? `\n**Candidatos:**\n${rankingLines.join('\n')}`
          : '\n*Nenhum candidato encontrado neste lobby.*')
      )
      .setFooter({ text: 'Bagre do Mix • CS2 Mix Hub • Selecione abaixo e clique em Encerrar quando todos votarem' })
      .setTimestamp();

    return embed;
  }

  buildVoteMenu(mix) {
    const session = this.startOrGetVote(mix);
    if (!session) return [];

    const options = (session.candidates || []).slice(0, 25).map((c) => ({
      label: String(c.username || 'Jogador').slice(0, 50),
      value: c.id,
      description: 'Votar neste jogador como o Bagre do Mix',
      emoji: '🐟',
    }));

    const hasCandidates = options.length > 0;
    if (!hasCandidates) {
      options.push({
        label: 'Nenhum jogador disponível',
        value: 'none',
        description: 'Lobby vazio',
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`bagre_select:${mix.id}`)
      .setPlaceholder('Escolha quem mais pinou ou entregou a partida...')
      .setDisabled(!hasCandidates)
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    const finishBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bagre_finish:${mix.id}`)
        .setLabel('Encerrar Votação e Coroar o Bagre')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasCandidates)
        .setEmoji('🐟')
    );

    return [row, finishBtn];
  }

  async finishVote(mixOrId, channel, guild, profiles = {}, saveProfilesFn = null) {
    const mixId = typeof mixOrId === 'string' ? mixOrId : mixOrId?.id;
    const mixObj = typeof mixOrId === 'object' ? mixOrId : null;
    if (!mixId) return null;

    const session = this.activeVotes.get(mixId);
    if (!session) return null;
    session.active = false;
    this.activeVotes.delete(mixId);

    const counts = new Map();
    session.votes.forEach((candidateId) => {
      if (candidateId && candidateId !== 'none') {
        counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
      }
    });

    let bagreId = null;
    let maxVotes = -1;

    counts.forEach((count, candidateId) => {
      if (count > maxVotes) {
        maxVotes = count;
        bagreId = candidateId;
      }
    });

    const candidates = session.candidates || [];
    if (!bagreId) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      bagreId = pick ? pick.id : mixObj?.players?.[0]?.id || null;
      maxVotes = 0;
    }

    if (!bagreId) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('🐟 VOTAÇÃO DE BAGRE ENCERRADA')
        .setColor(0x94a3b8)
        .setDescription('Não havia jogadores suficientes neste lobby para coroar um Bagre.')
        .setTimestamp();
      if (channel) await channel.send({ embeds: [emptyEmbed] }).catch(() => {});
      return emptyEmbed;
    }

    const candInfo = candidates.find((c) => c.id === bagreId);
    const bagreName = candInfo?.username || 'Jogador';

    // Update profile
    const prof = profiles[bagreId] || { level: 16 };
    prof.bagres = (prof.bagres || 0) + 1;
    profiles[bagreId] = prof;
    if (saveProfilesFn) saveProfilesFn(profiles);

    // Try to assign or reuse existing @Bagre do Mix role (avoid creating duplicates!)
    let roleAssigned = false;
    if (guild && guild.members && isSnowflake(bagreId)) {
      try {
        let role = guild.roles.cache.find((r) => r.name.toLowerCase().includes('bagre do mix'));
        if (!role && guild.roles.create) {
          role = await guild.roles.create({
            name: 'Bagre do Mix 🐟',
            color: 0x64748b,
            reason: 'Cargo comemorativo do Bagre da partida',
          }).catch(() => null);
        }

        if (role) {
          const membersWithRole = guild.members.cache.filter(
            (m) => m.id !== bagreId && m.roles.cache.has(role.id)
          );
          for (const [, m] of membersWithRole) {
            await m.roles.remove(role).catch(() => {});
          }

          const targetMember = await guild.members.fetch(bagreId).catch(() => null);
          if (targetMember) {
            if (!targetMember.roles.cache.has(role.id)) {
              await targetMember.roles.add(role).catch(() => {});
            }
            roleAssigned = true;
          }
        }
      } catch {
        // Safe fail
      }
    }

    const quote = this.getRandomQuote();
    const bagreLabel = isSnowflake(bagreId) ? `<@${bagreId}>` : `**${bagreName}**`;

    const embed = new EmbedBuilder()
      .setTitle('🐟 BAGRE DA PARTIDA COROADO COM SUCESSO!')
      .setColor(0x94a3b8)
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3075/3075977.png')
      .setDescription(
        `A bancada democrática votou e elegeu o jogador que mais colaborou com a diversão (e com os adversários):\n\n` +
        `🎣 **BAGRE ELEITO:** ${bagreLabel} (\`${maxVotes} ${maxVotes === 1 ? 'voto' : 'votos'}\`)\n` +
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
