import { describe, expect, it } from 'vitest';
import { crc16, fromBase64Url, toBase64Url } from './base64url';
import { CODEC_VERSION, decodeToken, encodeLetter } from './codec';
import { LIMITS, MOODS, PALETTES_PER_MOOD, VOICES, createLetter, type Letter } from './model';

const sample = (overrides: Partial<Letter> = {}): Letter =>
  createLetter({ message: 'Thinking of you.', to: 'Ana', from: 'Rafa', seed: 0xdecafbad, ...overrides });

function roundTrip(letter: Letter): Letter {
  const encoded = encodeLetter(letter);
  if (!encoded.ok) throw new Error(`encode failed: ${encoded.issues.join(',')}`);
  const decoded = decodeToken(encoded.token);
  if (!decoded.ok) throw new Error(`decode failed: ${decoded.error}`);
  return decoded.letter;
}

/** Builds a structurally arbitrary v1 payload with a *valid* checksum. */
function craft(body: number[], version = 1): string {
  const bytes = new Uint8Array(body.length + 2);
  bytes.set(body);
  const crc = crc16(bytes.subarray(0, body.length), 0xffff ^ version);
  bytes[body.length] = crc >> 8;
  bytes[body.length + 1] = crc & 255;
  return `${version}.${toBase64Url(bytes)}`;
}

// Invisible characters are written as code points, never pasted into the source.
const NUL = String.fromCharCode(0x00);
const BELL = String.fromCharCode(0x07);
const RLO = String.fromCharCode(0x202e);

const utf8 = (text: string) => Array.from(new TextEncoder().encode(text));
/** header + message + empty names */
const body = (flags: number, intensity: number, motion: number, message: number[]) => [
  flags, intensity, motion, 0, 0, 0, 1, message.length >> 8, message.length & 255, ...message, 0, 0,
];

describe('encode → decode', () => {
  it('reconstructs every field exactly', () => {
    const letter = sample({ mood: 'longing', palette: 2, voice: 'hand', intensity: 83, motion: 17 });
    expect(roundTrip(letter)).toEqual(letter);
  });

  it('covers every atmosphere, palette and voice', () => {
    for (const mood of MOODS) {
      for (let palette = 0; palette < PALETTES_PER_MOOD; palette++) {
        for (const voice of VOICES) {
          const letter = sample({ mood, palette, voice });
          expect(roundTrip(letter)).toEqual(letter);
        }
      }
    }
  });

  it('keeps boundary values', () => {
    for (const seed of [0, 1, 0x7fffffff, 0x80000000, 0xffffffff]) {
      expect(roundTrip(sample({ seed })).seed).toBe(seed);
    }
    expect(roundTrip(sample({ intensity: 0, motion: 100 }))).toMatchObject({ intensity: 0, motion: 100 });
    expect(roundTrip(sample({ to: '', from: '' }))).toMatchObject({ to: '', from: '' });
  });

  it('is deterministic and versioned', () => {
    const a = encodeLetter(sample());
    const b = encodeLetter(sample());
    expect(a).toEqual(b);
    expect(a.ok && a.token.startsWith(`${CODEC_VERSION}.`)).toBe(true);
    expect(a.ok && /^[0-9]+\.[A-Za-z0-9_-]+$/.test(a.token)).toBe(true);
  });

  it('preserves Unicode, emoji and line breaks', () => {
    const messages = [
      'Você é a minha canção favorita — coração, saudade, pão de queijo.',
      '春はあけぼの。やうやう白くなりゆく山ぎは',
      'שלום עולם · مرحبا بالعالم',
      'Family 👨‍👩‍👧‍👦 flag 🇧🇷 skin 👋🏽 heart ❤️‍🔥 keycap 1️⃣',
      'First line\nSecond line\n\nAfter a blank line',
      '𝓗𝓮𝓵𝓵𝓸 𝔀𝓸𝓻𝓵𝓭 — astral plane',
    ];
    for (const message of messages) {
      expect(roundTrip(sample({ message })).message).toBe(message.normalize('NFC'));
    }
    expect(roundTrip(sample({ to: 'Mãe 💛', from: 'João' }))).toMatchObject({ to: 'Mãe 💛', from: 'João' });
  });

  it('stores the canonical form of the text', () => {
    const decoded = roundTrip(sample({ message: '  Hello\r\nthere \u0007friend\t!  \n\n\n\nBye\n', to: '  Ana \n Lu ' }));
    expect(decoded.message).toBe('Hello\nthere friend !\n\nBye');
    expect(decoded.to).toBe('Ana Lu');
  });

  it('accepts the largest allowed letter', () => {
    const letter = sample({
      message: 'é'.repeat(LIMITS.messageGraphemes),
      to: 'ã'.repeat(LIMITS.nameGraphemes),
      from: 'õ'.repeat(LIMITS.nameGraphemes),
    });
    expect(roundTrip(letter)).toEqual(letter);
  });
});

