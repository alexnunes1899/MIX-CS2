/**
 * CS2 Mix Hub • Roteador de Intenções em Linguagem Natural & Coach/Analista IA
 * Interpreta menções naturais ao Bot no Discord e consulta Gemini (ou motor local determinístico)
 * com dados reais de leaderboard, histórico de partidas, lineups de granadas e sala ativa.
 */

const MAP_ALIASES = [
  { key: 'dust2', patterns: ['dust2', 'dust 2', 'd2', 'de_dust2'] },
  { key: 'mirage', patterns: ['mirage', 'mrg', 'de_mirage'] },
  { key: 'inferno', patterns: ['inferno', 'inf', 'de_inferno'] },
  { key: 'nuke', patterns: ['nuke', 'de_nuke'] },
  { key: 'ancient', patterns: ['ancient', 'anc', 'de_ancient'] },
  { key: 'anubis', patterns: ['anubis', 'anb', 'de_anubis'] },
  { key: 'vertigo', patterns: ['vertigo', 'vrg', 'de_vertigo'] },
  { key: 'overpass', patterns: ['overpass', 'ovp', 'de_overpass'] },
  { key: 'train', patterns: ['train', 'trn', 'de_train'] },
  { key: 'cache', patterns: ['cache', 'cac', 'de_cache'] },
  { key: 'office', patterns: ['office', 'ofc', 'cs_office'] },
  { key: 'italy', patterns: ['italy', 'itl', 'cs_italy'] },
];

const MAP_TACTICAL_TIPS = {
  mirage: {
    CT: '2 no A (1 Escada/Cabecinha + 1 Ticket/Jungle), 1 Janela/L com apoio do Conector e 1–2 no B (Van/Mercado). Se perderem controle do Meio, smoke Conector cedo e joguem crossfire do Bomb A.',
    TR: 'Controle do Meio é chave: smoke na Janela + Conector + L permite dividir o A pela Escada/Jungle ou explodir B via Mercado/Tapete.',
  },
  inferno: {
    CT: 'Na Banana, varie entre agressivar com molotov no Carro + HE profunda e recuar para setup duplo no B (Caixão + Areia). No A, controle Meio/Xuxa para ler rotações.',
    TR: 'Limpe a Banana com utilitário no começo para forçar rotações, mantenha lurk no Meio/Xuxa e combine flash de pop antes de invadir B ou Varanda/A.',
  },
  ancient: {
    CT: 'No Meio, faça disputa inicial com HE + Molotov no Red Room/Meio e mantenha 1 jogador no Donut pronto para ajudar tanto Meio quanto A. Sempre deixe smoke/kit pronto para retomar Caverna/B.',
    TR: 'Ganhar o Meio pelo Red Room abre splits rápidos para B (via Rampa/Dark) ou para A (via Donut/Temple). Smokes na Rampa B e CT travam a rotação defensiva.',
  },
  anubis: {
    CT: 'O Canal/Água define a rodada: alterne presença agressiva no Meio/Canal com cruzamento em E-box e B. Nunca deixe o TR entrar no Canal sem informação.',
    TR: 'Explore Canal/Água e Conector para pressionar ambos os bombsites ao mesmo tempo e isole Rotação/Céu com smokes antes do execute.',
  },
  nuke: {
    CT: 'Comunicação entre Fora, Cabana e Rampa é vital. Smoke Secret ou jogue avançado de AWP Fora apenas com flash de apoio, mantendo 2 prontos para fechar Rampa/Porta.',
    TR: 'Parede de 2 smokes Fora para descer Secret e dividir o Bomb B surpreende defesas estáticas; varie com rush rápido pela Porta/Cabana no A.',
  },
  dust2: {
    CT: 'Jogue pelo domínio de Varanda/Fundo ou meio-recuado com AWP olhando passagem do Meio para B. Se cederem Fundo, recuem cedo para retake coordenado com flashes altas.',
    TR: 'Controlar Varanda ou passar pelo Meio para dividir B (Mid-to-B) quebra facilmente setups padrão de 2-1-2.',
  },
  overpass: {
    CT: 'Brigue pelo controle de Banheiro/Balão no A ou Água/Bica no B no início da rodada; informação avançada no Overpass vale metade do round.',
    TR: 'Trabalhe pontas no Conector/Água para pegar informação e faça execute coordenado com smokes Lixeira/Banco (A) ou Céu/Ponte (B).',
  },
  vertigo: {
    CT: 'Controle da Rampa A com HE e molotov trava o ataque rápido; mantenha rotação ágil pelo Elevador e Meio.',
    TR: 'Smokes no lado direito/esquerdo da Rampa A e pressão constante pelo Meio forçam os CTs a gastar todas as utilitárias cedo.',
  },
  train: {
    CT: 'Feche Popdog/Ivy e use ângulos cruzados entre os trens no Bomb A; guarde smokes para atrasar o plant no A/B.',
    TR: 'Execute sincronizado pelo Main A + Ivy (com smokes no Olof/CT e Z) divide os marcadores do bombsite.',
  },
  cache: {
    CT: 'Dispute o Meio no começo da rodada com apoio da Z/Branco e use smokes para segurar a saída do Galpão A.',
    TR: 'Domínio de Meio abre espaço tanto para split Z no A quanto para entrada pelas Ventilações no B.',
  },
};

