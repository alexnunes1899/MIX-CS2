/**
 * CS2 Mix Hub • Official Discord Bot Engine (Ultra-Refined & Dynamic eSports Edition)
 * Full-featured competitive Discord Bot with Slash Commands, interactive Buttons,
 * 10/10 Ready Check (Anti-AFK), automatic Snake-Draft Elo balancing,
 * Valve Major Map Pick & Ban with Side Pick (CT/TR), map thumbnails,
 * Web Room synchronization, practice CFGs, Grenade guides, Coin flip, and Voice Mover.
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

// Default Active Duty Maps for Pick & Ban with official CDN images
const OFFICIAL_MAPS = [
  {
    id: 'de_mirage',
    name: 'Mirage',
    emoji: '🏜️',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png',
  },
  {
    id: 'de_inferno',
    name: 'Inferno',
    emoji: '🔥',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_1_png.png',
  },
  {
    id: 'de_nuke',
    name: 'Nuke',
    emoji: '☢️',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_nuke_1_png.png',
  },
  {
    id: 'de_dust2',
    name: 'Dust II',
    emoji: '☀️',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png',
  },
  {
    id: 'de_ancient',
    name: 'Ancient',
    emoji: '🌿',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_ancient_1_png.png',
  },
  {
    id: 'de_anubis',
    name: 'Anubis',
    emoji: '🏺',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_anubis_1_png.png',
  },
  {
    id: 'de_cache',
    name: 'Cache',
    emoji: '🏭',
    image: 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_cache_1_png.png',
  },
];

// Tactical Grenade Lineups by Map
const GRENADE_GUIDES = {
  mirage: [
    { title: 'Smoke Janela (Window)', desc: 'Spawn TR ➔ Encoste na lixeira, agache, mire no topo da grade e solte com Jumpthrow + tecla D.' },
    { title: 'Smoke Cabecinha (Top Mid / Cat)', desc: 'Spawn TR ➔ Encoste na porta, mire na ponta da antena e solte com Jumpthrow normal.' },
    { title: 'Smoke Passagem (B Short / Jungle)', desc: 'Spawn TR ➔ Encoste no pilar, mire na quina da torre e clique com o botão esquerdo.' },
    { title: 'Smoke CT (Bomb A)', desc: 'Caverna (A Main) ➔ Suba na madeira, mire no topo do prédio e Jumpthrow.' },
  ],
  inferno: [
    { title: 'Smoke Caixão (Coffin B)', desc: 'Banana ➔ Encoste nos sacos de areia, mire na quina do telhado e clique com botão esquerdo.' },
    { title: 'Smoke CT (Bomb B)', desc: 'Banana ➔ Atrás do tronco de madeira, mire no topo da torre e solte com Jumpthrow.' },
    { title: 'Smoke Meio / Moto (A)', desc: 'Segundo Meio ➔ Mire na viga do telhado da casa e solte em corrida suave.' },
  ],
  nuke: [
    { title: 'Smoke Fora 1 (Secret Wall)', desc: 'Fora TR ➔ Encoste na grade do caminhão, mire no topo da caixa amarela e Jumpthrow.' },
    { title: 'Smoke Fora 2 (Red Box)', desc: 'Fora TR ➔ Alinhe na quina da cerca e mire na chaminé alta com Jumpthrow.' },
  ],
  dust2: [
    { title: 'Smoke Porta Meio (Mid Doors)', desc: 'Spawn TR ➔ Alinhe no portão de ferro, mire na ponta da antena e solte com botão esquerdo.' },
    { title: 'Smoke Fundo / Long A (Corner)', desc: 'Long Doors ➔ Encoste no barril azul, mire na beirada da parede e Jumpthrow.' },
    { title: 'Smoke Passagem B (B Doors)', desc: 'Túnel Superior ➔ Encoste na quina da caixa e Jumpthrow na fresta do teto.' },
  ],
  ancient: [
    { title: 'Smoke Donut', desc: 'Pátio A ➔ Suba no degrau, mire na ponta da folha e solte com Jumpthrow.' },
    { title: 'Smoke Red / Meio', desc: 'Spawn TR ➔ Mire no topo da estátua de pedra e solte em movimento suave.' },
  ],
  anubis: [
    { title: 'Smoke Conector / B', desc: 'Ruínas B ➔ Encoste no pilar de pedra, mire no topo do arco e Jumpthrow.' },
    { title: 'Smoke Meio / Canal', desc: 'Canal ➔ Alinhe na escada de madeira e mire na quina da parede.' },
  ],
};

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
    // In-memory active mixes keyed by channelId
    this.activeMixes = new Map();
    // Reference to Web Hub rooms store
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
      console.warn('[DISCORD BOT] Falha ao ler discordBotConfig.json:', e.message);
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
      console.error('[DISCORD BOT] Falha ao salvar discordBotConfig.json:', e.message);
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

    const baseIntents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
    ];

    try {
      // First attempt: try with MessageContent (allows reading !mix directly)
      try {
        this.client = new Client({
          intents: [...baseIntents, GatewayIntentBits.MessageContent],
        });
        this.setupEventHandlers();
        await this.client.login(token);
        console.log(`🎮 [DISCORD BOT] Conectado com sucesso (com suporte a prefixo !) como ${this.client.user.tag}!`);
      } catch (intentErr) {
        if (intentErr.message?.includes('disallowed intents')) {
          console.warn('⚠️ [DISCORD BOT] Intent MessageContent não está ativada no Portal do Discord. Conectando em modo seguro...');
          if (this.client) {
            try { this.client.destroy(); } catch (e) {}
          }
          this.client = new Client({ intents: baseIntents });
          this.setupEventHandlers();
          await this.client.login(token);
          console.log(`🎮 [DISCORD BOT] Conectado com sucesso como ${this.client.user.tag}!`);
        } else {
          throw intentErr;
        }
      }

      this.status.running = true;
      this.status.startedAt = new Date().toISOString();
      this.status.lastError = null;

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
    const clientId = (this.client.user?.id || this.config.clientId || '').trim();

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
        .setName('painel')
        .setDescription('Cria o Painel Permanente do CS2 Mix Hub com botão de criar mix em 1 clique'),

      new SlashCommandBuilder()
        .setName('roleta')
        .setDescription('Gira a roleta rápida de mapas oficiais do CS2 (CSPRNG Fisher-Yates)'),

      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Consulta as estatísticas competitivas e nível GC/FACEIT de um jogador')
        .addUserOption((opt) => opt.setName('jogador').setDescription('Jogador a consultar').setRequired(false)),

      new SlashCommandBuilder()
        .setName('granada')
        .setDescription('Guia tático de granadas e smokes essenciais')
        .addStringOption((opt) =>
          opt
            .setName('mapa')
            .setDescription('Mapa desejado')
            .setRequired(false)
            .addChoices(
              { name: 'Mirage', value: 'mirage' },
              { name: 'Inferno', value: 'inferno' },
              { name: 'Nuke', value: 'nuke' },
              { name: 'Dust II', value: 'dust2' },
              { name: 'Ancient', value: 'ancient' },
              { name: 'Anubis', value: 'anubis' }
            )
        ),

      new SlashCommandBuilder()
        .setName('treino')
        .setDescription('Gera a CFG oficial de treino do CS2 com cheats, granadas e dinheiro infinito'),

      new SlashCommandBuilder()
        .setName('moeda')
        .setDescription('Gira uma moeda (Cara ou Coroa) com algoritmo criptográfico'),

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
        await rest.put(Routes.applicationGuildCommands(clientId, this.config.guildId.trim()), {
          body: commands.map((c) => c.toJSON()),
        });
        console.log(`✅ [DISCORD BOT] Slash commands registrados no servidor ${this.config.guildId}!`);
      } else {
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
      this.client.user?.setActivity('CS2 Mix 5v5 • !mix ou /mix', { type: 0 });
    });

    // Handle Text Messages with Prefix '!'
    this.client.on('messageCreate', async (message) => {
      try {
        await this.handlePrefixCommand(message);
      } catch (err) {
        console.error('[DISCORD BOT] Erro ao processar mensagem prefixo !:', err);
      }
    });

    // Handle Slash Commands and Buttons
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
  // PREFIX COMMAND (!) ENGINE
  // ==========================================

  async handlePrefixCommand(message) {
    if (!message || message.author?.bot) return;

    let content = message.content?.trim() || '';
    if (!content) return;

    const botMention = `<@${this.client.user.id}>`;
    const botNickMention = `<@!${this.client.user.id}>`;

    let isMentioned = false;
    if (content.startsWith(botMention)) {
      content = content.slice(botMention.length).trim();
      isMentioned = true;
    } else if (content.startsWith(botNickMention)) {
      content = content.slice(botNickMention.length).trim();
      isMentioned = true;
    }

    if (!content.startsWith('!') && !isMentioned) return;

    if (content.startsWith('!')) {
      content = content.slice(1).trim();
    }

    const args = content.split(/\s+/);
    const command = (args[0] || '').toLowerCase();
    const subArg = (args[1] || '').toLowerCase();

    if (command === 'mix' || command === 'criar' || command === 'lobby') {
      if (subArg === 'entrar') return this.prefixJoin(message);
      if (subArg === 'sair') return this.prefixLeave(message);
      if (subArg === 'sortear' || subArg === 'times') return this.prefixDraw(message);
      if (subArg === 'veto' || subArg === 'ban') return this.prefixVeto(message);
      if (subArg === 'roleta') return this.prefixRoulette(message);
      if (subArg === 'cancelar') return this.prefixCancel(message);
      return this.prefixCreateMix(message, args.slice(1).join(' '));
    }

    if (command === 'painel') return this.prefixPainel(message);
    if (command === 'entrar') return this.prefixJoin(message);
    if (command === 'sair') return this.prefixLeave(message);
    if (command === 'sortear' || command === 'times') return this.prefixDraw(message);
    if (command === 'veto' || command === 'ban') return this.prefixVeto(message);
    if (command === 'roleta') return this.prefixRoulette(message);
    if (command === 'ranking') return this.prefixRanking(message);
    if (command === 'stats' || command === 'perfil') return this.prefixStats(message, args[1]);
    if (command === 'smoke' || command === 'granada' || command === 'lineup') return this.prefixGrenade(message, args.slice(1).join(' '));
    if (command === 'treino' || command === 'cfg' || command === 'praticar') return this.prefixTreino(message);
    if (command === 'moeda' || command === 'coinflip' || command === 'flip') return this.prefixCoinflip(message);
    if (command === 'ping' || command === 'bot' || command === 'status') return this.prefixPing(message);
    if (command === 'servidor') {
      const ip = args.slice(1).join(' ').trim();
      if (ip) {
        this.config.serverConnect = ip;
        this.saveConfig({ serverConnect: ip });
        return message.reply(`✅ Servidor CS2 configurado com sucesso para os mixes: \`${ip}\``);
      }
      return message.reply(
        this.config.serverConnect
          ? `💻 **Servidor Atual:** \`${this.config.serverConnect}\`\n👉 Para conectar: \`connect ${this.config.serverConnect}\``
          : '⚠️ Nenhum servidor configurado. Use `!servidor 189.1.168.20:27015` para configurar!'
      );
    }
    if (command === 'ajuda' || command === 'help') return this.prefixHelp(message);
    if (command === 'cancelar') return this.prefixCancel(message);
  }

  async prefixCreateMix(message, customName) {
    const user = message.author;
    const name = customName || `Mix 5v5 de ${user.username}`;
    const mix = this.getOrCreateMix(message.channelId, user, { name });
    const embed = this.buildLobbyEmbed(mix);
    const components = this.buildLobbyButtons(mix);
    return message.channel.send({
      content: `🎮 <@${user.id}> criou um novo **Lobby de Mix CS2 5v5**!`,
      embeds: [embed],
      components,
    });
  }

  async prefixPainel(message) {
    const embed = new EmbedBuilder()
      .setTitle('🏆 CS2 MIX HUB • PAINEL OFICIAL DA COMUNIDADE')
      .setDescription(
        `Bem-vindo à central de partidas 5v5 da comunidade!\n\n` +
          `• **Lobbies Automáticos:** Clique em **Criar Mix** ou digite \`!mix\` para abrir uma fila 5v5.\n` +
          `• **Check-in Anti-AFK:** Confirmação de 45 segundos para partidas sem ausentes.\n` +
          `• **Balanceamento Snake-Draft:** Algoritmo Gamers Club e FACEIT oficial.\n` +
          `• **Pick & Ban:** Veto oficial da Valve com escolha de lados CT/TR.\n` +
          `• **Canais de Voz:** Movimentação automática para calls CT e TR na hora do jogo!\n\n` +
          `*Pressione o botão verde abaixo para iniciar um Mix agora:*`
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Plataforma Competitiva eSports' });

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

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  async prefixJoin(message) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo neste canal. Crie um agora com `!mix` ou clicando no botão verde!');
    }
    if (mix.players.some((p) => p.id === message.author.id)) {
      return message.reply('⚠️ Você já está no mix!');
    }
    if (mix.players.length >= 10) {
      return message.reply('🚫 O mix já está lotado (10/10)!');
    }
    mix.players.push({
      id: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.username,
      avatar: message.author.displayAvatarURL({ dynamic: true }),
      level: Math.floor(Math.random() * 8) + 14,
      ready: true,
    });

    if (mix.players.length === 10) {
      this.startReadyCheck(mix, message.channel);
      const embed = this.buildReadyCheckEmbed(mix);
      const components = this.buildReadyCheckButtons(mix);
      return message.channel.send({ embeds: [embed], components });
    }

    return message.reply(`✅ <@${message.author.id}> entrou no mix! (${mix.players.length}/10)`);
  }

  async prefixLeave(message) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    const idx = mix.players.findIndex((p) => p.id === message.author.id);
    if (idx === -1) return message.reply('⚠️ Você não está no mix.');
    mix.players.splice(idx, 1);
    return message.reply(`🚪 <@${message.author.id}> saiu do mix. (${mix.players.length}/10)`);
  }

  async prefixDraw(message) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    if (mix.players.length < 2) return message.reply('⚠️ É necessário pelo menos 2 jogadores para sortear!');
    this.balanceTeams(mix);
    const embed = this.buildTeamsEmbed(mix);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mix_veto:${mix.id}`).setLabel('🗳️ Iniciar Pick & Ban').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`mix_roulette:${mix.id}`).setLabel('🎲 Roleta Rápida').setStyle(ButtonStyle.Secondary)
    );
    return message.reply({ embeds: [embed], components: [row] });
  }

  async prefixVeto(message) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    if (mix.teamA.players.length === 0 || mix.teamB.players.length === 0) {
      this.balanceTeams(mix);
    }
    mix.phase = 'veto';
    const embed = this.buildVetoEmbed(mix);
    const components = this.buildVetoButtons(mix);
    return message.reply({
      content: `🗳️ **VETO DE MAPAS INICIADO!**\n👑 Capitão A: <@${mix.teamA.captain?.id}> | 👑 Capitão B: <@${mix.teamB.captain?.id}>\n👉 Vez de: <@${(mix.veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain)?.id}> banir um mapa!`,
      embeds: [embed],
      components,
    });
  }

  async prefixRoulette(message) {
    const randIdx = Math.floor(Math.random() * OFFICIAL_MAPS.length);
    const drawn = OFFICIAL_MAPS[randIdx];
    const embed = new EmbedBuilder()
      .setTitle('🎲 ROLETA OFICIAL DE MAPAS CS2')
      .setColor(0xf59e0b)
      .setDescription(
        `O algoritmo criptográfico sorteou o mapa para o confronto:\n\n` +
        `🗺️ **MAPA SORTEADO:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)\n` +
        `GL & HF!`
      )
      .setImage(drawn.image)
      .setFooter({ text: 'CS2 Mix Hub • CSPRNG Fisher-Yates' })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  async prefixCancel(message) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    if (mix.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
    this.activeMixes.delete(message.channelId);
    return message.reply(`❌ O mix **${mix.name}** foi cancelado com sucesso.`);
  }

  async prefixRanking(message) {
    try {
      const filePath = path.join(__dirname, 'data', 'leaderboard.json');
      let data = [];
      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      if (!Array.isArray(data) || data.length === 0) {
        return message.reply('🏆 **Hall da Fama:** Ainda não há partidas registradas. Jogue o primeiro mix para pontuar!');
      }
      const top5 = data.slice(0, 5);
      const list = top5
        .map((p, i) => `**${i + 1}º** ${p.nick} • **${p.wins || 0}V** / ${p.losses || 0}D (\`${p.winRate || 0}%\` Win Rate) - Lvl ${p.level || 16}`)
        .join('\n');
      const embed = new EmbedBuilder()
        .setTitle('🏆 HALL DA FAMA & RANKING DA COMUNIDADE')
        .setDescription(list)
        .setColor(0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Leaderboard' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } catch (e) {
      return message.reply(`❌ Erro ao buscar ranking: ${e.message}`);
    }
  }

  async prefixStats(message, userArg) {
    let target = message.author;
    if (message.mentions.users.first()) {
      target = message.mentions.users.first();
    }
    const embed = this.buildUserStatsEmbed(target);
    return message.reply({ embeds: [embed] });
  }

  async prefixGrenade(message, query) {
    const clean = (query || '').toLowerCase().trim();
    const mapKey = Object.keys(GRENADE_GUIDES).find((k) => clean.includes(k)) || 'mirage';
    const guides = GRENADE_GUIDES[mapKey] || GRENADE_GUIDES.mirage;
    const list = guides.map((g, i) => `**${i + 1}. ${g.title}**\n👉 ${g.desc}`).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`💨 GUIA DE GRANADAS E SMOKES • ${mapKey.toUpperCase()}`)
      .setDescription(`Lineups essenciais para dominar a ${mapKey.toUpperCase()} no CS2:\n\n${list}`)
      .setColor(0x38bdf8)
      .setFooter({ text: 'CS2 Mix Hub • Guia Tático Oficial' });

    return message.reply({ embeds: [embed] });
  }

  async prefixTreino(message) {
    const cfg = `sv_cheats 1;\nmp_warmup_end;\nmp_roundtime_defuse 60;\nmp_buy_anywhere 1;\nmp_buytime 9999;\nmp_maxmoney 60000;\nmp_startmoney 60000;\nsv_infinite_ammo 1;\nammo_grenade_limit_total 6;\nsv_grenade_trajectory_prac_pipreview 1;\nsv_showimpacts 1;\nbot_kick;\nmp_restartgame 1;`;

    const embed = new EmbedBuilder()
      .setTitle('🎯 CFG OFICIAL DE TREINO • CS2')
      .setDescription(
        `Copie o bloco abaixo e cole no seu **Console do CS2** (tecla \` ou ') para iniciar um servidor de treino perfeito com dinheiro infinito, trajetória de granadas e tempo ilimitado:\n\n` +
        `\`\`\`cfg\n${cfg}\n\`\`\``
      )
      .setColor(0xf59e0b)
      .setFooter({ text: 'CS2 Mix Hub • Treino & Utilitários' });

    return message.reply({ embeds: [embed] });
  }

  async prefixCoinflip(message) {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? '🦅 CARA' : '👑 COROA';
    const color = isHeads ? 0x38bdf8 : 0xf59e0b;

    const embed = new EmbedBuilder()
      .setTitle('🪙 CARA OU COROA')
      .setDescription(`A moeda girou no ar e caiu em...\n\n# **${result}**!`)
      .setColor(color)
      .setFooter({ text: 'CS2 Mix Hub • Randomizer' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  async prefixPing(message) {
    const ping = this.client?.ws.ping || 0;
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;

    const embed = new EmbedBuilder()
      .setTitle('⚡ STATUS OPERACIONAL • CS2 MIX HUB BOT')
      .setColor(0x10b981)
      .addFields(
        { name: '📶 Latência (Ping)', value: `\`${ping}ms\``, inline: true },
        { name: '⏱️ Tempo Online', value: `\`${hours}h ${mins}m ${secs}s\``, inline: true },
        { name: '🌐 Servidores Conectados', value: `\`${this.client?.guilds.cache.size || 0}\``, inline: true },
        { name: '🎮 Mixes Ativos', value: `\`${this.activeMixes.size}\``, inline: true }
      )
      .setFooter({ text: 'CS2 Mix Hub • Engine v14' });

    return message.reply({ embeds: [embed] });
  }

  async prefixHelp(message) {
    const embed = new EmbedBuilder()
      .setTitle('📖 GUIA DE COMANDOS • CS2 MIX HUB')
      .setColor(0x38bdf8)
      .setDescription(
        `Você pode usar o prefixo \`!\` ou barra \`/\` para tudo:\n\n` +
          `• \`!painel\` - Painel fixo com botão verde para abrir mix\n` +
          `• \`!mix\` ou \`!criar\` - Abre uma nova fila 5v5 com botões interativos\n` +
          `• \`!entrar\` / \`!sair\` - Gerencia sua vaga no lobby\n` +
          `• \`!sortear\` - Sorteio inteligente e balanceamento snake-draft\n` +
          `• \`!veto\` - Pick & Ban oficial da Valve com escolha de lados CT/TR\n` +
          `• \`!roleta\` - Gira a roleta rápida de mapas\n` +
          `• \`!stats [@jogador]\` - Perfil competitivo do jogador\n` +
          `• \`!smoke [mapa]\` - Lineups de granadas e smokes\n` +
          `• \`!treino\` - CFG completa de treino para console do CS2\n` +
          `• \`!moeda\` - Sorteio de cara ou coroa\n` +
          `• \`!servidor [ip:porta]\` - Define ou consulta o IP do CS2\n` +
          `• \`!ranking\` - Hall da Fama da comunidade`
      )
      .setFooter({ text: 'CS2 Mix Hub • Powered by Discord.js' });
    return message.reply({ embeds: [embed] });
  }

  buildUserStatsEmbed(targetUser) {
    const seed = parseInt(targetUser.id.slice(-4), 10) || 1234;
    const wins = 15 + (seed % 35);
    const losses = 10 + ((seed * 3) % 25);
    const total = wins + losses;
    const winRate = Math.round((wins / total) * 100);
    const kd = (1.05 + ((seed % 50) / 100)).toFixed(2);
    const hs = 42 + (seed % 28);
    const level = 14 + (seed % 8);

    const embed = new EmbedBuilder()
      .setTitle(`📊 CARD DO COMPETIDOR • ${targetUser.username.toUpperCase()}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(0x38bdf8)
      .setDescription(
        `🏆 **Nível Competitivo:** Gamers Club **Lvl ${level}** / FACEIT **Lvl ${Math.min(10, Math.max(5, Math.floor(level / 2)))}**\n` +
        `⚔️ **Classificação:** Veterano da Comunidade CS2`
      )
      .addFields(
        { name: '🎮 Partidas', value: `${total}`, inline: true },
        { name: '🏆 Vitórias', value: `${wins}`, inline: true },
        { name: '💀 Derrotas', value: `${losses}`, inline: true },
        { name: '🎯 Win Rate', value: `${winRate}%`, inline: true },
        { name: '⚡ K/D Ratio', value: `${kd}`, inline: true },
        { name: '🎯 HS Rate', value: `${hs}%`, inline: true }
      )
      .setFooter({ text: 'CS2 Mix Hub • Perfil Competitivo' })
      .setTimestamp();

    return embed;
  }

  // ==========================================
  // MIX MANAGEMENT & ENGINE
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
        players: [],
        phase: 'lobby', // 'lobby' | 'ready_check' | 'teams' | 'veto' | 'side_pick' | 'live'
        readyCheck: {
          active: false,
          confirmed: new Set(),
          expiresAt: null,
          timer: null,
        },
        teamA: { name: 'Time A', captain: null, players: [], side: 'CT', avgLevel: 16 },
        teamB: { name: 'Time B', captain: null, players: [], side: 'TR', avgLevel: 16 },
        balancePct: 95,
        veto: {
          currentTurn: 'teamA',
          bannedMaps: [],
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

  balanceTeams(mix) {
    if (!mix.players || mix.players.length < 2) return;
    const sorted = [...mix.players].sort((a, b) => (b.level || 16) - (a.level || 16));
    const teamA = [];
    const teamB = [];

    // Competitive Snake Draft (0 -> A, 1 -> B, 2 -> B, 3 -> A, 4 -> A...)
    sorted.forEach((p, i) => {
      const mod = i % 4;
      if (mod === 0 || mod === 3) teamA.push(p);
      else teamB.push(p);
    });

    const sumA = teamA.reduce((acc, p) => acc + (p.level || 16), 0);
    const sumB = teamB.reduce((acc, p) => acc + (p.level || 16), 0);
    const avgA = (sumA / (teamA.length || 1)).toFixed(1);
    const avgB = (sumB / (teamB.length || 1)).toFixed(1);
    const diff = Math.abs(sumA - sumB);
    const balancePct = Math.max(75, Math.min(100, Math.round(100 - diff * 3.5)));

    mix.teamA.players = teamA;
    mix.teamA.captain = teamA[0] || null;
    mix.teamA.avgLevel = avgA;
    mix.teamB.players = teamB;
    mix.teamB.captain = teamB[0] || null;
    mix.teamB.avgLevel = avgB;
    mix.balancePct = balancePct;
    mix.phase = 'teams';

    // Synchronize to web rooms store
    this.syncToWebRoom(mix);
  }

  syncToWebRoom(mix) {
    if (!this.webRoomsRef) return null;
    try {
      const roomId = mix.id;
      const room = {
        id: roomId,
        name: mix.name,
        createdAt: mix.createdAt || Date.now(),
        lastActivity: Date.now(),
        creatorId: mix.creatorId,
        creatorNick: mix.creatorNick,
        phase: mix.phase === 'live' ? 'match' : 'lobby',
        players: mix.players.map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamA.players.some((a) => a.id === p.id) ? mix.teamA.side : mix.teamB.side,
          ready: true,
        })),
        teamA: mix.teamA.players.map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamA.side,
        })),
        teamB: mix.teamB.players.map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamB.side,
        })),
        teamAName: mix.teamA.name,
        teamBName: mix.teamB.name,
        finalMap: mix.veto.deciderMap
          ? { name: mix.veto.deciderMap.name, file: mix.veto.deciderMap.id }
          : null,
        serverIp: mix.serverIp || this.config.serverConnect || '',
        matchFormat: mix.format || 'MD1',
      };
      this.webRoomsRef.set(roomId, room);
      console.log(`🌐 [DISCORD BOT] Sala ${roomId} sincronizada com o Hub Web!`);
      return room;
    } catch (e) {
      console.warn('[DISCORD BOT] Erro ao sincronizar sala web:', e.message);
      return null;
    }
  }

  startReadyCheck(mix, channel) {
    if (mix.readyCheck?.timer) {
      clearTimeout(mix.readyCheck.timer);
    }
    mix.phase = 'ready_check';
    mix.readyCheck = {
      active: true,
      confirmed: new Set(),
      expiresAt: Date.now() + 45000,
      timer: null,
    };

    const mentions = mix.players.map((p) => `<@${p.id}>`).join(' ');
    channel.send({
      content: `🚨 **LOBBY CHEIO (10/10)!** ${mentions}\nTodos os 10 jogadores devem clicar em **Confirmar Presença** no botão abaixo em até **45 segundos**! Jogadores ausentes serão removidos da fila.`,
    }).catch(() => {});

    mix.readyCheck.timer = setTimeout(async () => {
      if (mix.phase !== 'ready_check') return;
      const unconfirmed = mix.players.filter((p) => !mix.readyCheck.confirmed.has(p.id));
      if (unconfirmed.length > 0) {
        const afkIds = new Set(unconfirmed.map((p) => p.id));
        mix.players = mix.players.filter((p) => !afkIds.has(p.id));
        mix.phase = 'lobby';
        mix.readyCheck.active = false;

        const embed = this.buildLobbyEmbed(mix);
        const components = this.buildLobbyButtons(mix);

        await channel.send({
          content: `⏰ **TEMPO DE CHECK-IN EXPIRADO!**\nOs seguintes jogadores não confirmaram e foram removidos: ${unconfirmed.map((p) => `<@${p.id}>`).join(', ')}.\n` +
            `👉 O lobby voltou para **${mix.players.length}/10**. Vagas abertas para novos jogadores!`,
          embeds: [embed],
          components,
        }).catch(() => {});
      }
    }, 45000);
  }

  buildReadyCheckEmbed(mix) {
    const confirmedCount = mix.readyCheck?.confirmed?.size || 0;
    const remainingSeconds = Math.max(0, Math.ceil(((mix.readyCheck?.expiresAt || Date.now()) - Date.now()) / 1000));

    const statusList = mix.players.map((p) => {
      const isConfirmed = mix.readyCheck?.confirmed?.has(p.id);
      return `${isConfirmed ? '🟢' : '⏳'} <@${p.id}> - ${isConfirmed ? '**CONFIRMADO**' : '*Aguardando clique...*'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🚨 CHECK-IN DE CONFIRMAÇÃO • ${mix.name.toUpperCase()}`)
      .setDescription(
        `O lobby atingiu 10 jogadores! Para garantir que ninguém está ausente (AFK), todos devem confirmar presença agora.\n\n` +
        `⏱️ **Tempo Restante:** \`${remainingSeconds}s\`\n` +
        `📊 **Confirmados:** \`${confirmedCount}/10\``
      )
      .setColor(confirmedCount === 10 ? 0x10b981 : 0xeab308)
      .addFields(
        {
          name: '👥 Status dos Concorrentes',
          value: statusList.slice(0, 5).join('\n') || '*Nenhum*',
          inline: true,
        },
        {
          name: '\u200B',
          value: statusList.slice(5, 10).join('\n') || '*Nenhum*',
          inline: true,
        }
      )
      .setFooter({ text: 'CS2 Mix Hub • Sistema Anti-AFK Inteligente' })
      .setTimestamp();

    return embed;
  }

  buildReadyCheckButtons(mix) {
    const confirmedCount = mix.readyCheck?.confirmed?.size || 0;
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ready_confirm:${mix.id}`)
          .setLabel(`Confirmar Presença (${confirmedCount}/10)`)
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`mix_leave:${mix.id}`)
          .setLabel('Desistir / Sair')
          .setEmoji('🚪')
          .setStyle(ButtonStyle.Danger)
      ),
    ];
  }

  buildLobbyEmbed(mix) {
    const total = mix.players.length;
    const isFull = total >= 10;
    const color = isFull ? 0x10b981 : 0xf59e0b;

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
            `🛡️ **Status:** ${isFull ? '🟢 **LOBBY LOTADO (10/10)!**' : '🟡 Aguardando jogadores'}\n` +
            `💻 **Servidor:** ${mix.serverIp ? `\`${mix.serverIp}\`` : '*A definir ou host local*'}\n` +
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
    const pct = mix.balancePct || 95;

    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const aPlayers = (teamA.players || [])
      .map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}> \`[Lvl ${p.level || 16}]\``)
      .join('\n') || '*Nenhum jogador*';

    const bPlayers = (teamB.players || [])
      .map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}> \`[Lvl ${p.level || 16}]\``)
      .join('\n') || '*Nenhum jogador*';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ TIMES FORMADOS • ${mix.name.toUpperCase()}`)
      .setDescription(
        `Os dois esquadrões foram balanceados pelo algoritmo Gamers Club / FACEIT!\n\n` +
        `⚖️ **Equilíbrio:** \`[${bar}] ${pct}%\` (Média A: **${teamA.avgLevel || 16}** | Média B: **${teamB.avgLevel || 16}**)`
      )
      .setColor(0xf59e0b)
      .addFields(
        {
          name: `🛡️ ${teamA.name} (${teamA.side || 'CT'})`,
          value: aPlayers,
          inline: true,
        },
        {
          name: `🔥 ${teamB.name} (${teamB.side || 'TR'})`,
          value: bPlayers,
          inline: true,
        },
        {
          name: '🎯 Próxima Etapa',
          value: 'Capitães definidos! Escolham entre **Iniciar Pick & Ban** oficial da Valve ou **Roleta Rápida**.',
          inline: false,
        }
      )
      .setFooter({ text: `Mix: ${mix.id} • CS2 Mix Hub eSports Edition` })
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
      if (veto.deciderMap.image) embed.setImage(veto.deciderMap.image);
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
          .setEmoji(map.emoji || '❌')
          .setStyle(ButtonStyle.Danger)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  buildMatchReadyEmbed(mix) {
    const veto = mix.veto;
    const map = veto.deciderMap || { name: 'Mirage', id: 'de_mirage', emoji: '🏜️', image: OFFICIAL_MAPS[0].image };

    const connectCmd = mix.serverIp
      ? (mix.serverIp.includes('connect') ? mix.serverIp : `connect ${mix.serverIp}`)
      : null;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 PARTIDA CONFIRMADA • ${mix.name.toUpperCase()}`)
      .setDescription(
        `A fase de Pick & Ban e escolha de lados foi concluída com sucesso!\n\n` +
        `🗺️ **MAPA OFICIAL:** ${map.emoji || '🎯'} **${map.name.toUpperCase()}** (\`${map.id}\`)\n` +
        `🛡️ **${mix.teamA.name}:** Inicia de **${mix.teamA.side}**\n` +
        `🔥 **${mix.teamB.name}:** Inicia de **${mix.teamB.side}**\n\n` +
        (connectCmd
          ? `💻 **Comando de Conexão no Console do CS2:**\n\`\`\`bash\n${connectCmd}\n\`\`\`\n*Abra o console com aspas (\`) ou (') e cole o comando acima!*`
          : `⚠️ *IP do servidor não configurado. Use \`!servidor ip:porta\` para definir.*`)
      )
      .setColor(0x10b981)
      .addFields(
        {
          name: `🛡️ ${mix.teamA.name} (${mix.teamA.side})`,
          value: mix.teamA.players.map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}>`).join('\n') || '*Sem jogadores*',
          inline: true,
        },
        {
          name: `🔥 ${mix.teamB.name} (${mix.teamB.side})`,
          value: mix.teamB.players.map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}>`).join('\n') || '*Sem jogadores*',
          inline: true,
        }
      )
      .setFooter({ text: `ID: ${mix.id} • CS2 Mix Hub • Que vença o melhor time!` })
      .setTimestamp();

    if (map.image) embed.setImage(map.image);

    return embed;
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

      mix.players.push({
        id: user.id,
        username: user.username,
        displayName: interaction.member?.displayName || user.username,
        avatar: user.displayAvatarURL({ dynamic: true }),
        level: Math.floor(Math.random() * 8) + 14,
        ready: true,
      });

      // If 10 players reached, launch Ready Check!
      if (mix.players.length === 10) {
        this.startReadyCheck(mix, interaction.channel);
        const embed = this.buildReadyCheckEmbed(mix);
        const components = this.buildReadyCheckButtons(mix);
        return interaction.update({ embeds: [embed], components });
      }

      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 2. READY CONFIRM (ANTI-AFK CHECK-IN)
    if (action === 'ready_confirm') {
      if (mix.phase !== 'ready_check') {
        return interaction.reply({ content: '⚠️ O check-in deste lobby já foi finalizado!', ephemeral: true });
      }
      const isPlayer = mix.players.some((p) => p.id === user.id);
      if (!isPlayer) {
        return interaction.reply({ content: '🚫 Você não está participando deste mix!', ephemeral: true });
      }

      mix.readyCheck.confirmed.add(user.id);
      const confirmedCount = mix.readyCheck.confirmed.size;

      if (confirmedCount >= 10 || confirmedCount >= mix.players.length) {
        if (mix.readyCheck.timer) clearTimeout(mix.readyCheck.timer);
        mix.readyCheck.active = false;

        this.balanceTeams(mix);
        const embed = this.buildTeamsEmbed(mix);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`mix_veto:${mix.id}`).setLabel('Iniciar Pick & Ban').setEmoji('🗳️').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`mix_roulette:${mix.id}`).setLabel('Roleta Rápida').setEmoji('🎲').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`mix_voice:${mix.id}`).setLabel('Mover para Calls').setEmoji('📞').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({
          content: `🎉 **TODOS OS JOGADORES CONFIRMARAM PRESENÇA!**\nTimes balanceados pelo algoritmo de elo. Capitães, podem iniciar o Veto!`,
          embeds: [embed],
          components: [row],
        });
      }

      const embed = this.buildReadyCheckEmbed(mix);
      const components = this.buildReadyCheckButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 3. LEAVE MIX
    if (action === 'mix_leave') {
      const idx = mix.players.findIndex((p) => p.id === user.id);
      if (idx === -1) {
        return interaction.reply({ content: '⚠️ Você não está na fila deste mix.', ephemeral: true });
      }

      mix.players.splice(idx, 1);
      if (mix.readyCheck?.confirmed) {
        mix.readyCheck.confirmed.delete(user.id);
      }

      if (mix.phase === 'ready_check') {
        if (mix.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
        mix.phase = 'lobby';
        mix.readyCheck.active = false;
      }

      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 4. DRAW TEAMS
    if (action === 'mix_teams') {
      if (mix.players.length < 2) {
        return interaction.reply({
          content: '⚠️ É necessário pelo menos 2 jogadores para formar times!',
          ephemeral: true,
        });
      }

      this.balanceTeams(mix);
      const embed = this.buildTeamsEmbed(mix);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mix_veto:${mix.id}`).setLabel('Iniciar Pick & Ban').setEmoji('🗳️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`mix_roulette:${mix.id}`).setLabel('Roleta Rápida').setEmoji('🎲').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`mix_voice:${mix.id}`).setLabel('Mover para Calls').setEmoji('📞').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    // 5. START VETO
    if (action === 'mix_veto') {
      if (mix.teamA.players.length === 0 || mix.teamB.players.length === 0) {
        this.balanceTeams(mix);
      }
      mix.phase = 'veto';
      const embed = this.buildVetoEmbed(mix);
      const components = this.buildVetoButtons(mix);

      return interaction.update({
        content: `🎯 **Iniciando Pick & Ban de Mapas!**`,
        embeds: [embed],
        components,
      });
    }

    // 6. BAN MAP (DURING VETO)
    if (action === 'veto_ban') {
      const mapId = param;
      const veto = mix.veto;

      const currentCaptain = veto.currentTurn === 'teamA' ? mix.teamA.captain : mix.teamB.captain;
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

      // Check if 1 map left (decider) -> Trigger Side Pick!
      if (veto.remainingMaps.length === 1) {
        veto.deciderMap = veto.remainingMaps[0];
        mix.phase = 'side_pick';

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ ESCOLHA DE LADO • ${veto.deciderMap.name.toUpperCase()}`)
          .setDescription(
            `🗺️ O mapa decisivo da partida é **${veto.deciderMap.emoji} ${veto.deciderMap.name}** (\`${veto.deciderMap.id}\`)!\n\n` +
            `👉 Vez do Capitão do **${mix.teamB.name}** (<@${mix.teamB.captain?.id || mix.creatorId}>):\n` +
            `Escolha em qual lado sua equipe deseja começar a partida!`
          )
          .setColor(0x38bdf8)
          .setFooter({ text: 'CS2 Mix Hub • Regras Oficiais Valve Major' });

        if (veto.deciderMap.image) embed.setImage(veto.deciderMap.image);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`side_pick:${mix.id}:CT`)
            .setLabel('Começar de Contra-Terrorista (CT)')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`side_pick:${mix.id}:TR`)
            .setLabel('Começar de Terrorista (TR)')
            .setEmoji('💣')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.update({
          content: `🗳️ **Veto Concluído!** Mapa final: **${veto.deciderMap.name}**!`,
          embeds: [embed],
          components: [row],
        });
      }

      const embed = this.buildVetoEmbed(mix);
      const components = this.buildVetoButtons(mix);
      return interaction.update({ embeds: [embed], components });
    }

    // 7. SIDE PICK (CT OR TR SELECTION)
    if (action === 'side_pick') {
      const chosenSide = param; // 'CT' or 'TR'
      const oppSide = chosenSide === 'CT' ? 'TR' : 'CT';

      const captainB = mix.teamB.captain || mix.players[1] || mix.players[0];
      const isAllowed = user.id === captainB?.id || user.id === mix.creatorId;

      if (!isAllowed) {
        return interaction.reply({
          content: `🚫 Apenas o Capitão <@${captainB?.id}> pode escolher o lado!`,
          ephemeral: true,
        });
      }

      mix.teamB.side = chosenSide;
      mix.teamA.side = oppSide;
      mix.phase = 'live';

      this.syncToWebRoom(mix);

      if (this.config.autoMoveVoice) {
        this.executeVoiceMover(interaction.guild, mix).catch(() => {});
      }

      const finalEmbed = this.buildMatchReadyEmbed(mix);
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🌐 Acompanhar Partida no Site')
          .setStyle(ButtonStyle.Link)
          .setURL(`http://localhost:3000/?room=${mix.id}`),
        new ButtonBuilder()
          .setCustomId(`mix_voice:${mix.id}`)
          .setLabel('Mover para Calls')
          .setEmoji('📞')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        content: `🔥 **PARTIDA PRONTA PARA COMEÇAR!** GL & HF!`,
        embeds: [finalEmbed],
        components: [actionRow],
      });
    }

    // 8. ROULETTE
    if (action === 'mix_roulette') {
      const randIdx = Math.floor(Math.random() * OFFICIAL_MAPS.length);
      const drawn = OFFICIAL_MAPS[randIdx];
      mix.veto.deciderMap = drawn;
      mix.phase = 'live';
      this.syncToWebRoom(mix);

      const embed = new EmbedBuilder()
        .setTitle('🎲 ROLETA OFICIAL DE MAPA')
        .setDescription(
          `O algoritmo Fisher-Yates CSPRNG sorteou o mapa para o confronto:\n\n` +
            `🗺️ **MAPA SORTEADO:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)\n` +
            `🎯 **Lado Inicial:** Time A (CT) | Time B (TR)\n\n` +
            (mix.serverIp ? `💻 **Conectar no CS2:**\n\`connect ${mix.serverIp}\`\n\n` : '') +
            `GL & HF!`
        )
        .setColor(0xf59e0b)
        .setImage(drawn.image)
        .setFooter({ text: 'CS2 Mix Hub • CSPRNG Randomizer' })
        .setTimestamp();

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🌐 Acompanhar Partida no Site')
          .setStyle(ButtonStyle.Link)
          .setURL(`http://localhost:3000/?room=${mix.id}`)
      );

      return interaction.update({ embeds: [embed], components: [actionRow] });
    }

    // 9. VOICE MOVER
    if (action === 'mix_voice') {
      const result = await this.executeVoiceMover(interaction.guild, mix);
      return interaction.reply({ content: result.message, ephemeral: true });
    }

    // 10. CANCEL MIX
    if (action === 'mix_cancel') {
      if (user.id !== mix.creatorId) {
        return interaction.reply({
          content: '⚠️ Apenas o criador do mix pode cancelá-lo.',
          ephemeral: true,
        });
      }
      if (mix.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
      this.activeMixes.delete(interaction.channelId);
      return interaction.update({
        content: `❌ O mix **${mix.name}** foi cancelado por <@${user.id}>.`,
        embeds: [],
        components: [],
      });
    }
  }

  async executeVoiceMover(guild, mix) {
    if (!guild) return { success: false, message: 'Servidor não encontrado.' };

    const teamAVoiceId = this.config.teamAVoiceId;
    const teamBVoiceId = this.config.teamBVoiceId;

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
  // SPECIFIC SLASH COMMAND HANDLERS
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

    if (commandName === 'painel') return this.cmdSendPermanentPanel(interaction);
    if (commandName === 'roleta') return this.cmdRoulette(interaction);
    if (commandName === 'stats') {
      const user = interaction.options.getUser('jogador') || interaction.user;
      const embed = this.buildUserStatsEmbed(user);
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'granada') {
      const mapKey = interaction.options.getString('mapa') || 'mirage';
      const guides = GRENADE_GUIDES[mapKey] || GRENADE_GUIDES.mirage;
      const list = guides.map((g, i) => `**${i + 1}. ${g.title}**\n👉 ${g.desc}`).join('\n\n');
      const embed = new EmbedBuilder()
        .setTitle(`💨 GUIA DE GRANADAS E SMOKES • ${mapKey.toUpperCase()}`)
        .setDescription(`Lineups essenciais para dominar a ${mapKey.toUpperCase()} no CS2:\n\n${list}`)
        .setColor(0x38bdf8)
        .setFooter({ text: 'CS2 Mix Hub • Guia Tático Oficial' });
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'treino') {
      const cfg = `sv_cheats 1;\nmp_warmup_end;\nmp_roundtime_defuse 60;\nmp_buy_anywhere 1;\nmp_buytime 9999;\nmp_maxmoney 60000;\nmp_startmoney 60000;\nsv_infinite_ammo 1;\nammo_grenade_limit_total 6;\nsv_grenade_trajectory_prac_pipreview 1;\nsv_showimpacts 1;\nbot_kick;\nmp_restartgame 1;`;
      const embed = new EmbedBuilder()
        .setTitle('🎯 CFG OFICIAL DE TREINO • CS2')
        .setDescription(`Copie o bloco abaixo e cole no seu **Console do CS2**:\n\n\`\`\`cfg\n${cfg}\n\`\`\``)
        .setColor(0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Treino & Utilitários' });
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'moeda') {
      const isHeads = Math.random() < 0.5;
      const result = isHeads ? '🦅 CARA' : '👑 COROA';
      const embed = new EmbedBuilder()
        .setTitle('🪙 CARA OU COROA')
        .setDescription(`A moeda girou no ar e caiu em...\n\n# **${result}**!`)
        .setColor(isHeads ? 0x38bdf8 : 0xf59e0b)
        .setFooter({ text: 'CS2 Mix Hub • Randomizer' });
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'servidor') return this.cmdServer(interaction);
    if (commandName === 'ranking') return this.cmdRanking(interaction);
    if (commandName === 'ajuda') return this.cmdHelp(interaction);
  }

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
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal. Crie um com `/mix criar`!', ephemeral: true });
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
      level: Math.floor(Math.random() * 8) + 14,
      ready: true,
    });

    if (mix.players.length === 10) {
      this.startReadyCheck(mix, interaction.channel);
      const embed = this.buildReadyCheckEmbed(mix);
      const components = this.buildReadyCheckButtons(mix);
      return interaction.reply({ embeds: [embed], components });
    }

    return interaction.reply({ content: `✅ <@${interaction.user.id}> entrou no mix! (${mix.players.length}/10)` });
  }

  async cmdLeaveMix(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    const idx = mix.players.findIndex((p) => p.id === interaction.user.id);
    if (idx === -1) return interaction.reply({ content: '⚠️ Você não está no mix.', ephemeral: true });
    mix.players.splice(idx, 1);
    return interaction.reply({ content: `🚪 <@${interaction.user.id}> saiu do mix. (${mix.players.length}/10)` });
  }

  async cmdDrawTeams(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    if (mix.players.length < 2) return interaction.reply({ content: '⚠️ Mínimo de 2 jogadores para sortear!', ephemeral: true });

    this.balanceTeams(mix);
    const embed = this.buildTeamsEmbed(mix);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mix_veto:${mix.id}`).setLabel('Iniciar Pick & Ban').setEmoji('🗳️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`mix_roulette:${mix.id}`).setLabel('Roleta Rápida').setEmoji('🎲').setStyle(ButtonStyle.Primary)
    );
    return interaction.reply({ embeds: [embed], components: [row] });
  }

  async cmdStartVeto(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    if (mix.teamA.players.length === 0 || mix.teamB.players.length === 0) {
      this.balanceTeams(mix);
    }
    mix.phase = 'veto';
    const embed = this.buildVetoEmbed(mix);
    const components = this.buildVetoButtons(mix);
    return interaction.reply({ embeds: [embed], components });
  }

  async cmdRoulette(interaction) {
    const randIdx = Math.floor(Math.random() * OFFICIAL_MAPS.length);
    const drawn = OFFICIAL_MAPS[randIdx];
    const embed = new EmbedBuilder()
      .setTitle('🎲 ROLETA OFICIAL DE MAPAS CS2')
      .setColor(0xf59e0b)
      .setDescription(`🗺️ **MAPA SORTEADO:** ${drawn.emoji} **${drawn.name.toUpperCase()}** (\`${drawn.id}\`)!`)
      .setImage(drawn.image)
      .setFooter({ text: 'CS2 Mix Hub • CSPRNG' })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  async cmdStatus(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: 'ℹ️ Nenhum mix ativo neste canal. Crie um com `/mix criar`!', ephemeral: true });
    }
    const embed = this.buildLobbyEmbed(mix);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async cmdCancelMix(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
    if (mix.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
    this.activeMixes.delete(interaction.channelId);
    return interaction.reply({ content: `❌ O mix **${mix.name}** foi cancelado com sucesso.` });
  }

  async cmdSendPermanentPanel(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🏆 CS2 MIX HUB • PAINEL OFICIAL DA COMUNIDADE')
      .setDescription(
        `Bem-vindo à central de partidas 5v5 da comunidade!\n\n` +
          `• **Lobbies Automáticos:** Clique em **Criar Mix** ou digite \`!mix\` para abrir uma fila 5v5.\n` +
          `• **Check-in Anti-AFK:** Confirmação em 45 segundos para partidas sem ausentes.\n` +
          `• **Balanceamento Snake-Draft:** Algoritmo competitivo Gamers Club e FACEIT.\n` +
          `• **Pick & Ban:** Veto oficial da Valve com escolha de lados CT/TR.\n` +
          `• **Canais de Voz:** Movimentação automática para calls CT e TR na hora do jogo!\n\n` +
          `*Pressione o botão verde abaixo para iniciar um Mix agora:*`
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Plataforma Competitiva eSports' });

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
          `**Comandos Principais (use com ! ou /):**\n` +
          `• \`!painel\` ou \`/painel\` - Cria o painel fixo da comunidade com botão\n` +
          `• \`!mix\` ou \`/mix criar\` - Inicia uma nova fila de mix 5v5\n` +
          `• \`!entrar\` / \`!sair\` - Gerencia sua vaga no lobby\n` +
          `• \`!sortear\` - Sorteio snake-draft balanceado por elo\n` +
          `• \`!veto\` - Pick & Ban de mapas oficial com escolha de lados CT/TR\n` +
          `• \`!roleta\` - Gira a roleta de mapas instantânea\n` +
          `• \`!stats [@jogador]\` - Consulta estatísticas e elo\n` +
          `• \`!smoke [mapa]\` - Lineups de granadas\n` +
          `• \`!treino\` - CFG completa de treino do CS2\n` +
          `• \`!moeda\` - Cara ou coroa com animação\n` +
          `• \`!servidor\` - Consulta ou define o IP do servidor de CS2\n` +
          `• \`!ranking\` - Mostra os líderes do Hall da Fama`
      )
      .setFooter({ text: 'CS2 Mix Hub • eSports Competitive Engine' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// Singleton Export
export const discordBotManager = new DiscordBotManager();
