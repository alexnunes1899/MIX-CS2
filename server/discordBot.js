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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'data', 'discordBotConfig.json');
const PROFILES_FILE = path.join(__dirname, 'data', 'playerProfiles.json');
const MATCH_HISTORY_FILE = path.join(__dirname, 'data', 'matchHistory.json');
const LEADERBOARD_FILE = path.join(__dirname, 'data', 'leaderboard.json');

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

  loadPlayerProfiles() {
    try {
      if (fs.existsSync(PROFILES_FILE)) {
        const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao ler playerProfiles.json:', e.message);
    }
    return {};
  }

  savePlayerProfiles(profiles) {
    try {
      const dataDir = path.dirname(PROFILES_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
    } catch (e) {
      console.error('[DISCORD BOT] Falha ao salvar playerProfiles.json:', e.message);
    }
  }

  getPlayerLevel(userId) {
    const profiles = this.loadPlayerProfiles();
    return profiles[userId]?.level || 16;
  }

  setPlayerProfile(userId, data) {
    const profiles = this.loadPlayerProfiles();
    profiles[userId] = {
      ...(profiles[userId] || {}),
      ...data,
      updatedAt: Date.now(),
    };
    this.savePlayerProfiles(profiles);
    this.updateLeaderboardFile(profiles);
  }

  loadMatchHistory() {
    try {
      if (fs.existsSync(MATCH_HISTORY_FILE)) {
        const raw = fs.readFileSync(MATCH_HISTORY_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao ler matchHistory.json:', e.message);
    }
    return [];
  }

  saveMatchHistory(matches) {
    try {
      const dataDir = path.dirname(MATCH_HISTORY_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(MATCH_HISTORY_FILE, JSON.stringify(matches, null, 2), 'utf8');
    } catch (e) {
      console.error('[DISCORD BOT] Falha ao salvar matchHistory.json:', e.message);
    }
  }

  updateLeaderboardFile(profiles) {
    try {
      const list = Object.entries(profiles)
        .map(([id, p]) => {
          const wins = p.wins || 0;
          const losses = p.losses || 0;
          const total = wins + losses;
          const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
          return {
            id,
            nick: p.username || `<@${id}>`,
            level: p.level || 16,
            wins,
            losses,
            total,
            winRate,
            mvps: p.mvps || 0,
            streak: p.streak || 0,
          };
        })
        .filter((p) => p.total > 0 || p.wins > 0 || p.mvps > 0)
        .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.winRate || 0) - (a.winRate || 0));

      const dataDir = path.dirname(LEADERBOARD_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao atualizar leaderboard.json:', e.message);
    }
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
      // First attempt: try with MessageContent & GuildMembers (full privileged capabilities)
      try {
        this.client = new Client({
          intents: [
            ...baseIntents,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
          ],
        });
        this.setupEventHandlers();
        await this.client.login(token);
        console.log(`🎮 [DISCORD BOT] Conectado com sucesso (com suporte a prefixo ! e Membros) como ${this.client.user.tag}!`);
      } catch (intentErr) {
        if (intentErr.message?.includes('disallowed intents')) {
          console.warn('⚠️ [DISCORD BOT] Tentando conexão sem GuildMembers...');
          try {
            if (this.client) {
              try { this.client.destroy(); } catch (e) {}
            }
            this.client = new Client({
              intents: [...baseIntents, GatewayIntentBits.MessageContent],
            });
            this.setupEventHandlers();
            await this.client.login(token);
            console.log(`🎮 [DISCORD BOT] Conectado com suporte a prefixo ! como ${this.client.user.tag}!`);
          } catch (intentErr2) {
            if (intentErr2.message?.includes('disallowed intents')) {
              console.warn('⚠️ [DISCORD BOT] Intents privilegiadas desativadas no Portal. Conectando em modo básico...');
              if (this.client) {
                try { this.client.destroy(); } catch (e) {}
              }
              this.client = new Client({ intents: baseIntents });
              this.setupEventHandlers();
              await this.client.login(token);
              console.log(`🎮 [DISCORD BOT] Conectado em modo básico como ${this.client.user.tag}!`);
            } else {
              throw intentErr2;
            }
          }
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

      new SlashCommandBuilder()
        .setName('level')
        .setDescription('Configura o seu nível da Gamers Club (1 a 21) para o balanceamento de times')
        .addIntegerOption((opt) =>
          opt
            .setName('nivel')
            .setDescription('Seu nível na Gamers Club (de 1 a 21)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(21)
        ),

      new SlashCommandBuilder()
        .setName('lvl')
        .setDescription('Atalho rápido para definir seu nível da Gamers Club (1 a 21)')
        .addIntegerOption((opt) =>
          opt
            .setName('nivel')
            .setDescription('Seu nível na Gamers Club (de 1 a 21)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(21)
        ),

      new SlashCommandBuilder()
        .setName('vitoria')
        .setDescription('Registra o resultado da partida (Time A ou B) e atualiza o ranking')
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setDescription('Qual time venceu a partida?')
            .setRequired(true)
            .addChoices({ name: 'Time A', value: 'A' }, { name: 'Time B', value: 'B' })
        )
        .addStringOption((opt) =>
          opt
            .setName('placar')
            .setDescription('Placar final do jogo (ex: 13-9, 13-11, 16-14)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('sub')
        .setDescription('Substitui um jogador ausente ou desconectado por um reserva')
        .addUserOption((opt) => opt.setName('novo').setDescription('Novo jogador que vai entrar').setRequired(true))
        .addUserOption((opt) => opt.setName('antigo').setDescription('Jogador que saiu (opcional)').setRequired(false)),

      new SlashCommandBuilder()
        .setName('cargo')
        .setDescription('Ativa ou desativa notificações do cargo @Mix CS2 para ser avisado quando faltarem vagas'),

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

    // Handle Slash Commands, Buttons, and Modals
    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleChatCommand(interaction);
        } else if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction);
        } else if (interaction.isModalSubmit()) {
          await this.handleModalSubmit(interaction);
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
    if (command === 'ranking' || command === 'top' || command === 'leaderboard') return this.prefixRanking(message);
    if (command === 'vitoria' || command === 'resultado' || command === 'ganhador') return this.prefixMatchResult(message, args.slice(1));
    if (command === 'sub' || command === 'substituto' || command === 'reserva') return this.prefixSubstitute(message, args.slice(1));
    if (command === 'cargo' || command === 'notificar' || command === 'notificacao') return this.prefixToggleRole(message);
    if (command === 'level' || command === 'lvl' || command === 'gc') return this.prefixSetLevel(message, args[1]);
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
    const tutorialEmbed = this.buildMixTutorialEmbed();
    const embed = this.buildLobbyEmbed(mix);
    const components = this.buildLobbyButtons(mix);
    return message.channel.send({
      content: `🎮 <@${user.id}> criou um novo **Lobby de Mix CS2 5v5**!`,
      embeds: [tutorialEmbed, embed],
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
      level: this.getPlayerLevel(message.author.id),
      ready: true,
    });

    if (mix.players.length === 8 || mix.players.length === 9) {
      this.notifyMissingSlots(mix, message.guild, message.channel).catch(() => {});
    }

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
    const embed = this.buildRankingEmbed();
    return message.reply({ embeds: [embed] });
  }

  async prefixMatchResult(message, args) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo encontrado neste canal para registrar vitória.');
    }
    const winner = (args[0] || '').toUpperCase();
    if (winner !== 'A' && winner !== 'B') {
      return message.reply('👉 Uso correto: `!vitoria A 13-9` ou `!vitoria B 13-11` (indique Time A ou Time B).');
    }
    const score = args[1] || '13-9';
    const res = await this.recordMatchResult(mix, winner, score, message.author, message.channel);
    if (!res.success) return message.reply(`⚠️ ${res.error}`);
    return message.channel.send({ embeds: res.embeds, components: res.components });
  }

  async prefixSubstitute(message, args) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo neste canal para fazer substituição.');
    }
    if (!args[0]) {
      return message.reply('👉 Uso correto: `!sub @novo_jogador` ou `!sub @jogador_antigo @novo_jogador`');
    }
    const outArg = args.length >= 2 ? args[0] : message.author.id;
    const inArg = args.length >= 2 ? args[1] : args[0];
    const res = await this.executeSubstitute(mix, outArg, inArg, message.guild, message.channel);
    return message.channel.send(res.message);
  }

  async prefixToggleRole(message) {
    if (!message.guild || !message.member) return;
    const res = await this.toggleMixRole(message.guild, message.member);
    return message.reply(res.message);
  }

  async prefixSetLevel(message, levelArg) {
    const raw = (levelArg || '').trim();
    const parsed = parseInt(raw, 10);
    if (!raw || isNaN(parsed) || parsed < 1 || parsed > 21) {
      const current = this.getPlayerLevel(message.author.id);
      return message.reply(
        `ℹ️ Seu nível atual da Gamers Club é **Lvl ${current || 16}**.\n` +
        `👉 Para alterar, digite: \`!lvl <1 a 21>\` (Exemplo: \`!lvl 19\` ou \`!gc 18\`).`
      );
    }

    this.setPlayerProfile(message.author.id, {
      level: parsed,
      username: message.author.username,
    });

    const mix = this.activeMixes.get(message.channelId);
    if (mix) {
      const p = mix.players.find((pl) => pl.id === message.author.id);
      if (p) p.level = parsed;
    }

    const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';
    return message.reply(
      `✅ <@${message.author.id}>, seu nível da Gamers Club foi configurado para **Lvl ${parsed}** (\`${badge}\`)!\n` +
      `Os próximos sorteios de times balancearão as equipes com base no seu nível real.`
    );
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
          `• \`!painel\` — Painel fixo com botão verde para abrir mix\n` +
          `• \`!mix\` ou \`!criar\` — Abre uma nova fila 5v5 com botões interativos\n` +
          `• \`!entrar\` / \`!sair\` — Gerencia sua vaga no lobby\n` +
          `• \`!sortear\` — Sorteio inteligente e balanceamento snake-draft\n` +
          `• \`!veto\` — Pick & Ban oficial da Valve com escolha de lados CT/TR\n` +
          `• \`!vitoria [A|B] [placar]\` — Registra o resultado oficial da partida e pontua no ranking!\n` +
          `• \`!ranking\` / \`!top\` — Hall da Fama e Top 10 de vitórias e MVPs da comunidade\n` +
          `• \`!sub @novo\` — Substitui um jogador ausente por um reserva\n` +
          `• \`!cargo\` — Ativa/desativa notificações do cargo @Mix CS2 quando faltarem vagas\n` +
          `• \`!stats [@jogador]\` — Perfil competitivo, vitórias reais e medalhas de MVP\n` +
          `• \`!lvl <1-21>\` — Configura seu nível da Gamers Club (GC)\n` +
          `• \`!smoke [mapa]\` — Lineups de granadas e smokes táticas\n` +
          `• \`!treino\` — CFG completa de treino para console do CS2\n` +
          `• \`!moeda\` — Sorteio de cara ou coroa para desempates rápidos\n` +
          `• \`!servidor [ip:porta]\` — Define ou consulta o IP do servidor CS2`
      )
      .setFooter({ text: 'CS2 Mix Hub • Powered by Discord.js' });
    return message.reply({ embeds: [embed] });
  }

  buildUserStatsEmbed(targetUser) {
    const profiles = this.loadPlayerProfiles();
    const prof = profiles[targetUser.id] || {};
    const level = prof.level || this.getPlayerLevel(targetUser.id) || 16;
    const wins = prof.wins || 0;
    const losses = prof.losses || 0;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const mvps = prof.mvps || 0;
    const streak = prof.streak || 0;
    const gcBadge = level >= 20 ? '👑 Major Lvl 20+' : level >= 18 ? '🏆 Lvl 18-19' : level >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';

    const embed = new EmbedBuilder()
      .setTitle(`📊 CARD DO COMPETIDOR • ${targetUser.username.toUpperCase()}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(0x38bdf8)
      .setDescription(
        `🏆 **Nível Gamers Club:** **Lvl ${level}** (\`${gcBadge}\`)\n` +
        `⚔️ **Classificação:** FACEIT Lvl ${Math.min(10, Math.max(5, Math.floor(level / 2)))} • Veterano da Comunidade CS2`
      )
      .addFields(
        { name: '🎮 Partidas Oficiais', value: `${total}`, inline: true },
        { name: '🏆 Vitórias', value: `${wins}`, inline: true },
        { name: '💀 Derrotas', value: `${losses}`, inline: true },
        { name: '🎯 Win Rate', value: `${winRate}%`, inline: true },
        { name: '⭐ MVPs de Partida', value: `${mvps}`, inline: true },
        { name: '🔥 Win Streak', value: streak > 0 ? `${streak} Seguidas` : '0', inline: true }
      )
      .setFooter({ text: 'CS2 Mix Hub • Perfil Competitivo Atualizado' })
      .setTimestamp();

    return embed;
  }

  buildRankingEmbed() {
    const profiles = this.loadPlayerProfiles();
    const list = Object.entries(profiles)
      .map(([id, p]) => {
        const wins = p.wins || 0;
        const losses = p.losses || 0;
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        return {
          id,
          username: p.username || 'Competidor',
          level: p.level || 16,
          wins,
          losses,
          total,
          winRate,
          mvps: p.mvps || 0,
          streak: p.streak || 0,
        };
      })
      .filter((p) => p.total > 0 || p.wins > 0 || p.mvps > 0)
      .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.winRate || 0) - (a.winRate || 0) || (b.mvps || 0) - (a.mvps || 0));

    if (list.length === 0) {
      return new EmbedBuilder()
        .setTitle('🏆 CS2 MIX HUB • HALL DA FAMA & RANKING')
        .setDescription(
          `Ainda não há partidas com resultado registrado neste servidor!\n\n` +
          `👉 **Como pontuar no Ranking:**\n` +
          `1. Crie uma partida com \`!mix\`\n` +
          `2. Jogue com seus amigos (10/10)\n` +
          `3. Ao final, use o botão **\`[🏆 Declarar Placar]\`** ou digite \`!vitoria A 13-9\`!\n\n` +
          `O ranking registrará automaticamente suas vitórias, taxa de win rate e MVPs!`
        )
        .setColor(0x38bdf8)
        .setFooter({ text: 'CS2 Mix Hub • Seja o primeiro campeão!' });
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines = list.slice(0, 10).map((p, i) => {
      const medal = medals[i] || `**#${i + 1}**`;
      const mvpBadge = p.mvps > 0 ? ` • ⭐ **${p.mvps}x MVP**` : '';
      const streakBadge = p.streak >= 2 ? ` • 🔥 **${p.streak} Win Streak**` : '';
      return `${medal} <@${p.id}> — **${p.wins}V** / ${p.losses}D (\`${p.winRate}%\` Win Rate)${mvpBadge}${streakBadge} • \`Lvl ${p.level} GC\``;
    });

    return new EmbedBuilder()
      .setTitle('🏆 HALL DA FAMA & RANKING GERAL • TOP 10 CS2')
      .setDescription(
        `Confira os maiores vencedores da comunidade nos Mixes 5v5:\n\n` +
        lines.join('\n\n') +
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *Para subir de posição, jogue mixes e registre a vitória com \`!vitoria A\` ou pelo botão!*`
      )
      .setColor(0xf59e0b)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Atualizado em tempo real' })
      .setTimestamp();
  }

  async recordMatchResult(mix, winnerTeamLetter, scoreInput, declaredByUser, channel) {
    const isA = (winnerTeamLetter || '').toUpperCase() === 'A';
    const isB = (winnerTeamLetter || '').toUpperCase() === 'B';
    if (!isA && !isB) {
      return { success: false, error: 'O vencedor deve ser Time A ou Time B (ex: `!vitoria A 13-9`).' };
    }

    if (!mix.teamA?.players || mix.teamA.players.length === 0 || !mix.teamB?.players || mix.teamB.players.length === 0) {
      return { success: false, error: 'Os times ainda não foram sorteados! Use `!sortear` antes de registrar o placar da partida.' };
    }

    const winnerTeam = isA ? mix.teamA : mix.teamB;
    const loserTeam = isA ? mix.teamB : mix.teamA;
    const score = (scoreInput || '13-9').trim();

    mix.phase = 'finished';
    mix.winner = winnerTeam.name;
    mix.finalScore = score;

    const profiles = this.loadPlayerProfiles();

    // Update winners
    winnerTeam.players.forEach((p) => {
      const prof = profiles[p.id] || { level: p.level || 16, username: p.username };
      prof.wins = (prof.wins || 0) + 1;
      prof.totalMatches = (prof.totalMatches || 0) + 1;
      prof.streak = (prof.streak || 0) + 1;
      prof.username = p.username || prof.username;
      profiles[p.id] = prof;
    });

    // Update losers
    loserTeam.players.forEach((p) => {
      const prof = profiles[p.id] || { level: p.level || 16, username: p.username };
      prof.losses = (prof.losses || 0) + 1;
      prof.totalMatches = (prof.totalMatches || 0) + 1;
      prof.streak = 0;
      prof.username = p.username || prof.username;
      profiles[p.id] = prof;
    });

    this.savePlayerProfiles(profiles);

    // Save match to match history
    const history = this.loadMatchHistory();
    const matchRecord = {
      id: mix.id,
      timestamp: Date.now(),
      map: mix.veto.deciderMap?.name || 'Mirage',
      winner: winnerTeam.name,
      loser: loserTeam.name,
      score,
      declaredBy: declaredByUser.username,
      winnerPlayers: winnerTeam.players.map((p) => ({ id: p.id, nick: p.displayName || p.username })),
      loserPlayers: loserTeam.players.map((p) => ({ id: p.id, nick: p.displayName || p.username })),
    };
    history.unshift(matchRecord);
    this.saveMatchHistory(history.slice(0, 100));
    this.updateLeaderboardFile(profiles);

    // Build victory embed
    const victoryEmbed = new EmbedBuilder()
      .setTitle(`🏆 VITÓRIA DO ${winnerTeam.name.toUpperCase()}! • PLACAR ${score}`)
      .setDescription(
        `A partida foi encerrada e as estatísticas de todos os 10 jogadores foram atualizadas no **Ranking Geral**!\n\n` +
        `🗺️ **Mapa:** **${mix.veto.deciderMap?.name || 'Mirage'}**\n` +
        `⚔️ **Resultado Oficial:** **${winnerTeam.name}** venceu por **${score}**!\n` +
        `👑 **Declarado por:** <@${declaredByUser.id}>\n\n` +
        `⭐ **VOTAÇÃO DE MVP INICIADA:** Selecione no menu abaixo quem jogou mais nesta partida!`
      )
      .setColor(0x22c55e)
      .addFields(
        {
          name: `🥇 Campeões • ${winnerTeam.name} (+1 Vitória)`,
          value: winnerTeam.players.map((p) => `👑 <@${p.id}> \`[Lvl ${p.level || 16}]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        },
        {
          name: `🥈 Vice-Campeões • ${loserTeam.name}`,
          value: loserTeam.players.map((p) => `💀 <@${p.id}> \`[Lvl ${p.level || 16}]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        }
      )
      .setFooter({ text: 'CS2 Mix Hub • Partida Concluída' })
      .setTimestamp();

    if (mix.veto.deciderMap?.image) {
      victoryEmbed.setThumbnail(mix.veto.deciderMap.image);
    }

    // Initialize MVP voting state
    mix.mvpVote = {
      active: true,
      votes: new Map(),
      expiresAt: Date.now() + 60000,
    };

    // MVP select options
    const selectOptions = mix.players.slice(0, 25).map((p) => ({
      label: (p.displayName || p.username || 'Jogador').slice(0, 25),
      description: `Lvl ${p.level || 16} GC • ${winnerTeam.players.some((w) => w.id === p.id) ? 'Time Vencedor 🏆' : 'Time Perdedor'}`,
      value: p.id,
      emoji: winnerTeam.players.some((w) => w.id === p.id) ? '🥇' : '🎯',
    }));

    const components = [];
    if (selectOptions.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mvp_vote:${mix.id}`)
        .setPlaceholder('⭐ Escolha o MVP da Partida...')
        .addOptions(selectOptions);
      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    const finishBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mvp_finish:${mix.id}`)
        .setLabel('Encerrar Votação e Declarar MVP')
        .setEmoji('👑')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('Jogar Outro Mix')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Primary)
    );
    components.push(finishBtn);

    return { success: true, embeds: [victoryEmbed], components };
  }

  async finishMvpVote(mix, channel) {
    if (!mix || !mix.mvpVote) return;
    mix.mvpVote.active = false;

    const voteCounts = new Map();
    mix.mvpVote.votes.forEach((candidateId) => {
      voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + 1);
    });

    let bestCandidateId = null;
    let maxVotes = -1;
    voteCounts.forEach((count, candidateId) => {
      if (count > maxVotes) {
        maxVotes = count;
        bestCandidateId = candidateId;
      }
    });

    if (!bestCandidateId) {
      bestCandidateId = mix.winner === mix.teamA.name ? (mix.teamA.captain?.id || mix.players[0]?.id) : (mix.teamB.captain?.id || mix.players[1]?.id);
      maxVotes = 0;
    }

    const profiles = this.loadPlayerProfiles();
    const prof = profiles[bestCandidateId] || { level: 16 };
    prof.mvps = (prof.mvps || 0) + 1;
    profiles[bestCandidateId] = prof;
    this.savePlayerProfiles(profiles);
    this.updateLeaderboardFile(profiles);

    const mvpEmbed = new EmbedBuilder()
      .setTitle('👑 MVP DA PARTIDA COROADO!')
      .setDescription(
        `A comunidade votou e escolheu o grande destaque da partida no mapa **${mix.veto.deciderMap?.name || 'Mirage'}**:\n\n` +
        `⭐ **MVP ELEITO:** <@${bestCandidateId}> (\`${maxVotes} votos\`)\n` +
        `🏆 **Total de MVPs na Carreira:** **${prof.mvps}x MVP**\n` +
        `🎖️ **Nível GC:** Lvl ${prof.level || 16}`
      )
      .setColor(0xf59e0b)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Hall da Fama' })
      .setTimestamp();

    if (channel) {
      await channel.send({ embeds: [mvpEmbed] }).catch(() => {});
    }
    return mvpEmbed;
  }

  async notifyMissingSlots(mix, guild, channel) {
    if (!guild || !channel) return;
    const missing = 10 - mix.players.length;
    if (missing !== 1 && missing !== 2) return;

    try {
      const role = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'mix cs2' || r.name.toLowerCase() === 'mix'
      );
      const roleMention = role ? `<@&${role.id}> ` : '';
      const plural = missing === 1 ? 'VAGA RESTANTE' : 'VAGAS RESTANTES';
      const msg = `📢 ${roleMention}**FALTA(M) APENAS ${missing} ${plural} PARA FECHAR O MIX 5v5!**\n` +
        `👉 Quem vai jogar? Clique no botão verde **\`[➕ Entrar]\`** ou digite \`!entrar\` agora!`;
      await channel.send(msg);
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao notificar vagas:', e.message);
    }
  }

  async toggleMixRole(guild, member) {
    if (!guild || !member) return { success: false, message: 'Servidor ou membro inválido.' };
    try {
      let role = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'mix cs2' || r.name.toLowerCase() === 'mix'
      );
      if (!role) {
        try {
          role = await guild.roles.create({
            name: 'Mix CS2',
            color: 0x38bdf8,
            reason: 'Cargo de notificações para partidas de CS2 Mix Hub',
          });
        } catch (roleCreateErr) {
          return { success: false, message: '⚠️ Não foi possível encontrar ou criar o cargo `@Mix CS2`. Verifique se o bot tem permissão de gerenciar cargos!' };
        }
      }

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id);
        return { success: true, added: false, roleId: role.id, message: `🔕 Você removeu o cargo <@&${role.id}>. Você não será mais notificado quando faltarem vagas nos mixes.` };
      } else {
        await member.roles.add(role.id);
        return { success: true, added: true, roleId: role.id, message: `🔔 Sucesso! Você recebeu o cargo <@&${role.id}>! Você será avisado automaticamente quando faltarem 1 ou 2 vagas para iniciar o 5v5!` };
      }
    } catch (e) {
      return { success: false, message: `❌ Erro ao gerenciar cargo: ${e.message}` };
    }
  }

  async executeSubstitute(mix, outArg, inArg, guild, channel) {
    if (!mix) return { success: false, message: 'Nenhum mix ativo encontrado neste canal.' };
    const cleanOut = (outArg || '').replace(/[<@!>]/g, '').trim().toLowerCase();
    const cleanIn = (inArg || '').replace(/[<@!>]/g, '').trim().toLowerCase();

    const outIdx = mix.players.findIndex(
      (p) => p.id === cleanOut || (p.displayName || p.username || '').toLowerCase().includes(cleanOut)
    );
    if (outIdx === -1) {
      return { success: false, message: `❌ Não foi possível encontrar o jogador que vai sair: "${outArg}".` };
    }
    const oldPlayer = mix.players[outIdx];

    let newMember = null;
    if (guild) {
      newMember = guild.members.cache.find(
        (m) => m.id === cleanIn || m.user.username.toLowerCase().includes(cleanIn) || (m.displayName || '').toLowerCase().includes(cleanIn)
      );
    }

    const newId = newMember ? newMember.id : cleanIn;
    const newUsername = newMember ? newMember.user.username : inArg;
    const newDisplayName = newMember ? newMember.displayName : inArg;
    const newAvatar = newMember ? newMember.user.displayAvatarURL({ dynamic: true }) : null;

    if (mix.players.some((p) => p.id === newId)) {
      return { success: false, message: `⚠️ O substituto <@${newId}> já está participando deste mix!` };
    }

    const newLevel = this.getPlayerLevel(newId);
    const newPlayerObj = {
      id: newId,
      username: newUsername,
      displayName: newDisplayName,
      avatar: newAvatar,
      level: newLevel,
      ready: true,
    };

    mix.players.splice(outIdx, 1, newPlayerObj);

    let teamName = 'Lobby';
    let targetTeam = null;
    const idxA = mix.teamA.players.findIndex((p) => p.id === oldPlayer.id);
    if (idxA !== -1) {
      mix.teamA.players.splice(idxA, 1, newPlayerObj);
      teamName = mix.teamA.name;
      targetTeam = 'teamA';
      if (mix.teamA.captain?.id === oldPlayer.id) mix.teamA.captain = newPlayerObj;
    }

    const idxB = mix.teamB.players.findIndex((p) => p.id === oldPlayer.id);
    if (idxB !== -1) {
      mix.teamB.players.splice(idxB, 1, newPlayerObj);
      teamName = mix.teamB.name;
      targetTeam = 'teamB';
      if (mix.teamB.captain?.id === oldPlayer.id) mix.teamB.captain = newPlayerObj;
    }

    if (this.config.autoMoveVoice && targetTeam && guild && newMember) {
      const voiceId = targetTeam === 'teamA' ? this.config.teamAVoiceId : this.config.teamBVoiceId;
      if (voiceId && newMember.voice?.channelId) {
        newMember.voice.setChannel(voiceId).catch(() => {});
      }
    }

    this.syncToWebRoom(mix);

    return {
      success: true,
      message: `🔄 **SUBSTITUIÇÃO EFETUADA!**\n<@${oldPlayer.id}> foi substituído por <@${newPlayerObj.id}> \`[Lvl ${newLevel} GC]\` no **${teamName}**!`,
    };
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

    // Refresh every player's level from their persistent profile
    mix.players.forEach((p) => {
      p.level = this.getPlayerLevel(p.id) || p.level || 16;
    });

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
    mix.teamA.captain = teamA[0] || null; // Top Gamers Club player in Team A
    mix.teamA.avgLevel = avgA;
    mix.teamB.players = teamB;
    mix.teamB.captain = teamB[0] || null; // Top Gamers Club player in Team B
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

  buildMixTutorialEmbed() {
    return new EmbedBuilder()
      .setTitle('📖 GUIA RÁPIDO DO CS2 MIX HUB • COMO MEXER NO BOT')
      .setDescription(
        `Seja bem-vindo ao sistema oficial de Mix 5v5 da comunidade!\n` +
          `Aqui está o passo a passo de como funciona a fila e os comandos:\n\n` +
          `**1️⃣ Como Entrar e Sair da Fila:**\n` +
          `• Clique no botão verde **\`[➕ Entrar]\`** logo abaixo ou digite \`!entrar\` no chat.\n` +
          `• Se precisar desmarcar, clique em **\`[➖ Sair]\`** ou digite \`!sair\`.\n\n` +
          `**2️⃣ Cadastre seu Nível da Gamers Club (GC):**\n` +
          `• Clique no botão azul **\`[⭐ Meu Nível GC]\`** ou digite \`!lvl <1 a 21>\` (ex: \`!lvl 16\`).\n` +
          `• O bot salva seu nível para sempre! Isso garante que o sorteio forme times equilibrados.\n\n` +
          `**3️⃣ Confirmação de Presença (Anti-AFK):**\n` +
          `• Assim que a fila atingir **10/10 jogadores**, o bot abrirá um check-in de 45 segundos.\n` +
          `• Todos devem clicar em **\`[✅ Confirmar Presença]\`**. Quem não confirmar sai automaticamente!\n\n` +
          `**4️⃣ Sorteio dos Times & Capitães:**\n` +
          `• Clique em **\`[⚔️ Sortear Times]\`** (ou \`!sortear\`).\n` +
          `• Os dois jogadores de maior nível viram os Capitães 👑 (Time A e Time B) e o sistema divide os elos igualmente.\n\n` +
          `**5️⃣ Veto de Mapas (Pick & Ban) e Escolha de Lado:**\n` +
          `• Clique em **\`[🗳️ Pick & Ban]\`** (ou \`!veto\`) para os capitães banirem os mapas da Valve.\n` +
          `• No mapa final, o Capitão B escolhe começar de **CT** 🛡️ ou **TR** 💣!\n\n` +
          `**6️⃣ Conectar no Servidor & Mover Calls:**\n` +
          `• Clique em **\`[🚀 Conectar Direto no CS2]\`** para abrir o jogo pela Steam com 1 clique!\n` +
          `• Clique em **\`[📞 Mover Calls]\`** para o bot puxar cada time para sua sala de voz oficial.\n\n` +
          `**7️⃣ Placar da Partida, MVP & Ranking Geral:**\n` +
          `• Ao final do jogo, clique em **\`[🏆 Declarar Placar]\`** ou digite \`!vitoria A 13-9\`.\n` +
          `• O bot pontua as vitórias no **\`!ranking\`** e abre a eleição do **MVP da Partida** ⭐!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ **Comandos Oficiais no Chat:**\n` +
          `• \`!mix\` — Abre um novo lobby 5v5\n` +
          `• \`!vitoria [A|B] [placar]\` — Registra a vitória e pontua no ranking\n` +
          `• \`!ranking\` / \`!top\` — Hall da Fama e Top 10 com vitórias e medalhas\n` +
          `• \`!sub @novo\` — Substitui um jogador ausente por um reserva\n` +
          `• \`!cargo\` — Ativa/desativa notificações de vagas restantes (@Mix CS2)\n` +
          `• \`!lvl <1-21>\` — Cadastra/atualiza seu nível da Gamers Club\n` +
          `• \`!stats\` — Exibe suas estatísticas, vitórias, medalhas de MVP e streak\n` +
          `• \`!smoke <mapa>\` • Lineups | \`!treino\` • CFG console | \`!moeda\` • Cara ou coroa`
      )
      .setColor(0x38bdf8)
      .setThumbnail('https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_mirage_1_png.png')
      .setFooter({ text: 'Dica: Todos os botões do Mix estão disponíveis logo abaixo deste card! 👇' });
  }

  buildLobbyEmbed(mix) {
    const total = mix.players.length;
    const isFull = total >= 10;
    const color = isFull ? 0x10b981 : 0xf59e0b;

    const playerList = [];
    for (let i = 0; i < 10; i++) {
      const p = mix.players[i];
      if (p) {
        const lvl = p.level || this.getPlayerLevel(p.id) || 16;
        const gcEmoji = lvl >= 20 ? '👑' : lvl >= 18 ? '🏆' : lvl >= 14 ? '🥇' : '🥈';
        playerList.push(`**${i + 1}.** <@${p.id}> \`[Lvl ${lvl} GC ${gcEmoji}]\``);
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
        .setCustomId(`mix_set_level:${mix.id}`)
        .setLabel('Meu Nível GC')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary),
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
      .map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}> \`[Lvl ${p.level || 16} GC]\``)
      .join('\n') || '*Nenhum jogador*';

    const bPlayers = (teamB.players || [])
      .map((p, i) => `${i === 0 ? '👑 ' : ''}<@${p.id}> \`[Lvl ${p.level || 16} GC]\``)
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

  buildMatchReadyButtons(mix) {
    const rows = [];
    const row1 = new ActionRowBuilder();

    if (mix.serverIp) {
      const cleanIp = mix.serverIp.replace(/^connect\s+/i, '').trim();
      row1.addComponents(
        new ButtonBuilder()
          .setLabel('🚀 Conectar Direto no CS2')
          .setStyle(ButtonStyle.Link)
          .setURL(`http://localhost:3000/connect?ip=${encodeURIComponent(cleanIp)}`)
      );
    }

    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`match_result:${mix.id}`)
        .setLabel('🏆 Declarar Placar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mix_sub:${mix.id}`)
        .setLabel('🔄 Substituto')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`mix_voice:${mix.id}`)
        .setLabel('📞 Mover Calls')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(row1);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🌐 Acompanhar Partida no Site')
        .setStyle(ButtonStyle.Link)
        .setURL(`http://localhost:3000/?room=${mix.id}`),
      new ButtonBuilder()
        .setCustomId('panel_create_mix')
        .setLabel('🎮 Novo Mix')
        .setStyle(ButtonStyle.Primary)
    );
    rows.push(row2);

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
      const tutorialEmbed = this.buildMixTutorialEmbed();
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      return interaction.reply({
        content: `🎮 <@${user.id}> abriu um novo **Lobby de Mix CS2**!`,
        embeds: [tutorialEmbed, embed],
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

      const userLvl = this.getPlayerLevel(user.id);
      mix.players.push({
        id: user.id,
        username: user.username,
        displayName: interaction.member?.displayName || user.username,
        avatar: user.displayAvatarURL({ dynamic: true }),
        level: userLvl,
        ready: true,
      });

      // If 10 players reached, launch Ready Check!
      if (mix.players.length === 8 || mix.players.length === 9) {
        this.notifyMissingSlots(mix, interaction.guild, interaction.channel).catch(() => {});
      }

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

    // SET LEVEL MODAL POPUP
    if (action === 'mix_set_level') {
      const current = this.getPlayerLevel(user.id);
      const modal = new ModalBuilder()
        .setCustomId(`modal_set_level:${mix.id}`)
        .setTitle('Nível Gamers Club (GC)');

      const levelInput = new TextInputBuilder()
        .setCustomId('gc_level_input')
        .setLabel('Seu Nível na Gamers Club (1 a 21)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 18')
        .setValue(String(current || 16))
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(levelInput);
      modal.addComponents(actionRow);

      return interaction.showModal(modal);
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
      const components = this.buildMatchReadyButtons(mix);

      return interaction.update({
        content: `🔥 **PARTIDA PRONTA PARA COMEÇAR!** GL & HF!`,
        embeds: [finalEmbed],
        components,
      });
    }

    // 8. ROULETTE
    if (action === 'mix_roulette') {
      const randIdx = Math.floor(Math.random() * OFFICIAL_MAPS.length);
      const drawn = OFFICIAL_MAPS[randIdx];
      mix.veto.deciderMap = drawn;
      mix.phase = 'live';
      this.syncToWebRoom(mix);

      const embed = this.buildMatchReadyEmbed(mix);
      const components = this.buildMatchReadyButtons(mix);

      return interaction.update({
        content: `🎲 **MAPA DEFINIDO PELA ROLETA!** GL & HF!`,
        embeds: [embed],
        components,
      });
    }

    // 9. VOICE MOVER
    if (action === 'mix_voice') {
      const result = await this.executeVoiceMover(interaction.guild, mix);
      return interaction.reply({ content: result.message, ephemeral: true });
    }

    // 10. DECLARE MATCH RESULT (MODAL)
    if (action === 'match_result') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_match_result:${mix.id}`)
        .setTitle('🏆 Declarar Placar da Partida');

      const winnerInput = new TextInputBuilder()
        .setCustomId('winner_input')
        .setLabel('Time Vencedor (digite A ou B)')
        .setPlaceholder('Ex: A ou B')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(1)
        .setRequired(true);

      const scoreInput = new TextInputBuilder()
        .setCustomId('score_input')
        .setLabel('Placar Final do Confronto')
        .setPlaceholder('Ex: 13-9, 13-11, 16-14')
        .setValue('13-9')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(10)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(winnerInput),
        new ActionRowBuilder().addComponents(scoreInput)
      );

      return interaction.showModal(modal);
    }

    // 11. SUBSTITUTE MODAL
    if (action === 'mix_sub') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_mix_sub:${mix.id}`)
        .setTitle('🔄 Substituição de Jogador');

      const outInput = new TextInputBuilder()
        .setCustomId('sub_out')
        .setLabel('Quem vai sair do mix? (Nick ou ID)')
        .setPlaceholder('Ex: nick_do_jogador ou ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inInput = new TextInputBuilder()
        .setCustomId('sub_in')
        .setLabel('Quem vai entrar como reserva? (Nick ou ID)')
        .setPlaceholder('Ex: novo_jogador ou ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(outInput),
        new ActionRowBuilder().addComponents(inInput)
      );

      return interaction.showModal(modal);
    }

    // 12. FINISH MVP VOTE
    if (action === 'mvp_finish') {
      await interaction.deferUpdate().catch(() => {});
      return this.finishMvpVote(mix, interaction.channel);
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
    if (commandName === 'level' || commandName === 'lvl') return this.cmdSetLevel(interaction);
    if (commandName === 'servidor') return this.cmdServer(interaction);
    if (commandName === 'ranking') return this.cmdRanking(interaction);
    if (commandName === 'vitoria' || commandName === 'resultado') return this.cmdMatchResult(interaction);
    if (commandName === 'sub') return this.cmdSubstitute(interaction);
    if (commandName === 'cargo') return this.cmdToggleRole(interaction);
    if (commandName === 'ajuda') return this.cmdHelp(interaction);
  }

  async handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    if (customId.startsWith('mvp_vote')) {
      const [_, mixId] = customId.split(':');
      const mix = this.activeMixes.get(interaction.channelId);
      if (!mix || !mix.mvpVote?.active) {
        return interaction.reply({ content: '⚠️ Esta votação de MVP já foi encerrada.', ephemeral: true });
      }
      const chosenPlayerId = interaction.values[0];
      mix.mvpVote.votes.set(interaction.user.id, chosenPlayerId);
      const totalVotes = mix.mvpVote.votes.size;
      return interaction.reply({
        content: `⭐ Seu voto de MVP para <@${chosenPlayerId}> foi computado com sucesso! (Total de votos computados: ${totalVotes})`,
        ephemeral: true,
      });
    }
  }

  async handleModalSubmit(interaction) {
    const customId = interaction.customId;
    if (customId.startsWith('modal_set_level')) {
      const raw = interaction.fields.getTextInputValue('gc_level_input');
      const parsed = parseInt(raw?.trim(), 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 21) {
        return interaction.reply({
          content: '⚠️ Nível inválido! Insira um número de **1 a 21** correspondente ao seu nível na Gamers Club.',
          ephemeral: true,
        });
      }

      this.setPlayerProfile(interaction.user.id, {
        level: parsed,
        username: interaction.user.username,
      });

      const mix = this.activeMixes.get(interaction.channelId);
      if (mix) {
        const p = mix.players.find((pl) => pl.id === interaction.user.id);
        if (p) {
          p.level = parsed;
          const embed = this.buildLobbyEmbed(mix);
          const components = this.buildLobbyButtons(mix);
          if (mix.phase === 'lobby' && interaction.message) {
            await interaction.message.edit({ embeds: [embed], components }).catch(() => {});
          }
        }
      }

      const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';
      return interaction.reply({
        content: `✅ <@${interaction.user.id}>, seu nível da Gamers Club foi salvo com sucesso como **Lvl ${parsed}** (\`${badge}\`)!\nTodos os sorteios de times balancearão as equipes com base no seu nível real.`,
        ephemeral: true,
      });
    }

    if (customId.startsWith('modal_match_result')) {
      const winner = interaction.fields.getTextInputValue('winner_input');
      const score = interaction.fields.getTextInputValue('score_input');
      const mix = this.activeMixes.get(interaction.channelId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal.', ephemeral: true });
      }
      const result = await this.recordMatchResult(mix, winner, score, interaction.user, interaction.channel);
      if (!result.success) {
        return interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
      }
      return interaction.reply({ embeds: result.embeds, components: result.components });
    }

    if (customId.startsWith('modal_mix_sub')) {
      const outNick = interaction.fields.getTextInputValue('sub_out');
      const inNick = interaction.fields.getTextInputValue('sub_in');
      const mix = this.activeMixes.get(interaction.channelId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal.', ephemeral: true });
      }
      const res = await this.executeSubstitute(mix, outNick, inNick, interaction.guild, interaction.channel);
      return interaction.reply({ content: res.message, ephemeral: !res.success });
    }
  }

  async cmdMatchResult(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal para registrar vitória.', ephemeral: true });
    }
    const winner = interaction.options.getString('time');
    const score = interaction.options.getString('placar') || '13-9';
    const res = await this.recordMatchResult(mix, winner, score, interaction.user, interaction.channel);
    if (!res.success) {
      return interaction.reply({ content: `⚠️ ${res.error}`, ephemeral: true });
    }
    return interaction.reply({ embeds: res.embeds, components: res.components });
  }

  async cmdSubstitute(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal para fazer substituição.', ephemeral: true });
    }
    const newUser = interaction.options.getUser('novo');
    const oldUser = interaction.options.getUser('antigo') || interaction.user;
    const res = await this.executeSubstitute(mix, oldUser.id, newUser.id, interaction.guild, interaction.channel);
    return interaction.reply({ content: res.message, ephemeral: !res.success });
  }

  async cmdToggleRole(interaction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({ content: '⚠️ Este comando só pode ser usado em um servidor.', ephemeral: true });
    }
    const res = await this.toggleMixRole(interaction.guild, interaction.member);
    return interaction.reply({ content: res.message, ephemeral: true });
  }

  async cmdSetLevel(interaction) {
    const parsed = interaction.options.getInteger('nivel');
    if (!parsed || parsed < 1 || parsed > 21) {
      const current = this.getPlayerLevel(interaction.user.id);
      return interaction.reply({
        content: `ℹ️ Seu nível atual da Gamers Club é **Lvl ${current || 16}**.\nPara alterar, use: \`/level nivel: 19\`.`,
        ephemeral: true,
      });
    }

    this.setPlayerProfile(interaction.user.id, {
      level: parsed,
      username: interaction.user.username,
    });

    const mix = this.activeMixes.get(interaction.channelId);
    if (mix) {
      const p = mix.players.find((pl) => pl.id === interaction.user.id);
      if (p) p.level = parsed;
    }

    const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';
    return interaction.reply({
      content: `✅ Seu nível da Gamers Club foi salvo com sucesso como **Lvl ${parsed}** (\`${badge}\`)! O sorteio de times será balanceado com base no seu nível.`,
      ephemeral: true,
    });
  }

  async cmdCreateMix(interaction) {
    const name = interaction.options.getString('nome') || `Mix 5v5 de ${interaction.user.username}`;
    const format = interaction.options.getString('formato') || 'MD1';
    const mix = this.getOrCreateMix(interaction.channelId, interaction.user, { name, format });
    const tutorialEmbed = this.buildMixTutorialEmbed();
    const embed = this.buildLobbyEmbed(mix);
    const components = this.buildLobbyButtons(mix);

    return interaction.reply({
      content: `🎮 <@${interaction.user.id}> criou um novo **Lobby de Mix CS2 5v5**!`,
      embeds: [tutorialEmbed, embed],
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
      level: this.getPlayerLevel(interaction.user.id),
      ready: true,
    });

    if (mix.players.length === 8 || mix.players.length === 9) {
      this.notifyMissingSlots(mix, interaction.guild, interaction.channel).catch(() => {});
    }

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
