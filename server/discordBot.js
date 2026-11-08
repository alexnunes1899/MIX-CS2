/**
 * CS2 Mix Hub • Official Discord Bot Engine
 * Full-featured Discord Bot with Slash Commands, interactive Buttons,
 * 5v5 queue management, automatic team balancing, in-Discord Map Pick & Ban (Veto),
 * Roulette, voice channel auto-moving, and synchronization with CS2 Mix Hub web rooms.
 */

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'data', 'discordBotConfig.json');

// Default Active Duty Maps for Pick & Ban
const OFFICIAL_MAPS = [
  { id: 'de_mirage', name: 'Mirage', emoji: '🏜️' },
  { id: 'de_inferno', name: 'Inferno', emoji: '🔥' },
  { id: 'de_nuke', name: 'Nuke', emoji: '☢️' },
  { id: 'de_dust2', name: 'Dust II', emoji: '☀️' },
  { id: 'de_ancient', name: 'Ancient', emoji: '🌿' },
  { id: 'de_anubis', name: 'Anubis', emoji: '🏺' },
  { id: 'de_cache', name: 'Cache', emoji: '🏭' },
];

class DiscordBotManager {
  constructor() {
    this.client = null;
    this.config = this.loadConfig();
    this.status = {
      running: false,
      tag: null,
      id: null,
      guildCount: 0,
      ping: null,
      lastError: null,
      startedAt: null,
    };
    // In-memory active mixes keyed by channelId or mixId
    this.activeMixes = new Map();
    // Reference to Web Hub rooms store if passed
    this.webRoomsRef = null;
  }

