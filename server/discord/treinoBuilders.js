import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import {
  buildTreinoCfg,
  buildTreinoLeiaMeMd,
  resolveTreinoMapKey,
  TREINO_MAPS,
} from '../../shared/treinoCfg.js';

/**
 * Builds message 1: text-only CS2 practice guide without attachments.
 */
export function buildTreinoGuidePayload(mapQuery = '') {
  const mapKey = resolveTreinoMapKey(mapQuery);
  const mapObj = TREINO_MAPS.find((m) => m.id === mapKey) || null;
  const activationCmd = mapObj ? `exec treino; ${mapObj.id}` : 'exec treino; mirage';
  const titleSuffix = mapObj ? ` (${mapObj.emoji} ${mapObj.name})` : '';

  const guideText = [
    `## 🎯 PACK DE TREINO COMPLETO CS2 • LXN${titleSuffix}`,
    '',
    '**1️⃣ Instalação**',
    '• Baixe o arquivo `treino.cfg` **enviado abaixo** e salve na pasta `cfg` do CS2:',
    '`C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\treino.cfg`',
    '*(Ou clique no botão **Personalizar / Instalar 1-Clique** abaixo para instalar automático via PowerShell.)*',
    '',
    '**2️⃣ Como Ativar no Jogo**',
    "• Abra um mapa no modo **Treino**, abra o console (`'`) e digite:",
    '```cfg',
    activationCmd,
    '```',
    '• **Mirage (12 spawns por fileira):** `1–4` Frente | `5–8` Meio | `9, 0, Del, Enter` Fundo/A',
    '• **Competitivos (`Numpad 1–0`):** `cache`, `anubis`, `inferno`, `dust2`, `ancient`, `nuke`, `overpass`, `vertigo`, `train`',
    '• **Reféns (`Numpad 1–5`):** `office`, `italy`',
    '',
    '**3️⃣ Atalhos do Treino**',
    '• **`P`** Repetir granada • **`N`** Voar (`noclip`) • **`O`** Kit AWP + Granadas',
    '• **`K`** / **`I`** Câmera lenta `0.3x` / Normal • **`U`** Reiniciar • **`L`** Raio-X modelos',
    '• **`reset`** Limpa todas as teclas do Numpad (`KP_1–KP_0, Del, Enter`) e recarrega sua `autoexec`',
  ].join('\n');

  return { content: guideText };
}

/**
 * Builds message 2: downloadable treino.cfg + LEIA-ME-Treino.txt and quick action buttons.
 */
export function buildTreinoDownloadPayload(treinoWebUrl) {
  const cfgBuffer = Buffer.from(buildTreinoCfg(), 'utf-8');
  const leiaMeBuffer = Buffer.from(buildTreinoLeiaMeMd(), 'utf-8');

  const cfgAttachment = new AttachmentBuilder(cfgBuffer, { name: 'treino.cfg' });
  const guideTxtAttachment = new AttachmentBuilder(leiaMeBuffer, { name: 'LEIA-ME-Treino.txt' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Personalizar / Instalar 1-Clique')
      .setEmoji('🎛️')
      .setStyle(ButtonStyle.Link)
      .setURL(treinoWebUrl),
    new ButtonBuilder()
      .setCustomId('treino_rcon_apply')
      .setLabel('Aplicar via RCON')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: '📥 **Arquivos para download abaixo** *(salve o `treino.cfg` na pasta `cfg` do CS2)*:',
    files: [cfgAttachment, guideTxtAttachment],
    components: [row],
  };
}
