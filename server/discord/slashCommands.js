import { SlashCommandBuilder, ChannelType } from 'discord.js';

/**
 * Builds all official Discord Slash Command definitions for CS2 Mix Hub.
 */
export function buildSlashCommands({ officialMaps = [], treinoMaps = [] } = {}) {
  return [
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
      .addSubcommand((sub) => sub.setName('puxar').setDescription('Inscreve todos os jogadores da call de voz na fila do Mix'))
      .addSubcommand((sub) => sub.setName('cancelar').setDescription('Cancela o mix atual do canal')),

    new SlashCommandBuilder()
      .setName('vincular')
      .setDescription('Vincula sua conta do Discord com sua conta Steam do CS2 Mix Hub')
      .addStringOption((opt) =>
        opt
          .setName('codigo')
          .setDescription('Código de 6 dígitos gerado no site (deixe vazio para gerar um código aqui)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('dupla')
      .setDescription('Forma ou limpa sua dupla fixa para cair no mesmo time no sorteio')
      .addUserOption((opt) => opt.setName('amigo').setDescription('Amigo para jogar no mesmo time que você').setRequired(false))
      .addStringOption((opt) =>
        opt
          .setName('acao')
          .setDescription('Opcional: sair da sua dupla atual ou limpar todas as duplas do lobby')
          .setRequired(false)
          .addChoices(
            { name: 'Formar dupla com @amigo', value: 'formar' },
            { name: 'Sair da minha dupla', value: 'sair' },
            { name: 'Limpar todas as duplas (criador)', value: 'limpar' }
          )
      ),

    new SlashCommandBuilder()
      .setName('agendar')
      .setDescription('Agenda um Mix CS2 com confirmação de presença e lembrete 15 min antes')
      .addStringOption((opt) =>
        opt.setName('horario').setDescription('Horário do mix (ex: 21:00, 21h30, amanha 20:00, 25/11 21:00)').setRequired(true)
      )
      .addStringOption((opt) => opt.setName('nome').setDescription('Título do Mix (ex: Mix dos Crias)').setRequired(false))
      .addStringOption((opt) =>
        opt
          .setName('formato')
          .setDescription('Formato da Partida')
          .setRequired(false)
          .addChoices({ name: 'Melhor de 1 (MD1)', value: 'MD1' }, { name: 'Melhor de 3 (MD3)', value: 'MD3' })
      ),

    new SlashCommandBuilder()
      .setName('painel')
      .setDescription('Cria o Painel Permanente do CS2 Mix Hub com botão de criar mix em 1 clique'),

    new SlashCommandBuilder()
      .setName('roleta')
      .setDescription('Roleta justa de mapas (não repete até sair todos) ou escolha um mapa')
      .addStringOption((opt) =>
        opt
          .setName('mapa')
          .setDescription('Opcional: escolher um mapa específico em vez de sortear')
          .setRequired(false)
          .addChoices(...officialMaps.map((m) => ({ name: m.name, value: m.id })))
      ),

    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Consulta suas estatísticas do Mix Hub, nível GC e vínculo Steam/FACEIT')
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
            { name: 'Anubis', value: 'anubis' },
            { name: 'Overpass', value: 'overpass' },
            { name: 'Train', value: 'train' },
            { name: 'Cache', value: 'cache' },
            { name: 'Vertigo', value: 'vertigo' }
          )
      ),

    new SlashCommandBuilder()
      .setName('treino')
      .setDescription('Envia o pacote completo de treino LXN (treino.cfg + guia + até 12 spawns TR no Numpad)')
      .addStringOption((opt) =>
        opt
          .setName('mapa')
          .setDescription('Mapa para destacar os spawns TR (Mirage 12 spawns | outros 10/5 spawns)')
          .setRequired(false)
          .addChoices(...treinoMaps.map((m) => ({ name: m.name, value: m.id })))
      ),

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
      .setDescription('Consulta ao vivo o servidor CS2 (A2S_INFO Steam UDP: Ping, mapa e players online)')
      .addStringOption((opt) =>
        opt
          .setName('endereco')
          .setDescription('IP:Porta do servidor CS2 (opcional; usa o servidor do mix/padrão)')
          .setRequired(false)
      ),

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
      .setDescription('Radar ao vivo de jogos grátis para resgatar na Epic Games Store'),

    new SlashCommandBuilder()
      .setName('clip')
      .setDescription('Envia um clipe de jogada no canal com votação da comunidade')
      .addStringOption((opt) => opt.setName('link').setDescription('Link do clipe (Medal.tv, Twitch, YouTube, etc)').setRequired(true))
      .addStringOption((opt) => opt.setName('titulo').setDescription('Título ou descrição da jogada (opcional)').setRequired(false)),

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

    new SlashCommandBuilder()
      .setName('integracao')
      .setDescription('Abre o passo a passo oficial para integrar seu servidor privado de CS2 ao Bot e ao Web Hub'),

    new SlashCommandBuilder()
      .setName('coach')
      .setDescription('Pergunte ao Coach/Analista IA do Hub sobre táticas CS2, smokes ou análise do histórico')
      .addStringOption((opt) =>
        opt.setName('pergunta').setDescription('Ex: Como segurar meio na Ancient de CT? Ou analisa nosso histórico hoje').setRequired(true)
      ),

    new SlashCommandBuilder().setName('ajuda').setDescription('Manual completo de comandos do Bot do Mix'),
  ];
}
