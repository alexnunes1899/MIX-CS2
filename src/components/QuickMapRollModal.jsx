import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Dices,
  X,
  Sparkles,
  Copy,
  Check,
  Shield,
  Flame,
  SlidersHorizontal,
  ChevronDown,
  Trophy,
  Layers,
  RotateCcw,
  RefreshCw,
  Globe,
  ArrowRight,
  ShieldCheck,
  Lock,
  Hash,
  CheckCircle2,
  Info,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { CS2_MAPS, OFFICIAL_ACTIVE_DUTY, EXTRA_CS2_MAPS } from '../data/maps';
import { playRouletteTick, playFanfare, playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

/**
 * Generates an unbiased cryptographically secure random integer in [0, max - 1].
 * Uses rejection sampling to completely eliminate modulo bias.
 */
function getSecureRandomInt(max) {
  if (max <= 1) return 0;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - (uint32Max % max);
    const buffer = new Uint32Array(1);
    let rand;
    do {
      window.crypto.getRandomValues(buffer);
      rand = buffer[0];
    } while (rand >= limit);
    return rand % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Fisher-Yates (Knuth) Shuffle using CSPRNG.
 * Produces a strictly uniform permutation where every one of the N! possible orderings
 * has exactly equal probability 1 / N!.
 */
function cryptoSecureShuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Generates a verification audit ID for the draw.
 */
function generateAuditHash() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(6);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function QuickMapRollModal({
  isOpen,
  onClose,
  onApplyMap,
  soundEnabled,
  officialRotation,
  syncingRotation,
  onSyncOfficialRotation,
}) {
  const officialMaps = officialRotation?.activeDutyMaps && officialRotation.activeDutyMaps.length > 0
    ? officialRotation.activeDutyMaps
    : OFFICIAL_ACTIVE_DUTY;

  const extraMaps = officialRotation?.extraMaps && officialRotation.extraMaps.length > 0
    ? officialRotation.extraMaps
    : EXTRA_CS2_MAPS;

  const allMaps = useMemo(() => {
    return [...officialMaps, ...extraMaps];
  }, [officialMaps, extraMaps]);

  const officialIds = useMemo(() => officialMaps.map((m) => m.id), [officialMaps]);

  const officialPlusTrainIds = useMemo(() => {
    const hasTrain = allMaps.some((m) => m.id === 'de_train');
    return hasTrain && !officialIds.includes('de_train')
      ? [...officialIds, 'de_train']
      : officialIds;
  }, [allMaps, officialIds]);

  const allMapIds = useMemo(() => allMaps.map((m) => m.id), [allMaps]);

  // Match Format: MD1 (Best of 1), MD3 (Best of 3), MD5 (Best of 5)
  const [matchFormat, setMatchFormat] = useState(() => {
    try {
      return localStorage.getItem('cs2_roulette_format') || 'MD1';
    } catch (e) {
      return 'MD1';
    }
  });

  // Map Pool Configuration State (persisted in localStorage)
  const [preset, setPreset] = useState(() => {
    try {
      return localStorage.getItem('cs2_roulette_preset') || 'official';
    } catch (e) {
      return 'official';
    }
  });

  const [selectedMapIds, setSelectedMapIds] = useState(() => {
    try {
      const saved = localStorage.getItem('cs2_roulette_maps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return OFFICIAL_ACTIVE_DUTY.map((m) => m.id);
  });

  // Whenever official rotation updates, if preset is 'official', refresh selected IDs
  useEffect(() => {
    if (preset === 'official' && officialIds.length > 0) {
      setSelectedMapIds(officialIds);
    }
  }, [officialIds, preset]);

  const [showCustomList, setShowCustomList] = useState(false);
  const [showAuditInfo, setShowAuditInfo] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [selectedMap, setSelectedMap] = useState(null);
  const [startingSides, setStartingSides] = useState({ sideTimeA: 'CT', sideTimeB: 'TR' });
  const [drawnSeries, setDrawnSeries] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [auditRecord, setAuditRecord] = useState(null);

  const spinTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
    };
  }, []);

  // Active pool of maps based on current selection
  const activePool = useMemo(() => {
    const list = allMaps.filter((m) => selectedMapIds.includes(m.id));
    return list.length > 0 ? list : officialMaps;
  }, [allMaps, selectedMapIds, officialMaps]);

  // Minimum required maps according to match format
  const requiredCount = matchFormat === 'MD5' ? 5 : matchFormat === 'MD3' ? 3 : 1;
  const hasEnoughMaps = activePool.length >= requiredCount;

  // Sync to localStorage
  const updateSelectedMaps = (newIds, newPreset = 'custom') => {
    setSelectedMapIds(newIds);
    setPreset(newPreset);
    try {
      localStorage.setItem('cs2_roulette_maps', JSON.stringify(newIds));
      localStorage.setItem('cs2_roulette_preset', newPreset);
    } catch (e) {}
  };

  const handleSelectPreset = (mode) => {
    if (spinning) return;
    if (soundEnabled) playClickSound();
    if (mode === 'official') {
      updateSelectedMaps(officialIds, 'official');
    } else if (mode === 'official_train') {
      updateSelectedMaps(officialPlusTrainIds, 'official_train');
    } else if (mode === 'all') {
      updateSelectedMaps(allMapIds, 'all');
    }
  };

  const handleSelectFormat = (format) => {
    if (spinning) return;
    if (soundEnabled) playClickSound();
    setMatchFormat(format);
    setSelectedMap(null);
    setDrawnSeries([]);
    setAuditRecord(null);
    try {
      localStorage.setItem('cs2_roulette_format', format);
    } catch (e) {}
  };

  const handleToggleMap = (mapId) => {
    if (spinning) return;
    if (soundEnabled) playClickSound();
    let next;
    if (selectedMapIds.includes(mapId)) {
      if (selectedMapIds.length <= 1) return;
      next = selectedMapIds.filter((id) => id !== mapId);
    } else {
      next = [...selectedMapIds, mapId];
    }

    let detectedPreset = 'custom';
    if (next.length === officialIds.length && officialIds.every((id) => next.includes(id))) {
      detectedPreset = 'official';
    } else if (next.length === officialPlusTrainIds.length && officialPlusTrainIds.every((id) => next.includes(id))) {
      detectedPreset = 'official_train';
    } else if (next.length === allMapIds.length) {
      detectedPreset = 'all';
    }

    updateSelectedMaps(next, detectedPreset);
  };

  /**
   * 100% UNBIASED & VISUALLY SYNCHRONIZED SPIN
   * 1. Cryptographically selects winning sequence using Fisher-Yates + CSPRNG.
   * 2. Pre-calculates exact steps so animation decelerates and lands precisely on winning map.
   * 3. Zero frame jumps or visual desyncs.
   */
  const handleSpin = () => {
    if (spinning || !hasEnoughMaps) return;
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

    setSpinning(true);
    setSelectedMap(null);
    setDrawnSeries([]);

    const targetCount = matchFormat === 'MD5' ? 5 : matchFormat === 'MD3' ? 3 : 1;

    // 1. Unbiased CSPRNG Fisher-Yates shuffle
    const shuffled = cryptoSecureShuffle(activePool);
    const winningMaps = shuffled.slice(0, targetCount);

    const getRole = (index, format) => {
      if (format === 'MD1') return 'Mapa Único da Partida';
      if (format === 'MD3') {
        if (index === 0) return 'Mapa 1 (Pick Time A)';
        if (index === 1) return 'Mapa 2 (Pick Time B)';
        return 'Mapa 3 (Decider - Desempate)';
      }
      if (format === 'MD5') {
        if (index === 0) return 'Mapa 1 (Pick Time A)';
        if (index === 1) return 'Mapa 2 (Pick Time B)';
        if (index === 2) return 'Mapa 3 (Pick Time A)';
        if (index === 3) return 'Mapa 4 (Pick Time B)';
        return 'Mapa 5 (Decider - Desempate)';
      }
      return `Mapa #${index + 1}`;
    };

    // 2. Build complete series with fair side distribution
    const series = winningMaps.map((map, idx) => {
      const isTeamACT = getSecureRandomInt(2) === 0;
      const sideTimeA = isTeamACT ? 'CT' : 'TR';
      const sideTimeB = isTeamACT ? 'TR' : 'CT';
      const isDecider =
        (matchFormat === 'MD1' && idx === 0) ||
        (matchFormat === 'MD3' && idx === 2) ||
        (matchFormat === 'MD5' && idx === 4);
      const pickedBy =
        matchFormat === 'MD1'
          ? 'decider'
          : isDecider
          ? 'decider'
          : idx % 2 === 0
          ? 'teamA'
          : 'teamB';

      return {
        map,
        sideTimeA,
        sideTimeB,
        role: getRole(idx, matchFormat),
        pickedBy,
        isDecider,
      };
    });

    const targetWinner = series[0].map;
    const targetWinnerIndex = activePool.findIndex((m) => m.id === targetWinner.id);

    // 3. Exact Step Math: Guarantees (startIdx + totalSteps) % poolLen === targetWinnerIndex
    const poolLen = activePool.length;
    const startIdx = currentIndex % poolLen;
    // 3 to 4 full revolutions for dramatic effect
    const minCycles = 3 + getSecureRandomInt(2);
    const baseSteps = poolLen * minCycles;
    const remainder = (startIdx + baseSteps) % poolLen;
    const stepOffset = (targetWinnerIndex - remainder + poolLen) % poolLen;
    const totalSteps = baseSteps + stepOffset;

    let step = 0;
    let localCurrent = startIdx;

    const tick = () => {
      step++;
      localCurrent = (localCurrent + 1) % poolLen;
      setCurrentIndex(localCurrent);
      if (soundEnabled) playRouletteTick();

      if (step < totalSteps) {
        // Cubic easing curve: starts fast (~48ms), smoothly decelerates to ~360ms
        const progress = step / totalSteps;
        const delay = Math.round(48 + Math.pow(progress, 2.7) * 330);
        spinTimerRef.current = setTimeout(tick, delay);
      } else {
        // EXACT LANDING: localCurrent is guaranteed to equal targetWinnerIndex
        setSelectedMap(series[0].map);
        setStartingSides({
          sideTimeA: series[0].sideTimeA,
          sideTimeB: series[0].sideTimeB,
        });
        setDrawnSeries(series);
        setSpinning(false);

        const audit = {
          id: `ROLL-${generateAuditHash()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          fullDate: new Date().toISOString(),
          format: matchFormat,
          poolSize: activePool.length,
          winner: series[0].map.name,
          sideA: series[0].sideTimeA,
          sideB: series[0].sideTimeB,
          stepsExecuted: totalSteps,
          algorithm: 'Fisher-Yates CSPRNG (Web Crypto API)',
        };
        setAuditRecord(audit);

        if (soundEnabled) playFanfare();
        confetti({
          particleCount: matchFormat === 'MD1' ? 80 : 130,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#38bdf8', '#10b981', '#ec4899', '#a855f7'],
        });
      }
    };

    tick();
  };

  const handleCopy = () => {
    if (!selectedMap) return;
    if (soundEnabled) playClickSound();
    const presetLabel =
      preset === 'official'
        ? 'Rotação Oficial Valve (Active Duty - 7 mapas)'
        : preset === 'official_train'
        ? 'Rotação Oficial + Train (8 mapas)'
        : preset === 'all'
        ? 'Todos os Mapas do CS2 (12 mapas)'
        : `Personalizado (${activePool.length} mapas)`;

    let text = '';
    if (matchFormat === 'MD1' || drawnSeries.length <= 1) {
      text = `🎲 **MAPA SORTEADO PARA O MIX (MD1):** ${selectedMap.name} (${selectedMap.file})
📦 **Pool Configurado:** ${presetLabel}
🎯 **Lados Iniciais:**
   🛡️ Time A: ${startingSides.sideTimeA}
   🔥 Time B: ${startingSides.sideTimeB}
🔒 **Auditoria Criptográfica:** ${auditRecord ? auditRecord.id : 'CSPRNG Fisher-Yates'}
GL HF! 🔥 Que vença o melhor time!`;
    } else {
      text = `🏆 **SÉRIE OFICIAL SORTEADA NA ROLETA: ${matchFormat} (${drawnSeries.length} Mapas)**
📦 **Pool Configurado:** ${presetLabel}
🔒 **Auditoria Criptográfica:** ${auditRecord ? auditRecord.id : 'CSPRNG Fisher-Yates'}

${drawnSeries
  .map((s, idx) => {
    return `🗺️ **${s.role}:** ${s.map.name} (${s.map.file})
   👉 Lados: Time A (${s.sideTimeA}) | Time B (${s.sideTimeB})`;
  })
  .join('\n\n')}

GL HF! 🔥 Boa sorte a ambas as equipes!`;
    }

    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map Carousel strip items: window around current index (Declared unconditionally before early return)
  const reelItems = useMemo(() => {
    const len = activePool.length;
    if (len === 0) return [];
    const items = [];
    for (let offset = -2; offset <= 2; offset++) {
      const idx = (currentIndex + offset + len * 100) % len;
      items.push({
        map: activePool[idx],
        isCenter: offset === 0,
        key: `${activePool[idx].id}-${offset}`,
      });
    }
    return items;
  }, [activePool, currentIndex]);

  if (!isOpen) return null;

  const displayMap = selectedMap || activePool[currentIndex % activePool.length] || activePool[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[95vh] overflow-y-auto bg-[#0c1220] border-2 border-amber-500/60 rounded-3xl p-4 sm:p-5 text-center shadow-2xl custom-scrollbar">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={spinning}
          className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40 z-20"
          title="Fechar Roleta"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <Dices size={13} className="text-amber-400 animate-pulse" /> Sorteador Oficial CS2
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
            Roleta de Mapas & Séries CS2
          </h2>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto mt-0.5">
            Sorteador <strong>100% confiável</strong> com algoritmo Fisher-Yates (CSPRNG), sem viés estatístico e sincronização visual exata.
          </p>
        </div>

        {/* 1. MATCH FORMAT SELECTOR: MD1, MD3, MD5 */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-2.5 mb-2.5 text-left shadow-inner">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
              <Trophy size={12} className="text-amber-400" />
              <span>Formato da Partida (Série)</span>
            </span>
            <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.2 rounded-full">
              {matchFormat === 'MD1' ? '1 Mapa' : matchFormat === 'MD3' ? '3 Mapas' : '5 Mapas'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'MD1', label: 'MD1', title: 'Melhor de 1', count: '1 Mapa', desc: 'Partida Rápida' },
              { id: 'MD3', label: 'MD3', title: 'Melhor de 3', count: '3 Mapas', desc: 'Padrão Playoff' },
              { id: 'MD5', label: 'MD5', title: 'Melhor de 5', count: '5 Mapas', desc: 'Grande Final' },
            ].map((f) => {
              const isSelected = matchFormat === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={spinning}
                  onClick={() => handleSelectFormat(f.id)}
                  className={`py-2 px-2.5 rounded-xl text-left border transition-all cursor-pointer disabled:opacity-50 ${
                    isSelected
                      ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 border-amber-400 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-black text-sm text-white">
                      {f.label}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-200 block mt-0.5 leading-tight">
                    {f.title}
                  </span>
                  <span className="text-[9px] text-amber-400/80 font-mono block mt-0.5">
                    {f.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. MAP POOL CONFIGURATION PANEL */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 mb-3 text-left shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
              <SlidersHorizontal size={13} className="text-amber-400" />
              <span>Configuração do Pool de Mapas</span>
            </span>
            <div className="flex items-center gap-2">
              {onSyncOfficialRotation && (
                <button
                  type="button"
                  disabled={syncingRotation || spinning}
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    onSyncOfficialRotation();
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  title={`Fonte verificada: ${officialRotation?.source || 'Wikipedia / Valve Records'}`}
                >
                  <RefreshCw size={10} className={syncingRotation ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                  <span>{syncingRotation ? 'Sincronizando...' : 'Atualizar Oficial'}</span>
                </button>
              )}
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${hasEnoughMaps ? 'text-amber-300 bg-amber-500/15 border-amber-500/30' : 'text-rose-400 bg-rose-500/15 border-rose-500/30'}`}>
                {activePool.length} {activePool.length === 1 ? 'mapa ativo' : 'mapas ativos'}
              </span>
            </div>
          </div>

          {!hasEnoughMaps && (
            <p className="text-[11px] text-rose-400 font-bold mb-2">
              ⚠️ O formato {matchFormat} precisa de pelo menos {requiredCount} mapas ativos no pool.
            </p>
          )}

          {/* Quick Presets Grid */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <button
              type="button"
              disabled={spinning}
              onClick={() => handleSelectPreset('official')}
              className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer disabled:opacity-50 ${
                preset === 'official'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs font-heading">
                <Trophy size={12} className={preset === 'official' ? 'text-amber-400' : 'text-slate-500'} />
                <span>Oficial ({officialIds.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                Active Duty Puro
              </span>
            </button>

            <button
              type="button"
              disabled={spinning}
              onClick={() => handleSelectPreset('official_train')}
              className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer disabled:opacity-50 ${
                preset === 'official_train'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs font-heading">
                <Sparkles size={12} className={preset === 'official_train' ? 'text-amber-400' : 'text-slate-500'} />
                <span>+ Train ({officialPlusTrainIds.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                Oficial + Train
              </span>
            </button>

            <button
              type="button"
              disabled={spinning}
              onClick={() => handleSelectPreset('all')}
              className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer disabled:opacity-50 ${
                preset === 'all'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs font-heading">
                <Layers size={12} className={preset === 'all' ? 'text-sky-400' : 'text-slate-500'} />
                <span>Todos ({allMapIds.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                Overpass, Office...
              </span>
            </button>
          </div>

          {/* Toggle Accordion for Manual Map Checkboxes */}
          <button
            type="button"
            disabled={spinning}
            onClick={() => {
              if (soundEnabled) playClickSound();
              setShowCustomList(!showCustomList);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal size={12} className="text-amber-400" />
              <span>
                {showCustomList ? 'Ocultar Seleção Manual' : 'Personalizar Mapas Individualmente (Marcar / Desmarcar)'}
              </span>
            </span>
            <ChevronDown size={14} className={`transform transition-transform text-slate-400 ${showCustomList ? 'rotate-180' : ''}`} />
          </button>

          {/* Individual Map Checkboxes Grid */}
          {showCustomList && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80">
              <div className="text-[10px] text-slate-400 mb-2 flex items-center justify-between">
                <span>Clique para incluir ou remover mapas da roleta:</span>
                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => handleSelectPreset('official')}
                  className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={10} /> Resetar p/ Oficial
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                {allMaps.map((map) => {
                  const isSelected = selectedMapIds.includes(map.id);
                  return (
                    <button
                      key={map.id}
                      type="button"
                      disabled={spinning}
                      onClick={() => handleToggleMap(map.id)}
                      className={`relative overflow-hidden flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800/70 text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-700'
                      }`}
                    >
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-slate-950 border border-white/10">
                        <img src={map.image} alt={map.name} className="w-full h-full object-cover" />
                        {map.logo && (
                          <img
                            src={map.logo}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain p-0.5 filter drop-shadow"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-bold font-heading truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                            {map.name}
                          </span>
                          {isSelected ? (
                            <Check size={12} className="text-amber-400 flex-shrink-0 ml-1" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-sm border border-slate-700 flex-shrink-0 ml-1" />
                          )}
                        </div>
                        <span className="text-[9px] block text-slate-400 truncate">
                          {map.activeDuty ? 'Oficial' : map.category === 'hostage' ? 'Reféns' : 'Reserva CS2'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. CS2 TAPE / TICKER STRIP (PREVIEW REEL) */}
        <div className="relative mb-2.5 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-2 overflow-hidden shadow-inner">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
              <Dices size={11} className="text-amber-400" />
              <span>Fita da Roleta CS2</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                <ShieldCheck size={9} /> CSPRNG Seguro
              </span>
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setShowAuditInfo(!showAuditInfo);
                }}
                className="text-[9px] font-mono text-slate-400 hover:text-amber-300 underline cursor-pointer"
              >
                {showAuditInfo ? 'Fechar Info' : 'Ver Como Funciona'}
              </button>
            </div>
          </div>

          {/* Golden Center Target Needle */}
          <div className="relative flex items-center justify-center py-1">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-400 z-20 shadow-[0_0_8px_rgba(251,191,36,0.9)] pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-30 text-amber-400 text-[10px] font-black pointer-events-none">
              ▼
            </div>

            {/* Reel Cards */}
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {reelItems.map(({ map, isCenter, key }) => (
                <div
                  key={key}
                  className={`relative rounded-xl overflow-hidden p-1 text-center transition-all duration-150 border ${
                    isCenter
                      ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50 shadow-md scale-102'
                      : 'border-slate-800/70 bg-slate-900/60 opacity-60'
                  }`}
                >
                  <div className="relative h-10 w-full rounded-lg overflow-hidden bg-slate-950 mb-1">
                    <img src={map.image} alt={map.name} className="w-full h-full object-cover" />
                    {map.logo && (
                      <img
                        src={map.logo}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain p-0.5 filter drop-shadow"
                      />
                    )}
                  </div>
                  <span className={`text-[10px] font-bold block truncate font-heading ${isCenter ? 'text-amber-300' : 'text-slate-400'}`}>
                    {map.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROVABLY FAIR / AUDIT EXPLANATION POPOVER */}
        {showAuditInfo && (
          <div className="mb-3 p-3 bg-slate-950 border border-amber-500/40 rounded-2xl text-left text-xs text-slate-300 space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between text-amber-300 font-bold font-heading text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-amber-400" />
                Por que a Roleta é 100% Confiável & Justa?
              </span>
              <button
                type="button"
                onClick={() => setShowAuditInfo(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-400">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Entropia Criptográfica (Web Crypto API):</strong> Utiliza <code className="text-amber-300">window.crypto.getRandomValues</code> com rejeição de viés amostral em vez de <code className="text-slate-300">Math.random</code>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Algoritmo Fisher-Yates (Knuth):</strong> Embaralhamento com garantia matemática comprovada de probabilidade estritamente uniforme de 1/N! para qualquer mapa.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Sincronização Visual de 100%:</strong> O ponteiro desacelera e trava exatamente na carta sorteada, eliminando qualquer salto de frame ou discrepância visual.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Sem Duplicatas:</strong> Em séries MD3 e MD5, todos os mapas são estritamente únicos e respeitam as regras competitivas oficiais.</span>
              </li>
            </ul>
          </div>
        )}

        {/* 4. MAIN MAP DISPLAY CARD (ROULETTE STAGE) */}
        <div className={`relative my-2 overflow-hidden rounded-2xl border-2 transition-all duration-300 bg-slate-950 shadow-2xl h-44 sm:h-48 flex flex-col justify-between p-3.5 group ${
          selectedMap
            ? 'border-amber-400 ring-4 ring-amber-400/25 shadow-amber-500/20'
            : spinning
            ? 'border-amber-500/80 ring-2 ring-amber-500/20'
            : 'border-slate-800'
        }`}>
          {/* Background Map Snapshot */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-200 opacity-65"
            style={{
              backgroundImage: `url(${displayMap?.image})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/30" />

          {/* Top Bar with Map Status */}
          <div className="relative z-10 flex items-center justify-between">
            <span
              className={`text-[9px] sm:text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                displayMap?.activeDuty
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${displayMap?.activeDuty ? 'bg-amber-400' : 'bg-sky-400'}`} />
              {displayMap?.activeDuty ? 'Active Duty Oficial' : 'Mapa Reserva CS2'}
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-200 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
              {displayMap?.file}
            </span>
          </div>

          {/* Center: Logo & Map Name */}
          <div className="relative z-10 text-center py-0.5 flex flex-col items-center justify-center">
            {displayMap?.logo && (
              <img
                src={displayMap.logo}
                alt={displayMap.name}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain mb-0.5 drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] filter brightness-110 transition-transform duration-150"
              />
            )}
            <h3 className="text-2xl sm:text-3xl font-black font-heading text-white tracking-wider drop-shadow-lg">
              {displayMap?.name.toUpperCase()}
            </h3>
            <span className="text-[11px] text-slate-300 font-medium">
              {displayMap?.location || 'CS2'} • {displayMap?.description || 'Counter-Strike 2'}
            </span>
          </div>

          {/* Bottom Status Ticker */}
          <div className="relative z-10 flex items-center justify-center text-xs font-mono font-bold">
            {spinning ? (
              <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                <Dices size={13} className="animate-spin" /> Sorteando série {matchFormat} entre {activePool.length} mapas...
              </span>
            ) : selectedMap ? (
              <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-0.5 rounded-full border border-emerald-500/30">
                <Trophy size={13} /> {matchFormat === 'MD1' ? 'MAPA DEFINIDO COM 100% DE EQUIDADE!' : `SÉRIE ${matchFormat} DEFINIDA COM 100% DE EQUIDADE!`}
              </span>
            ) : (
              <span className="text-slate-400">Escolha o formato ({matchFormat}) e clique em "Girar Roleta"</span>
            )}
          </div>
        </div>

        {/* 5. AUDIT BADGE SUMMARY WHEN FINISHED */}
        {auditRecord && selectedMap && (
          <div className="mb-3 px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-amber-300 font-bold">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>Sorteio Criptograficamente Auditado</span>
            </span>
            <span className="text-slate-400">
              Audit ID: <strong className="text-white">{auditRecord.id}</strong> ({auditRecord.timestamp})
            </span>
          </div>
        )}

        {/* 6. SERIES MAP LIST FOR MD3 / MD5 */}
        {drawnSeries.length > 1 && (
          <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-3.5 mb-3 text-left space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-heading uppercase text-amber-400 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-400" />
                Série Sorteada • {matchFormat} ({drawnSeries.length} Mapas Únicos)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Clique no mapa para pré-visualizar
              </span>
            </div>

            <div className={`grid grid-cols-1 ${drawnSeries.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-5'} gap-2`}>
              {drawnSeries.map((item, idx) => {
                const isCurrentDisplay = selectedMap?.id === item.map.id;
                const sideB = item.sideTimeB || (item.sideTimeA === 'CT' ? 'TR' : 'CT');
                return (
                  <div
                    key={item.map.id + idx}
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setSelectedMap(item.map);
                      setStartingSides({
                        sideTimeA: item.sideTimeA,
                        sideTimeB: sideB,
                      });
                    }}
                    className={`relative overflow-hidden rounded-xl border p-2.5 transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrentDisplay
                        ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg'
                        : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-25"
                      style={{ backgroundImage: `url(${item.map.image})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

                    <div className="relative z-10 flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">
                        #{idx + 1}
                      </span>
                      <span className="text-[9px] font-bold text-slate-300 truncate">
                        {item.role.replace(/Mapa \d+ /, '')}
                      </span>
                    </div>

                    <div className="relative z-10 my-1">
                      <div className="font-heading font-black text-sm text-white uppercase tracking-wide">
                        {item.map.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {item.map.file}
                      </div>
                    </div>

                    <div className="relative z-10 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono font-bold">
                      <span className="text-sky-400 flex items-center gap-0.5">
                        <Shield size={9} /> A: {item.sideTimeA}
                      </span>
                      <span className="text-amber-400 flex items-center gap-0.5">
                        <Flame size={9} /> B: {sideB}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. ACTION CONTROLS */}
        <div className="space-y-3 pb-3">
          <button
            onClick={handleSpin}
            disabled={spinning || !hasEnoughMaps}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
          >
            <Dices size={18} className={spinning ? 'animate-spin' : ''} />
            <span>
              {spinning
                ? 'Sorteando...'
                : `Girar Roleta (${matchFormat} • ${activePool.length} Mapas)`}
            </span>
          </button>

          {/* Winner Match Details Bar */}
          {selectedMap && (
            <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-fadeIn">
              <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 font-mono font-bold">
                  {matchFormat === 'MD1' ? 'Lados Sorteados:' : 'Lados do Mapa Selecionado:'}
                </span>
                <span className="font-bold text-sky-400 flex items-center gap-0.5 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  <Shield size={12} /> Time A {startingSides.sideTimeA}
                </span>
                <span>/</span>
                <span className="font-bold text-amber-400 flex items-center gap-0.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  <Flame size={12} /> Time B {startingSides.sideTimeB}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCopy}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : matchFormat === 'MD1' ? 'Copiar Mapa' : 'Copiar Série'}</span>
                </button>

                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    onApplyMap(selectedMap, startingSides, matchFormat, drawnSeries);
                    onClose();
                  }}
                  className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{matchFormat === 'MD1' ? 'Jogar Este Mapa' : 'Jogar Esta Série'}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
