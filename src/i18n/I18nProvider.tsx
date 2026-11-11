import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readStored, writeStored } from '../lib/storage';
import { en, type Dictionary } from './en';
import { DICTIONARIES, detectLanguage, isLanguage, type Language } from './language';

const STORAGE_KEY = 'living-letter.language';

interface I18n {
  lang: Language;
  t: Dictionary;
  setLang: (lang: Language) => void;
}

const I18nContext = createContext<I18n>({ lang: 'en', t: en, setLang: () => undefined });

function initialLanguage(): Language {
  const stored = readStored(STORAGE_KEY);
  if (isLanguage(stored)) return stored;
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detectLanguage(preferences);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    writeStored(STORAGE_KEY, next);
  }, []);

  // Keep the document itself honest about its language, for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(() => ({ lang, t: DICTIONARIES[lang], setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
