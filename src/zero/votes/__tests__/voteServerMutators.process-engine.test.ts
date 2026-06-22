import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateVoteFn,
  createVoteFn,
  castIndicativeVoteFn,
  castFinalVoteFn,
  createFinalChoiceDecisionFn,
  upsertOfflineTallyFn,
  recomputeEventCountersMock,
  eventTitleMock,
  fireNotificationMock,
  requireRecentVotingPasswordVerificationMock,
  resolveAmendmentProcessVoteMock,
  notifyProcessVoteResolutionMock,
  discardPendingEventSuggestionsMock,
  finalizeInternalChangeRequestsForEventPhaseTransitionMock,
  resolveChangeRequestByVoteResultMock,
} = vi.hoisted(() => ({
  updateVoteFn: vi.fn(),
  createVoteFn: vi.fn(),
  castIndicativeVoteFn: vi.fn(),
  castFinalVoteFn: vi.fn(),
  createFinalChoiceDecisionFn: vi.fn(),
  upsertOfflineTallyFn: vi.fn(),
  recomputeEventCountersMock: vi.fn(),
  eventTitleMock: vi.fn(),
  fireNotificationMock: vi.fn(),
  requireRecentVotingPasswordVerificationMock: vi.fn(),
  resolveAmendmentProcessVoteMock: vi.fn(),
  notifyProcessVoteResolutionMock: vi.fn(),
  discardPendingEventSuggestionsMock: vi.fn(),
  finalizeInternalChangeRequestsForEventPhaseTransitionMock: vi.fn(),
  resolveChangeRequestByVoteResultMock: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    votes: {
      createVote: { fn: createVoteFn },
      updateVote: { fn: updateVoteFn },
      castIndicativeVote: { fn: castIndicativeVoteFn },
      castFinalVote: { fn: castFinalVoteFn },
      createFinalChoiceDecision: { fn: createFinalChoiceDecisionFn },
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

vi.mock('../../change-requests/server-resolution', () => ({
  resolveChangeRequestByVoteResult: resolveChangeRequestByVoteResultMock,
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
      agenda_item_change_request: {
        update: vi.fn(),
      },
      agenda_item: {
        update: vi.fn(),
      },
      vote: {
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
  createFinalChoiceDecisionFn.mockReset();
  upsertOfflineTallyFn.mockReset();
  recomputeEventCountersMock.mockReset();
  eventTitleMock.mockReset();
  fireNotificationMock.mockReset();
  requireRecentVotingPasswordVerificationMock.mockReset();
  resolveAmendmentProcessVoteMock.mockReset();
  notifyProcessVoteResolutionMock.mockReset();
  discardPendingEventSuggestionsMock.mockReset();
  finalizeInternalChangeRequestsForEventPhaseTransitionMock.mockReset();
  resolveChangeRequestByVoteResultMock.mockReset();
});

function activeVotingParticipant(userId: string) {
  return {
    id: `participant-${userId}`,
    user_id: userId,
    status: 'active',
    participant_roles: [
      {
        role: {
          action_rights: [
            {
              action: 'active_voting',
              resource: 'events',
              event_id: 'event-1',
            },
          ],
        },
      },
    ],
  };
}

function finalParticipation(voterId: string) {
  return {
    id: `final-participation-${voterId}`,
    vote_id: 'vote-1',
    voter_id: voterId,
  };
}

function voter(id: string, userId: string) {
  return {
    id,
    vote_id: 'vote-1',
    user_id: userId,
  };
}

describe('voteServerMutators final vote auto-close', () => {
  it('does not close after the first final vote when more active voters are eligible', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({ id: 'vote-1', agenda_item_id: 'agenda-1' })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce({ id: 'event-1', attendance_mode: 'hybrid' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'vote-1', status: 'final', agenda_item_id: 'agenda-1' })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce([
        activeVotingParticipant('user-1'),
        activeVotingParticipant('user-2'),
        activeVotingParticipant('user-3'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([voter('voter-1', 'user-1')])
      .mockResolvedValueOnce([finalParticipation('voter-1')])
      .mockResolvedValueOnce([]);

    await voteServerMutators.createFinalChoiceDecision.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'final-participation-voter-1',
      },
    });

    expect(createFinalChoiceDecisionFn).toHaveBeenCalledTimes(1);
    expect(updateVoteFn).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item.update).not.toHaveBeenCalled();
  });

  it('closes when all active voting-right holders have cast a final vote', async () => {
    const tx = createTx();
    eventTitleMock.mockResolvedValueOnce('Event One');
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce({
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    });

    tx.run
      .mockResolvedValueOnce({ id: 'vote-1', agenda_item_id: 'agenda-1' })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce({ id: 'event-1', attendance_mode: 'hybrid' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce([
        activeVotingParticipant('user-1'),
        activeVotingParticipant('user-2'),
        activeVotingParticipant('user-3'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        voter('voter-1', 'user-1'),
        voter('voter-2', 'user-2'),
        voter('voter-3', 'user-3'),
      ])
      .mockResolvedValueOnce([
        finalParticipation('voter-1'),
        finalParticipation('voter-2'),
        finalParticipation('voter-3'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([
        { choice_id: 'accept' },
        { choice_id: 'accept' },
        { choice_id: 'reject' },
      ])
      .mockResolvedValueOnce([
        voter('voter-1', 'user-1'),
        voter('voter-2', 'user-2'),
        voter('voter-3', 'user-3'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      });

    await voteServerMutators.createFinalChoiceDecision.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'final-participation-voter-3',
      },
    });

    expect(updateVoteFn).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          id: 'vote-1',
          status: 'closed',
          closed_reason: 'all_voters',
          closed_by_id: 'user-1',
        }),
      })
    );
    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith({
      id: 'agenda-1',
      voting_phase: 'closed',
      updated_at: expect.any(Number),
    });
  });

  it('keeps a final vote open while confirmed offline attendees have no final tally', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({ id: 'vote-1', agenda_item_id: 'agenda-1' })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce({ id: 'event-1', attendance_mode: 'hybrid' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'vote-1', status: 'final', agenda_item_id: 'agenda-1' })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce([activeVotingParticipant('user-1')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'offline-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ])
      .mockResolvedValueOnce([voter('voter-1', 'user-1')])
      .mockResolvedValueOnce([finalParticipation('voter-1')])
      .mockResolvedValueOnce([]);

    await voteServerMutators.createFinalChoiceDecision.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'decision-1',
        vote_id: 'vote-1',
        choice_id: 'choice-1',
        voter_participation_id: 'final-participation-voter-1',
      },
    });

    expect(updateVoteFn).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item.update).not.toHaveBeenCalled();
  });

  it('closes after the missing confirmed offline final tally is recorded', async () => {
    const tx = createTx();
    eventTitleMock.mockResolvedValueOnce('Event One');
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce({
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    });
    const confirmedOfflineParticipant = {
      id: 'offline-1',
      attendance_status: 'confirmed',
      participation_channel: 'offline',
    };
    const finalTally = { phase: 'final', choice_id: 'choice-1', count: 1 };

    tx.run
      .mockResolvedValueOnce({ id: 'vote-1', agenda_item_id: 'agenda-1' })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce([confirmedOfflineParticipant])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' })
      .mockResolvedValueOnce([activeVotingParticipant('user-1')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([confirmedOfflineParticipant])
      .mockResolvedValueOnce([voter('voter-1', 'user-1')])
      .mockResolvedValueOnce([finalParticipation('voter-1')])
      .mockResolvedValueOnce([finalTally])
      .mockResolvedValueOnce({
        id: 'vote-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([voter('voter-1', 'user-1')])
      .mockResolvedValueOnce([finalTally])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      });

    await voteServerMutators.upsertOfflineTally.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        vote_id: 'vote-1',
        phase: 'final',
        choice_id: 'choice-1',
        count: 1,
      },
    });

    expect(upsertOfflineTallyFn).toHaveBeenCalledTimes(1);
    expect(updateVoteFn).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          id: 'vote-1',
          status: 'closed',
          closed_reason: 'all_voters',
        }),
      })
    );
  });

  it('still closes expired final votes by time limit', async () => {
    const tx = createTx();
    eventTitleMock.mockResolvedValueOnce('Event One');
    resolveAmendmentProcessVoteMock.mockResolvedValueOnce({
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    });

    tx.run
      .mockResolvedValueOnce([{ id: 'agenda-1' }])
      .mockResolvedValueOnce([
        {
          id: 'vote-1',
          status: 'final',
          agenda_item_id: 'agenda-1',
          title: 'Vote title',
          majority_type: 'simple',
          closing_end_time: 1,
        },
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([voter('voter-1', 'user-1')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      });

    await voteServerMutators.closeExpiredFinalVotesForEvent.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { event_id: 'event-1' },
    });

    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-1',
        status: 'closed',
        closed_reason: 'time_elapsed',
      })
    );
    expect(tx.mutate.agenda_item.update).toHaveBeenCalledWith({
      id: 'agenda-1',
      voting_phase: 'closed',
      updated_at: expect.any(Number),
    });
  });
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
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
        status: 'final',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
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
    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        voteResult: 'passed',
      })
    );
    expect(fireNotificationMock).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item.update).not.toHaveBeenCalled();
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
        status: 'final',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'merge_variant',
        title: 'Variant vote',
        majority_type: 'relative',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'choice-a', label: 'Variant A', order_index: 0 },
        { id: 'choice-b', label: 'Variant B', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'choice-a' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
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
      });

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
        status: 'final',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: 'branch-1',
        change_request_id: 'cr-1',
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
    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        voteResult: 'passed',
      })
    );
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
        status: 'final',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'closing',
        title: 'Final amendment vote',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
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
        is_closing_vote: false,
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'pending',
        is_closing_vote: false,
      })
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_closing_vote: false,
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
        status: 'final',
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
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Vote title',
        majority_type: 'simple',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
        title: 'Agenda Item One',
      })
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
        status: 'indicative',
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
          is_closing_vote: false,
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
      .mockResolvedValueOnce([{ id: 'vote-variant-1', status: 'final', purpose: 'merge_variant' }]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-cr-1',
          status: 'final',
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
        purpose: 'closing',
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
          is_closing_vote: false,
        },
      ]);

    await expect(
      voteServerMutators.updateVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'vote-final-1',
          status: 'final',
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
        status: 'indicative',
        agenda_item_id: 'agenda-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'agenda-cr-2',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
      })
      .mockResolvedValueOnce([
        {
          id: 'agenda-cr-1',
          agenda_item_id: 'agenda-1',
          status: 'pending',
          is_closing_vote: false,
          order_index: 0,
        },
        {
          id: 'agenda-cr-2',
          agenda_item_id: 'agenda-1',
          status: 'voting',
          is_closing_vote: false,
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
        status: 'final',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
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
    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        voteResult: 'passed',
      })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-cr-1',
        status: 'completed',
        result_status: 'passed',
      })
    );
    expect(notifyProcessVoteResolutionMock).not.toHaveBeenCalled();
    expect(recomputeEventCountersMock).toHaveBeenCalledWith(tx, 'event-1');
  });

  it('rejects the linked change request when closing a rejected CR final vote', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-cr-rejected',
        status: 'final',
        agenda_item_id: 'agenda-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'reject' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-cr-rejected',
        status: 'closed',
      },
    });

    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        voteResult: 'rejected',
      })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-cr-1',
        status: 'completed',
        result_status: 'rejected',
      })
    );
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
  });

  it('blocks tied CR final votes without resolving the change request', async () => {
    const tx = createTx();

    tx.run
      .mockResolvedValueOnce({
        id: 'vote-cr-tie',
        status: 'final',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
      })
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce([
        { id: 'accept', label: 'accept', order_index: 0 },
        { id: 'reject', label: 'reject', order_index: 1 },
      ])
      .mockResolvedValueOnce([{ choice_id: 'accept' }, { choice_id: 'reject' }])
      .mockResolvedValueOnce([{ id: 'voter-1' }, { id: 'voter-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'agenda-cr-1',
        agenda_item_id: 'agenda-1',
        status: 'voting',
        is_closing_vote: false,
        change_request_id: 'cr-1',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await voteServerMutators.updateVote.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-cr-tie',
        status: 'closed',
      },
    });

    expect(resolveChangeRequestByVoteResultMock).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agenda-cr-1',
        status: 'blocked_tie',
        blocked_reason: 'tie',
        result_status: 'tie',
      })
    );
    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
    expect(resolveAmendmentProcessVoteMock).not.toHaveBeenCalled();
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
