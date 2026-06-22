import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateElectionFn,
  createElectionFn,
  addCandidateFn,
  deleteCandidateFn,
  castIndicativeElectionVoteFn,
  castFinalElectionVoteFn,
  upsertOfflineTallyFn,
  eventTitleMock,
  fireNotificationMock,
  getConfirmedOfflineAttendeeCountMock,
  recomputeEventCountersMock,
  requireConfiguredRecentVotingPasswordVerificationMock,
  requireRecentVotingPasswordVerificationMock,
  eventAllowsOnlineVotingMock,
  isUserForcedOfflineForEventMock,
} = vi.hoisted(() => ({
  updateElectionFn: vi.fn(),
  createElectionFn: vi.fn(),
  addCandidateFn: vi.fn(),
  deleteCandidateFn: vi.fn(),
  castIndicativeElectionVoteFn: vi.fn(),
  castFinalElectionVoteFn: vi.fn(),
  upsertOfflineTallyFn: vi.fn(),
  eventTitleMock: vi.fn(),
  fireNotificationMock: vi.fn(),
  getConfirmedOfflineAttendeeCountMock: vi.fn(),
  recomputeEventCountersMock: vi.fn(),
  requireConfiguredRecentVotingPasswordVerificationMock: vi.fn(),
  requireRecentVotingPasswordVerificationMock: vi.fn(),
  eventAllowsOnlineVotingMock: vi.fn(),
  isUserForcedOfflineForEventMock: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    elections: {
      createElection: { fn: createElectionFn },
      addCandidate: { fn: addCandidateFn },
      deleteCandidate: { fn: deleteCandidateFn },
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
  requireConfiguredRecentVotingPasswordVerification:
    requireConfiguredRecentVotingPasswordVerificationMock,
  requireRecentVotingPasswordVerification: requireRecentVotingPasswordVerificationMock,
  syncUserWithEventConversation: vi.fn(),
  userName: vi.fn(),
}));

vi.mock('../../server-notify', () => ({
  fireNotification: fireNotificationMock,
}));

vi.mock('../../offline-roster-helpers', () => ({
  eventAllowsOnlineVoting: eventAllowsOnlineVotingMock,
  getConfirmedOfflineAttendeeCount: getConfirmedOfflineAttendeeCountMock,
  isUserForcedOfflineForEvent: isUserForcedOfflineForEventMock,
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
  deleteCandidateFn.mockReset();
  castIndicativeElectionVoteFn.mockReset();
  castFinalElectionVoteFn.mockReset();
  upsertOfflineTallyFn.mockReset();
  eventTitleMock.mockReset();
  fireNotificationMock.mockReset();
  getConfirmedOfflineAttendeeCountMock.mockReset();
  getConfirmedOfflineAttendeeCountMock.mockResolvedValue(0);
  recomputeEventCountersMock.mockReset();
  requireConfiguredRecentVotingPasswordVerificationMock.mockReset();
  requireConfiguredRecentVotingPasswordVerificationMock.mockResolvedValue(undefined);
  requireRecentVotingPasswordVerificationMock.mockReset();
  requireRecentVotingPasswordVerificationMock.mockResolvedValue(undefined);
  eventAllowsOnlineVotingMock.mockReset();
  eventAllowsOnlineVotingMock.mockResolvedValue(true);
  isUserForcedOfflineForEventMock.mockReset();
  isUserForcedOfflineForEventMock.mockResolvedValue(false);
});

describe('electionServerMutators candidacy PIN verification', () => {
  const candidateArgs = {
    id: 'candidate-1',
    election_id: 'election-1',
    user_id: 'user-1',
    name: 'Ada',
    description: null,
    image_url: null,
    status: 'nominated',
    order_index: 1,
  };

  it('requires recent PIN verification before adding self-candidacy', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({ id: 'election-1', agenda_item_id: null });

    await electionServerMutators.addCandidate.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: candidateArgs,
    });

    expect(requireConfiguredRecentVotingPasswordVerificationMock).toHaveBeenCalledWith(
      tx,
      'user-1'
    );
    expect(addCandidateFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: candidateArgs,
    });
  });

  it('does not add self-candidacy when PIN verification fails', async () => {
    const tx = createTx();
    requireConfiguredRecentVotingPasswordVerificationMock.mockRejectedValueOnce(
      new Error('Please verify your voting PIN before changing your candidacy.')
    );

    await expect(
      electionServerMutators.addCandidate.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: candidateArgs,
      })
    ).rejects.toThrow('Please verify your voting PIN before changing your candidacy.');

    expect(addCandidateFn).not.toHaveBeenCalled();
  });

  it('requires recent PIN verification before withdrawing self-candidacy', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({ id: 'candidate-1', user_id: 'user-1' });

    await electionServerMutators.deleteCandidate.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { id: 'candidate-1' },
    });

    expect(requireConfiguredRecentVotingPasswordVerificationMock).toHaveBeenCalledWith(
      tx,
      'user-1'
    );
    expect(deleteCandidateFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: { id: 'candidate-1' },
    });
  });

  it('lets managers remove another user candidate without candidate PIN verification', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({ id: 'candidate-1', user_id: 'user-2' });

    await electionServerMutators.deleteCandidate.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { id: 'candidate-1' },
    });

    expect(requireConfiguredRecentVotingPasswordVerificationMock).not.toHaveBeenCalled();
    expect(deleteCandidateFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: { id: 'candidate-1' },
    });
  });
});

