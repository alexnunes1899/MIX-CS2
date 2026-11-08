/**
 * CS2 Mix Hub - Gerador de Imagens Canvas para Torneios
 * 
 * Gera imagens em alta definição:
 * 1. Tabela / Chaveamento Completo (Bracket - 1920x1080)
 * 2. Card de Confronto Match Versus (Match Card - 1200x675)
 */

export function drawTournamentBracketCanvas(canvas, { tournamentName, teamCount, matches, teams, champion }) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = 1920;
  const height = 1080;
  canvas.width = width;
  canvas.height = height;

  // 1. Dark Cyber Background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#060a12');
  grad.addColorStop(0.3, '#0b1325');
  grad.addColorStop(0.7, '#080e1b');
  grad.addColorStop(1, '#04070e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Outer Border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Decorative grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 60; x < width; x += 120) {
    ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, height - 30); ctx.stroke();
  }
  for (let y = 60; y < height; y += 120) {
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(width - 30, y); ctx.stroke();
  }

  // 2. Header
  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tournamentName || 'TORNEIO RELÂMPAGO CS2', width / 2, 100);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 20px monospace';
  ctx.fillText(`CHAVEAMENTO OFICIAL • FORMATO ${teamCount} EQUIPES • CS2 MIX HUB`, width / 2, 140);

  // Helper to draw match box
  const drawMatch = (x, y, w, h, match, roundTitle) => {
    // Card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = match?.winner ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Round title
    ctx.fillStyle = '#64748b';
    ctx.font = '800 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText((roundTitle || '').toUpperCase(), x + 16, y + 26);

    const timeTxt = match?.time || 'AO VIVO';
    ctx.textAlign = 'right';
    ctx.fillStyle = match?.status === 'live' ? '#ef4444' : '#94a3b8';
    ctx.fillText(timeTxt, x + w - 16, y + 26);

    // Team A
    const tAY = y + 40;
    const isWinA = match?.winner && match?.winner === match?.teamA;
    ctx.fillStyle = isWinA ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x + 10, tAY, w - 20, 38, 10);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = isWinA ? '900 18px sans-serif' : '700 17px sans-serif';
    ctx.fillStyle = isWinA ? '#34d399' : '#ffffff';
    ctx.fillText(match?.teamA || 'A Definir', x + 24, tAY + 25);

    ctx.textAlign = 'right';
    ctx.font = '900 20px monospace';
    ctx.fillStyle = isWinA ? '#34d399' : '#94a3b8';
    ctx.fillText(String(match?.scoreA ?? 0), x + w - 24, tAY + 26);

    // Team B
    const tBY = y + 84;
    const isWinB = match?.winner && match?.winner === match?.teamB;
    ctx.fillStyle = isWinB ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x + 10, tBY, w - 20, 38, 10);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = isWinB ? '900 18px sans-serif' : '700 17px sans-serif';
    ctx.fillStyle = isWinB ? '#34d399' : '#ffffff';
    ctx.fillText(match?.teamB || 'A Definir', x + 24, tBY + 25);

    ctx.textAlign = 'right';
    ctx.font = '900 20px monospace';
    ctx.fillStyle = isWinB ? '#34d399' : '#94a3b8';
    ctx.fillText(String(match?.scoreB ?? 0), x + w - 24, tBY + 26);
  };

  if (teamCount === 4) {
    // 4 Teams Layout: 2 Semis on Left, Grand Final on Right + Trophy Center/Right
    const boxW = 380;
    const boxH = 135;

    // Semifinais
    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SEMIFINAIS (MD1 / MD3)', 260, 240);

    drawMatch(260, 280, boxW, boxH, matches.m1, 'Semifinal 1');
    drawMatch(260, 480, boxW, boxH, matches.m2, 'Semifinal 2');

    // Connector Lines
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    // from SF1
    ctx.beginPath();
    ctx.moveTo(260 + boxW, 280 + boxH / 2);
    ctx.lineTo(260 + boxW + 80, 280 + boxH / 2);
    ctx.lineTo(260 + boxW + 80, 480 + boxH / 2);
    ctx.moveTo(260 + boxW, 480 + boxH / 2);
    ctx.lineTo(260 + boxW + 80, 480 + boxH / 2);
    // line to final
    ctx.moveTo(260 + boxW + 80, 380 + boxH / 2);
    ctx.lineTo(1050, 380 + boxH / 2);
    ctx.stroke();

    // Grande Final
    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 GRANDE FINAL (MD3)', 1050, 330);

    drawMatch(1050, 370, boxW + 40, boxH + 10, matches.m3, 'Decisão do Título');

    // Champion Banner
    if (champion) {
      const champY = 660;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.beginPath();
      ctx.roundRect(1050, champY, boxW + 40, 160, 20);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 GRANDE CAMPEÃO 👑', 1050 + (boxW + 40) / 2, champY + 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px sans-serif';
      ctx.fillText(champion, 1050 + (boxW + 40) / 2, champY + 110);
    }
  } else {
    // 8 Teams Layout: Quartas (col 1), Semis (col 2), Final (col 3)
    const boxW = 340;
    const boxH = 130;

    // Headers
    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('QUARTAS DE FINAL', 120, 220);
    ctx.fillText('SEMIFINAIS', 580, 220);
    ctx.fillText('🏆 GRANDE FINAL', 1040, 220);

    // Quartas
    drawMatch(120, 260, boxW, boxH, matches.q1, 'Quartas 1');
    drawMatch(120, 420, boxW, boxH, matches.q2, 'Quartas 2');
    drawMatch(120, 580, boxW, boxH, matches.q3, 'Quartas 3');
    drawMatch(120, 740, boxW, boxH, matches.q4, 'Quartas 4');

    // Semis
    drawMatch(580, 340, boxW, boxH, matches.s1, 'Semifinal 1');
    drawMatch(580, 660, boxW, boxH, matches.s2, 'Semifinal 2');

    // Final
    drawMatch(1040, 500, boxW + 40, boxH + 15, matches.f1, 'Decisão do Título');

    // Champion
    if (champion) {
      const champX = 1460;
      const champY = 460;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.roundRect(champX, champY, 360, 210, 20);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 CAMPEÃO 👑', champX + 180, champY + 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px sans-serif';
      ctx.fillText(champion, champX + 180, champY + 120);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 18px monospace';
      ctx.fillText('VENCEDOR DO TORNEIO', champX + 180, champY + 165);
    }
  }

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CS2 MIX HUB • PLATAFORMA DE TORNEIOS E SERVIDORES DEDICADOS • cs2mixhub.gg', width / 2, height - 50);

  return canvas.toDataURL('image/png');
}

