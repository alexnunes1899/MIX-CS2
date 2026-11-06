import React, { useState, useEffect } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import SteamIcon from './SteamIcon';
import { Shield, Flame, Shuffle, UserPlus, CheckCircle2, LogOut, RefreshCw, Zap, Lock } from 'lucide-react';
import { playClickSound } from '../utils/audio';

const AVATARS = ['🎯', '👑', '💀', '⚡', '🛡️', '💣', '🔥', '🦅', '🚀', '🧠'];

export default function PlayerForm({
  onSave,
  currentProfile,
  roomId = 'MIX-PRO',
  rankingSystem = 'gc', // 'gc' | 'faceit'
  soundEnabled,
  disabled,
}) {
  const [nick, setNick] = useState(currentProfile?.nick || '');
  const [level, setLevel] = useState(currentProfile?.level || 12);
  const [faceitLevel, setFaceitLevel] = useState(currentProfile?.faceitLevel || 5);
  const [faceitElo, setFaceitElo] = useState(currentProfile?.faceitElo || 1200);
  const [side, setSide] = useState(currentProfile?.side || 'ANY');
  const [avatar, setAvatar] = useState(currentProfile?.avatar || '🎯');
  const [isSaved, setIsSaved] = useState(false);
  const [levelSynced, setLevelSynced] = useState(false);
  const [syncingFaceit, setSyncingFaceit] = useState(false);

  useEffect(() => {
    if (currentProfile?.nick) setNick(currentProfile.nick);
    if (currentProfile?.level) setLevel(currentProfile.level);
    if (currentProfile?.faceitLevel) setFaceitLevel(currentProfile.faceitLevel);
    if (currentProfile?.faceitElo) setFaceitElo(currentProfile.faceitElo);
    if (currentProfile?.side) setSide(currentProfile.side);
    if (currentProfile?.avatar) setAvatar(currentProfile.avatar);
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
        steamId: currentProfile?.steamId || null,
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

  // Fetch / Refresh FACEIT Profile from server by Steam ID
  const handleRefreshFaceit = async () => {
    if (!currentProfile?.steamId) return;
    setSyncingFaceit(true);
    try {
      const res = await fetch(`/api/faceit/${currentProfile.steamId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.level) {
          setFaceitLevel(data.level);
          if (data.elo) setFaceitElo(data.elo);
          syncProfileUpdate({ faceitLevel: data.level, faceitElo: data.elo });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingFaceit(false);
    }
  };

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
      ready: true,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSteamLogin = () => {
    if (soundEnabled) playClickSound();
    window.location.href = `/api/auth/steam?room=${encodeURIComponent(roomId)}`;
  };

  const handleSteamLogout = () => {
    if (soundEnabled) playClickSound();
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
            {isFaceitMode ? (
              <span className="text-[10px] text-orange-400 font-bold bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                <Zap size={10} /> MODO FACEIT (AUTO)
              </span>
            ) : (
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                <Shield size={10} /> MODO GAMERS CLUB (1-21)
              </span>
            )}
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
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayerAvatar avatar={avatar} nick={nick} size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate max-w-[140px]">{nick}</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 flex items-center gap-1">
                  <SteamIcon className="w-3 h-3 text-[#66c0f4]" />
                  Steam ✓
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">ID: {currentProfile.steamId}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSteamLogout}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
            title="Desconectar Steam"
          >
            <LogOut size={14} />
          </button>
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

        {/* RANKING CONTROLS: FACEIT VS GAMERS CLUB */}
        {isFaceitMode ? (
          /* FACEIT Controls */
          <div className="bg-slate-950/60 border border-orange-500/30 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider flex items-center gap-1">
                  <Zap size={13} className="text-orange-400" /> Nível FACEIT (1 a 10)
                </span>
                <span className="text-[9px] text-orange-400 font-mono font-bold bg-orange-500/10 px-1.5 py-0.2 rounded border border-orange-500/20">
                  Auto API
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-orange-400">
                <span className="text-slate-500 text-xs">LVL</span>
                <span className="text-base">{faceitLevel}</span>
                {levelSynced && (
                  <span className="text-[10px] text-emerald-400 font-sans font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 animate-pulse">
                    ✓ Atualizado
                  </span>
                )}
              </div>
            </div>

            {/* Auto fetch button & ELO display */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-slate-500 text-[10px] uppercase font-mono">ELO:</span>
                <span className="font-mono font-bold text-orange-300">{faceitElo || '1200'} pts</span>
              </div>

              {isSteamUser && (
                <button
                  type="button"
                  onClick={handleRefreshFaceit}
                  disabled={syncingFaceit}
                  className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 transition-colors font-semibold cursor-pointer disabled:opacity-50"
                  title="Buscar estatísticas atualizadas no FACEIT via Steam ID"
                >
                  <RefreshCw size={11} className={syncingFaceit ? 'animate-spin' : ''} />
                  <span>{syncingFaceit ? 'Consultando...' : 'Re-sincronizar'}</span>
                </button>
              )}
            </div>

            {/* Quick 1-10 selector buttons */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={!isSteamUser}
                  onClick={() => handleFaceitLevelChange(num)}
                  className={`py-1.5 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer ${
                    faceitLevel === num
                      ? num === 10
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/40 border border-red-400'
                        : 'bg-orange-500 text-slate-950 font-black shadow-md border border-orange-300'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
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

            {/* Quick Level Preset Buttons */}
            <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-0.5 px-1">
              <button
                type="button"
                disabled={!isSteamUser}
                onClick={() => handleGCLevelChange(1)}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Lvl 1 (Bronze)
              </button>
              <button
                type="button"
                disabled={!isSteamUser}
                onClick={() => handleGCLevelChange(10)}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Lvl 10 (Ouro)
              </button>
              <button
                type="button"
                disabled={!isSteamUser}
                onClick={() => handleGCLevelChange(20)}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Lvl 20 (Elite)
              </button>
              <button
                type="button"
                disabled={!isSteamUser}
                onClick={() => handleGCLevelChange(21)}
                className="text-amber-400 font-bold hover:text-amber-300 transition-colors cursor-pointer"
              >
                Lvl 21 (Pro)
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
