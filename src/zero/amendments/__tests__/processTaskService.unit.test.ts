import { afterEach, describe, expect, it, vi } from 'vitest';

const notificationMock = vi.hoisted(() => vi.fn());

vi.mock('../process-task-notification', () => ({
  fireProcessTaskCreatedNotification: (...args: unknown[]) => notificationMock(...args),
}));

import {
  createImplementationEvaluationTask,
  createScheduleEventTask,
} from '../process-task-service';

function createTx(runResult: unknown) {
  return {
    run: vi.fn(async () => runResult),
    mutate: {
      process_task: {
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
    },
  };
}

const scheduleArgs = {
  processRunId: 'run-1',
  branchId: 'branch-1',
  stepRunId: 'step-1',
  taskTitle: 'Schedule vote',
  taskDescription: 'Select an event',
  groupId: 'group-1',
  targetGroupId: 'group-target',
  metadata: { amendmentId: 'amendment-1' },
  senderId: 'user-1',
  groupName: 'Group One',
};

const evaluationArgs = {
  processRunId: 'run-1',
  amendmentId: 'amendment-1',
  amendmentTitle: 'Housing Reform',
  targetGroupId: 'group-1',
  targetGroupName: 'Group One',
  dueAt: 2_000,
  requiredAfter: 1_000,
  evaluationMode: 'fixed_date' as const,
  senderId: 'user-1',
};

afterEach(() => {
  notificationMock.mockReset();
  vi.restoreAllMocks();
});

describe('process task service', () => {
  it('reuses an open schedule task', async () => {
    const tx = createTx({ id: 'task-open', status: 'open' });

    await expect(createScheduleEventTask(tx as never, scheduleArgs)).resolves.toBe('task-open');

    expect(tx.mutate.process_task.insert).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
  });

  it.each([
    ['query collection', []],
    ['no task', null],
    ['completed task', { id: 'task-completed', status: 'completed' }],
    ['cancelled task', { id: 'task-cancelled', status: 'cancelled' }],
  ])('creates a new schedule task for %s', async (_name, runResult) => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('40000000-0000-4000-8000-000000000001');
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const tx = createTx(runResult);

    await expect(createScheduleEventTask(tx as never, scheduleArgs)).resolves.toBe(
      '40000000-0000-4000-8000-000000000001'
    );

    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '40000000-0000-4000-8000-000000000001',
        task_type: 'schedule_event',
        status: 'open',
      })
    );
    expect(notificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: 'user-1', groupId: 'group-1' })
    );
  });

  it('reuses an existing non-cancelled implementation task', async () => {
    const tx = createTx([
      { id: 'task-cancelled', status: 'cancelled' },
      { id: 'task-open', status: 'open' },
    ]);

    await expect(createImplementationEvaluationTask(tx as never, evaluationArgs)).resolves.toBe(
      'task-open'
    );

    expect(tx.mutate.process_task.update).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
  });

  it('reopens and notifies for a cancelled implementation task', async () => {
    const tx = createTx([{ id: 'task-cancelled', status: 'cancelled' }]);

    await expect(createImplementationEvaluationTask(tx as never, evaluationArgs)).resolves.toBe(
      'task-cancelled'
    );

    expect(tx.mutate.process_task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-cancelled',
        status: 'open',
        due_at: 2_000,
      })
    );
    expect(notificationMock).toHaveBeenCalledOnce();
  });

  it('creates and notifies for the first implementation task', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('40000000-0000-4000-8000-000000000002');
    const tx = createTx([]);

    await expect(createImplementationEvaluationTask(tx as never, evaluationArgs)).resolves.toBe(
      '40000000-0000-4000-8000-000000000002'
    );

    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '40000000-0000-4000-8000-000000000002',
        task_type: 'implementation_evaluation',
        due_at: 2_000,
      })
    );
    expect(notificationMock).toHaveBeenCalledOnce();
  });
});
