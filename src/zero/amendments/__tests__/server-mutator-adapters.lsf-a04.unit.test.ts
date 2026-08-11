import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  deleteSupportVote: vi.fn(),
  initializeVoting: vi.fn(),
  recompute: vi.fn(),
  update: vi.fn(),
  updateSupportVote: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({ can: mocks.can }));
vi.mock('../../mutators', () => ({
  mutators: {
    amendments: {
      update: { fn: mocks.update },
      updateSupportVote: { fn: mocks.updateSupportVote },
      deleteSupportVote: { fn: mocks.deleteSupportVote },
    },
  },
}));
vi.mock('../../server-helpers', () => ({
  amendmentTitle: vi.fn(),
  eventTitle: vi.fn(),
  groupName: vi.fn(),
  recomputeAmendmentCounters: mocks.recompute,
  recomputeEventCounters: vi.fn(),
  recomputeGroupCounters: vi.fn(),
  recomputeUserCounters: vi.fn(),
  userName: vi.fn(),
}));
vi.mock('../../change-requests/internal-voting', () => ({
  finalizeExpiredInternalChangeRequestVotesForAmendment: vi.fn(),
  initializeInternalChangeRequestVotingForAmendment: mocks.initializeVoting,
  maybeFinalizeInternalChangeRequestVote: vi.fn(),
  repairInternalChangeRequestResolution: vi.fn(),
  resolveInternalChangeRequestVote: vi.fn(),
}));
vi.mock('../../documents/server-mutators', () => ({
  documentServerMutators: { create: { fn: vi.fn() } },
}));
vi.mock('../../common/server-hashtags', () => ({ syncEntityHashtagsForCreate: vi.fn() }));
vi.mock('../../server-notify', () => ({ fireNotification: vi.fn() }));
vi.mock('../process-engine', () => ({
  completeProcessTaskWithEvent: vi.fn(),
  initializeAmendmentProcessPath: vi.fn(),
  replanProcessBranchEvents: vi.fn(),
  resolveAmendmentProcessVote: vi.fn(),
}));
vi.mock('../process-notifications', () => ({ notifyProcessVoteResolution: vi.fn() }));
vi.mock('../../agendas/server-mutators', () => ({
  materializeCurrentForwardConfirmedEventVoting: vi.fn(),
}));

import { amendmentServerMutators } from '../server-mutators';

const ctx = { userID: 'user-1', email: 'user@example.test' };

describe('amendment server mutator LSF adapters', () => {
  it('reinitializes internal voting for every matching branch after a settings update', async () => {
    const previous = {
      id: 'amendment-1',
      title: 'Amendment',
      event_id: null,
      current_process_run_id: 'run-1',
    };
    const tx = {
      location: 'server',
      run: vi
        .fn()
        .mockResolvedValueOnce(previous)
        .mockResolvedValueOnce([{ id: 'branch-1' }, { id: 'branch-2' }]),
      mutate: {},
    };

    await amendmentServerMutators.update.fn({
      tx: tx as any,
      ctx,
      args: { id: 'amendment-1', internal_cr_voting_duration_minutes: 10 },
    });

    expect(mocks.initializeVoting).toHaveBeenCalledTimes(2);
    expect(mocks.initializeVoting).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ processBranchId: 'branch-1' })
    );
  });

  it('deletes an owned support vote and recomputes its amendment counters', async () => {
    const tx = {
      location: 'server',
      run: vi.fn().mockResolvedValue({
        id: 'vote-1',
        user_id: 'user-1',
        amendment_id: 'amendment-1',
      }),
      mutate: {},
    };

    await amendmentServerMutators.deleteSupportVote.fn({
      tx: tx as any,
      ctx,
      args: { id: 'vote-1' },
    });

    expect(mocks.deleteSupportVote).toHaveBeenCalledOnce();
    expect(mocks.recompute).toHaveBeenCalledWith(tx, 'amendment-1');
  });

  it('updates an owned support vote and recomputes its amendment counters', async () => {
    const tx = {
      location: 'server',
      run: vi.fn().mockResolvedValue({
        id: 'vote-1',
        user_id: 'user-1',
        amendment_id: 'amendment-1',
      }),
      mutate: {},
    };
    await amendmentServerMutators.updateSupportVote.fn({
      tx: tx as any,
      ctx,
      args: { id: 'vote-1', vote: 1 },
    });
    expect(mocks.recompute).toHaveBeenCalledWith(tx, 'amendment-1');
  });
});
