import { describe, expect, it, vi } from 'vitest';

import { voteSharedMutators } from '../shared-mutators';

describe('replaceIndicativeVote voter id invariant', () => {
  it('rejects a legacy voter whose resolved id remains empty', async () => {
    const tx = {
      location: 'client',
      mutate: {
        voter: { insert: vi.fn() },
      },
      run: vi.fn(),
    };

    await expect(
      voteSharedMutators.replaceIndicativeVote.fn({
        tx: tx as never,
        ctx: { email: 'actor@example.test', userID: 'actor' },
        args: {
          decisions: [],
          participation: {
            id: 'participation',
            vote_id: 'vote',
            voter_id: '',
          },
          voter: {
            id: '',
            user_id: 'actor',
            vote_id: 'vote',
          },
        },
      })
    ).rejects.toThrow('Voter is required for the legacy indicative mutator.');

    expect(tx.mutate.voter.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: '', vote_id: 'vote' })
    );
  });
});
