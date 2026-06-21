import { beforeEach, describe, expect, it, vi } from 'vitest';

const fireNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('../../server-notify', () => ({
  fireNotification: (...args: unknown[]) => fireNotificationMock(...args),
}));

import { initializeAmendmentProcessPath } from '../process-engine';

function createTx(documentEditingMode: string | null = null) {
  const state: {
    branch?: Record<string, unknown>;
    existingAgendaItems?: Record<string, unknown>[];
    vote?: Record<string, unknown>;
    agendaItem?: Record<string, unknown>;
    processRun?: Record<string, unknown>;
    stepRun?: Record<string, unknown>;
    pathSegment?: Record<string, unknown>;
    documentVersion?: Record<string, unknown>;
    document?: Record<string, unknown>;
  } = {
    existingAgendaItems: [
      { id: 'agenda-existing', order_index: 1, forwarding_status: 'forward_confirmed' },
      {
        id: 'agenda-outstanding',
        order_index: 999,
        forwarding_status: 'previous_decision_outstanding',
      },
    ],
  };

  let runCall = 0;

  const tx = {
    run: vi.fn(async () => {
      runCall += 1;

      switch (runCall) {
        case 1:
          return null;
        case 2:
          return [];
        case 3:
          return { id: 'amendment-1', document_id: 'document-main' };
        case 4:
          return {
            id: 'document-main',
            content: [{ type: 'p', children: [{ text: 'Base' }] }],
            editing_mode: documentEditingMode,
          };
        case 5:
          return { version_number: 1 };
        case 6:
          return state.existingAgendaItems ?? [];
        case 7:
          return [state.stepRun];
        case 8:
          return state.agendaItem;
        case 9:
          return state.pathSegment ? [state.pathSegment] : [];
        case 10:
          return state.stepRun ? [state.stepRun] : [];
        case 11:
          return state.branch ? [state.branch] : [];
        case 12:
          return state.stepRun ? [state.stepRun] : [];
        case 13:
          return state.branch ? [state.branch] : [];
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
      document_version: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.documentVersion = args;
        }),
      },
      document: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.document = args;
        }),
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

