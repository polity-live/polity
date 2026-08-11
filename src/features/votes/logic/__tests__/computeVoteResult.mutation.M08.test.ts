import { describe, expect, it } from 'vitest';

import { computeVoteResult, type MajorityType, type VoteResult } from '../computeVoteResult';

describe('computeVoteResult M08 mutation boundaries', () => {
  it.each<{
    accept: number;
    reject: number;
    totalVoters: number;
    majority: MajorityType;
    expected: VoteResult;
  }>([
    { accept: 2, reject: 2, totalVoters: 4, majority: 'simple', expected: 'tie' },
    { accept: 3, reject: 2, totalVoters: 20, majority: 'simple', expected: 'passed' },
    { accept: 2, reject: 3, totalVoters: 1, majority: 'simple', expected: 'rejected' },
    { accept: 4, reject: 1, totalVoters: 8, majority: 'absolute', expected: 'rejected' },
    { accept: 5, reject: 1, totalVoters: 8, majority: 'absolute', expected: 'passed' },
    { accept: 5, reject: 1, totalVoters: 9, majority: 'two_thirds', expected: 'rejected' },
    { accept: 6, reject: 1, totalVoters: 9, majority: 'two_thirds', expected: 'passed' },
  ])('returns $expected for $majority with $accept/$reject of $totalVoters', args => {
    expect(computeVoteResult(args.accept, args.reject, args.totalVoters, args.majority)).toBe(
      args.expected
    );
  });

  it('uses the simple comparison for defensive runtime majority values', () => {
    expect(computeVoteResult(7, 3, 100, 'legacy' as MajorityType)).toBe('passed');
    expect(computeVoteResult(3, 7, 1, 'legacy' as MajorityType)).toBe('rejected');
  });
});
