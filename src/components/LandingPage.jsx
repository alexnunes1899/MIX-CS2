import React, { useState, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Swords,
  Dices,
  Shield,
  Flame,
  Users,
  Layers,
  Zap,
  Trophy,
  ArrowRight,
  ExternalLink,
  Hash,
  RefreshCw,
  Server,
  Bell,
  Bot,
  ShieldCheck,
  Check,
  Volume2,
  VolumeX,
  Plug,
  Newspaper,
  Eye,
  Download,
  BookOpen,
  Target,
  Activity,
} from 'lucide-react';
import { ACTIVE_DUTY_MAPS, EXTRA_CS2_MAPS } from '../data/maps';
import PlayerAvatar from './PlayerAvatar';
import SteamIcon from './SteamIcon';
import MainNavigationMenu from './MainNavigationMenu';
import MixHubLogo from './MixHubLogo';
import { playClickSound } from '../utils/audio';
import { savePendingInvite } from '../hooks/useSteamSession';
import { buildDiscordBotInviteUrl } from '../../shared/appConfig.js';

const SHORTCUT_THEMES = {
  sky: {
    card: 'hover:border-sky-400/60 hover:bg-sky-950/25',
    iconBox: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    titleHover: 'group-hover:text-sky-300',
  },
  amber: {
    card: 'hover:border-amber-400/60 hover:bg-amber-950/25',
    iconBox: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    titleHover: 'group-hover:text-amber-300',
  },
  purple: {
    card: 'hover:border-purple-400/60 hover:bg-purple-950/25',
    iconBox: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    titleHover: 'group-hover:text-purple-300',
  },
  teal: {
    card: 'hover:border-teal-400/60 hover:bg-teal-950/25',
    iconBox: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    titleHover: 'group-hover:text-teal-300',
  },
  orange: {
    card: 'hover:border-orange-400/60 hover:bg-orange-950/25',
    iconBox: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    titleHover: 'group-hover:text-orange-300',
  },
  emerald: {
    card: 'hover:border-emerald-400/60 hover:bg-emerald-950/25',
    iconBox: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    titleHover: 'group-hover:text-emerald-300',
  },
};

const DEMO_CT_LEVELS = [20, 18, 16, 14, 13];
const DEMO_TR_LEVELS = [19, 18, 17, 14, 13];

