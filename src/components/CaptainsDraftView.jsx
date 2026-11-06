import React from 'react';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import PlayerAvatar from './PlayerAvatar';
import { Crown, Shield, Flame, UserCheck, ChevronLeft } from 'lucide-react';
import { playClickSound, playPickSound } from '../utils/audio';
import { getTeamNames } from '../utils/teamNames';

export default function CaptainsDraftView({
  room,
  onPickPlayer,
  onCancel,
  soundEnabled,
}) {
  const { captainA, captainB, captainTurn = 'captainA', teamA = [], teamB = [], unassignedPlayers = [], rankingSystem = 'gc' } = room;
  const { labelA, labelB, upperA, upperB } = getTeamNames(room);
  const isTurnA = captainTurn === 'captainA';
  const currentCaptain = isTurnA ? captainA : captainB;
  const isFaceit = rankingSystem === 'faceit';

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
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/80 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-md group"
            >
              <div className="flex items-center gap-2.5">
                <PlayerAvatar avatar={p.avatar} nick={p.nick} size="md" />
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                    {p.nick}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Pref: {p.side === 'CT' ? '🛡️ CT' : p.side === 'TR' ? '⚔️ TR' : 'Flex'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isFaceit ? (
                  <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="md" />
                ) : (
                  <GCBadge level={p.level} size="md" />
                )}
                <button className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
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
        <div className="bg-slate-900/90 border-2 border-sky-500/40 rounded-2xl p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-sky-400" />
              <h4 className="font-bold text-sm text-sky-300">{upperA} ({teamA.length}/5)</h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Capitão: <strong className="text-white">{captainA?.nick}</strong>
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 mt-2">
            {teamA.map((p, i) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                  <span className="text-sm font-semibold text-white">
                    {p.nick} {i === 0 && <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 ml-1">Capitão</span>}
                  </span>
                </div>
                {isFaceit ? (
                  <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="sm" />
                ) : (
                  <GCBadge level={p.level} size="sm" />
                )}
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
        <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-2xl p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-amber-400" />
              <h4 className="font-bold text-sm text-amber-300">{upperB} ({teamB.length}/5)</h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Capitão: <strong className="text-white">{captainB?.nick}</strong>
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 mt-2">
            {teamB.map((p, i) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                  <span className="text-sm font-semibold text-white">
                    {p.nick} {i === 0 && <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 ml-1">Capitão</span>}
                  </span>
                </div>
                {isFaceit ? (
                  <FaceitBadge level={p.faceitLevel || (p.level <= 10 ? p.level : Math.round(p.level / 2.1)) || 5} elo={p.faceitElo} size="sm" />
                ) : (
                  <GCBadge level={p.level} size="sm" />
                )}
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
