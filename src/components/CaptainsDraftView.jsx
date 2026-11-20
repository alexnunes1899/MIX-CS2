import React, { useEffect, useState } from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import { Crown, Shield, Flame, Clock, ChevronLeft } from 'lucide-react';
import { playClickSound, playPickSound } from '../utils/audio';
import { getTeamNames } from '../utils/teamNames';

export default function CaptainsDraftView({
  room,
  onPickPlayer,
  onCancel,
  onSetTurnTimer,
  myProfile = null,
  isAdmin = false,
  soundEnabled,
}) {
  const {
    captainA,
    captainB,
    captainTurn = 'captainA',
    teamA = [],
    teamB = [],
    unassignedPlayers = [],
    rankingSystem = 'gc',
    turnDeadline = null,
    turnTimerSeconds = 0,
  } = room;
  const { labelA, labelB, upperA, upperB } = getTeamNames(room);
  const isTurnA = captainTurn === 'captainA';
  const currentCaptain = isTurnA ? captainA : captainB;
  const isFaceit = rankingSystem === 'faceit';
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!turnDeadline) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      setSecondsLeft(Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000)));
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [turnDeadline]);

  const handlePick = (playerId) => {
    if (soundEnabled) playPickSound();
    onPickPlayer(playerId);
  };

  return (
    <div className="space-y-6">
      {/* Turn Banner */}
      <div
        className={`border-2 rounded-2xl p-5 text-center transition-all shadow-xl backdrop-blur ${
          isTurnA
            ? 'bg-sky-950/40 border-sky-500/60 shadow-sky-500/10'
            : 'bg-amber-950/40 border-amber-500/60 shadow-amber-500/10'
        }`}
      >
        <div className="flex items-center justify-center gap-2 flex-wrap mb-1.5">
          {secondsLeft !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                secondsLeft <= 5
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-slate-950/80 text-amber-300 border-amber-500/30'
              }`}
            >
              <Clock size={12} />
              <span>{secondsLeft}s</span>
            </span>
          )}
          {myProfile?.id && currentCaptain?.id && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                currentCaptain.id === myProfile.id || isAdmin
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-950/80 text-slate-400 border-slate-700'
              }`}
            >
              {currentCaptain.id === myProfile.id
                ? 'Sua vez de escolher!'
                : isAdmin
                ? 'Admin pode intervir'
                : `Aguarde ${currentCaptain.nick}`}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown size={22} className={isTurnA ? 'text-sky-400 animate-bounce' : 'text-amber-400 animate-bounce'} />
          <h2
            className={`text-xl font-extrabold font-heading tracking-wider uppercase ${
              isTurnA ? 'text-sky-300' : 'text-amber-300'
            }`}
          >
            Vez do Capitão {currentCaptain?.nick || (isTurnA ? labelA : labelB)} Escolher!
          </h2>
        </div>
        <p className="text-xs text-slate-300">
          Clique no jogador que você deseja recrutar para o seu time. Restam{' '}
          <strong className="text-white font-mono">{unassignedPlayers.length} jogadores</strong> disponíveis.
        </p>

        {isAdmin && onSetTurnTimer && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px]">
            <Clock size={12} className="text-slate-400" />
            <span className="text-slate-400 font-semibold">Auto-Pick Timer:</span>
            {[0, 20, 30, 45].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onSetTurnTimer(sec);
                }}
                className={`px-2 py-0.5 rounded font-mono font-bold transition-colors cursor-pointer ${
                  Number(turnTimerSeconds) === sec
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {sec === 0 ? 'Off' : `${sec}s`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Available Players Pool */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <span>Jogadores Disponíveis para Escolha</span>
          <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
            {unassignedPlayers.length}
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {unassignedPlayers.map((p) => (
            <div
              key={p.id}
              onClick={() => handlePick(p.id)}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/80 rounded-xl p-3 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-md group overflow-hidden"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <PlayerAvatar avatar={p.avatar} nick={p.nick} size="md" />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors truncate" title={p.nick}>
                    {p.nick}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono block truncate">
                    Pref: {p.side === 'CT' ? '🛡️ CT' : p.side === 'TR' ? '⚔️ TR' : 'Flex'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isFaceit ? (
                  <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="sm" />
                ) : (
                  <GCBadge level={p.level} size="sm" />
                )}
                <button className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shrink-0">
                  Escolher
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Teams Roster */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Team A */}
        <div className="bg-slate-900/90 border-2 border-sky-500/40 rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <Shield size={18} className="text-sky-400 shrink-0" />
              <h4 className="font-bold text-sm text-sky-300 truncate">{upperA} ({teamA.length}/5)</h4>
            </div>
            <span className="text-xs text-slate-400 font-mono truncate">
              Capitão: <strong className="text-white">{captainA?.nick}</strong>
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 mt-2">
            {teamA.map((p, i) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                  <span className="text-sm font-semibold text-white truncate" title={p.nick}>
                    {p.nick}
                  </span>
                  {i === 0 && <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">Capitão</span>}
                </div>
                <div className="shrink-0">
                  {isFaceit ? (
                    <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="sm" />
                  ) : (
                    <GCBadge level={p.level} size="sm" />
                  )}
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - teamA.length) }).map((_, idx) => (
              <div key={`empty-a-${idx}`} className="py-2.5 flex items-center justify-between text-slate-600 text-xs font-mono">
                <span className="text-slate-500">Slot #{teamA.length + idx + 1}</span>
                <span className="text-[10px] text-slate-600 italic">Aguardando escolha</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team B */}
        <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <Flame size={18} className="text-amber-400 shrink-0" />
              <h4 className="font-bold text-sm text-amber-300 truncate">{upperB} ({teamB.length}/5)</h4>
            </div>
            <span className="text-xs text-slate-400 font-mono truncate">
              Capitão: <strong className="text-white">{captainB?.nick}</strong>
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 mt-2">
            {teamB.map((p, i) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                  <span className="text-sm font-semibold text-white truncate" title={p.nick}>
                    {p.nick}
                  </span>
                  {i === 0 && <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">Capitão</span>}
                </div>
                <div className="shrink-0">
                  {isFaceit ? (
                    <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="sm" />
                  ) : (
                    <GCBadge level={p.level} size="sm" />
                  )}
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - teamB.length) }).map((_, idx) => (
              <div key={`empty-b-${idx}`} className="py-2.5 flex items-center justify-between text-slate-600 text-xs font-mono">
                <span className="text-slate-500">Slot #{teamB.length + idx + 1}</span>
                <span className="text-[10px] text-slate-600 italic">Aguardando escolha</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cancel button */}
      <div className="flex justify-start">
        <button
          onClick={() => {
            if (soundEnabled) playClickSound();
            onCancel();
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
        >
          <ChevronLeft size={16} />
          <span>Cancelar Modo Capitães e Voltar</span>
        </button>
      </div>
    </div>
  );
}
