/**
 * Cryptographically uniform random integer in [0, max) using Fisher-Yates safe entropy.
 */
export function getSecureRandomInt(max) {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let rand = 0;
    do {
      cryptoObj.getRandomValues(arr);
      rand = arr[0];
    } while (rand >= limit);
    return rand % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Unbiased Fisher-Yates shuffle returning a new array.
 */
export function cryptoShuffle(items = []) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
