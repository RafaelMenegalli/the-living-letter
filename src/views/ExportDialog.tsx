import { useEffect, useId, useState, type CSSProperties } from 'react';
import { EXPORT_FORMATS, renderLetterImage, type ExportFormat } from '../export/renderLetter';
import { canShareImage, canvasToPng, downloadBlob, shareImage } from '../export/save';
import { useI18n } from '../i18n/I18nProvider';
import type { Letter } from '../letter/model';
import { Dialog } from '../ui/Dialog';
import { DownloadIcon, ShareIcon } from '../ui/icons';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  letter: Letter;
}

type Result = { key: string; url: string; blob: Blob } | { key: string; failed: true };
type Status = { kind: 'ok' | 'error'; text: string } | null;

const FORMATS = Object.keys(EXPORT_FORMATS) as ExportFormat[];
/** Yields to the browser once, so the "painting" state can reach the screen. A timer, not a frame: frames stop in background tabs. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 30));

/**
 * Renders the letter as a PNG on this device and offers it for download (and,
 * where the platform supports it, to the share sheet). Nothing is uploaded.
 */
export function ExportDialog({ open, onClose, letter }: ExportDialogProps) {
  const { t, lang } = useI18n();
  const groupName = useId();
  const [format, setFormat] = useState<ExportFormat>('portrait');
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<Status>(null);

  // One render per distinct picture; anything else on screen is, by definition, still being painted.
  const key = open ? [format, lang, letter.mood, letter.palette, letter.voice, letter.intensity, letter.motion, letter.seed, letter.message, letter.to, letter.from].join('|') : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      await breathe();
      const canvas = await renderLetterImage(letter, format, { to: t.letter.to, brand: t.brand });
      const blob = await canvasToPng(canvas);
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setResult({ key, url, blob });
    })().catch((error: unknown) => {
      console.warn('[living-letter] image export failed.', error);
      if (!cancelled) setResult({ key, failed: true });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, letter, format, t]);

  const current = result && result.key === key ? result : null;
  const image = current && 'url' in current ? current : null;
  const filename = `living-letter-${letter.mood}-${format}.png`;
  const size = EXPORT_FORMATS[format];

  const close = () => {
    setStatus(null);
    onClose();
  };

  const download = (blob: Blob) => {
    try {
      downloadBlob(blob, filename);
      setStatus({ kind: 'ok', text: t.exporter.done });
    } catch {
      setStatus({ kind: 'error', text: t.exporter.failed });
    }
  };

  const share = async (blob: Blob) => {
    const outcome = await shareImage(blob, filename);
    if (outcome === 'shared') setStatus({ kind: 'ok', text: t.exporter.shared });
    else if (outcome === 'failed') setStatus({ kind: 'error', text: t.exporter.failed });
  };

  return (
    <Dialog open={open} onClose={close} title={t.exporter.title}>
      <p className="sheet__lede">{t.exporter.lede}</p>

      <div className="export">
        <div className="export__frame" style={{ aspectRatio: `${size.width} / ${size.height}`, "--ratio": size.width / size.height } as CSSProperties} aria-busy={!current}>
          {image ? (
            <img className="export__image" src={image.url} width={size.width} height={size.height} alt={t.exporter.previewAlt(t.moods[letter.mood].name)} />
          ) : (
            // A failure is reported once, in the status line below, where screen readers hear it.
            !current && <p className="export__state">{t.exporter.working}</p>
          )}
        </div>

        <div className="export__side">
          <fieldset className="field">
            <legend className="field__label">{t.exporter.shape}</legend>
            <div className="formats">
              {FORMATS.map((option) => (
                <label key={option} className="format">
                  <input
                    type="radio"
                    className="visually-hidden"
                    name={groupName}
                    checked={option === format}
                    onChange={() => {
                      setFormat(option);
                      setStatus(null);
                    }}
                  />
                  <span className="format__card">
                    <span className="format__shape" aria-hidden="true" style={{ aspectRatio: `${EXPORT_FORMATS[option].width} / ${EXPORT_FORMATS[option].height}` }} />
                    <span className="format__name">{t.exporter.formats[option].name}</span>
                    <span className="format__detail">{t.exporter.formats[option].detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="sheet__actions">
            <button type="button" className="button button--ink" disabled={!image} onClick={() => image && download(image.blob)}>
              <DownloadIcon />
              {t.exporter.download}
            </button>
            {image && canShareImage(image.blob, filename) && (
              <button type="button" className="button button--outline" onClick={() => share(image.blob)}>
                <ShareIcon />
                {t.exporter.shareImage}
              </button>
            )}
          </div>
          <p className="status" role="status" aria-live="polite" data-kind={current && !image ? 'error' : status?.kind}>
            {current && !image ? t.exporter.failed : status?.text}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
