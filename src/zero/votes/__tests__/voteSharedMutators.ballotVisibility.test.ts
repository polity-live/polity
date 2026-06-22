import { describe, expect, it, vi } from 'vitest';
import { createVoteSchema } from '../schema';
import { voteSharedMutators } from '../shared-mutators';
import { VOTE_PURPOSE } from '../vote-workflow';

function createTx() {
  return {
    location: 'client',
    mutate: {
      vote: {
        insert: vi.fn(),
      },
    },
  };
}

describe('voteSharedMutators ballot visibility defaults', () => {
  it('defaults new votes to named ballots', async () => {
    const tx = createTx();

    await voteSharedMutators.createVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
        amendment_id: null,
        title: 'Vote',
        description: null,
        purpose: VOTE_PURPOSE.closing,
        closing_duration_seconds: null,
        closing_end_time: 0,
      } as never,
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-1',
        ballot_visibility: 'named',
      })
    );
  });

  it('preserves explicit special purposes for agenda-attached votes', async () => {
    const tx = createTx();

    await voteSharedMutators.createVote.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        title: 'Merge vote',
        description: null,
        purpose: VOTE_PURPOSE.mergeVariant,
        closing_duration_seconds: null,
        closing_end_time: 0,
      } as never,
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-1',
        purpose: VOTE_PURPOSE.mergeVariant,
      })
    );
  });

  it('rejects missing and legacy vote purposes at the schema boundary', () => {
    const baseArgs = {
      id: 'vote-1',
      agenda_item_id: 'agenda-1',
      amendment_id: null,
      title: 'Vote',
      description: null,
      closing_duration_seconds: null,
      closing_end_time: 0,
    };

    expect(createVoteSchema.safeParse(baseArgs).success).toBe(false);

    for (const purpose of [
      'vote',
      'event_vote',
      'event_final_closing_vote',
      'final_closing',
      'final_amendment',
      'closing_vote',
      'group_vote',
      'general',
    ]) {
      expect(createVoteSchema.safeParse({ ...baseArgs, purpose }).success).toBe(false);
    }
  });
});