export function normalizePtBrText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMapQueryFromText(text) {
  const norm = normalizePtBrText(text);
  if (!norm) return null;
  for (const item of MAP_ALIASES) {
    for (const pattern of item.patterns) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(norm)) {
        return item.key;
      }
    }
  }
  return null;
}

function hasAny(norm, phrases) {
  return phrases.some((p) => norm.includes(p));
}

function hasWord(norm, words) {
  return words.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(norm);
  });
}

const COACH_MEMORY_TTL_MS = 20 * 60 * 1000;
const COACH_MEMORY_MAX_TURNS = 6;
const coachConversationMemory = new Map();

function buildMemoryKey(channelId, authorId) {
  return `${String(channelId || 'global')}:${String(authorId || 'anon')}`;
}

export function getCoachConversationHistory({ channelId, authorId } = {}) {
  if (!authorId && !channelId) return [];
  const key = buildMemoryKey(channelId, authorId);
  const turns = coachConversationMemory.get(key) || [];
  const now = Date.now();
  const fresh = turns.filter((t) => now - t.at <= COACH_MEMORY_TTL_MS);
  if (fresh.length !== turns.length) {
    if (fresh.length === 0) coachConversationMemory.delete(key);
    else coachConversationMemory.set(key, fresh);
  }
  return fresh;
}

export function recordCoachTurn({ channelId, authorId, query, replyBody, mapKey = null } = {}) {
  if (!query) return [];
  const key = buildMemoryKey(channelId, authorId);
  const existing = getCoachConversationHistory({ channelId, authorId });
  const next = [
    ...existing,
    {
      query: String(query).slice(0, 300),
      replyBody: String(replyBody || '').slice(0, 500),
      mapKey: mapKey || extractMapQueryFromText(query) || existing[existing.length - 1]?.mapKey || null,
      at: Date.now(),
    },
  ].slice(-COACH_MEMORY_MAX_TURNS);
  coachConversationMemory.set(key, next);
  return next;
}

export function clearCoachConversationHistory({ channelId, authorId } = {}) {
  const key = buildMemoryKey(channelId, authorId);
  coachConversationMemory.delete(key);
}

/**
 * Classifica uma menção ao bot em português natural em uma ação direta ou em pergunta para o Coach IA.
 */
