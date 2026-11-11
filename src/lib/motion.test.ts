import { describe, expect, it } from 'vitest';
import { resolveMotion } from './motion';

describe('motion policy', () => {
  it('follows the device when the visitor has made no choice', () => {
    expect(resolveMotion(null, false)).toEqual({ still: false, fromDevice: false });
    expect(resolveMotion(null, true)).toEqual({ still: true, fromDevice: true });
  });

  it('lets a choice made here override the device, in either direction', () => {
    expect(resolveMotion('on', true)).toEqual({ still: false, fromDevice: false });
    expect(resolveMotion('off', false)).toEqual({ still: true, fromDevice: false });
    expect(resolveMotion('off', true)).toEqual({ still: true, fromDevice: false });
  });
});
