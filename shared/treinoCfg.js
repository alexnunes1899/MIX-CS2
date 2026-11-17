/**
 * CS2 Mix Hub • Gerador Oficial do Pacote de Treino Completo LXN (Coordenadas Exatas CS2 - 12 Mapas / Até 12 Spawns)
 * Compartilhado entre Bot do Discord, Endpoints HTTP e Interface Web.
 */

export const TREINO_DEFAULT_BINDS = Object.freeze({
  rethrow: 'p',
  noclip: 'n',
  giveKit: 'o',
  slowMo: 'k',
  normalSpeed: 'i',
  restart: 'u',
  xray: 'l',
  autoexecName: 'autoexec',
});

export const TREINO_BIND_META = Object.freeze([
  { key: 'rethrow', label: 'Repetir Última Granada', cmd: 'sv_rethrow_last_grenade', hint: 'Refaz exatamente a última smoke/flash/molotov lançada' },
  { key: 'noclip', label: 'Noclip (Voar)', cmd: 'noclip', hint: 'Ativa/desativa voo livre (velocidade 1000)' },
  { key: 'giveKit', label: 'Kit AWP + Colete + Granadas', cmd: 'give weapon_awp; ...', hint: 'Entrega AWP, colete com capacete e kit completo' },
  { key: 'slowMo', label: 'Câmera Lenta (0.3x)', cmd: 'host_timescale 0.3', hint: 'Desacelera o tempo para acompanhar trajetórias' },
  { key: 'normalSpeed', label: 'Velocidade Normal (1.0x)', cmd: 'host_timescale 1', hint: 'Retorna o tempo do servidor ao normal' },
  { key: 'restart', label: 'Reiniciar Round', cmd: 'mp_restartgame 1', hint: 'Reinicia a rodada e limpa utilitários em 1 segundo' },
  { key: 'xray', label: 'Raio-X de Modelos', cmd: 'toggle r_drawothermodels 2 1', hint: 'Alterna visualização de modelos através das paredes' },
]);

const SPAWN_NUMPAD_KEYS = [
  'KP_1',
  'KP_2',
  'KP_3',
  'KP_4',
  'KP_5',
  'KP_6',
  'KP_7',
  'KP_8',
  'KP_9',
  'KP_0',
  'KP_DEL',
  'KP_ENTER',
];

export const TREINO_SPAWN_DESCRIPTIONS = Object.freeze([
  { slot: 1, kp: 'KP_1', label: 'Numpad 1', role: 'Spawn 1', mirageRole: 'Frente #1 (Canto direito / B)', competitiveOnly: false },
  { slot: 2, kp: 'KP_2', label: 'Numpad 2', role: 'Spawn 2', mirageRole: 'Frente #2 (Parede frente)', competitiveOnly: false },
  { slot: 3, kp: 'KP_3', label: 'Numpad 3', role: 'Spawn 3', mirageRole: 'Frente #3 (Parede frente)', competitiveOnly: false },
  { slot: 4, kp: 'KP_4', label: 'Numpad 4', role: 'Spawn 4', mirageRole: 'Frente #4 (Porta de madeira / A)', competitiveOnly: false },
  { slot: 5, kp: 'KP_5', label: 'Numpad 5', role: 'Spawn 5', mirageRole: 'Meio #5 (Fileira do meio / B)', competitiveOnly: false },
  { slot: 6, kp: 'KP_6', label: 'Numpad 6', role: 'Spawn 6 (Competitivos)', mirageRole: 'Meio #6 (Centro da base)', competitiveOnly: true },
  { slot: 7, kp: 'KP_7', label: 'Numpad 7', role: 'Spawn 7 (Competitivos)', mirageRole: 'Meio #7 (Centro-esquerda)', competitiveOnly: true },
  { slot: 8, kp: 'KP_8', label: 'Numpad 8', role: 'Spawn 8 (Competitivos)', mirageRole: 'Meio #8 (Alinhado saída Bomb A)', competitiveOnly: true },
  { slot: 9, kp: 'KP_9', label: 'Numpad 9', role: 'Spawn 9 (Competitivos)', mirageRole: 'Fundo #9 (Fundo direita / B)', competitiveOnly: true },
  { slot: 10, kp: 'KP_0', label: 'Numpad 0', role: 'Spawn 10 (Competitivos)', mirageRole: 'Fundo #10 (Fundo meio)', competitiveOnly: true },
  { slot: 11, kp: 'KP_DEL', label: 'Numpad Del', role: 'Spawn 11 (Mirage Fundo/A)', mirageRole: 'Fundo #11 (Lado Bomb A)', competitiveOnly: true },
  { slot: 12, kp: 'KP_ENTER', label: 'Numpad Enter', role: 'Spawn 12 (Mirage Entrada A)', mirageRole: 'Fundo #12 (Mais próximo do Bomb A)', competitiveOnly: true },
]);

