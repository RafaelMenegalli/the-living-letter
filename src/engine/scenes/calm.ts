import { rgba, type RGB } from '../color';
import { drawGlow, glowSprite } from '../paint';
import { TAU, between, createRng, forkSeed, hashUnit, lerp, pick } from '../rng';
import type { PointerState, Scene, SceneEnv } from '../types';

/**
 * CALM — "Tide".
 * A moon over slow water. Silk ribbons of light drift sideways like a tide,
 * twisting as they go; the moon lays a shimmering path across them; motes
 * hang in the air. Touching the scene sends rings across the surface.
 */

interface Ribbon {
  /** Draw priority: weaker devices skip the highest ranks. Sky veils are always drawn. */
  rank: number;
  baseY: number;
  color: RGB;
  strands: number;
  spread: number;
  alpha: number;
  a1: number; k1: number; w1: number; p1: number;
  a2: number; k2: number; w2: number; p2: number;
  kt: number; wt: number; pt: number;
}

interface Ripple { x: number; y: number; age: number; life: number; strength: number }
interface Mote { x: number; y: number; depth: number; size: number; phase: number; rate: number; sprite: HTMLCanvasElement }
interface Dash { y: number; offset: number; phase: number; rate: number; length: number }

const HORIZON = 0.54;
const RIPPLE_SPEED = 90;
const MAX_RIPPLES = 6;
const WATER_RIBBONS = 7;
/** Which water ribbons to keep first when a device can only afford some of them. */
const WATER_PRIORITY = [0, 6, 3, 1, 5, 2, 4];
const MOTES = 60;

class CalmScene implements Scene {
  readonly warmup = 2.6;
  private width: number;
  private height: number;
  private time = 0;
  private intensity: number;
  private motion: number;
  private ribbons: Ribbon[] = [];
  private motes: Mote[] = [];
  private dashes: Dash[] = [];
  private ripples: Ripple[] = [];
  private moon: { x: number; y: number; sprite: HTMLCanvasElement };
  private rippleColor: RGB;
  private travel = 0;
  private lastX = 0;
  private lastY = 0;
  private drops = 0;
  private nextDrop = 1.2;

  constructor(private env: SceneEnv) {
    this.width = env.width;
    this.height = env.height;
    this.intensity = env.intensity;
    this.motion = env.motion;
    const rng = createRng(forkSeed(env.seed, 1));
    const lights = env.colors.lights;
    this.rippleColor = lights[1];

    // Water: ribbons stacked from the horizon to the bottom edge, growing as they come closer.
    for (let i = 0; i < WATER_RIBBONS; i++) {
      const near = i / (WATER_RIBBONS - 1);
      this.ribbons.push(this.makeRibbon(rng, WATER_PRIORITY.indexOf(i), lerp(HORIZON + 0.04, 0.97, near ** 0.9) + between(rng, -0.015, 0.015), lerp(0.5, 1.3, near), 0.11, pick(rng, lights)));
    }
    // Sky: one or two very faint, wide veils that echo the water above the horizon.
    const skyCount = rng() < 0.5 ? 1 : 2;
    for (let i = 0; i < skyCount; i++) {
      this.ribbons.push(this.makeRibbon(rng, -1, between(rng, 0.1, 0.3), 2.4, 0.04, pick(rng, lights)));
    }

    this.moon = { x: between(rng, 0.22, 0.78), y: between(rng, 0.14, 0.26), sprite: glowSprite(lights[1]) };

    for (let i = 0; i < 30; i++) {
      const depth = (i + rng()) / 30;
      this.dashes.push({ y: depth, offset: between(rng, -1, 1), phase: rng() * TAU, rate: between(rng, 0.5, 1.4), length: between(rng, 0.5, 1) });
    }

    for (let i = 0; i < MOTES; i++) {
      const depth = between(rng, 0.25, 1);
      this.motes.push({
        x: rng(),
        y: rng(),
        depth,
        size: between(rng, 1.4, 4.2) * depth,
        phase: rng() * TAU,
        rate: between(rng, 0.25, 0.8),
        sprite: glowSprite(pick(rng, lights)),
      });
    }
  }

