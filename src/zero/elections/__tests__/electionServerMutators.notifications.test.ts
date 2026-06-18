import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateElectionFn,
  createElectionFn,
  addCandidateFn,
  castIndicativeElectionVoteFn,
  castFinalElectionVoteFn,
  upsertOfflineTallyFn,
  eventTitleMock,
  fireNotificationMock,
  recomputeEventCountersMock,
  requireRecentVotingPasswordVerificationMock,
} = vi.hoisted(() => ({
  updateElectionFn: vi.fn(),
  createElectionFn: vi.fn(),
  addCandidateFn: vi.fn(),
  castIndicativeElectionVoteFn: vi.fn(),
  castFinalElectionVoteFn: vi.fn(),
  upsertOfflineTallyFn: vi.fn(),
  eventTitleMock: vi.fn(),
  fireNotificationMock: vi.fn(),
  recomputeEventCountersMock: vi.fn(),
  requireRecentVotingPasswordVerificationMock: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    elections: {
      createElection: { fn: createElectionFn },
      addCandidate: { fn: addCandidateFn },
      updateElection: { fn: updateElectionFn },
      castIndicativeElectionVote: { fn: castIndicativeElectionVoteFn },
      castFinalElectionVote: { fn: castFinalElectionVoteFn },
      upsertOfflineTally: { fn: upsertOfflineTallyFn },
    },
  },
}));

vi.mock('../../server-helpers', () => ({
  eventTitle: eventTitleMock,
  recomputeEventCounters: recomputeEventCountersMock,
  requireRecentVotingPasswordVerification: requireRecentVotingPasswordVerificationMock,
  syncUserWithEventConversation: vi.fn(),
  userName: vi.fn(),
}));

vi.mock('../../server-notify', () => ({
  fireNotification: fireNotificationMock,
}));

vi.mock('@/features/elections/logic/electionFlowLogging', () => ({
  logElectionFlowServer: vi.fn(),
}));

import { electionServerMutators } from '../server-mutators';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      election: {
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
  updateElectionFn.mockReset();
  createElectionFn.mockReset();
  addCandidateFn.mockReset();
  castIndicativeElectionVoteFn.mockReset();
  castFinalElectionVoteFn.mockReset();
  upsertOfflineTallyFn.mockReset();
  eventTitleMock.mockReset();
  fireNotificationMock.mockReset();
  recomputeEventCountersMock.mockReset();
  requireRecentVotingPasswordVerificationMock.mockReset();
});

describe('electionServerMutators.updateElection notifications', () => {
  it.each(['final', 'final_vote'])(
    'notifies event participants when the final vote starts with status %s',
    async status => {
      const tx = createTx();
      eventTitleMock.mockResolvedValueOnce('Event One');
      tx.run
        .mockResolvedValueOnce({
          id: 'election-1',
          status: 'indicative',
          agenda_item_id: 'agenda-1',
          title: 'Election One',
        })
        .mockResolvedValueOnce({
          id: 'agenda-1',
          event_id: 'event-1',
        });

      await electionServerMutators.updateElection.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'election-1',
          status,
        },
      });

      expect(fireNotificationMock).toHaveBeenCalledWith('notifyElectionStarted', {
        senderId: 'user-1',
        eventId: 'event-1',
        eventTitle: 'Event One',
        electionTitle: 'Election One',
      });
    }
  );

  it('notifies event participants when the final vote closes', async () => {
    const tx = createTx();
    eventTitleMock.mockResolvedValueOnce('Event One');
    tx.run
      .mockResolvedValueOnce({
        id: 'election-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Election One',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      })
      .mockResolvedValueOnce({
        id: 'election-1',
        role: null,
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await electionServerMutators.updateElection.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'election-1',
        status: 'closed',
      },
    });

    expect(fireNotificationMock).toHaveBeenCalledWith('notifyElectionEnded', {
      senderId: 'user-1',
      eventId: 'event-1',
      eventTitle: 'Event One',
      electionTitle: 'Election One',
    });
  });

  it('still sends the final vote closed notification when a runoff is required', async () => {
    const tx = createTx();
    eventTitleMock.mockResolvedValueOnce('Event One');
    tx.run
      .mockResolvedValueOnce({
        id: 'election-1',
        status: 'final',
        agenda_item_id: 'agenda-1',
        title: 'Election One',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      })
      .mockResolvedValueOnce({
        id: 'election-1',
        role: { id: 'role-1', scope: 'event', event_id: 'event-1' },
        candidates: [
          { id: 'candidate-1', user_id: 'candidate-user-1', order_index: 1, status: 'nominated' },
          { id: 'candidate-2', user_id: 'candidate-user-2', order_index: 2, status: 'nominated' },
        ],
        final_selections: [{ candidate_id: 'candidate-1' }, { candidate_id: 'candidate-2' }],
        offline_tallies: [],
        description: null,
        election_mode: null,
        seat_count: 1,
        max_votes: 1,
        majority_type: 'simple',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await electionServerMutators.updateElection.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'election-1',
        status: 'closed',
      },
    });

    expect(fireNotificationMock).toHaveBeenCalledWith('notifyElectionEnded', {
      senderId: 'user-1',
      eventId: 'event-1',
      eventTitle: 'Event One',
      electionTitle: 'Election One',
    });
    expect(fireNotificationMock).not.toHaveBeenCalledWith(
      'notifyElectionResult',
      expect.anything()
    );
    expect(tx.mutate.election.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'election-1',
        status: 'runoff_required',
      })
    );
  });

  it.each([
    { oldStatus: 'final', nextStatus: 'final' },
    { oldStatus: 'closed', nextStatus: 'closed' },
  ])('does not duplicate notifications for repeated $nextStatus updates', async testCase => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'election-1',
        status: testCase.oldStatus,
        agenda_item_id: 'agenda-1',
        title: 'Election One',
      })
      .mockResolvedValueOnce({
        id: 'agenda-1',
        event_id: 'event-1',
      });

    await electionServerMutators.updateElection.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'election-1',
        status: testCase.nextStatus,
      },
    });

    expect(fireNotificationMock).not.toHaveBeenCalledWith(
      'notifyElectionStarted',
      expect.anything()
    );
    expect(fireNotificationMock).not.toHaveBeenCalledWith('notifyElectionEnded', expect.anything());
  });
});
