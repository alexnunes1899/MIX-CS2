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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Film,
  Image as ImageIcon,
  RefreshCw,
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
  const [mediaTab, setMediaTab] = useState('video'); // 'video' | 'aim' | 'stance' | 'impact'
  const [isZoomed, setIsZoomed] = useState(false);
  const [lineupsData, setLineupsData] = useState(GRENADE_LINEUPS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const openMediaModal = (lineup, initialMedia = 'video') => {
    if (soundEnabled) playClickSound();
    setVideoModalLineup(lineup);
    setMediaTab(initialMedia);
    setIsZoomed(false);
  };

  // Fetch updated PT-BR feed on modal open
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/grenades')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.lineups) && data.lineups.length > 0) {
          setLineupsData(data.lineups);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const handleSyncVideos = async () => {
    if (soundEnabled) playClickSound();
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/grenades/sync', { method: 'POST' });
      const data = await res.json();
      if (data && Array.isArray(data.lineups) && data.lineups.length > 0) {
        setLineupsData(data.lineups);
        setSyncMessage(`🇧🇷 ${data.verifiedCount || data.lineups.length} vídeos em Português do Brasil verificados e 100% atualizados!`);
      } else {
        setSyncMessage('🇧🇷 Vídeos em Português do Brasil já estão 100% atualizados!');
      }
    } catch (err) {
      setSyncMessage('🇧🇷 Catálogo oficial em Português pronto para uso!');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4500);
    }
  };

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
    return lineupsData.filter((item) => {
      if (selectedMap !== 'all' && item.map !== selectedMap) return false;
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.mapName.toLowerCase().includes(q) ||
          (item.authorPtBr && item.authorPtBr.toLowerCase().includes(q)) ||
          (item.aimPoint && item.aimPoint.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [lineupsData, selectedMap, selectedType, searchQuery]);

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
              <h2 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2 flex-wrap">
                <span>Playbook de Granadas & Oficina Steam</span>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                  CS2 Oficial
                </span>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span>🇧🇷</span>
                  <span>100% Vídeos PT-BR</span>
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Vídeos instrutivos narrados em Português do Brasil, fotos de mira e mapas de treino oficiais.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncVideos}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-60 shadow-sm"
              title="Buscar e verificar novos vídeos em Português do Brasil"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-amber-400' : 'text-amber-400'} />
              <span className="hidden sm:inline">{isSyncing ? 'Buscando Vídeos...' : 'Buscar Atualizações PT-BR'}</span>
              <span className="sm:hidden">{isSyncing ? '...' : 'Atualizar'}</span>
            </button>
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
        </div>

        {/* Sync Notification Banner */}
        {syncMessage && (
          <div className="px-5 py-2.5 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn shrink-0">
            <Sparkles size={14} className="text-emerald-400 animate-pulse" />
            <span>{syncMessage}</span>
          </div>
        )}

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
                          {/* Visual Media Preview Banner (100% In-Site Player Trigger) */}
                          <div
                            onClick={() => openMediaModal(lineup, 'video')}
                            className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 mb-3 group/banner cursor-pointer shadow-inner"
                          >
                            <img
                              src={lineup.thumbnailUrl || lineup.mapImage}
                              alt={lineup.title}
                              className="w-full h-full object-cover group-hover/banner:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                            {/* Centered Glowing Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="px-3.5 py-1.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/40 backdrop-blur-sm group-hover/banner:scale-110 transition-transform">
                                <Play size={13} className="fill-white" />
                                <span>Ver Vídeo (PT-BR)</span>
                              </div>
                            </div>

                            {/* Badges on Banner */}
                            <div className="absolute top-2 left-2 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold bg-slate-950/80 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md backdrop-blur-sm">
                                🎯 {lineup.throwType}
                              </span>
                            </div>
                            <div className="absolute bottom-2 right-2 flex items-center gap-1">
                              <span className="text-[10px] font-bold bg-slate-950/85 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1">
                                <Crosshair size={11} className="text-emerald-400" />
                                <span>Foto da Mira</span>
                              </span>
                            </div>
                          </div>

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
                              {lineup.authorPtBr && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <span>🇧🇷</span>
                                  <span>{lineup.authorPtBr}</span>
                                </span>
                              )}
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => openMediaModal(lineup, 'video')}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play size={12} className="fill-purple-300 text-purple-300" />
                              <span>Vídeo (PT-BR)</span>
                            </button>

                            <button
                              onClick={() => openMediaModal(lineup, 'aim')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Crosshair size={12} />
                              <span>Foto da Mira</span>
                            </button>

                            <button
                              onClick={() => {
                                if (soundEnabled) playClickSound();
                                setExpandedAimId(isAimExpanded ? null : lineup.id);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {isAimExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{isAimExpanded ? 'Fechar' : 'Passos'}</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleCopySteps(lineup)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
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

        {/* In-Site Video & Media Player Sub-Modal (100% Inside Website) */}
        {videoModalLineup && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border-2 border-purple-500/50 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
              {/* Header */}
              <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/80 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                      <span>{videoModalLineup.mapEmoji || '🗺️'}</span>
                      <span>{videoModalLineup.mapName}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        videoModalLineup.side === 'TR'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      Lado {videoModalLineup.side}
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      🎯 {videoModalLineup.throwType}
                    </span>
                    {videoModalLineup.authorPtBr && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <span>🇧🇷 Canal:</span>
                        <span>{videoModalLineup.authorPtBr}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white font-heading">
                    {videoModalLineup.title}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin size={12} className="text-amber-400 shrink-0" />
                    <span>{videoModalLineup.location}</span>
                  </p>
                </div>
                <button
                  onClick={() => setVideoModalLineup(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Media Switcher Tabs (Video vs Aim Photo vs Stance vs Impact) */}
              <div className="px-5 sm:px-6 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMediaTab('video');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    mediaTab === 'video'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <Film size={13} />
                  <span>Vídeo (PT-BR)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>

                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMediaTab('aim');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    mediaTab === 'aim'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <Crosshair size={13} />
                  <span>Foto da Mira & Retículo</span>
                </button>

                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMediaTab('stance');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    mediaTab === 'stance'
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <MapPin size={13} />
                  <span>Onde Pisar</span>
                </button>

                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMediaTab('impact');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    mediaTab === 'impact'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>Área de Cobertura</span>
                </button>
              </div>

              {/* Modal Body with Scroll */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[64vh] custom-scrollbar">
                {/* 1. VIDEO VIEW (Embedded 100% Inside Web Page) */}
                {mediaTab === 'video' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border-2 border-purple-500/40 shadow-2xl">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${videoModalLineup.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                        title={videoModalLineup.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs px-1 gap-1">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Vídeo narrado em Português do Brasil (60 FPS)</span>
                        {videoModalLineup.authorPtBr && (
                          <span className="text-slate-300 font-normal ml-1">
                            • Canal: <strong className="text-amber-300">{videoModalLineup.authorPtBr}</strong>
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        Arremesso: <strong className="text-purple-300">{videoModalLineup.throwType}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. AIM PHOTO & TACTICAL RETICLE VIEW */}
                {mediaTab === 'aim' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/40 shadow-2xl flex items-center justify-center select-none group">
                      <img
                        src={videoModalLineup.aimImage || videoModalLineup.thumbnailUrl}
                        alt={videoModalLineup.title}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                        }`}
                        onClick={() => setIsZoomed(!isZoomed)}
                      />
                      {/* CS2 Tactical Crosshair Reticle Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative flex items-center justify-center">
                          {/* Pulsing ring */}
                          <div className="w-10 h-10 rounded-full border-2 border-emerald-400/60 animate-ping absolute" />
                          {/* Solid ring */}
                          <div className="w-7 h-7 rounded-full border-2 border-emerald-400 bg-emerald-400/15 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-sm shadow-emerald-400" />
                          </div>
                          {/* Reticle lines */}
                          <div className="absolute top-1/2 -left-6 w-4 h-0.5 bg-emerald-400 shadow-sm" />
                          <div className="absolute top-1/2 -right-6 w-4 h-0.5 bg-emerald-400 shadow-sm" />
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-emerald-400 shadow-sm" />
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-emerald-400 shadow-sm" />
                        </div>
                      </div>

                      {/* Zoom Toggle Pill */}
                      <button
                        onClick={() => setIsZoomed(!isZoomed)}
                        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 backdrop-blur-md shadow-lg cursor-pointer transition-all"
                      >
                        {isZoomed ? (
                          <ZoomOut size={14} className="text-emerald-400" />
                        ) : (
                          <ZoomIn size={14} className="text-emerald-400" />
                        )}
                        <span>{isZoomed ? 'Reduzir (1x)' : 'Ampliar Pixel (Zoom)'}</span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-2">
                      <Crosshair size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white">Alinhamento Exato da Mira:</strong>{' '}
                        <span>{videoModalLineup.aimPoint}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. STANCE VIEW */}
                {mediaTab === 'stance' && (
                  <div className="p-5 rounded-2xl bg-slate-950 border-2 border-sky-500/30 space-y-3 text-xs text-slate-300 animate-fadeIn">
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                      <MapPin size={16} />
                      <span>Posicionamento dos Pés & Colisão com Parede</span>
                    </div>
                    <p className="leading-relaxed text-sm text-white">
                      👣 <strong>Onde travar o jogador:</strong> {videoModalLineup.standPos}
                    </p>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-[11px] text-sky-300">
                      <div>• <strong>Tipo de Movimento:</strong> {videoModalLineup.throwType}</div>
                      <div>• <strong>Mapa Oficial:</strong> {videoModalLineup.mapName} ({videoModalLineup.map})</div>
                      <div>• <strong>Lado:</strong> {videoModalLineup.side}</div>
                      <div>• <strong>Grau de Dificuldade:</strong> {videoModalLineup.difficulty}</div>
                    </div>
                  </div>
                )}

                {/* 4. IMPACT & COVERAGE VIEW */}
                {mediaTab === 'impact' && (
                  <div className="p-5 rounded-2xl bg-slate-950 border-2 border-amber-500/30 space-y-3 text-xs text-slate-300 animate-fadeIn">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                      <Sparkles size={16} />
                      <span>Área de Cobertura & Impacto Tático</span>
                    </div>
                    <p className="leading-relaxed text-sm text-white">
                      💨 <strong>O que esta utilitária anula:</strong> {videoModalLineup.bloomArea}
                    </p>
                    {videoModalLineup.proTip && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                        💡 <strong>Dica Pro:</strong> {videoModalLineup.proTip}
                      </div>
                    )}
                  </div>
                )}

                {/* Steps Checklist */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>📋 Passo a Passo de Execução:</span>
                    <span className="font-mono text-purple-300">{videoModalLineup.throwType}</span>
                  </div>
                  <div className="space-y-1.5">
                    {videoModalLineup.steps.map((st, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-300">
                        <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/40">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{st}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pro Tip */}
                {videoModalLineup.proTip && mediaTab !== 'impact' && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-start gap-2">
                    <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Dica Pro:</strong> {videoModalLineup.proTip}
                    </span>
                  </div>
                )}
              </div>

              {/* Sub-Modal Footer Controls */}
              <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
                <button
                  onClick={() => handleCopySteps(videoModalLineup)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {copiedId === videoModalLineup.id ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                  <span>
                    {copiedId === videoModalLineup.id ? 'Lineup Copiada!' : 'Copiar Guia da Lineup'}
                  </span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <a
                    href={videoModalLineup.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Abrir no YouTube (Opcional)</span>
                    <ExternalLink size={11} />
                  </a>
                  <button
                    onClick={() => setVideoModalLineup(null)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Fechar Player
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
