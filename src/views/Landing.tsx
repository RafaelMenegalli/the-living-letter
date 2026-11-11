import { useId, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { PATHS } from '../letter/link';
import { MOODS, type Mood, type Voice } from '../letter/model';
import { SponsorSlot } from '../monetization/SponsorSlot';
import { LetterText } from '../ui/LetterText';
import { TopBar, Wordmark } from '../ui/TopBar';
import { Universe } from '../ui/Universe';
import { ArrowIcon } from '../ui/icons';
import { paletteVars } from '../ui/paletteVars';

/** The four example letters. Fixed seeds, so the first impression is a composition we have looked at. */
const EXAMPLES: Record<Mood, { seed: number; palette: number; voice: Voice }> = {
  calm: { seed: 20240611, palette: 0, voice: 'italic' },
  celebration: { seed: 77301, palette: 0, voice: 'hand' },
  longing: { seed: 4410, palette: 0, voice: 'serif' },
  hope: { seed: 981234, palette: 0, voice: 'italic' },
};

export function Landing() {
  const { t } = useI18n();
  const [mood, setMood] = useState<Mood>('hope');
  const chipName = useId();
  const example = EXAMPLES[mood];

  return (
    <div className="landing" style={paletteVars(mood, example.palette)}>
      <main id="main" tabIndex={-1}>
        <section className="hero" data-stage>
          <Universe mood={mood} palette={example.palette} intensity={72} motion={55} seed={example.seed} />
          <TopBar />

          <figure className="hero__letter">
            <figcaption className="eyebrow">{t.landing.exampleLabel(t.moods[mood].name)}</figcaption>
            <LetterText key={mood} message={t.landing.examples[mood]} to="" from="" voice={example.voice} mode="reveal" />
            <p className="hero__hint">{t.landing.hint}</p>
          </figure>

          <div className="hero__foot">
            <div className="hero__pitch">
              <h1 className="hero__title">{t.landing.title}</h1>
              <p className="hero__lede">{t.landing.lede}</p>
            </div>
            <div className="hero__actions">
              <fieldset className="chips">
                <legend className="visually-hidden">{t.landing.moodPicker}</legend>
                {MOODS.map((option) => (
                  <label key={option} className="chip" style={paletteVars(option, EXAMPLES[option].palette)}>
                    <input type="radio" className="visually-hidden" name={chipName} checked={option === mood} onChange={() => setMood(option)} />
                    <span className="chip__body">
                      <span className="chip__dot" aria-hidden="true" />
                      {t.moods[option].name}
                    </span>
                  </label>
                ))}
              </fieldset>
              <a className="button button--primary button--large" href={PATHS.create}>
                {t.landing.cta}
                <ArrowIcon />
              </a>
              <p className="hero__note">{t.landing.note}</p>
            </div>
          </div>
        </section>

        <section className="about paper">
          <div className="about__grid">
            <div>
              <h2 className="about__heading">{t.landing.howTitle}</h2>
              <ol className="steps">
                {t.landing.steps.map((step, index) => (
                  <li key={step.title} className="steps__item">
                    <span className="steps__number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="steps__title">{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="about__heading">{t.landing.knowTitle}</h2>
              <ul className="notes">
                {t.landing.know.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <SponsorSlot placement="landing" />

          <div className="closing">
            <h2 className="closing__title">{t.landing.closingTitle}</h2>
            <a className="button button--ink button--large" href={PATHS.create}>
              {t.landing.cta}
              <ArrowIcon />
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Wordmark />
        <p>{t.landing.footer}</p>
      </footer>
    </div>
  );
}
