import { describe, expect, it, vi } from 'vitest';
import { electionSharedMutators } from '../shared-mutators';

function createTx() {
  return {
    location: 'client',
    run: vi.fn(),
    mutate: {
      election: {
        insert: vi.fn(),
      },
    },
  };
}

describe('electionSharedMutators ballot visibility defaults', () => {
  it('defaults new elections to secret ballots', async () => {
    const tx = createTx();

    await electionSharedMutators.createElection.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'election-1',
        agenda_item_id: 'agenda-1',
        role_id: null,
        title: 'Election',
        description: null,
        status: 'indicative',
        majority_type: 'simple',
        closing_type: null,
        closing_duration_seconds: null,
        closing_end_time: 0,
        visibility: 'public',
        election_mode: 'single',
        seat_count: 1,
        max_votes: 1,
      } as never,
    });

    expect(tx.mutate.election.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'election-1',
        ballot_visibility: 'secret',
      })
    );
  });
});
