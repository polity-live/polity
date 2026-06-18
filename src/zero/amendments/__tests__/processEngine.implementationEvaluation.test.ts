import { afterEach, describe, expect, it, vi } from 'vitest';

const fireNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('../../server-notify', () => ({
  fireNotification: (...args: unknown[]) => fireNotificationMock(...args),
}));

import { completeProcessTaskWithEvent, resolveAmendmentProcessVote } from '../process-engine';

function createQueueTx(runResults: unknown[]) {
  const queue = [...runResults];

  return {
    run: vi.fn(async () => queue.shift()),
    mutate: {
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
      process_task: {
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      amendment_process_run: {
        update: vi.fn(async () => null),
      },
      amendment_process_branch: {
        update: vi.fn(async () => null),
      },
      amendment_process_step_run: {
        update: vi.fn(async () => null),
      },
      amendment_group_decision: {
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      amendment_path_segment: {
        update: vi.fn(async () => null),
      },
      support_confirmation: {
        update: vi.fn(async () => null),
      },
      amendment: {
        update: vi.fn(async () => null),
      },
    },
  };
}

function buildDecisionVote(args: { accept: number; reject: number }) {
  const finalDecisions = [
    ...Array.from({ length: args.accept }, () => ({ choice_id: 'choice-accept' })),
    ...Array.from({ length: args.reject }, () => ({ choice_id: 'choice-reject' })),
  ];

  return {
    id: 'vote-1',
    majority_type: 'simple',
    choices: [
      { id: 'choice-accept', label: 'accept', order_index: 1 },
      { id: 'choice-reject', label: 'reject', order_index: 2 },
    ],
    offline_tallies: [],
    voters: Array.from({ length: Math.max(args.accept + args.reject, 1) }, () => ({})),
    final_participations: Array.from({ length: args.accept + args.reject }, () => ({})),
    final_decisions: finalDecisions,
  };
}

function buildImplementationVote(args: { yes: number; no: number }) {
  const finalDecisions = [
    ...Array.from({ length: args.yes }, () => ({ choice_id: 'choice-yes' })),
    ...Array.from({ length: args.no }, () => ({ choice_id: 'choice-no' })),
  ];

  return {
    id: 'vote-implementation-1',
    majority_type: 'simple',
    choices: [
      { id: 'choice-yes', label: 'yes', order_index: 1 },
      { id: 'choice-no', label: 'no', order_index: 2 },
    ],
    offline_tallies: [],
    voters: Array.from({ length: Math.max(args.yes + args.no, 1) }, () => ({})),
    final_participations: Array.from({ length: args.yes + args.no }, () => ({})),
    final_decisions: finalDecisions,
  };
}

function addRelativeOffset(timestamp: number, years: number, months: number) {
  const baseDate = new Date(timestamp);
  const originalDay = baseDate.getDate();
  const result = new Date(timestamp);
  result.setDate(1);
  result.setFullYear(result.getFullYear() + years);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result.getTime();
}

afterEach(() => {
  fireNotificationMock.mockReset();
  vi.restoreAllMocks();
});

describe('process-engine implementation evaluation', () => {
  it('creates a yes/no implementation review vote when scheduling the evaluation task', async () => {
    const tx = createQueueTx([
      {
        id: 'task-1',
        process_run_id: 'run-1',
        branch_id: null,
        step_run_id: null,
        task_type: 'implementation_evaluation',
        status: 'open',
        description: 'Bitte pruefen',
      },
      {
        id: 'event-1',
        title: 'Evaluation Event',
        start_date: 1_718_000_000_000,
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
      },
      {
        id: 'amendment-1',
        title: 'Housing Reform',
        reason: 'Important implementation review',
      },
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
    ]);

    await completeProcessTaskWithEvent(tx as never, 'user-1', {
      process_task_id: 'task-1',
      event_id: 'event-1',
      description: 'Mit Event verknuepfen',
    });

    expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'implementation_review',
      })
    );
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        majority_type: 'simple',
      })
    );
    const voteChoiceCalls = tx.mutate.vote_choice.insert.mock.calls as unknown as [
      Record<string, unknown>,
    ][];
    expect(voteChoiceCalls).toHaveLength(2);
    expect(voteChoiceCalls.map(([args]) => args.label)).toEqual(['yes', 'no']);
    const processRunUpdateCalls = tx.mutate.amendment_process_run.update.mock.calls as unknown as [
      Record<string, unknown>,
    ][];
    expect(
      processRunUpdateCalls.some(([args]) => args.implementation_status === 'evaluation_scheduled')
    ).toBe(true);
  });

  it('creates one implementation_evaluation task and persists the concrete relative evaluation date after final approval', async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const expectedEvaluationDate = addRelativeOffset(now, 1, 2);
    const tx = createQueueTx([
      [
        {
          id: 'step-1',
          process_run_id: 'run-1',
          branch_id: 'branch-1',
          vote_id: 'vote-1',
          target_group_id: 'target-group-1',
          order_index: 1,
          status: 'scheduled',
          step_kind: 'group_vote',
        },
      ],
      { id: 'agenda-1', amendment_id: 'amendment-1', title: 'Final Vote' },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-1',
        evaluation_mode: 'relative_to_vote',
        evaluation_date: null,
        evaluation_offset_months: 2,
        evaluation_offset_years: 1,
        implementation_status: null,
        selected_target_group_id: 'target-group-1',
      },
      { id: 'amendment-1', title: 'Housing Reform', reason: 'Reason' },
      buildDecisionVote({ accept: 2, reject: 1 }),
      { id: 'branch-1', status: 'scheduled', created_at: 1 },
      [],
      null,
      [],
      null,
      { id: 'target-group-1', name: 'Target Group' },
      [],
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
    ]);

    const resolution = await resolveAmendmentProcessVote(tx as never, {
      agenda_item_id: 'agenda-1',
    });

    expect(resolution).toMatchObject({
      supportedGroupId: 'target-group-1',
    });

    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: 'implementation_evaluation',
        group_id: 'target-group-1',
        target_group_id: 'target-group-1',
        due_at: expectedEvaluationDate,
        metadata: expect.objectContaining({
          requiredAfter: now,
          requiredBefore: expectedEvaluationDate,
          evaluationMode: 'relative_to_vote',
          evaluationDueAt: expectedEvaluationDate,
        }),
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyProcessTaskCreated', {
      senderId: 'user-1',
      groupId: 'target-group-1',
      groupName: 'Target Group',
      taskTitle: 'Umsetzung evaluieren: Housing Reform',
    });
    const processRunUpdateCalls = tx.mutate.amendment_process_run.update.mock.calls as unknown as [
      Record<string, unknown>,
    ][];
    expect(
      processRunUpdateCalls.some(
        ([args]) =>
          args.evaluation_date === expectedEvaluationDate &&
          args.implementation_status === 'awaiting_evaluation'
      )
    ).toBe(true);
  });

  it('marks the implementation evaluation as failed immediately when the fixed due date is already in the past', async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const pastEvaluationDate = now - 24 * 60 * 60 * 1000;
    const tx = createQueueTx([
      [
        {
          id: 'step-1',
          process_run_id: 'run-1',
          branch_id: 'branch-1',
          vote_id: 'vote-1',
          target_group_id: 'target-group-1',
          order_index: 1,
          status: 'scheduled',
          step_kind: 'group_vote',
        },
      ],
      { id: 'agenda-1', amendment_id: 'amendment-1', title: 'Final Vote' },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-1',
        evaluation_mode: 'fixed_date',
        evaluation_date: pastEvaluationDate,
        evaluation_offset_months: null,
        evaluation_offset_years: null,
        implementation_status: null,
        selected_target_group_id: 'target-group-1',
      },
      { id: 'amendment-1', title: 'Housing Reform', reason: 'Reason' },
      buildDecisionVote({ accept: 3, reject: 0 }),
      { id: 'branch-1', status: 'scheduled', created_at: 1 },
      [],
      null,
      [],
      null,
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
    ]);

    await resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' });

    expect(tx.mutate.process_task.insert).not.toHaveBeenCalled();
    expect(fireNotificationMock).not.toHaveBeenCalledWith(
      'notifyProcessTaskCreated',
      expect.anything()
    );
    const processRunUpdateCalls = tx.mutate.amendment_process_run.update.mock.calls as unknown as [
      Record<string, unknown>,
    ][];
    expect(
      processRunUpdateCalls.some(
        ([args]) =>
          args.evaluation_date === pastEvaluationDate &&
          args.implementation_status === 'implementation_failed'
      )
    ).toBe(true);
  });

  it('resolves implementation review votes through the linked process task when no step run exists', async () => {
    const tx = createQueueTx([
      [],
      {
        id: 'task-implementation-1',
        process_run_id: 'run-1',
      },
      {
        id: 'agenda-implementation-1',
        amendment_id: 'amendment-1',
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        status: 'completed',
      },
      {
        id: 'vote-implementation-1',
      },
      buildImplementationVote({ yes: 3, no: 1 }),
    ]);

    await resolveAmendmentProcessVote(tx as never, {
      agenda_item_id: 'agenda-implementation-1',
    });

    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-implementation-1',
        forwarding_status: 'approved',
      })
    );
    expect(tx.mutate.amendment_process_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-1',
        implementation_status: 'implemented',
      })
    );
  });

  it('reopens a cancelled implementation evaluation task and notifies the target group', async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const expectedEvaluationDate = now + 30 * 24 * 60 * 60 * 1000;
    const tx = createQueueTx([
      [
        {
          id: 'step-1',
          process_run_id: 'run-1',
          branch_id: 'branch-1',
          vote_id: 'vote-1',
          target_group_id: 'target-group-1',
          order_index: 1,
          status: 'scheduled',
          step_kind: 'group_vote',
        },
      ],
      { id: 'agenda-1', amendment_id: 'amendment-1', title: 'Final Vote' },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
        evaluation_mode: 'fixed_date',
        evaluation_date: expectedEvaluationDate,
        evaluation_offset_months: null,
        evaluation_offset_years: null,
        implementation_status: null,
        selected_target_group_id: 'target-group-1',
      },
      { id: 'amendment-1', title: 'Housing Reform', reason: 'Reason' },
      buildDecisionVote({ accept: 2, reject: 1 }),
      { id: 'branch-1', status: 'scheduled', created_at: 1 },
      [],
      null,
      [],
      null,
      { id: 'target-group-1', name: 'Target Group' },
      [
        {
          id: 'task-cancelled-1',
          status: 'cancelled',
          created_at: 1,
        },
      ],
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
    ]);

    await resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' }, 'closing-user');

    expect(tx.mutate.process_task.insert).not.toHaveBeenCalled();
    expect(tx.mutate.process_task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-cancelled-1',
        status: 'open',
        group_id: 'target-group-1',
        target_group_id: 'target-group-1',
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyProcessTaskCreated', {
      senderId: 'closing-user',
      groupId: 'target-group-1',
      groupName: 'Target Group',
      taskTitle: 'Umsetzung evaluieren: Housing Reform',
    });
  });

  it('does not notify again when an implementation evaluation task is already open', async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const expectedEvaluationDate = now + 30 * 24 * 60 * 60 * 1000;
    const tx = createQueueTx([
      [
        {
          id: 'step-1',
          process_run_id: 'run-1',
          branch_id: 'branch-1',
          vote_id: 'vote-1',
          target_group_id: 'target-group-1',
          order_index: 1,
          status: 'scheduled',
          step_kind: 'group_vote',
        },
      ],
      { id: 'agenda-1', amendment_id: 'amendment-1', title: 'Final Vote' },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
        evaluation_mode: 'fixed_date',
        evaluation_date: expectedEvaluationDate,
        evaluation_offset_months: null,
        evaluation_offset_years: null,
        implementation_status: null,
        selected_target_group_id: 'target-group-1',
      },
      { id: 'amendment-1', title: 'Housing Reform', reason: 'Reason' },
      buildDecisionVote({ accept: 2, reject: 1 }),
      { id: 'branch-1', status: 'scheduled', created_at: 1 },
      [],
      null,
      [],
      null,
      { id: 'target-group-1', name: 'Target Group' },
      [
        {
          id: 'task-open-1',
          status: 'open',
          created_at: 1,
        },
      ],
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
    ]);

    await resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' }, 'closing-user');

    expect(tx.mutate.process_task.insert).not.toHaveBeenCalled();
    expect(tx.mutate.process_task.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-open-1',
        status: 'open',
      })
    );
    expect(fireNotificationMock).not.toHaveBeenCalledWith(
      'notifyProcessTaskCreated',
      expect.anything()
    );
  });
});
