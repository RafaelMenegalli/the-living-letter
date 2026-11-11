/**
 * Deterministic randomness. Every random decision a scene makes flows from the
 * letter's seed through these helpers, which is what lets a link rebuild the
 * same composition on another device.
 */
export type Rng = () => number;

/** mulberry32 — small, fast, and identical across JavaScript engines. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives an independent stream, so one part of a scene cannot shift another's numbers. */
export function forkSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Stateless hash to [0, 1): the n-th scheduled event of a scene is always the same. */
export function hashUnit(seed: number, n: number): number {
  return forkSeed(seed, n) / 4294967296;
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/**
 * Seeded 2D value noise in [-1, 1] with smooth interpolation — enough to steer
 * flow fields and slow wandering without pulling in a noise library.
 */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  const rng = createRng(seed);
  const values = new Float32Array(256);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) {
    values[i] = rng() * 2 - 1;
    perm[i] = i;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = perm[i];
    perm[i] = perm[j];
    perm[j] = swap;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const lattice = (x: number, y: number) => values[perm[perm[x & 255] + (y & 255)]];

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = lattice(x0, y0) + (lattice(x0 + 1, y0) - lattice(x0, y0)) * sx;
    const bottom = lattice(x0, y0 + 1) + (lattice(x0 + 1, y0 + 1) - lattice(x0, y0 + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}

export const TAU = Math.PI * 2;
export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smooth 0 → 1 ramp between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
