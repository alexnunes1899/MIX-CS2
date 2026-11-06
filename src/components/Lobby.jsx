import React from 'react';
import GCBadge from './GCBadge';
import { Users, Trash2, Bot, Scale, Shuffle, Shield, Flame, CheckCircle2, Crown, Check, AlertCircle, Zap, Dices } from 'lucide-react';
import { playClickSound, playReadySound } from '../utils/audio';

export default function Lobby({
  players = [],
  myProfile,
  onToggleReady,
  onRemovePlayer,
  onFillMockBots,
  onClearPlayers,
  onDrawTeams,
  onStartCaptainDraft,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  soundEnabled,
}) {
  const maxSlots = 10;
  const emptySlots = Math.max(0, maxSlots - players.length);
  const totalLevel = players.reduce((acc, p) => acc + (Number(p.level) || 1), 0);
  const avgLevel = players.length > 0 ? (totalLevel / players.length).toFixed(1) : 0;
  const readyCount = players.filter((p) => p.ready).length;

  const myPlayer = players.find((p) => p.id === myProfile?.id || (p.nick && p.nick === myProfile?.nick));
  const isMyPlayerReady = myPlayer?.ready || false;

  const handleMyReadyToggle = () => {
    if (soundEnabled) playReadySound();
    if (myPlayer) {
      onToggleReady(myPlayer.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Mode Shortcuts Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          onClick={() => {
            if (soundEnabled) playClickSound();
            onOpenQuickVeto();
          }}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Zap size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-sky-300 transition-colors">
                Times Já Montados?
              </h4>
              <p className="text-[11px] text-slate-400">Ir direto para o Pick & Ban de Mapas</p>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-400 group-hover:translate-x-1 transition-transform">➔</span>
        </div>

        <div
          onClick={() => {
            if (soundEnabled) playClickSound();
            onOpenQuickMapRoll();
          }}
          className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Dices size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-amber-300 transition-colors">
                Sorteio Rápido de Mapa
              </h4>
              <p className="text-[11px] text-slate-400">Girar roleta entre os mapas da Valve</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">➔</span>
        </div>
      </div>

      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
              <Users size={20} className="text-amber-400" />
              Lobby de Jogadores ({players.length}/{maxSlots})
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                readyCount === maxSlots && players.length === maxSlots
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              <CheckCircle2 size={12} /> {readyCount}/{players.length} Prontos
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Média do Lobby: <strong className="text-amber-400 font-mono">Lvl {avgLevel}</strong> • Soma: <strong className="text-slate-200 font-mono">{totalLevel} pts</strong>
          </p>
        </div>

        {/* Action Buttons & My Ready Toggle */}
        <div className="flex items-center flex-wrap gap-2">
          {myPlayer && (
            <button
              onClick={handleMyReadyToggle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                isMyPlayerReady
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Check size={15} />
              <span>{isMyPlayerReady ? 'Você está Pronto! ✅' : 'Dar Ready (Pronto)'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onFillMockBots();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Preencher com 10 jogadores profissionais brasileiros para testar o sorteio imediatamente"
          >
            <Bot size={15} />
            <span>⚡ 10 Bots</span>
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
        {players.map((p) => (
          <div
            key={p.id}
            className={`group relative border rounded-xl p-3.5 transition-all shadow-md flex flex-col justify-between ${
              p.ready
                ? 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-500/5'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl select-none" role="img" aria-label="avatar">
                  {p.avatar || '🎯'}
                </span>
                <div>
                  <div className="flex items-center gap-1">
                    <h3 className="font-bold text-sm text-white truncate max-w-[105px]" title={p.nick}>
                      {p.nick}
                    </h3>
                    {p.ready && (
                      <span className="text-emerald-400 font-bold" title="Jogador pronto">
                        ✓
                      </span>
                    )}
                  </div>

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
              <span className={`font-mono text-[10px] ${p.ready ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                {p.ready ? 'PRONTO' : 'AGUARDANDO'}
              </span>
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
            <span className="text-xs text-slate-500 mt-1">Vazio...</span>
          </div>
        ))}
      </div>

      {/* Draw Action Controls */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center space-y-4">
        <div>
          <h3 className="text-base font-bold font-heading text-white">
            Formação dos Times para o Mix
          </h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
            Sorteie com inteligência matemática para somas de nível Gamers Club idênticas, ou monte com escolhas de capitães ao vivo!
          </p>
        </div>

        {players.length < 2 && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl py-2 px-4 max-w-md mx-auto">
            <AlertCircle size={15} />
            <span>Adicione pelo menos 2 jogadores para iniciar o sorteio (ou use os atalhos no topo).</span>
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
            <span>Balanceamento Inteligente (GC Level)</span>
          </button>

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onStartCaptainDraft();
            }}
            disabled={players.length < 2}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Crown size={17} className="text-amber-400" />
            <span>👑 Modo Capitães (Draft 1 a 1)</span>
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
            <span>Aleatório</span>
          </button>
        </div>
      </div>
    </div>
  );
}
