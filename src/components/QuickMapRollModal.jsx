import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Dices, X, Sparkles, Copy, Check, Shield, Flame } from 'lucide-react';
import { ACTIVE_DUTY_MAPS } from '../data/maps';
import { playRouletteTick, playFanfare, playClickSound } from '../utils/audio';

export default function QuickMapRollModal({
  isOpen,
  onClose,
  onApplyMap,
  soundEnabled,
}) {
  const [spinning, setSpinning] = useState(false);
  const [selectedMap, setSelectedMap] = useState(null);
  const [startingSide, setStartingSide] = useState('CT');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setSelectedMap(null);

    let count = 0;
    const totalSpins = 25;
    let speed = 70;

    const runStep = () => {
      count++;
      setCurrentIndex((prev) => (prev + 1) % ACTIVE_DUTY_MAPS.length);
      if (soundEnabled) playRouletteTick();

      if (count < totalSpins) {
        speed += 12; // slow down
        setTimeout(runStep, speed);
      } else {
        const winner = ACTIVE_DUTY_MAPS[Math.floor(Math.random() * ACTIVE_DUTY_MAPS.length)];
        const side = Math.random() < 0.5 ? 'CT' : 'TR';
        setSelectedMap(winner);
        setStartingSide(side);
        setSpinning(false);
        if (soundEnabled) playFanfare();

        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#38bdf8', '#10b981'],
        });
      }
    };

    runStep();
  };

  const handleCopy = () => {
    if (!selectedMap) return;
    if (soundEnabled) playClickSound();
    const text = `🎲 **MAPA SORTEADO PARA O MIX:** ${selectedMap.name} (${selectedMap.file})\n🎯 **Lado Inicial:** Time A começa de ${startingSide} | Time B começa de ${startingSide === 'CT' ? 'TR' : 'CT'}\nGL HF! 🔥`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayMap = selectedMap || ACTIVE_DUTY_MAPS[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 text-center shadow-2xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} /> Rotação Oficial Valve
          </div>
          <h2 className="text-xl font-extrabold font-heading text-white">
            Roleta de Mapa Aleatório (CS2)
          </h2>
          <p className="text-xs text-slate-400">
            Sorteie instantaneamente um mapa entre os 7 mapas oficiais do competitivo
          </p>
        </div>

        {/* Card Display */}
        <div className="relative my-4 overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-slate-950 shadow-xl h-52 flex flex-col justify-between p-4 group">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-300 opacity-60"
            style={{
              backgroundImage: `url(${displayMap?.image})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
              Active Duty Oficial
            </span>
            <span className="text-xs font-mono text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded">
              {displayMap?.file}
            </span>
          </div>

          <div className="relative z-10 text-center py-2 flex flex-col items-center justify-center">
            {displayMap?.logo && (
              <img
                src={displayMap.logo}
                alt={displayMap.name}
                className="w-14 h-14 object-contain mb-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              />
            )}
            <h3 className="text-4xl font-black font-heading text-white tracking-wider">
              {displayMap?.name.toUpperCase()}
            </h3>
            <span className="text-xs text-slate-300 font-medium">
              {displayMap?.location || 'CS2'}
            </span>
          </div>

          <div className="relative z-10 flex items-center justify-center text-xs font-mono text-amber-400">
            {spinning ? 'Girando roleta...' : selectedMap ? '🏆 MAPA SELECIONADO!' : 'Clique abaixo para sortear'}
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Dices size={18} className={spinning ? 'animate-spin' : ''} />
            <span>{spinning ? 'Girando...' : 'Girar Roleta de Mapas'}</span>
          </button>

          {selectedMap && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="text-slate-500">Lado sorteado:</span>
                <span className="font-bold text-sky-400 flex items-center gap-0.5">
                  <Shield size={12} /> Time A {startingSide}
                </span>
                <span>/</span>
                <span className="font-bold text-amber-400 flex items-center gap-0.5">
                  <Flame size={12} /> Time B {startingSide === 'CT' ? 'TR' : 'CT'}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCopy}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  onClick={() => {
                    onApplyMap(selectedMap, startingSide);
                    onClose();
                  }}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                >
                  Jogar Este Mapa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
