import { splitGraphemes } from '../letter/text';

/** Measures the rendered width of a string, in the same units as `maxWidth`. */
export type Measure = (text: string) => number;

/** Breaks a single over-long word into pieces that each fit, never splitting a grapheme. */
function breakWord(word: string, maxWidth: number, measure: Measure): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const grapheme of splitGraphemes(word)) {
    if (current && measure(current + grapheme) > maxWidth) {
      pieces.push(current);
      current = grapheme;
    } else {
      current += grapheme;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Greedy word wrap that honours the writer's own line breaks. Words too long
 * for a line (URLs, text in scripts without spaces) are broken rather than
 * allowed to overflow.
 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word) <= maxWidth) {
        line = word;
      } else {
        const pieces = breakWord(word, maxWidth, measure);
        line = pieces.pop() ?? '';
        lines.push(...pieces);
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  minSize: number;
  maxSize: number;
  /** Line height as a multiple of the font size. */
  leading: number;
}

export interface FittedText {
  lines: string[];
  size: number;
  /** Total block height: lines × size × leading. */
  height: number;
  /** True if even the smallest size could not hold the whole text. */
  clipped: boolean;
}

/**
 * Finds the largest font size at which the text fits the box. If nothing
 * fits, the smallest size is used and the overflow is cut with an ellipsis —
 * the text is never allowed to run past its box.
 */
export function fitText(text: string, options: FitOptions, measureAt: (size: number) => Measure): FittedText {
  const { maxWidth, maxHeight, minSize, maxSize, leading } = options;
  const layout = (size: number) => {
    const lines = wrapText(text, maxWidth, measureAt(size));
    return { lines, size, height: lines.length * size * leading };
  };

  let low = Math.floor(minSize);
  let high = Math.floor(maxSize);
  let best = layout(low);
  if (best.height > maxHeight) {
    const keep = Math.max(1, Math.floor(maxHeight / (low * leading)));
    const lines = best.lines.slice(0, keep);
    lines[keep - 1] = `${lines[keep - 1].replace(/\s+$/, '')}…`;
    return { lines, size: low, height: keep * low * leading, clipped: true };
  }
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const attempt = layout(middle);
    if (attempt.height <= maxHeight) {
      best = attempt;
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return { ...best, clipped: false };
}
