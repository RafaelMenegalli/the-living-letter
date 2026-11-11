import type { Mood } from '../letter/model';
import type { PaletteColors } from './palettes';

/** The part of a letter the visual engine cares about. */
export interface SceneConfig {
  mood: Mood;
  palette: number;
  /** 0 … 100 */
  intensity: number;
  /** 0 … 100 */
  motion: number;
  seed: number;
}

/** Everything a scene needs to lay itself out. All sizes are in CSS pixels. */
export interface SceneEnv {
  width: number;
  height: number;
  /** Backing-store pixels per CSS pixel, for scenes that keep their own layers. */
  pixelRatio: number;
  colors: PaletteColors;
  seed: number;
  /** 0 … 1 */
  intensity: number;
  /** 0 … 1 */
  motion: number;
  /** 0.45 … 1 — how much this device can comfortably draw. */
  density: number;
}

export interface PointerState {
  x: number;
  y: number;
  /** Eased presence, 0 (absent) … 1 (actively moving). */
  strength: number;
}

export interface Scene {
  /** Seconds of simulated time after which the scene makes a well-composed still. */
  readonly warmup: number;
  /** Advances the simulation. Scenes that accumulate trails paint them here. */
  update(dt: number, pointer: PointerState): void;
  /** Paints the scene's own layers over the backdrop. */
  render(ctx: CanvasRenderingContext2D): void;
  /** A deliberate tap or click. */
  pulse(x: number, y: number): void;
  /** Live adjustment that must not disturb the composition. */
  setLevels(intensity: number, motion: number): void;
  resize(width: number, height: number, pixelRatio: number): void;
}

export type SceneFactory = (env: SceneEnv) => Scene;
