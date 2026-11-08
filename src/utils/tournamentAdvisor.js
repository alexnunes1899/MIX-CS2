/**
 * CS2 Mix Hub - Motor Inteligente de Torneios & Advisor de Formatos
 * 
 * Calcula matematicamente o formato ideal para qualquer quantidade de times (2 a 16),
 * detalhando fases, duração estimada, alocação de BYEs (folgas estratégicas) e
 * justificativas competitivas.
 */

export const CS2_OFFICIAL_MAPS = [
  'de_mirage',
  'de_inferno',
  'de_nuke',
  'de_dust2',
  'de_ancient',
  'de_anubis',
  'de_cache',
];

/**
 * Retorna a análise inteligente completa para N equipes participantes.
 */
export function getTournamentRecommendation(count = 8) {
  const n = Math.max(2, Math.min(16, Number(count) || 8));

  switch (n) {
    case 2:
      return {
        id: 'showdown',
        title: 'Grande Duelo Decisivo (Showdown MD3 / MD5)',
        badge: 'DUELO DIRETO',
        tag: 'MELHOR FORMATO PARA 2 EQUIPES',
        rounds: 1,
        totalMatches: 1,
        estimatedDuration: '~1h30 (MD3) ou ~2h30 (MD5)',
        byes: [],
        phases: [
          { name: 'Decisão do Título', matchesCount: 1, description: 'Série única decisiva com Veto Oficial e Prorrogação MR12', defaultMap: 'de_mirage' }
        ],
        rationale: 'Com 2 equipes, o formato mais prestigioso e justo do Counter-Strike mundial é o confronto direto em MD3 ou MD5 com Pick & Ban completo de 7 mapas, garantindo teste de map pool e sem interferências externas.',
        alternatives: [
          { id: 'rematch', name: 'Série com Revanche (Ida e Volta)', description: 'Dois jogos MD1 com desempate em overtime se empatar 1-1.' }
        ]
      };

    case 3:
      return {
        id: 'triangular',
        title: 'Triangular Competitivo (Round-Robin + Grande Final)',
        badge: 'TODOS CONTRA TODOS',
        tag: 'ELIMINA INJUSTIÇAS EM 3 TIMES',
        rounds: 2,
        totalMatches: 4,
        estimatedDuration: '~2h30min',
        byes: [],
        phases: [
          { name: 'Fase de Pontos (3 Jogos)', matchesCount: 3, description: 'Todos os 3 times se enfrentam em MD1 (saldo de rounds decide desempate)', defaultMap: 'de_mirage' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Top 1 vs Top 2 disputam a taça', defaultMap: 'de_inferno' }
        ],
        rationale: 'Com número ímpar reduzido (3 times), o sistema todos-contra-todos é matematicamente o único que evita eliminar um time com apenas 1 derrota injusta. Os dois melhores colocados no saldo de rounds avançam para a decisão.',
        alternatives: [
          { id: 'gauntlet', name: 'Modo Gauntlet (Rei da Mesa)', description: 'Seed #2 vs #3; o vencedor sobe para desafiar o Seed #1 na Final.' }
        ]
      };

    case 4:
      return {
        id: 'bracket_4',
        title: 'Semifinais Clássicas + Grande Final (Single Elimination Pro)',
        badge: 'CHAVE OLÍMPICA',
        tag: 'FORMATO MAIS RÁPIDO & DINÂMICO',
        rounds: 2,
        totalMatches: 3,
        estimatedDuration: '~2h00min (MD1) ou ~3h30 (MD3)',
        byes: [],
        phases: [
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Seed #1 vs Seed #4 e Seed #2 vs Seed #3', defaultMap: 'de_mirage' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Vencedores das semifinais decidem o título', defaultMap: 'de_nuke' }
        ],
        rationale: 'Árvore binária simétrica perfeita (2^2). Sem necessidade de folgas ou repescagem prolongada. O Seed #1 é premiado enfrentando o Seed #4, garantindo valor ao ranqueamento.',
        alternatives: [
          { id: 'gsl_4', name: 'Grupo GSL (Dupla Eliminação)', description: 'Formato clássico da IEM: 2 vitórias classificam, 2 derrotas eliminam.' }
        ]
      };

    case 5:
      return {
        id: 'bye_5',
        title: 'Chave Eliminatória com Play-in & BYE Estratégico',
        badge: 'TOP 3 EM FOLGA',
        tag: 'EQUILÍBRIO MATEMÁTICO PERFEITO',
        rounds: 3,
        totalMatches: 4,
        estimatedDuration: '~2h45min',
        byes: [1, 2, 3],
        phases: [
          { name: 'Play-in Preliminar (1 Jogo)', matchesCount: 1, description: 'Seed #4 vs Seed #5 duelam pela 4ª vaga na Semifinal', defaultMap: 'de_dust2' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Seed #1 vs Vencedor Play-in | Seed #2 vs Seed #3', defaultMap: 'de_mirage' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Decisão do título', defaultMap: 'de_inferno' }
        ],
        rationale: 'Para 5 equipes, este formato premia os 3 melhores colocados (#1, #2 e #3) com vaga direta na Semifinal por mérito técnico, enquanto os seeds #4 e #5 disputam o Play-in de abertura, resultando em exatamente 4 jogos equilibrados sem tempo ocioso.',
        alternatives: [
          { id: 'groups_5', name: '2 Grupos (Grupo A de 2, Grupo B de 3)', description: 'Fase de grupos rápida com classificação cruzada para as semifinais.' }
        ]
      };

    case 6:
      return {
        id: 'pro_bye_6',
        title: 'Eliminatória Pro com BYE Duplo (Padrão ESL Pro League)',
        badge: 'OFICIAL ESL & GC',
        tag: 'FORMATO DE ELITE PARA 6 EQUIPES',
        rounds: 3,
        totalMatches: 5,
        estimatedDuration: '~3h15min',
        byes: [1, 2],
        phases: [
          { name: 'Quartas de Final (2 Jogos)', matchesCount: 2, description: 'Seed #3 vs Seed #6 e Seed #4 vs Seed #5', defaultMap: 'de_ancient' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Seed #1 vs Venc QF1 | Seed #2 vs Venc QF2 (Top 2 aguardam nas semis)', defaultMap: 'de_mirage' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Grande Decisão', defaultMap: 'de_nuke' }
        ],
        rationale: 'Este é o formato padrão oficial utilizado na ESL Pro League e Gamers Club para 6 equipes. Os Seeds #1 e #2 recebem BYE merecido para a semifinal, enquanto os outros 4 times batalham nas quartas.',
        alternatives: [
          { id: 'groups_6', name: '2 Grupos de 3 Equipes', description: 'Grupos A e B jogam round-robin; os 2 melhores de cada avançam para semis.' }
        ]
      };

    case 7:
      return {
        id: 'bye_7',
        title: 'Quartas de Final com Seed #1 em BYE Único',
        badge: 'TOP 1 EM FOLGA',
        tag: 'PREMIA O LÍDER DO RANKING',
        rounds: 3,
        totalMatches: 6,
        estimatedDuration: '~3h30min',
        byes: [1],
        phases: [
          { name: 'Quartas de Final (3 Jogos)', matchesCount: 3, description: '#2 vs #7 | #3 vs #6 | #4 vs #5 (Seed #1 folga)', defaultMap: 'de_inferno' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Seed #1 vs Venc QF1 | Venc QF2 vs Venc QF3', defaultMap: 'de_mirage' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Decisão do Título', defaultMap: 'de_anubis' }
        ],
        rationale: 'Com 7 times, falta apenas 1 para fechar o chaveamento de 8. A melhor prática desportiva é conceder BYE nas quartas exclusivamente ao Seed #1, que avança direto para a semifinal descansado.',
        alternatives: [
          { id: 'groups_7', name: 'Fase de Grupos (3 + 4)', description: 'Dois grupos com semifinais cruzadas entre os 2 melhores de cada.' }
        ]
      };

    case 8:
      return {
        id: 'bracket_8',
        title: 'Chave Clássica de 8 Equipes (Quartas -> Semis -> Final)',
        badge: 'CHAVE BINÁRIA COMPLETA',
        tag: 'FORMATO SUPREMO DE 8 EQUIPES',
        rounds: 3,
        totalMatches: 7,
        estimatedDuration: '~4h00min (MD1) ou ~6h (MD3)',
        byes: [],
        phases: [
          { name: 'Quartas de Final (4 Jogos)', matchesCount: 4, description: '#1 vs #8 | #4 vs #5 | #2 vs #7 | #3 vs #6', defaultMap: 'de_mirage' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Vencedores das quartas duelam pela vaga na final', defaultMap: 'de_inferno' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Grande Decisão de Título com Veto e Troféu', defaultMap: 'de_nuke' }
        ],
        rationale: 'O formato mais equilibrado, intuitivo e consagrado da história dos eSports. 8 equipes em eliminação simples perfeita (2^3), com cruzamento inteligente de seeds opostos (#1 vs #8, #2 vs #7).',
        alternatives: [
          { id: 'gsl_8', name: '2 Grupos GSL de 4 Equipes', description: 'Grupos no formato Major com chave superior e inferior; top 2 de cada vai pras semis.' }
        ]
      };

    case 9:
    case 10:
      return {
        id: 'playin_10',
        title: `Play-in Preliminar + Quartas de Final (${n} Equipes)`,
        badge: 'TOP 6 GARANTIDOS NAS QUARTAS',
        tag: 'TRANSIÇÃO SUAVE PARA CHAVE DE 8',
        rounds: 4,
        totalMatches: n === 9 ? 8 : 9,
        estimatedDuration: '~4h30min',
        byes: [1, 2, 3, 4, 5, 6],
        phases: [
          { name: 'Play-in de Repescagem', matchesCount: n === 9 ? 1 : 2, description: `Seeds inferiores (#7 a #${n}) duelam pelas últimas vagas nas Quartas`, defaultMap: 'de_dust2' },
          { name: 'Quartas de Final (4 Jogos)', matchesCount: 4, description: 'Top 6 + 2 classificados do play-in disputam vagas nas semis', defaultMap: 'de_mirage' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Confrontos de semifinal', defaultMap: 'de_inferno' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Disputa da Taça', defaultMap: 'de_nuke' }
        ],
        rationale: `Para ${n} equipes, os 6 melhores seeds já garantem vaga direta nas Quartas de Final pelo mérito, enquanto os seeds #${n === 9 ? '8 e #9' : '7 a #10'} disputam o Play-in de repescagem para completar o grid de 8 equipes.`,
        alternatives: [
          { id: 'swiss_10', name: 'Sistema Suíço Acelerado (3 Rodadas)', description: 'Todos jogam 3 rodadas contra adversários do mesmo retrospecto.' }
        ]
      };

    case 11:
    case 12:
      return {
        id: 'playin_12',
        title: `Eliminatória de 12 Equipes com Top 4 em BYE`,
        badge: 'TOP 4 DIRETO NAS QUARTAS',
        tag: 'ALTO NÍVEL COMPETITIVO',
        rounds: 4,
        totalMatches: 11,
        estimatedDuration: '~5h00min',
        byes: [1, 2, 3, 4],
        phases: [
          { name: 'Oitavas / Play-in (4 Jogos)', matchesCount: 4, description: 'Seeds #5 a #12 duelam por 4 vagas nas Quartas de Final', defaultMap: 'de_anubis' },
          { name: 'Quartas de Final (4 Jogos)', matchesCount: 4, description: 'Seeds #1 a #4 entram em ação contra os classificados', defaultMap: 'de_mirage' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Disputa de semifinais', defaultMap: 'de_inferno' },
          { name: 'Grande Final (MD3)', matchesCount: 1, description: 'Grande Decisão', defaultMap: 'de_nuke' }
        ],
        rationale: 'Para 12 equipes, o melhor formato esportivo concede BYE nas Quartas de Final aos 4 cabeças de chave (#1, #2, #3, #4), enquanto as outras 8 equipes duelam no Play-in preliminar para definir os adversários.',
        alternatives: [
          { id: 'groups_12', name: '2 Grupos de 6 Equipes', description: 'Fase de grupos longa com quartas de final cruzadas.' }
        ]
      };

    default: // 13 a 16 Equipes
      return {
        id: 'major_16',
        title: 'Chave Completa de Oitavas de Final (Estilo Major Valve 16 Equipes)',
        badge: 'FORMATO MAJOR VALVE',
        tag: 'ÁRVORE COMPLETA DE 16 TIMES',
        rounds: 4,
        totalMatches: 15,
        estimatedDuration: '~6h00min (Playoff Completo)',
        byes: [],
        phases: [
          { name: 'Oitavas de Final (8 Jogos)', matchesCount: 8, description: '16 equipes em duelos cruzados (#1 vs #16, #2 vs #15...)', defaultMap: 'de_dust2' },
          { name: 'Quartas de Final (4 Jogos)', matchesCount: 4, description: 'Os 8 sobreviventes disputam as semifinais', defaultMap: 'de_mirage' },
          { name: 'Semifinais (2 Jogos)', matchesCount: 2, description: 'Semifinais de alto nível', defaultMap: 'de_inferno' },
          { name: 'Grande Final (MD3/MD5)', matchesCount: 1, description: 'Grande Final do Campeonato', defaultMap: 'de_nuke' }
        ],
        rationale: 'Com 16 equipes, atinge-se a perfeição da árvore binária (2^4 = 16). É exatamente o formato consagrado dos playoffs dos Majors da Valve e da BLAST Premier: 8 oitavas de final, 4 quartas, 2 semifinais e a Grande Final.',
        alternatives: [
          { id: 'swiss_16', name: 'Sistema Suíço de 5 Rodadas (Major Stage)', description: '3 vitórias classificam, 3 derrotas eliminam.' }
        ]
      };
  }
}

/**
 * Cria a estrutura de partidas oficiais conectadas para qualquer quantidade de times (2 a 16).
 */
export function buildMatchesStructure(count, teamsList = []) {
  const n = Math.max(2, Math.min(16, Number(count) || 8));
  const tNames = teamsList.map((t) => t.name);

  const getTeam = (index, fallback) => {
    return (tNames && tNames[index]) ? tNames[index] : fallback;
  };

  const baseMatch = (id, roundName, teamA, teamB, time = '20:00', format = 'MD3', map = 'de_mirage') => ({
    id,
    roundName,
    title: roundName,
    teamA,
    teamB,
    scoreA: 0,
    scoreB: 0,
    time,
    status: 'pending',
    winner: null,
    format,
    map,
  });

  // 1. CASO 2 TIMES
  if (n === 2) {
    return {
      f1: baseMatch('f1', 'Decisão do Título', getTeam(0, 'Time 1'), getTeam(1, 'Time 2'), '21:00', 'MD3', 'de_mirage')
    };
  }

  // 2. CASO 3 TIMES (Triangular)
  if (n === 3) {
    return {
      r1: baseMatch('r1', 'Rodada 1 • Triangular', getTeam(0, 'Time 1'), getTeam(1, 'Time 2'), '19:30', 'MD1', 'de_mirage'),
      r2: baseMatch('r2', 'Rodada 2 • Triangular', getTeam(1, 'Time 2'), getTeam(2, 'Time 3'), '20:15', 'MD1', 'de_inferno'),
      r3: baseMatch('r3', 'Rodada 3 • Triangular', getTeam(0, 'Time 1'), getTeam(2, 'Time 3'), '21:00', 'MD1', 'de_nuke'),
      f1: baseMatch('f1', 'Grande Final (Top 1 vs Top 2)', '1º Colocado', '2º Colocado', '21:45', 'MD3', 'de_dust2')
    };
  }

  // 3. CASO 4 TIMES
  if (n === 4) {
    return {
      m1: baseMatch('m1', 'Semifinal 1', getTeam(0, 'FURIA Academy'), getTeam(3, 'MIBR Academy'), '20:00', 'MD3', 'de_mirage'),
      m2: baseMatch('m2', 'Semifinal 2', getTeam(1, 'Imperial Feeder'), getTeam(2, 'paiN Gaming Mix'), '21:00', 'MD3', 'de_inferno'),
      m3: baseMatch('m3', 'Grande Final', 'Vencedor SF1', 'Vencedor SF2', '22:30', 'MD3', 'de_nuke'),
    };
  }

  // 4. CASO 5 TIMES (Play-in #4 vs #5 -> Semis)
  if (n === 5) {
    return {
      pi1: baseMatch('pi1', 'Play-in (Vaga na Semifinal)', getTeam(3, 'Seed #4'), getTeam(4, 'Seed #5'), '19:30', 'MD1', 'de_dust2'),
      m1: baseMatch('m1', 'Semifinal 1', getTeam(0, 'Seed #1'), 'Vencedor Play-in', '20:30', 'MD3', 'de_mirage'),
      m2: baseMatch('m2', 'Semifinal 2', getTeam(1, 'Seed #2'), getTeam(2, 'Seed #3'), '20:30', 'MD3', 'de_inferno'),
      m3: baseMatch('m3', 'Grande Final', 'Vencedor SF1', 'Vencedor SF2', '22:00', 'MD3', 'de_nuke'),
    };
  }

  // 5. CASO 6 TIMES (Pro Byes: #1 e #2 direto na Semifinal)
  if (n === 6) {
    return {
      q1: baseMatch('q1', 'Quartas 1 (#3 vs #6)', getTeam(2, 'Seed #3'), getTeam(5, 'Seed #6'), '19:30', 'MD1', 'de_ancient'),
      q2: baseMatch('q2', 'Quartas 2 (#4 vs #5)', getTeam(3, 'Seed #4'), getTeam(4, 'Seed #5'), '19:30', 'MD1', 'de_anubis'),
      m1: baseMatch('m1', 'Semifinal 1 (Seed #1 em BYE)', getTeam(0, 'Seed #1'), 'Vencedor QF1', '20:30', 'MD3', 'de_mirage'),
      m2: baseMatch('m2', 'Semifinal 2 (Seed #2 em BYE)', getTeam(1, 'Seed #2'), 'Vencedor QF2', '20:30', 'MD3', 'de_inferno'),
      m3: baseMatch('m3', 'Grande Final', 'Vencedor SF1', 'Vencedor SF2', '22:15', 'MD3', 'de_nuke'),
    };
  }

  // 6. CASO 7 TIMES (Seed #1 em BYE na Semifinal)
  if (n === 7) {
    return {
      q1: baseMatch('q1', 'Quartas 1 (#2 vs #7)', getTeam(1, 'Seed #2'), getTeam(6, 'Seed #7'), '19:00', 'MD1', 'de_inferno'),
      q2: baseMatch('q2', 'Quartas 2 (#3 vs #6)', getTeam(2, 'Seed #3'), getTeam(5, 'Seed #6'), '19:00', 'MD1', 'de_dust2'),
      q3: baseMatch('q3', 'Quartas 3 (#4 vs #5)', getTeam(3, 'Seed #4'), getTeam(4, 'Seed #5'), '19:45', 'MD1', 'de_ancient'),
      m1: baseMatch('m1', 'Semifinal 1 (Seed #1 em BYE)', getTeam(0, 'Seed #1'), 'Vencedor QF1', '20:30', 'MD3', 'de_mirage'),
      m2: baseMatch('m2', 'Semifinal 2', 'Vencedor QF2', 'Vencedor QF3', '20:30', 'MD3', 'de_anubis'),
      m3: baseMatch('m3', 'Grande Final', 'Vencedor SF1', 'Vencedor SF2', '22:30', 'MD3', 'de_nuke'),
    };
  }

  // 7. CASO 8 TIMES
  if (n <= 8) {
    return {
      q1: baseMatch('q1', 'Quartas 1 (#1 vs #8)', getTeam(0, 'FURIA Academy'), getTeam(7, 'Fluxo Challengers'), '19:00', 'MD1', 'de_mirage'),
      q2: baseMatch('q2', 'Quartas 2 (#4 vs #5)', getTeam(3, 'paiN Gaming Mix'), getTeam(4, 'RED Canids Youth'), '19:00', 'MD1', 'de_inferno'),
      q3: baseMatch('q3', 'Quartas 3 (#2 vs #7)', getTeam(1, 'MIBR Academy'), getTeam(6, 'ODDIK Stars'), '20:00', 'MD1', 'de_nuke'),
      q4: baseMatch('q4', 'Quartas 4 (#3 vs #6)', getTeam(2, 'Imperial Feeder'), getTeam(5, 'Legacy Mix'), '20:00', 'MD1', 'de_dust2'),
      s1: baseMatch('s1', 'Semifinal 1', 'Vencedor Q1', 'Vencedor Q2', '21:00', 'MD3', 'de_ancient'),
      s2: baseMatch('s2', 'Semifinal 2', 'Vencedor Q3', 'Vencedor Q4', '21:00', 'MD3', 'de_anubis'),
      f1: baseMatch('f1', 'Grande Final', 'Vencedor SF1', 'Vencedor SF2', '22:30', 'MD3', 'de_cache'),
    };
  }

  // 8. CASO 9 a 12 TIMES (Play-ins + Grid Clássico)
  if (n <= 12) {
    return {
      pi1: baseMatch('pi1', 'Play-in 1', getTeam(6, 'Seed #7'), getTeam(7, 'Seed #8'), '18:30', 'MD1', 'de_dust2'),
      pi2: baseMatch('pi2', 'Play-in 2', getTeam(8, 'Seed #9'), getTeam(9, 'Seed #10'), '18:30', 'MD1', 'de_ancient'),
      q1: baseMatch('q1', 'Quartas 1', getTeam(0, 'Seed #1'), 'Vencedor Play-in 1', '19:30', 'MD1', 'de_mirage'),
      q2: baseMatch('q2', 'Quartas 2', getTeam(3, 'Seed #4'), getTeam(4, 'Seed #5'), '19:30', 'MD1', 'de_inferno'),
      q3: baseMatch('q3', 'Quartas 3', getTeam(1, 'Seed #2'), 'Vencedor Play-in 2', '20:15', 'MD1', 'de_nuke'),
      q4: baseMatch('q4', 'Quartas 4', getTeam(2, 'Seed #3'), getTeam(5, 'Seed #6'), '20:15', 'MD1', 'de_anubis'),
      s1: baseMatch('s1', 'Semifinal 1', 'Vencedor Q1', 'Vencedor Q2', '21:00', 'MD3', 'de_dust2'),
      s2: baseMatch('s2', 'Semifinal 2', 'Vencedor Q3', 'Vencedor Q4', '21:00', 'MD3', 'de_ancient'),
      f1: baseMatch('f1', 'Grande Final', 'Vencedor SF1', 'Vencedor SF2', '22:30', 'MD3', 'de_cache'),
    };
  }

  // 9. CASO 13 a 16 TIMES (Oitavas -> Quartas -> Semis -> Final)
  return {
    o1: baseMatch('o1', 'Oitavas 1 (#1 vs #16)', getTeam(0, 'Seed #1'), getTeam(15, 'Seed #16'), '17:00', 'MD1', 'de_mirage'),
    o2: baseMatch('o2', 'Oitavas 2 (#8 vs #9)', getTeam(7, 'Seed #8'), getTeam(8, 'Seed #9'), '17:00', 'MD1', 'de_inferno'),
    o3: baseMatch('o3', 'Oitavas 3 (#4 vs #13)', getTeam(3, 'Seed #4'), getTeam(12, 'Seed #13'), '17:45', 'MD1', 'de_nuke'),
    o4: baseMatch('o4', 'Oitavas 4 (#5 vs #12)', getTeam(4, 'Seed #5'), getTeam(11, 'Seed #12'), '17:45', 'MD1', 'de_dust2'),
    o5: baseMatch('o5', 'Oitavas 5 (#2 vs #15)', getTeam(1, 'Seed #2'), getTeam(14, 'Seed #15'), '18:30', 'MD1', 'de_ancient'),
    o6: baseMatch('o6', 'Oitavas 6 (#7 vs #10)', getTeam(6, 'Seed #7'), getTeam(9, 'Seed #10'), '18:30', 'MD1', 'de_anubis'),
    o7: baseMatch('o7', 'Oitavas 7 (#3 vs #14)', getTeam(2, 'Seed #3'), getTeam(13, 'Seed #14'), '19:15', 'MD1', 'de_cache'),
    o8: baseMatch('o8', 'Oitavas 8 (#6 vs #11)', getTeam(5, 'Seed #6'), getTeam(10, 'Seed #11'), '19:15', 'MD1', 'de_mirage'),
    q1: baseMatch('q1', 'Quartas 1', 'Vencedor O1', 'Vencedor O2', '20:00', 'MD1', 'de_inferno'),
    q2: baseMatch('q2', 'Quartas 2', 'Vencedor O3', 'Vencedor O4', '20:00', 'MD1', 'de_nuke'),
    q3: baseMatch('q3', 'Quartas 3', 'Vencedor O5', 'Vencedor O6', '20:45', 'MD1', 'de_dust2'),
    q4: baseMatch('q4', 'Quartas 4', 'Vencedor O7', 'Vencedor O8', '20:45', 'MD1', 'de_ancient'),
    s1: baseMatch('s1', 'Semifinal 1', 'Vencedor Q1', 'Vencedor Q2', '21:30', 'MD3', 'de_anubis'),
    s2: baseMatch('s2', 'Semifinal 2', 'Vencedor Q3', 'Vencedor Q4', '21:30', 'MD3', 'de_cache'),
    f1: baseMatch('f1', 'Grande Final (MD3/MD5)', 'Vencedor SF1', 'Vencedor SF2', '23:00', 'MD3', 'de_mirage'),
  };
}
