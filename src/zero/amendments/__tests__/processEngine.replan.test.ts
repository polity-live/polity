import { beforeEach, describe, expect, it, vi } from 'vitest';

const fireNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('../../server-notify', () => ({
  fireNotification: (...args: unknown[]) => fireNotificationMock(...args),
}));

import { completeProcessTaskWithEvent, replanProcessBranchEvents } from '../process-engine';

const future = Date.now() + 60 * 60 * 1000;

function baseBranch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'branch-1',
    process_run_id: 'run-1',
    status: 'scheduled',
    created_at: 1,
    ...overrides,
  };
}

function baseProcessRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    amendment_id: 'amendment-1',
    selected_target_group_id: 'group-target',
    created_by_id: 'author-1',
    status: 'scheduled',
    ...overrides,
  };
}

function baseAmendment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'amendment-1',
    title: 'Budget Reform',
    reason: 'Testing',
    ...overrides,
  };
}

function stepRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    process_run_id: 'run-1',
    branch_id: 'branch-1',
    workflow_id: null,
    workflow_step_id: null,
    step_kind: 'group_vote',
    selection_mode: null,
    merge_strategy: null,
    status: 'scheduled',
    source_group_id: 'group-source',
    target_group_id: 'group-target',
    event_id: 'event-old',
    agenda_item_id: 'agenda-old',
    vote_id: 'vote-old',
    decision_status: 'forward_confirmed',
    order_index: 0,
    starts_at: future,
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-old',
    group_id: 'group-target',
    title: 'Old event',
    start_date: future,
    end_date: future + 30 * 60 * 1000,
    amendment_deadline: null,
    ...overrides,
  };
}

function createMinimalTx(runResults: unknown[]) {
  return {
    run: vi.fn(async () => runResults.shift() ?? []),
    mutate: {
      amendment_process_step_run: { update: vi.fn() },
      amendment_path_segment: { update: vi.fn() },
      amendment_process_branch: { update: vi.fn() },
      amendment_process_run: { update: vi.fn() },
      agenda_item: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      vote: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      vote_choice: { insert: vi.fn(), delete: vi.fn() },
      process_task: { insert: vi.fn(), update: vi.fn() },
      speaker_list: { delete: vi.fn() },
      accreditation: { delete: vi.fn() },
      agenda_item_change_request: { delete: vi.fn() },
      indicative_choice_decision: { delete: vi.fn() },
      final_choice_decision: { delete: vi.fn() },
      indicative_voter_participation: { delete: vi.fn() },
      final_voter_participation: { delete: vi.fn() },
      vote_offline_tally: { delete: vi.fn() },
      voter: { delete: vi.fn() },
    },
  };
}

