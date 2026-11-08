import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Sparkles,
  Compass,
  Lightbulb,
  Check,
  Video,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Crosshair,
  MapPin,
  Wrench,
  Download,
  Star,
  ShieldCheck,
  Terminal,
  Play,
} from 'lucide-react';
import { GRENADE_LINEUPS, GRENADE_TYPES, WORKSHOP_PRACTICE_MAPS } from '../data/grenades';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

export default function GrenadePlaybookModal({
  isOpen,
  onClose,
  initialMap = null,
  soundEnabled = true,
}) {
  const [activeTab, setActiveTab] = useState('lineups'); // 'lineups' | 'workshop' | 'cfg'
  const [selectedMap, setSelectedMap] = useState(initialMap || 'all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedAimId, setExpandedAimId] = useState(null);
  const [videoModalLineup, setVideoModalLineup] = useState(null);

  useEffect(() => {
    if (initialMap) {
      setSelectedMap(initialMap);
    }
  }, [initialMap]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (videoModalLineup) {
          setVideoModalLineup(null);
          return;
        }
        if (soundEnabled) playClickSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, soundEnabled, videoModalLineup]);

  const mapsList = useMemo(
    () => [
      { id: 'all', name: 'Todos os Mapas', emoji: '🗺️' },
      { id: 'de_mirage', name: 'Mirage', emoji: '🏜️' },
      { id: 'de_inferno', name: 'Inferno', emoji: '🏰' },
      { id: 'de_nuke', name: 'Nuke', emoji: '☢️' },
      { id: 'de_dust2', name: 'Dust II', emoji: '🏜️' },
      { id: 'de_ancient', name: 'Ancient', emoji: '🏛️' },
      { id: 'de_anubis', name: 'Anubis', emoji: '🏺' },
    ],
    []
  );

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
          item.mapName.toLowerCase().includes(q) ||
          (item.aimPoint && item.aimPoint.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [selectedMap, selectedType, searchQuery]);

  const handleCopySteps = (lineup) => {
    if (soundEnabled) playClickSound();
    const text = `🎯 [CS2 Mix Hub] Lineup: ${lineup.title} (${lineup.mapName} - Lado ${lineup.side})\n📍 Local: ${lineup.location}\n⚙️ Arremesso: ${lineup.throwType}\n\nPasso a Passo:\n${lineup.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n💡 Dica Pro: ${lineup.proTip || 'Pratique no servidor de treino.'}`;
    copyText(text);
    setCopiedId(lineup.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCommand = (cmd, id) => {
    if (soundEnabled) playClickSound();
    copyText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const practiceCfgText = `// ============================================
// CS2 MIX HUB • CFG DE TREINO OFICIAL DE GRANADAS
// Cole no Console do CS2 (tecla ' ou ~)
// ============================================
sv_cheats 1;
mp_warmup_end;
mp_roundtime_defuse 60;
mp_buy_anywhere 1;
mp_buytime 9999;
mp_maxmoney 60000;
mp_startmoney 60000;
sv_infinite_ammo 1;
ammo_grenade_limit_total 6;
sv_grenade_trajectory_prac_pipreview 1;
sv_grenade_trajectory_prac_trailtime 8;
cl_grenadepreview 1;
sv_showimpacts 1;
sv_showimpacts_time 10;
bot_kick;
mp_limitteams 0;
mp_autoteambalance 0;
bind "alt" "sv_rethrow_last_grenade";
bind "v" "noclip";
mp_restartgame 1;
echo ">>> CS2 MIX HUB PRATICE CFG ATIVADA! ALT: Repetir Granada | V: Noclip <<<"`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-md shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                <span>Playbook de Granadas & Oficina Steam</span>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                  CS2 Oficial
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Lineups com fotos de mira, vídeos tutoriais e mapas oficiais confiáveis da Oficina Steam.
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

        {/* Main Navigation Tabs */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('lineups');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'lineups'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <span>🎯</span>
            <span>Playbook de Granadas ({GRENADE_LINEUPS.length})</span>
          </button>

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('workshop');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'workshop'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <span>🗺️</span>
            <span>Mapas da Oficina Steam ({WORKSHOP_PRACTICE_MAPS.length})</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-md font-mono">
              Confiáveis
            </span>
          </button>

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              setActiveTab('cfg');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'cfg'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <Terminal size={14} />
            <span>CFG de Treino Console</span>
          </button>
        </div>

        {/* Tab 1: Lineups Playbook */}
        {activeTab === 'lineups' && (
          <>
            {/* Filter Toolbar (Structured into 2 Clean Rows: Zero Collision) */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40 space-y-3 shrink-0">
              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por utilitária, mapa ou posição (Ex: janela, caixa, A, B, jumpthrow, mira)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* ROW 1: Dedicated Map Filter Pills */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span>🗺️</span>
                    <span>Selecione o Mapa:</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {filteredLineups.length} táticas encontradas
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {mapsList.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        setSelectedMap(m.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        selectedMap === m.id
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-2 ring-amber-500/30'
                          : 'bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      <span>{m.emoji}</span>
                      <span>{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ROW 2: Dedicated Grenade Type Filter Pills */}
              <div className="space-y-1 pt-1 border-t border-slate-900">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>Tipo de Utilitária:</span>
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <button
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      setSelectedType('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                      selectedType === 'all'
                        ? 'bg-slate-100 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                        selectedType === typeKey
                          ? `${typeObj.color} border shadow-md`
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      <span>{typeObj.icon}</span>
                      <span>{typeObj.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lineups List Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[58vh] custom-scrollbar">
              {filteredLineups.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Compass size={36} className="mx-auto text-slate-600 animate-pulse" />
                  <p className="text-sm font-semibold text-slate-400">
                    Nenhuma tática encontrada com os filtros selecionados.
                  </p>
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
                    const isAimExpanded = expandedAimId === lineup.id;
                    const isCopied = copiedId === lineup.id;

                    return (
                      <div
                        key={lineup.id}
                        className="bg-slate-950/85 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 transition-all shadow-md group relative overflow-hidden"
                      >
                        {/* Map Thumbnail Ambient Backing */}
                        {lineup.mapImage && (
                          <div
                            className="absolute -right-6 -bottom-6 w-32 h-32 bg-cover bg-center opacity-5 pointer-events-none rounded-full"
                            style={{ backgroundImage: `url(${lineup.mapImage})` }}
                          />
                        )}

                        <div>
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${typeInfo.color}`}
                              >
                                <span>{typeInfo.icon}</span>
                                <span>{typeInfo.label}</span>
                              </span>
                              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                                <span>{lineup.mapEmoji || '🗺️'}</span>
                                <span>{lineup.mapName}</span>
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  lineup.side === 'TR'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                }`}
                              >
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
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin size={11} className="text-amber-400 shrink-0" />
                            <span>{lineup.location}</span>
                          </p>
                          <p className="text-xs text-slate-300 mt-2">{lineup.description}</p>

                          {/* Throw Type Pill */}
                          <div className="mt-2.5 inline-block">
                            <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                              🎯 {lineup.throwType}
                            </span>
                          </div>

                          {/* Steps List */}
                          <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-900">
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

                          {/* Expandable Crosshair & Aim Details */}
                          {isAimExpanded && (
                            <div className="mt-3 p-3 rounded-xl bg-slate-900/95 border border-amber-500/30 space-y-2 animate-fadeIn text-xs">
                              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                                <Crosshair size={13} />
                                <span>Ponto Exato de Mira & Posição:</span>
                              </div>
                              <div className="space-y-1 text-slate-300 text-[11px]">
                                <p>
                                  <strong className="text-white">Posição dos Pés:</strong> {lineup.standPos}
                                </p>
                                <p>
                                  <strong className="text-white">Alinhamento da Mira:</strong> {lineup.aimPoint}
                                </p>
                                <p>
                                  <strong className="text-white">Área Coberta:</strong> {lineup.bloomArea}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Pro Tip */}
                          {lineup.proTip && (
                            <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-1.5">
                              <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                <strong>Dica Pro:</strong> {lineup.proTip}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card Interactive Footer Buttons */}
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                if (soundEnabled) playClickSound();
                                setExpandedAimId(isAimExpanded ? null : lineup.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {isAimExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{isAimExpanded ? 'Ocultar Mira' : 'Ver Mira'}</span>
                            </button>

                            <button
                              onClick={() => {
                                if (soundEnabled) playClickSound();
                                setVideoModalLineup(lineup);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play size={12} className="text-purple-400" />
                              <span>Vídeo / Tutorial</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleCopySteps(lineup)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span className={isCopied ? 'text-emerald-400 font-bold' : ''}>
                              {isCopied ? 'Copiado!' : 'Copiar'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab 2: Steam Workshop Practice Maps */}
        {activeTab === 'workshop' && (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 max-h-[70vh] custom-scrollbar">
            {/* Banner Notice */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Mapas 100% Confiáveis, Verificados e Seguros (VAC-Safe)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                      Valve Workshop
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Estes mapas foram criados pelos desenvolvedores mais respeitados da história do CS (Mr. uLLeticaL, ReMinD, crashz e Yesber). Você pode se inscrever na Steam com 1 clique ou usar o comando no console.
                  </p>
                </div>
              </div>
            </div>

            {/* Maps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WORKSHOP_PRACTICE_MAPS.map((mapItem) => {
                const isCmdCopied = copiedId === mapItem.id;
                return (
                  <div
                    key={mapItem.id}
                    className="bg-slate-950/85 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all shadow-md group relative overflow-hidden"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                          {mapItem.category}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-amber-400 font-bold">
                          <Star size={12} className="fill-amber-400" />
                          <span>{mapItem.ratingText}</span>
                        </div>
                      </div>

                      {/* Map Name & Author */}
                      <h3 className="font-heading font-black text-sm text-white group-hover:text-emerald-300 transition-colors">
                        {mapItem.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>Por <strong>{mapItem.author}</strong></span>
                        <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded font-mono">
                          {mapItem.authorBadge}
                        </span>
                      </p>

                      <p className="text-xs text-slate-300 mt-2.5">
                        {mapItem.description}
                      </p>

                      {/* Features */}
                      <div className="mt-3 space-y-1 pt-2 border-t border-slate-900">
                        {mapItem.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <Check size={12} className="text-emerald-400 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>

                      {/* Console Command Box */}
                      <div className="mt-3 p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                        <div className="font-mono text-[11px] text-slate-300 truncate">
                          <span className="text-slate-500 select-none">$ </span>
                          <span className="text-emerald-300 font-bold">{mapItem.consoleCommand}</span>
                        </div>
                        <button
                          onClick={() => handleCopyCommand(mapItem.consoleCommand, mapItem.id)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold shrink-0 cursor-pointer transition-colors flex items-center gap-1"
                          title="Copiar comando de console"
                        >
                          {isCmdCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          <span>{isCmdCopied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Workshop Actions */}
                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                      <a
                        href={mapItem.workshopUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={13} />
                        <span>Inscrever-se na Oficina Steam</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Console Practice CFG */}
        {activeTab === 'cfg' && (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 max-h-[70vh] custom-scrollbar">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <Terminal size={22} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Como Usar o Servidor de Treino no seu CS2</h3>
                <p className="text-xs text-slate-300 mt-1">
                  1. Abra o CS2 e entre em qualquer mapa pelo modo <strong>Praticar (Treino com Bots)</strong>.<br />
                  2. Abra o Console de Desenvolvedor (tecla <strong>'</strong> ou <strong>~</strong>).<br />
                  3. Cole a configuração completa abaixo e aperte Enter. Você terá dinheiro infinito, tempo ilimitado e a tecla <strong>ALT</strong> repetirá sua última granada automaticamente!
                </p>
              </div>
            </div>

            {/* CFG Box */}
            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-amber-400">practice_grenades.cfg</span>
                <button
                  onClick={() => handleCopyCommand(practiceCfgText, 'cfg-full')}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedId === 'cfg-full' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedId === 'cfg-full' ? 'CFG Copiada!' : 'Copiar CFG Completa'}</span>
                </button>
              </div>
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto no-scrollbar">
                {practiceCfgText}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400 shrink-0" />
            <span className="truncate">
              {activeTab === 'lineups'
                ? `${filteredLineups.length} lineups prontas para uso no seu Mix.`
                : activeTab === 'workshop'
                ? 'Mapas oficiais aprovados pela comunidade do CS2.'
                : 'Binds úteis: ALT para repetir granada, V para voar.'}
            </span>
          </div>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors shrink-0"
          >
            Fechar
          </button>
        </div>

        {/* Video Tutorial Sub-Modal */}
        {videoModalLineup && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border-2 border-purple-500/40 rounded-3xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl relative space-y-4">
              <button
                onClick={() => setVideoModalLineup(null)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Video size={16} />
                <span>Tutorial em Vídeo & Guia Visual</span>
              </div>

              <div>
                <h3 className="text-lg font-black text-white font-heading">
                  {videoModalLineup.title} ({videoModalLineup.mapName})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  📍 {videoModalLineup.location} • Arremesso: <strong>{videoModalLineup.throwType}</strong>
                </p>
              </div>

              {/* Aim & Breakdown Box */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Crosshair size={14} />
                  <span>Alinhamento & Posição:</span>
                </div>
                <div className="space-y-1.5 text-slate-300">
                  <p>
                    <strong className="text-white">👣 Onde Pisar:</strong> {videoModalLineup.standPos}
                  </p>
                  <p>
                    <strong className="text-white">🎯 Ponto de Mira:</strong> {videoModalLineup.aimPoint}
                  </p>
                  <p>
                    <strong className="text-white">💨 O que Cobre:</strong> {videoModalLineup.bloomArea}
                  </p>
                </div>
              </div>

              {/* YouTube Video Player Embed or Direct Link */}
              <div className="space-y-2">
                <a
                  href={videoModalLineup.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all text-sm cursor-pointer"
                >
                  <Play size={16} className="fill-white" />
                  <span>Assistir Vídeo Tutorial no YouTube (Oficial)</span>
                  <ExternalLink size={14} />
                </a>
                <p className="text-[11px] text-center text-slate-500">
                  Abre o tutorial direto no YouTube em nova aba com o alinhamento em 60 FPS.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
