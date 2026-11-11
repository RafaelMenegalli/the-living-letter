import { rgba, type RGB } from '../color';
import { drawGlow, glowSprite } from '../paint';
import { TAU, between, createRng, forkSeed, hashUnit, lerp, pick } from '../rng';
import type { PointerState, Scene, SceneEnv } from '../types';

/**
 * LONGING — "Distance".
 * A deep night sky. Drifting stars reach for one another and let go as they
 * pass; two bright wanderers circle on opposite sides of the message, joined
 * by a thread of light along which small pulses travel; each calls out in slow
 * rings that make the stars they cross answer. Your pointer becomes a star too.
 */

interface FarStar { x: number; y: number; size: number; alpha: number; rate: number; phase: number }
interface MidStar {
  x: number; y: number; vx: number; vy: number;
  size: number; rate: number; phase: number;
  ox: number; oy: number; lit: number;
  sprite: HTMLCanvasElement;
}
interface Bokeh { x: number; y: number; radius: number; alpha: number; vx: number; vy: number; sprite: HTMLCanvasElement }
interface Ring { x: number; y: number; age: number; life: number; strength: number }
interface Meteor { x: number; y: number; vx: number; vy: number; age: number; life: number }

const RING_SPEED = 150;
const THREAD_DOTS = 56;
const MID_STARS = 76;

class LongingScene implements Scene {
  readonly warmup = 2.4;
  private width: number;
  private height: number;
  private intensity: number;
  private motion: number;
  private time = 0;
  private clock = 0;
  private far: FarStar[] = [];
  private mid: MidStar[] = [];
  private bokeh: Bokeh[] = [];
  private rings: Ring[] = [];
  private meteor: Meteor | null = null;
  private meteorIndex = 0;
  private nextMeteor: number;
  private callIndex = 0;
  private nextCall = 0.5;
  private orbitStart: number;
  private orbitTurn: number;
  private wanderers = { ax: 0, ay: 0, bx: 0, by: 0, bendX: 0, bendY: 0 };
  private wandererSprite: HTMLCanvasElement;
  private threadSprite: HTMLCanvasElement;
  private lineColor: RGB;
  private farColor: RGB;
  private pointer: PointerState = { x: 0, y: 0, strength: 0 };
  private shiftX = 0;
  private shiftY = 0;

  constructor(private env: SceneEnv) {
    this.width = env.width;
    this.height = env.height;
    this.intensity = env.intensity;
    this.motion = env.motion;
    const lights = env.colors.lights;
    this.lineColor = lights[1];
    this.farColor = lights[0];
    this.wandererSprite = glowSprite(lights[3] ?? lights[0], true);
    this.threadSprite = glowSprite(lights[1]);

    const rng = createRng(forkSeed(env.seed, 3));
    this.orbitStart = rng() * TAU;
    this.orbitTurn = rng() < 0.5 ? 1 : -1;
    this.nextMeteor = between(rng, 4, 8);

    // Far field: half scattered, half gathered into a faint diagonal river of stars.
    const bandAngle = between(rng, -0.6, 0.6);
    const bandOffset = between(rng, 0.3, 0.7);
    // The far field has its own random stream: a device that draws fewer of
    // these stars must still lay out exactly the same constellations.
    const far = createRng(forkSeed(env.seed, 31));
    const farCount = Math.round(300 * env.density);
    for (let i = 0; i < farCount; i++) {
      let x = far();
      let y = far();
      if (i % 2 === 0) {
        const along = far() * 1.4 - 0.2;
        const across = (far() + far() + far() - 1.5) * 0.14;
        x = along;
        y = bandOffset + (along - 0.5) * Math.tan(bandAngle) + across;
      }
      this.far.push({ x, y, size: between(far, 0.5, 1.5), alpha: between(far, 0.2, 0.85), rate: between(far, 0.4, 1.8), phase: far() * TAU });
    }

    // Constellation stars share a slow common drift, each with its own small deviation.
    const heading = rng() * TAU;
    for (let i = 0; i < MID_STARS; i++) {
      const angle = heading + between(rng, -0.7, 0.7);
      const speed = between(rng, 2.5, 7);
      this.mid.push({
        x: rng(), y: rng(),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: between(rng, 1.1, 2.7),
        rate: between(rng, 0.5, 1.6), phase: rng() * TAU,
        ox: 0, oy: 0, lit: 0,
        sprite: glowSprite(pick(rng, lights), true),
      });
    }

    for (let i = 0; i < 9; i++) {
      this.bokeh.push({
        x: rng(), y: rng(),
        radius: between(rng, 16, 46),
        alpha: between(rng, 0.04, 0.1),
        vx: between(rng, -3, 3), vy: between(rng, -2, 2),
        sprite: glowSprite(pick(rng, env.colors.haze)),
      });
    }
    this.placeWanderers();
  }

