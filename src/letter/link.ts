import { decodeToken, encodeLetter, type DecodeResult } from './codec';
import { LIMITS, type Letter } from './model';
import type { LetterIssue } from './text';

/**
 * Routing lives entirely in the URL fragment, so the site needs exactly one
 * HTML file and no rewrite rules on the host:
 *
 *   #/                 landing
 *   #/create           studio
 *   #/create/preview   studio, previewing the recipient experience
 *   #/l/<token>        a shared letter
 */
export type Route =
  | { name: 'home' }
  | { name: 'create'; preview: boolean }
  | { name: 'letter'; token: string };

export const PATHS = {
  home: '#/',
  create: '#/create',
  preview: '#/create/preview',
  letter: '#/l/',
} as const;

/**
 * Pulls the token out of whatever followed "#/l/". Chat apps like to glue
 * punctuation onto links or percent-encode them, so anything after the last
 * valid token character is ignored; real damage is caught by the checksum.
 */
export function extractToken(raw: string): string {
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // keep the raw text; it will simply fail to decode
  }
  const match = /^[0-9]{1,4}\.[A-Za-z0-9_-]+/.exec(text.trim());
  return match ? match[0] : text;
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path.startsWith('/l/')) return { name: 'letter', token: extractToken(path.slice(3)) };
  if (path === '/create/preview') return { name: 'create', preview: true };
  if (path === '/create' || path.startsWith('/create/')) return { name: 'create', preview: false };
  return { name: 'home' };
}

/** The page address without query string or fragment — the stem of every share link. */
export function baseUrlOf(href: string): string {
  return href.split('#')[0].split('?')[0];
}

export type ShareIssue = LetterIssue | 'url-too-long';
export type ShareLinkResult = { ok: true; url: string; token: string } | { ok: false; issues: ShareIssue[] };

/** Builds the complete share URL, refusing to produce one that is too long to travel safely. */
export function createShareLink(letter: Letter, baseUrl: string): ShareLinkResult {
  const encoded = encodeLetter(letter);
  if (!encoded.ok) return encoded;
  const url = `${baseUrl}${PATHS.letter}${encoded.token}`;
  if (url.length > LIMITS.urlLength) return { ok: false, issues: ['url-too-long'] };
  return { ok: true, url, token: encoded.token };
}

/** Reads a letter straight from a full URL or bare fragment. */
export function readLetterFromUrl(url: string): DecodeResult {
  const hashIndex = url.indexOf('#');
  const route = parseRoute(hashIndex >= 0 ? url.slice(hashIndex) : '');
  if (route.name !== 'letter') return { ok: false, error: 'malformed' };
  return decodeToken(route.token);
}
