import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CS2_MAPS } from '../data/maps';
import { Shield, Flame, Ban, Check, Sparkles, History, RotateCcw, Trophy, Swords, Copy } from 'lucide-react';
import { playBanSound, playFanfare, playPickSound, playClickSound } from '../utils/audio';
import { getTeamNames } from '../utils/teamNames';
import { getVetoSchedule, getOppositeTeam } from '../utils/proVeto';
import { copyText } from '../utils/clipboard';

export default function MapVeto({
  room,
  onBanMap,
  onSelectSide,
  onChangeVetoFormat,
  onResetMix,
  soundEnabled,
}) {
  const [copiedLog, setCopiedLog] = useState(false);

  const {
    maps = [],
    bannedMaps = [],
    pickedMaps = [],
    vetoLog = [],
    currentTurn = 'teamA',
    phase,
    finalMap,
    matchFormat = 'MD1',
    vetoFirstTeam = 'teamA',
    bo1Order = 'ABABAB',
    pendingSidePick = null,
  } = room;

  const { labelA, labelB, upperA, upperB } = getTeamNames(room);

  const schedule = getVetoSchedule(matchFormat, vetoFirstTeam, bo1Order);
  const completedActionsCount = bannedMaps.length + pickedMaps.length;
  const currentStepObj = schedule[Math.min(completedActionsCount, schedule.length - 1)] || schedule[0];

  const soundEnabledRef = React.useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Trigger celebration when decider map is crowned or series is ready
  useEffect(() => {
    if (phase === 'side_pick' || phase === 'finished') {
      if (soundEnabledRef.current) playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#38bdf8', '#ef4444', '#10b981'],
      });
    }
  }, [phase]);

  const isBanned = (mapId) => bannedMaps.some((b) => b.mapId === mapId);
  const getBanInfo = (mapId) => bannedMaps.find((b) => b.mapId === mapId);
  const isPicked = (mapId) => pickedMaps.some((p) => p.mapId === mapId);
  const getPickInfo = (mapId) => pickedMaps.find((p) => p.mapId === mapId);

  const isWaitingPickSide = Boolean(pendingSidePick && pendingSidePick.mapId);
  const isActionPick = currentStepObj?.type === 'pick';
  const activeTeam = isWaitingPickSide
    ? pendingSidePick.sidePickBy
    : phase === 'side_pick'
    ? (schedule[schedule.length - 1]?.sidePickBy || 'teamB')
    : (currentStepObj?.team === 'teamA' || currentStepObj?.team === 'teamB' ? currentStepObj.team : currentTurn);

  const turnIsTeamA = activeTeam === 'teamA';

  const handleMapAction = (mapId) => {
    if (phase !== 'veto' || isWaitingPickSide) return;
    if (isBanned(mapId) || isPicked(mapId)) return;
    if (soundEnabled) {
      if (isActionPick) playPickSound();
      else playBanSound();
    }
    onBanMap(mapId);
  };

  const handleSelectSide = (side) => {
    if (soundEnabled) playPickSound();
    onSelectSide(side);
  };

  const getTeamLabel = (teamCode) => (teamCode === 'teamA' ? labelA : labelB);
  const getTeamUpper = (teamCode) => (teamCode === 'teamA' ? upperA : upperB);

  // Format official HLTV text log
  const buildHltvLogText = () => {
    const lines = [`🏆 VETO OFICIAL CS2 (${matchFormat}) — ${labelA} vs ${labelB}`];
    if (vetoLog && vetoLog.length > 0) {
      vetoLog.forEach((entry, idx) => {
        const tName = getTeamLabel(entry.team);
        if (entry.type === 'ban') {
          lines.push(`${idx + 1}. ${tName} removeu ${entry.mapName}`);
        } else if (entry.type === 'pick') {
          const sideInfo = entry.sideTeamA
            ? ` (${labelA}: ${entry.sideTeamA} | ${labelB}: ${entry.sideTeamB})`
            : '';
          lines.push(`${idx + 1}. ${tName} escolheu ${entry.mapName}${sideInfo}`);
        } else if (entry.type === 'decider') {
          const sideInfo = entry.sideTeamA
            ? ` (${labelA}: ${entry.sideTeamA} | ${labelB}: ${entry.sideTeamB})`
            : '';
          lines.push(`${idx + 1}. ${entry.mapName} sobrou como Decider${sideInfo}`);
        }
      });
    } else {
      bannedMaps.forEach((b, idx) => {
        const m = maps.find((x) => x.id === b.mapId) || CS2_MAPS.find((x) => x.id === b.mapId);
        lines.push(`${idx + 1}. ${getTeamLabel(b.bannedBy)} removeu ${m?.name || b.mapId}`);
      });
    }
    return lines.join('\n');
  };

  const handleCopyHltvLog = () => {
    if (soundEnabled) playClickSound();
    copyText(buildHltvLogText());
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const pendingMapObj = pendingSidePick
    ? maps.find((m) => m.id === pendingSidePick.mapId) || CS2_MAPS.find((m) => m.id === pendingSidePick.mapId)
    : null;

  const deciderSidePicker = schedule[schedule.length - 1]?.sidePickBy || 'teamB';

  return (
    <div className="space-y-5">
      {/* Top Format & Pro Rule Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Swords size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black font-heading text-white uppercase tracking-wider">
                Pick & Ban Oficial CS2 • Formato {matchFormat}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                PADRÃO VALVE MAJOR / HLTV
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {matchFormat === 'MD1' && 'Regra Pro MD1: 6 Bans alternados + 1 Mapa Decider com escolha de lado'}
              {matchFormat === 'MD3' && 'Regra Pro MD3: 2 Bans ➔ 2 Picks (adversário escolhe lado) ➔ 2 Bans ➔ 1 Decider'}
              {matchFormat === 'MD5' && 'Regra Pro MD5: 2 Bans ➔ 4 Picks (adversário escolhe lado) ➔ 1 Decider'}
            </p>
          </div>
        </div>

        {/* Format Switcher Pill */}
        {onChangeVetoFormat && (
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['MD1', 'MD3', 'MD5'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  onChangeVetoFormat(fmt);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-black transition-all cursor-pointer ${
                  matchFormat === fmt
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={`Alternar formato do Veto para ${fmt}`}
              >
                {fmt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 7-STEP OFFICIAL BROADCAST VETO TIMELINE */}
      <div className="bg-[#0b111e] border border-slate-800 rounded-2xl p-3 shadow-xl overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[640px]">
          {schedule.map((st, idx) => {
            const logItem = vetoLog?.[idx];
            const isCurrent = phase === 'veto' && idx === completedActionsCount && !isWaitingPickSide;
            const isSelectingSideNow = isWaitingPickSide && idx === completedActionsCount - 1;
            const isDeciderStep = st.type === 'decider';
            const isCompleted = idx < completedActionsCount || (isDeciderStep && (phase === 'side_pick' || phase === 'finished'));

            const stepTeamLabel = st.team === 'teamA' ? labelA : st.team === 'teamB' ? labelB : 'Decider';
            const isBan = st.type === 'ban';
            const isPick = st.type === 'pick';

            return (
              <div
                key={st.step}
                className={`relative rounded-xl border p-2 flex flex-col justify-between transition-all ${
                  isCurrent || isSelectingSideNow
                    ? isPick
                      ? 'bg-emerald-950/50 border-emerald-400 ring-2 ring-emerald-400/30 shadow-lg'
                      : 'bg-amber-950/50 border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                    : isCompleted
                    ? isBan
                      ? 'bg-slate-950/90 border-rose-500/40'
                      : isPick
                      ? 'bg-emerald-950/25 border-emerald-500/50'
                      : 'bg-amber-950/30 border-amber-500/50'
                    : 'bg-slate-950/50 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400">#{st.step}</span>
                  <span
                    className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded ${
                      isBan
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isPick
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isBan ? 'BAN' : isPick ? `MAPA ${st.mapNumber}` : 'DECIDER'}
                  </span>
                </div>

                <div className="my-1 text-center">
                  {logItem ? (
                    <>
                      <div
                        className={`text-xs font-black font-heading uppercase truncate ${
                          isBan ? 'text-rose-400 line-through' : isPick ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {logItem.mapName}
                      </div>
                      {logItem.sideTeamA && (
                        <div className="text-[9px] font-mono text-slate-300 mt-0.5 truncate">
                          {logItem.knifeRound ? '🔪 Round Faca' : `A:${logItem.sideTeamA} / B:${logItem.sideTeamB}`}
                        </div>
                      )}
                    </>
                  ) : isDeciderStep && finalMap ? (
                    <div className="text-xs font-black font-heading uppercase text-amber-300 truncate">
                      {finalMap.name}
                    </div>
                  ) : (
                    <div className="text-[11px] font-bold text-slate-500">
                      {isCurrent ? (isPick ? 'Escolhendo...' : 'Banindo...') : 'Aguardando'}
                    </div>
                  )}
                </div>

                <div className="text-[9px] font-mono text-slate-400 truncate text-center border-t border-white/5 pt-1">
                  {stepTeamLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Turn & Status Header Banner (When picking or banning a map) */}
      {phase === 'veto' && !isWaitingPickSide && (
        <div
          className={`border-2 rounded-2xl p-5 text-center transition-all shadow-xl backdrop-blur ${
            isActionPick
              ? 'bg-emerald-950/40 border-emerald-500/70 shadow-emerald-500/15'
              : turnIsTeamA
              ? 'bg-sky-950/40 border-sky-500/60 shadow-sky-500/10'
              : 'bg-amber-950/40 border-amber-500/60 shadow-amber-500/10'
          }`}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-950/80 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
            <span>
              Passo {currentStepObj.step} de 7 • {currentStepObj.label} • Pool Oficial Valve
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mb-1">
            {isActionPick ? (
              <Check size={24} className="text-emerald-400 animate-bounce" />
            ) : turnIsTeamA ? (
              <Shield size={22} className="text-sky-400 animate-pulse" />
            ) : (
              <Flame size={22} className="text-amber-400 animate-pulse" />
            )}
            <h2
              className={`text-xl sm:text-2xl font-black font-heading tracking-wider uppercase ${
                isActionPick ? 'text-emerald-300' : turnIsTeamA ? 'text-sky-300' : 'text-amber-300'
              }`}
            >
              {isActionPick
                ? `Vez do ${turnIsTeamA ? upperA : upperB} ESCOLHER (PICK) o Mapa ${currentStepObj.mapNumber}`
                : `Vez do ${turnIsTeamA ? upperA : upperB} BANIR um Mapa`}
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            {isActionPick ? (
              <>
                Clique no mapa que sua equipe quer <strong>JOGAR como Mapa {currentStepObj.mapNumber}</strong> da série {matchFormat}. Em seguida, o adversário escolherá o lado inicial (CT/TR).
              </>
            ) : (
              <>
                Clique no mapa que sua equipe deseja <strong>ELIMINAR</strong> da disputa. Restam{' '}
                <strong className="text-white font-mono">{maps.length - bannedMaps.length - pickedMaps.length} mapas</strong> disponíveis.
              </>
            )}
          </p>
        </div>
      )}

      {/* Opponent Side Selection Phase after a Map Pick (MD3 / MD5) */}
      {phase === 'veto' && isWaitingPickSide && pendingMapObj && (
        <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/70 border-2 border-emerald-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-fadeIn">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider mb-2">
              <Check size={14} /> Mapa {pendingSidePick.mapNumber} Escolhido pelo {getTeamLabel(pendingSidePick.pickedBy)}!
            </div>
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-wide">
              {pendingMapObj.name.toUpperCase()} (MAPA {pendingSidePick.mapNumber})
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1">
              Pela regra oficial da Valve, como o <strong>{getTeamLabel(pendingSidePick.pickedBy)}</strong> escolheu o mapa, o{' '}
              <strong className="text-amber-400 font-bold">{getTeamUpper(pendingSidePick.sidePickBy)}</strong> escolhe de qual lado vai começar em {pendingMapObj.name}:
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleSelectSide('CT')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Shield size={18} />
              <span>{getTeamLabel(pendingSidePick.sidePickBy)} começa de CT (Defesa)</span>
            </button>

            <button
              onClick={() => handleSelectSide('TR')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Flame size={18} />
              <span>{getTeamLabel(pendingSidePick.sidePickBy)} começa de TR (Ataque)</span>
            </button>

            <button
              onClick={() => handleSelectSide('KNIFE')}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Swords size={16} className="text-amber-400" />
              <span>🔪 Definir na Faca (Knife)</span>
            </button>
          </div>
        </div>
      )}

      {/* Side Selection Phase for Decider Map (When 1 map remains) */}
      {phase === 'side_pick' && finalMap && (
        <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border-2 border-amber-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-glow">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} /> Mapa Decisivo ({matchFormat === 'MD3' ? 'Mapa 3 - Decider' : matchFormat === 'MD5' ? 'Mapa 5 - Decider' : 'Decider MD1'}) Definido!
            </div>
            <h2 className="text-3xl font-extrabold font-heading text-white tracking-wide">
              {finalMap.name.toUpperCase()}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1">
              Defina o lado inicial do <strong className="text-amber-400 font-bold">{getTeamUpper(deciderSidePicker)}</strong> no mapa decisivo (ou selecione <strong>Round Faca</strong>):
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleSelectSide('CT')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Shield size={18} />
              <span>{getTeamLabel(deciderSidePicker)} começa de CT (Defesa)</span>
            </button>

            <button
              onClick={() => handleSelectSide('TR')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Flame size={18} />
              <span>{getTeamLabel(deciderSidePicker)} começa de TR (Ataque)</span>
            </button>

            <button
              onClick={() => handleSelectSide('KNIFE')}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Swords size={16} className="text-amber-400" />
              <span>🔪 Round Faca (Knife Round)</span>
            </button>
          </div>
        </div>
      )}

      {/* Maps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {maps.map((map) => {
          const banned = isBanned(map.id);
          const banInfo = getBanInfo(map.id);
          const picked = isPicked(map.id);
          const pickInfo = getPickInfo(map.id);
          const isDecider = finalMap && finalMap.id === map.id && !picked;
          const fullMapData = CS2_MAPS.find((m) => m.id === map.id) || map;

          return (
            <div
              key={map.id}
              className={`group relative overflow-hidden rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[230px] ${
                isDecider
                  ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl scale-[1.02]'
                  : picked
                  ? 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-xl shadow-emerald-500/10'
                  : banned
                  ? 'border-slate-800/80 bg-slate-950/80 opacity-60 grayscale'
                  : isActionPick
                  ? 'border-slate-700/80 hover:border-emerald-400 bg-slate-900 shadow-lg hover:shadow-emerald-500/15 cursor-pointer'
                  : 'border-slate-700/80 hover:border-amber-400/80 bg-slate-900 shadow-lg hover:shadow-amber-500/10 cursor-pointer'
              }`}
              onClick={() => !banned && !picked && phase === 'veto' && !isWaitingPickSide && handleMapAction(map.id)}
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
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px]">
                  <div className="border-4 border-rose-500 text-rose-500 font-heading font-black text-2xl px-4 py-1.5 rounded-lg map-card-stamp uppercase tracking-widest">
                    BANIDO
                  </div>
                  <span className="text-xs font-semibold text-rose-300 mt-3 bg-rose-950/90 px-2.5 py-0.5 rounded border border-rose-500/30">
                    Banido por {banInfo?.bannedBy === 'teamA' ? labelA : labelB}
                  </span>
                </div>
              )}

              {/* Picked Map Badge (MD3 / MD5) */}
              {picked && (
                <div className="absolute top-3 right-3 z-20">
                  <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                    <Check size={12} strokeWidth={3} /> MAPA {pickInfo?.mapNumber || 1} (PICK)
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
                <div className="flex items-center gap-3">
                  {fullMapData.logo && (
                    <img
                      src={fullMapData.logo}
                      alt={map.name}
                      className="w-10 h-10 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110"
                    />
                  )}
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 block">
                      {fullMapData.location || 'Competitivo'}
                    </span>
                    <h3 className="text-2xl font-black font-heading text-white tracking-wide drop-shadow-md">
                      {map.name}
                    </h3>
                  </div>
                </div>
                {!picked && !isDecider && (
                  <span className="text-xs font-mono font-bold text-amber-400/90 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/60 shadow">
                    {map.file}
                  </span>
                )}
              </div>

              {/* Card Footer / Action */}
              <div className="relative z-10 p-4 pt-0">
                {!banned && !picked && phase === 'veto' && !isWaitingPickSide && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMapAction(map.id);
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                      isActionPick
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-emerald-500/25'
                        : turnIsTeamA
                        ? 'bg-sky-600 hover:bg-sky-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isActionPick ? (
                      <>
                        <Check size={15} strokeWidth={3} />
                        <span>Escolher {map.name} (Mapa {currentStepObj.mapNumber})</span>
                      </>
                    ) : (
                      <>
                        <Ban size={14} />
                        <span>Banir {map.name}</span>
                      </>
                    )}
                  </button>
                )}

                {picked && (
                  <div className="w-full p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs space-y-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>Pick: {getTeamLabel(pickInfo?.pickedBy)}</span>
                      <span className="text-[10px] font-mono text-emerald-400">Mapa {pickInfo?.mapNumber}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 flex items-center justify-between pt-1 border-t border-emerald-500/20">
                      {pickInfo?.sideTeamA ? (
                        pickInfo.knifeRound ? (
                          <span className="text-amber-300 font-bold">🔪 Lado definido na Faca</span>
                        ) : (
                          <>
                            <span className="text-sky-300">{labelA}: {pickInfo.sideTeamA}</span>
                            <span className="text-amber-300">{labelB}: {pickInfo.sideTeamB}</span>
                          </>
                        )
                      ) : (
                        <span className="text-amber-300 animate-pulse">Escolhendo lado inicial...</span>
                      )}
                    </div>
                  </div>
                )}

                {isDecider && (
                  <div className="w-full py-2 px-3 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 font-bold text-xs text-center">
                    🏆 Mapa Decider ({matchFormat === 'MD3' ? 'Mapa 3' : matchFormat === 'MD5' ? 'Mapa 5' : 'Mapa Único'})
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Official HLTV Veto History Log */}
      {(vetoLog.length > 0 || bannedMaps.length > 0) && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <History size={16} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-heading">
                Histórico Oficial do Veto (Padrão HLTV / Major)
              </h4>
            </div>
            <button
              type="button"
              onClick={handleCopyHltvLog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              {copiedLog ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedLog ? 'Log HLTV Copiado!' : 'Copiar Log HLTV'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(vetoLog.length > 0 ? vetoLog : bannedMaps.map((b, i) => {
              const m = maps.find((x) => x.id === b.mapId) || CS2_MAPS.find((x) => x.id === b.mapId);
              return {
                step: i + 1,
                type: 'ban',
                team: b.bannedBy,
                mapId: b.mapId,
                mapName: m?.name || b.mapId,
              };
            })).map((entry, idx) => {
              const m = maps.find((x) => x.id === entry.mapId) || CS2_MAPS.find((x) => x.id === entry.mapId);
              const isBan = entry.type === 'ban';
              const isPick = entry.type === 'pick';
              return (
                <div
                  key={`${entry.mapId}-${idx}`}
                  className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 border shadow-sm ${
                    isBan
                      ? 'bg-slate-950/90 border-slate-800 text-slate-300'
                      : isPick
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-500 font-bold">#{idx + 1}</span>
                  {m?.logo && (
                    <img src={m.logo} alt={m.name} className={`w-4 h-4 object-contain ${isBan ? 'filter grayscale' : ''}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`font-bold font-mono text-[11px] ${
                        entry.team === 'teamA' ? 'text-sky-400' : entry.team === 'teamB' ? 'text-amber-400' : 'text-amber-300'
                      }`}
                    >
                      {entry.team === 'auto' ? 'Decider' : getTeamLabel(entry.team)}
                    </span>{' '}
                    <span className="text-slate-400 text-[10px]">
                      {isBan ? 'removeu' : isPick ? 'escolheu' : 'definido em'}
                    </span>{' '}
                    <span
                      className={`font-bold font-mono ${
                        isBan ? 'text-rose-400 line-through' : isPick ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {entry.mapName}
                    </span>
                    {entry.sideTeamA && (
                      <span className="block text-[10px] font-mono text-slate-400">
                        {entry.knifeRound ? '🔪 Round Faca' : `Lados: ${labelA} (${entry.sideTeamA}) vs ${labelB} (${entry.sideTeamB})`}
                      </span>
                    )}
                  </div>
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
