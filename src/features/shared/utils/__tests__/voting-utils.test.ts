import { describe, expect, it, vi } from 'vitest';

import {
  calculateElectionWinner,
  calculateMajority,
  countVotes,
  formatTimeRemaining,
  getMajorityTypeText,
  getVotePercentages,
  isQuorumReached,
} from '../voting-utils';

const translate = vi.hoisted(() => vi.fn((key: string) => key));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => translate(key),
}));

const votes = (...values: ('accept' | 'reject' | 'abstain')[]) => values.map(vote => ({ vote }));

const candidates = [{ id: 'ada', name: 'Ada' }, { id: 'grace', name: 'Grace' }, { id: 'linus' }];
const candidatesById = new Map(candidates.map(candidate => [candidate.id, candidate]));
const candidateVotes = (...ids: string[]) =>
  ids.map(id => ({ candidate: candidatesById.get(id) as (typeof candidates)[number] }));

describe('voting-utils', () => {
  it('counts each recognized vote and ignores unknown values', () => {
    expect(
      countVotes([...votes('accept', 'reject', 'abstain', 'accept'), { vote: 'other' } as never])
    ).toEqual({
      accept: 2,
      reject: 1,
      abstain: 1,
      total: 5,
    });
  });

  it.each([
    [votes('accept', 'reject'), 'simple', 2, 'tie'],
    [votes('accept', 'accept', 'reject'), 'simple', 3, 'passed'],
    [votes('accept', 'reject', 'reject'), 'simple', 3, 'rejected'],
    [votes('accept', 'accept', 'reject'), 'absolute', 4, 'rejected'],
    [votes('accept', 'accept', 'accept', 'reject'), 'absolute', 4, 'passed'],
    [votes('accept', 'accept', 'reject'), 'two_thirds', 3, 'passed'],
    [votes('accept', 'reject', 'reject'), 'two_thirds', 3, 'rejected'],
    [votes('accept', 'accept', 'reject'), 'unknown', 3, 'passed'],
    [votes('accept', 'reject', 'reject'), 'unknown', 3, 'rejected'],
  ] as const)('calculates %s majority results', (input, type, eligible, expected) => {
    expect(calculateMajority([...input], type as never, eligible)).toBe(expected);
  });

  it('calculates rounded percentages and safely handles no votes', () => {
    expect(getVotePercentages(votes('accept', 'accept', 'reject'))).toEqual({
      accept: 67,
      reject: 33,
      abstain: 0,
    });
    expect(getVotePercentages([])).toEqual({ accept: 0, reject: 0, abstain: 0 });
  });

  it('checks quorum at the boundary and rejects an empty electorate', () => {
    expect(isQuorumReached(0, 0)).toBe(false);
    expect(isQuorumReached(4, 10)).toBe(false);
    expect(isQuorumReached(5, 10)).toBe(true);
    expect(isQuorumReached(2, 10, 20)).toBe(true);
  });

  it.each([
    ['simple', 'common.majorityTypes.simple'],
    ['absolute', 'common.majorityTypes.absolute'],
    ['two_thirds', 'common.majorityTypes.twoThirds'],
    ['unknown', 'common.unknown'],
  ] as const)('translates majority type %s', (type, expected) => {
    expect(getMajorityTypeText(type as never)).toBe(expected);
  });

  it.each([
    [-1, '0:00'],
    [0, '0:00'],
    [1, '0:01'],
    [59, '0:59'],
    [60, '1:00'],
    [125, '2:05'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatTimeRemaining(seconds)).toBe(expected);
  });

  it('reports tied and empty elections', () => {
    expect(calculateElectionWinner(candidateVotes('ada', 'grace'), candidates, 'simple')).toEqual({
      winner: null,
      voteCount: 1,
      isTie: true,
    });
    expect(calculateElectionWinner([], candidates, 'simple')).toEqual({
      winner: null,
      voteCount: 0,
      isTie: false,
    });
  });

  it('elects a relative winner and ignores malformed or unlisted candidate votes', () => {
    const input = [
      ...candidateVotes('ada', 'ada', 'grace'),
      { candidate: { id: 'other' } },
      { candidate: null },
    ];
    expect(calculateElectionWinner(input as never, candidates, 'simple')).toEqual({
      winner: candidates[0],
      voteCount: 2,
      isTie: false,
    });
  });

  it('enforces absolute and two-thirds election thresholds', () => {
    expect(
      calculateElectionWinner(
        candidateVotes('ada', 'ada', 'grace', 'linus'),
        candidates,
        'absolute'
      ).winner
    ).toBeNull();
    expect(
      calculateElectionWinner(candidateVotes('ada', 'ada', 'ada', 'grace'), candidates, 'absolute')
        .winner
    ).toBe(candidates[0]);
    expect(
      calculateElectionWinner(
        candidateVotes('ada', 'ada', 'ada', 'grace', 'linus'),
        candidates,
        'two_thirds'
      ).winner
    ).toBeNull();
    expect(
      calculateElectionWinner(candidateVotes('ada', 'ada', 'grace'), candidates, 'two_thirds')
        .winner
    ).toBe(candidates[0]);
  });
});
