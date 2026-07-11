import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '../../rbac/errors';

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

function createTx(rows: unknown[]) {
  const remainingRows = [...rows];

  return {
    run: vi.fn(async () => {
      if (remainingRows.length === 0) {
        throw new Error('Unexpected query');
      }
      return remainingRows.shift();
    }),
    mutate: {
      agenda_item_change_request: {
        insert: vi.fn(),
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
  };
}

function changeRequest(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    amendment_id: 'amendment-1',
    process_branch_id: 'branch-1',
    title: id,
    status: 'open',
    voting_status: 'open',
    obsolete_at: null,
    obsolete_reason: null,
    ...overrides,
  };
}

async function ensure(tx: ReturnType<typeof createTx>, overrides = {}) {
  await agendaServerMutators.ensureEventSuggestionChangeRequestVotes.fn({
    tx: tx as never,
    ctx: createCtx() as never,
    args: {
      amendment_id: 'amendment-1',
      agenda_item_id: 'agenda-1',
      process_branch_id: 'branch-1',
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

describe('agendaServerMutators.ensureEventSuggestionChangeRequestVotes', () => {
  it('creates missing indicative CR vote rows idempotently', async () => {
    const tx = createTx([
      agendaItem(),
      [changeRequest('cr-1')],
      [{ id: 'existing-final', change_request_id: null, is_closing_vote: true, order_index: 4 }],
      [{ user_id: 'user-1' }, { user_id: 'user-2' }],
    ]);

    await ensure(tx);

    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
        status: 'indicative',
        ballot_visibility: 'named',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'yes', semantic_key: 'yes' })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'no', semantic_key: 'no' })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'abstain', semantic_key: 'abstain' })
    );
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-1',
        order_index: 4,
        step_kind: 'change_request',
        process_branch_id: 'branch-1',
        is_closing_vote: false,
        status: 'voting',
      })
    );
    expect(tx.mutate.vote.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'closing' })
    );
  });

  it('skips already-linked change requests without creating duplicate rows', async () => {
    const tx = createTx([
      agendaItem(),
      [changeRequest('cr-1')],
      [{ id: 'existing-cr-link', change_request_id: 'cr-1', order_index: 0 }],
    ]);

    await ensure(tx);

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.vote_choice.insert).not.toHaveBeenCalled();
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
  });

  it('appends missing vote rows in the configured event order', async () => {
    const tx = createTx([
      agendaItem(),
      [
        changeRequest('cr-13', { title: 'CR-13', changed_character_count: 1 }),
        changeRequest('cr-15', { title: 'CR-15', changed_character_count: 2 }),
      ],
      [{ id: 'existing-final', change_request_id: null, is_closing_vote: true, order_index: 5 }],
      { id: 'event-1', change_request_vote_order: 'text_position' },
      { id: 'amendment-1', document_id: null, discussions: [] },
      [
        {
          id: 'branch-1',
          document_id: 'document-branch-1',
          document_version_id: null,
          discussions: [
            { id: 'suggestion-13', changeRequestEntityId: 'cr-13' },
            { id: 'suggestion-15', changeRequestEntityId: 'cr-15' },
          ],
        },
      ],
      [
        {
          id: 'document-branch-1',
          content: [
            { type: 'p', children: [{ text: 'early', suggestion_15: { id: 'suggestion-15' } }] },
            { type: 'p', children: [{ text: 'later', suggestion_13: { id: 'suggestion-13' } }] },
          ],
        },
      ],
      [],
      [
        {
          id: 'link-cr-15',
          change_request_id: 'cr-15',
          order_index: 5,
          step_kind: 'change_request',
          is_closing_vote: false,
          status: 'voting',
          change_request: changeRequest('cr-15', { title: 'CR-15' }),
          vote: { status: 'indicative' },
        },
        {
          id: 'link-cr-13',
          change_request_id: 'cr-13',
          order_index: 6,
          step_kind: 'change_request',
          is_closing_vote: false,
          status: 'voting',
          change_request: changeRequest('cr-13', { title: 'CR-13' }),
          vote: { status: 'indicative' },
        },
      ],
      { id: 'amendment-1', document_id: null, discussions: [] },
      [
        {
          id: 'branch-1',
          document_id: 'document-branch-1',
          document_version_id: null,
          discussions: [
            { id: 'suggestion-13', changeRequestEntityId: 'cr-13' },
            { id: 'suggestion-15', changeRequestEntityId: 'cr-15' },
          ],
        },
      ],
      [
        {
          id: 'document-branch-1',
          content: [
            { type: 'p', children: [{ text: 'early', suggestion_15: { id: 'suggestion-15' } }] },
            { type: 'p', children: [{ text: 'later', suggestion_13: { id: 'suggestion-13' } }] },
          ],
        },
      ],
      [],
    ]);

    await ensure(tx);

    const insertedLinks = tx.mutate.agenda_item_change_request.insert.mock.calls.map(
      ([link]) => link
    );
    expect(insertedLinks).toEqual([
      expect.objectContaining({ change_request_id: 'cr-15', order_index: 5 }),
      expect.objectContaining({ change_request_id: 'cr-13', order_index: 6 }),
    ]);
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'existing-final', order_index: 7 })
    );
  });

  it('reorders existing open vote rows when a newly submitted change request belongs before them', async () => {
    const tx = createTx([
      agendaItem(),
      [
        changeRequest('cr-15', { title: 'CR-15', changed_character_count: 10 }),
        changeRequest('cr-17', { title: 'CR-17', changed_character_count: 80 }),
      ],
      [{ id: 'link-cr-15', change_request_id: 'cr-15', is_closing_vote: false, order_index: 0 }],
      { id: 'event-1', change_request_vote_order: 'text_position' },
      [
        {
          id: 'link-cr-15',
          change_request_id: 'cr-15',
          order_index: 0,
          step_kind: 'change_request',
          is_closing_vote: false,
          status: 'pending',
          change_request: changeRequest('cr-15', { title: 'CR-15' }),
          vote: { status: 'indicative' },
        },
        {
          id: 'link-cr-17',
          change_request_id: 'cr-17',
          order_index: 1,
          step_kind: 'change_request',
          is_closing_vote: false,
          status: 'pending',
          change_request: changeRequest('cr-17', { title: 'CR-17' }),
          vote: { status: 'indicative' },
        },
      ],
      { id: 'amendment-1', document_id: null, discussions: [] },
      [
        {
          id: 'branch-1',
          document_id: 'document-branch-1',
          document_version_id: null,
          discussions: [
            { id: 'suggestion-15', changeRequestEntityId: 'cr-15' },
            { id: 'suggestion-17', changeRequestEntityId: 'cr-17' },
          ],
        },
      ],
      [
        {
          id: 'document-branch-1',
          content: [
            { type: 'p', children: [{ text: 'early', suggestion_17: { id: 'suggestion-17' } }] },
            { type: 'p', children: [{ text: 'later', suggestion_15: { id: 'suggestion-15' } }] },
          ],
        },
      ],
      [],
    ]);

    await ensure(tx);

    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        change_request_id: 'cr-17',
        order_index: 1,
      })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'link-cr-17',
        order_index: 0,
      })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'link-cr-15',
        order_index: 1,
      })
    );
  });

  it('keeps a running final CR fixed and inserts new CRs before the closing vote', async () => {
    const activeLink = {
      id: 'link-active',
      change_request_id: 'cr-active',
      is_closing_vote: false,
      order_index: 0,
      status: 'voting',
    };
    const closingLink = {
      id: 'link-closing',
      change_request_id: null,
      is_closing_vote: true,
      step_kind: 'closing',
      order_index: 1,
      status: 'pending',
    };
    const tx = createTx([
      agendaItem(),
      [changeRequest('cr-active'), changeRequest('cr-new')],
      [activeLink, closingLink],
      { id: 'event-1', change_request_vote_order: 'cr_number' },
      [
        {
          ...activeLink,
          step_kind: 'change_request',
          change_request: changeRequest('cr-active'),
          vote: { status: 'final' },
        },
        {
          id: 'link-new',
          change_request_id: 'cr-new',
          is_closing_vote: false,
          step_kind: 'change_request',
          order_index: 1,
          status: 'voting',
          change_request: changeRequest('cr-new'),
          vote: { status: 'indicative' },
        },
        { ...closingLink, order_index: 2 },
      ],
    ]);

    await ensure(tx);

    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'cr-new', order_index: 1 })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'link-closing', order_index: 2 })
    );
    expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'link-active' })
    );
  });

  it('ignores pending, resolved, obsolete, and other-branch change requests', async () => {
    const tx = createTx([
      agendaItem(),
      [
        changeRequest('pending-cr', { voting_status: 'pending_submission' }),
        changeRequest('accepted-cr', { status: 'accepted' }),
        changeRequest('obsolete-cr', { obsolete_reason: 'superseded' }),
        changeRequest('other-branch-cr', { process_branch_id: 'branch-2' }),
      ],
      [],
    ]);

    await ensure(tx);

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
  });

  it('allows vote managers when they do not have active voting rights', async () => {
    canMock.mockImplementation(async (_tx, _ctx, check) => {
      if (check.action === 'active_voting') {
        throw new PermissionError(check.action, check.resource, check.eventId);
      }
      return undefined;
    });
    const tx = createTx([agendaItem(), [changeRequest('cr-1')], [], []]);

    await ensure(tx);

    expect(canMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userID: 'user-1' }),
      expect.objectContaining({ action: 'manage_votes', resource: 'events', eventId: 'event-1' })
    );
    expect(tx.mutate.vote.insert).toHaveBeenCalledTimes(1);
  });
});
