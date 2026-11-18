import { parseServerConnect } from '../utils/security.js';

// Validates numeric Discord Snowflake ID (17 to 20 digits)
export const isSnowflake = (id) => typeof id === 'string' && /^\d{17,20}$/.test(id);

/**
 * Evita comandos `/` duplicados no menu do Discord: quando há servidores conectados,
 * registra os Slash Commands apenas por guild e limpa os globais antigos.
 */
export function resolveSlashRegistrationTargets(guildIds = []) {
  const uniqueGuilds = [...new Set([...guildIds].filter(Boolean))];
  if (uniqueGuilds.length > 0) {
    return {
      registerGlobal: false,
      clearGlobal: true,
      guildIds: uniqueGuilds,
    };
  }
  return {
    registerGlobal: true,
    clearGlobal: false,
    guildIds: [],
  };
}

/**
 * Calcula medalhas e conquistas reais do jogador com base exclusivamente no perfil e histórico salvo.
 */
export function computePlayerAchievements(prof = {}, matchHistory = [], targetUserId = '') {
  const wins = Number(prof?.wins || 0);
  const losses = Number(prof?.losses || 0);
  const total = wins + losses;
  const mvps = Number(prof?.mvps || 0);
  const streak = Number(prof?.streak || 0);
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  const badges = [];
  if (streak >= 5) badges.push(`⚡ Imparável (${streak}x streak)`);
  else if (streak >= 3) badges.push(`🔥 Em Chamas (${streak}x streak)`);

  if (wins >= 25) badges.push(`👑 Lenda do Hub (${wins}V)`);
  else if (wins >= 10) badges.push(`🏆 Veterano (${wins}V)`);
  else if (wins >= 3) badges.push(`🥉 Competidor (${wins}V)`);

  if (mvps >= 5) badges.push(`⭐ Colecionador de MVPs (${mvps})`);
  else if (mvps >= 1) badges.push(`🌟 Destaque MVP (${mvps}x)`);

  if (total >= 5 && winRate >= 60) badges.push(`📈 Consistência ${winRate}%`);

  if (targetUserId && Array.isArray(matchHistory) && matchHistory.length > 0) {
    const mapWins = {};
    for (const m of matchHistory) {
      const wonInMatch = Array.isArray(m?.winnerPlayers) && m.winnerPlayers.some((wp) => wp?.id === targetUserId);
      if (wonInMatch && m?.map) {
        const cleanMap = String(m.map).replace(/^de_/i, '').trim();
        if (cleanMap) mapWins[cleanMap] = (mapWins[cleanMap] || 0) + 1;
      }
    }
    const topMap = Object.entries(mapWins).sort((a, b) => b[1] - a[1])[0];
    if (topMap && topMap[1] >= 3) {
      badges.push(`🎯 Especialista ${topMap[0]} (${topMap[1]}V)`);
    }
  }

  return badges;
}

