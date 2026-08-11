import { describe, expect, it } from 'vitest';
import { VOTE_PHASE } from '@/zero/votes/vote-workflow';
import { deriveChangeRequestVotePhase } from '../changeRequestVotePhase';

describe('deriveChangeRequestVotePhase', () => {
  it('derives internal phase for open internal change-request votes without a vote record phase', () => {
    expect(
      deriveChangeRequestVotePhase(
        {
          is_closing_vote: false,
          status: 'pending',
          vote: {},
          change_request: {
            id: 'cr-1',
            status: 'open',
            voting_status: 'open',
          },
        },
        'vote_internal'
      )
    ).toBe(VOTE_PHASE.internal);
  });

  it('prefers explicit vote phases over the editing mode', () => {
    expect(
      deriveChangeRequestVotePhase(
        {
          is_closing_vote: false,
          vote: { status: 'final' },
          change_request: { id: 'cr-1', status: 'open' },
        },
        'vote_internal'
      )
    ).toBe(VOTE_PHASE.final);
  });

  it('does not treat final change-request phase as a closing vote', () => {
    const phase = deriveChangeRequestVotePhase({
      is_closing_vote: false,
      vote: { status: 'final' },
      change_request: { id: 'cr-1', status: 'open' },
    });

    expect(phase).toBe(VOTE_PHASE.final);
  });
});
