import { describe, expect, it } from 'vitest';
import { PALETTES } from '../engine/palettes';
import { MOODS, VOICES } from '../letter/model';
import { en } from './en';
import { DICTIONARIES, LANGUAGES, detectLanguage, isLanguage } from './language';
import { ptBR } from './pt-BR';

describe('detectLanguage', () => {
  it('serves Portuguese to Portuguese speakers', () => {
    expect(detectLanguage(['pt-BR', 'en-US'])).toBe('pt-BR');
    expect(detectLanguage(['pt-PT'])).toBe('pt-BR');
    expect(detectLanguage(['pt'])).toBe('pt-BR');
  });

  it('respects the order of preference', () => {
    expect(detectLanguage(['en-GB', 'pt-BR'])).toBe('en');
    expect(detectLanguage(['fr-FR', 'pt-BR', 'en'])).toBe('pt-BR');
    expect(detectLanguage(['de', 'en-US', 'pt'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLanguage(['ja-JP', 'fr'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
    expect(detectLanguage(null)).toBe('en');
  });

  it('recognises only the languages it has', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('pt-BR')).toBe(true);
    expect(isLanguage('pt')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(Object.keys(DICTIONARIES).sort()).toEqual([...LANGUAGES].sort());
  });
});

/** Walks two dictionaries together and reports every place their shapes differ. */
function shapeDifferences(a: unknown, b: unknown, path = ''): string[] {
  if (typeof a !== typeof b) return [`${path}: ${typeof a} vs ${typeof b}`];
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: array vs non-array`];
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [`${path}: ${a.length} vs ${b.length} entries`];
    return a.flatMap((item, index) => shapeDifferences(item, b[index], `${path}[${index}]`));
  }
  if (typeof a === 'object' && a !== null && b !== null) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].flatMap((key) =>
      key in left && key in right ? shapeDifferences(left[key], right[key], `${path}.${key}`) : [`${path}.${key}: missing on one side`],
    );
  }
  if (typeof a === 'string' && (a.trim() === '' || (b as string).trim() === '')) return [`${path}: empty text`];
  if (typeof a === 'function' && (a as (...args: unknown[]) => unknown).length !== (b as (...args: unknown[]) => unknown).length) {
    return [`${path}: different parameters`];
  }
  return [];
}

describe('dictionaries', () => {
  it('are complete in both languages', () => {
    expect(shapeDifferences(en, ptBR)).toEqual([]);
  });

  it('name every atmosphere, palette and lettering style', () => {
    for (const dictionary of Object.values(DICTIONARIES)) {
      for (const mood of MOODS) {
        expect(dictionary.moods[mood].name).toBeTruthy();
        expect(dictionary.landing.examples[mood]).toBeTruthy();
        for (const palette of PALETTES[mood]) {
          expect((dictionary.palettes as Record<string, string>)[palette.id], palette.id).toBeTruthy();
        }
      }
      for (const voice of VOICES) expect(dictionary.voices[voice]).toBeTruthy();
    }
  });

  it('interpolate values into sentences', () => {
    expect(en.studio.counter(12, 280)).toContain('12');
    expect(ptBR.studio.counter(12, 280)).toContain('280');
    expect(en.letter.forName('Ana')).toContain('Ana');
    expect(ptBR.letter.forName('Ana')).toContain('Ana');
  });

  it('say plainly that a link is not private', () => {
    expect(en.share.privacy).toMatch(/anyone who gets the link can read it/i);
    expect(ptBR.share.privacy).toMatch(/qualquer pessoa com o link consegue ler/i);
  });
});