export function detectNaturalIntent(rawContent, { mentionsCount = 0 } = {}) {
  const cleanText = String(rawContent || '')
    .replace(/<@!?\d+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const norm = normalizePtBrText(cleanText);

  if (!norm || hasWord(norm, ['oi', 'ola', 'eai', 'eaee', 'salve', 'painel', 'menu', 'botoes'])) {
    return { intent: 'panel', query: cleanText };
  }

  // 1. Integração com servidor privado
  if (
    hasAny(norm, ['integracao', 'integrar servidor', 'servidor privado', 'conectar meu servidor', 'passo a passo servidor', 'configurar servidor privado'])
  ) {
    return { intent: 'integration', query: cleanText };
  }

  // 2. Definir nível GC (ex: "bota meu level 18", "meu nivel e 15", "sou gc 20")
  const levelMatch = norm.match(/(?:level|lvl|nivel|gc)\s*(?:e|eh|para|pra|em|no|=|:)?\s*(\d{1,2})\b/) ||
    norm.match(/(?:bota|coloca|seta|muda|altera|atualiza|define)\s+(?:meu\s+)?(?:level|lvl|nivel|gc)?\s*(?:para|pra|em|=)?\s*(\d{1,2})\b/);
  if (levelMatch && hasAny(norm, ['level', 'lvl', 'nivel', 'gc'])) {
    return { intent: 'set_level', level: levelMatch[1], query: cleanText };
  }

  // 3. Confronto direto X1 / Sinergia com @jogador
  if (
    mentionsCount > 0 &&
    hasAny(norm, ['x1', 'duelo', 'ganha mais', 'vence mais', 'confronto', 'head to head', 'sinergia', 'duo', 'entre mim e', 'entre eu e', 'contra o', 'contra a', 'juntos'])
  ) {
    return { intent: 'head_to_head', query: cleanText };
  }

  // 3b. Substituição de jogador ("substitui o @A pelo @B", "bota @B no lugar do @A")
  if (
    hasAny(norm, ['substitui', 'substituir', 'no lugar', 'tira o', 'troca o']) &&
    (mentionsCount >= 1 || hasAny(norm, ['reserva', 'sub', 'suplente', 'pelo', 'por']))
  ) {
    return { intent: 'sub', query: cleanText };
  }

  // 3c. Perfil / Stats individuais ("meu perfil", "stats do @fulano", "como tao as stats")
  if (hasAny(norm, ['meu perfil', 'meus stats', 'minhas stats', 'minhas estatisticas', 'perfil do', 'stats do', 'stats da', 'como ta o perfil', 'como tao os stats'])) {
    return { intent: 'stats', query: cleanText };
  }

  // 3d. Scanner Steam / Anti-Smurf
  const steamUrlMatch = cleanText.match(/https?:\/\/steamcommunity\.com\/(?:profiles|id)\/[A-Za-z0-9_.-]+/i);
  const steamIdMatch = cleanText.match(/\b(7656119\d{10})\b/);
  if (steamUrlMatch || steamIdMatch || hasAny(norm, ['checa a steam', 'checar steam', 'verifica smurf', 'verificar smurf', 'anti smurf', 'antismurf', 'horas de cs'])) {
    const tokenMatch = cleanText.match(/(?:steam|smurf|perfil)\s+(?:do|da|de)?\s*([A-Za-z0-9_.-]{3,})/i);
    return {
      intent: 'steam',
      steamTarget: steamUrlMatch?.[0] || steamIdMatch?.[1] || tokenMatch?.[1] || '',
      query: cleanText,
    };
  }

  // 3e. Calls de voz (checar faltantes / voltar lobby / puxar times)
  if (hasAny(norm, ['quem falta na call', 'quem nao ta na call', 'quem nao esta na call', 'faltando na call', 'chama pra call', 'chamada da call'])) {
    return { intent: 'calls_check', query: cleanText };
  }
  if (
    hasAny(norm, ['volta pro geral', 'voltar pro geral', 'volta pro lobby', 'voltar pro lobby', 'devolve pro geral', 'devolver pro lobby']) ||
    /\b(?:volta|voltar|devolve|devolver|retorna|retornar)\b.*\b(?:geral|lobby)\b/.test(norm)
  ) {
    return { intent: 'calls_return', query: cleanText };
  }
  if (
    hasAny(norm, ['move pra call', 'mover pra call', 'puxa pra call', 'puxar pra call', 'manda pras calls', 'move os times', 'separa as calls']) ||
    /\b(?:move|mover|puxa|puxar|manda|mandar)\b.*\bcalls?\b/.test(norm)
  ) {
    return { intent: 'calls_move', query: cleanText };
  }

  // 3f. Registrar vitória ("deu time A 13x9", "time B ganhou 13-10")
  const scoreMatch = cleanText.match(/\b(\d{1,2})\s*[-xX:]\s*(\d{1,2})\b/) ||
    cleanText.match(/\b(\d{1,2})\s+a\s+(\d{1,2})\b/i);
  const winnerTeamMatch = norm.match(/\btime\s*([ab])\b/i);
  if (
    winnerTeamMatch &&
    hasAny(norm, ['vitoria', 'ganhou', 'venceu', 'deu time', 'registra o placar', 'registrar placar', 'placar foi'])
  ) {
    return {
      intent: 'match_result',
      winner: winnerTeamMatch[1].toUpperCase(),
      score: scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : '',
      mapQuery: extractMapQueryFromText(norm),
      query: cleanText,
    };
  }

  // 4. Granadas / Smokes / Lineups (ex: "qual smoke do ct da mirage?", "granada da ancient")
  const mapFound = extractMapQueryFromText(norm);
  const asksGrenade = hasWord(norm, ['smoke', 'smokes', 'granada', 'granadas', 'flash', 'flashes', 'molotov', 'molly', 'lineup', 'lineups', 'pixel', 'pixeis', 'utilitario', 'utilitarios']);
  if (asksGrenade) {
    if (mapFound) {
      return { intent: 'grenade', mapQuery: mapFound, query: cleanText };
    }
    return { intent: 'coach_ai', query: cleanText };
  }

  // 5. Análise / Perguntas abertas para o Coach IA (prioridade sobre histórico simples se pedir análise/dica/como)
  const asksAnalysisOrTactics =
    hasAny(norm, ['analisa', 'analise', 'resumo', 'resuma', 'como segurar', 'como jogar', 'como atacar', 'como defender', 'dica de', 'tatica', 'estrategia', 'por que', 'porque', 'quem ta jogando melhor', 'quem esta jogando melhor', 'melhor jogador']);
  if (asksAnalysisOrTactics) {
    return { intent: 'coach_ai', mapQuery: mapFound, query: cleanText };
  }

  // 6. Ações diretas do Mix e Servidor
  if (hasAny(norm, ['sorteia os times', 'sortear times', 'faz os times', 'fazer os times', 'balanceia', 'balancear'])) {
    return { intent: 'draw', query: cleanText };
  }

  if (hasAny(norm, ['sorteia o mapa', 'sortear mapa', 'roleta de mapa', 'gira a roleta', 'roleta'])) {
    return { intent: 'roulette', query: cleanText };
  }

  if (hasAny(norm, ['escolher mapa', 'escolhe o mapa', 'coloca o mapa', 'bota o mapa']) && mapFound) {
    return { intent: 'choose_map', mapQuery: mapFound, query: cleanText };
  }

  if (hasAny(norm, ['inicia o veto', 'iniciar veto', 'comeca o veto', 'pick e ban', 'pick & ban', 'vetar mapa', 'banir mapa'])) {
    return { intent: 'veto', query: cleanText };
  }

  if (hasAny(norm, ['cria um mix', 'criar mix', 'abre um mix', 'abrir mix', 'abre uma fila', 'novo mix', 'comeca um mix'])) {
    return { intent: 'create_mix', query: cleanText };
  }

  if (hasAny(norm, ['entra na fila', 'entrar na fila', 'me bota na fila', 'me coloca na fila', 'me coloca no mix', 'quero jogar', 'to dentro'])) {
    return { intent: 'join', query: cleanText };
  }

  if (hasAny(norm, ['sair da fila', 'sai da fila', 'me tira da fila', 'me tira do mix', 'sair do mix', 'nao vou mais'])) {
    return { intent: 'leave', query: cleanText };
  }

  if (hasAny(norm, ['quem ta na fila', 'quem esta na fila', 'como ta a fila', 'como esta a fila', 'quantos faltam', 'status do mix', 'mostra a fila', 'ver a fila'])) {
    return { intent: 'fila', query: cleanText };
  }

  if (hasAny(norm, ['revanche', 'rematch', 'jogar de novo', 'mesmos times'])) {
    return { intent: 'rematch', query: cleanText };
  }

  if (hasAny(norm, ['cancela o mix', 'cancelar mix', 'fecha o mix', 'fechar mix', 'encerra o mix'])) {
    return { intent: 'cancel', query: cleanText };
  }

  if (hasAny(norm, ['ranking', 'hall da fama', 'top jogadores', 'leaderboard', 'quem ta em primeiro'])) {
    return { intent: 'ranking', query: cleanText };
  }

  if (hasAny(norm, ['quais mapas', 'mapas mais jogados', 'estatisticas dos mapas', 'stats dos mapas'])) {
    return { intent: 'map_stats', query: cleanText };
  }

  if (hasAny(norm, ['ultimos jogos', 'historico', 'partidas recentes', 'quem ganhou o ultimo'])) {
    return { intent: 'history', query: cleanText };
  }

  if (hasAny(norm, ['patch notes', 'patchnotes', 'atualizacao do cs', 'teve atualizacao', 'notas da valve'])) {
    return { intent: 'patch_notes', query: cleanText };
  }

  if (hasAny(norm, ['ao vivo', 'placar ao vivo', 'monitorar partida', 'radar da partida'])) {
    return { intent: 'live', query: cleanText };
  }

  if (hasAny(norm, ['status do server', 'status do servidor', 'servidor ta online', 'server ta online', 'quantos no server'])) {
    return { intent: 'server_status', query: cleanText };
  }

  if (hasAny(norm, ['qual o ip', 'qual ip', 'passa o ip', 'passa o connect', 'comando connect'])) {
    return { intent: 'ip', query: cleanText };
  }

  if (hasAny(norm, ['cfg de treino', 'config de treino', 'treino de granada', 'treino.cfg', 'baixar treino', 'arquivo de treino', 'pack de treino', 'pacote de treino'])) {
    return { intent: 'treino', mapQuery: mapFound, query: cleanText };
  }

  if (hasWord(norm, ['treino']) && mapFound && !hasAny(norm, ['tecla', 'bind', 'spawn', 'reset', 'camera', 'noclip', 'como'])) {
    return { intent: 'treino', mapQuery: mapFound, query: cleanText };
  }

  if (hasAny(norm, ['ajuda', 'comandos', 'o que voce faz', 'como funciona'])) {
    return { intent: 'help', query: cleanText };
  }

  if (hasWord(norm, ['bagre', 'votar bagre'])) {
    return { intent: 'bagre', query: cleanText };
  }

  // Fallback inteligente: perguntas abertas vão para o Coach/Analista IA
  return { intent: 'coach_ai', mapQuery: mapFound, query: cleanText };
}

/**
 * Monta um snapshot compacto com dados reais do hub para fundamentar a resposta do Coach/Analista.
 */
export function buildCoachContext({
  query = '',
  activeMix = null,
  liveMatch = null,
  leaderboard = [],
  matchHistory = [],
  grenades = [],
  serverConnect = '',
  requesterId = null,
  requesterName = 'Jogador',
  conversationHistory = [],
} = {}) {
  const recentHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
  const lastMemoryMap = [...recentHistory].reverse().find((t) => t?.mapKey)?.mapKey || null;
  const mapKey = extractMapQueryFromText(query) || lastMemoryMap;
  const topPlayers = (Array.isArray(leaderboard) ? leaderboard : []).slice(0, 10).map((p, idx) => ({
    rank: idx + 1,
    nick: p.nick || p.username || 'Jogador',
    level: p.level || 16,
    wins: p.wins || 0,
    losses: p.losses || 0,
    winRate: p.winRate || 0,
    mvps: p.mvps || 0,
    streak: p.streak || 0,
  }));

  const requesterStats = requesterId
    ? (Array.isArray(leaderboard) ? leaderboard : []).find((p) => p.id === requesterId || p.discordId === requesterId) || null
    : null;

  const recentMatches = (Array.isArray(matchHistory) ? matchHistory : []).slice(0, 10).map((m) => ({
    date: m.date || null,
    time: m.time || null,
    map: m.map || 'CS2',
    scoreA: m.scoreA ?? null,
    scoreB: m.scoreB ?? null,
    winner: m.winner || null,
    mvp: m.mvp?.nick || m.mvp || null,
    bagre: m.bagre?.nick || m.bagre || null,
    source: m.source || null,
  }));

  const mapBreakdown = {};
  for (const m of Array.isArray(matchHistory) ? matchHistory : []) {
    const key = String(m.map || 'Desconhecido').replace(/^de_/i, '');
    mapBreakdown[key] = (mapBreakdown[key] || 0) + 1;
  }

  const normalizedTargetMap = mapKey ? `de_${mapKey}` : null;
  const relevantLineups = (Array.isArray(grenades) ? grenades : [])
    .filter((g) => !normalizedTargetMap || String(g.map || '').toLowerCase() === normalizedTargetMap || String(g.mapName || '').toLowerCase() === mapKey)
    .slice(0, 4)
    .map((g) => ({
      map: g.mapName || g.map,
      title: g.title,
      side: g.side,
      type: g.type,
      location: g.location,
      throwType: g.throwType,
      steps: Array.isArray(g.steps) ? g.steps.slice(0, 3) : [],
    }));

  return {
    mapKey,
    requesterName,
    requesterStats,
    topPlayers,
    recentMatches,
    totalMatchesRecorded: Array.isArray(matchHistory) ? matchHistory.length : 0,
    mapBreakdown,
    activeMix: activeMix
      ? {
          id: activeMix.id,
          phase: activeMix.phase,
          playersCount: (activeMix.players || []).length,
          selectedMap: activeMix.selectedMap?.name || activeMix.mapName || null,
        }
      : null,
    liveMatch: liveMatch?.connected
      ? {
          mapName: liveMatch.mapName,
          scoreCT: liveMatch.scoreCT,
          scoreTR: liveMatch.scoreTR,
          roundNumber: liveMatch.roundNumber,
          phase: liveMatch.phase,
        }
      : null,
    hasServerConnect: Boolean(serverConnect),
    relevantLineups,
  };
}

/**
 * Fallback local determinístico caso GEMINI_API_KEY não esteja configurada ou falhe.
 * Usa dados reais do servidor + base tática CS2 sem inventar números falsos.
 */
export function buildDeterministicCoachReply(query, context) {
  const norm = normalizePtBrText(query);
  const mapKey = context?.mapKey || extractMapQueryFromText(norm);
  const asksTreinoPack =
    hasAny(norm, ['treino.cfg', 'spawns', 'spawn tr', 'numpad', 'camera lenta', 'noclip', 'rethrow', 'resetar treino', 'voltar ao normal']) ||
    (hasWord(norm, ['treino', 'cfg']) && hasAny(norm, ['tecla', 'teclas', 'bind', 'binds', 'repete', 'repetir', 'como ativo', 'como usa', 'como reset']));

  if (asksTreinoPack) {
    const mapCmdHint = mapKey ? `exec treino; ${mapKey}` : 'exec treino; mirage';
    return {
      source: 'local',
      title: '🎯 Guia Rápido • Pack Treino Completo LXN (treino.cfg)',
      body:
        `**Como ativar:** Salve em \`game\\csgo\\cfg\\treino.cfg\` (ou use \`!treino\` para baixar direto aqui) e digite no console:\n` +
        `\`${mapCmdHint}\`\n\n` +
        `**Teclas do Treino:**\n` +
        `• **\`P\`** — Repetir última granada (\`sv_rethrow_last_grenade\`)\n` +
        `• **\`N\`** — Voar (\`noclip\`) • **\`O\`** — Kit AWP + Colete + Granadas\n` +
        `• **\`K\` / \`I\`** — Câmera lenta (\`0.3x\`) / Velocidade normal (\`1.0x\`)\n` +
        `• **\`U\`** — Reiniciar round • **\`L\`** — Raio-X modelos\n` +
        `• **\`Numpad 1–5\`** — 5 spawns TR nos 12 mapas (\`mirage\`, \`inferno\`, \`dust2\`, \`ancient\`, \`anubis\`, \`cache\`, \`nuke\`, \`overpass\`, \`vertigo\`, \`train\`, \`office\`, \`italy\`)\n` +
        `• **\`reset\`** — Limpa as teclas do Numpad e recarrega sua \`autoexec\``,
    };
  }

  const asksHistory = hasAny(norm, ['historico', 'hoje', 'ultimos', 'partidas', 'ranking', 'melhor', 'stats', 'desempenho']);

  if (asksHistory && !mapKey) {
    const total = context?.totalMatchesRecorded || 0;
    const recent = context?.recentMatches || [];
    const top = context?.topPlayers || [];

    if (total === 0 && top.length === 0) {
      return {
        source: 'local',
        title: '📊 Analista do Hub • Histórico da Comunidade',
        body:
          'Ainda não há partidas finalizadas registradas no histórico oficial deste servidor.\n\n' +
          'Assim que concluírem mixes (via `!vitoria` ou automático pelo **Valve GSI**), eu consigo resumir winrate por mapa, MVPs, streaks e quem está dominando o lobby!',
      };
    }

    const leaderLine = top.slice(0, 3).map((p) => `${p.rank}. **${p.nick}** (${p.wins}V/${p.losses}D • ${p.winRate}% • 🔥${p.streak})`).join('\n');
    const recentLine = recent.slice(0, 5).map((m) => {
      const score = m.scoreA !== null && m.scoreB !== null ? `${m.scoreA}x${m.scoreB}` : 'finalizado';
      const mvpTxt = m.mvp ? ` • ⭐ MVP: **${m.mvp}**` : '';
      return `• **${String(m.map).replace(/^de_/i, '').toUpperCase()}** (${score}) — ${m.winner || 'Vencedor'}${mvpTxt}`;
    }).join('\n');

    const mapEntries = Object.entries(context?.mapBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const mapSummary = mapEntries.length > 0
      ? `🗺️ **Mapas mais jogados:** ${mapEntries.map(([m, c]) => `${m} (${c}x)`).join(' • ')}\n\n`
      : '';

    return {
      source: 'local',
      title: `📊 Análise Real do Hub (${total} partidas)`,
      body:
        mapSummary +
        (recentLine ? `**Últimos Confrontos:**\n${recentLine}\n\n` : '') +
        (leaderLine ? `**Top Jogadores no Ranking:**\n${leaderLine}` : ''),
    };
  }

  if (mapKey && MAP_TACTICAL_TIPS[mapKey]) {
    const sideHint = hasWord(norm, ['tr', 't', 'terrorista', 'atacar', 'ataque'])
      ? 'TR'
      : hasWord(norm, ['ct', 'contra', 'segurar', 'defender', 'defesa'])
      ? 'CT'
      : null;
    const tips = MAP_TACTICAL_TIPS[mapKey];
    const lineups = context?.relevantLineups || [];
    const lineupBlock = lineups.length > 0
      ? `\n\n💨 **Granadas PT-BR recomendadas (${mapKey.toUpperCase()}):**\n` +
        lineups.slice(0, 2).map((l) => `• **${l.title}** (${l.side} • ${l.throwType}): ${l.steps[0] || l.location}`).join('\n')
      : '';

    const text = sideHint
      ? `🛡️ **Plano ${sideHint} na ${mapKey.toUpperCase()}:**\n${tips[sideHint]}`
      : `🛡️ **CT:** ${tips.CT}\n\n💣 **TR:** ${tips.TR}`;

    return {
      source: 'local',
      title: `🧠 Coach Tático • ${mapKey.toUpperCase()}`,
      body: `${text}${lineupBlock}`,
    };
  }

  const activeInfo = context?.activeMix
    ? `Lobby ativo (\`${context.activeMix.id}\`) com **${context.activeMix.playersCount}/10** jogadores na fase \`${context.activeMix.phase}\`.`
    : 'Nenhum lobby 5v5 aberto neste canal agora.';

  return {
    source: 'local',
    title: '🤖 Assistente CS2 Mix Hub',
    body:
      `Entendi sua mensagem (**"${query.slice(0, 80)}"**)! Estado atual: ${activeInfo}\n\n` +
      `Você pode falar comigo naturalmente, por exemplo:\n` +
      `• *"bota meu level 18"* / *"sorteia os times"* / *"entra na fila"*\n` +
      `• *"qual smoke da Mirage?"* / *"como segurar meio na Ancient de CT?"*\n` +
      `• *"quem ganha mais entre mim e o @amigo?"* / *"analisa nosso histórico"*`,
  };
}

/**
 * Gera resposta do Coach/Analista via Gemini API quando disponível, com fallback automático local.
 */
export async function generateCoachResponse({
  query,
  context,
  geminiApiKey = '',
  model = 'gemini-2.5-flash',
  conversationHistory = [],
} = {}) {
  const cleanKey = String(geminiApiKey || '').trim();
  if (!cleanKey) {
    return buildDeterministicCoachReply(query, context);
  }

  const systemPrompt =
    'Você é o Coach Tático e Analista Oficial do CS2 Mix Hub no Discord. ' +
    'Responda sempre em Português do Brasil (PT-BR), direto ao ponto, em no máximo 1400 caracteres e formatado para Discord Markdown. ' +
    'Use EXCLUSIVAMENTE os dados reais fornecidos no CONTEXTO DO HUB ao citar partidas, placares, winrate, MVPs ou lineups; se não houver partidas registradas, diga claramente que ainda não há registros sem inventar estatísticas. ' +
    'Para perguntas táticas de CS2 (posicionamento, economia, smokes, splits), dê dicas objetivas e práticas de nível competitivo, considerando também o histórico recente da conversa.';

  const userPayload = `PERGUNTA DO JOGADOR (${context?.requesterName || 'Jogador'}): "${query}"\n\nCONTEXTO REAL DO HUB:\n${JSON.stringify(context)}`;
  const historyTurns = (Array.isArray(conversationHistory) ? conversationHistory : []).slice(-4).flatMap((turn) => [
    { role: 'user', parts: [{ text: turn.query }] },
    ...(turn.replyBody ? [{ role: 'model', parts: [{ text: turn.replyBody }] }] : []),
  ]);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...historyTurns,
          { role: 'user', parts: [{ text: userPayload }] },
        ],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 650,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const data = await res.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();
    if (!replyText) {
      throw new Error('Gemini retornou resposta vazia');
    }

    return {
      source: 'gemini',
      title: '🧠 Coach & Analista IA • CS2 Mix Hub',
      body: replyText.slice(0, 1900),
    };
  } catch (err) {
    console.warn('[DISCORD AI COACH FALLBACK]:', err.message);
    return buildDeterministicCoachReply(query, context);
  }
}

