import type { Voice } from '../letter/model';

/**
 * Font stacks, shared by the stylesheet (via CSS variables) and the canvas
 * export. The first family in each is bundled with the site; the rest are
 * system fonts, so text still looks intentional if a font file fails to load.
 */
export const FONT_SERIF = '"Fraunces Variable", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
export const FONT_SANS = '"Hanken Grotesk Variable", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const FONT_HAND = '"Caveat Variable", "Segoe Print", "Bradley Hand", "Snell Roundhand", cursive';

export interface VoiceStyle {
  family: string;
  style: 'normal' | 'italic';
  weight: number;
  /** Optical compensation: handwriting needs to be set larger to read as the same size. */
  scale: number;
  /** Line height as a multiple of font size. */
  leading: number;
}

export const VOICE_STYLES: Record<Voice, VoiceStyle> = {
  serif: { family: FONT_SERIF, style: 'normal', weight: 380, scale: 1, leading: 1.3 },
  italic: { family: FONT_SERIF, style: 'italic', weight: 380, scale: 1.03, leading: 1.3 },
  hand: { family: FONT_HAND, style: 'normal', weight: 500, scale: 1.3, leading: 1.14 },
};

/** A CSS `font` shorthand, as the canvas API and `document.fonts.load` expect it. */
export function fontShorthand(voice: VoiceStyle, size: number): string {
  return `${voice.style} ${voice.weight} ${size}px ${voice.family}`;
}
