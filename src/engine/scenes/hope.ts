import { rgba, type RGB } from '../color';
import { drawGlow, glowSprite } from '../paint';
import { TAU, between, createNoise2D, createRng, forkSeed, lerp } from '../rng';
import type { PointerState, Scene, SceneEnv } from '../types';

/**
 * HOPE — "First light".
 * Dawn breaks below the frame and sends long rays upward. Motes rise on a
 * wandering current, each drawing a short thread of light, while stems of
 * light grow from the ground and lean in around the message. Motes gather and
 * swirl around your pointer; a tap releases a small flock of them.
 */

const HISTORY = 12;
const SAMPLE = 1 / 28;
const COLORS = 4;

interface Twig { points: Float32Array; origin: number }
interface Stem {
  slot: number;
  cycle: number;
  age: number;
  grow: number;
  hold: number;
  points: Float32Array;
  twigs: Twig[];
  color: RGB;
  sprite: HTMLCanvasElement;
}

const FADE = 3.2;

class HopeScene implements Scene {
  readonly warmup = 7.5;
  private width: number;
  private height: number;
  private intensity: number;
  private motion: number;
  private time = 0;
  private count: number;
  private x: Float32Array;
  private y: Float32Array;
  private rise: Float32Array;
  private kickX: Float32Array;
  private kickY: Float32Array;
  private trail: Float32Array;
  private head = 0;
  private sampleClock = 0;
  private flow: (x: number, y: number) => number;
  private stems: Stem[] = [];
  private sun: { x: number; sprite: HTMLCanvasElement; rays: { angle: number; width: number; phase: number }[] };
  private colors: RGB[];
  private sprites: HTMLCanvasElement[];
  private softSprites: HTMLCanvasElement[];
  private respawnAt = 0;

  constructor(private env: SceneEnv) {
    this.width = env.width;
    this.height = env.height;
    this.intensity = env.intensity;
    this.motion = env.motion;
    this.flow = createNoise2D(forkSeed(env.seed, 41));
    this.colors = Array.from({ length: COLORS }, (_, i) => env.colors.lights[i % env.colors.lights.length]);
    this.sprites = this.colors.map((color) => glowSprite(color, true));
    this.softSprites = this.colors.map((color) => glowSprite(color));

    const rng = createRng(forkSeed(env.seed, 4));
    this.sun = { x: between(rng, 0.3, 0.7), sprite: glowSprite(env.colors.haze[0]), rays: [] };
    for (let i = 0; i < 7; i++) {
      this.sun.rays.push({ angle: lerp(-1.05, 1.05, (i + rng() * 0.8) / 7), width: between(rng, 0.05, 0.13), phase: rng() * TAU });
    }

    this.count = Math.round(520 * env.density);
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.rise = new Float32Array(this.count);
    this.kickX = new Float32Array(this.count);
    this.kickY = new Float32Array(this.count);
    this.trail = new Float32Array(this.count * HISTORY * 2);
    const moteRng = createRng(forkSeed(env.seed, 42));
    for (let i = 0; i < this.count; i++) {
      this.rise[i] = between(moteRng, 16, 46);
      this.place(i, moteRng() * this.width, moteRng() * this.height);
    }

    // Always plan seven stems; a weaker device simply grows fewer of them.
    const stemCount = Math.round(lerp(4, 7, env.density));
    const delays = Array.from({ length: 7 }, () => between(rng, 0, 2.2));
    for (let slot = 0; slot < stemCount; slot++) this.stems.push(this.buildStem(slot, 0, -delays[slot]));
  }

  /** Puts a mote somewhere new and collapses its trail, so no line is drawn across the jump. */
  private place(i: number, x: number, y: number): void {
    this.x[i] = x;
    this.y[i] = y;
    const base = i * HISTORY * 2;
    for (let slot = 0; slot < HISTORY; slot++) {
      this.trail[base + slot * 2] = x;
      this.trail[base + slot * 2 + 1] = y;
    }
  }

