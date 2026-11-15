const listeners = new Set();
let nextToastId = 1;

/**
 * Emits a lightweight UI toast notification across the app.
 * Safe in SSR/Node test environments without window/DOM.
 */
export function showToast({ title, description = '', type = 'success', duration = 2600 } = {}) {
  if (!title || typeof window === 'undefined') return null;
  const id = nextToastId++;
  const payload = { id, title: String(title), description: String(description || ''), type, duration };
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch {
      // ignore listener error
    }
  }
  return id;
}

export function subscribeToasts(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
