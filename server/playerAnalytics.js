import { loadMatchHistory, getMapImageUrl, normalizeMapName, normalizePlayerName } from './matchHistory.js';
import { getLeaderboard } from './leaderboard.js';
import { accountLinkService } from './accountLinks.js';

function cleanIdentifier(raw = '') {
  return String(raw || '').trim().replace(/^discord-/, '');
}

function getPlayerKeyForGrouping(p = {}) {
  if (p.steamId) return `steam:${p.steamId}`;
  if (p.discordId) return `discord:${cleanIdentifier(p.discordId)}`;
  if (p.id && !String(p.id).startsWith('p-win-') && !String(p.id).startsWith('p-lose-')) {
    return `id:${cleanIdentifier(p.id)}`;
  }
  const norm = normalizePlayerName(p.nick || p.displayName || p.username || '');
  return norm ? `nick:${norm}` : '';
}

/**
 * Computes rich per-player analytics (map winrates, duo synergy, biggest rival, recent form, badges)
 * unifying Discord and Web Hub records when linked.
 */
export function computePlayerAnalytics(playerQuery, { matches = null, leaderboard = null, link = null } = {}) {
  const rawQuery = String(playerQuery || '').trim();
  const cleanQuery = cleanIdentifier(rawQuery);
  const normQuery = normalizePlayerName(rawQuery);

  const allMatches = Array.isArray(matches) ? matches : loadMatchHistory();
  const allLeaderboard = Array.isArray(leaderboard) ? leaderboard : getLeaderboard();

  const resolvedLink =
    link ||
    accountLinkService.getLinkBySteamId(cleanQuery) ||
    accountLinkService.getLinkByDiscordId(cleanQuery) ||
    null;

  const candidateIds = new Set(
    [
      rawQuery,
      cleanQuery,
      resolvedLink?.steamId,
      resolvedLink?.discordId,
      resolvedLink?.discordId ? `discord-${resolvedLink.discordId}` : '',
    ]
      .filter(Boolean)
      .map((s) => String(s).trim())
  );

  const matchedLb = allLeaderboard.find((e) => {
    if (!e) return false;
    const eIds = [e.id, e.steamId, e.discordId, cleanIdentifier(e.id), cleanIdentifier(e.discordId)].filter(Boolean).map(String);
    if (eIds.some((id) => candidateIds.has(id))) return true;
    return Boolean(normQuery && normalizePlayerName(e.nick) === normQuery);
  });

  if (matchedLb) {
    if (matchedLb.steamId) candidateIds.add(String(matchedLb.steamId));
    if (matchedLb.discordId && matchedLb.discordId !== matchedLb.steamId) {
      candidateIds.add(String(matchedLb.discordId));
      candidateIds.add(`discord-${matchedLb.discordId}`);
    }
    if (matchedLb.id) {
      candidateIds.add(String(matchedLb.id));
      candidateIds.add(cleanIdentifier(matchedLb.id));
    }
    const unifiedFromLb = accountLinkService.resolveUnifiedIds({
      discordId: matchedLb.discordId && matchedLb.discordId !== matchedLb.steamId ? matchedLb.discordId : '',
      steamId: matchedLb.steamId || '',
    });
    if (unifiedFromLb.steamId) candidateIds.add(unifiedFromLb.steamId);
    if (unifiedFromLb.discordId) candidateIds.add(unifiedFromLb.discordId);
  }

  let targetNormNick = normalizePlayerName(
    matchedLb?.nick ||
      resolvedLink?.steamNick ||
      resolvedLink?.discordUsername ||
      (rawQuery && !/^\d{15,22}$/.test(cleanQuery) ? rawQuery : '')
  );

  const matchesTargetPlayer = (p) => {
    if (!p) return false;
    const ids = [p.id, p.steamId, p.discordId, cleanIdentifier(p.id)].filter(Boolean).map(String);
    if (ids.some((id) => candidateIds.has(id))) return true;
    const pNorm = normalizePlayerName(p.nick || p.displayName || p.username || '');
    return Boolean(targetNormNick && pNorm && pNorm === targetNormNick);
  };

  // Traverse chronologically from oldest to newest to compute accurate win streaks
  const orderedMatches = [...allMatches].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

  let wins = 0;
  let losses = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let mvpCount = 0;
  let bagreCount = 0;
  let kdSum = 0;
  let kdSamples = 0;
  let ratingSum = 0;
  let ratingSamples = 0;

  const mapStatsMap = new Map();
  const teammateMap = new Map();
  const opponentMap = new Map();
  const formChronological = [];
  let displayNick = matchedLb?.nick || resolvedLink?.steamNick || resolvedLink?.discordUsername || rawQuery;
  let displayAvatar = matchedLb?.avatar || '';
  let displayLevel = matchedLb?.level || 12;
  let displayFaceitLevel = matchedLb?.faceitLevel || 5;

  for (const m of orderedMatches) {
    const winPlayers = Array.isArray(m.winnerPlayers) ? m.winnerPlayers : [];
    const losePlayers = Array.isArray(m.loserPlayers) ? m.loserPlayers : [];
    const inWinners = winPlayers.find(matchesTargetPlayer);
    const inLosers = !inWinners ? losePlayers.find(matchesTargetPlayer) : null;

    if (!inWinners && !inLosers) continue;

    const didWin = Boolean(inWinners);
    const selfEntry = inWinners || inLosers;
    if (selfEntry?.nick && displayNick === rawQuery) displayNick = selfEntry.nick;
    if (selfEntry?.nick && !targetNormNick) targetNormNick = normalizePlayerName(selfEntry.nick);
    if (selfEntry?.avatar && !displayAvatar) displayAvatar = selfEntry.avatar;
    if (selfEntry?.level && !matchedLb?.level) displayLevel = selfEntry.level;

    if (didWin) {
      wins += 1;
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      losses += 1;
      currentStreak = 0;
    }

    const cleanMap = normalizeMapName(m.map || 'Mirage');
    const ms = mapStatsMap.get(cleanMap) || {
      map: cleanMap,
      mapImage: m.mapImage || getMapImageUrl(cleanMap),
      played: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    };
    ms.played += 1;
    if (didWin) ms.wins += 1;
    else ms.losses += 1;
    ms.winRate = Math.round((ms.wins / ms.played) * 100);
    mapStatsMap.set(cleanMap, ms);

    if (m.mvpId && candidateIds.has(cleanIdentifier(m.mvpId))) {
      mvpCount += 1;
    } else if (m.mvpNick && targetNormNick && normalizePlayerName(m.mvpNick) === targetNormNick) {
      mvpCount += 1;
    }

    if (m.bagreId && candidateIds.has(cleanIdentifier(m.bagreId))) {
      bagreCount += 1;
    } else if (m.bagreNick && targetNormNick && normalizePlayerName(m.bagreNick) === targetNormNick) {
      bagreCount += 1;
    }

    if (Array.isArray(m.evaluatedPlayers)) {
      const evalEntry = m.evaluatedPlayers.find((ep) => ep && (matchesTargetPlayer(ep) || (targetNormNick && normalizePlayerName(ep.nick) === targetNormNick)));
      if (evalEntry && evalEntry.isRealGsi) {
        if (typeof evalEntry.kd === 'number') {
          kdSum += evalEntry.kd;
          kdSamples += 1;
        }
        if (typeof evalEntry.rating === 'number') {
          ratingSum += evalEntry.rating;
          ratingSamples += 1;
        }
      }
    }

    const teammates = didWin ? winPlayers : losePlayers;
    for (const mate of teammates) {
      if (!mate || matchesTargetPlayer(mate)) continue;
      const gKey = getPlayerKeyForGrouping(mate);
      if (!gKey) continue;
      const prev = teammateMap.get(gKey) || {
        id: cleanIdentifier(mate.steamId || mate.discordId || mate.id),
        nick: mate.nick || mate.username || 'Jogador',
        avatar: mate.avatar || '',
        togetherMatches: 0,
        wins: 0,
        losses: 0,
      };
      prev.togetherMatches += 1;
      if (didWin) prev.wins += 1;
      else prev.losses += 1;
      if (!prev.avatar && mate.avatar) prev.avatar = mate.avatar;
      teammateMap.set(gKey, prev);
    }

    const opponents = didWin ? losePlayers : winPlayers;
    for (const opp of opponents) {
      if (!opp || matchesTargetPlayer(opp)) continue;
      const gKey = getPlayerKeyForGrouping(opp);
      if (!gKey) continue;
      const prev = opponentMap.get(gKey) || {
        id: cleanIdentifier(opp.steamId || opp.discordId || opp.id),
        nick: opp.nick || opp.username || 'Jogador',
        avatar: opp.avatar || '',
        vsMatches: 0,
        wins: 0,
        losses: 0,
      };
      prev.vsMatches += 1;
      if (didWin) prev.wins += 1;
      else prev.losses += 1;
      if (!prev.avatar && opp.avatar) prev.avatar = opp.avatar;
      opponentMap.set(gKey, prev);
    }

    formChronological.push({
      matchId: m.id,
      result: didWin ? 'W' : 'L',
      map: cleanMap,
      score: m.score || '13-8',
      date: m.date || '',
      timestamp: m.timestamp || 0,
    });
  }

  const historyMatchesPlayed = wins + losses;
  const effectiveMatches = historyMatchesPlayed > 0 ? historyMatchesPlayed : (matchedLb?.matchesPlayed || 0);
  const effectiveWins = historyMatchesPlayed > 0 ? wins : (matchedLb?.wins || 0);
  const effectiveLosses = historyMatchesPlayed > 0 ? losses : (matchedLb?.losses || 0);
  const effectiveWinRate = effectiveMatches > 0 ? Math.round((effectiveWins / effectiveMatches) * 100) : 0;
  const effectiveBestStreak = Math.max(bestStreak, matchedLb?.bestStreak || 0);
  const effectiveCurrentStreak = historyMatchesPlayed > 0 ? currentStreak : (matchedLb?.streak || 0);
  const effectiveMvps = Math.max(mvpCount, matchedLb?.mvpCount || 0);
  const effectiveBagres = Math.max(bagreCount, matchedLb?.bagreCount || 0);

  const mapStats = Array.from(mapStatsMap.values()).sort(
    (a, b) => b.played - a.played || b.winRate - a.winRate || b.wins - a.wins
  );

  const partnersSorted = Array.from(teammateMap.values())
    .map((t) => ({ ...t, winRate: t.togetherMatches > 0 ? Math.round((t.wins / t.togetherMatches) * 100) : 0 }))
    .sort((a, b) => {
      // Prefer partners with >= 2 matches first, then highest winrate & wins
      const aQualified = a.togetherMatches >= 2 ? 1 : 0;
      const bQualified = b.togetherMatches >= 2 ? 1 : 0;
      if (bQualified !== aQualified) return bQualified - aQualified;
      return b.winRate - a.winRate || b.wins - a.wins || b.togetherMatches - a.togetherMatches;
    });
  const bestPartner = partnersSorted[0] || null;

  const rivalsSorted = Array.from(opponentMap.values())
    .map((o) => ({ ...o, winRate: o.vsMatches > 0 ? Math.round((o.wins / o.vsMatches) * 100) : 0 }))
    .sort((a, b) => b.vsMatches - a.vsMatches || b.losses - a.losses || b.wins - a.wins);
  const biggestRival = rivalsSorted[0] || null;

  const recentForm = formChronological.slice(-10).reverse();

  const badges = [];
  if (resolvedLink || (matchedLb?.discordId && matchedLb?.steamId && matchedLb.discordId !== matchedLb.steamId)) {
    badges.push({
      id: 'unified_account',
      icon: '🔗',
      label: 'Conta Unificada',
      desc: 'Discord e Steam sincronizados no Mix Hub',
      tier: 'sky',
    });
  }
  if (effectiveBestStreak >= 3) {
    badges.push({
      id: 'hot_streak',
      icon: '🔥',
      label: effectiveBestStreak >= 5 ? 'Imparável' : 'Sequência Quente',
      desc: `Recorde de ${effectiveBestStreak} vitórias seguidas`,
      tier: 'amber',
    });
  }
  if (effectiveMvps >= 1) {
    badges.push({
      id: 'mvp_machine',
      icon: '👑',
      label: effectiveMvps >= 3 ? 'MVP Serial' : 'Destaque MVP',
      desc: `${effectiveMvps}x MVP oficial em partidas do Hub`,
      tier: 'amber',
    });
  }
  const favoriteStrongMap = mapStats.find((ms) => ms.played >= 2 && ms.winRate >= 65);
  if (favoriteStrongMap) {
    badges.push({
      id: 'map_specialist',
      icon: '🗺️',
      label: `Rei da ${favoriteStrongMap.map}`,
      desc: `${favoriteStrongMap.winRate}% de winrate em ${favoriteStrongMap.played} jogos`,
      tier: 'emerald',
    });
  }
  if (bestPartner && bestPartner.togetherMatches >= 2 && bestPartner.winRate >= 65) {
    badges.push({
      id: 'lethal_duo',
      icon: '🤝',
      label: 'Dupla Letal',
      desc: `${bestPartner.winRate}% WR jogando com ${bestPartner.nick}`,
      tier: 'purple',
    });
  }
  if (effectiveMatches >= 10) {
    badges.push({
      id: 'veteran',
      icon: '🎖️',
      label: 'Veterano do Mix',
      desc: `${effectiveMatches} partidas disputadas no Hub`,
      tier: 'emerald',
    });
  }
  if (effectiveBagres >= 2) {
    badges.push({
      id: 'bagre_survivor',
      icon: '🐟',
      label: 'Lenda do Bagre',
      desc: `${effectiveBagres}x eleito Bagre da partida`,
      tier: 'rose',
    });
  }

  return {
    query: rawQuery,
    identity: {
      id: matchedLb?.id || cleanQuery,
      nick: displayNick,
      avatar: displayAvatar,
      steamId: matchedLb?.steamId || resolvedLink?.steamId || (/^7656119\d{10}$/.test(cleanQuery) ? cleanQuery : ''),
      discordId: matchedLb?.discordId || resolvedLink?.discordId || '',
      level: displayLevel,
      faceitLevel: displayFaceitLevel,
    },
    linkedDiscord: resolvedLink
      ? {
          discordId: resolvedLink.discordId,
          discordUsername: resolvedLink.discordUsername,
          linkedAt: resolvedLink.linkedAt,
        }
      : null,
    summary: {
      matchesPlayed: effectiveMatches,
      wins: effectiveWins,
      losses: effectiveLosses,
      winRate: effectiveWinRate,
      currentStreak: effectiveCurrentStreak,
      bestStreak: effectiveBestStreak,
      mvpCount: effectiveMvps,
      bagreCount: effectiveBagres,
      avgKd: kdSamples > 0 ? Number((kdSum / kdSamples).toFixed(2)) : null,
      avgRating: ratingSamples > 0 ? Number((ratingSum / ratingSamples).toFixed(2)) : null,
    },
    mapStats,
    bestPartner,
    biggestRival,
    recentForm,
    badges,
  };
}
