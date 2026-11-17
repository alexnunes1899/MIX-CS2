/**
 * CS2 Mix Hub • Gerador Oficial do Pacote de Treino Completo LXN (Source 2)
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
  { slot: 1, kp: 'KP_1', label: 'Numpad 1', role: 'Spawn 1 — Mais avançado / saída rápida' },
  { slot: 2, kp: 'KP_2', label: 'Numpad 2', role: 'Spawn 2 — Segundo spawn de rush' },
  { slot: 3, kp: 'KP_3', label: 'Numpad 3', role: 'Spawn 3 — Posição central da base' },
  { slot: 4, kp: 'KP_4', label: 'Numpad 4', role: 'Spawn 4 — Apoio / pixel intermediário' },
  { slot: 5, kp: 'KP_5', label: 'Numpad 5', role: 'Spawn 5 — Fundo da base TR' },
]);

export const TREINO_MAPS = Object.freeze([
  {
    id: 'mirage',
    name: 'Mirage',
    emoji: '🏜️',
    aliases: ['de_mirage', 'mirage', 'mrg'],
    spawns: [
      'setpos 1216.00 -115.00 -103.97; setang 0.00 -170.00 0.00',
      'setpos 1216.00 -17.00 -103.97; setang 0.00 -175.00 0.00',
      'setpos 1296.00 -352.00 -103.97; setang 0.00 180.00 0.00',
      'setpos 1216.00 -211.00 -103.97; setang 0.00 -165.00 0.00',
      'setpos 1376.00 -272.00 -103.97; setang 0.00 180.00 0.00',
    ],
  },
  {
    id: 'inferno',
    name: 'Inferno',
    emoji: '🔥',
    aliases: ['de_inferno', 'inferno', 'inf'],
    spawns: [
      'setpos -1546.00 416.00 -31.97; setang 0.00 20.00 0.00',
      'setpos -1584.00 320.00 -31.97; setang 0.00 15.00 0.00',
      'setpos -1648.00 384.00 -31.97; setang 0.00 10.00 0.00',
      'setpos -1616.00 480.00 -31.97; setang 0.00 25.00 0.00',
      'setpos -1712.00 352.00 -31.97; setang 0.00 15.00 0.00',
    ],
  },
  {
    id: 'dust2',
    name: 'Dust 2',
    emoji: '☀️',
    aliases: ['de_dust2', 'dust2', 'dust 2', 'd2'],
    spawns: [
      'setpos -512.00 -736.00 152.03; setang 0.00 90.00 0.00',
      'setpos -704.00 -736.00 152.03; setang 0.00 95.00 0.00',
      'setpos -608.00 -800.00 152.03; setang 0.00 90.00 0.00',
      'setpos -448.00 -800.00 152.03; setang 0.00 85.00 0.00',
      'setpos -768.00 -800.00 152.03; setang 0.00 95.00 0.00',
    ],
  },
  {
    id: 'ancient',
    name: 'Ancient',
    emoji: '🗿',
    aliases: ['de_ancient', 'ancient', 'anc'],
    spawns: [
      'setpos -384.00 -2208.00 -99.97; setang 0.00 90.00 0.00',
      'setpos -288.00 -2208.00 -99.97; setang 0.00 85.00 0.00',
      'setpos -480.00 -2208.00 -99.97; setang 0.00 95.00 0.00',
      'setpos -544.00 -2272.00 -99.97; setang 0.00 100.00 0.00',
      'setpos -352.00 -2304.00 -99.97; setang 0.00 90.00 0.00',
    ],
  },
  {
    id: 'anubis',
    name: 'Anubis',
    emoji: '🐍',
    aliases: ['de_anubis', 'anubis', 'anb'],
    spawns: [
      'setpos -416.00 -1504.00 64.03; setang 0.00 90.00 0.00',
      'setpos -512.00 -1504.00 64.03; setang 0.00 95.00 0.00',
      'setpos -320.00 -1504.00 64.03; setang 0.00 85.00 0.00',
      'setpos -256.00 -1568.00 64.03; setang 0.00 80.00 0.00',
      'setpos -448.00 -1600.00 64.03; setang 0.00 90.00 0.00',
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

  const mapBlocks = TREINO_MAPS.map((map) => {
    const spawnAliases = map.spawns
      .map((coords, idx) => `alias "${map.id}_s${idx + 1}" "${coords}"`)
      .join('\n');
    const kpBindings = map.spawns
      .map((_, idx) => `bind KP_${idx + 1} ${map.id}_s${idx + 1}`)
      .join('; ');
    return (
      `// ${map.name}\n` +
      `${spawnAliases}\n` +
      `alias "${map.id}" "${kpBindings}; echo [SPAWNS ${map.name.toUpperCase()} TR CARREGADOS NO NUMPAD 1-5]"`
    );
  }).join('\n\n');

  return [
    '// ====== TREINO COMPLETO LXN (ARQUIVO UNICO - VERIFICADO CS2) ======',
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
    '// ====== SPAWNS TR POR MAPA (NUMPAD 1 A 5 - SINTAXE PURA SOURCE 2) ======',
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
    'echo "====================================================="',
    'echo "CS2 MIX HUB • TREINO COMPLETO LXN - BOM TREINO!"',
    'echo "Spawns TR (Numpad 1-5): digite mirage, inferno, dust2, ancient ou anubis"',
    'echo "Para voltar ao normal depois do treino: digite reset"',
    'echo "====================================================="',
  ].join('\n');
}

export function buildTreinoLeiaMeMd(options = {}) {
  const b = resolveTreinoBinds(options);
  return `# Guia de Uso — Configuração de Treino CS2 (LXN • CS2 Mix Hub)

Este pacote contém o arquivo \`treino.cfg\` completo (modo treino, granadas infinitas, trajetória em tempo real e teleporte instantâneo para os 5 spawns competitivos da base TR nos principais mapas).

---

## 1. Instalação

1. Baixe ou salve o arquivo **\`treino.cfg\`** dentro da pasta \`cfg\` do Counter-Strike 2:
   \`\`\`text
   C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\
   \`\`\`
   *(Caso sua Steam esteja em outro disco, abra a Steam > botão direito no CS2 > **Gerenciar > Explorar arquivos locais** e navegue até \`game\\csgo\\cfg\` — ou use o instalador 1-clique no site).*

---

## 2. Como Ativar no Jogo

1. Abra uma partida local no modo **Treino** (com *Granadas Infinitas* e *Câmera de Granada* desmarcados no menu, pois o script configura tudo automaticamente).
2. Abra o console (\`'\`) e digite:
   \`\`\`text
   exec treino
   \`\`\`
3. Digite o nome do mapa em que você está para carregar os 5 spawns da base TR no teclado numérico:
   - \`mirage\`
   - \`inferno\`
   - \`dust2\`
   - \`ancient\`
   - \`anubis\`

> **Dica rápida:** Execute tudo em um comando só, por exemplo:
> \`exec treino; mirage\`

---

## 3. Atalhos de Teclado Configurados

### Teleporte para Spawns TR (Teclado Numérico / Numpad)
*Certifique-se de que a tecla **Num Lock** está ativada.*

| Tecla | Código Interno | Função |
| :--- | :--- | :--- |
| **Numpad 1** | \`KP_1\` | Teleporta para o **Spawn 1** (mais avançado / saída rápida) |
| **Numpad 2** | \`KP_2\` | Teleporta para o **Spawn 2** |
| **Numpad 3** | \`KP_3\` | Teleporta para o **Spawn 3** (central) |
| **Numpad 4** | \`KP_4\` | Teleporta para o **Spawn 4** |
| **Numpad 5** | \`KP_5\` | Teleporta para o **Spawn 5** (fundo da base) |

### Utilitários e Treino de Granadas

| Tecla | Comando | Função |
| :--- | :--- | :--- |
| **${b.rethrow.toUpperCase()}** | \`sv_rethrow_last_grenade\` | Repete exatamente a última granada lançada |
| **${b.noclip.toUpperCase()}** | \`noclip\` | Ativa/desativa voo livre pelo mapa |
| **${b.giveKit.toUpperCase()}** | \`give ...\` | Entrega AWP, colete com capacete e kit completo de granadas |
| **${b.slowMo.toUpperCase()}** | \`host_timescale 0.3\` | Deixa o jogo em câmera lenta |
| **${b.normalSpeed.toUpperCase()}** | \`host_timescale 1\` | Retorna a velocidade do jogo ao normal |
| **${b.restart.toUpperCase()}** | \`mp_restartgame 1\` | Reinicia a rodada imediatamente |
| **${b.xray.toUpperCase()}** | \`toggle r_drawothermodels 2 1\` | Ativa/desativa visualização de modelos através das paredes |

---

## 4. Como Voltar ao Normal Após o Treino

- **Se fechar o CS2:** As configurações de treino ficam apenas na sessão ativa.
- **Sem fechar o jogo:** Abra o console (\`'\`) e digite:
  \`\`\`text
  reset
  \`\`\`
  Esse comando limpa automaticamente as teclas \`KP_1\` a \`KP_5\` e executa \`${b.autoexecName}.cfg\`.
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
