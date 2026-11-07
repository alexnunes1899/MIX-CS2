import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Flame, Search, X, RefreshCw, UserCheck, Shield, ChevronUp, ChevronDown } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import GCBadge from './GCBadge';
import FaceitBadge from './FaceitBadge';
import { playClickSound } from '../utils/audio';

export default function LeaderboardModal({
  isOpen,
  onClose,
  socket,
  soundEnabled,
}) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('wins'); // 'wins' | 'winRate' | 'matches' | 'level'

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (e) {
      console.warn('Falha ao carregar leaderboard via API:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      if (Array.isArray(data)) {
        setPlayers(data);
      }
    };
    socket.on('leaderboard_updated', handleUpdate);
    return () => socket.off('leaderboard_updated', handleUpdate);
  }, [socket]);

  if (!isOpen) return null;

  // Filter and sort players
  const filtered = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return p.nick?.toLowerCase().includes(q) || (p.steamId && p.steamId.includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'wins') return (b.wins || 0) - (a.wins || 0);
    if (sortBy === 'winRate') return (b.winRate || 0) - (a.winRate || 0);
    if (sortBy === 'matches') return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
    if (sortBy === 'level') return (b.level || 0) - (a.level || 0);
    return 0;
  });

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          title="Fechar Ranking"
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Trophy size={26} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-heading text-white flex items-center gap-2">
                <span>Hall da Fama & Ranking Geral</span>
              </h2>
              <p className="text-xs text-slate-400">
                Os melhores jogadores de mix do hub classificados por vitórias e taxa de vitória
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              fetchLeaderboard();
            }}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-amber-400' : ''} />
            <span>Atualizar</span>
          </button>
        </div>

        {loading ? (
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
                Nenhum dado foi computado ainda
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Ainda não há nenhuma partida finalizada com placar registrado no Hub. O Hall da Fama mostra apenas estatísticas reais das partidas disputadas pela comunidade!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase block">Passo 1</span>
                <strong className="text-xs text-white block font-heading">Monte o Mix 5v5</strong>
                <p className="text-[11px] text-slate-400">Crie uma sala, adicione os jogadores e sorteie os times e o mapa.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-sky-400 uppercase block">Passo 2</span>
                <strong className="text-xs text-white block font-heading">Jogue a Partida</strong>
                <p className="text-[11px] text-slate-400">Dispute o confronto no servidor online, LAN ou Radmin VPN.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase block">Passo 3</span>
                <strong className="text-xs text-white block font-heading">Salve o Placar</strong>
                <p className="text-[11px] text-slate-400">Registre o resultado final (ou use o GSI ao vivo) para computar Vitórias e Win Rate aqui!</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {sorted.length >= 3 && !search && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                
                {/* 2nd Place (Silver) */}
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

                {/* 1st Place (Gold Champion) */}
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
                      <span>{top3[0].winRate}% Win Rate ({top3[0].streak}x 🔥)</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place (Bronze) */}
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
              {/* Search */}
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

              {/* Sort Tabs */}
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
                      <th className="py-3 px-3.5 text-center">Nível</th>
                      <th className="py-3 px-3.5 text-center">Partidas (V/D)</th>
                      <th className="py-3 px-3.5 text-center">Win Rate</th>
                      <th className="py-3 px-3.5 text-center">Streak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum jogador encontrado para a busca "{search}".
                        </td>
                      </tr>
                    ) : (
                      sorted.map((p, idx) => {
                        const isRank1 = idx === 0;
                        const isRank2 = idx === 1;
                        const isRank3 = idx === 2;

                        return (
                          <tr
                            key={p.id || idx}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isRank1 ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-3 px-3.5 text-center font-bold">
                              {isRank1 ? (
                                <span className="text-amber-400 font-black">🥇 1º</span>
                              ) : isRank2 ? (
                                <span className="text-slate-300 font-black">🥈 2º</span>
                              ) : isRank3 ? (
                                <span className="text-amber-600 font-black">🥉 3º</span>
                              ) : (
                                <span className="text-slate-500">#{idx + 1}</span>
                              )}
                            </td>

                            {/* Nick & Avatar */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <PlayerAvatar avatar={p.avatar} nick={p.nick} size="sm" />
                                <div>
                                  <div className="font-bold text-white text-xs flex items-center gap-1.5 font-sans">
                                    <span>{p.nick}</span>
                                    {p.steamId && (
                                      <span className="text-[9px] text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded border border-sky-500/20" title={`SteamID: ${p.steamId}`}>
                                        STEAM
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500">
                                    {p.mvpCount ? `${p.mvpCount} MVPs` : 'Competidor'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Level */}
                            <td className="py-3 px-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <GCBadge level={p.level || 10} size="xs" />
                                {p.faceitLevel && (
                                  <FaceitBadge level={p.faceitLevel} size="xs" />
                                )}
                              </div>
                            </td>

                            {/* Matches (V/D) */}
                            <td className="py-3 px-3.5 text-center text-xs">
                              <span className="text-emerald-400 font-bold">{p.wins || 0}V</span>
                              <span className="text-slate-600 mx-1">/</span>
                              <span className="text-rose-400">{p.losses || 0}D</span>
                              <span className="text-[10px] text-slate-500 block">({p.matchesPlayed || 0} jogos)</span>
                            </td>

                            {/* Win Rate with progress bar */}
                            <td className="py-3 px-3.5 text-center">
                              <div className="flex flex-col items-center gap-1 max-w-[80px] mx-auto">
                                <span className={`text-xs font-bold ${
                                  p.winRate >= 70 ? 'text-amber-400' : p.winRate >= 50 ? 'text-emerald-400' : 'text-slate-400'
                                }`}>
                                  {p.winRate || 0}%
                                </span>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      p.winRate >= 70 ? 'bg-amber-400' : p.winRate >= 50 ? 'bg-emerald-400' : 'bg-slate-500'
                                    }`}
                                    style={{ width: `${Math.min(100, p.winRate || 0)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Streak */}
                            <td className="py-3 px-3.5 text-center">
                              {p.streak && p.streak > 0 ? (
                                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 inline-flex items-center gap-1">
                                  <Flame size={11} /> {p.streak}x
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600">-</span>
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

        {/* Footer Close Button */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 font-mono">
            * Os dados são atualizados automaticamente ao salvar o placar de qualquer Mix 5v5.
          </span>
          <button
            type="button"
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar Hall da Fama
          </button>
        </div>

      </div>
    </div>
  );
}
