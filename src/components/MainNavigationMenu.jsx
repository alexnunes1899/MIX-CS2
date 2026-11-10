import React, { useRef, useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function MainNavigationMenu({
  activeTab = '',
  onGoHome,
  onOpenLeaderboard,
  onOpenDiscordModal,
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
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [activeRoomsCount]);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      if (soundEnabled) playClickSound();
      const scrollAmount = 240;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleWheel = (e) => {
    if (scrollRef.current && e.deltaY !== 0 && scrollRef.current.scrollWidth > scrollRef.current.clientWidth) {
      scrollRef.current.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  const handleClick = (action) => {
    if (soundEnabled) playClickSound();
    if (action) action();
  };

  const navItems = [
    {
      id: 'inicio',
      label: 'Início',
      icon: Home,
      action: onGoHome,
      title: 'Página Inicial do CS2 Mix Hub',
      iconColor: 'text-amber-400',
    },
    {
      id: 'salas',
      label: 'Salas',
      icon: Layers,
      action: onOpenRoomsHub,
      title: 'Salas e Lobbies da Comunidade',
      iconColor: 'text-sky-400',
      badge: activeRoomsCount,
    },
    {
      id: 'torneio',
      label: 'Torneio',
      icon: Swords,
      action: onOpenTournament,
      title: 'Modo Torneio & Chaveamento Profissional',
      iconColor: 'text-purple-400',
    },
    {
      id: 'veto',
      label: 'Pick & Ban',
      icon: Zap,
      action: onOpenQuickVeto,
      title: 'Pick & Ban Oficial CS2 (MD1, MD3, MD5)',
      iconColor: 'text-amber-400',
    },
    {
      id: 'servers',
      label: 'Servidores',
      icon: Server,
      action: onOpenServersPage,
      title: 'Servidores Dedicados, LAN 0ms e Radmin VPN',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'granadas',
      label: 'Granadas',
      icon: BookOpen,
      action: onOpenGrenades,
      title: 'Playbook de Smokes e Táticas CS2',
      iconColor: 'text-teal-400',
    },
    {
      id: 'mira',
      label: 'Aquecer Mira',
      icon: Target,
      action: onOpenAimReflex,
      title: 'Treino de Mira, Reflexo e Grid Aim',
      iconColor: 'text-orange-400',
    },
    {
      id: 'roleta',
      label: 'Roleta',
      icon: Dices,
      action: onOpenQuickMapRoll,
      title: 'Sorteador Rápido de Mapas Oficiais Valve',
      iconColor: 'text-yellow-400',
    },
    {
      id: 'hall',
      label: 'Ranking',
      icon: Trophy,
      action: onOpenLeaderboard,
      title: 'Hall da Fama e Estatísticas dos Jogadores',
      iconColor: 'text-amber-400',
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: Bell,
      action: onOpenDiscordModal,
      title: 'Bot e Alertas Oficiais no Discord',
      iconColor: 'text-indigo-400',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageCircle,
      action: () => window.open('/whatsapp', '_blank'),
      title: 'Bot do WhatsApp para Grupos (Avisos de Mix)',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div className={`relative flex items-center justify-center w-full max-w-full group ${className}`}>
      {/* Outer Shell: Clean, unified low-profile esports rail */}
      <div className="relative flex items-center w-full max-w-full justify-center">
        {/* Left Scroll Button (appears when content overflows on smaller screens) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900/95 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-lg hover:bg-slate-800 transition-all cursor-pointer backdrop-blur-md"
            title="Rolar menu para a esquerda"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Left Edge Fade Mask */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#070b15] to-transparent pointer-events-none z-10 rounded-l-2xl" />
        )}

        {/* Navigation Rail Container */}
        <nav
          ref={scrollRef}
          onScroll={checkScroll}
          onWheel={handleWheel}
          aria-label="Menu Principal"
          className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-[#070b15]/95 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 rounded-2xl shadow-xl overflow-x-auto no-scrollbar scroll-smooth w-full md:w-auto max-w-full px-1.5 sm:px-2 transition-colors"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClick(item.action)}
                title={item.title}
                className={`relative px-2 lg:px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-xl text-[11px] lg:text-xs xl:text-[13px] font-bold tracking-tight xl:tracking-normal flex items-center gap-1 lg:gap-1.5 xl:gap-2 transition-all cursor-pointer shrink-0 select-none whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent hover:border-slate-700/60'
                }`}
              >
                <Icon
                  size={13}
                  className={`${
                    isActive ? 'text-amber-300' : item.iconColor
                  } shrink-0 transition-transform group-hover:scale-110 lg:w-3.5 lg:h-3.5 xl:w-4 xl:h-4`}
                />
                <span>{item.label}</span>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full border ${
                      item.badge > 0
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Edge Fade Mask */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#070b15] to-transparent pointer-events-none z-10 rounded-r-2xl" />
        )}

        {/* Right Scroll Button (appears when content overflows on smaller screens) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900/95 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-lg hover:bg-slate-800 transition-all cursor-pointer backdrop-blur-md"
            title="Rolar menu para a direita"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
