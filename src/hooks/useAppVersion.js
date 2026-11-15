import { useState, useEffect } from 'react';

export function useAppVersion(socket) {
  const [, setServerVersion] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const handleApplyUpdate = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) reg.unregister();
        });
      }
    } catch {}
    window.location.reload();
  };

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
      } catch {}
    };

    checkVersion();
    const handleFocus = () => checkVersion();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(checkVersion, 10000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handleSocketVersion = ({ version }) => {
      if (!version) return;
      setServerVersion((prev) => {
        if (prev && prev !== version) {
          setUpdateAvailable(true);
        }
        return version;
      });
    };

    socket.on('server_app_version', handleSocketVersion);
    return () => {
      socket.off('server_app_version', handleSocketVersion);
    };
  }, [socket]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5') {
        try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
              for (const r of regs) r.unregister();
            });
          }
        } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    updateAvailable,
    handleApplyUpdate,
  };
}
