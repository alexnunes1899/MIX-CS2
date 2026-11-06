import React, { useState } from 'react';
import { Swords, X, Sparkles, Shield, Flame } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function QuickVetoModal({
  isOpen,
  onClose,
  onStartQuickVeto,
  soundEnabled,
}) {
  const [teamA, setTeamA] = useState('Time A');
  const [teamB, setTeamB] = useState('Time B');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();
    onStartQuickVeto(teamA.trim() || 'Time A', teamB.trim() || 'Time B');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Swords size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">Veto Rápido (Times Prontos)</h2>
            <p className="text-xs text-slate-400">Pule o sorteio e vá direto para o Pick & Ban de Mapas</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Shield size={12} /> Nome do Time A
              </label>
              <input
                type="text"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                placeholder="Ex: Time FalleN / FURIA"
                maxLength={20}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-sky-400 font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Flame size={12} /> Nome do Time B
              </label>
              <input
                type="text"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                placeholder="Ex: Time coldzera / MIBR"
                maxLength={20}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-400 font-medium"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Será usada a rotação oficial <strong>Active Duty do CS2 (7 mapas)</strong>.
          </p>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={16} />
            <span>Iniciar Pick & Ban Imediatamente ➔</span>
          </button>
        </form>
      </div>
    </div>
  );
}
