import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  canMock,
  discardPendingEventSuggestionsMock,
  finalizeInternalChangeRequestsForEventPhaseTransitionMock,
} = vi.hoisted(() => ({
  canMock: vi.fn(),
  discardPendingEventSuggestionsMock: vi.fn(),
  finalizeInternalChangeRequestsForEventPhaseTransitionMock: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: canMock,
}));

vi.mock('../../change-requests/event-suggestions', () => ({
  discardPendingEventSuggestions: discardPendingEventSuggestionsMock,
}));

vi.mock('../../change-requests/internal-voting', () => ({
  finalizeInternalChangeRequestsForEventPhaseTransition:
    finalizeInternalChangeRequestsForEventPhaseTransitionMock,
}));

import { agendaServerMutators } from '../server-mutators';

function createCtx() {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      amendment: {
        update: vi.fn(),
      },
      amendment_process_branch: {
        update: vi.fn(),
      },
      agenda_item_change_request: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      amendment_process_step_run: {
        update: vi.fn(),
      },
      agenda_item: {
        update: vi.fn(),
      },
      vote: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      vote_choice: {
        insert: vi.fn(),
      },
      voter: {
        insert: vi.fn(),
      },
    },
  };
}

function agendaItem() {
  return {
    id: 'agenda-1',
    event_id: 'event-1',
    amendment_id: 'amendment-1',
    title: 'A1',
  };
}

function amendment() {
  return {
    id: 'amendment-1',
    editing_mode: 'event_final_closing_vote',
  };
}

async function initialize(tx: ReturnType<typeof createTx>, overrides = {}) {
  await agendaServerMutators.initializeChangeRequestVoting.fn({
    tx: tx as never,
    ctx: createCtx() as never,
    args: {
      amendment_id: 'amendment-1',
      agenda_item_id: 'agenda-1',
      ...overrides,
    },
  });
}

beforeEach(() => {
  canMock.mockReset();
  canMock.mockResolvedValue(undefined);
  discardPendingEventSuggestionsMock.mockReset();
  finalizeInternalChangeRequestsForEventPhaseTransitionMock.mockReset();
});

