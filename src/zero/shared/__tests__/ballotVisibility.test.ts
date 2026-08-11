import { describe, expect, it } from 'vitest';

import {
  ballotVisibilitySchema,
  isNamedBallot,
  resolveElectionBallotVisibility,
  resolveVoteBallotVisibility,
} from '../ballotVisibility';

describe('ballot visibility', () => {
  it('recognizes schema values and named ballots', () => {
    expect(ballotVisibilitySchema.parse('named')).toBe('named');
    expect(ballotVisibilitySchema.parse('secret')).toBe('secret');
    expect(isNamedBallot('named')).toBe(true);
    expect(isNamedBallot('secret')).toBe(false);
  });

  it('resolves vote and election defaults', () => {
    expect(resolveVoteBallotVisibility('named')).toBe('named');
    expect(resolveVoteBallotVisibility(null)).toBe('named');
    expect(resolveElectionBallotVisibility('secret')).toBe('secret');
    expect(resolveElectionBallotVisibility(undefined)).toBe('secret');
  });
});
