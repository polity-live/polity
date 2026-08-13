import { describe, expect, it, vi } from 'vitest';

import { electionSharedMutators } from '../shared-mutators';

function createClientTx() {
  const operations = () => ({ delete: vi.fn(), insert: vi.fn(), update: vi.fn() });

  return {
    clientID: 'client-1',
    location: 'client',
    mutate: {
      election: operations(),
      election_candidate: operations(),
      election_offline_tally: operations(),
      elector: operations(),
      final_candidate_selection: operations(),
      final_elector_participation: operations(),
      indicative_candidate_selection: operations(),
      indicative_elector_participation: operations(),
    },
    mutationID: 1,
    reason: 'test',
    run: vi.fn(),
  };
}

describe('replaceIndicativeElectionVote empty elector guard', () => {
  it('rejects an elector row whose schema-valid string id is empty', async () => {
    const tx = createClientTx();

    await expect(
      electionSharedMutators.replaceIndicativeElectionVote.fn({
        tx: tx as never,
        ctx: { email: 'voter@example.com', userID: 'user-1' },
        args: {
          elector: { election_id: 'election-1', id: '', user_id: 'user-1' },
          participation: {
            election_id: 'election-1',
            elector_id: '',
            id: 'participation-1',
            user_id: 'user-1',
          },
          selections: [
            {
              candidate_id: 'candidate-1',
              election_id: 'election-1',
              elector_participation_id: 'participation-1',
              id: 'selection-1',
            },
          ],
        } as never,
      })
    ).rejects.toThrow('Elector is required for the legacy indicative mutator.');

    expect(tx.mutate.elector.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: '', election_id: 'election-1', user_id: 'user-1' })
    );
    expect(tx.mutate.indicative_elector_participation.insert).not.toHaveBeenCalled();
    expect(tx.mutate.indicative_candidate_selection.insert).not.toHaveBeenCalled();
  });
});
