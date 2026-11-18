import { useState, useEffect, useRef, useCallback } from 'react';

const NOTIF_STORAGE_KEY = 'cs2mixhub_browser_notifications';

/**
 * Manages PWA installability prompt (`beforeinstallprompt`) and opt-in browser notifications
 * for nearly full lobbies (8-9/10) and newly released CS2 updates.
 */
export function usePwaNotifications({ publicRooms = [], onEnterRoom } = {}) {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted' &&
        window.localStorage.getItem(NOTIF_STORAGE_KEY) === '1'
      );
    } catch {
      return false;
    }
  });

  const notifiedRoomKeysRef = useRef(new Set());
  const notifiedUpdateGidsRef = useRef(new Set());

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstallPwa = useCallback(async () => {
    if (!installPromptEvent) return false;
    try {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstallPromptEvent(null);
        return true;
      }
    } catch {}
    return false;
  }, [installPromptEvent]);

  const toggleNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      try {
        window.localStorage.setItem(NOTIF_STORAGE_KEY, '0');
      } catch {}
      return false;
    }

    let perm = window.Notification.permission;
    if (perm === 'default') {
      perm = await window.Notification.requestPermission();
    }
    if (perm === 'granted') {
      setNotificationsEnabled(true);
      try {
        window.localStorage.setItem(NOTIF_STORAGE_KEY, '1');
      } catch {}
      try {
        new window.Notification('🔔 CS2 Mix Hub • Alertas Ativados!', {
          body: 'Você será avisado quando uma sala estiver quase fechando (8-9/10) ou sair atualização no CS2.',
          icon: '/favicon-192x192.png',
        });
      } catch {}
      return true;
    }
    return false;
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!notificationsEnabled || !Array.isArray(publicRooms)) return;
    if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') return;

    for (const r of publicRooms) {
      if (!r || !r.id) continue;
      const count = Number(r.playerCount || 0);
      if (count !== 8 && count !== 9) continue;
      const key = `${r.id}:${count}`;
      if (notifiedRoomKeysRef.current.has(key)) continue;
      notifiedRoomKeysRef.current.add(key);

      try {
        const missing = 10 - count;
        const n = new window.Notification(`🔥 Mix quase fechando! ${r.name || r.id} (${count}/10)`, {
          body: `Falta(m) ${missing} vaga(s) para começar o 5v5! Clique para entrar.`,
          icon: '/favicon-192x192.png',
        });
        n.onclick = () => {
          window.focus();
          if (typeof onEnterRoom === 'function') onEnterRoom(r.id);
        };
      } catch {}
    }
  }, [publicRooms, notificationsEnabled, onEnterRoom]);

  const notifyCs2Update = useCallback(
    (patch) => {
      if (!notificationsEnabled || !patch?.gid) return;
      if (notifiedUpdateGidsRef.current.has(String(patch.gid))) return;
      if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') return;
      notifiedUpdateGidsRef.current.add(String(patch.gid));
      try {
        const n = new window.Notification('📰 Nova Atualização do CS2 (PT-BR)', {
          body: patch.title || 'Notas oficiais da Valve disponíveis no CS2 Mix Hub.',
          icon: '/favicon-192x192.png',
        });
        n.onclick = () => {
          window.focus();
        };
      } catch {}
    },
    [notificationsEnabled]
  );

  return {
    canInstallPwa: Boolean(installPromptEvent),
    promptInstallPwa,
    notificationsEnabled,
    toggleNotifications,
    notifyCs2Update,
  };
}
