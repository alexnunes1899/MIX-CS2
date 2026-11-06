import React from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import ServerConnectBar from './ServerConnectBar';
import { Shield, Flame, ArrowLeftRight, RotateCcw, MapPin, Scale, ChevronLeft, CheckCircle2, Coins, Zap } from 'lucide-react';
import { playClickSound } from '../utils/audio';

export default function TeamsView({
  teamA = [],
  teamB = [],
  metrics,
  rankingSystem = 'gc',
  onSwapTeams,
  onReDraw,
  onStartCoinFlip,
  onStartVeto,
  onBackToLobby,
  serverIp = '',
  onUpdateServerIp,
  rconPassword = '',
  onUpdateRconPassword,
  roomId = 'MIX-PRO',
  liveMatch = null,
  onOpenGsiSetup,
  soundEnabled,
}) {
  const isFaceit = rankingSystem === 'faceit' || metrics?.rankingSystem === 'faceit';

  return (
    <div className="space-y-6">
      {/* Balance Metrics Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Scale size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold font-heading text-white">
                    Times Definidos!
                  </h2>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isFaceit
                      ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}>
                    {isFaceit ? '⚡ RANKING FACEIT' : '🛡️ RANKING GAMERS CLUB'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Diferença de apenas <strong className="text-amber-400 font-mono">{metrics?.diff ?? 0} ponto(s)</strong> entre as duas equipes
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Índice de Equilíbrio
              </div>
              <div className="text-lg font-black font-mono text-emerald-400 flex items-center justify-center gap-1">
                <CheckCircle2 size={16} />
                <span>{metrics?.balancePercentage ?? 100}%</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                onSwapTeams();
              }}
              className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="Inverter Time A e Time B"
            >
              <ArrowLeftRight size={15} />
              <span>Inverter</span>
            </button>
          </div>
        </div>
      </div>

      {/* CS2 Server Connect Bar */}
      {onUpdateServerIp && (
        <ServerConnectBar
          serverIp={serverIp}
          onUpdateServerIp={onUpdateServerIp}
          rconPassword={rconPassword}
          onUpdateRconPassword={onUpdateRconPassword}
          roomId={roomId}
          liveMatch={liveMatch}
          onOpenGsiSetup={onOpenGsiSetup}
          soundEnabled={soundEnabled}
        />
      )}

      {/* Teams Comparison Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* TIME A */}
        <div className="bg-slate-900/90 border-2 border-sky-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-400 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-sky-300">
                    TIME A (Lado 1)
                  </h3>
                  <span className="text-[11px] text-slate-400">{teamA.length} jogadores escalados</span>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">{isFaceit ? 'MÉDIA FACEIT' : 'MÉDIA GC'}</div>
                <div className="text-base font-black text-sky-400">
                  Lvl {metrics?.avgA ?? '-'} <span className="text-xs text-slate-500">({metrics?.sumA ?? '-'} pts)</span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60 mt-2">
              {teamA.map((p, i) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar avatar={p.avatar} nick={p.nick} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white">{p.nick}</span>
                        {p.side === 'CT' && (
                          <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                            CT
                          </span>
                        )}
                        {p.side === 'TR' && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            TR
                          </span>
                        )}
                        {p.side === 'ANY' && (
                          <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                            Flex
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Jogador #{i + 1}</span>
                    </div>
                  </div>
                  {isFaceit ? (
                    <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="md" />
                  ) : (
                    <GCBadge level={p.level} size="md" showTier />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TIME B */}
        <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center">
                  <Flame size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-amber-300">
                    TIME B (Lado 2)
                  </h3>
                  <span className="text-[11px] text-slate-400">{teamB.length} jogadores escalados</span>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">{isFaceit ? 'MÉDIA FACEIT' : 'MÉDIA GC'}</div>
                <div className="text-base font-black text-amber-400">
                  Lvl {metrics?.avgB ?? '-'} <span className="text-xs text-slate-500">({metrics?.sumB ?? '-'} pts)</span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60 mt-2">
              {teamB.map((p, i) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar avatar={p.avatar} nick={p.nick} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white">{p.nick}</span>
                        {p.side === 'CT' && (
                          <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                            CT
                          </span>
                        )}
                        {p.side === 'TR' && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            TR
                          </span>
                        )}
                        {p.side === 'ANY' && (
                          <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                            Flex
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Jogador #{i + 1}</span>
                    </div>
                  </div>
                  {isFaceit ? (
                    <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="md" />
                  ) : (
                    <GCBadge level={p.level} size="md" showTier />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onBackToLobby();
            }}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Voltar ao Lobby</span>
          </button>

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onReDraw();
            }}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Refazer o balanceamento"
          >
            <RotateCcw size={15} />
            <span>Re-sortear</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Coin Flip option */}
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onStartCoinFlip();
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
            title="Disputar quem começa banindo na moeda 3D"
          >
            <Coins size={16} className="text-amber-400" />
            <span>Cara ou Coroa</span>
          </button>

          {/* Direct to Map Veto */}
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onStartVeto();
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/30 cursor-pointer active:scale-95"
          >
            <MapPin size={16} />
            <span>Ir para o Veto de Mapas ➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
