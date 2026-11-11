import { rgba, type RGB } from '../color';
import { drawGlow, glowSprite } from '../paint';
import { TAU, between, createRng, forkSeed, hashUnit, lerp, pick, type Rng } from '../rng';
import type { PointerState, Scene, SceneEnv } from '../types';

/**
 * CELEBRATION — "Bloom".
 * Slow fireworks made of soft light: a shell climbs, opens into a peony, a
 * ring or a willow, and drifts down through a fall of glinting confetti.
 * Blooms swell and fade rather than flash. Tap anywhere to set one off.
 */

interface Spark {
  x: number; y: number;
  /** Trailing point that chases the spark; the line between them is its streak. */
  tx: number; ty: number;
  vx: number; vy: number;
  age: number; life: number; size: number;
  drag: number; gravity: number;
  color: number;
}

interface Shell { x0: number; x1: number; y1: number; t: number; index: number; color: number }
interface Halo { x: number; y: number; age: number; radius: number; color: number }

interface Confetto {
  x: number; y: number; depth: number;
  w: number; h: number;
  angle: number; spin: number;
  flip: number; flipRate: number;
  phase: number; sway: number; fall: number;
  color: RGB; round: boolean;
}

interface Glint { x: number; y: number; age: number; life: number; size: number; color: RGB }

const RISE_TIME = 0.75;
const HALO_LIFE = 1.1;
/** The first bursts land on fixed beats so a still frame always catches a bloom at its fullest. */
const OPENING_BEATS = [1.0, 2.2, 3.0];
const CONFETTI = 150;

