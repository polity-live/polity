import { describe, expect, it } from 'vitest';

import { computeElectionResult, tallyCandidateVotes } from '../computeElectionResults';

const candidates = [
  { id: 'ada', name: 'Ada' },
  { id: 'grace', name: 'Grace' },
  { id: 'linus', name: 'Linus' },
] as const;

const selections = (...candidateIds: string[]) =>
  candidateIds.map(candidate_id => ({ candidate_id }));

describe('computeElectionResults', () => {
  it('tallies indicative and final selections with percentages', () => {
    expect(
      tallyCandidateVotes(
        candidates,
        selections('ada', 'ada', 'grace'),
        selections('grace', 'grace', 'ada', 'linus')
      )
    ).toEqual([
      {
        candidateId: 'ada',
        candidateName: 'Ada',
        indicationCount: 2,
        finalCount: 1,
        indicationPercent: 67,
        finalPercent: 25,
      },
      {
        candidateId: 'grace',
        candidateName: 'Grace',
        indicationCount: 1,
        finalCount: 2,
        indicationPercent: 33,
        finalPercent: 50,
      },
      {
        candidateId: 'linus',
        candidateName: 'Linus',
        indicationCount: 0,
        finalCount: 1,
        indicationPercent: 0,
        finalPercent: 25,
      },
    ]);
  });

  it('uses a safe denominator when no selections exist', () => {
    expect(tallyCandidateVotes(candidates.slice(0, 1), [], [])[0]).toMatchObject({
      indicationCount: 0,
      finalCount: 0,
      indicationPercent: 0,
      finalPercent: 0,
    });
  });

  it('reports a tie between candidates with the same non-zero final count', () => {
    expect(
      computeElectionResult(candidates, selections('ada'), selections('ada', 'grace'), 'simple')
    ).toMatchObject({
      winnerId: null,
      winnerName: null,
      isTie: true,
      totalIndicationVotes: 1,
      totalFinalVotes: 2,
      majorityType: 'simple',
    });
  });

  it('reports no winner when nobody received a final vote', () => {
    expect(computeElectionResult(candidates, [], [], 'simple')).toMatchObject({
      winnerId: null,
      isTie: false,
      totalFinalVotes: 0,
    });
  });

  it('elects the unique relative-majority candidate', () => {
    expect(
      computeElectionResult(candidates, [], selections('linus', 'ada', 'linus'), 'simple')
    ).toMatchObject({ winnerId: 'linus', winnerName: 'Linus', isTie: false });
  });

  it('requires more than half of all final votes for an absolute majority', () => {
    expect(
      computeElectionResult(candidates, [], selections('ada', 'ada', 'grace', 'linus'), 'absolute')
        .winnerId
    ).toBeNull();
    expect(
      computeElectionResult(candidates, [], selections('ada', 'ada', 'ada', 'grace'), 'absolute')
        .winnerId
    ).toBe('ada');
  });

  it('requires at least two thirds of all final votes for a two-thirds majority', () => {
    expect(
      computeElectionResult(
        candidates,
        [],
        selections('ada', 'ada', 'ada', 'grace', 'linus'),
        'two_thirds'
      ).winnerId
    ).toBeNull();
    expect(
      computeElectionResult(candidates, [], selections('ada', 'ada', 'grace'), 'two_thirds')
        .winnerId
    ).toBe('ada');
  });
});
