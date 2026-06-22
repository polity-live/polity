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
    expect(tx.mutate.voter.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-1',
        change_request_id: 'cr-1',
        order_index: 5,
        step_kind: 'change_request',
        process_branch_id: 'branch-1',
        is_closing_vote: false,
        status: 'pending',
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
