import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  finalizeInternalChangeRequests: vi.fn(),
  notifyTaskCreated: vi.fn(),
}));

vi.mock('../process-task-notification', () => ({
  fireProcessTaskCreatedNotification: (...args: unknown[]) => mocks.notifyTaskCreated(...args),
}));
vi.mock('../../change-requests/internal-voting', () => ({
  finalizeInternalChangeRequestsForEventPhaseTransition: (...args: unknown[]) =>
    mocks.finalizeInternalChangeRequests(...args),
}));

import { parseAppError } from '@/features/shared/errors/app-error';
import { PermissionError } from '@/zero/rbac/errors';
import { createScheduleEventTask } from '../process-task-service';
import { transitionProcessBranchToEventMode } from '../event-mode-transition';

function processTaskTx(existingTask: unknown = null) {
  return {
    run: vi.fn(async () => existingTask),
    mutate: {
      process_task: {
        insert: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.finalizeInternalChangeRequests.mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('governance mutation service integration', () => {
  it('persists a schedule-event task and queues its governance notification', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('43000000-0000-4000-8000-000000000001');
    vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    const tx = processTaskTx();

    await expect(
      createScheduleEventTask(tx as never, {
        processRunId: 'run-1',
        branchId: 'branch-1',
        stepRunId: 'step-1',
        taskTitle: 'Schedule governance vote',
        taskDescription: 'Select the next event',
        groupId: 'group-1',
        targetGroupId: 'group-2',
        metadata: { amendmentId: 'amendment-1' },
        senderId: 'agenda-manager',
        groupName: 'Council',
      })
    ).resolves.toBe('43000000-0000-4000-8000-000000000001');

    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '43000000-0000-4000-8000-000000000001',
        task_type: 'schedule_event',
        status: 'open',
        group_id: 'group-1',
        target_group_id: 'group-2',
      })
    );
    expect(mocks.notifyTaskCreated).toHaveBeenCalledWith({
      senderId: 'agenda-manager',
      groupId: 'group-1',
      groupName: 'Council',
      taskTitle: 'Schedule governance vote',
    });
  });

  it('sanitizes a scoped PermissionError to the public action/resource contract', () => {
    const error = new PermissionError('update', 'amendments', 'branch:internal-secret-document-id');
    const payload = parseAppError(error);

    expect(payload).toEqual({
      version: 1,
      code: 'permission_denied',
      params: { action: 'update', resource: 'amendments' },
    });
    expect(error.message).not.toContain('internal-secret-document-id');
    expect(error.scope).toBe('branch:internal-secret-document-id');
  });

  it('finalizes internal requests and returns the persisted process transition result', async () => {
    const update = vi.fn(async () => undefined);
    const tx = {
      run: vi.fn(),
      mutate: { amendment_process_branch: { update } },
    };

    await expect(
      transitionProcessBranchToEventMode({
        tx: tx as never,
        ctx: { userID: 'agenda-manager' },
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
        editingMode: 'suggest_event',
        branch: { id: 'branch-1', editing_mode: 'vote_internal' },
        now: 1_750_000_000_100,
      })
    ).resolves.toEqual({ changed: true, finalizedInternalChangeRequests: true });

    expect(mocks.finalizeInternalChangeRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
        now: 1_750_000_000_100,
      })
    );
    expect(update).toHaveBeenCalledWith({
      id: 'branch-1',
      editing_mode: 'suggest_event',
      updated_at: 1_750_000_000_100,
    });
  });
});
