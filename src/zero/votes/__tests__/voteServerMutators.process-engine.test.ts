import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateVoteFn,
  createVoteFn,
  castIndicativeVoteFn,
  castFinalVoteFn,
  upsertOfflineTallyFn,
  recomputeEventCountersMock,
  eventTitleMock,
  fireNotificationMock,
  requireRecentVotingPasswordVerificationMock,
  resolveAmendmentProcessVoteMock,
  notifyProcessVoteResolutionMock,
  discardPendingEventSuggestionsMock,
  finalizeInternalChangeRequestsForEventPhaseTransitionMock,
} = vi.hoisted(() => ({
  updateVoteFn: vi.fn(),
  createVoteFn: vi.fn(),
  castIndicativeVoteFn: vi.fn(),
  castFinalVoteFn: vi.fn(),
  upsertOfflineTallyFn: vi.fn(),
  recomputeEventCountersMock: vi.fn(),
  eventTitleMock: vi.fn(),
  fireNotificationMock: vi.fn(),
  requireRecentVotingPasswordVerificationMock: vi.fn(),
  resolveAmendmentProcessVoteMock: vi.fn(),
  notifyProcessVoteResolutionMock: vi.fn(),
  discardPendingEventSuggestionsMock: vi.fn(),
  finalizeInternalChangeRequestsForEventPhaseTransitionMock: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    votes: {
      createVote: { fn: createVoteFn },
      updateVote: { fn: updateVoteFn },
      castIndicativeVote: { fn: castIndicativeVoteFn },
      castFinalVote: { fn: castFinalVoteFn },
      upsertOfflineTally: { fn: upsertOfflineTallyFn },
    },
  },
}));

vi.mock('../../server-helpers', () => ({
  eventTitle: eventTitleMock,
  recomputeEventCounters: recomputeEventCountersMock,
  requireRecentVotingPasswordVerification: requireRecentVotingPasswordVerificationMock,
}));

vi.mock('../../server-notify', () => ({
  fireNotification: fireNotificationMock,
}));

vi.mock('../../amendments/process-engine', () => ({
  resolveAmendmentProcessVote: resolveAmendmentProcessVoteMock,
}));

vi.mock('../../amendments/process-notifications', () => ({
  notifyProcessVoteResolution: notifyProcessVoteResolutionMock,
}));

vi.mock('../../change-requests/event-suggestions', () => ({
  discardPendingEventSuggestions: discardPendingEventSuggestionsMock,
}));

vi.mock('../../change-requests/internal-voting', () => ({
  finalizeInternalChangeRequestsForEventPhaseTransition:
    finalizeInternalChangeRequestsForEventPhaseTransitionMock,
}));

import { voteServerMutators } from '../server-mutators';

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
    },
  };
}

