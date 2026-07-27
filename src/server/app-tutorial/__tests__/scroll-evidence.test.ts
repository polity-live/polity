import { describe, expect, it } from 'vitest';

import {
  horizontalScrollEvidenceIsValid,
  requiredHorizontalScrollPixels,
} from '../scroll-evidence';

describe('tutorial horizontal scroll evidence', () => {
  it('keeps the 48 pixel minimum for old clients without a reported range', () => {
    expect(requiredHorizontalScrollPixels(48)).toBe(48);
    expect(
      horizontalScrollEvidenceIsValid(48, {
        type: 'scroll',
        scrollPixels: 47,
      })
    ).toBe(false);
  });

  it('accepts a shorter movement only when the reported range is equally short', () => {
    expect(requiredHorizontalScrollPixels(48, 24)).toBe(24);
    expect(
      horizontalScrollEvidenceIsValid(48, {
        type: 'scroll',
        scrollPixels: 24,
        scrollRangePixels: 24,
      })
    ).toBe(true);
    expect(
      horizontalScrollEvidenceIsValid(48, {
        type: 'scroll',
        scrollPixels: 23,
        scrollRangePixels: 24,
      })
    ).toBe(false);
  });

  it('requires the normal minimum for no-overflow swipe evidence', () => {
    expect(requiredHorizontalScrollPixels(48, 0)).toBe(48);
    expect(
      horizontalScrollEvidenceIsValid(48, {
        type: 'scroll',
        scrollPixels: 48,
        scrollRangePixels: 0,
      })
    ).toBe(true);
  });

  it('preserves the desktop acknowledgement path', () => {
    expect(horizontalScrollEvidenceIsValid(48, { desktopAcknowledged: true })).toBe(true);
  });
});
