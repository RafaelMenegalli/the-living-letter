import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type CompositionEvent } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { draftStore } from '../letter/draft';
import { PATHS } from '../letter/link';
import { LIMITS, randomSeed, type Letter } from '../letter/model';
import { cleanMessage, cleanName, countGraphemes, findIssues } from '../letter/text';
import { navigate } from '../lib/hooks';
import { LetterText } from '../ui/LetterText';
import { TopBar } from '../ui/TopBar';
import { Universe } from '../ui/Universe';
import { MoodPicker, PalettePicker, Slider, VoicePicker } from '../ui/controls';
import { DownloadIcon, EyeIcon, SendIcon, SparkIcon } from '../ui/icons';
import { paletteVars } from '../ui/paletteVars';
import { ExportDialog } from './ExportDialog';
import { LetterExperience } from './LetterExperience';
import { ShareDialog } from './ShareDialog';
import { issueText } from './issues';

type TextField = 'message' | 'to' | 'from';
type FieldElement = HTMLTextAreaElement | HTMLInputElement;

/** Change handlers for a text field of the draft, aware of input-method composition. */
function bind(field: TextField) {
  return {
    onChange: (event: ChangeEvent<FieldElement>) =>
      draftStore.patch({ [field]: event.target.value }, (event.nativeEvent as InputEvent).isComposing === true),
    onCompositionEnd: (event: CompositionEvent<FieldElement>) => draftStore.patch({ [field]: event.currentTarget.value }),
  };
}

/** A short, human way to name a seed: "4F2A". */
const variationCode = (seed: number) => (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);

/**
 * The creation studio: a sheet of paper to write on, beside (or, on a phone,
 * beneath) the living preview of what the recipient will get.
 */