describe('replanProcessBranchEvents', () => {
  beforeEach(() => {
    fireNotificationMock.mockReset();
  });

  it('blocks replanning decided steps', async () => {
    const tx = createMinimalTx([
      baseBranch(),
      baseProcessRun(),
      baseAmendment(),
      [stepRun({ status: 'approved' })],
      eventRow(),
    ]);

    await expect(
      replanProcessBranchEvents(tx as never, 'user-1', {
        branch_id: 'branch-1',
        event_updates: [{ step_run_id: 'step-1', event_id: 'event-new' }],
      })
    ).rejects.toThrow('Decided process steps cannot be replanned');

    expect(tx.mutate.amendment_process_step_run.update).not.toHaveBeenCalled();
  });

  it('rejects event updates that would break chronological order', async () => {
    const firstStep = stepRun({
      id: 'step-1',
      target_group_id: 'group-a',
      event_id: 'event-a',
      agenda_item_id: 'agenda-a',
      vote_id: 'vote-a',
      order_index: 0,
      starts_at: future,
    });
    const secondStep = stepRun({
      id: 'step-2',
      target_group_id: 'group-b',
      event_id: null,
      agenda_item_id: null,
      vote_id: null,
      order_index: 1,
      starts_at: null,
    });
    const tx = createMinimalTx([
      baseBranch(),
      baseProcessRun(),
      baseAmendment(),
      [firstStep, secondStep],
      eventRow({
        id: 'event-a',
        group_id: 'group-a',
        start_date: future,
        end_date: future + 60 * 60 * 1000,
      }),
      eventRow({
        id: 'event-b-too-early',
        group_id: 'group-b',
        start_date: future + 30 * 60 * 1000,
        end_date: future + 45 * 60 * 1000,
      }),
    ]);

    await expect(
      replanProcessBranchEvents(tx as never, 'user-1', {
        branch_id: 'branch-1',
        event_updates: [{ step_run_id: 'step-2', event_id: 'event-b-too-early' }],
      })
    ).rejects.toThrow('chronological order');

    expect(tx.mutate.amendment_process_step_run.update).not.toHaveBeenCalled();
  });

  it('clears a future event and creates an open schedule task', async () => {
    const step = stepRun();
    const pathSegment = { id: 'segment-1' };
    const branch = baseBranch();
    const tx = createMinimalTx([
      branch,
      baseProcessRun(),
      baseAmendment(),
      [step],
      eventRow(),
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [pathSegment],
      { id: 'group-target', name: 'Target Group' },
      null,
      [{ ...step, event_id: null, agenda_item_id: null, vote_id: null, status: 'pending_event' }],
      [pathSegment],
      [branch],
      [{ ...step, event_id: null, agenda_item_id: null, vote_id: null, status: 'pending_event' }],
      [{ ...branch, status: 'pending_event' }],
    ]);

    await expect(
      replanProcessBranchEvents(tx as never, 'user-1', {
        branch_id: 'branch-1',
        event_updates: [{ step_run_id: 'step-1', event_id: null }],
      })
    ).resolves.toMatchObject({
      handled: true,
      changedStepRunIds: ['step-1'],
    });

    expect(tx.mutate.vote.delete).toHaveBeenCalledWith({ id: 'vote-old' });
    expect(tx.mutate.agenda_item.delete).toHaveBeenCalledWith({ id: 'agenda-old' });
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-1',
        event_id: null,
        agenda_item_id: null,
        vote_id: null,
        status: 'pending_event',
      })
    );
    expect(tx.mutate.process_task.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: 'schedule_event',
        status: 'open',
        group_id: 'group-target',
      })
    );
  });

  it('reuses one future agenda and vote pair when branches later merge at one event', async () => {
    const branchA = baseBranch({ id: 'branch-1', title: 'BR-1', created_at: 1 });
    const branchB = baseBranch({ id: 'branch-2', title: 'BR-2', created_at: 2 });
    const currentStepA = stepRun({
      id: 'step-a-current',
      branch_id: 'branch-1',
      event_id: 'event-current-a',
      agenda_item_id: 'agenda-current-a',
      vote_id: 'vote-current-a',
      target_group_id: 'group-current-a',
      order_index: 0,
      created_at: 1,
    });
    const currentStepB = stepRun({
      id: 'step-b-current',
      branch_id: 'branch-2',
      event_id: 'event-current-b',
      agenda_item_id: 'agenda-current-b',
      vote_id: 'vote-current-b',
      target_group_id: 'group-current-b',
      order_index: 0,
      created_at: 2,
    });
    const futureStepA = stepRun({
      id: 'step-a-future',
      branch_id: 'branch-1',
      event_id: 'event-merge',
      agenda_item_id: 'agenda-a',
      vote_id: 'vote-a',
      target_group_id: 'group-target',
      decision_status: 'previous_decision_outstanding',
      order_index: 2,
      created_at: 3,
    });
    const futureStepB = stepRun({
      id: 'step-b-future',
      branch_id: 'branch-2',
      event_id: 'event-merge',
      agenda_item_id: 'agenda-b',
      vote_id: 'vote-b',
      target_group_id: 'group-target',
      decision_status: 'previous_decision_outstanding',
      order_index: 2,
      created_at: 4,
    });

    const tx = createMinimalTx([
      branchA,
      baseProcessRun(),
      baseAmendment({ title: 'A1' }),
      [currentStepA, futureStepA],
      eventRow({ id: 'event-current-a', group_id: 'group-current-a' }),
      eventRow({
        id: 'event-merge',
        group_id: 'group-target',
        start_date: future + 2 * 60 * 60 * 1000,
        end_date: future + 3 * 60 * 60 * 1000,
      }),
      [],
      [],
      [currentStepA, futureStepA],
      { id: 'agenda-current-a', title: 'A1', forwarding_status: 'forward_confirmed' },
      [],
      { id: 'agenda-a', title: 'A1', forwarding_status: 'previous_decision_outstanding' },
      [],
      { id: 'vote-current-a', status: 'indicative' },
      [branchA, branchB],
      [currentStepA, futureStepA, currentStepB, futureStepB],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      { id: 'agenda-a', title: 'A1' },
      { id: 'vote-a', status: 'indicative' },
      [{ id: 'choice-old' }],
      [],
      [],
      [{ id: 'agenda-a', order_index: 1, forwarding_status: 'forward_confirmed' }],
      [branchA, branchB],
    ]);

    await expect(
      replanProcessBranchEvents(tx as never, 'user-1', {
        branch_id: 'branch-1',
        event_updates: [{ step_run_id: 'step-a-current', event_id: 'event-current-a' }],
      })
    ).resolves.toMatchObject({
      handled: true,
      changedStepRunIds: ['step-a-current'],
    });

    expect(tx.mutate.agenda_item.delete).toHaveBeenCalledWith({ id: 'agenda-b' });
    expect(tx.mutate.agenda_item.delete).not.toHaveBeenCalledWith({ id: 'agenda-a' });
    expect(tx.mutate.agenda_item.delete).not.toHaveBeenCalledWith({ id: 'agenda-current-a' });
    expect(tx.mutate.vote.delete).toHaveBeenCalledWith({ id: 'vote-b' });
    expect(tx.mutate.vote.delete).not.toHaveBeenCalledWith({ id: 'vote-a' });
    expect(tx.mutate.vote.delete).not.toHaveBeenCalledWith({ id: 'vote-current-a' });
    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-a',
        title: 'A1: BR-1 vs BR-2',
      })
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-a',
        title: 'A1: BR-1 vs BR-2',
        purpose: 'merge_variant',
      })
    );
    expect(tx.mutate.vote_choice.delete).toHaveBeenCalledWith({ id: 'choice-old' });
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-a-future',
        agenda_item_id: 'agenda-a',
        vote_id: 'vote-a',
        step_kind: 'merge_vote',
      })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-b-future',
        agenda_item_id: 'agenda-a',
        vote_id: 'vote-a',
        status: 'scheduled',
      })
    );
  });

  it('creates a closing vote when completing a process task with an event', async () => {
    const task = {
      id: 'task-1',
      process_run_id: 'run-1',
      branch_id: null,
      step_run_id: 'step-1',
      task_type: 'schedule_event',
      description: 'Schedule this amendment',
      support_confirmation_id: null,
    };
    const step = stepRun({
      id: 'step-1',
      event_id: null,
      agenda_item_id: null,
      vote_id: null,
      status: 'pending_event',
    });
    const tx = createMinimalTx([
      task,
      eventRow({ id: 'event-new', group_id: 'group-target' }),
      baseProcessRun(),
      baseAmendment({ title: 'A1' }),
      step,
      [],
      [],
      [],
    ]);

    await expect(
      completeProcessTaskWithEvent(tx as never, 'user-1', {
        process_task_id: 'task-1',
        event_id: 'event-new',
      })
    ).resolves.toMatchObject({
      handled: true,
      processRunId: 'run-1',
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: expect.any(String),
        amendment_id: 'amendment-1',
        purpose: 'closing',
      })
    );
  });
});
