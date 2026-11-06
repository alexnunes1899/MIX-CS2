import React, { useState } from 'react';
import { Share2, Check, Users, Swords, MapPin, Trophy, Volume2, VolumeX, Layers, History, Dices, Zap } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function Header({
  roomId,
  roomName,
  phase,
  soundEnabled,
  setSoundEnabled,
  onOpenRoomsHub,
  onOpenHistory,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
}) {
  const [copied, setCopied] = useState(false);

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
                  <span className="text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                    GC
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Balanceamento por Nível Gamers Club & Pick/Ban</p>
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
    </header>
  );
}
