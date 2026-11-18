import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainNavigationMenu from './MainNavigationMenu';
import MixHubLogo from './MixHubLogo';
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Search,
  Calendar,
  Sparkles,
  ArrowLeft,
  Volume2,
  VolumeX,
  Radio,
  Languages,
  FileText,
  ShieldCheck,
  ChevronRight,
  Bot,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';
import { copyText } from '../utils/clipboard';

const CS2_HIGHLIGHT_REGEX =
  /\b(Dust II|Dust 2|Mirage|Inferno|Nuke|Ancient|Anubis|Vertigo|Overpass|Train|Cache|Italy|Office|Sub-tick|Premier|Wingman|Retakes|Deathmatch|Arms Race|Jumpthrow|Smoke|Flashbang|Molotov|Incendiary|HE Grenade|Decoy|AK-47|M4A4|M4A1-S|AWP|Desert Eagle|Zeus x27|Glock-18|USP-S|HUD|FPS|VAC|Workshop|Armory|Hitbox|Bombsite|Noclip|CSTV|GOTV)\b/g;

function HighlightedCs2Text({ text }) {
  const str = String(text || '');
  const parts = str.split(CS2_HIGHLIGHT_REGEX);
  if (parts.length <= 1) return str;
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <span
        key={idx}
        className="px-1.5 py-0.5 mx-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[11px] font-bold"
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

function getSourceBadge(source) {
  if (source === 'gemini') {
    return {
      label: 'IA Gemini PT-BR',
      className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    };
  }
  if (source === 'valve-ptbr') {
    return {
      label: 'Valve Oficial PT-BR',
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  }
  if (source === 'offline-fallback') {
    return {
      label: 'Resumo Técnico PT-BR',
      className: 'bg-slate-800 text-slate-300 border-slate-700',
    };
  }
  return {
    label: 'Traduzido PT-BR',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  };
}

function parseDisplaySections(patch) {
  if (!patch) return [];
  if (Array.isArray(patch.sections) && patch.sections.length > 0) {
    return patch.sections;
  }
  const lines = String(patch.formattedNotes || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const sections = [];
  let current = { title: '📌 [NOTAS DA ATUALIZAÇÃO]', items: [] };
  for (const line of lines) {
    const headerMatch = line.match(/^__\*\*(.+?)\*\*__$/);
    if (headerMatch) {
      if (current.items.length > 0) sections.push(current);
      current = { title: headerMatch[1].trim(), items: [] };
    } else {
      const clean = line.replace(/^[•\-*]\s*/, '').trim();
      if (clean && !clean.startsWith('*(...leia')) {
        current.items.push(clean);
      }
    }
  }
  if (current.items.length > 0) sections.push(current);
  return sections;
}

export default function CS2UpdatesPage({
  roomId,
  socket,
  onGoHome,
  onGoToRoom,
  onOpenQuickVeto,
  onOpenQuickMapRoll,
  onOpenRoomsHub,
  onOpenLeaderboard,
  onOpenDiscordModal,
  onOpenTournament,
  onOpenGrenades,
  onOpenAimReflex,
  onOpenServersPage,
  activeRoomsCount = 0,
  soundEnabled = true,
  onToggleSound,
}) {
  const [updates, setUpdates] = useState([]);
  const [selectedGid, setSelectedGid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOriginalEn, setShowOriginalEn] = useState(false);
  const [copiedGid, setCopiedGid] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [liveAlertTitle, setLiveAlertTitle] = useState('');

  const loadUpdates = useCallback(async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading((prev) => (updates.length === 0 ? true : prev));
      setError('');

      const res = await fetch(`/api/cs2/updates?limit=10${force ? '&force=1' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.updates) ? data.updates : [];
      setUpdates(list);
      setLastCheckedAt(data?.lastCheckedAt || new Date().toISOString());
      if (list.length > 0) {
        setSelectedGid((prev) => (prev && list.some((u) => u.gid === prev) ? prev : list[0].gid));
      }
    } catch (err) {
      setError('Não foi possível consultar as atualizações oficiais da Valve agora.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [updates.length]);

  useEffect(() => {
    loadUpdates({ force: false });
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewUpdate = (patch) => {
      if (!patch || !patch.gid) return;
      setUpdates((prev) => {
        const filtered = prev.filter((item) => item.gid !== patch.gid);
        return [patch, ...filtered].slice(0, 12);
      });
      setSelectedGid(patch.gid);
      setLiveAlertTitle(patch.title || 'Nova Atualização CS2');
      setLastCheckedAt(new Date().toISOString());
    };
    socket.on('cs2_update_released', handleNewUpdate);
    return () => {
      socket.off('cs2_update_released', handleNewUpdate);
    };
  }, [socket]);

  const filteredUpdates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return updates;
    return updates.filter((item) => {
      const hay = `${item.title || ''} ${item.originalTitle || ''} ${item.formattedNotes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [updates, searchQuery]);

  const selectedPatch = useMemo(() => {
    return (
      filteredUpdates.find((u) => u.gid === selectedGid) ||
      filteredUpdates[0] ||
      updates.find((u) => u.gid === selectedGid) ||
      updates[0] ||
      null
    );
  }, [filteredUpdates, updates, selectedGid]);

  const sections = useMemo(() => parseDisplaySections(selectedPatch), [selectedPatch]);

  const handleCopySummary = async (patch) => {
    if (!patch) return;
    if (soundEnabled) playClickSound();
    const text =
      `📢 ATUALIZAÇÃO OFICIAL CS2 — ${patch.title}\n` +
      `📅 ${patch.formattedDate} (Horário de Brasília)\n\n` +
      `${String(patch.formattedNotes || '').replace(/__\*\*(.+?)\*\*__/g, '$1')}\n\n` +
      `🔗 Fonte Steam: ${patch.url}`;
    const ok = await copyText(text);
    if (ok) {
      setCopiedGid(patch.gid);
      setTimeout(() => setCopiedGid(null), 2500);
    }
  };

  const formattedCheckedTime = useMemo(() => {
    if (!lastCheckedAt) return '';
    try {
      return new Date(lastCheckedAt).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [lastCheckedAt]);

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#070b15]/95 backdrop-blur-xl sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand + Back */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              onClick={onGoHome}
              className="flex items-center gap-2.5 cursor-pointer group select-none"
            >
              <MixHubLogo className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                    MIX HUB
                  </span>
                  <span className="text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono">
                    UPDATES
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">RADAR VALVE PT-BR</p>
              </div>
            </div>

            {onGoToRoom && roomId && (
              <button
                type="button"
                onClick={() => onGoToRoom(roomId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Voltar para o Mix ({roomId})</span>
                <span className="sm:hidden">Voltar</span>
              </button>
            )}
          </div>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center justify-center flex-1 min-w-0 px-2">
            <MainNavigationMenu
              activeTab="updates"
              onGoHome={onGoHome}
              onOpenLeaderboard={onOpenLeaderboard}
              onOpenDiscordModal={onOpenDiscordModal}
              onOpenQuickMapRoll={onOpenQuickMapRoll}
              onOpenQuickVeto={onOpenQuickVeto}
              onOpenServersPage={onOpenServersPage}
              onOpenUpdatesPage={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              onOpenRoomsHub={onOpenRoomsHub}
              onOpenTournament={onOpenTournament}
              onOpenGrenades={onOpenGrenades}
              onOpenAimReflex={onOpenAimReflex}
              activeRoomsCount={activeRoomsCount}
              soundEnabled={soundEnabled}
            />
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm active:scale-95 ${
                soundEnabled
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700/60'
              }`}
              title={soundEnabled ? 'Sons Ativados' : 'Sons Silenciados'}
            >
              {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-slate-400" />}
              <span className="hidden xl:inline text-[11px] font-bold">{soundEnabled ? 'Som Ativo' : 'Sem Som'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Bar */}
        <div className="md:hidden border-t border-slate-800/80 px-2 py-1.5 bg-[#070b15]/98 flex items-center justify-center">
          <MainNavigationMenu
            activeTab="updates"
            onGoHome={onGoHome}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenDiscordModal={onOpenDiscordModal}
            onOpenQuickMapRoll={onOpenQuickMapRoll}
            onOpenQuickVeto={onOpenQuickVeto}
            onOpenServersPage={onOpenServersPage}
            onOpenUpdatesPage={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onOpenRoomsHub={onOpenRoomsHub}
            onOpenTournament={onOpenTournament}
            onOpenGrenades={onOpenGrenades}
            onOpenAimReflex={onOpenAimReflex}
            activeRoomsCount={activeRoomsCount}
            soundEnabled={soundEnabled}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 space-y-6">
        {/* Live Notification Banner if received while open */}
        {liveAlertTitle && (
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500/20 via-amber-500/15 to-emerald-500/20 border border-emerald-500/50 px-4 py-3 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5 text-sm font-bold text-emerald-200">
              <Radio size={18} className="text-emerald-400 animate-pulse shrink-0" />
              <span>Nova atualização oficial da Valve detectada agora: <strong className="text-white">{liveAlertTitle}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setLiveAlertTitle('')}
              className="text-xs font-bold text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-slate-900/70 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-950/50 via-slate-900 to-amber-950/40 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Newspaper size={14} />
                <span>Radar Oficial Valve • Counter-Strike 2 (PT-BR)</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black font-heading text-white tracking-wide">
                Atualizações Oficiais do CS2 em Português
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Sempre que a Valve lança um novo patch no Steam, o Mix Hub traduz automaticamente as notas para{' '}
                <strong className="text-white">Português do Brasil (PT-BR)</strong> — preservando termos do jogo como nomes de mapas (
                <span className="text-amber-300 font-mono">Mirage</span>, <span className="text-amber-300 font-mono">Dust II</span>,{' '}
                <span className="text-amber-300 font-mono">Ancient</span>), armas e mecânicas (<span className="text-amber-300 font-mono">Sub-tick</span>,{' '}
                <span className="text-amber-300 font-mono">Smoke</span>, <span className="text-amber-300 font-mono">Premier</span>) — e publica ao mesmo tempo no{' '}
                <strong className="text-indigo-300">Bot do Discord</strong> e aqui no site.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
              <button
                type="button"
                disabled={refreshing}
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  loadUpdates({ force: true });
                }}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Sincronizando Valve...' : 'Verificar Atualizações Agora'}</span>
              </button>

              <div className="flex items-center justify-center lg:justify-end gap-3 text-[11px] font-mono text-slate-400">
                <span className="inline-flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-sync a cada 10min
                </span>
                {formattedCheckedTime && <span>• Verificado às {formattedCheckedTime}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Master-Detail Updates Explorer */}
        {loading && updates.length === 0 ? (
          <div className="glass-panel rounded-3xl border border-slate-800 p-12 text-center space-y-3">
            <RefreshCw size={28} className="mx-auto text-amber-400 animate-spin" />
            <p className="text-sm font-bold text-white">Carregando e traduzindo notas oficiais da Valve...</p>
            <p className="text-xs text-slate-400">Consultando Steam AppID 730 (Counter-Strike 2)</p>
          </div>
        ) : error && updates.length === 0 ? (
          <div className="glass-panel rounded-3xl border border-red-500/30 p-10 text-center space-y-3">
            <p className="text-sm font-bold text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => loadUpdates({ force: true })}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar: Search + Recent Updates List */}
            <aside className="lg:col-span-4 space-y-3">
              <div className="glass-panel rounded-2xl border border-white/[0.08] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    Histórico Recente ({filteredUpdates.length})
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500">Steam Official</span>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar mapa, arma, sub-tick..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 focus:border-amber-500/60 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {filteredUpdates.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Nenhuma atualização encontrada para &ldquo;{searchQuery}&rdquo;.
                    </p>
                  ) : (
                    filteredUpdates.map((item, index) => {
                      const isSelected = selectedPatch?.gid === item.gid;
                      const badge = getSourceBadge(item.translationSource);
                      return (
                        <button
                          key={item.gid}
                          type="button"
                          onClick={() => {
                            if (soundEnabled) playClickSound();
                            setSelectedGid(item.gid);
                            setShowOriginalEn(false);
                          }}
                          className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
                              : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                              <Calendar size={10} className="text-amber-400" />
                              {item.formattedDate}
                            </span>
                            {index === 0 && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Mais Recente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className={`text-xs font-bold line-clamp-2 ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                              {item.title}
                            </h3>
                            <ChevronRight
                              size={14}
                              className={`shrink-0 transition-transform ${isSelected ? 'text-amber-400 translate-x-0.5' : 'text-slate-500'}`}
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                              {badge.label}
                            </span>
                            {Array.isArray(item.sections) && item.sections.length > 0 && (
                              <span className="text-[10px] font-mono text-slate-500">
                                {item.sections.reduce((acc, s) => acc + (s.items?.length || 0), 0)} alterações
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Discord Sync Card */}
              <div className="glass-panel rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <Bot size={16} className="text-indigo-400" />
                  <span>Receba no Discord Automático</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  O bot do Mix Hub monitora a Steam a cada 10 minutos e envia todas as atualizações já traduzidas no seu servidor Discord. Use <code className="text-amber-300 font-mono">!patchnotes</code> ou{' '}
                  <code className="text-amber-300 font-mono">!patchnotes canal</code>.
                </p>
                {onOpenDiscordModal && (
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playClickSound();
                      onOpenDiscordModal();
                    }}
                    className="w-full py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Configurar Bot no Discord
                  </button>
                )}
              </div>
            </aside>

            {/* Right Panel: Selected Patch Details */}
            <section className="lg:col-span-8">
              {selectedPatch ? (
                <article className="glass-panel rounded-3xl border border-white/[0.1] p-5 sm:p-7 shadow-2xl space-y-6">
                  {/* Patch Header */}
                  <div className="space-y-3 pb-5 border-b border-slate-800/90">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold flex items-center gap-1.5">
                        <Calendar size={12} />
                        {selectedPatch.formattedDate} (Horário de Brasília)
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1.5 ${
                          getSourceBadge(selectedPatch.translationSource).className
                        }`}
                      >
                        <Languages size={12} />
                        {getSourceBadge(selectedPatch.translationSource).label}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono">
                        GID {selectedPatch.gid}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black font-heading text-white leading-snug">
                      {showOriginalEn ? selectedPatch.originalTitle || selectedPatch.title : selectedPatch.title}
                    </h2>

                    {selectedPatch.originalTitle && selectedPatch.originalTitle !== selectedPatch.title && !showOriginalEn && (
                      <p className="text-xs text-slate-400 font-mono">
                        Original Valve: {selectedPatch.originalTitle}
                      </p>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopySummary(selectedPatch)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedGid === selectedPatch.gid ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-300">Resumo Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} className="text-amber-400" />
                            <span>Copiar Resumo PT-BR</span>
                          </>
                        )}
                      </button>

                      {selectedPatch.rawContents && (
                        <button
                          type="button"
                          onClick={() => {
                            if (soundEnabled) playClickSound();
                            setShowOriginalEn((prev) => !prev);
                          }}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            showOriginalEn
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                              : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                          }`}
                        >
                          <FileText size={14} />
                          <span>{showOriginalEn ? 'Voltar para PT-BR' : 'Ver Original (EN)'}</span>
                        </button>
                      )}

                      <a
                        href={selectedPatch.url || 'https://www.counter-strike.net/news/updates'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>Nota Oficial Steam</span>
                        <ExternalLink size={13} />
                      </a>

                      <a
                        href="https://www.counter-strike.net/news/updates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>Counter-Strike.net</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>

                  {/* Body */}
                  {showOriginalEn ? (
                    <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedPatch.rawContents}
                    </div>
                  ) : sections.length > 0 ? (
                    <div className="space-y-4">
                      {sections.map((section, sIdx) => (
                        <div
                          key={`${section.title}-${sIdx}`}
                          className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-4 sm:p-5 space-y-3"
                        >
                          <h3 className="text-xs sm:text-sm font-black tracking-wider text-amber-300 uppercase flex items-center gap-2">
                            <span>{section.title}</span>
                          </h3>
                          <ul className="space-y-2.5">
                            {section.items.map((line, lIdx) => (
                              <li key={lIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>
                                  <HighlightedCs2Text text={line} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedPatch.formattedNotes}
                    </div>
                  )}

                  {/* Footer Note */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800/80">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      Termos técnicos oficiais do CS2 (mapas, armas, utilitários e mecânicas) preservados na tradução.
                    </span>
                    <span className="font-mono text-slate-500">Fonte: Valve Corporation</span>
                  </div>
                </article>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