  setLevels(intensity: number, motion: number): void {
    this.intensity = intensity;
    this.motion = motion;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.placeWanderers();
  }

  pulse(x: number, y: number): void {
    this.call(x, y, 1);
  }

  private call(x: number, y: number, strength: number): void {
    if (this.rings.length >= 5) this.rings.shift();
    this.rings.push({ x, y, age: 0, life: 4.2, strength });
  }

  private placeWanderers(): void {
    const { width, height } = this;
    const angle = this.orbitStart + this.time * 0.045 * this.orbitTurn;
    const rx = Math.min(width * 0.4, 560);
    const ry = Math.min(height * 0.34, 330);
    const wobble = Math.sin(this.time * 0.21) * 0.12;
    this.wanderers.ax = width / 2 + Math.cos(angle + wobble) * rx;
    this.wanderers.ay = height / 2 + Math.sin(angle + wobble) * ry;
    this.wanderers.bx = width / 2 - Math.cos(angle - wobble) * rx;
    this.wanderers.by = height / 2 - Math.sin(angle - wobble) * ry;
    // The thread between them swings a quarter-turn ahead, so it arcs around the words, never through them.
    this.wanderers.bendX = width / 2 + Math.cos(angle + Math.PI / 2) * rx * 2.1;
    this.wanderers.bendY = height / 2 + Math.sin(angle + Math.PI / 2) * ry * 2.1;
  }

