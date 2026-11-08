import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Flame,
  Search,
  X,
  RefreshCw,
  UserCheck,
  Shield,
  ChevronUp,
  ChevronDown,
  Globe,
  Calendar,
  Clock,
  Crown,
  Users,
  MapPin,
  Check,
  Sparkles,
  Filter,
  Layers,
  Award,
  Gamepad2,
  Copy,
} from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import { playClickSound } from '../utils/audio';

function DiscordIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

const MAP_OPTIONS = [
  { id: 'all', label: 'Todos os Mapas', icon: '🗺️' },
  { id: 'mirage', label: 'Mirage', icon: '🏜️' },
  { id: 'inferno', label: 'Inferno', icon: '🏰' },
  { id: 'nuke', label: 'Nuke', icon: '☢️' },
  { id: 'dust2', label: 'Dust II', icon: '🏜️' },
  { id: 'ancient', label: 'Ancient', icon: '🏛️' },
  { id: 'anubis', label: 'Anubis', icon: '🏺' },
  { id: 'cache', label: 'Cache', icon: '☢️' },
];

export default function LeaderboardModal({
  isOpen,
  onClose,
  socket,
  soundEnabled,
}) {
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'matches'
  
  // Players Ranking state
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('wins'); // 'wins' | 'winRate' | 'matches' | 'level'

  // Match History state
  const [matches, setMatches] = useState([]);
  const [matchesStats, setMatchesStats] = useState({ total: 0, discordCount: 0, webCount: 0 });
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [matchSourceFilter, setMatchSourceFilter] = useState('all'); // 'all' | 'discord' | 'web'
  const [matchMapFilter, setMatchMapFilter] = useState('all');
  const [matchSearch, setMatchSearch] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchLeaderboard = async () => {
    setLoadingPlayers(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (e) {
      console.warn('Falha ao carregar leaderboard via API:', e);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch('/api/matches?limit=100');
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setMatchesStats({
          total: data.total || 0,
          discordCount: data.discordCount || 0,
          webCount: data.webCount || 0,
        });
      }
    } catch (e) {
      console.warn('Falha ao carregar histórico unificado de mixes:', e);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
      fetchMatches();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!socket) return;

    const handleLeaderboardUpdate = (data) => {
      if (Array.isArray(data)) {
        setPlayers(data);
      }
    };

    const handleMatchUpdate = (data) => {
      if (data && Array.isArray(data.matches)) {
        setMatches(data.matches);
        setMatchesStats({
          total: data.total || 0,
          discordCount: data.discordCount || 0,
          webCount: data.webCount || 0,
        });
      }
    };

    socket.on('leaderboard_updated', handleLeaderboardUpdate);
    socket.on('match_history_updated', handleMatchUpdate);
    socket.on('match_history_init', handleMatchUpdate);

    return () => {
      socket.off('leaderboard_updated', handleLeaderboardUpdate);
      socket.off('match_history_updated', handleMatchUpdate);
      socket.off('match_history_init', handleMatchUpdate);
    };
  }, [socket]);

  if (!isOpen) return null;

  // Filter and sort players
  const filteredPlayers = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return p.nick?.toLowerCase().includes(q) || (p.steamId && p.steamId.includes(q));
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (sortBy === 'wins') return (b.wins || 0) - (a.wins || 0);
    if (sortBy === 'winRate') return (b.winRate || 0) - (a.winRate || 0);
    if (sortBy === 'matches') return (b.matchesPlayed || b.total || 0) - (a.matchesPlayed || a.total || 0);
    if (sortBy === 'level') return (b.level || 0) - (a.level || 0);
    return 0;
  });

  const top3 = sortedPlayers.slice(0, 3);

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    if (matchSourceFilter !== 'all' && m.source !== matchSourceFilter) return false;
    if (matchMapFilter !== 'all') {
      const qMap = matchMapFilter.toLowerCase().replace('de_', '');
      if (!(m.map || '').toLowerCase().includes(qMap)) return false;
    }
    if (matchSearch.trim()) {
      const q = matchSearch.toLowerCase().trim();
      const inId = (m.id || '').toLowerCase().includes(q);
      const inMap = (m.map || '').toLowerCase().includes(q);
      const inGuild = (m.guildName || '').toLowerCase().includes(q);
      const inChannel = (m.channelName || '').toLowerCase().includes(q);
      const inRoom = (m.roomName || '').toLowerCase().includes(q);
      const inDeclared = (m.declaredBy || '').toLowerCase().includes(q);
      const inMvp = (m.mvpNick || '').toLowerCase().includes(q);
      const inWinners = (m.winnerPlayers || []).some((p) => (p.nick || '').toLowerCase().includes(q));
      const inLosers = (m.loserPlayers || []).some((p) => (p.nick || '').toLowerCase().includes(q));
      return inId || inMap || inGuild || inChannel || inRoom || inDeclared || inMvp || inWinners || inLosers;
    }
    return true;
  });

  const handleCopyMatchId = (id) => {
    if (soundEnabled) playClickSound();
    navigator.clipboard?.writeText?.(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden bg-slate-900 border-2 border-amber-500/40 rounded-3xl shadow-2xl flex flex-col">
        
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="px-5 sm:px-7 py-4 border-b border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black font-heading text-white flex items-center gap-2 flex-wrap">
                <span>Hall da Fama & Histórico Geral CS2</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Discord & Site Sincronizados</span>
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Estatísticas, ranking individual Gamers Club e histórico de todas as partidas disputadas no Discord e na Web.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                fetchLeaderboard();
                fetchMatches();
              }}
              disabled={loadingPlayers || loadingMatches}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw size={13} className={loadingPlayers || loadingMatches ? 'animate-spin text-amber-400' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Classificação Geral vs Histórico de Mixes */}
        <div className="px-5 sm:px-7 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setActiveTab('ranking');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'ranking'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Trophy size={14} />
              <span>Classificação de Jogadores</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                {players.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setActiveTab('matches');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'matches'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Layers size={14} />
              <span>Histórico de Mixes Registrados</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30 text-purple-200">
                {matchesStats.total}
              </span>
              {matchesStats.discordCount > 0 && (
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono bg-purple-950/80 border border-purple-500/40 text-purple-300 px-1.5 py-0.2 rounded">
                  <DiscordIcon size={10} />
                  <span>{matchesStats.discordCount} Discord</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: RANKING DE JOGADORES */}
        {activeTab === 'ranking' && (
          <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {loadingPlayers ? (
              <div className="py-16 text-center space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <RefreshCw size={28} className="mx-auto text-amber-400 animate-spin" />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Consultando dados do Hall da Fama...
                </p>
              </div>
            ) : players.length === 0 ? (
              <div className="p-8 sm:p-10 bg-slate-950/80 border-2 border-dashed border-amber-500/30 rounded-3xl text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <Trophy size={32} />
                </div>
                <div className="max-w-lg mx-auto space-y-2">
                  <h3 className="text-lg sm:text-xl font-black font-heading text-white">
                    Nenhum jogador pontuou ainda
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Quando um mix for finalizado (seja via <strong>Discord Bot</strong> com <code>/mix-resultado</code> ou pelo site), as vitórias e derrotas aparecem aqui automaticamente!
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Top 3 Podium */}
                {sortedPlayers.length >= 3 && !search && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    
                    {/* 2nd Place */}
                    {top3[1] && (
                      <div className="order-2 sm:order-1 bg-slate-950/80 border border-slate-700/60 rounded-2xl p-4 text-center relative overflow-hidden flex flex-col items-center justify-between shadow-lg">
                        <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow mb-2">
                          2º
                        </div>
                        <PlayerAvatar avatar={top3[1].avatar} nick={top3[1].nick} size="md" />
                        <h4 className="font-bold text-sm text-white mt-2 truncate max-w-[160px]">{top3[1].nick}</h4>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <GCBadge level={top3[1].level} size="xs" />
                          <span>• {top3[1].wins}V / {top3[1].losses}D</span>
                        </div>
                        <div className="mt-2 text-xs font-mono font-black text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg">
                          {top3[1].winRate}% Win Rate
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {top3[0] && (
                      <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-500/15 via-slate-950 to-slate-950 border-2 border-amber-400 rounded-3xl p-5 text-center relative overflow-hidden flex flex-col items-center justify-between shadow-2xl shadow-amber-500/15 scale-105 z-10">
                        <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-400/40 mb-2 animate-bounce">
                          👑 1º
                        </div>
                        <PlayerAvatar avatar={top3[0].avatar} nick={top3[0].nick} size="lg" />
                        <h4 className="font-black text-base text-amber-300 mt-2 truncate max-w-[180px]">{top3[0].nick}</h4>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-slate-300">
                          <GCBadge level={top3[0].level} size="xs" />
                          <span>• {top3[0].wins}V / {top3[0].losses}D</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs font-mono font-black text-amber-400 bg-amber-500/20 border border-amber-400/30 px-3 py-1 rounded-full">
                          <Flame size={13} className="text-amber-400" />
                          <span>{top3[0].winRate}% Win Rate ({top3[0].streak || 0}x 🔥)</span>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {top3[2] && (
                      <div className="order-3 sm:order-3 bg-slate-950/80 border border-amber-700/40 rounded-2xl p-4 text-center relative overflow-hidden flex flex-col items-center justify-between shadow-lg">
                        <div className="w-8 h-8 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow mb-2">
                          3º
                        </div>
                        <PlayerAvatar avatar={top3[2].avatar} nick={top3[2].nick} size="md" />
                        <h4 className="font-bold text-sm text-white mt-2 truncate max-w-[160px]">{top3[2].nick}</h4>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <GCBadge level={top3[2].level} size="xs" />
                          <span>• {top3[2].wins}V / {top3[2].losses}D</span>
                        </div>
                        <div className="mt-2 text-xs font-mono font-black text-amber-500 bg-slate-800/80 px-2.5 py-1 rounded-lg">
                          {top3[2].winRate}% Win Rate
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Filter Controls & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar jogador por nick ou Steam ID..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                    {[
                      { id: 'wins', label: 'Vitórias' },
                      { id: 'winRate', label: 'Win Rate' },
                      { id: 'matches', label: 'Partidas' },
                      { id: 'level', label: 'Nível' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (soundEnabled) playClickSound();
                          setSortBy(tab.id);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sortBy === tab.id
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Players Table */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70 shadow-inner">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800 tracking-wider">
                        <tr>
                          <th className="py-3 px-3.5 text-center w-12">#</th>
                          <th className="py-3 px-3.5">Jogador</th>
                          <th className="py-3 px-3.5 text-center">Nível GC</th>
                          <th className="py-3 px-3.5 text-center">Partidas (V/D)</th>
                          <th className="py-3 px-3.5 text-center">Win Rate</th>
                          <th className="py-3 px-3.5 text-center">Streak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {sortedPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                              Nenhum jogador encontrado para a busca "{search}".
                            </td>
                          </tr>
                        ) : (
                          sortedPlayers.map((p, index) => {
                            const isPodium = index < 3;
                            return (
                              <tr key={p.id || index} className="hover:bg-slate-900/50 transition-colors">
                                <td className="py-3 px-3.5 text-center">
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                </td>
                                <td className="py-3 px-3.5 flex items-center gap-2.5">
                                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                                  <span className={`font-bold font-sans ${isPodium ? 'text-white' : 'text-slate-300'}`}>
                                    {p.nick}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  <GCBadge level={p.level || 16} size="xs" />
                                </td>
                                <td className="py-3 px-3.5 text-center text-slate-300">
                                  <span className="text-emerald-400 font-bold">{p.wins || 0}V</span>
                                  {' - '}
                                  <span className="text-rose-400 font-bold">{p.losses || 0}D</span>
                                  <span className="text-slate-500 text-[10px] ml-1">
                                    ({(p.wins || 0) + (p.losses || 0)})
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-center font-bold text-amber-400">
                                  {p.winRate || 0}%
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  {(p.streak || 0) > 0 ? (
                                    <span className="text-amber-400 font-bold flex items-center justify-center gap-0.5">
                                      <Flame size={12} /> {p.streak}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: HISTÓRICO GERAL DE MIXES (DISCORD + WEB) */}
        {activeTab === 'matches' && (
          <div className="p-5 sm:p-7 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Source Filters */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMatchSourceFilter('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    matchSourceFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Todos os Mixes</span>
                  <span className="text-[10px] opacity-80">({matchesStats.total})</span>
                </button>

                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMatchSourceFilter('discord');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    matchSourceFilter === 'discord'
                      ? 'bg-purple-600 text-white font-black'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  <DiscordIcon size={12} />
                  <span>Via Discord</span>
                  <span className="text-[10px] opacity-80">({matchesStats.discordCount})</span>
                </button>

                <button
                  onClick={() => {
                    if (soundEnabled) playClickSound();
                    setMatchSourceFilter('web');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    matchSourceFilter === 'web'
                      ? 'bg-sky-600 text-white font-black'
                      : 'text-sky-300 hover:text-white'
                  }`}
                >
                  <Globe size={12} />
                  <span>Via Site Web</span>
                  <span className="text-[10px] opacity-80">({matchesStats.webCount})</span>
                </button>
              </div>

              {/* Map Filter & Search */}
              <div className="flex items-center gap-2 flex-1 justify-end">
                <select
                  value={matchMapFilter}
                  onChange={(e) => setMatchMapFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 shrink-0 cursor-pointer"
                >
                  {MAP_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.icon} {m.label}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Buscar por jogador, canal, ID..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Matches List */}
            {loadingMatches ? (
              <div className="py-16 text-center space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <RefreshCw size={28} className="mx-auto text-purple-400 animate-spin" />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Sincronizando histórico de partidas do Discord e Site...
                </p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-950/60 border-2 border-dashed border-slate-800 rounded-2xl">
                <Layers size={36} className="mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-300">
                  Nenhum mix encontrado com os filtros selecionados.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Partidas finalizadas no Discord através do comando <code>/mix-resultado</code> ou no site aparecem aqui em tempo real!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMatches.map((m) => {
                  const isExpanded = expandedMatchId === m.id;
                  const isDiscord = m.source === 'discord';

                  return (
                    <div
                      key={m.id}
                      className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all shadow-md relative overflow-hidden space-y-3.5 group"
                    >
                      {/* Ambient map backing */}
                      {m.mapImage && (
                        <div
                          className="absolute right-0 top-0 w-64 h-full bg-cover bg-right opacity-5 pointer-events-none rounded-r-2xl"
                          style={{ backgroundImage: `url(${m.mapImage})` }}
                        />
                      )}

                      {/* Header Row: Origin Badge, Match ID, Date */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDiscord ? (
                            <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <DiscordIcon size={13} className="text-purple-400" />
                              <span>Discord: <strong>{m.guildName || 'Servidor'}</strong></span>
                              {m.channelName && (
                                <span className="opacity-80 font-mono text-[11px]">• {m.channelName}</span>
                              )}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <Globe size={13} className="text-sky-400" />
                              <span>Site Web: <strong>{m.roomName || 'Sala'}</strong></span>
                            </span>
                          )}

                          <button
                            onClick={() => handleCopyMatchId(m.id)}
                            className="font-mono text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copiar ID do Mix"
                          >
                            <span>#{m.id}</span>
                            {copiedId === m.id ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} className="opacity-60" />
                            )}
                          </button>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-500" />
                          <span>{m.dateFormatted || `${m.date} às ${m.time}`}</span>
                        </div>
                      </div>

                      {/* Main Match Visual: Map, Winner vs Loser, Final Score */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1">
                        <div className="flex items-center gap-3">
                          {m.mapImage ? (
                            <img
                              src={m.mapImage}
                              alt={m.map}
                              className="w-14 h-14 rounded-xl object-cover border border-slate-700 shadow shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0">
                              🗺️
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-heading font-black text-base sm:text-lg text-white">
                                {m.map}
                              </h3>
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase">
                                {m.format || 'MD1'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span>Declarado por: <strong className="text-slate-200">{m.declaredBy}</strong></span>
                              {m.balancePct && (
                                <span className="text-[10px] text-emerald-400 font-mono">
                                  • Equilíbrio GC: {m.balancePct}%
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Placar Esports */}
                        <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-2xl self-start md:self-auto shadow-inner">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                              🏆 Campeão
                            </span>
                            <span className="text-sm font-bold text-white truncate max-w-[120px] block">
                              {m.winner}
                            </span>
                          </div>

                          <div className="font-heading font-black text-xl sm:text-2xl text-amber-400 tracking-wider font-mono">
                            {m.score}
                          </div>

                          <div className="text-left">
                            <span className="text-[10px] uppercase font-bold text-rose-400 block">
                              💀 Derrotado
                            </span>
                            <span className="text-sm font-bold text-slate-300 truncate max-w-[120px] block">
                              {m.loser}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* MVP Highlight Banner if present */}
                      {m.mvpNick && (
                        <div className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Crown size={15} className="text-amber-400" />
                            <span>
                              <strong className="text-amber-300">MVP da Partida:</strong>{' '}
                              <span className="text-white font-bold">{m.mvpNick}</span>
                            </span>
                          </div>
                          {m.mvpVotes > 0 && (
                            <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              ⭐ {m.mvpVotes} votos da comunidade
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rosters Comparison (5v5 Players Roster) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {/* Winner Team Roster */}
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1.5">
                            <span className="flex items-center gap-1.5">
                              <Trophy size={13} />
                              <span>{m.winner} (Vencedores)</span>
                            </span>
                            <span className="font-mono text-[10px] text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
                              +1 Vitória no Ranking
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {(m.winnerPlayers || []).map((p, idx) => (
                              <div
                                key={p.id || idx}
                                className="flex items-center justify-between text-xs text-slate-300"
                              >
                                <div className="flex items-center gap-2">
                                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="xs" />
                                  <span className="font-medium text-white">{p.nick}</span>
                                  {p.role === 'Capitão' && (
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                                      C
                                    </span>
                                  )}
                                  {m.mvpNick === p.nick && (
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 border border-amber-500/30 px-1 py-0.2 rounded flex items-center gap-0.5">
                                      👑 MVP
                                    </span>
                                  )}
                                </div>
                                <GCBadge level={p.level || 16} size="xs" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Loser Team Roster */}
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-1.5">
                            <span className="flex items-center gap-1.5">
                              <Shield size={13} className="text-slate-500" />
                              <span>{m.loser} (Vice-Campeões)</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              Partida Computada
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {(m.loserPlayers || []).map((p, idx) => (
                              <div
                                key={p.id || idx}
                                className="flex items-center justify-between text-xs text-slate-400"
                              >
                                <div className="flex items-center gap-2">
                                  <PlayerAvatar avatar={p.avatar} nick={p.nick} size="xs" />
                                  <span className="font-medium text-slate-300">{p.nick}</span>
                                  {p.role === 'Capitão' && (
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                                      C
                                    </span>
                                  )}
                                </div>
                                <GCBadge level={p.level || 16} size="xs" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Server connect info if available */}
                      {m.serverConnect && (
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono truncate">
                            Servidor: <strong className="text-emerald-400">{m.serverConnect}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400 shrink-0" />
            <span>
              {activeTab === 'ranking'
                ? 'Vitórias e derrotas computadas de todas as partidas oficiais do Discord e Site.'
                : `${filteredMatches.length} mixes registrados no banco de dados com histórico completo.`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
