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
import { cryptoShuffle } from '../utils/random';
import { DEFAULT_TOURNAMENT_TEAMS, PRESET_LOGOS } from '../data/tournamentTeams';
import { drawTournamentBracketCanvas, drawMatchVersusCardCanvas } from '../utils/tournamentCanvas';
import { getTournamentRecommendation, buildMatchesStructure } from '../utils/tournamentAdvisor';

export default function TournamentBracketModal({
  isOpen,
  onClose,
  onLoadTeamsToMix = null,
  soundEnabled = true,
  roomId = 'MIX',
}) {
  const [activeTab, setActiveTab] = useState('bracket'); // 'bracket' | 'schedule' | 'teams'
  const [teamCount, setTeamCount] = useState(() => {
    try {
      const saved = localStorage.getItem(`cs2_tournament_teamcount_${roomId}`);
      if (saved) return Math.max(2, Math.min(16, Number(saved) || 8));
    } catch (e) {}
    return 8;
  });
  const [tournamentName, setTournamentName] = useState(() => {
    try {
      return localStorage.getItem(`cs2_tournament_name_${roomId}`) || 'COPA DE MIX CS2 2026';
    } catch (e) {
      return 'COPA DE MIX CS2 2026';
    }
  });
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

  // Smart Advisor Recommendation
  const recommendation = useMemo(() => {
    return getTournamentRecommendation(teamCount);
  }, [teamCount]);

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
      localStorage.setItem(`cs2_tournament_teamcount_${roomId}`, String(teamCount));
    } catch (e) {}
  }, [teams, matches, tournamentName, teamCount, roomId]);

  const getNextSlotTarget = useCallback((matchId, count) => {
    if (count === 4) {
      if (matchId === 'm1') return { nextId: 'm3', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 'm2') return { nextId: 'm3', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    if (count === 5) {
      if (matchId === 'pi1') return { nextId: 'm1', slot: 'teamB', placeholder: 'Vencedor Play-in' };
      if (matchId === 'm1') return { nextId: 'm3', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 'm2') return { nextId: 'm3', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    if (count === 6) {
      if (matchId === 'q1') return { nextId: 'm1', slot: 'teamB', placeholder: 'Vencedor QF1' };
      if (matchId === 'q2') return { nextId: 'm2', slot: 'teamB', placeholder: 'Vencedor QF2' };
      if (matchId === 'm1') return { nextId: 'm3', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 'm2') return { nextId: 'm3', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    if (count === 7) {
      if (matchId === 'q1') return { nextId: 'm1', slot: 'teamB', placeholder: 'Vencedor QF1' };
      if (matchId === 'q2') return { nextId: 'm2', slot: 'teamA', placeholder: 'Vencedor QF2' };
      if (matchId === 'q3') return { nextId: 'm2', slot: 'teamB', placeholder: 'Vencedor QF3' };
      if (matchId === 'm1') return { nextId: 'm3', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 'm2') return { nextId: 'm3', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    if (count === 8) {
      if (matchId === 'q1') return { nextId: 's1', slot: 'teamA', placeholder: 'Vencedor Q1' };
      if (matchId === 'q2') return { nextId: 's1', slot: 'teamB', placeholder: 'Vencedor Q2' };
      if (matchId === 'q3') return { nextId: 's2', slot: 'teamA', placeholder: 'Vencedor Q3' };
      if (matchId === 'q4') return { nextId: 's2', slot: 'teamB', placeholder: 'Vencedor Q4' };
      if (matchId === 's1') return { nextId: 'f1', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 's2') return { nextId: 'f1', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    if (count >= 9 && count <= 12) {
      if (matchId === 'pi1') return { nextId: 'q1', slot: 'teamB', placeholder: 'Vencedor Play-in 1' };
      if (matchId === 'pi2') return { nextId: 'q3', slot: 'teamB', placeholder: 'Vencedor Play-in 2' };
      if (matchId === 'q1') return { nextId: 's1', slot: 'teamA', placeholder: 'Vencedor Q1' };
      if (matchId === 'q2') return { nextId: 's1', slot: 'teamB', placeholder: 'Vencedor Q2' };
      if (matchId === 'q3') return { nextId: 's2', slot: 'teamA', placeholder: 'Vencedor Q3' };
      if (matchId === 'q4') return { nextId: 's2', slot: 'teamB', placeholder: 'Vencedor Q4' };
      if (matchId === 's1') return { nextId: 'f1', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 's2') return { nextId: 'f1', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    if (count >= 13) {
      if (matchId === 'o1') return { nextId: 'q1', slot: 'teamA', placeholder: 'Vencedor O1' };
      if (matchId === 'o2') return { nextId: 'q1', slot: 'teamB', placeholder: 'Vencedor O2' };
      if (matchId === 'o3') return { nextId: 'q2', slot: 'teamA', placeholder: 'Vencedor O3' };
      if (matchId === 'o4') return { nextId: 'q2', slot: 'teamB', placeholder: 'Vencedor O4' };
      if (matchId === 'o5') return { nextId: 'q3', slot: 'teamA', placeholder: 'Vencedor O5' };
      if (matchId === 'o6') return { nextId: 'q3', slot: 'teamB', placeholder: 'Vencedor O6' };
      if (matchId === 'o7') return { nextId: 'q4', slot: 'teamA', placeholder: 'Vencedor O7' };
      if (matchId === 'o8') return { nextId: 'q4', slot: 'teamB', placeholder: 'Vencedor O8' };
      if (matchId === 'q1') return { nextId: 's1', slot: 'teamA', placeholder: 'Vencedor Q1' };
      if (matchId === 'q2') return { nextId: 's1', slot: 'teamB', placeholder: 'Vencedor Q2' };
      if (matchId === 'q3') return { nextId: 's2', slot: 'teamA', placeholder: 'Vencedor Q3' };
      if (matchId === 'q4') return { nextId: 's2', slot: 'teamB', placeholder: 'Vencedor Q4' };
      if (matchId === 's1') return { nextId: 'f1', slot: 'teamA', placeholder: 'Vencedor SF1' };
      if (matchId === 's2') return { nextId: 'f1', slot: 'teamB', placeholder: 'Vencedor SF2' };
      return null;
    }
    return null;
  }, []);

  const clearDownstreamWinner = useCallback((next, matchId, oldWinner, count) => {
    const target = getNextSlotTarget(matchId, count);
    if (!target || !next[target.nextId]) return next;

    const downstream = { ...next[target.nextId] };
    const hadOldWinnerInSlot = !oldWinner || downstream[target.slot] === oldWinner;
    if (hadOldWinnerInSlot) {
      downstream[target.slot] = target.placeholder;
    }

    const previousDownstreamWinner = downstream.winner;
    if (previousDownstreamWinner && (!oldWinner || previousDownstreamWinner === oldWinner)) {
      downstream.winner = null;
      downstream.status = (downstream.scoreA > 0 || downstream.scoreB > 0) ? 'live' : 'pending';
      next[target.nextId] = downstream;
      return clearDownstreamWinner(next, target.nextId, previousDownstreamWinner, count);
    }

    next[target.nextId] = downstream;
    return next;
  }, [getNextSlotTarget]);

  // Propagador Inteligente de Vencedores entre Chaves
  const propagateWinner = useCallback((next, matchId, winnerTeam, count) => {
    if (!winnerTeam) return next;
    const target = getNextSlotTarget(matchId, count);
    if (!target || !next[target.nextId]) return next;
    next[target.nextId] = {
      ...next[target.nextId],
      [target.slot]: winnerTeam,
    };
    return next;
  }, [getNextSlotTarget]);

  // Initialize Matches using buildMatchesStructure
  const initBracketMatches = useCallback((count, currentTeams = teams) => {
    const validCount = Math.max(2, Math.min(16, Number(count) || 8));
    const generated = buildMatchesStructure(validCount, currentTeams);
    setMatches(generated);
  }, [teams]);

  // Handle Dynamic Team Count Change
  const handleSelectTeamCount = (count) => {
    const validCount = Math.max(2, Math.min(16, Number(count) || 8));
    if (soundEnabled) playClickSound();
    setTeamCount(validCount);
    initBracketMatches(validCount, teams);
    const available = teams.slice(0, validCount);
    if (!available.some((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(available[0]?.id || 'team-1');
    }
  };

  useEffect(() => {
    if (!matches || Object.keys(matches).length === 0) {
      initBracketMatches(teamCount);
    }
  }, [teamCount, matches, initBracketMatches]);

  // Handle Team Shuffling
  const handleShuffleTeams = () => {
    if (soundEnabled) playClickSound();
    const shuffled = cryptoShuffle(teams);
    setTeams(shuffled);
    initBracketMatches(teamCount, shuffled);
  };

  // Update Score & Propagate/Reset Winner (CS2 MR12: >= 13 rounds with >= 2-round lead)
  const updateMatchScore = (matchId, side, score) => {
    const num = Math.max(0, parseInt(score, 10) || 0);
    setMatches((prev) => {
      if (!prev[matchId]) return prev;
      const match = { ...prev[matchId] };
      const previousWinner = match.winner;
      if (side === 'A') match.scoreA = num;
      if (side === 'B') match.scoreB = num;

      const scoreA = Number(match.scoreA) || 0;
      const scoreB = Number(match.scoreB) || 0;

      if (scoreA >= 13 && scoreA - scoreB >= 2) {
        match.winner = match.teamA;
        match.status = 'finished';
      } else if (scoreB >= 13 && scoreB - scoreA >= 2) {
        match.winner = match.teamB;
        match.status = 'finished';
      } else {
        match.winner = null;
        match.status = (scoreA > 0 || scoreB > 0) ? 'live' : 'pending';
      }

      const next = { ...prev, [matchId]: match };
      if (previousWinner && previousWinner !== match.winner) {
        clearDownstreamWinner(next, matchId, previousWinner, teamCount);
      }
      if (match.winner) {
        return propagateWinner(next, matchId, match.winner, teamCount);
      }
      return next;
    });
  };

  const setManualWinner = (matchId, winnerTeam) => {
    if (soundEnabled) playClickSound();
    setMatches((prev) => {
      const match = { ...prev[matchId], winner: winnerTeam, status: 'finished' };
      const next = { ...prev, [matchId]: match };
      return propagateWinner(next, matchId, winnerTeam, teamCount);
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
  const champion = teamCount === 2 ? matches.f1?.winner : (matches.f1?.winner || matches.m3?.winner || null);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={tournamentName}
    >
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
            type="button"
            aria-label="Fechar janela de torneio"
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
            {/* Dynamic Stepper */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold hidden sm:inline">
                Equipes:
              </span>
              <button
                type="button"
                onClick={() => handleSelectTeamCount(teamCount - 1)}
                disabled={teamCount <= 2}
                className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-slate-400 hover:text-white bg-slate-900 border border-slate-800 disabled:opacity-30 cursor-pointer"
                title="Diminuir equipes"
              >
                -
              </button>
              <span className="px-1.5 font-mono text-xs font-black text-amber-400">
                {teamCount}
              </span>
              <button
                type="button"
                onClick={() => handleSelectTeamCount(teamCount + 1)}
                disabled={teamCount >= 16}
                className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-slate-400 hover:text-white bg-slate-900 border border-slate-800 disabled:opacity-30 cursor-pointer"
                title="Aumentar equipes"
              >
                +
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
          <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-5">
            {/* AI TOURNAMENT ADVISOR CARD */}
            <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full shadow-sm">
                      🧠 {recommendation.badge}
                    </span>
                    <h4 className="text-sm sm:text-base font-black font-heading text-white">
                      {recommendation.title}
                    </h4>
                    <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-bold">
                      ⏱️ {recommendation.estimatedDuration}
                    </span>
                    <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full font-bold">
                      ⚔️ {recommendation.totalMatches} Partidas • {recommendation.rounds} Rodadas
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-amber-400">Fórmula Recomendada: </strong>
                    {recommendation.rationale}
                  </p>
                  {recommendation.byes && recommendation.byes.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-mono pt-0.5">
                      <Flame size={13} className="text-amber-400 shrink-0" />
                      <span>Folgas Estratégicas (BYEs): <strong>Seeds {recommendation.byes.map((b) => `#${b}`).join(', ')}</strong> avançam direto!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Definir Quantidade de Times:
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {[2, 3, 4, 5, 6, 8, 10, 12, 16].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSelectTeamCount(num)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        teamCount === num
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 ring-1 ring-amber-300 scale-105'
                          : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <div className="flex items-center ml-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleSelectTeamCount(teamCount - 1)}
                      disabled={teamCount <= 2}
                      className="px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-1.5 text-xs font-mono font-black text-amber-400">{teamCount}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectTeamCount(teamCount + 1)}
                      disabled={teamCount >= 16}
                      className="px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

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

            {/* DYNAMIC BRACKET PHASES */}
            {(() => {
              // Reusable Match Card Renderer
              const renderMatchCard = (mKey, match, customTitle = null, isFinal = false) => {
                if (!match) return null;
                const isAWin = match.winner && match.winner === match.teamA;
                const isBWin = match.winner && match.winner === match.teamB;

                return (
                  <div
                    key={mKey}
                    className={`rounded-2xl p-3 space-y-2 transition-all shadow-lg ${
                      isFinal
                        ? 'bg-slate-950/90 border-2 border-amber-500/60 shadow-amber-500/10'
                        : match.winner
                        ? 'bg-slate-950/80 border border-amber-500/30'
                        : 'bg-slate-950/80 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${match.status === 'live' ? 'bg-rose-500 animate-pulse' : isFinal ? 'bg-amber-400' : 'bg-slate-500'}`} />
                        <span className="truncate">{customTitle || match.title || match.roundName || 'Confronto'}</span>
                        <span className="text-[10px] text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold shrink-0">
                          {match.format || 'MD1'}
                        </span>
                      </span>
                      <span className="text-slate-500 text-[11px] shrink-0 font-mono">{match.time}</span>
                    </div>

                    {/* Team A */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                        isAWin ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        <span className="text-base shrink-0">{getTeamIcon(match.teamA)}</span>
                        <button
                          type="button"
                          onClick={() => setManualWinner(mKey, match.teamA)}
                          className="font-bold text-xs text-white hover:text-amber-300 cursor-pointer truncate text-left"
                          title="Clique para declarar vencedor"
                        >
                          {match.teamA}
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={match.scoreA}
                        onChange={(e) => updateMatchScore(mKey, 'A', e.target.value)}
                        className="w-11 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs py-1 text-white outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Team B */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                        isBWin ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        <span className="text-base shrink-0">{getTeamIcon(match.teamB)}</span>
                        <button
                          type="button"
                          onClick={() => setManualWinner(mKey, match.teamB)}
                          className="font-bold text-xs text-white hover:text-amber-300 cursor-pointer truncate text-left"
                          title="Clique para declarar vencedor"
                        >
                          {match.teamB}
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={match.scoreB}
                        onChange={(e) => updateMatchScore(mKey, 'B', e.target.value)}
                        className="w-11 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs py-1 text-white outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-900">
                      <button
                        onClick={() => handleOpenExportMatch(match)}
                        className="py-1 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Image size={11} className="text-indigo-400" />
                        <span>Card Versus</span>
                      </button>
                      {onLoadTeamsToMix && (
                        <button
                          onClick={() => handleSendMatchToMix(match)}
                          className={`py-1 px-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                            isFinal
                              ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 shadow-md'
                              : 'bg-slate-900 hover:bg-slate-800 text-amber-300'
                          }`}
                        >
                          {isFinal ? <Trophy size={11} className="text-slate-950" /> : <Play size={11} className="text-amber-400" />}
                          <span>{isFinal ? 'Jogar Final' : 'Jogar no Mix'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              };

              // 2 Times Layout
              if (teamCount === 2) {
                return (
                  <div className="max-w-xl mx-auto space-y-4">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800 text-center">
                      🏆 Decisão do Título (MD3 / MD5)
                    </span>
                    {renderMatchCard('f1', matches.f1 || matches.m1, 'Showdown Decisivo', true)}
                  </div>
                );
              }

              // 3 Times Layout (Triangular)
              if (teamCount === 3) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Fase de Pontos • Triangular (MD1)
                      </span>
                      {['r1', 'r2', 'r3'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final (Top 1 vs Top 2)
                      </span>
                      {renderMatchCard('f1', matches.f1, 'Decisão do Triangular', true)}
                    </div>
                  </div>
                );
              }

              // 4 Times Layout
              if (teamCount === 4) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Semifinais (MD3)
                      </span>
                      {['m1', 'm2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final (MD3)
                      </span>
                      {renderMatchCard('m3', matches.m3, 'Grande Decisão', true)}
                    </div>
                  </div>
                );
              }

              // 5 Times Layout
              if (teamCount === 5) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Play-in Preliminar
                      </span>
                      {renderMatchCard('pi1', matches.pi1, 'Play-in (#4 vs #5)')}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Semifinais (Top 3 BYE)
                      </span>
                      {['m1', 'm2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final
                      </span>
                      {renderMatchCard('m3', matches.m3, 'Grande Decisão', true)}
                    </div>
                  </div>
                );
              }

              // 6 Times Layout
              if (teamCount === 6) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Quartas de Final
                      </span>
                      {['q1', 'q2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Semifinais (Seeds #1 e #2 BYE)
                      </span>
                      {['m1', 'm2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final
                      </span>
                      {renderMatchCard('m3', matches.m3, 'Grande Decisão', true)}
                    </div>
                  </div>
                );
              }

              // 7 Times Layout
              if (teamCount === 7) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Quartas de Final (Seed #1 BYE)
                      </span>
                      {['q1', 'q2', 'q3'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Semifinais
                      </span>
                      {['m1', 'm2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final
                      </span>
                      {renderMatchCard('m3', matches.m3, 'Grande Decisão', true)}
                    </div>
                  </div>
                );
              }

              // 8 Times Layout
              if (teamCount === 8) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Quartas de Final
                      </span>
                      {['q1', 'q2', 'q3', 'q4'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Semifinais
                      </span>
                      {['s1', 's2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-4">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final
                      </span>
                      {renderMatchCard('f1', matches.f1, 'Grande Decisão', true)}
                    </div>
                  </div>
                );
              }

              // 9 to 12 Times Layout
              if (teamCount >= 9 && teamCount <= 12) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                    <div className="space-y-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Play-in Preliminar
                      </span>
                      {['pi1', 'pi2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Quartas de Final
                      </span>
                      {['q1', 'q2', 'q3', 'q4'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        Semifinais
                      </span>
                      {['s1', 's2'].map((k) => renderMatchCard(k, matches[k]))}
                    </div>
                    <div className="space-y-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                        🏆 Grande Final
                      </span>
                      {renderMatchCard('f1', matches.f1, 'Grande Decisão', true)}
                    </div>
                  </div>
                );
              }

              // 13 to 16 Times Layout (Major 16)
              return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                  <div className="space-y-2.5">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                      Oitavas de Final (8 Jogos)
                    </span>
                    {['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8'].map((k) => renderMatchCard(k, matches[k]))}
                  </div>
                  <div className="space-y-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                      Quartas de Final (4 Jogos)
                    </span>
                    {['q1', 'q2', 'q3', 'q4'].map((k) => renderMatchCard(k, matches[k]))}
                  </div>
                  <div className="space-y-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                      Semifinais (2 Jogos)
                    </span>
                    {['s1', 's2'].map((k) => renderMatchCard(k, matches[k]))}
                  </div>
                  <div className="space-y-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold block pb-1 border-b border-slate-800">
                      🏆 Grande Final
                    </span>
                    {renderMatchCard('f1', matches.f1, 'Grande Decisão', true)}
                  </div>
                </div>
              );
            })()}
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
