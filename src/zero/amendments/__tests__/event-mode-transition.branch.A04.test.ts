import { beforeEach, describe, expect, it, vi } from 'vitest';

const finalizeInternalChangeRequestsMock = vi.hoisted(() => vi.fn());

vi.mock('../../change-requests/internal-voting', () => ({
  finalizeInternalChangeRequestsForEventPhaseTransition: finalizeInternalChangeRequestsMock,
}));

import { transitionProcessBranchToEventMode } from '../event-mode-transition';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      amendment_process_branch: {
        update: vi.fn(),
      },
    },
  };
}

describe('event mode transition A04 priority branches', () => {
  beforeEach(() => finalizeInternalChangeRequestsMock.mockReset());

  it('distinguishes a missing row from a loaded non-terminal row', async () => {
    const missingTx = createTx();
    missingTx.run.mockResolvedValueOnce(undefined);
    await expect(
      transitionProcessBranchToEventMode({
        tx: missingTx as never,
        ctx: { userID: 'user-1' },
        amendmentId: 'amendment-1',
        processBranchId: 'missing',
        editingMode: 'suggest_event',
        now: 100,
      })
    ).resolves.toEqual({ changed: false, finalizedInternalChangeRequests: false });

    const loadedTx = createTx();
    loadedTx.run.mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'edit' });
    await expect(
      transitionProcessBranchToEventMode({
        tx: loadedTx as never,
        ctx: { userID: 'user-1' },
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
        editingMode: 'suggest_event',
        now: 101,
      })
    ).resolves.toEqual({ changed: true, finalizedInternalChangeRequests: false });
    expect(loadedTx.mutate.amendment_process_branch.update).toHaveBeenCalledWith({
      id: 'branch-1',
      editing_mode: 'suggest_event',
      updated_at: 101,
    });
  });
});
