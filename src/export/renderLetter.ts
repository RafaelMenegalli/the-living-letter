import { hexToRgb, rgba } from '../engine/color';
import { buildComposition, paint, settle } from '../engine/compose';
import { drawGrain } from '../engine/grain';
import { createLayer } from '../engine/paint';
import { getPalette } from '../engine/palettes';
import type { Letter } from '../letter/model';
import { cleanMessage, cleanName, splitGraphemes } from '../letter/text';
import { FONT_SANS, FONT_SERIF, VOICE_STYLES, fontShorthand } from '../ui/typography';
import { fitText } from './layout';

export const EXPORT_FORMATS = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

export interface ExportLabels {
  /** "For Ana" */
  to: (name: string) => string;
  brand: string;
}

/** The picture is composed at half size and rendered at 2×, like a phone screen. */
const SCALE = 2;

/** Waits for the bundled fonts the picture needs, but never for long: system fonts are an acceptable stand-in. */
async function loadFonts(specs: string[], sample: string): Promise<void> {
  if (!document.fonts?.load) return;
  const loading = Promise.all(specs.map((spec) => document.fonts.load(spec, sample))).catch(() => undefined);
  await Promise.race([loading, new Promise((resolve) => setTimeout(resolve, 2500))]);
}

/** Draws letter-spaced text centred on `centerX`; returns its width. Works without `ctx.letterSpacing`. */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, tracking: number): number {
  const glyphs = splitGraphemes(text);
  const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * Math.max(0, glyphs.length - 1);
  let x = centerX - total / 2;
  ctx.textAlign = 'left';
  glyphs.forEach((glyph, index) => {
    ctx.fillText(glyph, x, y);
    x += widths[index] + tracking;
  });
  return total;
}

/**
 * Composes the letter as a still picture: the scene at its settled moment, the
 * message fitted to a centred column, and a small signature mark at the foot.
 * Everything is drawn locally from code and bundled fonts, so the canvas is
 * never tainted and can always be exported.
 */
export async function renderLetterImage(letter: Letter, format: ExportFormat, labels: ExportLabels): Promise<HTMLCanvasElement> {
  const pixels = EXPORT_FORMATS[format];
  const width = pixels.width / SCALE;
  const height = pixels.height / SCALE;
  const message = cleanMessage(letter.message);
  const to = cleanName(letter.to);
  const from = cleanName(letter.from);
  const voice = VOICE_STYLES[letter.voice];
  const palette = getPalette(letter.mood, letter.palette);
  const ink = hexToRgb(palette.ink);
  const shade = hexToRgb(palette.sky[0]);
  const header = to ? labels.to(to).toLocaleUpperCase() : '';
  const signature = from ? `— ${from}` : '';

  await loadFonts(
    [fontShorthand(voice, 40), `italic 400 20px ${FONT_SERIF}`, `600 12px ${FONT_SANS}`],
    `${message}${header}${signature}${labels.brand}`,
  );

  const { canvas, ctx } = createLayer(width, height, SCALE);
  const composition = buildComposition(letter, { width, height, pixelRatio: SCALE, density: 1 });
  settle(composition);
  paint(ctx, composition);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Text column
  const column = width * 0.8;
  const headerBlock = header ? 36 : 0;
  const signatureBlock = signature ? 46 : 0;
  const fitted = fitText(
    message,
    {
      maxWidth: column,
      maxHeight: height * 0.54 - headerBlock - signatureBlock,
      minSize: 11,
      maxSize: (format === 'story' ? 44 : 40) * voice.scale,
      leading: voice.leading,
    },
    (size) => {
      ctx.font = fontShorthand(voice, size);
      return (text) => ctx.measureText(text).width;
    },
  );

  const centerX = width / 2;
  let y = height / 2 - (headerBlock + fitted.height + signatureBlock) / 2;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = rgba(shade, 0.75);
  ctx.shadowBlur = 16;

  if (header) {
    ctx.font = `600 12px ${FONT_SANS}`;
    ctx.fillStyle = rgba(ink, 0.8);
    drawTracked(ctx, header, centerX, y + 13, 2.6);
    y += headerBlock;
  }

  ctx.font = fontShorthand(voice, fitted.size);
  ctx.fillStyle = rgba(ink, 1);
  ctx.textAlign = 'center';
  const lineHeight = fitted.size * voice.leading;
  fitted.lines.forEach((line, index) => {
    ctx.fillText(line, centerX, y + (index + 0.5) * lineHeight + fitted.size * 0.33, column + 8);
  });
  y += fitted.height;

  if (signature) {
    const size = Math.max(14, Math.min(20, fitted.size * 0.56));
    ctx.font = `italic 400 ${size}px ${FONT_SERIF}`;
    ctx.fillStyle = rgba(ink, 0.86);
    ctx.fillText(signature, centerX, y + 34, column);
  }

  // Maker's mark: a point of light with one orbit, and the name, kept quiet.
  ctx.shadowBlur = 8;
  ctx.font = `600 9px ${FONT_SANS}`;
  ctx.fillStyle = rgba(ink, 0.6);
  const brandY = height - 30;
  const brandWidth = drawTracked(ctx, labels.brand.toLocaleUpperCase(), centerX + 10, brandY, 2.4);
  const markX = centerX + 10 - brandWidth / 2 - 15;
  const markY = brandY - 3.2;
  ctx.beginPath();
  ctx.arc(markX, markY, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(ink, 0.6);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(markX, markY, 8, 3.4, -0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  drawGrain(ctx, pixels.width, pixels.height);
  return canvas;
}
