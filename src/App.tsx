import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from './i18n/I18nProvider';
import { decodeToken } from './letter/codec';
import { useRoute } from './lib/hooks';
import { Landing } from './views/Landing';
import { LetterExperience, LetterProblem } from './views/LetterExperience';
import { Studio } from './views/Studio';

/** A shared letter: decoded and validated from the link, or an explanation of why it could not be. */
function SharedLetter({ token }: { token: string }) {
  const result = useMemo(() => decodeToken(token), [token]);
  return result.ok ? <LetterExperience key={token} letter={result.letter} /> : <LetterProblem error={result.error} />;
}

const focusMain = () => document.getElementById('main')?.focus();

export function App() {
  const route = useRoute();
  const { t } = useI18n();
  const firstRender = useRef(true);
  const view = route.name === 'create' && route.preview ? 'preview' : route.name;

  // Page title and description follow the view and the interface language.
  useEffect(() => {
    document.title = route.name === 'create' ? t.meta.createTitle : route.name === 'letter' ? t.meta.letterTitle : t.meta.homeTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description);
  }, [route.name, t]);

  // A new view starts at its top, with focus on its main content — but the first load is left alone.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [view]);

  return (
    <>
      <button type="button" className="skip-link" onClick={focusMain}>
        {t.common.skip}
      </button>
      {route.name === 'home' && <Landing />}
      {route.name === 'create' && <Studio preview={route.preview} />}
      {route.name === 'letter' && <SharedLetter token={route.token} />}
    </>
  );
}
