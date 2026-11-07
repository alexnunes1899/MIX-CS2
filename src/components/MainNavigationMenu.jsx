import React from 'react';
import { Home, Trophy, Bell, Dices, Zap, Server, Layers } from 'lucide-react';
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
  activeRoomsCount = 0,
  soundEnabled = true,
  className = '',
}) {
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
      title: 'Página Inicial do Mix Hub',
      iconColor: 'text-amber-400',
    },
    {
      id: 'hall',
      label: 'Hall da Fama',
      icon: Trophy,
      action: onOpenLeaderboard,
      title: 'Ranking da Comunidade e Hall da Fama',
      iconColor: 'text-amber-400',
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: Bell,
      action: onOpenDiscordModal,
      title: 'Alertas Automáticos no Discord',
      iconColor: 'text-indigo-400',
    },
    {
      id: 'roleta',
      label: 'Roleta de Mapa',
      icon: Dices,
      action: onOpenQuickMapRoll,
      title: 'Sorteador Rápido de Mapas Oficiais Valve',
      iconColor: 'text-amber-400',
    },
    {
      id: 'veto',
      label: 'Veto Rápido',
      icon: Zap,
      action: onOpenQuickVeto,
      title: 'Pick & Ban Oficial CS2 (MD1 / MD3 / MD5)',
      iconColor: 'text-sky-400',
    },
    {
      id: 'servers',
      label: 'Servidores & LAN',
      icon: Server,
      action: onOpenServersPage,
      title: 'Central de Servidores CS2: Dedicado, LAN e Radmin VPN',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'salas',
      label: 'Salas',
      icon: Layers,
      action: onOpenRoomsHub,
      title: 'Ver e Criar Salas de Mix',
      iconColor: 'text-slate-300',
      badge: activeRoomsCount,
    },
  ];

  return (
    <div className={`flex items-center justify-center w-full ${className}`}>
      <nav
        aria-label="Menu Principal"
        className="inline-flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-[#080d19]/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl overflow-x-auto no-scrollbar max-w-full px-2"
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
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-bold tracking-wide flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 select-none ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-lg shadow-amber-500/10 font-extrabold ring-1 ring-amber-500/30'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/40 hover:border-slate-600 shadow-sm active:scale-95'
              }`}
            >
              <Icon size={15} className={`${isActive ? 'text-amber-300' : item.iconColor} shrink-0 transition-transform group-hover:scale-110`} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full border ${
                    item.badge > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
