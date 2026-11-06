import React, { useState } from 'react';
import { Share2, Check, Users, Swords, MapPin, Trophy, Volume2, VolumeX, Layers, History, Dices, Zap, Home, Server, Play, Copy, User, Trash2 } from 'lucide-react';
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
  onGoHome,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedServer, setCopiedServer] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const parsedServer = parseServerDetails(serverIp);

  const copyInviteLink = () => {
    if (soundEnabled) playClickSound();
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
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
    <header className="border-b border-slate-800/80 bg-[#0c1220]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo & Room Switcher */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-black text-xl text-black shadow-lg shadow-amber-500/20 tracking-tighter">
                CS2
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold font-heading tracking-wide text-white">
                    {roomName || 'MIX HUB'}
                  </h1>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    rankingSystem === 'faceit'
                      ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  }`}>
                    {rankingSystem === 'faceit' ? '⚡ FACEIT' : '🛡️ GC'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {rankingSystem === 'faceit' ? 'Balanceamento por Nível FACEIT & Pick/Ban' : 'Balanceamento por Nível Gamers Club & Pick/Ban'}
                </p>
              </div>
            </div>

            {/* Quick action buttons on mobile */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={onOpenQuickMapRoll}
                className="p-2 rounded-lg bg-slate-800 text-amber-400 hover:text-white"
                title="Roleta de Mapa Rápido"
              >
                <Dices size={17} />
              </button>
              <button
                onClick={onOpenQuickVeto}
                className="p-2 rounded-lg bg-slate-800 text-sky-400 hover:text-white"
                title="Veto Rápido (Times Prontos)"
              >
                <Zap size={17} />
              </button>
              <button
                onClick={onOpenRoomsHub}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                title="Trocar de Sala / Criar Mix"
              >
                <Layers size={17} />
              </button>
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setDeleteConfirmOpen(true);
                }}
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                title="Excluir esta sala"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>

          {/* Stepper (Desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            {steps.map((st, idx) => {
              const status = getStepStatus(st.id);
              const Icon = st.icon;
              return (
                <div key={st.id} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      status === 'active'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800/60 text-slate-500 border border-slate-700/30'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{st.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <span className="text-slate-700 text-xs">➔</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Room Controls & Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onGoHome();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold transition-all cursor-pointer"
              title="Voltar para a Página Inicial"
            >
              <Home size={14} className="text-amber-400" />
              <span className="hidden sm:inline">Início</span>
            </button>

            {/* Quick Tools */}
            <button
              onClick={onOpenQuickMapRoll}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
              title="Sortear um mapa aleatório rapidamente entre a rotação da Valve"
            >
              <Dices size={14} />
              <span>Roleta de Mapa</span>
            </button>

            <button
              onClick={onOpenQuickVeto}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all cursor-pointer"
              title="Ir direto para o veto de mapas se os times já estiverem formados"
            >
              <Zap size={14} />
              <span>Veto Rápido</span>
            </button>

            <button
              onClick={onOpenRoomsHub}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold transition-all cursor-pointer"
              title="Ver todas as salas ou criar um novo mix"
            >
              <Layers size={14} className="text-slate-400" />
              <span>Salas</span>
            </button>

            {/* Delete Room Button */}
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setDeleteConfirmOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Excluir permanentemente esta sala de mix"
            >
              <Trash2 size={13} />
              <span>Excluir Sala</span>
            </button>

            {/* Profile & Stats Button in Header */}
            {myProfile?.steamId && (
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  if (onOpenProfile) onOpenProfile();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-white border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
                title="Ver meu perfil, estatísticas e gerenciar conta Steam"
              >
                <PlayerAvatar avatar={myProfile.avatar} nick={myProfile.nick} size="sm" />
                <span className="truncate max-w-[85px] hidden md:inline font-bold">{myProfile.nick}</span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">
                  Stats
                </span>
              </button>
            )}

            {/* Quick Server Action in Header if Configured */}
            {parsedServer.isValid && (
              <div className="hidden xl:flex items-center gap-1.5 bg-slate-900 border border-emerald-500/30 rounded-lg p-1 pl-2.5 shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
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
                  className="p-1 px-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors text-[11px] font-semibold flex items-center gap-1"
                  title="Copiar comando connect"
                >
                  {copiedServer ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedServer ? 'Copiado' : 'Connect'}</span>
                </button>
                {parsedServer.steamUrl && (
                  <a
                    href={parsedServer.steamUrl}
                    className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                    title="Conectar automaticamente ao CS2"
                  >
                    <Play size={10} fill="currentColor" /> CS2
                  </a>
                )}
              </div>
            )}

            {/* Room Code & Invite button */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 pl-3 shadow-inner">
              <div className="text-xs mr-2 font-mono">
                <span className="text-slate-500 text-[10px]">SALA:</span>{' '}
                <span className="font-bold text-amber-400">{roomId}</span>
              </div>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                title="Copiar link para os amigos entrarem com seu nick e level GC"
              >
                {copied ? <Check size={14} className="text-slate-950" /> : <Share2 size={14} />}
                <span>{copied ? 'Copiado!' : 'Convidar'}</span>
              </button>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/40 cursor-pointer"
              title={soundEnabled ? 'Silenciar Sons' : 'Ativar Sons'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>

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
