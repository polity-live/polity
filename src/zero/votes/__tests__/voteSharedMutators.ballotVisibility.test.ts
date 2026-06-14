import { describe, expect, it, vi } from 'vitest';
import { voteSharedMutators } from '../shared-mutators';

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
});
