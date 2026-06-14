import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateVoteFn,
  createVoteFn,
  castIndicativeVoteFn,
  castFinalVoteFn,
  upsertOfflineTallyFn,
  recomputeEventCountersMock,
  requireRecentVotingPasswordVerificationMock,
  resolveAmendmentProcessVoteMock,
  notifyProcessVoteResolutionMock,
} = vi.hoisted(() => ({
  updateVoteFn: vi.fn(),
  createVoteFn: vi.fn(),
  castIndicativeVoteFn: vi.fn(),
  castFinalVoteFn: vi.fn(),
  upsertOfflineTallyFn: vi.fn(),
  recomputeEventCountersMock: vi.fn(),
  requireRecentVotingPasswordVerificationMock: vi.fn(),
  resolveAmendmentProcessVoteMock: vi.fn(),
  notifyProcessVoteResolutionMock: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    votes: {
      createVote: { fn: createVoteFn },
      updateVote: { fn: updateVoteFn },
      castIndicativeVote: { fn: castIndicativeVoteFn },
      castFinalVote: { fn: castFinalVoteFn },
      upsertOfflineTally: { fn: upsertOfflineTallyFn },
    },
  },
}));

vi.mock('../../server-helpers', () => ({
  recomputeEventCounters: recomputeEventCountersMock,
  requireRecentVotingPasswordVerification: requireRecentVotingPasswordVerificationMock,
}));

vi.mock('../../amendments/process-engine', () => ({
  resolveAmendmentProcessVote: resolveAmendmentProcessVoteMock,
}));

vi.mock('../../amendments/process-notifications', () => ({
  notifyProcessVoteResolution: notifyProcessVoteResolutionMock,
}));

import { voteServerMutators } from '../server-mutators';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {},
  };
}

function createCtx() {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

beforeEach(() => {
  updateVoteFn.mockReset();
  createVoteFn.mockReset();
  castIndicativeVoteFn.mockReset();
  castFinalVoteFn.mockReset();
  upsertOfflineTallyFn.mockReset();
  recomputeEventCountersMock.mockReset();
  requireRecentVotingPasswordVerificationMock.mockReset();
  resolveAmendmentProcessVoteMock.mockReset();
  notifyProcessVoteResolutionMock.mockReset();
});

describe('voteServerMutators.updateVote', () => {
  it('resolves amendment process votes on server-side close', async () => {
    const tx = createTx();
    const resolution = {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    } as const;

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'open',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce(resolution);

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });

    expect(updateVoteFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });
    expect(resolveAmendmentProcessVoteMock).toHaveBeenCalledWith(tx, {
      agenda_item_id: 'agenda-1',
    });
    expect(notifyProcessVoteResolutionMock).toHaveBeenCalledWith(
      tx,
      'user-1',
      'agenda-1',
      resolution
    );
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
  });

  it('blocks final votes while change request timeline items are still open', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'open',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_final_vote: false,
        },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-1',
          status: 'closed',
        },
      })
    ).rejects.toThrow('All change request votes must be completed before the final vote.');

    expect(updateVoteFn).not.toHaveBeenCalled();
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
  });

  it('blocks out-of-order change request vote closure', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-2',
        status: 'open',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-2',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_final_vote: false,
      })
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_final_vote: false,
          order_index: 0,
        },
        {
          id: 'agenda-cr-2',
          agenda_item_id: 'agenda-1',
          status: 'voting',
          is_final_vote: false,
          order_index: 1,
        },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-2',
          status: 'closed',
        },
      })
    ).rejects.toThrow('Change requests must be voted in their configured order.');

    expect(updateVoteFn).not.toHaveBeenCalled();
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
  });

  it('does not resolve amendment process votes when closing change request timeline votes', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-3',
        status: 'open',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_final_vote: false,
      })
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'voting',
          is_final_vote: false,
          order_index: 0,
        },
      ])
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-3',
        status: 'closed',
      },
    });

    expect(updateVoteFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: {
        id: 'vote-3',
        status: 'closed',
      },
    });
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
    expect(notifyProcessVoteResolutionMock).not.toHaveBeenCalled();
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
  });

  it('does not re-resolve already closed votes', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'closed',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });

    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
    expect(notifyProcessVoteResolutionMock).not.toHaveBeenCalled();
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
  });
});
