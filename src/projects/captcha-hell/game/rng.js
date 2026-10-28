/** Seedable 32-bit generator. Same seed => same sequence. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a list of finite numbers. Non-numbers contribute as zero. */
export function hashSeed(values) {
  let hash = 2166136261;
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    const text = String(Math.round(number * 1000));
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0xff;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
