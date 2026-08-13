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

beforeEach(() => {
  finalizeInternalChangeRequestsMock.mockReset();
});

describe('transitionProcessBranchToEventMode', () => {
  it('loads an omitted branch and returns unchanged for missing or terminal rows', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce(undefined);
    await expect(
      transitionProcessBranchToEventMode({
        tx: tx as never,
        ctx: { userID: 'user-1' },
        amendmentId: 'amendment-1',
        processBranchId: 'missing',
        editingMode: 'suggest_event',
      })
    ).resolves.toEqual({ changed: false, finalizedInternalChangeRequests: false });
    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();

    for (const editing_mode of ['passed', 'rejected'] as const) {
      await expect(
        transitionProcessBranchToEventMode({
          tx: tx as never,
          ctx: { userID: 'user-1' },
          amendmentId: 'amendment-1',
          processBranchId: editing_mode,
          editingMode: 'suggest_event',
          branch: { id: editing_mode, editing_mode },
        })
      ).resolves.toEqual({ changed: false, finalizedInternalChangeRequests: false });
    }
  });

  it('does not rewrite a branch already in the requested event mode', async () => {
    const tx = createTx();
    await expect(
      transitionProcessBranchToEventMode({
        tx: tx as never,
        ctx: { userID: 'user-1' },
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
        editingMode: 'event_final_closing_vote',
        branch: { id: 'branch-1', editing_mode: 'event_final_closing_vote' },
      })
    ).resolves.toEqual({ changed: false, finalizedInternalChangeRequests: false });
    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
  });

  it.each(['edit', 'suggest_internal'] as const)(
    'keeps open internal change requests unresolved when transitioning from %s',
    async editingMode => {
      const tx = createTx();
      await transitionProcessBranchToEventMode({
        tx: tx as never,
        ctx: { userID: 'user-1' },
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
        editingMode: 'suggest_event',
        branch: { id: 'branch-1', editing_mode: editingMode },
        now: 100,
      });

      expect(finalizeInternalChangeRequestsMock).not.toHaveBeenCalled();
      expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith({
        id: 'branch-1',
        editing_mode: 'suggest_event',
        updated_at: 100,
      });
    }
  );

  it('finalizes internal votes before transitioning from vote_internal', async () => {
    const tx = createTx();
    const result = await transitionProcessBranchToEventMode({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      amendmentId: 'amendment-1',
      processBranchId: 'branch-1',
      editingMode: 'suggest_event',
      branch: { id: 'branch-1', editing_mode: 'vote_internal' },
      now: 100,
    });

    expect(finalizeInternalChangeRequestsMock).toHaveBeenCalledOnce();
    expect(finalizeInternalChangeRequestsMock.mock.invocationCallOrder[0]).toBeLessThan(
      tx.mutate.amendment_process_branch.update.mock.invocationCallOrder[0]
    );
    expect(result.finalizedInternalChangeRequests).toBe(true);
  });

  it('normalizes an empty previous mode and uses the current clock by default', async () => {
    const tx = createTx();
    vi.spyOn(Date, 'now').mockReturnValueOnce(321);
    const result = await transitionProcessBranchToEventMode({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      amendmentId: 'amendment-1',
      processBranchId: 'branch-1',
      editingMode: 'suggest_event',
      branch: { id: 'branch-1', editing_mode: null },
    });
    expect(result).toEqual({ changed: true, finalizedInternalChangeRequests: false });
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith({
      id: 'branch-1',
      editing_mode: 'suggest_event',
      updated_at: 321,
    });
  });
});
