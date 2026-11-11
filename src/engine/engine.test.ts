import { beforeAll, describe, expect, it } from 'vitest';
import { MOODS, PALETTES_PER_MOOD, type Mood } from '../letter/model';
import { contrastRatio, hexToRgb } from './color';
import { IDLE_POINTER, advance, buildComposition, needsRebuild, paint, resizeComposition, setLevels, settle, type Frame } from './compose';
import { PALETTES, getPalette } from './palettes';
import { createNoise2D, createRng, forkSeed, hashUnit } from './rng';
import { installFakeCanvas, type DrawLog } from './testing/fakeCanvas';
import type { SceneConfig } from './types';

const PHONE: Frame = { width: 390, height: 844, pixelRatio: 2, density: 0.72 };
const DESKTOP: Frame = { width: 1440, height: 900, pixelRatio: 1, density: 1 };

const config = (mood: Mood, overrides: Partial<SceneConfig> = {}): SceneConfig => ({
  mood,
  palette: 0,
  intensity: 60,
  motion: 50,
  seed: 20240611,
  ...overrides,
});

describe('seeded randomness', () => {
  it('repeats exactly for the same seed and differs for another', () => {
    const draw = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 64 }, () => rng());
    };
    expect(draw(42)).toEqual(draw(42));
    expect(draw(42)).not.toEqual(draw(43));
    for (const value of draw(0xffffffff)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('forks independent, stable streams', () => {
    expect(forkSeed(7, 1)).toBe(forkSeed(7, 1));
    expect(forkSeed(7, 1)).not.toBe(forkSeed(7, 2));
    expect(hashUnit(7, 3)).toBe(hashUnit(7, 3));
    expect(hashUnit(7, 3)).toBeLessThan(1);
  });

  it('makes smooth, bounded, repeatable noise', () => {
    const noise = createNoise2D(99);
    const again = createNoise2D(99);
    for (let i = 0; i < 200; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      const value = noise(x, y);
      expect(value).toBe(again(x, y));
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
      expect(Math.abs(value - noise(x + 0.001, y))).toBeLessThan(0.02);
    }
  });
});

describe('palettes', () => {
  it('gives every atmosphere the same number of complete palettes', () => {
    const hex = /^#[0-9a-f]{6}$/;
    const ids = new Set<string>();
    for (const mood of MOODS) {
      expect(PALETTES[mood]).toHaveLength(PALETTES_PER_MOOD);
      for (const palette of PALETTES[mood]) {
        ids.add(palette.id);
        for (const color of [...palette.sky, ...palette.haze, ...palette.lights, palette.ink, palette.accent]) {
          expect(color).toMatch(hex);
        }
        expect(palette.haze.length).toBeGreaterThanOrEqual(2);
        expect(palette.lights.length).toBeGreaterThanOrEqual(4);
      }
    }
    expect(ids.size).toBe(MOODS.length * PALETTES_PER_MOOD);
  });

  it('keeps the message readable: ink against every part of the sky is at least 7:1', () => {
    for (const mood of MOODS) {
      for (const palette of PALETTES[mood]) {
        for (const sky of palette.sky) {
          expect(contrastRatio(hexToRgb(palette.ink), hexToRgb(sky)), `${palette.id} ink on ${sky}`).toBeGreaterThanOrEqual(7);
        }
      }
    }
  });

  it('keeps accent buttons readable with dark text', () => {
    for (const mood of MOODS) {
      for (const palette of PALETTES[mood]) {
        expect(contrastRatio(hexToRgb(palette.accent), hexToRgb('#14110d')), palette.id).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('falls back to the first palette for an index it does not have', () => {
    expect(getPalette('calm', 99)).toBe(PALETTES.calm[0]);
    expect(getPalette('calm', -1)).toBe(PALETTES.calm[0]);
    expect(getPalette('calm', 1.5)).toBe(PALETTES.calm[0]);
  });
});

describe('compositions', () => {
  let log: DrawLog;

  const paintInto = (composition: ReturnType<typeof buildComposition>) => {
    const context = (document.createElement('canvas') as HTMLCanvasElement).getContext('2d');
    paint(context as CanvasRenderingContext2D, composition);
  };

  /** Builds a scene, runs it to its settled moment, paints it, and digests everything that was drawn. */
  const picture = (sceneConfig: SceneConfig, frame: Frame) => {
    const composition = buildComposition(sceneConfig, frame);
    settle(composition);
    log.reset();
    paintInto(composition);
    return { hash: log.hash, operations: log.count };
  };

  beforeAll(() => {
    log = installFakeCanvas();
    // Light sprites are cached per colour; draw everything once so later runs start from the same cache.
    for (const mood of MOODS) {
      for (let palette = 0; palette < PALETTES_PER_MOOD; palette++) picture(config(mood, { palette }), PHONE);
    }
  });

  it('renders every atmosphere and palette, on phone and desktop, without error', () => {
    for (const mood of MOODS) {
      for (let palette = 0; palette < PALETTES_PER_MOOD; palette++) {
        for (const frame of [PHONE, DESKTOP]) {
          expect(picture(config(mood, { palette }), frame).operations, mood + '/' + palette).toBeGreaterThan(100);
        }
      }
    }
  });

  it('rebuilds the same picture from the same seed, on every atmosphere', () => {
    for (const mood of MOODS) {
      for (const frame of [PHONE, DESKTOP]) {
        expect(picture(config(mood), frame), mood).toEqual(picture(config(mood), frame));
      }
    }
  });

  it('draws a different picture for a different seed, palette or size', () => {
    for (const mood of MOODS) {
      const base = picture(config(mood, { seed: 1 }), PHONE).hash;
      expect(picture(config(mood, { seed: 2 }), PHONE).hash, mood + ' seed').not.toBe(base);
      expect(picture(config(mood, { seed: 1, palette: 1 }), PHONE).hash, mood + ' palette').not.toBe(base);
      expect(picture(config(mood, { seed: 1 }), DESKTOP).hash, mood + ' size').not.toBe(base);
    }
  });

  it('survives resizing, live level changes, taps and extreme settings', () => {
    for (const mood of MOODS) {
      for (const [intensity, motion] of [[0, 0], [100, 100], [0, 100], [100, 0]]) {
        const sceneConfig = config(mood, { intensity, motion, seed: 0xffffffff });
        const composition = buildComposition(sceneConfig, PHONE);
        for (let step = 0; step < 90; step++) {
          advance(composition, 1 / 60, { x: 100 + step, y: 300, strength: 1 });
          if (step % 30 === 0) composition.scene.pulse(120, 240);
        }
        resizeComposition(composition, DESKTOP);
        setLevels(composition, { ...sceneConfig, intensity: 50, motion: 50 });
        advance(composition, 0.05, IDLE_POINTER);
        log.reset();
        paintInto(composition);
        expect(log.count, mood).toBeGreaterThan(50);
      }
    }
  });

  it('knows which changes need a new composition', () => {
    const base = config('calm');
    expect(needsRebuild(base, { ...base })).toBe(false);
    expect(needsRebuild(base, { ...base, intensity: 5, motion: 95 })).toBe(false);
    expect(needsRebuild(base, { ...base, mood: 'hope' })).toBe(true);
    expect(needsRebuild(base, { ...base, palette: 1 })).toBe(true);
    expect(needsRebuild(base, { ...base, seed: base.seed + 1 })).toBe(true);
  });
});
