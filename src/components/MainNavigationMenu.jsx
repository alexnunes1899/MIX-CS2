import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Trophy,
  Bell,
  Dices,
  Zap,
  Server,
  Layers,
  BookOpen,
  Target,
  Swords,
  MessageCircle,
  ChevronDown,
  Sparkles,
  MoreHorizontal,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function MainNavigationMenu({
  activeTab = '',
  onGoHome,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenWhatsAppModal,
  onOpenQuickMapRoll,
  onOpenQuickVeto,
  onOpenServersPage,
  onOpenRoomsHub,
  onOpenTournament,
  onOpenGrenades,
  onOpenAimReflex,
  activeRoomsCount = 0,
  soundEnabled = true,
  className = '',
  includeBrandIntegrations = false,
}) {
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tacticsRef = useRef(null);
  const moreRef = useRef(null);
  const mobileRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (tacticsRef.current && !tacticsRef.current.contains(e.target)) {
        setTacticsOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleClick = (action) => {
    if (soundEnabled) playClickSound();
    if (action) action();
    setTacticsOpen(false);
    setMoreOpen(false);
    setMobileMenuOpen(false);
  };

  const handleWhatsAppClick = () => {
    if (soundEnabled) playClickSound();
    if (onOpenWhatsAppModal) {
      onOpenWhatsAppModal();
    } else {
      window.open('/whatsapp', '_blank');
    }
    setMobileMenuOpen(false);
    setMoreOpen(false);
  };

  const isTacticsActive = ['granadas', 'mira', 'roleta'].includes(activeTab);

  // Core Main Game Tabs
  const primaryTabs = [
    {
      id: 'inicio',
      label: 'Início',
      shortLabel: 'Início',
      icon: Home,
      action: onGoHome,
      title: 'Página Inicial do CS2 Mix Hub',
      iconColor: 'text-amber-400',
      visibility: 'always',
    },
    {
      id: 'salas',
      label: 'Salas',
      shortLabel: 'Salas',
      icon: Layers,
      action: onOpenRoomsHub,
      title: 'Salas e Lobbies da Comunidade',
      iconColor: 'text-sky-400',
      badge: activeRoomsCount,
      visibility: 'always',
    },
    {
      id: 'veto',
      label: 'Pick & Ban',
      shortLabel: 'Veto',
      icon: Zap,
      action: onOpenQuickVeto,
      title: 'Pick & Ban Oficial CS2 (MD1, MD3, MD5)',
      iconColor: 'text-amber-400',
      visibility: 'always',
    },
    {
      id: 'torneio',
      label: 'Torneio',
      shortLabel: 'Torneio',
      icon: Swords,
      action: onOpenTournament,
      title: 'Modo Torneio & Chaveamento Profissional',
      iconColor: 'text-purple-400',
      visibility: 'xl', // visible on xl (>= 1280px), in Mais ▾ on < 1280px
    },
    {
      id: 'servers',
      label: 'Servidores',
      shortLabel: 'Servers',
      icon: Server,
      action: onOpenServersPage,
      title: 'Servidores Dedicados, LAN 0ms e Radmin VPN',
      iconColor: 'text-emerald-400',
      visibility: 'xl', // visible on xl (>= 1280px), in Mais ▾ on < 1280px
    },
    {
      id: 'hall',
      label: 'Ranking',
      shortLabel: 'Rank',
      icon: Trophy,
      action: onOpenLeaderboard,
      title: 'Hall da Fama e Estatísticas dos Jogadores',
      iconColor: 'text-amber-400',
      visibility: 'always',
    },
  ];

  // Tactics & Practice Submenu
  const tacticsTabs = [
    {
      id: 'granadas',
      label: 'Granadas & Smokes',
      subtitle: 'Playbook tático oficial CS2',
      icon: BookOpen,
      action: onOpenGrenades,
      iconColor: 'text-teal-400',
    },
    {
      id: 'mira',
      label: 'Aquecer Mira',
      subtitle: 'Reflexo & Grid Aim 60s',
      icon: Target,
      action: onOpenAimReflex,
      iconColor: 'text-orange-400',
    },
    {
      id: 'roleta',
      label: 'Roleta de Mapas',
      subtitle: 'Sorteador Valve Active Duty',
      icon: Dices,
      action: onOpenQuickMapRoll,
      iconColor: 'text-yellow-400',
    },
  ];

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {/* Outer Shell: Clean, unified renowned esports navigation rail */}
      <nav
        aria-label="Menu Principal"
        className="flex items-center gap-1 p-1 bg-[#070b15]/95 backdrop-blur-xl border border-slate-800/90 hover:border-slate-700/80 rounded-2xl shadow-xl transition-all shrink-0 whitespace-nowrap"
      >
        {/* DESKTOP / LAPTOP VIEW (>= 768px): Strictly ZERO WRAP Responsive Rail */}
        <div className="hidden md:flex items-center gap-1 flex-nowrap justify-center shrink-0 whitespace-nowrap">
          {/* Primary Game Tabs */}
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const visibilityClass = item.visibility === 'xl' ? 'hidden xl:flex' : 'flex';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClick(item.action)}
                title={item.title}
                className={`relative px-2 xl:px-2.5 py-1.5 rounded-xl text-xs xl:text-[13px] font-bold tracking-tight transition-all cursor-pointer shrink-0 select-none whitespace-nowrap items-center gap-1.5 ${visibilityClass} ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent hover:border-slate-700/60'
                }`}
              >
                <Icon
                  size={14}
                  className={`${isActive ? 'text-amber-300' : item.iconColor} shrink-0 transition-transform group-hover:scale-110`}
                />
                <span className="hidden xl:inline whitespace-nowrap">{item.label}</span>
                <span className="xl:hidden whitespace-nowrap">{item.shortLabel}</span>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full border shrink-0 ${
                      item.badge > 0
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20 animate-pulse'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Tactics & Practice Dropdown */}
          <div className="relative shrink-0" ref={tacticsRef}>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                setTacticsOpen(!tacticsOpen);
                setMoreOpen(false);
              }}
              className={`px-2 xl:px-2.5 py-1.5 rounded-xl text-xs xl:text-[13px] font-bold tracking-tight transition-all cursor-pointer shrink-0 select-none whitespace-nowrap flex items-center gap-1.5 ${
                isTacticsActive || tacticsOpen
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm shadow-teal-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent hover:border-slate-700/60'
              }`}
              title="Ferramentas táticas: Granadas CS2, Aquecer Mira e Roleta"
            >
              <BookOpen size={14} className="text-teal-400 shrink-0" />
              <span className="whitespace-nowrap">Treino</span>
              <ChevronDown
                size={12}
                className={`text-slate-400 transition-transform duration-200 shrink-0 ${tacticsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Tactical Popover Menu */}
            {tacticsOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#0a101d] border border-teal-500/40 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-fadeIn space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400/80 border-b border-slate-800/80 flex items-center justify-between">
                  <span>Ferramentas de Treino</span>
                  <Sparkles size={11} />
                </div>
                {tacticsTabs.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleClick(t.action)}
                      className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        isActive
                          ? 'bg-teal-500/20 text-teal-200 border border-teal-500/30'
                          : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                        <Icon size={16} className={t.iconColor} />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{t.label}</div>
                        <div className="text-[10px] text-slate-400">{t.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overflow "Mais ▾" Dropdown for Medium Screens (< 1280px) */}
          <div className="relative xl:hidden shrink-0" ref={moreRef}>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                setMoreOpen(!moreOpen);
                setTacticsOpen(false);
              }}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer shrink-0 select-none whitespace-nowrap flex items-center gap-1 ${
                moreOpen
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent hover:border-slate-700/60'
              }`}
              title="Mais recursos"
            >
              <MoreHorizontal size={14} className="text-slate-400 shrink-0" />
              <span>Mais</span>
              <ChevronDown
                size={12}
                className={`text-slate-400 transition-transform duration-200 shrink-0 ${moreOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Overflow Dropdown */}
            {moreOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-[#0a101d] border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-fadeIn space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                  Mais Recursos CS2
                </div>

                {/* Torneio (hidden on < 1280px) */}
                <button
                  type="button"
                  onClick={() => handleClick(onOpenTournament)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
                >
                  <Swords size={14} className="text-purple-400" />
                  <span>Torneio & Chaveamento</span>
                </button>

                {/* Servidores (hidden on < 1280px) */}
                <button
                  type="button"
                  onClick={() => handleClick(onOpenServersPage)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
                >
                  <Server size={14} className="text-emerald-400" />
                  <span>Servidores & LAN 0ms</span>
                </button>
              </div>
            )}
          </div>

          {/* Optional Standalone Brand Integrations (Only if explicitly enabled) */}
          {includeBrandIntegrations && (
            <>
              <div className="h-5 w-px bg-slate-800 mx-1 shrink-0" />
              <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleClick(onOpenDiscordModal)}
                  title="Bot e Notificações Oficiais no Discord"
                  className="px-2 xl:px-2.5 py-1.5 rounded-xl text-xs xl:text-[13px] font-bold tracking-tight transition-all cursor-pointer shrink-0 select-none flex items-center gap-1.5 bg-[#5865F2]/15 hover:bg-[#5865F2]/25 text-[#7983f5] hover:text-white border border-[#5865F2]/30 hover:border-[#5865F2]/60 shadow-sm shadow-[#5865F2]/10"
                >
                  <Bell size={14} className="text-[#5865F2]" />
                  <span className="hidden xl:inline">Discord</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-pulse" />
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  title="Bot do WhatsApp para Grupos (Avisos de Mix & Comandos)"
                  className="px-2 xl:px-2.5 py-1.5 rounded-xl text-xs xl:text-[13px] font-bold tracking-tight transition-all cursor-pointer shrink-0 select-none flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/60 shadow-sm shadow-emerald-500/10"
                >
                  <MessageCircle size={14} className="text-emerald-400" />
                  <span className="hidden xl:inline">WhatsApp</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* MOBILE VIEW (< 768px): Streamlined Touch Bar + Unified Drawer */}
        <div className="flex md:hidden items-center justify-between w-full gap-1 px-1">
          <button
            type="button"
            onClick={() => handleClick(onGoHome)}
            className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'inicio' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-slate-300'
            }`}
          >
            <Home size={13} className="text-amber-400" />
            <span>Início</span>
          </button>

          <button
            type="button"
            onClick={() => handleClick(onOpenRoomsHub)}
            className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 relative ${
              activeTab === 'salas' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50' : 'text-slate-300'
            }`}
          >
            <Layers size={13} className="text-sky-400" />
            <span>Salas</span>
            {activeRoomsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleClick(onOpenQuickVeto)}
            className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'veto' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-slate-300'
            }`}
          >
            <Zap size={13} className="text-amber-400" />
            <span>Veto</span>
          </button>

          <button
            type="button"
            onClick={() => handleClick(onOpenLeaderboard)}
            className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'hall' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-slate-300'
            }`}
          >
            <Trophy size={13} className="text-amber-400" />
            <span>Rank</span>
          </button>

          {/* Mobile "Mais ▾" Dropdown */}
          <div className="relative" ref={mobileRef}>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white flex items-center gap-1 border border-slate-700"
            >
              <span>Mais</span>
              <ChevronDown size={12} className={`transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {mobileMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-[#0a101d] border border-slate-700 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 space-y-1 animate-fadeIn">
                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  Ferramentas & Modos
                </div>

                <button
                  type="button"
                  onClick={() => handleClick(onOpenTournament)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                >
                  <Swords size={14} className="text-purple-400" />
                  <span>Torneio & Chaveamento</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClick(onOpenServersPage)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                >
                  <Server size={14} className="text-emerald-400" />
                  <span>Servidores & LAN 0ms</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClick(onOpenGrenades)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                >
                  <BookOpen size={14} className="text-teal-400" />
                  <span>Granadas & Smokes</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClick(onOpenAimReflex)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                >
                  <Target size={14} className="text-orange-400" />
                  <span>Aquecer Mira</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClick(onOpenQuickMapRoll)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                >
                  <Dices size={14} className="text-yellow-400" />
                  <span>Roleta de Mapas</span>
                </button>

                <div className="h-px bg-slate-800 my-1" />

                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Comunidade & Bots
                </div>

                <button
                  type="button"
                  onClick={() => handleClick(onOpenDiscordModal)}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-[#7983f5] hover:bg-[#5865F2]/20 flex items-center gap-2"
                >
                  <Bell size={14} className="text-[#5865F2]" />
                  <span>Bot do Discord</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  className="w-full p-2 rounded-xl text-left text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-2"
                >
                  <MessageCircle size={14} className="text-emerald-400" />
                  <span>Bot do WhatsApp</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
