import { describe, expect, it } from 'vitest';

import { formatReactionCount, getReactionEmoji } from '../reaction-helpers';

describe('reaction helpers', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1.0K'],
    [9_999, '10.0K'],
    [10_000, '10K'],
    [999_999, '999K'],
    [1_000_000, '1.0M'],
    [1_250_000, '1.3M'],
  ])('formats %i as %s', (count, expected) => {
    expect(formatReactionCount(count)).toBe(expected);
  });

  it.each([
    ['support', '👍'],
    ['oppose', '👎'],
    ['interested', '🤔'],
    ['unknown', '👍'],
  ] as const)('maps %s to its emoji', (type, expected) => {
    expect(getReactionEmoji(type as Parameters<typeof getReactionEmoji>[0])).toBe(expected);
  });
});
