import { describe, expect, it, vi } from 'vitest';

import { initializeAmendmentProcessPath } from '../process-engine';

function createTx() {
  const state: {
    branch?: Record<string, unknown>;
    vote?: Record<string, unknown>;
    agendaItem?: Record<string, unknown>;
    processRun?: Record<string, unknown>;
    stepRun?: Record<string, unknown>;
    pathSegment?: Record<string, unknown>;
  } = {};

  let runCall = 0;

  const tx = {
    run: vi.fn(async () => {
      runCall += 1;

      switch (runCall) {
        case 1:
          return [];
        case 2:
          return [state.stepRun];
        case 3:
          return state.agendaItem;
        case 4:
          return state.pathSegment ? [state.pathSegment] : [];
        case 5:
          return state.vote;
        case 6:
          return [state.branch];
        default:
          return [];
      }
    }),
    mutate: {
      amendment_process_run: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.processRun = args;
        }),
        update: vi.fn(async (args: Record<string, unknown>) => {
          state.processRun = { ...state.processRun, ...args };
        }),
      },
      amendment_process_branch: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.branch = args;
        }),
        update: vi.fn(async (args: Record<string, unknown>) => {
          state.branch = { ...state.branch, ...args };
        }),
      },
      amendment_path: {
        insert: vi.fn(async () => null),
      },
      amendment_process_step_run: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.stepRun = args;
        }),
        update: vi.fn(async (args: Record<string, unknown>) => {
          state.stepRun = { ...state.stepRun, ...args };
        }),
      },
      amendment_path_segment: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.pathSegment = args;
        }),
        update: vi.fn(async () => null),
      },
      agenda_item: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.agendaItem = args;
        }),
        update: vi.fn(async (args: Record<string, unknown>) => {
          state.agendaItem = { ...state.agendaItem, ...args };
        }),
      },
      vote: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.vote = args;
        }),
      },
      vote_choice: {
        insert: vi.fn(async () => null),
      },
      process_task: {
        insert: vi.fn(async () => null),
      },
      amendment: {
        update: vi.fn(async () => null),
      },
    },
  };

  return tx;
}

describe('initializeAmendmentProcessPath', () => {
  it('creates the process run before attaching its active branch id', async () => {
    const tx = createTx();

    await initializeAmendmentProcessPath(tx as never, 'user-1', {
      amendment_id: 'amendment-1',
      amendment_title: 'Budget Reform',
      amendment_reason: 'Testing FK-safe initialization',
      source_group_id: 'group-start',
      path_mode: 'hierarchy',
      enriched_path: [
        {
          groupId: 'group-start',
          groupName: 'Budget Circle',
          eventId: 'event-1',
          eventTitle: 'Budget Assembly',
          eventStartDate: Date.now() + 60_000,
          eventEndDate: Date.now() + 120_000,
          agendaItemId: null,
          amendmentVoteId: null,
          forwardingStatus: 'forward_confirmed',
        },
      ],
    });

    const processRunInsertCall =
      tx.mutate.amendment_process_run.insert.mock.invocationCallOrder[0] ?? 0;
    const branchInsertCall =
      tx.mutate.amendment_process_branch.insert.mock.invocationCallOrder[0] ?? 0;
    const firstProcessRunUpdateCall =
      tx.mutate.amendment_process_run.update.mock.invocationCallOrder[0] ?? 0;

    expect(tx.mutate.amendment_process_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        active_branch_id: null,
      })
    );
    expect(processRunInsertCall).toBeLessThan(branchInsertCall);
    expect(branchInsertCall).toBeLessThan(firstProcessRunUpdateCall);
    expect(tx.mutate.amendment_process_run.update.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        active_branch_id: expect.any(String),
      })
    );
  });
});
