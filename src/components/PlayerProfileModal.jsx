import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Copy, Check, LogOut, ArrowRightLeft, Shield, Flame, Trophy, Sparkles, User, RefreshCw, Zap, ShieldCheck, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';
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
  onSaveProfile,
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [steamStats, setSteamStats] = useState(null);
  const [loadingSteam, setLoadingSteam] = useState(false);
  const [faceitSaved, setFaceitSaved] = useState(false);
  const [tempElo, setTempElo] = useState(null);
  const [syncingFaceit, setSyncingFaceit] = useState(false);
  const [faceitSyncMessage, setFaceitSyncMessage] = useState(null);
  const [customFaceitNick, setCustomFaceitNick] = useState('');
  const [showNickInput, setShowNickInput] = useState(false);

  const { nick = 'Jogador', steamId, avatar = '🎯', level = 12, faceitLevel = 5, faceitElo = 1200, side = 'ANY' } = profile || {};
  const isSteamUser = Boolean(steamId);
  const stats = getPlayerStats(steamId);
  const gcTier = getGCTier(level);

  // Close on Escape Key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (soundEnabled) playClickSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, soundEnabled]);

  // Fetch Steam Stats
  useEffect(() => {
    if (!isOpen || !steamId) return;
    setLoadingSteam(true);
    fetch(`/api/steam/player-stats/${steamId}`)
      .then((res) => res.json())
      .then((data) => setSteamStats(data))
      .catch(() => {})
      .finally(() => setLoadingSteam(false));
  }, [isOpen, steamId]);

  const handleSyncFaceitAuto = async (overrideNick) => {
    if (!steamId && !overrideNick) return;
    setSyncingFaceit(true);
    setFaceitSyncMessage(null);
    if (soundEnabled) playClickSound();
    const queryNick = overrideNick || customFaceitNick || nick || '';
    try {
      const res = await fetch(`/api/faceit/${steamId || 'custom'}?nickname=${encodeURIComponent(queryNick)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.found && data.level) {
          const updated = {
            ...profile,
            faceitLevel: data.level,
            faceitElo: data.elo,
          };
          if (onSaveProfile) onSaveProfile(updated);
          setFaceitSyncMessage(`✓ Sincronizado: Nível ${data.level} (${data.elo} ELO)`);
          setTimeout(() => setFaceitSyncMessage(null), 4000);
          setShowNickInput(false);
        } else {
          setFaceitSyncMessage('Conta FACEIT não encontrada');
          setTimeout(() => setFaceitSyncMessage(null), 3000);
        }
      }
    } catch (e) {
      setFaceitSyncMessage('Erro na consulta');
      setTimeout(() => setFaceitSyncMessage(null), 3000);
    } finally {
      setSyncingFaceit(false);
    }
  };

  // Auto-sync FACEIT on modal open
  useEffect(() => {
    if (!isOpen || !steamId) return;
    handleSyncFaceitAuto();
  }, [isOpen, steamId]);

  if (!isOpen || !profile) return null;

  const handleClose = () => {
    if (soundEnabled) playClickSound();
    onClose();
  };

  const handleCopySteamId = () => {
    if (!steamId) return;
    if (soundEnabled) playClickSound();
    navigator.clipboard.writeText(steamId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdateFaceitLevel = (newLevel) => {
    const lvl = Math.min(10, Math.max(1, Number(newLevel)));
    const defaultElos = {
      1: 650, 2: 875, 3: 1025, 4: 1175, 5: 1325,
      6: 1475, 7: 1625, 8: 1775, 9: 1925, 10: 2200,
    };
    const newElo = defaultElos[lvl] || 1200;
    const updated = {
      ...profile,
      faceitLevel: lvl,
      faceitElo: newElo,
    };
    if (soundEnabled) playClickSound();
    setFaceitSaved(true);
    setTimeout(() => setFaceitSaved(false), 1500);
    if (onSaveProfile) onSaveProfile(updated);
  };

  const handleUpdateFaceitElo = (newElo) => {
    const eloNum = Number(newElo) || 1200;
    const updated = {
      ...profile,
      faceitElo: eloNum,
    };
    if (soundEnabled) playClickSound();
    setFaceitSaved(true);
    setTimeout(() => setFaceitSaved(false), 1500);
    if (onSaveProfile) onSaveProfile(updated);
  };

  const handleUpdateGCLevel = (newVal) => {
    const lvl = Math.min(21, Math.max(1, Number(newVal)));
    const updated = {
      ...profile,
      level: lvl,
    };
    if (onSaveProfile) onSaveProfile(updated);
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* PINNED STICKY HEADER - NEVER DISAPPEARS WHEN SCROLLING */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-20 shrink-0">
          <div className="flex items-center gap-2">
            <User size={16} className="text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-heading">
              Perfil do Jogador & Estatísticas
            </h3>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer font-bold text-xs border border-slate-700 shadow-sm z-30 active:scale-95"
            title="Fechar Perfil (ou aperte Esc)"
          >
            <X size={15} />
            <span>Fechar (Esc)</span>
          </button>
        </div>

        {/* SCROLLABLE MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {/* Profile Header Passport */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b border-slate-800">
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
                      className="ml-1 text-slate-500 hover:text-amber-400 transition-colors p-0.5 cursor-pointer"
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
          <div className="space-y-3">
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
              <div className="bg-slate-950/80 border border-orange-500/30 rounded-2xl p-3.5 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
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
                <div className="pt-2 border-t border-slate-900 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSyncFaceitAuto()}
                      disabled={syncingFaceit}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 border border-orange-500/40 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <RefreshCw size={11} className={syncingFaceit ? 'animate-spin' : ''} />
                      <span>{syncingFaceit ? 'Buscando na FACEIT...' : 'Puxar Automático da FACEIT'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNickInput(!showNickInput)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      {showNickInput ? 'Fechar' : 'Nick diferente?'}
                    </button>
                  </div>
                  {showNickInput && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="Ex: Lxn1899"
                        value={customFaceitNick}
                        onChange={(e) => setCustomFaceitNick(e.target.value)}
                        className="bg-slate-900 border border-orange-500/40 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none flex-1 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleSyncFaceitAuto(customFaceitNick)}
                        className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Buscar
                      </button>
                    </div>
                  )}
                  {faceitSyncMessage && (
                    <span className="text-[10px] text-emerald-400 font-bold block animate-pulse">
                      {faceitSyncMessage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Level Adjusters */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-inner">
              {/* FACEIT Level Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5 font-heading">
                    <Zap size={13} className="text-orange-400" /> Selecione seu Nível FACEIT (1 a 10)
                  </span>
                  {faceitSaved ? (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                      ✓ Nível Salvo!
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Clique no seu nível
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = faceitLevel === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleUpdateFaceitLevel(num)}
                        className={`h-9 rounded-xl font-mono font-black text-xs transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                          isSelected
                            ? 'bg-gradient-to-t from-orange-600 via-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-300 scale-105'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-orange-500/30'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                {/* ELO Input Row */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-900">
                  <span className="text-slate-400 font-mono text-xs">Pontos de ELO no FACEIT:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={100}
                      max={4500}
                      value={tempElo !== null ? tempElo : (faceitElo || 1200)}
                      onChange={(e) => setTempElo(e.target.value)}
                      onBlur={() => {
                        if (tempElo) {
                          handleUpdateFaceitElo(tempElo);
                          setTempElo(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tempElo) {
                          handleUpdateFaceitElo(tempElo);
                          setTempElo(null);
                        }
                      }}
                      className="w-24 bg-slate-900 border border-orange-500/40 focus:border-orange-400 rounded-lg px-2.5 py-1 text-center font-mono font-bold text-orange-300 text-xs outline-none"
                    />
                    <span className="text-slate-500 font-mono text-[10px]">pts</span>
                  </div>
                </div>
              </div>

              {/* Gamers Club Level Selector */}
              <div className="pt-2.5 border-t border-slate-900">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-heading">
                    <Shield size={13} className="text-amber-400" /> Nível Gamers Club (1 a 21)
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    Nível {level}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={21}
                  value={level}
                  onChange={(e) => handleUpdateGCLevel(e.target.value)}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Official Valve Steam Data Card */}
          {isSteamUser && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <SteamIcon className="w-3.5 h-3.5 text-[#66c0f4]" />
                  <span>Dados Oficiais da Valve (Steam)</span>
                </h3>
                <span className="text-[10px] font-mono text-[#66c0f4] bg-[#1b2838] px-2 py-0.5 rounded-full border border-[#66c0f4]/30">
                  {steamStats?.source || 'Steam Web API'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* CS2 Playtime */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Horas de CS2</span>
                    <strong className="text-white font-mono text-sm">
                      {steamStats?.cs2Hours ? `${steamStats.cs2Hours.toLocaleString('pt-BR')} hrs` : 'Disponível'}
                    </strong>
                  </div>
                </div>

                {/* VAC Ban Status */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    steamStats?.vacBanned
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {steamStats?.vacBanned ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Status VAC Valve</span>
                    <strong className={`font-mono text-xs ${steamStats?.vacBanned ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {steamStats?.vacBanned ? `${steamStats.vacBansCount} Ban VAC` : 'Conta 100% Limpa'}
                    </strong>
                  </div>
                </div>

                {/* Account Age */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Tempo de Steam</span>
                    <strong className="text-white font-mono text-xs">
                      {steamStats?.accountAgeYears ? `${steamStats.accountAgeYears} anos (desde ${steamStats.createdYear})` : 'Steam Ativa'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CS2 Mix Hub Match Performance Statistics */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
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
          <div className="space-y-3 pt-2 border-t border-slate-800">
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
          </div>

          {/* PROMINENT CLOSE / RETURN BUTTON AT BOTTOM */}
          <div className="pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700 shadow-md active:scale-95"
            >
              <X size={16} />
              <span>Fechar Janela de Perfil (Voltar ao Mix)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
