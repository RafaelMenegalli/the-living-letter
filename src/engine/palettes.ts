import { PALETTES_PER_MOOD, type Mood } from '../letter/model';
import { hexToRgb, type RGB } from './color';

/**
 * A palette is art direction, not a colour picker: a night-sky gradient, the
 * large soft lights that drift behind everything, the bright colours scenes
 * draw with, the colour the message is set in, and one accent the interface
 * borrows for buttons and focus rings.
 */
export interface Palette {
  id: string;
  /** Background gradient, top → middle → bottom. */
  sky: readonly [string, string, string];
  haze: readonly string[];
  lights: readonly string[];
  ink: string;
  accent: string;
}

export const PALETTES: Record<Mood, readonly Palette[]> = {
  calm: [
    {
      id: 'lagoon',
      sky: ['#03161a', '#06272c', '#0a3a3d'],
      haze: ['#157a78', '#2a9d8f', '#1b4f72'],
      lights: ['#9be8d8', '#d8fff4', '#6fc7c0', '#f2e9c9'],
      ink: '#effaf6',
      accent: '#8fe3d0',
    },
    {
      id: 'mist',
      sky: ['#0b0e24', '#191b40', '#2b2854'],
      haze: ['#4f55c4', '#9a7fd1', '#2e5fa8'],
      lights: ['#c9c4ff', '#eadfff', '#9fb4ff', '#ffd9ec'],
      ink: '#f4f1ff',
      accent: '#c3b8ff',
    },
    {
      id: 'moss',
      sky: ['#0b120d', '#152117', '#22301d'],
      haze: ['#4a7a4f', '#a3b36f', '#2f6b5a'],
      lights: ['#cfe3b4', '#f1ecd0', '#9cc59a', '#e9d9a6'],
      ink: '#f6f6ea',
      accent: '#cfe3b4',
    },
  ],
  celebration: [
    {
      id: 'carnival',
      sky: ['#170520', '#2a0a33', '#3c0d38'],
      haze: ['#c2187a', '#ff7a3d', '#6a2bd9'],
      lights: ['#ff4fa3', '#ffc53d', '#ff7a59', '#5ce1e6', '#fff3d6'],
      ink: '#fff6f0',
      accent: '#ffc53d',
    },
    {
      id: 'champagne',
      sky: ['#100b06', '#1d150a', '#2c1f10'],
      haze: ['#b8862b', '#e6c98a', '#8a4b2a'],
      lights: ['#ffe6a8', '#fff6dc', '#f2c36b', '#ffb38a', '#e8d8c0'],
      ink: '#fff8ea',
      accent: '#f2c36b',
    },
    {
      id: 'electric',
      sky: ['#050920', '#0b103c', '#180f58'],
      haze: ['#3f5bff', '#c63dff', '#00b3c7'],
      lights: ['#6ef3ff', '#ff5ccd', '#b6ff5c', '#ffe45c', '#ffffff'],
      ink: '#f4f6ff',
      accent: '#6ef3ff',
    },
  ],
  longing: [
    {
      id: 'midnight',
      sky: ['#02040b', '#070b1c', '#0d142e'],
      haze: ['#1c2f6b', '#3a4f9c', '#14365c'],
      lights: ['#dfe9ff', '#a9c2ff', '#ffffff', '#ffe9c4'],
      ink: '#eef2ff',
      accent: '#a9c2ff',
    },
    {
      id: 'ember',
      sky: ['#0e0406', '#1c0a0f', '#2c0f17'],
      haze: ['#7a1f35', '#c2553a', '#4a1830'],
      lights: ['#ffd7c2', '#ffb199', '#fff1e0', '#ff8a70'],
      ink: '#fff3ec',
      accent: '#ffb199',
    },
    {
      id: 'violet',
      sky: ['#0a0514', '#150b2b', '#241343'],
      haze: ['#4b2a8a', '#8a4fb0', '#2a2f7a'],
      lights: ['#e6d4ff', '#c3a6ff', '#fff0d6', '#ffb8e0'],
      ink: '#f6efff',
      accent: '#c3a6ff',
    },
  ],
  hope: [
    {
      id: 'firstlight',
      sky: ['#0a0f24', '#1d1b45', '#54304f'],
      haze: ['#ff9d5c', '#ffd08a', '#7a4fb8'],
      lights: ['#ffe2a8', '#ffb37a', '#fff4d6', '#ff8fa3'],
      ink: '#fff7ea',
      accent: '#ffcf8a',
    },
    {
      id: 'verdant',
      sky: ['#04110d', '#0a281f', '#17452c'],
      haze: ['#3fbf7f', '#d9e86a', '#1f8a7a'],
      lights: ['#c9ffb8', '#f0ffb0', '#8ff0c0', '#fff3a0'],
      ink: '#f4fff0',
      accent: '#c9ffb8',
    },
    {
      id: 'rose',
      sky: ['#150717', '#30102c', '#5e2240'],
      haze: ['#ff6f91', '#ffc1a1', '#a04fb8'],
      lights: ['#ffd1dc', '#ffe9c9', '#ff9ebb', '#ffffff'],
      ink: '#fff4f4',
      accent: '#ffb3c6',
    },
  ],
};

export function getPalette(mood: Mood, index: number): Palette {
  const list = PALETTES[mood];
  const safe = Number.isInteger(index) && index >= 0 && index < PALETTES_PER_MOOD ? index : 0;
  return list[safe];
}

/** A palette with its colours parsed once, ready for per-frame use. */
export interface PaletteColors {
  sky: readonly RGB[];
  haze: readonly RGB[];
  lights: readonly RGB[];
  ink: RGB;
}

export function resolvePalette(palette: Palette): PaletteColors {
  return {
    sky: palette.sky.map(hexToRgb),
    haze: palette.haze.map(hexToRgb),
    lights: palette.lights.map(hexToRgb),
    ink: hexToRgb(palette.ink),
  };
}
