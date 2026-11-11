import type { Mood } from '../letter/model';
import { Backdrop, Veil } from './paint';
import { getPalette, resolvePalette } from './palettes';
import { lerp } from './rng';
import { createCalm } from './scenes/calm';
import { createCelebration } from './scenes/celebration';
import { createHope } from './scenes/hope';
import { createLonging } from './scenes/longing';
import type { PointerState, Scene, SceneConfig, SceneEnv, SceneFactory } from './types';

const FACTORIES: Record<Mood, SceneFactory> = {
  calm: createCalm,
  celebration: createCelebration,
  longing: createLonging,
  hope: createHope,
};

export const IDLE_POINTER: PointerState = { x: 0, y: 0, strength: 0 };

/** One complete picture: sky, the mood's scene, and the reading shade over both. */
export interface Composition {
  env: SceneEnv;
  backdrop: Backdrop;
  scene: Scene;
  veil: Veil;
  /** Seconds of backdrop time. */
  clock: number;
}

export interface Frame {
  width: number;
  height: number;
  pixelRatio: number;
  /** 0.45 … 1, see SceneEnv.density */
  density: number;
}

/** True when two configs differ in a way that needs a new composition rather than a live tweak. */
export function needsRebuild(a: SceneConfig, b: SceneConfig): boolean {
  return a.mood !== b.mood || a.palette !== b.palette || a.seed !== b.seed;
}

export function buildComposition(config: SceneConfig, frame: Frame): Composition {
  const colors = resolvePalette(getPalette(config.mood, config.palette));
  const env: SceneEnv = {
    width: frame.width,
    height: frame.height,
    pixelRatio: frame.pixelRatio,
    colors,
    seed: config.seed >>> 0,
    intensity: config.intensity / 100,
    motion: config.motion / 100,
    density: frame.density,
  };
  return {
    env,
    backdrop: new Backdrop(env),
    scene: FACTORIES[config.mood](env),
    veil: new Veil(colors.sky[0], frame.width, frame.height, frame.pixelRatio),
    clock: 0,
  };
}

export function setLevels(composition: Composition, config: SceneConfig): void {
  composition.env.intensity = config.intensity / 100;
  composition.env.motion = config.motion / 100;
  composition.backdrop.setIntensity(composition.env.intensity);
  composition.scene.setLevels(composition.env.intensity, composition.env.motion);
}

export function resizeComposition(composition: Composition, frame: Frame): void {
  composition.env.width = frame.width;
  composition.env.height = frame.height;
  composition.env.pixelRatio = frame.pixelRatio;
  composition.backdrop.resize(frame.width, frame.height, frame.pixelRatio);
  composition.veil.resize(frame.width, frame.height, frame.pixelRatio);
  composition.scene.resize(frame.width, frame.height, frame.pixelRatio);
}

export function advance(composition: Composition, dt: number, pointer: PointerState): void {
  composition.clock += dt * lerp(0.4, 1.4, composition.env.motion);
  composition.scene.update(dt, pointer);
}

/** Paints one frame. `ctx` must already be scaled so its units are CSS pixels. */
export function paint(ctx: CanvasRenderingContext2D, composition: Composition): void {
  composition.backdrop.render(ctx, composition.clock);
  composition.scene.render(ctx);
  composition.veil.render(ctx);
}

const STILL_STEP = 1 / 30;

/**
 * Runs the simulation, untouched by any pointer, to the moment the scene
 * considers its best still. Used for reduced motion and for image export; the
 * result depends only on the config and the frame size.
 */
export function settle(composition: Composition): void {
  const steps = Math.round(composition.scene.warmup / STILL_STEP);
  for (let i = 0; i < steps; i++) advance(composition, STILL_STEP, IDLE_POINTER);
}
