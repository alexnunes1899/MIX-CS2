import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import PlayerForm from './components/PlayerForm';
import Lobby from './components/Lobby';
import TeamsView from './components/TeamsView';
import MapVeto from './components/MapVeto';
import FinalSummary from './components/FinalSummary';
import { CS2_MAPS } from './data/maps';
import { balanceTeams, shuffleTeams } from './utils/balance';
import { MOCK_PLAYERS } from './data/mockPlayers';

// Connect to socket backend
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

  const [soundEnabled, setSoundEnabled] = useState(true);

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
      side: 'ANY',
      avatar: '🎯',
    };
  });

  // Room state synchronized with server or local fallback
  const [room, setRoom] = useState({
    id: roomId,
    name: `Sala ${roomId}`,
    phase: 'lobby',
    players: [],
    teamA: [],
    teamB: [],
    metrics: null,
    maps: [
      { id: 'de_mirage', name: 'Mirage', file: 'de_mirage', location: 'Marrocos' },
      { id: 'de_inferno', name: 'Inferno', file: 'de_inferno', location: 'Itália' },
      { id: 'de_nuke', name: 'Nuke', file: 'de_nuke', location: 'EUA' },
      { id: 'de_dust2', name: 'Dust II', file: 'de_dust2', location: 'Oriente Médio' },
      { id: 'de_ancient', name: 'Ancient', file: 'de_ancient', location: 'América Central' },
      { id: 'de_anubis', name: 'Anubis', file: 'de_anubis', location: 'Egito' },
      { id: 'de_vertigo', name: 'Vertigo', file: 'de_vertigo', location: 'Arranha-céu' },
    ],
    bannedMaps: [],
    currentTurn: 'teamA',
    finalMap: null,
    startingSideTeamB: null,
  });

  const [connected, setConnected] = useState(false);

  // Setup Socket listener
  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', {
        roomId,
        player: myProfile.nick ? myProfile : null,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room_state', (updatedRoom) => {
      if (updatedRoom && updatedRoom.id === roomId) {
        setRoom(updatedRoom);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_state');
    };
  }, [roomId, myProfile]);

  // Save profile changes
  const handleSaveProfile = (newProfile) => {
    setMyProfile(newProfile);
    try {
      localStorage.setItem('cs2_mix_profile', JSON.stringify(newProfile));
    } catch (e) {
      // ignore
    }

    if (socket.connected) {
      socket.emit('join_room', {
        roomId,
        player: newProfile,
      });
    } else {
      // Offline / Local state fallback
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

  // Balance or random draw teams
  const handleDrawTeams = (mode = 'balanced') => {
    if (socket.connected) {
      socket.emit('draw_teams', { roomId, mode });
    } else {
      const result = mode === 'balanced' ? balanceTeams(room.players) : shuffleTeams(room.players);
      setRoom((prev) => ({
        ...prev,
        phase: 'teams',
        teamA: result.teamA,
        teamB: result.teamB,
        metrics: result.metrics,
      }));
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

  // Start Veto Phase
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
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
      <Header
        roomId={roomId}
        phase={room.phase}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        playerCount={room.players.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* LOBBY PHASE */}
        {room.phase === 'lobby' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <PlayerForm
                currentProfile={myProfile}
                onSave={handleSaveProfile}
                soundEnabled={soundEnabled}
                disabled={room.players.length >= 10 && !room.players.some((p) => p.id === myProfile.id)}
              />
            </div>

            <div className="lg:col-span-8">
              <Lobby
                players={room.players}
                onRemovePlayer={handleRemovePlayer}
                onFillMockBots={handleFillMockBots}
                onClearPlayers={handleClearPlayers}
                onDrawTeams={handleDrawTeams}
                soundEnabled={soundEnabled}
              />
            </div>
          </div>
        )}

        {/* TEAMS PHASE */}
        {room.phase === 'teams' && (
          <TeamsView
            teamA={room.teamA}
            teamB={room.teamB}
            metrics={room.metrics}
            onSwapTeams={handleSwapTeams}
            onReDraw={() => handleDrawTeams('balanced')}
            onStartVeto={handleStartVeto}
            onBackToLobby={() => setRoom((prev) => ({ ...prev, phase: 'lobby' }))}
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
            soundEnabled={soundEnabled}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>
          CS2 Mix Hub • Feito para jogar com os amigos • Sincronização em tempo real via WebSockets
        </p>
      </footer>
    </div>
  );
}