describe('agendaServerMutators.initializeChangeRequestVoting', () => {
  it('creates a real final amendment vote without change requests', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([{ user_id: 'user-1' }, { user_id: 'user-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx);

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'final_closing',
        status: 'indicative_open',
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: null,
        is_final_vote: true,
        step_kind: 'final_closing',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.voter.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.vote.update).not.toHaveBeenCalled();
  });

  it('starts the materialized final vote when requested and no change requests exist', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ default_final_vote_duration_seconds: null });

    await initialize(tx, { start_final_vote_if_no_change_requests: true });

    const finalVoteInsert = tx.mutate.vote.insert.mock.calls.find(
      ([vote]) => vote.purpose === 'final_closing'
    )?.[0];

    expect(finalVoteInsert).toBeTruthy();
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: finalVoteInsert.id,
        status: 'final_open',
      })
    );
  });

  it('does not skip real change request votes when start-final is requested', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'cr-1', title: 'CR 1', process_branch_id: null }])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx, { start_final_vote_if_no_change_requests: true });

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-1',
        is_final_vote: false,
        status: 'pending',
      })
    );
    expect(tx.mutate.vote.update).not.toHaveBeenCalled();
  });

  it('materializes only change requests for the agenda item branch', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        { id: 'step-branch', branch_id: 'branch-1', step_kind: 'group_vote', status: 'scheduled' },
      ])
      .mockResolvedValueOnce([
        { id: 'cr-branch', title: 'Branch CR', process_branch_id: 'branch-1' },
        { id: 'cr-other', title: 'Other branch CR', process_branch_id: 'branch-2' },
        { id: 'cr-main', title: 'Main CR', process_branch_id: null },
      ])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx);

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-branch',
        is_final_vote: false,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'cr-other' })
    );
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'cr-main' })
    );
  });

  it('reuses an existing final vote instead of creating a duplicate', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'vote-final-1',
          purpose: 'final_closing',
          status: 'indicative_open',
        },
      ])
      .mockResolvedValueOnce({ default_final_vote_duration_seconds: null });

    await initialize(tx, { start_final_vote_if_no_change_requests: true });

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote_choice.insert).not.toHaveBeenCalled();
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-final-1',
        status: 'final_open',
      })
    );
  });

  it('creates a merge-variant step with branch-titled agenda and vote titles', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        {
          id: 'step-merge-a',
          branch_id: 'branch-1',
          step_kind: 'merge_vote',
          status: 'scheduled',
        },
        {
          id: 'step-merge-b',
          branch_id: 'branch-2',
          step_kind: 'merge_vote',
          status: 'scheduled',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce({
        id: 'branch-2',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'branch-1', title: 'BR-1', created_at: 1 },
        { id: 'branch-2', title: 'BR-2', created_at: 2 },
      ])
      .mockResolvedValueOnce({ id: 'amendment-1', title: 'A1' });

    await initialize(tx, { start_final_vote_if_no_change_requests: true });

    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-1',
        title: 'A1: BR-1 vs BR-2',
      })
    );
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        title: 'A1: BR-1 vs BR-2',
        purpose: 'merge_variant',
        status: 'indicative_open',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'BR-1',
        semantic_key: 'branch:branch-1',
        process_branch_id: 'branch-1',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'BR-2',
        semantic_key: 'branch:branch-2',
        process_branch_id: 'branch-2',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'abstain',
        semantic_key: 'abstain',
        process_branch_id: null,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: null,
        order_index: 0,
        step_kind: 'merge_variant',
        is_final_vote: false,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        order_index: 1,
        step_kind: 'final_closing',
        is_final_vote: true,
      })
    );
    expect(tx.mutate.amendment_process_step_run.update).toHaveBeenCalledTimes(2);
    expect(tx.mutate.vote.update).not.toHaveBeenCalled();
  });

  it('formats merge-variant titles for more than two branches', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        {
          id: 'step-merge-a',
          branch_id: 'branch-1',
          step_kind: 'merge_vote',
          status: 'scheduled',
        },
        {
          id: 'step-merge-b',
          branch_id: 'branch-2',
          step_kind: 'merge_vote',
          status: 'scheduled',
        },
        {
          id: 'step-merge-c',
          branch_id: 'branch-3',
          step_kind: 'merge_vote',
          status: 'scheduled',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce({
        id: 'branch-2',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce({
        id: 'branch-3',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'branch-2', title: 'BR-2', created_at: 2 },
        { id: 'branch-3', title: 'BR-3', created_at: 3 },
        { id: 'branch-1', title: 'BR-1', created_at: 1 },
      ])
      .mockResolvedValueOnce({ id: 'amendment-1', title: 'A1' });

    await initialize(tx, { start_final_vote_if_no_change_requests: true });

    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-1',
        title: 'A1: BR-1 vs BR-2 vs BR-3',
      })
    );
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'A1: BR-1 vs BR-2 vs BR-3',
        purpose: 'merge_variant',
      })
    );
  });

  it('updates an existing merge-variant vote title instead of creating a duplicate', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        {
          id: 'step-merge-a',
          branch_id: 'branch-1',
          step_kind: 'merge_vote',
          status: 'scheduled',
          vote_id: 'vote-merge-1',
        },
        {
          id: 'step-merge-b',
          branch_id: 'branch-2',
          step_kind: 'merge_vote',
          status: 'scheduled',
          vote_id: 'vote-merge-1',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce({
        id: 'branch-2',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'vote-merge-1',
          purpose: 'merge_variant',
          status: 'indicative_open',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'branch-1', title: 'BR-1', created_at: 1 },
        { id: 'branch-2', title: 'BR-2', created_at: 2 },
      ])
      .mockResolvedValueOnce({ id: 'amendment-1', title: 'A1' })
      .mockResolvedValueOnce([
        {
          id: 'vote-merge-1',
          purpose: 'merge_variant',
          status: 'indicative_open',
        },
      ]);

    await initialize(tx);

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'final_closing' })
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-merge-1',
        title: 'A1: BR-1 vs BR-2',
        purpose: 'merge_variant',
      })
    );
  });
});
