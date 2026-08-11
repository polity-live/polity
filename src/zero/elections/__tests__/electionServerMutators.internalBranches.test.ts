import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseMetadata: vi.fn(),
  resolveMode: vi.fn(),
  resolveSeatCount: vi.fn(),
  computeRevoteDate: vi.fn(),
  eventAllowsOnlineVoting: vi.fn(),
  isUserForcedOfflineForEvent: vi.fn(),
  recomputeEventCounters: vi.fn(),
  syncUserWithEventConversation: vi.fn(),
  isOwnedTutorial: vi.fn(),
  requireRecentPassword: vi.fn(),
  requireConfiguredPassword: vi.fn(),
  eventTitle: vi.fn(),
  userName: vi.fn(),
  fireNotification: vi.fn(),
  assertEligibility: vi.fn(),
  snapshotElectorate: vi.fn(),
  createElection: vi.fn(),
  addCandidate: vi.fn(),
  deleteCandidate: vi.fn(),
  updateElection: vi.fn(),
  castIndicative: vi.fn(),
  replaceIndicative: vi.fn(),
  castFinal: vi.fn(),
  castFinalFull: vi.fn(),
  upsertOfflineTally: vi.fn(),
}));

vi.mock('@/features/elections/logic/electionAssignmentMetadata', () => ({
  parseDelegateElectionMetadata: mocks.parseMetadata,
}));
vi.mock('@/features/elections/logic/electionFlowLogging', () => ({
  logElectionFlowServer: vi.fn(),
}));
vi.mock('@/features/elections/logic/electionMode', () => ({
  resolveElectionMode: mocks.resolveMode,
  resolveElectionSeatCount: mocks.resolveSeatCount,
}));
vi.mock('@/features/votes/utils/revote-scheduling', () => ({
  computeRoleScheduledRevoteDate: mocks.computeRevoteDate,
}));
vi.mock('../../offline-roster-helpers', () => ({
  eventAllowsOnlineVoting: mocks.eventAllowsOnlineVoting,
  isUserForcedOfflineForEvent: mocks.isUserForcedOfflineForEvent,
}));
vi.mock('../../server-helpers', () => ({
  eventTitle: mocks.eventTitle,
  isOwnedAppTutorialAgendaItem: mocks.isOwnedTutorial,
  recomputeEventCounters: mocks.recomputeEventCounters,
  requireConfiguredRecentVotingPasswordVerification: mocks.requireConfiguredPassword,
  requireRecentVotingPasswordVerification: mocks.requireRecentPassword,
  syncUserWithEventConversation: mocks.syncUserWithEventConversation,
  userName: mocks.userName,
}));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../ballot-eligibility', () => ({
  assertCurrentOnlineBallotEligibility: mocks.assertEligibility,
  snapshotElectionElectorate: mocks.snapshotElectorate,
}));
vi.mock('../../mutators', () => ({
  mutators: {
    elections: {
      createElection: { fn: mocks.createElection },
      addCandidate: { fn: mocks.addCandidate },
      deleteCandidate: { fn: mocks.deleteCandidate },
      updateElection: { fn: mocks.updateElection },
      castIndicativeElectionVote: { fn: mocks.castIndicative },
      replaceIndicativeElectionVote: { fn: mocks.replaceIndicative },
      castFinalElectionVote: { fn: mocks.castFinal },
      castFinalElectionVoteFull: { fn: mocks.castFinalFull },
      upsertOfflineTally: { fn: mocks.upsertOfflineTally },
    },
  },
}));

import { electionServerMutatorTestApi as api, electionServerMutators } from '../server-mutators';

