import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { Voice } from '../letter/model';
import { countGraphemes } from '../letter/text';

export type LetterScale = 'xl' | 'l' | 'm' | 's' | 'xs';

/** Chooses a type size from how much there is to say: a few words are set large, a long note smaller. */
export function letterScale(message: string): LetterScale {
  const length = countGraphemes(message);
  const lines = message.split('\n').length;
  if (length <= 36 && lines <= 2) return 'xl';
  if (length <= 80 && lines <= 3) return 'l';
  if (length <= 150 && lines <= 5) return 'm';
  if (length <= 230 && lines <= 8) return 's';
  return 'xs';
}

interface LetterTextProps {
  message: string;
  to: string;
  from: string;
  voice: Voice;
  /**
   * "reveal" brings the words in one after another; "settled" is the same
   * layout at rest. Either way the full message is present as ordinary text.
   */
  mode?: 'static' | 'reveal' | 'settled';
}

/** Total time the reveal may take, however long the message is. */
const REVEAL_BUDGET_MS = 2200;
const WORD_STEP_MS = 75;

/**
 * The words of a letter, set in its chosen voice. Text is always rendered as
 * text nodes — never as markup — so whatever was typed is shown literally.
 */
export function LetterText({ message, to, from, voice, mode = 'static' }: LetterTextProps) {
  const { t } = useI18n();
  const animated = mode !== 'static';

  let body: ReactNode;
  if (animated) {
    // Split on spaces and line breaks, keeping both, so each word can arrive on its own beat.
    const tokens = message.split(/(\n| +)/);
    const wordCount = tokens.filter((token) => token.trim().length > 0).length;
    const step = Math.min(WORD_STEP_MS, REVEAL_BUDGET_MS / Math.max(1, wordCount));
    let index = 0;
    body = (
      <>
        <p className="letter__message" dir="auto" aria-hidden="true" style={{ '--step': `${step}ms` } as CSSProperties}>
          {tokens.map((token, position) => {
            if (token === '\n') return <br key={position} />;
            if (token.trim().length === 0) return <Fragment key={position}>{token ? ' ' : ''}</Fragment>;
            return (
              <span key={position} className="letter__word" style={{ '--i': index++ } as CSSProperties}>
                {token}
              </span>
            );
          })}
        </p>
        {/* The same words as one uninterrupted run, for screen readers. */}
        <p className="visually-hidden" dir="auto">
          {message}
        </p>
      </>
    );
  } else {
    body = (
      <p className="letter__message" dir="auto">
        {message}
      </p>
    );
  }

  return (
    <div className="letter" data-voice={voice} data-scale={letterScale(message)} data-mode={mode}>
      {to && (
        <p className="letter__to" dir="auto">
          {t.letter.to(to)}
        </p>
      )}
      {body}
      {from && (
        <p className="letter__from" dir="auto">
          <span aria-hidden="true">— </span>
          {from}
        </p>
      )}
    </div>
  );
}