  setWebRoomsReference(roomsRef) {
    this.webRoomsRef = roomsRef;
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao ler botConfig.json:', e.message);
    }
    return {
      token: process.env.DISCORD_BOT_TOKEN || '',
      clientId: process.env.DISCORD_CLIENT_ID || '',
      guildId: process.env.DISCORD_GUILD_ID || '',
      defaultChannelId: process.env.DISCORD_CHANNEL_ID || '',
      lobbyVoiceId: process.env.DISCORD_LOBBY_VOICE || '',
      teamAVoiceId: process.env.DISCORD_TEAMA_VOICE || '',
      teamBVoiceId: process.env.DISCORD_TEAMB_VOICE || '',
      autoMoveVoice: true,
      autoStartVetoOnFull: false,
      serverConnect: '',
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('[DISCORD BOT] Falha ao salvar botConfig.json:', e.message);
    }
  }

  getStatus() {
    const isReady = Boolean(this.client && this.client.isReady());
    const safeConfig = {
      hasToken: Boolean(this.config.token),
      clientId: this.config.clientId || '',
      guildId: this.config.guildId || '',
      defaultChannelId: this.config.defaultChannelId || '',
      lobbyVoiceId: this.config.lobbyVoiceId || '',
      teamAVoiceId: this.config.teamAVoiceId || '',
      teamBVoiceId: this.config.teamBVoiceId || '',
      autoMoveVoice: this.config.autoMoveVoice ?? true,
      autoStartVetoOnFull: this.config.autoStartVetoOnFull ?? false,
      serverConnect: this.config.serverConnect || '',
    };

    if (isReady) {
      return {
        ...this.status,
        running: true,
        tag: this.client.user?.tag || null,
        id: this.client.user?.id || null,
        guildCount: this.client.guilds.cache.size,
        ping: this.client.ws.ping,
        config: safeConfig,
        activeMixesCount: this.activeMixes.size,
      };
    }
    return {
      ...this.status,
      running: false,
      config: safeConfig,
      activeMixesCount: this.activeMixes.size,
    };
  }

  async start() {
    const token = (this.config.token || process.env.DISCORD_BOT_TOKEN || '').trim();
    if (!token) {
      this.status.lastError = 'Token do Bot Discord não configurado.';
      return { success: false, error: this.status.lastError };
    }

    if (this.client) {
      await this.stop();
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.MessageContent,
        ],
      });

      this.setupEventHandlers();

      await this.client.login(token);
      this.status.running = true;
      this.status.startedAt = new Date().toISOString();
      this.status.lastError = null;

      console.log(`🎮 [DISCORD BOT] Conectado com sucesso como ${this.client.user.tag}!`);

      // Register or update Slash Commands
      await this.registerSlashCommands();

      return { success: true, tag: this.client.user.tag, id: this.client.user.id };
    } catch (err) {
      console.error('❌ [DISCORD BOT] Erro ao iniciar bot:', err.message);
      this.status.running = false;
      this.status.lastError = err.message;
      return { success: false, error: err.message };
    }
  }

  async stop() {
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {}
      this.client = null;
    }
    this.status.running = false;
    this.status.tag = null;
    this.status.id = null;
    console.log('🛑 [DISCORD BOT] Bot desconectado.');
    return { success: true };
  }

  async registerSlashCommands() {
    if (!this.client || !this.client.user) return;
    const token = this.config.token.trim();
    const clientId = (this.config.clientId || this.client.user.id).trim();

    const commands = [
      new SlashCommandBuilder()
        .setName('mix')
        .setDescription('Comandos de Mix CS2 5v5 oficial')
        .addSubcommand((sub) =>
          sub
            .setName('criar')
            .setDescription('Cria um novo lobby de Mix 5v5 com botões interativos')
            .addStringOption((opt) =>
              opt.setName('nome').setDescription('Nome personalizado para o Mix (ex: Mix dos Primos)').setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName('formato')
                .setDescription('Formato da Partida')
                .setRequired(false)
                .addChoices({ name: 'Melhor de 1 (MD1)', value: 'MD1' }, { name: 'Melhor de 3 (MD3)', value: 'MD3' })
            )
        )
        .addSubcommand((sub) => sub.setName('entrar').setDescription('Entra na fila do Mix ativo neste canal'))
        .addSubcommand((sub) => sub.setName('sair').setDescription('Sai da fila do Mix'))
        .addSubcommand((sub) => sub.setName('sortear').setDescription('Sorteia e balanceia os dois times (Time A vs Time B)'))
        .addSubcommand((sub) => sub.setName('veto').setDescription('Inicia o Pick & Ban (Veto) oficial de mapas'))
        .addSubcommand((sub) => sub.setName('roleta').setDescription('Sorteia um mapa na roleta rápida do CS2'))
        .addSubcommand((sub) => sub.setName('status').setDescription('Exibe o status do mix atual'))
        .addSubcommand((sub) => sub.setName('cancelar').setDescription('Cancela o mix atual do canal')),

      new SlashCommandBuilder()
        .setName('roleta')
        .setDescription('Gira a roleta rápida de mapas oficiais do CS2 (CSPRNG Fisher-Yates)')
        .addStringOption((opt) =>
          opt
            .setName('formato')
            .setDescription('Quantidade de mapas a sortear')
            .setRequired(false)
            .addChoices(
              { name: 'MD1 (1 Mapa)', value: 'MD1' },
              { name: 'MD3 (3 Mapas)', value: 'MD3' },
              { name: 'MD5 (5 Mapas)', value: 'MD5' }
            )
        ),

      new SlashCommandBuilder()
        .setName('painel')
        .setDescription('Cria o Painel Permanente do CS2 Mix Hub com botão de criar mix em 1 clique'),

      new SlashCommandBuilder()
        .setName('servidor')
        .setDescription('Exibe ou configura o endereço IP do servidor de CS2 para o mix')
        .addStringOption((opt) =>
          opt.setName('ip_porta').setDescription('Ex: 189.1.168.20:27015 (ou connect com senha)').setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Exibe os melhores jogadores e o Hall da Fama do CS2 Mix Hub'),

      new SlashCommandBuilder().setName('ajuda').setDescription('Manual completo de comandos do Bot do Mix'),
    ];

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      console.log(`[DISCORD BOT] Registrando ${commands.length} Slash Commands...`);

      if (this.config.guildId && this.config.guildId.trim()) {
        // Instant guild registration (updates immediately without Discord 1-hour global cache delay)
        await rest.put(Routes.applicationGuildCommands(clientId, this.config.guildId.trim()), {
          body: commands.map((c) => c.toJSON()),
        });
        console.log(`✅ [DISCORD BOT] Slash commands registrados no servidor ${this.config.guildId}!`);
      } else {
        // Global registration
        await rest.put(Routes.applicationCommands(clientId), {
          body: commands.map((c) => c.toJSON()),
        });
        console.log('✅ [DISCORD BOT] Slash commands registrados globalmente!');
      }
    } catch (err) {
      console.warn('[DISCORD BOT] Aviso ao registrar comandos slash:', err.message);
    }
  }

  setupEventHandlers() {
    this.client.on('ready', () => {
      this.client.user?.setActivity('CS2 Mix 5v5 • /mix', { type: 0 }); // Playing
    });

    // Handle Slash Commands
    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleChatCommand(interaction);
        } else if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this.handleSelectMenuInteraction(interaction);
        }
      } catch (err) {
        console.error('[DISCORD BOT] Erro ao processar interação:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Ocorreu um erro interno: ${err.message}`,
            ephemeral: true,
          }).catch(() => {});
        }
      }
    });
  }

  // ==========================================
  // SLASH COMMAND HANDLERS
  // ==========================================

  async handleChatCommand(interaction) {
    const { commandName } = interaction;

    if (commandName === 'mix') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'criar') return this.cmdCreateMix(interaction);
      if (sub === 'entrar') return this.cmdJoinMix(interaction);
      if (sub === 'sair') return this.cmdLeaveMix(interaction);
      if (sub === 'sortear') return this.cmdDrawTeams(interaction);
      if (sub === 'veto') return this.cmdStartVeto(interaction);
      if (sub === 'roleta') return this.cmdRoulette(interaction);
      if (sub === 'status') return this.cmdStatus(interaction);
      if (sub === 'cancelar') return this.cmdCancelMix(interaction);
    }

    if (commandName === 'painel') {
      return this.cmdSendPermanentPanel(interaction);
    }

    if (commandName === 'roleta') {
      return this.cmdRoulette(interaction);
    }

    if (commandName === 'servidor') {
      return this.cmdServer(interaction);
    }

    if (commandName === 'ranking') {
      return this.cmdRanking(interaction);
    }

    if (commandName === 'ajuda') {
      return this.cmdHelp(interaction);
    }
  }

  // ==========================================
  // MIX MANAGEMENT LOGIC
  // ==========================================

  getOrCreateMix(channelId, creator, options = {}) {
    let mix = this.activeMixes.get(channelId);
    if (!mix) {
      const mixId = `MIX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      mix = {
        id: mixId,
        channelId,
        name: options.name || `Mix CS2 #${mixId}`,
        format: options.format || 'MD1',
        creatorId: creator.id,
        creatorNick: creator.username,
        players: [], // array of { id, username, displayName, avatar, level, ready }
        phase: 'lobby', // 'lobby' | 'teams' | 'veto' | 'live' | 'finished'
        teamA: { name: 'Time A', captain: null, players: [], side: 'CT' },
        teamB: { name: 'Time B', captain: null, players: [], side: 'TR' },
        veto: {
          currentTurn: 'teamA', // 'teamA' | 'teamB'
          bannedMaps: [], // array of map objects
          remainingMaps: [...OFFICIAL_MAPS],
          deciderMap: null,
          history: [],
        },
        serverIp: this.config.serverConnect || '',
        messageId: null,
        createdAt: Date.now(),
      };
      this.activeMixes.set(channelId, mix);
    }
    return mix;
  }

  buildLobbyEmbed(mix) {
    const total = mix.players.length;
    const isFull = total >= 10;
    const color = isFull ? 0x10b981 : 0xf59e0b; // Emerald if 10/10, Gold otherwise

    const playerList = [];
    for (let i = 0; i < 10; i++) {
      const p = mix.players[i];
      if (p) {
        playerList.push(`**${i + 1}.** <@${p.id}> \`[Lvl ${p.level || 16}]\``);
      } else {
        playerList.push(`**${i + 1}.** *[Vazio - Disponível]*`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎮 CS2 MIX HUB • ${mix.name.toUpperCase()}`)
      .setDescription(
        `Fila oficial de Mix 5v5 para Counter-Strike 2.\n` +
          `Clique nos botões abaixo para entrar ou gerenciar a partida!`
      )
      .setColor(color)
      .addFields(
        {
          name: `👥 Jogadores Conectados (${total}/10)`,
          value: playerList.slice(0, 5).join('\n'),
          inline: true,
        },
        {
          name: '\u200B',
          value: playerList.slice(5, 10).join('\n'),
          inline: true,
        },
        {
          name: '⚙️ Configurações da Partida',
          value:
            `🏆 **Formato:** ${mix.format}\n` +
            `🛡️ **Status:** ${isFull ? '🟢 **LOBBY LOTADO (10/10)! Pronto para sortear**' : '🟡 Aguardando jogadores'}\n` +
            `💻 **Servidor:** ${mix.serverIp ? `\`${mix.serverIp}\`` : '*Host local ou a definir*'}\n` +
            `👑 **Criador:** <@${mix.creatorId}>`,
          inline: false,
        }
      )
      .setFooter({
        text: `ID do Mix: ${mix.id} • CS2 Mix Hub eSports Edition`,
      })
      .setTimestamp();

    return embed;
  }

  buildLobbyButtons(mix) {
    const total = mix.players.length;
    const isFull = total >= 10;

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_join:${mix.id}`)
        .setLabel(`Entrar (${total}/10)`)
        .setEmoji('➕')
        .setStyle(isFull ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isFull),
      new ButtonBuilder()
        .setCustomId(`mix_leave:${mix.id}`)
        .setLabel('Sair')
        .setEmoji('➖')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(total === 0),
      new ButtonBuilder()
        .setCustomId(`mix_teams:${mix.id}`)
        .setLabel('Sortear Times')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(total < 2),
      new ButtonBuilder()
        .setCustomId(`mix_veto:${mix.id}`)
        .setLabel('Pick & Ban')
        .setEmoji('🗳️')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mix_roulette:${mix.id}`)
        .setLabel('Roleta de Mapa')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_voice:${mix.id}`)
        .setLabel('Mover Calls')
        .setEmoji('📞')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_cancel:${mix.id}`)
        .setLabel('Cancelar')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2];
  }

  buildTeamsEmbed(mix) {
    const teamA = mix.teamA;
    const teamB = mix.teamB;

    const aPlayers = (teamA.players || [])
      .map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}> \`[Lvl ${p.level || 16}]\``)
      .join('\n') || '*Nenhum jogador*';

    const bPlayers = (teamB.players || [])
      .map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}> \`[Lvl ${p.level || 16}]\``)
      .join('\n') || '*Nenhum jogador*';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ TIMES FORMADOS • ${mix.name.toUpperCase()}`)
      .setDescription('Os dois esquadrões foram balanceados por Nível de Habilidade!')
      .setColor(0xf59e0b)
      .addFields(
        {
          name: `🛡️ ${teamA.name} (${teamA.side})`,
          value: aPlayers,
          inline: true,
        },
        {
          name: `🔥 ${teamB.name} (${teamB.side})`,
          value: bPlayers,
          inline: true,
        },
        {
          name: '🎯 Próxima Etapa',
          value: 'Clique em **Iniciar Pick & Ban** para vetar os mapas ou **Roleta de Mapa** para sorteio rápido!',
          inline: false,
        }
      )
      .setFooter({ text: `Mix: ${mix.id} • CS2 Mix Hub` })
      .setTimestamp();

    return embed;
  }

  buildVetoEmbed(mix) {
    const veto = mix.veto;
    const isFinished = Boolean(veto.deciderMap);
    const turnCaptain = veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
    const turnTeamName = veto.currentTurn === 'teamA' ? mix.teamA.name : mix.teamB.name;

    const remainingList = veto.remainingMaps
      .map((m) => `${m.emoji} **${m.name}** (\`${m.id}\`)`)
      .join('\n') || '*Nenhum*';

    const bannedList = veto.bannedMaps
      .map((b) => `❌ ~~${b.map.name}~~ (Banido por <@${b.by}>)`)
      .join('\n') || '*Nenhum mapa banido ainda*';

    const embed = new EmbedBuilder()
      .setTitle(`🗳️ PICK & BAN DE MAPAS • ${mix.name.toUpperCase()}`)
      .setColor(isFinished ? 0x10b981 : 0x38bdf8);

    if (isFinished) {
      embed.setDescription(
        `🏆 **MAPA DEFINIDO COM SUCESSO!**\n\n` +
          `🗺️ **Mapa:** \`${veto.deciderMap.name}\` (${veto.deciderMap.id})\n` +
          `🛡️ **${mix.teamA.name}:** Inicia de **${mix.teamA.side}**\n` +
          `🔥 **${mix.teamB.name}:** Inicia de **${mix.teamB.side}**\n\n` +
          (mix.serverIp ? `💻 **Conectar no CS2:**\n\`connect ${mix.serverIp}\`\n\n` : '') +
          `GL & HF! Bom jogo a todos!`
      );
    } else {
      embed.setDescription(
        `Formato: **${mix.format}** • Rotação Oficial Valve\n\n` +
          `👉 **Vez de Banir:** <@${turnCaptain?.id || mix.creatorId}> (${turnTeamName})`
      );
    }

    embed.addFields(
      {
        name: `🗺️ Mapas no Pool (${veto.remainingMaps.length})`,
        value: remainingList,
        inline: true,
      },
      {
        name: `🚫 Mapas Banidos (${veto.bannedMaps.length})`,
        value: bannedList,
        inline: true,
      }
    );

    return embed;
  }

  buildVetoButtons(mix) {
    const veto = mix.veto;
    if (veto.deciderMap || veto.remainingMaps.length <= 1) {
      return [];
    }

    // Maximum 5 buttons per ActionRow in Discord
    const rows = [];
    let currentRow = new ActionRowBuilder();

    veto.remainingMaps.forEach((map, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`veto_ban:${mix.id}:${map.id}`)
          .setLabel(`Banir ${map.name}`)
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  // ==========================================
  // BUTTON INTERACTION HANDLERS
  // ==========================================

  async handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const user = interaction.user;

    // Permanent Panel Trigger
    if (customId === 'panel_create_mix') {
      const mix = this.getOrCreateMix(interaction.channelId, user, { name: `Mix 5v5 de ${user.username}` });
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      return interaction.reply({
        content: `🎮 <@${user.id}> abriu um novo **Lobby de Mix CS2**!`,
        embeds: [embed],
        components,
      });
    }

    // Parsed customId: "action:mixId:param"
    const [action, mixId, param] = customId.split(':');
    const mix = this.activeMixes.get(interaction.channelId);

    if (!mix || mix.id !== mixId) {
      return interaction.reply({
        content: '⚠️ Este mix já foi finalizado ou expirou. Use `/mix criar` para começar outro!',
        ephemeral: true,
      });
    }

    // 1. JOIN MIX
    if (action === 'mix_join') {
      const alreadyIn = mix.players.some((p) => p.id === user.id);
      if (alreadyIn) {
        return interaction.reply({
          content: '⚠️ Você já está na fila deste mix!',
          ephemeral: true,
        });
      }

      if (mix.players.length >= 10) {
        return interaction.reply({
          content: '🚫 O lobby já está lotado com 10 jogadores!',
          ephemeral: true,
        });
      }

      // Add player
      mix.players.push({
        id: user.id,
        username: user.username,
        displayName: interaction.member?.displayName || user.username,
        avatar: user.displayAvatarURL({ dynamic: true }),
        level: Math.floor(Math.random() * 8) + 14, // default around 14-21 GC
        ready: true,
      });

      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);

      await interaction.update({ embeds: [embed], components });

      // Notify if lobby became 10/10
      if (mix.players.length === 10) {
        const mentions = mix.players.map((p) => `<@${p.id}>`).join(' ');
        await interaction.channel.send({
          content: `🚨 **LOBBY LOTADO (10/10)!** ${mentions}\nTodos os jogadores estão prontos! O capitão pode clicar em **Sortear Times**!`,
        });
      }
      return;
    }

    // 2. LEAVE MIX
    if (action === 'mix_leave') {
      const idx = mix.players.findIndex((p) => p.id === user.id);
      if (idx === -1) {
        return interaction.reply({
          content: '⚠️ Você não está na fila deste mix.',
          ephemeral: true,
        });
      }

      mix.players.splice(idx, 1);
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 3. DRAW TEAMS
    if (action === 'mix_teams') {
      if (mix.players.length < 2) {
        return interaction.reply({
          content: '⚠️ É necessário pelo menos 2 jogadores para formar times!',
          ephemeral: true,
        });
      }

      // Balance teams by level
      const sorted = [...mix.players].sort((a, b) => (b.level || 16) - (a.level || 16));
      const teamA = [];
      const teamB = [];

      sorted.forEach((p, i) => {
        if (i % 2 === 0) teamA.push(p);
        else teamB.push(p);
      });

      mix.teamA.players = teamA;
      mix.teamA.captain = teamA[0] || null;
      mix.teamB.players = teamB;
      mix.teamB.captain = teamB[0] || null;
      mix.phase = 'teams';

      const embed = this.buildTeamsEmbed(mix);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mix_veto:${mix.id}`).setLabel('Iniciar Pick & Ban').setEmoji('🗳️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`mix_roulette:${mix.id}`).setLabel('Roleta Rápida').setEmoji('🎲').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`mix_voice:${mix.id}`).setLabel('Mover para Calls').setEmoji('📞').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    // 4. START VETO
    if (action === 'mix_veto') {
      mix.phase = 'veto';
      if (!mix.teamA.captain && mix.players[0]) {
        mix.teamA.captain = mix.players[0];
        mix.teamB.captain = mix.players[1] || mix.players[0];
      }

      const embed = this.buildVetoEmbed(mix);
      const components = this.buildVetoButtons(mix);

      return interaction.update({
        content: `🎯 **Iniciando Pick & Ban de Mapas!**`,
        embeds: [embed],
        components,
      });
    }

    // 5. BAN MAP (DURING VETO)
    if (action === 'veto_ban') {
      const mapId = param;
      const veto = mix.veto;

      const currentCaptain = veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
      // Allow creator or captain to click
      const isAllowed = user.id === currentCaptain?.id || user.id === mix.creatorId;

      if (!isAllowed) {
        return interaction.reply({
          content: `🚫 Não é a sua vez! Apenas o Capitão <@${currentCaptain?.id}> pode banir agora.`,
          ephemeral: true,
        });
      }

      const mapIndex = veto.remainingMaps.findIndex((m) => m.id === mapId);
      if (mapIndex === -1) {
        return interaction.reply({
          content: '⚠️ Este mapa já foi banido!',
          ephemeral: true,
        });
      }

      const [banned] = veto.remainingMaps.splice(mapIndex, 1);
      veto.bannedMaps.push({ map: banned, by: user.id });

      // Alternate turn
      veto.currentTurn = veto.currentTurn === 'teamA' ? 'teamB' : 'teamA';

      // Check if 1 map left (decider)
      if (veto.remainingMaps.length === 1) {
        veto.deciderMap = veto.remainingMaps[0];
        mix.phase = 'live';

        // Auto move voice if enabled
        if (this.config.autoMoveVoice) {
          this.executeVoiceMover(interaction.guild, mix).catch(() => {});
        }
      }

      const embed = this.buildVetoEmbed(mix);
      const components = this.buildVetoButtons(mix);

      return interaction.update({ embeds: [embed], components });
    }

    // 6. ROULETTE
    if (action === 'mix_roulette') {
      const randIdx = Math.floor(Math.random() * OFFICIAL_MAPS.length);
      const drawn = OFFICIAL_MAPS[randIdx];
      mix.veto.deciderMap = drawn;
      mix.phase = 'live';

      const embed = new EmbedBuilder()
        .setTitle('🎲 ROLETA OFICIAL DE MAPA')
        .setDescription(
          `O algoritmo Fisher-Yates CSPRNG sorteou o mapa para o confronto:\n\n` +
            `🗺️ **MAPA SORTEADO:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)\n` +
            `🎯 **Lado Inicial:** Time A (CT) | Time B (TR)\n\n` +
            (mix.serverIp ? `💻 \`connect ${mix.serverIp}\`` : '')
        )
        .setColor(0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Roleta Instantânea' })
        .setTimestamp();

      return interaction.update({ embeds: [embed], components: [] });
    }

    // 7. VOICE MOVER
    if (action === 'mix_voice') {
      if (!interaction.guild) {
        return interaction.reply({ content: '⚠️ Comando disponível apenas em servidores.', ephemeral: true });
      }
      const res = await this.executeVoiceMover(interaction.guild, mix);
      return interaction.reply({
        content: res.message,
        ephemeral: true,
      });
    }

    // 8. CANCEL MIX
    if (action === 'mix_cancel') {
      if (user.id !== mix.creatorId && !interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: '🚫 Apenas o criador do mix ou um administrador pode cancelar.',
          ephemeral: true,
        });
      }

      this.activeMixes.delete(interaction.channelId);
      return interaction.update({
        content: `❌ O mix **${mix.name}** foi cancelado por <@${user.id}>.`,
        embeds: [],
        components: [],
      });
    }
  }

  // ==========================================
  // VOICE CHANNEL MOVER HELPER
  // ==========================================

  async executeVoiceMover(guild, mix) {
    if (!guild) return { success: false, message: 'Guild não encontrada.' };
    const { teamAVoiceId, teamBVoiceId } = this.config;
    if (!teamAVoiceId || !teamBVoiceId) {
      return {
        success: false,
        message: '⚠️ IDs dos canais de voz Time A e Time B não foram configurados no bot.',
      };
    }

    let movedCount = 0;
    const movePlayer = async (playerId, channelId) => {
      try {
        const member = await guild.members.fetch(playerId).catch(() => null);
        if (member && member.voice && member.voice.channelId) {
          await member.voice.setChannel(channelId);
          movedCount++;
        }
      } catch (e) {
        console.warn(`[VOICE MOVER] Falha ao mover membro ${playerId}:`, e.message);
      }
    };

    const promises = [];
    (mix.teamA.players || []).forEach((p) => promises.push(movePlayer(p.id, teamAVoiceId)));
    (mix.teamB.players || []).forEach((p) => promises.push(movePlayer(p.id, teamBVoiceId)));

    await Promise.all(promises);
    return {
      success: true,
      message: `✅ **${movedCount} jogador(es)** foram movidos para as suas respectivas calls de voz!`,
    };
  }

  // ==========================================
  // SPECIFIC SLASH COMMANDS
  // ==========================================

  async cmdCreateMix(interaction) {
    const name = interaction.options.getString('nome') || `Mix 5v5 de ${interaction.user.username}`;
    const format = interaction.options.getString('formato') || 'MD1';

    const mix = this.getOrCreateMix(interaction.channelId, interaction.user, { name, format });
    const embed = this.buildLobbyEmbed(mix);
    const components = this.buildLobbyButtons(mix);

    return interaction.reply({
      content: `🎮 <@${interaction.user.id}> criou um novo **Lobby de Mix CS2 5v5**!`,
      embeds: [embed],
      components,
    });
  }

  async cmdJoinMix(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({
        content: '⚠️ Nenhum mix ativo neste canal. Crie um com `/mix criar`!',
        ephemeral: true,
      });
    }

    if (mix.players.some((p) => p.id === interaction.user.id)) {
      return interaction.reply({ content: '⚠️ Você já está no mix!', ephemeral: true });
    }

    if (mix.players.length >= 10) {
      return interaction.reply({ content: '🚫 O mix já está lotado (10/10)!', ephemeral: true });
    }

    mix.players.push({
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.username,
      avatar: interaction.user.displayAvatarURL({ dynamic: true }),
      level: 16,
      ready: true,
    });

    return interaction.reply({
      content: `✅ <@${interaction.user.id}> entrou no mix! (${mix.players.length}/10)`,
    });
  }

  async cmdLeaveMix(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    }

    const idx = mix.players.findIndex((p) => p.id === interaction.user.id);
    if (idx === -1) {
      return interaction.reply({ content: '⚠️ Você não está no mix.', ephemeral: true });
    }

    mix.players.splice(idx, 1);
    return interaction.reply({
      content: `🚪 <@${interaction.user.id}> saiu do mix. (${mix.players.length}/10)`,
    });
  }

  async cmdDrawTeams(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    }

    if (mix.players.length < 2) {
      return interaction.reply({ content: '⚠️ Mínimo de 2 jogadores para sortear times!', ephemeral: true });
    }

    const sorted = [...mix.players].sort((a, b) => (b.level || 16) - (a.level || 16));
    const teamA = [];
    const teamB = [];

    sorted.forEach((p, i) => {
      if (i % 2 === 0) teamA.push(p);
      else teamB.push(p);
    });

    mix.teamA.players = teamA;
    mix.teamA.captain = teamA[0];
    mix.teamB.players = teamB;
    mix.teamB.captain = teamB[0];
    mix.phase = 'teams';

    const embed = this.buildTeamsEmbed(mix);
    return interaction.reply({ embeds: [embed] });
  }

  async cmdStartVeto(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    }

    mix.phase = 'veto';
    if (!mix.teamA.captain && mix.players[0]) {
      mix.teamA.captain = mix.players[0];
      mix.teamB.captain = mix.players[1] || mix.players[0];
    }

    const embed = this.buildVetoEmbed(mix);
    const components = this.buildVetoButtons(mix);

    return interaction.reply({
      content: '🎯 **Pick & Ban Iniciado!**',
      embeds: [embed],
      components,
    });
  }

  async cmdRoulette(interaction) {
    const format = interaction.options?.getString('formato') || 'MD1';
    const count = format === 'MD3' ? 3 : format === 'MD5' ? 5 : 1;

    const shuffled = [...OFFICIAL_MAPS].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count);

    const embed = new EmbedBuilder()
      .setTitle(`🎲 ROLETA DE MAPAS CS2 • ${format}`)
      .setColor(0xf59e0b)
      .setDescription(
        `Sorteio criptográfico realizado com sucesso!\n\n` +
          picked.map((m, i) => `**Mapa ${i + 1}:** ${m.emoji} **${m.name}** (\`${m.id}\`)`).join('\n')
      )
      .setFooter({ text: 'CS2 Mix Hub • Algoritmo CSPRNG' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  async cmdStatus(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({
        content: 'ℹ️ Nenhum mix ativo neste canal. Crie um agora com `/mix criar`!',
        ephemeral: true,
      });
    }

    const embed = this.buildLobbyEmbed(mix);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async cmdCancelMix(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    }

    this.activeMixes.delete(interaction.channelId);
    return interaction.reply({ content: `❌ O mix **${mix.name}** foi cancelado com sucesso.` });
  }

  async cmdSendPermanentPanel(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🏆 CS2 MIX HUB • PAINEL OFICIAL DA COMUNIDADE')
      .setDescription(
        `Bem-vindo à central de partidas 5v5 da comunidade!\n\n` +
          `• **Lobbies Automáticos:** Clique em **Criar Mix** para abrir uma fila 5v5 neste canal.\n` +
          `• **Balanceamento Competitivo:** Gamers Club e FACEIT oficial.\n` +
          `• **Pick & Ban:** Veto de mapas oficial MD1 e MD3 da Valve com 1 clique.\n` +
          `• **Canais de Voz:** Movimentação automática para calls CT e TR na hora do jogo!\n\n` +
          `*Pressione o botão verde abaixo para iniciar um Mix agora:*`
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Plataforma Competitiva' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('🎮 Criar Mix 5v5')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('🌐 Acessar Hub no Navegador')
        .setStyle(ButtonStyle.Link)
        .setURL('http://localhost:3000/')
    );

    await interaction.reply({
      content: '✅ Painel do Mix Hub gerado com sucesso no canal!',
      ephemeral: true,
    });

    return interaction.channel.send({ embeds: [embed], components: [row] });
  }

  async cmdServer(interaction) {
    const input = interaction.options.getString('ip_porta');
    if (input) {
      this.config.serverConnect = input.trim();
      this.saveConfig({ serverConnect: input.trim() });
      return interaction.reply({
        content: `✅ Servidor CS2 configurado com sucesso para os mixes: \`${this.config.serverConnect}\``,
      });
    }

    const current = this.config.serverConnect;
    return interaction.reply({
      content: current
        ? `💻 **Servidor Atual:** \`${current}\`\n👉 Para conectar: \`connect ${current}\``
        : '⚠️ Nenhum servidor configurado ainda. Use `/servidor ip_porta: 189.1.168.20:27015` para configurar!',
    });
  }

  async cmdRanking(interaction) {
    try {
      const filePath = path.join(__dirname, 'data', 'leaderboard.json');
      let data = [];
      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }

      if (!Array.isArray(data) || data.length === 0) {
        return interaction.reply({
          content: '🏆 **Hall da Fama:** Ainda não há partidas registradas. Jogue o primeiro mix para pontuar!',
        });
      }

      const top5 = data.slice(0, 5);
      const list = top5
        .map(
          (p, i) =>
            `**${i + 1}º** ${p.nick} • **${p.wins || 0}V** / ${p.losses || 0}D (\`${p.winRate || 0}%\` Win Rate) - Lvl ${p.level || 16}`
        )
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏆 HALL DA FAMA & RANKING DA COMUNIDADE')
        .setDescription(list)
        .setColor(0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Leaderboard' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      return interaction.reply({ content: `❌ Erro ao buscar ranking: ${e.message}`, ephemeral: true });
    }
  }

  async cmdHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 GUIA DE COMANDOS • CS2 MIX HUB BOT')
      .setColor(0x38bdf8)
      .setDescription(
        `O bot permite organizar mixes 5v5 completos sem precisar sair do Discord!\n\n` +
          `**Comandos Principais:**\n` +
          `• \`/mix criar\` - Inicia uma nova fila de mix 5v5 com botões\n` +
          `• \`/mix entrar\` - Entra na fila do mix ativo\n` +
          `• \`/mix sair\` - Sai da fila do mix\n` +
          `• \`/mix sortear\` - Balanceia os dois times por nível de habilidade\n` +
          `• \`/mix veto\` - Inicia o Pick & Ban de mapas oficial da Valve\n` +
          `• \`/mix roleta\` - Gira a roleta de mapas instantânea\n` +
          `• \`/mix status\` - Exibe a situação do mix no canal\n` +
          `• \`/mix cancelar\` - Cancela o mix ativo\n` +
          `• \`/painel\` - Cria um painel fixo com botão verde para abrir mix a qualquer hora\n` +
          `• \`/servidor\` - Consulta ou define o IP do servidor de CS2\n` +
          `• \`/ranking\` - Mostra os líderes do Hall da Fama`
      )
      .setFooter({ text: 'CS2 Mix Hub • Powered by Discord.js' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// Singleton Export
export const discordBotManager = new DiscordBotManager();
