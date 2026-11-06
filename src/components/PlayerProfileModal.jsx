import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, LogOut, ArrowRightLeft, Shield, Flame, Trophy, Sparkles, User, RefreshCw, Zap } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import SteamIcon from './SteamIcon';
import { getPlayerStats } from '../utils/playerStats';
import { getGCTier } from '../data/gcLevels';
import { playClickSound } from '../utils/audio';

export default function PlayerProfileModal({
  isOpen,
  onClose,
  profile,
  rankingSystem = 'gc',
  onLogout,
  onSwitchAccount,
  soundEnabled,
}) {
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen || !profile) return null;

  const { nick = 'Jogador', steamId, avatar = '🎯', level = 12, faceitLevel = 5, faceitElo = 1200, side = 'ANY' } = profile;
  const isSteamUser = Boolean(steamId);
  const stats = getPlayerStats(steamId);
  const gcTier = getGCTier(level);

  const handleCopySteamId = () => {
    if (!steamId) return;
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(steamId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSwitch = () => {
    if (soundEnabled) playClickSound();
    if (onSwitchAccount) {
      onSwitchAccount();
    } else {
      window.location.href = `/api/auth/steam`;
    }
  };

  const handleLogoutClick = () => {
    if (soundEnabled) playClickSound();
    if (onLogout) {
      onLogout();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl">
        
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Profile Header Passport */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-5 border-b border-slate-800">
          <div className="relative">
            <PlayerAvatar avatar={avatar} nick={nick} size="xl" className="ring-4 ring-amber-500/30 shadow-xl" />
            {isSteamUser && (
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1b2838] border-2 border-[#66c0f4] flex items-center justify-center shadow">
                <SteamIcon className="w-3.5 h-3.5 text-[#66c0f4]" />
              </span>
            )}
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="text-xl font-black font-heading text-white truncate max-w-[220px]">
                {nick}
              </h2>
              {isSteamUser ? (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Steam Verificada
                </span>
              ) : (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Não Autenticado
                </span>
              )}
            </div>

            {/* Steam ID & Profile link */}
            {steamId ? (
              <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">ID:</span>
                  <span className="text-slate-200 font-bold">{steamId}</span>
                  <button
                    onClick={handleCopySteamId}
                    className="ml-1 text-slate-500 hover:text-amber-400 transition-colors p-0.5"
                    title="Copiar SteamID64"
                  >
                    {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>

                <a
                  href={`https://steamcommunity.com/profiles/${steamId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20"
                >
                  <span>Perfil Steam</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Conecte sua conta Steam para ver estatísticas oficiais</p>
            )}
          </div>
        </div>

        {/* Ratings & Badges Grid */}
        <div className="relative z-10 py-5 border-b border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-400" />
            Classificação Competitiva
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Gamers Club Card */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400/80 font-bold block mb-0.5">
                  Gamers Club
                </span>
                <div className="font-heading font-black text-lg text-white">
                  Nível {level}
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${gcTier.text}`}>
                  Patente {gcTier.name}
                </span>
              </div>
              <GCBadge level={level} size="lg" />
            </div>

            {/* FACEIT Card */}
            <div className="bg-slate-950/80 border border-orange-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-mono uppercase text-orange-400/80 font-bold block mb-0.5">
                  FACEIT Oficial
                </span>
                <div className="font-heading font-black text-lg text-white">
                  Nível {faceitLevel}
                </div>
                <span className="text-[11px] text-orange-300 font-mono font-bold">
                  {faceitElo || '1200'} ELO
                </span>
              </div>
              <FaceitBadge level={faceitLevel} elo={faceitElo} size="lg" />
            </div>
          </div>
        </div>

        {/* CS2 Mix Hub Match Performance Statistics */}
        <div className="relative z-10 py-5 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-400" />
              Estatísticas no Mix Hub
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Temporada 2026</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Partidas</span>
              <span className="text-lg font-black font-mono text-white">{stats.matchesPlayed}</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Vitórias</span>
              <span className="text-lg font-black font-mono text-emerald-400">{stats.wins}V - {stats.losses}D</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Win Rate</span>
              <span className="text-lg font-black font-mono text-amber-400">{stats.winRate}%</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Sequência</span>
              <span className="text-lg font-black font-mono text-orange-400 flex items-center justify-center gap-0.5">
                🔥 {stats.streak}
              </span>
            </div>
          </div>

          {/* Win Rate Progress Bar */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
              <span className="text-slate-400">Taxa de Eficiência</span>
              <span className="font-bold text-emerald-400">{stats.winRate}% de Vitórias</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.winRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steam Account Switcher & Logout Controls */}
        <div className="relative z-10 pt-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ArrowRightLeft size={14} className="text-sky-400" />
            Gerenciamento da Conta Steam
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Switch Account */}
            <button
              onClick={handleSwitch}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#171a21] via-[#1b2838] to-[#2a475e] hover:from-[#1b2838] hover:to-[#2a475e] text-white border border-[#66c0f4]/50 shadow-md text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-95"
            >
              <SteamIcon className="w-4 h-4 text-[#66c0f4] group-hover:rotate-180 transition-transform duration-500" />
              <span>Entrar com Outra Conta</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogoutClick}
              className="py-3 px-4 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <LogOut size={14} />
              <span>Sair desta Conta (Logout)</span>
            </button>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300 block mb-0.5">Como trocar de conta Steam:</strong>
            Ao clicar em <em>"Entrar com Outra Conta"</em>, caso a Steam entre automaticamente na mesma conta salva no navegador, clique em <strong>"Não é você?"</strong> na tela da Valve ou deslogue em <a href="https://store.steampowered.com/logout/" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">store.steampowered.com</a>.
          </div>
        </div>

      </div>
    </div>
  );
}
