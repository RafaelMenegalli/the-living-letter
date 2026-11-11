import { useId } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGES, LANGUAGE_NAMES } from '../i18n/language';
import { PATHS } from '../letter/link';
import { useMotion } from '../lib/motion';
import { Mark, PauseIcon, PlayIcon } from './icons';

/** Wordmark that leads home. */
export function Wordmark() {
  const { t } = useI18n();
  return (
    <a className="wordmark" href={PATHS.home}>
      <Mark />
      <span className="wordmark__name">{t.brand}</span>
    </a>
  );
}

export function MotionToggle() {
  const { t } = useI18n();
  const { still, fromDevice, toggle } = useMotion();
  const noteId = useId();
  const label = still ? t.common.playMotion : t.common.pauseMotion;
  return (
    <>
      {/* Say why nothing is moving, and that it is a choice the visitor can change. */}
      {fromDevice && (
        <span id={noteId} className="motion-note">
          {t.common.reducedNote}
        </span>
      )}
      <button type="button" className="chip-button" onClick={toggle} aria-label={label} aria-describedby={fromDevice ? noteId : undefined} title={label}>
        {still ? <PlayIcon /> : <PauseIcon />}
      </button>
    </>
  );
}

export function LanguageSwitch() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t.common.language}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-switch__option"
          lang={code}
          aria-pressed={lang === code}
          aria-label={LANGUAGE_NAMES[code].full}
          title={LANGUAGE_NAMES[code].full}
          onClick={() => setLang(code)}
        >
          {LANGUAGE_NAMES[code].short}
        </button>
      ))}
    </div>
  );
}

/** The strip of global controls shared by every view. */
export function TopBar({ className }: { className?: string }) {
  return (
    <header className={`topbar${className ? ` ${className}` : ''}`}>
      <Wordmark />
      <div className="topbar__tools">
        <MotionToggle />
        <LanguageSwitch />
      </div>
    </header>
  );
}