  update(dt: number, pointer: PointerState): void {
    const step = dt * lerp(0.3, 1.5, this.motion);
    this.time += step;
    this.clock += dt;
    this.pointer = pointer;
    const { width, height } = this;
    this.placeWanderers();

    // Depth: the sky leans away from the pointer, nearer layers more than far ones.
    const targetX = pointer.strength * (0.5 - pointer.x / width);
    const targetY = pointer.strength * (0.5 - pointer.y / height);
    const ease = Math.min(1, dt * 2.5);
    this.shiftX += (targetX - this.shiftX) * ease;
    this.shiftY += (targetY - this.shiftY) * ease;

    const reach = this.linkRadius() * 1.5;
    for (const star of this.mid) {
      star.x += (star.vx * step) / width;
      star.y += (star.vy * step) / height;
      if (star.x < -0.05) star.x += 1.1;
      else if (star.x > 1.05) star.x -= 1.1;
      if (star.y < -0.05) star.y += 1.1;
      else if (star.y > 1.05) star.y -= 1.1;

      // Stars near the pointer lean toward it, then settle back.
      let pullX = 0;
      let pullY = 0;
      if (pointer.strength > 0.05) {
        const dx = pointer.x - star.x * width;
        const dy = pointer.y - star.y * height;
        const distance = Math.hypot(dx, dy);
        if (distance < reach && distance > 1) {
          const pull = (1 - distance / reach) * 16 * pointer.strength;
          pullX = (dx / distance) * pull;
          pullY = (dy / distance) * pull;
        }
      }
      star.ox += (pullX - star.ox) * ease;
      star.oy += (pullY - star.oy) * ease;
      star.lit *= Math.exp(-dt * 1.6);
    }

    for (const light of this.bokeh) {
      light.x += (light.vx * step) / width;
      light.y += (light.vy * step) / height;
      if (light.x < -0.1) light.x += 1.2;
      else if (light.x > 1.1) light.x -= 1.2;
      if (light.y < -0.1) light.y += 1.2;
      else if (light.y > 1.1) light.y -= 1.2;
    }

    // The wanderers take turns calling across the distance.
    if (this.clock >= this.nextCall) {
      const fromA = this.callIndex++ % 2 === 0;
      this.call(fromA ? this.wanderers.ax : this.wanderers.bx, fromA ? this.wanderers.ay : this.wanderers.by, 0.6);
      this.nextCall = this.clock + lerp(9, 4.5, this.motion);
    }
    for (const ring of this.rings) {
      ring.age += dt;
      const radius = ring.age * RING_SPEED;
      const fade = 1 - ring.age / ring.life;
      for (const star of this.mid) {
        const gap = Math.hypot(star.x * width - ring.x, star.y * height - ring.y) - radius;
        if (gap > -24 && gap < 24) star.lit = Math.max(star.lit, fade * ring.strength);
      }
    }
    this.rings = this.rings.filter((ring) => ring.age < ring.life);

    // A rare, unhurried shooting star.
    if (this.meteor) {
      this.meteor.age += dt;
      this.meteor.x += this.meteor.vx * dt;
      this.meteor.y += this.meteor.vy * dt;
      if (this.meteor.age >= this.meteor.life) this.meteor = null;
    } else if (this.clock >= this.nextMeteor) {
      const n = this.meteorIndex++;
      const seed = this.env.seed;
      const leftward = hashUnit(seed, n * 4 + 71) < 0.5;
      const angle = lerp(0.25, 0.6, hashUnit(seed, n * 4 + 72));
      const speed = Math.max(width, height) * 0.55;
      this.meteor = {
        x: width * lerp(0.15, 0.85, hashUnit(seed, n * 4 + 73)),
        y: height * lerp(0.02, 0.3, hashUnit(seed, n * 4 + 74)),
        vx: Math.cos(angle) * speed * (leftward ? -1 : 1),
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 1.1,
      };
      this.nextMeteor = this.clock + lerp(16, 7, this.motion) * (0.7 + 0.6 * hashUnit(seed, n * 4 + 75));
    }
  }

  private linkRadius(): number {
    return Math.max(84, Math.min(150, Math.min(this.width, this.height) * 0.17));
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, intensity, clock } = this;
    const lush = lerp(0.6, 1.2, intensity);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Far field
    ctx.fillStyle = rgba(this.farColor, 1);
    const farCount = Math.round(this.far.length * lerp(0.45, 1, intensity));
    const farX = this.shiftX * 6;
    const farY = this.shiftY * 6;
    for (let i = 0; i < farCount; i++) {
      const star = this.far[i];
      ctx.globalAlpha = Math.min(1, star.alpha * (0.6 + 0.4 * Math.sin(clock * star.rate + star.phase)) * lush);
      ctx.fillRect(star.x * width + farX, star.y * height + farY, star.size, star.size);
    }

    // Soft out-of-focus lights, closest to the viewer
    for (const light of this.bokeh) {
      drawGlow(ctx, light.sprite, light.x * width + this.shiftX * 44, light.y * height + this.shiftY * 44, light.radius * 1.6, light.alpha * lush);
    }

