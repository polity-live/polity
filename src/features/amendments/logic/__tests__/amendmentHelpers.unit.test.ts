import { describe, expect, it } from 'vitest';

import { AMENDMENT_STATUS_COLORS, deriveVoteState, getSupportStatus } from '../amendmentHelpers';

describe('amendmentHelpers', () => {
  it.each([
    [[], 'active'],
    [[{ group: { id: 'group-1' }, status: 'confirmed' }], 'active'],
    [[{ group: { id: 'group-2' }, status: 'pending' }], 'active'],
    [[{ group: { id: 'group-1' }, status: 'pending' }], 'pending'],
    [[{ group: { id: 'group-1' }, status: 'declined' }], 'declined'],
    [[{ group: { id: 'group-1' }, status: 'unknown' }], 'active'],
  ] as const)('derives support status from confirmations', (confirmations, expected) => {
    expect(getSupportStatus('group-1', [...confirmations])).toBe(expected);
  });

  it('uses legacy counters when no normalized support votes exist', () => {
    expect(
      deriveVoteState({ upvotes: 7, downvotes: 2, support_votes: [] } as never, undefined)
    ).toEqual({
      score: 5,
      upvotes: 7,
      downvotes: 2,
      supporterCount: 7,
      userVote: undefined,
      currentVoteValue: 0,
      hasUpvoted: false,
      hasDownvoted: false,
    });
    expect(
      deriveVoteState({ upvotes: null, downvotes: null, support_votes: null } as never, 'user-1')
    ).toMatchObject({ score: 0, upvotes: 0, downvotes: 0, currentVoteValue: 0 });
  });

  it('normalizes support votes and resolves a related user id', () => {
    const currentUserVote = { vote: -1, user: { id: 'user-1' }, user_id: 'legacy-id' };
    const state = deriveVoteState(
      {
        upvotes: 99,
        downvotes: 99,
        support_votes: [
          { vote: 1, user_id: 'user-2' },
          { vote: null, user_id: 'user-3' },
          currentUserVote,
        ],
      } as never,
      'user-1'
    );

    expect(state).toEqual({
      score: 1,
      upvotes: 2,
      downvotes: 1,
      supporterCount: 2,
      userVote: currentUserVote,
      currentVoteValue: -1,
      hasUpvoted: false,
      hasDownvoted: true,
    });
  });

  it('falls back to user_id and treats every non-negative vote as support', () => {
    const currentUserVote = { vote: undefined, user_id: 'user-1' };
    expect(
      deriveVoteState(
        { upvotes: 0, downvotes: 0, support_votes: [currentUserVote] } as never,
        'user-1'
      )
    ).toMatchObject({
      currentVoteValue: 1,
      hasUpvoted: true,
      hasDownvoted: false,
      userVote: currentUserVote,
    });
  });

  it('defines a theme token for every supported amendment status', () => {
    expect(Object.keys(AMENDMENT_STATUS_COLORS).sort()).toEqual([
      'edit',
      'event_final_closing_vote',
      'passed',
      'rejected',
      'suggest_event',
      'suggest_internal',
      'view',
      'vote_internal',
    ]);
    expect(Object.values(AMENDMENT_STATUS_COLORS).every(Boolean)).toBe(true);
  });
});
