import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  ArrowRightLeft,
  Shield,
  Flame,
  Trophy,
  Sparkles,
  User,
  RefreshCw,
  Zap,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Pencil,
  HelpCircle,
  Info,
  Smartphone,
  Award,
  ThumbsUp,
} from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import SteamIcon from './SteamIcon';
import { getPlayerStats } from '../utils/playerStats';
import { getGCTier } from '../data/gcLevels';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';
import { calculateTrustFactor } from '../utils/trustFactor';
import { savePostAuthAction, savePendingInvite } from '../hooks/useSteamSession';

export default function PlayerProfileModal({
  isOpen,
  onClose,
  profile,
  rankingSystem = 'gc',
  onLogout,
  onSwitchAccount,
  soundEnabled,
  onSaveProfile,
  onOpenStoryCard,
  readOnly = false,
  initialTab = 'steam',
  isSessionExpired = false,
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
  const [editingHours, setEditingHours] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [showHoursHelp, setShowHoursHelp] = useState(false);
  const [hoursSavedAlert, setHoursSavedAlert] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'steam'); // 'steam' | 'ranks' | 'stats'

  // Advanced Player Analytics & Discord Link State
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [discordLink, setDiscordLink] = useState(null);
  const [discordCodeInput, setDiscordCodeInput] = useState('');
  const [generatedWebCode, setGeneratedWebCode] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkStatusMsg, setLinkStatusMsg] = useState(null);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [sessionNeedsReauth, setSessionNeedsReauth] = useState(Boolean(isSessionExpired));
  const [copiedLinkCode, setCopiedLinkCode] = useState(false);

  const {
    nick: propNick = 'Jogador',
    steamId: propSteamId = '',
    discordId: propDiscordId = '',
    avatar: propAvatar = '🎯',
    level: propLevel = 12,
    faceitLevel: propFaceitLevel = 5,
    faceitElo: propFaceitElo = 1200,
  } = profile || {};

  const identity = analytics?.identity || null;
  const nick = (readOnly && identity?.nick) || propNick || identity?.nick || 'Jogador';
  const steamId = propSteamId || identity?.steamId || '';
  const discordId = propDiscordId || identity?.discordId || '';
  const avatar = (readOnly && identity?.avatar) || propAvatar || identity?.avatar || '🎯';
  const level = readOnly ? (identity?.level || propLevel || 12) : propLevel;
  const faceitLevel = readOnly ? (identity?.faceitLevel || propFaceitLevel || 5) : propFaceitLevel;
  const faceitElo = propFaceitElo || 1200;

  const isSteamUser = Boolean(steamId);
  const stats = readOnly
    ? { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, streak: 0 }
    : getPlayerStats(steamId);
  const gcTier = getGCTier(level);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || (readOnly ? 'stats' : 'steam'));
    }
  }, [isOpen, initialTab, readOnly]);

  const effectiveHours = profile?.cs2Hours || steamStats?.cs2Hours || null;
  const trust = calculateTrustFactor(
    { ...profile, nick, steamId, discordId, level, faceitLevel, faceitElo },
    steamStats
  );

  // Auto-sync Steam hours when detected via API (only on own editable profile)
  useEffect(() => {
    if (readOnly) return;
    if (steamStats?.cs2Hours && (!profile?.cs2Hours || profile.cs2Hours !== steamStats.cs2Hours)) {
      if (onSaveProfile) {
        onSaveProfile({
          ...profile,
          cs2Hours: steamStats.cs2Hours,
        });
      }
    }
  }, [steamStats?.cs2Hours, readOnly]);

  const handleOpenEditHours = () => {
    if (soundEnabled) playClickSound();
    setHoursInput(effectiveHours ? String(effectiveHours) : '');
    setEditingHours(true);
    setShowHoursHelp(false);
  };

  const handleSaveHours = (e) => {
    if (e) e.preventDefault();
    const parsed = parseInt(hoursInput, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100000) {
      if (soundEnabled) playClickSound();
      if (onSaveProfile) {
        onSaveProfile({
          ...profile,
          cs2Hours: parsed,
        });
      }
      setEditingHours(false);
      setHoursSavedAlert(true);
      setTimeout(() => setHoursSavedAlert(false), 3000);
    }
  };

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
    if (!isOpen || !steamId) {
      setSteamStats(null);
      return;
    }
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
        if (data && data.level) {
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
    if (!isOpen || !steamId || readOnly) return;
    handleSyncFaceitAuto();
  }, [isOpen, steamId, readOnly]);

  // Fetch Unified Player Analytics & Discord Link Status
  const analyticsQueryId = propSteamId || propDiscordId || profile?.id || propNick;
  useEffect(() => {
    if (!isOpen || !analyticsQueryId) return;
    setAnalytics(null);
    setLoadingAnalytics(true);
    fetch(`/api/players/${encodeURIComponent(analyticsQueryId)}/analytics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.analytics) setAnalytics(data.analytics);
      })
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false));
  }, [isOpen, analyticsQueryId]);

  useEffect(() => {
    setSessionNeedsReauth(Boolean(isSessionExpired));
  }, [isSessionExpired]);

  useEffect(() => {
    if (!isOpen || readOnly || !isSteamUser) return;
    fetch('/api/account/link', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setDiscordLink(data.linked ? data.link : null);
        if (data.authenticated === false) setSessionNeedsReauth(true);
        else if (data.authenticated === true) setSessionNeedsReauth(false);
      })
      .catch(() => {});
  }, [isOpen, readOnly, isSteamUser]);

  const handleRenewSteamSession = () => {
    if (soundEnabled) playClickSound();
    savePostAuthAction({ openProfile: true });
    try {
      const params = new URLSearchParams(window.location.search);
      const currentRoom = params.get('room');
      const currentKey = params.get('key') || '';
      if (currentRoom) savePendingInvite(currentRoom, currentKey);
    } catch {}
    window.location.href = '/api/auth/steam';
  };

  const handleConfirmDiscordCode = async (e) => {
    if (e) e.preventDefault();
    if (!discordCodeInput.trim()) return;
    setLinkLoading(true);
    setLinkStatusMsg(null);
    try {
      const res = await fetch('/api/account/link/confirm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discordCodeInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || data?.requiresSteamReauth) {
        setSessionNeedsReauth(true);
      }
      if (!res.ok) throw new Error(data.error || 'Falha ao vincular');
      setDiscordLink(data.link);
      setDiscordCodeInput('');
      setGeneratedWebCode(null);
      setSessionNeedsReauth(false);
      setLinkStatusMsg({ type: 'success', text: 'Discord vinculado com sucesso! Estatísticas unificadas.' });
    } catch (err) {
      setLinkStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleGenerateWebLinkCode = async () => {
    if (soundEnabled) playClickSound();
    setLinkLoading(true);
    setLinkStatusMsg(null);
    try {
      const res = await fetch('/api/account/link/code', { method: 'POST', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || data?.requiresSteamReauth) {
        setSessionNeedsReauth(true);
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar código');
      setGeneratedWebCode(data.code);
      setSessionNeedsReauth(false);
    } catch (err) {
      setLinkStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlinkDiscord = async () => {
    if (soundEnabled) playClickSound();
    setLinkLoading(true);
    setLinkStatusMsg(null);
    try {
      const res = await fetch('/api/account/link', { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || data?.requiresSteamReauth) {
        setSessionNeedsReauth(true);
      }
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao desvincular conta');
      }
      setDiscordLink(null);
      setLinkStatusMsg({ type: 'success', text: 'Vínculo Discord ↔ Steam removido.' });
    } catch (err) {
      setLinkStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyPublicProfileUrl = () => {
    if (soundEnabled) playClickSound();
    const targetId = steamId || discordId || profile?.id || nick;
    const shareUrl = `${window.location.origin}/?perfil=${encodeURIComponent(targetId)}`;
    copyText(shareUrl);
    setCopiedPublicUrl(true);
    setTimeout(() => setCopiedPublicUrl(false), 2000);
  };

  if (!isOpen || !profile) return null;

  const handleClose = () => {
    if (soundEnabled) playClickSound();
    onClose();
  };

  const handleCopySteamId = () => {
    if (!steamId) return;
    if (soundEnabled) playClickSound();
    copyText(steamId);
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
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* PINNED STICKY HEADER - NEVER DISAPPEARS */}
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
            title="Fechar Perfil (Esc)"
          >
            <X size={15} />
            <span>Fechar (Esc)</span>
          </button>
        </div>

        {/* 3-TAB NAVIGATION BAR */}
        <div className="flex items-center px-4 pt-2.5 pb-2 bg-slate-900/95 border-b border-slate-800/80 gap-2 shrink-0 z-20">
          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('steam');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'steam'
                ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border border-amber-500/50 shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <SteamIcon className="w-3.5 h-3.5 text-[#66c0f4]" />
            <span>Steam & Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('ranks');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'ranks'
                ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border border-amber-500/50 shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Trophy size={14} className="text-amber-400" />
            <span>Patentes (GC & FACEIT)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('stats');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border border-amber-500/50 shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Sparkles size={14} className="text-emerald-400" />
            <span>Estatísticas Mix</span>
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          
          {/* TAB 1: DADOS STEAM & PERFIL */}
          {activeTab === 'steam' && (
            <div className="space-y-4 animate-fadeIn">
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
                    ) : discordId ? (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/35 text-indigo-300">
                        Discord Verificado
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
                  ) : discordId ? (
                    <p className="text-xs text-indigo-300/90 font-mono mt-1">Discord ID: {discordId}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      {readOnly ? 'Perfil público de estatísticas no CS2 Mix Hub' : 'Conecte sua conta Steam para ver estatísticas oficiais'}
                    </p>
                  )}
                </div>
              </div>

              {/* 1. HERO CARD: Horas Registradas no CS2 (100% Width, Never Wraps, High-End Diagramming) */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 sm:p-4.5 transition-all shadow-lg space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                      <Clock size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 font-heading">
                          Horas Registradas no CS2
                        </span>
                        {effectiveHours ? (
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            steamStats?.cs2Hours
                              ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
                              : 'text-amber-300 bg-amber-500/15 border-amber-500/40'
                          }`}>
                            {steamStats?.cs2Hours ? 'Steam Oficial ✓' : 'Manual'}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <strong className="text-white font-mono text-2xl sm:text-3xl font-black tracking-tight whitespace-nowrap">
                          {effectiveHours ? (
                            <span>
                              {effectiveHours.toLocaleString('pt-BR')} <span className="text-amber-400 text-lg font-bold">hrs</span>
                            </span>
                          ) : (
                            <span className="text-amber-400 text-sm font-semibold">Horas não sincronizadas</span>
                          )}
                        </strong>
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                          no Counter-Strike 2
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Controls for Hours (own profile only) */}
                  {!readOnly && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenEditHours}
                        className="text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Editar ou definir manualmente suas horas de CS2"
                      >
                        <Pencil size={12} />
                        <span className="hidden sm:inline">{effectiveHours ? 'Editar' : 'Definir'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (soundEnabled) playClickSound();
                          setShowHoursHelp(!showHoursHelp);
                          setEditingHours(false);
                        }}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-sky-400 border border-slate-800 transition-colors cursor-pointer"
                        title="Ajuda sobre privacidade da Steam"
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Editing Form for CS2 Hours */}
                {!readOnly && editingHours && (
                  <form onSubmit={handleSaveHours} className="p-3.5 bg-slate-950/95 border border-amber-500/50 rounded-xl space-y-2.5 animate-fadeIn shadow-xl">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-400 font-bold flex items-center gap-1.5 font-heading uppercase tracking-wide">
                        <Clock size={14} />
                        Definir Horas de Jogo no CS2
                      </span>
                      <button type="button" onClick={() => setEditingHours(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Digite quantas horas você possui registradas no CS2/CS:GO. Elas ficarão salvas no seu perfil do Mix Hub e visíveis para os amigos no Lobby!
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="99999"
                        value={hoursInput}
                        onChange={(e) => setHoursInput(e.target.value)}
                        placeholder="Ex: 1500"
                        className="bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none flex-1 font-mono font-bold"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                      >
                        Salvar Horas
                      </button>
                    </div>
                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono">Atalhos rápidos:</span>
                      {[250, 500, 1000, 1500, 2000, 3000, 5000].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setHoursInput(String(h))}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </form>
                )}

                {hoursSavedAlert && (
                  <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-400 font-mono flex items-center gap-2 animate-fadeIn">
                    <Check size={14} />
                    <span>Horas salvas no seu perfil com sucesso e sincronizadas com o mix!</span>
                  </div>
                )}

                {/* Help Drawer about Steam Privacy Settings */}
                {showHoursHelp && (
                  <div className="p-3 bg-slate-900/90 border border-sky-500/30 rounded-xl space-y-2 text-xs animate-fadeIn">
                    <div className="flex items-center justify-between text-sky-400 font-bold">
                      <span className="flex items-center gap-1.5 font-heading">
                        <Info size={14} />
                        Como liberar suas horas oficiais na Steam:
                      </span>
                      <button type="button" onClick={() => setShowHoursHelp(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
                    </div>
                    <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1 leading-relaxed">
                      <li>Abra seu perfil na Steam e clique em <strong>Editar Perfil</strong>.</li>
                      <li>Acesse a aba <strong>Configurações de Privacidade</strong> na barra lateral.</li>
                      <li>Mude <strong>Detalhes dos Jogos</strong> para <strong>Público</strong>.</li>
                      <li>Desmarque a opção <em>"Manter o tempo de jogo privado"</em>.</li>
                    </ol>
                    <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                      Ou simplesmente use o botão <strong>"Editar Horas"</strong> acima para definir manualmente!
                    </p>
                  </div>
                )}
              </div>

              {/* 2. SUB-GRID: Status VAC & Tempo de Steam (2 Equal Symmetrical Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* VAC Ban Status */}
                <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                    steamStats?.vacBanned
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  }`}>
                    {steamStats?.vacBanned ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block truncate font-heading">
                      Status VAC Valve
                    </span>
                    <strong className={`font-mono text-xs sm:text-sm font-bold block truncate ${
                      steamStats?.vacBanned ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {steamStats?.vacBanned ? `${steamStats.vacBansCount} Ban VAC Ativo` : 'Conta 100% Limpa'}
                    </strong>
                  </div>
                </div>

                {/* Account Age */}
                <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/25 flex items-center justify-center shrink-0 shadow-sm">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block truncate font-heading">
                      Tempo de Steam
                    </span>
                    <strong className="text-white font-mono text-xs sm:text-sm font-bold block truncate">
                      {steamStats?.accountAgeYears ? `${steamStats.accountAgeYears} anos (desde ${steamStats.createdYear})` : 'Steam Ativa'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 3. Mix Hub Trust Factor & Anti-Smurf Section */}
              <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
                    <ShieldCheck size={14} className={trust.color} />
                    <span>Mix Hub Trust Factor & Anti-Smurf</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${trust.bg} ${trust.border} ${trust.color}`}>
                      ÍNDICE: {trust.score}/100 • {trust.category}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      trust.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                      trust.score >= 60 ? 'bg-gradient-to-r from-sky-500 to-indigo-400' :
                      trust.score >= 40 ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                      'bg-gradient-to-r from-rose-600 to-red-400'
                    }`}
                    style={{ width: `${trust.score}%` }}
                  />
                </div>

                {/* Smurf Inconsistency Alert if active */}
                {trust.smurfAlert && (
                  <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs flex items-start gap-2 animate-pulse">
                    <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">⚠️ Alerta de Inconsistência de Conta:</strong>
                      <span className="text-[11px] leading-relaxed opacity-90">{trust.smurfReason}</span>
                    </div>
                  </div>
                )}

                {/* Badges breakdown */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {trust.badges.map((b, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                        b.type === 'gold' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                        b.type === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                        b.type === 'rose' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' :
                        'text-sky-400 bg-sky-500/10 border-sky-500/30'
                      }`}
                    >
                      <span>{b.icon}</span>
                      <span>{b.label}</span>
                    </span>
                  ))}
                  {onOpenStoryCard && (
                    <button
                      type="button"
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        onOpenStoryCard();
                      }}
                      className="ml-auto text-[10px] font-bold text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Smartphone size={11} />
                      <span>Card Stories (9:16)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Discord <-> Steam Unified Account Linking */}
              {!readOnly && isSteamUser && (
                <div className="bg-slate-950/85 border border-indigo-500/35 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 font-heading">
                      <Zap size={14} className="text-indigo-400" />
                      Conta Unificada Discord ↔ Steam
                    </h4>
                    {discordLink && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                        ✓ Vinculada ({discordLink.discordUsername || discordLink.discordId})
                      </span>
                    )}
                  </div>

                  {discordLink ? (
                    <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs">
                      <div>
                        <div className="font-bold text-white">Discord: {discordLink.discordUsername || discordLink.discordId}</div>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {discordLink.discordId} • Ranking & Mixes unificados</div>
                      </div>
                      <button
                        type="button"
                        disabled={linkLoading}
                        onClick={handleUnlinkDiscord}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 font-bold text-[11px] cursor-pointer"
                      >
                        Desvincular
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      {sessionNeedsReauth && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/35 text-amber-200">
                          <span className="text-[11px] leading-snug">
                            Sua sessão Steam no servidor expirou (ex: após atualização ou reinício do servidor). Reconfirme para liberar a vinculação.
                          </span>
                          <button
                            type="button"
                            onClick={handleRenewSteamSession}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <RefreshCw size={12} />
                            <span>Reconfirmar Sessão Steam</span>
                          </button>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Use <code className="text-indigo-300 font-mono">/vincular</code> no Bot do Discord para gerar um código e cole abaixo, ou gere um código aqui para usar no Discord:
                      </p>
                      <form onSubmit={handleConfirmDiscordCode} className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={12}
                          value={discordCodeInput}
                          onChange={(e) => setDiscordCodeInput(e.target.value.toUpperCase())}
                          placeholder="Código do /vincular (ex: A7K9M2)"
                          className="flex-1 bg-slate-900 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-indigo-400"
                        />
                        <button
                          type="submit"
                          disabled={linkLoading || !discordCodeInput.trim()}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                      </form>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={linkLoading}
                          onClick={handleGenerateWebLinkCode}
                          className="text-[11px] font-bold text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
                        >
                          Gerar código para usar no Discord (/vincular codigo:...)
                        </button>
                        {generatedWebCode && (
                          <button
                            type="button"
                            onClick={() => {
                              if (soundEnabled) playClickSound();
                              copyText(`/vincular codigo:${generatedWebCode}`);
                              setCopiedLinkCode(true);
                              setTimeout(() => setCopiedLinkCode(false), 2500);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-mono text-[11px] font-bold cursor-pointer flex items-center gap-1.5"
                            title="Clique para copiar o comando completo"
                          >
                            <span>/vincular codigo:{generatedWebCode}</span>
                            {copiedLinkCode && <span className="text-emerald-300 font-sans">✓ Copiado!</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {linkStatusMsg && (
                    <div className={`text-[11px] font-bold px-3 py-2 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      linkStatusMsg.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                    }`}>
                      <span>{linkStatusMsg.text}</span>
                      {linkStatusMsg.type !== 'success' && sessionNeedsReauth && (
                        <button
                          type="button"
                          onClick={handleRenewSteamSession}
                          className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          <span>Reconfirmar Sessão Steam</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Steam Account Switcher & Logout Controls */}
              {!readOnly && (
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-heading">
                    <ArrowRightLeft size={14} className="text-sky-400" />
                    Gerenciamento da Conta
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={handleSwitch}
                      className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#171a21] via-[#1b2838] to-[#2a475e] hover:from-[#1b2838] hover:to-[#2a475e] text-white border border-[#66c0f4]/50 shadow-md text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-95"
                    >
                      <SteamIcon className="w-4 h-4 text-[#66c0f4] group-hover:rotate-180 transition-transform duration-500" />
                      <span>Entrar com Outra Conta</span>
                    </button>

                    <button
                      onClick={handleLogoutClick}
                      className="py-2.5 px-3.5 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      <LogOut size={14} />
                      <span>Sair desta Conta (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PATENTES (GAMERS CLUB & FACEIT) */}
          {activeTab === 'ranks' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Gamers Club Card */}
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-amber-400/80 font-bold block mb-0.5">
                      Gamers Club
                    </span>
                    <div className="font-heading font-black text-xl text-white">
                      Nível {level}
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${gcTier.text}`}>
                      {gcTier.category}
                    </span>
                  </div>
                  <GCBadge level={level} size="lg" />
                </div>

                {/* FACEIT Card */}
                <div className="bg-slate-950/80 border border-orange-500/30 rounded-2xl p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-orange-400/80 font-bold block mb-0.5">
                        FACEIT Oficial
                      </span>
                      <div className="font-heading font-black text-xl text-white">
                        Nível {faceitLevel}
                      </div>
                      <span className="text-[11px] text-orange-300 font-mono font-bold">
                        {faceitElo || '1200'} ELO
                      </span>
                    </div>
                    <FaceitBadge level={faceitLevel} elo={faceitElo} size="lg" />
                  </div>
                  {!readOnly && (
                    <div className="pt-2 border-t border-slate-900 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleSyncFaceitAuto()}
                          disabled={syncingFaceit}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 border border-orange-500/40 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                          <RefreshCw size={11} className={syncingFaceit ? 'animate-spin' : ''} />
                          <span>{syncingFaceit ? 'Buscando...' : 'Puxar Automático da FACEIT'}</span>
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
                  )}
                </div>
              </div>

              {/* Adjusters Box (own editable profile only) */}
              {!readOnly && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-inner">
                {/* FACEIT Level Selector (1 a 10) */}
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
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-900">
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

                {/* Gamers Club Level Selector (1 a 21) */}
                <div className="pt-3 border-t border-slate-900">
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
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>
              </div>
              )}
            </div>
          )}

          {/* TAB 3: ESTATÍSTICAS MIX AVANÇADAS */}
          {activeTab === 'stats' && (() => {
            const summary = analytics?.summary || {};
            const totalPlayed = Math.max(Number(summary.matchesPlayed || 0), Number(stats.matchesPlayed || 0));
            const totalWins = summary.matchesPlayed > 0 ? summary.wins : stats.wins;
            const totalLosses = summary.matchesPlayed > 0 ? summary.losses : stats.losses;
            const effWinRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : (stats.winRate || 0);
            const effStreak = summary.matchesPlayed > 0 ? summary.bestStreak : stats.streak;
            const recentForm = Array.isArray(analytics?.recentForm) ? analytics.recentForm : [];
            const mapStats = Array.isArray(analytics?.mapStats) ? analytics.mapStats : [];
            const badges = Array.isArray(analytics?.badges) ? analytics.badges : [];

            return (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-heading">
                    <Sparkles size={14} className="text-emerald-400" />
                    Estatísticas Unificadas • {analytics?.identity?.nick || nick}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyPublicProfileUrl}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPublicUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedPublicUrl ? 'Link Copiado!' : 'Copiar Perfil Público'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center shadow-sm">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Partidas</span>
                    <span className="text-xl font-black font-mono text-white">{totalPlayed}</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center shadow-sm">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Vitórias</span>
                    <span className="text-xl font-black font-mono text-emerald-400">{totalWins}V - {totalLosses}D</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center shadow-sm">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Win Rate</span>
                    <span className="text-xl font-black font-mono text-amber-400">{effWinRate}%</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center shadow-sm">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Best Streak</span>
                    <span className="text-xl font-black font-mono text-orange-400 flex items-center justify-center gap-1">
                      🔥 {effStreak}
                    </span>
                  </div>
                </div>

                {(summary.mvpCount > 0 || summary.avgKd !== null || summary.avgRating !== null) && (
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="bg-slate-950/80 border border-amber-500/25 rounded-xl p-2.5">
                      <span className="text-[10px] font-mono text-slate-400 block">MVPs</span>
                      <span className="text-sm font-black font-mono text-amber-300">👑 {summary.mvpCount || 0}</span>
                    </div>
                    <div className="bg-slate-950/80 border border-sky-500/25 rounded-xl p-2.5">
                      <span className="text-[10px] font-mono text-slate-400 block">K/D Médio</span>
                      <span className="text-sm font-black font-mono text-sky-300">{summary.avgKd ?? '—'}</span>
                    </div>
                    <div className="bg-slate-950/80 border border-emerald-500/25 rounded-xl p-2.5">
                      <span className="text-[10px] font-mono text-slate-400 block">Rating Médio</span>
                      <span className="text-sm font-black font-mono text-emerald-300">{summary.avgRating ?? '—'}</span>
                    </div>
                  </div>
                )}

                {/* Recent Form & Trend Sparkline */}
                {recentForm.length > 0 && (
                  <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                        📈 Forma Recente (Últimos {recentForm.length} jogos)
                      </span>
                      <div className="flex items-center gap-1">
                        {recentForm.map((item, idx) => (
                          <span
                            key={`${item.matchId}-${idx}`}
                            title={`${item.map} (${item.score})`}
                            className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
                              item.result === 'W'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {item.result === 'W' ? 'V' : 'D'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Best Duo Synergy & Biggest Rival */}
                {(analytics?.bestPartner || analytics?.biggestRival) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {analytics?.bestPartner && (
                      <div className="bg-slate-950/85 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">
                          🤝 Melhor Dupla (Sinergia)
                        </span>
                        <div className="text-sm font-black text-white truncate">{analytics.bestPartner.nick}</div>
                        <div className="text-[11px] font-mono text-slate-300">
                          {analytics.bestPartner.winRate}% Win Rate • {analytics.bestPartner.wins}V-{analytics.bestPartner.losses}D ({analytics.bestPartner.togetherMatches} juntos)
                        </div>
                      </div>
                    )}
                    {analytics?.biggestRival && (
                      <div className="bg-slate-950/85 border border-rose-500/30 rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block">
                          ⚔️ Maior Rival (X1)
                        </span>
                        <div className="text-sm font-black text-white truncate">{analytics.biggestRival.nick}</div>
                        <div className="text-[11px] font-mono text-slate-300">
                          Placar {analytics.biggestRival.wins}V - {analytics.biggestRival.losses}D ({analytics.biggestRival.vsMatches} confrontos)
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Win Rate by Map */}
                {mapStats.length > 0 && (
                  <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                      🗺️ Desempenho por Mapa
                    </span>
                    <div className="space-y-2">
                      {mapStats.slice(0, 6).map((ms) => (
                        <div key={ms.map} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-white">{ms.map}</span>
                            <span className="text-slate-300">
                              <strong className={ms.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{ms.winRate}%</strong>
                              {' '}• {ms.wins}V-{ms.losses}D ({ms.played})
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${ms.winRate >= 50 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                              style={{ width: `${ms.winRate}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unlocked Badges */}
                {badges.length > 0 && (
                  <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                      🏅 Conquistas & Badges ({badges.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {badges.map((b) => (
                        <div
                          key={b.id}
                          title={b.desc}
                          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-amber-500/30 text-xs flex items-center gap-1.5"
                        >
                          <span>{b.icon}</span>
                          <span className="font-bold text-amber-300">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loadingAnalytics && (
                  <div className="text-center text-[11px] font-mono text-slate-500">
                    Atualizando histórico detalhado...
                  </div>
                )}

                {/* Win Rate Progress Bar */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs mb-2 font-mono">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Taxa de Eficiência Geral</span>
                    <span className="font-bold text-emerald-400">{effWinRate}% de Vitórias</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${effWinRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FIXED BOTTOM ACTION BUTTON */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-400/50 shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Check size={16} />
              <span>{readOnly ? 'Fechar Perfil' : 'Salvar e Fechar (Voltar ao Mix)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
