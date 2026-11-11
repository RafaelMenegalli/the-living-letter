export type RGB = readonly [number, number, number];

export function hexToRgb(hex: string): RGB {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgba(color: RGB, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha < 0 ? 0 : alpha > 1 ? 1 : +alpha.toFixed(4)})`;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function luminance(color: RGB): number {
  return 0.2126 * channelToLinear(color[0]) + 0.7152 * channelToLinear(color[1]) + 0.0722 * channelToLinear(color[2]);
}

/** WCAG contrast ratio between two colours, 1 … 21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
