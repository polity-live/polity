import { describe, expect, it } from 'vitest';
import { validMediaRange } from '../media-range';

describe('published media byte ranges', () => {
  it.each(['bytes=0-15', 'bytes=99-', 'bytes=-16', 'bytes=0-999'])(
    'accepts a satisfiable range: %s',
    header => {
      expect(validMediaRange(header, 100)).toBe(true);
    }
  );
  it.each([
    'bytes=100-',
    'bytes=20-10',
    'bytes=-0',
    'bytes=-',
    'bytes=1-2,4-5',
    'items=0-5',
    'bytes=9007199254740992-',
    'bytes=0-9007199254740992',
    'bytes=-9007199254740992',
  ])('rejects an invalid or unsatisfiable range: %s', header => {
    expect(validMediaRange(header, 100)).toBe(false);
  });
  it.each([0, -1, NaN, 0.5])('rejects invalid object sizes: %s', size => {
    expect(validMediaRange('bytes=0-', size)).toBe(false);
  });
});
