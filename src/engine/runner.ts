import { advance, buildComposition, needsRebuild, paint, resizeComposition, setLevels, settle, type Composition } from './compose';
import type { PointerState, SceneConfig } from './types';

/** Backing-store budget. Beyond this a canvas costs fill-rate without looking better. */
const MAX_PIXELS = 3_600_000;
const MAX_PIXEL_RATIO = 2;
const MIN_RESOLUTION = 0.5;
/** Clicks on controls that sit over the scene must not set off the scene. */
const CONTROLS = 'a, button, input, textarea, select, label, summary, [role="radio"], [data-quiet]';

export interface RunnerOptions {
  /** Paint one composed frame instead of animating (reduced motion). */
  still: boolean;
  /** React to pointer and touch. */
  interactive: boolean;
  /** Element that receives pointer events; defaults to the canvas. */
  pointerTarget?: HTMLElement | null;
  /** Called once if the scene cannot be drawn, so the UI can show its fallback. */
  onFail: () => void;
}

/** How much this device can comfortably draw, from coarse hardware hints. */
export function detectDensity(): number {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  let density = 1;
  if (Math.min(window.innerWidth, window.innerHeight) < 520) density = 0.72;
  if (cores <= 4) density = Math.min(density, 0.62);
  if (memory <= 2) density = Math.min(density, 0.5);
  return density;
}

/**
 * Owns one canvas: sizes it, runs the animation loop, feeds pointer input to
 * the scene, pauses when nobody can see it, and lowers its own resolution if
 * the device cannot keep up.
 */
