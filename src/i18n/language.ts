import { en, type Dictionary } from './en';
import { ptBR } from './pt-BR';

export const LANGUAGES = ['en', 'pt-BR'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DICTIONARIES: Record<Language, Dictionary> = { en, 'pt-BR': ptBR };

/** Short labels for the language switch, each written in its own language. */
export const LANGUAGE_NAMES: Record<Language, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  'pt-BR': { short: 'PT', full: 'Português' },
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Picks the interface language from the browser's ordered preferences: the
 * first entry we can serve wins, and English is the fallback.
 */
export function detectLanguage(preferences: readonly string[] | undefined | null): Language {
  for (const tag of preferences ?? []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en';
  }
  return 'en';
}
