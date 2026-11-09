/**
 * Copies text to the clipboard reliably.
 * navigator.clipboard only exists in secure contexts (HTTPS / localhost). When the site
 * is opened over a LAN IP (http://192.168.x.x) it is undefined, so we fall back to the
 * legacy textarea + execCommand('copy') technique.
 * @returns {Promise<boolean>} true when the copy succeeded
 */
export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (e) {
    // fall through to legacy method
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

/**
 * Builds the direct invite URL and the rich WhatsApp/Discord invite message
 * with the room name, active player count, and a call-to-action to join the Mix.
 */
export function buildRoomInviteData({
  roomId = 'MIX-PRO',
  roomName = '',
  isPrivate = false,
  inviteKey = '',
  rankingSystem = 'gc',
  playerCount = 0,
  maxSlots = 10,
} = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const url = new URL(origin);
  url.searchParams.set('room', roomId);
  if (isPrivate && inviteKey) {
    url.searchParams.set('key', inviteKey);
  }
  const displayTitle = roomName && roomName.trim() ? roomName.trim() : `Mix ${roomId}`;
  if (displayTitle && displayTitle !== roomId) {
    url.searchParams.set('name', displayTitle);
  }

  const rankLabel = rankingSystem === 'faceit' ? '⚡ FACEIT (1-10)' : '🛡️ Gamers Club (1-21)';
  const currentCount = Number(playerCount) || 0;
  const remaining = Math.max(0, maxSlots - currentCount);
  const spotsText =
    currentCount > 0
      ? remaining > 0
        ? `${currentCount}/${maxSlots} na sala (Faltam ${remaining} vagas!)`
        : `${currentCount}/${maxSlots} na sala (Lobby 10/10!)`
      : `Sala aberta para fechar o 5v5 (${maxSlots} vagas)`;

  const inviteUrl = url.toString();
  const inviteText = [
    `🔥 *CONVITE PARA O MIX CS2 — ${displayTitle.toUpperCase()}* 🔥`,
    `🎮 *Sala:* ${displayTitle} (\`#${roomId}\`) • ${rankLabel}`,
    `👥 *Jogadores:* ${spotsText}`,
    ``,
    `🚀 *Bora fechar o Mix! Clique no link abaixo para entrar direto na sala:*`,
    inviteUrl,
  ].join('\n');

  return {
    inviteUrl,
    inviteText,
    displayTitle,
  };
}
