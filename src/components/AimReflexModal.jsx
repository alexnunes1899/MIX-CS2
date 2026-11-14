import React, { useState, useEffect, useRef } from 'react';
import { X, Target, Zap, RotateCcw, Share2, Check, Trophy, Flame, Sparkles } from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

export default function AimReflexModal({
  isOpen,
  onClose,
  soundEnabled = true,
  onShareToChat = null,
}) {
  const [activeTab, setActiveTab] = useState('reaction'); // 'reaction' | 'grid'

  // Reaction State
  const [reactionState, setReactionState] = useState('idle'); // 'idle' | 'waiting' | 'ready' | 'clicked' | 'early'
  const [startTime, setStartTime] = useState(0);
  const [currentScore, setCurrentScore] = useState(null);
  const [scoresList, setScoresList] = useState([]);
  const [copiedShare, setCopiedShare] = useState(false);
  const timerRef = useRef(null);

  // Grid Aim State
  const [gridState, setGridState] = useState('idle'); // 'idle' | 'playing' | 'finished'
  const [gridScore, setGridScore] = useState(0);
  const [gridStartTime, setGridStartTime] = useState(0);
  const [gridTotalTime, setGridTotalTime] = useState(0);
  const [currentTarget, setCurrentTarget] = useState({ top: 50, left: 50 });
  const [targetCount, setTargetCount] = useState(0);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (soundEnabled) playClickSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, soundEnabled]);

  // Start Reaction Round
  const startReactionTest = () => {
    if (soundEnabled) playClickSound();
    setReactionState('waiting');
    setCurrentScore(null);

    const randomDelay = Math.floor(Math.random() * 2500) + 1500; // 1.5s to 4s
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setReactionState('ready');
      setStartTime(Date.now());
    }, randomDelay);
  };

  const handleReactionClick = () => {
    if (reactionState === 'waiting') {
      // Early click penalty
      if (timerRef.current) clearTimeout(timerRef.current);
      setReactionState('early');
      return;
    }

    if (reactionState === 'ready') {
      const elapsed = Date.now() - startTime;
      setCurrentScore(elapsed);
      setReactionState('clicked');
      setScoresList((prev) => [elapsed, ...prev].slice(0, 5));
    }
  };

  const getBenchmark = (ms) => {
    if (!ms) return null;
    if (ms < 190) return { label: 'Deus da Mira (Nível Major / Pro)', color: 'text-amber-400', icon: '👑' };
    if (ms < 230) return { label: 'Reflexo Nível 20 GC / FACEIT 10', color: 'text-emerald-400', icon: '🔥' };
    if (ms < 280) return { label: 'Mira Competitiva (Lvl 12-19)', color: 'text-sky-400', icon: '🎯' };
    return { label: 'Aquecendo os Motores (Lento)', color: 'text-rose-400', icon: '🐢' };
  };

  const averageScore = scoresList.length > 0
    ? Math.round(scoresList.reduce((a, b) => a + b, 0) / scoresList.length)
    : null;

  // Grid Aim Trainer Logic
  const startGridAim = () => {
    if (soundEnabled) playClickSound();
    setGridState('playing');
    setGridScore(0);
    setTargetCount(0);
    setGridStartTime(Date.now());
    spawnNewTarget();
  };

  const spawnNewTarget = () => {
    const top = Math.floor(Math.random() * 70) + 15;
    const left = Math.floor(Math.random() * 70) + 15;
    setCurrentTarget({ top, left });
  };

  const handleHitTarget = (e) => {
    e.stopPropagation();
    if (gridState !== 'playing') return;
    if (soundEnabled) playClickSound();

    const nextCount = targetCount + 1;
    setTargetCount(nextCount);
    setGridScore((prev) => prev + 1);

    if (nextCount >= 15) {
      const total = ((Date.now() - gridStartTime) / 1000).toFixed(2);
      setGridTotalTime(total);
      setGridState('finished');
    } else {
      spawnNewTarget();
    }
  };

  const handleShareResult = () => {
    if (soundEnabled) playClickSound();
    const text = activeTab === 'reaction' && currentScore
      ? `🎯 [CS2 MIX HUB] Teste de Reflexo: ${currentScore}ms (${getBenchmark(currentScore)?.label || ''})! Venha bater meu tempo!`
      : `🎯 [CS2 MIX HUB] Grid Aim: 15 alvos abatidos em ${gridTotalTime}s!`;

    copyText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);

    if (onShareToChat) {
      onShareToChat(text);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aquecimento de Mira e Reflexo"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-md">
              <Target size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                <span>Aquecimento de Mira & Reflexo</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
                  Mini-Game
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Aqueça o tempo de resposta e precisão antes de a partida começar.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar janela"
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 border-b border-slate-800 bg-slate-950/30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('reaction');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === 'reaction'
                ? 'bg-slate-900 border-amber-500/40 text-amber-400 shadow-md'
                : 'bg-transparent border-transparent text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Teste de Reflexo (ms)
          </button>
          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('grid');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === 'grid'
                ? 'bg-slate-900 border-amber-500/40 text-amber-400 shadow-md'
                : 'bg-transparent border-transparent text-slate-400 hover:text-white'
            }`}
          >
            🎯 Grid Aim (15 Alvos)
          </button>
        </div>

        {/* Main Game Stage */}
        <div className="p-6 overflow-y-auto no-scrollbar space-y-4">
          {activeTab === 'reaction' ? (
            <div className="space-y-4">
              {/* Interactive Reaction Box */}
              <button
                type="button"
                onClick={
                  reactionState === 'idle' || reactionState === 'clicked' || reactionState === 'early'
                    ? startReactionTest
                    : handleReactionClick
                }
                className={`relative w-full h-64 rounded-3xl flex flex-col items-center justify-center text-center p-6 select-none cursor-pointer transition-all duration-150 shadow-inner border-2 ${
                  reactionState === 'idle'
                    ? 'bg-slate-950/90 border-slate-800 hover:border-amber-400 text-slate-300'
                    : reactionState === 'waiting'
                    ? 'bg-rose-950/90 border-rose-500/80 text-rose-200 animate-pulse'
                    : reactionState === 'ready'
                    ? 'bg-emerald-600 border-emerald-300 text-slate-950 font-black scale-[1.01]'
                    : reactionState === 'early'
                    ? 'bg-amber-950 border-amber-500 text-amber-200'
                    : 'bg-indigo-950/90 border-indigo-500/60 text-white'
                }`}
              >
                {reactionState === 'idle' && (
                  <div className="space-y-2">
                    <Zap size={44} className="mx-auto text-amber-400 animate-bounce" />
                    <h3 className="text-xl font-black font-heading text-white">CLIQUE PARA INICIAR</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Quando a tela ficar <strong className="text-emerald-400">VERDE</strong>, clique o mais rápido possível!
                    </p>
                  </div>
                )}

                {reactionState === 'waiting' && (
                  <div className="space-y-2">
                    <span className="text-3xl">🔴</span>
                    <h3 className="text-2xl font-black font-heading text-rose-400">AGUARDE FICAR VERDE...</h3>
                    <p className="text-xs text-rose-300/80">Não clique antes da hora!</p>
                  </div>
                )}

                {reactionState === 'ready' && (
                  <div className="space-y-1">
                    <span className="text-4xl">🟢</span>
                    <h3 className="text-4xl font-black font-heading tracking-widest text-slate-950">CLIQUE AGORA!</h3>
                  </div>
                )}

                {reactionState === 'early' && (
                  <div className="space-y-2">
                    <span className="text-3xl">⚠️</span>
                    <h3 className="text-xl font-black font-heading text-amber-400">CLICOU MUITO CEDO!</h3>
                    <p className="text-xs text-amber-200">A tela ainda estava vermelha. Clique para tentar novamente.</p>
                  </div>
                )}

                {reactionState === 'clicked' && currentScore && (
                  <div className="space-y-2 animate-fadeIn">
                    <span className="text-3xl">{getBenchmark(currentScore)?.icon}</span>
                    <div className="text-5xl font-black font-mono text-white tracking-tight">
                      {currentScore} <span className="text-lg text-amber-400 font-sans">ms</span>
                    </div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${getBenchmark(currentScore)?.color}`}>
                      {getBenchmark(currentScore)?.label}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">Clique para tentar um novo recorde</p>
                  </div>
                )}
              </button>

              {/* Benchmarks & History Bar */}
              {scoresList.length > 0 && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                      Últimas Tentativas (Média: {averageScore}ms)
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {scoresList.map((sc, i) => (
                        <span key={i} className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
                          {sc}ms
                        </span>
                      ))}
                    </div>
                  </div>

                  {currentScore && (
                    <button
                      onClick={handleShareResult}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
                    >
                      {copiedShare ? <Check size={14} /> : <Share2 size={14} />}
                      <span>{copiedShare ? 'Copiado p/ Chat!' : 'Compartilhar Tempo'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Grid Aim Trainer Tab */
            <div className="space-y-4">
              <div
                className="relative w-full h-72 rounded-3xl bg-slate-950/90 border border-slate-800 overflow-hidden select-none"
              >
                {gridState === 'idle' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <Target size={44} className="text-amber-400 animate-pulse" />
                    <h3 className="text-lg font-black font-heading text-white">GRID AIM TRAINER</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      15 alvos irão surgir aleatoriamente na tela. Acerte todos o mais rápido possível para treinar flicks de mira!
                    </p>
                    <button
                      onClick={startGridAim}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      Começar Treino
                    </button>
                  </div>
                )}

                {gridState === 'playing' && (
                  <>
                    <div className="absolute top-3 left-4 text-xs font-mono font-bold text-slate-400">
                      Alvo: <span className="text-amber-400 font-bold">{targetCount + 1} / 15</span>
                    </div>
                    {/* The Moving Target */}
                    <button
                      type="button"
                      onClick={handleHitTarget}
                      style={{ top: `${currentTarget.top}%`, left: `${currentTarget.left}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 border-2 border-white shadow-lg shadow-amber-500/50 flex items-center justify-center active:scale-90 transition-transform cursor-crosshair animate-pulse"
                    >
                      <div className="w-4 h-4 rounded-full bg-rose-600 border border-white" />
                    </button>
                  </>
                )}

                {gridState === 'finished' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 animate-fadeIn">
                    <Trophy size={44} className="text-amber-400" />
                    <h3 className="text-2xl font-black font-heading text-white">TREINO CONCLUÍDO!</h3>
                    <div className="text-4xl font-black font-mono text-emerald-400">
                      {gridTotalTime} <span className="text-sm text-slate-400 font-sans">segundos</span>
                    </div>
                    <p className="text-xs text-slate-400">15 alvos abatidos com 100% de precisão.</p>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={startGridAim}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Tentar Novamente</span>
                      </button>
                      <button
                        onClick={handleShareResult}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedShare ? <Check size={13} /> : <Share2 size={13} />}
                        <span>{copiedShare ? 'Copiado!' : 'Compartilhar'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-400" />
            <span>Mantenha os reflexos afiados enquanto espera os 10 jogadores entrarem na sala.</span>
          </span>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
