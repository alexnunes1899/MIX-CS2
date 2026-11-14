import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import PlayerForm from './components/PlayerForm';
import Lobby from './components/Lobby';
import ChatDrawer from './components/ChatDrawer';
import FailoverBanner from './components/FailoverBanner';
import UpdateNotificationBanner from './components/UpdateNotificationBanner';
import GlobalModals from './components/GlobalModals';
import { playClickSound, setSoundEnabledGlobal, isSoundEnabled } from './utils/audio';
import { recordMatchResult } from './utils/playerStats';
import { ACTIVE_DUTY_MAPS, OFFICIAL_ACTIVE_DUTY, EXTRA_CS2_MAPS } from './data/maps';
import { balanceTeams, shuffleTeams, calculateMetricsForTeams } from './utils/balance';
import { getVetoSchedule } from './utils/proVeto';
import { MOCK_PLAYERS } from './data/mockPlayers';

const LandingPage = lazy(() => import('./components/LandingPage'));
const DedicatedServersHub = lazy(() => import('./components/DedicatedServersHub'));
const TeamsView = lazy(() => import('./components/TeamsView'));
const MapVeto = lazy(() => import('./components/MapVeto'));
const FinalSummary = lazy(() => import('./components/FinalSummary'));
const CoinFlipModal = lazy(() => import('./components/CoinFlipModal'));
const DraftRoulette = lazy(() => import('./components/DraftRoulette'));
const CaptainsDraftView = lazy(() => import('./components/CaptainsDraftView'));