/**
 * Gera uma leitura objetiva pós-jogo fundamentada apenas nos números reais registrados da partida e histórico.
 */
export function buildPostMatchCoachInsight({ matchRecord, profiles = {}, matchHistory = [] } = {}) {
  if (!matchRecord) return null;
  const mapName = String(matchRecord.map || 'CS2').replace(/^de_/i, '');
  const normTarget = mapName.toLowerCase();
  const sameMapMatches = (Array.isArray(matchHistory) ? matchHistory : []).filter(
    (m) => String(m?.map || '').toLowerCase().replace(/^de_/i, '') === normTarget
  );
  const wScore = Number(matchRecord.scoreWinner ?? 13);
  const lScore = Number(matchRecord.scoreLoser ?? 0);
  const margin = Math.abs(wScore - lScore);

  const lines = [];
  if (wScore >= 13 && lScore >= 11) {
    lines.push(`🔥 Confronto equilibrado até os últimos rounds (**${matchRecord.score || `${wScore}-${lScore}`}** em **${mapName}**).`);
  } else if (margin >= 7) {
    lines.push(`⚡ Domínio claro do **${matchRecord.winner || 'Time Vencedor'}** por **${matchRecord.score || `${wScore}-${lScore}`}** em **${mapName}**.`);
  } else {
    lines.push(`📊 Vitória sólida do **${matchRecord.winner || 'Time Vencedor'}** em **${mapName}** (**${matchRecord.score || `${wScore}-${lScore}`}**).`);
  }

  lines.push(`🗺️ Este foi o **${Math.max(1, sameMapMatches.length)}º jogo** registrado no mapa **${mapName}** no histórico do servidor.`);

  const hotStreaks = (matchRecord.winnerPlayers || [])
    .map((p) => ({
      nick: p.nick || 'Jogador',
      streak: Number(profiles?.[p.id]?.streak || 0),
    }))
    .filter((p) => p.streak >= 2)
    .sort((a, b) => b.streak - a.streak);

  if (hotStreaks.length > 0) {
    lines.push(`🚀 Em sequência: ${hotStreaks.slice(0, 3).map((s) => `**${s.nick}** (${s.streak}x 🔥)`).join(' • ')}`);
  }

  if (matchRecord.hasRealGsiStats && matchRecord.mvp?.nick) {
    lines.push(`👑 Destaque real GSI: **${matchRecord.mvp.nick}** com **${matchRecord.mvp.kills}/${matchRecord.mvp.deaths}** (${matchRecord.mvp.kd} K/D).`);
  }

  return lines.join('\n');
}