function txWith(rows: unknown[] = []) {
  const queue = [...rows];
  return {
    run: vi.fn(async () => queue.shift()),
    mutate: {
      election: { update: vi.fn() },
      indicative_elector_participation: { insert: vi.fn() },
      indicative_candidate_selection: { insert: vi.fn(), delete: vi.fn() },
      event_participant: { insert: vi.fn(), update: vi.fn() },
      event_participant_role: { insert: vi.fn(), delete: vi.fn() },
      role_holder_history: { insert: vi.fn(), update: vi.fn() },
      role: { update: vi.fn() },
      event_delegate: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseMetadata.mockReturnValue(null);
  mocks.resolveMode.mockReturnValue('single');
  mocks.resolveSeatCount.mockReturnValue(1);
  mocks.computeRevoteDate.mockReturnValue(1234);
  mocks.eventAllowsOnlineVoting.mockResolvedValue(true);
  mocks.isUserForcedOfflineForEvent.mockResolvedValue(false);
  mocks.isOwnedTutorial.mockResolvedValue(false);
  mocks.requireRecentPassword.mockResolvedValue(undefined);
  mocks.requireConfiguredPassword.mockResolvedValue(undefined);
  mocks.eventTitle.mockResolvedValue('Event');
  mocks.userName.mockResolvedValue('Fallback candidate');
});

describe('election server internal branch contracts', () => {
  it('recognizes only the final election status', () => {
    expect(api.isFinalElectionVoteStatus('final')).toBe(true);
    expect(api.isFinalElectionVoteStatus('indicative')).toBe(false);
    expect(api.isFinalElectionVoteStatus(null)).toBe(false);
  });

  it('allows an unlinked or online election and rejects offline-only paths', async () => {
    await api.assertOnlineElectionVoteAllowed(txWith([null]) as never, {
      electionId: 'election-1',
      userId: 'user-1',
    });
    await api.assertOnlineElectionVoteAllowed(
      txWith([{ agenda_item_id: 'agenda-1' }, null]) as never,
      { electionId: 'election-1', userId: 'user-1' }
    );
    await api.assertOnlineElectionVoteAllowed(
      txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
      { electionId: 'election-1', userId: 'user-1' }
    );

    mocks.eventAllowsOnlineVoting.mockResolvedValueOnce(false);
    await expect(
      api.assertOnlineElectionVoteAllowed(
        txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
        { electionId: 'election-1', userId: 'user-1' }
      )
    ).rejects.toThrow(/offline tally flow/i);

    mocks.isUserForcedOfflineForEvent.mockResolvedValueOnce(true);
    await expect(
      api.assertOnlineElectionVoteAllowed(
        txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
        { electionId: 'election-1', userId: 'user-1' }
      )
    ).rejects.toThrow(/offline tally flow/i);
  });

  it('enforces individual and aggregate offline election caps', async () => {
    const args = {
      electionId: 'election-1',
      phase: 'final' as const,
      nextCandidateId: 'candidate-1',
      nextCount: 2,
    };
    await expect(
      api.assertOfflineElectionTallyWithinCap(
        txWith([null, { offline_electorate_size: 2 }]) as never,
        args
      )
    ).rejects.toThrow(/not linked/i);

    await expect(
      api.assertOfflineElectionTallyWithinCap(
        txWith([
          { agenda_item_id: 'agenda-1' },
          { offline_electorate_size: 1 },
          { event_id: 'event-1' },
        ]) as never,
        args
      )
    ).rejects.toThrow(/at most 1/i);

    await api.assertOfflineElectionTallyWithinCap(
      txWith([
        { agenda_item_id: 'agenda-1' },
        { offline_electorate_size: 2, max_votes: null },
        { event_id: 'event-1' },
        [
          { phase: 'indicative', candidate_id: 'candidate-1', count: 99 },
          { phase: 'final', candidate_id: 'candidate-1', count: 1 },
        ],
      ]) as never,
      args
    );

    await api.assertOfflineElectionTallyWithinCap(
      txWith([
        { agenda_item_id: 'agenda-1' },
        { offline_electorate_size: null, max_votes: 1 },
        { event_id: 'event-1' },
        [],
      ]) as never,
      { ...args, nextCount: 0 }
    );

    await expect(
      api.assertOfflineElectionTallyWithinCap(
        txWith([
          { agenda_item_id: 'agenda-1' },
          { offline_electorate_size: 2, max_votes: 2 },
          { event_id: 'event-1' },
          [
            { phase: 'final', candidate_id: 'candidate-2', count: 3 },
            { phase: 'indicative', candidate_id: 'candidate-3', count: 50 },
          ],
        ]) as never,
        args
      )
    ).rejects.toThrow(/exceed the current cap of 4/i);

    await expect(
      api.assertOfflineElectionTallyWithinCap(
        txWith([
          { agenda_item_id: 'agenda-1' },
          { offline_electorate_size: 1, max_votes: null },
          { event_id: 'event-1' },
          [{ phase: 'final', candidate_id: 'candidate-2', count: 1 }],
        ]) as never,
        { ...args, nextCount: 1 }
      )
    ).rejects.toThrow(/current cap of 1/i);
  });

  it('adds participant-role links idempotently and preserves assignment provenance', async () => {
    const existing = txWith([{ id: 'link-1' }]);
    await api.addEventParticipantRoleLink(existing as never, {
      eventParticipantId: 'participant-1',
      roleId: 'role-1',
    });
    expect(existing.mutate.event_participant_role.insert).not.toHaveBeenCalled();

    const fresh = txWith([null]);
    await api.addEventParticipantRoleLink(fresh as never, {
      eventParticipantId: 'participant-1',
      roleId: 'role-1',
      assignedById: 'manager-1',
    });
    expect(fresh.mutate.event_participant_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: 'manager-1' })
    );

    const anonymous = txWith([null]);
    await api.addEventParticipantRoleLink(anonymous as never, {
      eventParticipantId: 'participant-1',
      roleId: 'role-1',
    });
    expect(anonymous.mutate.event_participant_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );
  });

  it.each([
    [[{ id: 'default', default_invite_role: true, assignee_kind: 'member' }], 'default'],
    [[{ id: 'voter', name: 'Voter', assignee_kind: 'member' }], 'voter'],
    [[{ id: 'participant', name: 'Participant', assignee_kind: 'member' }], 'participant'],
    [[{ id: 'first', assignee_kind: 'member' }], 'first'],
    [[{ id: 'guest', default_invite_role: true, assignee_kind: 'guest' }], null],
  ])('selects the appropriate default participant role', async (roles, expected) => {
    expect(
      await api.resolveDefaultActiveParticipantRoleId(txWith([roles]) as never, 'event-1')
    ).toBe(expected);
  });

  it('creates, reactivates, and preserves active event participants', async () => {
    const created = txWith([
      null,
      { group_id: 'group-1', visibility: null },
      [{ id: 'role-1', default_invite_role: true, assignee_kind: 'member' }],
      null,
    ]);
    const createdId = await api.ensureActiveEventParticipant(created as never, {
      eventId: 'event-1',
      userId: 'user-1',
    });
    expect(createdId).toEqual(expect.any(String));
    expect(created.mutate.event_participant.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-1', visibility: 'public' })
    );

    const reactivated = txWith([
      { id: 'participant-1', status: 'inactive', group_id: 'old-group' },
      { group_id: null },
      [],
    ]);
    expect(
      await api.ensureActiveEventParticipant(reactivated as never, {
        eventId: 'event-1',
        userId: 'user-1',
      })
    ).toBe('participant-1');
    expect(reactivated.mutate.event_participant.update).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'old-group', status: 'active' })
    );

    const active = txWith([{ id: 'participant-1', status: 'active' }, null, []]);
    await api.ensureActiveEventParticipant(active as never, {
      eventId: 'event-1',
      userId: 'user-1',
    });
    expect(active.mutate.event_participant.update).not.toHaveBeenCalled();

    const createdWithoutEvent = txWith([null, null, [], null]);
    await api.ensureActiveEventParticipant(createdWithoutEvent as never, {
      eventId: 'event-1',
      userId: 'user-1',
    });
    expect(createdWithoutEvent.mutate.event_participant.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: null })
    );

    const reactivatedWithoutGroup = txWith([
      { id: 'participant-1', status: 'inactive', group_id: null },
      null,
      [],
    ]);
    await api.ensureActiveEventParticipant(reactivatedWithoutGroup as never, {
      eventId: 'event-1',
      userId: 'user-1',
    });
    expect(reactivatedWithoutGroup.mutate.event_participant.update).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: null })
    );

    const invalid = txWith([{ id: null, status: 'active' }, null]);
    expect(
      await api.ensureActiveEventParticipant(invalid as never, {
        eventId: 'event-1',
        userId: 'user-1',
      })
    ).toBeNull();
  });

  it('synchronizes role-holder history, including term metadata', async () => {
    const missingRole = txWith([null]);
    await api.syncRoleHoldersForRole(missingRole as never, {
      roleId: 'role-1',
      userIds: ['user-1'],
    });
    expect(missingRole.run).toHaveBeenCalledTimes(1);

    const tx = txWith([
      { id: 'role-1', recurrence_pattern: 'yearly', recurrence_interval: 2 },
      [
        { id: 'old', user_id: 'old-user', end_date: null },
        { id: 'kept', user_id: 'user-1', end_date: null },
        { id: 'ended', user_id: 'ended-user', end_date: 1 },
      ],
    ]);
    await api.syncRoleHoldersForRole(tx as never, {
      roleId: 'role-1',
      userIds: ['user-1', 'user-1', '', 'user-2'],
      updateRoleTerm: true,
    });
    expect(tx.mutate.role_holder_history.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old', reason: 'term_ended' })
    );
    expect(tx.mutate.role_holder_history.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.role.update).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_revote_date: 1234 })
    );

    const empty = txWith([{ id: 'role-1' }, []]);
    await api.syncRoleHoldersForRole(empty as never, {
      roleId: 'role-1',
      userIds: [],
      updateRoleTerm: true,
    });
    expect(empty.mutate.role.update).not.toHaveBeenCalled();
  });

  it('removes stale event-role links and adds desired users', async () => {
    const removals = txWith([
      [
        { user_id: 'kept', participant_roles: [{ id: 'same', role_id: 'role-1' }] },
        { user_id: 'old', participant_roles: [{ id: 'old', role_id: 'role-1' }] },
        { user_id: 'none', participant_roles: undefined },
        { user_id: 'other', participant_roles: [{ id: 'other', role_id: 'role-2' }] },
      ],
    ]);
    await api.syncUsersToEventRole(removals as never, {
      roleId: 'role-1',
      eventId: 'event-1',
      userIds: [],
    });
    expect(removals.mutate.event_participant_role.delete).toHaveBeenCalledWith({ id: 'old' });

    const additions = txWith([[], { id: 'participant-1', status: 'active' }, null, [], null]);
    await api.syncUsersToEventRole(additions as never, {
      roleId: 'role-1',
      eventId: 'event-1',
      userIds: ['', 'user-1', 'user-1'],
      assignedById: 'manager-1',
    });
    expect(additions.mutate.event_participant_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'role-1', assigned_by_id: 'manager-1' })
    );

    const invalidAddition = txWith([[], { id: null, status: 'active' }, null]);
    await api.syncUsersToEventRole(invalidAddition as never, {
      roleId: 'role-1',
      eventId: 'event-1',
      userIds: ['invalid-user'],
    });
    expect(invalidAddition.mutate.event_participant_role.insert).not.toHaveBeenCalled();
  });

  it('synchronizes delegate seat counts, stale delegates, and active participants', async () => {
    await api.syncConfirmedDelegatesFromSeatRoles(txWith() as never, {
      meta: {
        mode: 'list',
        targetEventId: 'target-event',
        sourceGroupId: 'group-1',
        seatRoleIds: [],
        allSeatRoleIds: [],
      } as never,
    });

    const tx = txWith([
      [
        { role_id: 'seat-1', user_id: 'user-1', end_date: null },
        { role_id: 'seat-2', user_id: 'user-1', end_date: null },
        { role_id: 'ended', user_id: 'user-2', end_date: 1 },
      ],
      [
        { id: 'delegate-1', user_id: 'user-1' },
        { id: 'delegate-old', user_id: 'user-old' },
      ],
      { id: 'participant-1', status: 'active' },
      null,
      [],
    ]);
    await api.syncConfirmedDelegatesFromSeatRoles(tx as never, {
      meta: {
        mode: 'list',
        targetEventId: 'target-event',
        sourceGroupId: 'group-1',
        seatRoleIds: ['seat-1', 'seat-2'],
        allSeatRoleIds: ['seat-1', 'seat-2', 'missing', 'ended'],
      } as never,
      correlationId: 'correlation-1',
    });
    expect(tx.mutate.event_delegate.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'delegate-1', seat_count: 2 })
    );
    expect(tx.mutate.event_delegate.delete).toHaveBeenCalledWith({ id: 'delegate-old' });

    const insertion = txWith([
      [{ role_id: 'seat-1', user_id: 'user-1', end_date: null }],
      [],
      { id: null, status: 'active' },
      null,
    ]);
    await api.syncConfirmedDelegatesFromSeatRoles(insertion as never, {
      meta: {
        mode: 'list',
        targetEventId: 'target-event',
        sourceGroupId: 'group-1',
        seatRoleIds: ['seat-1'],
        allSeatRoleIds: ['seat-1'],
      } as never,
    });
    expect(insertion.mutate.event_delegate.insert).toHaveBeenCalled();
  });

  it('applies skipped, no-winner, runoff, group, event, and delegate assignments', async () => {
    expect(
      await api.applyElectionAssignments(txWith([null]) as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'skipped' }));

    const noWinner = txWith([
      { id: 'election-1', role: { id: 'role-1', scope: 'group' }, candidates: [] },
    ]);
    expect(
      await api.applyElectionAssignments(noWinner as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'no_winner' }));

    const runoff = txWith([
      {
        id: 'election-1',
        role: { id: 'role-1', scope: 'group' },
        candidates: [{ id: 'one' }, { id: 'two' }],
        final_selections: [{ candidate_id: 'one' }, { candidate_id: 'two' }],
      },
    ]);
    expect(
      await api.applyElectionAssignments(runoff as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'runoff_required' }));
    expect(runoff.mutate.election.update).toHaveBeenCalled();

    const group = txWith([
      {
        id: 'election-1',
        role: { id: 'role-1', scope: 'group' },
        candidates: [{ id: 'one', user_id: 'user-1' }],
        final_selections: [{ candidate_id: 'one' }],
        offline_tallies: [],
      },
      { id: 'role-1' },
      [],
    ]);
    expect(
      await api.applyElectionAssignments(group as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'applied' }));
    expect(group.mutate.role.update).toHaveBeenCalled();

    const event = txWith([
      {
        id: 'election-1',
        role: { id: 'role-1', scope: 'event', event_id: 'event-1' },
        candidates: [{ id: 'one', user_id: 'user-1' }],
        final_selections: [{ candidate_id: 'one' }],
      },
      { id: 'role-1' },
      [],
      [],
      { id: 'participant-1', status: 'active' },
      null,
      [],
      null,
    ]);
    expect(
      await api.applyElectionAssignments(event as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'applied' }));

    const metadata = {
      mode: 'list',
      targetEventId: 'target-event',
      sourceGroupId: 'group-1',
      seatRoleIds: ['seat-1', 'seat-2'],
      allSeatRoleIds: [],
    };
    mocks.parseMetadata.mockReturnValueOnce(metadata);
    const delegated = txWith([
      {
        id: 'election-1',
        description: 'metadata',
        role: { id: 'role-1' },
        candidates: [{ id: 'one', user_id: 'user-1' }],
        final_selections: [{ candidate_id: 'one' }],
      },
      { id: 'seat-1' },
      [],
    ]);
    expect(
      await api.applyElectionAssignments(delegated as never, {
        electionId: 'election-1',
        correlationId: 'correlation-1',
      })
    ).toEqual(expect.objectContaining({ outcome: 'applied', seatCount: 2 }));

    mocks.parseMetadata.mockReturnValueOnce({ ...metadata, seatRoleIds: [], allSeatRoleIds: [] });
    const delegatedWithoutWinner = txWith([
      { id: 'election-1', description: 'metadata', role: { id: 'role-1' } },
    ]);
    expect(
      await api.applyElectionAssignments(delegatedWithoutWinner as never, {
        electionId: 'election-1',
      })
    ).toEqual(expect.objectContaining({ outcome: 'no_winner' }));

    mocks.parseMetadata.mockReturnValueOnce(null);
    const sparseSingle = txWith([{ id: 'election-1', role: { id: 'role-1' } }]);
    expect(
      await api.applyElectionAssignments(sparseSingle as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'no_winner' }));

    const unspecifiedScope = txWith([
      {
        id: 'election-1',
        role: { id: 'role-1', scope: null },
        candidates: [{ id: 'one', user_id: 'user-1' }],
        final_selections: [{ candidate_id: 'one' }],
      },
      { id: 'role-1' },
      [],
    ]);
    expect(
      await api.applyElectionAssignments(unspecifiedScope as never, { electionId: 'election-1' })
    ).toEqual(expect.objectContaining({ outcome: 'applied' }));
  });
});

