import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Trophy,
  Swords,
  Shuffle,
  RotateCcw,
  Check,
  Play,
  Crown,
  Sparkles,
  Plus,
  Edit2,
  Calendar,
  Shield,
  Download,
  Copy,
  Image,
  Eye,
  Radio,
  Clock,
  ChevronRight,
  Flame,
  Zap,
} from 'lucide-react';
import { playClickSound, playReadySound } from '../utils/audio';
import { copyText } from '../utils/clipboard';
import { DEFAULT_TOURNAMENT_TEAMS, PRESET_LOGOS } from '../data/tournamentTeams';
import { drawTournamentBracketCanvas, drawMatchVersusCardCanvas } from '../utils/tournamentCanvas';

export default function TournamentBracketModal({
  isOpen,
  onClose,
  onLoadTeamsToMix = null,
  soundEnabled = true,
  roomId = 'MIX',
}) {
  const [activeTab, setActiveTab] = useState('bracket'); // 'bracket' | 'schedule' | 'teams'
  const [teamCount, setTeamCount] = useState(4); // 4 or 8
  const [tournamentName, setTournamentName] = useState('COPA DE MIX CS2 2026');
  const [isEditingName, setIsEditingName] = useState(false);

  // Teams with custom rosters, tags and logos
  const [teams, setTeams] = useState(() => {
    try {
      const saved = localStorage.getItem(`cs2_tournament_teams_${roomId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_TOURNAMENT_TEAMS;
  });

  // Matches State
  const [matches, setMatches] = useState(() => {
    try {
      const saved = localStorage.getItem(`cs2_tournament_matches_${roomId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  // Selected Team for Editing in Teams tab
  const [selectedTeamId, setSelectedTeamId] = useState('team-1');

  // Canvas Image Export State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState('bracket'); // 'bracket' | 'match'
  const [selectedMatchForExport, setSelectedMatchForExport] = useState(null);
  const [exportedDataUrl, setExportedDataUrl] = useState(null);
  const [copiedImage, setCopiedImage] = useState(false);
  const canvasRef = useRef(null);

  // Close on Escape Key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (exportModalOpen) {
          setExportModalOpen(false);
          return;
        }
        if (soundEnabled) playClickSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, exportModalOpen, soundEnabled]);

  // Persist state in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`cs2_tournament_teams_${roomId}`, JSON.stringify(teams));
      localStorage.setItem(`cs2_tournament_matches_${roomId}`, JSON.stringify(matches));
      localStorage.setItem(`cs2_tournament_name_${roomId}`, tournamentName);
    } catch (e) {}
  }, [teams, matches, tournamentName, roomId]);

  // Initialize Default Matches if empty
  const initBracketMatches = useCallback((count, currentTeams = teams) => {
    const tNames = currentTeams.map((t) => t.name);
    if (count === 4) {
      setMatches({
        m1: {
          id: 'm1',
          round: 'semi',
          title: 'Semifinal 1',
          teamA: tNames[0] || 'Time 1',
          teamB: tNames[1] || 'Time 2',
          scoreA: 0,
          scoreB: 0,
          winner: null,
          time: '20:00',
          status: 'pending', // 'pending' | 'live' | 'finished'
          format: 'MD3',
          map: 'de_mirage',
        },
        m2: {
          id: 'm2',
          round: 'semi',
          title: 'Semifinal 2',
          teamA: tNames[2] || 'Time 3',
          teamB: tNames[3] || 'Time 4',
          scoreA: 0,
          scoreB: 0,
          winner: null,
          time: '21:00',
          status: 'pending',
          format: 'MD3',
          map: 'de_inferno',
        },
        m3: {
          id: 'm3',
          round: 'final',
          title: 'Grande Final',
          teamA: 'Vencedor SF1',
          teamB: 'Vencedor SF2',
          scoreA: 0,
          scoreB: 0,
          winner: null,
          time: '22:30',
          status: 'pending',
          format: 'MD3',
          map: 'de_nuke',
        },
      });
    } else {
      setMatches({
        q1: { id: 'q1', round: 'quarter', title: 'Quartas 1', teamA: tNames[0], teamB: tNames[1], scoreA: 0, scoreB: 0, winner: null, time: '19:00', status: 'pending', format: 'MD1', map: 'de_mirage' },
        q2: { id: 'q2', round: 'quarter', title: 'Quartas 2', teamA: tNames[2], teamB: tNames[3], scoreA: 0, scoreB: 0, winner: null, time: '19:45', status: 'pending', format: 'MD1', map: 'de_inferno' },
        q3: { id: 'q3', round: 'quarter', title: 'Quartas 3', teamA: tNames[4], teamB: tNames[5], scoreA: 0, scoreB: 0, winner: null, time: '20:30', status: 'pending', format: 'MD1', map: 'de_dust2' },
        q4: { id: 'q4', round: 'quarter', title: 'Quartas 4', teamA: tNames[6], teamB: tNames[7], scoreA: 0, scoreB: 0, winner: null, time: '21:15', status: 'pending', format: 'MD1', map: 'de_ancient' },
        s1: { id: 's1', round: 'semi', title: 'Semifinal 1', teamA: 'Vencedor QF1', teamB: 'Vencedor QF2', scoreA: 0, scoreB: 0, winner: null, time: '22:00', status: 'pending', format: 'MD3', map: 'de_nuke' },
        s2: { id: 's2', round: 'semi', title: 'Semifinal 2', teamA: 'Vencedor QF3', teamB: 'Vencedor QF4', scoreA: 0, scoreB: 0, winner: null, time: '22:45', status: 'pending', format: 'MD3', map: 'de_anubis' },
        f1: { id: 'f1', round: 'final', title: 'Grande Final', teamA: 'Vencedor SF1', teamB: 'Vencedor SF2', scoreA: 0, scoreB: 0, winner: null, time: '23:30', status: 'pending', format: 'MD3', map: 'de_mirage' },
      });
    }
  }, [teams]);

  useEffect(() => {
    if (!matches || Object.keys(matches).length === 0) {
      initBracketMatches(teamCount);
    }
  }, [teamCount, matches, initBracketMatches]);

  // Handle Team Shuffling
  const handleShuffleTeams = () => {
    if (soundEnabled) playClickSound();
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    setTeams(shuffled);
    initBracketMatches(teamCount, shuffled);
  };

  // Update Score & Propagate Winner
  const updateMatchScore = (matchId, side, score) => {
    const num = Math.max(0, parseInt(score, 10) || 0);
    setMatches((prev) => {
      const match = { ...prev[matchId] };
      if (side === 'A') match.scoreA = num;
      if (side === 'B') match.scoreB = num;

      // Determine Winner
      if (match.scoreA >= 13 && match.scoreA > match.scoreB) {
        match.winner = match.teamA;
        match.status = 'finished';
      } else if (match.scoreB >= 13 && match.scoreB > match.scoreA) {
        match.winner = match.teamB;
        match.status = 'finished';
      } else if (match.scoreA > 0 || match.scoreB > 0) {
        match.status = 'live';
      }

      const next = { ...prev, [matchId]: match };

      if (teamCount === 4) {
        if (matchId === 'm1' && match.winner) next.m3.teamA = match.winner;
        if (matchId === 'm2' && match.winner) next.m3.teamB = match.winner;
      } else {
        if (matchId === 'q1' && match.winner) next.s1.teamA = match.winner;
        if (matchId === 'q2' && match.winner) next.s1.teamB = match.winner;
        if (matchId === 'q3' && match.winner) next.s2.teamA = match.winner;
        if (matchId === 'q4' && match.winner) next.s2.teamB = match.winner;
        if (matchId === 's1' && match.winner) next.f1.teamA = match.winner;
        if (matchId === 's2' && match.winner) next.f1.teamB = match.winner;
      }

      return next;
    });
  };

  const setManualWinner = (matchId, winnerTeam) => {
    if (soundEnabled) playClickSound();
    setMatches((prev) => {
      const match = { ...prev[matchId], winner: winnerTeam, status: 'finished' };
      const next = { ...prev, [matchId]: match };

      if (teamCount === 4) {
        if (matchId === 'm1') next.m3.teamA = winnerTeam;
        if (matchId === 'm2') next.m3.teamB = winnerTeam;
      } else {
        if (matchId === 'q1') next.s1.teamA = winnerTeam;
        if (matchId === 'q2') next.s1.teamB = winnerTeam;
        if (matchId === 'q3') next.s2.teamA = winnerTeam;
        if (matchId === 'q4') next.s2.teamB = winnerTeam;
        if (matchId === 's1') next.f1.teamA = winnerTeam;
        if (matchId === 's2') next.f1.teamB = winnerTeam;
      }

      return next;
    });
  };

  const handleUpdateMatchDetails = (matchId, updates) => {
    setMatches((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        ...updates,
      },
    }));
  };

  // Team Editing Handlers
  const currentEditingTeam = useMemo(() => {
    return teams.find((t) => t.id === selectedTeamId) || teams[0];
  }, [teams, selectedTeamId]);

  const handleUpdateCurrentTeam = (updates) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === selectedTeamId ? { ...t, ...updates } : t))
    );
  };

  const handleUpdatePlayer = (playerIdx, updates) => {
    const updatedPlayers = currentEditingTeam.players.map((p, idx) =>
      idx === playerIdx ? { ...p, ...updates } : p
    );
    handleUpdateCurrentTeam({ players: updatedPlayers });
  };

  const handleSetCaptain = (playerIdx) => {
    if (soundEnabled) playClickSound();
    const updatedPlayers = currentEditingTeam.players.map((p, idx) => ({
      ...p,
      isCaptain: idx === playerIdx,
    }));
    handleUpdateCurrentTeam({ players: updatedPlayers });
  };

  const handleApplyPresetLogo = (preset) => {
    if (soundEnabled) playClickSound();
    handleUpdateCurrentTeam({
      name: preset.name,
      tag: preset.tag,
      color: preset.color,
      icon: preset.icon,
    });
  };

  // Champion
  const champion = teamCount === 4 ? matches.m3?.winner : matches.f1?.winner;

  // Launch match directly into the CS2 Mix Hub
  const handleSendMatchToMix = (match) => {
    if (soundEnabled) playReadySound();
    if (onLoadTeamsToMix) {
      const teamAObj = teams.find((t) => t.name === match.teamA);
      const teamBObj = teams.find((t) => t.name === match.teamB);
      onLoadTeamsToMix({
        nameA: match.teamA,
        nameB: match.teamB,
        teamAObj,
        teamBObj,
        matchId: match.id,
      });
      onClose();
    }
  };

  // Render Image Preview on Canvas
  const handleOpenExportBracket = () => {
    if (soundEnabled) playClickSound();
    setExportMode('bracket');
    setExportModalOpen(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const url = drawTournamentBracketCanvas(canvas, {
          tournamentName,
          teamCount,
          matches,
          teams,
          champion,
        });
        setExportedDataUrl(url);
      }
    }, 100);
  };

  const handleOpenExportMatch = (match) => {
    if (soundEnabled) playClickSound();
    setSelectedMatchForExport(match);
    setExportMode('match');
    setExportModalOpen(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const teamAObj = teams.find((t) => t.name === match.teamA) || { name: match.teamA, tag: 'T1', icon: '🛡️', color: '#f59e0b' };
        const teamBObj = teams.find((t) => t.name === match.teamB) || { name: match.teamB, tag: 'T2', icon: '⚔️', color: '#0ea5e9' };
        const url = drawMatchVersusCardCanvas(canvas, {
          tournamentName,
          match,
          teamAData: teamAObj,
          teamBData: teamBObj,
          format: match.format || 'MD3',
        });
        setExportedDataUrl(url);
      }
    }, 100);
  };

  const handleDownloadImage = () => {
    if (soundEnabled) playClickSound();
    if (!exportedDataUrl) return;
    const a = document.createElement('a');
    a.href = exportedDataUrl;
    a.download = exportMode === 'bracket' ? `chaveamento_${tournamentName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png` : `match_${selectedMatchForExport?.id || 'versus'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyExportedImage = async () => {
    if (soundEnabled) playClickSound();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (navigator?.clipboard?.write && window.ClipboardItem) {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2000);
        });
        return;
      } catch (e) {}
    }

    copyText(`Chaveamento do Torneio CS2: ${window.location.href}`);
    setCopiedImage(true);
    setTimeout(() => setCopiedImage(false), 2000);
  };

  const getTeamIcon = (teamName) => {
    const t = teams.find((x) => x.name === teamName);
    return t?.icon || '🛡️';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header with Editable Tournament Name */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-md">
              <Trophy size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    autoFocus
                    className="bg-slate-950 border border-amber-500 rounded px-2 py-0.5 text-base font-black font-heading text-white outline-none w-64 sm:w-80"
                  />
                ) : (
                  <h2
                    onClick={() => setIsEditingName(true)}
                    className="text-base sm:text-lg font-black font-heading text-white truncate cursor-pointer hover:text-amber-300 transition-colors flex items-center gap-1.5"
                    title="Clique para editar o nome do torneio"
                  >
                    <span>{tournamentName}</span>
                    <Edit2 size={13} className="text-amber-400/70" />
                  </h2>
                )}
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase shrink-0">
                  {teamCount} Equipes
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Central Profissional: Chaveamento, Monitoramento Ao Vivo, Escalações e Gerador de Imagens.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation & Action Bar */}
        <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-2.5">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setActiveTab('bracket');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bracket'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Trophy size={13} />
              <span>Chaveamento</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setActiveTab('schedule');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schedule'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Calendar size={13} />
              <span>Tabela & Monitor Ao Vivo</span>
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playClickSound();
                setActiveTab('teams');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'teams'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Shield size={13} />
              <span>Gerenciar Times & Jogadores</span>
            </button>
          </div>

          {/* Quick Tools */}
          <div className="flex items-center gap-2">
            {/* Team Count Toggle */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-0.5 flex items-center">
              <button
                onClick={() => {
                  setTeamCount(4);
                  initBracketMatches(4);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  teamCount === 4 ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                4 Times
              </button>
              <button
                onClick={() => {
                  setTeamCount(8);
                  initBracketMatches(8);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  teamCount === 8 ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                8 Times
              </button>
            </div>

            {/* Export Bracket PNG */}
            <button
              onClick={handleOpenExportBracket}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20 active:scale-95 transition-all"
              title="Gera uma imagem de alta definição (1920x1080) da tabela do torneio para postar no Discord/WhatsApp"
            >
              <Image size={13} />
              <span>Gerar Imagem da Chave (PNG)</span>
            </button>

            {/* Shuffle */}
            <button
              onClick={handleShuffleTeams}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Embaralhar seeds das equipes"
            >
              <Shuffle size={13} />
            </button>

            {/* Reset */}
            <button
              onClick={() => initBracketMatches(teamCount)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Reiniciar Chaveamento"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* TAB 1: BRACKET VIEW */}
        {activeTab === 'bracket' && (
          <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-6">
            {champion && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-400 text-center space-y-1 shadow-xl animate-bounce">
                <Crown size={28} className="mx-auto text-amber-400" />
                <div className="text-[10px] font-mono text-amber-300 uppercase font-black tracking-widest">
                  GRANDE CAMPEÃO DO TORNEIO
                </div>
                <h3 className="text-2xl font-black font-heading text-white">{champion}</h3>
                <p className="text-xs text-amber-200">Parabéns aos vencedores da competição!</p>
              </div>
            )}

            {teamCount === 4 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Semis */}
                <div className="space-y-5">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                    Semifinais (MD1 / MD3)
                  </span>

                  {['m1', 'm2'].map((mKey, idx) => {
                    const m = matches[mKey];
                    if (!m) return null;
                    return (
                      <div
                        key={mKey}
                        className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-lg"
                      >
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            {m.title} • {m.format}
                          </span>
                          <span className="text-slate-500">{m.time}</span>
                        </div>

                        {/* Team A */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                            m.winner === m.teamA ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 mr-2">
                            <span className="text-base">{getTeamIcon(m.teamA)}</span>
                            <button
                              type="button"
                              onClick={() => setManualWinner(mKey, m.teamA)}
                              className="font-bold text-xs text-white hover:text-amber-400 cursor-pointer truncate text-left"
                            >
                              {m.teamA}
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={m.scoreA}
                            onChange={(e) => updateMatchScore(mKey, 'A', e.target.value)}
                            className="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs py-1 text-white outline-none"
                          />
                        </div>

                        {/* Team B */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                            m.winner === m.teamB ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 mr-2">
                            <span className="text-base">{getTeamIcon(m.teamB)}</span>
                            <button
                              type="button"
                              onClick={() => setManualWinner(mKey, m.teamB)}
                              className="font-bold text-xs text-white hover:text-amber-400 cursor-pointer truncate text-left"
                            >
                              {m.teamB}
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={m.scoreB}
                            onChange={(e) => updateMatchScore(mKey, 'B', e.target.value)}
                            className="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs py-1 text-white outline-none"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                          <button
                            onClick={() => handleOpenExportMatch(m)}
                            className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Image size={11} className="text-indigo-400" />
                            <span>Card Versus</span>
                          </button>
                          {onLoadTeamsToMix && (
                            <button
                              onClick={() => handleSendMatchToMix(m)}
                              className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play size={11} className="text-amber-400" />
                              <span>Jogar no Mix</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Final */}
                <div className="space-y-5">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                    🏆 Grande Final
                  </span>

                  {matches.m3 && (
                    <div className="bg-slate-950/90 border-2 border-amber-500/60 rounded-3xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
                      <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-400">
                        <span>DECISÃO DO TÍTULO • MD3</span>
                        {matches.m3.winner && (
                          <span className="text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                            👑 CAMPEÃO: {matches.m3.winner}
                          </span>
                        )}
                      </div>

                      {/* Team A */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          matches.m3.winner === matches.m3.teamA ? 'bg-amber-500/20 border border-amber-500/60' : 'bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 mr-2">
                          <span className="text-lg">{getTeamIcon(matches.m3.teamA)}</span>
                          <button
                            type="button"
                            onClick={() => setManualWinner('m3', matches.m3.teamA)}
                            className="font-bold text-sm text-white hover:text-amber-400 cursor-pointer truncate text-left"
                          >
                            {matches.m3.teamA}
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={matches.m3.scoreA}
                          onChange={(e) => updateMatchScore('m3', 'A', e.target.value)}
                          className="w-14 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-sm py-1.5 text-white outline-none"
                        />
                      </div>

                      {/* Team B */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          matches.m3.winner === matches.m3.teamB ? 'bg-amber-500/20 border border-amber-500/60' : 'bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 mr-2">
                          <span className="text-lg">{getTeamIcon(matches.m3.teamB)}</span>
                          <button
                            type="button"
                            onClick={() => setManualWinner('m3', matches.m3.teamB)}
                            className="font-bold text-sm text-white hover:text-amber-400 cursor-pointer truncate text-left"
                          >
                            {matches.m3.teamB}
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={matches.m3.scoreB}
                          onChange={(e) => updateMatchScore('m3', 'B', e.target.value)}
                          className="w-14 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-sm py-1.5 text-white outline-none"
                        />
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                        <button
                          onClick={() => handleOpenExportMatch(matches.m3)}
                          className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Image size={13} className="text-indigo-400" />
                          <span>Card Versus</span>
                        </button>
                        {onLoadTeamsToMix && (
                          <button
                            onClick={() => handleSendMatchToMix(matches.m3)}
                            className="py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                          >
                            <Trophy size={13} />
                            <span>Jogar Final</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 8 Teams View */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Quartas */}
                <div className="space-y-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                    Quartas de Final
                  </span>
                  {['q1', 'q2', 'q3', 'q4'].map((qKey) => {
                    const m = matches[qKey];
                    if (!m) return null;
                    return (
                      <div key={qKey} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{m.title}</span>
                          <button onClick={() => handleOpenExportMatch(m)} className="text-indigo-400 hover:underline cursor-pointer">
                            Card
                          </button>
                        </div>
                        <div className={`flex items-center justify-between p-1.5 rounded-lg ${m.winner === m.teamA ? 'bg-emerald-500/15' : 'bg-slate-900'}`}>
                          <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                            <span>{getTeamIcon(m.teamA)}</span>
                            <span onClick={() => setManualWinner(qKey, m.teamA)} className="font-bold text-white truncate cursor-pointer">{m.teamA}</span>
                          </div>
                          <input
                            type="number"
                            value={m.scoreA}
                            onChange={(e) => updateMatchScore(qKey, 'A', e.target.value)}
                            className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                          />
                        </div>
                        <div className={`flex items-center justify-between p-1.5 rounded-lg ${m.winner === m.teamB ? 'bg-emerald-500/15' : 'bg-slate-900'}`}>
                          <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                            <span>{getTeamIcon(m.teamB)}</span>
                            <span onClick={() => setManualWinner(qKey, m.teamB)} className="font-bold text-white truncate cursor-pointer">{m.teamB}</span>
                          </div>
                          <input
                            type="number"
                            value={m.scoreB}
                            onChange={(e) => updateMatchScore(qKey, 'B', e.target.value)}
                            className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Semis */}
                <div className="space-y-6">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                    Semifinais
                  </span>
                  {['s1', 's2'].map((sKey) => {
                    const m = matches[sKey];
                    if (!m) return null;
                    return (
                      <div key={sKey} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{m.title}</span>
                          <button onClick={() => handleOpenExportMatch(m)} className="text-indigo-400 hover:underline cursor-pointer">
                            Card
                          </button>
                        </div>
                        <div className={`flex items-center justify-between p-2 rounded-lg ${m.winner === m.teamA ? 'bg-emerald-500/15' : 'bg-slate-900'}`}>
                          <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                            <span>{getTeamIcon(m.teamA)}</span>
                            <span onClick={() => setManualWinner(sKey, m.teamA)} className="font-bold text-white truncate cursor-pointer">{m.teamA}</span>
                          </div>
                          <input
                            type="number"
                            value={m.scoreA}
                            onChange={(e) => updateMatchScore(sKey, 'A', e.target.value)}
                            className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                          />
                        </div>
                        <div className={`flex items-center justify-between p-2 rounded-lg ${m.winner === m.teamB ? 'bg-emerald-500/15' : 'bg-slate-900'}`}>
                          <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                            <span>{getTeamIcon(m.teamB)}</span>
                            <span onClick={() => setManualWinner(sKey, m.teamB)} className="font-bold text-white truncate cursor-pointer">{m.teamB}</span>
                          </div>
                          <input
                            type="number"
                            value={m.scoreB}
                            onChange={(e) => updateMatchScore(sKey, 'B', e.target.value)}
                            className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-0.5 text-white"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Final */}
                <div className="space-y-6">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                    🏆 Grande Final
                  </span>
                  {matches.f1 && (
                    <div className="bg-slate-950/90 border-2 border-amber-500/60 rounded-3xl p-4 space-y-3 shadow-2xl">
                      <div className="text-center">
                        <Trophy size={28} className="mx-auto text-amber-400 mb-1" />
                        <div className="text-xs font-black text-white uppercase">{matches.f1.title}</div>
                      </div>
                      <div className={`flex items-center justify-between p-2 rounded-xl ${matches.f1.winner === matches.f1.teamA ? 'bg-amber-500/20' : 'bg-slate-900'}`}>
                        <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                          <span>{getTeamIcon(matches.f1.teamA)}</span>
                          <span onClick={() => setManualWinner('f1', matches.f1.teamA)} className="font-bold text-xs text-white truncate cursor-pointer">{matches.f1.teamA}</span>
                        </div>
                        <input
                          type="number"
                          value={matches.f1.scoreA}
                          onChange={(e) => updateMatchScore('f1', 'A', e.target.value)}
                          className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 text-white"
                        />
                      </div>
                      <div className={`flex items-center justify-between p-2 rounded-xl ${matches.f1.winner === matches.f1.teamB ? 'bg-amber-500/20' : 'bg-slate-900'}`}>
                        <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                          <span>{getTeamIcon(matches.f1.teamB)}</span>
                          <span onClick={() => setManualWinner('f1', matches.f1.teamB)} className="font-bold text-xs text-white truncate cursor-pointer">{matches.f1.teamB}</span>
                        </div>
                        <input
                          type="number"
                          value={matches.f1.scoreB}
                          onChange={(e) => updateMatchScore('f1', 'B', e.target.value)}
                          className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 text-white"
                        />
                      </div>
                      <button
                        onClick={() => handleOpenExportMatch(matches.f1)}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Image size={12} className="text-indigo-400" />
                        <span>Gerar Card da Grande Final</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCHEDULE & LIVE MONITOR */}
        {activeTab === 'schedule' && (
          <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={16} className="text-amber-400" />
                  <span>Cronograma & Monitoramento de Partidas</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Acompanhe horários, placares e status de cada confronto do torneio em tempo real.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                {Object.values(matches).length} Jogos Programados
              </span>
            </div>

            <div className="space-y-3">
              {Object.values(matches).map((m) => {
                const teamAObj = teams.find((t) => t.name === m.teamA) || { tag: 'T1', icon: '🛡️' };
                const teamBObj = teams.find((t) => t.name === m.teamB) || { tag: 'T2', icon: '⚔️' };
                const isFinished = m.status === 'finished';
                const isLive = m.status === 'live';

                return (
                  <div
                    key={m.id}
                    className={`bg-slate-950/80 border rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-md ${
                      isLive ? 'border-rose-500/60 ring-1 ring-rose-500/40 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Left: Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center shrink-0 font-mono">
                        <Clock size={14} className="text-amber-400 mb-0.5" />
                        <span className="text-[11px] font-bold text-slate-300">{m.time}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-black text-sm text-white uppercase tracking-wide">
                            {m.title}
                          </span>
                          <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.2 rounded font-bold">
                            {m.format}
                          </span>
                          {isLive && (
                            <span className="text-[10px] font-mono text-rose-400 bg-rose-500/20 border border-rose-500/40 px-2 py-0.2 rounded-full font-bold flex items-center gap-1 animate-pulse">
                              <Radio size={10} /> AO VIVO
                            </span>
                          )}
                          {isFinished && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 rounded font-bold">
                              ✓ FINALIZADO
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          Mapa Oficial: <strong className="text-slate-200">{m.map}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Middle: Versus & Scores */}
                    <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-2xl">
                      {/* Team A */}
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs font-bold text-white truncate max-w-[120px]">{m.teamA}</span>
                        <span className="text-base">{teamAObj.icon}</span>
                      </div>

                      {/* Score inputs */}
                      <div className="flex items-center gap-2 font-mono">
                        <input
                          type="number"
                          value={m.scoreA}
                          onChange={(e) => updateMatchScore(m.id, 'A', e.target.value)}
                          className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 text-white font-bold"
                        />
                        <span className="text-slate-500">:</span>
                        <input
                          type="number"
                          value={m.scoreB}
                          onChange={(e) => updateMatchScore(m.id, 'B', e.target.value)}
                          className="w-10 bg-slate-950 border border-slate-700 rounded text-center text-xs py-1 text-white font-bold"
                        />
                      </div>

                      {/* Team B */}
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-base">{teamBObj.icon}</span>
                        <span className="text-xs font-bold text-white truncate max-w-[120px]">{m.teamB}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button
                        onClick={() => handleOpenExportMatch(m)}
                        className="flex-1 md:flex-none px-3 py-2 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        title="Gerar card visual da partida (Versus)"
                      >
                        <Image size={13} />
                        <span>Gerar Card</span>
                      </button>

                      {onLoadTeamsToMix && (
                        <button
                          onClick={() => handleSendMatchToMix(m)}
                          className="flex-1 md:flex-none px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                          title="Abrir confronto direto no Mix Hub"
                        >
                          <Play size={13} />
                          <span>Transmitir no Mix</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: TEAMS & ROSTERS MANAGER */}
        {activeTab === 'teams' && (
          <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Team Selector List */}
            <div className="md:col-span-4 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
                Equipes Participantes ({teams.length})
              </span>
              <div className="space-y-1.5">
                {teams.slice(0, teamCount).map((t, idx) => {
                  const isSelected = t.id === selectedTeamId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (soundEnabled) playClickSound();
                        setSelectedTeamId(t.id);
                      }}
                      className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-lg ring-1 ring-amber-400/40 text-white'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl">{t.icon || '🛡️'}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate text-white">{t.name}</span>
                          <span className="text-[10px] font-mono text-amber-400">TAG: [{t.tag}]</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Seed #{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Edit Selected Team and Rosters */}
            <div className="md:col-span-8 bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md border"
                    style={{ backgroundColor: `${currentEditingTeam.color}25`, borderColor: currentEditingTeam.color }}
                  >
                    {currentEditingTeam.icon || '🛡️'}
                  </div>
                  <div>
                    <h3 className="text-base font-black font-heading text-white">{currentEditingTeam.name}</h3>
                    <span className="text-xs font-mono text-slate-400">Editar Detalhes, Logo e Escalação de Jogadores</span>
                  </div>
                </div>
              </div>

              {/* Team Name and Tag Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nome do Time</label>
                  <input
                    type="text"
                    value={currentEditingTeam.name}
                    onChange={(e) => handleUpdateCurrentTeam({ name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tag Curta</label>
                  <input
                    type="text"
                    value={currentEditingTeam.tag}
                    onChange={(e) => handleUpdateCurrentTeam({ tag: e.target.value.toUpperCase().slice(0, 5) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Quick Preset Logos */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Escolher Brasão / Logo Oficial Rápida
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_LOGOS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPresetLogo(p)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        currentEditingTeam.tag === p.tag
                          ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 scale-105'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                      title={p.name}
                    >
                      <span className="text-xl">{p.icon}</span>
                      <span className="text-[9px] font-mono font-bold text-slate-300 truncate w-full">{p.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Roster of 5 Players */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-heading">
                    Escalação dos 5 Jogadores (Titulares)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Clique na coroa 👑 para definir o Capitão / IGL
                  </span>
                </div>

                <div className="space-y-2">
                  {currentEditingTeam.players.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => handleSetCaptain(idx)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            p.isCaptain
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                              : 'bg-slate-950 text-slate-600 border-slate-800 hover:text-slate-400'
                          }`}
                          title={p.isCaptain ? 'Capitão da Equipe' : 'Definir como Capitão'}
                        >
                          <Crown size={14} />
                        </button>
                        <span className="text-xs font-mono text-slate-500 w-4">#{idx + 1}</span>
                        <input
                          type="text"
                          value={p.nick}
                          onChange={(e) => handleUpdatePlayer(idx, { nick: e.target.value })}
                          placeholder={`Jogador ${idx + 1}`}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Role selector */}
                      <select
                        value={p.role || 'Rifler'}
                        onChange={(e) => handleUpdatePlayer(idx, { role: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-300 outline-none"
                      >
                        <option value="IGL">🧠 IGL</option>
                        <option value="AWPer">🎯 AWPer</option>
                        <option value="Entry">💣 Entry</option>
                        <option value="Rifler">⚡ Rifler</option>
                        <option value="Suporte">🛡️ Suporte</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-400" />
            <span>Chaveamento e tabelas salvos automaticamente em tempo real.</span>
          </span>
          <button
            onClick={() => {
              if (soundEnabled) playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            Fechar Janela
          </button>
        </div>

      </div>

      {/* EXPORT IMAGE MODAL (CANVAS PREVIEW & DOWNLOAD) */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-lg animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Image size={18} className="text-amber-400" />
                <h3 className="font-heading font-black text-white text-base">
                  {exportMode === 'bracket' ? 'Imagem da Tabela / Chaveamento (1080p HD)' : `Card de Confronto: ${selectedMatchForExport?.teamA} vs ${selectedMatchForExport?.teamB}`}
                </h3>
              </div>
              <button
                onClick={() => setExportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar flex flex-col items-center justify-center gap-4">
              {/* Canvas element */}
              <div className="border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-w-full">
                <canvas
                  ref={canvasRef}
                  className="max-h-[55vh] w-auto object-contain mx-auto"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full max-w-lg">
                <button
                  onClick={handleDownloadImage}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <Download size={15} />
                  <span>Baixar Imagem (PNG)</span>
                </button>

                <button
                  onClick={handleCopyExportedImage}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  {copiedImage ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  <span>{copiedImage ? 'Copiada!' : 'Copiar Imagem'}</span>
                </button>

                <button
                  onClick={() => setExportModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
