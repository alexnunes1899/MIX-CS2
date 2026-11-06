import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CS2_MAPS } from '../data/maps';
import { Shield, Flame, Ban, Check, MapPin, Sparkles, History, RotateCcw } from 'lucide-react';
import { playBanSound, playFanfare, playPickSound, playClickSound } from '../utils/audio';

export default function MapVeto({
  room,
  onBanMap,
  onSelectSide,
  onResetMix,
  soundEnabled,
}) {
  const { maps = [], bannedMaps = [], currentTurn = 'teamA', phase, finalMap, startingSideTeamB } = room;

  // Trigger celebration when decider map is crowned
  useEffect(() => {
    if (phase === 'side_pick' || phase === 'finished') {
      if (soundEnabled) playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#38bdf8', '#ef4444', '#10b981'],
      });
    }
  }, [phase, soundEnabled]);

  const isBanned = (mapId) => bannedMaps.some((b) => b.mapId === mapId);
  const getBanInfo = (mapId) => bannedMaps.find((b) => b.mapId === mapId);

  const handleBan = (mapId) => {
    if (phase !== 'veto') return;
    if (isBanned(mapId)) return;
    if (soundEnabled) playBanSound();
    onBanMap(mapId);
  };

  const handleSelectSide = (side) => {
    if (soundEnabled) playPickSound();
    onSelectSide(side);
  };

  const turnIsTeamA = currentTurn === 'teamA';

  return (
    <div className="space-y-6">
      {/* Turn & Status Header Banner */}
      {phase === 'veto' && (
        <div
          className={`border-2 rounded-2xl p-5 text-center transition-all shadow-xl backdrop-blur ${
            turnIsTeamA
              ? 'bg-sky-950/40 border-sky-500/60 shadow-sky-500/10'
              : 'bg-amber-950/40 border-amber-500/60 shadow-amber-500/10'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            {turnIsTeamA ? (
              <Shield size={22} className="text-sky-400 animate-pulse" />
            ) : (
              <Flame size={22} className="text-amber-400 animate-pulse" />
            )}
            <h2
              className={`text-xl font-extrabold font-heading tracking-wider uppercase ${
                turnIsTeamA ? 'text-sky-300' : 'text-amber-300'
              }`}
            >
              Vez do {turnIsTeamA ? 'TIME A' : 'TIME B'} Banir
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            Clique no mapa que sua equipe deseja eliminar da disputa. Restam{' '}
            <strong className="text-white font-mono">{maps.length - bannedMaps.length} mapas</strong> no pool.
          </p>
        </div>
      )}

      {/* Side Selection Phase (When 1 map remains) */}
      {phase === 'side_pick' && finalMap && (
        <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border-2 border-amber-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-glow">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} /> Mapa Decisivo Encontrado!
            </div>
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-wide">
              {finalMap.name.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
              Como o último ban foi realizado pelo Time A, agora o <strong className="text-amber-400 font-bold">TIME B</strong> escolhe de qual lado deseja começar a partida:
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => handleSelectSide('CT')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
            >
              <Shield size={18} />
              <span>Time B começa de CT (Defesa)</span>
            </button>

            <button
              onClick={() => handleSelectSide('TR')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
            >
              <Flame size={18} />
              <span>Time B começa de TR (Ataque)</span>
            </button>
          </div>
        </div>
      )}

      {/* Maps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {maps.map((map) => {
          const banned = isBanned(map.id);
          const banInfo = getBanInfo(map.id);
          const isDecider = finalMap && finalMap.id === map.id;
          const fullMapData = CS2_MAPS.find((m) => m.id === map.id) || map;

          return (
            <div
              key={map.id}
              className={`group relative overflow-hidden rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[220px] ${
                isDecider
                  ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl scale-[1.02]'
                  : banned
                  ? 'border-slate-800/80 bg-slate-950/80 opacity-60 grayscale'
                  : 'border-slate-700/80 hover:border-amber-400/80 bg-slate-900 shadow-lg hover:shadow-amber-500/10 cursor-pointer'
              }`}
              onClick={() => !banned && phase === 'veto' && handleBan(map.id)}
            >
              {/* Map Background Artwork */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{
                  backgroundImage: `url(${fullMapData.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80'})`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />

              {/* Banned Stamp Overlay */}
              {banned && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
                  <div className="border-4 border-rose-500 text-rose-500 font-heading font-black text-2xl px-4 py-1.5 rounded-lg map-card-stamp uppercase tracking-widest">
                    BANIDO
                  </div>
                  <span className="text-xs font-semibold text-rose-300 mt-3 bg-rose-950/80 px-2.5 py-0.5 rounded border border-rose-500/30">
                    Eliminado pelo {banInfo?.bannedBy === 'teamA' ? 'Time A' : 'Time B'}
                  </span>
                </div>
              )}

              {/* Decider Badge */}
              {isDecider && (
                <div className="absolute top-3 right-3 z-20">
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                    <Sparkles size={12} /> DECIDER
                  </span>
                </div>
              )}

              {/* Card Header */}
              <div className="relative z-10 p-4 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    {fullMapData.location || 'Competitivo'}
                  </span>
                  <h3 className="text-2xl font-black font-heading text-white tracking-wide">
                    {map.name}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400/90 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
                  {map.file}
                </span>
              </div>

              {/* Card Footer / Action */}
              <div className="relative z-10 p-4 pt-0">
                {!banned && phase === 'veto' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBan(map.id);
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                      turnIsTeamA
                        ? 'bg-sky-600 hover:bg-sky-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    <Ban size={14} />
                    <span>Banir {map.name}</span>
                  </button>
                )}

                {isDecider && (
                  <div className="w-full py-2 px-3 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 font-bold text-xs text-center">
                    🏆 Mapa Oficial da Partida
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ban History / Logs */}
      {bannedMaps.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Histórico do Pick & Ban
            </h4>
          </div>

          <div className="flex flex-wrap gap-2">
            {bannedMaps.map((b, idx) => {
              const m = maps.find((x) => x.id === b.mapId);
              return (
                <div
                  key={b.mapId}
                  className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300"
                >
                  <span className="font-mono text-slate-500">#{idx + 1}</span>
                  <span
                    className={`font-bold ${
                      b.bannedBy === 'teamA' ? 'text-sky-400' : 'text-amber-400'
                    }`}
                  >
                    {b.bannedBy === 'teamA' ? 'Time A' : 'Time B'}
                  </span>
                  <span className="text-slate-500">baniu</span>
                  <span className="text-rose-400 font-semibold line-through">
                    {m?.name || b.mapId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset Controls */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            if (soundEnabled) playClickSound();
            onResetMix();
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>Reiniciar Veto</span>
        </button>
      </div>
    </div>
  );
}