describe('election server public mutator edge branches', () => {
  const ctx = { userID: 'user-1', email: 'user@example.com' };
  const idempotencyId = '00000000-0000-4000-8000-000000000001';
  const baseElection = {
    id: 'election-1',
    agenda_item_id: 'agenda-1',
    status: 'indicative',
    max_votes: 1,
    ballot_visibility: 'named',
    electorate_snapshotted_at: null,
  };

  async function submit(rows: unknown[], overrides: Record<string, unknown> = {}) {
    const tx = txWith(rows);
    await electionServerMutators.submitElectionVote.fn({
      tx: tx as never,
      ctx,
      args: {
        election_id: 'election-1',
        phase: 'indicative',
        candidate_ids: ['candidate-1'],
        idempotency_id: idempotencyId,
        ...overrides,
      } as never,
    });
    return tx;
  }

  it('starts elections with optional closing times and rejects missing elections', async () => {
    await expect(
      electionServerMutators.startElection.fn({
        tx: txWith([null]) as never,
        ctx,
        args: { election_id: 'election-1', phase: 'indicative' } as never,
      })
    ).rejects.toThrow(/not found/i);

    await electionServerMutators.startElection.fn({
      tx: txWith([{ id: 'election-1' }, { id: 'election-1', status: 'pending' }]) as never,
      ctx,
      args: { election_id: 'election-1', phase: 'indicative' } as never,
    });
    expect(mocks.updateElection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.not.objectContaining({ closing_end_time: expect.anything() }),
      })
    );

    await electionServerMutators.startElection.fn({
      tx: txWith([{ id: 'election-1' }, { id: 'election-1', status: 'pending' }]) as never,
      ctx,
      args: { election_id: 'election-1', phase: 'indicative', closing_end_time: null } as never,
    });
    expect(mocks.updateElection).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: expect.objectContaining({ closing_end_time: null }) })
    );
  });

  it('validates election phase, candidate limits, and candidate identity', async () => {
    await expect(submit([null], { candidate_ids: [] })).rejects.toThrow(/not open/i);
    await expect(
      submit([{ ...baseElection, status: 'final' }], { phase: 'indicative' })
    ).rejects.toThrow(/not open/i);
    await expect(
      submit([{ ...baseElection, max_votes: 0 }], { candidate_ids: ['candidate-1'] })
    ).rejects.toThrow(/at most 0/i);
    await expect(
      submit([baseElection, [{ id: 'other' }]], { candidate_ids: ['candidate-1'] })
    ).rejects.toThrow(/candidate not found/i);
  });

  it('supports indicative idempotency, named replacement, and secret ballots', async () => {
    mocks.isOwnedTutorial.mockResolvedValueOnce(true);
    await submit(
      [{ ...baseElection, status: 'indication' }, [{ id: 'candidate-1' }], { id: idempotencyId }],
      {}
    );

    await expect(
      submit([
        { ...baseElection, ballot_visibility: null },
        [{ id: 'candidate-1' }],
        { id: 'existing' },
      ])
    ).rejects.toThrow(/secret indicative/i);

    const replaced = await submit([
      baseElection,
      [{ id: 'candidate-1' }],
      { id: 'existing' },
      [{ id: 'selection-old-1' }, { id: 'selection-old-2' }],
    ]);
    expect(replaced.mutate.indicative_candidate_selection.delete).toHaveBeenCalledTimes(2);
    expect(replaced.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({ elector_participation_id: 'existing' })
    );

    const freshSecret = await submit([
      { ...baseElection, ballot_visibility: undefined },
      [{ id: 'candidate-1' }],
      null,
    ]);
    expect(freshSecret.mutate.indicative_elector_participation.insert).toHaveBeenCalled();
    expect(freshSecret.mutate.indicative_candidate_selection.insert).toHaveBeenCalledWith(
      expect.objectContaining({ elector_participation_id: null })
    );
  });

  it('enforces the final electorate snapshot and final-vote idempotency', async () => {
    await expect(
      submit([{ ...baseElection, status: 'final' }, [{ id: 'candidate-1' }]], {
        phase: 'final',
      })
    ).rejects.toThrow(/not been snapshotted/i);

    const finalElection = {
      ...baseElection,
      status: 'final',
      electorate_snapshotted_at: 1,
    };
    await expect(
      submit([finalElection, [{ id: 'candidate-1' }], null], { phase: 'final' })
    ).rejects.toThrow(/not part of the electorate/i);
    await expect(
      submit(
        [
          finalElection,
          [{ id: 'candidate-1' }],
          { id: 'elector-1', participation_channel: 'offline' },
        ],
        { phase: 'final' }
      )
    ).rejects.toThrow(/offline tally flow/i);

    await submit(
      [
        finalElection,
        [{ id: 'candidate-1' }],
        { id: 'elector-1', participation_channel: 'online' },
        { id: idempotencyId },
      ],
      { phase: 'final' }
    );
    await expect(
      submit(
        [
          finalElection,
          [{ id: 'candidate-1' }],
          { id: 'elector-1', participation_channel: 'online' },
          { id: 'existing' },
        ],
        { phase: 'final' }
      )
    ).rejects.toThrow(/already cast/i);

    await submit(
      [
        { ...finalElection, ballot_visibility: null },
        [{ id: 'candidate-1' }],
        { id: 'elector-1', participation_channel: 'online' },
        null,
      ],
      { phase: 'final' }
    );
    expect(mocks.castFinalFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          selections: [expect.objectContaining({ elector_participation_id: null })],
        }),
      })
    );

    await submit(
      [
        finalElection,
        [{ id: 'candidate-1' }],
        { id: 'elector-1', participation_channel: 'online' },
        null,
      ],
      { phase: 'final' }
    );
    expect(mocks.castFinalFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          selections: [expect.objectContaining({ elector_participation_id: idempotencyId })],
        }),
      })
    );
  });

  it('logs sparse and delegate election creation and conditionally recomputes counters', async () => {
    mocks.parseMetadata.mockReturnValueOnce(null);
    await electionServerMutators.createElection.fn({
      tx: txWith() as never,
      ctx,
      args: { id: 'election-1', description: null, agenda_item_id: null } as never,
    });

    mocks.parseMetadata.mockReturnValueOnce({ targetEventId: 'target-event' });
    await electionServerMutators.createElection.fn({
      tx: txWith([{ event_id: 'event-1' }]) as never,
      ctx,
      args: {
        id: 'election-2',
        description: 'metadata',
        debug_correlation_id: 'correlation-1',
        agenda_item_id: 'agenda-1',
        role_id: 'role-1',
        election_mode: 'list',
        seat_count: 2,
      } as never,
    });
    expect(mocks.recomputeEventCounters).toHaveBeenCalledWith(expect.anything(), 'event-1');

    mocks.parseMetadata.mockReturnValueOnce(null);
    await electionServerMutators.createElection.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'election-3', agenda_item_id: 'agenda-1' } as never,
    });
  });

  it('handles manager-added candidacies, missing event links, and candidate-name fallback', async () => {
    await electionServerMutators.addCandidate.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'candidate-1', election_id: 'election-1', user_id: 'user-2' } as never,
    });
    expect(mocks.requireConfiguredPassword).not.toHaveBeenCalled();

    await electionServerMutators.addCandidate.fn({
      tx: txWith([{ agenda_item_id: 'agenda-1' }, null]) as never,
      ctx,
      args: { id: 'candidate-2', election_id: 'election-1', user_id: 'user-2' } as never,
    });

    await electionServerMutators.addCandidate.fn({
      tx: txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
      ctx,
      args: {
        id: 'candidate-3',
        election_id: 'election-1',
        user_id: 'user-2',
        name: null,
      } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyCandidateAdded',
      expect.objectContaining({ candidateName: 'Fallback candidate' })
    );

    await electionServerMutators.addCandidate.fn({
      tx: txWith([{ agenda_item_id: 'agenda-1' }, { event_id: 'event-1' }]) as never,
      ctx,
      args: {
        id: 'candidate-4',
        election_id: 'election-1',
        user_id: 'user-2',
        name: 'Named candidate',
      } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyCandidateAdded',
      expect.objectContaining({ candidateName: 'Named candidate' })
    );
  });

  it('covers sparse update paths and all direct vote wrappers', async () => {
    await electionServerMutators.updateElection.fn({
      tx: txWith([null]) as never,
      ctx,
      args: { id: 'election-1', status: 'pending' } as never,
    });
    await electionServerMutators.updateElection.fn({
      tx: txWith([
        { id: 'election-1', status: 'pending', agenda_item_id: 'agenda-1' },
        null,
      ]) as never,
      ctx,
      args: { id: 'election-1', status: 'pending' } as never,
    });
    await electionServerMutators.updateElection.fn({
      tx: txWith([
        { id: 'election-1', status: 'pending', agenda_item_id: 'agenda-1', title: null },
        { event_id: 'event-1' },
      ]) as never,
      ctx,
      args: { id: 'election-1', status: 'final', title: null } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyElectionStarted',
      expect.objectContaining({ electionTitle: 'Election' })
    );

    for (const [name, args] of [
      ['castIndicativeElectionVote', { election_id: 'election-1' }],
      ['replaceIndicativeElectionVote', { participation: { election_id: 'election-1' } }],
      ['castFinalElectionVote', { election_id: 'election-1' }],
      ['castFinalElectionVoteFull', { participation: { election_id: 'election-1' } }],
    ] as const) {
      await electionServerMutators[name].fn({
        tx: txWith([null]) as never,
        ctx,
        args: args as never,
      });
    }
    expect(mocks.castIndicative).toHaveBeenCalled();
    expect(mocks.replaceIndicative).toHaveBeenCalled();
    expect(mocks.castFinal).toHaveBeenCalled();
    expect(mocks.castFinalFull).toHaveBeenCalled();
  });
});