function createOfflineTallyTx({
  maxVotes = 4,
  existingTallies = [],
}: {
  maxVotes?: number;
  existingTallies?: {
    phase: 'indicative' | 'final';
    candidate_id: string;
    count: number;
  }[];
} = {}) {
  const tx = createTx();

  tx.run
    .mockResolvedValueOnce({
      id: 'election-1',
      agenda_item_id: 'agenda-1',
    })
    .mockResolvedValueOnce({
      id: 'election-1',
      max_votes: maxVotes,
    })
    .mockResolvedValueOnce({
      id: 'agenda-1',
      event_id: 'event-1',
    })
    .mockResolvedValueOnce(existingTallies);

  return tx;
}

describe('electionServerMutators.updateElection notifications', () => {
  it.each(['final', 'final'])(
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

describe('electionServerMutators.upsertOfflineTally caps', () => {
  it('rejects a candidate tally above the confirmed offline participant count', async () => {
    const tx = createOfflineTallyTx();
    getConfirmedOfflineAttendeeCountMock.mockResolvedValueOnce(3);

    await expect(
      electionServerMutators.upsertOfflineTally.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          election_id: 'election-1',
          phase: 'indicative',
          candidate_id: 'candidate-1',
          count: 4,
        },
      })
    ).rejects.toThrow('Each candidate can receive at most 3 offline selections.');

    expect(upsertOfflineTallyFn).not.toHaveBeenCalled();
  });

  it('allows a candidate tally at the participant cap when the total cap allows it', async () => {
    const tx = createOfflineTallyTx();
    getConfirmedOfflineAttendeeCountMock.mockResolvedValueOnce(3);

    await electionServerMutators.upsertOfflineTally.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        election_id: 'election-1',
        phase: 'indicative',
        candidate_id: 'candidate-1',
        count: 3,
      },
    });

    expect(upsertOfflineTallyFn).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: {
        election_id: 'election-1',
        phase: 'indicative',
        candidate_id: 'candidate-1',
        count: 3,
      },
    });
  });

  it('keeps rejecting election offline tallies above the total offline vote cap', async () => {
    const tx = createOfflineTallyTx({
      existingTallies: [
        { phase: 'indicative', candidate_id: 'candidate-2', count: 3 },
        { phase: 'indicative', candidate_id: 'candidate-3', count: 3 },
        { phase: 'indicative', candidate_id: 'candidate-4', count: 3 },
        { phase: 'indicative', candidate_id: 'candidate-5', count: 1 },
      ],
    });
    getConfirmedOfflineAttendeeCountMock.mockResolvedValueOnce(3);

    await expect(
      electionServerMutators.upsertOfflineTally.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          election_id: 'election-1',
          phase: 'indicative',
          candidate_id: 'candidate-1',
          count: 3,
        },
      })
    ).rejects.toThrow('Offline election totals exceed the current cap of 12 votes');

    expect(upsertOfflineTallyFn).not.toHaveBeenCalled();
  });
});
