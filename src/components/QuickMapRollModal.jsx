import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Dices, X, Sparkles, Copy, Check, Shield, Flame, SlidersHorizontal, ChevronDown, Trophy, Layers, RotateCcw, RefreshCw, Globe, ArrowRight } from 'lucide-react';
import { CS2_MAPS, OFFICIAL_ACTIVE_DUTY, EXTRA_CS2_MAPS } from '../data/maps';
import { playRouletteTick, playFanfare, playClickSound } from '../utils/audio';

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
  const [spinning, setSpinning] = useState(false);
  const [selectedMap, setSelectedMap] = useState(null);
  const [startingSide, setStartingSide] = useState('CT');
  const [drawnSeries, setDrawnSeries] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

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
    if (soundEnabled) playClickSound();
    setMatchFormat(format);
    setSelectedMap(null);
    setDrawnSeries([]);
    try {
      localStorage.setItem('cs2_roulette_format', format);
    } catch (e) {}
  };

  const handleToggleMap = (mapId) => {
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

  const handleSpin = () => {
    if (spinning || !hasEnoughMaps) return;
    setSpinning(true);
    setSelectedMap(null);
    setDrawnSeries([]);

    let count = 0;
    const totalSpins = 24 + Math.floor(Math.random() * 8);
    let speed = 65;

    const runStep = () => {
      count++;
      setCurrentIndex((prev) => (prev + 1) % activePool.length);
      if (soundEnabled) playRouletteTick();

      if (count < totalSpins) {
        speed += 12; // decelerate
        setTimeout(runStep, speed);
      } else {
        const targetCount = matchFormat === 'MD5' ? 5 : matchFormat === 'MD3' ? 3 : 1;
        // Shuffle copy of activePool to pick unique maps without duplicates
        const shuffled = [...activePool].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, Math.min(targetCount, shuffled.length));

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
          return `Mapa ${index + 1}`;
        };

        const series = picked.map((map, idx) => {
          const side = Math.random() < 0.5 ? 'CT' : 'TR';
          return {
            map,
            sideTimeA: side,
            role: getRole(idx, matchFormat),
          };
        });

        setDrawnSeries(series);
        setSelectedMap(series[0].map);
        setStartingSide(series[0].sideTimeA);
        setSpinning(false);
        if (soundEnabled) playFanfare();

        confetti({
          particleCount: matchFormat === 'MD1' ? 75 : 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#38bdf8', '#10b981', '#ec4899'],
        });
      }
    };

    runStep();
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
🎯 **Lado Inicial:** Time A começa de ${startingSide} | Time B começa de ${startingSide === 'CT' ? 'TR' : 'CT'}
GL HF! 🔥`;
    } else {
      text = `🏆 **SÉRIE DE MAPAS SORTEADA NA ROLETA: ${matchFormat} (${drawnSeries.length} Mapas)**
📦 **Pool Configurado:** ${presetLabel}

${drawnSeries
  .map((s, idx) => {
    const sideB = s.sideTimeA === 'CT' ? 'TR' : 'CT';
    return `🗺️ **${s.role}:** ${s.map.name} (${s.map.file})
   👉 Lado: Time A de ${s.sideTimeA} | Time B de ${sideB}`;
  })
  .join('\n\n')}