export class SceneRunner {
  private ctx: CanvasRenderingContext2D;
  private composition: Composition | null = null;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;
  private resolution = 1;
  private readonly density = detectDensity();
  private raf = 0;
  private last = 0;
  private frames = 0;
  private frameAverage = 16;
  private curtain = 0;
  private onScreen = true;
  private paused = false;
  private failed = false;
  private disposed = false;
  private pointer: PointerState = { x: 0, y: 0, strength: 0 };
  private pointerActive = false;
  private pointerMovedAt = 0;
  private lastPulse = 0;
  private readonly target: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly intersectionObserver: IntersectionObserver | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private config: SceneConfig,
    private options: RunnerOptions,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
    this.target = options.pointerTarget ?? canvas;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(canvas);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        this.onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
        this.wake();
      });
      this.intersectionObserver.observe(canvas);
    }
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.wake);
    if (options.interactive) {
      this.target.addEventListener('pointermove', this.handlePointerMove, { passive: true });
      this.target.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
      this.target.addEventListener('pointerleave', this.handlePointerEnd, { passive: true });
      this.target.addEventListener('pointerup', this.handlePointerEnd, { passive: true });
      this.target.addEventListener('pointercancel', this.handlePointerEnd, { passive: true });
    }

    this.guard(() => {
      this.measure();
      this.rebuild();
    });
  }

  /** Applies a new config, rebuilding only when the composition itself changes. */
  setConfig(next: SceneConfig): void {
    const previous = this.config;
    this.config = next;
    this.guard(() => {
      if (!this.composition || needsRebuild(previous, next)) this.rebuild();
      else if (previous.intensity !== next.intensity || previous.motion !== next.motion) {
        if (this.options.still) this.rebuild();
        else setLevels(this.composition, next);
      }
    });
  }

  setStill(still: boolean): void {
    if (this.options.still === still) return;
    this.options = { ...this.options, still };
    this.guard(() => this.rebuild());
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.wake();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.wake);
    this.target.removeEventListener('pointermove', this.handlePointerMove);
    this.target.removeEventListener('pointerdown', this.handlePointerDown);
    this.target.removeEventListener('pointerleave', this.handlePointerEnd);
    this.target.removeEventListener('pointerup', this.handlePointerEnd);
    this.target.removeEventListener('pointercancel', this.handlePointerEnd);
    this.composition = null;
  }

  /** Runs engine work; any exception retires the canvas in favour of the fallback. */
  private guard(work: () => void): void {
    if (this.failed || this.disposed) return;
    try {
      work();
    } catch (error) {
      this.failed = true;
      cancelAnimationFrame(this.raf);
      console.warn('[living-letter] scene unavailable, using the static fallback.', error);
      this.options.onFail();
    }
  }

  /** Reads the canvas's CSS size and picks a backing-store resolution. Returns false if nothing changed. */
  private measure(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < 2 || height < 2) return false;
    const wanted = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO) * this.resolution;
    const affordable = Math.sqrt(MAX_PIXELS / (width * height));
    const pixelRatio = Math.max(0.4, Math.min(wanted, affordable));
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return false;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    return true;
  }

  private frameInfo() {
    return { width: this.width, height: this.height, pixelRatio: this.pixelRatio, density: this.density };
  }

  private rebuild(): void {
    if (this.width < 2) return;
    this.composition = buildComposition(this.config, this.frameInfo());
    // Every scene opens already in full swing — trails drawn, stems grown — never from an empty sky.
    settle(this.composition);
    if (this.options.still) {
      this.draw();
    } else {
      this.curtain = 1;
      this.wake();
    }
  }

  private draw(): void {
    const { ctx, composition } = this;
    if (!composition) return;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    paint(ctx, composition);
    if (this.curtain > 0.004) {
      // A new composition rises out of the dark instead of popping in.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = this.curtain * this.curtain;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }
  }

  private readonly handleResize = (): void => {
    this.guard(() => {
      if (!this.measure()) return;
      if (!this.composition || this.options.still) this.rebuild();
      else {
        resizeComposition(this.composition, this.frameInfo());
        this.draw();
      }
      this.wake();
    });
  };

  private canRun(): boolean {
    return !this.disposed && !this.failed && !this.paused && !this.options.still && this.onScreen && !document.hidden && !!this.composition;
  }

  /** Starts the loop if it should be running and is not. */
  private readonly wake = (): void => {
    if (this.raf || !this.canRun()) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  };

  private readonly tick = (now: number): void => {
    this.raf = 0;
    if (!this.canRun()) return;
    const elapsed = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    const dt = Math.min(0.05, Math.max(0.001, elapsed));

    this.guard(() => {
      const composition = this.composition;
      if (!composition) return;
      const present = this.pointerActive && now - this.pointerMovedAt < 2600 ? 1 : 0;
      const rate = present > this.pointer.strength ? 7 : 1.5;
      this.pointer.strength += (present - this.pointer.strength) * Math.min(1, dt * rate);
      if (this.curtain > 0) this.curtain = Math.max(0, this.curtain - dt / 0.7);
      advance(composition, dt, this.pointer);
      this.draw();
      this.adapt(elapsed * 1000);
    });
    if (!this.failed) this.raf = requestAnimationFrame(this.tick);
  };

  /**
   * If frames keep arriving late, trade resolution for smoothness. Never trades
   * back, to avoid oscillating. Two things are deliberately not treated as
   * slowness: long gaps (the tab was throttled or hidden) and a steady 30 fps
   * (battery savers cap the frame rate there on perfectly capable devices).
   */
  private adapt(frameMs: number): void {
    if (frameMs > 250) return;
    this.frames++;
    if (this.frames < 45) return;
    this.frameAverage += (frameMs - this.frameAverage) * 0.06;
    if (this.frames % 60 !== 0 || this.frameAverage < 38 || this.resolution <= MIN_RESOLUTION) return;
    this.resolution = Math.max(MIN_RESOLUTION, this.resolution * 0.8);
    this.frameAverage = 16;
    if (this.measure() && this.composition) resizeComposition(this.composition, this.frameInfo());
  }

  private locate(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointerActive = true;
    this.pointerMovedAt = performance.now();
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.locate(event);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Element && event.target.closest(CONTROLS)) return;
    this.locate(event);
    const now = performance.now();
    if (now - this.lastPulse < 160) return;
    this.lastPulse = now;
    this.guard(() => this.composition?.scene.pulse(this.pointer.x, this.pointer.y));
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    // A mouse stays "present" until it leaves; a finger is gone the moment it lifts.
    if (event.type === 'pointerleave' || event.pointerType !== 'mouse') this.pointerActive = false;
  };
}
