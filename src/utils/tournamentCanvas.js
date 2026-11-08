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
    const isCompact = h < 115;
    // Card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, isCompact ? 10 : 16);
    ctx.fill();
    ctx.strokeStyle = match?.winner ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = isCompact ? 1.5 : 2;
    ctx.stroke();

    // Round title
    ctx.fillStyle = '#64748b';
    ctx.font = isCompact ? '800 11px monospace' : '800 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText((roundTitle || '').toUpperCase(), x + 14, isCompact ? y + 18 : y + 26);

    const timeTxt = match?.time || 'AO VIVO';
    ctx.textAlign = 'right';
    ctx.fillStyle = match?.status === 'live' ? '#ef4444' : '#94a3b8';
    ctx.fillText(timeTxt, x + w - 14, isCompact ? y + 18 : y + 26);

    // Box dimensions
    const boxH = isCompact ? 28 : 38;
    const tAY = isCompact ? y + 24 : y + 40;
    const tBY = isCompact ? y + 56 : y + 84;
    const textOffsetY = isCompact ? 19 : 25;
    const scoreOffsetY = isCompact ? 20 : 26;
    const fontSize = isCompact ? '13px' : '17px';
    const fontBoldSize = isCompact ? '14px' : '18px';
    const scoreFontSize = isCompact ? '14px' : '20px';

    // Team A
    const isWinA = match?.winner && match?.winner === match?.teamA;
    ctx.fillStyle = isWinA ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x + 8, tAY, w - 16, boxH, isCompact ? 6 : 10);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = isWinA ? `900 ${fontBoldSize} sans-serif` : `700 ${fontSize} sans-serif`;
    ctx.fillStyle = isWinA ? '#34d399' : '#ffffff';
    ctx.fillText(match?.teamA || 'A Definir', x + 18, tAY + textOffsetY);

    ctx.textAlign = 'right';
    ctx.font = `900 ${scoreFontSize} monospace`;
    ctx.fillStyle = isWinA ? '#34d399' : '#94a3b8';
    ctx.fillText(String(match?.scoreA ?? 0), x + w - 18, tAY + scoreOffsetY);

    // Team B
    const isWinB = match?.winner && match?.winner === match?.teamB;
    ctx.fillStyle = isWinB ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x + 8, tBY, w - 16, boxH, isCompact ? 6 : 10);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = isWinB ? `900 ${fontBoldSize} sans-serif` : `700 ${fontSize} sans-serif`;
    ctx.fillStyle = isWinB ? '#34d399' : '#ffffff';
    ctx.fillText(match?.teamB || 'A Definir', x + 18, tBY + textOffsetY);

    ctx.textAlign = 'right';
    ctx.font = `900 ${scoreFontSize} monospace`;
    ctx.fillStyle = isWinB ? '#34d399' : '#94a3b8';
    ctx.fillText(String(match?.scoreB ?? 0), x + w - 18, tBY + scoreOffsetY);
  };

  const resolvedChampion = champion || matches?.f1?.winner || matches?.m3?.winner || null;

  if (teamCount === 2) {
    // 2 Teams Layout: Single Direct Showdown
    const boxW = 520;
    const boxH = 150;
    const m = matches?.f1 || matches?.m1;

    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 GRANDE DECISÃO DO TÍTULO (MD3 / MD5)', width / 2, 280);

    drawMatch(width / 2 - boxW / 2, 330, boxW, boxH, m, 'Decisão Direta');

    if (resolvedChampion) {
      const champY = 560;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - boxW / 2, champY, boxW, 190, 20);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 GRANDE CAMPEÃO 👑', width / 2, champY + 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px sans-serif';
      ctx.fillText(resolvedChampion, width / 2, champY + 115);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 18px monospace';
      ctx.fillText('VENCEDOR DO CONFRONTO SHOWDOWN', width / 2, champY + 155);
    }
  } else if (teamCount === 3) {
    // 3 Teams Layout: Triangular + Final
    const boxW = 380;
    const boxH = 135;

    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FASE DE PONTOS (TRIANGULAR MD1)', 240, 230);
    ctx.fillText('🏆 GRANDE FINAL (MD3)', 980, 230);

    drawMatch(240, 270, boxW, boxH, matches.r1, 'Rodada 1 • Triangular');
    drawMatch(240, 440, boxW, boxH, matches.r2, 'Rodada 2 • Triangular');
    drawMatch(240, 610, boxW, boxH, matches.r3, 'Rodada 3 • Triangular');

    drawMatch(980, 360, boxW + 40, boxH + 15, matches.f1, 'Decisão do Título');

    if (resolvedChampion) {
      const champY = 580;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.roundRect(980, champY, boxW + 40, 180, 20);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 CAMPEÃO TRIANGULAR 👑', 980 + (boxW + 40) / 2, champY + 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px sans-serif';
      ctx.fillText(resolvedChampion, 980 + (boxW + 40) / 2, champY + 105);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 16px monospace';
      ctx.fillText('LÍDER DA COMPETIÇÃO', 980 + (boxW + 40) / 2, champY + 145);
    }
  } else if (teamCount === 4) {
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
    if (resolvedChampion) {
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
      ctx.fillText(resolvedChampion, 1050 + (boxW + 40) / 2, champY + 110);
    }
  } else if (teamCount >= 5 && teamCount <= 7) {
    // 5, 6, 7 Teams Layout (Play-in / QF + Semis + Final)
    const boxW = 340;
    const boxH = 130;

    const col1Title = teamCount === 5 ? 'PLAY-IN PRELIMINAR' : 'QUARTAS DE FINAL';
    const col2Title = teamCount === 5 ? 'SEMIFINAIS (TOP 3 BYE)' : teamCount === 6 ? 'SEMIFINAIS (TOP 2 BYE)' : 'SEMIFINAIS';

    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(col1Title, 120, 220);
    ctx.fillText(col2Title, 580, 220);
    ctx.fillText('🏆 GRANDE FINAL', 1040, 220);

    if (teamCount === 5) {
      drawMatch(120, 400, boxW, boxH, matches.pi1, 'Play-in (#4 vs #5)');
    } else if (teamCount === 6) {
      drawMatch(120, 320, boxW, boxH, matches.q1, 'Quartas 1 (#3 vs #6)');
      drawMatch(120, 520, boxW, boxH, matches.q2, 'Quartas 2 (#4 vs #5)');
    } else {
      drawMatch(120, 280, boxW, boxH, matches.q1, 'Quartas 1 (#2 vs #7)');
      drawMatch(120, 460, boxW, boxH, matches.q2, 'Quartas 2 (#3 vs #6)');
      drawMatch(120, 640, boxW, boxH, matches.q3, 'Quartas 3 (#4 vs #5)');
    }

    // Semis
    drawMatch(580, 340, boxW, boxH, matches.m1 || matches.s1, 'Semifinal 1');
    drawMatch(580, 560, boxW, boxH, matches.m2 || matches.s2, 'Semifinal 2');

    // Final
    drawMatch(1040, 440, boxW + 40, boxH + 15, matches.m3 || matches.f1, 'Decisão do Título');

    // Champion
    if (resolvedChampion) {
      const champX = 1460;
      const champY = 400;
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
      ctx.fillText(resolvedChampion, champX + 180, champY + 120);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 18px monospace';
      ctx.fillText('VENCEDOR DO TORNEIO', champX + 180, champY + 165);
    }
  } else if (teamCount === 8) {
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
    if (resolvedChampion) {
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
      ctx.fillText(resolvedChampion, champX + 180, champY + 120);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 18px monospace';
      ctx.fillText('VENCEDOR DO TORNEIO', champX + 180, champY + 165);
    }
  } else if (teamCount >= 9 && teamCount <= 12) {
    // 9 to 12 Teams: Play-in + Quartas + Semis + Final
    const boxW = 300;
    const boxH = 125;

    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PLAY-IN', 80, 220);
    ctx.fillText('QUARTAS DE FINAL', 460, 220);
    ctx.fillText('SEMIFINAIS', 840, 220);
    ctx.fillText('🏆 GRANDE FINAL', 1220, 220);

    drawMatch(80, 360, boxW, boxH, matches.pi1, 'Play-in 1');
    drawMatch(80, 560, boxW, boxH, matches.pi2, 'Play-in 2');

    drawMatch(460, 260, boxW, boxH, matches.q1, 'Quartas 1');
    drawMatch(460, 420, boxW, boxH, matches.q2, 'Quartas 2');
    drawMatch(460, 580, boxW, boxH, matches.q3, 'Quartas 3');
    drawMatch(460, 740, boxW, boxH, matches.q4, 'Quartas 4');

    drawMatch(840, 340, boxW, boxH, matches.s1, 'Semifinal 1');
    drawMatch(840, 660, boxW, boxH, matches.s2, 'Semifinal 2');

    drawMatch(1220, 500, boxW + 40, boxH + 15, matches.f1, 'Decisão do Título');

    if (resolvedChampion) {
      const champX = 1580;
      const champY = 460;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.roundRect(champX, champY, 260, 210, 16);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 CAMPEÃO 👑', champX + 130, champY + 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px sans-serif';
      ctx.fillText(resolvedChampion, champX + 130, champY + 115);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 15px monospace';
      ctx.fillText('VENCEDOR', champX + 130, champY + 160);
    }
  } else {
    // 13 to 16 Teams: Major 16 Style (Oitavas -> Quartas -> Semis -> Final)
    const boxW = 280;
    const boxH = 92;

    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OITAVAS DE FINAL', 60, 190);
    ctx.fillText('QUARTAS', 440, 190);
    ctx.fillText('SEMIFINAIS', 820, 190);
    ctx.fillText('🏆 GRANDE FINAL', 1200, 190);

    // Oitavas (8 games)
    for (let i = 1; i <= 8; i++) {
      const oKey = `o${i}`;
      drawMatch(60, 215 + (i - 1) * 96, boxW, boxH, matches[oKey], `Oitavas ${i}`);
    }

    // Quartas (4 games)
    for (let i = 1; i <= 4; i++) {
      const qKey = `q${i}`;
      drawMatch(440, 260 + (i - 1) * 190, boxW, 115, matches[qKey], `Quartas ${i}`);
    }

    // Semis (2 games)
    drawMatch(820, 350, boxW, 125, matches.s1, 'Semifinal 1');
    drawMatch(820, 680, boxW, 125, matches.s2, 'Semifinal 2');

    // Final
    drawMatch(1200, 500, boxW + 40, 135, matches.f1, 'Decisão do Título');

    if (resolvedChampion) {
      const champX = 1560;
      const champY = 460;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.roundRect(champX, champY, 280, 210, 16);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 CAMPEÃO MAJOR 👑', champX + 140, champY + 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px sans-serif';
      ctx.fillText(resolvedChampion, champX + 140, champY + 115);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 15px monospace';
      ctx.fillText('CAMPEÃO DO TORNEIO', champX + 140, champY + 160);
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