/** A four-point sparkle with pinched sides. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const waist = radius * 0.14;
  const reach = radius * 0.72;
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.quadraticCurveTo(x + waist, y - waist, x + reach, y);
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + radius);
  ctx.quadraticCurveTo(x - waist, y + waist, x - reach, y);
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - radius);
  ctx.fill();
}

class CelebrationScene implements Scene {
  readonly warmup = 3.5;
  private width: number;
  private height: number;
  private intensity: number;
  private motion: number;
  private clock = 0;
  private time = 0;
  private sparks: Spark[] = [];
  private cursor = 0;
  private maxSparks: number;
  private shells: Shell[] = [];
  private halos: Halo[] = [];
  private confetti: Confetto[] = [];
  private glints: Glint[] = [];
  private bloomIndex = 0;
  private nextBurst = OPENING_BEATS[0];
  private shellSent = false;
  private glintIndex = 0;
  private nextGlint = 0.3;
  private fx: Rng;
  private colors: readonly RGB[];
  private sprites: HTMLCanvasElement[];
  private softSprites: HTMLCanvasElement[];
  private lastX = 0;
  private lastY = 0;

  constructor(private env: SceneEnv) {
    this.width = env.width;
    this.height = env.height;
    this.intensity = env.intensity;
    this.motion = env.motion;
    this.fx = createRng(forkSeed(env.seed, 21));
    this.colors = env.colors.lights;
    this.sprites = this.colors.map((color) => glowSprite(color, true));
    this.softSprites = this.colors.map((color) => glowSprite(color));
    this.maxSparks = Math.round(1300 * env.density);

    const rng = createRng(forkSeed(env.seed, 2));
    for (let i = 0; i < CONFETTI; i++) {
      const depth = between(rng, 0.35, 1);
      const round = rng() < 0.2;
      const size = between(rng, 5, 12) * depth;
      this.confetti.push({
        x: rng(),
        y: rng(),
        depth,
        w: size,
        h: round ? size : size * between(rng, 0.4, 0.7),
        angle: rng() * TAU,
        spin: between(rng, -1.6, 1.6),
        flip: rng() * TAU,
        flipRate: between(rng, 1.4, 3.8),
        phase: rng() * TAU,
        sway: between(rng, 8, 26),
        fall: between(rng, 16, 40),
        color: pick(rng, this.colors),
        round,
      });
    }
  }

  setLevels(intensity: number, motion: number): void {
    this.intensity = intensity;
    this.motion = motion;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  pulse(x: number, y: number): void {
    this.burst(x, y, Math.floor(this.fx() * 1000) + 5000);
  }

  private emit(x: number, y: number, vx: number, vy: number, life: number, size: number, drag: number, gravity: number, color: number): void {
    const spark: Spark = { x, y, tx: x, ty: y, vx, vy, age: 0, life, size, drag, gravity, color };
    if (this.sparks.length < this.maxSparks) this.sparks.push(spark);
    else {
      this.sparks[this.cursor] = spark;
      this.cursor = (this.cursor + 1) % this.maxSparks;
    }
  }

  /** Opens bloom number `n`. Its character is a pure function of the seed and n. */
  private burst(x: number, y: number, n: number): void {
    const seed = this.env.seed;
    const kind = Math.floor(hashUnit(seed, n * 7 + 1) * 3); // 0 peony · 1 ring · 2 willow
    const main = Math.floor(hashUnit(seed, n * 7 + 2) * this.colors.length);
    const second = Math.floor(hashUnit(seed, n * 7 + 3) * this.colors.length);
    const reach = Math.min(this.width, this.height) * lerp(0.34, 0.52, hashUnit(seed, n * 7 + 4));
    const count = Math.round(lerp(44, 110, this.intensity) * this.env.density * (kind === 1 ? 0.75 : 1));
    const rng = createRng(forkSeed(seed, 9000 + n));
    const turn = rng() * TAU;

    for (let i = 0; i < count; i++) {
      const angle = turn + (i / count) * TAU + between(rng, -0.06, 0.06);
      const shell = kind === 1 ? between(rng, 0.94, 1) : 0.28 + 0.72 * Math.sqrt(rng());
      const drag = kind === 2 ? 2.1 : 1.75;
      const speed = reach * shell * drag; // distance travelled before drag stops it ≈ reach × shell
      this.emit(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        kind === 2 ? between(rng, 2.3, 3.3) : between(rng, 1.4, 2.3),
        between(rng, 2.2, 4.2),
        drag,
        kind === 2 ? 74 : 34,
        rng() < 0.72 ? main : second,
      );
    }
    if (this.halos.length >= 6) this.halos.shift();
    this.halos.push({ x, y, age: 0, radius: reach * 1.25, color: main });
  }

  update(dt: number, pointer: PointerState): void {
    this.clock += dt;
    const step = dt * lerp(0.6, 1.25, this.motion);
    this.time += step;
    const { width, height } = this;
    const seed = this.env.seed;

    // Shells: launched so that they open exactly on the beat.
    if (!this.shellSent && this.clock >= this.nextBurst - RISE_TIME) {
      const n = this.bloomIndex;
      const angle = hashUnit(seed, n * 5 + 31) * TAU;
      const x1 = width * (0.5 + Math.cos(angle) * lerp(0.2, 0.4, hashUnit(seed, n * 5 + 32)));
      const y1 = height * (0.42 + Math.sin(angle) * lerp(0.14, 0.3, hashUnit(seed, n * 5 + 33)));
      this.shells.push({
        x0: x1 + (hashUnit(seed, n * 5 + 34) - 0.5) * width * 0.18,
        x1,
        y1,
        t: (this.clock - (this.nextBurst - RISE_TIME)) / RISE_TIME,
        index: n,
        color: n % this.colors.length,
      });
      this.shellSent = true;
    }
    for (const shell of this.shells) {
      shell.t += dt / RISE_TIME;
      if (shell.t < 1) {
        const ease = 1 - (1 - shell.t) ** 2.2;
        const x = lerp(shell.x0, shell.x1, ease);
        const y = lerp(height + 10, shell.y1, ease);
        this.emit(x, y, (this.fx() - 0.5) * 14, 20 + this.fx() * 20, 0.55, 1.7, 2, 20, shell.color);
      } else {
        this.burst(shell.x1, shell.y1, shell.index);
      }
    }
    if (this.shells.length > 0 && this.shells[0].t >= 1) {
      this.shells = this.shells.filter((shell) => shell.t < 1);
      this.bloomIndex++;
      this.shellSent = false;
      const beat = OPENING_BEATS[this.bloomIndex];
      this.nextBurst =
        beat ?? this.nextBurst + lerp(2.5, 0.95, this.motion) * (0.75 + 0.5 * hashUnit(seed, this.bloomIndex * 5 + 35));
    }

    // A moving pointer trails sparks like a sparkler.
    const moved = Math.hypot(pointer.x - this.lastX, pointer.y - this.lastY);
    if (pointer.strength > 0.1 && moved > 2) {
      const color = Math.floor(this.fx() * this.colors.length);
      this.emit(pointer.x, pointer.y, (this.fx() - 0.5) * 80, (this.fx() - 0.5) * 80 - 10, 0.5 + this.fx() * 0.5, 1.6 + this.fx() * 1.6, 2.4, 60, color);
    }
    this.lastX = pointer.x;
    this.lastY = pointer.y;

    const follow = 1 - Math.exp(-step * 7);
    for (const spark of this.sparks) {
      if (spark.age >= spark.life) continue;
      spark.age += step;
      const keep = Math.exp(-spark.drag * step);
      spark.vx *= keep;
      spark.vy = spark.vy * keep + spark.gravity * step;
      spark.x += spark.vx * step;
      spark.y += spark.vy * step;
      spark.tx += (spark.x - spark.tx) * follow;
      spark.ty += (spark.y - spark.ty) * follow;
    }

    for (const halo of this.halos) halo.age += step;
    this.halos = this.halos.filter((halo) => halo.age < HALO_LIFE);

    for (const piece of this.confetti) {
      piece.y += (step * piece.fall * piece.depth) / height;
      piece.x += (step * Math.sin(this.time * 0.9 + piece.phase) * piece.sway * piece.depth) / width;
      piece.angle += piece.spin * step;
      piece.flip += piece.flipRate * step;
      if (piece.y > 1.04) {
        piece.y -= 1.08;
        piece.x = (piece.x + 0.37) % 1;
      }
      if (piece.x < -0.04) piece.x += 1.08;
      else if (piece.x > 1.04) piece.x -= 1.08;
    }

    // Glints: four-point twinkles that open and close like an eye.
    if (this.clock >= this.nextGlint) {
      const n = this.glintIndex++;
      if (this.glints.length < 14) {
        this.glints.push({
          x: hashUnit(seed, n * 4 + 61),
          y: hashUnit(seed, n * 4 + 62),
          age: 0,
          life: lerp(0.9, 1.6, hashUnit(seed, n * 4 + 63)),
          size: lerp(6, 15, hashUnit(seed, n * 4 + 64)),
          color: this.colors[n % this.colors.length],
        });
      }
      this.nextGlint = this.clock + lerp(0.7, 0.22, this.intensity);
    }
    for (const glint of this.glints) glint.age += step;
    this.glints = this.glints.filter((glint) => glint.age < glint.life);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, intensity } = this;
    const lush = lerp(0.6, 1.15, intensity);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // The glow a bloom throws on the sky around it: quick to rise, slow to go, never a flash.
    for (const halo of this.halos) {
      const life = halo.age / HALO_LIFE;
      const swell = Math.min(1, halo.age / 0.16) * (1 - life) ** 1.6;
      drawGlow(ctx, this.softSprites[halo.color], halo.x, halo.y, halo.radius * (0.7 + 0.3 * life), 0.2 * swell * lush);
    }

    // Confetti
    const pieces = Math.round(this.confetti.length * this.env.density * lerp(0.35, 1, intensity));
    ctx.globalAlpha = 1;
    for (let i = 0; i < pieces; i++) {
      const piece = this.confetti[i];
      // A piece turning in the air: its face narrows to an edge and catches the light as it opens.
      const face = Math.cos(piece.flip);
      ctx.save();
      ctx.translate(piece.x * width, piece.y * height);
      ctx.rotate(piece.angle);
      ctx.scale(1, Math.abs(face) < 0.03 ? 0.03 : face);
      ctx.fillStyle = rgba(piece.color, (0.2 + 0.62 * face * face) * piece.depth * lush);
      if (piece.round) {
        ctx.beginPath();
        ctx.arc(0, 0, piece.w / 2, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      }
      ctx.restore();
    }

    // Streaks, batched by colour and by brightness so hundreds of sparks cost a handful of strokes.
    ctx.lineCap = 'round';
    for (let color = 0; color < this.colors.length; color++) {
      for (let band = 0; band < 2; band++) {
        ctx.beginPath();
        for (const spark of this.sparks) {
          if (spark.color !== color || spark.age >= spark.life) continue;
          const bright = spark.age / spark.life < 0.5;
          if (bright !== (band === 0)) continue;
          ctx.moveTo(spark.tx, spark.ty);
          ctx.lineTo(spark.x, spark.y);
        }
        ctx.strokeStyle = rgba(this.colors[color], (band === 0 ? 0.5 : 0.2) * lush);
        ctx.lineWidth = band === 0 ? 1.7 : 1.1;
        ctx.stroke();
      }
    }

    // Spark heads
    for (const spark of this.sparks) {
      if (spark.age >= spark.life) continue;
      const life = spark.age / spark.life;
      const fade = Math.min(1, spark.age / 0.09) * (1 - life) ** 1.3;
      const flicker = life > 0.6 ? 0.82 + 0.18 * Math.sin(spark.age * 23 + spark.size * 9) : 1;
      drawGlow(ctx, this.sprites[spark.color], spark.x, spark.y, spark.size * (2.2 + 1.6 * (1 - life)), 0.9 * fade * flicker * lush);
    }

    // Glints
    ctx.globalAlpha = 1;
    for (const glint of this.glints) {
      const open = Math.sin((glint.age / glint.life) * Math.PI);
      ctx.fillStyle = rgba(glint.color, 0.85 * open * lush);
      sparkle(ctx, glint.x * width, glint.y * height, glint.size * (0.4 + 0.6 * open));
    }

    ctx.restore();
  }
}

export function createCelebration(env: SceneEnv): Scene {
  return new CelebrationScene(env);
}
