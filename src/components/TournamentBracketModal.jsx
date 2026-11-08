import React, { useState, useEffect, useMemo } from 'react';
import { X, Trophy, Swords, Shuffle, RotateCcw, Check, Play, Crown, Sparkles, Plus, Edit2 } from 'lucide-react';
import { playClickSound } from '../utils/audio';

const DEFAULT_4_TEAMS = [
  'FURIA Academy',
  'MIBR Academy',
  'Imperial Feeder',
  'Pain Gaming Mix',
];

const DEFAULT_8_TEAMS = [
  'FURIA Academy',
  'MIBR Academy',
  'Imperial Feeder',
  'Pain Gaming Mix',
  'Red Canids Youth',
  'Legacy Mix',
  'ODDIK Stars',
  'Fluxo Challengers',
];

export default function TournamentBracketModal({
  isOpen,
  onClose,
  onLoadTeamsToMix = null,
  soundEnabled = true,
}) {
  const [teamCount, setTeamCount] = useState(4); // 4 or 8
  const [teamNames, setTeamNames] = useState(DEFAULT_4_TEAMS);
  const [matches, setMatches] = useState({});
  const [editingTeamIndex, setEditingTeamIndex] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Handle ESC
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

  // Initialize or reset bracket matches
  const initBracket = (count, customNames = null) => {
    const names = customNames || (count === 4 ? [...DEFAULT_4_TEAMS] : [...DEFAULT_8_TEAMS]);
    setTeamNames(names);

    if (count === 4) {
      setMatches({
        m1: { id: 'm1', round: 'semi', teamA: names[0], teamB: names[1], scoreA: 0, scoreB: 0, winner: null },
        m2: { id: 'm2', round: 'semi', teamA: names[2], teamB: names[3], scoreA: 0, scoreB: 0, winner: null },
        m3: { id: 'm3', round: 'final', teamA: 'Vencedor SF1', teamB: 'Vencedor SF2', scoreA: 0, scoreB: 0, winner: null },
      });
    } else {
      setMatches({
        q1: { id: 'q1', round: 'quarter', teamA: names[0], teamB: names[1], scoreA: 0, scoreB: 0, winner: null },
        q2: { id: 'q2', round: 'quarter', teamA: names[2], teamB: names[3], scoreA: 0, scoreB: 0, winner: null },
        q3: { id: 'q3', round: 'quarter', teamA: names[4], teamB: names[5], scoreA: 0, scoreB: 0, winner: null },
        q4: { id: 'q4', round: 'quarter', teamA: names[6], teamB: names[7], scoreA: 0, scoreB: 0, winner: null },
        s1: { id: 's1', round: 'semi', teamA: 'Vencedor QF1', teamB: 'Vencedor QF2', scoreA: 0, scoreB: 0, winner: null },
        s2: { id: 's2', round: 'semi', teamA: 'Vencedor QF3', teamB: 'Vencedor QF4', scoreA: 0, scoreB: 0, winner: null },
        f1: { id: 'f1', round: 'final', teamA: 'Vencedor SF1', teamB: 'Vencedor SF2', scoreA: 0, scoreB: 0, winner: null },
      });
    }
  };

  useEffect(() => {
    initBracket(teamCount);
  }, [teamCount]);

  const handleShuffleTeams = () => {
    if (soundEnabled) playClickSound();
    const shuffled = [...teamNames].sort(() => Math.random() - 0.5);
    initBracket(teamCount, shuffled);
  };

  const updateMatchScore = (matchId, side, score) => {
    const num = Math.max(0, parseInt(score, 10) || 0);
    setMatches((prev) => {
      const match = { ...prev[matchId] };
      if (side === 'A') match.scoreA = num;
      if (side === 'B') match.scoreB = num;

      // Determine winner if score reaches 13 or higher and diff >= 2, or simple winner selection
      if (match.scoreA >= 13 && match.scoreA > match.scoreB) {
        match.winner = match.teamA;
      } else if (match.scoreB >= 13 && match.scoreB > match.scoreA) {
        match.winner = match.teamB;
      }

      const nextMatches = { ...prev, [matchId]: match };

      // Propagate winners to subsequent rounds
      if (teamCount === 4) {
        if (matchId === 'm1' && match.winner) nextMatches.m3.teamA = match.winner;
        if (matchId === 'm2' && match.winner) nextMatches.m3.teamB = match.winner;
      } else {
        if (matchId === 'q1' && match.winner) nextMatches.s1.teamA = match.winner;
        if (matchId === 'q2' && match.winner) nextMatches.s1.teamB = match.winner;
        if (matchId === 'q3' && match.winner) nextMatches.s2.teamA = match.winner;
        if (matchId === 'q4' && match.winner) nextMatches.s2.teamB = match.winner;
        if (matchId === 's1' && match.winner) nextMatches.f1.teamA = match.winner;
        if (matchId === 's2' && match.winner) nextMatches.f1.teamB = match.winner;
      }

      return nextMatches;
    });
  };

  const setManualWinner = (matchId, winnerTeam) => {
    if (soundEnabled) playClickSound();
    setMatches((prev) => {
      const match = { ...prev[matchId], winner: winnerTeam };
      const nextMatches = { ...prev, [matchId]: match };

      if (teamCount === 4) {
        if (matchId === 'm1') nextMatches.m3.teamA = winnerTeam;
        if (matchId === 'm2') nextMatches.m3.teamB = winnerTeam;
      } else {
        if (matchId === 'q1') nextMatches.s1.teamA = winnerTeam;
        if (matchId === 'q2') nextMatches.s1.teamB = winnerTeam;
        if (matchId === 'q3') nextMatches.s2.teamA = winnerTeam;
        if (matchId === 'q4') nextMatches.s2.teamB = winnerTeam;
        if (matchId === 's1') nextMatches.f1.teamA = winnerTeam;
        if (matchId === 's2') nextMatches.f1.teamB = winnerTeam;
      }

      return nextMatches;
    });
  };

  const handleSendMatchToMix = (match) => {
    if (soundEnabled) playClickSound();
    if (onLoadTeamsToMix) {
      onLoadTeamsToMix({
        nameA: match.teamA,
        nameB: match.teamB,
        matchId: match.id,
      });
      onClose();
    }
  };

  const champion = teamCount === 4 ? matches.m3?.winner : matches.f1?.winner;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-md">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                <span>Modo Torneio Relâmpago CS2</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                  Chaveamento Eliminatório
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Organize copas rápidas entre 4 ou 8 equipes com progressão automática para a Grande Final.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Format Selector & Shuffle */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTeamCount(4)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                teamCount === 4
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              4 Equipes (Semis + Final)
            </button>
            <button
              onClick={() => setTeamCount(8)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                teamCount === 8
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              8 Equipes (Quartas + Semis + Final)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShuffleTeams}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Embaralhar seeds dos confrontos"
            >
              <Shuffle size={13} />
              <span>Embaralhar Seeds</span>
            </button>
            <button
              onClick={() => initBracket(teamCount)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reiniciar Chave</span>
            </button>
          </div>
        </div>

        {/* Bracket Content Stage */}
        <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
          {/* Champion Banner if finalized */}
          {champion && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-400 text-center space-y-1 shadow-xl animate-bounce">
              <Crown size={28} className="mx-auto text-amber-400" />
              <div className="text-[10px] font-mono text-amber-300 uppercase font-black tracking-widest">
                GRANDE CAMPEÃO DO TORNEIO
              </div>
              <h3 className="text-2xl font-black font-heading text-white">{champion}</h3>
              <p className="text-xs text-amber-200">Parabéns aos vencedores da competição!</p>
            </div>
          )}

          {/* 4 TEAMS BRACKET VIEW */}
          {teamCount === 4 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Semifinals Column */}
              <div className="space-y-6">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                  Semifinais (MD1 / MD3)
                </span>

                {['m1', 'm2'].map((mKey, idx) => {
                  const m = matches[mKey];
                  if (!m) return null;
                  return (
                    <div
                      key={mKey}
                      className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-lg"
                    >
                      <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                        <span>CONFRONTO #{idx + 1}</span>
                        {m.winner && (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Vencedor: {m.winner}
                          </span>
                        )}
                      </div>

                      {/* Team A Row */}
                      <div className={`flex items-center justify-between p-2 rounded-xl ${
                        m.winner === m.teamA ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-slate-900'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setManualWinner(mKey, m.teamA)}
                          className="font-bold text-xs text-white hover:text-amber-400 cursor-pointer truncate text-left flex-1"
                        >
                          {m.teamA}
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={m.scoreA}
                          onChange={(e) => updateMatchScore(mKey, 'A', e.target.value)}
                          className="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs py-1 text-white outline-none"
                        />
                      </div>

                      {/* Team B Row */}
                      <div className={`flex items-center justify-between p-2 rounded-xl ${
                        m.winner === m.teamB ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-slate-900'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setManualWinner(mKey, m.teamB)}
                          className="font-bold text-xs text-white hover:text-amber-400 cursor-pointer truncate text-left flex-1"
                        >
                          {m.teamB}
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={m.scoreB}
                          onChange={(e) => updateMatchScore(mKey, 'B', e.target.value)}
                          className="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs py-1 text-white outline-none"
                        />
                      </div>

                      {/* Action: Send to Mix */}
                      {onLoadTeamsToMix && (
                        <button
                          onClick={() => handleSendMatchToMix(m)}
                          className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Play size={11} className="text-amber-400" />
                          <span>Jogar Partida no Mix Hub</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Grand Final Column */}
              <div className="space-y-6">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                  🏆 Grande Final
                </span>

                {matches.m3 && (
                  <div className="bg-slate-950/90 border-2 border-amber-500/60 rounded-3xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-400">
                      <span>DECISÃO DO TÍTULO</span>
                      {matches.m3.winner && (
                        <span className="text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                          👑 CAMPEÃO: {matches.m3.winner}
                        </span>
                      )}
                    </div>

                    {/* Team A */}
                    <div className={`flex items-center justify-between p-3 rounded-xl ${
                      matches.m3.winner === matches.m3.teamA ? 'bg-amber-500/20 border border-amber-500/60' : 'bg-slate-900'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setManualWinner('m3', matches.m3.teamA)}
                        className="font-bold text-sm text-white hover:text-amber-400 cursor-pointer truncate text-left flex-1"
                      >
                        {matches.m3.teamA}
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={matches.m3.scoreA}
                        onChange={(e) => updateMatchScore('m3', 'A', e.target.value)}
                        className="w-14 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-sm py-1.5 text-white outline-none"
                      />
                    </div>

                    {/* Team B */}
                    <div className={`flex items-center justify-between p-3 rounded-xl ${
                      matches.m3.winner === matches.m3.teamB ? 'bg-amber-500/20 border border-amber-500/60' : 'bg-slate-900'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setManualWinner('m3', matches.m3.teamB)}
                        className="font-bold text-sm text-white hover:text-amber-400 cursor-pointer truncate text-left flex-1"
                      >
                        {matches.m3.teamB}
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={matches.m3.scoreB}
                        onChange={(e) => updateMatchScore('m3', 'B', e.target.value)}
                        className="w-14 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-sm py-1.5 text-white outline-none"
                      />
                    </div>

                    {onLoadTeamsToMix && (
                      <button
                        onClick={() => handleSendMatchToMix(matches.m3)}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                      >
                        <Trophy size={14} />
                        <span>Carregar Grande Final no Mix Hub</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 8 TEAMS BRACKET VIEW */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Quarterfinals */}
              <div className="space-y-4">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                  Quartas de Final
                </span>
                {['q1', 'q2', 'q3', 'q4'].map((qKey, i) => {
                  const m = matches[qKey];
                  if (!m) return null;
                  return (
                    <div key={qKey} className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>QF #{i + 1}</span>
                        {m.winner && <span className="text-emerald-400 font-bold">✓ {m.winner}</span>}
                      </div>
                      <div className={`flex items-center justify-between p-1.5 rounded-lg ${
                        m.winner === m.teamA ? 'bg-emerald-500/15' : 'bg-slate-900'
                      }`}>
                        <button onClick={() => setManualWinner(qKey, m.teamA)} className="font-bold text-white truncate text-left flex-1">
                          {m.teamA}
                        </button>
                        <input
                          type="number"
                          value={m.scoreA}
                          onChange={(e) => updateMatchScore(qKey, 'A', e.target.value)}
                          className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                        />
                      </div>
                      <div className={`flex items-center justify-between p-1.5 rounded-lg ${
                        m.winner === m.teamB ? 'bg-emerald-500/15' : 'bg-slate-900'
                      }`}>
                        <button onClick={() => setManualWinner(qKey, m.teamB)} className="font-bold text-white truncate text-left flex-1">
                          {m.teamB}
                        </button>
                        <input
                          type="number"
                          value={m.scoreB}
                          onChange={(e) => updateMatchScore(qKey, 'B', e.target.value)}
                          className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Semifinals */}
              <div className="space-y-6">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                  Semifinais
                </span>
                {['s1', 's2'].map((sKey, i) => {
                  const m = matches[sKey];
                  if (!m) return null;
                  return (
                    <div key={sKey} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>SF #{i + 1}</span>
                        {m.winner && <span className="text-emerald-400 font-bold">✓ {m.winner}</span>}
                      </div>
                      <div className={`flex items-center justify-between p-2 rounded-lg ${
                        m.winner === m.teamA ? 'bg-emerald-500/15' : 'bg-slate-900'
                      }`}>
                        <button onClick={() => setManualWinner(sKey, m.teamA)} className="font-bold text-white truncate text-left flex-1">
                          {m.teamA}
                        </button>
                        <input
                          type="number"
                          value={m.scoreA}
                          onChange={(e) => updateMatchScore(sKey, 'A', e.target.value)}
                          className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                        />
                      </div>
                      <div className={`flex items-center justify-between p-2 rounded-lg ${
                        m.winner === m.teamB ? 'bg-emerald-500/15' : 'bg-slate-900'
                      }`}>
                        <button onClick={() => setManualWinner(sKey, m.teamB)} className="font-bold text-white truncate text-left flex-1">
                          {m.teamB}
                        </button>
                        <input
                          type="number"
                          value={m.scoreB}
                          onChange={(e) => updateMatchScore(sKey, 'B', e.target.value)}
                          className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Final */}
              <div className="space-y-6">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                  🏆 Grande Final
                </span>
                {matches.f1 && (
                  <div className="bg-slate-950/90 border-2 border-amber-500/60 rounded-3xl p-4 space-y-3 shadow-2xl">
                    <div className="text-center">
                      <Trophy size={28} className="mx-auto text-amber-400 mb-1" />
                      <div className="text-xs font-black text-white uppercase">Decisão do Campeonato</div>
                    </div>
                    <div className={`flex items-center justify-between p-2 rounded-xl ${
                      matches.f1.winner === matches.f1.teamA ? 'bg-amber-500/20' : 'bg-slate-900'
                    }`}>
                      <button onClick={() => setManualWinner('f1', matches.f1.teamA)} className="font-bold text-xs text-white truncate text-left flex-1">
                        {matches.f1.teamA}
                      </button>
                      <input
                        type="number"
                        value={matches.f1.scoreA}
                        onChange={(e) => updateMatchScore('f1', 'A', e.target.value)}
                        className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 text-white"
                      />
                    </div>
                    <div className={`flex items-center justify-between p-2 rounded-xl ${
                      matches.f1.winner === matches.f1.teamB ? 'bg-amber-500/20' : 'bg-slate-900'
                    }`}>
                      <button onClick={() => setManualWinner('f1', matches.f1.teamB)} className="font-bold text-xs text-white truncate text-left flex-1">
                        {matches.f1.teamB}
                      </button>
                      <input
                        type="number"
                        value={matches.f1.scoreB}
                        onChange={(e) => updateMatchScore('f1', 'B', e.target.value)}
                        className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 text-white"
                      />
                    </div>
                    {onLoadTeamsToMix && (
                      <button
                        onClick={() => handleSendMatchToMix(matches.f1)}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                      >
                        <Trophy size={13} />
                        <span>Carregar no Mix Hub</span>
                      </button>
                    )}
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
            <span>Chaveamento compatível com disputas MD1, MD3 e MD5.</span>
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
