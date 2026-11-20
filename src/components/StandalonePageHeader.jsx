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
  rightExtra = null,
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
      <div className="max-w-[1400px] mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div
            onClick={onGoHome}
            className="flex items-center gap-2 cursor-pointer group select-none shrink-0"
          >
            <MixHubLogo className="w-9 h-9 shrink-0" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-base font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                  MIX HUB
                </span>
                <span className="text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono uppercase">
                  {badgeLabel}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono uppercase hidden 2xl:block">{subtitle}</p>
            </div>
          </div>

          {onGoToRoom && roomId && (
            <button
              type="button"
              onClick={() => onGoToRoom(roomId)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white border border-slate-700/80 transition-all cursor-pointer shrink-0"
              title={`Voltar para a sala ${roomId}`}
            >
              <ArrowLeft size={14} className="shrink-0" />
              <span className="hidden lg:inline truncate max-w-[130px]">Mix ({roomId})</span>
              <span className="lg:hidden">Voltar</span>
            </button>
          )}
        </div>

        <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-2">
          <MainNavigationMenu {...navProps} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rightExtra}
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-2 rounded-xl transition-all cursor-pointer border flex items-center justify-center shadow-sm active:scale-95 ${
                soundEnabled
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700/60'
              }`}
              title={soundEnabled ? 'Sons Ativados' : 'Sons Silenciados'}
            >
              {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-slate-400" />}
            </button>
          )}
        </div>
      </div>

      <div className="lg:hidden border-t border-slate-800/80 px-2 py-1.5 bg-[#070b15]/98 flex items-center justify-center">
        <MainNavigationMenu {...navProps} />
      </div>
    </header>
  );
}
