import { createLayer } from './paint';
import { createRng } from './rng';

const TILE = 160;
let tile: HTMLCanvasElement | null = null;

/**
 * A small tile of film grain: sparse light and dark specks at very low
 * opacity. It takes the digital edge off smooth gradients and hides banding.
 * Generated once, in code, so there is no image file to ship or to taint a canvas.
 */
export function grainTile(): HTMLCanvasElement {
  if (tile) return tile;
  const { canvas, ctx } = createLayer(TILE, TILE, 1);
  const image = ctx.createImageData(TILE, TILE);
  const rng = createRng(0x51f15eed);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = rng() < 0.5 ? 0 : 255;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = Math.floor(rng() * rng() * 34);
  }
  ctx.putImageData(image, 0, 0);
  tile = canvas;
  return canvas;
}

/** The grain as a data URL for use as a CSS background, or null where canvas is unavailable. */
export function grainDataUrl(): string | null {
  try {
    return grainTile().toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Lays grain over a whole canvas, one device pixel per grain pixel. */
export function drawGrain(ctx: CanvasRenderingContext2D, pixelWidth: number, pixelHeight: number): void {
  const pattern = ctx.createPattern(grainTile(), 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  ctx.restore();
}
