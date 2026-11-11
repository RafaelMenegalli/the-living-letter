import { describe, expect, it } from 'vitest';
import { LIMITS, createLetter } from './model';
import { baseUrlOf, createShareLink, extractToken, parseRoute, readLetterFromUrl } from './link';

const BASE = 'https://letters.example.org/';
const letter = createLetter({ message: 'Meet me where the sea starts. 🌊', to: 'Lia', from: 'Tom', mood: 'hope', seed: 77 });

function link(l = letter, base = BASE) {
  const result = createShareLink(l, base);
  if (!result.ok) throw new Error(result.issues.join(','));
  return result;
}

describe('share links', () => {
  it('puts the whole letter in the fragment and reads it back', () => {
    const { url, token } = link();
    expect(url).toBe(`${BASE}#/l/${token}`);
    expect(readLetterFromUrl(url)).toEqual({ ok: true, letter });
  });

  it('works from a sub-path and from index.html', () => {
    for (const base of ['https://user.example.io/living-letter/', 'https://example.org/app/index.html']) {
      expect(readLetterFromUrl(link(letter, base).url)).toEqual({ ok: true, letter });
    }
  });

  it('keeps the largest allowed letter under the URL limit', () => {
    const biggest = createLetter({
      message: '字'.repeat(LIMITS.messageGraphemes),
      to: 'ã'.repeat(LIMITS.nameGraphemes),
      from: 'õ'.repeat(LIMITS.nameGraphemes),
    });
    const { url } = link(biggest);
    expect(url.length).toBeLessThanOrEqual(LIMITS.urlLength);
    expect(readLetterFromUrl(url)).toMatchObject({ ok: true, letter: { message: biggest.message } });
  });

  it('refuses to build a link that is too long instead of producing a broken one', () => {
    const heavy = createLetter({ message: '😀'.repeat(240) });
    const longBase = `https://example.org/${'deep/'.repeat(160)}`;
    expect(createShareLink(heavy, longBase)).toEqual({ ok: false, issues: ['url-too-long'] });
  });

  it('passes validation problems through', () => {
    expect(createShareLink(createLetter({ message: '   ' }), BASE)).toEqual({ ok: false, issues: ['empty'] });
  });

  it('strips query strings and fragments from the base address', () => {
    expect(baseUrlOf('https://example.org/app/?utm=x#/create')).toBe('https://example.org/app/');
    expect(baseUrlOf('https://example.org/#/l/1.abc')).toBe('https://example.org/');
  });
});

describe('routes', () => {
  it('maps fragments to routes', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/nonsense')).toEqual({ name: 'home' });
    expect(parseRoute('#/create')).toEqual({ name: 'create', preview: false });
    expect(parseRoute('#/create/preview')).toEqual({ name: 'create', preview: true });
    expect(parseRoute('#/l/1.AbC_-9')).toEqual({ name: 'letter', token: '1.AbC_-9' });
  });

  it('tolerates what chat apps do to links', () => {
    const { url, token } = link();
    expect(extractToken(`${token}.`)).toBe(token);
    expect(extractToken(`${token})`)).toBe(token);
    expect(extractToken(`${token}?fbclid=abc`)).toBe(token);
    expect(extractToken(encodeURIComponent(token))).toBe(token);
    expect(readLetterFromUrl(`${url}).`)).toEqual({ ok: true, letter });
  });

  it('reports malformed links instead of throwing', () => {
    for (const bad of ['#/l/', '#/l/%E0%A4%A', '#/l/not-a-letter', '#/l/1.!!!', 'https://example.org/', '#/create']) {
      expect(readLetterFromUrl(bad).ok).toBe(false);
    }
  });
});
