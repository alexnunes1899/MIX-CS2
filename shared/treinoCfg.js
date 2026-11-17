/**
 * CS2 Mix Hub • Gerador Oficial do Pacote de Treino Completo LXN (Coordenadas Exatas CS2 - 12 Mapas)
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

export const TREINO_SPAWN_DESCRIPTIONS = Object.freeze([
  { slot: 1, kp: 'KP_1', label: 'Numpad 1', role: 'Teleporta para o Spawn 1 (exato CS2)' },
  { slot: 2, kp: 'KP_2', label: 'Numpad 2', role: 'Teleporta para o Spawn 2 (exato CS2)' },
  { slot: 3, kp: 'KP_3', label: 'Numpad 3', role: 'Teleporta para o Spawn 3 (exato CS2)' },
  { slot: 4, kp: 'KP_4', label: 'Numpad 4', role: 'Teleporta para o Spawn 4 (exato CS2)' },
  { slot: 5, kp: 'KP_5', label: 'Numpad 5', role: 'Teleporta para o Spawn 5 (exato CS2)' },
]);

export const TREINO_MAPS = Object.freeze([
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
    ],
  },
  {
    id: 'mirage',
    name: 'Mirage',
    emoji: '🏜️',
    aliases: ['de_mirage', 'mirage', 'mrg'],
    spawns: [
      'setpos 1136.00 32.00 -164.80; setang 0.00 -175.00 0.00',
      'setpos 1296.00 32.00 -168.00; setang 0.00 -175.00 0.00',
      'setpos 1136.00 -64.00 -164.50; setang 0.00 -170.00 0.00',
      'setpos 1216.00 -115.00 -164.00; setang 0.00 -170.00 0.00',
      'setpos 1216.00 -16.00 -164.00; setang 0.00 -175.00 0.00',
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
    ],
  },
  {
    id: 'train',
    name: 'Train',
    emoji: '🚂',
    aliases: ['de_train', 'train', 'trn'],
    spawns: [
      'setpos -1632.00 1344.00 -207.97; setang 0.00 -15.00 0.00',
      'setpos -1632.00 1472.00 -207.97; setang 0.00 -10.00 0.00',
      'setpos -1728.00 1344.00 -207.97; setang 0.00 -15.00 0.00',
      'setpos -1664.00 1216.00 -207.97; setang 0.00 -25.00 0.00',
      'setpos -1824.00 1344.00 -207.97; setang 0.00 -15.00 0.00',
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
    const spawnAliases = map.spawns
      .map((coords, idx) => `alias "${map.id}_s${idx + 1}" "${coords}"`)
      .join('\n');
    const kpBindings = map.spawns
      .map((_, idx) => `bind KP_${idx + 1} ${map.id}_s${idx + 1}`)
      .join('; ');
    return (
      `// ${mapIdx + 1}. ${map.name}\n` +
      `${spawnAliases}\n` +
      `alias "${map.id}" "${kpBindings}; echo [SPAWNS ${map.name.toUpperCase()} CS2 TR CARREGADOS NO NUMPAD 1-5]"`
    );
  }).join('\n\n');

  return [
    '// ====== TREINO COMPLETO LXN (ARQUIVO UNICO - COORDENADAS EXATAS CS2) ======',
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
    '// ====== SPAWNS TR POR MAPA (NUMPAD 1 A 5 - COORDENADAS EXATAS DO MAPA CS2) ======',
    '',
    mapBlocks,
    '',
    '// Comando rapido para limpar as teclas depois do treino',
    `alias "reset" "unbind KP_1; unbind KP_2; unbind KP_3; unbind KP_4; unbind KP_5; exec ${b.autoexecName}; echo [TREINO RESETADO E AUTOEXEC RECARREGADA]"`,
    '',
    '// Reiniciar o round e limpar console',
    'mp_restartgame 1',
    'clear',
    '',
    '// Mensagem de boas-vindas',
    'echo "========================================================================="',
    'echo "CS2 MIX HUB • TREINO COMPLETO LXN - BOM TREINO!"',
    'echo "Mapas disponiveis (Numpad 1-5): cache, anubis, mirage, inferno, dust2,"',
    'echo "ancient, nuke, overpass, vertigo, train, office ou italy"',
    'echo "Para voltar ao normal depois do treino: digite reset"',
    'echo "========================================================================="',
  ].join('\n');
}

export function buildTreinoLeiaMeMd(options = {}) {
  const b = resolveTreinoBinds(options);
  const mapRows = TREINO_MAPS.map((m) => `| **${m.name}** | \`${m.id}\` |`).join('\n');

  return `# Guia de Uso — Configuração de Treino CS2 Completa (LXN • CS2 Mix Hub)

Este pacote contém o arquivo **\`treino.cfg\`** atualizado com as **coordenadas exatas extraídas diretamente dos mapas do CS2** (incluindo o **novo remake da Cache** e **Anubis**), além de modo treino, granadas infinitas e câmera de trajetória em **${TREINO_MAPS.length} mapas do CS2**.

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
3. Em seguida, digite o comando correspondente ao mapa em que você está para vincular os 5 spawns oficiais da base TR nas teclas **1 a 5 do Numpad**:

| Mapa | Comando no Console |
| :--- | :--- |
${mapRows}

> **Dica rápida:** Você pode ativar o treino e o mapa na mesma linha usando ponto e vírgula (\`;\`), por exemplo:
> \`exec treino; cache\` ou \`exec treino; anubis\`

---

## 3. Atalhos de Teclado Configurados

### Teleporte para Spawns TR (Teclado Numérico / Numpad)
*Certifique-se de que a tecla **Num Lock** está ativada.*

| Tecla | Código Interno | Função |
| :--- | :--- | :--- |
| **Numpad 1** | \`KP_1\` | Teleporta para o **Spawn 1** |
| **Numpad 2** | \`KP_2\` | Teleporta para o **Spawn 2** |
| **Numpad 3** | \`KP_3\` | Teleporta para o **Spawn 3** |
| **Numpad 4** | \`KP_4\` | Teleporta para o **Spawn 4** |
| **Numpad 5** | \`KP_5\` | Teleporta para o **Spawn 5** |

### Utilitários e Treino de Granadas

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

## 4. Como Voltar ao Normal Após o Treino

- **Se fechar o CS2:** As configurações de treino ficam apenas na sessão atual; ao abrir o jogo novamente, sua \`${b.autoexecName}.cfg\` será carregada normalmente.
- **Se for jogar Competitivo, Premier ou Mix sem fechar o jogo:** Abra o console (\`'\`) e digite:
  \`\`\`text
  reset
  \`\`\`
  Esse comando limpa automaticamente as teclas \`KP_1\` a \`KP_5\` e recarrega sua \`${b.autoexecName}.cfg\`.
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
