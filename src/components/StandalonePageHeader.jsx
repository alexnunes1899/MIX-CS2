import React from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import MainNavigationMenu from './MainNavigationMenu';
import MixHubLogo from './MixHubLogo';

export default function StandalonePageHeader({
  activeTab = '',
  badgeLabel = 'HUB',
  subtitle = '5V5 COMPETITIVO',
  roomId = '',
  onGoHome,
  onGoToRoom,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenRoomsHub,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenTournament,
  onOpenGrenades,
  onOpenAimReflex,
  onOpenServersPage,
  onOpenUpdatesPage,
  activeRoomsCount = 0,
  soundEnabled = true,
  onToggleSound,
}) {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const navProps = {
    activeTab,
    onGoHome,
    onOpenLeaderboard: activeTab === 'hall' ? scrollToTop : onOpenLeaderboard,
    onOpenDiscordModal,
    onOpenQuickMapRoll,
    onOpenQuickVeto,
    onOpenServersPage: activeTab === 'servers' ? scrollToTop : onOpenServersPage,
    onOpenUpdatesPage: activeTab === 'updates' ? scrollToTop : onOpenUpdatesPage,
    onOpenRoomsHub,
    onOpenTournament: activeTab === 'torneio' ? scrollToTop : onOpenTournament,
    onOpenGrenades: activeTab === 'granadas' ? scrollToTop : onOpenGrenades,
    onOpenAimReflex,
    activeRoomsCount,
    soundEnabled,
  };

  return (
    <header className="border-b border-slate-800/80 bg-[#070b15]/95 backdrop-blur-xl sticky top-0 z-40 shadow-2xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 sm:h-20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div
            onClick={onGoHome}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <MixHubLogo className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                  MIX HUB
                </span>
                <span className="text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono uppercase">
                  {badgeLabel}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono uppercase">{subtitle}</p>
            </div>
          </div>

          {onGoToRoom && roomId && (
            <button
              type="button"
              onClick={() => onGoToRoom(roomId)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Voltar para o Mix ({roomId})</span>
              <span className="sm:hidden">Voltar</span>
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center justify-center flex-1 min-w-0 px-2">
          <MainNavigationMenu {...navProps} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                soundEnabled
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700/60'
              }`}
              title={soundEnabled ? 'Sons Ativados' : 'Sons Silenciados'}
            >
              {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-slate-400" />}
              <span className="hidden xl:inline text-[11px] font-bold">{soundEnabled ? 'Som Ativo' : 'Sem Som'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden border-t border-slate-800/80 px-2 py-1.5 bg-[#070b15]/98 flex items-center justify-center">
        <MainNavigationMenu {...navProps} />
      </div>
    </header>
  );
}
