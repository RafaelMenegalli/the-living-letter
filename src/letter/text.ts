import { LIMITS } from './model';

const encoder = new TextEncoder();

/** Size of a string once UTF-8 encoded: the unit the link format budgets in. */
export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}

type GraphemeSegmenter = { segment(input: string): Iterable<{ segment: string }> };
let cachedSegmenter: GraphemeSegmenter | null | undefined;

function getSegmenter(): GraphemeSegmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  try {
    cachedSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  } catch {
    // Older browsers: fall back to code points (over-counts emoji, never under-counts).
    cachedSegmenter = null;
  }
  return cachedSegmenter;
}

/** Splits text into user-perceived characters: a family emoji is one, an accented letter is one. */
export function splitGraphemes(text: string): string[] {
  const segmenter = getSegmenter();
  if (!segmenter) return Array.from(text);
  const parts: string[] = [];
  for (const part of segmenter.segment(text)) parts.push(part.segment);
  return parts;
}

export function countGraphemes(text: string): number {
  return splitGraphemes(text).length;
}

/** Cuts text to at most `max` user-perceived characters, never through the middle of one. */
export function truncateGraphemes(text: string, max: number): string {
  const parts = splitGraphemes(text);
  return parts.length <= max ? text : parts.slice(0, max).join('');
}

/** Drops surrogate halves that have lost their partner (they cannot be encoded). */
function stripLoneSurrogates(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i++;
      }
    } else if (code < 0xdc00 || code > 0xdfff) {
      out += text[i];
    }
  }
  return out;
}

/** Spells a code point as a regex escape, so no invisible characters live in this file. */
const u = (code: number) => '\\u' + code.toString(16).padStart(4, '0');

// Control characters (keeping the line feed), the byte-order mark, and the
// legacy bidi embedding / override controls that can visually reorder text.
// Zero-width joiners stay: emoji sequences and several scripts depend on them.
const DISALLOWED = new RegExp(
  '[' +
    [u(0x00) + '-' + u(0x09), u(0x0b) + '-' + u(0x1f), u(0x7f) + '-' + u(0x9f), u(0xfeff), u(0x202a) + '-' + u(0x202e)].join('') +
    ']',
  'g',
);
// CR, CRLF and the Unicode line / paragraph separators all become a line feed.
const LINE_BREAKS = new RegExp('\\r\\n?|[' + u(0x2028) + u(0x2029) + ']', 'g');
// A long run of combining marks ("zalgo") can spill far outside its line.
const MARK_FLOOD = /(\p{M}{6})\p{M}+/gu;

function scrub(raw: string): string {
  return stripLoneSurrogates(raw)
    .replace(LINE_BREAKS, '\n')
    .replace(/\t/g, ' ')
    .replace(DISALLOWED, '')
    .normalize('NFC')
    .replace(MARK_FLOOD, '$1');
}

/** Keeps the first `maxLines` lines; later line breaks become spaces. */
function capLines(text: string, maxLines: number): string {
  let seen = 0;
  return text.replace(/\n/g, () => (++seen < maxLines ? '\n' : ' '));
}

/**
 * Sanitises message text while it is being typed: unsafe characters go, but
 * trailing spaces and line breaks stay so the caret behaves naturally.
 */
export function cleanMessageDraft(raw: string): string {
  return capLines(scrub(raw), LIMITS.messageLines);
}

/** Canonical form of a message: what is stored in a link and shown to a recipient. */
export function cleanMessage(raw: string): string {
  const tidy = scrub(raw)
    .replace(/[^\S\n]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return capLines(tidy, LIMITS.messageLines);
}

/** Names are single-line. */
export function cleanNameDraft(raw: string): string {
  return scrub(raw).replace(/\s+/g, ' ').replace(/^ /, '');
}

export function cleanName(raw: string): string {
  return cleanNameDraft(raw).trim();
}

export type LetterIssue = 'empty' | 'message-too-long' | 'message-too-heavy' | 'to-too-long' | 'from-too-long';

function nameTooLong(name: string): boolean {
  return countGraphemes(name) > LIMITS.nameGraphemes || utf8Length(name) > LIMITS.nameBytes;
}

/**
 * Checks a letter's text against every limit. Works on canonical text, so a
 * draft with stray whitespace is judged by what would actually be shared.
 */
export function findIssues(letter: { message: string; to: string; from: string }): LetterIssue[] {
  const issues: LetterIssue[] = [];
  const message = cleanMessage(letter.message);
  if (message.length === 0) issues.push('empty');
  if (countGraphemes(message) > LIMITS.messageGraphemes) issues.push('message-too-long');
  else if (utf8Length(message) > LIMITS.messageBytes) issues.push('message-too-heavy');
  if (nameTooLong(cleanName(letter.to))) issues.push('to-too-long');
  if (nameTooLong(cleanName(letter.from))) issues.push('from-too-long');
  return issues;
}
