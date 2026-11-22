// Colors for the little people on the village map
export const SKIN = ['#f1d3b8', '#e0b48f', '#c48d64', '#8d5f3e', '#5f3f2a'];
export const HAIR = ['#2e2420', '#5a3b28', '#a86b3c', '#d6b56f', '#1d1b1a', '#8a8580'];
export const SHIRT = ['#d9574a', '#4f6f9a', '#6f9a6a', '#e0a33b', '#9a6fb0', '#2f8f8f', '#e07a95'];
export const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const pick = (list, v, fallback) => list[Number.isInteger(v) && v >= 0 && v < list.length ? v : fallback % list.length];

// The look a person has now: their picks, or the one their id gives them
export function lookFor(seed, look = {}) {
  const h = hash(seed);
  return {
    skin: pick(SKIN, look.skin, h),
    hair: pick(HAIR, look.hair, h >> 3),
    shirt: pick(SHIRT, look.shirt, h >> 6),
    long: typeof look.long === 'boolean' ? look.long : (h >> 9) % 2 === 0,
  };
}

