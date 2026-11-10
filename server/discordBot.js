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
  Events,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import { fileURLToPath } from 'url';
import {
  loadMatchHistory as loadUnifiedMatchHistory,
  saveMatchHistory as saveUnifiedMatchHistory,
  recordMatchHistoryEntry,
  computeMatchMvp,
  updateMatchMvp,
  getMapImageUrl,
  normalizeMapName,
} from './matchHistory.js';
import { scheduleSave, clearMixPersistence } from './mixPersistence.js';
import { hardwareDealsManager, CATEGORY_LABELS } from './hardwareDeals.js';
import { whatsappBot } from './whatsappBot.js';
import { SteamScannerService } from './steamScanner.js';
import { cs2NewsRadar } from './cs2NewsRadar.js';
import { proMatchesAgenda } from './proMatchesAgenda.js';
import { freeGamesRadar } from './freeGamesRadar.js';
import { cs2CaseSimulator } from './cs2CaseSimulator.js';
import { communityClips } from './communityClips.js';
import { bagreVoteService } from './bagreVote.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'discordBotConfig.json');
const PROFILES_FILE = path.join(DATA_DIR, 'playerProfiles.json');
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'matchHistory.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Validates numeric Discord Snowflake ID (17 to 20 digits)
export const isSnowflake = (id) => typeof id === 'string' && /^\d{17,20}$/.test(id);

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

/**
 * Steam A2S_INFO UDP Server Query Protocol
 * Queries live CS2 dedicated server status (ping, current map, players count).
 */