export const TREINO_MAPS = Object.freeze([
  {
    id: 'mirage',
    name: 'Mirage',
    emoji: '🏜️',
    aliases: ['de_mirage', 'mirage', 'mrg'],
    customHeader: 'Todos os spawns organizados por fileira: 1-4 Frente | 5-8 Meio | 9, 0, Del Fundo/Lado A',
    customEcho: '[SPAWNS MIRAGE CS2 TR CARREGADOS: 1-4 FRENTE | 5-8 MEIO | 9, 0, DEL, ENTER FUNDO/A]',
    spawns: [
      'setpos 1136.00 32.00 -164.80; setang 0.00 -175.00 0.00',
      'setpos 1136.00 -64.00 -164.50; setang 0.00 -170.00 0.00',
      'setpos 1136.00 -160.00 -164.00; setang 0.00 -170.00 0.00',
      'setpos 1136.00 -256.00 -164.00; setang 0.00 -165.00 0.00',
      'setpos 1216.00 -16.00 -164.00; setang 0.00 -175.00 0.00',
      'setpos 1216.00 -115.00 -164.00; setang 0.00 -170.00 0.00',
      'setpos 1216.00 -211.00 -164.00; setang 0.00 -165.00 0.00',
      'setpos 1216.00 -307.00 -164.00; setang 0.00 -160.00 0.00',
      'setpos 1296.00 32.00 -168.00; setang 0.00 -175.00 0.00',
      'setpos 1296.00 -160.00 -164.00; setang 0.00 -170.00 0.00',
      'setpos 1296.00 -256.00 -164.00; setang 0.00 -165.00 0.00',
      'setpos 1296.00 -352.00 -164.00; setang 0.00 -155.00 0.00',
    ],
  },
  {
    id: 'cache',
    name: 'Cache (Remake CS2)',
    emoji: '☢️',
    aliases: ['de_cache', 'cache', 'cac'],
    spawns: [
      'setpos 3019.30 225.40 1616.00; setang 0.00 -176.30 0.00',
      'setpos 3077.80 135.90 1616.00; setang 0.00 -177.70 0.00',
      'setpos 2916.80 69.40 1608.00; setang 0.00 -178.70 0.00',
      'setpos 3041.80 -21.10 1608.00; setang 0.00 180.00 0.00',
      'setpos 3094.30 -152.60 1608.00; setang 0.00 177.00 0.00',
      'setpos 2960.00 156.00 1616.00; setang 0.00 -176.00 0.00',
      'setpos 2980.00 40.00 1612.00; setang 0.00 -178.00 0.00',
      'setpos 2944.00 -88.00 1612.00; setang 0.00 179.00 0.00',
      'setpos 3120.00 48.00 1616.00; setang 0.00 -178.00 0.00',
      'setpos 3128.00 -76.00 1612.00; setang 0.00 178.00 0.00',
    ],
  },
  {
    id: 'anubis',
    name: 'Anubis',
    emoji: '🐍',
    aliases: ['de_anubis', 'anubis', 'anb'],
    spawns: [
      'setpos -384.00 -1552.00 -12.00; setang 0.00 90.00 0.00',
      'setpos -328.00 -1528.00 -12.00; setang 0.00 85.00 0.00',
      'setpos -234.00 -1503.10 -12.00; setang 0.00 80.00 0.00',
      'setpos -154.00 -1503.10 -12.00; setang 0.00 80.00 0.00',
      'setpos -416.00 -1608.00 2.00; setang 0.00 95.00 0.00',
      'setpos -480.00 -1552.00 -12.00; setang 0.00 95.00 0.00',
      'setpos -320.00 -1608.00 2.00; setang 0.00 90.00 0.00',
      'setpos -234.00 -1584.00 -4.00; setang 0.00 85.00 0.00',
      'setpos -464.00 -1496.00 -12.00; setang 0.00 95.00 0.00',
      'setpos -154.00 -1576.00 -6.00; setang 0.00 80.00 0.00',
    ],
  },
  {
    id: 'inferno',
    name: 'Inferno',
    emoji: '🔥',
    aliases: ['de_inferno', 'inferno', 'inf'],
    spawns: [
      'setpos -1586.50 440.80 -64.00; setang 0.00 20.00 0.00',
      'setpos -1520.10 430.90 -64.00; setang 0.00 15.00 0.00',
      'setpos -1675.60 351.70 -64.00; setang 0.00 15.00 0.00',
      'setpos -1657.20 419.60 -64.00; setang 0.00 20.00 0.00',
      'setpos -1662.20 288.80 -64.00; setang 0.00 10.00 0.00',
      'setpos -1591.20 361.90 -64.00; setang 0.00 15.00 0.00',
      'setpos -1524.00 355.00 -64.00; setang 0.00 15.00 0.00',
      'setpos -1462.00 398.00 -64.00; setang 0.00 20.00 0.00',
      'setpos -1585.00 292.00 -64.00; setang 0.00 10.00 0.00',
      'setpos -1728.00 384.00 -64.00; setang 0.00 15.00 0.00',
    ],
  },
  {
    id: 'dust2',
    name: 'Dust 2',
    emoji: '☀️',
    aliases: ['de_dust2', 'dust2', 'dust 2', 'd2'],
    spawns: [
      'setpos -857.50 -738.40 122.10; setang 0.00 90.00 0.00',
      'setpos -1181.00 -754.00 120.20; setang 0.00 95.00 0.00',
      'setpos -1015.00 -808.00 116.10; setang 0.00 90.00 0.00',
      'setpos -696.80 -806.60 116.70; setang 0.00 85.00 0.00',
      'setpos -332.00 -754.00 78.90; setang 0.00 85.00 0.00',
      'setpos -512.00 -752.00 104.50; setang 0.00 85.00 0.00',
      'setpos -940.00 -744.00 121.50; setang 0.00 90.00 0.00',
      'setpos -1104.00 -812.00 117.80; setang 0.00 95.00 0.00',
      'setpos -776.00 -748.00 121.00; setang 0.00 90.00 0.00',
      'setpos -608.00 -748.00 115.20; setang 0.00 85.00 0.00',
    ],
  },
  {
    id: 'ancient',
    name: 'Ancient',
    emoji: '🗿',
    aliases: ['de_ancient', 'ancient', 'anc'],
    spawns: [
      'setpos -520.00 -2224.00 -163.30; setang 0.00 90.00 0.00',
      'setpos -392.00 -2224.00 -163.30; setang 0.00 90.00 0.00',
      'setpos -584.00 -2288.00 -162.40; setang 0.00 95.00 0.00',
      'setpos -456.00 -2288.00 -163.30; setang 0.00 90.00 0.00',
      'setpos -328.00 -2288.00 -163.30; setang 0.00 85.00 0.00',
      'setpos -264.00 -2224.00 -163.30; setang 0.00 85.00 0.00',
      'setpos -648.00 -2224.00 -162.40; setang 0.00 95.00 0.00',
      'setpos -520.00 -2352.00 -163.30; setang 0.00 90.00 0.00',
      'setpos -392.00 -2352.00 -163.30; setang 0.00 90.00 0.00',
      'setpos -264.00 -2352.00 -163.30; setang 0.00 85.00 0.00',
    ],
  },
  {
    id: 'nuke',
    name: 'Nuke',
    emoji: '⚡',
    aliases: ['de_nuke', 'nuke', 'nuk'],
    spawns: [
      'setpos -1947.00 -965.10 -416.00; setang 0.00 15.00 0.00',
      'setpos -1808.00 -1025.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1947.00 -1102.10 -416.00; setang 0.00 15.00 0.00',
      'setpos -1874.00 -1076.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1832.00 -1160.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1876.00 -988.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1752.00 -1068.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1760.00 -964.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1912.00 -1168.00 -416.00; setang 0.00 15.00 0.00',
      'setpos -1752.00 -1148.00 -416.00; setang 0.00 15.00 0.00',
    ],
  },
  {
    id: 'overpass',
    name: 'Overpass',
    emoji: '🌉',
    aliases: ['de_overpass', 'overpass', 'ovp'],
    spawns: [
      'setpos -1510.40 -3053.90 281.10; setang 0.00 75.00 0.00',
      'setpos -1499.00 -3126.00 276.90; setang 0.00 75.00 0.00',
      'setpos -1422.40 -3129.70 268.40; setang 0.00 75.00 0.00',
      'setpos -1363.00 -3122.00 260.60; setang 0.00 75.00 0.00',
      'setpos -1271.00 -3262.00 266.20; setang 0.00 75.00 0.00',
      'setpos -1440.00 -3056.00 272.00; setang 0.00 75.00 0.00',
      'setpos -1368.00 -3056.00 263.50; setang 0.00 75.00 0.00',
      'setpos -1488.00 -3204.00 282.00; setang 0.00 75.00 0.00',
      'setpos -1408.00 -3208.00 273.50; setang 0.00 75.00 0.00',
      'setpos -1336.00 -3208.00 265.00; setang 0.00 75.00 0.00',
    ],
  },
  {
    id: 'vertigo',
    name: 'Vertigo',
    emoji: '🏗️',
    aliases: ['de_vertigo', 'vertigo', 'vrg'],
    spawns: [
      'setpos -1468.80 -1194.40 11488.00; setang 0.00 55.00 0.00',
      'setpos -1411.30 -1130.30 11488.00; setang 0.00 60.00 0.00',
      'setpos -1439.80 -1322.00 11488.00; setang 0.00 55.00 0.00',
      'setpos -1439.60 -1251.70 11488.00; setang 0.00 60.00 0.00',
      'setpos -1502.60 -1360.80 11488.00; setang 0.00 55.00 0.00',
      'setpos -1356.00 -1188.00 11488.00; setang 0.00 60.00 0.00',
      'setpos -1376.00 -1288.00 11488.00; setang 0.00 55.00 0.00',
      'setpos -1524.00 -1264.00 11488.00; setang 0.00 55.00 0.00',
      'setpos -1324.00 -1248.00 11488.00; setang 0.00 60.00 0.00',
      'setpos -1424.00 -1388.00 11488.00; setang 0.00 55.00 0.00',
    ],
  },
  {
    id: 'train',
    name: 'Train (Remake CS2)',
    emoji: '🚂',
    aliases: ['de_train', 'train', 'trn'],
    spawns: [
      'setpos -1568.00 1376.00 -200.00; setang 0.00 -15.00 0.00',
      'setpos -1568.00 1472.00 -200.00; setang 0.00 -15.00 0.00',
      'setpos -1648.00 1312.00 -200.00; setang 0.00 -10.00 0.00',
      'setpos -1648.00 1424.00 -200.00; setang 0.00 -15.00 0.00',
      'setpos -1728.00 1360.00 -200.00; setang 0.00 -15.00 0.00',
      'setpos -1728.00 1472.00 -200.00; setang 0.00 -15.00 0.00',
      'setpos -1632.00 1232.00 -200.00; setang 0.00 -20.00 0.00',
      'setpos -1712.00 1248.00 -200.00; setang 0.00 -20.00 0.00',
      'setpos -1808.00 1312.00 -200.00; setang 0.00 -15.00 0.00',
      'setpos -1808.00 1424.00 -200.00; setang 0.00 -15.00 0.00',
    ],
  },
  {
    id: 'office',
    name: 'Office',
    emoji: '🏢',
    aliases: ['cs_office', 'office', 'ofc'],
    spawns: [
      'setpos 1216.00 768.00 -159.97; setang 0.00 180.00 0.00',
      'setpos 1216.00 896.00 -159.97; setang 0.00 -170.00 0.00',
      'setpos 1312.00 832.00 -159.97; setang 0.00 180.00 0.00',
      'setpos 1280.00 704.00 -159.97; setang 0.00 175.00 0.00',
      'setpos 1408.00 832.00 -159.97; setang 0.00 180.00 0.00',
    ],
  },
  {
    id: 'italy',
    name: 'Italy',
    emoji: '🏘️',
    aliases: ['cs_italy', 'italy', 'itl'],
    spawns: [
      'setpos -128.00 1824.00 160.03; setang 0.00 -90.00 0.00',
      'setpos -224.00 1856.00 160.03; setang 0.00 -80.00 0.00',
      'setpos -160.00 1920.00 160.03; setang 0.00 -90.00 0.00',
      'setpos -64.00 1888.00 160.03; setang 0.00 -100.00 0.00',
      'setpos -160.00 2016.00 160.03; setang 0.00 -90.00 0.00',
    ],
  },
]);

