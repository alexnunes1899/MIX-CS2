import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Shield, Flame, BookOpen, Sparkles, Compass, Lightbulb, Check } from 'lucide-react';
import { GRENADE_LINEUPS, GRENADE_TYPES } from '../data/grenades';
import { playClickSound } from '../utils/audio';

export default function GrenadePlaybookModal({
  isOpen,
  onClose,
  initialMap = null,
  soundEnabled = true,
}) {
  const [selectedMap, setSelectedMap] = useState(initialMap || 'all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (initialMap) {
      setSelectedMap(initialMap);
    }
  }, [initialMap]);

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

  const mapsList = useMemo(() => [
    { id: 'all', name: 'Todos os Mapas' },
    { id: 'de_mirage', name: 'Mirage' },
    { id: 'de_inferno', name: 'Inferno' },
    { id: 'de_nuke', name: 'Nuke' },
    { id: 'de_dust2', name: 'Dust II' },
    { id: 'de_ancient', name: 'Ancient' },
    { id: 'de_anubis', name: 'Anubis' },
  ], []);

  const filteredLineups = useMemo(() => {
    return GRENADE_LINEUPS.filter((item) => {
      if (selectedMap !== 'all' && item.map !== selectedMap) return false;
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.mapName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedMap, selectedType, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-md">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                <span>Playbook de Granadas Competitivas</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                  CS2 Oficial
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Lineups essenciais de Smokes, Flashes e Molotovs para o seu Mix vencer rounds.
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

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por utilitária, mapa ou posição (Ex: janela, caixa, A, B, jumpthrow)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Map & Category Selector Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Maps */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {mapsList.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setSelectedMap(m.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    selectedMap === m.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>

            {/* Types */}
            <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
              <button
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setSelectedType('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  selectedType === 'all'
                    ? 'bg-slate-200 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todas ({GRENADE_LINEUPS.length})
              </button>
              {Object.entries(GRENADE_TYPES).map(([typeKey, typeObj]) => (
                <button
                  key={typeKey}
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setSelectedType(typeKey);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                    selectedType === typeKey
                      ? `${typeObj.color} border shadow-sm`
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{typeObj.icon}</span>
                  <span>{typeObj.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[60vh] no-scrollbar">
          {filteredLineups.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Compass size={36} className="mx-auto text-slate-600 animate-pulse" />
              <p className="text-sm font-semibold text-slate-400">Nenhuma tática encontrada com os filtros selecionados.</p>
              <button
                onClick={() => {
                  setSelectedMap('all');
                  setSelectedType('all');
                  setSearchQuery('');
                }}
                className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLineups.map((lineup) => {
                const typeInfo = GRENADE_TYPES[lineup.type] || GRENADE_TYPES.smoke;
                return (
                  <div
                    key={lineup.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all shadow-md group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${typeInfo.color}`}>
                            <span>{typeInfo.icon}</span>
                            <span>{typeInfo.label}</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {lineup.mapName}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            lineup.side === 'TR' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                          }`}>
                            Lado {lineup.side}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {lineup.difficulty}
                        </span>
                      </div>

                      {/* Title & Location */}
                      <h3 className="font-heading font-black text-sm text-white group-hover:text-amber-300 transition-colors">
                        {lineup.title}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        📍 {lineup.location}
                      </p>
                      <p className="text-xs text-slate-300 mt-2">
                        {lineup.description}
                      </p>

                      {/* Throw Type Pill */}
                      <div className="mt-2.5 inline-block">
                        <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                          🎯 {lineup.throwType}
                        </span>
                      </div>

                      {/* Steps */}
                      <div className="mt-3 space-y-1 pt-2 border-t border-slate-900">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Passo a Passo:
                        </span>
                        {lineup.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="font-mono text-amber-400 font-bold shrink-0">{idx + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>

                      {/* Pro Tip */}
                      {lineup.proTip && (
                        <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-1.5">
                          <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
                          <span><strong>Dica Pro:</strong> {lineup.proTip}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" />
            <span>Mais granadas são sincronizadas com cada atualização do mapa competitivo.</span>
          </div>
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
