import React, { useState } from 'react';
import { Share2, Check, Users, Swords, MapPin, Trophy, Volume2, VolumeX, Layers, History, Dices, Zap, Home, Server, Laptop, Play, Copy, User, Trash2, Lock, KeyRound, Eye, EyeOff, Globe, Bell } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import DeleteRoomModal from './DeleteRoomModal';
import { playClickSound } from '../utils/audio';
import { parseServerDetails } from '../utils/serverParser';

export default function Header({
  roomId,
  roomName,
  phase,
  rankingSystem = 'gc',
  serverIp = '',
  myProfile,
  onOpenProfile,
  onDeleteRoom,
  soundEnabled,
  setSoundEnabled,
  onOpenRoomsHub,
  onOpenHistory,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenLocalHost,
  onOpenServersPage,
  onGoHome,
  roomPassword = '',
  hasPassword = false,
  isPrivate = false,
  inviteKey = '',
}) {
  const [copied, setCopied] = useState(false);
  const [copiedServer, setCopiedServer] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showHeaderPassword, setShowHeaderPassword] = useState(false);

  const parsedServer = parseServerDetails(serverIp);

  const copyInviteLink = () => {
    if (soundEnabled) playClickSound();
    const url = new URL(window.location.origin);
    url.searchParams.set('room', roomId);
    if (isPrivate && inviteKey) {
      url.searchParams.set('key', inviteKey);
    }
    if (roomPassword) {
      url.searchParams.set('pwd', roomPassword);
    }
    navigator.clipboard.writeText(url.toString());
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
    <header className="border-b border-slate-800 bg-[#0c1220] sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 space-y-2.5">
        
        {/* ROW 1: Room Identity & Quick Utility Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Logo & Room Details */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img
                src="/favicon.png"
                alt="CS2 Mix"
                className="w-10 h-10 object-contain drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)] hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black font-heading tracking-wide text-white">
                  {roomName || 'MIX HUB'}
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    rankingSystem === 'faceit'
                      ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  {rankingSystem === 'faceit' ? '⚡ FACEIT' : '🛡️ GC'}
                </span>
                {isPrivate ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-purple-400 bg-purple-500/15 border-purple-500/30 flex items-center gap-1 font-mono">
                    <Lock size={10} /> Privado
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/15 border-emerald-500/30 flex items-center gap-1 font-mono">
                    <Globe size={10} /> Mix Público
                  </span>
                )}
                {(hasPassword || roomPassword) && (
                  <button
                    type="button"
                    onClick={() => setShowHeaderPassword(!showHeaderPassword)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-amber-300 bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25 flex items-center gap-1 font-mono cursor-pointer transition-colors"
                    title={roomPassword ? 'Clique para mostrar/ocultar senha' : 'Sala protegida com senha'}
                  >
                    <Lock size={10} />
                    <span>PIN: {roomPassword ? (showHeaderPassword ? roomPassword : '••••') : 'Ativo'}</span>
                    {roomPassword && (showHeaderPassword ? <EyeOff size={10} className="opacity-70" /> : <Eye size={10} className="opacity-70" />)}
                  </button>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">
                {rankingSystem === 'faceit' ? 'Balanceamento por Nível FACEIT & Pick/Ban' : 'Balanceamento por Nível Gamers Club & Pick/Ban'}
              </p>
            </div>
          </div>

          {/* Right: Steam Profile, Server Pill, Share Invite & Sound Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Server Action if Configured */}
            {parsedServer.isValid && (
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-emerald-500/30 rounded-xl p-1 pl-2.5 shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono text-emerald-400 font-bold truncate max-w-[130px]" title={parsedServer.ip}>
                  {parsedServer.ip}
                </span>
                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    navigator.clipboard.writeText(parsedServer.connectCommand);
                    setCopiedServer(true);
                    setTimeout(() => setCopiedServer(false), 2000);
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  title="Copiar comando connect"
                >
                  {copiedServer ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedServer ? 'Copiado' : 'Connect'}</span>
                </button>
                {parsedServer.steamUrl && (
                  <a
                    href={parsedServer.steamUrl}
                    className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                    title="Conectar automaticamente ao CS2"
                  >
                    <Play size={10} fill="currentColor" /> CS2
                  </a>
                )}
              </div>
            )}

            {/* Room Code, PIN & Invite button */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 pl-2.5 shadow-inner">
              <div className="text-xs mr-2 font-mono flex items-center gap-1.5">
                <span className="text-slate-500 text-[10px] font-semibold">SALA:</span>{' '}
                <span className="font-bold text-amber-400">{roomId}</span>
              </div>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                title="Copiar link de convite com acesso direto sem senha"
              >
                {copied ? <Check size={14} className="text-slate-950" /> : <Share2 size={14} />}
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
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
                title="Ver meu perfil, estatísticas e gerenciar conta Steam"
              >
                <PlayerAvatar avatar={myProfile.avatar} nick={myProfile.nick} size="sm" />
                <span className="truncate max-w-[85px] hidden sm:inline font-bold">{myProfile.nick}</span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">
                  Stats
                </span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/50 cursor-pointer"
              title={soundEnabled ? 'Silenciar Sons' : 'Ativar Sons'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Delete Room Button (Admin) */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setDeleteConfirmOpen(true);
              }}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              title="Excluir permanentemente esta sala de mix"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* ROW 2: O MENU PRINCIPAL — CENTRALIZADO, MAIOR E COM DESTAQUE ESPORTS */}
        <div className="pt-1 flex items-center justify-center w-full">
          <nav className="inline-flex items-center gap-1.5 sm:gap-2.5 p-1.5 bg-[#080d19] border border-slate-700/80 rounded-2xl shadow-2xl overflow-x-auto max-w-full no-scrollbar">
            
            {/* Início */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onGoHome();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-600/90 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Voltar para a Página Inicial"
            >
              <Home size={17} className="text-amber-400" />
              <span>Início</span>
            </button>

            {/* Hall da Fama */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onOpenLeaderboard) onOpenLeaderboard();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/60 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-lg shadow-amber-500/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Hall da Fama & Ranking Geral da Comunidade"
            >
              <Trophy size={17} className="text-amber-400" />
              <span>Hall da Fama</span>
            </button>

            {/* Discord */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onOpenDiscordModal) onOpenDiscordModal();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/60 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-lg shadow-indigo-500/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Notificações Automáticas no Discord"
            >
              <Bell size={17} className="text-indigo-400" />
              <span>Discord</span>
            </button>

            {/* Roleta de Mapa */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenQuickMapRoll();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/60 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Sortear um mapa aleatório rapidamente entre a rotação da Valve"
            >
              <Dices size={17} className="text-amber-400" />
              <span>Roleta de Mapa</span>
            </button>

            {/* Veto Rápido */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenQuickVeto();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-sky-200 border border-sky-500/60 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Ir direto para o veto de mapas se os times já estiverem formados"
            >
              <Zap size={17} className="text-sky-400" />
              <span>Veto Rápido</span>
            </button>

            {/* Central Completa de Servidores (Dedicado, LAN, Radmin, Testador de Portas) */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                if (onOpenServersPage) onOpenServersPage();
                else if (onOpenLocalHost) onOpenLocalHost();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 text-emerald-300 hover:text-white border border-emerald-500/60 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-lg shadow-emerald-500/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Central Completa de Servidores: Dedicado Online, LAN Party 0ms, Radmin VPN, Teste de Portas 27015 e Gerador de Scripts .bat"
            >
              <Server size={17} className="text-emerald-400" />
              <span>Servidores & LAN</span>
            </button>

            {/* Salas */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onOpenRoomsHub();
              }}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-600/90 text-xs sm:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Ver todas as salas ativas ou criar um novo mix"
            >
              <Layers size={17} className="text-slate-300" />
              <span>Salas</span>
            </button>

          </nav>
        </div>

        {/* ROW 3: Compact Phase Stepper */}
        <div className="hidden sm:flex items-center justify-center gap-2 pt-1 border-t border-slate-800/40">
          {steps.map((st, idx) => {
            const status = getStepStatus(st.id);
            const Icon = st.icon;
            return (
              <div key={st.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                    status === 'active'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'
                  }`}
                >
                  <Icon size={12} />
                  <span>{st.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <span className="text-slate-700 text-[10px]">➔</span>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Delete Room Confirmation Modal */}
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
    </header>
  );
}
