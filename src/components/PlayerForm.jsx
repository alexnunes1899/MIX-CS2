import React, { useState, useEffect } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import SteamIcon from './SteamIcon';
import { Shield, Flame, Shuffle, UserPlus, CheckCircle2, LogOut, RefreshCw, Zap, Lock, ArrowRightLeft, Trophy, Sparkles, Copy, Check } from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { getPlayerStats } from '../utils/playerStats';
import { copyText } from '../utils/clipboard';

const AVATARS = ['🎯', '👑', '💀', '⚡', '🛡️', '💣', '🔥', '🦅', '🚀', '🧠'];

export default function PlayerForm({
  onSave,
  currentProfile,
  roomId = 'MIX-PRO',
  rankingSystem = 'gc', // 'gc' | 'faceit'
  onLogout,
  onSwitchAccount,
  onOpenProfileModal,
  soundEnabled,
  disabled,
}) {
  const [nick, setNick] = useState(currentProfile?.nick || '');
  const [level, setLevel] = useState(currentProfile?.level || 12);
  const [faceitLevel, setFaceitLevel] = useState(currentProfile?.faceitLevel || 5);
  const [faceitElo, setFaceitElo] = useState(currentProfile?.faceitElo || 1200);
  const [side, setSide] = useState(currentProfile?.side || 'ANY');
  const [avatar, setAvatar] = useState(currentProfile?.avatar || '🎯');
  const [faceitNick, setFaceitNick] = useState(currentProfile?.faceitNick || '');
  const [faceitSyncError, setFaceitSyncError] = useState(null);
  const [activeRankingTab, setActiveRankingTab] = useState(rankingSystem === 'faceit' ? 'faceit' : 'gc');

  useEffect(() => {
    if (rankingSystem) setActiveRankingTab(rankingSystem);
  }, [rankingSystem]);
  const [isSaved, setIsSaved] = useState(false);
  const [levelSynced, setLevelSynced] = useState(false);
  const [syncingFaceit, setSyncingFaceit] = useState(false);
  const [copiedSteamId, setCopiedSteamId] = useState(false);

  const playerStats = getPlayerStats(currentProfile?.steamId);

  useEffect(() => {
    if (currentProfile?.nick) setNick(currentProfile.nick);
    if (currentProfile?.level) setLevel(currentProfile.level);
    if (currentProfile?.faceitLevel) setFaceitLevel(currentProfile.faceitLevel);
    if (currentProfile?.faceitElo) setFaceitElo(currentProfile.faceitElo);
    if (currentProfile?.side) setSide(currentProfile.side);
    if (currentProfile?.avatar) setAvatar(currentProfile.avatar);
    if (currentProfile?.faceitNick) setFaceitNick(currentProfile.faceitNick);
  }, [currentProfile]);

  const isSteamUser = Boolean(currentProfile?.steamId);
  const isFaceitMode = rankingSystem === 'faceit';

  // Helper to persist to localStorage & broadcast in real-time
  const syncProfileUpdate = (partial) => {
    const nextNick = (partial.nick !== undefined ? partial.nick : nick).trim();
    const nextLevel = partial.level !== undefined ? Math.min(21, Math.max(1, Number(partial.level))) : Number(level);
    const nextFaceitLvl = partial.faceitLevel !== undefined ? Math.min(10, Math.max(1, Number(partial.faceitLevel))) : Number(faceitLevel);
    const nextFaceitElo = partial.faceitElo !== undefined ? partial.faceitElo : faceitElo;
    const nextSide = partial.side !== undefined ? partial.side : side;
    const nextAvatar = partial.avatar !== undefined ? partial.avatar : avatar;
    const nextFaceitNick = partial.faceitNick !== undefined ? partial.faceitNick : faceitNick;
    const nextCs2Hours = partial.cs2Hours !== undefined ? partial.cs2Hours : currentProfile?.cs2Hours;

    try {
      const saved = JSON.parse(localStorage.getItem('cs2_mix_profile') || '{}');
      localStorage.setItem(
        'cs2_mix_profile',
        JSON.stringify({
          ...saved,
          nick: nextNick || saved.nick || '',
          level: nextLevel,
          faceitLevel: nextFaceitLvl,
          faceitElo: nextFaceitElo,
          side: nextSide,
          avatar: nextAvatar,
          faceitNick: nextFaceitNick,
          cs2Hours: nextCs2Hours,
        })
      );
    } catch (e) {}

    const effectiveNick = nextNick || currentProfile?.nick?.trim();
    if (effectiveNick && isSteamUser) {
      onSave({
        id: currentProfile?.id || `player-${Date.now()}`,
        nick: effectiveNick,
        level: nextLevel,
        faceitLevel: nextFaceitLvl,
        faceitElo: nextFaceitElo,
        side: nextSide,
        avatar: nextAvatar,
        faceitNick: nextFaceitNick,
        steamId: currentProfile?.steamId || null,
        cs2Hours: nextCs2Hours,
        ready: currentProfile?.ready !== undefined ? currentProfile.ready : true,
      });
    }
  };

  // Immediate real-time GC level change
  const handleGCLevelChange = (newVal) => {
    const validLevel = Math.min(21, Math.max(1, Number(newVal)));
    setLevel(validLevel);
    setLevelSynced(true);
    setTimeout(() => setLevelSynced(false), 1400);

    syncProfileUpdate({ level: validLevel });
  };

  // Immediate real-time FACEIT level change
  const handleFaceitLevelChange = (newVal) => {
    const validFaceit = Math.min(10, Math.max(1, Number(newVal)));
    setFaceitLevel(validFaceit);
    setLevelSynced(true);
    setTimeout(() => setLevelSynced(false), 1400);

    syncProfileUpdate({ faceitLevel: validFaceit });
  };

  // Immediate side change
  const handleSideChange = (newSide) => {
    setSide(newSide);
    if (soundEnabled) playClickSound();
    syncProfileUpdate({ side: newSide });
  };

  // Immediate avatar change
  const handleAvatarChange = (newAvatar) => {
    setAvatar(newAvatar);
    syncProfileUpdate({ avatar: newAvatar });
  };

  // Fetch / Refresh FACEIT Profile from server by Steam ID or Nickname
  const handleRefreshFaceit = async (overrideNick) => {
    const queryNick = (overrideNick || faceitNick || nick || '').trim();
    const querySteamId = currentProfile?.steamId || 'custom';
    if (!querySteamId && !queryNick) return;

    setSyncingFaceit(true);
    setFaceitSyncError(null);
    try {
      const res = await fetch(`/api/faceit/${querySteamId}?nickname=${encodeURIComponent(queryNick)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.found && data.level) {
          setFaceitLevel(data.level);
          if (data.elo) setFaceitElo(data.elo);
          if (data.nickname) setFaceitNick(data.nickname);
          setLevelSynced(true);
          setTimeout(() => setLevelSynced(false), 2500);
          syncProfileUpdate({
            faceitLevel: data.level,
            faceitElo: data.elo,
            faceitNick: data.nickname,
          });
        } else {
          setFaceitSyncError('Conta FACEIT não encontrada');
          setTimeout(() => setFaceitSyncError(null), 3500);
        }
      }
    } catch (e) {
      console.error(e);
      setFaceitSyncError('Erro na consulta FACEIT');
      setTimeout(() => setFaceitSyncError(null), 3500);
    } finally {
      setSyncingFaceit(false);
    }
  };

  // Auto-fetch FACEIT stats on mount
  useEffect(() => {
    if (isFaceitMode && (currentProfile?.steamId || nick)) {
      if (!currentProfile?.faceitElo || currentProfile?.faceitLevel === 5) {
        handleRefreshFaceit();
      }
    }
  }, [isFaceitMode, currentProfile?.steamId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nick.trim()) return;

    if (!isSteamUser) {
      handleSteamLogin();
      return;
    }

    if (soundEnabled) playClickSound();
    onSave({
      id: currentProfile?.id || `player-${Date.now()}`,
      nick: nick.trim(),
      level: Number(level),
      faceitLevel: Number(faceitLevel),
      faceitElo: faceitElo ? Number(faceitElo) : null,
      side,
      avatar,
      steamId: currentProfile?.steamId || null,
      cs2Hours: currentProfile?.cs2Hours || null,
      ready: true,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSteamLogin = () => {
    if (soundEnabled) playClickSound();
    window.location.href = '/api/auth/steam';
  };

  const handleSteamLogout = () => {
    if (soundEnabled) playClickSound();
    if (onLogout) {
      onLogout();
    } else {
      const cleanProfile = {
        id: `player-${Date.now()}`,
        nick: '',
        level: 12,
        faceitLevel: 5,
        faceitElo: 1200,
        side: 'ANY',
        avatar: '🎯',
        steamId: null,
      };
      onSave(cleanProfile);
    }
  };

  const handleSwitchAccount = () => {
    if (soundEnabled) playClickSound();
    if (onSwitchAccount) {
      onSwitchAccount();
    } else {
      handleSteamLogout();
      window.location.href = '/api/auth/steam';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur space-y-4">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Mode indicator and Badge */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
            <UserPlus size={18} className="text-amber-400" />
            Seu Perfil no Mix
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                <Shield size={10} /> GC: LVL {level}
              </span>
              <span className="text-[10px] text-orange-400 font-bold bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                <Zap size={10} /> FACEIT: LVL {faceitLevel}
              </span>
            </div>
          </div>
        </div>

        {isFaceitMode ? (
          <FaceitBadge level={faceitLevel} elo={faceitElo} size="lg" showLabel />
        ) : (
          <GCBadge level={level} size="lg" showTier />
        )}
      </div>

      {/* Steam Login Required Barrier or Connected Badge */}
      {!isSteamUser ? (
        <div className="bg-gradient-to-br from-[#171a21] via-[#1b2838] to-[#2a475e] border-2 border-[#66c0f4]/50 rounded-2xl p-4 text-center space-y-2.5 shadow-lg">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#66c0f4] uppercase tracking-wider">
            <Lock size={14} /> Login com a Steam Obrigatório
          </div>
          <p className="text-xs text-slate-300 leading-snug">
            Para entrar na sala e puxar seu nível {isFaceitMode ? 'FACEIT' : 'da GC'}, faça login com sua conta Steam.
          </p>
          <button
            type="button"
            onClick={handleSteamLogin}
            className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-950 text-white border border-[#66c0f4]/60 hover:border-[#66c0f4] shadow-md text-xs font-bold transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
          >
            <SteamIcon className="w-5 h-5 text-[#66c0f4] group-hover:scale-110 transition-transform" />
            <span>Fazer Login com a Steam ➔</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 shadow-inner space-y-3">
          {/* Passport Header with Steam Verified Badge & Switch Account */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <PlayerAvatar avatar={avatar} nick={nick} size="md" />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <SteamIcon className="w-2.5 h-2.5 text-[#66c0f4]" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[140px]">{nick}</span>
                  <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                    Steam ✓
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[105px]">ID: {currentProfile.steamId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      copyText(currentProfile.steamId);
                      setCopiedSteamId(true);
                      setTimeout(() => setCopiedSteamId(false), 2000);
                    }}
                    className="text-slate-500 hover:text-amber-400 p-0.5"
                    title="Copiar SteamID64"
                  >
                    {copiedSteamId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                  {onOpenProfileModal && (
                    <button
                      type="button"
                      onClick={onOpenProfileModal}
                      className="ml-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                      title="Ver ou editar horas de CS2"
                    >
                      {currentProfile?.cs2Hours ? `${currentProfile.cs2Hours.toLocaleString('pt-BR')}h` : '+ Horas'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Account Switch & Logout Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 border border-slate-700/80 hover:border-sky-500/40 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                title="Entrar com outra conta da Steam"
              >
                <ArrowRightLeft size={11} />
                <span className="hidden sm:inline">Trocar Conta</span>
              </button>

              <button
                type="button"
                onClick={handleSteamLogout}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                title="Desconectar da Steam"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* Embedded Player Statistics in Profile */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1">
                <Trophy size={11} className="text-amber-400" /> Estatísticas no Mix
              </span>
              {onOpenProfileModal && (
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="text-amber-400 hover:underline cursor-pointer font-semibold"
                >
                  Ver Detalhes ➔
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-1.5">
                <span className="text-[9px] uppercase font-mono text-slate-500 block">Partidas</span>
                <span className="text-xs font-black font-mono text-white">{playerStats.matchesPlayed}</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-1.5">
                <span className="text-[9px] uppercase font-mono text-slate-500 block">Vitórias</span>
                <span className="text-xs font-black font-mono text-emerald-400">{playerStats.wins}V</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-1.5">
                <span className="text-[9px] uppercase font-mono text-slate-500 block">Win Rate</span>
                <span className="text-xs font-black font-mono text-amber-400">{playerStats.winRate}%</span>
              </div>
            </div>

            {/* Win rate progress bar */}
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${playerStats.winRate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Form Details */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nickname & Avatar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Nickname no CS2
            </label>
            <input
              type="text"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Ex: FalleN, coldzera..."
              maxLength={20}
              required
              disabled={!isSteamUser}
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all font-medium disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Ícone
            </label>
            {isSteamUser && avatar.startsWith('http') ? (
              <div className="flex items-center justify-center p-1 bg-slate-950 border border-slate-800 rounded-xl h-[42px]">
                <PlayerAvatar avatar={avatar} nick={nick} size="md" />
              </div>
            ) : (
              <select
                value={avatar}
                onChange={(e) => handleAvatarChange(e.target.value)}
                disabled={!isSteamUser}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-lg text-center outline-none cursor-pointer disabled:opacity-50"
              >
                {AVATARS.map((av) => (
                  <option key={av} value={av} className="text-slate-900">
                    {av}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* RANKING TABS: GAMERS CLUB VS FACEIT */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveRankingTab('gc');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRankingTab === 'gc'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Shield size={13} />
            <span>Gamers Club ({level})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveRankingTab('faceit');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeRankingTab === 'faceit'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Zap size={13} />
            <span>FACEIT Oficial ({faceitLevel})</span>
          </button>
        </div>

        {/* ACTIVE RANKING PANEL */}
        {activeRankingTab === 'faceit' ? (
          /* FACEIT Controls */
          <div className="bg-slate-950/60 border border-orange-500/30 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider flex items-center gap-1">
                  <Zap size={13} className="text-orange-400" /> Nível FACEIT Oficial (1 a 10)
                </span>
                <span className="text-[9px] text-orange-400 font-mono font-bold bg-orange-500/10 px-1.5 py-0.2 rounded border border-orange-500/20">
                  Auto API
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-orange-400">
                <span className="text-slate-500 text-xs">LVL</span>
                <span className="text-base font-black">{faceitLevel}</span>
                {levelSynced && (
                  <span className="text-[10px] text-emerald-400 font-sans font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 animate-pulse">
                    ✓ Sincronizado
                  </span>
                )}
              </div>
            </div>

            {/* Verified Faceit Status Banner */}
            {faceitElo && faceitElo !== 1200 ? (
              <div className="bg-gradient-to-r from-orange-500/15 via-emerald-500/10 to-transparent border border-orange-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs border border-orange-500/30">
                    {faceitLevel}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-white block">
                      {faceitNick || nick || 'Conta FACEIT'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 size={10} /> {faceitElo} ELO detectado automaticamente
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRefreshFaceit()}
                  disabled={syncingFaceit}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-orange-400 border border-orange-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="Atualizar dados da FACEIT agora"
                >
                  <RefreshCw size={11} className={syncingFaceit ? 'animate-spin' : ''} />
                  <span>{syncingFaceit ? 'Buscando...' : 'Re-sincronizar'}</span>
                </button>
              </div>
            ) : (
              /* Search / Pull by Faceit Nickname input */
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Puxar nível da sua conta FACEIT:</span>
                  <span className="font-mono text-orange-400 font-bold">{faceitElo || '1200'} ELO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Seu nick na FACEIT (ex: Lxn1899)"
                    value={faceitNick}
                    onChange={(e) => setFaceitNick(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRefreshFaceit(faceitNick);
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-orange-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleRefreshFaceit(faceitNick)}
                    disabled={syncingFaceit}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-md shadow-orange-500/20"
                  >
                    <RefreshCw size={11} className={syncingFaceit ? 'animate-spin' : ''} />
                    <span>{syncingFaceit ? 'Buscando...' : 'Puxar Automático'}</span>
                  </button>
                </div>
                {faceitSyncError && (
                  <p className="text-[10px] text-red-400 font-medium">{faceitSyncError}</p>
                )}
              </div>
            )}

            {/* Quick 1-10 selector buttons */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Ajuste manual (opcional):</span>
                <span>Nível {faceitLevel} selecionado</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={!isSteamUser}
                    onClick={() => handleFaceitLevelChange(num)}
                    className={`py-1.5 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer ${
                      faceitLevel === num
                        ? num === 10
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/40 border border-red-400 scale-105'
                          : 'bg-orange-500 text-slate-950 font-black shadow-md border border-orange-300 scale-105'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Gamers Club Controls */
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Level Gamers Club (1 a 21)
                </span>
                <span className="text-[9px] text-amber-400 font-mono font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  Auto-sync
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-400">
                <span className="text-slate-500 text-xs">LVL</span>
                <span className="text-base">{level}</span>
                {levelSynced && (
                  <span className="text-[10px] text-emerald-400 font-sans font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 animate-pulse">
                    ✓ Atualizado
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!isSteamUser}
                onClick={() => {
                  handleGCLevelChange(level - 1);
                  if (soundEnabled) playClickSound();
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-base transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                title="Diminuir level"
              >
                -
              </button>

              <input
                type="range"
                min="1"
                max="21"
                value={level}
                disabled={!isSteamUser}
                onChange={(e) => handleGCLevelChange(Number(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none disabled:opacity-50"
              />

              <button
                type="button"
                disabled={!isSteamUser}
                onClick={() => {
                  handleGCLevelChange(level + 1);
                  if (soundEnabled) playClickSound();
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-base transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                title="Aumentar level"
              >
                +
              </button>
            </div>

            {/* Quick Level Preset Buttons (Sleek Pills) */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { lvl: 1, label: 'Lvl 1', desc: 'Iniciante' },
                { lvl: 11, label: 'Lvl 11', desc: 'Start' },
                { lvl: 16, label: 'Lvl 16', desc: 'Rise' },
                { lvl: 21, label: 'Lvl 21', desc: 'Hall' },
              ].map((preset) => {
                const isCurrent = level === preset.lvl;
                return (
                  <button
                    key={preset.lvl}
                    type="button"
                    disabled={!isSteamUser}
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      handleGCLevelChange(preset.lvl);
                    }}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                    title={`Nível ${preset.lvl} - ${preset.desc}`}
                  >
                    <span className="text-[11px] font-mono font-black block leading-none">{preset.label}</span>
                    <span className="text-[8px] uppercase tracking-wider block opacity-75 mt-0.5 leading-none">{preset.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Always Visible FACEIT Quick-Sync Bar inside GC view */}
            <div className="pt-2 border-t border-slate-800/80 mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FaceitBadge level={faceitLevel} elo={faceitElo} size="sm" />
                <div className="min-w-0 text-[11px]">
                  <span className="font-bold text-white truncate block">
                    {faceitNick || nick || 'Conta FACEIT'}
                  </span>
                  <span className="text-[10px] text-orange-400 font-mono">
                    Nível {faceitLevel} {faceitElo ? `(${faceitElo} ELO)` : ''}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRefreshFaceit(faceitNick || nick)}
                disabled={syncingFaceit}
                className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-orange-500/20 disabled:opacity-50 active:scale-95 shrink-0"
                title="Puxar nível e ELO da FACEIT agora"
              >
                <RefreshCw size={11} className={syncingFaceit ? 'animate-spin' : ''} />
                <span>{syncingFaceit ? 'Buscando...' : 'Puxar FACEIT'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Side Preference */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Preferência de Lado
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!isSteamUser}
              onClick={() => handleSideChange('CT')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                side === 'CT'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm shadow-sky-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield size={14} className={side === 'CT' ? 'text-sky-400' : 'text-slate-500'} />
              <span>CT (Defesa)</span>
            </button>

            <button
              type="button"
              disabled={!isSteamUser}
              onClick={() => handleSideChange('TR')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                side === 'TR'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame size={14} className={side === 'TR' ? 'text-amber-400' : 'text-slate-500'} />
              <span>TR (Ataque)</span>
            </button>

            <button
              type="button"
              disabled={!isSteamUser}
              onClick={() => handleSideChange('ANY')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                side === 'ANY'
                  ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-sm shadow-purple-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shuffle size={14} className={side === 'ANY' ? 'text-purple-400' : 'text-slate-500'} />
              <span>Tanto Faz</span>
            </button>
          </div>
        </div>

        {/* Submit button */}
        {!isSteamUser ? (
          <button
            type="button"
            onClick={handleSteamLogin}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#171a21] via-[#1b2838] to-[#2a475e] hover:from-[#1b2838] text-white font-bold text-xs uppercase tracking-wider transition-all border border-[#66c0f4]/50 shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <SteamIcon className="w-4 h-4 text-[#66c0f4]" />
            <span>Faça Login com a Steam para Entrar</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !nick.trim()}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={16} className="text-slate-950" />
                <span>Dados Salvos no Mix!</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>{currentProfile?.nick ? 'Atualizar meus Dados' : 'Entrar no Mix'}</span>
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
