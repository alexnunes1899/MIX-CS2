import { useState, useEffect, useCallback } from 'react';
import { playClickSound } from '../utils/audio';

function resolveInitialView() {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  if (viewParam === 'servers') return 'servers';
  if (viewParam === 'updates') return 'updates';
  if (params.get('steam_auth') === '1' || !params.get('room')) {
    return 'landing';
  }
  return 'mix';
}

/**
 * Manages top-level view routing (?view=servers, ?view=updates, ?room=..., landing) and browser history sync.
 */
export function useNavigationView({ setRoomId, soundEnabled = true } = {}) {
  const [view, setView] = useState(resolveInitialView);

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const viewParam = p.get('view');
      if (viewParam === 'servers') {
        setView('servers');
      } else if (viewParam === 'updates') {
        setView('updates');
      } else if (p.get('room')) {
        if (setRoomId) setRoomId(p.get('room'));
        setView('mix');
      } else {
        setView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setRoomId]);

  const handleOpenServersPage = useCallback(
    (tab = null) => {
      if (soundEnabled) playClickSound();
      setView('servers');
      const u = new URL(window.location);
      u.searchParams.set('view', 'servers');
      if (typeof tab === 'string' && tab) {
        u.searchParams.set('tab', tab);
      }
      window.history.pushState({}, '', u);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [soundEnabled]
  );

  const handleOpenUpdatesPage = useCallback(() => {
    if (soundEnabled) playClickSound();
    setView('updates');
    const u = new URL(window.location);
    u.searchParams.set('view', 'updates');
    u.searchParams.delete('tab');
    window.history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [soundEnabled]);

  const handleGoHome = useCallback(() => {
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
  }, [soundEnabled]);

  return {
    view,
    setView,
    handleOpenServersPage,
    handleOpenUpdatesPage,
    handleGoHome,
  };
}
