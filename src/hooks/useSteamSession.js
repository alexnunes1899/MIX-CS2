import { useState, useEffect, useCallback } from 'react';

function createFreshProfile() {
  return {
    id: `player-${Math.random().toString(36).substring(2, 9)}`,
    nick: '',
    level: 14,
    faceitLevel: 5,
    faceitElo: 1200,
    side: 'ANY',
    avatar: '🎯',
    cs2Hours: null,
    steamId: null,
  };
}

function loadInitialProfile() {
  let base = createFreshProfile();
  try {
    const saved = localStorage.getItem('cs2_mix_profile');
    if (saved) base = { ...base, ...JSON.parse(saved) };
  } catch {}

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
        } catch {}
      }

      if (import.meta.env.DEV && params.get('mock_user') === '1') {
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
        } catch {}
      }
    } catch {}
  }

  return base;
}

export function savePendingInvite(room, key = '') {
  if (!room) return;
  try {
    const payload = JSON.stringify({
      room: String(room).trim().toUpperCase(),
      key: String(key || '').trim(),
    });
    sessionStorage.setItem('cs2_pending_invite', payload);
    localStorage.setItem('cs2_pending_invite', payload);
  } catch {}
}

export function consumePendingInvite() {
  try {
    const raw =
      sessionStorage.getItem('cs2_pending_invite') ||
      localStorage.getItem('cs2_pending_invite');
    sessionStorage.removeItem('cs2_pending_invite');
    localStorage.removeItem('cs2_pending_invite');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.room ? parsed : null;
  } catch {
    return null;
  }
}

const POST_AUTH_ACTION_KEY = 'cs2_post_auth_action';

export function savePostAuthAction(action) {
  if (!action || typeof action !== 'object') return;
  try {
    const payload = JSON.stringify(action);
    sessionStorage.setItem(POST_AUTH_ACTION_KEY, payload);
    localStorage.setItem(POST_AUTH_ACTION_KEY, payload);
  } catch {}
}

export function consumePostAuthAction() {
  try {
    const raw =
      sessionStorage.getItem(POST_AUTH_ACTION_KEY) ||
      localStorage.getItem(POST_AUTH_ACTION_KEY);
    sessionStorage.removeItem(POST_AUTH_ACTION_KEY);
    localStorage.removeItem(POST_AUTH_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function useSteamSession({ onRestorePendingInvite, onPostAuthAction } = {}) {
  const [myProfile, setMyProfile] = useState(loadInitialProfile);
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('checking');

  // Clean Steam OpenID callback params, hydrate HttpOnly session, and restore pending invite if any
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const isSteamAuthReturn = params.get('steam_auth') === '1';

    const finalizeAuthRedirect = () => {
      if (!isSteamAuthReturn) return;
      const cleanUrl = new URL(window.location);
      [
        'steam_auth',
        'room',
        'steamId',
        'nick',
        'avatar',
        'faceitLevel',
        'faceitElo',
        'faceitFound',
        'cs2Hours',
      ].forEach((k) => cleanUrl.searchParams.delete(k));

      const pending = consumePendingInvite();
      if (pending && onRestorePendingInvite) {
        onRestorePendingInvite(pending, cleanUrl);
      } else {
        window.history.replaceState({}, '', cleanUrl.pathname || '/');
      }

      const postAction = consumePostAuthAction();
      if (postAction && onPostAuthAction) {
        onPostAuthAction(postAction);
      }
    };

    const legacyNick = params.get('nick');
    if (isSteamAuthReturn && legacyNick) {
      const steamId = params.get('steamId');
      const steamAvatar = params.get('avatar');
      const faceitLevel = params.get('faceitLevel');
      const faceitElo = params.get('faceitElo');
      const faceitFound = params.get('faceitFound') === '1';
      const steamCs2Hours = params.get('cs2Hours');
      setMyProfile((prev) => {
        const updated = {
          ...prev,
          nick: legacyNick,
          avatar: steamAvatar || prev.avatar,
          steamId: steamId || null,
          cs2Hours: steamCs2Hours && !isNaN(Number(steamCs2Hours)) ? Number(steamCs2Hours) : (prev.cs2Hours || null),
          faceitLevel: faceitFound && faceitLevel ? Number(faceitLevel) : (prev.faceitLevel || 5),
          faceitElo: faceitFound && faceitElo && faceitElo !== 'null' ? Number(faceitElo) : (prev.faceitElo || 1200),
        };
        try {
          localStorage.setItem('cs2_mix_profile', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      finalizeAuthRedirect();
    }

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data) {
          const isAuthed = Boolean(data.authenticated && data.user?.steamId);
          setSessionStatus(isAuthed ? 'authenticated' : 'unauthenticated');
          setIsSiteAdmin(Boolean(data.isAdmin));
          if (isAuthed) {
            setMyProfile((prev) => {
              const merged = {
                ...prev,
                steamId: data.user.steamId,
                nick: data.user.nick || prev.nick,
                avatar: data.user.avatar || prev.avatar,
                cs2Hours: data.user.cs2Hours ?? prev.cs2Hours,
                faceitLevel: data.user.faceitLevel || prev.faceitLevel,
                faceitElo: data.user.faceitElo ?? prev.faceitElo,
              };
              try {
                localStorage.setItem('cs2_mix_profile', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        }
        if (!legacyNick) {
          finalizeAuthRedirect();
        }
      })
      .catch(() => {
        if (active && !legacyNick) finalizeAuthRedirect();
      });

    return () => {
      active = false;
    };
  }, []);

  const clearSessionProfile = useCallback(() => {
    try {
      localStorage.removeItem('cs2_mix_profile');
    } catch {}
    setIsSiteAdmin(false);
    setSessionStatus('unauthenticated');
    setMyProfile(createFreshProfile());
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  }, []);

  return {
    myProfile,
    setMyProfile,
    isSteamLogged: Boolean(myProfile?.steamId),
    isServerSessionActive: sessionStatus === 'authenticated',
    isSessionExpired: Boolean(myProfile?.steamId) && sessionStatus === 'unauthenticated',
    isSiteAdmin,
    clearSessionProfile,
  };
}
