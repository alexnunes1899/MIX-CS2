import React, { useState, useEffect } from 'react';
import GCBadge from './GCBadge';
import { Sparkles, Trophy } from 'lucide-react';
import { playRouletteTick, playFanfare } from '../utils/audio';

export default function DraftRoulette({
  players,
  onComplete,
  soundEnabled,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let tickCount = 0;
    const totalTicks = 25;
    const intervalTime = 90;

    const interval = setInterval(() => {
      tickCount++;
      setCurrentIndex((prev) => (prev + 1) % (players.length || 1));
      setProgress((tickCount / totalTicks) * 100);

      if (soundEnabled) playRouletteTick();

      if (tickCount >= totalTicks) {
        clearInterval(interval);
        if (soundEnabled) playFanfare();
        setTimeout(() => {
          onComplete();
        }, 400);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [players, soundEnabled, onComplete]);

  const activePlayer = players[currentIndex] || players[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 text-center shadow-2xl overflow-hidden animate-glow">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} className="animate-spin" /> Sorteando Equipes
          </div>

          <h2 className="text-xl font-extrabold font-heading text-white">
            Calculando Equilíbrio Perfeito...
          </h2>

          {/* Active Card spinning */}
          <div className="py-4">
            <div className="bg-slate-950 border-2 border-amber-400 rounded-2xl p-5 shadow-xl inline-block w-48 transition-all transform scale-105">
              <span className="text-5xl block mb-2 select-none">{activePlayer?.avatar || '🎯'}</span>
              <h3 className="font-bold text-lg text-white truncate">{activePlayer?.nick || 'CS2 Player'}</h3>
              <div className="mt-2 flex justify-center">
                <GCBadge level={activePlayer?.level || 1} size="md" showTier />
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-slate-400 font-mono animate-pulse">
            Analisando combinações 5v5...
          </p>
        </div>
      </div>
    </div>
  );
}
