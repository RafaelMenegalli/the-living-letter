import { useI18n } from '../i18n/I18nProvider';
import { readSponsor, type Placement } from './sponsor';

const sponsor = readSponsor(import.meta.env);

/** Renders the configured sponsor line for a placement, or nothing when none is configured. */
export function SponsorSlot({ placement }: { placement: Placement }) {
  const { t } = useI18n();
  if (!sponsor) return null;
  return (
    <aside className={`sponsor sponsor--${placement}`} aria-label={t.sponsor.label}>
      <span className="sponsor__label">{t.sponsor.label}</span>
      <a className="sponsor__link" href={sponsor.url} target="_blank" rel="sponsored noopener noreferrer">
        {sponsor.text} <strong>{sponsor.name}</strong>
      </a>
    </aside>
  );
}
