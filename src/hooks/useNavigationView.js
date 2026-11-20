import { useState, useEffect, useCallback } from 'react';
import { playClickSound } from '../utils/audio';

function resolveViewFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const path = String(window.location.pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  const viewParam = params.get('view');

  if (params.get('room') && params.get('steam_auth') !== '1') return 'mix';

  if (path === '/servidores' || viewParam === 'servers') return 'servers';
  if (path === '/atualizacoes' || viewParam === 'updates') return 'updates';
  if (path === '/ranking' || viewParam === 'ranking') return 'ranking';
  if (path === '/granadas' || viewParam === 'grenades' || params.get('treino') === '1') return 'grenades';
  if (path === '/torneio' || viewParam === 'tournament') return 'tournament';

  if (params.get('steam_auth') === '1' || !params.get('room')) {
    return 'landing';
  }
  return 'mix';
}

/**
 * Manages top-level view routing (/servidores, /atualizacoes, /ranking, /granadas, /torneio, ?room=..., landing)
 * with backwards compatibility for ?view=... and browser history sync.
 */
export function useNavigationView({ setRoomId, soundEnabled = true } = {}) {
  const [view, setView] = useState(resolveViewFromLocation);

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const next = resolveViewFromLocation();
      if (next === 'mix' && setRoomId && p.get('room')) {
        setRoomId(p.get('room'));
      }
      setView(next);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setRoomId]);

  const navigateCleanPath = useCallback((pathname, updateSearchParams) => {
    const u = new URL(window.location);
    u.pathname = pathname;
    u.searchParams.delete('view');
    u.searchParams.delete('tab');
    u.searchParams.delete('code');
    u.searchParams.delete('room');
    u.searchParams.delete('pwd');
    u.searchParams.delete('key');
    u.searchParams.delete('treino');
    if (typeof updateSearchParams === 'function') {
      updateSearchParams(u.searchParams);
    }
    window.history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenServersPage = useCallback(
    (tab = null) => {
      if (soundEnabled) playClickSound();
      setView('servers');
      navigateCleanPath('/servidores', (sp) => {
        if (typeof tab === 'string' && tab) sp.set('tab', tab);
      });
    },
    [soundEnabled, navigateCleanPath]
  );

  const handleOpenUpdatesPage = useCallback(() => {
    if (soundEnabled) playClickSound();
    setView('updates');
    navigateCleanPath('/atualizacoes');
  }, [soundEnabled, navigateCleanPath]);

  const handleOpenLeaderboardPage = useCallback(() => {
    if (soundEnabled) playClickSound();
    setView('ranking');
    navigateCleanPath('/ranking');
  }, [soundEnabled, navigateCleanPath]);

  const handleOpenGrenadesPage = useCallback(
    (tab = null) => {
      if (soundEnabled) playClickSound();
      setView('grenades');
      navigateCleanPath('/granadas', (sp) => {
        if (typeof tab === 'string' && tab) sp.set('tab', tab);
      });
    },
    [soundEnabled, navigateCleanPath]
  );

  const handleOpenTournamentPage = useCallback(
    (code = null) => {
      if (soundEnabled) playClickSound();
      setView('tournament');
      navigateCleanPath('/torneio', (sp) => {
        if (typeof code === 'string' && code.trim()) sp.set('code', code.trim().toUpperCase());
      });
    },
    [soundEnabled, navigateCleanPath]
  );

  const handleGoHome = useCallback(() => {
    if (soundEnabled) playClickSound();
    setView('landing');
    const u = new URL(window.location);
    u.pathname = '/';
    u.searchParams.delete('view');
    u.searchParams.delete('tab');
    u.searchParams.delete('code');
    u.searchParams.delete('room');
    u.searchParams.delete('pwd');
    u.searchParams.delete('key');
    u.searchParams.delete('treino');
    window.history.pushState({}, '', u);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [soundEnabled]);

  return {
    view,
    setView,
    handleOpenServersPage,
    handleOpenUpdatesPage,
    handleOpenLeaderboardPage,
    handleOpenGrenadesPage,
    handleOpenTournamentPage,
    handleGoHome,
  };
}