GL HF! 🔥 Que vença o melhor time!`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const displayMap = selectedMap || activePool[currentIndex % activePool.length] || activePool[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[94vh] overflow-y-auto bg-[#0c1220] border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 text-center shadow-2xl custom-scrollbar">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-52 h-52 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-52 h-52 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider mb-2">
            <Dices size={14} className="text-amber-400 animate-pulse" /> Sorteador Aleatório de Mapas CS2
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
            Roleta de Mapas do CS2
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Escolha o formato da partida (<strong>MD1</strong>, <strong>MD3</strong> ou <strong>MD5</strong>) e gire a roleta entre a rotação da Valve!
          </p>
        </div>

        {/* 1. MATCH FORMAT SELECTOR: MD1, MD3, MD5 */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 mb-3 text-left shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
              <Trophy size={13} className="text-amber-400" />
              <span>Formato da Partida (Série)</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
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
                  onClick={() => handleSelectFormat(f.id)}
                  className={`py-2 px-2.5 rounded-xl text-left border transition-all cursor-pointer ${
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
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 mb-4 text-left shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-heading">
              <SlidersHorizontal size={13} className="text-amber-400" />
              <span>Configuração do Pool de Mapas</span>
            </span>
            <div className="flex items-center gap-2">
              {onSyncOfficialRotation && (
                <button
                  type="button"
                  disabled={syncingRotation}
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
              onClick={() => handleSelectPreset('official')}
              className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer ${
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
              onClick={() => handleSelectPreset('official_train')}
              className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer ${
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
              onClick={() => handleSelectPreset('all')}
              className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer ${
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
            onClick={() => {
              if (soundEnabled) playClickSound();
              setShowCustomList(!showCustomList);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 font-semibold transition-all cursor-pointer"
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
                  onClick={() => handleSelectPreset('official')}
                  className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                      onClick={() => handleToggleMap(map.id)}
                      className={`relative overflow-hidden flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
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

        {/* 3. MAP DISPLAY CARD (ROULETTE STAGE) */}
        <div className="relative my-3 overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-slate-950 shadow-2xl h-56 sm:h-60 flex flex-col justify-between p-4 group">
          {/* Background Map Snapshot */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-300 opacity-65"
            style={{
              backgroundImage: `url(${displayMap?.image})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/30" />

          {/* Top Bar with Map Status */}
          <div className="relative z-10 flex items-center justify-between">
            <span
              className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                displayMap?.activeDuty
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${displayMap?.activeDuty ? 'bg-amber-400' : 'bg-sky-400'}`} />
              {displayMap?.activeDuty ? 'Active Duty Oficial' : 'Mapa Reserva CS2'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-200 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
              {displayMap?.file}
            </span>
          </div>

          {/* Center: Logo & Map Name */}
          <div className="relative z-10 text-center py-1 flex flex-col items-center justify-center">
            {displayMap?.logo && (
              <img
                src={displayMap.logo}
                alt={displayMap.name}
                className="w-16 h-16 object-contain mb-1 drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] filter brightness-110"
              />
            )}
            <h3 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-wider drop-shadow-lg">
              {displayMap?.name.toUpperCase()}
            </h3>
            <span className="text-xs text-slate-300 font-medium">
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
                <Trophy size={13} /> {matchFormat === 'MD1' ? 'MAPA DEFINIDO PARA A PARTIDA!' : `SÉRIE ${matchFormat} SORTEADA COM SUCESSO!`}
              </span>
            ) : (
              <span className="text-slate-400">Escolha o formato ({matchFormat}) e clique em "Girar Roleta"</span>
            )}
          </div>
        </div>

        {/* 4. SERIES MAP LIST FOR MD3 / MD5 */}
        {drawnSeries.length > 1 && (
          <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-3.5 mb-3 text-left space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-heading uppercase text-amber-400 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-400" />
                Série Sorteada • {matchFormat} ({drawnSeries.length} Mapas)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Clique no mapa para pré-visualizar
              </span>
            </div>

            <div className={`grid grid-cols-1 ${drawnSeries.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-5'} gap-2`}>
              {drawnSeries.map((item, idx) => {
                const isCurrentDisplay = selectedMap?.id === item.map.id;
                const sideB = item.sideTimeA === 'CT' ? 'TR' : 'CT';
                return (
                  <div
                    key={item.map.id + idx}
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setSelectedMap(item.map);
                      setStartingSide(item.sideTimeA);
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

        {/* 5. ACTION CONTROLS */}
        <div className="space-y-3">
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
                  {matchFormat === 'MD1' ? 'Lado sorteado:' : 'Lado do Mapa Selecionado:'}
                </span>
                <span className="font-bold text-sky-400 flex items-center gap-0.5 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  <Shield size={12} /> Time A {startingSide}
                </span>
                <span>/</span>
                <span className="font-bold text-amber-400 flex items-center gap-0.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  <Flame size={12} /> Time B {startingSide === 'CT' ? 'TR' : 'CT'}
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
                    onApplyMap(selectedMap, startingSide, matchFormat, drawnSeries);
                    onClose();
                  }}
                  className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {matchFormat === 'MD1' ? 'Jogar Este Mapa' : 'Jogar Esta Série'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