function createTxForMissingEvent() {
  const state: {
    branch?: Record<string, unknown>;
    stepRun?: Record<string, unknown>;
    pathSegment?: Record<string, unknown>;
    documentVersion?: Record<string, unknown>;
    document?: Record<string, unknown>;
  } = {};

  let runCall = 0;

  const tx = {
    run: vi.fn(async () => {
      runCall += 1;

      switch (runCall) {
        case 1:
          return null;
        case 2:
          return [];
        case 3:
          return { id: 'amendment-2', document_id: 'document-main' };
        case 4:
          return { id: 'document-main', content: [{ type: 'p', children: [{ text: 'Base' }] }] };
        case 5:
          return { version_number: 1 };
        case 6:
          return null;
        case 7:
          return state.stepRun ? [state.stepRun] : [];
        case 8:
          return state.pathSegment ? [state.pathSegment] : [];
        case 9:
          return state.stepRun ? [state.stepRun] : [];
        case 10:
          return state.branch ? [state.branch] : [];
        case 11:
          return state.stepRun ? [state.stepRun] : [];
        case 12:
          return state.branch ? [state.branch] : [];
        default:
          return [];
      }
    }),
    mutate: {
      amendment_process_run: {
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
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
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      vote: {
        insert: vi.fn(async () => null),
      },
      vote_choice: {
        insert: vi.fn(async () => null),
      },
      document_version: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.documentVersion = args;
        }),
      },
      document: {
        insert: vi.fn(async (args: Record<string, unknown>) => {
          state.document = args;
        }),
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
  beforeEach(() => {
    fireNotificationMock.mockReset();
  });

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
    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'document-main',
        amendment_id: 'amendment-1',
        content: [{ type: 'p', children: [{ text: 'Base' }] }],
      })
    );
    expect(tx.mutate.document.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment_id: 'amendment-1',
        content: [{ type: 'p', children: [{ text: 'Base' }] }],
      })
    );
    expect(tx.mutate.amendment_process_branch.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: expect.any(String),
        document_version_id: expect.any(String),
        discussions: [],
      })
    );
    expect(processRunInsertCall).toBeLessThan(branchInsertCall);
    expect(branchInsertCall).toBeLessThan(firstProcessRunUpdateCall);
    expect(tx.mutate.amendment_process_run.update.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        active_branch_id: expect.any(String),
      })
    );
    expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_index: 2,
      })
    );
  });

  it('initializes the first process branch from the amendment document editing mode', async () => {
    const tx = createTx('suggest_internal');

    await initializeAmendmentProcessPath(tx as never, 'user-1', {
      amendment_id: 'amendment-1',
      amendment_title: 'Budget Reform',
      amendment_reason: 'Testing branch mode initialization',
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

    expect(tx.mutate.document.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment_id: 'amendment-1',
        editing_mode: 'suggest_internal',
      })
    );
    expect(tx.mutate.amendment_process_branch.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        editing_mode: 'suggest_internal',
      })
    );
  });

  it('creates a schedule_event task when a path step has no event yet', async () => {
    const tx = createTxForMissingEvent();

    await initializeAmendmentProcessPath(tx as never, 'user-1', {
      amendment_id: 'amendment-2',
      amendment_title: 'Missing Event Coverage',
      amendment_reason: 'Verify schedule task creation',
      source_group_id: 'group-start',
      path_mode: 'hierarchy',
      enriched_path: [
        {
          groupId: 'group-later',
          groupName: 'Later Assembly',
          eventId: null,
          eventTitle: 'Pending event',
          eventStartDate: null,
          agendaItemId: null,
          amendmentVoteId: null,
          forwardingStatus: 'previous_decision_outstanding',
          requiredAfter: 10,
          requiredBefore: 20,
        },
      ],
    });

    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: 'schedule_event',
        status: 'open',
        group_id: 'group-later',
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyProcessTaskCreated', {
      senderId: 'user-1',
      groupId: 'group-later',
      groupName: 'Later Assembly',
      taskTitle: 'Schedule amendment vote for Later Assembly',
    });
    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending_event',
        event_id: null,
        agenda_item_id: null,
        vote_id: null,
      })
    );
  });

  it('rejects adding another branch from an already used start group', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([
          {
            id: 'run-existing',
            amendment_id: 'amendment-1',
            selected_target_group_id: 'group-target',
            selected_target_workflow_id: null,
            status: 'scheduled',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'step-existing',
            branch_id: 'branch-existing',
            order_index: 0,
            target_group_id: 'group-start',
            source_group_id: 'group-start',
          },
        ]),
      mutate: {
        amendment_process_branch: {
          insert: vi.fn(),
        },
      },
    };

    await expect(
      initializeAmendmentProcessPath(tx as never, 'user-1', {
        amendment_id: 'amendment-1',
        amendment_title: 'Budget Reform',
        amendment_reason: null,
        source_group_id: 'group-start',
        path_mode: 'hierarchy',
        enriched_path: [
          {
            groupId: 'group-target',
            groupName: 'Target',
            eventId: null,
            eventTitle: 'Pending event',
            eventStartDate: null,
            agendaItemId: null,
            amendmentVoteId: null,
            forwardingStatus: 'previous_decision_outstanding',
          },
        ],
      })
    ).rejects.toThrow('start group already exists');

    expect(tx.mutate.amendment_process_branch.insert).not.toHaveBeenCalled();
  });

  it('rejects creating a new target run while another active run exists', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([
          {
            id: 'run-existing',
            amendment_id: 'amendment-1',
            selected_target_group_id: 'group-other-target',
            selected_target_workflow_id: null,
            status: 'scheduled',
          },
        ]),
      mutate: {
        amendment_process_branch: {
          insert: vi.fn(),
        },
      },
    };

    await expect(
      initializeAmendmentProcessPath(tx as never, 'user-1', {
        amendment_id: 'amendment-1',
        amendment_title: 'Budget Reform',
        amendment_reason: null,
        source_group_id: 'group-start',
        path_mode: 'hierarchy',
        enriched_path: [
          {
            groupId: 'group-target',
            groupName: 'Target',
            eventId: null,
            eventTitle: 'Pending event',
            eventStartDate: null,
            agendaItemId: null,
            amendmentVoteId: null,
            forwardingStatus: 'previous_decision_outstanding',
          },
        ],
      })
    ).rejects.toThrow('active process target');

    expect(tx.mutate.amendment_process_branch.insert).not.toHaveBeenCalled();
  });
});
