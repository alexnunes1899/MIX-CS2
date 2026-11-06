import React, { useState, useEffect } from 'react';
import GCBadge from './GCBadge';
import PlayerAvatar from './PlayerAvatar';
import { Shield, Flame, Shuffle, UserPlus, CheckCircle2, LogOut } from 'lucide-react';
import { playClickSound } from '../utils/audio';

const AVATARS = ['🎯', '👑', '💀', '⚡', '🛡️', '💣', '🔥', '🦅', '🚀', '🧠'];

export default function PlayerForm({
  onSave,
  currentProfile,
  roomId = 'MIX-PRO',
  soundEnabled,
  disabled,
}) {
  const [nick, setNick] = useState(currentProfile?.nick || '');
  const [level, setLevel] = useState(currentProfile?.level || 12);
  const [side, setSide] = useState(currentProfile?.side || 'ANY');
  const [avatar, setAvatar] = useState(currentProfile?.avatar || '🎯');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (currentProfile?.nick) setNick(currentProfile.nick);
    if (currentProfile?.level) setLevel(currentProfile.level);
    if (currentProfile?.side) setSide(currentProfile.side);
    if (currentProfile?.avatar) setAvatar(currentProfile.avatar);
  }, [currentProfile]);

  const isSteamUser = Boolean(currentProfile?.steamId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nick.trim()) return;

    if (soundEnabled) playClickSound();
    onSave({
      id: currentProfile?.id || `player-${Date.now()}`,
      nick: nick.trim(),
      level: Number(level),
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
      side: 'ANY',
      avatar: '🎯',
      steamId: null,
    };
    onSave(cleanProfile);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur space-y-4">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
            <UserPlus size={18} className="text-amber-400" />
            Seu Perfil no Mix
          </h2>
          <p className="text-xs text-slate-400">Entre na sala com seu nick e seu level da GC</p>
        </div>
        <GCBadge level={level} size="lg" showTier />
      </div>

      {/* Steam Login Button or Steam Connected Badge */}
      {!isSteamUser ? (
        <button
          type="button"
          onClick={handleSteamLogin}
          className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#171a21] via-[#1b2838] to-[#2a475e] hover:from-[#1b2838] hover:to-[#171a21] text-white border border-[#66c0f4]/30 shadow-lg text-xs font-bold transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
        >
          {/* Steam Logo SVG */}
          <svg className="w-4 h-4 fill-current text-[#66c0f4] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2m4.8 5.6a2.4 2.4 0 0 0-2.4 2.4c0 .4.1.8.3 1.1l-3 4.3a2.4 2.4 0 0 0-1.7-.2l-2.4-1a2.4 2.4 0 0 0-4.6 1.8 2.4 2.4 0 0 0 3.3 1.3l2.3 1a2.4 2.4 0 0 0 4 .3l3.2-2.2c.5.2 1.1.3 1.7.3a2.4 2.4 0 0 0 2.4-2.4 2.4 2.4 0 0 0-2.4-2.4z"/>
          </svg>
          <span>Entrar com a Steam (Puxar Nick e Foto)</span>
        </button>
      ) : (
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayerAvatar avatar={avatar} nick={nick} size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{nick}</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                  Steam Conectada ✓
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">ID: {currentProfile.steamId}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSteamLogout}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
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
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all font-medium"
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
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-lg text-center outline-none cursor-pointer"
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

        {/* Gamers Club Level Interactive Slider */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Level Gamers Club (1 a 21)
            </span>
            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-400">
              <span className="text-slate-500 text-xs">LVL</span>
              <span className="text-base">{level}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLevel((prev) => Math.max(1, prev - 1));
                if (soundEnabled) playClickSound();
              }}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-base transition-colors"
            >
              -
            </button>

            <input
              type="range"
              min="1"
              max="21"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
            />

            <button
              type="button"
              onClick={() => {
                setLevel((prev) => Math.min(21, prev + 1));
                if (soundEnabled) playClickSound();
              }}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-base transition-colors"
            >
              +
            </button>
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5 px-1">
            <span>Lvl 1 (Bronze)</span>
            <span>Lvl 10 (Ouro)</span>
            <span>Lvl 20 (Elite)</span>
            <span className="text-amber-400 font-bold">Lvl 21 (Pro)</span>
          </div>
        </div>

        {/* Side Preference */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Preferência de Lado
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setSide('CT');
                if (soundEnabled) playClickSound();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
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
              onClick={() => {
                setSide('TR');
                if (soundEnabled) playClickSound();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
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
              onClick={() => {
                setSide('ANY');
                if (soundEnabled) playClickSound();
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
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
        <button
          type="submit"
          disabled={disabled || !nick.trim()}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
      </form>
    </div>
  );
}
