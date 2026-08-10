import { describe, expect, it } from 'vitest';

import { computeVoteResult } from '../computeVoteResult';

describe('computeVoteResult', () => {
  it('resolves ties before applying the selected majority rule', () => {
    expect(computeVoteResult(2, 2, 4, 'simple')).toBe('tie');
  });

  it('applies simple, absolute, and two-thirds thresholds on both sides', () => {
    expect(computeVoteResult(3, 2, 8, 'simple')).toBe('passed');
    expect(computeVoteResult(2, 3, 8, 'simple')).toBe('rejected');
    expect(computeVoteResult(5, 2, 8, 'absolute')).toBe('passed');
    expect(computeVoteResult(4, 2, 8, 'absolute')).toBe('rejected');
    expect(computeVoteResult(6, 2, 9, 'two_thirds')).toBe('passed');
    expect(computeVoteResult(5, 2, 9, 'two_thirds')).toBe('rejected');
  });

  it('falls back to simple majority for defensive runtime input', () => {
    expect(computeVoteResult(2, 1, 3, 'legacy' as never)).toBe('passed');
    expect(computeVoteResult(1, 2, 3, 'legacy' as never)).toBe('rejected');
  });
});
