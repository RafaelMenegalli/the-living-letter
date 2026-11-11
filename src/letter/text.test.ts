import { describe, expect, it } from 'vitest';
import { LIMITS, coerceLetter } from './model';
import {
  cleanMessage,
  cleanMessageDraft,
  cleanName,
  cleanNameDraft,
  countGraphemes,
  findIssues,
  utf8Length,
} from './text';

/** Invisible and unsafe characters are written as code points, never pasted into the source. */
const ch = (...codes: number[]) => String.fromCharCode(...codes);
const ACUTE = ch(0x301);
const BELL = ch(0x07);

describe('counting', () => {
  it('counts what a person would call characters', () => {
    expect(countGraphemes('')).toBe(0);
    expect(countGraphemes('olá')).toBe(3);
    expect(countGraphemes(`e${ACUTE}`)).toBe(1);
    expect(countGraphemes('👨‍👩‍👧‍👦🇧🇷👋🏽')).toBe(3);
  });

  it('measures UTF-8 size', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('ção')).toBe(5);
    expect(utf8Length('😀')).toBe(4);
  });
});

describe('message cleaning', () => {
  it('removes control characters but keeps line breaks and joiners', () => {
    expect(cleanMessage(['a', 'b', 'c', 'd', 'e'].join(ch(0x00)))).toBe('abcde');
    expect(cleanMessage(`a${ch(0x1f)}b${ch(0x7f)}c${ch(0x85)}d${ch(0x9f)}e`)).toBe('abcde');
    expect(cleanMessage(`one\r\ntwo\rthree${ch(0x2028)}four${ch(0x2029)}five`)).toBe('one\ntwo\nthree\nfour\nfive');
    expect(cleanMessage('👩‍🚀')).toBe('👩‍🚀');
    expect(cleanMessage(`${ch(0xfeff)}hello`)).toBe('hello');
  });

  it('neutralises bidi overrides that could visually reorder text', () => {
    for (let code = 0x202a; code <= 0x202e; code++) {
      expect(cleanMessage(`safe${ch(code)}txt.exe`)).toBe('safetxt.exe');
    }
  });

  it('drops unpaired surrogates', () => {
    expect(cleanMessage(`a${ch(0xd83d)}b`)).toBe('ab');
    expect(cleanMessage(`a${ch(0xde00)}b`)).toBe('ab');
    expect(cleanMessage(`a${ch(0xd83d, 0xde00)}b`)).toBe('a😀b');
  });

  it('normalises to NFC and caps runaway combining marks', () => {
    expect(cleanMessage(`e${ACUTE}`)).toBe('é');
    const zalgo = `x${ch(0x0336).repeat(40)}`;
    expect(Array.from(cleanMessage(zalgo)).length).toBeLessThanOrEqual(8);
  });

  it('never treats markup as anything but text', () => {
    const hostile = '<img src=x onerror=alert(1)> & <script>alert(2)</script>';
    expect(cleanMessage(hostile)).toBe(hostile);
  });

  it('limits the number of lines', () => {
    const many = Array.from({ length: 30 }, (_, i) => `l${i}`).join('\n');
    expect(cleanMessage(many).split('\n')).toHaveLength(LIMITS.messageLines);
    expect(cleanMessageDraft(many).split('\n')).toHaveLength(LIMITS.messageLines);
  });

  it('is idempotent', () => {
    const messy = `  a \n\n\n\n b\t\tc ${BELL} \n`;
    expect(cleanMessage(cleanMessage(messy))).toBe(cleanMessage(messy));
  });

  it('leaves trailing whitespace alone while typing', () => {
    expect(cleanMessageDraft('hello \n')).toBe('hello \n');
    expect(cleanNameDraft('Ana ')).toBe('Ana ');
  });
});

describe('names', () => {
  it('are single-line and trimmed', () => {
    expect(cleanName('  Ana\nMaria\t ')).toBe('Ana Maria');
  });
});

describe('findIssues', () => {
  it('judges the canonical text', () => {
    expect(findIssues({ message: ' hi ', to: '', from: '' })).toEqual([]);
    expect(findIssues({ message: `${'a'.repeat(LIMITS.messageGraphemes)}   `, to: '', from: '' })).toEqual([]);
    expect(findIssues({ message: '', to: 'x'.repeat(41), from: 'y'.repeat(41) })).toEqual([
      'empty',
      'to-too-long',
      'from-too-long',
    ]);
  });
});

describe('coerceLetter', () => {
  const clean = { message: cleanMessageDraft, name: cleanNameDraft };

  it('rejects non-objects', () => {
    expect(coerceLetter(null, clean)).toBeNull();
    expect(coerceLetter('letter', clean)).toBeNull();
  });

  it('repairs out-of-range and wrongly typed fields', () => {
    const repaired = coerceLetter(
      { message: 42, to: `A${BELL}na`, mood: 'rage', palette: 99, voice: null, intensity: -5, motion: 'fast', seed: -1 },
      clean,
    );
    expect(repaired).toEqual({
      message: '',
      to: 'Ana',
      from: '',
      mood: 'calm',
      palette: 2,
      voice: 'italic',
      intensity: 0,
      motion: 50,
      seed: 0,
    });
  });
});