export function Studio({ preview }: { preview: boolean }) {
  const { t } = useI18n();
  const letter = useSyncExternalStore(draftStore.subscribe, draftStore.get);
  const [dialog, setDialog] = useState<'share' | 'export' | null>(null);
  const [nudged, setNudged] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [restored] = useState(draftStore.wasRestored);
  const messageField = useRef<HTMLTextAreaElement>(null);
  const messageId = useId();
  const counterId = useId();
  const errorId = useId();
  const toId = useId();
  const fromId = useId();

  /** The letter exactly as it would be shared: canonical text, same settings. */
  const shown = useMemo<Letter>(
    () => ({ ...letter, message: cleanMessage(letter.message), to: cleanName(letter.to), from: cleanName(letter.from) }),
    [letter],
  );
  const issues = useMemo(() => findIssues(shown), [shown]);
  const ready = issues.length === 0;
  const used = countGraphemes(letter.message);
  const full = used >= LIMITS.messageGraphemes;

  // "We kept your draft" is said once per visit.
  useEffect(() => draftStore.acknowledgeRestored(), []);

  // A preview needs something to preview; otherwise fall back to the editor.
  useEffect(() => {
    if (preview && !ready) navigate(PATHS.create);
  }, [preview, ready]);

  const attempt = (action: 'share' | 'export' | 'preview') => {
    if (!ready) {
      setNudged(true);
      messageField.current?.focus();
      return;
    }
    if (action === 'preview') navigate(PATHS.preview);
    else setDialog(action);
  };

  if (preview && ready) {
    return <LetterExperience letter={shown} onExitPreview={() => navigate(PATHS.create)} />;
  }

  const messageIssue = issues.find((issue) => issue === 'message-too-heavy' || issue === 'message-too-long' || (nudged && issue === 'empty'));
  const toIssue = issues.includes('to-too-long');
  const fromIssue = issues.includes('from-too-long');

  return (
    <div className="studio" style={paletteVars(letter.mood, letter.palette)}>
      <section className="studio__stage" data-stage aria-label={t.studio.stageLabel}>
        <Universe mood={letter.mood} palette={letter.palette} intensity={letter.intensity} motion={letter.motion} seed={letter.seed} />
        <div className="studio__stage-text">
          {shown.message ? (
            <LetterText message={shown.message} to={shown.to} from={shown.from} voice={shown.voice} />
          ) : (
            <p className="studio__placeholder">{t.studio.stagePlaceholder}</p>
          )}
        </div>
      </section>

      <div className="studio__panel paper">
        <TopBar className="topbar--paper" />

        <main id="main" tabIndex={-1} className="studio__form">
          <h1 className="studio__title">{t.studio.title}</h1>
          {restored && <p className="studio__restored">{t.studio.draftRestored}</p>}

          <div className="field">
            <label className="field__label" htmlFor={messageId}>
              {t.studio.message}
            </label>
            <textarea
              id={messageId}
              ref={messageField}
              className="stationery"
              rows={5}
              value={letter.message}
              placeholder={t.studio.messagePlaceholder}
              aria-describedby={`${counterId} ${errorId}`}
              aria-invalid={messageIssue ? true : undefined}
              autoCapitalize="sentences"
              dir="auto"
              {...bind('message')}
            />
            <div className="field__foot">
              <p id={errorId} className="field__error" role="alert">
                {messageIssue ? issueText(t, messageIssue) : ''}
              </p>
              <p id={counterId} className="counter" data-full={full}>
                <span aria-hidden="true">
                  {used}/{LIMITS.messageGraphemes}
                </span>
                <span className="visually-hidden">{t.studio.counter(used, LIMITS.messageGraphemes)}</span>
              </p>
            </div>
            {/* Said aloud only when the limit is reached, not on every keystroke. */}
            <p className="visually-hidden" role="status">
              {full ? t.studio.counter(used, LIMITS.messageGraphemes) : ''}
            </p>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor={toId}>
                {t.studio.to} <span className="field__optional">{t.common.optional}</span>
              </label>
              <input id={toId} className="line-input" type="text" value={letter.to} placeholder={t.studio.toPlaceholder} autoComplete="off" aria-invalid={toIssue || undefined} dir="auto" {...bind('to')} />
              {toIssue && (
                <p className="field__error" role="alert">
                  {issueText(t, 'to-too-long')}
                </p>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor={fromId}>
                {t.studio.from} <span className="field__optional">{t.common.optional}</span>
              </label>
              <input id={fromId} className="line-input" type="text" value={letter.from} placeholder={t.studio.fromPlaceholder} autoComplete="off" aria-invalid={fromIssue || undefined} dir="auto" {...bind('from')} />
              {fromIssue && (
                <p className="field__error" role="alert">
                  {issueText(t, 'from-too-long')}
                </p>
              )}
            </div>
          </div>

          <MoodPicker value={letter.mood} palette={letter.palette} onChange={(mood) => draftStore.patch({ mood })} />
          <PalettePicker mood={letter.mood} value={letter.palette} onChange={(palette) => draftStore.patch({ palette })} />
          <VoicePicker value={letter.voice} onChange={(voice) => draftStore.patch({ voice })} />

          <div className="field-row">
            <Slider label={t.studio.glow} low={t.studio.glowLow} high={t.studio.glowHigh} value={letter.intensity} onChange={(intensity) => draftStore.patch({ intensity })} />
            <Slider label={t.studio.movement} low={t.studio.movementLow} high={t.studio.movementHigh} value={letter.motion} onChange={(motion) => draftStore.patch({ motion })} />
          </div>

          <div className="variation">
            <button type="button" className="button button--outline" onClick={() => draftStore.patch({ seed: randomSeed() })}>
              <SparkIcon />
              {t.studio.variation}
            </button>
            <p className="variation__text">
              <span className="variation__code">{t.studio.variationLabel(variationCode(letter.seed))}</span>
              {t.studio.variationHint}
            </p>
          </div>

          <div className="reset">
            {confirmingReset ? (
              <p className="reset__confirm" role="group" aria-label={t.studio.resetConfirm}>
                <span>{t.studio.resetConfirm}</span>
                <button
                  type="button"
                  className="text-button text-button--danger"
                  onClick={() => {
                    draftStore.reset();
                    setConfirmingReset(false);
                    setNudged(false);
                    messageField.current?.focus();
                  }}
                >
                  {t.studio.resetYes}
                </button>
                <button type="button" className="text-button" onClick={() => setConfirmingReset(false)}>
                  {t.studio.resetNo}
                </button>
              </p>
            ) : (
              <button type="button" className="text-button" onClick={() => setConfirmingReset(true)}>
                {t.studio.reset}
              </button>
            )}
          </div>
        </main>

        <div className="studio__actions">
          <button type="button" className="button button--outline" onClick={() => attempt('preview')}>
            <EyeIcon />
            <span className="button__label">{t.studio.preview}</span>
          </button>
          <button type="button" className="button button--outline" onClick={() => attempt('export')}>
            <DownloadIcon />
            <span className="button__label">{t.studio.save}</span>
          </button>
          <button type="button" className="button button--ink" onClick={() => attempt('share')}>
            <SendIcon />
            <span className="button__label">{t.studio.share}</span>
          </button>
        </div>
      </div>

      <ShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} letter={shown} />
      <ExportDialog open={dialog === 'export'} onClose={() => setDialog(null)} letter={shown} />
    </div>
  );
}
