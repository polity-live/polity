import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

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
        delete: vi.fn(async () => null),
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      vote: {
        delete: vi.fn(async () => null),
        insert: vi.fn(async () => null),
      },
      vote_choice: {
        delete: vi.fn(async () => null),
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
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      amendment_path_segment: {
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      amendment_group_decision: {
        insert: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      support_confirmation: {
        update: vi.fn(async () => null),
      },
      amendment: {
        update: vi.fn(async () => null),
      },
      change_request: {
        update: vi.fn(async () => null),
      },
      agenda_item_change_request: {
        delete: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      speaker_list: {
        delete: vi.fn(async () => null),
      },
      accreditation: {
        delete: vi.fn(async () => null),
      },
      indicative_choice_decision: {
        delete: vi.fn(async () => null),
      },
      final_choice_decision: {
        delete: vi.fn(async () => null),
      },
      indicative_voter_participation: {
        delete: vi.fn(async () => null),
      },
      final_voter_participation: {
        delete: vi.fn(async () => null),
      },
      vote_offline_tally: {
        delete: vi.fn(async () => null),
      },
      voter: {
        delete: vi.fn(async () => null),
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

beforeEach(() => {
  useLanguageStore.setState({ language: 'de' });
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
      [
        { id: 'agenda-existing', order_index: 1, forwarding_status: 'forward_confirmed' },
        {
          id: 'agenda-outstanding',
          order_index: 999,
          forwarding_status: 'previous_decision_outstanding',
        },
      ],
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
      [],
      [{ id: 'branch-1', status: 'completed', created_at: 1 }],
    ]);

    await completeProcessTaskWithEvent(tx as never, 'user-1', {
      process_task_id: 'task-1',
      event_id: 'event-1',
      description: 'Mit Event verknuepfen',
    });

    expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_index: 2,
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

  it('materializes an automatic merge without a reusable agenda pair', async () => {
    const branches = [
      { id: 'branch-a', title: 'Variant A', status: 'scheduled', created_at: 1 },
      { id: 'branch-b', title: 'Variant B', status: 'scheduled', created_at: 2 },
    ];
    const crossingStepA = {
      id: 'crossing-a',
      process_run_id: 'run-1',
      branch_id: 'branch-a',
      workflow_step_id: null,
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: 'group-merge',
      event_id: 'event-auto',
      agenda_item_id: null,
      vote_id: null,
      decision_status: 'tie',
      order_index: 2,
    };
    const crossingStepB = {
      ...crossingStepA,
      id: 'crossing-b',
      branch_id: 'branch-b',
      decision_status: 'forward_confirmed',
    };
    const laterDuplicateForBranchA = {
      ...crossingStepA,
      id: 'crossing-a-later',
      order_index: 3,
    };
    const tx = createQueueTx([
      {
        id: 'task-auto-merge',
        process_run_id: 'run-1',
        branch_id: null,
        step_run_id: null,
        task_type: 'schedule_event',
        support_confirmation_id: null,
        description: 'Create the triggering vote',
      },
      { id: 'event-auto', title: 'Automatic Merge', start_date: 20_000 },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'creator-1' },
      { id: 'amendment-1', title: 'Housing Reform', reason: null },
      [],
      branches,
      [crossingStepA, laterDuplicateForBranchA, crossingStepB],
      [],
      [],
      [],
      [],
      branches,
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-auto-merge',
        event_id: 'event-auto',
      })
    ).resolves.toMatchObject({ handled: true, runStatus: 'scheduled' });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'merge_variant', majority_type: 'relative' })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-a', decision_status: 'tie' })
    );
    expect(tx.mutate.amendment_process_step_run.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-a-later', step_kind: 'merge_vote' })
    );
  });

  it('completes a support confirmation without creating an agenda vote', async () => {
    const tx = createQueueTx([
      {
        id: 'task-support-1',
        process_run_id: 'run-1',
        branch_id: 'branch-1',
        step_run_id: null,
        task_type: 'support_confirmation',
        support_confirmation_id: 'support-1',
      },
      {
        id: 'event-1',
        title: 'Support Event',
        start_date: 1_718_000_000_000,
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-main',
        created_by_id: 'user-creator',
      },
      null,
      {
        id: 'support-1',
        amendment_id: 'amendment-support',
      },
      {
        id: 'amendment-support',
        title: 'Supported Amendment',
        reason: null,
      },
      [],
      [],
      [],
      [],
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-support-1',
        event_id: 'event-1',
      })
    ).resolves.toMatchObject({
      handled: true,
      agendaItemId: null,
      voteId: null,
      runStatus: 'completed',
    });

    expect(tx.mutate.agenda_item.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.process_task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-support-1',
        status: 'completed',
        agenda_item_id: null,
      })
    );
    expect(tx.mutate.support_confirmation.update).toHaveBeenCalledWith({
      id: 'support-1',
      event_id: 'event-1',
      process_task_id: 'task-support-1',
    });
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch-1', status: 'completed' })
    );
  });

  it('uses the support confirmation amendment id when its amendment cannot be loaded', async () => {
    const tx = createQueueTx([
      {
        id: 'task-support-missing-amendment',
        process_run_id: 'run-1',
        branch_id: null,
        step_run_id: null,
        task_type: 'support_confirmation',
        support_confirmation_id: 'support-1',
      },
      { id: 'event-1', title: 'Support Event', start_date: 10_000 },
      { id: 'run-1', amendment_id: 'amendment-main', created_by_id: 'creator-1' },
      null,
      { id: 'support-1', amendment_id: 'amendment-support' },
      null,
      [],
      [],
      [],
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-support-missing-amendment',
        event_id: 'event-1',
      })
    ).resolves.toMatchObject({ handled: true, agendaItemId: null, voteId: null });

    expect(tx.mutate.support_confirmation.update).toHaveBeenCalled();
  });

  it('completes a context-free task without inventing an amendment id', async () => {
    const tx = createQueueTx([
      {
        id: 'task-context-free',
        process_run_id: 'run-1',
        branch_id: null,
        step_run_id: null,
        task_type: 'schedule_event',
        support_confirmation_id: null,
      },
      { id: 'event-1', title: null, start_date: null },
      { id: 'run-1', amendment_id: 'amendment-missing', created_by_id: 'creator-1' },
      null,
      [],
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-context-free',
        event_id: 'event-1',
      })
    ).resolves.toMatchObject({
      handled: true,
      agendaItemId: expect.any(String),
      voteId: expect.any(String),
    });

    expect(tx.mutate.agenda_item.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
  });

  it('falls back to the event label and preserves a tied scheduled step', async () => {
    const step = {
      id: 'step-tied',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'group_vote',
      status: 'pending_event',
      decision_status: 'tie',
      event_id: null,
      agenda_item_id: null,
      vote_id: null,
      order_index: 1,
    };
    const tx = createQueueTx([
      {
        id: 'task-tied',
        process_run_id: 'run-1',
        branch_id: null,
        step_run_id: 'step-tied',
        task_type: 'schedule_event',
        support_confirmation_id: null,
        description: null,
      },
      { id: 'event-1', title: null, start_date: null },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'creator-1' },
      { id: 'amendment-1', title: null, reason: null },
      step,
      [],
      [],
      [],
      [],
      [],
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-tied',
        event_id: 'event-1',
        description: '   ',
      })
    ).resolves.toMatchObject({ handled: true });

    expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Automatically linked to event.' })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step-tied', starts_at: null, decision_status: 'tie' })
    );
  });

  it('materializes the selected workflow after an approved handoff', async () => {
    const now = 1_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    let uuidIndex = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidIndex += 1;
      return `00000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`;
    });

    const insertedFirstStep = {
      id: '00000000-0000-4000-8000-000000000001',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: 'workflow-step-1',
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: 'group-1',
      event_id: 'event-group-1-early',
      agenda_item_id: '00000000-0000-4000-8000-000000000002',
      vote_id: '00000000-0000-4000-8000-000000000003',
      decision_status: 'forward_confirmed',
      order_index: 2,
    };
    const insertedMergeStep = {
      id: '00000000-0000-4000-8000-000000000008',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: 'workflow-step-2',
      step_kind: 'merge_vote',
      status: 'pending_event',
      target_group_id: 'group-2',
      event_id: null,
      agenda_item_id: null,
      vote_id: null,
      decision_status: 'previous_decision_outstanding',
      order_index: 3,
    };
    const insertedHandoffStep = {
      id: '00000000-0000-4000-8000-000000000010',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: 'workflow-step-3',
      step_kind: 'workflow_handoff',
      status: 'scheduled',
      target_group_id: 'group-3',
      event_id: 'event-group-3',
      agenda_item_id: '00000000-0000-4000-8000-000000000011',
      vote_id: '00000000-0000-4000-8000-000000000012',
      decision_status: 'previous_decision_outstanding',
      order_index: 4,
    };
    const insertedMissingEventStep = {
      id: '00000000-0000-4000-8000-000000000017',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: 'workflow-step-4',
      step_kind: 'group_vote',
      status: 'pending_event',
      target_group_id: 'group-4',
      event_id: null,
      agenda_item_id: null,
      vote_id: null,
      decision_status: 'previous_decision_outstanding',
      order_index: 5,
    };
    const currentStep = {
      id: 'step-current',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: 'workflow-step-handoff',
      step_kind: 'workflow_handoff',
      selection_mode: 'explicit_workflow',
      status: 'scheduled',
      source_group_id: 'group-source',
      target_group_id: null,
      event_id: 'event-handoff',
      agenda_item_id: 'agenda-current',
      vote_id: 'vote-current',
      decision_status: 'forward_confirmed',
      order_index: 1,
      starts_at: 2_000,
      created_at: 1,
    };
    const synchronizedCurrentStep = {
      ...currentStep,
      status: 'approved',
      decision_status: 'approved',
    };
    const synchronizedStepRuns = [
      synchronizedCurrentStep,
      insertedFirstStep,
      insertedMergeStep,
      insertedHandoffStep,
      insertedMissingEventStep,
    ];
    const tx = createQueueTx([
      [currentStep],
      {
        id: 'agenda-current',
        amendment_id: 'amendment-1',
        title: 'Workflow handoff',
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
      },
      {
        id: 'amendment-1',
        title: 'Housing Reform',
        reason: 'Reason',
      },
      {
        ...buildDecisionVote({ accept: 2, reject: 0 }),
        id: 'vote-current',
      },
      {
        id: 'branch-1',
        status: 'scheduled',
      },
      [],
      currentStep,
      {
        id: 'workflow-step-handoff',
        target_workflow_id: 'workflow-next',
      },
      {
        id: 'event-handoff',
        start_date: 2_000,
        end_date: 2_500,
      },
      [
        {
          id: 'workflow-step-1',
          workflow_id: 'workflow-next',
          group_id: 'group-1',
          step_kind: 'invalid',
          selection_mode: 'invalid',
          merge_strategy: 'invalid',
          order_index: 1,
          group: null,
        },
        {
          id: 'workflow-step-2',
          workflow_id: 'workflow-next',
          group_id: 'group-2',
          step_kind: 'merge_vote',
          selection_mode: 'default_target_workflow',
          merge_strategy: 'winner_continues',
          auto_task_on_missing_event: false,
          order_index: 2,
          group: { name: 'Merge Group' },
        },
        {
          id: 'workflow-step-3',
          workflow_id: 'workflow-next',
          group_id: 'group-3',
          step_kind: 'workflow_handoff',
          selection_mode: 'explicit_workflow',
          merge_strategy: null,
          order_index: 3,
          group: { name: 'Handoff Group' },
        },
        {
          id: 'workflow-step-4',
          workflow_id: 'workflow-next',
          group_id: 'group-4',
          step_kind: 'group_vote',
          order_index: 4,
          group: { name: 'Missing Event Group' },
        },
      ],
      [
        { id: 'event-without-group', start_date: 5_000 },
        { id: 'event-without-start', group_id: 'group-1', start_date: null },
        { id: 'event-past', group_id: 'group-1', start_date: 500 },
        {
          id: 'event-group-1-late',
          group_id: 'group-1',
          start_date: 4_000,
          end_date: 4_100,
        },
        {
          id: 'event-group-1-early',
          group_id: 'group-1',
          start_date: 3_000,
          end_date: 3_100,
        },
        {
          id: 'event-group-2-too-early',
          group_id: 'group-2',
          start_date: 2_800,
        },
        {
          id: 'event-group-3',
          group: { id: 'group-3' },
          start_date: 3_500,
          end_date: null,
        },
      ],
      [{ id: 'step-existing-later', order_index: 9 }],
      [{ id: 'segment-existing-later', order_index: null }],
      { id: 'path-1' },
      [],
      [],
      null,
      synchronizedStepRuns.slice(1),
      [],
      [],
      [],
      synchronizedStepRuns,
      {
        id: 'agenda-current',
        forwarding_status: 'approved',
      },
      [],
      {
        id: insertedFirstStep.agenda_item_id,
        forwarding_status: 'forward_confirmed',
      },
      [],
      [],
      {
        id: insertedHandoffStep.agenda_item_id,
        forwarding_status: 'previous_decision_outstanding',
      },
      [],
      [],
      { id: insertedFirstStep.vote_id, status: 'open' },
      [{ id: 'branch-1', status: 'in_vote' }],
      { id: 'branch-1', editing_mode: 'suggest_event' },
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
    ).resolves.toMatchObject({
      handled: true,
      nextStepRunId: insertedFirstStep.id,
      branchStatus: 'in_vote',
      runStatus: 'in_vote',
    });

    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledTimes(4);
    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_step_id: 'workflow-step-1',
        source_group_id: null,
        target_group_id: 'group-1',
        event_id: 'event-group-1-early',
        step_kind: 'group_vote',
        selection_mode: 'explicit_workflow',
        merge_strategy: null,
        order_index: 2,
      })
    );
    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_step_id: 'workflow-step-2',
        source_group_id: 'group-1',
        event_id: null,
        step_kind: 'merge_vote',
        selection_mode: 'default_target_workflow',
        merge_strategy: 'winner_continues',
        order_index: 3,
      })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-existing-later',
        order_index: 13,
      })
    );
    expect(tx.mutate.amendment_path_segment.update).toHaveBeenCalledWith({
      id: 'segment-existing-later',
      order_index: 4,
    });
    expect(tx.mutate.amendment_path_segment.insert).toHaveBeenCalledTimes(4);
    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        step_run_id: insertedMissingEventStep.id,
        group_id: 'group-4',
        target_group_id: null,
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyProcessTaskCreated', {
      senderId: 'user-creator',
      groupId: 'group-4',
      groupName: 'Missing Event Group',
      taskTitle: 'Schedule amendment vote for Missing Event Group',
    });
  });

  it('materializes the target group default workflow without a process path', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    let uuidIndex = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidIndex += 1;
      return `60000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`;
    });
    const currentStep = {
      id: 'step-current',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: null,
      step_kind: 'workflow_handoff',
      selection_mode: 'default_target_workflow',
      status: 'scheduled',
      source_group_id: 'group-source',
      target_group_id: 'group-target',
      event_id: 'event-handoff',
      agenda_item_id: 'agenda-current',
      vote_id: 'vote-current',
      decision_status: 'forward_confirmed',
      order_index: 1,
      starts_at: null,
      created_at: 1,
    };
    const insertedStep = {
      id: '60000000-0000-4000-8000-000000000002',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      workflow_step_id: 'workflow-step-default',
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: 'group-next',
      event_id: 'event-next',
      agenda_item_id: '60000000-0000-4000-8000-000000000003',
      vote_id: '60000000-0000-4000-8000-000000000004',
      decision_status: 'forward_confirmed',
      order_index: 2,
    };
    const tx = createQueueTx([
      [currentStep],
      { id: 'agenda-current', amendment_id: 'amendment-1', title: 'Handoff' },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'user-creator' },
      { id: 'amendment-1', title: 'Housing Reform', reason: null },
      { ...buildDecisionVote({ accept: 2, reject: 0 }), id: 'vote-current' },
      { id: 'branch-1', status: 'scheduled' },
      [],
      null,
      currentStep,
      [{ id: 'workflow-default' }],
      null,
      [
        {
          id: 'workflow-step-default',
          workflow_id: 'workflow-default',
          group_id: 'group-next',
          step_kind: 'group_vote',
          selection_mode: 'explicit_workflow',
          order_index: 1,
          group: { name: 'Next Group' },
        },
      ],
      [
        {
          id: 'event-next',
          group_id: 'group-next',
          start_date: 2_000,
          end_date: 2_100,
        },
      ],
      [],
      [],
      null,
      [],
      [insertedStep],
      [],
      [],
      [],
      [
        {
          ...currentStep,
          status: 'approved',
          decision_status: 'approved',
        },
        insertedStep,
      ],
      { id: 'agenda-current', forwarding_status: 'approved' },
      [],
      { id: insertedStep.agenda_item_id, forwarding_status: 'forward_confirmed' },
      [],
      { id: insertedStep.vote_id, status: 'indicative' },
      [{ id: 'branch-1', status: 'scheduled' }],
      { id: 'branch-1', editing_mode: 'suggest_event' },
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
    ).resolves.toMatchObject({
      handled: true,
      nextStepRunId: insertedStep.id,
      branchStatus: 'scheduled',
      runStatus: 'scheduled',
    });

    expect(tx.mutate.amendment_group_decision.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-target', status: 'supported' })
    );
    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: insertedStep.id,
        workflow_id: 'workflow-default',
        source_group_id: null,
        target_group_id: 'group-next',
      })
    );
    expect(tx.mutate.amendment_path_segment.insert).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'refreshed handoff step is missing',
      currentOverrides: {},
      materializationResults: [null],
      postMaterializationResults: [],
    },
    {
      name: 'default handoff has no target group',
      currentOverrides: {
        workflow_step_id: null,
        selection_mode: 'default_target_workflow',
      },
      materializationResults: ['current'],
      postMaterializationResults: [],
    },
    {
      name: 'selected workflow has no steps',
      currentOverrides: { event_id: null, starts_at: 2_000 },
      materializationResults: [
        'current',
        { id: 'workflow-step-handoff', target_workflow_id: 'workflow-empty' },
        [],
      ],
      postMaterializationResults: [],
    },
    {
      name: 'target group has no default workflow',
      currentOverrides: {
        workflow_step_id: null,
        selection_mode: 'default_target_workflow',
        target_group_id: 'group-target',
      },
      materializationResults: ['current', []],
      postMaterializationResults: [null],
    },
  ])(
    'completes an approved handoff when the $name',
    async ({ currentOverrides, materializationResults, postMaterializationResults }) => {
      const currentStep = {
        id: 'step-current',
        process_run_id: 'run-1',
        branch_id: 'branch-1',
        workflow_step_id: 'workflow-step-handoff',
        step_kind: 'workflow_handoff',
        selection_mode: 'explicit_workflow',
        status: 'scheduled',
        target_group_id: null,
        event_id: 'event-handoff',
        agenda_item_id: 'agenda-current',
        vote_id: 'vote-current',
        decision_status: 'forward_confirmed',
        order_index: 1,
        created_at: 1,
        ...currentOverrides,
      };
      const resolvedMaterializationResults = materializationResults.map(result =>
        result === 'current' ? currentStep : result
      );
      const tx = createQueueTx([
        [currentStep],
        { id: 'agenda-current', amendment_id: 'amendment-1', title: 'Handoff' },
        { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'user-creator' },
        { id: 'amendment-1', title: 'Housing Reform', reason: null },
        { ...buildDecisionVote({ accept: 2, reject: 0 }), id: 'vote-current' },
        { id: 'branch-1', status: 'scheduled' },
        [],
        ...resolvedMaterializationResults,
        [],
        ...postMaterializationResults,
        [{ id: 'branch-1', status: 'completed' }],
        { id: 'branch-1', editing_mode: 'passed' },
      ]);

      await expect(
        resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
      ).resolves.toMatchObject({
        handled: true,
        nextStepRunId: null,
        terminalDecision: 'accepted',
        runStatus: 'completed',
      });

      expect(tx.mutate.amendment_process_step_run.insert).not.toHaveBeenCalled();
    }
  );

  it('resolves a merge winner, obsoletes the losing branch, and schedules round two', async () => {
    const now = 10_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    let uuidIndex = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidIndex += 1;
      return `10000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`;
    });

    const winnerStep = {
      id: 'step-winner',
      process_run_id: 'run-1',
      branch_id: 'branch-winner',
      step_kind: 'merge_vote',
      merge_strategy: 'winner_continues',
      status: 'scheduled',
      source_group_id: 'group-source',
      target_group_id: 'group-merge',
      event_id: 'event-merge',
      agenda_item_id: 'agenda-merge',
      vote_id: 'vote-merge',
      decision_status: 'forward_confirmed',
      order_index: 2,
      starts_at: 9_000,
      created_at: 1,
    };
    const loserStep = {
      ...winnerStep,
      id: 'step-loser',
      branch_id: 'branch-loser',
      created_at: 2,
    };
    const roundTwoStep = {
      id: '10000000-0000-4000-8000-000000000001',
      process_run_id: 'run-1',
      branch_id: 'branch-winner',
      step_kind: 'group_vote',
      status: 'scheduled',
      source_group_id: 'group-source',
      target_group_id: 'group-merge',
      event_id: 'event-merge',
      agenda_item_id: '10000000-0000-4000-8000-000000000002',
      vote_id: '10000000-0000-4000-8000-000000000003',
      decision_status: 'forward_confirmed',
      order_index: 3,
    };
    const tx = createQueueTx([
      [winnerStep, loserStep],
      {
        id: 'agenda-merge',
        amendment_id: 'amendment-main',
        title: 'Merge variants',
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-main',
        created_by_id: 'user-creator',
      },
      {
        id: 'amendment-main',
        title: 'Main Amendment',
        reason: 'Main reason',
      },
      {
        id: 'vote-merge',
        majority_type: 'simple',
        choices: [
          {
            id: 'choice-winner',
            label: 'Winner',
            process_branch_id: 'branch-winner',
            order_index: 1,
          },
          {
            id: 'choice-loser',
            label: 'Loser',
            process_branch_id: 'branch-loser',
            order_index: 2,
          },
          { id: 'choice-abstain', label: 'abstain', order_index: 3 },
        ],
        offline_tallies: [],
        voters: [{}, {}, {}],
        final_participations: [{}, {}, {}],
        final_decisions: [
          { choice_id: 'choice-winner' },
          { choice_id: 'choice-winner' },
          { choice_id: 'choice-loser' },
        ],
      },
      [],
      [
        { id: 'cr-loser-active', obsolete_at: null },
        { id: 'cr-loser-already-obsolete', obsolete_at: 5_000 },
      ],
      [
        { id: 'timeline-completed', status: 'completed' },
        { id: 'timeline-open', status: 'open' },
      ],
      [],
      [{ path_id: 'path-winner' }],
      { id: 'path-winner', amendment_id: 'amendment-winner' },
      {
        id: 'amendment-winner',
        title: 'Winning Amendment',
        reason: 'Winning reason',
      },
      [{ id: 'step-existing-later', order_index: 8 }],
      [{ id: 'segment-existing-later', order_index: 8 }],
      [],
      { id: 'path-process' },
      [
        { ...winnerStep, status: 'merged', decision_status: 'merged', agenda_item_id: null },
        roundTwoStep,
        {
          id: 'step-existing-later',
          status: 'pending_event',
          decision_status: 'previous_decision_outstanding',
          order_index: 9,
          event_id: null,
          vote_id: null,
          agenda_item_id: null,
        },
      ],
      [],
      {
        id: roundTwoStep.agenda_item_id,
        forwarding_status: 'forward_confirmed',
      },
      [],
      [],
      { id: roundTwoStep.vote_id, status: 'indicative' },
      [
        { id: 'branch-winner', status: 'scheduled' },
        { id: 'branch-loser', status: 'rejected' },
      ],
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-merge' })
    ).resolves.toMatchObject({
      handled: true,
      branchId: 'branch-winner',
      nextStepRunId: roundTwoStep.id,
      voteResult: 'passed',
      runStatus: 'scheduled',
    });

    expect(tx.mutate.change_request.update).toHaveBeenCalledTimes(1);
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-loser-active',
        obsolete_reason: 'merge_loser',
        obsolete_by_vote_id: 'vote-merge',
      })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'timeline-completed', status: 'completed' })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'timeline-open', status: 'obsolete' })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step-existing-later', order_index: 9 })
    );
    expect(tx.mutate.amendment_path_segment.update).toHaveBeenCalledWith({
      id: 'segment-existing-later',
      order_index: 9,
    });
    expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: roundTwoStep.agenda_item_id,
        amendment_id: 'amendment-winner',
        title: 'Merge confirmation: Winning Amendment',
      })
    );
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: roundTwoStep.vote_id,
        title: 'Merge round 2: Winning Amendment',
      })
    );
    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: roundTwoStep.id,
        branch_id: 'branch-winner',
        order_index: 3,
        status: 'scheduled',
      })
    );
  });

  it('recovers a legacy merge vote without an event by creating a round-two task', async () => {
    let uuidIndex = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidIndex += 1;
      return `70000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`;
    });
    const winnerStep = {
      id: 'step-winner',
      process_run_id: 'run-1',
      branch_id: 'branch-winner',
      step_kind: 'merge_vote',
      status: 'scheduled',
      source_group_id: null,
      target_group_id: null,
      event_id: null,
      agenda_item_id: 'agenda-merge',
      vote_id: 'vote-merge',
      decision_status: 'forward_confirmed',
      order_index: 2,
      created_at: 1,
    };
    const loserStep = {
      ...winnerStep,
      id: 'step-loser',
      branch_id: 'branch-loser',
      created_at: 2,
    };
    const roundTwoStepId = '70000000-0000-4000-8000-000000000001';
    const tx = createQueueTx([
      [winnerStep, loserStep],
      { id: 'agenda-merge', amendment_id: 'amendment-main', title: null },
      {
        id: 'run-1',
        amendment_id: 'amendment-main',
        created_by_id: 'user-creator',
      },
      { id: 'amendment-main', title: null, reason: null },
      {
        id: 'vote-merge',
        choices: [
          {
            id: 'choice-winner',
            process_branch_id: 'branch-winner',
            order_index: 1,
          },
          {
            id: 'choice-loser',
            process_branch_id: 'branch-loser',
            order_index: 2,
          },
        ],
        final_decisions: [{ choice_id: 'choice-winner' }],
        offline_tallies: [],
      },
      [],
      [],
      [],
      [],
      [{ path_id: 'path-without-amendment' }],
      null,
      [],
      [],
      null,
      null,
      [
        { ...winnerStep, status: 'merged', decision_status: 'merged', agenda_item_id: null },
        {
          id: roundTwoStepId,
          status: 'pending_event',
          decision_status: 'previous_decision_outstanding',
          event_id: null,
          agenda_item_id: null,
          vote_id: null,
          order_index: 3,
        },
      ],
      [],
      [],
      [
        { id: 'branch-winner', status: 'pending_event' },
        { id: 'branch-loser', status: 'rejected' },
      ],
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-merge' })
    ).resolves.toMatchObject({
      handled: true,
      branchId: 'branch-winner',
      nextStepRunId: roundTwoStepId,
      runStatus: 'pending_event',
    });

    expect(tx.mutate.amendment_process_step_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: roundTwoStepId,
        event_id: null,
        agenda_item_id: null,
        vote_id: null,
        status: 'pending_event',
      })
    );
    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        step_run_id: roundTwoStepId,
        group_id: '',
        metadata: expect.objectContaining({ mergeRound: 2 }),
      })
    );
  });

  it('materializes a shared first-round merge vote after assigning its event', async () => {
    let uuidIndex = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      uuidIndex += 1;
      return `20000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`;
    });
    const mergeStepA = {
      id: 'merge-step-a',
      process_run_id: 'run-1',
      branch_id: 'branch-a',
      workflow_step_id: 'workflow-merge-step',
      step_kind: 'merge_vote',
      status: 'scheduled',
      source_group_id: 'group-source',
      target_group_id: 'group-merge',
      event_id: 'event-merge',
      agenda_item_id: null,
      vote_id: null,
      decision_status: 'tie',
      order_index: 2,
      created_at: 1,
    };
    const mergeStepB = {
      ...mergeStepA,
      id: 'merge-step-b',
      branch_id: 'branch-b',
      created_at: 2,
    };
    const tx = createQueueTx([
      {
        id: 'task-merge',
        process_run_id: 'run-1',
        branch_id: null,
        step_run_id: 'merge-step-a',
        task_type: 'schedule_event',
        support_confirmation_id: null,
      },
      {
        id: 'event-merge',
        title: 'Merge Event',
        start_date: 20_000,
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
      },
      {
        id: 'amendment-1',
        title: 'Housing Reform',
        reason: 'Reason',
      },
      { ...mergeStepA, event_id: null, status: 'pending_event' },
      [],
      [],
      [],
      mergeStepA,
      [
        { id: 'branch-a', title: 'Variant A', status: 'scheduled', created_at: 1 },
        { id: 'branch-b', title: 'Variant B', status: 'scheduled', created_at: 2 },
      ],
      [mergeStepA, mergeStepB],
      [],
      [],
      [],
      [],
      [
        { id: 'branch-a', status: 'scheduled' },
        { id: 'branch-b', status: 'scheduled' },
      ],
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-merge',
        event_id: 'event-merge',
      })
    ).resolves.toMatchObject({
      handled: true,
      stepRunId: 'merge-step-a',
      runStatus: 'scheduled',
    });

    const agendaItemId = '20000000-0000-4000-8000-000000000001';
    const voteId = '20000000-0000-4000-8000-000000000002';
    expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: agendaItemId,
        event_id: 'event-merge',
        title: expect.stringContaining('Variant A'),
      })
    );
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: voteId,
        agenda_item_id: agendaItemId,
        purpose: 'merge_variant',
      })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'merge-step-a',
        agenda_item_id: agendaItemId,
        vote_id: voteId,
        status: 'scheduled',
      })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'merge-step-b',
        agenda_item_id: agendaItemId,
        vote_id: voteId,
        status: 'scheduled',
      })
    );
  });

  it.each([
    {
      name: 'no active branch participates',
      automaticBranches: [
        { id: 'branch-terminal', status: 'completed', created_at: 1 },
        { id: 'branch-active', status: 'scheduled', created_at: 2 },
      ],
      automaticStepRuns: [
        {
          id: 'terminal-step',
          process_run_id: 'run-1',
          branch_id: 'branch-terminal',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'group_vote',
          status: 'scheduled',
          target_group_id: 'group-merge',
          event_id: 'event-merge',
          order_index: 1,
        },
      ],
      participatingBranches: [
        { id: 'branch-terminal', status: 'completed', created_at: 1 },
        { id: 'branch-active', status: 'scheduled', created_at: 2 },
      ],
      participatingStepRuns: [
        {
          id: 'terminal-step',
          process_run_id: 'run-1',
          branch_id: 'branch-terminal',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'scheduled',
          target_group_id: 'group-merge',
          event_id: 'event-merge',
          order_index: 1,
        },
      ],
    },
    {
      name: 'first unresolved branch step has a different fingerprint',
      automaticBranches: [],
      automaticStepRuns: [],
      participatingBranches: [
        { id: 'branch-a', status: 'scheduled', created_at: 1 },
        { id: 'branch-b', status: 'scheduled', created_at: 2 },
      ],
      participatingStepRuns: [
        {
          id: 'earlier-step-a',
          process_run_id: 'run-1',
          branch_id: 'branch-a',
          workflow_step_id: null,
          step_kind: 'group_vote',
          status: 'pending_event',
          target_group_id: 'group-earlier',
          event_id: null,
          order_index: 1,
        },
        {
          id: 'merge-step-a',
          process_run_id: 'run-1',
          branch_id: 'branch-a',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'scheduled',
          target_group_id: 'group-merge',
          event_id: 'event-merge',
          order_index: 2,
        },
        {
          id: 'merge-step-b',
          process_run_id: 'run-1',
          branch_id: 'branch-b',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'scheduled',
          target_group_id: 'group-merge',
          event_id: 'event-merge',
          order_index: 2,
        },
      ],
    },
    {
      name: 'participating branches use different events',
      automaticBranches: [],
      automaticStepRuns: [],
      participatingBranches: [
        { id: 'branch-a', status: 'scheduled', created_at: 1 },
        { id: 'branch-b', status: 'scheduled', created_at: 2 },
      ],
      participatingStepRuns: [
        {
          id: 'merge-step-a',
          process_run_id: 'run-1',
          branch_id: 'branch-a',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'scheduled',
          target_group_id: 'group-merge',
          event_id: 'event-a',
          order_index: 2,
        },
        {
          id: 'merge-step-b',
          process_run_id: 'run-1',
          branch_id: 'branch-b',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'scheduled',
          target_group_id: 'group-merge',
          event_id: 'event-b',
          order_index: 2,
        },
      ],
    },
    {
      name: 'participating branches have no event yet',
      automaticBranches: [],
      automaticStepRuns: [],
      participatingBranches: [
        { id: 'branch-a', status: 'scheduled', created_at: 1 },
        { id: 'branch-b', status: 'scheduled', created_at: 2 },
      ],
      participatingStepRuns: [
        {
          id: 'merge-step-a',
          process_run_id: 'run-1',
          branch_id: 'branch-a',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'pending_event',
          target_group_id: 'group-merge',
          event_id: null,
          order_index: 2,
        },
        {
          id: 'merge-step-b',
          process_run_id: 'run-1',
          branch_id: 'branch-b',
          workflow_step_id: 'workflow-merge-step',
          step_kind: 'merge_vote',
          status: 'pending_event',
          target_group_id: 'group-merge',
          event_id: null,
          order_index: 2,
        },
      ],
    },
  ])(
    'does not create a first-round merge vote when $name',
    async ({
      automaticBranches,
      automaticStepRuns,
      participatingBranches,
      participatingStepRuns,
    }) => {
      const anchorStep = {
        id: 'merge-anchor',
        process_run_id: 'run-1',
        branch_id: 'branch-active',
        workflow_step_id: 'workflow-merge-step',
        step_kind: 'merge_vote',
        status: 'scheduled',
        target_group_id: 'group-merge',
        event_id: 'event-merge',
        agenda_item_id: null,
        vote_id: null,
        decision_status: 'forward_confirmed',
        order_index: 2,
      };
      const tx = createQueueTx([
        {
          id: 'task-merge',
          process_run_id: 'run-1',
          branch_id: null,
          step_run_id: 'merge-anchor',
          task_type: 'schedule_event',
          support_confirmation_id: null,
        },
        { id: 'event-merge', title: 'Merge Event', start_date: 20_000 },
        { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'user-creator' },
        { id: 'amendment-1', title: 'Housing Reform', reason: null },
        { ...anchorStep, event_id: null, status: 'pending_event' },
        [],
        automaticBranches,
        automaticStepRuns,
        anchorStep,
        participatingBranches,
        participatingStepRuns,
        [],
      ]);

      await expect(
        completeProcessTaskWithEvent(tx as never, 'user-1', {
          process_task_id: 'task-merge',
          event_id: 'event-merge',
        })
      ).resolves.toMatchObject({ handled: true, runStatus: 'completed' });

      expect(tx.mutate.agenda_item.insert).not.toHaveBeenCalled();
      expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    }
  );

  it('rejects a branch and removes the runtime of outstanding future decisions', async () => {
    const currentStep = {
      id: 'step-current',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: 'group-target',
      event_id: 'event-current',
      agenda_item_id: 'agenda-current',
      vote_id: 'vote-current',
      decision_status: 'forward_confirmed',
      order_index: 1,
      created_at: 1,
    };
    const outstandingFutureStep = {
      id: 'step-future-outstanding',
      branch_id: 'branch-1',
      agenda_item_id: 'agenda-future-outstanding',
      vote_id: 'vote-future-outstanding',
      decision_status: 'previous_decision_outstanding',
      order_index: 2,
    };
    const confirmedFutureStep = {
      id: 'step-future-confirmed',
      branch_id: 'branch-1',
      agenda_item_id: 'agenda-future-confirmed',
      vote_id: 'vote-future-confirmed',
      decision_status: 'forward_confirmed',
      order_index: 3,
    };
    const tx = createQueueTx([
      [currentStep],
      {
        id: 'agenda-current',
        amendment_id: 'amendment-1',
        title: 'Current decision',
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
      },
      {
        id: 'amendment-1',
        title: 'Housing Reform',
        reason: 'Reason',
      },
      {
        ...buildDecisionVote({ accept: 0, reject: 2 }),
        id: 'vote-current',
        offline_tallies: [
          { phase: 'indicative', choice_id: 'choice-accept', count: 10 },
          { phase: 'final', choice_id: 'choice-reject', count: 1 },
        ],
      },
      { id: 'branch-1', status: 'scheduled' },
      [{ id: 'segment-current' }],
      { id: 'decision-existing' },
      [outstandingFutureStep, confirmedFutureStep],
      [{ id: 'speaker-future' }],
      [{ id: 'accreditation-future' }],
      [{ id: 'timeline-future' }],
      [{ id: 'choice-future' }],
      [{ id: 'voter-future' }],
      [{ id: 'indicative-participation-future' }],
      [{ id: 'indicative-decision-future' }],
      [{ id: 'final-participation-future' }],
      [{ id: 'final-decision-future' }],
      [{ id: 'offline-tally-future' }],
      [
        { id: 'task-future-open', status: 'open' },
        { id: 'task-future-completed', status: 'completed' },
        { id: 'task-future-cancelled', status: 'cancelled' },
      ],
      [{ id: 'segment-future-outstanding' }],
      [{ id: 'task-future-confirmed-open', status: 'open' }],
      [{ id: 'segment-future-confirmed' }],
      [{ id: 'branch-1', status: 'rejected' }],
      { id: 'branch-1', editing_mode: 'view' },
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
    ).resolves.toMatchObject({
      handled: true,
      branchId: 'branch-1',
      stepRunId: 'step-current',
      voteResult: 'rejected',
      runStatus: 'rejected',
      terminalDecision: 'rejected',
    });

    expect(tx.mutate.amendment_group_decision.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'decision-existing', status: 'rejected' })
    );
    expect(tx.mutate.speaker_list.delete).toHaveBeenCalledWith({ id: 'speaker-future' });
    expect(tx.mutate.accreditation.delete).toHaveBeenCalledWith({
      id: 'accreditation-future',
    });
    expect(tx.mutate.agenda_item_change_request.delete).toHaveBeenCalledWith({
      id: 'timeline-future',
    });
    expect(tx.mutate.vote.delete).toHaveBeenCalledWith({ id: 'vote-future-outstanding' });
    expect(tx.mutate.agenda_item.delete).toHaveBeenCalledWith({
      id: 'agenda-future-outstanding',
    });
    expect(tx.mutate.vote.delete).not.toHaveBeenCalledWith({ id: 'vote-future-confirmed' });
    expect(tx.mutate.agenda_item.delete).not.toHaveBeenCalledWith({
      id: 'agenda-future-confirmed',
    });
    expect(tx.mutate.process_task.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-future-open', status: 'cancelled' })
    );
    expect(tx.mutate.process_task.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-future-completed' })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-future-outstanding',
        agenda_item_id: null,
        vote_id: null,
        status: 'rejected',
      })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-future-confirmed',
        agenda_item_id: 'agenda-future-confirmed',
        vote_id: 'vote-future-confirmed',
        status: 'rejected',
      })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch-1', editing_mode: 'rejected' })
    );
  });

  it('rejects a branch without creating a decision for a missing target group', async () => {
    const currentStep = {
      id: 'step-no-target',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: null,
      event_id: 'event-current',
      agenda_item_id: 'agenda-current',
      vote_id: 'vote-current',
      decision_status: 'forward_confirmed',
      order_index: 1,
      created_at: 1,
    };
    const tx = createQueueTx([
      [currentStep],
      { id: 'agenda-current', amendment_id: 'amendment-1', title: null },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'creator-1' },
      null,
      { ...buildDecisionVote({ accept: 0, reject: 2 }), id: 'vote-current' },
      { id: 'branch-1', status: 'scheduled' },
      [],
      [],
      [{ id: 'branch-1', status: 'rejected' }],
      { id: 'branch-1', editing_mode: 'view' },
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
    ).resolves.toMatchObject({ handled: true, terminalDecision: 'rejected' });

    expect(tx.mutate.amendment_group_decision.insert).not.toHaveBeenCalled();
    expect(tx.mutate.amendment_group_decision.update).not.toHaveBeenCalled();
  });

  it('keeps a regular process vote open when the final result is tied', async () => {
    const currentStep = {
      id: 'step-current',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: null,
      event_id: 'event-current',
      agenda_item_id: 'agenda-current',
      vote_id: 'vote-current',
      decision_status: 'forward_confirmed',
      order_index: 1,
      created_at: 1,
    };
    const synchronizedStep = {
      ...currentStep,
      decision_status: 'tie',
    };
    const tx = createQueueTx([
      [currentStep],
      { id: 'agenda-current', amendment_id: 'amendment-1', title: null },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'user-creator' },
      null,
      { ...buildDecisionVote({ accept: 1, reject: 1 }), id: 'vote-current' },
      { id: 'branch-1', status: 'in_vote' },
      [],
      [synchronizedStep],
      { id: 'agenda-current', forwarding_status: 'tie' },
      [],
      { id: 'vote-current', status: 'open' },
      [{ id: 'branch-1', status: 'in_vote' }],
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
    ).resolves.toMatchObject({
      handled: true,
      voteResult: 'tie',
      runStatus: 'in_vote',
      terminalDecision: null,
    });

    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step-current', decision_status: 'tie' })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch-1', status: 'in_vote' })
    );
  });

  it('keeps all merge branches open when the merge vote is tied', async () => {
    const mergeStepA = {
      id: 'merge-step-a',
      process_run_id: 'run-1',
      branch_id: 'branch-a',
      step_kind: 'merge_vote',
      status: 'scheduled',
      event_id: 'event-merge',
      agenda_item_id: 'agenda-merge',
      vote_id: 'vote-merge',
      decision_status: 'forward_confirmed',
      order_index: 1,
      created_at: 1,
    };
    const mergeStepB = {
      ...mergeStepA,
      id: 'merge-step-b',
      branch_id: 'branch-b',
      created_at: 2,
    };
    const synchronizedStepA = { ...mergeStepA, decision_status: 'tie' };
    const synchronizedStepB = { ...mergeStepB, decision_status: 'tie' };
    const tiedVote = {
      id: 'vote-merge',
      choices: [
        {
          id: 'choice-a',
          label: 'A',
          process_branch_id: 'branch-a',
          order_index: 1,
        },
        {
          id: 'choice-b',
          label: 'B',
          process_branch_id: 'branch-b',
          order_index: 2,
        },
      ],
      offline_tallies: [],
      voters: [{}, {}],
      final_participations: [{}, {}],
      final_decisions: [{ choice_id: 'choice-a' }, { choice_id: 'choice-b' }],
    };
    const tx = createQueueTx([
      [mergeStepA, mergeStepB],
      { id: 'agenda-merge', amendment_id: 'amendment-1', title: 'Merge' },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'user-creator' },
      { id: 'amendment-1', title: 'Housing Reform', reason: null },
      tiedVote,
      [],
      [synchronizedStepA],
      { id: 'agenda-merge', forwarding_status: 'tie' },
      [],
      { id: 'vote-merge', status: 'open' },
      [],
      [synchronizedStepB],
      { id: 'agenda-merge', forwarding_status: 'tie' },
      [],
      { id: 'vote-merge', status: 'open' },
      [
        { id: 'branch-a', status: 'in_vote' },
        { id: 'branch-b', status: 'in_vote' },
      ],
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-merge' })
    ).resolves.toMatchObject({
      handled: true,
      voteResult: 'tie',
      runStatus: 'in_vote',
      terminalDecision: null,
    });

    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'merge-step-a', decision_status: 'tie' })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'merge-step-b', decision_status: 'tie' })
    );
  });

  it('ignores an agenda item that is not linked to an implementation task', async () => {
    const tx = createQueueTx([[], null]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-unlinked' })
    ).resolves.toEqual({ handled: false });

    expect(tx.run).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: 'agenda item is missing',
      runResults: [
        [],
        { id: 'task-1', process_run_id: 'run-1' },
        null,
        { id: 'run-1', amendment_id: 'amendment-1' },
        { id: 'vote-record' },
        buildImplementationVote({ yes: 1, no: 0 }),
      ],
    },
    {
      name: 'process run is missing',
      runResults: [
        [],
        { id: 'task-1', process_run_id: 'run-1' },
        { id: 'agenda-1', amendment_id: 'amendment-1' },
        null,
        { id: 'vote-record' },
        buildImplementationVote({ yes: 1, no: 0 }),
      ],
    },
    {
      name: 'amendment link is missing',
      runResults: [
        [],
        { id: 'task-1', process_run_id: 'run-1' },
        { id: 'agenda-1', amendment_id: null },
        { id: 'run-1', amendment_id: null },
        { id: 'vote-record' },
        buildImplementationVote({ yes: 1, no: 0 }),
      ],
    },
    {
      name: 'vote is missing',
      runResults: [
        [],
        { id: 'task-1', process_run_id: 'run-1' },
        { id: 'agenda-1', amendment_id: 'amendment-1' },
        { id: 'run-1', amendment_id: 'amendment-1' },
        null,
      ],
    },
  ])('does not resolve an implementation vote when the $name', async ({ runResults }) => {
    const tx = createQueueTx(runResults);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' })
    ).resolves.toEqual({ handled: false });

    expect(tx.mutate.agenda_item.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'agenda item is missing',
      runResults: [
        [{ id: 'step-1', process_run_id: 'run-1', vote_id: 'vote-1' }],
        null,
        { id: 'run-1', amendment_id: 'amendment-1' },
        { id: 'amendment-1' },
        buildDecisionVote({ accept: 1, reject: 0 }),
      ],
    },
    {
      name: 'process run is missing',
      runResults: [
        [{ id: 'step-1', process_run_id: 'run-1', vote_id: 'vote-1' }],
        { id: 'agenda-1', amendment_id: 'amendment-1' },
        null,
        { id: 'amendment-1' },
        buildDecisionVote({ accept: 1, reject: 0 }),
      ],
    },
    {
      name: 'amendment link is missing',
      runResults: [
        [{ id: 'step-1', process_run_id: 'run-1', vote_id: 'vote-1' }],
        { id: 'agenda-1', amendment_id: null },
        { id: 'run-1', amendment_id: null },
        buildDecisionVote({ accept: 1, reject: 0 }),
      ],
    },
    {
      name: 'step vote link is missing',
      runResults: [
        [{ id: 'step-1', process_run_id: 'run-1', vote_id: null }],
        { id: 'agenda-1', amendment_id: 'amendment-1' },
        { id: 'run-1', amendment_id: 'amendment-1' },
        { id: 'amendment-1' },
      ],
    },
    {
      name: 'vote details are missing',
      runResults: [
        [{ id: 'step-1', process_run_id: 'run-1', vote_id: 'vote-1' }],
        { id: 'agenda-1', amendment_id: 'amendment-1' },
        { id: 'run-1', amendment_id: 'amendment-1' },
        { id: 'amendment-1' },
        null,
      ],
    },
  ])('does not resolve a process vote when the $name', async ({ runResults }) => {
    const tx = createQueueTx(runResults);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' })
    ).resolves.toEqual({ handled: false });

    expect(tx.mutate.agenda_item.update).not.toHaveBeenCalled();
  });

  it('does not resolve a process vote when its branch no longer exists', async () => {
    const step = {
      id: 'step-1',
      process_run_id: 'run-1',
      branch_id: 'branch-missing',
      step_kind: 'group_vote',
      vote_id: 'vote-1',
    };
    const tx = createQueueTx([
      [step],
      { id: 'agenda-1', amendment_id: 'amendment-1' },
      { id: 'run-1', amendment_id: 'amendment-1' },
      { id: 'amendment-1' },
      buildDecisionVote({ accept: 1, reject: 0 }),
      null,
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' })
    ).resolves.toEqual({ handled: false });
  });

  it('does not accept a merge result whose winning branch was not a candidate', async () => {
    const mergeStep = {
      id: 'merge-step-1',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'merge_vote',
      vote_id: 'vote-1',
      created_at: 1,
    };
    const tx = createQueueTx([
      [mergeStep],
      { id: 'agenda-1', amendment_id: 'amendment-1' },
      { id: 'run-1', amendment_id: 'amendment-1' },
      { id: 'amendment-1' },
      {
        id: 'vote-1',
        choices: [
          {
            id: 'choice-unknown',
            label: 'Unknown',
            process_branch_id: 'branch-unknown',
            order_index: 1,
          },
        ],
        final_decisions: [{ choice_id: 'choice-unknown' }],
        offline_tallies: [],
      },
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-1' })
    ).resolves.toEqual({ handled: false });
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
      null,
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
      groupName: 'die zuständige Gruppe',
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

  it('does not increment an already-appended next agenda item again', async () => {
    const tx = createQueueTx([
      [
        {
          id: 'step-current',
          process_run_id: 'run-1',
          branch_id: 'branch-1',
          vote_id: 'vote-1',
          target_group_id: null,
          order_index: 1,
          status: 'scheduled',
          step_kind: 'group_vote',
        },
      ],
      { id: 'agenda-current', amendment_id: 'amendment-1', title: 'Current Vote' },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-creator',
        status: 'scheduled',
      },
      { id: 'amendment-1', title: 'Housing Reform', reason: 'Reason' },
      buildDecisionVote({ accept: 2, reject: 0 }),
      { id: 'branch-1', status: 'scheduled', created_at: 1 },
      [],
      [
        {
          id: 'step-next',
          process_run_id: 'run-1',
          branch_id: 'branch-1',
          vote_id: 'vote-next',
          target_group_id: null,
          order_index: 2,
          status: 'scheduled',
          step_kind: 'group_vote',
          event_id: 'event-next',
          agenda_item_id: 'agenda-next',
        },
      ],
      [
        { id: 'agenda-existing', order_index: 1, forwarding_status: 'forward_confirmed' },
        { id: 'agenda-next', order_index: 2, forwarding_status: 'forward_confirmed' },
        {
          id: 'agenda-outstanding',
          order_index: 999,
          forwarding_status: 'previous_decision_outstanding',
        },
      ],
      [],
      [],
      [],
      [{ id: 'branch-1', status: 'scheduled', created_at: 1 }],
      { id: 'event-next', start_date: Number.MAX_SAFE_INTEGER },
      { id: 'amendment-1', editing_mode: 'view' },
      null,
      [],
    ]);

    await resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' });

    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-next',
        order_index: 2,
      })
    );
    expect(tx.mutate.agenda_item.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-next',
        order_index: 3,
      })
    );
  });

  it.each([
    {
      name: 'agenda exists but vote is missing',
      existingAgendaItemId: 'agenda-next',
      existingVoteId: null,
      expectedAgendaItemId: 'agenda-next',
      expectedVoteId: '50000000-0000-4000-8000-000000000001',
      requiresRefresh: false,
      refreshedAgendaItem: null,
    },
    {
      name: 'vote exists but agenda is missing',
      existingAgendaItemId: null,
      existingVoteId: 'vote-next',
      expectedAgendaItemId: '50000000-0000-4000-8000-000000000001',
      expectedVoteId: 'vote-next',
      requiresRefresh: true,
      refreshedAgendaItem: {
        id: 'step-next',
        agenda_item_id: '50000000-0000-4000-8000-000000000001',
      },
    },
    {
      name: 'new agenda is not visible on the immediate refresh',
      existingAgendaItemId: null,
      existingVoteId: 'vote-next',
      expectedAgendaItemId: '50000000-0000-4000-8000-000000000001',
      expectedVoteId: 'vote-next',
      requiresRefresh: true,
      refreshedAgendaItem: null,
    },
  ])(
    'repairs a partially scheduled next step when the $name',
    async ({
      existingAgendaItemId,
      existingVoteId,
      expectedAgendaItemId,
      expectedVoteId,
      requiresRefresh,
      refreshedAgendaItem,
    }) => {
      let uuidIndex = 0;
      vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        uuidIndex += 1;
        return `50000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`;
      });
      const currentStep = {
        id: 'step-current',
        process_run_id: 'run-1',
        branch_id: 'branch-1',
        vote_id: 'vote-current',
        target_group_id: null,
        order_index: 1,
        status: 'scheduled',
        step_kind: 'group_vote',
      };
      const nextStep = {
        id: 'step-next',
        process_run_id: 'run-1',
        branch_id: 'branch-1',
        vote_id: existingVoteId,
        target_group_id: null,
        order_index: 2,
        status: 'scheduled',
        step_kind: 'group_vote',
        event_id: 'event-next',
        agenda_item_id: existingAgendaItemId,
        decision_status: 'forward_confirmed',
      };
      const synchronizedSteps = [
        {
          ...currentStep,
          status: 'approved',
          decision_status: 'approved',
          agenda_item_id: null,
          vote_id: null,
        },
        {
          ...nextStep,
          agenda_item_id: expectedAgendaItemId,
          vote_id: expectedVoteId,
        },
      ];
      const runResults: unknown[] = [
        [currentStep],
        { id: 'agenda-current', amendment_id: 'amendment-1', title: 'Current Vote' },
        {
          id: 'run-1',
          amendment_id: 'amendment-1',
          created_by_id: 'user-creator',
          status: 'scheduled',
        },
        { id: 'amendment-1', title: 'Housing Reform', reason: null },
        buildDecisionVote({ accept: 2, reject: 0 }),
        { id: 'branch-1', status: 'scheduled' },
        [],
        [nextStep],
        [],
        [
          { id: 'task-next-open', status: 'open' },
          { id: 'task-next-completed', status: 'completed' },
          { id: 'task-next-cancelled', status: 'cancelled' },
        ],
      ];
      if (requiresRefresh) {
        runResults.push(refreshedAgendaItem);
      }
      if (!requiresRefresh || refreshedAgendaItem) {
        runResults.push([]);
      }
      runResults.push(
        [],
        [],
        synchronizedSteps,
        [],
        { id: expectedAgendaItemId, forwarding_status: 'forward_confirmed' },
        [],
        { id: expectedVoteId, status: 'indicative' },
        [{ id: 'branch-1', status: 'scheduled' }],
        { id: 'branch-1', editing_mode: 'suggest_event' }
      );
      const tx = createQueueTx(runResults);

      await expect(
        resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
      ).resolves.toMatchObject({
        handled: true,
        nextStepRunId: 'step-next',
        branchStatus: 'scheduled',
        runStatus: 'scheduled',
      });

      expect(tx.mutate.agenda_item.insert).toHaveBeenCalledWith(
        expect.objectContaining({ id: expectedAgendaItemId, event_id: 'event-next' })
      );
      expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
        expect.objectContaining({ id: expectedVoteId, agenda_item_id: expectedAgendaItemId })
      );
      expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'step-next',
          agenda_item_id: expectedAgendaItemId,
          vote_id: expectedVoteId,
          status: 'scheduled',
        })
      );
      expect(tx.mutate.process_task.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-next-open', status: 'completed' })
      );
      expect(tx.mutate.process_task.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-next-completed' })
      );
    }
  );

  it('keeps a pending merge step as the next process step when it cannot be materialized yet', async () => {
    const currentStep = {
      id: 'step-current',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'group_vote',
      status: 'scheduled',
      target_group_id: null,
      event_id: 'event-current',
      agenda_item_id: 'agenda-current',
      vote_id: 'vote-current',
      decision_status: 'forward_confirmed',
      order_index: 1,
    };
    const nextMergeStep = {
      id: 'step-merge-next',
      process_run_id: 'run-1',
      branch_id: 'branch-1',
      step_kind: 'merge_vote',
      status: 'pending_event',
      target_group_id: 'group-merge',
      event_id: null,
      agenda_item_id: null,
      vote_id: null,
      decision_status: 'previous_decision_outstanding',
      order_index: 2,
    };
    const tx = createQueueTx([
      [currentStep],
      { id: 'agenda-current', amendment_id: 'amendment-1', title: 'Current' },
      { id: 'run-1', amendment_id: 'amendment-1', created_by_id: 'user-creator' },
      { id: 'amendment-1', title: 'Housing Reform', reason: null },
      { ...buildDecisionVote({ accept: 2, reject: 0 }), id: 'vote-current' },
      { id: 'branch-1', status: 'scheduled' },
      [],
      [nextMergeStep],
      null,
      [],
      [],
      [
        {
          ...currentStep,
          status: 'approved',
          decision_status: 'approved',
          agenda_item_id: null,
        },
        nextMergeStep,
      ],
      [],
      [],
      [{ id: 'branch-1', status: 'pending_event' }],
      { id: 'branch-1', editing_mode: 'view' },
    ]);

    await expect(
      resolveAmendmentProcessVote(tx as never, { agenda_item_id: 'agenda-current' })
    ).resolves.toMatchObject({
      handled: true,
      nextStepRunId: 'step-merge-next',
      branchStatus: 'pending_event',
      runStatus: 'pending_event',
    });

    expect(tx.mutate.agenda_item.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
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

  it.each([
    {
      name: 'implemented',
      vote: buildImplementationVote({ yes: 3, no: 1 }),
      forwardingStatus: 'approved',
      implementationStatus: 'implemented',
    },
    {
      name: 'failed',
      vote: buildImplementationVote({ yes: 0, no: 3 }),
      forwardingStatus: 'rejected',
      implementationStatus: 'implementation_failed',
    },
  ])(
    'marks an implementation review as $name when no step run exists',
    async ({ vote, forwardingStatus, implementationStatus }) => {
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
        vote,
      ]);

      await resolveAmendmentProcessVote(tx as never, {
        agenda_item_id: 'agenda-implementation-1',
      });

      expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'agenda-implementation-1',
          forwarding_status: forwardingStatus,
        })
      );
      expect(tx.mutate.amendment_process_run.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-1',
          implementation_status: implementationStatus,
        })
      );
    }
  );

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
