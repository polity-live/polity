import { describe, expect, it } from 'vitest';

import { calculateScore, getUserVote } from '../voting-utils';

describe('vote utility primitives', () => {
  it('calculates scores with explicit and default counts', () => {
    expect(calculateScore(5, 2)).toBe(3);
    expect(calculateScore()).toBe(0);
  });

  it('returns the matching hydrated vote', () => {
    expect(getUserVote([{ user: { id: 'user-1' }, vote: -1 }], 'user-1')).toBe(-1);
  });

  it('returns undefined without a user or matching vote', () => {
    expect(getUserVote([], undefined)).toBeUndefined();
    expect(getUserVote([{ user: { id: 'other' }, vote: 1 }], 'user-1')).toBeUndefined();
  });
});
