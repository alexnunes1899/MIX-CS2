import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainNavigationMenu from './MainNavigationMenu';
import MixHubLogo from './MixHubLogo';
import {
  Film,
  Flame,
  Trophy,
  Plus,
  ExternalLink,
  ArrowLeft,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  Sparkles,
  Check,
  Users,
} from 'lucide-react';
import { playClickSound } from '../utils/audio';

const PLATFORM_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'medal', label: 'Medal.tv' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'streamable', label: 'Streamable' },
];

export default function ClipsGalleryPage({
  roomId = '',
  socket,
  myProfile,
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
  onOpenUpdatesPage,
  activeRoomsCount = 0,
  soundEnabled = true,
  onToggleSound,
}) {
  const [clips, setClips] = useState([]);
  const [clipOfTheWeek, setClipOfTheWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('recent'); // 'recent' | 'top'
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');

  // Submit form state
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [mapInput, setMapInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [votingId, setVotingId] = useState(null);

  const loadClips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/clips?sort=${encodeURIComponent(sort)}&platform=${encodeURIComponent(platform)}`);
      if (res.ok) {
        const data = await res.json();
        setClips(Array.isArray(data.clips) ? data.clips : []);
        setClipOfTheWeek(data.clipOfTheWeek || null);
      }
    } catch {}
    setLoading(false);
  }, [sort, platform]);

  useEffect(() => {
    loadClips();
  }, [loadClips]);

  useEffect(() => {
    if (!socket) return;
    const handleClipsUpdate = (data) => {
      if (data && Array.isArray(data.clips)) {
        loadClips();
      }
    };
    socket.on('community_clips_updated', handleClipsUpdate);
    return () => socket.off('community_clips_updated', handleClipsUpdate);
  }, [socket, loadClips]);

  const filteredClips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter((c) => {
      const hay = `${c.title || ''} ${c.authorName || ''} ${c.platform || ''} ${c.map || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clips, search]);

  const handleSubmitClip = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    if (soundEnabled) playClickSound();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/community/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          title: titleInput.trim(),
          map: mapInput.trim(),
          authorName: myProfile?.nick || 'Jogador da Comunidade',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar clipe');
      setUrlInput('');
      setTitleInput('');
      setMapInput('');
      setFeedback({ type: 'success', text: 'Clipe enviado para a Galeria da Comunidade!' });
      loadClips();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (clipId, voteType) => {
    if (soundEnabled) playClickSound();
    setVotingId(clipId);
    try {
      const res = await fetch(`/api/community/clips/${encodeURIComponent(clipId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType }),
      });
      if (res.ok) {
        await loadClips();
      }
    } catch {}
    setVotingId(null);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#070b15]/95 backdrop-blur-xl sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div onClick={onGoHome} className="flex items-center gap-2.5 cursor-pointer group select-none">
              <MixHubLogo className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold font-heading tracking-wider text-white group-hover:text-amber-400 transition-colors">
                    MIX HUB
                  </span>
                  <span className="text-purple-300 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 font-mono">
                    CLIPES
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">GALERIA DA COMUNIDADE</p>
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

          <div className="hidden md:flex items-center justify-center flex-1 min-w-0 px-2">
            <MainNavigationMenu
              activeTab="clips"
              onGoHome={onGoHome}
              onOpenLeaderboard={onOpenLeaderboard}
              onOpenDiscordModal={onOpenDiscordModal}
              onOpenQuickMapRoll={onOpenQuickMapRoll}
              onOpenQuickVeto={onOpenQuickVeto}
              onOpenServersPage={onOpenServersPage}
              onOpenUpdatesPage={onOpenUpdatesPage}
              onOpenClipsPage={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              onOpenRoomsHub={onOpenRoomsHub}
              onOpenTournament={onOpenTournament}
              onOpenGrenades={onOpenGrenades}
              onOpenAimReflex={onOpenAimReflex}
              activeRoomsCount={activeRoomsCount}
              soundEnabled={soundEnabled}
            />
          </div>

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

        <div className="md:hidden border-t border-slate-800/80 px-2 py-1.5 bg-[#070b15]/98 flex items-center justify-center">
          <MainNavigationMenu
            activeTab="clips"
            onGoHome={onGoHome}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenDiscordModal={onOpenDiscordModal}
            onOpenQuickMapRoll={onOpenQuickMapRoll}
            onOpenQuickVeto={onOpenQuickVeto}
            onOpenServersPage={onOpenServersPage}
            onOpenUpdatesPage={onOpenUpdatesPage}
            onOpenClipsPage={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onOpenRoomsHub={onOpenRoomsHub}
            onOpenTournament={onOpenTournament}
            onOpenGrenades={onOpenGrenades}
            onOpenAimReflex={onOpenAimReflex}
            activeRoomsCount={activeRoomsCount}
            soundEnabled={soundEnabled}
          />
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 space-y-8">
        {/* Top Hero + Submit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/35 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <Film size={13} />
              <span>Highlights & Clipes do Mix</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-wide">
              Galeria de Clipes da Comunidade
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Compartilhe clutches, aces e pinadas épicas do Medal.tv, YouTube, Twitch ou Streamable — os clipes postados no Discord (<code className="text-purple-300">/clip</code>) também aparecem automaticamente aqui!
            </p>

            {/* Clipe da Semana Highlight */}
            {clipOfTheWeek && (
              <div className="rounded-3xl bg-gradient-to-br from-purple-950/60 via-slate-900 to-amber-950/30 border-2 border-amber-500/40 p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Clipe da Semana
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                    {clipOfTheWeek.platformIcon} {clipOfTheWeek.platform}
                  </span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg font-black text-white">{clipOfTheWeek.title}</h2>
                  <p className="text-xs text-slate-400">
                    Por <strong className="text-slate-200">{clipOfTheWeek.authorName}</strong>
                    {clipOfTheWeek.map ? ` • Mapa ${clipOfTheWeek.map}` : ''}
                  </p>
                </div>

                {clipOfTheWeek.embedUrl && (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800">
                    <iframe
                      src={clipOfTheWeek.embedUrl}
                      title={clipOfTheWeek.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={votingId === clipOfTheWeek.id}
                      onClick={() => handleVote(clipOfTheWeek.id, 'fire')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🔥 Jogou Muito</span>
                      <span className="font-mono font-black">({clipOfTheWeek.fireCount || 0})</span>
                    </button>
                    <button
                      type="button"
                      disabled={votingId === clipOfTheWeek.id}
                      onClick={() => handleVote(clipOfTheWeek.id, 'bagre')}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <span>💩 Bagre</span>
                      <span className="font-mono font-black">({clipOfTheWeek.bagreCount || 0})</span>
                    </button>
                  </div>
                  <a
                    href={clipOfTheWeek.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors"
                  >
                    <span>Assistir Original</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Submit Clip Form */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSubmitClip}
              className="rounded-3xl bg-slate-900/90 border border-purple-500/35 p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Plus size={16} className="text-purple-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Enviar Novo Clipe
                </h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Link do Clipe (Medal.tv, YouTube, Twitch, Streamable) *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://medal.tv/games/counter-strike-2/clips/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-400 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Título da Jogada
                  </label>
                  <input
                    type="text"
                    maxLength={90}
                    placeholder="Ex: Clutch 1v4 de AWP na Mirage"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-400 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Mapa (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    placeholder="Ex: Mirage, Inferno, Dust II..."
                    value={mapInput}
                    onChange={(e) => setMapInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-400 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {feedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold border ${
                    feedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{submitting ? 'Publicando...' : 'Publicar na Galeria'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/75 border border-slate-800 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {PLATFORM_FILTERS.map((pf) => (
              <button
                key={pf.id}
                type="button"
                onClick={() => setPlatform(pf.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  platform === pf.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-56">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar título, autor..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setSort('recent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  sort === 'recent' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Recentes
              </button>
              <button
                type="button"
                onClick={() => setSort('top')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  sort === 'top' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                🔥 Top Votados
              </button>
            </div>
          </div>
        </div>

        {/* Clips Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 font-mono">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-purple-400" />
            Carregando clipes da comunidade...
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-10 text-center space-y-2">
            <Film size={28} className="mx-auto text-slate-500" />
            <div className="text-sm font-bold text-white">Nenhum clipe encontrado ainda</div>
            <p className="text-xs text-slate-400">
              Seja o primeiro a enviar uma jogada acima ou use <code className="text-purple-300">/clip</code> no Discord!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClips.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl bg-slate-900/85 border border-slate-800 hover:border-purple-500/40 p-4 flex flex-col justify-between gap-3 transition-all shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                      {c.platformIcon || '🎬'} {c.platform || 'Clipe'}
                    </span>
                    {c.map && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        {c.map}
                      </span>
                    )}
                  </div>

                  {c.embedUrl ? (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                      <iframe
                        src={c.embedUrl}
                        title={c.title}
                        className="w-full h-full"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-video w-full rounded-xl bg-gradient-to-br from-slate-950 to-purple-950/40 border border-slate-800 hover:border-purple-400/50 flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white transition-colors"
                    >
                      <Film size={28} className="text-purple-400" />
                      <span className="text-xs font-bold flex items-center gap-1">
                        Assistir no {c.platform} <ExternalLink size={12} />
                      </span>
                    </a>
                  )}

                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-2">{c.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                      <Users size={11} className="text-slate-500" />
                      <span>{c.authorName}</span>
                      <span>•</span>
                      <span>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={votingId === c.id}
                      onClick={() => handleVote(c.id, 'fire')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-bold cursor-pointer"
                    >
                      🔥 {c.fireCount ?? c.votes?.fire?.length ?? 0}
                    </button>
                    <button
                      type="button"
                      disabled={votingId === c.id}
                      onClick={() => handleVote(c.id, 'bagre')}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold cursor-pointer"
                    >
                      💩 {c.bagreCount ?? c.votes?.bagre?.length ?? 0}
                    </button>
                  </div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1"
                  >
                    <span>Abrir</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
