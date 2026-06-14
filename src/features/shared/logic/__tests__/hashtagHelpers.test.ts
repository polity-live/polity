import { describe, expect, it } from 'vitest';

import { getHashtagGradient, parseHashtagsFromText } from '@/features/shared/logic/hashtagHelpers';

describe('hashtagHelpers', () => {
  it('returns deterministic gradients for the same tag', () => {
    expect(getHashtagGradient('assembly')).toBe(getHashtagGradient('assembly'));
    expect(getHashtagGradient('assembly')).toContain('bg-gradient-to-r');
  });

  it('parses unique hashtag tokens from free text', () => {
    expect(parseHashtagsFromText('Discuss #budget and #housing, then #budget again')).toEqual([
      'budget',
      'housing',
    ]);
  });
});
