/**
 * CS2 Mix Hub - Sistema de Trust Factor e Anti-Smurf
 * 
 * Analisa a consistência de horas jogadas no CS2, tempo de Steam,
 * ausência de punições VAC Valve e reputação (karma/comendações) da comunidade.
 */

export function calculateTrustFactor(player = {}, steamStats = null, commendations = {}) {
  let score = 50; // Pontuação base neutra
  const badges = [];
  let smurfAlert = false;
  let smurfReason = '';

  const cs2Hours = Number(player.cs2Hours || steamStats?.cs2Hours || 0);
  const gcLevel = Number(player.level || 12);
  const faceitLevel = Number(player.faceitLevel || 5);
  const faceitElo = Number(player.faceitElo || 1200);
  const accountAgeYears = Number(steamStats?.accountAgeYears || 0);
  const vacBanned = Boolean(steamStats?.vacBanned);

  // 1. Horas no CS2
  if (cs2Hours >= 2000) {
    score += 25;
    badges.push({ label: 'Veterano (+2k hrs)', type: 'gold', icon: '👑' });
  } else if (cs2Hours >= 1000) {
    score += 20;
    badges.push({ label: 'Experiente (+1k hrs)', type: 'emerald', icon: '⭐' });
  } else if (cs2Hours >= 400) {
    score += 10;
    badges.push({ label: 'Ativo no CS2', type: 'sky', icon: '🎮' });
  } else if (cs2Hours > 0 && cs2Hours < 200) {
    score -= 10;
  }

  // 2. Tempo de Conta Steam
  if (accountAgeYears >= 8) {
    score += 20;
    badges.push({ label: 'Steam 8+ anos', type: 'gold', icon: '🛡️' });
  } else if (accountAgeYears >= 3) {
    score += 15;
    badges.push({ label: `Steam ${accountAgeYears} anos`, type: 'sky', icon: '📅' });
  } else if (accountAgeYears === 1 || accountAgeYears === 2) {
    score += 5;
  } else if (accountAgeYears === 0 && steamStats) {
    score -= 10;
  }

  // 3. Status VAC Valve
  if (vacBanned) {
    score -= 40;
    badges.push({ label: 'Possui Ban VAC Valve', type: 'rose', icon: '⚠️' });
  } else if (steamStats) {
    score += 15;
    badges.push({ label: 'Conta Valve Limpa', type: 'emerald', icon: '✓' });
  }

  // 4. Detecção de Smurf / Conta Comprada (Inconsistência de Horas vs Nível Alto)
  const isHighGc = gcLevel >= 17;
  const isHighFaceit = faceitLevel >= 8 || faceitElo >= 1800;
  
  if ((isHighGc || isHighFaceit) && cs2Hours > 0 && cs2Hours < 250) {
    smurfAlert = true;
    smurfReason = `Nível Alto (${isHighGc ? `GC ${gcLevel}` : `FACEIT ${faceitLevel}`}) com poucas horas registradas (${cs2Hours}h). Possível Smurf.`;
    score -= 25;
    badges.push({ label: 'Inconsistência Horas/Nível', type: 'amber', icon: '⚠️' });
  }

  // 5. Comendações / Karma da Comunidade
  const playerCommends = commendations[player.id] || commendations[player.nick] || { friendly: 0, leader: 0, aim: 0, comms: 0 };
  const totalCommends = (playerCommends.friendly || 0) + (playerCommends.leader || 0) + (playerCommends.aim || 0) + (playerCommends.comms || 0);

  if (totalCommends >= 10) {
    score += 15;
    badges.push({ label: 'Comunidade Positiva (+10)', type: 'emerald', icon: '💎' });
  } else if (totalCommends >= 3) {
    score += 8;
    badges.push({ label: 'Elogiado no Hub', type: 'sky', icon: '👏' });
  }

  // Limitar pontuação entre 5 e 100
  score = Math.max(5, Math.min(100, score));

  // Categoria de Confiança
  let category = 'REGULAR';
  let color = 'text-amber-400';
  let border = 'border-amber-500/40';
  let bg = 'bg-amber-500/10';

  if (score >= 80) {
    category = 'EXCELENTE';
    color = 'text-emerald-400';
    border = 'border-emerald-500/40';
    bg = 'bg-emerald-500/10';
  } else if (score >= 60) {
    category = 'ALTA';
    color = 'text-sky-400';
    border = 'border-sky-500/40';
    bg = 'bg-sky-500/10';
  } else if (score < 40) {
    category = 'ATENÇÃO';
    color = 'text-rose-400';
    border = 'border-rose-500/40';
    bg = 'bg-rose-500/10';
  }

  return {
    score,
    category,
    color,
    border,
    bg,
    smurfAlert,
    smurfReason,
    badges,
    totalCommends,
  };
}
