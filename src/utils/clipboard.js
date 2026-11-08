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