export function drawMatchVersusCardCanvas(canvas, { tournamentName, match, teamAData, teamBData, format = 'MD3' }) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = 1200;
  const height = 675;
  canvas.width = width;
  canvas.height = height;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#04070e');
  bg.addColorStop(0.5, '#0b1325');
  bg.addColorStop(1, '#050914');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Top Tournament Banner
  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tournamentName || 'TORNEIO OFICIAL CS2', width / 2, 70);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 16px monospace';
  ctx.fillText(`CONFRONTO OFICIAL • FORMATO ${format} • STATUS: ${match?.status === 'live' ? 'AO VIVO' : 'CONFIRMADO'}`, width / 2, 102);

  // Center Score / VS
  const centerY = 280;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 110, centerY - 65, 220, 130, 24);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VS', width / 2, centerY - 15);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 48px monospace';
  ctx.fillText(`${match?.scoreA ?? 0}  :  ${match?.scoreB ?? 0}`, width / 2, centerY + 42);

  // TEAM A (Left Side)
  const leftX = 260;
  ctx.fillStyle = teamAData?.color || '#f59e0b';
  ctx.beginPath();
  ctx.arc(leftX, centerY - 40, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(teamAData?.icon || '🛡️', leftX, centerY - 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px sans-serif';
  ctx.fillText(teamAData?.name || match?.teamA || 'Time A', leftX, centerY + 50);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '800 18px monospace';
  ctx.fillText(`[${teamAData?.tag || 'TIME A'}]`, leftX, centerY + 80);

  // Roster A
  const playersA = teamAData?.players || [
    { nick: 'Player 1 (IGL)', isCaptain: true },
    { nick: 'Player 2' }, { nick: 'Player 3' }, { nick: 'Player 4' }, { nick: 'Player 5' }
  ];
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 15px monospace';
  playersA.forEach((p, i) => {
    const nickText = p.isCaptain ? `👑 ${p.nick} (Capitão)` : `• ${p.nick}`;
    ctx.fillText(nickText, leftX, 420 + i * 26);
  });

  // TEAM B (Right Side)
  const rightX = width - 260;
  ctx.fillStyle = teamBData?.color || '#0ea5e9';
  ctx.beginPath();
  ctx.arc(rightX, centerY - 40, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(teamBData?.icon || '⚔️', rightX, centerY - 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px sans-serif';
  ctx.fillText(teamBData?.name || match?.teamB || 'Time B', rightX, centerY + 50);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 18px monospace';
  ctx.fillText(`[${teamBData?.tag || 'TIME B'}]`, rightX, centerY + 80);

  // Roster B
  const playersB = teamBData?.players || [
    { nick: 'Player 1 (IGL)', isCaptain: true },
    { nick: 'Player 2' }, { nick: 'Player 3' }, { nick: 'Player 4' }, { nick: 'Player 5' }
  ];
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 15px monospace';
  playersB.forEach((p, i) => {
    const nickText = p.isCaptain ? `👑 ${p.nick} (Capitão)` : `• ${p.nick}`;
    ctx.fillText(nickText, rightX, 420 + i * 26);
  });

  // Bottom Watermark
  ctx.fillStyle = '#64748b';
  ctx.font = '600 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CS2 MIX HUB • TRANSMISSÃO AO VIVO • cs2mixhub.gg', width / 2, height - 35);

  return canvas.toDataURL('image/png');
}
