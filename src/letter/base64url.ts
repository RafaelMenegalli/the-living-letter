const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/** URL-safe base64 without padding (RFC 4648 §5). */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63];
  }
  return out;
}

/**
 * Strict decoder: returns null for any character outside the alphabet, for an
 * impossible length, or for non-canonical trailing bits — so every byte
 * sequence has exactly one accepted spelling.
 */
export function fromBase64Url(text: string): Uint8Array | null {
  const length = text.length;
  if (length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((length * 3) / 4));
  let o = 0;
  for (let i = 0; i < length; i += 4) {
    const chunk = Math.min(4, length - i);
    let n = 0;
    for (let j = 0; j < 4; j++) {
      let value = 0;
      if (j < chunk) {
        const code = text.charCodeAt(i + j);
        value = code < 128 ? LOOKUP[code] : -1;
        if (value < 0) return null;
      }
      n = (n << 6) | value;
    }
    if (chunk === 4) {
      out[o++] = n >> 16;
      out[o++] = (n >> 8) & 255;
      out[o++] = n & 255;
    } else if (chunk === 3) {
      if (n & 0xff) return null;
      out[o++] = n >> 16;
      out[o++] = (n >> 8) & 255;
    } else {
      if (n & 0xffff) return null;
      out[o++] = n >> 16;
    }
  }
  return out;
}

/** CRC-16/CCITT-FALSE. Catches links that were truncated or mangled in transit. */
export function crc16(bytes: Uint8Array, seed = 0xffff): number {
  let crc = seed;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
