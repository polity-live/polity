import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  isPermissionError: vi.fn(),
  fireNotification: vi.fn(),
  createElection: vi.fn(),
  createRole: vi.fn(),
  createVote: vi.fn(),
  snapshotVoteElectorate: vi.fn(),
  eventTitle: vi.fn(),
  recomputeEventCounters: vi.fn(),
  recomputeEventEndDate: vi.fn(),
  resolveChangeRequestByVoteResult: vi.fn(),
  discardPendingEventSuggestions: vi.fn(),
  transitionProcessBranchToEventMode: vi.fn(),
  orderChangeRequestsForVoting: vi.fn(),
  reorderOpenSteps: vi.fn(),
  createAgendaItem: vi.fn(),
  deleteAgendaItem: vi.fn(),
  updateAgendaItem: vi.fn(),
  reorderAgendaItems: vi.fn(),
  addSpeaker: vi.fn(),
  updateAgendaItemChangeRequest: vi.fn(),
  createVoteChoice: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({ can: mocks.can }));
vi.mock('../../rbac/errors', () => ({ isPermissionError: mocks.isPermissionError }));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../elections/server-mutators', () => ({
  electionServerMutators: { createElection: { fn: mocks.createElection } },
}));
vi.mock('../../groups/server-mutators', () => ({
  groupServerMutators: { createRole: { fn: mocks.createRole } },
}));
vi.mock('../../votes/server-mutators', () => ({
  voteServerMutators: { createVote: { fn: mocks.createVote } },
}));
vi.mock('../../ballot-eligibility', () => ({
  snapshotVoteElectorate: mocks.snapshotVoteElectorate,
}));
vi.mock('../../server-helpers', () => ({
  eventTitle: mocks.eventTitle,
  recomputeEventCounters: mocks.recomputeEventCounters,
  recomputeEventEndDate: mocks.recomputeEventEndDate,
}));
vi.mock('../../change-requests/server-resolution', () => ({
  resolveChangeRequestByVoteResult: mocks.resolveChangeRequestByVoteResult,
}));
vi.mock('../../change-requests/event-suggestions', () => ({
  discardPendingEventSuggestions: mocks.discardPendingEventSuggestions,
}));
vi.mock('../../amendments/event-mode-transition', () => ({
  transitionProcessBranchToEventMode: mocks.transitionProcessBranchToEventMode,
}));
vi.mock('../change-request-vote-ordering', () => ({
  orderChangeRequestsForVoting: mocks.orderChangeRequestsForVoting,
  reorderOpenChangeRequestVoteStepsForAgendaItem: mocks.reorderOpenSteps,
}));
vi.mock('../../mutators', () => ({
  mutators: {
    agendas: {
      createAgendaItem: { fn: mocks.createAgendaItem },
      deleteAgendaItem: { fn: mocks.deleteAgendaItem },
      updateAgendaItem: { fn: mocks.updateAgendaItem },
      reorderAgendaItems: { fn: mocks.reorderAgendaItems },
      addSpeaker: { fn: mocks.addSpeaker },
      updateAgendaItemChangeRequest: { fn: mocks.updateAgendaItemChangeRequest },
    },
    votes: {
      createVoteChoice: { fn: mocks.createVoteChoice },
    },
  },
}));

import {
  agendaServerMutatorTestApi as api,
  agendaServerMutators,
  materializeCurrentForwardConfirmedEventVoting,
} from '../server-mutators';

function txWith(rows: unknown[] = []) {
  const queue = [...rows];
  return {
    run: vi.fn(async () => queue.shift()),
    mutate: {
      amendment: { update: vi.fn() },
      amendment_process_branch: { update: vi.fn() },
      amendment_process_run: { update: vi.fn() },
      agenda_item_change_request: { insert: vi.fn(), update: vi.fn() },
      amendment_process_step_run: { update: vi.fn() },
      agenda_item: { update: vi.fn() },
      vote: { insert: vi.fn(), update: vi.fn() },
      vote_choice: { insert: vi.fn() },
      voter: { insert: vi.fn() },
    },
  };
}

const ctx = { userID: 'user-1', email: 'user@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockResolvedValue(undefined);
  mocks.isPermissionError.mockReturnValue(true);
  mocks.eventTitle.mockResolvedValue('Event');
  mocks.orderChangeRequestsForVoting.mockImplementation(
    (_tx, _amendmentId, changeRequests) => changeRequests
  );
});

