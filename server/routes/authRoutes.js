import {
  clearSessionCookie,
  getConfiguredAdminSteamIds,
  getSessionUser,
  setSessionCookie,
} from '../authSession.js';
import { getSteamPlayerDetails } from '../steamApi.js';
import { fetchFaceitPlayer } from '../faceit.js';
import { resolveSafeBaseUrl } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_PUBLIC_URL } from '../../shared/appConfig.js';

export function registerAuthRoutes(app) {
  app.get('/api/auth/me', (req, res) => {
    const user = getSessionUser(req);
    if (!user) {
      return res.json({ authenticated: false, user: null, isAdmin: false });
    }
    const adminIds = getConfiguredAdminSteamIds();
    return res.json({
      authenticated: true,
      user,
      isAdmin: adminIds.includes(user.steamId),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    return res.json({ success: true });
  });

  app.get('/api/steam/player-stats/:steamId', async (req, res) => {
    try {
      const details = await getSteamPlayerDetails(req.params.steamId);
      res.json(details);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/auth/steam', (req, res) => {
    const baseUrl = resolveSafeBaseUrl(req, DEFAULT_PUBLIC_URL);
    const returnTo = `${baseUrl}/api/auth/steam/return`;
    const realm = `${baseUrl}/`;

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
  });

  app.get('/api/auth/steam/return', async (req, res) => {
    try {
      const claimedId = req.query['openid.claimed_id'];
      const steamIdMatch = claimedId && String(claimedId).match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);

      if (!steamIdMatch) {
        return res.redirect('/?steam_error=invalid_id');
      }

      const steamId = steamIdMatch[1];

      const validateParams = new URLSearchParams();
      for (const [key, val] of Object.entries(req.query)) {
        validateParams.append(key, val);
      }
      validateParams.set('openid.mode', 'check_authentication');

      const authRes = await fetch('https://steamcommunity.com/openid/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: validateParams.toString(),
      });

      const authText = await authRes.text();
      if (!authText.includes('is_valid:true')) {
        return res.redirect('/?steam_error=auth_failed');
      }

      let nick = `Player_${steamId.slice(-4)}`;
      let avatar = '';

      try {
        const profileRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
        if (profileRes.ok) {
          const xml = await profileRes.text();
          const nickMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
          const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || xml.match(/<avatarFull>(.*?)<\/avatarFull>/);
          if (nickMatch) nick = nickMatch[1];
          if (avatarMatch) avatar = avatarMatch[1];
        }
      } catch (e) {
        console.error('Error fetching steam XML profile:', e);
      }

      let faceitLevel = 5;
      let faceitElo = 1200;
      let faceitFound = 0;
      const faceitResult = await fetchFaceitPlayer({ steamId, nickname: nick });
      if (faceitResult && faceitResult.found) {
        faceitLevel = faceitResult.level;
        faceitElo = faceitResult.elo;
        faceitFound = 1;
      }

      let cs2Hours = '';
      try {
        const steamDetails = await getSteamPlayerDetails(steamId);
        if (steamDetails && steamDetails.cs2Hours) {
          cs2Hours = steamDetails.cs2Hours;
        }
      } catch (e) {
        logger.debug('STEAM_AUTH', 'Falha opcional ao buscar horas CS2 no login Steam', e);
      }

      // Mint signed HttpOnly session cookie verified by Express & Socket.IO
      setSessionCookie(req, res, {
        steamId,
        nick,
        avatar,
        faceitLevel,
        faceitElo,
        faceitFound: Boolean(faceitFound),
        cs2Hours,
      });

      return res.redirect('/?steam_auth=1');
    } catch (err) {
      console.error('Steam Auth Error:', err);
      return res.redirect('/?steam_error=server_error');
    }
  });

  app.get('/api/faceit/:steamId', async (req, res) => {
    const { steamId } = req.params;
    const nickname = req.query.nickname || '';
    try {
      const faceitResult = await fetchFaceitPlayer({ steamId, nickname });
      if (faceitResult && faceitResult.found) {
        return res.json({
          success: true,
          found: true,
          nickname: faceitResult.nickname,
          level: faceitResult.level,
          elo: faceitResult.elo,
        });
      }
      return res.json({
        success: true,
        found: false,
        message: 'Conta FACEIT não vinculada a este jogador.',
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}