export function sanitizeCfgBindKey(raw, fallback) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16);
  return cleaned || fallback;
}

export function sanitizeAutoexecName(raw, fallback = 'autoexec') {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\.cfg$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32);
  return cleaned || fallback;
}

export function resolveTreinoMapKey(query) {
  const norm = String(query || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!norm) return null;
  for (const map of TREINO_MAPS) {
    if (map.aliases.some((alias) => norm === alias || norm.includes(alias))) {
      return map.id;
    }
  }
  return null;
}

export function resolveTreinoBinds(options = {}) {
  return {
    rethrow: sanitizeCfgBindKey(options.rethrow, TREINO_DEFAULT_BINDS.rethrow),
    noclip: sanitizeCfgBindKey(options.noclip, TREINO_DEFAULT_BINDS.noclip),
    giveKit: sanitizeCfgBindKey(options.giveKit, TREINO_DEFAULT_BINDS.giveKit),
    slowMo: sanitizeCfgBindKey(options.slowMo, TREINO_DEFAULT_BINDS.slowMo),
    normalSpeed: sanitizeCfgBindKey(options.normalSpeed, TREINO_DEFAULT_BINDS.normalSpeed),
    restart: sanitizeCfgBindKey(options.restart, TREINO_DEFAULT_BINDS.restart),
    xray: sanitizeCfgBindKey(options.xray, TREINO_DEFAULT_BINDS.xray),
    autoexecName: sanitizeAutoexecName(options.autoexecName, TREINO_DEFAULT_BINDS.autoexecName),
  };
}