describe('agenda server helper branches', () => {
  it('builds ordered merge choices and a terminal abstention choice', () => {
    const choices = api.buildMergeVoteChoiceSpecs([
      { id: 'branch-2', created_at: 2, title: 'Second' },
      { id: 'branch-1', created_at: 1, title: null },
    ] as never);
    expect(choices).toHaveLength(3);
    expect(choices.at(-1)).toEqual({
      label: 'abstain',
      semanticKey: 'abstain',
      processBranchId: null,
    });
  });

  it('allows absent, closing, current, and completed timeline records but rejects later items', async () => {
    expect(
      await api.assertCurrentChangeRequestTimelineItem(txWith([null]) as never, 'link-1')
    ).toBeNull();
    const closing = { id: 'closing', is_closing_vote: true };
    expect(
      await api.assertCurrentChangeRequestTimelineItem(txWith([closing]) as never, 'closing')
    ).toBe(closing);
    await api.assertCurrentChangeRequestTimelineItem(
      txWith([
        { id: 'current', agenda_item_id: 'agenda-1', is_closing_vote: false },
        [
          { id: 'done', is_closing_vote: false, status: 'completed' },
          { id: 'current', is_closing_vote: false, status: 'voting' },
        ],
      ]) as never,
      'current'
    );
    await expect(
      api.assertCurrentChangeRequestTimelineItem(
        txWith([
          { id: 'later', agenda_item_id: 'agenda-1', is_closing_vote: false },
          [{ id: 'first', is_closing_vote: false, status: 'voting' }],
        ]) as never,
        'later'
      )
    ).rejects.toThrow(/configured order/i);
  });

  it('enforces event and amendment vote-management permissions', async () => {
    await api.assertCanManageAgendaVoteFlow(
      txWith() as never,
      { ...ctx, [api.INTERNAL_VOTE_MATERIALIZATION]: true },
      'agenda-1'
    );
    await expect(
      api.assertCanManageAgendaVoteFlow(txWith([null]) as never, ctx, 'agenda-1')
    ).rejects.toThrow(/not linked/i);
    await api.assertCanManageAgendaVoteFlow(
      txWith([{ event_id: 'event-1' }]) as never,
      ctx,
      'agenda-1'
    );

    const eventPermission = new Error('event denied');
    mocks.can.mockRejectedValueOnce(eventPermission).mockResolvedValueOnce(undefined);
    await api.assertCanManageAgendaVoteFlow(
      txWith([{ event_id: 'event-1', amendment_id: 'amendment-1' }]) as never,
      ctx,
      'agenda-1'
    );

    const unexpected = new Error('unexpected');
    mocks.can.mockRejectedValueOnce(unexpected);
    mocks.isPermissionError.mockReturnValueOnce(false);
    await expect(
      api.assertCanManageAgendaVoteFlow(txWith([{ event_id: 'event-1' }]) as never, ctx, 'agenda-1')
    ).rejects.toBe(unexpected);

    mocks.can.mockRejectedValueOnce(eventPermission).mockRejectedValueOnce(unexpected);
    mocks.isPermissionError.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(
      api.assertCanManageAgendaVoteFlow(
        txWith([{ event_id: 'event-1', amendment_id: 'amendment-1' }]) as never,
        ctx,
        'agenda-1'
      )
    ).rejects.toBe(unexpected);

    mocks.can.mockRejectedValueOnce(eventPermission);
    mocks.isPermissionError.mockReturnValueOnce(true);
    await expect(
      api.assertCanManageAgendaVoteFlow(
        txWith([{ event_id: 'event-1', amendment_id: null }]) as never,
        ctx,
        'agenda-1'
      )
    ).rejects.toBe(eventPermission);

    mocks.can.mockRejectedValueOnce(eventPermission).mockRejectedValueOnce(eventPermission);
    mocks.isPermissionError.mockReturnValueOnce(true).mockReturnValueOnce(true);
    await expect(
      api.assertCanManageAgendaVoteFlow(
        txWith([{ event_id: 'event-1', amendment_id: 'amendment-1' }]) as never,
        ctx,
        'agenda-1'
      )
    ).rejects.toBe(eventPermission);
  });

  it('accepts active voters, vote managers, and amendment managers for suggestion votes', async () => {
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(txWith([null]) as never, ctx, {
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
      })
    ).rejects.toThrow(/not linked/i);
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(
        txWith([{ event_id: 'event-1', amendment_id: 'other' }]) as never,
        ctx,
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toThrow(/different amendment/i);

    const item = { event_id: 'event-1', amendment_id: 'amendment-1' };
    expect(
      await api.assertCanEnsureEventSuggestionChangeRequestVotes(txWith([item]) as never, ctx, {
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
      })
    ).toBe(item);

    const denied = new Error('denied');
    mocks.can.mockRejectedValueOnce(denied).mockResolvedValueOnce(undefined);
    expect(
      await api.assertCanEnsureEventSuggestionChangeRequestVotes(txWith([item]) as never, ctx, {
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
      })
    ).toBe(item);

    mocks.can
      .mockRejectedValueOnce(denied)
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce(undefined);
    expect(
      await api.assertCanEnsureEventSuggestionChangeRequestVotes(txWith([item]) as never, ctx, {
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
      })
    ).toBe(item);

    mocks.can.mockRejectedValueOnce(denied);
    mocks.isPermissionError.mockReturnValueOnce(false);
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(txWith([item]) as never, ctx, {
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
      })
    ).rejects.toBe(denied);

    mocks.can.mockRejectedValueOnce(denied).mockRejectedValueOnce(denied);
    mocks.isPermissionError.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(txWith([item]) as never, ctx, {
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
      })
    ).rejects.toBe(denied);

    const itemWithoutAmendment = { event_id: 'event-1', amendment_id: null };
    mocks.can.mockRejectedValueOnce(denied).mockRejectedValueOnce(denied);
    mocks.isPermissionError.mockReturnValueOnce(true).mockReturnValueOnce(true);
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(
        txWith([itemWithoutAmendment]) as never,
        ctx,
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toBe(denied);

    mocks.can.mockReset();
    mocks.isPermissionError.mockReset();
    const unexpected = new Error('unexpected amendment failure');
    mocks.can
      .mockRejectedValueOnce(denied)
      .mockRejectedValueOnce(denied)
      .mockRejectedValueOnce(unexpected);
    mocks.isPermissionError
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(
        txWith([{ event_id: 'event-1', amendment_id: 'amendment-1' }]) as never,
        ctx,
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toBe(unexpected);
  });

  it('resolves active, first, and missing fallback process branches', async () => {
    expect(
      await api.resolveFallbackProcessBranchId(txWith([null]) as never, 'amendment-1')
    ).toBeNull();
    expect(
      await api.resolveFallbackProcessBranchId(
        txWith([{ current_process_run_id: 'run-1' }, { active_branch_id: 'active' }]) as never,
        'amendment-1'
      )
    ).toBe('active');
    expect(
      await api.resolveFallbackProcessBranchId(
        txWith([{ current_process_run_id: 'run-1' }, null, [{ id: 'first' }]]) as never,
        'amendment-1'
      )
    ).toBe('first');
    expect(
      await api.resolveFallbackProcessBranchId(
        txWith([{ current_process_run_id: 'run-1' }, null, []]) as never,
        'amendment-1'
      )
    ).toBeNull();
  });

  it('synchronizes mutable branch modes and discards pending suggestions for closing mode', async () => {
    await api.syncBranchEditingMode(txWith() as never, ctx, null, 'branch-1', 'suggest_event');
    await api.syncBranchEditingMode(
      txWith([null]) as never,
      ctx,
      'amendment-1',
      null,
      'suggest_event'
    );
    for (const branch of [
      null,
      { id: 'passed', editing_mode: 'passed' },
      { id: 'rejected', editing_mode: 'rejected' },
    ]) {
      await api.syncBranchEditingMode(
        txWith([branch]) as never,
        ctx,
        'amendment-1',
        'branch-1',
        'suggest_event'
      );
    }
    await api.syncBranchEditingMode(
      txWith([{ id: 'same', editing_mode: 'suggest_event' }]) as never,
      ctx,
      'amendment-1',
      'same',
      'suggest_event'
    );
    await api.syncBranchEditingMode(
      txWith([{ id: 'open', editing_mode: 'suggest_event' }]) as never,
      ctx,
      'amendment-1',
      'open',
      'event_final_closing_vote'
    );
    expect(mocks.discardPendingEventSuggestions).toHaveBeenCalled();
    expect(mocks.transitionProcessBranchToEventMode).toHaveBeenCalled();
  });

  it('synchronizes only amendment-backed event agenda items using step and fallback branches', async () => {
    await api.syncEventAmendmentsToSuggestEvent(txWith([[]]) as never, ctx, 'event-1');
    const tx = txWith([
      [
        { id: 'plain', amendment_id: null },
        { id: 'linked', amendment_id: 'amendment-1' },
        { id: '', amendment_id: 'ignored' },
      ],
      [
        { agenda_item_id: null, branch_id: 'invalid' },
        { agenda_item_id: 'linked', branch_id: 'branch-1' },
      ],
      { id: 'branch-1', editing_mode: 'event_final_closing_vote' },
      null,
      null,
      [],
    ]);
    await api.syncEventAmendmentsToSuggestEvent(tx as never, ctx, 'event-1');
    expect(mocks.transitionProcessBranchToEventMode).toHaveBeenCalledWith(
      expect.objectContaining({ processBranchId: 'branch-1', editingMode: 'suggest_event' })
    );
  });

  it('rethrows the original event permission after all permission fallbacks fail', async () => {
    mocks.can.mockReset();
    mocks.isPermissionError.mockReset();
    const denied = new Error('denied');
    mocks.can.mockRejectedValue(denied);
    mocks.isPermissionError.mockReturnValue(true);
    await expect(
      api.assertCanEnsureEventSuggestionChangeRequestVotes(
        txWith([{ event_id: 'event-1', amendment_id: 'amendment-1' }]) as never,
        ctx,
        { agenda_item_id: 'agenda-1', amendment_id: 'amendment-1' }
      )
    ).rejects.toBe(denied);
  });
});

