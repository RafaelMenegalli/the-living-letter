/**
 * Optional sponsorship. Off by default: with no configuration, `sponsor` is
 * null and no placement renders anything at all — no empty boxes, no labels.
 *
 * There are exactly two placements, both outside the moments that matter:
 *   "landing"       below the explanation on the landing page
 *   "after-letter"  in the footer of a letter, only after it has been opened,
 *                   and never over or beside the message itself
 *
 * The built-in implementation is a single plain text link configured at build
 * time. To use an advertising network instead, render its unit inside
 * `SponsorSlot` for the placements you want. Doing so is the site owner's
 * decision and responsibility: provider approval, consent and privacy
 * obligations, and content policies all have to be assessed separately.
 */
export interface Sponsor {
  name: string;
  url: string;
  text: string;
}

export type Placement = 'landing' | 'after-letter';

/** Returns a sponsor only if every field is present and the link is https. */
export function readSponsor(env: Record<string, unknown>): Sponsor | null {
  const field = (key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');
  const name = field('VITE_SPONSOR_NAME');
  const url = field('VITE_SPONSOR_URL');
  const text = field('VITE_SPONSOR_TEXT');
  if (!name || !url || !text) return null;
  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { name: name.slice(0, 60), url, text: text.slice(0, 140) };
}
