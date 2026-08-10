import { describe, expect, it, vi } from 'vitest';

const translateMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: translateMock,
}));

import {
  canUserBeCandidate,
  canUserVote,
  formatVoteResultSentence,
  getPhaseVariant,
  getVotingPhase,
} from '../votePhaseHelpers';

translateMock.mockImplementation((key: string, args?: unknown) =>
  args ? `${key}:${JSON.stringify(args)}` : key
);

describe('votePhaseHelpers', () => {
  it.each([
    ['internal', 'internal'],
    ['final', 'final'],
    ['closed', 'closed'],
    ['indication', 'indication'],
    ['unknown', 'indication'],
    [null, 'indication'],
  ] as const)('normalizes phase %j to %s', (phase, expected) => {
    expect(getVotingPhase({ voting_phase: phase })).toBe(expected);
  });

  it('blocks closed voting without consulting permissions', () => {
    const can = vi.fn(() => true);
    expect(canUserVote({ can }, 'closed')).toBe(false);
    expect(can).not.toHaveBeenCalled();
  });

  it.each([true, false])('delegates open voting permission and preserves %s', allowed => {
    const can = vi.fn(() => allowed);
    expect(canUserVote({ can }, 'final')).toBe(allowed);
    expect(can).toHaveBeenCalledWith('active_voting', 'events');
  });

  it.each([true, false])('delegates passive candidate permission and preserves %s', allowed => {
    const can = vi.fn(() => allowed);
    expect(canUserBeCandidate({ can })).toBe(allowed);
    expect(can).toHaveBeenCalledWith('passive_voting', 'events');
  });

  it.each([
    [
      ['election', 'tie', undefined, 'Chair', undefined],
      'features.votes.resultSentence.electionTieForRole:{"role":"Chair"}',
    ],
    [['election', 'tie'], 'features.votes.resultSentence.electionTie'],
    [
      ['election', 'passed', undefined, 'Chair'],
      'features.votes.resultSentence.noWinnerForRole:{"role":"Chair"}',
    ],
    [['election', 'rejected'], 'features.votes.resultSentence.noWinner'],
    [
      ['election', 'passed', 'Ada', 'Chair', 60],
      'features.votes.resultSentence.winnerForRoleWithShare:{"role":"Chair","winner":"Ada","share":60}',
    ],
    [
      ['election', 'passed', 'Ada', 'Chair'],
      'features.votes.resultSentence.winnerForRole:{"role":"Chair","winner":"Ada"}',
    ],
    [
      ['election', 'passed', 'Ada', undefined, 0],
      'features.votes.resultSentence.winnerWithShare:{"winner":"Ada","share":0}',
    ],
    [['election', 'passed', 'Ada'], 'features.votes.resultSentence.winner:{"winner":"Ada"}'],
    [['vote', 'tie'], 'features.votes.resultSentence.voteTie'],
    [
      ['vote', 'passed', undefined, undefined, 55],
      'features.votes.resultSentence.motionAcceptedWithShare:{"share":55}',
    ],
    [['vote', 'passed'], 'features.votes.resultSentence.motionAccepted'],
    [
      ['vote', 'rejected', undefined, undefined, 45],
      'features.votes.resultSentence.motionRejectedWithShare:{"share":45}',
    ],
    [['vote', 'rejected'], 'features.votes.resultSentence.motionRejected'],
  ] as const)('formats result arguments %j', (args, expected) => {
    expect(formatVoteResultSentence(args[0], args[1], args[2], args[3], args[4])).toBe(expected);
  });

  it.each([
    ['indication', 'secondary'],
    ['internal', 'secondary'],
    ['final', 'default'],
    ['closed', 'outline'],
  ] as const)('maps %s to badge variant %s', (phase, expected) => {
    expect(getPhaseVariant(phase)).toBe(expected);
  });
});