describe('agenda server public mutator edge branches', () => {
  async function initialize(rows: unknown[], overrides: Record<string, unknown> = {}) {
    const tx = txWith(rows);
    await api.materializeChangeRequestVotingInternal({
      tx: tx as never,
      ctx: ctx as never,
      args: {
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        ...overrides,
      },
    });
    return tx;
  }

  it('rejects a mismatched amendment during internal materialization', async () => {
    await expect(initialize([{ amendment_id: 'other-amendment' }])).rejects.toThrow(
      /different amendment/i
    );
  });

  it('materializes sparse non-event data and starts an untimed closing vote', async () => {
    const tx = await initialize(
      [
        { id: 'agenda-1', amendment_id: 'amendment-1', event_id: null },
        null,
        null,
        null,
        null,
        null,
      ],
      { start_final_vote_if_no_change_requests: true }
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'final', closing_end_time: null })
    );
  });

  it('uses a single nullable branch and fallback change-request title', async () => {
    const tx = await initialize([
      { id: 'agenda-1', amendment_id: 'amendment-1', event_id: null },
      [{ branch_id: null, step_kind: 'group_vote', status: 'scheduled' }],
      [{ id: 'cr-1', title: null, process_branch_id: null }],
      null,
      [{ id: 'regular-link', order_index: null, is_closing_vote: false }],
      [],
    ]);
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'change_request' })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ process_branch_id: null })
    );
  });

  it('materializes multi-merge fallbacks while preserving existing merge and closing links', async () => {
    const mergeSteps = [
      {
        id: 'step-1',
        branch_id: 'branch-1',
        step_kind: 'merge_vote',
        status: 'scheduled',
        vote_id: 'merge-vote',
        agenda_item_id: 'agenda-1',
      },
      {
        id: 'step-2',
        branch_id: 'branch-2',
        step_kind: 'merge_vote',
        status: null,
        vote_id: null,
        agenda_item_id: null,
      },
      {
        id: 'step-3',
        branch_id: null,
        step_kind: 'merge_vote',
        status: 'scheduled',
        vote_id: null,
        agenda_item_id: null,
      },
    ];
    const existingLinks = [
      {
        id: 'merge-link',
        vote_id: 'other-vote',
        step_kind: 'merge_variant',
        order_index: null,
        change_request_id: null,
        is_closing_vote: false,
      },
      {
        id: 'closing-link',
        vote_id: 'final-vote',
        step_kind: 'closing',
        order_index: 0,
        change_request_id: null,
        is_closing_vote: true,
      },
    ];
    const existingVotes = [
      { id: 'merge-vote', purpose: 'merge_variant' },
      { id: 'final-vote', purpose: 'closing', status: 'closed' },
    ];
    const tx = await initialize([
      {
        id: 'agenda-1',
        amendment_id: 'amendment-1',
        event_id: 'event-1',
        title: null,
      },
      mergeSteps,
      [
        { id: 'cr-1', title: null, process_branch_id: 'branch-1' },
        { id: 'cr-2', title: 'Second', process_branch_id: 'branch-2' },
        { id: 'cr-unscoped', title: 'Unscoped', process_branch_id: null },
      ],
      { change_request_vote_order: null },
      { id: 'branch-1', editing_mode: 'suggest_event' },
      { id: 'branch-2', editing_mode: 'suggest_event' },
      existingLinks,
      existingVotes,
      null,
      null,
      existingVotes,
    ]);
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'merge-vote', purpose: 'merge_variant' })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledTimes(2);
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ step_kind: 'merge_variant' })
    );
  });

  it('creates a merge sequence when branch identifiers and stored branch rows are absent', async () => {
    const tx = await initialize([
      { id: 'agenda-1', amendment_id: 'amendment-1', event_id: null, title: 'Merge' },
      [
        { id: 'step-1', branch_id: null, step_kind: 'merge_vote', status: 'scheduled' },
        { id: 'step-2', branch_id: null, step_kind: 'merge_vote', status: 'scheduled' },
      ],
      [],
      null,
      [{ id: 'regular-link', order_index: null, is_closing_vote: false }],
      [],
      null,
    ]);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ step_kind: 'merge_variant', order_index: 0 })
    );
  });

  it('caches event ordering while reloading change requests after a mode transition', async () => {
    mocks.transitionProcessBranchToEventMode.mockResolvedValueOnce({
      finalizedInternalChangeRequests: true,
    });
    await initialize([
      { id: 'agenda-1', amendment_id: 'amendment-1', event_id: 'event-1' },
      [{ branch_id: 'branch-1', step_kind: 'group_vote', status: 'scheduled' }],
      [
        { id: 'cr-1', process_branch_id: 'branch-1' },
        { id: 'cr-2', process_branch_id: 'branch-1' },
      ],
      { change_request_vote_order: 'created_at' },
      { id: 'branch-1', editing_mode: 'event_final_closing_vote' },
      [
        { id: 'cr-1', process_branch_id: 'branch-1' },
        { id: 'cr-2', process_branch_id: 'branch-1' },
      ],
      [],
      [],
    ]);
    expect(mocks.orderChangeRequestsForVoting).toHaveBeenCalledTimes(2);
  });

  it('orders multiple branch-scoped requests without an event', async () => {
    await initialize([
      { id: 'agenda-1', amendment_id: 'amendment-1', event_id: null },
      [{ branch_id: 'branch-1', step_kind: 'group_vote', status: 'scheduled' }],
      [
        { id: 'cr-1', process_branch_id: 'branch-1' },
        { id: 'cr-2', process_branch_id: 'branch-1' },
      ],
      { id: 'branch-1', editing_mode: 'suggest_event' },
      [],
      [],
    ]);
  });

  it('starts a closing vote with a positive event duration', async () => {
    const tx = await initialize(
      [
        { id: 'agenda-1', amendment_id: 'amendment-1', event_id: 'event-1' },
        [{ branch_id: 'branch-1', step_kind: 'group_vote', status: 'scheduled' }],
        [],
        { id: 'branch-1', editing_mode: 'suggest_event' },
        [],
        [],
        { default_final_vote_duration_seconds: 30 },
        { id: 'branch-1', editing_mode: 'suggest_event' },
      ],
      { start_final_vote_if_no_change_requests: true }
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        closing_duration_seconds: 30,
        closing_end_time: expect.any(Number),
      })
    );
  });

  it('handles explicit and inferred suggestion-branch edge cases', async () => {
    await agendaServerMutators.ensureEventSuggestionChangeRequestVotes.fn({
      tx: txWith([{ event_id: 'event-1', amendment_id: 'amendment-1' }, null, null, null]) as never,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
      } as never,
    });

    const explicit = txWith([
      { event_id: 'event-1', amendment_id: 'amendment-1' },
      [
        {
          id: 'cr-1',
          title: null,
          status: 'open',
          voting_status: 'open',
          obsolete_at: null,
          obsolete_reason: null,
          process_branch_id: 'branch-1',
        },
      ],
      [
        {
          id: 'closing',
          change_request_id: null,
          is_closing_vote: true,
          step_kind: 'closing',
          status: 'pending',
          order_index: 0,
        },
        {
          id: 'open-link',
          change_request_id: 'old-cr',
          is_closing_vote: false,
          status: 'voting',
          order_index: null,
        },
      ],
      { change_request_vote_order: null },
    ]);
    await agendaServerMutators.ensureEventSuggestionChangeRequestVotes.fn({
      tx: explicit as never,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: 'branch-1',
      } as never,
    });
    expect(explicit.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'change_request' })
    );

    const inferredNull = txWith([
      { event_id: 'event-1', amendment_id: 'amendment-1' },
      [{ branch_id: null, step_kind: 'group_vote' }],
      [
        {
          id: 'cr-2',
          title: null,
          status: 'open',
          voting_status: 'open',
          process_branch_id: null,
        },
      ],
      [],
    ]);
    await agendaServerMutators.ensureEventSuggestionChangeRequestVotes.fn({
      tx: inferredNull as never,
      ctx,
      args: { amendment_id: 'amendment-1', agenda_item_id: 'agenda-1' } as never,
    });
    expect(inferredNull.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ process_branch_id: null })
    );

    await agendaServerMutators.ensureEventSuggestionChangeRequestVotes.fn({
      tx: txWith([
        { event_id: 'event-1', amendment_id: 'amendment-1' },
        [
          { branch_id: 'merge', step_kind: 'merge_vote' },
          { branch_id: 'branch-2', step_kind: 'group_vote' },
        ],
        [],
        [],
      ]) as never,
      ctx,
      args: { amendment_id: 'amendment-1', agenda_item_id: 'agenda-1' } as never,
    });

    const reducedOrder = txWith([
      { event_id: 'event-1', amendment_id: 'amendment-1' },
      [
        {
          id: 'cr-3',
          title: 'Third',
          status: 'open',
          voting_status: 'open',
          process_branch_id: null,
        },
      ],
      [
        {
          id: 'regular-link',
          change_request_id: 'old-cr',
          is_closing_vote: false,
          status: 'completed',
          order_index: null,
        },
      ],
    ]);
    await agendaServerMutators.ensureEventSuggestionChangeRequestVotes.fn({
      tx: reducedOrder as never,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: null,
      } as never,
    });

    await api.syncBranchEditingMode(
      txWith([
        { current_process_run_id: 'run-1' },
        { active_branch_id: 'fallback-branch' },
        { id: 'fallback-branch', editing_mode: 'suggest_event' },
      ]) as never,
      ctx,
      'amendment-1',
      null,
      'suggest_event'
    );
  });

  it('creates sparse and event-backed agenda items with title fallback', async () => {
    await agendaServerMutators.createAgendaItem.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'agenda-1', event_id: null, title: null } as never,
    });
    await agendaServerMutators.createAgendaItem.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'agenda-2', event_id: 'event-1', title: null } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyAgendaItemCreated',
      expect.objectContaining({ agendaItemTitle: 'Agenda Item' })
    );
    await agendaServerMutators.createAgendaItem.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'agenda-3', event_id: 'event-1', title: 'Budget' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyAgendaItemCreated',
      expect.objectContaining({ agendaItemTitle: 'Budget' })
    );
  });

  it('creates full agenda bundles with absent and populated optional collections', async () => {
    const createAgendaSpy = vi
      .spyOn(agendaServerMutators.createAgendaItem, 'fn')
      .mockResolvedValue(undefined);
    await agendaServerMutators.createFull.fn({
      tx: txWith() as never,
      ctx,
      args: { agenda_items: [], roles: null, elections: null, votes: null } as never,
    });
    await agendaServerMutators.createFull.fn({
      tx: txWith() as never,
      ctx,
      args: {
        roles: [{ id: 'role-1' }],
        agenda_items: [{ id: 'agenda-1' }],
        elections: [{ id: 'election-1' }],
        votes: [
          { vote: { id: 'vote-1' }, choices: null },
          { vote: { id: 'vote-2' }, choices: [{ id: 'choice-1' }] },
        ],
      } as never,
    });
    expect(mocks.createRole).toHaveBeenCalled();
    expect(createAgendaSpy).toHaveBeenCalled();
    expect(mocks.createElection).toHaveBeenCalled();
    expect(mocks.createVote).toHaveBeenCalledTimes(2);
    expect(mocks.createVoteChoice).toHaveBeenCalledTimes(1);
    createAgendaSpy.mockRestore();
  });

  it('deletes linked and unlinked agenda items', async () => {
    await agendaServerMutators.deleteAgendaItem.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'agenda-1' },
    });
    await agendaServerMutators.deleteAgendaItem.fn({
      tx: txWith([{ id: 'agenda-2', event_id: 'event-1', title: 'Budget' }]) as never,
      ctx,
      args: { id: 'agenda-2' },
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyAgendaItemDeleted',
      expect.objectContaining({ agendaItemId: 'agenda-2' })
    );
  });

  it('updates sparse, same-event, newly linked, and both activation status variants', async () => {
    await agendaServerMutators.updateAgendaItem.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'agenda-1' } as never,
    });
    await agendaServerMutators.updateAgendaItem.fn({
      tx: txWith([
        { id: 'agenda-2', event_id: null, status: 'pending', type: 'discussion' },
      ]) as never,
      ctx,
      args: { id: 'agenda-2', event_id: 'event-2', status: 'pending' } as never,
    });
    expect(mocks.recomputeEventCounters).toHaveBeenCalledWith(expect.anything(), 'event-2');

    await agendaServerMutators.updateAgendaItem.fn({
      tx: txWith([
        {
          id: 'agenda-3',
          event_id: 'event-1',
          status: 'pending',
          type: 'discussion',
          title: 'Budget',
        },
        [],
      ]) as never,
      ctx,
      args: { id: 'agenda-3', status: 'in-progress' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyAgendaItemActivated',
      expect.objectContaining({ agendaItemId: 'agenda-3' })
    );

    await agendaServerMutators.updateAgendaItem.fn({
      tx: txWith([
        {
          id: 'agenda-4',
          event_id: 'event-1',
          status: 'pending',
          type: 'discussion',
          title: 'Budget',
        },
        [],
      ]) as never,
      ctx,
      args: { id: 'agenda-4', status: 'active' } as never,
    });
  });

  it('updates implementation review state and emits transfer notifications', async () => {
    const base = {
      id: 'agenda-1',
      event_id: 'event-1',
      status: 'pending',
      type: 'implementation_review',
      title: 'Review',
    };
    const missingTask = txWith([base, [], null]);
    await agendaServerMutators.updateAgendaItem.fn({
      tx: missingTask as never,
      ctx,
      args: { id: 'agenda-1', status: 'active' } as never,
    });
    expect(missingTask.mutate.amendment_process_run.update).not.toHaveBeenCalled();

    const task = txWith([base, [], { process_run_id: 'run-1' }]);
    await agendaServerMutators.updateAgendaItem.fn({
      tx: task as never,
      ctx,
      args: { id: 'agenda-1', status: 'active' } as never,
    });
    expect(task.mutate.amendment_process_run.update).toHaveBeenCalledWith(
      expect.objectContaining({ implementation_status: 'evaluation_in_vote' })
    );

    await agendaServerMutators.updateAgendaItem.fn({
      tx: txWith([{ ...base, type: 'discussion' }]) as never,
      ctx,
      args: { id: 'agenda-1', event_id: 'event-2', status: 'pending' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyAgendaItemTransferred',
      expect.objectContaining({ targetEventId: 'event-2' })
    );
  });

  it('reorders only changed event schedules and handles empty input', async () => {
    await agendaServerMutators.reorderAgendaItems.fn({
      tx: txWith() as never,
      ctx,
      args: { items: [] },
    });
    const tx = txWith([
      [
        { id: 'same', event_id: 'event-1', order_index: 1 },
        { id: 'changed', event_id: 'event-1', order_index: 2 },
        { id: 'unlinked', event_id: null, order_index: 0 },
      ],
    ]);
    await agendaServerMutators.reorderAgendaItems.fn({
      tx: tx as never,
      ctx,
      args: {
        items: [
          { id: 'same', order_index: 1 },
          { id: 'changed', order_index: 3 },
          { id: 'missing', order_index: 0 },
        ],
      },
    });
    expect(mocks.recomputeEventEndDate).toHaveBeenCalledWith(tx, 'event-1');
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyScheduleChanged',
      expect.objectContaining({ eventId: 'event-1' })
    );
  });

  it('adds speakers with absent, unlinked, and linked agenda references', async () => {
    await agendaServerMutators.addSpeaker.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'speaker-1', agenda_item_id: null } as never,
    });
    await agendaServerMutators.addSpeaker.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'speaker-2', agenda_item_id: 'agenda-1' } as never,
    });
    await agendaServerMutators.addSpeaker.fn({
      tx: txWith([{ event_id: 'event-1' }]) as never,
      ctx,
      args: { id: 'speaker-3', agenda_item_id: 'agenda-1' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifySpeakerListJoined',
      expect.objectContaining({ agendaItemId: 'agenda-1' })
    );
  });

  it('guards voting and completed timeline updates but forwards unrelated statuses', async () => {
    await agendaServerMutators.updateAgendaItemChangeRequest.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'link-1', status: 'open' } as never,
    });
    await agendaServerMutators.updateAgendaItemChangeRequest.fn({
      tx: txWith([{ id: 'link-2', is_closing_vote: true }]) as never,
      ctx,
      args: { id: 'link-2', status: 'voting' } as never,
    });
    await agendaServerMutators.updateAgendaItemChangeRequest.fn({
      tx: txWith([{ id: 'link-3', is_closing_vote: true }]) as never,
      ctx,
      args: { id: 'link-3', status: 'completed' } as never,
    });
    expect(mocks.updateAgendaItemChangeRequest).toHaveBeenCalledTimes(3);
  });

  it('processes absent, terminal, tied, linked, and closing vote results', async () => {
    await agendaServerMutators.processCRVoteResult.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { agenda_item_change_request_id: 'missing', vote_result: 'accepted' } as never,
    });
    for (const status of ['completed', 'blocked_tie']) {
      await agendaServerMutators.processCRVoteResult.fn({
        tx: txWith([{ id: status, status }]) as never,
        ctx,
        args: { agenda_item_change_request_id: status, vote_result: 'accepted' } as never,
      });
    }

    const tie = txWith([
      { id: 'link-tie', status: 'voting', agenda_item_id: 'agenda-1', is_closing_vote: true },
      { id: 'link-tie', status: 'voting', agenda_item_id: 'agenda-1', is_closing_vote: true },
      { event_id: 'event-1' },
    ]);
    await agendaServerMutators.processCRVoteResult.fn({
      tx: tie as never,
      ctx,
      args: { agenda_item_change_request_id: 'link-tie', vote_result: 'tie' } as never,
    });
    expect(tie.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blocked_tie' })
    );

    const linked = txWith([
      {
        id: 'link-accepted',
        status: 'voting',
        agenda_item_id: 'agenda-1',
        is_closing_vote: true,
        change_request_id: 'cr-1',
      },
      {
        id: 'link-accepted',
        status: 'voting',
        agenda_item_id: 'agenda-1',
        is_closing_vote: true,
      },
      { event_id: 'event-1' },
    ]);
    await agendaServerMutators.processCRVoteResult.fn({
      tx: linked as never,
      ctx,
      args: { agenda_item_change_request_id: 'link-accepted', vote_result: 'accepted' } as never,
    });
    expect(mocks.resolveChangeRequestByVoteResult).toHaveBeenCalled();

    const closing = txWith([
      { id: 'closing', status: 'voting', agenda_item_id: 'agenda-1', is_closing_vote: true },
      { id: 'closing', status: 'voting', agenda_item_id: 'agenda-1', is_closing_vote: true },
      { event_id: 'event-1' },
    ]);
    await agendaServerMutators.processCRVoteResult.fn({
      tx: closing as never,
      ctx,
      args: { agenda_item_change_request_id: 'closing', vote_result: 'rejected' } as never,
    });
  });

  it('filters terminal and invalid forward-confirmed materialization steps', async () => {
    await materializeCurrentForwardConfirmedEventVoting(txWith() as never, ctx as never, null);
    await materializeCurrentForwardConfirmedEventVoting(
      txWith([[{ status: 'completed' }]]) as never,
      ctx as never,
      'branch-1'
    );
    for (const step of [
      { agenda_item_id: null, event_id: 'event-1', decision_status: 'forward_confirmed' },
      { agenda_item_id: 'agenda-1', event_id: null, decision_status: 'forward_confirmed' },
      {
        agenda_item_id: 'agenda-1',
        event_id: 'event-1',
        step_kind: 'merge_vote',
        decision_status: 'forward_confirmed',
      },
      {
        agenda_item_id: 'agenda-1',
        event_id: 'event-1',
        step_kind: 'group_vote',
        decision_status: 'outstanding',
      },
    ]) {
      await materializeCurrentForwardConfirmedEventVoting(
        txWith([[{ status: 'scheduled', ...step }]]) as never,
        ctx as never,
        'branch-1'
      );
    }
    await materializeCurrentForwardConfirmedEventVoting(
      txWith([
        [
          {
            status: 'scheduled',
            agenda_item_id: 'agenda-1',
            event_id: 'event-1',
            step_kind: 'group_vote',
            decision_status: 'forward_confirmed',
          },
        ],
        null,
      ]) as never,
      ctx as never,
      'branch-1'
    );
    await materializeCurrentForwardConfirmedEventVoting(
      txWith([
        [
          {
            status: null,
            agenda_item_id: 'agenda-1',
            event_id: 'event-1',
            step_kind: 'group_vote',
            decision_status: 'forward_confirmed',
          },
        ],
        null,
      ]) as never,
      ctx as never,
      'branch-1'
    );
  });
});
