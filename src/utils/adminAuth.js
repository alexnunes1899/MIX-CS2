/**
 * Builds request headers including any stored site admin API key (`x-admin-key`).
 */
export function getAdminAuthHeaders(extra = {}, explicitKey = null) {
  let key = '';
  if (typeof explicitKey === 'string') {
    key = explicitKey.trim();
  } else if (typeof window !== 'undefined') {
    try {
      key = String(localStorage.getItem('cs2_admin_api_key') || '').trim();
    } catch {
      key = '';
    }
  }
  return {
    ...extra,
    ...(key ? { 'x-admin-key': key } : {}),
  };
}
