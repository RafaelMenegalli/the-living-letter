import { crc16, fromBase64Url, toBase64Url } from './base64url';
import { LIMITS, MOODS, PALETTES_PER_MOOD, VOICES, type Letter } from './model';
import { cleanMessage, cleanName, findIssues, type LetterIssue } from './text';

/**
 * Share token format:  "<version>.<base64url(payload)>"
 *
 * Version 1 payload (big-endian):
 *   byte 0      mood (bits 0-1) | palette (bits 2-3) | voice (bits 4-5) | reserved 00
 *   byte 1      intensity, 0-100
 *   byte 2      motion, 0-100
 *   bytes 3-6   seed, uint32
 *   uint16 + n  message, UTF-8
 *   uint8 + n   recipient name, UTF-8
 *   uint8 + n   signature, UTF-8
 *   uint16      CRC-16 of everything above (seeded with the version)
 *
 * The decoder accepts exactly this shape and nothing else: every field is range
 * checked, lengths are bounded, and no trailing bytes are tolerated.
 */
export const CODEC_VERSION = 1;

/** Upper bound checked before any decoding work is done. */
const MAX_TOKEN_LENGTH = 2000;
const HEADER_BYTES = 7;
const MIN_PAYLOAD_BYTES = HEADER_BYTES + 2 + 1 + 1 + 2;

export type DecodeError = 'malformed' | 'unsupported-version' | 'empty';
export type DecodeResult = { ok: true; letter: Letter } | { ok: false; error: DecodeError };
export type EncodeResult = { ok: true; token: string } | { ok: false; issues: LetterIssue[] };

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });

const checksumSeed = (version: number) => 0xffff ^ version;
const clampByte = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value) || 0));

export function encodeLetter(letter: Letter): EncodeResult {
  const issues = findIssues(letter);
  if (issues.length > 0) return { ok: false, issues };

  const message = encoder.encode(cleanMessage(letter.message));
  const to = encoder.encode(cleanName(letter.to));
  const from = encoder.encode(cleanName(letter.from));

  const mood = Math.max(0, MOODS.indexOf(letter.mood));
  const voice = Math.max(0, VOICES.indexOf(letter.voice));
  const palette = clampByte(letter.palette, PALETTES_PER_MOOD - 1);
  const seed = letter.seed >>> 0;

  const bytes = new Uint8Array(HEADER_BYTES + 2 + message.length + 1 + to.length + 1 + from.length + 2);
  let o = 0;
  bytes[o++] = mood | (palette << 2) | (voice << 4);
  bytes[o++] = clampByte(letter.intensity, 100);
  bytes[o++] = clampByte(letter.motion, 100);
  bytes[o++] = seed >>> 24;
  bytes[o++] = (seed >>> 16) & 255;
  bytes[o++] = (seed >>> 8) & 255;
  bytes[o++] = seed & 255;
  bytes[o++] = message.length >> 8;
  bytes[o++] = message.length & 255;
  bytes.set(message, o);
  o += message.length;
  bytes[o++] = to.length;
  bytes.set(to, o);
  o += to.length;
  bytes[o++] = from.length;
  bytes.set(from, o);
  o += from.length;
  const crc = crc16(bytes.subarray(0, o), checksumSeed(CODEC_VERSION));
  bytes[o++] = crc >> 8;
  bytes[o] = crc & 255;

  return { ok: true, token: `${CODEC_VERSION}.${toBase64Url(bytes)}` };
}

const MALFORMED: DecodeResult = { ok: false, error: 'malformed' };

function decodeV1(bytes: Uint8Array): DecodeResult {
  if (bytes.length < MIN_PAYLOAD_BYTES) return MALFORMED;
  const body = bytes.subarray(0, bytes.length - 2);
  const expected = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
  if (crc16(body, checksumSeed(1)) !== expected) return MALFORMED;

  const flags = body[0];
  const mood = flags & 3;
  const palette = (flags >> 2) & 3;
  const voice = (flags >> 4) & 3;
  if (flags >> 6 !== 0 || palette >= PALETTES_PER_MOOD || voice >= VOICES.length) return MALFORMED;

  const intensity = body[1];
  const motion = body[2];
  if (intensity > 100 || motion > 100) return MALFORMED;
  const seed = ((body[3] << 24) | (body[4] << 16) | (body[5] << 8) | body[6]) >>> 0;

  let o = HEADER_BYTES;
  const takeText = (length: number, maxBytes: number): string | null => {
    if (length > maxBytes || o + length > body.length) return null;
    try {
      const text = strictDecoder.decode(body.subarray(o, o + length));
      o += length;
      return text;
    } catch {
      return null; // not valid UTF-8
    }
  };

  const messageLength = (body[o] << 8) | body[o + 1];
  o += 2;
  const rawMessage = takeText(messageLength, LIMITS.messageBytes);
  if (rawMessage === null || o >= body.length) return MALFORMED;
  const rawTo = takeText(body[o++], LIMITS.nameBytes);
  if (rawTo === null || o >= body.length) return MALFORMED;
  const rawFrom = takeText(body[o++], LIMITS.nameBytes);
  if (rawFrom === null || o !== body.length) return MALFORMED;

  // Decoded text is untrusted: it goes through the same cleaning as typed text.
  const message = cleanMessage(rawMessage);
  if (message.length === 0) return { ok: false, error: 'empty' };

  return {
    ok: true,
    letter: {
      message,
      to: cleanName(rawTo),
      from: cleanName(rawFrom),
      mood: MOODS[mood],
      palette,
      voice: VOICES[voice],
      intensity,
      motion,
      seed,
    },
  };
}

/** Turns a share token back into a letter, or explains why it cannot. */
export function decodeToken(token: unknown): DecodeResult {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return MALFORMED;
  const match = /^([0-9]{1,4})\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return MALFORMED;

  const version = Number(match[1]);
  if (version > CODEC_VERSION) return { ok: false, error: 'unsupported-version' };
  if (version !== 1) return MALFORMED;

  const bytes = fromBase64Url(match[2]);
  return bytes ? decodeV1(bytes) : MALFORMED;
}