export const OFFICIAL_MAPS = [
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

export const GRENADE_GUIDES = {
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
    { title: 'Smoke Main / Céu (Bomb A)', desc: 'Lobby / Telhado ➔ Quebre o vidro, mire na quina da caixa de ventilação e solte com botão esquerdo.' },
  ],
  dust2: [
    { title: 'Smoke Porta Meio (Mid Doors)', desc: 'Spawn TR ➔ Alinhe no portão de ferro, mire na ponta da antena e solte com botão esquerdo.' },
    { title: 'Smoke Fundo / Long A (Corner)', desc: 'Long Doors ➔ Encoste no barril azul, mire na beirada da parede e Jumpthrow.' },
    { title: 'Smoke Passagem B (B Doors)', desc: 'Túnel Superior ➔ Encoste na quina da caixa e Jumpthrow na fresta do teto.' },
  ],
  ancient: [
    { title: 'Smoke Donut', desc: 'Pátio A ➔ Suba no degrau, mire na ponta da folha e solte com Jumpthrow.' },
    { title: 'Smoke Red / Meio', desc: 'Spawn TR ➔ Mire no topo da estátua de pedra e solte em movimento suave.' },
    { title: 'Smoke Caverna / Ramp B', desc: 'Fora B ➔ Encoste na parede esquerda do pilar, mire acima da moldura de pedra e solte com Jumpthrow.' },
  ],
  anubis: [
    { title: 'Smoke Conector / B', desc: 'Ruínas B ➔ Encoste no pilar de pedra, mire no topo do arco e Jumpthrow.' },
    { title: 'Smoke Meio / Canal', desc: 'Canal ➔ Alinhe na escada de madeira e mire na quina da parede.' },
    { title: 'Smoke Heaven / Câmera A', desc: 'Main A ➔ Encoste na porta dupla e alinhe no topo da pilastra direita com Jumpthrow.' },
  ],
  overpass: [
    { title: 'Smoke Lixeira / Dumpster (A)', desc: 'Fundo / Long A ➔ Encoste no poste da cerca, mire acima do poste elétrico e solte com Jumpthrow.' },
    { title: 'Smoke Banco (A Site)', desc: 'Banheiro A ➔ Encoste na quina antes da saída, mire no topo do letreiro e Jumpthrow.' },
    { title: 'Smoke Céu / Passarela (B)', desc: 'Água / Sapo ➔ Alinhe no corrimão de ferro, mire na antena do prédio e solte com Jumpthrow.' },
  ],
  train: [
    { title: 'Smoke Ivy / Olof (A)', desc: 'Saída T-Main ➔ Encoste na parede da direita, mire na quina do prédio industrial e Jumpthrow.' },
    { title: 'Smoke Z / Conector (A)', desc: 'Pombo / T-Main ➔ Alinhe na caixa elétrica e mire no fio superior direito com Jumpthrow.' },
    { title: 'Smoke Bomb B (Upper)', desc: 'Rampa B ➔ Encoste na porta antes da passarela, mire na janela alta e clique com botão esquerdo.' },
  ],
  cache: [
    { title: 'Smoke Cruz (Main A)', desc: 'Galpão A ➔ Encoste no muro branco, mire no canto da claraboia e clique com botão esquerdo.' },
    { title: 'Smoke Empilhadeira / Quad (A)', desc: 'Squeaky ➔ Mire no topo da estrutura de metal à esquerda e solte em passo curto.' },
    { title: 'Smoke CT / Passarela (B)', desc: 'Checkers / Rampa B ➔ Encoste no engradado, mire na barra de ferro superior e Jumpthrow.' },
  ],
  vertigo: [
    { title: 'Smoke CT / Elevador (A)', desc: 'Rampa A ➔ Encoste no saco de cimento, mire acima do guindaste vermelho e clique com botão esquerdo.' },
    { title: 'Smoke Sandbag / Esquerda (A)', desc: 'Rampa A ➔ Encoste na parede amarela e alinhe no topo da viga metálica.' },
    { title: 'Smoke Gerador (B)', desc: 'Escada B ➔ Alinhe no degrau médio, mire na borda da caixa elétrica e clique com botão esquerdo.' },
  ],
};

export const GRENADE_MAP_ALIASES = {
  mir: 'mirage',
  mirage: 'mirage',
  inf: 'inferno',
  infer: 'inferno',
  inferno: 'inferno',
  nuk: 'nuke',
  nuke: 'nuke',
  d2: 'dust2',
  dd2: 'dust2',
  dust: 'dust2',
  dust2: 'dust2',
  dustii: 'dust2',
  anc: 'ancient',
  ancient: 'ancient',
  anu: 'anubis',
  anubis: 'anubis',
  ovp: 'overpass',
  over: 'overpass',
  overpass: 'overpass',
  trn: 'train',
  train: 'train',
  cac: 'cache',
  cache: 'cache',
  vrg: 'vertigo',
  vert: 'vertigo',
  vertigo: 'vertigo',
};

export function resolveGrenadeMapKey(query) {
  const raw = String(query || '').toLowerCase().trim();
  if (!raw) return 'mirage';
  const normalized = raw.replace(/^de_/, '').replace(/[^a-z0-9]/g, '');
  if (!normalized) return 'mirage';
  if (GRENADE_MAP_ALIASES[normalized]) return GRENADE_MAP_ALIASES[normalized];
  const exact = Object.keys(GRENADE_GUIDES).find((k) => k === normalized);
  if (exact) return exact;
  const partial = Object.keys(GRENADE_GUIDES).find((k) => k.startsWith(normalized) || normalized.includes(k));
  return partial || null;
}

export function extractHostAndPort(rawServer) {
  const parsed = parseServerConnect(rawServer || '');
  if (parsed.valid) {
    return {
      host: parsed.host,
      port: parsed.port,
      hostPort: parsed.hostPort,
      normalized: parsed.normalized,
      password: parsed.password,
    };
  }
  const stripped = String(rawServer || '')
    .replace(/^connect\s+/i, '')
    .split(';')[0]
    .replace(/["']/g, '')
    .trim();
  const colonIdx = stripped.lastIndexOf(':');
  const host = colonIdx !== -1 ? stripped.slice(0, colonIdx).trim() : stripped;
  const portCandidate = colonIdx !== -1 ? parseInt(stripped.slice(colonIdx + 1), 10) : 27015;
  const port = !Number.isNaN(portCandidate) && portCandidate >= 1 && portCandidate <= 65535 ? portCandidate : 27015;
  return {
    host,
    port,
    hostPort: host ? `${host}:${port}` : '',
    normalized: host ? `${host}:${port}` : '',
    password: '',
  };
}
