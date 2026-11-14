import React, { useState, useEffect } from 'react';
import { Shield, Flame, Sparkles, Check } from 'lucide-react';
import { playCoinSound, playFanfare } from '../utils/audio';
import { getTeamNames } from '../utils/teamNames';

export default function CoinFlipModal({
  isOpen,
  room,
  coin,
  onChooseAction,
  soundEnabled,
}) {
  const [flipping, setFlipping] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setFlipping(true);
      if (soundEnabled) playCoinSound();
      const timer = setTimeout(() => {
        setFlipping(false);
        if (soundEnabled) playFanfare();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, soundEnabled]);

  if (!isOpen || !coin) return null;

  const { upperA, upperB } = getTeamNames(room);
  const winner = coin.winner; // 'teamA' or 'teamB'
  const winnerName = winner === 'teamA' ? upperA : upperB;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-flip-modal-title"
    >
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 text-center shadow-2xl overflow-hidden">
        
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} /> Cara ou Coroa Oficial
          </div>

          <h2 id="coin-flip-modal-title" className="text-xl font-extrabold font-heading text-white">
            Quem Começa o Pick & Ban?
          </h2>

          {/* 3D Animated Coin */}
          <div className="py-6 flex justify-center">
            <div
              className={`w-28 h-28 rounded-full border-4 shadow-2xl flex items-center justify-center transition-all duration-700 ${
                flipping
                  ? 'animate-spin border-amber-400 bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600 scale-110 shadow-amber-500/50'
                  : winner === 'teamA'
                  ? 'border-sky-400 bg-gradient-to-tr from-sky-600 to-blue-800 shadow-sky-500/50'
                  : 'border-amber-400 bg-gradient-to-tr from-amber-600 to-orange-800 shadow-amber-500/50'
              }`}
            >
              {flipping ? (
                <span className="text-3xl font-black text-slate-950 font-heading">CS2</span>
              ) : winner === 'teamA' ? (
                <div className="flex flex-col items-center text-white">
                  <Shield size={36} className="text-sky-300 mb-1" />
                  <span className="text-xs font-black font-heading tracking-wider">{upperA}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-white">
                  <Flame size={36} className="text-amber-300 mb-1" />
                  <span className="text-xs font-black font-heading tracking-wider">{upperB}</span>
                </div>
              )}
            </div>
          </div>

          {/* Result announcement */}
          {flipping ? (
            <p className="text-sm font-semibold text-amber-300 animate-pulse">
              A moeda está girando no ar...
            </p>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 block mb-1">Vencedor do sorteio:</span>
                <h3
                  className={`text-2xl font-black font-heading tracking-wide ${
                    winner === 'teamA' ? 'text-sky-400' : 'text-amber-400'
                  }`}
                >
                  {winnerName} VENCEU A MOEDA!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  O capitão do {winnerName} tem o direito de escolher quem faz o primeiro ban:
                </p>
              </div>

              {/* Action Choices */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => onChooseAction('first')}
                  className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Banir Primeiro
                </button>

                <button
                  onClick={() => onChooseAction('pass')}
                  className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Passar Primeiro Ban
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
