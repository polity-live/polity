import { afterEach, describe, expect, it, vi } from 'vitest';

import { amendmentSharedMutators } from '../shared-mutators';

function createTx(rows: unknown[]) {
  const remainingRows = [...rows];

  return {
    location: 'client',
    run: vi.fn(async () => {
      if (remainingRows.length === 0) {
        throw new Error('Unexpected query');
      }
      return remainingRows.shift();
    }),
    mutate: {
      change_request_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      change_request: {
        update: vi.fn(),
      },
    },
  };
}

const openChangeRequest = {
  id: 'cr-1',
  amendment_id: 'amendment-1',
  status: 'open',
  voting_status: 'open',
};

describe('change request voting mutator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts the first vote and updates aggregate counts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const tx = createTx([openChangeRequest, []]);

    await amendmentSharedMutators.voteOnChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'vote-1',
        change_request_id: 'cr-1',
        vote: 'accept',
      },
    });

    expect(tx.mutate.change_request_vote.insert).toHaveBeenCalledWith({
      id: 'vote-1',
      change_request_id: 'cr-1',
      user_id: 'user-1',
      vote: 'accept',
      created_at: 1_000,
    });
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith({
      id: 'cr-1',
      votes_for: 1,
      votes_against: 0,
      votes_abstain: 0,
      updated_at: 1_000,
    });
  });

  it('updates the latest existing user vote instead of inserting a duplicate', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const tx = createTx([
      openChangeRequest,
      [
        {
          id: 'vote-old',
          change_request_id: 'cr-1',
          user_id: 'user-1',
          vote: 'reject',
          created_at: 1_000,
        },
      ],
    ]);

    await amendmentSharedMutators.voteOnChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'vote-new',
        change_request_id: 'cr-1',
        vote: 'accept',
      },
    });

    expect(tx.mutate.change_request_vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.change_request_vote.update).toHaveBeenCalledWith({
      id: 'vote-old',
      vote: 'accept',
      created_at: 2_000,
    });
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        votes_for: 1,
        votes_against: 0,
        votes_abstain: 0,
      })
    );
  });

  it('normalizes duplicate votes and counts only the newest vote per user', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(3_000);
    const tx = createTx([
      openChangeRequest,
      [
        {
          id: 'current-old',
          change_request_id: 'cr-1',
          user_id: 'user-1',
          vote: 'accept',
          created_at: 1_000,
        },
        {
          id: 'current-new',
          change_request_id: 'cr-1',
          user_id: 'user-1',
          vote: 'reject',
          created_at: 2_000,
        },
        {
          id: 'other-old',
          change_request_id: 'cr-1',
          user_id: 'user-2',
          vote: 'accept',
          created_at: 1_500,
        },
        {
          id: 'other-new',
          change_request_id: 'cr-1',
          user_id: 'user-2',
          vote: 'abstain',
          created_at: 2_500,
        },
      ],
    ]);

    await amendmentSharedMutators.voteOnChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'vote-new',
        change_request_id: 'cr-1',
        vote: 'reject',
      },
    });

    expect(tx.mutate.change_request_vote.delete).toHaveBeenCalledWith({ id: 'current-old' });
    expect(tx.mutate.change_request_vote.delete).toHaveBeenCalledWith({ id: 'other-old' });
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        votes_for: 0,
        votes_against: 1,
        votes_abstain: 1,
      })
    );
  });

  it('rejects votes after the change request voting is completed', async () => {
    const tx = createTx([{ ...openChangeRequest, voting_status: 'completed' }]);

    await expect(
      amendmentSharedMutators.voteOnChangeRequest.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          id: 'vote-1',
          change_request_id: 'cr-1',
          vote: 'accept',
        },
      })
    ).rejects.toThrow('Change request voting is already completed');

    expect(tx.mutate.change_request_vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });

  it('rejects a vote for a missing or already resolved change request', async () => {
    const missing = createTx([null]);
    await expect(
      amendmentSharedMutators.voteOnChangeRequest.fn({
        tx: missing as never,
        ctx: { userID: 'user-1' } as never,
        args: { id: 'vote-1', change_request_id: 'missing', vote: 'accept' },
      })
    ).rejects.toThrow('Change request not found');

    for (const status of ['accepted', 'approved', 'rejected', 'declined']) {
      const resolved = createTx([{ ...openChangeRequest, status }]);
      await expect(
        amendmentSharedMutators.voteOnChangeRequest.fn({
          tx: resolved as never,
          ctx: { userID: 'user-1' } as never,
          args: { id: `vote-${status}`, change_request_id: 'cr-1', vote: 'accept' },
        })
      ).rejects.toThrow('Change request voting is already completed');
    }
  });

  it('keeps the latest user vote across missing and tied timestamps and defaults a cleared vote', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(4_000);
    const tx = createTx([
      openChangeRequest,
      [
        {
          id: 'user-keeper',
          change_request_id: 'cr-1',
          user_id: 'user-1',
          vote: 'accept',
          created_at: undefined,
        },
        {
          id: 'user-duplicate',
          change_request_id: 'cr-1',
          user_id: 'user-1',
          vote: 'reject',
          created_at: null,
        },
        {
          id: 'other-a',
          change_request_id: 'cr-1',
          user_id: 'user-2',
          vote: 'accept',
          created_at: undefined,
        },
        {
          id: 'other-z',
          change_request_id: 'cr-1',
          user_id: 'user-2',
          vote: 'abstain',
          created_at: null,
        },
      ],
    ]);

    await amendmentSharedMutators.voteOnChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { id: 'unused', change_request_id: 'cr-1', vote: null },
    });

    expect(tx.mutate.change_request_vote.update).toHaveBeenCalledWith({
      id: 'user-keeper',
      vote: null,
      created_at: 4_000,
    });
    expect(tx.mutate.change_request_vote.delete).toHaveBeenCalledWith({ id: 'user-duplicate' });
    expect(tx.mutate.change_request_vote.delete).toHaveBeenCalledWith({ id: 'other-a' });
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ votes_for: 0, votes_against: 0, votes_abstain: 1 })
    );
  });

  it('inserts a cleared first vote as null', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const tx = createTx([openChangeRequest, []]);

    await amendmentSharedMutators.voteOnChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { id: 'vote-cleared', change_request_id: 'cr-1', vote: null },
    });

    expect(tx.mutate.change_request_vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-cleared', vote: null })
    );
  });
});
