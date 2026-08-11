import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  canMock,
  discardPendingEventSuggestionsMock,
  finalizeInternalChangeRequestsForEventPhaseTransitionMock,
  resolveChangeRequestByVoteResultMock,
  snapshotVoteElectorateMock,
} = vi.hoisted(() => ({
  canMock: vi.fn(),
  discardPendingEventSuggestionsMock: vi.fn(),
  finalizeInternalChangeRequestsForEventPhaseTransitionMock: vi.fn(),
  resolveChangeRequestByVoteResultMock: vi.fn(),
  snapshotVoteElectorateMock: vi.fn(),
}));

vi.mock('../../ballot-eligibility', () => ({
  snapshotVoteElectorate: snapshotVoteElectorateMock,
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

vi.mock('../../change-requests/server-resolution', () => ({
  resolveChangeRequestByVoteResult: resolveChangeRequestByVoteResultMock,
}));

import {
  agendaServerMutators,
  materializeCurrentForwardConfirmedEventVoting,
} from '../server-mutators';

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
  resolveChangeRequestByVoteResultMock.mockReset();
  snapshotVoteElectorateMock.mockReset();
});

describe('agendaServerMutators.initializeChangeRequestVoting', () => {
  it('materializes only the current forward-confirmed non-merge step', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([
        {
          id: 'step-current',
          branch_id: 'branch-1',
          agenda_item_id: 'agenda-1',
          event_id: 'event-1',
          step_kind: 'group_vote',
          status: 'scheduled',
          decision_status: 'forward_confirmed',
          order_index: 0,
        },
        {
          id: 'step-future',
          branch_id: 'branch-1',
          agenda_item_id: 'agenda-future',
          event_id: 'event-future',
          step_kind: 'group_vote',
          status: 'scheduled',
          decision_status: 'previous_decision_outstanding',
          order_index: 1,
        },
      ])
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        {
          id: 'step-current',
          branch_id: 'branch-1',
          step_kind: 'group_vote',
          status: 'scheduled',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'vote-final-1',
          purpose: 'closing',
          status: 'indicative',
        },
      ]);

    await materializeCurrentForwardConfirmedEventVoting(
      tx as never,
      createCtx() as never,
      'branch-1'
    );

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        vote_id: 'vote-final-1',
        step_kind: 'closing',
      })
    );
  });

  it('does not materialize a merge-based active step', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce([
      {
        id: 'step-merge',
        branch_id: 'branch-1',
        agenda_item_id: 'agenda-merge',
        event_id: 'event-1',
        step_kind: 'merge_vote',
        status: 'scheduled',
        decision_status: 'forward_confirmed',
        order_index: 0,
      },
    ]);

    await materializeCurrentForwardConfirmedEventVoting(
      tx as never,
      createCtx() as never,
      'branch-1'
    );

    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
  });

  it('creates a real final amendment vote without change requests', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx);

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'closing',
        status: 'indicative',
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: null,
        is_closing_vote: true,
        step_kind: 'closing',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
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
      ([vote]) => vote.purpose === 'closing'
    )?.[0];

    expect(finalVoteInsert).toBeTruthy();
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: finalVoteInsert.id,
        status: 'final',
      })
    );
    expect(snapshotVoteElectorateMock).toHaveBeenCalledWith(tx, finalVoteInsert.id);
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
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledTimes(6);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-1',
        order_index: 0,
        is_closing_vote: false,
        status: 'voting',
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: null,
        order_index: 1,
        is_closing_vote: true,
        status: 'pending',
      })
    );
    expect(tx.mutate.vote.update).not.toHaveBeenCalled();
  });

  it('reloads open change requests after leaving vote_internal', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        {
          id: 'step-1',
          branch_id: 'branch-1',
          step_kind: 'group_vote',
          status: 'scheduled',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cr-finalized',
          title: 'CR 1',
          status: 'open',
          process_branch_id: 'branch-1',
        },
      ])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'vote_internal',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx);

    expect(finalizeInternalChangeRequestsForEventPhaseTransitionMock).toHaveBeenCalledOnce();
    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'cr-finalized' })
    );
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
        is_closing_vote: false,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'cr-other' })
    );
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'cr-main' })
    );
  });

  it('orders materialized change request votes by the event setting', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        { id: 'step-branch', branch_id: 'branch-1', step_kind: 'group_vote', status: 'scheduled' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cr-13',
          title: 'CR-13',
          process_branch_id: 'branch-1',
          changed_character_count: 1,
        },
        {
          id: 'cr-15',
          title: 'CR-15',
          process_branch_id: 'branch-1',
          changed_character_count: 2,
        },
      ])
      .mockResolvedValueOnce({ id: 'event-1', change_request_vote_order: 'text_position' })
      .mockResolvedValueOnce({ id: 'amendment-1', document_id: null, discussions: [] })
      .mockResolvedValueOnce([
        {
          id: 'branch-1',
          document_id: 'document-branch-1',
          document_version_id: null,
          discussions: [
            { id: 'suggestion-13', changeRequestEntityId: 'cr-13' },
            { id: 'suggestion-15', changeRequestEntityId: 'cr-15' },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'document-branch-1',
          content: [
            { type: 'p', children: [{ text: 'early', suggestion_15: { id: 'suggestion-15' } }] },
            { type: 'p', children: [{ text: 'later', suggestion_13: { id: 'suggestion-13' } }] },
          ],
        },
      ])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx);

    const changeRequestLinks = tx.mutate.agenda_item_change_request.insert.mock.calls
      .map(([link]) => link)
      .filter(link => link.step_kind === 'change_request');
    expect(changeRequestLinks).toEqual([
      expect.objectContaining({ change_request_id: 'cr-15', order_index: 0 }),
      expect.objectContaining({ change_request_id: 'cr-13', order_index: 1 }),
    ]);
  });

  it('orders materialized change request votes by largest changed character count first', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        { id: 'step-branch', branch_id: 'branch-1', step_kind: 'group_vote', status: 'scheduled' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cr-13',
          title: 'CR-13',
          process_branch_id: 'branch-1',
          changed_character_count: 1,
        },
        {
          id: 'cr-15',
          title: 'CR-15',
          process_branch_id: 'branch-1',
          changed_character_count: 20,
        },
        {
          id: 'cr-11',
          title: 'CR-11',
          process_branch_id: 'branch-1',
          changed_character_count: 10,
        },
      ])
      .mockResolvedValueOnce({
        id: 'event-1',
        change_request_vote_order: 'changed_character_count',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', document_id: null, discussions: [] })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await initialize(tx);

    const changeRequestLinks = tx.mutate.agenda_item_change_request.insert.mock.calls
      .map(([link]) => link)
      .filter(link => link.step_kind === 'change_request');
    expect(changeRequestLinks).toEqual([
      expect.objectContaining({ change_request_id: 'cr-15', order_index: 0 }),
      expect.objectContaining({ change_request_id: 'cr-11', order_index: 1 }),
      expect.objectContaining({ change_request_id: 'cr-13', order_index: 2 }),
    ]);
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
      .mockResolvedValueOnce([
        {
          id: 'vote-final-1',
          purpose: 'closing',
          status: 'indicative',
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
        status: 'final',
      })
    );
    expect(snapshotVoteElectorateMock).toHaveBeenCalledWith(tx, 'vote-final-1');
  });

  it('does not create duplicates when voting is materialized again', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce(agendaItem())
      .mockResolvedValueOnce([
        {
          id: 'step-branch',
          branch_id: 'branch-1',
          step_kind: 'group_vote',
          status: 'scheduled',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cr-1',
          title: 'CR 1',
          process_branch_id: 'branch-1',
        },
      ])
      .mockResolvedValueOnce(amendment())
      .mockResolvedValueOnce([
        {
          id: 'link-cr-1',
          agenda_item_id: 'agenda-1',
          change_request_id: 'cr-1',
          vote_id: 'vote-cr-1',
          order_index: 0,
          step_kind: 'change_request',
          is_closing_vote: false,
        },
        {
          id: 'link-final-1',
          agenda_item_id: 'agenda-1',
          change_request_id: null,
          vote_id: 'vote-final-1',
          order_index: 1,
          step_kind: 'closing',
          is_closing_vote: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'vote-cr-1',
          purpose: 'change_request',
          status: 'indicative',
        },
        {
          id: 'vote-final-1',
          purpose: 'closing',
          status: 'indicative',
        },
      ]);

    await initialize(tx);

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote_choice.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
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
        status: 'indicative',
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
        is_closing_vote: false,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        order_index: 1,
        step_kind: 'closing',
        is_closing_vote: true,
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
      .mockResolvedValueOnce([
        {
          id: 'vote-merge-1',
          purpose: 'merge_variant',
          status: 'indicative',
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
          status: 'indicative',
        },
      ]);

    await initialize(tx);

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'closing' })
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-merge-1',
        title: 'A1: BR-1 vs BR-2',
        purpose: 'merge_variant',
      })
    );
  });

  it('does not process an already completed CR vote result again', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({
      id: 'agenda-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      status: 'completed',
      is_closing_vote: false,
    });

    await agendaServerMutators.processCRVoteResult.fn({
      tx: tx as never,
      ctx: createCtx() as never,
      args: {
        agenda_item_change_request_id: 'agenda-cr-1',
        vote_result: 'passed',
      },
    });

    expect(canMock).not.toHaveBeenCalled();
    expect(resolveChangeRequestByVoteResultMock).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalled();
  });
});