export function buildTreinoCfg(options = {}) {
  const b = resolveTreinoBinds(options);

  const mapBlocks = TREINO_MAPS.map((map, mapIdx) => {
    const count = map.spawns.length;
    const isFullTen = count === 10;
    const headerSuffix = map.customHeader
      ? map.customHeader
      : isFullTen
      ? '10 Spawns TR no Numpad 1 a 0'
      : `${count} Spawns TR no Numpad 1 a ${count}`;
    const rangeTag = isFullTen ? '1-10' : `1-${count}`;
    const keyRangeTag = isFullTen ? '1-0' : `1-${count}`;

    const spawnAliases = map.spawns
      .map((coords, idx) => `alias "${map.id}_s${idx + 1}" "${coords}"`)
      .join('\n');
    const kpBindings = map.spawns
      .map((_, idx) => `bind ${SPAWN_NUMPAD_KEYS[idx]} ${map.id}_s${idx + 1}`)
      .join('; ');
    const unusedUnbinds = count < SPAWN_NUMPAD_KEYS.length
      ? `; ${SPAWN_NUMPAD_KEYS.slice(count).map((kp) => `unbind ${kp}`).join('; ')}`
      : '';
    const echoMsg = map.customEcho || `[SPAWNS ${map.name.toUpperCase()} CS2 TR ${rangeTag} CARREGADOS NO NUMPAD ${keyRangeTag}]`;

    return (
      `// ${mapIdx + 1}. ${map.name} (${headerSuffix})\n` +
      `${spawnAliases}\n` +
      `alias "${map.id}" "${kpBindings}${unusedUnbinds}; echo ${echoMsg}"`
    );
  }).join('\n\n');

  const unbindAllNumpad = SPAWN_NUMPAD_KEYS.map((kp) => `unbind ${kp}`).join('; ');

  return [
    '// ====== TREINO COMPLETO LXN (ARQUIVO UNICO - TODOS OS MAPAS ATUALIZADOS CS2) ======',
    '',
    '// Ativar cheats',
    'sv_cheats 1',
    '',
    '// Tempo infinito',
    'mp_roundtime 60',
    'mp_roundtime_defuse 60',
    'mp_roundtime_hostage 60',
    'mp_freezetime 0',
    '',
    '// Remover aquecimento',
    'mp_warmup_end',
    'mp_warmuptime 0',
    'mp_warmup_pausetimer 0',
    '',
    '// Dinheiro infinito',
    'mp_maxmoney 65535',
    'mp_startmoney 65535',
    'mp_afterroundmoney 65535',
    'mp_buy_anywhere 1',
    'mp_buytime 99999',
    '',
    '// Granadas infinitas',
    'sv_infinite_ammo 2',
    'ammo_grenade_limit_total 5',
    '',
    '// Treino de granadas',
    'sv_grenade_trajectory 1',
    'sv_grenade_trajectory_time 10',
    'cl_sim_grenade_trajectory 1',
    'sv_grenade_trajectory_dash 1',
    'sv_grenade_trajectory_prac_pipreview true',
    'sv_grenade_trajectory_prac_trailtime 15',
    'sv_grenade_trajectory_time_spectator 15',
    `bind "${b.rethrow}" "sv_rethrow_last_grenade"`,
    '',
    '// Respawn instantaneo',
    'mp_respawn_on_death_ct 1',
    'mp_respawn_on_death_t 1',
    '',
    '// Movimentacao',
    'sv_noclipspeed 1000',
    `bind "${b.noclip}" "noclip"`,
    '',
    '// Binds para pegar itens',
    `bind "${b.giveKit}" "give weapon_awp; give weapon_flashbang; give weapon_smokegrenade; give weapon_molotov; give weapon_hegrenade; give item_assaultsuit"`,
    '',
    '// Comandos uteis',
    `bind "${b.slowMo}" "host_timescale 0.3"`,
    `bind "${b.normalSpeed}" "host_timescale 1"`,
    `bind "${b.restart}" "mp_restartgame 1"`,
    `bind "${b.xray}" "toggle r_drawothermodels 2 1"`,
    '',
    '// ====== SPAWNS TR POR MAPA (SINTAXE PURA SOURCE 2) ======',
    '',
    mapBlocks,
    '',
    '// Comando rapido para limpar todas as teclas do Numpad depois do treino',
    `alias "reset" "${unbindAllNumpad}; exec ${b.autoexecName}; echo [TREINO RESETADO E AUTOEXEC RECARREGADA]"`,
    '',
    '// Reiniciar o round e limpar console',
    'mp_restartgame 1',
    'clear',
    '',
    '// Mensagem de boas-vindas',
    'echo "========================================================================="',
    'echo "CS2 MIX HUB • TREINO COMPLETO LXN - BOM TREINO!"',
    'echo "Mirage (12 spawns TR organizados por fileira): 1-4 Frente | 5-8 Meio | 9, 0, Del, Enter Fundo/A"',
    'echo "Demais mapas competitivos (Numpad 1-0): cache, anubis, inferno, dust2,"',
    'echo "ancient, nuke, overpass, vertigo ou train"',
    'echo "Mapas refens (Numpad 1-5): office ou italy"',
    'echo "Para voltar ao normal depois do treino: digite reset"',
    'echo "========================================================================="',
  ].join('\n');
}

