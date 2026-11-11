import { useId, useMemo, useRef, useState } from 'react';
import { canShareLinks, copyText, shareLink } from '../export/save';
import { useI18n } from '../i18n/I18nProvider';
import { baseUrlOf, createShareLink } from '../letter/link';
import type { Letter } from '../letter/model';
import { Dialog } from '../ui/Dialog';
import { CheckIcon, CopyIcon, EyeIcon, ShareIcon } from '../ui/icons';
import { issueText } from './issues';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  letter: Letter;
}

type Status = { kind: 'ok' | 'error'; text: string } | null;

/** Builds the link and offers every way of sending it that this browser supports. */
export function ShareDialog({ open, onClose, letter }: ShareDialogProps) {
  const { t } = useI18n();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const link = useMemo(() => (open ? createShareLink(letter, baseUrlOf(window.location.href)) : null), [open, letter]);

  const close = () => {
    setStatus(null);
    onClose();
  };

  const copy = async (url: string) => {
    if (await copyText(url)) {
      setStatus({ kind: 'ok', text: t.share.copied });
    } else {
      // Clipboard access denied or missing: leave the link selected for a manual copy.
      field.current?.focus();
      field.current?.select();
      setStatus({ kind: 'error', text: t.share.copyFailed });
    }
  };

  const share = async (url: string) => {
    const outcome = await shareLink(url, t.brand, t.share.shareText);
    if (outcome === 'shared') setStatus({ kind: 'ok', text: t.share.shared });
    else if (outcome === 'failed') setStatus({ kind: 'error', text: t.share.shareFailed });
  };

  return (
    <Dialog open={open} onClose={close} title={t.share.title}>
      {link?.ok ? (
        <>
          <p className="sheet__lede">{t.share.lede}</p>
          <div className="field">
            <label className="field__label" htmlFor={fieldId}>
              {t.share.linkLabel}
              <span className="field__value">{t.share.length(link.url.length)}</span>
            </label>
            <input
              id={fieldId}
              ref={field}
              className="linkbox"
              type="text"
              readOnly
              value={link.url}
              dir="ltr"
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <div className="sheet__actions">
            <button type="button" className="button button--ink" onClick={() => copy(link.url)}>
              {status?.kind === 'ok' && status.text === t.share.copied ? <CheckIcon /> : <CopyIcon />}
              {t.share.copy}
            </button>
            {canShareLinks() && (
              <button type="button" className="button button--outline" onClick={() => share(link.url)}>
                <ShareIcon />
                {t.share.native}
              </button>
            )}
            <a className="button button--outline" href={link.url} target="_blank" rel="noopener">
              <EyeIcon />
              {t.share.open}
            </a>
          </div>
          <p className="status" role="status" aria-live="polite" data-kind={status?.kind}>
            {status?.text}
          </p>
          <aside className="notice">
            <h3 className="notice__title">{t.share.privacyTitle}</h3>
            <p>{t.share.privacy}</p>
            <p>{t.share.previewNote}</p>
          </aside>
        </>
      ) : (
        <div role="alert">
          {(link?.issues ?? []).map((issue) => (
            <p key={issue} className="field__error">
              {issueText(t, issue)}
            </p>
          ))}
        </div>
      )}
    </Dialog>
  );
}
