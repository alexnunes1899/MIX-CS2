import React from 'react';
import GCBadge from './GCBadge';
import { Users, Trash2, Bot, Scale, Shuffle, Shield, Flame, UserCheck, Sparkles, AlertCircle } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function Lobby({
  players,
  onRemovePlayer,
  onFillMockBots,
  onClearPlayers,
  onDrawTeams,
  soundEnabled,
}) {
  const maxSlots = 10;
  const emptySlots = Math.max(0, maxSlots - players.length);
  const totalLevel = players.reduce((acc, p) => acc + (Number(p.level) || 1), 0);
  const avgLevel = players.length > 0 ? (totalLevel / players.length).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
              <Users size={20} className="text-amber-400" />
              Lobby de Espera ({players.length}/{maxSlots})
            </h2>
            {players.length === maxSlots ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                <UserCheck size={12} /> Pronto para o Sorteio!
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                Aguardando 10 jogadores
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Média Geral do Lobby: <strong className="text-amber-400 font-mono">Lvl {avgLevel}</strong> • Soma Total: <strong className="text-slate-200 font-mono">{totalLevel} pts</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onFillMockBots();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Preencher com 10 jogadores profissionais brasileiros para testar o sorteio imediatamente"
          >
            <Bot size={15} />
            <span>⚡ Testar c/ 10 Bots</span>
          </button>

          {players.length > 0 && (
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onClearPlayers();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/40 text-xs font-semibold transition-all cursor-pointer"
              title="Limpar todos os jogadores da sala"
            >
              <Trash2 size={14} />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Players Grid (10 Slots) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {players.map((p, idx) => (
          <div
            key={p.id}
            className="group relative bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition-all shadow-md flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl select-none" role="img" aria-label="avatar">
                  {p.avatar || '🎯'}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-white truncate max-w-[110px]" title={p.nick}>
                    {p.nick}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    {p.side === 'CT' && (
                      <span className="flex items-center gap-0.5 text-[10px] text-sky-400 font-semibold bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                        <Shield size={10} /> CT
                      </span>
                    )}
                    {p.side === 'TR' && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        <Flame size={10} /> TR
                      </span>
                    )}
                    {p.side === 'ANY' && (
                      <span className="text-[10px] text-slate-400 font-medium bg-slate-800 px-1.5 py-0.2 rounded">
                        Flex
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <GCBadge level={p.level} size="md" />
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono">Slot #{idx + 1}</span>
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onRemovePlayer(p.id);
                }}
                className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                title="Remover jogador"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {/* Empty Slot Placeholders */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="border-2 border-dashed border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center text-center text-slate-600 min-h-[105px] bg-slate-950/30"
          >
            <span className="text-xs font-mono text-slate-600">
              Slot #{players.length + i + 1}
            </span>
            <span className="text-xs text-slate-500 mt-1">Aguardando entrada...</span>
          </div>
        ))}
      </div>

      {/* Draw Action Controls */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center space-y-4">
        <div>
          <h3 className="text-base font-bold font-heading text-white flex items-center justify-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            Hora de Formar os Times
          </h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
            O algoritmo analisa todos os 10 jogadores e calcula a partição exata de 5v5 para que os dois times fiquem com a soma de níveis da GC praticamente idêntica!
          </p>
        </div>

        {players.length < 2 && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl py-2 px-4 max-w-md mx-auto">
            <AlertCircle size={15} />
            <span>Adicione pelo menos 2 jogadores (ou clique em "Testar c/ 10 Bots" acima).</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onDrawTeams('balanced');
            }}
            disabled={players.length < 2}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Scale size={18} />
            <span>Sortear Times Equilibrados (GC Level)</span>
          </button>

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onDrawTeams('random');
            }}
            disabled={players.length < 2}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Shuffle size={16} />
            <span>Sorteio Aleatório</span>
          </button>
        </div>
      </div>
    </div>
  );
}
