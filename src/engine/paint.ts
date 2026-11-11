import { luminance, rgba, type RGB } from './color';
import { TAU, between, createRng, forkSeed } from './rng';
import type { SceneEnv } from './types';

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** An offscreen canvas whose drawing units are CSS pixels. Throws if 2D canvas is unavailable. */
export function createLayer(width: number, height: number, pixelRatio: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { canvas, ctx };
}

const SPRITE_SIZE = 64;
const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * A soft round light, pre-rendered once per colour. Drawing these additively
 * is far cheaper than per-particle gradients or canvas shadows.
 * `hot` gives the light a white core, like something actually burning.
 */
export function glowSprite(color: RGB, hot = false): HTMLCanvasElement {
  const key = `${color.join(',')}:${hot ? 1 : 0}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = createLayer(SPRITE_SIZE, SPRITE_SIZE, 1);
  const half = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  if (hot) {
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.12, rgba(color, 0.95));
  } else {
    gradient.addColorStop(0, rgba(color, 1));
  }
  gradient.addColorStop(0.3, rgba(color, 0.42));
  gradient.addColorStop(0.62, rgba(color, 0.1));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  spriteCache.set(key, canvas);
  return canvas;
}

/** Draws a glow sprite centred on (x, y). Caller sets compositing; alpha is restored by the caller's save/restore. */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.003 || radius <= 0) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
}

interface HazeBlob {
  color: RGB;
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  phase: number;
  speed: number;
  alpha: number;
}

/**
 * The sky moves so slowly that repainting it on every frame is wasted work.
 * (It is painted at full resolution on purpose: browsers dither gradients, and
 * a small layer stretched up magnifies that dither into a visible lattice.)
 */
const BACKDROP_REFRESH = 2;

/**
 * The sky: a vertical gradient with a few very large, very slow lights
 * breathing behind it. Kept in its own layer and refreshed every other frame.
 */
export class Backdrop {
  private layer: Layer;
  private blobs: HazeBlob[] = [];
  private width = 0;
  private height = 0;
  private frame = 0;

  constructor(private env: SceneEnv) {
    this.layer = createLayer(1, 1, 1);
    const rng = createRng(forkSeed(env.seed, 101));
    for (const color of env.colors.haze) {
      for (let i = 0; i < 2; i++) {
        this.blobs.push({
          color,
          x: between(rng, 0.05, 0.95),
          y: between(rng, 0.05, 0.95),
          radius: between(rng, 0.34, 0.66),
          driftX: between(rng, 0.03, 0.09),
          driftY: between(rng, 0.02, 0.07),
          phase: rng() * TAU,
          speed: between(rng, 0.04, 0.1),
          // Pale colours are held back, so no palette can wash the night out from under the words.
          alpha: between(rng, 0.2, 0.38) * (1 - 0.5 * luminance(color)),
        });
      }
    }
    this.resize(env.width, env.height, env.pixelRatio);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.layer = createLayer(width, height, pixelRatio);
    this.frame = 0;
  }

  setIntensity(intensity: number): void {
    this.env = { ...this.env, intensity };
  }

  render(target: CanvasRenderingContext2D, time: number): void {
    if (this.frame++ % BACKDROP_REFRESH === 0) this.repaint(time);
    target.globalCompositeOperation = 'source-over';
    target.globalAlpha = 1;
    target.drawImage(this.layer.canvas, 0, 0, this.width, this.height);
  }

  private repaint(time: number): void {
    const { ctx } = this.layer;
    const { width, height } = this;
    const sky = this.env.colors.sky;

    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, rgba(sky[0], 1));
    gradient.addColorStop(0.55, rgba(sky[1], 1));
    gradient.addColorStop(1, rgba(sky[2], 1));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'screen';
    const reach = Math.max(width, height);
    const glow = 0.55 + this.env.intensity * 0.6;
    for (const blob of this.blobs) {
      const t = time * blob.speed + blob.phase;
      const x = (blob.x + Math.sin(t) * blob.driftX) * width;
      const y = (blob.y + Math.cos(t * 0.8) * blob.driftY) * height;
      const radius = blob.radius * reach * (0.92 + 0.08 * Math.sin(t * 1.7));
      const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, rgba(blob.color, blob.alpha * glow));
      light.addColorStop(0.5, rgba(blob.color, blob.alpha * glow * 0.32));
      light.addColorStop(1, rgba(blob.color, 0));
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, width, height);
    }
  }
}

/**
 * Darkens the edges of the frame and lays a soft shade behind the centre,
 * where the message sits, so the words always win against the art.
 * Rendered once per size and stamped on every frame.
 */
export class Veil {
  private layer: Layer;
  private width = 0;
  private height = 0;

  constructor(private shade: RGB, width: number, height: number, pixelRatio: number) {
    this.layer = createLayer(1, 1, 1);
    this.resize(width, height, pixelRatio);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.layer = createLayer(width, height, pixelRatio);
    const { ctx } = this.layer;
    const cx = width / 2;
    const cy = height / 2;

    // Vignette
    const corner = Math.hypot(cx, cy);
    const vignette = ctx.createRadialGradient(cx, cy, corner * 0.45, cx, cy, corner);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Reading shade: an ellipse sized to the text column.
    const rx = Math.min(width * 0.52, 560);
    const ry = Math.min(height * 0.34, 300);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const shadeGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    shadeGradient.addColorStop(0, rgba(this.shade, 0.66));
    shadeGradient.addColorStop(0.55, rgba(this.shade, 0.4));
    shadeGradient.addColorStop(1, rgba(this.shade, 0));
    ctx.fillStyle = shadeGradient;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  render(target: CanvasRenderingContext2D): void {
    target.globalCompositeOperation = 'source-over';
    target.globalAlpha = 1;
    target.drawImage(this.layer.canvas, 0, 0, this.width, this.height);
  }
}
