import { describe, expect, it } from 'vitest';
import { splitGraphemes } from '../letter/text';
import { fitText, wrapText, type Measure } from './layout';

/** A stand-in for canvas text metrics: every grapheme is `size × 0.5` wide. */
const measureAt = (size: number): Measure => (text) => splitGraphemes(text).length * size * 0.5;
const measure10 = measureAt(20); // 10 units per grapheme

describe('wrapText', () => {
  it('wraps on spaces and never exceeds the width', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog', 100, measure10);
    expect(lines).toEqual(['the quick', 'brown fox', 'jumps over', 'the lazy', 'dog']);
    for (const line of lines) expect(measure10(line)).toBeLessThanOrEqual(100);
  });

  it('keeps the writer’s own line breaks, including blank lines', () => {
    expect(wrapText('one\ntwo\n\nfour', 500, measure10)).toEqual(['one', 'two', '', 'four']);
  });

  it('breaks a word that is longer than a whole line', () => {
    const lines = wrapText('see https://example.org/a/very/long/path now', 100, measure10);
    // Nothing is lost, and the tail of the broken word shares its line with what follows.
    expect(lines.join('').replace(/ /g, '')).toBe('seehttps://example.org/a/very/long/pathnow');
    expect(lines).toEqual(['see', 'https://ex', 'ample.org/', 'a/very/lon', 'g/path now']);
    for (const line of lines) expect(measure10(line)).toBeLessThanOrEqual(100);
  });

  it('breaks text written without spaces, and never splits an emoji', () => {
    const lines = wrapText('春はあけぼのやうやう白くなりゆく山ぎは', 60, measure10);
    for (const line of lines) expect(splitGraphemes(line).length).toBeLessThanOrEqual(6);
    expect(lines.join('')).toBe('春はあけぼのやうやう白くなりゆく山ぎは');

    const family = '👨‍👩‍👧‍👦';
    const emojiLines = wrapText(family.repeat(7), 30, measure10);
    expect(emojiLines).toEqual([family.repeat(3), family.repeat(3), family]);
  });

  it('collapses runs of spaces and handles empty input', () => {
    expect(wrapText('a    b', 500, measure10)).toEqual(['a b']);
    expect(wrapText('', 500, measure10)).toEqual(['']);
  });
});

describe('fitText', () => {
  const box = { maxWidth: 400, maxHeight: 300, minSize: 10, maxSize: 60, leading: 1.25 };

  it('sets a short message as large as allowed', () => {
    const fitted = fitText('Hi', box, measureAt);
    expect(fitted.size).toBe(60);
    expect(fitted.lines).toEqual(['Hi']);
    expect(fitted.clipped).toBe(false);
  });

  it('finds the largest size that still fits, and it does fit', () => {
    const text = 'Some words deserve a little more room than a single line can give them, so they wrap.';
    const fitted = fitText(text, box, measureAt);
    expect(fitted.size).toBeLessThan(60);
    expect(fitted.size).toBeGreaterThan(10);
    expect(fitted.height).toBeLessThanOrEqual(box.maxHeight);
    for (const line of fitted.lines) expect(measureAt(fitted.size)(line)).toBeLessThanOrEqual(box.maxWidth);
    // One size up would overflow: this really is the largest.
    const bigger = wrapText(text, box.maxWidth, measureAt(fitted.size + 1));
    expect(bigger.length * (fitted.size + 1) * box.leading).toBeGreaterThan(box.maxHeight);
  });

  it('fits the longest allowed message into an export-sized column without clipping', () => {
    const longest = 'W'.repeat(280).replace(/(.{7})/g, '$1 ');
    const fitted = fitText(longest, { maxWidth: 432, maxHeight: 300, minSize: 11, maxSize: 40, leading: 1.3 }, measureAt);
    expect(fitted.clipped).toBe(false);
    expect(fitted.height).toBeLessThanOrEqual(300);
  });

  it('cuts with an ellipsis rather than overflow when nothing fits', () => {
    const fitted = fitText('word '.repeat(400), { ...box, maxHeight: 40 }, measureAt);
    expect(fitted.clipped).toBe(true);
    expect(fitted.size).toBe(10);
    expect(fitted.height).toBeLessThanOrEqual(40);
    expect(fitted.lines.at(-1)?.endsWith('…')).toBe(true);
  });
});
