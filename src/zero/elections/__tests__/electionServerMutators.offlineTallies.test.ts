import { describe, expect, it } from 'vitest';
import { electionWinnerResolutionTestApi } from '../server-mutators';

const candidates = [
  { id: 'alice', user_id: 'user-alice', order_index: 1, status: 'nominated' },
  { id: 'bob', user_id: 'user-bob', order_index: 2, status: 'nominated' },
  { id: 'carol', user_id: 'user-carol', order_index: 3, status: 'nominated' },
  { id: 'dana', user_id: 'user-dana', order_index: 4, status: 'nominated' },
];

describe('election server winner resolution offline tallies', () => {
  it('uses final offline tallies to resolve a single-seat election winner', () => {
    const result = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates,
      selections: [],
      offlineTallies: [
        { phase: 'indicative', candidate_id: 'bob', count: 5 },
        { phase: 'final', candidate_id: 'alice', count: 1 },
      ],
      majorityType: 'absolute',
    });

    expect(result.requiresRunoff).toBe(false);
    expect(result.winners.map(winner => winner.id)).toEqual(['alice']);
    expect(result.voteCountByCandidateId.get('alice')).toBe(1);
    expect(result.voteCountByCandidateId.get('bob')).toBe(0);
  });

  it('uses final offline tallies to resolve list-election seats', () => {
    const result = electionWinnerResolutionTestApi.resolveMultiSeatWinners({
      candidates,
      selections: [{ candidate_id: 'alice' }],
      offlineTallies: [
        { phase: 'final', candidate_id: 'bob', count: 3 },
        { phase: 'final', candidate_id: 'carol', count: 2 },
        { phase: 'final', candidate_id: 'dana', count: 1 },
      ],
      seatCount: 2,
    });

    expect(result.requiresRunoff).toBe(false);
    expect(result.winners.map(winner => winner.id)).toEqual(['bob', 'carol']);
    expect(result.voteCountByCandidateId.get('bob')).toBe(3);
    expect(result.voteCountByCandidateId.get('carol')).toBe(2);
  });
});