  private makeRibbon(rng: () => number, rank: number, baseY: number, scale: number, alpha: number, color: RGB): Ribbon {
    const span = Math.max(this.env.width, 640);
    return {
      rank,
      baseY,
      color,
      strands: Math.round(between(rng, 9, 15) * Math.min(1.25, 0.7 + scale * 0.4) * lerp(0.7, 1, this.env.density)),
      spread: between(rng, 13, 26) * scale,
      alpha: alpha * between(rng, 0.8, 1.15),
      a1: between(rng, 9, 20) * scale,
      k1: TAU / (between(rng, 0.6, 1.05) * span),
      w1: between(rng, 0.12, 0.24) * (rng() < 0.5 ? 1 : -1),
      p1: rng() * TAU,
      a2: between(rng, 3, 8) * scale,
      k2: TAU / (between(rng, 0.22, 0.4) * span),
      w2: between(rng, 0.16, 0.34),
      p2: rng() * TAU,
      kt: TAU / (between(rng, 0.55, 1) * span),
      wt: between(rng, 0.05, 0.12),
      pt: rng() * TAU,
    };
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
    this.addRipple(x, y, 1);
  }

  private addRipple(x: number, y: number, strength: number): void {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, age: 0, life: 5.5, strength });
  }

  update(dt: number, pointer: PointerState): void {
    const step = dt * lerp(0.35, 1.6, this.motion);
    this.time += step;

    // A finger or cursor dragging through the water leaves a wake of rings.
    if (pointer.strength > 0.05) {
      this.travel += Math.hypot(pointer.x - this.lastX, pointer.y - this.lastY);
      if (this.travel > 120) {
        this.travel = 0;
        this.addRipple(pointer.x, pointer.y, 0.55);
      }
    }
    this.lastX = pointer.x;
    this.lastY = pointer.y;

    // Now and then a drop falls on its own, so the surface is never dead.
    if (this.time >= this.nextDrop) {
      const n = this.drops++;
      this.addRipple(
        lerp(0.12, 0.88, hashUnit(this.env.seed, n * 3 + 11)) * this.width,
        lerp(HORIZON + 0.08, 0.92, hashUnit(this.env.seed, n * 3 + 12)) * this.height,
        0.7,
      );
      this.nextDrop = this.time + lerp(4.5, 9, hashUnit(this.env.seed, n * 3 + 13));
    }

    for (const ripple of this.ripples) ripple.age += dt;
    this.ripples = this.ripples.filter((ripple) => ripple.age < ripple.life);

    for (const mote of this.motes) {
      mote.y -= (step * (2 + 6 * mote.depth)) / this.height;
      mote.x += (step * Math.sin(this.time * mote.rate + mote.phase) * 3 * mote.depth) / this.width;
      if (pointer.strength > 0.05) {
        const dx = mote.x * this.width - pointer.x;
        const dy = mote.y * this.height - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 150 && distance > 1) {
          const push = ((1 - distance / 150) * 26 * dt * pointer.strength) / distance;
          mote.x += (dx * push) / this.width;
          mote.y += (dy * push) / this.height;
        }
      }
      if (mote.y < -0.03) mote.y += 1.06;
      if (mote.x < -0.03) mote.x += 1.06;
      else if (mote.x > 1.03) mote.x -= 1.06;
    }
  }

  /** Vertical displacement the ripples impose on a point of the surface. */
  private swell(x: number, y: number): number {
    let offset = 0;
    for (const ripple of this.ripples) {
      const delta = Math.hypot(x - ripple.x, (y - ripple.y) * 2.2) - ripple.age * RIPPLE_SPEED;
      if (delta > 130 || delta < -130) continue;
      const fade = 1 - ripple.age / ripple.life;
      offset += Math.sin(delta * 0.055) * Math.exp(-(delta * delta) / 3200) * fade * fade * ripple.strength * 16;
    }
    return offset;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, time, intensity } = this;
    const lush = lerp(0.55, 1.25, intensity);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Moon and halo
    const moonX = this.moon.x * width;
    const moonY = this.moon.y * height;
    const moonRadius = Math.min(width, height) * 0.075;
    const breath = 1 + 0.04 * Math.sin(time * 0.35);
    drawGlow(ctx, this.moon.sprite, moonX, moonY, moonRadius * 5.5 * breath, 0.16 * lush);
    drawGlow(ctx, this.moon.sprite, moonX, moonY, moonRadius * 1.9, 0.5 * lush);
    // The disc itself: lit from the upper left, so it reads as a body rather than a flat dot.
    const disc = moonRadius * 0.62;
    const face = ctx.createRadialGradient(moonX - disc * 0.35, moonY - disc * 0.35, disc * 0.1, moonX, moonY, disc);
    face.addColorStop(0, rgba(this.rippleColor, Math.min(0.8, 0.5 * lush)));
    face.addColorStop(1, rgba(this.rippleColor, Math.min(0.4, 0.2 * lush)));
    ctx.globalAlpha = 1;
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(moonX, moonY, disc, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // The moon's path on the water: short strokes that widen as they approach.
    const horizonY = height * HORIZON;
    ctx.lineCap = 'round';
    for (const dash of this.dashes) {
      const near = dash.y * dash.y;
      const y = horizonY + near * (height - horizonY) * 1.02;
      const shimmer = 0.5 + 0.5 * Math.sin(time * dash.rate * 1.6 + dash.phase);
      const half = (4 + near * width * 0.11) * dash.length * (0.6 + 0.4 * shimmer);
      const x = moonX + dash.offset * (6 + near * width * 0.09) + Math.sin(time * 0.5 + dash.phase) * 5 * near;
      const lift = this.swell(x, y);
      ctx.strokeStyle = rgba(this.rippleColor, (0.08 + 0.3 * shimmer) * (0.5 + 0.5 * dash.y) * lush);
      ctx.lineWidth = 0.8 + near * 1.6;
      ctx.beginPath();
      ctx.moveTo(x - half, y + lift);
      ctx.lineTo(x + half, y + lift);
      ctx.stroke();
    }

    // Ribbons
    const stride = lerp(22, 14, this.env.density);
    ctx.lineWidth = 1;
    const keep = Math.round(lerp(4, WATER_RIBBONS, this.env.density));
    for (const ribbon of this.ribbons) {
      if (ribbon.rank >= keep) continue;
      const strands = Math.max(3, Math.round(ribbon.strands * lerp(0.5, 1, intensity)));
      const base = ribbon.baseY * height;
      const rippled = ribbon.baseY > HORIZON && this.ripples.length > 0;
      for (let s = 0; s < strands; s++) {
        const u = strands === 1 ? 0 : (s / (strands - 1)) * 2 - 1;
        const edge = Math.abs(u);
        ctx.strokeStyle = rgba(ribbon.color, ribbon.alpha * lush * (0.55 + 0.75 * edge * edge));
        ctx.beginPath();
        for (let x = -stride; x <= width + stride; x += stride) {
          const twist = Math.sin(ribbon.kt * x + ribbon.wt * time + ribbon.pt);
          let y =
            base +
            ribbon.a1 * Math.sin(ribbon.k1 * x + ribbon.w1 * time + ribbon.p1 + u * 0.4) +
            ribbon.a2 * Math.sin(ribbon.k2 * x - ribbon.w2 * time + ribbon.p2 + u * 0.9) +
            u * ribbon.spread * twist;
          if (rippled) y += this.swell(x, y);
          if (x === -stride) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Rings on the surface
    for (const ripple of this.ripples) {
      const fade = 1 - ripple.age / ripple.life;
      const radius = ripple.age * RIPPLE_SPEED;
      ctx.strokeStyle = rgba(this.rippleColor, 0.2 * fade * fade * ripple.strength * lush);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, radius, radius / 2.2, 0, 0, TAU);
      ctx.stroke();
    }

    // Motes
    const visible = Math.round(this.motes.length * this.env.density * lerp(0.4, 1, intensity));
    for (let i = 0; i < visible; i++) {
      const mote = this.motes[i];
      const twinkle = 0.55 + 0.45 * Math.sin(time * mote.rate * 2 + mote.phase);
      drawGlow(ctx, mote.sprite, mote.x * width, mote.y * height, mote.size * 3, 0.5 * twinkle * mote.depth * lush);
    }

    ctx.restore();
  }
}

export function createCalm(env: SceneEnv): Scene {
  return new CalmScene(env);
}