const socket = io('/', {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default function App() {
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('steam_auth') === '1') return '';
    return params.get('room') || '';
  });

  const [roomPassword, setRoomPassword] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pwd') || params.get('pass') || params.get('password') || '';
  });
  const [inviteKey, setInviteKey] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('key') || params.get('token') || '';
  });
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingRoomAuth, setPendingRoomAuth] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [authErrorType, setAuthErrorType] = useState('wrong_password');

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'servers') {
      return 'servers';
    }
    // Ao fazer login (steam_auth=1) ou quando não há parâmetro room, SEMPRE abre a tela inicial
    if (params.get('steam_auth') === '1' || !params.get('room')) {
      return 'landing';
    }
    return 'mix';
  });

  // Som desativado por padrão conforme solicitação, com persistência no localStorage
  const [soundEnabled, setSoundEnabled] = useState(() => isSoundEnabled());

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setSoundEnabledGlobal(next);
      return next;
    });
  };

  const [socketConnected, setSocketConnected] = useState(socket.connected);

  // Sync browser navigation (Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      if (p.get('view') === 'servers') {
        setView('servers');
      } else if (p.get('room')) {
        setRoomId(p.get('room'));
        setView('mix');
      } else {
        setView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [roomsHubOpen, setRoomsHubOpen] = useState(false);
  const [activeRoomsCount, setActiveRoomsCount] = useState(0);

  useEffect(() => {
    fetch('/api/rooms')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setActiveRoomsCount(data.length);
      })
      .catch(() => {});
  }, []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quickVetoOpen, setQuickVetoOpen] = useState(false);
  const [quickMapRollOpen, setQuickMapRollOpen] = useState(false);
  const [rouletteActive, setRouletteActive] = useState(false);
  const [pendingDrawMode, setPendingDrawMode] = useState('balanced');
  const [steamGateModalOpen, setSteamGateModalOpen] = useState(false);
  const [steamGateActionText, setSteamGateActionText] = useState('criar ou entrar no mix');
  const [profileModalOpen, setProfileModalOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('open_profile') === '1';
    } catch (e) {
      return false;
    }
  });
  const [gsiModalOpen, setGsiModalOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('gsi') === '1';
    } catch (e) {
      return false;
    }
  });
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [discordModalOpen, setDiscordModalOpen] = useState(false);
  const [matchCardOpen, setMatchCardOpen] = useState(false);
  const [storyCardOpen, setStoryCardOpen] = useState(false);
  const [grenadeModalOpen, setGrenadeModalOpen] = useState(false);
  const [aimReflexModalOpen, setAimReflexModalOpen] = useState(false);
  const [tournamentModalOpen, setTournamentModalOpen] = useState(false);
  const [localHostModalOpen, setLocalHostModalOpen] = useState(false);
  const [roomNotice, setRoomNotice] = useState(null);
  const [serverVersion, setServerVersion] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const handleApplyUpdate = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) reg.unregister();
        });
      }
    } catch (e) {}
    window.location.reload();
  };

  // Real-time Version & Update Detector (fixes caching delays permanently)
  useEffect(() => {
    let isMounted = true;
    const checkVersion = async () => {
      try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && isMounted) {
          setServerVersion((prev) => {
            if (prev && prev !== data.version) {
              setUpdateAvailable(true);
            }
            return data.version;
          });
        }
      } catch (e) {}
    };

    checkVersion();
    const handleFocus = () => checkVersion();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(checkVersion, 10000); // Checa a cada 10 segundos

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Garante que o F5 sempre faça um recarregamento 100% limpo sem cache residual
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5') {
        try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
              for (const r of regs) r.unregister();
            });
          }
        } catch (err) {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Official Active Duty Live Rotation State (sourced from Wikipedia / Valve records)
  const [officialRotation, setOfficialRotation] = useState(() => ({
    source: 'Wikipedia / Valve Esports Records',
    lastSync: Date.now(),
    activeDutyMaps: OFFICIAL_ACTIVE_DUTY,
    extraMaps: EXTRA_CS2_MAPS,
  }));
  const [syncingRotation, setSyncingRotation] = useState(false);

  // User's own saved profile (stored in localStorage or immediate Steam redirect params)
  const [myProfile, setMyProfile] = useState(() => {
    let base = {
      id: `player-${Math.random().toString(36).substring(2, 9)}`,
      nick: '',
      level: 14,
      faceitLevel: 5,
      faceitElo: 1200,
      side: 'ANY',
      avatar: '🎯',
      cs2Hours: null,
    };
    try {
      const saved = localStorage.getItem('cs2_mix_profile');
      if (saved) base = { ...base, ...JSON.parse(saved) };
    } catch (e) {}

    // Check if returning from Steam Auth redirect immediately on first render
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('steam_auth') === '1' && params.get('nick')) {
          const steamId = params.get('steamId');
          const steamNick = params.get('nick');
          const steamAvatar = params.get('avatar');
          const faceitLevel = params.get('faceitLevel');
          const faceitElo = params.get('faceitElo');
          const faceitFound = params.get('faceitFound') === '1';
          const steamCs2Hours = params.get('cs2Hours');

          base = {
            ...base,
            nick: steamNick,
            avatar: steamAvatar || base.avatar,
            steamId: steamId || null,
            cs2Hours: steamCs2Hours && !isNaN(Number(steamCs2Hours)) ? Number(steamCs2Hours) : (base.cs2Hours || null),
            faceitLevel: faceitFound && faceitLevel ? Number(faceitLevel) : (base.faceitLevel || 5),
            faceitElo: faceitFound && faceitElo && faceitElo !== 'null' ? Number(faceitElo) : (base.faceitElo || 1200),
          };
          try {
            localStorage.setItem('cs2_mix_profile', JSON.stringify(base));
          } catch (e) {}
        }
        if (params.get('mock_user') === '1') {
          base = {
            ...base,
            nick: 'Capitao',
            steamId: '76561198000000001',
            level: 18,
            faceitLevel: 9,
            cs2Hours: 1850,
          };
          try {
            localStorage.setItem('cs2_mix_profile', JSON.stringify(base));
          } catch (e) {}
        }
      } catch (e) {}
    }
    return base;
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
    pickedMaps: [],
    vetoLog: [],
    drawnSeries: [],
    matchFormat: 'MD1',
    vetoFirstTeam: 'teamA',
    bo1Order: 'ABABAB',
    pendingSidePick: null,
    teamAName: null,
    teamBName: null,
    currentTurn: 'teamA',
    finalMap: null,
    startingSideTeamB: null,
    serverIp: '',
    rconPassword: '',
    liveMatch: null,
    chat: [],
    history: [],
    coin: null,
    captainA: null,
    captainB: null,
    captainTurn: 'captainA',
    unassignedPlayers: [],
  });

  // Update browser tab title dynamically with room name and player count
  useEffect(() => {
    if (view === 'mix' && roomId) {
      const rName = room?.name || `Mix ${roomId}`;
      const pCount = room?.players?.length || 0;
      document.title = `🔥 ${rName} (${pCount}/10) — Bora pro Mix CS2!`;
    } else {
      document.title = 'CS2 Mix Hub | Sorteador GC & Pick/Ban';
    }
  }, [view, roomId, room?.name, room?.players?.length]);

  const isAdmin = Boolean(
    myProfile && (
      (room.adminId && room.adminId === myProfile.id) ||
      (room.creatorSteamId && myProfile.steamId && room.creatorSteamId === myProfile.steamId) ||
      (room.creatorId && room.creatorId === myProfile.id) ||
      (room.players.length > 0 && room.players[0].id === myProfile.id)
    )
  );

  // Check for Steam Auth return on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamAuth = params.get('steam_auth');
    if (steamAuth === '1') {
      setView('landing'); // Garante que a tela inicial continue ativa ao logar
      const steamId = params.get('steamId');
      const steamNick = params.get('nick');
      const steamAvatar = params.get('avatar');
      const faceitLevel = params.get('faceitLevel');
      const faceitElo = params.get('faceitElo');
      const faceitFound = params.get('faceitFound');
      const steamCs2Hours = params.get('cs2Hours');

      if (steamNick) {
        setMyProfile((prev) => {
          const hasFoundFaceit = faceitFound === '1' && faceitLevel;
          const updated = {
            ...prev,
            nick: steamNick,
            avatar: steamAvatar || prev.avatar,
            steamId: steamId || null,
            cs2Hours: steamCs2Hours && !isNaN(Number(steamCs2Hours)) ? Number(steamCs2Hours) : (prev.cs2Hours || null),
            faceitLevel: hasFoundFaceit ? Number(faceitLevel) : (prev.faceitLevel || 5),
            faceitElo: hasFoundFaceit && faceitElo && faceitElo !== 'null' ? Number(faceitElo) : (prev.faceitElo || 1200),
          };
          try {
            localStorage.setItem('cs2_mix_profile', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }

      const cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete('steam_auth');
      cleanUrl.searchParams.delete('room');
      cleanUrl.searchParams.delete('steamId');
      cleanUrl.searchParams.delete('nick');
      cleanUrl.searchParams.delete('avatar');
      cleanUrl.searchParams.delete('faceitLevel');
      cleanUrl.searchParams.delete('faceitElo');
      cleanUrl.searchParams.delete('faceitFound');
      cleanUrl.searchParams.delete('cs2Hours');

      // Se o jogador clicou em um link de convite de uma sala antes de logar na Steam, restaura a sala e o token do link
      try {
        const pendingRaw = sessionStorage.getItem('cs2_pending_invite');
        if (pendingRaw) {
          sessionStorage.removeItem('cs2_pending_invite');
          const pending = JSON.parse(pendingRaw);
          if (pending?.room) {
            setRoomId(pending.room);
            if (pending.key) setInviteKey(pending.key);
            setView('mix');
            cleanUrl.searchParams.set('room', pending.room);
            if (pending.key) cleanUrl.searchParams.set('key', pending.key);
            window.history.replaceState({}, '', cleanUrl.toString());
            return;
          }
        }
      } catch (e) {}

      window.history.replaceState({}, '', cleanUrl.pathname || '/');
    }
  }, []);

  // Mutable refs so Socket.IO listeners never tear down or read stale closures
  const roomIdRef = useRef(roomId);
  const myProfileRef = useRef(myProfile);
  const roomPasswordRef = useRef(roomPassword);
  const inviteKeyRef = useRef(inviteKey);
  const viewRef = useRef(view);
  const roomRef = useRef(room);

  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { myProfileRef.current = myProfile; }, [myProfile]);
  useEffect(() => { roomPasswordRef.current = roomPassword; }, [roomPassword]);
  useEffect(() => { inviteKeyRef.current = inviteKey; }, [inviteKey]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { roomRef.current = room; }, [room]);

  // Automatic background FACEIT stats sync on mount
  useEffect(() => {
    if (!myProfile?.steamId && !myProfile?.faceitNick && !myProfile?.nick) return;
    const cleanNick = myProfile.faceitNick || myProfile.nick || '';
    const steamId = myProfile.steamId || 'custom';
    fetch(`/api/faceit/${steamId}?nickname=${encodeURIComponent(cleanNick)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.found && data.level) {
          setMyProfile((prev) => {
            if (prev.faceitLevel === data.level && prev.faceitElo === data.elo && prev.faceitNick === data.nickname) return prev;
            const updated = {
              ...prev,
              faceitLevel: data.level,
              faceitElo: data.elo,
              faceitNick: data.nickname,
            };
            try {
              localStorage.setItem('cs2_mix_profile', JSON.stringify(updated));
            } catch (e) {}

            // Immediately emit to room so lobby & teams update (apenas se estiver ativamente dentro de uma sala de mix)
            if (socket.connected && prev.nick && viewRef.current === 'mix' && roomIdRef.current) {
              socket.emit('update_player', {
                roomId: roomIdRef.current,
                player: updated,
              });
            }

            return updated;
          });
        }
      })
      .catch(() => {});
  }, [myProfile?.steamId, myProfile?.faceitNick]);

  // Fetch Official Rotation on Mount
  useEffect(() => {
    fetch('/api/maps/rotation')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.activeDutyMaps) && data.activeDutyMaps.length > 0) {
          setOfficialRotation(data);
        }
      })
      .catch(() => {});
  }, []);

  // Single mount-only Socket.IO listener lifecycle with named cleanup handlers
  useEffect(() => {
    const emitInitialRoomJoin = () => {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room') || roomIdRef.current;
      const urlKey = params.get('key') || params.get('token') || inviteKeyRef.current || '';
      const urlName = params.get('name') || '';
      const isLanding = params.get('steam_auth') === '1' || !urlRoom || viewRef.current !== 'mix';
      if (!isLanding && urlRoom) {
        socket.emit('join_room', {
          roomId: urlRoom,
          roomName: urlName || undefined,
          player: myProfileRef.current?.nick ? myProfileRef.current : null,
          password: roomPasswordRef.current || undefined,
          inviteKey: urlKey || undefined,
          isPrivate: Boolean(urlKey),
          createIfMissing: true,
        });
      }
    };

    const handleConnect = () => {
      setSocketConnected(true);
      emitInitialRoomJoin();
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
    };
    const handleRoomNotFound = ({ roomId: missingId, message }) => {
      setRoomNotice({
        title: 'Sala Encerrada ou Inexistente',
        message: message || `A sala ${missingId || ''} não está mais ativa. Crie uma nova sala ou escolha uma sala aberta.`,
        type: 'warning',
      });
      setRoomId('');
      setView('landing');
      const u = new URL(window.location);
      u.searchParams.delete('room');
      u.searchParams.delete('pwd');
      u.searchParams.delete('key');
      window.history.replaceState({}, '', u.pathname || '/');
    };
    const handleRoomState = (updatedRoom) => {
      if (updatedRoom && String(updatedRoom.id).toUpperCase() === String(roomIdRef.current).toUpperCase()) {
        setRoom(updatedRoom);
      }
    };
    const handleActiveRotationUpdated = (updatedRotation) => {
      if (updatedRotation && Array.isArray(updatedRotation.activeDutyMaps)) {
        setOfficialRotation(updatedRotation);
      }
    };
    const handleGsiUpdate = (liveMatch) => {
      setRoom((prev) => ({ ...prev, liveMatch }));
    };
    const handleChatMessage = (msg) => {
      setRoom((prev) => {
        if (prev.chat.some((m) => m.id === msg.id)) return prev;
        return { ...prev, chat: [...prev.chat, msg] };
      });
    };
    const handleServerAppVersion = ({ version }) => {
      if (!version) return;
      setServerVersion((prev) => {
        if (prev && prev !== version) {
          setUpdateAvailable(true);
        }
        return version;
      });
    };
    const handleRoomAuthenticated = ({ roomId: authRoomId, password: authPassword, inviteKey: authKey, isPrivate: authIsPrivate }) => {
      if (String(authRoomId).toUpperCase() === String(roomIdRef.current).toUpperCase()) {
        setPendingRoomAuth(null);
        setPasswordError(null);
        setPasswordModalOpen(false);
        if (authPassword) setRoomPassword(authPassword);
        if (authKey) setInviteKey(authKey);
        const u = new URL(window.location);
        u.searchParams.set('room', authRoomId);
        if (authIsPrivate && authKey) {
          u.searchParams.set('key', authKey);
        } else {
          u.searchParams.delete('key');
        }
        if (authPassword) {
          u.searchParams.set('pwd', authPassword);
        } else {
          u.searchParams.delete('pwd');
        }
        window.history.replaceState({}, '', u);
      }
    };
    const handleRoomAuthError = ({ roomId: authRoomId, roomName: authRoomName, error, message }) => {
      setPendingRoomAuth({ roomId: authRoomId, roomName: authRoomName });
      setAuthErrorType(error || 'wrong_password');
      setPasswordError(
        message ||
          (error === 'private_room'
            ? 'Esta sala é privada. O acesso é exclusivo via link direto de convite.'
            : 'Esta sala requer uma senha para entrar.')
      );
      setPasswordModalOpen(true);
    };
    const handleRoomDeleted = ({ roomId: deletedId, message, reason }) => {
      if (String(deletedId).toUpperCase() === String(roomIdRef.current).toUpperCase()) {
        setRoomNotice({
          title: reason === 'inactivity' ? 'Sala Encerrada por Inatividade' : 'Sala Excluída',
          message: message || 'Esta sala de mix foi excluída.',
          type: 'warning',
        });
        setView('landing');
        const u = new URL(window.location);
        u.searchParams.delete('room');
        u.searchParams.delete('pwd');
        u.searchParams.delete('key');
        window.history.pushState({}, '', u);
      }
    };
    const handleKickedFromRoom = ({ targetPlayerId, reason }) => {
      const currentProfileId = myProfileRef.current?.id;
      if (targetPlayerId && currentProfileId && currentProfileId !== targetPlayerId) {
        return;
      }
      setRoomNotice({
        title: 'Removido da Sala',
        message: reason || 'Você foi removido da sala pelo administrador.',
        type: 'warning',
      });
      setView('landing');
      const u = new URL(window.location);
      u.searchParams.delete('room');
      u.searchParams.delete('pwd');
      u.searchParams.delete('key');
      window.history.pushState({}, '', u);
    };
    const handleAdminError = ({ message }) => {
      setRoomNotice({
        title: 'Aviso de Administrador',
        message: message || 'Ação restrita ao administrador da sala.',
        type: 'warning',
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('room_not_found', handleRoomNotFound);
    socket.on('room_state', handleRoomState);
    socket.on('active_rotation_updated', handleActiveRotationUpdated);
    socket.on('gsi_update', handleGsiUpdate);
    socket.on('chat_message', handleChatMessage);
    socket.on('server_app_version', handleServerAppVersion);
    socket.on('room_authenticated', handleRoomAuthenticated);
    socket.on('room_auth_error', handleRoomAuthError);
    socket.on('room_deleted', handleRoomDeleted);
    socket.on('kicked_from_room', handleKickedFromRoom);
    socket.on('admin_error', handleAdminError);

    if (socket.connected) {
      setSocketConnected(true);
      emitInitialRoomJoin();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.off('room_not_found', handleRoomNotFound);
      socket.off('room_state', handleRoomState);
      socket.off('active_rotation_updated', handleActiveRotationUpdated);
      socket.off('gsi_update', handleGsiUpdate);
      socket.off('chat_message', handleChatMessage);
      socket.off('server_app_version', handleServerAppVersion);
      socket.off('room_authenticated', handleRoomAuthenticated);
      socket.off('room_auth_error', handleRoomAuthError);
      socket.off('room_deleted', handleRoomDeleted);
      socket.off('kicked_from_room', handleKickedFromRoom);
      socket.off('admin_error', handleAdminError);
    };
  }, []);

  // Switch Room (Multi-room hub support with password, GC privacy & direct link)
  const handleSelectRoom = (newRoomCode, customName, rankingSystem = 'gc', serverIp = '', password = undefined, isPrivate = false, key = undefined) => {
    const safeCode = typeof newRoomCode === 'string' && newRoomCode.trim() ? newRoomCode : (roomId || 'MIX-PRO');
    const clean = safeCode.trim().toUpperCase();
    setRoomId(clean);
    setView('mix');

    const defaultName = myProfile?.nick ? `Time ${myProfile.nick.trim()}` : `Mix ${clean}`;
    const effectiveName = customName || defaultName;

    const targetPassword = password === null ? '' : (password !== undefined ? password : roomPassword);
    if (password !== undefined) {
      setRoomPassword(targetPassword || '');
    }

    const targetKey = key === null ? '' : (key !== undefined ? key : inviteKey);
    if (key !== undefined) {
      setInviteKey(targetKey || '');
    }

    const url = new URL(window.location);
    url.searchParams.set('room', clean);
    if (targetPassword) {
      url.searchParams.set('pwd', targetPassword);
    } else {
      url.searchParams.delete('pwd');
    }
    if (targetKey && isPrivate) {
      url.searchParams.set('key', targetKey);
    } else {
      url.searchParams.delete('key');
    }
    window.history.pushState({}, '', url);

    socket.emit('join_room', {
      roomId: clean,
      roomName: effectiveName,
      rankingSystem,
      serverIp: serverIp ? serverIp.trim() : undefined,
      password: targetPassword || undefined,
      isPrivate: Boolean(isPrivate),
      inviteKey: targetKey || undefined,
      player: myProfile.nick ? myProfile : null,
      createIfMissing: true,
    });
  };

  const handleSubmitRoomPassword = (enteredPassword) => {
    if (!pendingRoomAuth) return;
    const targetId = pendingRoomAuth.roomId;
    const targetName = pendingRoomAuth.roomName;
    setPasswordError(null);
    setPasswordModalOpen(false);
    handleSelectRoom(targetId, targetName, undefined, undefined, enteredPassword);
  };

  const handleKickPlayer = (targetPlayerId) => {
    if (socket.connected) {
      socket.emit('kick_player', { roomId, targetPlayerId });
    } else {
      setRoom((prev) => {
        const teamA = prev.teamA.filter((p) => p.id !== targetPlayerId);
        const teamB = prev.teamB.filter((p) => p.id !== targetPlayerId);
        const players = prev.players.filter((p) => p.id !== targetPlayerId);
        const metrics = (prev.phase === 'teams' || prev.phase === 'veto')
          ? calculateMetricsForTeams(teamA, teamB, prev.rankingSystem || 'gc')
          : prev.metrics;
        return { ...prev, players, teamA, teamB, metrics };
      });
    }
  };

  const handleMovePlayerTeam = (playerId, targetTeam) => {
    if (socket.connected) {
      socket.emit('move_player_team', { roomId, playerId, targetTeam });
    } else {
      setRoom((prev) => {
        const player = prev.players.find((p) => p.id === playerId);
        if (!player) return prev;
        const teamA = prev.teamA.filter((p) => p.id !== playerId);
        const teamB = prev.teamB.filter((p) => p.id !== playerId);
        if (targetTeam === 'teamA') teamA.push(player);
        else teamB.push(player);
        const metrics = calculateMetricsForTeams(teamA, teamB, prev.rankingSystem || 'gc');
        return { ...prev, teamA, teamB, metrics };
      });
    }
  };

  const handleSwapPlayers = (playerAId, playerBId) => {
    if (socket.connected) {
      socket.emit('swap_players', { roomId, playerAId, playerBId });
    } else {
      setRoom((prev) => {
        let idxA = prev.teamA.findIndex((p) => p.id === playerAId);
        let idxB = prev.teamB.findIndex((p) => p.id === playerBId);
        if (idxA === -1 || idxB === -1) {
          idxA = prev.teamA.findIndex((p) => p.id === playerBId);
          idxB = prev.teamB.findIndex((p) => p.id === playerAId);
        }
        if (idxA >= 0 && idxB >= 0) {
          const newTeamA = [...prev.teamA];
          const newTeamB = [...prev.teamB];
          const pA = newTeamA[idxA];
          const pB = newTeamB[idxB];
          newTeamA[idxA] = pB;
          newTeamB[idxB] = pA;
          const metrics = calculateMetricsForTeams(newTeamA, newTeamB, prev.rankingSystem || 'gc');
          return { ...prev, teamA: newTeamA, teamB: newTeamB, metrics };
        }
        return prev;
      });
    }
  };

  const handleAdminChangePlayerSide = (targetPlayerId, side) => {
    if (socket.connected) {
      socket.emit('admin_change_player_side', { roomId, targetPlayerId, side });
    }
  };

  const handleEnterRoom = (code = 'MIX-PRO') => {
    if (!isSteamLogged) {
      handleRequireSteamLogin('entrar no mix');
      return;
    }
    const safeCode = typeof code === 'string' && code.trim() ? code : (roomId || 'MIX-PRO');
    handleSelectRoom(safeCode);
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
    const safeTarget = typeof targetRoomId === 'string' && targetRoomId.trim() ? targetRoomId : (roomId || 'MIX-PRO');
    const cleanId = safeTarget.trim().toUpperCase();
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

  // Live Sync Official Rotation from verified source
  const handleSyncOfficialRotation = async () => {
    if (syncingRotation) return;
    setSyncingRotation(true);
    try {
      if (socket.connected) {
        socket.emit('sync_official_rotation');
      }
      const res = await fetch('/api/maps/sync-rotation', { method: 'POST' });
      const data = await res.json();
      if (data && Array.isArray(data.activeDutyMaps)) {
        setOfficialRotation(data);
        setRoomNotice({
          title: 'Rotação Oficial Sincronizada',
          message: `Pool verificado via ${data.source || 'Wikipedia / Valve Records'}: ${data.activeDutyMaps.length} mapas competitivos ativos mundialmente.`,
          type: 'info',
        });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar rotação:', err);
    } finally {
      setTimeout(() => setSyncingRotation(false), 500);
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

    // Only synchronize with a mix room if the user is actively inside a mix room
    if (viewRef.current !== 'mix' || !roomIdRef.current) {
      return;
    }

    const activeRoomId = roomIdRef.current;
    const isAlreadyInRoom = Boolean(
      roomRef.current?.players?.some((p) => p.id === newProfile.id || (p.nick && p.nick === newProfile.nick))
    );

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
      if (isAlreadyInRoom) {
        socket.emit('update_player', {
          roomId: activeRoomId,
          player: newProfile,
        });
      } else {
        socket.emit('join_room', {
          roomId: activeRoomId,
          player: newProfile,
          password: roomPasswordRef.current || undefined,
          inviteKey: inviteKeyRef.current || undefined,
          isPrivate: Boolean(inviteKeyRef.current || roomRef.current?.isPrivate),
          createIfMissing: true,
        });
      }
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

  // Return to lobby preserving players (canceling draft or team preview)
  const handleReturnToLobby = () => {
    if (socket.connected && roomIdRef.current) {
      socket.emit('return_to_lobby', { roomId: roomIdRef.current });
    }
    setRoom((prev) => ({
      ...prev,
      phase: 'lobby',
      captainA: null,
      captainB: null,
      unassignedPlayers: [],
    }));
  };

  // Send chat message (accepts either { sender, text } or plain string text)
  const handleSendMessage = (message) => {
    const normalized =
      typeof message === 'string'
        ? {
            sender: myProfileRef.current?.nick
              ? myProfileRef.current
              : { nick: 'Jogador', level: 10, faceitLevel: 5, avatar: '🎯' },
            text: message,
          }
        : message;

    if (!normalized || !normalized.text || !String(normalized.text).trim()) return;

    if (socket.connected && roomIdRef.current) {
      socket.emit('send_chat', { roomId: roomIdRef.current, message: normalized });
    } else {
      const chatMsg = {
        id: `msg-${Date.now()}`,
        sender: normalized.sender || myProfileRef.current || { nick: 'Jogador', level: 10, avatar: '🎯' },
        text: String(normalized.text),
        timestamp: Date.now(),
      };
      setRoom((prev) => ({ ...prev, chat: [...prev.chat, chatMsg] }));
    }
  };

  // Commend player post-match (broadcasts commendation in room chat)
  const handleCommendPlayer = (playerId, type) => {
    const target = [...(roomRef.current?.teamA || []), ...(roomRef.current?.teamB || []), ...(roomRef.current?.players || [])].find(
      (p) => p.id === playerId
    );
    const labelMap = {
      leader: 'Liderança / IGL',
      aim: 'MiraInsana',
      friendly: 'Bom Companheiro',
      clutch: 'Mestre do Clutch',
    };
    const commendLabel = labelMap[type] || type;
    if (target?.nick && viewRef.current === 'mix' && roomIdRef.current) {
      handleSendMessage(`⭐ Elogio enviado para ${target.nick}: ${commendLabel}!`);
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

  // Update RCON Password
  const handleUpdateRconPassword = (rconPassword) => {
    if (socket.connected) {
      socket.emit('set_rcon_password', { roomId, rconPassword });
    } else {
      setRoom((prev) => ({ ...prev, rconPassword }));
    }
  };

  // Change Server Map via RCON
  const handleChangeServerMapRcon = (mapFile) => {
    if (socket.connected) {
      socket.emit('change_server_map', { roomId, mapFile }, (res) => {
        if (res?.success) {
          setRoomNotice({
            title: 'Mapa Alterado no Servidor',
            message: `Servidor da FireGames mudou para ${mapFile} com sucesso via RCON!`,
            type: 'info',
          });
        } else {
          setRoomNotice({
            title: 'Erro no RCON',
            message: res?.error || 'Não foi possível alterar o mapa no servidor.',
            type: 'warning',
          });
        }
      });
    }
  };

  // Execute generic RCON command from client
  const handleExecRconCommand = (command, label = 'Comando') => {
    if (socket.connected) {
      socket.emit('exec_rcon_command', { roomId, command }, (res) => {
        if (res?.success) {
          setRoomNotice({
            title: `RCON: ${label}`,
            message: res?.response || 'Comando executado com sucesso no servidor!',
            type: 'info',
          });
        } else {
          setRoomNotice({
            title: 'Erro no RCON',
            message: res?.error || 'Não foi possível executar o comando no servidor.',
            type: 'warning',
          });
        }
      });
    }
  };

  // Update Discord Webhook settings
  const handleSaveDiscordWebhook = ({ webhookUrl, autoLobby, autoVeto, autoGsiRounds, autoGsiBomb, autoStats }) => {
    if (socket.connected) {
      socket.emit('set_discord_webhook', {
        roomId,
        webhookUrl,
        autoLobby,
        autoVeto,
        autoGsiRounds,
        autoGsiBomb,
        autoStats,
      });
    }
    setRoom((prev) => ({
      ...prev,
      discordWebhook: webhookUrl,
      discordAutoLobby: autoLobby,
      discordAutoVeto: autoVeto,
      discordGsiRounds: autoGsiRounds,
      discordGsiBomb: autoGsiBomb,
      discordAutoStats: autoStats,
    }));
  };

  // Save match score
  const handleSaveScore = (scoreA, scoreB, selectedMap) => {
    const numA = Number(scoreA) || 0;
    const numB = Number(scoreB) || 0;
    const mapToSave = selectedMap || room.finalMap?.name || 'Mirage';

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
      socket.emit('save_score', {
        roomId,
        scoreA,
        scoreB,
        map: mapToSave,
        mapName: mapToSave,
      });
    } else {
      setRoom((prev) => ({
        ...prev,
        history: [
          {
            id: `match-${Date.now()}`,
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            map: mapToSave,
            scoreA: numA,
            scoreB: numB,
            winner: numA > numB ? 'Time A' : numB > numA ? 'Time B' : 'Empate',
          },
          ...prev.history,
        ],
      }));
    }
  };

  // Direct Veto Start (Teams already made — Pro MD1 / MD3 / MD5)
  const handleStartQuickVeto = (teamAName, teamBName, options = {}) => {
    const { matchFormat = 'MD3', firstTeam = 'teamA', bo1Order = 'ABABAB' } = options;
    const targetRoomId = roomId || `VETO-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    if (!roomId) setRoomId(targetRoomId);
    setView('mix');

    const cleanA = (teamAName || 'Time A').trim();
    const cleanB = (teamBName || 'Time B').trim();

    setRoom((prev) => ({
      ...prev,
      id: targetRoomId,
      phase: 'veto',
      matchFormat,
      vetoFirstTeam: firstTeam,
      bo1Order,
      teamAName: cleanA,
      teamBName: cleanB,
      bannedMaps: [],
      pickedMaps: [],
      vetoLog: [],
      drawnSeries: [],
      pendingSidePick: null,
      currentTurn: firstTeam,
      finalMap: null,
      startingSideTeamB: null,
      teamA: [{ id: 't1', nick: cleanA, level: 15, avatar: '🛡️' }],
      teamB: [{ id: 't2', nick: cleanB, level: 15, avatar: '⚔️' }],
    }));

    if (socket.connected) {
      socket.emit('join_room', {
        roomId: targetRoomId,
        roomName: `${cleanA} vs ${cleanB}`,
        player: myProfile?.nick ? myProfile : null,
        createIfMissing: true,
      });
      socket.emit('quick_start_veto', {
        roomId: targetRoomId,
        teamAName: cleanA,
        teamBName: cleanB,
        matchFormat,
        firstTeam,
        bo1Order,
      });
    }
  };

  // Direct Quick Map Roll (Supports MD1, MD3, MD5 with 100% reliable cryptographic draw)
  const handleApplyQuickMap = (map, startingSide, matchFormat = 'MD1', drawnSeries = []) => {
    const targetRoomId = roomId || `MAPA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    if (!roomId) setRoomId(targetRoomId);
    setView('mix');

    const sideTeamA = (typeof startingSide === 'object' && startingSide?.sideTimeA) ? startingSide.sideTimeA : (typeof startingSide === 'string' ? startingSide : 'CT');
    const sideTeamB = (typeof startingSide === 'object' && startingSide?.sideTimeB) ? startingSide.sideTimeB : (sideTeamA === 'CT' ? 'TR' : 'CT');

    const formattedSeries = Array.isArray(drawnSeries) && drawnSeries.length > 0
      ? drawnSeries.map((s, idx) => ({
          ...s,
          sideTimeA: s.sideTimeA || 'CT',
          sideTimeB: s.sideTimeB || (s.sideTimeA === 'CT' ? 'TR' : 'CT'),
          role: s.role || `Mapa #${idx + 1}`,
        }))
      : [{ map, sideTimeA: sideTeamA, sideTimeB: sideTeamB, role: 'Mapa da Partida' }];

    setRoom((prev) => ({
      ...prev,
      id: targetRoomId,
      phase: 'finished',
      finalMap: map,
      startingSideTeamB: sideTeamB,
      startingSideTeamA: sideTeamA,
      matchFormat,
      drawnSeries: formattedSeries,
      teamA: prev.teamA.length > 0 ? prev.teamA : [{ id: 't1', nick: 'Time A', level: 15, avatar: '🛡️' }],
      teamB: prev.teamB.length > 0 ? prev.teamB : [{ id: 't2', nick: 'Time B', level: 15, avatar: '⚔️' }],
    }));
    if (socket.connected) {
      socket.emit('join_room', {
        roomId: targetRoomId,
        roomName: `Sorteio ${map?.name || 'CS2'}`,
        player: myProfile?.nick ? myProfile : null,
        createIfMissing: true,
      });
      socket.emit('quick_random_map', {
        roomId: targetRoomId,
        map,
        startingSide: sideTeamB,
        startingSideTeamA: sideTeamA,
        matchFormat,
        drawnSeries: formattedSeries,
      });
    }
  };

  // Load Tournament match into Mix Hub
  const handleLoadTournamentTeams = ({ nameA, nameB, teamAObj, teamBObj }) => {
    if (soundEnabled) playClickSound();

    const cleanRoom = (roomId && roomId.trim()) ? roomId.trim() : `COPA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    if (!roomId) {
      setRoomId(cleanRoom);
      const u = new URL(window.location);
      u.searchParams.set('room', cleanRoom);
      window.history.replaceState({}, '', u);
    }

    const formattedTeamA = (teamAObj?.players || []).map((p, i) => ({
      id: `tourney-a-${i}-${Date.now()}`,
      nick: p.nick,
      level: 16,
      avatar: p.role === 'IGL' ? '👑' : p.role === 'AWP' ? '🎯' : '⚡',
      team: 'teamA',
      role: p.role,
      isCaptain: Boolean(p.isCaptain),
    }));

    const formattedTeamB = (teamBObj?.players || []).map((p, i) => ({
      id: `tourney-b-${i}-${Date.now()}`,
      nick: p.nick,
      level: 16,
      avatar: p.role === 'IGL' ? '👑' : p.role === 'AWP' ? '🎯' : '⚡',
      team: 'teamB',
      role: p.role,
      isCaptain: Boolean(p.isCaptain),
    }));

    const allTourneyPlayers = [...formattedTeamA, ...formattedTeamB];

    if (socket.connected) {
      socket.emit('join_room', {
        roomId: cleanRoom,
        roomName: `${nameA} vs ${nameB}`,
        createIfMissing: true,
      });
      socket.emit('load_tournament_match', {
        roomId: cleanRoom,
        nameA,
        nameB,
        teamA: formattedTeamA,
        teamB: formattedTeamB,
        matchFormat: 'MD3',
      });
    }

    setRoom((prev) => ({
      ...prev,
      id: cleanRoom,
      nameA: nameA || prev.nameA || 'Time A',
      nameB: nameB || prev.nameB || 'Time B',
      teamAName: nameA || 'Time A',
      teamBName: nameB || 'Time B',
      teamA: formattedTeamA.length > 0 ? formattedTeamA : prev.teamA,
      teamB: formattedTeamB.length > 0 ? formattedTeamB : prev.teamB,
      players: allTourneyPlayers.length > 0 ? allTourneyPlayers : prev.players,
      phase: allTourneyPlayers.length >= 10 ? 'teams' : (prev.players.length >= 10 ? 'teams' : 'lobby'),
    }));

    if (view !== 'mix') {
      setView('mix');
    }
    setTournamentModalOpen(false);
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
    u.searchParams.delete('view');
    window.history.pushState({}, '', u);
  };

  const handleOpenServersPage = () => {
    if (soundEnabled) playClickSound();
    setView('servers');
    const u = new URL(window.location);
    u.searchParams.set('view', 'servers');
    window.history.pushState({}, '', u);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    if (soundEnabled) playClickSound();
    setView('landing');
    const u = new URL(window.location);
    u.searchParams.delete('view');
    u.searchParams.delete('tab');
    u.searchParams.delete('room');
    u.searchParams.delete('pwd');
    u.searchParams.delete('key');
    window.history.pushState({}, '', u);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToRoom = (targetRoomId) => {
    if (soundEnabled) playClickSound();
    const safeTarget = typeof targetRoomId === 'string' && targetRoomId.trim() ? targetRoomId : (roomId || 'MIX-PRO');
    const clean = safeTarget.trim().toUpperCase();
    const u = new URL(window.location);
    u.searchParams.delete('view');
    u.searchParams.delete('tab');
    window.history.replaceState({}, '', u);
    handleEnterRoom(clean);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Steam Switch Account (logout and immediate redirect to Steam Auth)
  const handleSwitchSteamAccount = () => {
    if (myProfile?.id) {
      handleRemovePlayer(myProfile.id);
    }
    try {
      localStorage.removeItem('cs2_mix_profile');
    } catch (e) {}

    window.location.href = '/api/auth/steam';
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
  const handleStartVeto = (matchFormat = 'MD1') => {
    const fmt = typeof matchFormat === 'string' && ['MD1', 'MD3', 'MD5'].includes(matchFormat) ? matchFormat : (room.matchFormat || 'MD1');
    const targetId = roomId || room.id;
    if (socket.connected && targetId) {
      socket.emit('start_veto', { roomId: targetId, matchFormat: fmt });
    }
    setRoom((prev) => ({
      ...prev,
      phase: 'veto',
      matchFormat: fmt,
      bannedMaps: [],
      pickedMaps: [],
      vetoLog: [],
      drawnSeries: [],
      pendingSidePick: null,
      currentTurn: prev.vetoFirstTeam || 'teamA',
      finalMap: null,
      startingSideTeamB: null,
    }));
  };

  // Change Veto Format (MD1 / MD3 / MD5)
  const handleChangeVetoFormat = (newFormat) => {
    if (socket.connected) {
      socket.emit('change_veto_format', { roomId, matchFormat: newFormat });
    } else {
      setRoom((prev) => ({
        ...prev,
        phase: 'veto',
        matchFormat: newFormat,
        bannedMaps: [],
        pickedMaps: [],
        vetoLog: [],
        drawnSeries: [],
        pendingSidePick: null,
        currentTurn: prev.vetoFirstTeam || 'teamA',
        finalMap: null,
        startingSideTeamB: null,
      }));
    }
  };

  // Restart Veto Only
  const handleRestartVeto = () => {
    if (socket.connected) {
      socket.emit('restart_veto', { roomId });
    } else {
      setRoom((prev) => ({
        ...prev,
        phase: 'veto',
        bannedMaps: [],
        pickedMaps: [],
        vetoLog: [],
        drawnSeries: [],
        pendingSidePick: null,
        currentTurn: prev.vetoFirstTeam || 'teamA',
        finalMap: null,
        startingSideTeamB: null,
      }));
    }
  };

  // Ban or Pick Map according to Pro Veto Schedule
  const handleBanMap = (mapId) => {
    const targetId = roomId || room.id;
    if (socket.connected && targetId) {
      socket.emit('ban_map', { roomId: targetId, mapId });
    } else {
      setRoom((prev) => {
        if (prev.pendingSidePick) return prev;
        if (prev.bannedMaps.some((b) => b.mapId === mapId) || (prev.pickedMaps || []).some((p) => p.mapId === mapId)) {
          return prev;
        }
        const mapObj = prev.maps.find((m) => m.id === mapId);
        if (!mapObj) return prev;

        const schedule = getVetoSchedule(prev.matchFormat || 'MD1', prev.vetoFirstTeam || 'teamA', prev.bo1Order || 'ABABAB');
        const actionIdx = prev.bannedMaps.length + (prev.pickedMaps?.length || 0);
        const currentStep = schedule[actionIdx];
        if (!currentStep) return prev;

        if (currentStep.type === 'pick') {
          const newPick = {
            mapId,
            map: mapObj,
            pickedBy: currentStep.team,
            sidePickBy: currentStep.sidePickBy,
            mapNumber: currentStep.mapNumber,
            step: currentStep.step,
            sideTeamA: null,
            sideTeamB: null,
            knifeRound: false,
            timestamp: Date.now(),
          };
          const newLog = [
            ...(prev.vetoLog || []),
            {
              step: currentStep.step,
              type: 'pick',
              team: currentStep.team,
              mapId,
              mapName: mapObj.name,
              mapNumber: currentStep.mapNumber,
              sideTeamA: null,
              sideTeamB: null,
              knifeRound: false,
            },
          ];
          return {
            ...prev,
            pickedMaps: [...(prev.pickedMaps || []), newPick],
            vetoLog: newLog,
            pendingSidePick: {
              mapId,
              mapNumber: currentStep.mapNumber,
              pickedBy: currentStep.team,
              sidePickBy: currentStep.sidePickBy,
              step: currentStep.step,
            },
            currentTurn: currentStep.sidePickBy,
          };
        }

        const newBans = [
          ...prev.bannedMaps,
          { mapId, bannedBy: currentStep.team, step: currentStep.step, timestamp: Date.now() },
        ];
        const newLog = [
          ...(prev.vetoLog || []),
          { step: currentStep.step, type: 'ban', team: currentStep.team, mapId, mapName: mapObj.name },
        ];
        const remaining = prev.maps.filter(
          (m) => !newBans.some((b) => b.mapId === m.id) && !(prev.pickedMaps || []).some((p) => p.mapId === m.id)
        );
        const nextStep = schedule[actionIdx + 1];

        if (remaining.length === 1 || !nextStep || nextStep.type === 'decider') {
          return {
            ...prev,
            bannedMaps: newBans,
            vetoLog: newLog,
            finalMap: remaining[0] || mapObj,
            phase: 'side_pick',
            currentTurn: nextStep?.sidePickBy || 'teamA',
          };
        }

        return {
          ...prev,
          bannedMaps: newBans,
          vetoLog: newLog,
          currentTurn: nextStep.team,
        };
      });
    }
  };

  // Side Selection (for picked map in MD3/MD5 or decider map)
  const handleSelectSide = (side) => {
    const targetId = roomId || room.id;
    if (socket.connected && targetId) {
      socket.emit('select_side', { roomId: targetId, side });
    } else {
      setRoom((prev) => {
        const cleanSide = side === 'TR' ? 'TR' : side === 'KNIFE' ? 'KNIFE' : 'CT';
        const schedule = getVetoSchedule(prev.matchFormat || 'MD1', prev.vetoFirstTeam || 'teamA', prev.bo1Order || 'ABABAB');

        if (prev.phase === 'veto' && prev.pendingSidePick) {
          const pending = prev.pendingSidePick;
          const pickerTeam = pending.sidePickBy || 'teamB';
          let sideA = 'CT';
          let sideB = 'TR';
          if (cleanSide === 'KNIFE') {
            sideA = 'FACA';
            sideB = 'FACA';
          } else if (pickerTeam === 'teamA') {
            sideA = cleanSide;
            sideB = cleanSide === 'CT' ? 'TR' : 'CT';
          } else {
            sideB = cleanSide;
            sideA = cleanSide === 'CT' ? 'TR' : 'CT';
          }

          const updatedPicks = (prev.pickedMaps || []).map((p) =>
            p.mapId === pending.mapId ? { ...p, sideTeamA: sideA, sideTeamB: sideB, knifeRound: cleanSide === 'KNIFE' } : p
          );
          const updatedLog = (prev.vetoLog || []).map((l) =>
            l.mapId === pending.mapId && l.type === 'pick'
              ? { ...l, sideTeamA: sideA, sideTeamB: sideB, knifeRound: cleanSide === 'KNIFE' }
              : l
          );

          const remaining = prev.maps.filter(
            (m) => !prev.bannedMaps.some((b) => b.mapId === m.id) && !updatedPicks.some((p) => p.mapId === m.id)
          );
          const nextIdx = prev.bannedMaps.length + updatedPicks.length;
          const nextStep = schedule[nextIdx];

          if (remaining.length === 1 || !nextStep || nextStep.type === 'decider') {
            return {
              ...prev,
              pickedMaps: updatedPicks,
              vetoLog: updatedLog,
              pendingSidePick: null,
              finalMap: remaining[0],
              phase: 'side_pick',
              currentTurn: nextStep?.sidePickBy || 'teamA',
            };
          }

          return {
            ...prev,
            pickedMaps: updatedPicks,
            vetoLog: updatedLog,
            pendingSidePick: null,
            currentTurn: nextStep.team,
          };
        }

        const deciderStep = schedule[schedule.length - 1];
        const pickerTeam = deciderStep?.sidePickBy || 'teamB';
        let deciderSideA = 'CT';
        let deciderSideB = 'TR';
        if (cleanSide === 'KNIFE') {
          deciderSideA = 'CT';
          deciderSideB = 'TR';
        } else if (pickerTeam === 'teamA') {
          deciderSideA = cleanSide;
          deciderSideB = cleanSide === 'CT' ? 'TR' : 'CT';
        } else {
          deciderSideB = cleanSide;
          deciderSideA = cleanSide === 'CT' ? 'TR' : 'CT';
        }

        const deciderMap = prev.finalMap;
        const updatedLog = [
          ...(prev.vetoLog || []),
          {
            step: schedule.length,
            type: 'decider',
            team: 'auto',
            mapId: deciderMap?.id,
            mapName: deciderMap?.name || 'Decider',
            mapNumber: deciderStep?.mapNumber || 1,
            sideTeamA: cleanSide === 'KNIFE' ? 'FACA' : deciderSideA,
            sideTeamB: cleanSide === 'KNIFE' ? 'FACA' : deciderSideB,
            knifeRound: cleanSide === 'KNIFE',
          },
        ];

        const picks = prev.pickedMaps || [];
        if (picks.length > 0) {
          const labelA = prev.teamAName || prev.teamA?.[0]?.nick || 'Time A';
          const labelB = prev.teamBName || prev.teamB?.[0]?.nick || 'Time B';
          const series = picks.map((p) => ({
            map: p.map,
            sideTimeA: p.sideTeamA === 'FACA' ? 'CT' : (p.sideTeamA || 'CT'),
            knifeRound: Boolean(p.knifeRound),
            pickedBy: p.pickedBy,
            role: `Mapa ${p.mapNumber} (Pick ${p.pickedBy === 'teamA' ? labelA : labelB})`,
          }));
          series.push({
            map: deciderMap,
            sideTimeA: deciderSideA,
            knifeRound: cleanSide === 'KNIFE',
            pickedBy: 'decider',
            role: `Mapa ${series.length + 1} (Decider)`,
          });
          return {
            ...prev,
            vetoLog: updatedLog,
            drawnSeries: series,
            finalMap: series[0].map || deciderMap,
            startingSideTeamB: series[0].sideTimeA === 'CT' ? 'TR' : 'CT',
            phase: 'finished',
          };
        }

        return {
          ...prev,
          vetoLog: updatedLog,
          drawnSeries: [
            {
              map: deciderMap,
              sideTimeA: deciderSideA,
              knifeRound: cleanSide === 'KNIFE',
              pickedBy: 'decider',
              role: 'Mapa da Partida (Decider)',
            },
          ],
          startingSideTeamB: deciderSideB,
          phase: 'finished',
        };
      });
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
        teamAName: null,
        teamBName: null,
        metrics: null,
        bannedMaps: [],
        pickedMaps: [],
        vetoLog: [],
        drawnSeries: [],
        pendingSidePick: null,
        finalMap: null,
        startingSideTeamB: null,
        currentTurn: 'teamA',
        coin: null,
        unassignedPlayers: [],
      }));
    }
  };

  // Rematch with Same Teams
  const handleRematchSameTeams = () => {
    if (socket.connected) {
      socket.emit('rematch_same_teams', { roomId });
    } else {
      setRoom((prev) => ({
        ...prev,
        phase: 'veto',
        bannedMaps: [],
        pickedMaps: [],
        vetoLog: [],
        drawnSeries: [],
        pendingSidePick: null,
        finalMap: null,
        startingSideTeamB: prev.startingSideTeamB === 'CT' ? 'TR' : 'CT',
        currentTurn: 'teamA',
        liveMatch: null,
      }));
    }
  };

  const handleExitMixLobbyToLanding = () => {
    setView('landing');
    const u = new URL(window.location);
    u.searchParams.delete('room');
    u.searchParams.delete('pwd');
    u.searchParams.delete('key');
    window.history.pushState({}, '', u);
  };

  const pageLoadingFallback = (
    <div className="min-h-screen flex items-center justify-center bg-[#070a12] text-slate-300 font-mono text-xs">
      Carregando interface...
    </div>
  );

  const phaseLoadingFallback = (
    <div className="py-16 text-center text-xs font-mono text-amber-300 animate-pulse">
      Carregando fase do mix...
    </div>
  );

  return (
    <>
      <UpdateNotificationBanner isAvailable={updateAvailable} onUpdate={handleApplyUpdate} />
      <FailoverBanner roomId={roomId} roomPassword={roomPassword} socketConnected={socketConnected} />

      {/* Room Notification Toast Banner */}
      {roomNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-fadeIn">
          <div
            className={`p-4 rounded-2xl border shadow-2xl flex items-start justify-between gap-3 backdrop-blur-xl ${
              roomNotice.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-200'
                : 'bg-slate-900/95 border-emerald-500/50 text-slate-100'
            }`}
          >
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
              aria-label="Fechar aviso"
              onClick={() => setRoomNotice(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {view === 'servers' ? (
        <Suspense fallback={pageLoadingFallback}>
          <DedicatedServersHub
            roomId={roomId}
            currentServerIp={room.serverIp || ''}
            rconPassword={room.rconPassword || ''}
            finalMap={room.finalMap?.name || 'de_mirage'}
            onUpdateServerIp={handleUpdateServerIp}
            onUpdateRconPassword={handleUpdateRconPassword}
            onGoHome={handleGoHome}
            onGoToRoom={handleGoToRoom}
            onOpenQuickVeto={() => setQuickVetoOpen(true)}
            onOpenQuickMapRoll={() => setQuickMapRollOpen(true)}
            onOpenRoomsHub={() => setRoomsHubOpen(true)}
            onOpenLeaderboard={() => setLeaderboardOpen(true)}
            onOpenDiscordModal={() => setDiscordModalOpen(true)}
            onOpenTournament={() => setTournamentModalOpen(true)}
            onOpenGrenades={() => setGrenadeModalOpen(true)}
            onOpenAimReflex={() => setAimReflexModalOpen(true)}
            onOpenProfile={() => setProfileModalOpen(true)}
            activeRoomsCount={activeRoomsCount}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            myProfile={myProfile}
          />
        </Suspense>
      ) : view === 'landing' ? (
        <Suspense fallback={pageLoadingFallback}>
          <LandingPage
            onGoHome={handleGoHome}
            onEnterRoom={handleEnterRoom}
            onOpenQuickVeto={() => setQuickVetoOpen(true)}
            onOpenQuickMapRoll={() => setQuickMapRollOpen(true)}
            onOpenRoomsHub={() => setRoomsHubOpen(true)}
            onOpenLeaderboard={() => setLeaderboardOpen(true)}
            onOpenDiscordModal={() => setDiscordModalOpen(true)}
            onOpenLocalHost={() => setLocalHostModalOpen(true)}
            onOpenTournament={() => setTournamentModalOpen(true)}
            onOpenGrenades={() => setGrenadeModalOpen(true)}
            onOpenAimReflex={() => setAimReflexModalOpen(true)}
            onOpenServersPage={handleOpenServersPage}
            onRequireSteamLogin={handleRequireSteamLogin}
            onOpenProfile={() => setProfileModalOpen(true)}
            myProfile={myProfile}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            officialRotation={officialRotation}
            syncingRotation={syncingRotation}
            onSyncOfficialRotation={handleSyncOfficialRotation}
          />
        </Suspense>
      ) : (
        <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
          <Header
            roomId={roomId}
            roomName={room.name}
            phase={room.phase}
            rankingSystem={room.rankingSystem || 'gc'}
            playerCount={room.players?.length || 0}
            serverIp={room.serverIp || ''}
            myProfile={myProfile}
            onOpenProfile={() => setProfileModalOpen(true)}
            onDeleteRoom={handleDeleteRoom}
            soundEnabled={soundEnabled}
            setSoundEnabled={handleToggleSound}
            onToggleSound={handleToggleSound}
            activeRoomsCount={activeRoomsCount}
            onOpenRoomsHub={() => setRoomsHubOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onOpenQuickVeto={() => setQuickVetoOpen(true)}
            onOpenQuickMapRoll={() => setQuickMapRollOpen(true)}
            onOpenLeaderboard={() => setLeaderboardOpen(true)}
            onOpenDiscordModal={() => setDiscordModalOpen(true)}
            onOpenLocalHost={() => setLocalHostModalOpen(true)}
            onOpenTournament={() => setTournamentModalOpen(true)}
            onOpenGrenades={() => setGrenadeModalOpen(true)}
            onOpenAimReflex={() => setAimReflexModalOpen(true)}
            onOpenServersPage={handleOpenServersPage}
            onGoHome={handleGoHome}
            roomPassword={roomPassword}
            hasPassword={Boolean(room.hasPassword)}
            isPrivate={Boolean(room.isPrivate)}
            inviteKey={inviteKey || room.inviteKey}
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
                    onOpenDiscordModal={() => setDiscordModalOpen(true)}
                    onOpenGrenades={() => setGrenadeModalOpen(true)}
                    onOpenAimReflex={() => setAimReflexModalOpen(true)}
                    onOpenTournament={() => setTournamentModalOpen(true)}
                    serverIp={room.serverIp || ''}
                    onUpdateServerIp={handleUpdateServerIp}
                    rconPassword={room.rconPassword || ''}
                    onUpdateRconPassword={handleUpdateRconPassword}
                    roomId={roomId}
                    roomName={room.name}
                    liveMatch={room.liveMatch}
                    onOpenGsiSetup={() => setGsiModalOpen(true)}
                    onOpenServersPage={handleOpenServersPage}
                    soundEnabled={soundEnabled}
                    isAdmin={isAdmin}
                    adminId={room.adminId}
                    onKickPlayer={handleKickPlayer}
                    onAdminChangeSide={handleAdminChangePlayerSide}
                    roomPassword={roomPassword}
                    isPrivate={Boolean(room.isPrivate)}
                    hasPassword={Boolean(room.hasPassword || roomPassword)}
                    inviteKey={inviteKey || room.inviteKey}
                  />
                </div>
              </div>
            )}

            {/* CAPTAINS DRAFT PHASE */}
            {room.phase === 'captains_draft' && (
              <Suspense fallback={phaseLoadingFallback}>
                <CaptainsDraftView
                  room={room}
                  onPickPlayer={handleCaptainPick}
                  onCancel={handleReturnToLobby}
                  soundEnabled={soundEnabled}
                />
              </Suspense>
            )}

            {/* TEAMS PHASE */}
            {room.phase === 'teams' && (
              <Suspense fallback={phaseLoadingFallback}>
                <TeamsView
                  room={room}
                  teamA={room.teamA}
                  teamB={room.teamB}
                  metrics={room.metrics}
                  rankingSystem={room.rankingSystem || 'gc'}
                  onSwapTeams={handleSwapTeams}
                  onReDraw={() => handleTriggerDraw('balanced')}
                  onStartCoinFlip={handleStartCoinFlip}
                  onStartVeto={handleStartVeto}
                  onBackToLobby={handleReturnToLobby}
                  serverIp={room.serverIp || ''}
                  onUpdateServerIp={handleUpdateServerIp}
                  rconPassword={room.rconPassword || ''}
                  onUpdateRconPassword={handleUpdateRconPassword}
                  roomId={roomId}
                  liveMatch={room.liveMatch}
                  onOpenGsiSetup={() => setGsiModalOpen(true)}
                  onOpenServersPage={handleOpenServersPage}
                  soundEnabled={soundEnabled}
                  isAdmin={isAdmin}
                  adminId={room.adminId}
                  myProfile={myProfile}
                  onMovePlayerTeam={handleMovePlayerTeam}
                  onKickPlayer={handleKickPlayer}
                />
              </Suspense>
            )}

            {/* VETO & SIDE PICK PHASE */}
            {(room.phase === 'veto' || room.phase === 'side_pick') && (
              <Suspense fallback={phaseLoadingFallback}>
                <MapVeto
                  room={room}
                  onBanMap={handleBanMap}
                  onSelectSide={handleSelectSide}
                  onChangeVetoFormat={handleChangeVetoFormat}
                  onResetMix={handleRestartVeto}
                  soundEnabled={soundEnabled}
                />
              </Suspense>
            )}

            {/* FINISHED / SUMMARY PHASE */}
            {room.phase === 'finished' && (
              <Suspense fallback={phaseLoadingFallback}>
                <FinalSummary
                  room={room}
                  onResetMix={handleResetMix}
                  onRematchSameTeams={handleRematchSameTeams}
                  onUpdateServerIp={handleUpdateServerIp}
                  onUpdateRconPassword={handleUpdateRconPassword}
                  onChangeServerMapRcon={handleChangeServerMapRcon}
                  onExecRconCommand={handleExecRconCommand}
                  onOpenMatchCard={() => setMatchCardOpen(true)}
                  onOpenStoryCard={() => setStoryCardOpen(true)}
                  onOpenDiscordModal={() => setDiscordModalOpen(true)}
                  onOpenGsiSetup={() => setGsiModalOpen(true)}
                  onOpenHistory={() => setHistoryOpen(true)}
                  onOpenServersPage={handleOpenServersPage}
                  soundEnabled={soundEnabled}
                  onCommendPlayer={handleCommendPlayer}
                />
              </Suspense>
            )}
          </main>

          {room.phase === 'coin_flip' && (
            <Suspense fallback={null}>
              <CoinFlipModal
                isOpen={true}
                room={room}
                coin={room.coin}
                onChooseAction={handleCoinChoice}
                soundEnabled={soundEnabled}
              />
            </Suspense>
          )}

          {rouletteActive && (
            <Suspense fallback={null}>
              <DraftRoulette
                players={room.players}
                rankingSystem={room.rankingSystem || 'gc'}
                onComplete={handleRouletteComplete}
                soundEnabled={soundEnabled}
              />
            </Suspense>
          )}

          <ChatDrawer
            roomId={roomId}
            chat={room.chat}
            onSendMessage={handleSendMessage}
            myProfile={myProfile}
            rankingSystem={room.rankingSystem || 'gc'}
            soundEnabled={soundEnabled}
          />

          {/* Footer */}
          <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
            <p>
              CS2 Mix Hub • Rotação Oficial Valve (Active Duty) • Sorteador Gamers Club & Pick/Ban em Tempo Real
            </p>
          </footer>
        </div>
      )}

      <GlobalModals
        view={view}
        roomId={roomId}
        room={room}
        myProfile={myProfile}
        socket={socket}
        soundEnabled={soundEnabled}
        isSteamLogged={isSteamLogged}
        officialRotation={officialRotation}
        syncingRotation={syncingRotation}
        roomsHubOpen={roomsHubOpen}
        onCloseRoomsHub={() => setRoomsHubOpen(false)}
        onOpenRoomsHub={() => setRoomsHubOpen(true)}
        historyOpen={historyOpen}
        onCloseHistory={() => setHistoryOpen(false)}
        quickVetoOpen={quickVetoOpen}
        onCloseQuickVeto={() => setQuickVetoOpen(false)}
        quickMapRollOpen={quickMapRollOpen}
        onCloseQuickMapRoll={() => setQuickMapRollOpen(false)}
        steamGateModalOpen={steamGateModalOpen}
        steamGateActionText={steamGateActionText}
        onCloseSteamGate={() => setSteamGateModalOpen(false)}
        onExitMixLobbyToLanding={handleExitMixLobbyToLanding}
        profileModalOpen={profileModalOpen}
        onCloseProfile={() => setProfileModalOpen(false)}
        gsiModalOpen={gsiModalOpen}
        onCloseGsi={() => setGsiModalOpen(false)}
        passwordModalOpen={passwordModalOpen}
        pendingRoomAuth={pendingRoomAuth}
        passwordError={passwordError}
        authErrorType={authErrorType}
        onClosePasswordModal={() => {
          setPasswordModalOpen(false);
          setPasswordError(null);
          setPendingRoomAuth(null);
        }}
        onSubmitRoomPassword={handleSubmitRoomPassword}
        leaderboardOpen={leaderboardOpen}
        onCloseLeaderboard={() => setLeaderboardOpen(false)}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        discordModalOpen={discordModalOpen}
        onCloseDiscordModal={() => setDiscordModalOpen(false)}
        matchCardOpen={matchCardOpen}
        onCloseMatchCard={() => setMatchCardOpen(false)}
        storyCardOpen={storyCardOpen}
        onCloseStoryCard={() => setStoryCardOpen(false)}
        onOpenStoryCard={() => setStoryCardOpen(true)}
        grenadeModalOpen={grenadeModalOpen}
        onCloseGrenadeModal={() => setGrenadeModalOpen(false)}
        aimReflexModalOpen={aimReflexModalOpen}
        onCloseAimReflexModal={() => setAimReflexModalOpen(false)}
        tournamentModalOpen={tournamentModalOpen}
        onCloseTournamentModal={() => setTournamentModalOpen(false)}
        localHostModalOpen={localHostModalOpen}
        onCloseLocalHostModal={() => setLocalHostModalOpen(false)}
        onSelectRoom={handleSelectRoom}
        onDeleteRoom={handleDeleteRoom}
        onRequireSteamLogin={handleRequireSteamLogin}
        onSaveScore={handleSaveScore}
        onStartQuickVeto={handleStartQuickVeto}
        onApplyQuickMap={handleApplyQuickMap}
        onSyncOfficialRotation={handleSyncOfficialRotation}
        onLogoutSteam={handleLogoutSteam}
        onSwitchSteamAccount={handleSwitchSteamAccount}
        onSaveProfile={handleSaveProfile}
        onSaveDiscordWebhook={handleSaveDiscordWebhook}
        onShareToChat={handleSendMessage}
        onLoadTournamentTeams={handleLoadTournamentTeams}
        onUpdateServerIp={handleUpdateServerIp}
      />
    </>
  );
}