describe('encode validation', () => {
  const issuesOf = (letter: Letter) => {
    const result = encodeLetter(letter);
    return result.ok ? [] : result.issues;
  };

  it('rejects empty and whitespace-only messages', () => {
    expect(issuesOf(sample({ message: '' }))).toEqual(['empty']);
    expect(issuesOf(sample({ message: ' \n\t \n' }))).toEqual(['empty']);
  });

  it('enforces the character limit by graphemes, not code units', () => {
    expect(issuesOf(sample({ message: 'a'.repeat(LIMITS.messageGraphemes) }))).toEqual([]);
    expect(issuesOf(sample({ message: 'a'.repeat(LIMITS.messageGraphemes + 1) }))).toEqual(['message-too-long']);
    // 100 family emoji are 100 characters to a person, but far too many bytes for a link.
    expect(issuesOf(sample({ message: '👨‍👩‍👧‍👦'.repeat(100) }))).toEqual(['message-too-heavy']);
  });

  it('enforces name limits', () => {
    expect(issuesOf(sample({ to: 'x'.repeat(LIMITS.nameGraphemes + 1) }))).toEqual(['to-too-long']);
    expect(issuesOf(sample({ from: '👨‍👩‍👧‍👦'.repeat(20) }))).toEqual(['from-too-long']);
  });
});

describe('decode rejects bad input', () => {
  const valid = (() => {
    const encoded = encodeLetter(sample({ message: 'A letter that will be damaged in many ways. 💌' }));
    if (!encoded.ok) throw new Error('fixture');
    return encoded.token;
  })();

  it('rejects non-strings and junk', () => {
    for (const junk of [undefined, null, 42, {}, '', '1', '1.', '.abc', 'abc', '1.@@@', '1.ab cd', 'x.AAAA', '1.AAAA.AAAA']) {
      expect(decodeToken(junk)).toEqual({ ok: false, error: 'malformed' });
    }
  });

  it('rejects every truncation of a valid token', () => {
    for (let length = 0; length < valid.length; length++) {
      expect(decodeToken(valid.slice(0, length)).ok).toBe(false);
    }
  });

  it('rejects any single corrupted character', () => {
    for (let i = 2; i < valid.length; i++) {
      const swapped = valid[i] === 'A' ? 'B' : 'A';
      expect(decodeToken(valid.slice(0, i) + swapped + valid.slice(i + 1)).ok).toBe(false);
    }
  });

  it('rejects oversized tokens before decoding', () => {
    expect(decodeToken(`1.${'A'.repeat(5000)}`)).toEqual({ ok: false, error: 'malformed' });
  });

  it('distinguishes newer versions from garbage', () => {
    const payload = valid.slice(2);
    expect(decodeToken(`2.${payload}`)).toEqual({ ok: false, error: 'unsupported-version' });
    expect(decodeToken(`999.${payload}`)).toEqual({ ok: false, error: 'unsupported-version' });
    expect(decodeToken(`0.${payload}`)).toEqual({ ok: false, error: 'malformed' });
    // The checksum is seeded with the version, so a payload sealed for another
    // version cannot be relabelled as version 1.
    const sealedForV2 = craft(body(0, 50, 50, utf8('hi')), 2);
    expect(decodeToken(`1.${sealedForV2.slice(2)}`)).toEqual({ ok: false, error: 'malformed' });
    expect(decodeToken(craft(body(0, 50, 50, utf8('hi')), 1)).ok).toBe(true);
  });

  it('validates every field even when the checksum is correct', () => {
    const hi = utf8('hi');
    const cases: Record<string, number[]> = {
      'palette out of range': body(3 << 2, 50, 50, hi),
      'voice out of range': body(3 << 4, 50, 50, hi),
      'reserved bits set': body(1 << 6, 50, 50, hi),
      'intensity out of range': body(0, 101, 50, hi),
      'motion out of range': body(0, 50, 255, hi),
      'trailing bytes': [...body(0, 50, 50, hi), 0],
      'message length overruns payload': [0, 50, 50, 0, 0, 0, 1, 0, 200, ...hi, 0, 0],
      'name length overruns payload': [0, 50, 50, 0, 0, 0, 1, 0, 2, ...hi, 9, 0],
      'missing name fields': [0, 50, 50, 0, 0, 0, 1, 0, 2, ...hi],
      'invalid UTF-8': body(0, 50, 50, [0xff, 0xfe, 0xfd]),
      'truncated UTF-8 sequence': body(0, 50, 50, [0xe2, 0x82]),
      'message over the byte limit': body(0, 50, 50, new Array(LIMITS.messageBytes + 1).fill(0x61)),
    };
    for (const [name, bytes] of Object.entries(cases)) {
      expect(decodeToken(craft(bytes)), name).toEqual({ ok: false, error: 'malformed' });
    }
  });

  it('reports an empty letter separately', () => {
    expect(decodeToken(craft(body(0, 50, 50, [])))).toEqual({ ok: false, error: 'empty' });
    expect(decodeToken(craft(body(0, 50, 50, utf8(' \n '))))).toEqual({ ok: false, error: 'empty' });
  });

  it('cleans text that a hand-made link tries to smuggle in', () => {
    const decoded = decodeToken(craft(body(0, 50, 50, utf8('<b>hi</b>' + NUL + RLO + BELL + ' there'))));
    expect(decoded).toMatchObject({ ok: true, letter: { message: '<b>hi</b> there' } });
  });
});

describe('base64url', () => {
  it('round-trips every length and byte value', () => {
    for (let length = 0; length < 70; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + length * 11) & 255);
      const text = toBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(fromBase64Url(text) ?? [])).toEqual(Array.from(bytes));
    }
  });

  it('refuses non-canonical or foreign input', () => {
    expect(fromBase64Url('A')).toBeNull(); // impossible length
    expect(fromBase64Url('AB')).toBeNull(); // dangling bits
    expect(fromBase64Url('AA==')).toBeNull(); // padding is not part of the format
    expect(fromBase64Url('AA+/')).toBeNull(); // standard alphabet
    expect(fromBase64Url('AAé')).toBeNull();
  });
});
