import React, { useState } from 'react';
import { Swords, X, Sparkles, Shield, Flame, Trophy, Coins, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { playClickSound, playCoinFlipSound } from '../utils/audio';
import { getVetoSchedule } from '../utils/proVeto';

export default function QuickVetoModal({
  isOpen,
  onClose,
  onStartQuickVeto,
  soundEnabled,
}) {
  const [teamA, setTeamA] = useState('Time A');
  const [teamB, setTeamB] = useState('Time B');
  const [matchFormat, setMatchFormat] = useState('MD3');
  const [firstTeam, setFirstTeam] = useState('teamA');
  const [bo1Order, setBo1Order] = useState('ABABAB');
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [coinWinner, setCoinWinner] = useState(null);

  if (!isOpen) return null;

  const cleanA = teamA.trim() || 'Time A';
  const cleanB = teamB.trim() || 'Time B';

  const schedule = getVetoSchedule(matchFormat, firstTeam, bo1Order);

  const handleSwapTeams = () => {
    if (soundEnabled) playClickSound();
    const prevA = teamA;
    setTeamA(teamB);
    setTeamB(prevA);
  };

  const handleFlipCoin = () => {
    if (coinFlipping) return;
    if (soundEnabled) playCoinFlipSound();
    setCoinFlipping(true);
    setCoinWinner(null);
    setTimeout(() => {
      const winner = Math.random() < 0.5 ? 'teamA' : 'teamB';
      setFirstTeam(winner);
      setCoinWinner(winner);
      setCoinFlipping(false);
    }, 650);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (soundEnabled) playClickSound();
    onStartQuickVeto(cleanA, cleanB, {
      matchFormat,
      firstTeam,
      bo1Order,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[94vh] overflow-y-auto bg-[#0c1220] border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl custom-scrollbar">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/25 to-sky-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-lg">
            <Swords size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-heading text-white tracking-wide">
                Pick & Ban Oficial CS2 (Padrão Pro)
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                VALVE MAJOR / HLTV
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Sistema oficial de Veto com Bans, Picks de Mapa, Escolha de Lado (CT/TR/Faca) e Decider
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. FORMAT SELECTOR: MD1, MD3, MD5 */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
                <Trophy size={13} className="text-amber-400" />
                <span>1. Formato Oficial da Série</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Pool Oficial: 7 Mapas Active Duty
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'MD1',
                  label: 'MD1 (BO1)',
                  title: 'Jogo Único',
                  rule: '6 Bans + 1 Decider',
                  badge: 'Mix / Fase Suíça',
                },
                {
                  id: 'MD3',
                  label: 'MD3 (BO3)',
                  title: 'Melhor de 3',
                  rule: '2 Bans • 2 Picks • 2 Bans • Decider',
                  badge: 'Padrão Pro / HLTV',
                },
                {
                  id: 'MD5',
                  label: 'MD5 (BO5)',
                  title: 'Melhor de 5',
                  rule: '2 Bans • 4 Picks • 1 Decider',
                  badge: 'Grande Final',
                },
              ].map((f) => {
                const active = matchFormat === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setMatchFormat(f.id);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/10 border-amber-400 text-white shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-black text-xs sm:text-sm text-white">{f.label}</span>
                      {active && <CheckCircle2 size={13} className="text-amber-400" />}
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 block mt-0.5">{f.title}</span>
                    <span className="text-[9px] font-mono text-amber-300/90 block mt-0.5 leading-tight">{f.rule}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-option for BO1 Veto Order */}
            {matchFormat === 'MD1' && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-slate-400">Ordem de Bans MD1:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setBo1Order('ABABAB');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                      bo1Order === 'ABABAB'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    A-B-A-B-A-B (Padrão GC / ESL)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setBo1Order('ABBAAB');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                      bo1Order === 'ABBAAB'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    A-B-B-A-A-B (Valve Major / FACEIT)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. TEAMS INPUTS */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-heading">
                2. Equipes do Confronto
              </span>
              <button
                type="button"
                onClick={handleSwapTeams}
                className="text-[10px] font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Inverter nomes do Time A e Time B"
              >
                <ArrowLeftRight size={11} /> Inverter Equipes
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Shield size={12} /> Equipe 1 (Azul)
                </label>
                <input
                  type="text"
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                  placeholder="Ex: FURIA / Time FalleN"
                  maxLength={24}
                  required
                  className="w-full bg-slate-900 border border-sky-500/40 focus:border-sky-400 rounded-xl px-3 py-2 text-sm text-white outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Flame size={12} /> Equipe 2 (Laranja)
                </label>
                <input
                  type="text"
                  value={teamB}
                  onChange={(e) => setTeamB(e.target.value)}
                  placeholder="Ex: NAVI / Time coldzera"
                  maxLength={24}
                  required
                  className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-sm text-white outline-none font-bold"
                />
              </div>
            </div>
          </div>

          {/* 3. WHO STARTS THE VETO (SEED / COIN TOSS) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-heading">
                3. Quem Inicia o Veto (1º Ban / Seed 1)
              </span>
              {coinWinner && (
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-fadeIn">
                  🪙 Moeda: {coinWinner === 'teamA' ? cleanA : cleanB} venceu!
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setFirstTeam('teamA');
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  firstTeam === 'teamA'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Shield size={13} className="text-sky-400 shrink-0" />
                <span className="truncate">{cleanA}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setFirstTeam('teamB');
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  firstTeam === 'teamB'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Flame size={13} className="text-amber-400 shrink-0" />
                <span className="truncate">{cleanB}</span>
              </button>

              <button
                type="button"
                onClick={handleFlipCoin}
                disabled={coinFlipping}
                className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Coins size={13} className={coinFlipping ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                <span>{coinFlipping ? 'Girando...' : 'Sortear Moeda'}</span>
              </button>
            </div>
          </div>

          {/* 4. LIVE PREVIEW OF THE 7 OFFICIAL STEPS */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
              Ordem Oficial de Veto ({matchFormat}):
            </span>
            <div className="grid grid-cols-7 gap-1 text-center">
              {schedule.map((st) => {
                const teamLabel = st.team === 'teamA' ? cleanA : st.team === 'teamB' ? cleanB : 'Sobra';
                const isBan = st.type === 'ban';
                const isPick = st.type === 'pick';
                return (
                  <div
                    key={st.step}
                    className={`p-1.5 rounded-lg border text-[9px] font-mono flex flex-col items-center justify-between ${
                      isBan
                        ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                        : isPick
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    <span className="font-bold opacity-75">#{st.step}</span>
                    <span className="font-black uppercase text-[10px] my-0.5">
                      {isBan ? 'BAN' : isPick ? 'PICK' : 'DECIDER'}
                    </span>
                    <span className="truncate w-full text-[8px] text-slate-300" title={teamLabel}>
                      {teamLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Sparkles size={16} />
            <span>Iniciar Pick & Ban Profissional ({matchFormat}) ➔</span>
          </button>
        </form>
      </div>
    </div>
  );
}
