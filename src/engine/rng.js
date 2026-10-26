// RNG layer (spec B2). Production: crypto.getRandomValues. Test/simulation: seeded sfc32 (never player-selectable).

/** Production uint32 source backed by crypto.getRandomValues (buffered). */
export function cryptoUint32Source() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('crypto.getRandomValues unavailable');
  const buf = new Uint32Array(256);
  let i = buf.length;
  return function nextUint32() {
    if (i >= buf.length) {
      c.getRandomValues(buf);
      i = 0;
    }
    return buf[i++];
  };
}

/** splitmix32 - expands a 32-bit seed into well-mixed state words. */
function splitmix32(a) {
  return function () {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/** Seeded sfc32 uint32 source (TEST MODE ONLY). seed: non-negative integer < 2^32. */
export function seededUint32Source(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be a uint32');
  const sm = splitmix32(seed);
  let a = sm(), b = sm(), c = sm(), d = sm();
  const next = function nextUint32() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next(); // warm-up
  return next;
}

/**
 * Wrap a uint32 source in the RNG interface used by the engine.
 * randInt(n): draw x; reject while x >= floor(2^32/n)*n; return x mod n.
 */
export function makeRng(nextUint32) {
  function randInt(n) {
    if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new RangeError(`randInt: bad n ${n}`);
    const limit = Math.floor(0x100000000 / n) * n;
    let x = nextUint32();
    while (x >= limit) x = nextUint32();
    return x % n;
  }
  return { randInt, uint32: nextUint32 };
}

export function createCryptoRng() {
  return makeRng(cryptoUint32Source());
}

export function createSeededRng(seed) {
  return makeRng(seededUint32Source(seed));
}