    // Constellation: resolve positions once, then links, then the stars themselves.
    const count = Math.round(this.mid.length * lerp(0.55, 1, this.env.density) * lerp(0.6, 1, intensity));
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const midX = this.shiftX * 16;
    const midY = this.shiftY * 16;
    for (let i = 0; i < count; i++) {
      const star = this.mid[i];
      xs[i] = star.x * width + star.ox + midX;
      ys[i] = star.y * height + star.oy + midY;
    }
    const radius = this.linkRadius();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = xs[i] - xs[j];
        if (dx > radius || dx < -radius) continue;
        const dy = ys[i] - ys[j];
        const distance = Math.hypot(dx, dy);
        if (distance >= radius) continue;
        const closeness = 1 - distance / radius;
        const lit = 1 + 1.5 * Math.max(this.mid[i].lit, this.mid[j].lit);
        ctx.strokeStyle = rgba(this.lineColor, closeness * closeness * 0.42 * lit * lush);
        ctx.beginPath();
        ctx.moveTo(xs[i], ys[i]);
        ctx.lineTo(xs[j], ys[j]);
        ctx.stroke();
      }
    }

    // The pointer reaches for the stars around it.
    const pointer = this.pointer;
    if (pointer.strength > 0.05) {
      const reach = radius * 1.5;
      for (let i = 0; i < count; i++) {
        const distance = Math.hypot(xs[i] - pointer.x, ys[i] - pointer.y);
        if (distance >= reach) continue;
        const closeness = 1 - distance / reach;
        ctx.strokeStyle = rgba(this.lineColor, closeness * closeness * 0.7 * pointer.strength * lush);
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(xs[i], ys[i]);
        ctx.stroke();
      }
      drawGlow(ctx, this.wandererSprite, pointer.x, pointer.y, 12, 0.5 * pointer.strength);
    }

    for (let i = 0; i < count; i++) {
      const star = this.mid[i];
      const twinkle = 0.7 + 0.3 * Math.sin(clock * star.rate + star.phase);
      const size = star.size * (1 + star.lit * 1.4);
      drawGlow(ctx, star.sprite, xs[i], ys[i], size * 3.6, Math.min(1, (0.7 * twinkle + star.lit) * lush));
    }

    // Calls: rings spreading from whoever called.
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    for (const ring of this.rings) {
      const fade = 1 - ring.age / ring.life;
      ctx.strokeStyle = rgba(this.lineColor, 0.2 * fade * fade * ring.strength * lush);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.age * RING_SPEED, 0, TAU);
      ctx.stroke();
    }

    // The thread between the two wanderers.
    const { ax, ay, bx, by, bendX: controlX, bendY: controlY } = this.wanderers;
    const sent = (this.time * 0.09) % 1;
    for (let i = 1; i < THREAD_DOTS; i++) {
      const s = i / THREAD_DOTS;
      const k = 1 - s;
      const x = k * k * ax + 2 * k * s * controlX + s * s * bx;
      const y = k * k * ay + 2 * k * s * controlY + s * s * by;
      const there = Math.exp(-(((s - sent) * 9) ** 2));
      const back = Math.exp(-(((1 - s - ((sent + 0.5) % 1)) * 9) ** 2));
      const pulse = Math.max(there, back);
      drawGlow(ctx, this.threadSprite, x, y, 2.2 + pulse * 5, (0.16 + 0.75 * pulse) * lush);
    }
    const breath = 1 + 0.08 * Math.sin(clock * 0.9);
    for (const [x, y, beat] of [[ax, ay, breath], [bx, by, 2 - breath]] as const) {
      drawGlow(ctx, this.wandererSprite, x, y, 46 * beat, 0.26 * lush);
      drawGlow(ctx, this.wandererSprite, x, y, 13 * beat, 0.95);
    }

    // Shooting star
    const meteor = this.meteor;
    if (meteor) {
      const fade = Math.sin((meteor.age / meteor.life) * Math.PI);
      const tailX = meteor.x - meteor.vx * 0.16;
      const tailY = meteor.y - meteor.vy * 0.16;
      const tail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      tail.addColorStop(0, rgba(this.farColor, 0.8 * fade));
      tail.addColorStop(1, rgba(this.farColor, 0));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      drawGlow(ctx, this.wandererSprite, meteor.x, meteor.y, 7, 0.8 * fade);
    }

    ctx.restore();
  }
}

export function createLonging(env: SceneEnv): Scene {
  return new LongingScene(env);
}
