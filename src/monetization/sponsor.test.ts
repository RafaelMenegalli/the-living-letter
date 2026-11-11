import { describe, expect, it } from 'vitest';
import { readSponsor } from './sponsor';

const complete = {
  VITE_SPONSOR_NAME: 'Paper & Ink Co.',
  VITE_SPONSOR_URL: 'https://example.org/',
  VITE_SPONSOR_TEXT: 'Stationery for people who still write.',
};

describe('readSponsor', () => {
  it('is off by default', () => {
    expect(readSponsor({})).toBeNull();
  });

  it('stays off unless every field is present', () => {
    for (const key of Object.keys(complete)) {
      expect(readSponsor({ ...complete, [key]: '' })).toBeNull();
      expect(readSponsor({ ...complete, [key]: '   ' })).toBeNull();
      expect(readSponsor({ ...complete, [key]: undefined })).toBeNull();
    }
  });

  it('accepts only https links', () => {
    expect(readSponsor({ ...complete, VITE_SPONSOR_URL: 'http://example.org/' })).toBeNull();
    expect(readSponsor({ ...complete, VITE_SPONSOR_URL: 'javascript:alert(1)' })).toBeNull();
    expect(readSponsor({ ...complete, VITE_SPONSOR_URL: 'not a url' })).toBeNull();
  });

  it('returns the configured sponsor, trimmed and bounded', () => {
    expect(readSponsor(complete)).toEqual({
      name: 'Paper & Ink Co.',
      url: 'https://example.org/',
      text: 'Stationery for people who still write.',
    });
    const long = readSponsor({ ...complete, VITE_SPONSOR_NAME: 'x'.repeat(500), VITE_SPONSOR_TEXT: 'y'.repeat(500) });
    expect(long?.name).toHaveLength(60);
    expect(long?.text).toHaveLength(140);
  });
});
