export function formatDiscordSummary({ roomName, teamA, teamB, metrics, finalMap, startingSideTeamB }) {
  const mapStr = finalMap ? `🗺️ **Mapa Decisivo:** ${finalMap.name} (${finalMap.file})` : '🗺️ Mapa: A definir';
  const sideStr = startingSideTeamB 
    ? `🎯 **Lados:** Time A começa de **${startingSideTeamB === 'CT' ? 'TR' : 'CT'}** | Time B começa de **${startingSideTeamB}**` 
    : '';

  const teamAList = teamA.map((p) => `• ${p.nick} [Lvl ${p.level}]`).join('\n');
  const teamBList = teamB.map((p) => `• ${p.nick} [Lvl ${p.level}]`).join('\n');

  return `
🏆 **MIX CS2 - ${roomName.toUpperCase()}** 🏆
${mapStr}
${sideStr}

🛡️ **TIME A** (Média: ${metrics?.avgA || '-'} | Soma: ${metrics?.sumA || '-'})
${teamAList}

⚔️ **TIME B** (Média: ${metrics?.avgB || '-'} | Soma: ${metrics?.sumB || '-'})
${teamBList}

⚖️ **Equilíbrio:** ${metrics?.balancePercentage || 100}% (Diferença de ${metrics?.diff || 0} lvls)
Boa partida a todos! 🔥 GL HF!
`.trim();
}

export function formatServerCommand(finalMap) {
  if (!finalMap) return 'changelevel de_mirage';
  return `changelevel ${finalMap.file}; mp_warmup_end 1; mp_restartgame 1;`;
}