export function buildTreinoLeiaMeMd(options = {}) {
  const b = resolveTreinoBinds(options);
  const mapRows = TREINO_MAPS.map((m) => {
    const label = m.spawns.length >= 12
      ? `**${m.spawns.length} spawns TR** (Numpad \`1\`–\`0\`, \`Del\` e \`Enter\`)`
      : m.spawns.length >= 10
      ? '**10 spawns TR** (Numpad `1` a `0`)'
      : `**${m.spawns.length} spawns TR** (Numpad \`1\` a \`${m.spawns.length}\`)`;
    return `| **${m.name}** | \`${m.id}\` | ${label} |`;
  }).join('\n');

  return `# Guia de Uso — Configuração de Treino CS2 Completa (LXN • CS2 Mix Hub)

Este pacote contém o arquivo **\`treino.cfg\`** unificado e atualizado com as **coordenadas oficiais extraídas dos mapas do CS2** — incluindo **todos os 12 spawns da base TR da Mirage organizados por fileira** (inclusive os spawns do extremo lado do **Bomb A / Rampa / Palácio**) e os **10 spawns competitivos** nos demais mapas (incluindo os remakes de **Cache** e **Train**).

---

## 1. Instalação

1. Baixe ou salve o arquivo **\`treino.cfg\`** dentro da pasta \`cfg\` do Counter-Strike 2:
   \`\`\`text
   C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\
   \`\`\`
   *(Caso sua Steam esteja em outro disco, abra a Steam > clique com o botão direito no CS2 > **Gerenciar > Explorar arquivos locais** e navegue até \`game\\csgo\\cfg\` — ou use o instalador 1-clique no site).*

---

## 2. Como Ativar no Jogo

1. Entre em uma partida local no modo **Treino**.
2. Abra o console (\`'\`) e digite:
   \`\`\`text
   exec treino
   \`\`\`
3. Em seguida, digite o comando correspondente ao mapa em que você está:

| Mapa | Comando no Console | Spawns Disponíveis |
| :--- | :--- | :--- |
${mapRows}

> **Dica rápida:** Você pode ativar o treino e o mapa na mesma linha usando ponto e vírgula (\`;\`), por exemplo:
> \`exec treino; mirage\`

---

## 3. Organização dos Spawns na Mirage (Do Lado B para o Lado A)

Na **Mirage**, as teclas do Numpad seguem agora a ordem exata das fileiras da direita (lado B) para a esquerda (lado do **Bomb A / Rampa / Palácio**):

| Fileira | Tecla Numpad | Código | Posição |
| :--- | :--- | :--- | :--- |
| **Frente** (colada na parede) | **1, 2, 3, 4** | \`KP_1\` a \`KP_4\` | Do canto direito (B) até a porta de madeira (A) |
| **Meio** | **5, 6, 7, 8** | \`KP_5\` a \`KP_8\` | Do lado B até o spawn **8** alinhado com a saída do Bomb A |
| **Fundo** | **9, 0, Del, Enter** | \`KP_9\`, \`KP_0\`, \`KP_DEL\`, \`KP_ENTER\` | Do fundo B até o **Enter** (spawn mais próximo da entrada do Bomb A) |

---

## 4. Utilitários e Treino de Granadas

| Tecla | Comando | Função |
| :--- | :--- | :--- |
| **${b.rethrow.toUpperCase()}** | \`sv_rethrow_last_grenade\` | Repete exatamente a última granada lançada |
| **${b.noclip.toUpperCase()}** | \`noclip\` | Ativa/desativa voo livre pelo mapa |
| **${b.giveKit.toUpperCase()}** | \`give ...\` | Entrega AWP, colete com capacete e kit completo de granadas |
| **${b.slowMo.toUpperCase()}** | \`host_timescale 0.3\` | Deixa o jogo em câmera lenta (ideal para acompanhar trajetórias) |
| **${b.normalSpeed.toUpperCase()}** | \`host_timescale 1\` | Retorna a velocidade do jogo ao normal |
| **${b.restart.toUpperCase()}** | \`mp_restartgame 1\` | Reinicia a rodada imediatamente |
| **${b.xray.toUpperCase()}** | \`toggle r_drawothermodels 2 1\` | Ativa/desativa visualização de modelos através das paredes |

---

## 5. Como Voltar ao Normal Após o Treino

- **Se fechar o CS2:** As configurações de treino ficam apenas na sessão atual; ao abrir o jogo novamente, sua \`${b.autoexecName}.cfg\` será carregada normalmente.
- **Se for jogar Competitivo, Premier ou Mix sem fechar o jogo:** Abra o console (\`'\`) e digite:
  \`\`\`text
  reset
  \`\`\`
  Esse comando limpa automaticamente todas as teclas do Numpad (\`KP_1\` a \`KP_0\`, \`KP_DEL\`, \`KP_ENTER\`) e recarrega sua \`${b.autoexecName}.cfg\`.
`;
}

/**
 * Comandos server-side seguros para aplicar modo treino em servidor dedicado CS2 via RCON.
 */
export function buildTreinoRconCommands() {
  return [
    'sv_cheats 1',
    'mp_warmup_end',
    'mp_roundtime 60',
    'mp_roundtime_defuse 60',
    'mp_freezetime 0',
    'mp_maxmoney 65535',
    'mp_startmoney 65535',
    'mp_buy_anywhere 1',
    'mp_buytime 99999',
    'sv_infinite_ammo 2',
    'ammo_grenade_limit_total 5',
    'sv_grenade_trajectory_prac_pipreview 1',
    'sv_grenade_trajectory_prac_trailtime 15',
    'mp_respawn_on_death_ct 1',
    'mp_respawn_on_death_t 1',
    'sv_noclipspeed 1000',
    'mp_restartgame 1',
    'say ">>> [CS2 MIX HUB] Modo Treino LXN ativado via RCON!"',
  ].join('; ');
}
