import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { CloseIcon } from './icons';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A modal sheet built on the native <dialog>, which supplies the focus trap,
 * Escape-to-close, background inertness and focus restoration for free.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', ''); // no modal support: show it in place rather than not at all
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} onClose={onClose} onClick={closeOnBackdrop}>
      {open && (
        <div className="sheet__body">
          <header className="sheet__head">
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            <button type="button" className="chip-button chip-button--paper" onClick={onClose} aria-label={t.common.close}>
              <CloseIcon />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
