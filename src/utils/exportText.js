export function formatDiscordSummary({ roomName, teamA, teamB, metrics, finalMap, startingSideTeamB, matchFormat = 'MD1', drawnSeries = [] }) {
  const isSeries = matchFormat !== 'MD1' && Array.isArray(drawnSeries) && drawnSeries.length > 1;
  
  let mapsSection = '';
  if (isSeries) {
    mapsSection = `🏆 **Formato da Partida:** ${matchFormat}\n` +
      drawnSeries.map((item, idx) => {
        const sideA = item.sideTimeA || 'CT';
        const sideB = sideA === 'CT' ? 'TR' : 'CT';
        const mapName = item.map?.name || item.map || 'Mapa';
        const role = item.role || `Mapa #${idx + 1}`;
        return `• **#${idx + 1} ${mapName}:** ${role} (Time A: **${sideA}** | Time B: **${sideB}**)`;
      }).join('\n');
  } else {
    const mapStr = finalMap ? `🗺️ **Mapa Decisivo:** ${finalMap.name} (${finalMap.file})` : '🗺️ Mapa: A definir';
    const sideStr = startingSideTeamB 
      ? `🎯 **Lados:** Time A começa de **${startingSideTeamB === 'CT' ? 'TR' : 'CT'}** | Time B começa de **${startingSideTeamB}**` 
      : '';
    mapsSection = `${mapStr}\n${sideStr}`.trim();
  }

  const teamAList = teamA.map((p) => `• ${p.nick} [${p.faceitLevel ? `FACEIT ${p.faceitLevel}` : `Lvl ${p.level}`}]`).join('\n');
  const teamBList = teamB.map((p) => `• ${p.nick} [${p.faceitLevel ? `FACEIT ${p.faceitLevel}` : `Lvl ${p.level}`}]`).join('\n');

  return `
🏆 **MIX CS2 - ${roomName.toUpperCase()}** 🏆
${mapsSection}

🛡️ **TIME A** (Média: ${metrics?.avgA || '-'} | Soma: ${metrics?.sumA || '-'})
${teamAList}

⚔️ **TIME B** (Média: ${metrics?.avgB || '-'} | Soma: ${metrics?.sumB || '-'})
${teamBList}

⚖️ **Equilíbrio:** ${metrics?.balancePercentage || 100}% (Diferença: ${metrics?.diff || 0})
Boa partida a todos! 🔥 GL HF!
`.trim();
}

export function formatServerCommand(finalMap) {
  if (!finalMap) return 'changelevel de_mirage';
  return `changelevel ${finalMap.file}; mp_warmup_end 1; mp_restartgame 1;`;
}