function createCtx() {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

beforeEach(() => {
  updateVoteFn.mockReset();
  createVoteFn.mockReset();
  castIndicativeVoteFn.mockReset();
  castFinalVoteFn.mockReset();
  upsertOfflineTallyFn.mockReset();
  recomputeEventCountersMock.mockReset();
  eventTitleMock.mockReset();
  fireNotificationMock.mockReset();
  requireRecentVotingPasswordVerificationMock.mockReset();
  resolveAmendmentProcessVoteMock.mockReset();
  notifyProcessVoteResolutionMock.mockReset();
  discardPendingEventSuggestionsMock.mockReset();
  finalizeInternalChangeRequestsForEventPhaseTransitionMock.mockReset();
});

describe('voteServerMutators.updateVote', () => {
  it('notifies event participants when a generic final vote starts', async () => {
    const tx = createTx();
    eventTitleMock.mockResolvedValueOnce('Event One');

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'indicative',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'final',
      },
    });

    expect(fireNotificationMock).toHaveBeenCalledWith('notifyVotingPhaseStarted', {
      senderId: 'user-1',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda Item One',
      votingType: 'final',
    });
  });

  it('notifies event participants when a generic final vote closes', async () => {
    const tx = createTx();
    const resolution = {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    } as const;
    eventTitleMock.mockResolvedValueOnce('Event One');
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce(resolution);

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([
        { choice_id: 'accept' },
        { choice_id: 'accept' },
        { choice_id: 'reject' },
      ])
      .mockResolvedValueOnce([{ id: 'voter-1' }, { id: 'voter-2' }, { id: 'voter-3' }])
      .mockResolvedValueOnce([]);

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });

    expect(notifyProcessVoteResolutionMock).toHaveBeenCalledWith(
      tx,
      'user-1',
      'agenda-1',
      resolution
    );
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyVotingCompleted', {
      senderId: 'user-1',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda Item One',
      result: 'passed',
      acceptVotes: 2,
      rejectVotes: 1,
    });
  });

  it('does not notify event participants when a change-request vote closes', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final_vote',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_final_vote: false,
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });

    expect(notifyProcessVoteResolutionMock).not.toHaveBeenCalled();
    expect(fireNotificationMock).not.toHaveBeenCalled();
  });

  it('returns the amendment to event suggesting after a variant vote closes', async () => {
    const tx = createTx();
    const resolution = {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: null,
    } as const;
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce(resolution);
    eventTitleMock.mockResolvedValueOnce('Event One');

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-variant-1',
        status: 'final_vote',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'variant_selection',
        title: 'Variant vote',
        majority_type: 'relative',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ process_branch_id: 'branch-1' }])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
      .mockResolvedValueOnce([
        { id: 'choice-a', label: 'Variant A', order_index: 0 },
        { id: 'choice-b', label: 'Variant B', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'choice-a' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([]);

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-variant-1',
        status: 'closed',
      },
    });

    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
    );
    expect(discardPendingEventSuggestionsMock).not.toHaveBeenCalled();
    expect(finalizeInternalChangeRequestsForEventPhaseTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amendmentId: 'amendment-1',
      })
    );
  });

  it('returns the amendment to event suggesting after a change-request vote closes', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-cr-1',
        status: 'final_vote',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_final_vote: false,
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        process_branch_id: 'branch-1',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'event_final_closing_vote',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-cr-1',
        status: 'closed',
      },
    });

    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
    );
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
    expect(fireNotificationMock).not.toHaveBeenCalled();
  });

  it('keeps the amendment out of event suggesting after the final amendment vote closes', async () => {
    const tx = createTx();
    const resolution = {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    } as const;
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce(resolution);
    eventTitleMock.mockResolvedValueOnce('Event One');

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-final-1',
        status: 'final_vote',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'final_amendment',
        title: 'Final amendment vote',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([]);

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-final-1',
        status: 'closed',
      },
    });

    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
    expect(finalizeInternalChangeRequestsForEventPhaseTransitionMock).not.toHaveBeenCalled();
  });

  it('does not switch the amendment to final closing when starting a change-request final vote', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-cr-1',
        status: 'indicative',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'pending',
        is_final_vote: false,
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'pending',
        is_final_vote: false,
      })
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_final_vote: false,
          order_index: 0,
        },
      ])
      .mockResolvedValueOnce({
        id: 'amendment-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-cr-1',
        status: 'final_vote',
      },
    });

    expect(discardPendingEventSuggestionsMock).not.toHaveBeenCalled();
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
  });

  it('does not notify event participants for unrelated vote updates', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'indicative',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        title: 'Updated title',
      },
    });

    expect(fireNotificationMock).not.toHaveBeenCalled();
  });

  it('resolves amendment process votes on server-side close', async () => {
    const tx = createTx();
    const resolution = {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    } as const;

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final_open',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([]);
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce(resolution);

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });

    expect(updateVoteFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });
    expect(resolveAmendmentProcessVoteMock).toHaveBeenCalledWith(
      tx,
      {
        agenda_item_id: 'agenda-1',
      },
      'user-1'
    );
    expect(notifyProcessVoteResolutionMock).toHaveBeenCalledWith(
      tx,
      'user-1',
      'agenda-1',
      resolution
    );
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyVotingCompleted',
      expect.objectContaining({
        eventId: 'event-1',
        result: 'passed',
      })
    );
  });

  it('blocks final votes while change request timeline items are still open', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'indicative_open',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_final_vote: false,
        },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-1',
          status: 'closed',
        },
      })
    ).rejects.toThrow('All change request votes must be completed before the final vote.');

    expect(updateVoteFn).not.toHaveBeenCalled();
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
  });

  it('blocks change request final votes while another final vote is active', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-cr-1',
        status: 'indicative',
        agenda_item_id: 'agenda-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'vote-variant-1', status: 'final_open', purpose: 'merge_variant' },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-cr-1',
          status: 'final_vote',
        },
      })
    ).rejects.toThrow('Another final vote is already active for this agenda item.');

    expect(updateVoteFn).not.toHaveBeenCalled();
  });

  it('blocks the final amendment vote until change request votes are completed', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-final-1',
        status: 'indicative',
        agenda_item_id: 'agenda-1',
        purpose: 'final_closing',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ id: 'merge-step', step_kind: 'merge_vote' }])
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_final_vote: false,
        },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-final-1',
          status: 'final_vote',
        },
      })
    ).rejects.toThrow('All change request votes must be completed before the final vote.');

    expect(updateVoteFn).not.toHaveBeenCalled();
  });

  it('blocks out-of-order change request vote closure', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-2',
        status: 'indicative_open',
        agenda_item_id: 'agenda-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-cr-2',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_final_vote: false,
      })
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_final_vote: false,
          order_index: 0,
        },
        {
          id: 'agenda-cr-2',
          agenda_item_id: 'agenda-1',
          status: 'voting',
          is_final_vote: false,
          order_index: 1,
        },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-2',
          status: 'closed',
        },
      })
    ).rejects.toThrow('Change requests must be voted in their configured order.');

    expect(updateVoteFn).not.toHaveBeenCalled();
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
  });

  it('does not resolve amendment process votes when closing change request timeline votes', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-3',
        status: 'final_open',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_final_vote: false,
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-3',
        status: 'closed',
      },
    });

    expect(updateVoteFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: {
        id: 'vote-3',
        status: 'closed',
      },
    });
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
    expect(notifyProcessVoteResolutionMock).not.toHaveBeenCalled();
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
  });

  it('does not re-resolve already closed votes', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'closed',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        status: 'closed',
      },
    });

    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
    expect(notifyProcessVoteResolutionMock).not.toHaveBeenCalled();
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
  });
});
