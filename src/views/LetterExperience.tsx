import { useCallback, useEffect, useRef, useState } from 'react';
import { getPalette } from '../engine/palettes';
import { useI18n } from '../i18n/I18nProvider';
import type { DecodeError } from '../letter/codec';
import { PATHS } from '../letter/link';
import type { Letter } from '../letter/model';
import { useMotion } from '../lib/motion';
import { SponsorSlot } from '../monetization/SponsorSlot';
import { LetterText } from '../ui/LetterText';
import { TopBar } from '../ui/TopBar';
import { Universe } from '../ui/Universe';
import { paletteName } from '../ui/controls';
import { ArrowIcon, BackIcon, DownloadIcon, Mark } from '../ui/icons';
import { paletteVars } from '../ui/paletteVars';
import { ExportDialog } from './ExportDialog';

/** Longest the word-by-word reveal can take before the letter is simply shown. */
const REVEAL_MS = 3600;

interface LetterExperienceProps {
  letter: Letter;
  /** Set when a writer is previewing their own draft; shows a way back to the studio. */
  onExitPreview?: () => void;
}

/**
 * What a recipient sees. The letter arrives sealed; opening it wakes the
 * universe and brings the words in. The reveal is short, and a tap, a key or
 * the "show it all" button ends it at once.
 */
export function LetterExperience({ letter, onExitPreview }: LetterExperienceProps) {
  const { t } = useI18n();
  const { still } = useMotion();
  const [phase, setPhase] = useState<'sealed' | 'opening' | 'open'>('sealed');
  const [exporting, setExporting] = useState(false);
  const article = useRef<HTMLElement>(null);
  const title = letter.to ? t.letter.forName(letter.to) : t.letter.forYou;

  const open = () => setPhase(still ? 'open' : 'opening');
  const finish = useCallback(() => setPhase((current) => (current === 'opening' ? 'open' : current)), []);

  // Hand focus to the letter itself, so a screen reader starts reading it.
  useEffect(() => {
    if (phase === 'opening' || (phase === 'open' && document.activeElement === document.body)) {
      article.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'opening') return;
    const timer = window.setTimeout(finish, REVEAL_MS);
    window.addEventListener('keydown', finish);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', finish);
    };
  }, [phase, finish]);

  return (
    <div className="experience" data-phase={phase} style={paletteVars(letter.mood, letter.palette)}>
      <section className="experience__stage" data-stage onPointerDown={finish}>
        <Universe mood={letter.mood} palette={letter.palette} intensity={letter.intensity} motion={letter.motion} seed={letter.seed} />
        <TopBar />

        {onExitPreview && (
          <div className="preview-bar" data-quiet>
            <p>{t.studio.previewNote}</p>
            <button type="button" className="button button--paper button--small" onClick={onExitPreview}>
              <BackIcon />
              {t.studio.previewBack}
            </button>
          </div>
        )}

        <main id="main" tabIndex={-1} className="experience__main">
          {phase === 'sealed' ? (
            <div className="envelope" data-quiet>
              <Mark size={30} />
              <h1 className="envelope__title" dir="auto">
                {title}
              </h1>
              {letter.from && (
                <p className="envelope__from" dir="auto">
                  {t.letter.fromName(letter.from)}
                </p>
              )}
              <button type="button" className="button button--ink button--large" onClick={open}>
                {t.letter.open}
              </button>
              <p className="envelope__hint">{t.letter.openHint}</p>
            </div>
          ) : (
            <article className="experience__letter" ref={article} tabIndex={-1}>
              <h1 className="visually-hidden">{title}</h1>
              <LetterText message={letter.message} to={letter.to} from={letter.from} voice={letter.voice} mode={phase === 'opening' ? 'reveal' : 'settled'} />
              <p className="visually-hidden">
                {t.common.sceneDescription(t.moods[letter.mood].name, paletteName(t, getPalette(letter.mood, letter.palette).id))}
              </p>
            </article>
          )}
        </main>

        <footer className="experience__foot">
          {phase === 'opening' && (
            <button type="button" className="text-button" onClick={finish}>
              {t.letter.skip}
            </button>
          )}
          {phase === 'open' && (
            <div className="experience__after">
              <p className="experience__made">{t.letter.madeWith}</p>
              <div className="experience__actions">
                <a className="button button--glass" href={PATHS.create}>
                  {t.letter.create}
                  <ArrowIcon />
                </a>
                <button type="button" className="button button--glass" onClick={() => setExporting(true)}>
                  <DownloadIcon />
                  {t.letter.save}
                </button>
              </div>
              <SponsorSlot placement="after-letter" />
            </div>
          )}
        </footer>
      </section>

      <ExportDialog open={exporting} onClose={() => setExporting(false)} letter={letter} />
    </div>
  );
}

/** Shown instead of a letter when the link cannot be read. Always offers a way forward. */
export function LetterProblem({ error }: { error: DecodeError }) {
  const { t } = useI18n();
  const copy = {
    malformed: { title: t.problem.malformedTitle, body: t.problem.malformed },
    'unsupported-version': { title: t.problem.unsupportedTitle, body: t.problem.unsupported },
    empty: { title: t.problem.emptyTitle, body: t.problem.empty },
  }[error];

  return (
    <div className="experience" data-phase="sealed" style={paletteVars('calm', 1)}>
      <section className="experience__stage" data-stage>
        <Universe mood="calm" palette={1} intensity={40} motion={30} seed={7} interactive={false} />
        <TopBar />
        <main id="main" tabIndex={-1} className="experience__main">
          <div className="envelope envelope--problem">
            <Mark size={30} />
            <h1 className="envelope__title">{copy.title}</h1>
            <p className="envelope__body">{copy.body}</p>
            <div className="envelope__actions">
              {error === 'unsupported-version' && (
                <button type="button" className="button button--ink" onClick={() => window.location.reload()}>
                  {t.problem.reload}
                </button>
              )}
              <a className={`button ${error === 'unsupported-version' ? 'button--outline' : 'button--ink'}`} href={PATHS.create}>
                {t.problem.create}
              </a>
              <a className="button button--outline" href={PATHS.home}>
                {t.problem.home}
              </a>
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}
