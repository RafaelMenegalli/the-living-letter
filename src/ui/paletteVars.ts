import type { CSSProperties } from 'react';
import { hexToRgb, rgba } from '../engine/color';
import { getPalette } from '../engine/palettes';
import type { Mood } from '../letter/model';

/**
 * Exposes a palette to the stylesheet as custom properties. Whatever element
 * carries these lends its colours to everything inside it: the still backdrop
 * shown before (or instead of) the canvas, the message ink, and the accent
 * used by buttons and focus rings.
 */
export function paletteVars(mood: Mood, palette: number): CSSProperties {
  const colors = getPalette(mood, palette);
  const haze = colors.haze.map(hexToRgb);
  return {
    '--sky-0': colors.sky[0],
    '--sky-1': colors.sky[1],
    '--sky-2': colors.sky[2],
    '--haze-a': rgba(haze[0], 0.42),
    '--haze-b': rgba(haze[1], 0.34),
    '--haze-c': rgba(haze[2 % haze.length], 0.3),
    '--letter-ink': colors.ink,
    '--accent': colors.accent,
    '--accent-soft': rgba(hexToRgb(colors.accent), 0.22),
  } as CSSProperties;
}