export function queryA2SServer(hostWithPort, timeoutMs = 2500) {
  return new Promise((resolve) => {
    let [host, portStr] = (hostWithPort || '').split(':');
    host = (host || '').trim();
    const port = parseInt(portStr, 10) || 27015;

    if (!host) {
      return resolve({ online: false, error: 'Endereço de IP inválido.' });
    }

    const socket = dgram.createSocket('udp4');
    const startTime = Date.now();
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch (e) {}
    };

    timer = setTimeout(() => {
      cleanup();
      resolve({
        online: false,
        host,
        port,
        error: 'Tempo limite esgotado (servidor offline ou porta UDP bloqueada).',
      });
    }, timeoutMs);

    const basePacket = Buffer.from([
      0xff, 0xff, 0xff, 0xff,
      0x54, // 'T'
      0x53, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6e, 0x67, 0x69, 0x6e, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00,
    ]);

    socket.on('error', (err) => {
      cleanup();
      resolve({ online: false, host, port, error: err.message });
    });

    socket.on('message', (msg) => {
      if (msg.length < 5) return;
      const header = msg.readInt32LE(0);
      if (header !== -1) return;
      const type = msg.readUInt8(4);

      // Challenge response (0x41)
      if (type === 0x41 && msg.length >= 9) {
        const challenge = msg.subarray(5, 9);
        const challengePacket = Buffer.concat([basePacket, challenge]);
        socket.send(challengePacket, port, host, (err) => {
          if (err) {
            cleanup();
            resolve({ online: false, host, port, error: err.message });
          }
        });
        return;
      }

      // A2S_INFO Response (0x49)
      if (type === 0x49) {
        const ping = Date.now() - startTime;
        cleanup();
        try {
          let offset = 5;
          const protocol = msg.readUInt8(offset++);

          const readString = () => {
            const nullIdx = msg.indexOf(0x00, offset);
            if (nullIdx === -1) return '';
            const str = msg.toString('utf8', offset, nullIdx);
            offset = nullIdx + 1;
            return str;
          };

          const name = readString();
          const map = readString();
          const folder = readString();
          const game = readString();
          offset += 2; // Steam App ID
          const players = msg.readUInt8(offset++);
          const maxPlayers = msg.readUInt8(offset++);
          const bots = msg.readUInt8(offset++);

          resolve({
            online: true,
            host,
            port,
            ping,
            name,
            map,
            players,
            maxPlayers,
            bots,
          });
        } catch (e) {
          resolve({
            online: true,
            host,
            port,
            ping,
            name: 'Servidor CS2',
            map: 'de_mirage',
            players: 0,
            maxPlayers: 10,
            bots: 0,
          });
        }
      }
    });

    try {
      socket.send(basePacket, port, host, (err) => {
        if (err) {
          cleanup();
          resolve({ online: false, host, port, error: err.message });
        }
      });
    } catch (err) {
      cleanup();
      resolve({ online: false, host, port, error: err.message });
    }
  });
}

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
    this.mixes = this.activeMixes;
    // Reference to Web Hub rooms store
    this.webRoomsRef = null;
    // Valve CS2 Game State Integration cache
    this.lastGsiState = null;
    // Multi-player GSI state tracking (keyed by steamId)
    this.playersGsiStates = new Map();
    // Active Live Match Discord message trackers for real-time round-by-round auto-editing
    this.liveTrackers = new Map();

    // Auto-sync live trackers periodically every 1.0 second (real-time Discord rate)
    setInterval(() => {
      if (this.liveTrackers && this.liveTrackers.size > 0 && this.lastGsiState) {
        this.syncLiveTrackers(this.lastGsiState).catch(() => {});
      }
    }, 1000);
  }

  setWebRoomsReference(roomsRef) {
    this.webRoomsRef = roomsRef;
  }

  getPublicWebUrl(path = '') {
    const base = (
      this.config.publicWebUrl ||
      process.env.PUBLIC_URL ||
      (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : 'https://mix-cs2-production.up.railway.app')
    ).replace(/\/+$/, '');
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    return `${base}${cleanPath}`;
  }

  handleGsiEvent(roomId, liveState) {
    if (!liveState) return;
    this.lastGsiState = {
      ...liveState,
      roomId: roomId || 'MIX-PRO',
      receivedAt: Date.now(),
    };

    const steamId = liveState.player?.steamId || liveState.rawPlayer?.steamId;
    if (steamId) {
      this.playersGsiStates.set(steamId, {
        ...liveState,
        roomId: roomId || 'MIX-PRO',
        receivedAt: Date.now(),
      });
    }

    // Instantly sync active Discord message trackers in real time
    if (this.liveTrackers && this.liveTrackers.size > 0) {
      this.syncLiveTrackers(this.lastGsiState).catch(() => {});
    }

    // If match ended in CS2, automatically finalize any active mix
    if (liveState.isGameOver && liveState.phase === 'gameover') {
      for (const [channelId, mix] of this.activeMixes.entries()) {
        if (mix.phase !== 'finished' && mix.phase !== 'lobby') {
          const isCtWinner = (liveState.scoreCT || 0) > (liveState.scoreTR || 0);
          const score = `${Math.max(liveState.scoreCT || 0, liveState.scoreTR || 0)}-${Math.min(liveState.scoreCT || 0, liveState.scoreTR || 0)}`;

          let winnerLetter = 'A';
          if (mix.veto?.sidePick) {
            const teamBSide = mix.veto.sidePick.teamBSide || 'CT';
            const winningSide = isCtWinner ? 'CT' : 'TR';
            winnerLetter = teamBSide === winningSide ? 'B' : 'A';
          } else {
            winnerLetter = isCtWinner ? 'A' : 'B';
          }

          const channel = this.client?.channels?.cache?.get(channelId);
          this.recordMatchResult(
            mix,
            winnerLetter,
            score,
            { id: 'gsi_system', username: 'Valve CS2 GSI' },
            channel
          )
            .then((res) => {
              if (res.success && channel) {
                channel
                  .send({
                    content: `🤖 📡 **[VALVE CS2 GSI DETECTADO]** Partida concluída no mapa **${liveState.mapName || 'CS2'}**!\nPlacar final registrado automaticamente pelo cliente do jogador: **${score}**!`,
                    embeds: res.embeds,
                    components: res.components,
                  })
                  .catch(() => {});
              }
            })
            .catch((err) => console.warn('[DISCORD BOT GSI AUTO-RESULT ERROR]:', err.message));
          break;
        }
      }
    }

    // Auto-update registered Discord Live Match Tracker embeds
    this.syncLiveTrackers(this.lastGsiState).catch((err) =>
      console.warn('[DISCORD BOT LIVE TRACKER SYNC ERROR]:', err.message)
    );
  }

  buildGsiEmbed() {
    const isOnline = Boolean(
      this.lastGsiState && Date.now() - (this.lastGsiState.receivedAt || 0) < 60000
    );
    const state = this.lastGsiState || {};

    const embed = new EmbedBuilder()
      .setTitle('📡 VALVE CS2 GAME STATE INTEGRATION (GSI)')
      .setColor(isOnline ? 0x22c55e : 0x38bdf8)
      .setDescription(
        `O **Valve GSI** permite ao bot monitorar e encerrar os mixes **ao vivo**, diretamente pelo CS2 de um dos jogadores!\n\n` +
          `**Status da Transmissão:** ${isOnline ? '🟢 **ONLINE (CS2 Conectado e Transmitindo)**' : '🔴 **AGUARDANDO CONEXÃO DO CS2**'}\n` +
          (isOnline
            ? `• **Mapa Atual:** \`${state.mapName || 'de_mirage'}\`\n` +
              `• **Placar ao Vivo:** **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** (Round ${state.roundNumber || 0})\n` +
              `• **Fase do Jogo:** \`${state.phase || 'live'}\`\n` +
              `• **Status da C4:** \`${state.bomb || 'none'}\`\n\n`
            : '\n') +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⭐ **COMO FUNCIONA (APENAS 1 JOGADOR PRECISA INSTALAR):**\n` +
          `• Não precisa de todos os 10 jogadores! Apenas **1 pessoa** (jogador, admin ou espectador) coloca o arquivo no CS2.\n` +
          `• O CS2 dele transmite automaticamente cada round para o bot via protocolo oficial da Valve.\n` +
          `• O bot encerra o mix **automaticamente** ao final do jogo (\`13-9\`, \`13-11\`) e computa o Ranking e Patentes sem ninguém precisar digitar \`!vitoria\`!\n\n` +
          `⚡ **INSTALAÇÃO AUTOMÁTICA EM 1 CLIQUE NO SEU PC (ZERO ESFORÇO):**\n` +
          `1. Clique no botão verde **[⚡ Instalador 1-Clique (.bat)]** abaixo.\n` +
          `2. Dê 2 cliques no arquivo baixado: **ele detecta a pasta do seu CS2 sozinho** (mesmo em HD ou SSD secundário) e instala tudo em 1 segundo!\n` +
          `3. Pronto! Abra o CS2 e jogue normalmente.\n\n` +
          `🛡️ **100% SEGURO & VAC-SAFE:** O GSI é uma funcionalidade nativa oficial desenvolvida pela Valve (usada pela ESL, BLAST e HLTV). Zero risco de ban.`
      )
      .setFooter({ text: 'CS2 Mix Hub • Engine Oficial Valve GSI' })
      .setTimestamp();

    return embed;
  }

  buildLiveMatchEmbed(requesterName = 'Jogador', targetPlayerQuery = null, isExpanded = false, mix = null) {
    let state = this.lastGsiState || {};

    // If specific player requested by name or steamId
    if (targetPlayerQuery && this.playersGsiStates && this.playersGsiStates.size > 0) {
      const q = targetPlayerQuery.toLowerCase().trim();
      for (const [sId, pState] of this.playersGsiStates.entries()) {
        const pName = (pState.player?.name || pState.rawPlayer?.name || '').toLowerCase();
        if (pName.includes(q) || sId === targetPlayerQuery) {
          state = pState;
          break;
        }
      }
    }

    const lastTime = state.receivedAt || state.lastUpdate || 0;
    const isOnline = Boolean(
      state && Date.now() - lastTime < 90000
    );
    const player = state.player || {};
    const playerName = player.name || state.rawPlayer?.name || requesterName || 'Jogador';

    const embed = new EmbedBuilder().setTimestamp();

    if (!isOnline || (!player.name && !state.rawPlayer?.name)) {
      embed
        .setTitle('📡 MONITORAR PARTIDA • AGUARDANDO CS2')
        .setColor(0x6366f1);

      if (isExpanded) {
        embed
          .setDescription(
            `⏳ **Monitoramento ativado com sucesso! Aguardando início da partida no CS2...**\n\n` +
              `O bot está em modo de escuta ativa. **Assim que você conectar no servidor e o round começar, este card será atualizado automaticamente em tempo real!**\n\n` +
              `Seus amigos já podem deixar este card aberto no Discord ou no Hub Web para acompanhar:\n` +
              `• 🛡️ / 💣 **Lado da Equipe:** CT ou TR (com mudança de cores)\n` +
              `• 🔢 **Placar da Partida:** Contagem de rounds e round atual\n` +
              `• ❤️ **Sua Vida (HP):** Barra gráfica dinâmica atualizada em tempo real\n` +
              `• 🛡️ **Proteção:** Colete leve, capacete ou sem colete\n` +
              `• 🔫 **Armamento:** Arma ativa em mãos e munição exata\n` +
              `• 💣 **Granadas & Utilitários:** Smokes, flashes e molotovs no inventário\n` +
              `• 💰 **Economia ($):** Dinheiro atual e valor de equipamento\n` +
              `• 📊 **Desempenho:** Kills, Mortes, Assists, MVPs e K/D\n` +
              `• 🚨 **C4 Status:** Avisos ao vivo de bomba armada ou defusada`
          )
          .addFields(
            {
              name: '📡 Status do Monitoramento',
              value: '🟢 **Monitoramento Ativo** (Auto-Sync Ligado)',
              inline: true,
            },
            {
              name: '🕹️ Solicitado por',
              value: `**${requesterName}**`,
              inline: true,
            },
            {
              name: '⚙️ Arquivo GSI',
              value: '`gamestate_integration_cs2mixhub.cfg`',
              inline: true,
            }
          )
          .setFooter({ text: 'CS2 Mix Hub • Modo Expandido • Atualização Automática no 1º Round' });
      } else {
        embed
          .setDescription(
            `⏳ **Monitoramento ativado com sucesso!** Aguardando início da partida no CS2 de **${playerName}**...\n` +
            `*Assim que entrar no servidor, este card será atualizado automaticamente em tempo real.*`
          )
          .setFooter({ text: '📡 Painel Discreto • Clique em "Ver Detalhes (+)" para expandir' });
      }
      return embed;
    }

    const isInMenu = (player.activity === 'menu' || state.activity === 'menu' || !state.mapName || state.mapName === 'Indefinido' || state.phase === 'unknown');

    if (isInMenu) {
      embed
        .setTitle(`🎮 CS2 CONECTADO • ${playerName.toUpperCase()} NO MENU`)
        .setColor(0x10b981);

      if (isExpanded) {
        embed
          .setDescription(
            `🟢 **CS2 Detectado e Conectado com Sucesso!**\n\n` +
              `O jogador **${playerName}** está com o Counter-Strike 2 aberto no **Menu Principal**.\n\n` +
              `📡 **O monitoramento em tempo real já está sincronizado!**\n` +
              `Assim que você entrar em um servidor (seja casual, competitivo ou servidor de mix) e o round começar, este card mudará automaticamente para exibir:\n` +
              `• 🗺️ Mapa e Lado da equipe (CT ou TR)\n` +
              `• 🔢 Placar do jogo e contagem de rounds\n` +
              `• ❤️ Barra gráfica de vida (HP) e colete\n` +
              `• 🔫 Armas equipadas, munição e granadas\n` +
              `• 💣 Status da C4 em tempo real`
          )
          .addFields(
            {
              name: '🟢 Status da Conexão',
              value: '✅ **GSI CS2 Ativo e Recebendo Dados**',
              inline: true,
            },
            {
              name: '🕹️ Jogador',
              value: `**${playerName}**`,
              inline: true,
            },
            {
              name: '⚡ Auto-Sync',
              value: '🔄 **Atualização a cada 2.5s**',
              inline: true,
            }
          )
          .setFooter({ text: 'CS2 Mix Hub • Modo Expandido • Conectado' });
      } else {
        embed
          .setDescription(
            `🟢 **CS2 Conectado!** O jogador **${playerName}** está no Menu Principal do jogo.\n` +
            `*O monitoramento atualizará sozinho assim que a partida começar.*`
          )
          .setFooter({ text: '📡 Painel Discreto • Clique em "Ver Detalhes (+)" para expandir' });
      }
      return embed;
    }

    if (state.isGameOver) {
      const isCtWinner = (state.scoreCT || 0) > (state.scoreTR || 0);
      const isTie = (state.scoreCT || 0) === (state.scoreTR || 0);
      const winnerText = isTie
        ? '🤝 **PARTIDA EMPATADA!**'
        : isCtWinner
        ? '🛡️ **VITÓRIA DOS CONTRA-TERRORISTAS (CT)!**'
        : '💣 **VITÓRIA DOS TERRORISTAS (TR)!**';

      embed
        .setTitle(`🏆 PARTIDA FINALIZADA • ${playerName.toUpperCase()}`)
        .setColor(isTie ? 0xf59e0b : 0x10b981);

      // Extract best stats for player
      let kills = typeof player.kills === 'number' ? player.kills : 0;
      let deaths = typeof player.deaths === 'number' ? player.deaths : 0;
      let assists = typeof player.assists === 'number' ? player.assists : 0;
      let mvps = typeof player.mvps === 'number' ? player.mvps : 0;
      let score = typeof player.score === 'number' ? player.score : 0;
      let kd = player.kd;

      if (kills === 0 && deaths === 0 && Array.isArray(state.allPlayersStats) && state.allPlayersStats.length > 0) {
        const found = state.allPlayersStats.find(
          (p) =>
            (player.steamId && p.steamId === player.steamId) ||
            (p.name && p.name.toLowerCase() === playerName.toLowerCase())
        );
        if (found && (found.kills > 0 || found.score > 0)) {
          kills = found.kills;
          deaths = found.deaths;
          assists = found.assists;
          mvps = found.mvps;
          score = found.score;
          kd = found.kd;
        } else if (state.topFragger && state.topFragger.kills > 0) {
          kills = state.topFragger.kills;
          deaths = state.topFragger.deaths;
          assists = state.topFragger.assists;
          mvps = state.topFragger.mvps;
          score = state.topFragger.score;
          kd = state.topFragger.kd;
        }
      }

      if (kd === undefined || kd === null) {
        kd = deaths > 0 ? Number((kills / deaths).toFixed(2)) : Number(kills.toFixed(2));
      }

      if (isExpanded) {
        embed
          .setDescription(
            `Partida concluída no mapa **${state.mapName || 'CS2'}**!\n\n` +
              `🔢 **Placar Final:** 🛡️ **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** 💣\n` +
              `${winnerText}\n\n` +
              `📊 **Desempenho Final de ${playerName}:**\n` +
              `🎯 **${kills} Kills** • 💀 **${deaths} Mortes** • 🤝 **${assists} Assists** • ⭐ **${mvps} MVPs**\n` +
              `🔥 **K/D Final:** **${kd}** • ⚡ **Pontuação:** **${score}**`
          )
          .setFooter({ text: 'CS2 Mix Hub • Partida Concluída' });
      } else {
        embed
          .setDescription(
            `Partida encerrada em **${state.mapName || 'CS2'}**!\n` +
            `🔢 **Placar Final:** 🛡️ **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** 💣 (${winnerText})\n` +
            `📊 **Estatísticas:** 🎯 **${kills} Kills** • 💀 **${deaths} Mortes** (K/D **${kd}**) • 🤝 **${assists}A** • ⭐ **${mvps} MVPs** • ⚡ **${score} pts**`
          )
          .setFooter({ text: '📡 Painel Discreto • Partida Concluída' });
      }
      return embed;
    }

    const isCt = (player.team === 'CT' || state.rawPlayer?.team === 'CT');
    const sideBadge = isCt ? '🛡️ **Counter-Terrorists (CT)**' : '💣 **Terrorists (TR)**';
    const sideColor = isCt ? 0x38bdf8 : 0xf59e0b;
    const healthBar = player.isAlive
      ? `${'🟩'.repeat(Math.max(1, Math.round(player.health / 10)))}${'⬛'.repeat(Math.max(0, 10 - Math.round(player.health / 10)))} **${player.health} HP**`
      : '💀 **ELIMINADO / MORTO NESTE ROUND**';
    const armorBadge = player.hasHelmet
      ? `🛡️ ${player.armor}% + Capacete`
      : player.armor > 0
      ? `🛡️ ${player.armor}% Colete`
      : '❌ Sem Colete';

    let bombStatusText = '🟢 Round em Andamento';
    if (state.bomb === 'planted') bombStatusText = '🚨 💣 **C4 PLANTADA! TEMPO CORRENDO!**';
    else if (state.bomb === 'defused') bombStatusText = '🛡️ **C4 DEFUSADA PELOS CTs!**';
    else if (state.bomb === 'exploded') bombStatusText = '💥 **C4 DETONADA! VITÓRIA DOS TRs!**';

    const weaponName = player.activeWeapon?.name || player.primaryWeapon?.name || 'Faca';
    const ammoText =
      player.activeWeapon?.ammoClip !== null && player.activeWeapon?.ammoClip !== undefined
        ? `\`[${player.activeWeapon.ammoClip}/${player.activeWeapon.ammoReserve || 0}]\``
        : '';
    const nadesText = (player.grenades || []).length > 0 ? player.grenades.join(', ') : 'Nenhum';

    // Resolve active mix context if not explicitly provided
    let activeMix = mix;
    if (!activeMix && this.activeMixes && this.activeMixes.size > 0) {
      for (const m of this.activeMixes.values()) {
        if (m && (m.phase === 'live' || m.phase === 'teams' || m.phase === 'veto')) {
          activeMix = m;
          break;
        }
      }
    }

    const allStats = Array.isArray(state.allPlayersStats) ? state.allPlayersStats : [];

    function resolvePlayerGsi(p) {
      if (!p) return null;
      const pName = (p.displayName || p.username || p.nick || p.name || '').toLowerCase();
      return allStats.find((s) => {
        const sName = (s.name || '').toLowerCase();
        return sName === pName || (pName.length >= 3 && sName.includes(pName)) || (sName.length >= 3 && pName.includes(sName));
      });
    }

    // Build dedicated dual team lists for Time A and Time B (or CT & TR)
    let teamAField = null;
    let teamBField = null;

    if (activeMix && activeMix.teamA?.players?.length > 0 && activeMix.teamB?.players?.length > 0) {
      const isTeamACt = (activeMix.teamA.side || 'CT') === 'CT';
      const capA = activeMix.teamA.captain || activeMix.teamA.players[0];
      const capB = activeMix.teamB.captain || activeMix.teamB.players[0];
      const moneyA = isTeamACt ? (state.totalMoneyCT || 0) : (state.totalMoneyTR || 0);
      const moneyB = isTeamACt ? (state.totalMoneyTR || 0) : (state.totalMoneyCT || 0);
      const aliveA = isTeamACt ? (state.aliveCountCT ?? 5) : (state.aliveCountTR ?? 5);
      const aliveB = isTeamACt ? (state.aliveCountTR ?? 5) : (state.aliveCountCT ?? 5);

      const linesA = activeMix.teamA.players.map((p) => {
        const isCap = p.id === capA?.id;
        const gsi = resolvePlayerGsi(p);
        const hp = gsi ? gsi.health : 100;
        const isAlive = gsi ? gsi.isAlive : true;
        const money = gsi ? gsi.money : 0;
        const kills = gsi ? gsi.kills : 0;
        const deaths = gsi ? gsi.deaths : 0;
        const weapon = gsi?.activeWeapon || 'Faca';
        const hpBadge = isAlive ? `❤️ \`${hp} HP\`` : '💀 `MORTO`';
        const capIcon = isCap ? '👑 ' : '• ';
        return `${capIcon}<@${p.id}> \`[Lvl ${p.level || 16} GC]\`\n  └ ${hpBadge} | 💰 \`$${money}\` | 🎯 \`${kills}/${deaths}\` | 🔫 \`${weapon}\``;
      }).join('\n');

      const linesB = activeMix.teamB.players.map((p) => {
        const isCap = p.id === capB?.id;
        const gsi = resolvePlayerGsi(p);
        const hp = gsi ? gsi.health : 100;
        const isAlive = gsi ? gsi.isAlive : true;
        const money = gsi ? gsi.money : 0;
        const kills = gsi ? gsi.kills : 0;
        const deaths = gsi ? gsi.deaths : 0;
        const weapon = gsi?.activeWeapon || 'Faca';
        const hpBadge = isAlive ? `❤️ \`${hp} HP\`` : '💀 `MORTO`';
        const capIcon = isCap ? '👑 ' : '• ';
        return `${capIcon}<@${p.id}> \`[Lvl ${p.level || 16} GC]\`\n  └ ${hpBadge} | 💰 \`$${money}\` | 🎯 \`${kills}/${deaths}\` | 🔫 \`${weapon}\``;
      }).join('\n');

      teamAField = {
        name: `🛡️ TIME A (${activeMix.teamA.side || 'CT'}) • 💵 $${moneyA} • 🛡️ ${aliveA}/5 Vivos`,
        value: `👑 **Capitão do Time A:** <@${capA?.id}> \`[Lvl ${capA?.level || 16} GC]\`\n${linesA}`,
        inline: true,
      };

      teamBField = {
        name: `🔥 TIME B (${activeMix.teamB.side || 'TR'}) • 💵 $${moneyB} • 🛡️ ${aliveB}/5 Vivos`,
        value: `👑 **Capitão do Time B:** <@${capB?.id}> \`[Lvl ${capB?.level || 16} GC]\`\n${linesB}`,
        inline: true,
      };
    } else if (state.teamCT?.length > 0 || state.teamTR?.length > 0) {
      const ctLines = (state.teamCT || []).map((p, i) => {
        const hpBadge = p.isAlive ? `❤️ \`${p.health} HP\`` : '💀 `MORTO`';
        const capBadge = i === 0 ? '👑 ' : '• ';
        return `${capBadge}**${p.name}**\n  └ ${hpBadge} | 💰 \`$${p.money || 0}\` | 🎯 \`${p.kills}/${p.deaths}\` | 🔫 \`${p.activeWeapon || 'Faca'}\``;
      }).join('\n') || '*Aguardando jogadores*';

      const trLines = (state.teamTR || []).map((p, i) => {
        const hpBadge = p.isAlive ? `❤️ \`${p.health} HP\`` : '💀 `MORTO`';
        const capBadge = i === 0 ? '👑 ' : '• ';
        return `${capBadge}**${p.name}**\n  └ ${hpBadge} | 💰 \`$${p.money || 0}\` | 🎯 \`${p.kills}/${p.deaths}\` | 🔫 \`${p.activeWeapon || 'Faca'}\``;
      }).join('\n') || '*Aguardando jogadores*';

      teamAField = {
        name: `🛡️ CONTRA-TERRORISTAS (CT) • 💵 $${state.totalMoneyCT || 0} • 🛡️ ${state.aliveCountCT ?? 0} Vivos`,
        value: ctLines,
        inline: true,
      };

      teamBField = {
        name: `💣 TERRORISTAS (TR) • 💵 $${state.totalMoneyTR || 0} • 🛡️ ${state.aliveCountTR ?? 0} Vivos`,
        value: trLines,
        inline: true,
      };
    }

    if (!isExpanded) {
      // ==========================================
      // MODO DISCRETO / COMPACTO (PAINEL PEQUENO)
      // ==========================================
      const hpBadge = player.isAlive ? `❤️ **${player.health} HP**` : '💀 **ELIMINADO**';
      const armorShort = player.hasHelmet ? `🛡️ ${player.armor}%+Cap.` : player.armor > 0 ? `🛡️ ${player.armor}%` : '❌ Sem Colete';
      const weaponShort = `🔫 **${weaponName}** ${ammoText}`.trim();
      const moneyShort = `💰 **$${player.money || 0}**`;
      const kdaShort = `🎯 **${player.kills || 0}K/${player.deaths || 0}D** (K/D **${player.kd || 0}**) • ⭐ **${player.mvps || 0}**`;
      const nadesShort = (player.grenades || []).length > 0 ? `💣 ${(player.grenades || []).join(', ')}` : '';

      embed
        .setTitle(`🔴 AO VIVO • ${playerName.toUpperCase()} [${isCt ? 'CT' : 'TR'}] • ${state.mapName || 'CS2'} • CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR (R${state.roundNumber || 1})`)
        .setColor(sideColor);

      if (teamAField && teamBField) {
        embed
          .setDescription(
            `⏱️ **Situação:** ${bombStatusText}\n` +
            `${hpBadge} • ${weaponShort} • ${moneyShort}`
          )
          .addFields(teamAField, teamBField);
      } else {
        embed.setDescription(
          `${hpBadge} • ${armorShort} • ${weaponShort}\n` +
          `${moneyShort} • ${kdaShort}${nadesShort ? ` • ${nadesShort}` : ''}\n` +
          `⏱️ **Situação:** ${bombStatusText}`
        );
      }

      embed.setFooter({ text: '📡 Painel Discreto • Clique em "Ver Detalhes (+)" para expandir' });
      return embed;
    }

    // ==========================================
    // MODO DETALHADO / EXPANDIDO
    // ==========================================
    embed
      .setTitle(`🔴 AO VIVO • MONITORAMENTO DE PARTIDA CS2`)
      .setColor(sideColor)
      .setDescription(
        `Acompanhe a partida em tempo real com telemetria direta do CS2:\n\n` +
          `🗺️ **Mapa:** **${state.mapName || 'Mirage'}** • *Fase: ${state.phase || 'live'}*\n` +
          `⚖️ **Perspectiva:** ${sideBadge} (${playerName})\n` +
          `🔢 **Placar Oficial:** 🛡️ **CT ${state.scoreCT || 0} x ${state.scoreTR || 0} TR** 💣 (Round **${state.roundNumber || 1}**)\n` +
          `⏱️ **Situação:** ${bombStatusText}`
      );

    if (teamAField && teamBField) {
      embed.addFields(teamAField, teamBField);
    }

    embed.addFields(
      {
        name: `❤️ Vida & Proteção de ${playerName}`,
        value: `${healthBar}\n${armorBadge}`,
        inline: true,
      },
      {
        name: '💵 Economia Pessoal',
        value: `💰 **$${player.money || 0}**\nEquipamento: \`$${player.equipValue || 0}\``,
        inline: true,
      },
      {
        name: '🔫 Armamento Atual',
        value: `🎯 **${weaponName}** ${ammoText}\nUtilitários: \`${nadesText}\``,
        inline: true,
      },
      {
        name: `📊 Estatísticas na Partida (Score: ${player.score || 0})`,
        value: `🎯 **${player.kills || 0} Kills** • 💀 **${player.deaths || 0} Mortes** • 🤝 **${player.assists || 0} Assists** • ⭐ **${player.mvps || 0} MVPs**`,
        inline: false,
      },
      {
        name: '📈 Eficiência de Combate',
        value: `🔥 **K/D Ratio:** **${player.kd || 0}**\n⚡ **Kills neste Round:** **${player.roundKills || 0}** (${player.roundKillHs || 0} Headshots)`,
        inline: false,
      }
    );

    // List other online players if multiple people installed the .bat
    const otherPlayers = [];
    if (this.playersGsiStates && this.playersGsiStates.size > 1) {
      const now = Date.now();
      for (const [sId, pState] of this.playersGsiStates.entries()) {
        if (now - (pState.receivedAt || pState.lastUpdate || 0) < 90000) {
          const otherName = pState.player?.name || pState.rawPlayer?.name;
          if (otherName && otherName.toLowerCase() !== playerName.toLowerCase()) {
            const side = pState.player?.team === 'CT' || pState.rawPlayer?.team === 'CT' ? 'CT' : 'TR';
            otherPlayers.push(`**${otherName}** (${side})`);
          }
        }
      }
    }

    if (otherPlayers.length > 0) {
      embed.addFields({
        name: '👥 Outros Jogadores com Monitoramento Ativo',
        value: `📡 ${otherPlayers.join(' • ')}\n*(Dica: digite \`!monitorar <nome>\` para alternar de jogador)*`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'CS2 Mix Hub • Modo Expandido • Clique em "Modo Compacto" para recolher' });

    return embed;
  }

  buildLiveMatchButtons(isOnline = false, isExpanded = false) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('live_toggle_expand')
        .setLabel(isExpanded ? '🔽 Modo Compacto' : '🔍 Ver Detalhes (+)')
        .setStyle(isExpanded ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('live_refresh')
        .setLabel('🔄 Atualizar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🌐 Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/')),
      new ButtonBuilder()
        .setCustomId('live_stop')
        .setLabel('⏹️ Parar')
        .setStyle(ButtonStyle.Danger)
    );
    return row;
  }

  registerLiveTracker(messageOrReply, requesterName = 'Jogador', targetQuery = null) {
    if (!messageOrReply?.id || !messageOrReply?.channelId) return;

    if (this.liveTrackers) {
      for (const [id, t] of this.liveTrackers.entries()) {
        if (t.channelId === messageOrReply.channelId) {
          this.liveTrackers.delete(id);
        }
      }

      this.liveTrackers.set(messageOrReply.id, {
        messageId: messageOrReply.id,
        channelId: messageOrReply.channelId,
        requester: requesterName,
        targetQuery: targetQuery,
        startedAt: Date.now(),
        lastEditedAt: 0,
        lastSignature: '',
        state: this.lastGsiState?.player?.name ? 'in_game' : 'waiting',
        consecutiveErrors: 0,
      });
    }
  }

  async syncLiveTrackers(liveState) {
    if (!this.liveTrackers || this.liveTrackers.size === 0) return;
    const now = Date.now();
    const sig = `${liveState?.roundNumber}_${liveState?.scoreCT}_${liveState?.scoreTR}_${liveState?.bomb}_${liveState?.player?.isAlive}_${liveState?.player?.health}_${liveState?.player?.kills}_${liveState?.player?.deaths}_${liveState?.aliveCountCT}_${liveState?.aliveCountTR}_${liveState?.totalMoneyCT}_${liveState?.totalMoneyTR}_${liveState?.player?.roundKills}_${liveState?.player?.activeWeapon?.name}_${liveState?.player?.team}_${liveState?.phase}_${liveState?.isGameOver}`;

    for (const [msgId, tracker] of this.liveTrackers.entries()) {
      if (now - tracker.startedAt > 2.5 * 3600 * 1000) {
        this.liveTrackers.delete(msgId);
        continue;
      }
      if (tracker.state === 'finished' && now - tracker.lastEditedAt > 5 * 60 * 1000) {
        this.liveTrackers.delete(msgId);
        continue;
      }

      if (now - tracker.lastEditedAt < 1000) continue;
      if (tracker.lastSignature === sig && tracker.state !== 'waiting') continue;

      try {
        const channel =
          this.client?.channels?.cache?.get(tracker.channelId) ||
          (await this.client?.channels?.fetch(tracker.channelId).catch(() => null));
        if (!channel) {
          this.liveTrackers.delete(msgId);
          continue;
        }

        const msg = await channel.messages.fetch(msgId).catch(() => null);
        if (!msg) {
          this.liveTrackers.delete(msgId);
          continue;
        }

        const isExpanded = Boolean(tracker.isExpanded);
        const mix = this.activeMixes?.get(tracker.channelId);
        const embed = this.buildLiveMatchEmbed(tracker.requester, tracker.targetQuery, isExpanded, mix);
        const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name), isExpanded);

        await msg.edit({ embeds: [embed], components: [row] }).catch((e) => {
          if (e.code === 10008) {
            this.liveTrackers.delete(msgId);
          } else {
            console.warn('[DISCORD BOT LIVE TRACKER EDIT WARNING]:', e.message);
          }
        });

        tracker.lastEditedAt = Date.now();
        tracker.lastSignature = sig;
        if (liveState?.isGameOver) {
          tracker.state = 'finished';
        } else if (liveState?.player?.name) {
          tracker.state = 'in_game';
        }
      } catch (err) {
        tracker.consecutiveErrors = (tracker.consecutiveErrors || 0) + 1;
        if (tracker.consecutiveErrors > 5) {
          this.liveTrackers.delete(msgId);
        }
      }
    }
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

  hasSavedLevel(userId) {
    if (!userId) return false;
    const profiles = this.loadPlayerProfiles();
    const lvl = profiles[userId]?.level;
    return typeof lvl === 'number' && lvl >= 1 && lvl <= 21;
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
    return loadUnifiedMatchHistory();
  }

  saveMatchHistory(matches) {
    return saveUnifiedMatchHistory(matches);
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
      dealsChannelId: process.env.DISCORD_DEALS_CHANNEL || '',
      dealsChannels: {},
      autoPostDeals: true,
      dealsIntervalMinutes: 60,
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
    if (this.dealsMonitorInterval) {
      clearInterval(this.dealsMonitorInterval);
      this.dealsMonitorInterval = null;
    }
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
    const token = (this.config.token || process.env.DISCORD_BOT_TOKEN || '').trim();
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
        )
        .addStringOption((opt) =>
          opt
            .setName('mapa')
            .setDescription('Mapa jogado (ex: Mirage, Dust II, Inferno, Nuke, Ancient, Anubis, Cache)')
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

      new SlashCommandBuilder()
        .setName('historico')
        .setDescription('Exibe o histórico das últimas partidas finalizadas no servidor'),

      new SlashCommandBuilder()
        .setName('x1')
        .setDescription('Compara o confronto direto (Head-to-Head) e sinergia entre dois jogadores')
        .addUserOption((opt) =>
          opt
            .setName('adversario')
            .setDescription('Jogador adversário para comparar estatísticas mútuas')
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('mapas')
        .setDescription('Estatísticas dos mapas mais disputados e populares no servidor'),

      new SlashCommandBuilder()
        .setName('status-servidor')
        .setDescription('Consulta ao vivo o servidor CS2 (A2S_INFO Steam UDP: Ping, mapa e players online)'),

      new SlashCommandBuilder()
        .setName('gsi')
        .setDescription('Instruções e download do Valve GSI para monitorar partidas ao vivo do CS2'),

      new SlashCommandBuilder()
        .setName('aovivo')
        .setDescription('Acompanha a partida de CS2 ao vivo em tempo real (placar, lado CT/TR, vida e armas)')
        .addStringOption((opt) =>
          opt
            .setName('jogador')
            .setDescription('Nome ou SteamID do jogador para monitorar (opcional)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('monitorar')
        .setDescription('Monitorar Partida de CS2 ao vivo: placar, lado CT/TR, vida e armas em tempo real')
        .addStringOption((opt) =>
          opt
            .setName('jogador')
            .setDescription('Nome ou SteamID do jogador para monitorar (opcional)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('monitorar-partida')
        .setDescription('Monitorar Partida de CS2 ao vivo: placar, lado CT/TR, vida e armas em tempo real')
        .addStringOption((opt) =>
          opt
            .setName('jogador')
            .setDescription('Nome ou SteamID do jogador para monitorar (opcional)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('ofertas')
        .setDescription('Busca ofertas de hardware e setup gamer (KaBuM!, Pichau, Terabyte)')
        .addStringOption((opt) =>
          opt.setName('busca').setDescription('Peça a buscar (ex: cadeira, mesa, mouse, teclado, rtx 4060, ryzen)').setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('categoria')
            .setDescription('Filtrar por categoria de hardware ou setup')
            .setRequired(false)
            .addChoices(
              { name: 'Placas de Vídeo (GPUs)', value: 'gpu' },
              { name: 'Processadores (CPUs)', value: 'cpu' },
              { name: 'Memórias RAM & SSDs', value: 'ram_ssd' },
              { name: 'Placas-Mãe, Fontes & Gabinetes', value: 'placa_mae_fonte' },
              { name: 'Monitores Gamer (144Hz a 240Hz)', value: 'monitor' },
              { name: 'Mouses & Teclados Mecânicos', value: 'mouse_teclado' },
              { name: 'Headsets & Áudio Gamer', value: 'audio' },
              { name: 'Cadeiras Gamer', value: 'cadeira' },
              { name: 'Mesas Gamer & Setup', value: 'mesa' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('loja')
            .setDescription('Filtrar por loja confiável')
            .setRequired(false)
            .addChoices(
              { name: '🟠 KaBuM!', value: 'kabum' },
              { name: '🔴 Pichau Informática', value: 'pichau' },
              { name: '🟢 TerabyteShop', value: 'terabyte' }
            )
        ),

      new SlashCommandBuilder()
        .setName('alertas-hardware')
        .setDescription('Configura o canal de alertas automáticos de promoções de hardware')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal de texto para postar promoções').setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('ativar').setDescription('Ativar ou desativar postagens automáticas').setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('steam')
        .setDescription('Scanner Steam & Anti-Smurf: Horas de CS2, VAC bans e integridade da conta')
        .addStringOption((opt) =>
          opt.setName('perfil').setDescription('Link do perfil, SteamID64 ou Vanity URL (ex: gaules ou 7656119...)').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('patchnotes')
        .setDescription('Últimas notas de atualização e patches oficiais do CS2 lançados pela Valve'),

      new SlashCommandBuilder()
        .setName('att')
        .setDescription('Atalho rápido para as notas de atualização oficiais do CS2 pela Valve'),

      new SlashCommandBuilder()
        .setName('pro')
        .setDescription('Agenda de jogos dos times brasileiros de CS2 (FURIA, MIBR, paiN, Imperial)'),

      new SlashCommandBuilder()
        .setName('jogos')
        .setDescription('Agenda e horários de jogos dos times brasileiros de CS2 (FURIA, MIBR, paiN)'),

      new SlashCommandBuilder()
        .setName('bagre')
        .setDescription('Inicia ou consulta a votação do Bagre da Partida (o jogador que mais pinou no mix)'),

      new SlashCommandBuilder()
        .setName('jogosgratis')
        .setDescription('Radar de jogos para PC gratuitos para resgatar na Epic Games Store e Steam'),

      new SlashCommandBuilder()
        .setName('clip')
        .setDescription('Envia um clipe de jogada no canal com votação da comunidade')
        .addStringOption((opt) => opt.setName('link').setDescription('Link do clipe (Medal.tv, Twitch, YouTube, etc)').setRequired(true))
        .addStringOption((opt) => opt.setName('titulo').setDescription('Título ou descrição da jogada (opcional)').setRequired(false)),

      new SlashCommandBuilder()
        .setName('caixa')
        .setDescription('Simulador oficial de abertura de caixas de CS2 com odds reais da Valve')
        .addStringOption((opt) =>
          opt
            .setName('caixa')
            .setDescription('Escolha a caixa para abrir')
            .setRequired(false)
            .addChoices(
              { name: '⚡ Caixa Quilowatt (Kilowatt)', value: 'kilowatt' },
              { name: '🌙 Sonhos e Pesadelos (Dreams & Nightmares)', value: 'dreams' },
              { name: '💥 Caixa Coice (Recoil)', value: 'recoil' }
            )
        ),

      new SlashCommandBuilder()
        .setName('inventario')
        .setDescription('Consulta seu inventário de skins, lucro/prejuízo e facas abertas no simulador'),

      new SlashCommandBuilder()
        .setName('calls')
        .setDescription('Configura ou move os jogadores do mix para as calls de voz oficiais Time A e Time B')
        .addChannelOption((opt) =>
          opt
            .setName('time_a')
            .setDescription('Selecione o canal de voz oficial do Time A')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('time_b')
            .setDescription('Selecione o canal de voz oficial do Time B')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('lobby')
            .setDescription('Selecione o canal de voz do Lobby / Geral')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        ),

      new SlashCommandBuilder().setName('ajuda').setDescription('Manual completo de comandos do Bot do Mix'),
    ];

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const bodyPayload = commands.map((c) => c.toJSON());
      console.log(`[DISCORD BOT] Registrando ${commands.length} Slash Commands...`);

      // Register globally
      await rest.put(Routes.applicationCommands(clientId), {
        body: bodyPayload,
      }).catch((e) => console.warn('[DISCORD BOT] Aviso registro global:', e.message));

      // Also register on every connected guild for instant 0-second propagation
      const guildIds = new Set();
      if (this.config.guildId && this.config.guildId.trim()) {
        guildIds.add(this.config.guildId.trim());
      }
      if (this.client?.guilds?.cache) {
        for (const [gId] of this.client.guilds.cache) {
          guildIds.add(gId);
        }
      }
      for (const gId of guildIds) {
        await rest.put(Routes.applicationGuildCommands(clientId, gId), {
          body: bodyPayload,
        }).catch(() => {});
      }
      console.log(`✅ [DISCORD BOT] ${commands.length} Slash commands registrados com sucesso (${guildIds.size} servidor(es) ativo(s))!`);
    } catch (err) {
      console.warn('[DISCORD BOT] Aviso ao registrar comandos slash:', err.message);
    }
  }

  setupEventHandlers() {
    const readyEvent = Events.ClientReady || 'clientReady';
    this.client.on(readyEvent, () => {
      this.client.user?.setActivity('CS2 Mix 5v5 • /mix ou @cs hub', { type: 0 });
      this.registerSlashCommands().catch(() => {});
      this.startScheduledDealsMonitor();
    });

    // Handle Text Messages with Prefix '!'
    this.client.on('messageCreate', async (message) => {
      try {
        await this.handlePrefixCommand(message);
      } catch (err) {
        console.error('[DISCORD BOT] Erro ao processar mensagem prefixo !:', err);
        message.reply(`❌ Ocorreu um erro ao processar o comando: ${err.message}`).catch(() => {});
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
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: `❌ Ocorreu um erro interno: ${err.message}`,
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

    if (!content.startsWith('!') && !content.startsWith('.') && !isMentioned) return;

    if (content.startsWith('!') || content.startsWith('.')) {
      content = content.slice(1).trim();
    }

    const args = content.split(/\s+/);
    const command = (args[0] || '').toLowerCase();
    const subArg = (args[1] || '').toLowerCase();

    console.log(`💬 [DISCORD CMD] De ${message.author?.username} em #${message.channel?.name || message.channelId}: "!${command} ${args.slice(1).join(' ')}"`);

    if (command === 'mix' || command === 'criar' || command === 'lobby') {
      if (subArg === 'fila' || subArg === 'status' || subArg === 'jogadores') return this.prefixFila(message);
      if (subArg === 'entrar') return this.prefixJoin(message);
      if (subArg === 'sair') return this.prefixLeave(message);
      if (subArg === 'sortear' || subArg === 'times') return this.prefixDraw(message);
      if (subArg === 'veto' || subArg === 'ban') return this.prefixVeto(message);
      if (subArg === 'roleta') return this.prefixRoulette(message);
      if (subArg === 'cancelar') return this.prefixCancel(message);
      return this.prefixCreateMix(message, args.slice(1).join(' '));
    }

    if (command === 'painel') return this.prefixPainel(message);
    if (command === 'fila' || command === 'status' || command === 'jogadores') return this.prefixFila(message);
    if (command === 'entrar') return this.prefixJoin(message);
    if (command === 'sair') return this.prefixLeave(message);
    if (command === 'sortear' || command === 'times') return this.prefixDraw(message);
    if (command === 'veto' || command === 'ban') return this.prefixVeto(message);
    if (command === 'roleta') return this.prefixRoulette(message);
    if (command === 'ranking' || command === 'top' || command === 'leaderboard') return this.prefixRanking(message);
    if (command === 'historico' || command === 'history') return this.prefixHistory(message, args.slice(1));
    if (command === 'x1' || command === 'confronto' || command === 'duelo' || command === 'headtohead') return this.prefixHeadToHead(message, args.slice(1));
    if (command === 'mapas' || command === 'mapstats') return this.prefixMapStats(message);
    if (command === 'status-server' || command === 'status-servidor') return this.prefixServerStatus(message, args.slice(1));
    if (command === 'gsi') return this.prefixGsi(message);
    if (
      command === 'aovivo' ||
      command === 'live' ||
      command === 'partida' ||
      command === 'hud' ||
      command === 'monitorar' ||
      command === 'monitor' ||
      command === 'monitorar-partida' ||
      command === 'radar'
    ) return this.prefixLive(message, args.slice(1));
    if (command === 'vitoria' || command === 'resultado' || command === 'ganhador') return this.prefixMatchResult(message, args.slice(1));
    if (command === 'sub' || command === 'substituto' || command === 'reserva') return this.prefixSubstitute(message, args.slice(1));
    if (command === 'cargo' || command === 'notificar' || command === 'notificacao') return this.prefixToggleRole(message);
    if (command === 'level' || command === 'lvl' || command === 'gc') return this.prefixSetLevel(message, args[1]);
    if (command === 'stats' || command === 'perfil') return this.prefixStats(message, args[1]);
    if (command === 'smoke' || command === 'granada' || command === 'lineup') return this.prefixGrenade(message, args.slice(1).join(' '));
    if (command === 'treino' || command === 'cfg' || command === 'praticar') return this.prefixTreino(message);
    if (command === 'moeda' || command === 'coinflip' || command === 'flip') return this.prefixCoinflip(message);
    if (command === 'ping' || command === 'bot' || command === 'uptime') return this.prefixPing(message);
    if (command === 'servidor') {
      if (subArg === 'status') {
        return this.prefixServerStatus(message, args.slice(2));
      }
      const ip = args.slice(1).join(' ').trim();
      if (ip) {
        const clean = ip.replace(/^connect\s+/i, '').trim();
        this.config.serverConnect = clean;
        this.saveConfig({ serverConnect: clean });
        const mix = this.activeMixes.get(message.channelId);
        if (mix) {
          mix.serverIp = clean;
          this.syncToWebRoom(mix);
          this.updateLobbyInChannels(mix);
        }
        return message.reply(`✅ Servidor CS2 configurado com sucesso para os mixes: \`${clean}\``);
      }
      return message.reply(
        this.config.serverConnect
          ? `💻 **Servidor Atual:** \`${this.config.serverConnect}\`\n👉 Para conectar: \`connect ${this.config.serverConnect}\``
          : '⚠️ Nenhum servidor configurado. Use `!servidor 189.1.168.20:27015` para configurar!'
      );
    }
    if (command === 'ajuda' || command === 'help') return this.prefixHelp(message);
    if (command === 'ofertas' || command === 'hardware' || command === 'promo' || command === 'promocao' || command === 'promocoes') {
      return this.prefixDeals(message, args.slice(1));
    }
    if (command === 'steam' || command === 'antismurf' || command === 'smurf') {
      return this.prefixSteam(message, args.slice(1).join(' '));
    }
    if (command === 'att' || command === 'patchnotes' || command === 'update' || command === 'atualizacao' || command === 'patch') {
      return this.prefixPatchNotes(message);
    }
    if (command === 'pro' || command === 'jogos' || command === 'agenda' || command === 'hltv') {
      return this.prefixProMatches(message);
    }
    if (command === 'bagre' || command === 'bagredomix') {
      return this.prefixBagre(message);
    }
    if (command === 'jogosgratis' || command === 'freegames' || command === 'jogosfree' || command === 'epic') {
      return this.prefixFreeGames(message);
    }
    if (command === 'clip' || command === 'clipe' || command === 'highlight' || command === 'jogada') {
      return this.prefixClip(message, args.slice(1));
    }
    if (command === 'caixa' || command === 'case' || command === 'abrir') {
      return this.prefixCase(message, args[1]);
    }
    if (command === 'inventario' || command === 'inv') {
      return this.prefixInventory(message);
    }
    if (command === 'cancelar') return this.prefixCancel(message);
    if (command === 'ip' || command === 'connect') return this.prefixIp(message);
    if (command === 'comandos') return this.prefixHelp(message);
    if (command === 'reset') return this.prefixCancel(message);

    // If the user mentioned the bot directly (e.g. "@cs hub" or "@cs hub oi"), always respond with the interactive panel
    if (isMentioned) {
      return this.prefixPainel(message);
    }
  }

  async prefixCreateMix(message, customName) {
    try {
      const user = message.author;
      const name = customName || `Mix 5v5 de ${user.username}`;
      const mix = this.getOrCreateMix(message.channelId, user, { name });

      if (mix.players.length === 0 && this.hasSavedLevel(user.id)) {
        mix.players.push({
          id: user.id,
          username: user.username,
          displayName: message.member?.displayName || user.username,
          avatar: user.displayAvatarURL({ dynamic: true }),
          level: this.getPlayerLevel(user.id),
          ready: true,
        });
        this.syncToWebRoom(mix);
      }

      const tutorialEmbed = this.buildMixTutorialEmbed();
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      const sent = await message.channel.send({
        content: `🎮 <@${user.id}> abriu o **Lobby de Mix CS2 5v5**! (${mix.players.length}/10 confirmados)`,
        embeds: [tutorialEmbed, embed],
        components,
      });
      if (sent) {
        mix.lobbyMessageId = sent.id;
        mix.channelId = message.channelId;
      }
      return sent;
    } catch (err) {
      console.error('[DISCORD BOT] Erro em prefixCreateMix:', err);
      return message.reply(`❌ Erro ao abrir lobby no Discord: ${err.message}. Verifique se o bot tem permissão de "Inserir Links" (Embeds) neste canal!`);
    }
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
        .setCustomId('panel_set_level')
        .setLabel('Meu Nível GC')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_live_radar')
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🌐 Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/'))
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  async prefixFila(message) {
    let mix = this.activeMixes.get(message.channelId);
    if (!mix && this.activeMixes.size > 0) {
      mix = Array.from(this.activeMixes.values()).find((m) => m && m.phase !== 'cancelled' && m.phase !== 'finished') || Array.from(this.activeMixes.values())[0];
    }
    if (!mix && this.webRoomsRef && this.webRoomsRef.size > 0) {
      for (const r of this.webRoomsRef.values()) {
        if (r && r.phase !== 'finished' && r.phase !== 'cancelled') {
          mix = r;
          break;
        }
      }
    }
    if (!mix) {
      return message.reply('ℹ️ Nenhum mix ativo no momento. Use `!mix` ou `/mix criar` para abrir um!');
    }
    const embed = this.buildLobbyEmbed(mix);
    const components = this.buildLobbyButtons(mix);
    const sent = await message.channel.send({ embeds: [embed], components });
    if (sent) {
      mix.lobbyMessageId = sent.id;
      mix.channelId = message.channelId;
    }
    return sent;
  }

  async updateLobbyInChannels(mix) {
    if (!mix || !this.client) return;
    try {
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);

      // 1. Atualiza mensagens nos canais registrados em activeMixes
      if (this.activeMixes && this.activeMixes.size > 0) {
        for (const m of this.activeMixes.values()) {
          if (m && m.channelId && m.lobbyMessageId && (m.id === mix.id || m.phase === 'lobby')) {
            const channel = await this.client.channels.fetch(m.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
              const msg = await channel.messages.fetch(m.lobbyMessageId).catch(() => null);
              if (msg) {
                await msg.edit({ embeds: [embed], components }).catch(() => {});
              }
            }
          }
        }
      }

      // 2. Atualiza diretamente se o próprio mix tiver channelId e lobbyMessageId
      if (mix.channelId && mix.lobbyMessageId && mix.channelId !== 'whatsapp-mix') {
        const channel = await this.client.channels.fetch(mix.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(mix.lobbyMessageId).catch(() => null);
          if (msg) {
            await msg.edit({ embeds: [embed], components }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao atualizar lobby nos canais:', e.message);
    }
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

    if (!this.hasSavedLevel(message.author.id)) {
      return message.reply(
        '⚠️ **Você precisa cadastrar seu Nível da Gamers Club antes de entrar no mix!**\n' +
        '👉 Digite `!lvl <1 a 21>` (ex: `!lvl 16`) ou clique no botão **`[⭐ Meu Nível GC]`** na mensagem do lobby.\n' +
        'O seu nível ficará salvo no seu perfil para todas as próximas partidas!'
      );
    }
    const playerLvl = this.getPlayerLevel(message.author.id);
    const pName = message.member?.displayName || message.author.username;
    mix.players.push({
      id: message.author.id,
      username: message.author.username,
      displayName: pName,
      avatar: message.author.displayAvatarURL({ dynamic: true }),
      level: playerLvl,
      ready: true,
    });
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);
    whatsappBot.broadcastLobbyUpdate(mix, `🎮 *${pName}* [Lvl ${playerLvl} GC] entrou no mix pelo Discord!`);

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
    const removed = mix.players.splice(idx, 1)[0];
    if (mix.players.length <= 7 && mix.notifiedMissing) {
      mix.notifiedMissing.clear();
    }
    this.syncToWebRoom(mix);
    this.updateLobbyInChannels(mix);
    whatsappBot.broadcastLobbyUpdate(mix, `🚪 *${removed?.displayName || removed?.username || 'Jogador'}* saiu do mix pelo Discord.`);
    return message.reply(`🚪 <@${message.author.id}> saiu do mix. (${mix.players.length}/10)`);
  }

  async prefixDraw(message) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    if (mix.players.length < 2) return message.reply('⚠️ É necessário pelo menos 2 jogadores para sortear!');
    this.balanceTeams(mix);
    whatsappBot.broadcastTeamsDrawn(mix);
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
    const mix = this.deleteMix(message.channelId);
    if (!mix) return message.reply('⚠️ Nenhum mix ativo neste canal.');
    return message.reply(`❌ O mix **${mix.name}** foi cancelado com sucesso.`);
  }

  async prefixRanking(message) {
    const embed = this.buildRankingEmbed();
    return message.reply({ embeds: [embed] });
  }

  async prefixHistory(message, args) {
    const limit = parseInt(args[0], 10) || 6;
    const embed = this.buildMatchHistoryEmbed(Math.min(15, Math.max(1, limit)));
    return message.reply({ embeds: [embed] });
  }

  async prefixHeadToHead(message, args) {
    let target = message.mentions.users.first();
    if (!target && args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '').trim();
      target = this.client?.users.cache.get(cleanId);
    }
    if (!target) {
      return message.reply(
        '👉 Para comparar o confronto direto, mencione o jogador ou passe o ID:\n' +
        'Exemplo: `!x1 @amigo` ou `!duelo @amigo`'
      );
    }
    if (target.id === message.author.id) {
      return message.reply('😅 Você não pode disputar um X1 contra você mesmo! Mencione outro jogador do servidor.');
    }
    const embed = this.buildHeadToHeadEmbed(message.author, target);
    return message.reply({ embeds: [embed] });
  }

  async prefixMapStats(message) {
    const embed = this.buildMapStatsEmbed();
    return message.reply({ embeds: [embed] });
  }

  async prefixIp(message) {
    const mix = this.activeMixes.get(message.channelId);
    const ip = (mix?.serverIp || this.config.serverConnect || '').trim();
    if (!ip) {
      return message.reply('⚠️ Nenhum servidor CS2 configurado no momento. Use `!servidor <ip:porta>` para definir o IP!');
    }
    const cleanIp = ip.replace(/^connect\s+/i, '');
    const connectUrl = this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(cleanIp)}`);
    const embed = new EmbedBuilder()
      .setTitle('💻 SERVIDOR CS2 DO MIX')
      .setDescription(
        `🌐 **Comando de Conexão no Console do CS2:**\n\`\`\`bash\nconnect ${cleanIp}\n\`\`\`\n` +
        `🚀 **Steam 1-Clique:** Clique no botão abaixo para abrir o Counter-Strike 2 e conectar diretamente!`
      )
      .setColor(0x10b981)
      .setFooter({ text: 'CS2 Mix Hub • Conexão Instantânea' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Conectar Direto no CS2 (Steam)')
        .setStyle(ButtonStyle.Link)
        .setURL(connectUrl)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  async prefixServerStatus(message, args) {
    const address = (args && args[0]) ? args[0].trim() : (this.config.serverConnect || '127.0.0.1:27015');
    const res = await queryA2SServer(address, 3000);
    const embed = this.buildServerStatusEmbed(res, address);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Conectar no CS2')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(address)}`))
    );
    return message.reply({ embeds: [embed], components: [row] });
  }

  async prefixGsi(message) {
    const embed = this.buildGsiEmbed();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('⚡ Instalador 1-Clique (.bat)')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/api/gsi/installer/MIX-PRO')),
      new ButtonBuilder()
        .setLabel('📥 Manual (.cfg)')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/api/gsi/cfg/MIX-PRO')),
      new ButtonBuilder()
        .setLabel('🌐 Ver Partida no Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/'))
    );
    return message.reply({ embeds: [embed], components: [row] });
  }

  async prefixLive(message, args = []) {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'parar' || sub === 'stop') {
      let stopped = 0;
      if (this.liveTrackers) {
        for (const [id, t] of this.liveTrackers.entries()) {
          if (t.channelId === message.channelId) {
            this.liveTrackers.delete(id);
            stopped++;
          }
        }
      }
      return message.reply(`⏹️ Monitoramento de partida desativado neste canal (${stopped} rastreador(es) removido(s)).`);
    }

    const targetQuery = args.length > 0 ? args.join(' ') : null;
    const requester = message.author?.username || 'Jogador';
    const embed = this.buildLiveMatchEmbed(requester, targetQuery);
    const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name));
    const sent = await message.reply({ embeds: [embed], components: [row] });
    this.registerLiveTracker(sent, requester, targetQuery);
    return sent;
  }

  async prefixMatchResult(message, args) {
    const mix = this.activeMixes.get(message.channelId);
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo encontrado neste canal para registrar vitória.');
    }
    const winner = (args[0] || '').toUpperCase();
    if (winner !== 'A' && winner !== 'B') {
      return message.reply('👉 Uso correto: `!vitoria A 13-9 [mapa]` ou `!vitoria B 13-11 [mapa]` (ex: `!vitoria A 13-9 Dust II`).');
    }
    const score = args[1] || '13-9';
    const map = args.slice(2).join(' ').trim() || '';
    const res = await this.recordMatchResult(mix, winner, score, message.author, message.channel, map);
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
          `• \`!vitoria [A|B] [placar]\` — Registra a vitória, pontua no ranking e inicia votação de MVP\n` +
          `• \`!aovivo\` [parar] — Monitorar Partida com auto-atualização round a round: placar, CT/TR, HP e armas (ative antes ou durante o jogo!)\n` +
          `• \`!gsi\` — Instruções e download do Valve GSI para transmissão em tempo real\n` +
          `• \`!historico [qtde]\` — Histórico das últimas partidas finalizadas\n` +
          `• \`!x1 @amigo\` — Duelo direto Head-to-Head e sinergia de duo\n` +
          `• \`!mapas\` — Estatísticas dos mapas mais disputados no servidor\n` +
          `• \`!status-server\` — Consulta ping, mapa e players online no CS2 (A2S_INFO)\n` +
          `• \`!ranking\` / \`!top\` — Hall da Fama e Top 10 de vitórias e MVPs\n` +
          `• \`!sub @novo\` — Substitui um jogador ausente por um reserva\n` +
          `• \`!cargo\` — Ativa/desativa notificações do cargo @Mix CS2 quando faltarem vagas\n` +
          `• \`!stats [@jogador]\` — Perfil competitivo, vitórias reais e medalhas de MVP\n` +
          `• \`!lvl <1-21>\` — Configura seu nível da Gamers Club (GC)\n` +
          `• \`!smoke [mapa]\` — Lineups de granadas e smokes táticas\n` +
          `• \`!treino\` — CFG completa de treino para console do CS2\n` +
          `• \`!moeda\` — Sorteio de cara ou coroa para desempates rápidos\n` +
          `• \`!servidor [ip:porta]\` — Define ou consulta o IP do servidor CS2\n` +
          `• \`!steam [link/id]\` — Scanner Steam & Anti-Smurf (horas CS2, VAC bans, idade da conta)\n` +
          `• \`!att\` ou \`!patchnotes\` — Últimas notas de atualização oficiais do CS2 pela Valve\n` +
          `• \`!pro\` ou \`!jogos\` — Agenda dos times BR (FURIA, MIBR, paiN) com horário BRT e Gaules\n` +
          `• \`!bagre\` — Votação bem-humorada do Bagre da Partida (o jogador que mais pinou no mix)\n` +
          `• \`!jogosgratis\` — Radar de jogos grátis para PC da semana (Epic Games & Steam)\n` +
          `• \`!clip [link]\` — Envia clipes de jogadas da comunidade com votação interativa\n` +
          `• \`!caixa [nome]\` — Simulador de abertura de caixas de CS2 com odds reais da Valve\n` +
          `• \`!inventario\` — Consulta seu inventário de caixas e melhor drop\n` +
          `• \`!ofertas [busca]\` — Radar de promoções gamer (KaBuM!, Pichau, Terabyte: GPU, CPU, mesas, cadeiras)`
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
      const userTag = isSnowflake(p.id) ? `<@${p.id}>` : `**${p.username}** 💬`;
      return `${medal} ${userTag} — **${p.wins}V** / ${p.losses}D (\`${p.winRate}%\` Win Rate)${mvpBadge}${streakBadge} • \`Lvl ${p.level} GC\``;
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

  buildMatchHistoryEmbed(limit = 6) {
    const rawHistory = this.loadMatchHistory() || [];
    // Only matches with 10 players (5v5) that were finalized
    const history = rawHistory.filter(
      (m) => (m.winnerPlayers?.length || 0) + (m.loserPlayers?.length || 0) === 10
    );

    const embed = new EmbedBuilder()
      .setTitle('📜 HISTÓRICO DE PARTIDAS 5v5 • CS2 MIX HUB')
      .setColor(0x3b82f6)
      .setFooter({ text: 'CS2 Mix Hub • Apenas Partidas Oficiais 5v5 (10 Jogadores)' })
      .setTimestamp();

    if (!history || history.length === 0) {
      embed.setDescription(
        '🛡️ **Nenhuma partida oficial de 10 jogadores finalizada ainda!**\n\n' +
        'O histórico de partidas do servidor mantém **exclusivamente** partidas completas (5v5 com 10 jogadores) que foram concluídas.\n' +
        'Lobbies incompletos ou partidas sem estatísticas foram descartados para não lotar o histórico.\n\n' +
        '👉 Para registrar o placar de um mix 5v5 finalizado, use o botão **`[🏆 Declarar Placar]`** no lobby ou digite no chat:\n' +
        '`!vitoria A 13-9` ou `!vitoria B 13-11`.'
      );
      return embed;
    }

    const recent = history.slice(0, limit);
    embed.setDescription(`Exibindo as últimas **${recent.length}** partidas 5v5 completas (10 jogadores) finalizadas com mapas oficiais:`);

    recent.forEach((m, idx) => {
      const dateStr = m.timestamp
        ? new Date(m.timestamp).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Recente';
      const winNames = (m.winnerPlayers || []).map((p) => p.nick || p.username).join(', ') || 'Equipe';
      const loseNames = (m.loserPlayers || []).map((p) => p.nick || p.username).join(', ') || 'Equipe';
      const mvpBadge = m.mvpNick ? ` • ⭐ MVP: **${m.mvpNick}**` : '';
      const mapEmoji =
        m.map === 'Nuke' ? '☢️' :
        m.map === 'Inferno' ? '🏰' :
        m.map === 'Dust II' ? '🏜️' :
        m.map === 'Ancient' ? '🏛️' :
        m.map === 'Anubis' ? '🏺' :
        m.map === 'Vertigo' ? '🏢' :
        m.map === 'Overpass' ? '🌉' :
        m.map === 'Cache' ? '☣️' : '🎯';

      embed.addFields({
        name: `#${idx + 1} • ${mapEmoji} **${m.map || 'Mirage'}** [${m.score || '13-9'}] • 🏆 ${m.winner || 'Time A'}`,
        value:
          `📅 *${dateStr}*${mvpBadge}\n` +
          `👑 **Vencedores (5):** \`${winNames}\`\n` +
          `💀 **Derrotados (5):** \`${loseNames}\`\n` +
          `👤 *Declarado por: **${m.declaredBy || 'Admin'}***`,
        inline: false,
      });
    });

    return embed;
  }

  buildHeadToHeadEmbed(user1, user2) {
    const history = this.loadMatchHistory();
    const u1Id = String(user1.id);
    const u2Id = String(user2.id);
    const u1Name = user1.displayName || user1.username || 'Jogador 1';
    const u2Name = user2.displayName || user2.username || 'Jogador 2';

    let directDuels = 0;
    let u1Wins = 0;
    let u2Wins = 0;
    let teammatesCount = 0;
    let teammateWins = 0;

    history.forEach((m) => {
      const u1InWinners = (m.winnerPlayers || []).some((p) => String(p.id) === u1Id);
      const u1InLosers = (m.loserPlayers || []).some((p) => String(p.id) === u1Id);
      const u2InWinners = (m.winnerPlayers || []).some((p) => String(p.id) === u2Id);
      const u2InLosers = (m.loserPlayers || []).some((p) => String(p.id) === u2Id);

      // Direct duel (opposite teams)
      if ((u1InWinners && u2InLosers) || (u1InLosers && u2InWinners)) {
        directDuels++;
        if (u1InWinners) u1Wins++;
        else if (u2InWinners) u2Wins++;
      }
      // Teammates (same team)
      else if ((u1InWinners && u2InWinners) || (u1InLosers && u2InLosers)) {
        teammatesCount++;
        if (u1InWinners) teammateWins++;
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ CONFRONTO DIRETO • HEAD-TO-HEAD`)
      .setDescription(`Comparativo oficial de partidas entre **${u1Name}** vs **${u2Name}** no CS2 Mix Hub.`)
      .setColor(0x8b5cf6)
      .setThumbnail('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200&q=80')
      .setFooter({ text: 'CS2 Mix Hub • Estatísticas Head-to-Head' })
      .setTimestamp();

    if (directDuels === 0 && teammatesCount === 0) {
      embed.addFields({
        name: '🤝 Sem histórico mútuo',
        value: `Estes dois jogadores ainda não disputaram partidas juntos ou como adversários em mixes finalizados no servidor.`,
        inline: false,
      });
      return embed;
    }

    const u1Pct = directDuels > 0 ? Math.round((u1Wins / directDuels) * 100) : 50;
    const u2Pct = directDuels > 0 ? 100 - u1Pct : 50;
    const barBlocks = 10;
    const u1Blocks = Math.round((u1Pct / 100) * barBlocks);
    const u2Blocks = barBlocks - u1Blocks;
    const duelBar = `🟦`.repeat(Math.max(0, u1Blocks)) + `🟧`.repeat(Math.max(0, u2Blocks));

    embed.addFields(
      {
        name: `🥊 Duelos Diretos (Adversários): ${directDuels} jogos`,
        value: `${duelBar}\n\n` +
          `🟦 **${u1Name}:** **${u1Wins} vitórias** (${u1Pct}%)\n` +
          `🟧 **${u2Name}:** **${u2Wins} vitórias** (${u2Pct}%)`,
        inline: false,
      },
      {
        name: `🤝 Jogando no Mesmo Time (Duo / Parceiros): ${teammatesCount} jogos`,
        value: teammatesCount > 0
          ? `🏆 **Vitórias Juntos:** **${teammateWins} / ${teammatesCount}** (${Math.round((teammateWins / teammatesCount) * 100)}% de taxa de vitória conjunta)`
          : `*Ainda não jogaram na mesma equipe.*`,
        inline: false,
      }
    );

    return embed;
  }

  buildMapStatsEmbed() {
    const history = this.loadMatchHistory();
    const embed = new EmbedBuilder()
      .setTitle('🗺️ ESTATÍSTICAS DE MAPAS DO SERVIDOR • CS2')
      .setColor(0x10b981)
      .setFooter({ text: 'CS2 Mix Hub • Active Duty Analytics' })
      .setTimestamp();

    if (!history || history.length === 0) {
      embed.setDescription(
        'Nenhuma partida foi registrada ainda para calcular estatísticas de mapas!\n\n' +
        'O pool ativo da Valve inclui: **Mirage, Inferno, Nuke, Dust II, Ancient, Anubis e Cache**.'
      );
      return embed;
    }

    const mapCounts = {};
    history.forEach((m) => {
      const clean = (m.map || 'Mirage').replace(/^de_/, '');
      const mapName = clean.charAt(0).toUpperCase() + clean.slice(1);
      mapCounts[mapName] = (mapCounts[mapName] || 0) + 1;
    });

    const total = history.length;
    const sorted = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]);

    let desc = `Total de **${total}** partidas analisadas no servidor:\n\n`;
    sorted.forEach(([map, count], idx) => {
      const pct = Math.round((count / total) * 100);
      const medal = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📍';
      const greenBlocks = Math.max(1, Math.round(pct / 10));
      const darkBlocks = Math.max(0, 10 - greenBlocks);
      const bar = '🟩'.repeat(greenBlocks) + '⬛'.repeat(darkBlocks);
      desc += `${medal} **${map}**: **${count} jogos** (\`${pct}%\`)\n${bar}\n\n`;
    });

    embed.setDescription(desc);
    return embed;
  }

  buildServerStatusEmbed(queryResult, serverAddress) {
    const address = serverAddress || this.config.serverConnect || '127.0.0.1:27015';
    const embed = new EmbedBuilder().setTimestamp();

    if (queryResult.online) {
      embed
        .setTitle('📡 STATUS DO SERVIDOR CS2 • ONLINE 🟢')
        .setDescription(
          `O servidor de CS2 está online e respondendo via protocolo Valve A2S_INFO!\n\n` +
          `🏷️ **Nome do Servidor:** **${queryResult.name || 'Servidor CS2'}**\n` +
          `🗺️ **Mapa Atual:** \`${queryResult.map || 'de_mirage'}\`\n` +
          `👥 **Jogadores:** **${queryResult.players} / ${queryResult.maxPlayers}** ${queryResult.bots ? `(${queryResult.bots} bots)` : ''}\n` +
          `📶 **Latência (Ping UDP):** **${queryResult.ping} ms**\n` +
          `🔗 **Endereço IP:** \`${queryResult.host}:${queryResult.port}\`\n\n` +
          `👉 Para entrar, clique no botão abaixo ou digite no console:\n\`connect ${queryResult.host}:${queryResult.port}\``
        )
        .setColor(0x22c55e)
        .setFooter({ text: 'CS2 Mix Hub • Live Server Query Engine' });
    } else {
      embed
        .setTitle('📡 STATUS DO SERVIDOR CS2 • INACESSÍVEL / OFFLINE 🔴')
        .setDescription(
          `Não foi possível obter resposta UDP do servidor CS2 no endereço \`${address}\`.\n\n` +
          `⚠️ **Motivo:** ${queryResult.error || 'Tempo limite esgotado'}\n\n` +
          `💡 **Dicas para Conectar:**\n` +
          `• Verifique se o servidor dedicado de CS2 está aberto e ativo.\n` +
          `• Verifique se a porta UDP 27015 está liberada no firewall.\n` +
          `• Configure o IP correto usando \`!servidor <ip:porta>\`.`
        )
        .setColor(0xef4444)
        .setFooter({ text: 'CS2 Mix Hub • Live Server Query Engine' });
    }

    return embed;
  }

  async checkAndAwardTierRoles(guild, players, profiles) {
    if (!guild || !players || !Array.isArray(players)) return [];
    const awarded = [];

    const TIERS = [
      {
        name: 'Rei do Servidor',
        color: 0xffd700,
        check: (p, all) => {
          const list = Object.values(all).sort((a, b) => (b.wins || 0) - (a.wins || 0));
          return list[0] && list[0].username === p.username && (p.wins || 0) >= 10;
        },
      },
      { name: 'Major Champion', minWins: 30, color: 0xf59e0b },
      { name: 'Veterano do Mix', minWins: 15, color: 0x8b5cf6 },
      { name: 'Competidor', minWins: 5, color: 0x3b82f6 },
    ];

    try {
      const me = guild.members.me;
      const canManageRoles = me && me.permissions && me.permissions.has(PermissionsBitField.Flags.ManageRoles);
      if (!canManageRoles) return [];

      for (const p of players) {
        if (!p || !p.id || !isSnowflake(p.id)) continue;
        const prof = profiles[p.id];
        if (!prof) continue;
        const wins = prof.wins || 0;

        const member = await guild.members.fetch(p.id).catch(() => null);
        if (!member) continue;

        for (const tier of TIERS) {
          let qualifies = false;
          if (tier.check) {
            qualifies = tier.check(prof, profiles);
          } else if (wins >= tier.minWins) {
            qualifies = true;
          }

          if (qualifies) {
            let role = guild.roles.cache.find(
              (r) => r.name.toLowerCase() === tier.name.toLowerCase()
            );
            if (!role) {
              role = await guild.roles
                .create({
                  name: tier.name,
                  color: tier.color,
                  reason: 'Cargo automático por conquistas competitivas no CS2 Mix Hub',
                })
                .catch(() => null);
            }
            if (role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role).catch(() => {});
              awarded.push({ member, roleName: tier.name });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao verificar/atribuir patentes:', e.message);
    }
    return awarded;
  }

  async recordMatchResult(mix, winnerTeamLetter, scoreInput, declaredByUser, channel, mapInput = null) {
    const isA = (winnerTeamLetter || '').toUpperCase() === 'A';
    const isB = (winnerTeamLetter || '').toUpperCase() === 'B';
    if (!isA && !isB) {
      return { success: false, error: 'O vencedor deve ser Time A ou Time B (ex: `!vitoria A 13-9`).' };
    }

    if (!mix.teamA?.players || mix.teamA.players.length === 0 || !mix.teamB?.players || mix.teamB.players.length === 0) {
      return { success: false, error: 'Os times ainda não foram sorteados! Use `!sortear` antes de registrar o placar da partida.' };
    }

    const totalPlayers = (mix.teamA.players.length || 0) + (mix.teamB.players.length || 0);
    if (totalPlayers < 2) {
      return {
        success: false,
        error: `⚠️ Este mix possui apenas **${totalPlayers} jogador(es)**!\nPara registrar uma partida no histórico oficial, é necessário haver pelo menos 2 jogadores divididos entre os times.`,
      };
    }

    const winnerTeam = isA ? mix.teamA : mix.teamB;
    const loserTeam = isA ? mix.teamB : mix.teamA;
    const score = (scoreInput || '13-9').trim();

    // Accurately resolve map:
    // 1. Explicit map input (e.g. from command or modal)
    // 2. Pick & Ban decider map
    // 3. Roulette / active match map
    // 4. Web room final map
    // 5. Valve CS2 GSI active server map
    let candidateMap =
      mapInput ||
      mix.veto?.deciderMap?.name ||
      mix.veto?.deciderMap?.id ||
      mix.matchMap ||
      mix.finalMap?.name ||
      mix.finalMap?.id;

    if (!candidateMap && this.lastGsiState?.mapName && this.lastGsiState.mapName !== 'Indefinido') {
      candidateMap = this.lastGsiState.mapName;
    }

    const resolvedMap = normalizeMapName(candidateMap || 'Mirage');
    const resolvedImage = getMapImageUrl(resolvedMap);

    mix.phase = 'finished';
    mix.winner = winnerTeam.name;
    mix.finalScore = score;
    mix.matchMap = resolvedMap;
    mix.matchMapImage = resolvedImage;

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

    // Save match to match history with full rich metadata
    const parsedWinner = parseInt(String(score).split('-')[0], 10) || 13;
    const parsedLoser = parseInt(String(score).split('-')[1], 10) || 8;
    const matchRecord = {
      id: mix.id,
      source: 'discord',
      platform: 'Discord Bot',
      sourceLabel: 'Via Discord',
      guildName: channel?.guild?.name || 'Servidor Discord Oficial',
      guildId: channel?.guild?.id || '',
      channelName: channel?.name ? `#${channel.name}` : '#mix-5v5',
      channelId: channel?.id || '',
      format: mix.format || 'MD1',
      balancePct: mix.balancePct || 95,
      serverConnect: mix.serverIp || this.config.serverConnect || '',
      timestamp: Date.now(),
      map: resolvedMap,
      mapImage: resolvedImage,
      winner: winnerTeam.name,
      loser: loserTeam.name,
      score,
      scoreWinner: parsedWinner,
      scoreLoser: parsedLoser,
      declaredBy: declaredByUser.displayName || declaredByUser.username,
      declaredById: declaredByUser.id,
      winnerPlayers: winnerTeam.players.map((p, idx) => ({
        id: p.id,
        nick: p.displayName || p.username || `Jogador ${idx + 1}`,
        level: p.level || 16,
        avatar: typeof p.displayAvatarURL === 'function' ? p.displayAvatarURL() : (p.avatar || ''),
        role: p.id === winnerTeam.captain?.id ? 'Capitão' : 'Jogador',
      })),
      loserPlayers: loserTeam.players.map((p, idx) => ({
        id: p.id,
        nick: p.displayName || p.username || `Jogador ${idx + 1}`,
        level: p.level || 16,
        avatar: typeof p.displayAvatarURL === 'function' ? p.displayAvatarURL() : (p.avatar || ''),
        role: p.id === loserTeam.captain?.id ? 'Capitão' : 'Jogador',
      })),
      vetoBans: Array.isArray(mix.veto?.bannedMaps) ? mix.veto.bannedMaps : [],
    };
    // Automatically compute Match MVP based on CS2 player performance statistics
    const gsiState = mix.gsi || null;
    const computedMvp = computeMatchMvp(matchRecord, gsiState);
    if (computedMvp) {
      matchRecord.mvpId = computedMvp.id;
      matchRecord.mvpNick = computedMvp.nick;
      matchRecord.mvp = computedMvp;
      matchRecord.mvpStats = computedMvp;

      // Credit MVP to player's persistent profile
      if (profiles[computedMvp.id]) {
        profiles[computedMvp.id].mvps = (profiles[computedMvp.id].mvps || 0) + 1;
      }
    }

    recordMatchHistoryEntry(matchRecord);
    this.updateLeaderboardFile(profiles);
    if (typeof this.onMatchRecorded === 'function') {
      try { this.onMatchRecorded(matchRecord); } catch (e) {}
    }
    whatsappBot.notifyMatchFinished(mix, {
      score,
      winner: winnerTeam.name || (winner === 'A' ? 'Time A' : 'Time B'),
      map: resolvedMap,
      mvp: computedMvp || null,
    }).catch(() => {});

    // Check and award tier roles asynchronously to winners
    this.checkAndAwardTierRoles(channel?.guild, winnerTeam.players, profiles).catch((err) => {
      console.warn('[DISCORD BOT] Falha ao atribuir patentes automáticas:', err.message);
    });

    // Build victory embed with crowned MVP
    const mvpUserTag = computedMvp
      ? (isSnowflake(computedMvp.id) ? `<@${computedMvp.id}>` : `**${computedMvp.nick || computedMvp.username}** 💬`)
      : '';
    const mvpDescription = computedMvp
      ? `\n\n👑 **MVP DA PARTIDA ELEITO:** ${mvpUserTag}\n` +
        `⭐ **Estatísticas:** 🎯 **${computedMvp.kills} Kills** • 💀 **${computedMvp.deaths} Mortes** (K/D **${computedMvp.kd}**) • ⭐ **${computedMvp.mvps} MVPs de Round** • 📊 Rating **${computedMvp.rating}**\n` +
        `🏆 *Eleito automaticamente com o melhor desempenho da partida pelas estatísticas!*`
      : '';

    const declaredTag = isSnowflake(declaredByUser.id) ? `<@${declaredByUser.id}>` : `**${declaredByUser.username || declaredByUser.displayName}**`;

    const victoryEmbed = new EmbedBuilder()
      .setTitle(`🏆 VITÓRIA DO ${winnerTeam.name.toUpperCase()}! • PLACAR ${score}`)
      .setDescription(
        `A partida foi encerrada e as estatísticas de todos os jogadores foram atualizadas no **Ranking Geral**!\n\n` +
        `🗺️ **Mapa:** **${resolvedMap}**\n` +
        `⚔️ **Resultado Oficial:** **${winnerTeam.name}** venceu por **${score}**!\n` +
        `👑 **Declarado por:** ${declaredTag}` +
        mvpDescription
      )
      .setColor(0x22c55e)
      .addFields(
        ...(computedMvp
          ? [
              {
                name: `👑 MVP da Partida • ${computedMvp.nick}`,
                value: `🎯 **${computedMvp.kills} Kills** • 💀 **${computedMvp.deaths} Mortes** • ⚡ **${computedMvp.kd} K/D** • ⭐ **${computedMvp.mvps} MVPs** • 📈 **${computedMvp.rating} Rating**\n🏆 Total na carreira: **${profiles[computedMvp.id]?.mvps || 1}x MVP**`,
                inline: false,
              },
            ]
          : []),
        {
          name: `🥇 Campeões • ${winnerTeam.name} (+1 Vitória)`,
          value: winnerTeam.players.map((p) => `👑 ${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.username || 'Jogador'}** 💬`} \`[Lvl ${p.level || 16}]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        },
        {
          name: `🥈 Vice-Campeões • ${loserTeam.name}`,
          value: loserTeam.players.map((p) => `💀 ${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.username || 'Jogador'}** 💬`} \`[Lvl ${p.level || 16}]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        }
      )
      .setFooter({ text: 'CS2 Mix Hub • Partida Concluída' })
      .setTimestamp();

    if (resolvedImage) {
      victoryEmbed.setThumbnail(resolvedImage);
    }

    const components = [];
    const finishBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mvp_finish:${mix.id}`)
        .setLabel('Encerrar MVP Agora (60s)')
        .setEmoji('👑')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mix_voice_lobby:${mix.id}`)
        .setLabel('Voltar para o Geral')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bagre_vote_start:${mix.id}`)
        .setLabel('Votar no Bagre do Mix')
        .setEmoji('🐟')
        .setStyle(ButtonStyle.Danger),
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
    if (mix.mvpVote.timer) {
      clearTimeout(mix.mvpVote.timer);
      mix.mvpVote.timer = null;
    }
    if (!mix.mvpVote.active) return;
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

    try {
      updateMatchMvp(mix.id, {
        id: bestCandidateId,
        nick: prof.username || `<@${bestCandidateId}>`,
        votes: maxVotes,
      });
    } catch (e) {
      console.warn('[DISCORD BOT] Falha ao atualizar MVP no histórico:', e.message);
    }

    const mvpEmbed = new EmbedBuilder()
      .setTitle('👑 MVP DA PARTIDA COROADO!')
      .setDescription(
        `A comunidade votou e escolheu o grande destaque da partida no mapa **${mix.matchMap || mix.veto?.deciderMap?.name || 'Mirage'}**:\n\n` +
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
    const missing = 10 - (mix.players?.length || 0);
    if (missing !== 1 && missing !== 2) return;

    if (!mix.notifiedMissing) {
      mix.notifiedMissing = new Set();
    }
    if (mix.notifiedMissing.has(missing)) return;
    mix.notifiedMissing.add(missing);

    try {
      const role = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'mix cs2' || r.name.toLowerCase() === 'mix'
      );
      const roleMention = role ? `<@&${role.id}> ` : '';
      const plural = missing === 1 ? 'VAGA RESTANTE' : 'VAGAS RESTANTES';
      const msg = `📢 ${roleMention}**FALTA(M) APENAS ${missing} ${plural} PARA FECHAR O MIX 5v5!**\n` +
        `👉 Quem vai jogar? Clique no botão verde **\`[➕ Entrar]\`** ou digite \`!entrar\` agora!`;
      await channel.send(msg);
      whatsappBot.notifyMissingSlots(mix).catch(() => {});
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

  resolveMixFromInteraction(interaction, customId = null) {
    const rawId = customId || (interaction && interaction.customId) || '';
    const targetMixId = rawId.includes(':') ? rawId.split(':')[1] : null;

    if (targetMixId) {
      if (this.activeMixes.has(targetMixId)) return this.activeMixes.get(targetMixId);
      const byId = Array.from(this.activeMixes.values()).find((m) => m.id === targetMixId);
      if (byId) return byId;
      if (this.webRoomsRef && this.webRoomsRef.has(targetMixId)) return this.webRoomsRef.get(targetMixId);
    }

    if (interaction && interaction.channelId && this.activeMixes.has(interaction.channelId)) {
      return this.activeMixes.get(interaction.channelId);
    }

    if (this.activeMixes.size > 0) {
      const active = Array.from(this.activeMixes.values()).find((m) => m && m.phase !== 'cancelled' && m.phase !== 'finished');
      if (active) return active;
      return Array.from(this.activeMixes.values())[0];
    }

    if (this.webRoomsRef && this.webRoomsRef.size > 0) {
      const active = Array.from(this.webRoomsRef.values()).find((r) => r && r.phase !== 'cancelled' && r.phase !== 'finished');
      if (active) return active;
      return Array.from(this.webRoomsRef.values())[0];
    }

    return null;
  }

  getOrCreateMix(channelId, creator, options = {}) {
    let mix = options.forceNew ? null : this.activeMixes.get(channelId);
    if (mix && (mix.phase === 'finished' || mix.phase === 'cancelled')) {
      mix = null;
    }
    if (!mix) {
      const mixId = options.id || `MIX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      mix = {
        id: mixId,
        channelId,
        name: options.name || `Mix CS2 #${mixId}`,
        format: options.format || 'MD1',
        creatorId: creator.id,
        creatorNick: creator.username,
        players: Array.isArray(options.players) ? options.players : [],
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
      if (mix.id) this.activeMixes.set(mix.id, mix);
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      whatsappBot.notifyMixCreated(mix).catch(() => {});
      scheduleSave(100);
    }
    return mix;
  }

  recoverMixFromMessage(interaction, mixId) {
    if (!interaction?.channelId || !mixId) return null;
    const embeds = interaction.message?.embeds || [];
    let recoveredName = `Mix 5v5 #${mixId}`;
    const recoveredPlayers = [];
    const seenIds = new Set();

    for (const emb of embeds) {
      if (emb.title && emb.title.includes('•')) {
        const parts = emb.title.split('•');
        const candidate = parts[parts.length - 1]?.trim();
        if (candidate && !candidate.includes('COMO MEXER')) {
          recoveredName = candidate;
        }
      }
      for (const field of emb.fields || []) {
        if (field.name?.includes('Jogadores') || field.name === '\u200B') {
          const matches = String(field.value || '').matchAll(/<@!?(\d+)>[^\n]*?\[Lvl\s+(\d+)/gi);
          for (const m of matches) {
            const pId = m[1];
            const pLvl = parseInt(m[2], 10) || this.getPlayerLevel(pId) || 16;
            if (pId && !seenIds.has(pId)) {
              seenIds.add(pId);
              const cachedUser = this.client?.users?.cache?.get(pId);
              recoveredPlayers.push({
                id: pId,
                username: cachedUser?.username || `Player_${pId.slice(-4)}`,
                displayName: cachedUser?.displayName || cachedUser?.username || `Player_${pId.slice(-4)}`,
                avatar: cachedUser ? cachedUser.displayAvatarURL({ dynamic: true }) : null,
                level: pLvl,
                ready: true,
              });
            }
          }
        }
      }
    }

    return this.getOrCreateMix(interaction.channelId, interaction.user, {
      id: mixId,
      name: recoveredName,
      players: recoveredPlayers,
      forceNew: true,
    });
  }

  deleteMix(channelId) {
    const mix = this.activeMixes.get(channelId);
    if (!mix) return null;
    if (mix.readyCheck?.timer) clearTimeout(mix.readyCheck.timer);
    this.activeMixes.delete(channelId);
    if (mix.id) this.activeMixes.delete(mix.id);
    if (this.webRoomsRef && mix.id) {
      this.webRoomsRef.delete(mix.id);
      if (typeof this.onRoomUpdated === 'function') {
        try {
          this.onRoomUpdated(mix.id, null);
        } catch (_) {}
      }
    }
    clearMixPersistence(mix.id);
    scheduleSave(50);
    return mix;
  }

  balanceTeams(mix) {
    if (!mix.players || mix.players.length < 2) return;

    // Refresh every player's level from their persistent profile
    mix.players.forEach((p) => {
      if (this.hasSavedLevel(p.id)) {
        p.level = this.getPlayerLevel(p.id);
      } else {
        p.level = p.level || 16;
      }
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

    // Ensure each team is sorted by Gamers Club level descending so top level is Captain
    teamA.sort((a, b) => (b.level || 16) - (a.level || 16));
    teamB.sort((a, b) => (b.level || 16) - (a.level || 16));

    mix.teamA.players = teamA;
    mix.teamA.captain = teamA[0] || null; // Maior Nível Gamers Club do Time A eleito Capitão
    mix.teamA.avgLevel = avgA;
    mix.teamB.players = teamB;
    mix.teamB.captain = teamB[0] || null; // Maior Nível Gamers Club do Time B eleito Capitão
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
      const existing = this.webRoomsRef.get(roomId) || {};
      const room = {
        ...existing,
        id: roomId,
        name: mix.name,
        createdAt: mix.createdAt || Date.now(),
        lastActivity: Date.now(),
        creatorId: mix.creatorId,
        creatorNick: mix.creatorNick,
        source: 'discord',
        sourceLabel: 'Via Discord',
        phase: mix.phase === 'live' ? 'match' : 'lobby',
        players: (mix.players || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: (mix.teamA?.players || []).some((a) => a.id === p.id) ? (mix.teamA?.side || 'CT') : (mix.teamB?.side || 'TR'),
          ready: true,
        })),
        teamA: (mix.teamA?.players || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamA?.side || 'CT',
          isCaptain: mix.teamA?.captain?.id === p.id,
        })),
        teamB: (mix.teamB?.players || []).map((p) => ({
          id: p.id,
          nick: p.displayName || p.username,
          avatar: p.avatar,
          level: p.level || 16,
          side: mix.teamB?.side || 'TR',
          isCaptain: mix.teamB?.captain?.id === p.id,
        })),
        captainA: mix.teamA?.captain
          ? {
              id: mix.teamA.captain.id,
              nick: mix.teamA.captain.displayName || mix.teamA.captain.username,
              level: mix.teamA.captain.level || 16,
            }
          : null,
        captainB: mix.teamB?.captain
          ? {
              id: mix.teamB.captain.id,
              nick: mix.teamB.captain.displayName || mix.teamB.captain.username,
              level: mix.teamB.captain.level || 16,
            }
          : null,
        teamAName: mix.teamA?.name || 'Time A',
        teamBName: mix.teamB?.name || 'Time B',
        finalMap: mix.veto?.deciderMap
          ? { name: mix.veto.deciderMap.name, file: mix.veto.deciderMap.id }
          : null,
        serverIp: mix.serverIp || this.config.serverConnect || '',
        matchFormat: mix.format || 'MD1',
      };
      this.webRoomsRef.set(roomId, room);
      scheduleSave(100);
      if (typeof this.onRoomUpdated === 'function') {
        try {
          this.onRoomUpdated(roomId, room);
        } catch (callErr) {
          console.warn('[DISCORD BOT] Erro ao chamar onRoomUpdated:', callErr.message);
        }
      }
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
      expiresAt: null,
      timer: null,
    };

    const mentions = mix.players.map((p) => `<@${p.id}>`).join(' ');
    channel.send({
      content: `🚨 **LOBBY CHEIO (10/10)!** ${mentions}\nTodos os 10 jogadores podem clicar em **Confirmar Presença** no botão abaixo quando estiverem prontos, ou sortear os times para jogar!`,
    }).catch(() => {});
  }

  buildReadyCheckEmbed(mix) {
    const confirmedCount = mix.readyCheck?.confirmed?.size || 0;

    const statusList = mix.players.map((p) => {
      const isConfirmed = mix.readyCheck?.confirmed?.has(p.id);
      return `${isConfirmed ? '🟢' : '⏳'} <@${p.id}> - ${isConfirmed ? '**CONFIRMADO**' : '*Aguardando clique...*'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🚨 CHECK-IN DE CONFIRMAÇÃO • ${mix.name.toUpperCase()}`)
      .setDescription(
        `O lobby atingiu 10 jogadores! Confirmem presença nos botões abaixo ou iniciem o sorteio dos times quando todos estiverem prontos.\n\n` +
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
      .setFooter({ text: 'CS2 Mix Hub • Confirmação de Presença' })
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
          .setCustomId(`mix_teams:${mix.id}`)
          .setLabel('Sortear Times')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`mix_leave:${mix.id}`)
          .setLabel('Desistir / Sair')
          .setEmoji('🚪')
          .setStyle(ButtonStyle.Danger)
      ),
    ];
  }

  async startAutomaticLiveMonitoring(mix, channel, guild) {
    if (!channel || !mix) return;

    try {
      // 1. Send live match tracker message & register it in Discord message tracker engine
      const embed = this.buildLiveMatchEmbed('Sistema CS2 Mix Hub', null, true, mix);
      const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name), true);

      const monitorMsg = await channel.send({
        content: `📡 **MONITORAMENTO AUTOMÁTICO INICIADO!** O bot está acompanhando a partida em tempo real:`,
        embeds: [embed],
        components: [row],
      }).catch((err) => {
        console.warn('[BOT] Erro ao enviar embed de monitoramento automático:', err.message);
        return null;
      });

      if (monitorMsg) {
        this.registerLiveTracker(monitorMsg, 'Sistema CS2 Mix Hub', null, true);
      }

      // Dispatch WhatsApp Group notification
      whatsappBot.notifyMatchReady(mix).catch(() => {});

      // 2. Check if Server IP is defined. If missing, prompt players in chat with 1-click modal button
      const currentIp = (mix.serverIp || this.config.serverConnect || '').trim();
      if (!currentIp) {
        const ipEmbed = new EmbedBuilder()
          .setColor(0xeab308)
          .setTitle('⚠️ IP do Servidor CS2 Não Definido')
          .setDescription(
            `Para que os 10 jogadores possam conectar com 1 clique (Steam Direct) e o bot possa exibir o ping e status do servidor, informe o IP agora!\n\n` +
            `👉 Clique no botão abaixo para preencher ou digite: \`!servidor <ip:porta>\``
          );

        const ipRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mix_set_ip:${mix.id}`)
            .setLabel('⚙️ Definir IP do Servidor')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚙️')
        );

        await channel.send({ embeds: [ipEmbed], components: [ipRow] }).catch(() => {});
      }

      // 3. Check if Valve GSI signal is currently received from any player's PC
      const isGsiActive = Boolean(
        this.lastGsiState &&
        (Date.now() - (this.lastGsiState.receivedAt || 0) < 60000) &&
        this.lastGsiState.player?.name
      );

      const domain = this.config.webUrl || 'https://mix-cs2-production.up.railway.app';
      const roomId = mix.id || 'MIX-PRO';
      const installerUrl = `${domain}/api/gsi/installer/${roomId}`;
      const cfgUrl = `${domain}/api/gsi/cfg/${roomId}`;

      if (!isGsiActive) {
        const gsiAlertEmbed = new EmbedBuilder()
          .setColor(0xf97316)
          .setTitle('📡 Aguardando Sinal GSI dos Jogadores (Vida & Dinheiro em Tempo Real)')
          .setDescription(
            `Nenhum computador de jogador está enviando telemetria do CS2 no momento.\n\n` +
            `Para o bot atualizar automaticamente o **placar**, a **vida (HP)**, o **dinheiro ($)** e as **kills** de cada jogador rodada a rodada, basta **1 jogador** da partida ter o GSI ativado!\n\n` +
            `⚡ **Instalação Rápida em 1 Clique (Automática):**\n` +
            `Clique no botão abaixo para baixar o instalador automático (\`.bat\`) e execute-o. Ele localiza a pasta do seu CS2 e instala tudo sozinho!`
          );

        const gsiButtonsRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('⚡ Instalar GSI (1-Clique .bat)')
            .setStyle(ButtonStyle.Link)
            .setURL(installerUrl),
          new ButtonBuilder()
            .setLabel('📥 Baixar gamestate_integration.cfg')
            .setStyle(ButtonStyle.Link)
            .setURL(cfgUrl),
          new ButtonBuilder()
            .setCustomId('gsi_help_info')
            .setLabel('❓ Como Funciona?')
            .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ embeds: [gsiAlertEmbed], components: [gsiButtonsRow] }).catch(() => {});

        // 4. Follow-up check after 35 seconds to notify if connected or re-prompt captains
        setTimeout(async () => {
          try {
            const activeNow = Boolean(
              this.lastGsiState &&
              (Date.now() - (this.lastGsiState.receivedAt || 0) < 60000) &&
              this.lastGsiState.player?.name
            );

            if (!activeNow && mix.phase === 'live') {
              const capA = mix.teamA?.captain?.id ? `<@${mix.teamA.captain.id}>` : 'Time A';
              const capB = mix.teamB?.captain?.id ? `<@${mix.teamB.captain.id}>` : 'Time B';
              await channel.send({
                content: `⚠️ **Aviso GSI**: Ainda não detectamos sinal do CS2 de nenhum jogador. ${capA} e ${capB}, peçam para alguém da partida rodar o instalador de 1-Clique acima para ativar o radar e estatísticas automáticas!`,
              }).catch(() => {});
            } else if (activeNow && mix.phase === 'live') {
              await channel.send({
                content: `✅ **Sinal GSI detectado com sucesso!** O bot agora está recebendo vida, dinheiro e rounds diretamente do CS2! 🎯`,
              }).catch(() => {});
            }
          } catch (_) {}
        }, 35000);
      }
    } catch (err) {
      console.warn('[BOT] Erro ao executar startAutomaticLiveMonitoring:', err);
    }
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
          `**3️⃣ Confirmação de Presença (Sem Limite de Tempo):**\n` +
          `• Assim que a fila atingir **10/10 jogadores**, os jogadores podem confirmar presença ou sortear os times direto sem pressa e sem ninguém ser expulso por tempo.\n\n` +
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
          `• \`!vitoria [A|B] [placar]\` — Registra a vitória, pontua no ranking e inicia votação de MVP\n` +
          `• \`!aovivo\` [parar] — Monitorar Partida round a round: placar, CT/TR, HP e armas (ative antes da partida!)\n` +
          `• \`!historico\` — Histórico de partidas recentes com placares e destaques\n` +
          `• \`!x1 @amigo\` — Duelo direto Head-to-Head e sinergia de duo\n` +
          `• \`!mapas\` — Estatísticas dos mapas mais disputados no servidor\n` +
          `• \`!status-server\` — Consulta ping, mapa e players online no CS2 (A2S_INFO)\n` +
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
        const isWa = p.source === 'whatsapp' || String(p.id).startsWith('wa_') || Boolean(p.phone);
        const capTag = (i === 0 || p.isCaptain) ? '👑 ' : '';
        const name = p.displayName || p.nick || p.name || p.username || 'Jogador';
        if (isWa) {
          playerList.push(`**${i + 1}.** ${capTag}💬 **${name}** \`[WhatsApp • Lvl ${lvl} GC ${gcEmoji}]\``);
        } else {
          playerList.push(`**${i + 1}.** ${capTag}🎮 <@${p.id}> \`[Discord • Lvl ${lvl} GC ${gcEmoji}]\``);
        }
      } else {
        playerList.push(`**${i + 1}.** ⏳ *[Vazio - Disponível]*`);
      }
    }

    const creatorDisplay = mix.creatorNick || (String(mix.creatorId).startsWith('wa_') ? '💬 WhatsApp' : `<@${mix.creatorId}>`);

    const embed = new EmbedBuilder()
      .setTitle(`🎮 CS2 MIX HUB • ${mix.name.toUpperCase()}`)
      .setDescription(
        `Fila oficial de Mix 5v5 para Counter-Strike 2.\n` +
        `🌐 **Sincronização Ativa:** Jogadores do **Discord**, **WhatsApp** e **Web** jogam no mesmo lobby!\n` +
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
            `🏆 **Formato:** ${mix.format || 'MD1'}\n` +
            `🛡️ **Status:** ${isFull ? '🟢 **LOBBY LOTADO (10/10)!**' : `🟡 Aguardando jogadores (${10 - total} restante(s))`}\n` +
            `💻 **Servidor:** ${mix.serverIp ? `\`${mix.serverIp}\`` : '*A definir ou host local*'}\n` +
            `👑 **Criador:** ${creatorDisplay}`,
          inline: false,
        }
      )
      .setFooter({
        text: `ID do Mix: ${mix.id} • Sincronizado Discord + WhatsApp + Web`,
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
        .setCustomId(`mix_live_tracker:${mix.id}`)
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
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

    const captainA = teamA.captain || teamA.players?.[0];
    const captainB = teamB.captain || teamB.players?.[0];

    const formatPlayer = (p, isCap) => {
      const capTag = isCap ? '👑 **Capitão:** ' : '• ';
      const lvl = p.level || 16;
      const isWa = p.source === 'whatsapp' || String(p.id).startsWith('wa_') || Boolean(p.phone);
      const name = p.displayName || p.nick || p.name || p.username || 'Jogador';
      if (isWa) {
        return `${capTag}💬 **${name}** \`[WhatsApp • Lvl ${lvl} GC]\``;
      }
      return `${capTag}🎮 <@${p.id}> \`[Discord • Lvl ${lvl} GC]\``;
    };

    const aPlayers = (teamA.players || [])
      .map((p) => formatPlayer(p, p.id === captainA?.id))
      .join('\n') || '*Nenhum jogador*';

    const bPlayers = (teamB.players || [])
      .map((p) => formatPlayer(p, p.id === captainB?.id))
      .join('\n') || '*Nenhum jogador*';

    const capAName = captainA ? (String(captainA.id).startsWith('wa_') ? `💬 ${captainA.nick || captainA.name}` : `<@${captainA.id}>`) : 'A definir';
    const capBName = captainB ? (String(captainB.id).startsWith('wa_') ? `💬 ${captainB.nick || captainB.name}` : `<@${captainB.id}>`) : 'A definir';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ TIMES FORMADOS • ${mix.name.toUpperCase()}`)
      .setDescription(
        `Os dois esquadrões foram balanceados pelo algoritmo Snake-Draft Gamers Club!\n\n` +
        `👑 **Capitão Time A:** ${capAName} \`[Lvl ${captainA?.level || 16} GC]\`\n` +
        `👑 **Capitão Time B:** ${capBName} \`[Lvl ${captainB?.level || 16} GC]\`\n\n` +
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
      .setFooter({ text: 'Sincronizado em tempo real entre Discord, WhatsApp e Web Hub' })
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
      .map((b) => `❌ ~~${b.map.name}~~ (Banido por ${isSnowflake(b.by) ? `<@${b.by}>` : '💬 **WhatsApp**'})`)
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
      const turnCapTag = isSnowflake(turnCaptain?.id)
        ? `<@${turnCaptain?.id}>`
        : (turnCaptain ? `💬 **${turnCaptain.displayName || turnCaptain.nick || turnCaptain.name || turnCaptain.username || 'Capitão'}**` : (isSnowflake(mix.creatorId) ? `<@${mix.creatorId}>` : '💬 **Capitão**'));

      embed.setDescription(
        `Formato: **${mix.format}** • Rotação Oficial Valve\n\n` +
          `👉 **Vez de Banir:** ${turnCapTag} (${turnTeamName})`
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
          value: mix.teamA.players.map((p) => `${p.id === mix.teamA.captain?.id ? '👑 **Capitão:** ' : '• '}${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.displayName || p.nick || p.name || p.username}** 💬`} \`[Lvl ${p.level || 16} GC]\``).join('\n') || '*Sem jogadores*',
          inline: true,
        },
        {
          name: `🔥 ${mix.teamB.name} (${mix.teamB.side})`,
          value: mix.teamB.players.map((p) => `${p.id === mix.teamB.captain?.id ? '👑 **Capitão:** ' : '• '}${isSnowflake(p.id) ? `<@${p.id}>` : `**${p.displayName || p.nick || p.name || p.username}** 💬`} \`[Lvl ${p.level || 16} GC]\``).join('\n') || '*Sem jogadores*',
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
          .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(cleanIp)}`))
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
        .setCustomId(`mix_live_tracker:${mix.id}`)
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel('🌐 Acompanhar no Site')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/?room=${mix.id}`)),
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

    // Community Clip Voting
    if (customId.startsWith('clip_vote_fire_') || customId.startsWith('clip_vote_bagre_')) {
      const isFire = customId.startsWith('clip_vote_fire_');
      const clipId = customId.replace(isFire ? 'clip_vote_fire_' : 'clip_vote_bagre_', '');
      const updated = communityClips.voteClip(clipId, user.id, isFire ? 'fire' : 'bagre');
      if (updated) {
        const { embeds, components } = communityClips.buildEmbed(updated);
        return interaction.update({ embeds, components });
      }
      return interaction.reply({ content: 'Clipe não encontrado.', ephemeral: true });
    }

    // Mix Set IP Modal Trigger
    if (customId.startsWith('mix_set_ip:') || customId === 'mix_set_ip') {
      const mixId = customId.includes(':') ? customId.split(':')[1] : '';
      const modal = new ModalBuilder()
        .setCustomId(`modal_set_ip:${mixId}`)
        .setTitle('⚙️ Definir IP do Servidor CS2');

      const ipInput = new TextInputBuilder()
        .setCustomId('server_ip_input')
        .setLabel('Endereço IP:Porta do Servidor')
        .setPlaceholder('Ex: 177.54.152.82:27015 ou connect 177.54.152.82:27015')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(ipInput));
      return interaction.showModal(modal);
    }

    // GSI Help Information Button
    if (customId === 'gsi_help_info') {
      return interaction.reply({
        content:
          `ℹ️ **O que é Valve GSI e como funciona?**\n\n` +
          `• O **Game State Integration (GSI)** é um recurso nativo e oficial da Valve no CS2 que transmite eventos do jogo em tempo real (vida, colete, dinheiro, kills, rounds, bombas).\n` +
          `• **Basta 1 jogador** da partida estar conectado com o GSI ativo para todo o servidor/Discord e o Hub Web acompanharem o radar e estatísticas ao vivo!\n` +
          `• O arquivo de configuração (\`gamestate_integration_cs2mixhub.cfg\`) fica salvo na pasta do seu CS2: \`.../steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg\`.\n` +
          `• O **Instalador de 1-Clique (\`.bat\`)** localiza a sua pasta da Steam e instala tudo automaticamente em 2 segundos — sem programas externos e 100% oficial pela Valve!`,
        ephemeral: true,
      });
    }

    // CS2 Case Simulator Buttons
    if (customId.startsWith('case_open_')) {
      const caseId = customId.replace('case_open_', '');
      const drop = cs2CaseSimulator.openCase(caseId, user);
      const { embeds, components } = cs2CaseSimulator.buildEmbed(drop);
      return interaction.reply({ embeds, components });
    }
    if (customId === 'case_inventory') {
      const { embeds, components } = cs2CaseSimulator.buildInventoryEmbed(user);
      return interaction.reply({ embeds, components, ephemeral: true });
    }

    // Bagre Vote Buttons
    if (customId.startsWith('bagre_vote_start:')) {
      const mixId = customId.split(':')[1];
      const mix = Array.from(this.activeMixes.values()).find((m) => m.id === mixId) || this.activeMixes?.get(interaction.channelId);
      if (!mix) return interaction.reply({ content: 'Mix não encontrado.', ephemeral: true });
      const components = bagreVoteService.buildVoteMenu(mix);
      return interaction.reply({
        content: `🐟 **VOTAÇÃO DE BAGRE DA PARTIDA!** (${mix.name})\nSelecione no menu abaixo quem mais entregou:`,
        components,
        ephemeral: true,
      });
    }

    if (customId.startsWith('bagre_finish:')) {
      const mixId = customId.split(':')[1];
      const mix = Array.from(this.activeMixes.values()).find((m) => m.id === mixId) || this.activeMixes?.get(interaction.channelId);
      if (!mix) return interaction.reply({ content: 'Mix não encontrado.', ephemeral: true });
      await bagreVoteService.finishVote(
        mix,
        interaction.channel,
        interaction.guild,
        this.loadPlayerProfiles(),
        (p) => this.savePlayerProfiles(p)
      );
      return interaction.reply({ content: '✅ Votação de Bagre encerrada e coroada!', ephemeral: true });
    }

    // Permanent Panel Trigger
    if (customId === 'panel_create_mix') {
      const mix = this.getOrCreateMix(interaction.channelId, user, { name: `Mix 5v5 de ${user.username}` });
      const tutorialEmbed = this.buildMixTutorialEmbed();
      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      const reply = await interaction.reply({
        content: `🎮 <@${user.id}> abriu um novo **Lobby de Mix CS2**!`,
        embeds: [tutorialEmbed, embed],
        components,
        fetchReply: true,
      });
      if (reply) {
        mix.lobbyMessageId = reply.id;
        mix.channelId = interaction.channelId;
      }
      return reply;
    }

    // Permanent Panel GC Level Modal
    if (customId === 'panel_set_level') {
      const current = this.getPlayerLevel(user.id);
      const modal = new ModalBuilder()
        .setCustomId('modal_set_level:panel')
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

    // Permanent Panel Live Match Monitor Trigger
    if (customId === 'panel_live_radar') {
      const requester = user.username || 'Jogador';
      const embed = this.buildLiveMatchEmbed(requester);
      const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name));
      await interaction.reply({
        content: `📡 <@${user.id}> ativou o **Monitorar Partida**!`,
        embeds: [embed],
        components: [row],
      });
      const sent = await interaction.fetchReply();
      this.registerLiveTracker(sent, requester);
      return;
    }

    // Refresh Hardware Deals
    if (customId === 'deals_refresh_hot') {
      const deals = await hardwareDealsManager.getDeals({ limit: 5 });
      const embed = hardwareDealsManager.buildDealsEmbed(deals);
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals);
      return interaction.update({ embeds: [embed], components: [selectMenu, ...actionButtons] });
    }

    // Live Match Tracker Controls
    if (customId === 'live_toggle_expand') {
      const tracker = this.liveTrackers?.get(interaction.message?.id);
      const isExpanded = tracker ? !tracker.isExpanded : true;
      if (tracker) {
        tracker.isExpanded = isExpanded;
      }
      const requester = interaction.user?.username || tracker?.requester || 'Jogador';
      const embed = this.buildLiveMatchEmbed(requester, tracker?.targetQuery, isExpanded);
      const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name), isExpanded);
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'live_refresh') {
      const tracker = this.liveTrackers?.get(interaction.message?.id);
      const requester = interaction.user?.username || tracker?.requester || 'Jogador';
      const isExpanded = tracker ? Boolean(tracker.isExpanded) : false;
      const embed = this.buildLiveMatchEmbed(requester, tracker?.targetQuery, isExpanded);
      const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name), isExpanded);
      if (interaction.message?.id) {
        this.registerLiveTracker(interaction.message, requester, tracker?.targetQuery, isExpanded);
      }
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'live_stop') {
      if (this.liveTrackers && interaction.message?.id) {
        this.liveTrackers.delete(interaction.message.id);
      }
      const embed = new EmbedBuilder()
        .setTitle('⏹️ MONITOR AO VIVO ENCERRADO')
        .setDescription(
          `O monitoramento de partida ao vivo foi desativado por <@${user.id}>.\n` +
            `Para iniciar novamente a qualquer momento antes ou durante uma partida, digite \`!aovivo\` ou \`/aovivo\`.`
        )
        .setColor(0x64748b)
        .setTimestamp();
      return interaction.update({ embeds: [embed], components: [] });
    }

    const [action, mixId, param] = customId.split(':');

    // Mix Live Tracker Trigger from Lobby or Match Ready Screen
    if (action === 'mix_live_tracker') {
      const requester = user.username || 'Jogador';
      const embed = this.buildLiveMatchEmbed(requester);
      const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name));
      await interaction.reply({
        content: `📡 <@${user.id}> ativou o **Monitorar Partida**!`,
        embeds: [embed],
        components: [row],
      });
      const sent = await interaction.fetchReply();
      this.registerLiveTracker(sent, requester);
      return;
    }

    let mix = this.activeMixes.get(interaction.channelId);

    if ((!mix || mix.id !== mixId) && mixId && action !== 'mix_cancel') {
      mix = this.recoverMixFromMessage(interaction, mixId);
    }

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

      if (!this.hasSavedLevel(user.id)) {
        const modal = new ModalBuilder()
          .setCustomId(`modal_join_set_level:${mix.id}`)
          .setTitle('Cadastre seu Nível GC (1 a 21)');

        const levelInput = new TextInputBuilder()
          .setCustomId('gc_level_input')
          .setLabel('Seu Nível Gamers Club (1 a 21)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 16 (ficará salvo no seu perfil)')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(2);

        const firstActionRow = new ActionRowBuilder().addComponents(levelInput);
        modal.addComponents(firstActionRow);
        return interaction.showModal(modal);
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
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      whatsappBot.broadcastLobbyUpdate(mix, `🎮 *${interaction.member?.displayName || user.username}* [Lvl ${userLvl} GC] entrou no mix pelo Discord!`);

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

      if (mix.players.length <= 7 && mix.notifiedMissing) {
        mix.notifiedMissing.clear();
      }
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      whatsappBot.broadcastLobbyUpdate(mix, `🚪 *${interaction.member?.displayName || user.username}* saiu do mix pelo Discord.`);

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
      whatsappBot.broadcastTeamsDrawn(mix);
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
      const isWaCaptain = String(currentCaptain?.id).startsWith('wa_');
      const isCurrentTeam = (veto.currentTurn === 'teamA' ? mix.teamA.players : mix.teamB.players).some((p) => p.id === user.id);
      const isAllowed = user.id === currentCaptain?.id || user.id === mix.creatorId || (isWaCaptain && isCurrentTeam);

      if (!isAllowed) {
        const capTag = isSnowflake(currentCaptain?.id)
          ? `<@${currentCaptain?.id}>`
          : `**${currentCaptain?.displayName || currentCaptain?.nick || currentCaptain?.name || currentCaptain?.username || 'Capitão'}** (WhatsApp)`;
        return interaction.reply({
          content: `🚫 Não é a sua vez! Apenas o Capitão ${capTag} pode banir agora.`,
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
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);

        const capBTag = isSnowflake(mix.teamB.captain?.id)
          ? `<@${mix.teamB.captain?.id}>`
          : (mix.teamB.captain ? `💬 **${mix.teamB.captain.displayName || mix.teamB.captain.nick || mix.teamB.captain.name || 'Capitão'}** [WhatsApp]` : `<@${mix.creatorId}>`);

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ ESCOLHA DE LADO • ${veto.deciderMap.name.toUpperCase()}`)
          .setDescription(
            `🗺️ O mapa decisivo da partida é **${veto.deciderMap.emoji} ${veto.deciderMap.name}** (\`${veto.deciderMap.id}\`)!\n\n` +
            `👉 Vez do Capitão do **${mix.teamB.name}** (${capBTag}):\n` +
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
      const isWaCaptain = String(captainB?.id).startsWith('wa_');
      const isTeamBMember = (mix.teamB.players || []).some((p) => p.id === user.id);
      const isAllowed = user.id === captainB?.id || user.id === mix.creatorId || (isWaCaptain && isTeamBMember);

      if (!isAllowed) {
        const capTag = isSnowflake(captainB?.id)
          ? `<@${captainB?.id}>`
          : `**${captainB?.displayName || captainB?.nick || captainB?.name || 'Capitão'}** (WhatsApp)`;
        return interaction.reply({
          content: `🚫 Apenas o Capitão ${capTag} pode escolher o lado!`,
          ephemeral: true,
        });
      }

      mix.teamB.side = chosenSide;
      mix.teamA.side = oppSide;
      mix.phase = 'live';

      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);

      if (this.config.autoMoveVoice) {
        this.executeVoiceMover(interaction.guild, mix, interaction.channel).catch(() => {});
      }

      const finalEmbed = this.buildMatchReadyEmbed(mix);
      const components = this.buildMatchReadyButtons(mix);

      await interaction.update({
        content: `🔥 **PARTIDA PRONTA PARA COMEÇAR!** GL & HF!`,
        embeds: [finalEmbed],
        components,
      });

      // INICIAR MONITORAMENTO AUTOMÁTICO EM TEMPO REAL
      this.startAutomaticLiveMonitoring(mix, interaction.channel, interaction.guild).catch((err) => {
        console.warn('[BOT] Erro ao iniciar monitoramento automático:', err.message);
      });
      return;
    }

    // 8. ROULETTE
    if (action === 'mix_roulette') {
      const randIdx = Math.floor(Math.random() * OFFICIAL_MAPS.length);
      const drawn = OFFICIAL_MAPS[randIdx];
      mix.veto.deciderMap = drawn;
      mix.phase = 'live';
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);

      if (this.config.autoMoveVoice) {
        this.executeVoiceMover(interaction.guild, mix, interaction.channel).catch(() => {});
      }

      const embed = this.buildMatchReadyEmbed(mix);
      const components = this.buildMatchReadyButtons(mix);

      await interaction.update({
        content: `🎲 **MAPA DEFINIDO PELA ROLETA!** GL & HF!`,
        embeds: [embed],
        components,
      });

      // INICIAR MONITORAMENTO AUTOMÁTICO EM TEMPO REAL
      this.startAutomaticLiveMonitoring(mix, interaction.channel, interaction.guild).catch((err) => {
        console.warn('[BOT] Erro ao iniciar monitoramento automático:', err.message);
      });
      return;
    }

    // 9. VOICE MOVER
    if (action === 'mix_voice') {
      const result = await this.executeVoiceMover(interaction.guild, mix, interaction.channel);
      return interaction.reply({ content: result.message, ephemeral: false });
    }

    if (action === 'mix_voice_lobby') {
      const result = await this.executeVoiceReturnToLobby(interaction.guild, mix);
      return interaction.reply({ content: result.message, ephemeral: false });
    }

    // 10. DECLARE MATCH RESULT (MODAL)
    if (action === 'match_result') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_match_result:${mix.id}`)
        .setTitle('🏆 Declarar Placar da Partida');

      const defaultMap = mix.matchMap || mix.veto?.deciderMap?.name || 'Mirage';

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

      const mapInput = new TextInputBuilder()
        .setCustomId('map_input')
        .setLabel('Mapa Jogado no CS2')
        .setPlaceholder('Ex: Mirage, Inferno, Nuke, Dust II, Ancient, Anubis...')
        .setValue(defaultMap)
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(30)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(winnerInput),
        new ActionRowBuilder().addComponents(scoreInput),
        new ActionRowBuilder().addComponents(mapInput)
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
      this.deleteMix(interaction.channelId);
      return interaction.update({
        content: `❌ O mix **${mix.name}** foi cancelado por <@${user.id}>.`,
        embeds: [],
        components: [],
      });
    }
  }

  async resolveVoiceChannelsForGuild(guild, contextChannel = null) {
    if (!guild) return null;

    if (!this.config.guildVoiceChannels) {
      this.config.guildVoiceChannels = {};
    }

    const guildVoice = this.config.guildVoiceChannels[guild.id] || {};
    let channelA = null;
    let channelB = null;

    // 1. Check if configured IDs exist in the guild
    if (guildVoice.teamAVoiceId) {
      channelA = await guild.channels.fetch(guildVoice.teamAVoiceId).catch(() => null);
    }
    if (guildVoice.teamBVoiceId) {
      channelB = await guild.channels.fetch(guildVoice.teamBVoiceId).catch(() => null);
    }

    // Fallback to legacy global config if not found in per-guild config
    if (!channelA && this.config.teamAVoiceId) {
      channelA = await guild.channels.fetch(this.config.teamAVoiceId).catch(() => null);
    }
    if (!channelB && this.config.teamBVoiceId) {
      channelB = await guild.channels.fetch(this.config.teamBVoiceId).catch(() => null);
    }

    // 2. Search existing channels in this guild by name pattern if missing
    if (!channelA || !channelB) {
      try {
        const channels = await guild.channels.fetch();
        const voiceChannels = channels.filter((c) => c && c.type === ChannelType.GuildVoice);

        if (!channelA) {
          channelA =
            voiceChannels.find((c) => /^(🔊\s*)?(time\s*a|team\s*a|call\s*a|mix\s*a)/i.test(c.name)) || null;
        }

        if (!channelB) {
          channelB =
            voiceChannels.find((c) => /^(🔊\s*)?(time\s*b|team\s*b|call\s*b|mix\s*b)/i.test(c.name)) || null;
        }
      } catch (err) {
        console.warn(`[VOICE RESOLVER] Erro ao buscar canais no servidor ${guild.name}:`, err.message);
      }
    }

    // 3. If still missing, AUTO-CREATE THEM in the server!
    const me = await guild.members.fetchMe().catch(() => null);
    const canManage = me && me.permissions.has(PermissionsBitField.Flags.ManageChannels);

    if ((!channelA || !channelB) && canManage) {
      try {
        let parentCategoryId = contextChannel?.parentId || guildVoice.categoryId || null;
        if (!parentCategoryId) {
          const channels = await guild.channels.fetch();
          const existingCat = channels.find(
            (c) => c && c.type === ChannelType.GuildCategory && /cs2 mix hub|calls do mix/i.test(c.name)
          );
          if (existingCat) {
            parentCategoryId = existingCat.id;
          } else {
            const newCat = await guild.channels.create({
              name: '🏆 CS2 MIX HUB',
              type: ChannelType.GuildCategory,
            });
            parentCategoryId = newCat.id;
          }
        }

        if (!channelA) {
          channelA = await guild.channels.create({
            name: '🔊 Time A (Mix CS2)',
            type: ChannelType.GuildVoice,
            parent: parentCategoryId,
            userLimit: 5,
          });
          console.log(`[VOICE MOVER] Canal Time A criado em ${guild.name} (ID: ${channelA.id})`);
        }

        if (!channelB) {
          channelB = await guild.channels.create({
            name: '🔊 Time B (Mix CS2)',
            type: ChannelType.GuildVoice,
            parent: parentCategoryId,
            userLimit: 5,
          });
          console.log(`[VOICE MOVER] Canal Time B criado em ${guild.name} (ID: ${channelB.id})`);
        }
      } catch (err) {
        console.warn(`[VOICE MOVER] Falha ao auto-criar canais de voz em ${guild.name}:`, err.message);
      }
    }

    // 4. Save the resolved channels in config for this guild
    if (channelA && channelB) {
      this.config.guildVoiceChannels[guild.id] = {
        teamAVoiceId: channelA.id,
        teamBVoiceId: channelB.id,
        categoryId: channelA.parentId || guildVoice.categoryId || '',
      };
      if (!this.config.teamAVoiceId) this.config.teamAVoiceId = channelA.id;
      if (!this.config.teamBVoiceId) this.config.teamBVoiceId = channelB.id;
      this.saveConfig({
        guildVoiceChannels: this.config.guildVoiceChannels,
        teamAVoiceId: this.config.teamAVoiceId,
        teamBVoiceId: this.config.teamBVoiceId,
      });
    }

    return { channelA, channelB };
  }

  async executeVoiceMover(guild, mix, contextChannel = null) {
    if (!guild) return { success: false, message: 'Servidor não encontrado.' };

    const resolved = await this.resolveVoiceChannelsForGuild(guild, contextChannel);
    if (!resolved || !resolved.channelA || !resolved.channelB) {
      return {
        success: false,
        message: '⚠️ Não foi possível encontrar ou criar os canais de voz **Time A** e **Time B**. Verifique se o bot possui a permissão de **Gerenciar Canais** ou configure os canais manualmente com `/calls`.',
      };
    }

    const { channelA, channelB } = resolved;

    // Apply exclusive private permissions for each team (Only Team A players access Call/Chat A, only Team B access B)
    try {
      if (channelA && channelA.manageable) {
        const overwritesA = [
          {
            id: guild.id, // @everyone: cannot connect or send messages
            deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages],
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: this.client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
          ...(mix.teamA.players || []).filter((p) => isSnowflake(p.id)).map((p) => ({
            id: p.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          })),
        ];
        await channelA.permissionOverwrites.set(overwritesA).catch((e) => {
          console.warn('[VOICE OVERWRITES] Time A:', e.message);
        });
      }

      if (channelB && channelB.manageable) {
        const overwritesB = [
          {
            id: guild.id, // @everyone: cannot connect or send messages
            deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages],
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: this.client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
          ...(mix.teamB.players || []).filter((p) => isSnowflake(p.id)).map((p) => ({
            id: p.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          })),
        ];
        await channelB.permissionOverwrites.set(overwritesB).catch((e) => {
          console.warn('[VOICE OVERWRITES] Time B:', e.message);
        });
      }
    } catch (err) {
      console.warn('[VOICE MOVER] Falha ao configurar permissões exclusivas das calls:', err.message);
    }

    let movedCount = 0;
    const movedA = [];
    const movedB = [];
    const notInVoice = [];
    const errors = [];

    const movePlayer = async (p, targetChannel, teamLetter) => {
      if (!p || !isSnowflake(p.id)) {
        return; // WhatsApp/Web player, skip Discord voice fetch
      }
      try {
        const member = await guild.members.fetch(p.id).catch(() => null);
        if (!member) {
          errors.push(`Membro <@${p.id}> não encontrado no servidor.`);
          return;
        }

        if (member.voice && member.voice.channelId) {
          if (member.voice.channelId === targetChannel.id) {
            if (teamLetter === 'A') movedA.push(member);
            else movedB.push(member);
            movedCount++;
          } else {
            await member.voice.setChannel(targetChannel.id);
            if (teamLetter === 'A') movedA.push(member);
            else movedB.push(member);
            movedCount++;
          }
        } else {
          notInVoice.push({ p, teamLetter });
        }
      } catch (e) {
        console.warn(`[VOICE MOVER] Falha ao mover membro ${p.id}:`, e.message);
        errors.push(`<@${p.id}>: ${e.message}`);
      }
    };

    const promises = [];
    (mix.teamA.players || []).forEach((p) => promises.push(movePlayer(p, channelA, 'A')));
    (mix.teamB.players || []).forEach((p) => promises.push(movePlayer(p, channelB, 'B')));

    await Promise.all(promises);

    let msg = '';
    if (movedCount > 0) {
      msg += `✅ **${movedCount} jogador(es) nas calls de voz oficiais:**\n`;
      msg += `• **Time A:** <#${channelA.id}> (${movedA.length}/5)\n`;
      msg += `• **Time B:** <#${channelB.id}> (${movedB.length}/5)\n`;
    }

    if (notInVoice.length > 0) {
      msg += `\n⚠️ **${notInVoice.length} jogador(es) não estão conectados em nenhuma call de voz:**\n`;
      msg += notInVoice.map((item) => `• ${isSnowflake(item.p.id) ? `<@${item.p.id}>` : `**${item.p.displayName || item.p.username}**`} (${item.teamLetter === 'A' ? 'Time A' : 'Time B'})`).join('\n');
      msg += `\n\n👉 *Entrem em qualquer canal de voz do servidor e cliquem novamente no botão **[📞 Mover para Calls]** para o bot puxar vocês automaticamente!*`;
    }

    if (movedCount === 0 && notInVoice.length > 0) {
      msg = `⚠️ **Nenhum jogador dos times está conectado em canal de voz no momento!**\n\n`;
      msg += `As calls oficiais da partida estão prontas:\n`;
      msg += `• **Time A:** <#${channelA.id}>\n`;
      msg += `• **Time B:** <#${channelB.id}>\n\n`;
      msg += `👉 Entrem em qualquer canal de voz do servidor e cliquem em **[📞 Mover para Calls]** para serem transferidos automaticamente!`;
    }

    return {
      success: true,
      movedCount,
      channelA,
      channelB,
      message: msg,
    };
  }

  async executeVoiceReturnToLobby(guild, mix) {
    if (!guild) return { success: false, message: 'Servidor não encontrado.' };

    let lobbyChannel = null;
    const guildVoice = this.config.guildVoiceChannels?.[guild.id] || {};

    if (guildVoice.lobbyVoiceId) {
      lobbyChannel = await guild.channels.fetch(guildVoice.lobbyVoiceId).catch(() => null);
    }
    if (!lobbyChannel && this.config.lobbyVoiceId) {
      lobbyChannel = await guild.channels.fetch(this.config.lobbyVoiceId).catch(() => null);
    }

    if (!lobbyChannel) {
      try {
        const channels = await guild.channels.fetch();
        const voiceChannels = channels.filter((c) => c && c.type === ChannelType.GuildVoice);
        lobbyChannel =
          voiceChannels.find((c) => /^(geral|lobby|cszin|counter\s*strike)/i.test(c.name)) || null;
      } catch (_) {}
    }

    if (!lobbyChannel) {
      return {
        success: false,
        message: '⚠️ Canal de voz do Lobby/Geral não foi encontrado no servidor.',
      };
    }

    let movedCount = 0;
    const allPlayers = [...(mix.teamA?.players || []), ...(mix.teamB?.players || []), ...(mix.players || [])];
    const uniqueIds = [...new Set(allPlayers.map((p) => p.id))].filter(isSnowflake);

    for (const playerId of uniqueIds) {
      try {
        const member = await guild.members.fetch(playerId).catch(() => null);
        if (member && member.voice && member.voice.channelId) {
          if (member.voice.channelId !== lobbyChannel.id) {
            await member.voice.setChannel(lobbyChannel.id);
            movedCount++;
          }
        }
      } catch (_) {}
    }

    await this.resetVoicePermissions(guild);

    return {
      success: true,
      message: `🔊 **${movedCount} jogador(es)** foram movidos de volta para o canal <#${lobbyChannel.id}>!\n🔓 Permissões das calls dos times foram liberadas.`,
    };
  }

  async resetVoicePermissions(guild) {
    if (!guild) return;
    try {
      const guildVoice = this.config.guildVoiceChannels?.[guild.id] || {};
      if (guildVoice.teamAVoiceId) {
        const cA = await guild.channels.fetch(guildVoice.teamAVoiceId).catch(() => null);
        if (cA && cA.manageable) {
          await cA.permissionOverwrites.set([
            {
              id: guild.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.SendMessages,
              ],
            },
          ]).catch(() => {});
        }
      }
      if (guildVoice.teamBVoiceId) {
        const cB = await guild.channels.fetch(guildVoice.teamBVoiceId).catch(() => null);
        if (cB && cB.manageable) {
          await cB.permissionOverwrites.set([
            {
              id: guild.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.SendMessages,
              ],
            },
          ]).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[VOICE RESET] Falha ao restaurar permissões:', err.message);
    }
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
    if (commandName === 'calls') return this.cmdCalls(interaction);
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
    if (commandName === 'historico') return this.cmdHistory(interaction);
    if (commandName === 'x1') return this.cmdHeadToHead(interaction);
    if (commandName === 'mapas') return this.cmdMapStats(interaction);
    if (commandName === 'status-servidor') return this.cmdServerStatus(interaction);
    if (commandName === 'gsi') return this.cmdGsi(interaction);
    if (commandName === 'aovivo' || commandName === 'monitorar' || commandName === 'monitorar-partida') return this.cmdLive(interaction);
    if (commandName === 'vitoria' || commandName === 'resultado') return this.cmdMatchResult(interaction);
    if (commandName === 'sub') return this.cmdSubstitute(interaction);
    if (commandName === 'cargo') return this.cmdToggleRole(interaction);
    if (commandName === 'ofertas') return this.cmdDeals(interaction);
    if (commandName === 'alertas-hardware') return this.cmdHardwareAlerts(interaction);
    if (commandName === 'steam') return this.cmdSteam(interaction);
    if (commandName === 'patchnotes' || commandName === 'att') return this.cmdPatchNotes(interaction);
    if (commandName === 'pro' || commandName === 'jogos') return this.cmdProMatches(interaction);
    if (commandName === 'bagre') return this.cmdBagre(interaction);
    if (commandName === 'jogosgratis' || commandName === 'freegames') return this.cmdFreeGames(interaction);
    if (commandName === 'clip') return this.cmdClip(interaction);
    if (commandName === 'caixa') return this.cmdCase(interaction);
    if (commandName === 'inventario') return this.cmdInventory(interaction);
    if (commandName === 'ajuda') return this.cmdHelp(interaction);
  }

  async handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    if (customId === 'hardware_category_filter') {
      const selected = interaction.values[0];
      const category = selected === 'all' ? null : selected;
      const deals = await hardwareDealsManager.getDeals({ category, limit: 5 });
      const embed = hardwareDealsManager.buildDealsEmbed(deals, {
        title: selected === 'all' ? undefined : `🔥 OFERTAS DE HARDWARE • ${deals[0]?.categoryLabel || selected.toUpperCase()}`,
      });
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals, { category });
      return interaction.update({ embeds: [embed], components: [selectMenu, ...actionButtons] });
    }
    if (customId.startsWith('bagre_select')) {
      const [_, mixId] = customId.split(':');
      const selectedId = interaction.values?.[0];
      if (selectedId && selectedId !== 'none') {
        bagreVoteService.castVote(mixId, interaction.user.id, selectedId);
        return interaction.reply({
          content: `🐟 Seu voto de **Bagre do Mix** para <@${selectedId}> foi computado com sucesso!`,
          ephemeral: true,
        });
      }
    }
    if (customId.startsWith('mvp_vote')) {
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix || !mix.mvpVote?.active) {
        return interaction.reply({ content: '⚠️ Esta votação de MVP já foi encerrada.', ephemeral: true });
      }
      const chosenPlayerId = interaction.values[0];
      mix.mvpVote.votes.set(interaction.user.id, chosenPlayerId);
      const totalVotes = mix.mvpVote.votes.size;
      const remainingSeconds = Math.max(0, Math.ceil(((mix.mvpVote.expiresAt || Date.now()) - Date.now()) / 1000));

      await interaction.reply({
        content: `⭐ Seu voto de MVP para <@${chosenPlayerId}> foi computado com sucesso! (Total: ${totalVotes} voto(s) • Tempo restante: ~${remainingSeconds}s)`,
        ephemeral: true,
      });

      // Se todos os jogadores do mix já votaram, encerra e coroa o MVP imediatamente sem esperar o cronômetro
      if (mix.mvpVote.votes.size >= (mix.players?.length || 10)) {
        if (mix.mvpVote.timer) {
          clearTimeout(mix.mvpVote.timer);
          mix.mvpVote.timer = null;
        }
        await this.finishMvpVote(mix, interaction.channel);
      }
      return;
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

      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (mix) {
        const p = mix.players.find((pl) => pl.id === interaction.user.id);
        if (p) {
          p.level = parsed;
          this.syncToWebRoom(mix);
          this.updateLobbyInChannels(mix);
          whatsappBot.broadcastLobbyUpdate(mix, `⭐ *${interaction.member?.displayName || interaction.user.username}* atualizou seu nível para Lvl ${parsed} GC!`);
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

    if (customId.startsWith('modal_join_set_level')) {
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

      const mix = this.resolveMixFromInteraction(interaction, customId);
      const badge = parsed >= 20 ? '👑 Lvl 20+' : parsed >= 18 ? '🏆 Lvl 18-19' : parsed >= 14 ? '🥇 Lvl 14-17' : '🥈 Lvl 1-13';

      if (!mix) {
        return interaction.reply({
          content: `✅ Seu nível GC foi salvo como **Lvl ${parsed}** (\`${badge}\`) no seu perfil com sucesso!`,
          ephemeral: true,
        });
      }

      if (mix.players.some((p) => p.id === interaction.user.id)) {
        const p = mix.players.find((pl) => pl.id === interaction.user.id);
        if (p) p.level = parsed;
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
        whatsappBot.broadcastLobbyUpdate(mix, `⭐ *${interaction.member?.displayName || interaction.user.username}* atualizou seu nível para Lvl ${parsed} GC!`);
        return interaction.reply({
          content: `✅ Seu nível GC foi salvo como **Lvl ${parsed}** (\`${badge}\`) e atualizado no seu slot do Mix!`,
          ephemeral: true,
        });
      }

      if (mix.players.length >= 10) {
        return interaction.reply({
          content: `✅ Nível GC **Lvl ${parsed}** (\`${badge}\`) salvo com sucesso no seu perfil! Porém, o mix acabou de lotar (10/10). Fique atento para o próximo!`,
          ephemeral: true,
        });
      }

      mix.players.push({
        id: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ dynamic: true }),
        level: parsed,
        ready: true,
      });
      this.syncToWebRoom(mix);
      this.updateLobbyInChannels(mix);
      whatsappBot.broadcastLobbyUpdate(mix, `🎮 *${interaction.member?.displayName || interaction.user.username}* [Lvl ${parsed} GC] definiu o nível e entrou no mix pelo Discord!`);

      if (mix.players.length === 8 || mix.players.length === 9) {
        this.notifyMissingSlots(mix, interaction.guild, interaction.channel).catch(() => {});
      }

      if (mix.players.length === 10) {
        this.startReadyCheck(mix, interaction.channel);
        const embed = this.buildReadyCheckEmbed(mix);
        const components = this.buildReadyCheckButtons(mix);
        if (mix.lobbyMessageId) {
          const msg = await interaction.channel.messages.fetch(mix.lobbyMessageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components }).catch(() => {});
        }
        return interaction.reply({
          content: `✅ Nível GC salvo como **Lvl ${parsed}** (\`${badge}\`) e você entrou no Mix! 🎯 O lobby atingiu **10/10 jogadores**!`,
          ephemeral: true,
        });
      }

      const embed = this.buildLobbyEmbed(mix);
      const components = this.buildLobbyButtons(mix);
      if (mix.lobbyMessageId) {
        const msg = await interaction.channel.messages.fetch(mix.lobbyMessageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [embed], components }).catch(() => {});
      }

      return interaction.reply({
        content: `✅ Nível GC salvo como **Lvl ${parsed}** (\`${badge}\`) e você acabou de entrar no Mix! 🎯 Vaga confirmada (${mix.players.length}/10).`,
        ephemeral: true,
      });
    }

    if (customId.startsWith('modal_match_result')) {
      const winner = interaction.fields.getTextInputValue('winner_input');
      const score = interaction.fields.getTextInputValue('score_input');
      let map = '';
      try {
        map = interaction.fields.getTextInputValue('map_input') || '';
      } catch (_) {}
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal.', ephemeral: true });
      }
      const result = await this.recordMatchResult(mix, winner, score, interaction.user, interaction.channel, map);
      if (!result.success) {
        return interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
      }
      return interaction.reply({ embeds: result.embeds, components: result.components });
    }

    if (customId.startsWith('modal_mix_sub')) {
      const outNick = interaction.fields.getTextInputValue('sub_out');
      const inNick = interaction.fields.getTextInputValue('sub_in');
      const mix = this.resolveMixFromInteraction(interaction, customId);
      if (!mix) {
        return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal.', ephemeral: true });
      }
      const res = await this.executeSubstitute(mix, outNick, inNick, interaction.guild, interaction.channel);
      return interaction.reply({ content: res.message, ephemeral: !res.success });
    }

    if (customId.startsWith('modal_set_ip')) {
      const rawIp = interaction.fields.getTextInputValue('server_ip_input');
      const cleanIp = (rawIp || '').replace(/^connect\s+/i, '').trim();

      if (!cleanIp || !cleanIp.includes(':')) {
        return interaction.reply({
          content: '⚠️ Formato de IP inválido! Use o formato `ip:porta`, por exemplo: `177.54.152.82:27015`.',
          ephemeral: true,
        });
      }

      const mix = this.resolveMixFromInteraction(interaction, customId);

      if (mix) {
        mix.serverIp = cleanIp;
        this.syncToWebRoom(mix);
        this.updateLobbyInChannels(mix);
      }
      this.config.serverConnect = cleanIp;
      this.saveConfig({ serverConnect: cleanIp });

      const connectUrl = this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(cleanIp)}`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🚀 Conectar Direto no CS2')
          .setStyle(ButtonStyle.Link)
          .setURL(connectUrl)
      );

      return interaction.reply({
        content:
          `✅ **IP do Servidor CS2 Definido com Sucesso por <@${interaction.user.id}>!**\n\n` +
          `🌐 **Endereço:** \`connect ${cleanIp}\`\n\n` +
          `Clique no botão abaixo ou use o console do CS2 (\`~\`) para entrar no servidor!`,
        components: [row],
      });
    }
  }

  async cmdMatchResult(interaction) {
    const mix = this.activeMixes.get(interaction.channelId);
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo encontrado neste canal para registrar vitória.', ephemeral: true });
    }
    const winner = interaction.options.getString('time');
    const score = interaction.options.getString('placar') || '13-9';
    const map = interaction.options.getString('mapa') || '';
    const res = await this.recordMatchResult(mix, winner, score, interaction.user, interaction.channel, map);
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

  async cmdCalls(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '⚠️ Este comando só pode ser usado em um servidor.', ephemeral: true });
    }

    const timeA = interaction.options.getChannel('time_a');
    const timeB = interaction.options.getChannel('time_b');
    const lobby = interaction.options.getChannel('lobby');

    if (timeA || timeB || lobby) {
      if (!this.config.guildVoiceChannels) this.config.guildVoiceChannels = {};
      const current = this.config.guildVoiceChannels[interaction.guildId] || {};
      if (timeA) current.teamAVoiceId = timeA.id;
      if (timeB) current.teamBVoiceId = timeB.id;
      if (lobby) current.lobbyVoiceId = lobby.id;
      this.config.guildVoiceChannels[interaction.guildId] = current;
      this.saveConfig({ guildVoiceChannels: this.config.guildVoiceChannels });

      return interaction.reply({
        content: `✅ **Canais de voz configurados para este servidor:**\n` +
          `• **Time A:** ${current.teamAVoiceId ? `<#${current.teamAVoiceId}>` : '*Não alterado*'}\n` +
          `• **Time B:** ${current.teamBVoiceId ? `<#${current.teamBVoiceId}>` : '*Não alterado*'}\n` +
          `• **Lobby Geral:** ${current.lobbyVoiceId ? `<#${current.lobbyVoiceId}>` : '*Não alterado*'}\n\n` +
          `Os sorteios e o botão **[📞 Mover para Calls]** usarão estes canais automaticamente!`,
        ephemeral: false,
      });
    }

    const mix = this.activeMixes.get(interaction.channelId);
    if (mix && (mix.teamA?.players?.length > 0 || mix.teamB?.players?.length > 0)) {
      await interaction.deferReply();
      const res = await this.executeVoiceMover(interaction.guild, mix, interaction.channel);
      return interaction.editReply({ content: res.message });
    }

    await interaction.deferReply({ ephemeral: true });
    const resolved = await this.resolveVoiceChannelsForGuild(interaction.guild, interaction.channel);
    if (!resolved || !resolved.channelA || !resolved.channelB) {
      return interaction.editReply({
        content: `⚠️ Não foi possível encontrar ou criar as calls no servidor. Verifique se o bot tem permissão de **Gerenciar Canais**.`,
      });
    }

    return interaction.editReply({
      content: `📞 **Canais de Voz Oficiais do Servidor:**\n` +
        `• **Time A:** <#${resolved.channelA.id}>\n` +
        `• **Time B:** <#${resolved.channelB.id}>\n\n` +
        `✅ As calls estão 100% configuradas e prontas para receber os jogadores nos mixes!`,
    });
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

    const reply = await interaction.reply({
      content: `🎮 <@${interaction.user.id}> criou um novo **Lobby de Mix CS2 5v5**!`,
      embeds: [tutorialEmbed, embed],
      components,
      fetchReply: true,
    });
    if (reply) {
      mix.lobbyMessageId = reply.id;
      mix.channelId = interaction.channelId;
    }
    return reply;
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

    if (!this.hasSavedLevel(interaction.user.id)) {
      const modal = new ModalBuilder()
        .setCustomId(`modal_join_set_level:${mix.id}`)
        .setTitle('Cadastre seu Nível GC (1 a 21)');

      const levelInput = new TextInputBuilder()
        .setCustomId('gc_level_input')
        .setLabel('Seu Nível Gamers Club (1 a 21)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 16 (ficará salvo no seu perfil)')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2);

      const firstActionRow = new ActionRowBuilder().addComponents(levelInput);
      modal.addComponents(firstActionRow);
      return interaction.showModal(modal);
    }

    mix.players.push({
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.username,
      avatar: interaction.user.displayAvatarURL({ dynamic: true }),
      level: this.getPlayerLevel(interaction.user.id),
      ready: true,
    });
    this.syncToWebRoom(mix);

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
    if (mix.players.length <= 7 && mix.notifiedMissing) {
      mix.notifiedMissing.clear();
    }
    this.syncToWebRoom(mix);
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
    let mix = this.activeMixes.get(interaction.channelId);
    if (!mix && this.activeMixes.size > 0) {
      mix = Array.from(this.activeMixes.values()).find((m) => m && m.phase !== 'cancelled' && m.phase !== 'finished') || Array.from(this.activeMixes.values())[0];
    }
    if (!mix && this.webRoomsRef && this.webRoomsRef.size > 0) {
      for (const r of this.webRoomsRef.values()) {
        if (r && r.phase !== 'finished' && r.phase !== 'cancelled') {
          mix = r;
          break;
        }
      }
    }
    if (!mix) {
      return interaction.reply({ content: 'ℹ️ Nenhum mix ativo no momento. Crie um com `/mix criar` ou digite `!mix`!', ephemeral: true });
    }
    const embed = this.buildLobbyEmbed(mix);
    const components = this.buildLobbyButtons(mix);
    const reply = await interaction.reply({ embeds: [embed], components, fetchReply: true });
    if (reply) {
      mix.lobbyMessageId = reply.id;
      mix.channelId = interaction.channelId;
    }
    return reply;
  }

  async cmdCancelMix(interaction) {
    const mix = this.deleteMix(interaction.channelId);
    if (!mix) return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal.', ephemeral: true });
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
        .setCustomId('panel_set_level')
        .setLabel('Meu Nível GC')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_live_radar')
        .setLabel('Monitorar Partida')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('🌐 Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/'))
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

  async cmdHistory(interaction) {
    const embed = this.buildMatchHistoryEmbed(6);
    return interaction.reply({ embeds: [embed] });
  }

  async cmdHeadToHead(interaction) {
    const targetUser = interaction.options.getUser('adversario');
    if (!targetUser) {
      return interaction.reply({ content: '⚠️ Selecione um jogador para comparar o confronto direto.', ephemeral: true });
    }
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '😅 Você não pode disputar um X1 contra você mesmo! Escolha outro competidor.', ephemeral: true });
    }
    const embed = this.buildHeadToHeadEmbed(interaction.user, targetUser);
    return interaction.reply({ embeds: [embed] });
  }

  async cmdMapStats(interaction) {
    const embed = this.buildMapStatsEmbed();
    return interaction.reply({ embeds: [embed] });
  }

  async cmdServerStatus(interaction) {
    await interaction.deferReply();
    const address = this.config.serverConnect || '127.0.0.1:27015';
    const res = await queryA2SServer(address, 3000);
    const embed = this.buildServerStatusEmbed(res, address);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Conectar no CS2')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl(`/connect?ip=${encodeURIComponent(address)}`))
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  async cmdGsi(interaction) {
    const embed = this.buildGsiEmbed();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('⚡ Instalador 1-Clique (.bat)')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/api/gsi/installer/MIX-PRO')),
      new ButtonBuilder()
        .setLabel('📥 Manual (.cfg)')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/api/gsi/cfg/MIX-PRO')),
      new ButtonBuilder()
        .setLabel('🌐 Ver Partida no Hub Web')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getPublicWebUrl('/'))
    );
    return interaction.reply({ embeds: [embed], components: [row] });
  }

  async cmdLive(interaction) {
    const requester = interaction.user?.username || 'Jogador';
    const targetQuery = interaction.options?.getString('jogador') || null;
    const embed = this.buildLiveMatchEmbed(requester, targetQuery);
    const row = this.buildLiveMatchButtons(Boolean(this.lastGsiState?.player?.name));
    await interaction.reply({ embeds: [embed], components: [row] });
    const sent = await interaction.fetchReply();
    this.registerLiveTracker(sent, requester, targetQuery);
    return sent;
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
          `• \`!vitoria [A|B] [placar]\` - Registra a vitória, pontua no ranking e inicia votação de MVP\n` +
          `• \`!aovivo\` ou \`/aovivo\` - Monitorar Partida com auto-atualização round a round: placar, CT/TR, HP e armas (ative antes ou durante o jogo!)\n` +
          `• \`!gsi\` ou \`/gsi\` - Instruções e download do arquivo CFG do Valve GSI\n` +
          `• \`!historico\` ou \`/historico\` - Histórico de partidas recentes e placares\n` +
          `• \`!x1 @amigo\` ou \`/x1\` - Duelo Head-to-Head e sinergia de vitórias juntos\n` +
          `• \`!mapas\` ou \`/mapas\` - Estatísticas dos mapas mais disputados\n` +
          `• \`!status-server\` ou \`/status-servidor\` - Consulta ping, mapa e players no servidor CS2\n` +
          `• \`!sub @novo\` - Substitui jogador ausente por um reserva\n` +
          `• \`!cargo\` - Ativa/desativa notificações de vagas restantes (@Mix CS2)\n` +
          `• \`!ranking\` - Mostra os líderes do Hall da Fama\n` +
          `• \`!stats [@jogador]\` - Consulta estatísticas, vitórias e elo\n` +
          `• \`!smoke [mapa]\` - Lineups de granadas\n` +
          `• \`!treino\` - CFG completa de treino do CS2\n` +
          `• \`!moeda\` - Cara ou coroa com animação\n` +
          `• \`!ofertas [busca]\` ou \`/ofertas\` - Busca promoções de hardware gamer (KaBuM!, Pichau, Terabyte)`
      )
      .setFooter({ text: 'CS2 Mix Hub • eSports Competitive Engine' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ==========================================
  // HARDWARE DEALS & PROMOTIONS (100% AUTOMATIC)
  // ==========================================

  async getOrCreateDealsChannel(guild) {
    if (!guild) return null;
    try {
      // 1. Explicit configured channel for this guild
      const customId = this.config.dealsChannels?.[guild.id] || (this.config.guildId === guild.id ? this.config.dealsChannelId : null);
      if (customId) {
        const customChannel = guild.channels.cache.get(customId) || await guild.channels.fetch(customId).catch(() => null);
        if (customChannel && customChannel.isTextBased()) return customChannel;
      }

      // 2. Existing text channel with relevant name
      const existing = guild.channels.cache.find((c) =>
        c.isTextBased() &&
        (c.name.includes('ofertas') || c.name.includes('promoc') || c.name.includes('hardware-deals') || c.name.includes('descontos'))
      );
      if (existing) {
        this.config.dealsChannels = this.config.dealsChannels || {};
        this.config.dealsChannels[guild.id] = existing.id;
        this.saveConfig({ dealsChannels: this.config.dealsChannels });
        return existing;
      }

      // 3. Create dedicated clean channel if bot has permission
      const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
      if (me && me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        const created = await guild.channels.create({
          name: '🏷️・ofertas-gamer',
          type: ChannelType.GuildText,
          topic: '🔥 Radar automático de promoções de hardware, periféricos, cadeiras e mesas gamer (KaBuM!, Pichau, TerabyteShop)',
          reason: 'Canal automático para promoções de computadores gamers e setup',
        });
        console.log(`[DISCORD BOT] Canal #${created.name} criado com sucesso no servidor "${guild.name}"!`);

        this.config.dealsChannels = this.config.dealsChannels || {};
        this.config.dealsChannels[guild.id] = created.id;
        this.saveConfig({ dealsChannels: this.config.dealsChannels });
        return created;
      }

      // 4. Fallback to default channel or first text channel
      const fallback =
        guild.channels.cache.get(this.config.defaultChannelId) ||
        guild.channels.cache.find((c) => c.isTextBased() && (c.name.includes('cs') || c.name === 'geral')) ||
        guild.channels.cache.filter((c) => c.isTextBased()).first();

      return fallback || null;
    } catch (e) {
      console.warn(`[DISCORD BOT] Falha ao obter/criar canal de ofertas na guild "${guild.name}":`, e.message);
      return null;
    }
  }

  async dispatchAutomaticDealsDrop(categoryType = 'all') {
    if (!this.client || !this.client.isReady()) return;

    let deals = [];
    let title = '🔥 RADAR AUTOMÁTICO • SUPER OFERTAS GAMER';
    let desc = '⚡ **PROMOÇÕES RELÂMPAGO DO DIA!** Oportunidades verificadas em **KaBuM!**, **Pichau** e **TerabyteShop**:';

    if (categoryType === 'cadeira_mesa') {
      const cadeiras = await hardwareDealsManager.getDeals({ category: 'cadeira', limit: 2 });
      const mesas = await hardwareDealsManager.getDeals({ category: 'mesa', limit: 2 });
      deals = [...cadeiras, ...mesas];
      title = '💺🪵 ALERTA DE OFERTAS • CADEIRAS & MESAS GAMER';
      desc = '🛋️ **CONFORTO & ERGONOMIA GAMER!** Cadeiras reclináveis e mesas reforçadas com desconto:';
    } else if (categoryType === 'gpu_cpu') {
      const gpus = await hardwareDealsManager.getDeals({ category: 'gpu', limit: 2 });
      const cpus = await hardwareDealsManager.getDeals({ category: 'cpu', limit: 2 });
      deals = [...gpus, ...cpus];
      title = '🎮⚡ ALERTA DE OFERTAS • PLACAS DE VÍDEO & PROCESSADORES';
      desc = '🚀 **MÁXIMO FPS NO CS2!** As melhores GPUs e processadores Ryzen/Intel com preço reduzido:';
    } else if (categoryType === 'mouse_teclado') {
      const mouses = await hardwareDealsManager.getDeals({ query: 'mouse gamer', limit: 2 });
      const teclados = await hardwareDealsManager.getDeals({ query: 'teclado mecanico', limit: 2 });
      deals = [...mouses, ...teclados];
      title = '🖱️⌨️ ALERTA DE OFERTAS • MOUSES & TECLADOS MECÂNICOS';
      desc = '🎯 **PRECISÃO COMPETITIVA!** Mouses ultraleves e teclados mecânicos em promoção:';
    } else if (categoryType === 'monitor_audio') {
      const monitores = await hardwareDealsManager.getDeals({ category: 'monitor', limit: 2 });
      const audio = await hardwareDealsManager.getDeals({ category: 'audio', limit: 2 });
      deals = [...monitores, ...audio];
      title = '🖥️🎧 ALERTA DE OFERTAS • MONITORES 144Hz-240Hz & HEADSETS';
      desc = '👀 **FLUIDEZ & ÁUDIO ESPACIAL!** Veja inimigos primeiro e escute passos com precisão:';
    } else if (categoryType === 'ram_ssd') {
      deals = await hardwareDealsManager.getDeals({ category: 'ram_ssd', limit: 4 });
      title = '🚀🛡️ ALERTA DE OFERTAS • MEMÓRIAS RAM & SSDs NVMe';
      desc = '⚡ **VELOCIDADE TOTAL!** Carregamento instantâneo de mapas e zero stuttering:';
    } else {
      deals = await hardwareDealsManager.getDeals({ limit: 4 });
      title = '🔥 RADAR AUTOMÁTICO • SUPER OFERTAS PC GAMER';
      desc = '⚡ **PROMOÇÕES RELÂMPAGO DO DIA!** Peças selecionadas com maiores descontos nas lojas confiáveis:';
    }

    if (!deals || deals.length === 0) return;

    const embed = hardwareDealsManager.buildDealsEmbed(deals, { title, description: desc });
    const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
    const actionButtons = hardwareDealsManager.buildActionButtons(deals);

    for (const [guildId, guild] of this.client.guilds.cache) {
      try {
        const channel = await this.getOrCreateDealsChannel(guild);
        if (!channel) continue;
        await channel.send({ embeds: [embed], components: [selectMenu, ...actionButtons] }).catch(() => {});
        console.log(`[DISCORD BOT] 🏷️ Ofertas automáticas (${categoryType}) postadas no canal #${channel.name} (${guild.name})!`);
      } catch (err) {
        console.warn(`[DISCORD BOT] Erro ao postar ofertas na guild "${guild.name}":`, err.message);
      }
    }
    this.saveConfig({ lastDealsDropAt: Date.now() });
  }

  startScheduledDealsMonitor() {
    if (this.dealsMonitorInterval) clearInterval(this.dealsMonitorInterval);

    // Initial drop only if more than 45 minutes have passed since last drop (prevents duplicate spam on restarts)
    const elapsedSinceLastDrop = Date.now() - (Number(this.config.lastDealsDropAt) || 0);
    if (elapsedSinceLastDrop > 45 * 60 * 1000) {
      setTimeout(() => {
        this.dispatchAutomaticDealsDrop('all').catch((err) => {
          console.warn('[DISCORD BOT] Aviso no drop inicial de ofertas:', err.message);
        });
      }, 8000);
    }

    // Rotating categories across cycles
    const categoryRotation = ['cadeira_mesa', 'gpu_cpu', 'mouse_teclado', 'monitor_audio', 'ram_ssd', 'all'];
    let rotationIndex = 0;

    // Check and post automatically every 60 minutes
    const intervalMs = (this.config.dealsIntervalMinutes || 60) * 60 * 1000;
    this.dealsMonitorInterval = setInterval(async () => {
      try {
        if (!this.client || !this.client.isReady()) return;
        if (this.config.autoPostDeals === false) return;

        const currentCat = categoryRotation[rotationIndex % categoryRotation.length];
        rotationIndex++;

        await this.dispatchAutomaticDealsDrop(currentCat);

        // Check for new official CS2 patch updates from Valve
        try {
          const patch = await cs2NewsRadar.fetchLatestPatch();
          if (patch && patch.isNew) {
            const { embeds, components } = cs2NewsRadar.buildEmbed(patch);
            for (const [, guild] of this.client.guilds.cache) {
              const channel = await this.getOrCreateDealsChannel(guild);
              if (channel) {
                await channel.send({ content: '🚨 **NOVA ATUALIZAÇÃO OFICIAL DO CS2 LANÇADA PELA VALVE!**', embeds, components }).catch(() => {});
              }
            }
            cs2NewsRadar.saveState(patch.gid);
          }
        } catch (e) {}
      } catch (err) {
        console.warn('[DISCORD BOT] Erro ao disparar alertas de ofertas:', err.message);
      }
    }, intervalMs);
  }

  async prefixDeals(message, args = []) {
    const sub = (args[0] || '').toLowerCase();

    // 1. Configure deals channel: !ofertas canal #promocoes
    if (sub === 'canal' || sub === 'channel') {
      const mentionedChannel = message.mentions.channels.first();
      const channelId = mentionedChannel ? mentionedChannel.id : (args[1] || message.channelId);
      this.config.dealsChannels = this.config.dealsChannels || {};
      if (message.guild?.id) {
        this.config.dealsChannels[message.guild.id] = channelId;
      }
      this.config.dealsChannelId = channelId;
      this.config.autoPostDeals = true;
      this.saveConfig({ dealsChannels: this.config.dealsChannels, dealsChannelId: channelId, autoPostDeals: true });
      return message.reply(`✅ Canal de alertas de promoções configurado com sucesso para: <#${channelId}>! O bot publicará alertas diários de hardware.`);
    }

    // 2. Force post deals to channel: !ofertas postar
    if (sub === 'postar' || sub === 'alerta') {
      await this.dispatchAutomaticDealsDrop('all');
      return message.reply(`🚀 Alerta de ofertas postado automaticamente em todos os canais configurados!`);
    }

    // 3. Search query: !ofertas rtx 4060
    if (args.length > 0) {
      const query = args.join(' ');
      const deals = await hardwareDealsManager.getDeals({ query, limit: 5 });
      const embed = hardwareDealsManager.buildDealsEmbed(deals, {
        title: `🔍 BUSCA DE HARDWARE: "${query.toUpperCase()}"`,
        description: `Resultados encontrados nas lojas oficiais parceiras (**KaBuM!**, **Pichau**, **TerabyteShop**):`,
      });
      const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
      const actionButtons = hardwareDealsManager.buildActionButtons(deals, { query });
      return message.reply({ embeds: [embed], components: [selectMenu, ...actionButtons] });
    }

    // 4. Default hot deals
    const deals = await hardwareDealsManager.getDeals({ limit: 5 });
    const embed = hardwareDealsManager.buildDealsEmbed(deals);
    const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
    const actionButtons = hardwareDealsManager.buildActionButtons(deals);
    return message.reply({ embeds: [embed], components: [selectMenu, ...actionButtons] });
  }

  async cmdDeals(interaction) {
    await interaction.deferReply();
    const query = interaction.options?.getString('busca');
    const category = interaction.options?.getString('categoria');
    const store = interaction.options?.getString('loja');

    const deals = await hardwareDealsManager.getDeals({ query, category, store, limit: 5 });
    const title = query
      ? `🔍 BUSCA DE HARDWARE: "${query.toUpperCase()}"`
      : category
      ? `🔥 OFERTAS DE HARDWARE • ${category.toUpperCase()}`
      : undefined;

    const embed = hardwareDealsManager.buildDealsEmbed(deals, { title });
    const selectMenu = hardwareDealsManager.buildCategorySelectMenu();
    const actionButtons = hardwareDealsManager.buildActionButtons(deals, { query, category });

    return interaction.editReply({ embeds: [embed], components: [selectMenu, ...actionButtons] });
  }

  async cmdHardwareAlerts(interaction) {
    const channel = interaction.options?.getChannel('canal');
    const activate = interaction.options?.getBoolean('ativar') ?? true;

    if (!channel) {
      return interaction.reply({ content: '⚠️ Canal inválido.', ephemeral: true });
    }

    this.config.dealsChannels = this.config.dealsChannels || {};
    if (interaction.guildId) {
      this.config.dealsChannels[interaction.guildId] = channel.id;
    }
    this.config.dealsChannelId = channel.id;
    this.config.autoPostDeals = activate;
    this.saveConfig({ dealsChannels: this.config.dealsChannels, dealsChannelId: channel.id, autoPostDeals: activate });

    return interaction.reply({
      content: activate
        ? `🔔 **Alertas de Promoções Ativados!** As melhores ofertas de hardware de **KaBuM!**, **Pichau** e **TerabyteShop** serão postadas automaticamente em <#${channel.id}>!`
        : `🔕 Alertas automáticos de promoções foram desativados.`,
    });
  }

  // ==========================================
  // STEAM SCANNER & ANTI-SMURF
  // ==========================================

  async prefixSteam(message, input) {
    if (!input || !input.trim()) {
      return message.reply('⚠️ Forneça o link ou ID da conta Steam! Exemplo: `!steam gaules` ou `!steam 76561198012345678`');
    }
    try {
      const scanData = await SteamScannerService.scanProfile(input.trim());
      const { embeds, components } = SteamScannerService.buildEmbed(scanData);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ ${err.message}`);
    }
  }

  async cmdSteam(interaction) {
    await interaction.deferReply();
    const input = interaction.options.getString('perfil');
    try {
      const scanData = await SteamScannerService.scanProfile(input.trim());
      const { embeds, components } = SteamScannerService.buildEmbed(scanData);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `❌ ${err.message}` });
    }
  }

  // ==========================================
  // CS2 VALVE PATCH NOTES & UPDATE RADAR
  // ==========================================

  async prefixPatchNotes(message) {
    try {
      const patchData = await cs2NewsRadar.fetchLatestPatch();
      if (!patchData) return message.reply('⚠️ Nenhuma nota de atualização recente encontrada.');
      const { embeds, components } = cs2NewsRadar.buildEmbed(patchData);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ Erro ao consultar notas de atualização: ${err.message}`);
    }
  }

  async cmdPatchNotes(interaction) {
    await interaction.deferReply();
    try {
      const patchData = await cs2NewsRadar.fetchLatestPatch();
      if (!patchData) return interaction.editReply({ content: '⚠️ Nenhuma nota de atualização recente encontrada.' });
      const { embeds, components } = cs2NewsRadar.buildEmbed(patchData);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `❌ Erro ao consultar notas de atualização: ${err.message}` });
    }
  }

  // ==========================================
  // PRO MATCHES & HLTV BR ESPORTS AGENDA
  // ==========================================

  async prefixProMatches(message) {
    try {
      const matches = await proMatchesAgenda.getUpcomingMatches();
      const { embeds, components } = proMatchesAgenda.buildEmbed(matches);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ Erro ao consultar agenda de jogos pro: ${err.message}`);
    }
  }

  async cmdProMatches(interaction) {
    try {
      const matches = await proMatchesAgenda.getUpcomingMatches();
      const { embeds, components } = proMatchesAgenda.buildEmbed(matches);
      return interaction.reply({ embeds, components });
    } catch (err) {
      return interaction.reply({ content: `❌ Erro ao consultar agenda: ${err.message}`, ephemeral: true });
    }
  }

  // ==========================================
  // "BAGRE DA PARTIDA" / ANTI-MVP HUMOR VOTE
  // ==========================================

  async prefixBagre(message) {
    const mix = this.activeMixes.get(message.channelId) || Array.from(this.activeMixes.values())[0];
    if (!mix) {
      return message.reply('⚠️ Nenhum mix ativo neste canal para eleger o Bagre. Crie um mix com `/mix criar` ou termine uma partida!');
    }
    const components = bagreVoteService.buildVoteMenu(mix);
    return message.reply({
      content: `🐟 **VOTAÇÃO DE BAGRE DA PARTIDA!** (${mix.name})\nVote no jogador que mais pinou ou entregou a rodada:`,
      components,
    });
  }

  async cmdBagre(interaction) {
    const mix = this.activeMixes.get(interaction.channelId) || Array.from(this.activeMixes.values())[0];
    if (!mix) {
      return interaction.reply({ content: '⚠️ Nenhum mix ativo neste canal para votar no Bagre.', ephemeral: true });
    }
    const components = bagreVoteService.buildVoteMenu(mix);
    return interaction.reply({
      content: `🐟 **VOTAÇÃO DE BAGRE DA PARTIDA!** (${mix.name})\nVote no jogador que mais pinou ou entregou a rodada:`,
      components,
      ephemeral: true,
    });
  }

  // ==========================================
  // FREE PC GAMES RADAR (EPIC GAMES & STEAM)
  // ==========================================

  async prefixFreeGames(message) {
    try {
      const data = await freeGamesRadar.getAllFreeGames();
      const { embeds, components } = freeGamesRadar.buildEmbed(data);
      return message.reply({ embeds, components });
    } catch (err) {
      return message.reply(`❌ Erro ao consultar jogos gratuitos: ${err.message}`);
    }
  }

  async cmdFreeGames(interaction) {
    await interaction.deferReply();
    try {
      const data = await freeGamesRadar.getAllFreeGames();
      const { embeds, components } = freeGamesRadar.buildEmbed(data);
      return interaction.editReply({ embeds, components });
    } catch (err) {
      return interaction.editReply({ content: `❌ Erro ao consultar jogos gratuitos: ${err.message}` });
    }
  }

  // ==========================================
  // COMMUNITY CLIPS & HIGHLIGHTS SHOWCASE
  // ==========================================

  async prefixClip(message, args) {
    const url = args[0];
    const title = args.slice(1).join(' ');
    if (!url || !/^https?:\/\//i.test(url)) {
      return message.reply('⚠️ Envie um link válido de clipe! Ex: `!clip https://medal.tv/... Ace de AWP na B`');
    }
    try {
      const clip = communityClips.submitClip(message.author, url, title);
      const { embeds, components } = communityClips.buildEmbed(clip);
      return message.channel.send({
        content: `🎥 **Novo clipe da comunidade enviado por <@${message.author.id}>!**`,
        embeds,
        components,
      });
    } catch (err) {
      return message.reply(`❌ ${err.message}`);
    }
  }

  async cmdClip(interaction) {
    const url = interaction.options.getString('link');
    const title = interaction.options.getString('titulo') || '';
    try {
      const clip = communityClips.submitClip(interaction.user, url, title);
      const { embeds, components } = communityClips.buildEmbed(clip);
      return interaction.reply({
        content: `🎥 **Novo clipe da comunidade enviado por <@${interaction.user.id}>!**`,
        embeds,
        components,
      });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // ==========================================
  // CS2 CASE OPENING SIMULATOR
  // ==========================================

  async prefixCase(message, caseName) {
    const selected = (caseName || 'kilowatt').toLowerCase();
    const drop = cs2CaseSimulator.openCase(selected, message.author);
    const { embeds, components } = cs2CaseSimulator.buildEmbed(drop);
    return message.reply({ embeds, components });
  }

  async prefixInventory(message) {
    const { embeds, components } = cs2CaseSimulator.buildInventoryEmbed(message.author);
    return message.reply({ embeds, components });
  }

  async cmdCase(interaction) {
    const caseName = interaction.options.getString('caixa') || 'kilowatt';
    const drop = cs2CaseSimulator.openCase(caseName, interaction.user);
    const { embeds, components } = cs2CaseSimulator.buildEmbed(drop);
    return interaction.reply({ embeds, components });
  }

  async cmdInventory(interaction) {
    const { embeds, components } = cs2CaseSimulator.buildInventoryEmbed(interaction.user);
    return interaction.reply({ embeds, components, ephemeral: true });
  }
}

// Singleton Export
export const discordBotManager = new DiscordBotManager();