export default function LandingPage({
  onGoHome,
  onEnterRoom,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenRoomsHub,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenServersPage,
  onOpenUpdatesPage,
  onOpenTournament,
  onOpenGrenades,
  onOpenAimReflex,
  onRequireSteamLogin,
  onOpenProfile,
  onSpectateRoom,
  canInstallPwa = false,
  onInstallPwa,
  notificationsEnabled = false,
  onToggleNotifications,
  myProfile,
  soundEnabled,
  onToggleSound,
  officialRotation,
  syncingRotation,
  onSyncOfficialRotation,
  publicRooms = null,
}) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [mapTab, setMapTab] = useState('active');
  const [latestPatch, setLatestPatch] = useState(null);
  const [featuredMapIdx, setFeaturedMapIdx] = useState(0);

  const activeDutyMaps = officialRotation?.activeDutyMaps && officialRotation.activeDutyMaps.length > 0
    ? officialRotation.activeDutyMaps
    : ACTIVE_DUTY_MAPS;

  const extraMaps = officialRotation?.extraMaps && officialRotation.extraMaps.length > 0
    ? officialRotation.extraMaps
    : EXTRA_CS2_MAPS;

  const currentDisplayMaps = mapTab === 'active' ? activeDutyMaps : extraMaps;
  const displayedRooms = Array.isArray(publicRooms) ? publicRooms : activeRooms;
  const featuredMap = activeDutyMaps[featuredMapIdx % activeDutyMaps.length] || activeDutyMaps[0];

  useEffect(() => {
    fetch('/api/cs2/updates?limit=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.latest) setLatestPatch(data.latest);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (Array.isArray(publicRooms)) return;
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => setActiveRooms(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [publicRooms]);

  useEffect(() => {
    if (!activeDutyMaps.length) return undefined;
    const timer = setInterval(() => {
      setFeaturedMapIdx((prev) => (prev + 1) % activeDutyMaps.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [activeDutyMaps.length]);

  const isSteamLogged = Boolean(myProfile?.steamId);

  const triggerAction = (fn) => {
    if (soundEnabled) playClickSound();
    if (typeof fn === 'function') fn();
  };

  const persistPendingRoomRedirect = (code) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      const targetRoom = urlRoom || code;
      if (targetRoom) {
        savePendingInvite(targetRoom, params.get('key') || '');
      }
    } catch {}
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const defaultCode = myProfile?.nick
      ? `TIME-${myProfile.nick.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
      : 'MIX-PRO';
    const code = roomCodeInput.trim().toUpperCase() || defaultCode;
    const roomExists = displayedRooms.some((r) => String(r.id || '').toUpperCase() === code);
    if (!isSteamLogged && !roomExists) {
      persistPendingRoomRedirect(code);
      if (onRequireSteamLogin) {
        onRequireSteamLogin('criar uma nova sala de mix');
      } else {
        window.location.href = '/api/auth/steam';
      }
      return;
    }
    if (soundEnabled) playClickSound();
    onEnterRoom(code, { requireCreate: !roomExists });
  };

  const handleCreateMix = (code = 'MIX-PRO', { requireCreate = false } = {}) => {
    const clean = String(code || 'MIX-PRO').trim().toUpperCase();
    const roomExists = displayedRooms.some((r) => String(r.id || '').toUpperCase() === clean);
    if (!isSteamLogged && (requireCreate || !roomExists)) {
      persistPendingRoomRedirect(clean);
      if (onRequireSteamLogin) {
        onRequireSteamLogin('criar uma nova sala de mix');
      } else {
        window.location.href = '/api/auth/steam';
      }
      return;
    }
    if (soundEnabled) playClickSound();
    onEnterRoom(clean, { requireCreate: !roomExists });
  };

  const heroShortcuts = [
    {
      id: 'veto',
      title: 'Veto Rápido',
      subtitle: 'Pick & Ban MD1/MD3/MD5',
      icon: Zap,
      theme: 'sky',
      onClick: onOpenQuickVeto,
    },
    {
      id: 'roleta',
      title: 'Roleta de Mapa',
      subtitle: 'Sorteio 3D Active Duty',
      icon: Dices,
      theme: 'amber',
      onClick: onOpenQuickMapRoll,
    },
    {
      id: 'torneio',
      title: 'Modo Torneio',
      subtitle: 'Brackets & Playoffs',
      icon: Swords,
      theme: 'purple',
      onClick: onOpenTournament,
    },
    {
      id: 'granadas',
      title: 'Granadas & Smokes',
      subtitle: 'Playbook pixel a pixel',
      icon: BookOpen,
      theme: 'teal',
      onClick: onOpenGrenades,
    },
    {
      id: 'mira',
      title: 'Treino de Reflexo',
      subtitle: 'Aquecimento em ms',
      icon: Target,
      theme: 'orange',
      onClick: onOpenAimReflex,
    },
    {
      id: 'servidores',
      title: 'Servidores & LAN',
      subtitle: 'RCON, GSI & 0ms',
      icon: Server,
      theme: 'emerald',
      onClick: onOpenServersPage ? () => onOpenServersPage() : null,
    },
  ].filter((item) => typeof item.onClick === 'function');

  const metricsCards = [
    {
      value: '126 COMBINAÇÕES',
      label: 'Equilíbrio GC (1–21) & FACEIT',
      detail: 'Duplas Fixas + Draft de Capitães',
      accent: 'text-amber-400 border-amber-500/25 bg-amber-500/10',
      icon: Trophy,
    },
    {
      value: `${activeDutyMaps.length} + ${extraMaps.length} MAPAS CS2`,
      label: 'Rotação Oficial Valve',
      detail: 'Veto MD1, MD3 e MD5 com lados CT/TR',
      accent: 'text-sky-400 border-sky-500/25 bg-sky-500/10',
      icon: Layers,
    },
    {
      value: 'TELEMETRIA GSI',
      label: 'Placar & Stats em Tempo Real',
      detail: 'K/D, ADR, MVP, Bagre & Card PNG',
      accent: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10',
      icon: Activity,
    },
    {
      value: '39 SLASH COMMANDS',
      label: 'Bot Discord Integrado',
      detail: 'Puxar call de voz, fila & radar ao vivo',
      accent: 'text-indigo-400 border-indigo-500/25 bg-indigo-500/10',
      icon: Bot,
    },
  ];

  const ecosystemFeatures = [
    {
      id: 'balance',
      title: 'Balanceador Gamers Club (1–21) & FACEIT ELO',
      description: 'O algoritmo avalia matematicamente todas as 126 combinações possíveis de 5v5, respeitando duplas fixas ou modo Draft de Capitães.',
      cta: 'Criar Sala Balanceada',
      icon: Trophy,
      badge: '126 Combinações',
      theme: 'amber',
      onClick: () => handleCreateMix('MIX-PRO'),
    },
    {
      id: 'veto',
      title: 'Pick & Ban Oficial (MD1, MD3 e MD5)',
      description: 'Turnos alternados com timer configurável, carimbo animado de banimento, chuva de confetes no mapa decisivo e escolha de lado CT/TR.',
      cta: 'Abrir Simulador de Veto',
      icon: Swords,
      badge: 'Estilo Major',
      theme: 'sky',
      onClick: onOpenQuickVeto,
    },
    {
      id: 'tournament',
      title: 'Modo Torneio & Chaveamento',
      description: 'Monte campeonatos completos com oitavas, quartas, semi e final, progresso em tempo real, placar e registro oficial de campeões.',
      cta: 'Criar ou Ver Torneio',
      icon: Flame,
      badge: 'Playoffs 5v5',
      theme: 'purple',
      onClick: onOpenTournament,
    },
    {
      id: 'grenades',
      title: 'Playbook de Granadas & Treino de Mira',
      description: 'Consulte smokes, flashes e molotovs por mapa antes do mix, baixe a CFG completa de treino e aqueça o tempo de reação em ms.',
      cta: 'Abrir Playbook de Granadas',
      icon: BookOpen,
      badge: 'Tático + Aim',
      theme: 'teal',
      onClick: onOpenGrenades,
    },
    {
      id: 'gsi',
      title: 'Telemetria Valve GSI & Hall da Fama',
      description: 'Conecte o instalador de 1 clique no CS2 para acompanhar placar de rounds, MVP automático, Bagre da Partida, ranking mensal e Story Card.',
      cta: 'Ver Ranking & Temporadas',
      icon: Activity,
      badge: 'Tempo Real',
      theme: 'orange',
      onClick: onOpenLeaderboard,
    },
    {
      id: 'servers',
      title: 'Central de Servidores, RCON & LAN 0ms',
      description: 'Guias de servidor dedicado e Radmin VPN, medição de latência, comandos RCON protegidos e botão de Connect direto com 1 clique.',
      cta: 'Abrir Central de Servidores',
      icon: Server,
      badge: 'Online & LAN',
      theme: 'emerald',
      onClick: onOpenServersPage ? () => onOpenServersPage() : null,
    },
  ].filter((item) => typeof item.onClick === 'function');

  const showMapsFillerCard = currentDisplayMaps.length % 4 !== 0;

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#070b15]/95 backdrop-blur-xl sticky top-0 z-40 shadow-2xl">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2.5">
          {/* Brand Identity */}
          <div
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0 select-none whitespace-nowrap"
            onClick={() => {
              if (soundEnabled) playClickSound();
              if (onGoHome) onGoHome();
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="relative shrink-0">
              <MixHubLogo className="w-9 h-9 shrink-0" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#070b15] animate-pulse" />
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                <span className="text-base font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                  MIX HUB
                </span>
                <span className="text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono">
                  GC
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden 2xl:block">5V5 COMPETITIVO</p>
            </div>
          </div>

          {/* Responsive Nav Menu */}
          <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-1">
            <MainNavigationMenu
              activeTab="inicio"
              onGoHome={() => {
                if (onGoHome) onGoHome();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenLeaderboard={onOpenLeaderboard}
              onOpenDiscordModal={onOpenDiscordModal}
              onOpenQuickMapRoll={onOpenQuickMapRoll}
              onOpenQuickVeto={onOpenQuickVeto}
              onOpenServersPage={onOpenServersPage}
              onOpenUpdatesPage={onOpenUpdatesPage}
              onOpenRoomsHub={onOpenRoomsHub}
              onOpenTournament={onOpenTournament}
              onOpenGrenades={onOpenGrenades}
              onOpenAimReflex={onOpenAimReflex}
              activeRoomsCount={displayedRooms.length}
              soundEnabled={soundEnabled}
            />
          </div>

          {/* Utility Dock + Steam + CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800/90 shrink-0">
              <button
                type="button"
                onClick={() => triggerAction(onOpenDiscordModal)}
                title="Bot e Central Discord"
                className="relative p-1.5 rounded-lg text-[#7983f5] hover:text-white hover:bg-[#5865F2]/25 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Bot size={15} className="text-[#5865F2]" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-pulse" />
              </button>

              {onToggleNotifications && (
                <button
                  type="button"
                  onClick={() => triggerAction(onToggleNotifications)}
                  title={notificationsEnabled ? 'Alertas no navegador ativos (salas 8-9/10 e updates CS2)' : 'Ativar alertas no navegador para filas quase fechando e updates CS2'}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer hidden sm:flex items-center justify-center active:scale-95 shrink-0 ${
                    notificationsEnabled
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Bell size={15} className={notificationsEnabled ? 'text-amber-300' : 'text-slate-400'} />
                </button>
              )}

              {canInstallPwa && onInstallPwa && (
                <button
                  type="button"
                  onClick={() => triggerAction(onInstallPwa)}
                  title="Instalar CS2 Mix Hub como aplicativo (PWA)"
                  className="p-1.5 rounded-lg text-sky-300 hover:text-white hover:bg-sky-500/20 transition-all cursor-pointer hidden sm:flex items-center justify-center active:scale-95 shrink-0"
                >
                  <Download size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={onToggleSound}
                className={`p-1.5 rounded-lg transition-all cursor-pointer hidden sm:flex items-center justify-center active:scale-95 shrink-0 ${
                  soundEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={soundEnabled ? 'Sons Ativados' : 'Sons Silenciados'}
              >
                {soundEnabled ? (
                  <Volume2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <VolumeX size={15} className="text-slate-400 shrink-0" />
                )}
              </button>
            </div>

            {isSteamLogged ? (
              <button
                type="button"
                onClick={() => triggerAction(onOpenProfile)}
                title="Abrir meu perfil e estatísticas Steam"
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 rounded-xl px-2 py-1.5 shadow-sm transition-all cursor-pointer group shrink-0"
              >
                <PlayerAvatar avatar={myProfile.avatar} nick={myProfile.nick} size="sm" />
                <span className="text-xs font-bold text-white hidden xl:inline group-hover:text-amber-400 transition-colors truncate max-w-[76px]">
                  {myProfile.nick}
                </span>
              </button>
            ) : (
              <a
                href="/api/auth/steam"
                title="Fazer Login com a Steam"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#171a21] to-[#1b2838] hover:from-[#1b2838] hover:to-[#2a475e] border border-[#66c0f4]/40 hover:border-[#66c0f4] text-white text-xs font-bold transition-all shadow-md group cursor-pointer shrink-0"
              >
                <SteamIcon className="w-4 h-4 text-[#66c0f4] group-hover:scale-110 transition-transform shrink-0" />
                <span className="hidden xl:inline">Steam</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => triggerAction(onOpenRoomsHub)}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Play size={12} fill="currentColor" className="shrink-0" />
              <span className="hidden sm:inline">Criar Mix</span>
              <span className="sm:hidden">Mix</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Navigation Bar */}
        <div className="lg:hidden border-t border-slate-800/80 px-2 py-1.5 bg-[#070b15]/98 flex items-center justify-center w-full">
          <MainNavigationMenu
            activeTab="inicio"
            onGoHome={() => {
              if (onGoHome) onGoHome();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenDiscordModal={onOpenDiscordModal}
            onOpenQuickMapRoll={onOpenQuickMapRoll}
            onOpenQuickVeto={onOpenQuickVeto}
            onOpenServersPage={onOpenServersPage}
            onOpenUpdatesPage={onOpenUpdatesPage}
            onOpenRoomsHub={onOpenRoomsHub}
            onOpenTournament={onOpenTournament}
            onOpenGrenades={onOpenGrenades}
            onOpenAimReflex={onOpenAimReflex}
            activeRoomsCount={displayedRooms.length}
            soundEnabled={soundEnabled}
          />
        </div>
      </header>

      {/* HERO SECTION — Command Center Esports 12 Colunas */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Atmospheric CS2 Map Backdrop */}
        {featuredMap?.image && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.14] scale-105 blur-[2px] transition-all duration-1000 pointer-events-none"
            style={{ backgroundImage: `url(${featuredMap.image})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a12]/80 via-[#070a12]/90 to-[#070a12] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070a12] via-[#070a12]/70 to-transparent pointer-events-none" />
        {/* CT / TR Volumetric Glows */}
        <div className="absolute -top-12 left-1/4 w-[520px] h-[300px] bg-amber-500/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/6 w-[440px] h-[280px] bg-sky-500/12 rounded-full blur-[130px] pointer-events-none" />

        <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 pt-8 sm:pt-11 pb-10 sm:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-stretch">
            {/* Left Column (7 cols): Core Pitch, Command Form & 3x2 Shortcuts */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-5 text-center lg:text-left">
              <div className="space-y-4">
                {/* Top Status Badges */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1424]/90 border border-amber-500/35 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>ROTAÇÃO VALVE ACTIVE DUTY • GC (1–21) & FACEIT ELO</span>
                  </div>

                  {onOpenUpdatesPage && (
                    <button
                      type="button"
                      onClick={() => triggerAction(onOpenUpdatesPage)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-orange-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <Newspaper size={12} />
                      <span>Patch CS2 PT-BR • {latestPatch?.formattedDate || 'Notas Oficiais'}</span>
                    </button>
                  )}
                </div>

                {/* Main Title */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                    <h1 className="text-3xl sm:text-5xl xl:text-[54px] font-black font-heading text-white tracking-wider leading-[1.04]">
                      JOGUE MIX 5V5{' '}
                      <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 drop-shadow-sm">
                        COMO UM PROFISSIONAL
                      </span>
                    </h1>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-center lg:justify-start gap-2.5">
                    <span className="inline-flex items-center self-center sm:self-auto gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-white/10 text-[11px] font-mono font-black text-sky-300 shrink-0">
                      <Shield size={12} className="text-sky-400" />
                      CS2 • MR12 COMPETITIVO
                    </span>
                    <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed max-w-2xl">
                      Lobby com link direto, equilíbrio matemático das <strong>126 combinações</strong> (GC 1–21, FACEIT ELO e Duplas Fixas), <strong>Pick & Ban oficial</strong> e integração em tempo real com <strong>Discord + Valve GSI</strong>.
                    </p>
                  </div>
                </div>

                {/* Elevated Room Entry Command Box (Full Column Width) */}
                <form
                  onSubmit={handleJoinByCode}
                  className="rounded-2xl bg-[#0b1222]/95 border border-amber-500/35 focus-within:border-amber-400 p-3.5 shadow-[0_20px_50px_-15px_rgba(245,158,11,0.22)] backdrop-blur-2xl space-y-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 flex items-center bg-slate-950/85 border border-slate-800 focus-within:border-amber-500/60 rounded-xl px-3.5 py-2.5 transition-colors">
                      <Hash size={17} className="text-amber-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        placeholder={myProfile?.nick ? `Código da sala (ex: TIME-${myProfile.nick.toUpperCase()})...` : 'Digite ou crie o código da sala (ex: MIX-PRO)...'}
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                        className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-500 outline-none font-semibold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                      <span>Entrar / Criar Sala</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerAction(onOpenRoomsHub)}
                      className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/90 hover:border-sky-400/50 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Layers size={14} className="text-sky-400" />
                      <span>Ver Salas ({displayedRooms.length})</span>
                    </button>
                  </div>

                  {/* Card Footer: Quick Presets + Steam Login Status */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-white/[0.06] text-[11px]">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                      <span className="text-slate-500 font-medium">Acesso rápido:</span>
                      {['MIX-PRO', 'LOBBY-5V5', 'MIX-AMIGOS'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleCreateMix(preset)}
                          className="px-2.5 py-0.5 rounded-full bg-slate-900 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 font-mono font-bold transition-colors cursor-pointer"
                        >
                          #{preset}
                        </button>
                      ))}
                    </div>

                    {isSteamLogged ? (
                      <button
                        type="button"
                        onClick={() => triggerAction(onOpenProfile)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 font-semibold transition-colors cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Logado como {myProfile.nick}</span>
                      </button>
                    ) : (
                      <a
                        href="/api/auth/steam"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1b2838] hover:bg-[#2a475e] border border-[#66c0f4]/40 text-sky-300 hover:text-white font-semibold transition-colors"
                      >
                        <SteamIcon className="w-3.5 h-3.5 text-[#66c0f4]" />
                        <span>Login Steam 1-Clique</span>
                      </a>
                    )}
                  </div>
                </form>
              </div>

              {/* Symmetric 3x2 Quick Action Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                {heroShortcuts.map((item) => {
                  const Icon = item.icon;
                  const t = SHORTCUT_THEMES[item.theme] || SHORTCUT_THEMES.amber;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => triggerAction(item.onClick)}
                      className={`p-3 rounded-2xl bg-[#0b1120]/90 border border-white/[0.08] transition-all shadow-lg group cursor-pointer active:scale-[0.98] ${t.card}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${t.iconBox}`}>
                          <Icon size={14} />
                        </div>
                        <span className={`text-xs font-black uppercase text-white transition-colors truncate ${t.titleHover}`}>
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug truncate">{item.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column (5 cols): Live Match Center & 5v5 Balance Preview HUD */}
            <div className="lg:col-span-5">
              <div className="h-full flex flex-col justify-between rounded-3xl bg-[#0b1120]/95 border border-white/[0.12] overflow-hidden shadow-2xl">
                {/* Featured Active Duty Visual Header */}
                <div className="relative h-28 sm:h-32 overflow-hidden border-b border-white/[0.08] p-4 flex flex-col justify-between">
                  {featuredMap?.image && (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-all duration-700 opacity-55 scale-105"
                      style={{ backgroundImage: `url(${featuredMap.image})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#070b15]/95 via-[#070b15]/75 to-[#070b15]/60" />

                  {/* Top Row: Live Status + Active Rooms Counter */}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <h2 className="text-sm font-black font-heading uppercase tracking-wider text-white">
                        Match Center • Ao Vivo
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-amber-500/40 text-amber-300">
                      {displayedRooms.length} {displayedRooms.length === 1 ? 'sala online' : 'salas online'}
                    </span>
                  </div>

                  {/* Bottom Row: Featured Map Badge + Mini Map Switcher Pills */}
                  <div className="relative z-10 flex items-end justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {featuredMap?.logo && (
                        <img
                          src={featuredMap.logo}
                          alt={featuredMap.name}
                          className="w-9 h-9 object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                          Pool Oficial Valve • {featuredMap?.file}
                        </div>
                        <div className="text-base font-black font-heading text-white leading-tight truncate">
                          {featuredMap?.name || 'Active Duty'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {activeDutyMaps.slice(0, 5).map((m, idx) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setFeaturedMapIdx(idx)}
                          title={`Visualizar ${m.name}`}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border ${
                            idx === featuredMapIdx % activeDutyMaps.length
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-950/80 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {m.name.slice(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Body: Live Rooms List OR Visual 5v5 Balance HUD */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                  {displayedRooms.length > 0 ? (
                    <>
                      <div className="space-y-2.5">
                        {displayedRooms.slice(0, 4).map((r) => {
                          const c = Math.min(10, Math.max(0, Number(r.playerCount) || 0));
                          const pct = Math.round((c / 10) * 100);
                          const live = r.liveMatch?.connected ? r.liveMatch : null;
                          return (
                            <div
                              key={r.id}
                              className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-amber-500/40 transition-all flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-white truncate">{r.name || r.id}</span>
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                                    #{r.id}
                                  </span>
                                  {live && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shrink-0 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                      {live.mapName} • CT {live.scoreCT}×{live.scoreTR} TR • R{live.roundNumber}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${c >= 10 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0">{c}/10</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {live && onSpectateRoom && (
                                  <button
                                    type="button"
                                    onClick={() => triggerAction(() => onSpectateRoom(r))}
                                    title="Abrir Espectador Ao Vivo (GSI)"
                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Eye size={12} />
                                    <span className="hidden sm:inline">Assistir</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCreateMix(r.id)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider cursor-pointer shrink-0 transition-colors"
                                >
                                  Entrar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => triggerAction(onOpenRoomsHub)}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
                        >
                          Central de Salas / Criar ➔
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerAction(onOpenLeaderboard)}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Trophy size={13} />
                          <span>Ver Ranking</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Rich 5v5 Mathematical Balance HUD Preview */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                            ⚖️ Preview • Equilíbrio 5v5
                          </span>
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
                            Δ 0.0 LVL • 99.8% JUSTO
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {/* CT Team */}
                          <div className="p-3 rounded-2xl bg-sky-500/[0.07] border border-sky-500/30 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-black font-heading text-sky-300 uppercase tracking-wider">
                                Time CT
                              </span>
                              <span className="text-[10px] font-mono font-bold text-sky-200 bg-sky-500/20 px-1.5 py-0.5 rounded">
                                Média 16.2
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {DEMO_CT_LEVELS.map((lvl, idx) => (
                                <span
                                  key={`ct-${idx}`}
                                  className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-sky-500/30 text-[10px] font-mono font-bold text-sky-300"
                                >
                                  LVL {lvl}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* TR Team */}
                          <div className="p-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/30 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-black font-heading text-amber-300 uppercase tracking-wider">
                                Time TR
                              </span>
                              <span className="text-[10px] font-mono font-bold text-amber-200 bg-amber-500/20 px-1.5 py-0.5 rounded">
                                Média 16.2
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {DEMO_TR_LEVELS.map((lvl, idx) => (
                                <span
                                  key={`tr-${idx}`}
                                  className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300"
                                >
                                  LVL {lvl}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 4-Step Pipeline */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                          {[
                            { n: '01', label: 'Lobby & Duos' },
                            { n: '02', label: 'Sorteio GC' },
                            { n: '03', label: 'Veto Oficial' },
                            { n: '04', label: 'Connect & GSI' },
                          ].map((step) => (
                            <div
                              key={step.n}
                              className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/90 text-center"
                            >
                              <div className="text-[9px] font-mono font-black text-amber-400">{step.n}</div>
                              <div className="text-[10px] font-semibold text-slate-200 leading-tight mt-0.5">{step.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCreateMix('MIX-PRO')}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Zap size={14} />
                          <span>Abrir Lobby 5v5</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerAction(onOpenLeaderboard)}
                          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/50 text-white font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Trophy size={14} className="text-amber-400" />
                          <span>Ver Ranking</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Diagrammed 4-Card Metrics Strip */}
      <section className="bg-[#0a0f1c]/85 border-b border-white/[0.08] py-6">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricsCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.value}
                className="p-4 rounded-2xl bg-[#0d1424]/90 border border-white/[0.07] hover:border-white/[0.15] transition-all flex items-center gap-3.5 shadow-lg"
              >
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${card.accent}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-black font-heading text-white tracking-wide leading-tight truncate">
                    {card.value}
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-tight truncate">
                    {card.label}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {card.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Official & Extra Map Pool Section — Symmetric 4-Col Grid */}
      <section id="mapas" className="max-w-[1360px] mx-auto px-4 sm:px-6 py-16 sm:py-20 w-full">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="space-y-2.5 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
              Pool Oficial & Reserva CS2
            </div>
            <h2 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-wide text-balance">
              Mapas Oficiais do <span className="text-amber-400">Counter-Strike 2</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Capturas reais direto do jogo com insígnias oficiais da Valve e acesso rápido ao simulador de veto e playbook de granadas.
            </p>
          </div>

          {/* Right Controls: Source + Sync + Tabs */}
          <div className="flex flex-col items-center lg:items-end gap-2.5">
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Fonte:</span>
                <strong className="text-amber-300 font-medium">
                  {officialRotation?.source || 'Wikipedia / Valve Esports Records'}
                </strong>
              </div>

              {onSyncOfficialRotation && (
                <button
                  type="button"
                  disabled={syncingRotation}
                  onClick={() => triggerAction(onSyncOfficialRotation)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Buscar e sincronizar rotação oficial mundial em tempo real"
                >
                  <RefreshCw size={12} className={syncingRotation ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                  <span>{syncingRotation ? 'Sincronizando...' : 'Sincronizar Rotação'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setMapTab('active');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                  mapTab === 'active'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <Trophy size={13} />
                <span>Rotação Oficial ({activeDutyMaps.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setMapTab('extra');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                  mapTab === 'extra'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg shadow-sky-500/25'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <Sparkles size={13} />
                <span>Mapas Extras ({extraMaps.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Strict 4-Column Symmetric Map Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {currentDisplayMaps.map((map) => (
            <div
              key={map.id}
              className="relative overflow-hidden rounded-2xl border border-white/[0.1] hover:border-amber-400/80 bg-slate-950 shadow-2xl min-h-[250px] flex flex-col justify-between p-4 group transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 opacity-75"
                style={{ backgroundImage: `url(${map.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/20" />

              {/* Header */}
              <div className="relative z-10 flex items-start justify-between gap-2">
                <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full shadow flex items-center gap-1 border ${
                  map.activeDuty
                    ? 'bg-slate-900/90 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900/90 text-sky-300 border-sky-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${map.activeDuty ? 'bg-amber-400' : 'bg-sky-400'}`} />
                  {map.activeDuty ? 'Active Duty' : map.category === 'hostage' ? 'Reféns' : 'Reserva CS2'}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-200 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800">
                  {map.file}
                </span>
              </div>

              {/* Body & Interactive Quick Actions */}
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={map.logo}
                    alt={map.name}
                    className="w-12 h-12 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] filter brightness-110 group-hover:scale-110 transition-transform shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xl font-black font-heading text-white tracking-wider drop-shadow-md truncate">
                      {map.name}
                    </h3>
                    <span className="text-xs text-slate-300 font-medium block truncate">
                      {map.location}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/[0.1]">
                  <button
                    type="button"
                    onClick={() => triggerAction(onOpenQuickVeto)}
                    className="py-1.5 px-2 rounded-lg bg-slate-950/85 hover:bg-sky-500/25 border border-white/[0.1] hover:border-sky-400/50 text-[11px] font-bold text-slate-200 hover:text-sky-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Zap size={12} className="text-sky-400" />
                    <span>Veto</span>
                  </button>
                  {onOpenGrenades ? (
                    <button
                      type="button"
                      onClick={() => triggerAction(onOpenGrenades)}
                      className="py-1.5 px-2 rounded-lg bg-slate-950/85 hover:bg-teal-500/25 border border-white/[0.1] hover:border-teal-400/50 text-[11px] font-bold text-slate-200 hover:text-teal-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <BookOpen size={12} className="text-teal-400" />
                      <span>Smokes</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => triggerAction(onOpenQuickMapRoll)}
                      className="py-1.5 px-2 rounded-lg bg-slate-950/85 hover:bg-amber-500/25 border border-white/[0.1] hover:border-amber-400/50 text-[11px] font-bold text-slate-200 hover:text-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Dices size={12} className="text-amber-400" />
                      <span>Roleta</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 8th Symmetry Filler Card — Eliminates Orphan Row on Active Duty (7 Maps) */}
          {showMapsFillerCard && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-[#0f172a] via-[#131b2e] to-amber-950/40 shadow-2xl min-h-[250px] flex flex-col justify-between p-5">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 space-y-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-mono font-bold uppercase">
                  <Dices size={11} />
                  <span>Decisão Rápida</span>
                </span>
                <h3 className="text-xl font-black font-heading text-white leading-tight">
                  Central de Sorteio & Pick/Ban
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sem quórum completo para sala? Faça um Pick & Ban completo ou gire a roleta 3D instantânea agora mesmo.
                </p>
              </div>

              <div className="relative z-10 space-y-2 pt-3">
                <button
                  type="button"
                  onClick={() => triggerAction(onOpenQuickVeto)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Zap size={13} />
                  <span>Abrir Veto (MD1/MD3/MD5)</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerAction(onOpenQuickMapRoll)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Dices size={13} className="text-sky-400" />
                  <span>Girar Roleta 3D</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Ecosystem Features Grid — 3x2 Interactive Bento Cards */}
      <section id="recursos" className="max-w-[1360px] mx-auto px-4 sm:px-6 py-16 sm:py-20 w-full border-t border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-bold uppercase tracking-wider">
            Ecossistema Completo 5v5
          </div>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-wide text-balance">
            Tudo Para Seu Mix Competitivo em Um Só Lugar
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 text-balance">
            Da organização da fila e sorteio balanceado até o servidor dedicado, replay de stats via GSI e integração total com Discord.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ecosystemFeatures.map((feat) => {
            const Icon = feat.icon;
            const t = SHORTCUT_THEMES[feat.theme] || SHORTCUT_THEMES.amber;
            return (
              <div
                key={feat.id}
                onClick={() => triggerAction(feat.onClick)}
                className={`glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between gap-4 cursor-pointer group ${t.card}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${t.iconBox}`}>
                      <Icon size={21} />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-950/90 border border-white/[0.08] text-slate-300">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className={`font-bold text-base font-heading text-white tracking-wide transition-colors ${t.titleHover}`}>
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-white">
                  <span>{feat.cta}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform text-amber-400" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Unified 12-Col Showcase: Discord Bot (7 cols) + CS2 Patch Radar & Practice (5 cols) */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 pb-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Discord Bot Showcase (7 cols) */}
          <div className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/85 via-[#0d1425] to-purple-950/75 border border-indigo-500/35 p-6 sm:p-8 shadow-2xl flex flex-col justify-between gap-6">
            <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Bot size={14} />
                <span>Bot Oficial de Mix 5v5 para Discord</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black font-heading text-white tracking-wide leading-tight">
                Adicione o Bot ao seu Servidor do Discord
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Organize partidas 5v5 completas sem sair do Discord! Fila automática com botões interativos, balanceamento inteligente por nível Gamers Club (1 a 21), veto MD1/MD3 oficial, movimentação nas calls CT/TR, patentes automáticas e radar de ofertas verificado.
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Check size={15} /> 100% Gratuito
                </div>
                <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                  <Check size={15} /> 39 Slash Commands
                </div>
                <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                  <Check size={15} /> Valve GSI Integrado
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-3 pt-2">
              <a
                href={buildDiscordBotInviteUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEnabled && playClickSound()}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              >
                <Bot size={17} />
                <span>Adicionar ao Discord</span>
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                onClick={() => triggerAction(onOpenDiscordModal)}
                className="px-4 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-indigo-200 border border-indigo-500/35 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck size={15} className="text-amber-400" />
                <span>Como Configurar</span>
              </button>

              {onOpenServersPage && (
                <button
                  type="button"
                  onClick={() => triggerAction(() => onOpenServersPage('integracao'))}
                  className="px-4 py-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plug size={15} className="text-emerald-400" />
                  <span>Integração Servidor Privado</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): CS2 Patch Radar + Quick Training */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-5">
            {onOpenUpdatesPage && (
              <div className="flex-1 relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-950/55 via-[#0d1424] to-amber-950/40 border border-orange-500/35 p-6 shadow-2xl flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 text-[11px] font-bold uppercase tracking-wider">
                    <Newspaper size={13} />
                    <span>Radar Valve PT-BR • Atualizações CS2</span>
                  </div>
                  <h3 className="text-xl font-black font-heading text-white leading-snug">
                    {latestPatch?.title || 'Notas Oficiais do Counter-Strike 2 em Português'}
                  </h3>
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {latestPatch?.formattedNotes
                      ? String(latestPatch.formattedNotes).replace(/__\*\*(.+?)\*\*__/g, '$1 — ')
                      : 'Acompanhe todas as notas de atualização da Valve traduzidas automaticamente para PT-BR, preservando nomes de mapas, armas e termos competitivos.'}
                  </p>
                  {latestPatch?.formattedDate && (
                    <p className="text-[11px] font-mono text-amber-300/90">
                      📅 {latestPatch.formattedDate} (Brasília)
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => triggerAction(onOpenUpdatesPage)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <Newspaper size={15} />
                  <span>Ver Notas de Atualização</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Quick Warmup / Tools Compact Card */}
            <div className="rounded-3xl bg-[#0d1424]/95 border border-white/[0.1] p-5 shadow-xl flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[11px] font-mono font-bold uppercase text-teal-300 flex items-center gap-1.5">
                  <Target size={13} />
                  <span>Pré-Mix & Aquecimento</span>
                </div>
                <div className="text-sm font-black font-heading text-white">
                  Aqueça a mira ou estude smokes antes da fila fechar
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto lg:w-full xl:w-auto">
                {onOpenAimReflex && (
                  <button
                    type="button"
                    onClick={() => triggerAction(onOpenAimReflex)}
                    className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-orange-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Treinar Mira
                  </button>
                )}
                {onOpenGrenades && (
                  <button
                    type="button"
                    onClick={() => triggerAction(onOpenGrenades)}
                    className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/35 text-teal-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Granadas
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="bg-gradient-to-r from-amber-500/10 via-[#0d1425] to-sky-500/10 border-y border-amber-500/20 py-16 px-4 text-center">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 space-y-5">
          <h2 className="text-3xl sm:text-5xl font-black font-heading text-white tracking-wide">
            Pronto para Dominar o Servidor?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Crie sua sala agora mesmo, compartilhe o link com o time no Discord e comece o 5v5 em menos de 1 minuto.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => triggerAction(onOpenRoomsHub)}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-amber-500/30 cursor-pointer inline-flex items-center gap-2 active:scale-95"
            >
              <Play size={16} fill="currentColor" />
              <span>Criar Mix Agora</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => triggerAction(onOpenLeaderboard)}
              className="px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-white font-bold text-sm uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Trophy size={16} className="text-amber-400" />
              <span>Ver Hall da Fama</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#060911] py-10 text-xs text-slate-400">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <MixHubLogo className="w-8 h-8 shrink-0" />
            <div className="text-left">
              <div className="font-heading font-black text-white tracking-wider text-sm">CS2 MIX HUB</div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Plataforma Online • Bot Discord + Web Sync</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap text-[11px] font-semibold">
            <button type="button" onClick={() => triggerAction(onOpenRoomsHub)} className="hover:text-amber-400 transition-colors cursor-pointer">Salas Abertas</button>
            <button type="button" onClick={() => triggerAction(onOpenLeaderboard)} className="hover:text-amber-400 transition-colors cursor-pointer">Hall da Fama</button>
            <button type="button" onClick={() => triggerAction(onOpenDiscordModal)} className="hover:text-amber-400 transition-colors cursor-pointer">Bot Discord</button>
            {onOpenTournament && (
              <button type="button" onClick={() => triggerAction(onOpenTournament)} className="hover:text-amber-400 transition-colors cursor-pointer">Torneios</button>
            )}
            {onOpenServersPage && (
              <button type="button" onClick={() => triggerAction(() => onOpenServersPage())} className="hover:text-amber-400 transition-colors cursor-pointer">Servidores & LAN</button>
            )}
            {onOpenUpdatesPage && (
              <button type="button" onClick={() => triggerAction(onOpenUpdatesPage)} className="hover:text-amber-400 transition-colors cursor-pointer">Atualizações CS2</button>
            )}
          </div>

          <div className="text-center md:text-right text-[11px] text-slate-500">
            Rotação Oficial Valve Active Duty • Não afiliado à Valve Corporation.
          </div>
        </div>
      </footer>
    </div>
  );
}
