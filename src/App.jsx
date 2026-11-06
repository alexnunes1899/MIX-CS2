import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import PlayerForm from './components/PlayerForm';
import Lobby from './components/Lobby';
import TeamsView from './components/TeamsView';
import MapVeto from './components/MapVeto';
import FinalSummary from './components/FinalSummary';
import RoomsHubModal from './components/RoomsHubModal';
import MatchHistoryModal from './components/MatchHistoryModal';
import QuickVetoModal from './components/QuickVetoModal';
import QuickMapRollModal from './components/QuickMapRollModal';
import ChatDrawer from './components/ChatDrawer';
import CoinFlipModal from './components/CoinFlipModal';
import DraftRoulette from './components/DraftRoulette';
import CaptainsDraftView from './components/CaptainsDraftView';
import LandingPage from './components/LandingPage';
import SteamLoginGateModal from './components/SteamLoginGateModal';
import PlayerProfileModal from './components/PlayerProfileModal';
import { recordMatchResult } from './utils/playerStats';
import { ACTIVE_DUTY_MAPS } from './data/maps';
import { balanceTeams, shuffleTeams } from './utils/balance';
import { MOCK_PLAYERS } from './data/mockPlayers';

const socket = io('/', {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default function App() {
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'MIX-PRO';
  });

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') ? 'mix' : 'landing';
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [roomsHubOpen, setRoomsHubOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quickVetoOpen, setQuickVetoOpen] = useState(false);
  const [quickMapRollOpen, setQuickMapRollOpen] = useState(false);
  const [rouletteActive, setRouletteActive] = useState(false);
  const [pendingDrawMode, setPendingDrawMode] = useState('balanced');
  const [steamGateModalOpen, setSteamGateModalOpen] = useState(false);
  const [steamGateActionText, setSteamGateActionText] = useState('criar ou entrar no mix');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [roomNotice, setRoomNotice] = useState(null);

  // User's own saved profile (stored in localStorage)
  const [myProfile, setMyProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('cs2_mix_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return {
      id: `player-${Math.random().toString(36).substring(2, 9)}`,
      nick: '',
      level: 14,
      faceitLevel: 5,
      faceitElo: 1200,
      side: 'ANY',
      avatar: '🎯',
    };
  });

  const isSteamLogged = Boolean(myProfile?.steamId);

  const handleRequireSteamLogin = (actionText = 'acessar as salas de mix') => {
    setSteamGateActionText(actionText);
    setSteamGateModalOpen(true);
  };

  // Auto-dismiss room notices (e.g. room deleted or closed for inactivity)
  useEffect(() => {
    if (roomNotice) {
      const timer = setTimeout(() => setRoomNotice(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [roomNotice]);

  // Room state synchronized with server or local fallback
  const [room, setRoom] = useState({
    id: roomId,
    name: `Mix ${roomId}`,
    rankingSystem: 'gc', // 'gc' | 'faceit'
    phase: 'lobby',
    players: [],
    teamA: [],
    teamB: [],
    metrics: null,
    maps: [...ACTIVE_DUTY_MAPS],
    bannedMaps: [],
    currentTurn: 'teamA',
    finalMap: null,
    startingSideTeamB: null,
    serverIp: '',
    chat: [],
    history: [],
    coin: null,
    captainA: null,
    captainB: null,
    captainTurn: 'captainA',
    unassignedPlayers: [],
  });

  // Check for Steam Auth return on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamAuth = params.get('steam_auth');
    if (steamAuth === '1') {
      const steamId = params.get('steamId');
      const steamNick = params.get('nick');
      const steamAvatar = params.get('avatar');
      const faceitLevel = params.get('faceitLevel');
      const faceitElo = params.get('faceitElo');

      if (steamNick) {
        setMyProfile((prev) => {
          const updated = {
            ...prev,
            nick: steamNick,
            avatar: steamAvatar || prev.avatar,
            steamId: steamId || null,
            faceitLevel: faceitLevel ? Number(faceitLevel) : prev.faceitLevel || 5,
            faceitElo: faceitElo && faceitElo !== 'null' ? Number(faceitElo) : prev.faceitElo || 1200,
          };
          try {
            localStorage.setItem('cs2_mix_profile', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }

      const cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete('steam_auth');
      cleanUrl.searchParams.delete('steamId');
      cleanUrl.searchParams.delete('nick');
      cleanUrl.searchParams.delete('avatar');
      cleanUrl.searchParams.delete('faceitLevel');
      cleanUrl.searchParams.delete('faceitElo');
      cleanUrl.searchParams.delete('faceitFound');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, []);

  // Setup Socket listener
  useEffect(() => {
    socket.on('connect', () => {
      socket.emit('join_room', {
        roomId,
        player: myProfile.nick ? myProfile : null,
      });
    });

    socket.on('room_state', (updatedRoom) => {
      if (updatedRoom && updatedRoom.id === roomId) {
        setRoom(updatedRoom);
      }
    });

    socket.on('chat_message', (msg) => {
      setRoom((prev) => {
        if (prev.chat.some((m) => m.id === msg.id)) return prev;
        return { ...prev, chat: [...prev.chat, msg] };
      });
    });

    socket.on('room_deleted', ({ roomId: deletedId, message, reason }) => {
      if (deletedId === roomId) {
        setRoomNotice({
          title: reason === 'inactivity' ? 'Sala Encerrada por Inatividade' : 'Sala Excluída',
          message: message || 'Esta sala de mix foi excluída.',
          type: 'warning',
        });
        setView('landing');
        const u = new URL(window.location);
        u.searchParams.delete('room');
        window.history.pushState({}, '', u);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('room_state');
      socket.off('chat_message');
      socket.off('room_deleted');
    };
  }, [roomId, myProfile]);

  // Switch Room (Multi-room hub support)
  const handleSelectRoom = (newRoomCode, customName, rankingSystem = 'gc', serverIp = '') => {
    const clean = newRoomCode.trim().toUpperCase();
    setRoomId(clean);
    setView('mix');
    const url = new URL(window.location);
    url.searchParams.set('room', clean);
    window.history.pushState({}, '', url);

    socket.emit('join_room', {
      roomId: clean,
      roomName: customName,
      rankingSystem,
      serverIp: serverIp ? serverIp.trim() : undefined,
      player: myProfile.nick ? myProfile : null,
    });
  };

  const handleEnterRoom = (code = 'MIX-PRO') => {
    if (!isSteamLogged) {
      handleRequireSteamLogin('entrar no mix');
      return;
    }
    handleSelectRoom(code);
  };

  // Change room ranking system (GC vs FACEIT)
  const handleChangeRankingSystem = (newSystem) => {
    if (socket.connected) {
      socket.emit('change_ranking_system', { roomId, rankingSystem: newSystem });
    } else {
      setRoom((prev) => ({ ...prev, rankingSystem: newSystem }));
    }
  };

  // Delete Room
  const handleDeleteRoom = (targetRoomId) => {
    const cleanId = (targetRoomId || roomId).trim().toUpperCase();
    if (socket.connected) {
      socket.emit('delete_room', { roomId: cleanId });
    } else {
      fetch(`/api/rooms/${encodeURIComponent(cleanId)}`, { method: 'DELETE' }).catch(() => {});
    }

    if (cleanId === roomId) {
      setRoomNotice({
        title: 'Sala Excluída',
        message: `A sala ${room.name || cleanId} foi excluída com sucesso.`,
        type: 'info',
      });
      setView('landing');
      const u = new URL(window.location);
      u.searchParams.delete('room');
      window.history.pushState({}, '', u);
    }
  };

  // Save profile changes (with optimistic local update for zero-latency slider sync)
  const handleSaveProfile = (newProfile) => {
    setMyProfile(newProfile);
    try {
      localStorage.setItem('cs2_mix_profile', JSON.stringify(newProfile));
    } catch (e) {
      // ignore
    }

    // Immediate optimistic local update for instant UI response
    setRoom((prev) => {
      const existingIdx = prev.players.findIndex((p) => p.id === newProfile.id || p.nick === newProfile.nick);
      if (existingIdx >= 0) {
        const updatedPlayers = [...prev.players];
        updatedPlayers[existingIdx] = {
          ...updatedPlayers[existingIdx],
          ...newProfile,
          ready: newProfile.ready !== undefined ? newProfile.ready : updatedPlayers[existingIdx].ready,
        };
        return { ...prev, players: updatedPlayers };
      }
      return prev;
    });

    if (socket.connected) {
      socket.emit('join_room', {
        roomId,
        player: newProfile,
      });
    } else {
      setRoom((prev) => {
        const existingIdx = prev.players.findIndex((p) => p.id === newProfile.id || p.nick === newProfile.nick);
        let updatedPlayers = [...prev.players];
        if (existingIdx >= 0) {
          updatedPlayers[existingIdx] = newProfile;
        } else if (updatedPlayers.length < 10) {
          updatedPlayers.push(newProfile);
        }
        return { ...prev, players: updatedPlayers };
      });
    }
  };

  // Toggle ready status
  const handleToggleReady = (playerId) => {
    if (socket.connected) {
      socket.emit('toggle_ready', { roomId, playerId });
    } else {
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, ready: !p.ready } : p)),
      }));
    }
  };

  // Send chat message
  const handleSendMessage = (message) => {
    if (socket.connected) {
      socket.emit('send_chat', { roomId, message });
    } else {
      const chatMsg = {
        id: `msg-${Date.now()}`,
        sender: message.sender,
        text: message.text,
        timestamp: Date.now(),
      };
      setRoom((prev) => ({ ...prev, chat: [...prev.chat, chatMsg] }));
    }
  };

  // Update Server IP
  const handleUpdateServerIp = (serverIp) => {
    if (socket.connected) {
      socket.emit('update_server_ip', { roomId, serverIp });
    } else {
      setRoom((prev) => ({ ...prev, serverIp }));
    }
  };

  // Save match score
  const handleSaveScore = (scoreA, scoreB) => {
    const numA = Number(scoreA) || 0;
    const numB = Number(scoreB) || 0;

    // Record stats for player if authenticated with Steam
    if (myProfile?.steamId) {
      const inTeamA = room.teamA?.some((p) => p.id === myProfile.id || p.steamId === myProfile.steamId);
      const inTeamB = room.teamB?.some((p) => p.id === myProfile.id || p.steamId === myProfile.steamId);
      if (inTeamA || inTeamB) {
        const didWin = inTeamA ? numA > numB : numB > numA;
        const playerSide = inTeamA
          ? (room.startingSideTeamB === 'CT' ? 'TR' : 'CT')
          : (room.startingSideTeamB || 'CT');
        recordMatchResult(myProfile.steamId, didWin, playerSide);
      }
    }

    if (socket.connected) {
      socket.emit('save_score', { roomId, scoreA, scoreB });
    } else {
      setRoom((prev) => ({
        ...prev,
        history: [
          {
            id: `match-${Date.now()}`,
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            map: prev.finalMap?.name || 'Mirage',
            scoreA: numA,
            scoreB: numB,
            winner: numA > numB ? 'Time A' : numB > numA ? 'Time B' : 'Empate',
          },
          ...prev.history,
        ],
      }));
    }
  };

  // Direct Veto Start (Teams already made)
  const handleStartQuickVeto = (teamAName, teamBName) => {
    setView('mix');
    if (socket.connected) {
      socket.emit('quick_start_veto', { roomId, teamAName, teamBName });
    } else {
      setRoom((prev) => ({
        ...prev,
        phase: 'veto',
        bannedMaps: [],
        currentTurn: 'teamA',
        finalMap: null,
        startingSideTeamB: null,
        teamA: [{ id: 't1', nick: teamAName || 'Time A', level: 15, avatar: '🛡️' }],
        teamB: [{ id: 't2', nick: teamBName || 'Time B', level: 15, avatar: '⚔️' }],
      }));
    }
  };

  // Direct Quick Map Roll
  const handleApplyQuickMap = (map, startingSide) => {
    setView('mix');
    setRoom((prev) => ({
      ...prev,
      phase: 'finished',
      finalMap: map,
      startingSideTeamB: startingSide,
      teamA: prev.teamA.length > 0 ? prev.teamA : [{ id: 't1', nick: 'Time A', level: 15, avatar: '🛡️' }],
      teamB: prev.teamB.length > 0 ? prev.teamB : [{ id: 't2', nick: 'Time B', level: 15, avatar: '⚔️' }],
    }));
    if (socket.connected) {
      socket.emit('quick_random_map', { roomId, map, startingSide });
    }
  };

  // Remove player
  const handleRemovePlayer = (playerId) => {
    if (socket.connected) {
      socket.emit('remove_player', { roomId, playerId });
    } else {
      setRoom((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }));
    }
  };

  // Steam Logout
  const handleLogoutSteam = () => {
    if (myProfile?.id) {
      handleRemovePlayer(myProfile.id);
    }
    try {
      localStorage.removeItem('cs2_mix_profile');
    } catch (e) {}

    const freshProfile = {
      id: `player-${Math.random().toString(36).substring(2, 9)}`,
      nick: '',
      level: 14,
      faceitLevel: 5,
      faceitElo: 1200,
      side: 'ANY',
      avatar: '🎯',
      steamId: null,
    };
    setMyProfile(freshProfile);
    setProfileModalOpen(false);

    // Return to landing view
    setView('landing');
    const u = new URL(window.location);
    u.searchParams.delete('room');
    window.history.pushState({}, '', u);
  };

  // Steam Switch Account (logout and immediate redirect to Steam Auth)
  const handleSwitchSteamAccount = () => {
    if (myProfile?.id) {
      handleRemovePlayer(myProfile.id);
    }
    try {
      localStorage.removeItem('cs2_mix_profile');
    } catch (e) {}

    const targetRoom = roomId || 'MIX-PRO';
    window.location.href = `/api/auth/steam?room=${encodeURIComponent(targetRoom)}`;
  };

  // Fill mock bots for instant testing
  const handleFillMockBots = () => {
    if (socket.connected) {
      socket.emit('fill_mock_bots', { roomId });
    } else {
      setRoom((prev) => ({
        ...prev,
        players: JSON.parse(JSON.stringify(MOCK_PLAYERS)),
      }));
    }
  };

  // Clear players
  const handleClearPlayers = () => {
    if (socket.connected) {
      socket.emit('clear_players', { roomId });
    } else {
      setRoom((prev) => ({
        ...prev,
        players: [],
        phase: 'lobby',
        teamA: [],
        teamB: [],
        metrics: null,
        bannedMaps: [],
        finalMap: null,
      }));
    }
  };

  // Trigger draw with suspense roulette
  const handleTriggerDraw = (mode = 'balanced') => {
    setPendingDrawMode(mode);
    setRouletteActive(true);
  };

  const handleRouletteComplete = () => {
    setRouletteActive(false);
    if (socket.connected) {
      socket.emit('draw_teams', { roomId, mode: pendingDrawMode });
    } else {
      const result = pendingDrawMode === 'balanced'
        ? balanceTeams(room.players, room.rankingSystem || 'gc')
        : shuffleTeams(room.players, room.rankingSystem || 'gc');
      setRoom((prev) => ({
        ...prev,
        phase: 'teams',
        teamA: result.teamA,
        teamB: result.teamB,
        metrics: result.metrics,
      }));
    }
  };

  // Captains Draft
  const handleStartCaptainDraft = () => {
    if (socket.connected) {
      socket.emit('start_captain_draft', { roomId });
    } else {
      const sorted = [...room.players].sort((a, b) => b.level - a.level);
      setRoom((prev) => ({
        ...prev,
        phase: 'captains_draft',
        captainA: sorted[0],
        captainB: sorted[1],
        teamA: [sorted[0]],
        teamB: [sorted[1]],
        unassignedPlayers: sorted.slice(2),
        captainTurn: 'captainA',
      }));
    }
  };

  const handleCaptainPick = (playerId) => {
    if (socket.connected) {
      socket.emit('captain_pick', { roomId, playerId });
    } else {
      setRoom((prev) => {
        const idx = prev.unassignedPlayers.findIndex((p) => p.id === playerId);
        if (idx === -1) return prev;
        const chosen = prev.unassignedPlayers[idx];
        const newUnassigned = prev.unassignedPlayers.filter((p) => p.id !== playerId);

        const newTeamA = prev.captainTurn === 'captainA' ? [...prev.teamA, chosen] : prev.teamA;
        const newTeamB = prev.captainTurn === 'captainB' ? [...prev.teamB, chosen] : prev.teamB;
        const nextTurn = prev.captainTurn === 'captainA' ? 'captainB' : 'captainA';

        if (newUnassigned.length === 0) {
          const sumA = newTeamA.reduce((acc, p) => acc + p.level, 0);
          const sumB = newTeamB.reduce((acc, p) => acc + p.level, 0);
          const diff = Math.abs(sumA - sumB);
          return {
            ...prev,
            phase: 'teams',
            teamA: newTeamA,
            teamB: newTeamB,
            unassignedPlayers: [],
            metrics: {
              sumA,
              sumB,
              avgA: (sumA / newTeamA.length).toFixed(1),
              avgB: (sumB / newTeamB.length).toFixed(1),
              diff,
              balancePercentage: Math.max(0, Math.min(100, Math.round(100 - (diff / Math.max(sumA, sumB || 1)) * 100))),
            },
          };
        }

        return {
          ...prev,
          teamA: newTeamA,
          teamB: newTeamB,
          unassignedPlayers: newUnassigned,
          captainTurn: nextTurn,
        };
      });
    }
  };

  // Coin Flip Cara ou Coroa
  const handleStartCoinFlip = () => {
    if (socket.connected) {
      socket.emit('flip_coin', { roomId });
    } else {
      const winner = Math.random() < 0.5 ? 'teamA' : 'teamB';
      setRoom((prev) => ({
        ...prev,
        phase: 'coin_flip',
        coin: { winner, timestamp: Date.now(), choice: null },
      }));
    }
  };

  const handleCoinChoice = (choice) => {
    if (socket.connected) {
      socket.emit('coin_choice', { roomId, choice });
    } else {
      setRoom((prev) => {
        const turn = choice === 'first' ? prev.coin?.winner || 'teamA' : prev.coin?.winner === 'teamA' ? 'teamB' : 'teamA';
        return {
          ...prev,
          phase: 'veto',
          currentTurn: turn,
          bannedMaps: [],
          finalMap: null,
          startingSideTeamB: null,
        };
      });
    }
  };

  // Swap sides
  const handleSwapTeams = () => {
    if (socket.connected) {
      socket.emit('swap_teams', { roomId });
    } else {
      setRoom((prev) => {
        const temp = prev.teamA;
        const newMetrics = prev.metrics
          ? {
              ...prev.metrics,
              sumA: prev.metrics.sumB,
              sumB: prev.metrics.sumA,
              avgA: prev.metrics.avgB,
              avgB: prev.metrics.avgA,
            }
          : null;
        return {
          ...prev,
          teamA: prev.teamB,
          teamB: temp,
          metrics: newMetrics,
        };
      });
    }
  };

  // Start Veto Phase directly
  const handleStartVeto = () => {
    if (socket.connected) {
      socket.emit('start_veto', { roomId });
    } else {
      setRoom((prev) => ({
        ...prev,
        phase: 'veto',
        bannedMaps: [],
        currentTurn: 'teamA',
        finalMap: null,
        startingSideTeamB: null,
      }));
    }
  };

  // Ban Map
  const handleBanMap = (mapId) => {
    if (socket.connected) {
      socket.emit('ban_map', { roomId, mapId });
    } else {
      setRoom((prev) => {
        if (prev.bannedMaps.some((b) => b.mapId === mapId)) return prev;
        const newBans = [
          ...prev.bannedMaps,
          { mapId, bannedBy: prev.currentTurn, timestamp: Date.now() },
        ];
        const remaining = prev.maps.filter((m) => !newBans.some((b) => b.mapId === m.id));

        if (remaining.length === 1) {
          return {
            ...prev,
            bannedMaps: newBans,
            finalMap: remaining[0],
            phase: 'side_pick',
          };
        }

        return {
          ...prev,
          bannedMaps: newBans,
          currentTurn: prev.currentTurn === 'teamA' ? 'teamB' : 'teamA',
        };
      });
    }
  };

  // Side Selection
  const handleSelectSide = (side) => {
    if (socket.connected) {
      socket.emit('select_side', { roomId, side });
    } else {
      setRoom((prev) => ({
        ...prev,
        startingSideTeamB: side,
        phase: 'finished',
      }));
    }
  };

  // Reset Mix
  const handleResetMix = () => {
    if (socket.connected) {
      socket.emit('reset_mix', { roomId });
    } else {
      setRoom((prev) => ({
        ...prev,
        phase: 'lobby',
        teamA: [],
        teamB: [],
        metrics: null,
        bannedMaps: [],
        finalMap: null,
        startingSideTeamB: null,
        currentTurn: 'teamA',
        coin: null,
        unassignedPlayers: [],
      }));
    }
  };

  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onEnterRoom={handleEnterRoom}
          onOpenQuickVeto={() => setQuickVetoOpen(true)}
          onOpenQuickMapRoll={() => setQuickMapRollOpen(true)}
          onOpenRoomsHub={() => setRoomsHubOpen(true)}
          onRequireSteamLogin={handleRequireSteamLogin}
          onOpenProfile={() => setProfileModalOpen(true)}
          myProfile={myProfile}
          soundEnabled={soundEnabled}
        />

        {/* Room Notification Toast Banner */}
        {roomNotice && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-fadeIn">
            <div className={`p-4 rounded-2xl border shadow-2xl flex items-start justify-between gap-3 backdrop-blur-xl ${
              roomNotice.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-200'
                : 'bg-slate-900/95 border-emerald-500/50 text-slate-100'
            }`}>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider font-heading flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${roomNotice.type === 'warning' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {roomNotice.title}
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {roomNotice.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomNotice(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* MODALS AVAILABLE ON LANDING */}
        <RoomsHubModal
          isOpen={roomsHubOpen}
          onClose={() => setRoomsHubOpen(false)}
          currentRoomId={roomId}
          onSelectRoom={handleSelectRoom}
          onDeleteRoom={handleDeleteRoom}
          soundEnabled={soundEnabled}
          isSteamLogged={isSteamLogged}
          onRequireSteamLogin={handleRequireSteamLogin}
        />

        <QuickVetoModal
          isOpen={quickVetoOpen}
          onClose={() => setQuickVetoOpen(false)}
          onStartQuickVeto={handleStartQuickVeto}
          soundEnabled={soundEnabled}
        />

        <QuickMapRollModal
          isOpen={quickMapRollOpen}
          onClose={() => setQuickMapRollOpen(false)}
          onApplyMap={handleApplyQuickMap}
          soundEnabled={soundEnabled}
        />

        <SteamLoginGateModal
          isOpen={steamGateModalOpen}
          onClose={() => setSteamGateModalOpen(false)}
          roomId={roomId}
          actionText={steamGateActionText}
          soundEnabled={soundEnabled}
        />

        <PlayerProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          profile={myProfile}
          rankingSystem={room.rankingSystem || 'gc'}
          onLogout={handleLogoutSteam}
          onSwitchAccount={handleSwitchSteamAccount}
          soundEnabled={soundEnabled}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
      <Header
        roomId={roomId}
        roomName={room.name}
        phase={room.phase}
        rankingSystem={room.rankingSystem || 'gc'}
        serverIp={room.serverIp || ''}
        myProfile={myProfile}
        onOpenProfile={() => setProfileModalOpen(true)}
        onDeleteRoom={handleDeleteRoom}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenRoomsHub={() => setRoomsHubOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenQuickVeto={() => setQuickVetoOpen(true)}
        onOpenQuickMapRoll={() => setQuickMapRollOpen(true)}
        onGoHome={() => {
          setView('landing');
          const u = new URL(window.location);
          u.searchParams.delete('room');
          window.history.pushState({}, '', u);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* LOBBY PHASE */}
        {room.phase === 'lobby' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <PlayerForm
                currentProfile={myProfile}
                onSave={handleSaveProfile}
                roomId={roomId}
                rankingSystem={room.rankingSystem || 'gc'}
                onLogout={handleLogoutSteam}
                onSwitchAccount={handleSwitchSteamAccount}
                onOpenProfileModal={() => setProfileModalOpen(true)}
                soundEnabled={soundEnabled}
                disabled={room.players.length >= 10 && !room.players.some((p) => p.id === myProfile.id)}
              />
            </div>

            <div className="lg:col-span-8">
              <Lobby
                players={room.players}
                myProfile={myProfile}
                rankingSystem={room.rankingSystem || 'gc'}
                onChangeRankingSystem={handleChangeRankingSystem}
                onToggleReady={handleToggleReady}
                onRemovePlayer={handleRemovePlayer}
                onFillMockBots={handleFillMockBots}
                onClearPlayers={handleClearPlayers}
                onDrawTeams={handleTriggerDraw}
                onStartCaptainDraft={handleStartCaptainDraft}
                onOpenQuickVeto={() => setQuickVetoOpen(true)}
                onOpenQuickMapRoll={() => setQuickMapRollOpen(true)}
                serverIp={room.serverIp || ''}
                onUpdateServerIp={handleUpdateServerIp}
                soundEnabled={soundEnabled}
              />
            </div>
          </div>
        )}

        {/* CAPTAINS DRAFT PHASE */}
        {room.phase === 'captains_draft' && (
          <CaptainsDraftView
            room={room}
            onPickPlayer={handleCaptainPick}
            onCancel={() => setRoom((prev) => ({ ...prev, phase: 'lobby' }))}
            soundEnabled={soundEnabled}
          />
        )}

        {/* TEAMS PHASE */}
        {room.phase === 'teams' && (
          <TeamsView
            teamA={room.teamA}
            teamB={room.teamB}
            metrics={room.metrics}
            rankingSystem={room.rankingSystem || 'gc'}
            onSwapTeams={handleSwapTeams}
            onReDraw={() => handleTriggerDraw('balanced')}
            onStartCoinFlip={handleStartCoinFlip}
            onStartVeto={handleStartVeto}
            onBackToLobby={() => setRoom((prev) => ({ ...prev, phase: 'lobby' }))}
            serverIp={room.serverIp || ''}
            onUpdateServerIp={handleUpdateServerIp}
            soundEnabled={soundEnabled}
          />
        )}

        {/* VETO & SIDE PICK PHASE */}
        {(room.phase === 'veto' || room.phase === 'side_pick') && (
          <MapVeto
            room={room}
            onBanMap={handleBanMap}
            onSelectSide={handleSelectSide}
            onResetMix={handleResetMix}
            soundEnabled={soundEnabled}
          />
        )}

        {/* FINISHED / SUMMARY PHASE */}
        {room.phase === 'finished' && (
          <FinalSummary
            room={room}
            onResetMix={handleResetMix}
            onUpdateServerIp={handleUpdateServerIp}
            onOpenHistory={() => setHistoryOpen(true)}
            soundEnabled={soundEnabled}
          />
        )}
      </main>

      {/* MODALS & DRAWERS */}
      <RoomsHubModal
        isOpen={roomsHubOpen}
        onClose={() => setRoomsHubOpen(false)}
        currentRoomId={roomId}
        onSelectRoom={handleSelectRoom}
        onDeleteRoom={handleDeleteRoom}
        soundEnabled={soundEnabled}
        isSteamLogged={isSteamLogged}
        onRequireSteamLogin={handleRequireSteamLogin}
      />

      <SteamLoginGateModal
        isOpen={steamGateModalOpen || (view === 'mix' && !isSteamLogged)}
        roomId={roomId}
        actionText={steamGateActionText}
        soundEnabled={soundEnabled}
        onClose={
          view === 'mix' && !isSteamLogged
            ? () => {
                setView('landing');
                const u = new URL(window.location);
                u.searchParams.delete('room');
                window.history.pushState({}, '', u);
              }
            : () => setSteamGateModalOpen(false)
        }
      />

      <MatchHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={room.history}
        onSaveScore={handleSaveScore}
        soundEnabled={soundEnabled}
      />

      <QuickVetoModal
        isOpen={quickVetoOpen}
        onClose={() => setQuickVetoOpen(false)}
        onStartQuickVeto={handleStartQuickVeto}
        soundEnabled={soundEnabled}
      />

      <QuickMapRollModal
        isOpen={quickMapRollOpen}
        onClose={() => setQuickMapRollOpen(false)}
        onApplyMap={handleApplyQuickMap}
        soundEnabled={soundEnabled}
      />

      <CoinFlipModal
        isOpen={room.phase === 'coin_flip'}
        coin={room.coin}
        onChooseAction={handleCoinChoice}
        soundEnabled={soundEnabled}
      />

      {rouletteActive && (
        <DraftRoulette
          players={room.players}
          rankingSystem={room.rankingSystem || 'gc'}
          onComplete={handleRouletteComplete}
          soundEnabled={soundEnabled}
        />
      )}

      <ChatDrawer
        chat={room.chat}
        onSendMessage={handleSendMessage}
        myProfile={myProfile}
        rankingSystem={room.rankingSystem || 'gc'}
        soundEnabled={soundEnabled}
      />

      <PlayerProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        profile={myProfile}
        rankingSystem={room.rankingSystem || 'gc'}
        onLogout={handleLogoutSteam}
        onSwitchAccount={handleSwitchSteamAccount}
        soundEnabled={soundEnabled}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>
          CS2 Mix Hub • Rotação Oficial Valve (Active Duty) • Sorteador Gamers Club & Pick/Ban em Tempo Real
        </p>
      </footer>
    </div>
  );
}
