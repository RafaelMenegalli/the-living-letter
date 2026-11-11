/**
 * The letter is the single source of truth for everything a recipient sees:
 * the words, and every parameter the visual engine needs to rebuild the scene.
 */

export const MOODS = ['calm', 'celebration', 'longing', 'hope'] as const;
export type Mood = (typeof MOODS)[number];

/** Typographic voice the message is set in. */
export const VOICES = ['serif', 'italic', 'hand'] as const;
export type Voice = (typeof VOICES)[number];

/** Every atmosphere ships the same number of art-directed palettes. */
export const PALETTES_PER_MOOD = 3;

export interface Letter {
  message: string;
  /** Optional recipient name. */
  to: string;
  /** Optional signature. */
  from: string;
  mood: Mood;
  /** Index into the mood's palettes, 0 … PALETTES_PER_MOOD - 1. */
  palette: number;
  voice: Voice;
  /** 0 … 100 — how lush and bright the scene is. */
  intensity: number;
  /** 0 … 100 — how lively the scene moves. */
  motion: number;
  /** Unsigned 32-bit seed for every random decision in the scene. */
  seed: number;
}

/**
 * Size limits. Grapheme limits are what a writer sees ("280 characters");
 * byte limits are what the link format enforces, so that a link can never
 * grow past a length that messengers and browsers handle reliably.
 */
export const LIMITS = {
  messageGraphemes: 280,
  messageBytes: 1000,
  messageLines: 12,
  nameGraphemes: 40,
  nameBytes: 120,
  /** Longest share URL we are willing to produce. */
  urlLength: 2000,
} as const;

export function randomSeed(): number {
  try {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0];
  } catch {
    return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  }
}

export function createLetter(overrides: Partial<Letter> = {}): Letter {
  return {
    message: '',
    to: '',
    from: '',
    mood: 'calm',
    palette: 0,
    voice: 'italic',
    intensity: 60,
    motion: 50,
    seed: randomSeed(),
    ...overrides,
  };
}

export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && (MOODS as readonly string[]).includes(value);
}

export function isVoice(value: unknown): value is Voice {
  return typeof value === 'string' && (VOICES as readonly string[]).includes(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Coerces unknown data (for example a draft read back from localStorage) into
 * a well-formed letter. Text fields are passed through `clean` so callers can
 * decide how strict to be; everything else is clamped into its valid range.
 */
export function coerceLetter(
  input: unknown,
  clean: { message: (raw: string) => string; name: (raw: string) => string },
): Letter | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    message: clean.message(text(raw.message)),
    to: clean.name(text(raw.to)),
    from: clean.name(text(raw.from)),
    mood: isMood(raw.mood) ? raw.mood : 'calm',
    palette: clampInt(raw.palette, 0, PALETTES_PER_MOOD - 1, 0),
    voice: isVoice(raw.voice) ? raw.voice : 'italic',
    intensity: clampInt(raw.intensity, 0, 100, 60),
    motion: clampInt(raw.motion, 0, 100, 50),
    seed: clampInt(raw.seed, 0, 0xffff_ffff, 1) >>> 0,
  };
}