  /** Grows the geometry of one stem. Slot and cycle fully determine its shape. */
  private buildStem(slot: number, cycle: number, age: number): Stem {
    const { width, height } = this;
    const rng = createRng(forkSeed(this.env.seed, 500 + slot * 31 + cycle * 977));
    const side = slot % 2 === 0 ? -1 : 1;
    const rootX = width * (0.5 + side * between(rng, 0.25, 0.48));
    const lean = -Math.PI / 2 - side * between(rng, 0.04, 0.2); // lean in toward the message
    const stride = height * between(rng, 0.0046, 0.0066);

    // A stem wanders a little, is drawn back toward its heading, and — like a fern — curls in at the tip.
    const walk = (x: number, y: number, heading: number, steps: number, home: number, salt: number, curl: number): Float32Array => {
      const points = new Float32Array(steps * 2);
      for (let i = 0; i < steps; i++) {
        points[i * 2] = x;
        points[i * 2 + 1] = y;
        const along = i / steps;
        heading +=
          this.flow(i * 0.035 + salt, slot * 3.1 + cycle * 1.7) * 0.045 +
          (home - heading) * 0.03 * (1 - along * along) +
          curl * along ** 3;
        x += Math.cos(heading) * stride;
        y += Math.sin(heading) * stride;
      }
      return points;
    };

    const steps = Math.round(between(rng, 95, 150));
    const points = walk(rootX, height + 8, lean + between(rng, -0.15, 0.15), steps, lean, 0, -side * between(rng, 0.05, 0.1));
    const twigs: Twig[] = [];
    const twigCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < twigCount; i++) {
      const origin = Math.round(steps * between(rng, 0.28, 0.8));
      const turn = (rng() < 0.5 ? -1 : 1) * between(rng, 0.5, 0.9);
      twigs.push({
        origin,
        points: walk(points[origin * 2], points[origin * 2 + 1], lean + turn, Math.round(between(rng, 26, 50)), -Math.PI / 2, 40 + i * 13, Math.sign(turn) * between(rng, 0.08, 0.16)),
      });
    }
    const pick = slot % this.colors.length;
    return { slot, cycle, age, grow: between(rng, 7, 11), hold: between(rng, 5, 9), points, twigs, color: this.colors[pick], sprite: this.sprites[pick] };
  }

  setLevels(intensity: number, motion: number): void {
    this.intensity = intensity;
    this.motion = motion;
  }

  resize(width: number, height: number): void {
    const scaleX = width / this.width;
    const scaleY = height / this.height;
    this.width = width;
    this.height = height;
    for (let i = 0; i < this.count; i++) this.place(i, this.x[i] * scaleX, this.y[i] * scaleY);
    this.stems = this.stems.map((stem) => this.buildStem(stem.slot, stem.cycle, stem.age));
  }

  pulse(x: number, y: number): void {
    const flock = Math.min(28, this.count);
    for (let n = 0; n < flock; n++) {
      const i = this.respawnAt;
      this.respawnAt = (this.respawnAt + 1) % this.count;
      const angle = (n / flock) * TAU;
      this.place(i, x, y);
      this.kickX[i] = Math.cos(angle) * 150;
      this.kickY[i] = Math.sin(angle) * 150;
    }
  }

  update(dt: number, pointer: PointerState): void {
    const step = dt * lerp(0.35, 1.5, this.motion);
    this.time += step;
    const { width, height, time } = this;
    const active = Math.round(this.count * lerp(0.3, 1, this.intensity));
    const settle = Math.exp(-dt * 2.4);

    for (let i = 0; i < active; i++) {
      const x = this.x[i];
      const y = this.y[i];
      let vx = this.flow(x * 0.0034, y * 0.0034 - time * 0.07) * 40;
      let vy = -this.rise[i] + this.flow(x * 0.0034 + 97.3, y * 0.0034 + time * 0.05) * 16;

      if (pointer.strength > 0.05) {
        const dx = pointer.x - x;
        const dy = pointer.y - y;
        const distance = Math.hypot(dx, dy);
        if (distance < 200 && distance > 4) {
          const pull = (1 - distance / 200) * pointer.strength;
          vx += ((-dy / distance) * 120 + (dx / distance) * 40) * pull;
          vy += ((dx / distance) * 120 + (dy / distance) * 40) * pull;
        }
      }

      this.x[i] = x + vx * step + this.kickX[i] * dt;
      this.y[i] = y + vy * step + this.kickY[i] * dt;
      this.kickX[i] *= settle;
      this.kickY[i] *= settle;

      if (this.y[i] < -24) this.place(i, ((this.x[i] * 1.7 + 211) % width + width) % width, height + 12 + (i % 9) * 3);
      else if (this.x[i] < -24) this.place(i, width + 20, this.y[i]);
      else if (this.x[i] > width + 24) this.place(i, -20, this.y[i]);
    }

    // Trails are sampled on a fixed clock, so their length does not depend on frame rate.
    this.sampleClock += step;
    while (this.sampleClock >= SAMPLE) {
      this.sampleClock -= SAMPLE;
      this.head = (this.head + 1) % HISTORY;
      for (let i = 0; i < active; i++) {
        const at = (i * HISTORY + this.head) * 2;
        this.trail[at] = this.x[i];
        this.trail[at + 1] = this.y[i];
      }
    }

    const growth = dt * lerp(0.7, 1.25, this.motion);
    for (let s = 0; s < this.stems.length; s++) {
      const stem = this.stems[s];
      stem.age += growth;
      if (stem.age > stem.grow + stem.hold + FADE) {
        this.stems[s] = this.buildStem(stem.slot, stem.cycle + 1, -0.6 - (stem.slot % 3) * 0.7);
      }
    }
  }

  /** Strokes the first `reach` points of a path, tapering from root to tip. */
  private strokeTapered(ctx: CanvasRenderingContext2D, points: Float32Array, reach: number, thick: number, thin: number): void {
    const total = points.length / 2;
    const last = Math.min(total - 1, Math.floor(reach));
    const bands = 5;
    for (let band = 0; band < bands; band++) {
      const from = Math.floor((band * total) / bands);
      const to = Math.min(last, Math.floor(((band + 1) * total) / bands));
      if (from >= last) break;
      ctx.lineWidth = lerp(thick, thin, band / (bands - 1));
      ctx.beginPath();
      ctx.moveTo(points[from * 2], points[from * 2 + 1]);
      for (let i = from + 1; i <= to; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
      ctx.stroke();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, time, intensity } = this;
    const lush = lerp(0.6, 1.2, intensity);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // The sun, just under the frame, and its rays.
    const sunX = this.sun.x * width;
    const sunY = height * 1.04;
    const reach = Math.hypot(width, height);
    const breath = 1 + 0.035 * Math.sin(time * 0.4);
    drawGlow(ctx, this.sun.sprite, sunX, sunY, Math.max(width, height) * 0.62 * breath, 0.55 * lush);
    drawGlow(ctx, this.sprites[0], sunX, sunY, Math.min(width, height) * 0.3 * breath, 0.5 * lush);
    ctx.globalAlpha = 1;
    for (const ray of this.sun.rays) {
      const angle = -Math.PI / 2 + ray.angle + Math.sin(time * 0.07 + ray.phase) * 0.06;
      const shine = (0.035 + 0.03 * Math.sin(time * 0.23 + ray.phase)) * lush;
      const beam = ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * reach * 0.8, sunY + Math.sin(angle) * reach * 0.8);
      beam.addColorStop(0, rgba(this.colors[0], shine * 1.6));
      beam.addColorStop(1, rgba(this.colors[0], 0));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(angle - ray.width) * reach, sunY + Math.sin(angle - ray.width) * reach);
      ctx.lineTo(sunX + Math.cos(angle + ray.width) * reach, sunY + Math.sin(angle + ray.width) * reach);
      ctx.closePath();
      ctx.fill();
    }

    // Stems
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stem of this.stems) {
      if (stem.age <= 0) continue;
      const progress = Math.min(1, stem.age / stem.grow);
      const grown = 1 - (1 - progress) ** 2.4;
      const fade = Math.min(1, Math.max(0, (stem.grow + stem.hold + FADE - stem.age) / FADE));
      const total = stem.points.length / 2;
      const tip = grown * (total - 1);
      ctx.strokeStyle = rgba(stem.color, 0.42 * fade * lush);
      this.strokeTapered(ctx, stem.points, tip, 2.3, 0.7);
      for (const twig of stem.twigs) {
        if (tip <= twig.origin) continue;
        const twigTotal = twig.points.length / 2;
        const twigTip = Math.min(twigTotal - 1, (tip - twig.origin) * 1.3);
        this.strokeTapered(ctx, twig.points, twigTip, 1.3, 0.5);
        const end = Math.floor(twigTip);
        drawGlow(ctx, stem.sprite, twig.points[end * 2], twig.points[end * 2 + 1], 5.5, 0.75 * fade * lush);
      }
      // Buds that light up as the stem passes them, and the growing tip itself.
      for (let node = 12; node < tip; node += 16) {
        const glimmer = 0.55 + 0.45 * Math.sin(time * 1.3 + node + stem.slot);
        drawGlow(ctx, stem.sprite, stem.points[node * 2], stem.points[node * 2 + 1], 3.6, 0.55 * glimmer * fade * lush);
      }
      const end = Math.floor(tip);
      drawGlow(ctx, stem.sprite, stem.points[end * 2], stem.points[end * 2 + 1], 9, 0.9 * fade * lush);
      ctx.globalAlpha = 1;
    }

    // Motes: trails batched by colour and by age, newest brightest.
    const active = Math.round(this.count * lerp(0.3, 1, intensity));
    const bands = 3;
    const perBand = (HISTORY - 1) / bands;
    for (let color = 0; color < COLORS; color++) {
      for (let band = 0; band < bands; band++) {
        ctx.strokeStyle = rgba(this.colors[color], lerp(0.26, 0.05, band / (bands - 1)) * lush);
        ctx.lineWidth = lerp(1.2, 0.6, band / (bands - 1));
        ctx.beginPath();
        for (let i = color; i < active; i += COLORS) {
          const base = i * HISTORY;
          const first = Math.round(band * perBand);
          const lastStep = Math.round((band + 1) * perBand);
          let slot = (this.head - first + HISTORY) % HISTORY;
          if (band === 0) ctx.moveTo(this.x[i], this.y[i]);
          else ctx.moveTo(this.trail[(base + slot) * 2], this.trail[(base + slot) * 2 + 1]);
          if (band === 0) ctx.lineTo(this.trail[(base + slot) * 2], this.trail[(base + slot) * 2 + 1]);
          for (let k = first + 1; k <= lastStep; k++) {
            slot = (this.head - k + HISTORY) % HISTORY;
            ctx.lineTo(this.trail[(base + slot) * 2], this.trail[(base + slot) * 2 + 1]);
          }
        }
        ctx.stroke();
      }
    }
    for (let i = 0; i < active; i++) {
      // Sizes repeat on a cycle of seven: mostly pinpoints, a few soft lantern-like lights.
      const twinkle = 0.65 + 0.35 * Math.sin(time * 1.6 + i * 1.7);
      const near = i % 7 === 0;
      const radius = near ? 7 + (i % 3) * 2.5 : 2 + (i % 5) * 0.5;
      drawGlow(ctx, near ? this.softSprites[i % COLORS] : this.sprites[i % COLORS], this.x[i], this.y[i], radius, (near ? 0.34 : 0.8) * twinkle * lush);
    }

    ctx.restore();
  }
}

export function createHope(env: SceneEnv): Scene {
  return new HopeScene(env);
}
