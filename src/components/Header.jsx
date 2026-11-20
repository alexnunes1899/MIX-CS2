import React, { useState, useRef, useEffect } from 'react';
import { Share2, Check, Users, Swords, MapPin, Trophy, Volume2, VolumeX, Layers, History, Dices, Zap, Home, Server, Copy, Trash2, Lock, Globe, Bell, Menu, BookOpen, Target, Newspaper, ChevronDown } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import DeleteRoomModal from './DeleteRoomModal';
import MixHubLogo from './MixHubLogo';
import { playClickSound } from '../utils/audio';
import { parseServerDetails } from '../utils/serverParser';
import { copyText, buildRoomInviteData } from '../utils/clipboard';

export default function Header({
  roomId,
  roomName,
  phase,
  rankingSystem = 'gc',
  playerCount = 0,
  serverIp = '',
  myProfile,
  isAdmin = false,
  onOpenProfile,
  onDeleteRoom,
  soundEnabled,
  setSoundEnabled,
  onToggleSound,
  activeRoomsCount = 0,
  onOpenRoomsHub,
  onOpenHistory,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenServersPage,
  onOpenUpdatesPage,
  onOpenTournament,
  onOpenGrenades,
  onOpenAimReflex,
  onGoHome,
  roomPassword = '',
  hasPassword = false,
  isPrivate = false,
  inviteKey = '',
}) {
  const [copied, setCopied] = useState(false);
  const [copiedServer, setCopiedServer] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleMenuAction = (fn) => {
    if (soundEnabled) playClickSound();
    setMenuOpen(false);
    if (fn) fn();
  };

  const parsedServer = parseServerDetails(serverIp);

  const copyInviteLink = () => {
    if (soundEnabled) playClickSound();
    const { inviteText } = buildRoomInviteData({
      roomId,
      roomName,
      isPrivate,
      inviteKey,
      rankingSystem,
      playerCount,
    });
    copyText(inviteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { id: 'lobby', label: '1. Lobby', icon: Users },
    { id: 'teams', label: '2. Times', icon: Swords },
    { id: 'veto', label: '3. Veto', icon: MapPin },
    { id: 'finished', label: '4. Jogo', icon: Trophy },
  ];

  const getStepStatus = (stepId) => {
    const order = ['lobby', 'teams', 'captains_draft', 'coin_flip', 'veto', 'side_pick', 'finished'];
    const currentIdx = order.indexOf(phase === 'side_pick' || phase === 'coin_flip' ? 'veto' : phase);
    const stepIdx = order.indexOf(stepId);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <header className="border-b border-slate-800 bg-[#0c1220]/95 backdrop-blur-xl sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 space-y-1.5">
        
        {/* SINGLE FOCUS ROW: Room Identity, Center Match Phase Stepper & Compact Menu + Utility Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Logo & Room Details */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onGoHome) onGoHome();
              }}
              className="shrink-0 cursor-pointer group focus:outline-none"
              title="Voltar para a Página Inicial"
            >
              <MixHubLogo className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-105 transition-transform" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black font-heading tracking-wide text-white truncate max-w-[140px] sm:max-w-[200px]">
                  {roomName || 'MIX HUB'}
                </h1>
                <span
                  className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    rankingSystem === 'faceit'
                      ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  {rankingSystem === 'faceit' ? '⚡ FACEIT' : '🛡️ GC'}
                </span>
                <span
                  className={`text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    playerCount >= 10
                      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
                      : 'text-slate-300 bg-slate-800/80 border-slate-700'
                  }`}
                  title="Jogadores na sala"
                >
                  {playerCount}/10
                </span>
                {isPrivate ? (
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border text-purple-300 bg-purple-500/15 border-purple-500/30 hidden sm:flex items-center gap-1 font-mono">
                    <Lock size={10} /> Privado
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/15 border-emerald-500/30 hidden sm:flex items-center gap-1 font-mono">
                    <Globe size={10} /> Público
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Match Phase Stepper (Sleek eSports Breadcrumb) */}
          <div className="hidden lg:flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-inner">
            {steps.map((st, idx) => {
              const status = getStepStatus(st.id);
              const Icon = st.icon;
              return (
                <div key={st.id} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors ${
                      status === 'active'
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                        : status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-500'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{st.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <span className="text-slate-700 text-xs font-bold">›</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Steam Profile, Server Pill, Share Invite & Sound Controls */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Quick Server Action if Configured */}
            {parsedServer.isValid && (
              <div className="hidden xl:flex items-center gap-1.5 bg-slate-900 border border-emerald-500/30 rounded-xl p-1 pl-2.5 shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono text-emerald-400 font-bold truncate max-w-[120px]" title={parsedServer.ip}>
                  {parsedServer.ip}
                </span>
                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    copyText(parsedServer.connectCommand);
                    setCopiedServer(true);
                    setTimeout(() => setCopiedServer(false), 2000);
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  title="Copiar comando connect"
                >
                  {copiedServer ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedServer ? 'Copiado' : 'Connect'}</span>
                </button>
              </div>
            )}

            {/* Room Code & Invite button */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 pl-2.5 shadow-inner">
              <div className="text-xs mr-2 font-mono flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px] font-semibold">SALA:</span>{' '}
                <span className="font-bold text-amber-400">{roomId}</span>
              </div>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                title="Copiar link de convite com acesso direto sem senha"
              >
                {copied ? <Check size={13} className="text-slate-950" /> : <Share2 size={13} />}
                <span>{copied ? 'Copiado!' : 'Convidar'}</span>
              </button>
            </div>

            {/* Profile & Stats Button in Header */}
            {myProfile?.steamId && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  if (onOpenProfile) onOpenProfile();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
                title="Ver meu perfil, estatísticas e gerenciar conta Steam"
              >
                <PlayerAvatar avatar={myProfile.avatar} nick={myProfile.nick} size="sm" />
                <span className="truncate max-w-[85px] hidden sm:inline font-bold">{myProfile.nick}</span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono hidden sm:inline">
                  Stats
                </span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => {
                if (onToggleSound) onToggleSound();
                else if (setSoundEnabled) setSoundEnabled(!soundEnabled);
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                soundEnabled
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700/60'
              }`}
              title={soundEnabled ? 'Sons Ativados' : 'Sons Silenciados'}
            >
              {soundEnabled ? (
                <Volume2 size={15} className="text-emerald-400" />
              ) : (
                <VolumeX size={15} className="text-slate-400" />
              )}
              <span className="hidden xl:inline text-[11px] font-bold">
                {soundEnabled ? 'Som' : 'Mudo'}
              </span>
            </button>

            {/* Compact Room Hub Dropdown Menu (Replaces bulky 2nd navigation row) */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setMenuOpen((prev) => !prev);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  menuOpen
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/70'
                }`}
                title="Abrir menu de ferramentas e páginas do Mix Hub"
              >
                <Menu size={15} />
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown size={12} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#0a101d] border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-fadeIn space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 flex items-center justify-between">
                    <span>Navegação & Ferramentas</span>
                    {activeRoomsCount > 0 && (
                      <span className="text-emerald-400">{activeRoomsCount} salas</span>
                    )}
                  </div>

                  {[
                    { label: 'Início', icon: Home, color: 'text-amber-400', action: onGoHome },
                    { label: `Salas da Comunidade${activeRoomsCount > 0 ? ` (${activeRoomsCount})` : ''}`, icon: Layers, color: 'text-sky-400', action: onOpenRoomsHub },
                    { label: 'Hall da Fama & Ranking', icon: Trophy, color: 'text-amber-400', action: onOpenLeaderboard },
                    { label: 'Pick & Ban Rápido', icon: Zap, color: 'text-sky-400', action: onOpenQuickVeto },
                    { label: 'Roleta de Mapas', icon: Dices, color: 'text-yellow-400', action: onOpenQuickMapRoll },
                    { label: 'Granadas & Treino LXN', icon: BookOpen, color: 'text-teal-400', action: onOpenGrenades },
                    { label: 'Teste de Reflexo', icon: Target, color: 'text-orange-400', action: onOpenAimReflex },
                    { label: 'Modo Torneio', icon: Swords, color: 'text-purple-400', action: onOpenTournament },
                    { label: 'Servidores & Bot CS2', icon: Server, color: 'text-emerald-400', action: onOpenServersPage },
                    { label: 'Atualizações CS2 (PT-BR)', icon: Newspaper, color: 'text-orange-400', action: onOpenUpdatesPage },
                    { label: 'Central Discord', icon: Bell, color: 'text-indigo-400', action: onOpenDiscordModal },
                    { label: 'Histórico desta Sala', icon: History, color: 'text-slate-300', action: onOpenHistory },
                  ]
                    .filter((item) => typeof item.action === 'function')
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleMenuAction(item.action)}
                          className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-2.5 cursor-pointer"
                        >
                          <Icon size={14} className={`${item.color} shrink-0`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Delete Room Button (Admin) */}
            {isAdmin && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setDeleteConfirmOpen(true);
                }}
                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                title="Excluir permanentemente esta sala de mix"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Phase Stepper (< 1024px) */}
        <div className="flex lg:hidden items-center justify-start sm:justify-center gap-1 pt-1.5 border-t border-slate-800/40 overflow-x-auto no-scrollbar">
          {steps.map((st, idx) => {
            const status = getStepStatus(st.id);
            const Icon = st.icon;
            return (
              <div key={st.id} className="flex items-center gap-1 shrink-0">
                <div
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap ${
                    status === 'active'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/15'
                      : status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'
                  }`}
                >
                  <Icon size={11} />
                  <span>{st.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <span className="text-slate-700 text-[10px] font-bold">›</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Room Confirmation Modal */}
      {isAdmin && (
        <DeleteRoomModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={(targetId) => {
            if (onDeleteRoom) onDeleteRoom(targetId);
            setDeleteConfirmOpen(false);
          }}
          roomId={roomId}
          roomName={roomName}
          soundEnabled={soundEnabled}
        />
      )}
    </header>
  );
}
