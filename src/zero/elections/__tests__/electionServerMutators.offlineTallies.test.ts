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

  it('ignores declined candidates, empty selections, indicative tallies, and negative counts', () => {
    const result = electionWinnerResolutionTestApi.tallyCandidateVotes(
      [
        { id: 'alice' },
        { id: 'declined', status: 'declined' },
      ],
      [{ candidate_id: null }, { candidate_id: 'alice' }, { candidate_id: 'write-in' }],
      [
        { phase: 'indicative', candidate_id: 'alice', count: 9 },
        { phase: 'final', candidate_id: null, count: 9 },
        { phase: 'final', candidate_id: 'alice', count: -2 },
        { phase: 'final', candidate_id: 'write-in', count: null },
        { phase: 'final', candidate_id: 'offline-only', count: null },
      ]
    );

    expect(result.get('alice')).toBe(1);
    expect(result.get('write-in')).toBe(1);
    expect(result.get('declined')).toBe(0);
  });

  it('resolves empty, zero-vote, one-candidate, tied, and ordered single elections', () => {
    expect(
      electionWinnerResolutionTestApi.resolveSingleWinner({ candidates: [], selections: [] })
        .winners
    ).toEqual([]);
    expect(
      electionWinnerResolutionTestApi.resolveSingleWinner({ candidates, selections: [] }).winners
    ).toEqual([]);

    const one = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates: [{ id: 'only', order_index: null }],
      selections: [{ candidate_id: 'only' }],
    });
    expect(one.winners.map(candidate => candidate.id)).toEqual(['only']);

    const tied = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates: [
        { id: 'zeta', order_index: null },
        { id: 'alpha', order_index: null },
      ],
      selections: [{ candidate_id: 'zeta' }, { candidate_id: 'alpha' }],
    });
    expect(tied.requiresRunoff).toBe(true);
    expect(tied.tiedCandidateIds).toEqual(['alpha', 'zeta']);

    const ordered = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates: [
        { id: 'second', order_index: 2 },
        { id: 'first', order_index: 1 },
        { id: 'declined', order_index: 0, status: 'declined' },
      ],
      selections: [
        { candidate_id: 'second' },
        { candidate_id: 'second' },
        { candidate_id: 'first' },
      ],
    });
    expect(ordered.winners.map(candidate => candidate.id)).toEqual(['second']);
  });

  it('enforces absolute and two-thirds majorities including offline ballots', () => {
    const absoluteMiss = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates,
      selections: [
        { candidate_id: 'alice' },
        { candidate_id: 'alice' },
        { candidate_id: 'bob' },
        { candidate_id: 'carol' },
      ],
      majorityType: 'absolute',
    });
    expect(absoluteMiss.winners).toEqual([]);

    const twoThirdsMiss = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates,
      selections: [
        { candidate_id: 'alice' },
        { candidate_id: 'alice' },
        { candidate_id: 'alice' },
        { candidate_id: 'bob' },
        { candidate_id: 'carol' },
      ],
      offlineTallies: [{ phase: 'final', candidate_id: 'alice', count: null }],
      majorityType: 'two_thirds',
    });
    expect(twoThirdsMiss.winners).toEqual([]);

    const twoThirdsHit = electionWinnerResolutionTestApi.resolveSingleWinner({
      candidates,
      selections: [
        { candidate_id: 'alice' },
        { candidate_id: 'alice' },
        { candidate_id: 'bob' },
        { candidate_id: 'carol' },
      ],
      offlineTallies: [{ phase: 'final', candidate_id: 'alice', count: 2 }],
      majorityType: 'two_thirds',
    });
    expect(twoThirdsHit.winners.map(candidate => candidate.id)).toEqual(['alice']);
  });

  it('handles zero seats, no positive candidates, a complete slate, and a boundary tie', () => {
    expect(
      electionWinnerResolutionTestApi.resolveMultiSeatWinners({
        candidates,
        selections: [],
        seatCount: -1,
      }).winners
    ).toEqual([]);

    expect(
      electionWinnerResolutionTestApi.resolveMultiSeatWinners({
        candidates,
        selections: [],
        seatCount: 2,
      }).winners
    ).toEqual([]);

    const completeSlate = electionWinnerResolutionTestApi.resolveMultiSeatWinners({
      candidates: candidates.slice(0, 2),
      selections: [{ candidate_id: 'alice' }, { candidate_id: 'bob' }],
      seatCount: 2,
    });
    expect(completeSlate.winners.map(candidate => candidate.id)).toEqual(['alice', 'bob']);

    const tie = electionWinnerResolutionTestApi.resolveMultiSeatWinners({
      candidates,
      selections: [
        { candidate_id: 'alice' },
        { candidate_id: 'alice' },
        { candidate_id: 'bob' },
        { candidate_id: 'carol' },
      ],
      seatCount: 2,
    });
    expect(tie.requiresRunoff).toBe(true);
    expect(tie.tiedCandidateIds).toEqual(['bob', 'carol']);
  });
});
