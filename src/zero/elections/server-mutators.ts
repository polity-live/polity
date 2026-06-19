import { defineMutator } from '@rocicorp/zero';
import {
  parseDelegateElectionMetadata,
  type DelegateElectionAssignmentMeta,
} from '@/features/elections/logic/electionAssignmentMetadata';
import { logElectionFlowServer } from '@/features/elections/logic/electionFlowLogging';
import {
  resolveElectionMode,
  resolveElectionSeatCount,
} from '@/features/elections/logic/electionMode';
import { computeRoleScheduledRevoteDate } from '@/features/votes/utils/revote-scheduling';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import {
  eventTitle,
  requireConfiguredRecentVotingPasswordVerification,
  recomputeEventCounters,
  requireRecentVotingPasswordVerification,
  syncUserWithEventConversation,
  userName,
} from '../server-helpers';
import {
  eventAllowsOnlineVoting,
  getConfirmedOfflineAttendeeCount,
  isUserForcedOfflineForEvent,
} from '../offline-roster-helpers';
import {
  createElectionSchema,
  updateElectionSchema,
  createElectionCandidateSchema,
  deleteElectionCandidateSchema,
  createIndicativeElectorParticipationSchema,
  replaceIndicativeElectionVoteSchema,
  createFinalElectorParticipationSchema,
  upsertElectionOfflineTallySchema,
} from './schema';

type ElectionServerTx = Parameters<typeof mutators.elections.createElection.fn>[0]['tx'];

interface CandidateLike {
  id: string;
  user_id?: string | null;
  name?: string | null;
  order_index?: number | null;
  status?: string | null;
}

interface SelectionLike {
  candidate_id?: string | null;
}

interface ElectionOfflineTallyLike {
  candidate_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

interface WinnerResolutionResult {
  winners: CandidateLike[];
  voteCountByCandidateId: Map<string, number>;
  requiresRunoff: boolean;
  tiedCandidateIds: string[];
}

interface ElectionAssignmentResult {
  outcome: 'applied' | 'runoff_required' | 'no_winner' | 'skipped';
  winners: CandidateLike[];
  seatCount: number;
  tiedCandidateIds: string[];
}

function isFinalElectionVoteStatus(status?: string | null) {
  return status === 'final' || status === 'final_vote';
}

async function loadElectionEventId(tx: ElectionServerTx, electionId: string) {
  const election = await tx.run(zql.election.where('id', electionId).one());
  if (!election?.agenda_item_id) {
    return null;
  }

  const agendaItem = await tx.run(zql.agenda_item.where('id', election.agenda_item_id).one());
  return agendaItem?.event_id ?? null;
}

async function assertOnlineElectionVoteAllowed(
  tx: ElectionServerTx,
  args: {
    electionId: string;
    userId: string;
  }
) {
  const eventId = await loadElectionEventId(tx, args.electionId);
  if (!eventId) {
    return;
  }

  const [onlineVotingAllowed, forcedOffline] = await Promise.all([
    eventAllowsOnlineVoting(tx, eventId),
    isUserForcedOfflineForEvent(tx, eventId, args.userId),
  ]);
  if (!onlineVotingAllowed || forcedOffline) {
    throw new Error(
      'This election must be entered via the offline tally flow for this participant.'
    );
  }
}

async function assertOfflineElectionTallyWithinCap(
  tx: ElectionServerTx,
  args: {
    electionId: string;
    phase: 'indicative' | 'final';
    nextCandidateId: string;
    nextCount: number;
  }
) {
  const [eventId, election] = await Promise.all([
    loadElectionEventId(tx, args.electionId),
    tx.run(zql.election.where('id', args.electionId).one()),
  ]);
  if (!eventId || !election) {
    throw new Error('Election is not linked to an event.');
  }

  const confirmedOfflineAttendeeCount = await getConfirmedOfflineAttendeeCount(tx, eventId);
  if (args.nextCount > confirmedOfflineAttendeeCount) {
    throw new Error(
      `Each candidate can receive at most ${confirmedOfflineAttendeeCount} offline selections.`
    );
  }

  const existingTallies = await tx.run(
    zql.election_offline_tally.where('election_id', args.electionId)
  );
  const hasMatchingCandidate = existingTallies.some(
    tally => tally.phase === args.phase && tally.candidate_id === args.nextCandidateId
  );
  const totalCount =
    existingTallies.reduce((sum, tally) => {
      if (tally.phase !== args.phase) {
        return sum;
      }

      return sum + (tally.candidate_id === args.nextCandidateId ? args.nextCount : tally.count);
    }, 0) + (hasMatchingCandidate ? 0 : args.nextCount);
  const maxOfflineVotes = confirmedOfflineAttendeeCount * Math.max(1, election.max_votes ?? 1);

  if (totalCount > maxOfflineVotes) {
    throw new Error(
      `Offline election totals exceed the current cap of ${maxOfflineVotes} votes (${confirmedOfflineAttendeeCount} confirmed offline attendees x ${Math.max(1, election.max_votes ?? 1)} max votes). Confirm more offline or hybrid attendees on the participants page or reduce the tally.`
    );
  }
}

function tallyCandidateVotes(
  candidates: readonly CandidateLike[],
  selections: readonly SelectionLike[],
  offlineTallies: readonly ElectionOfflineTallyLike[] = []
) {
  const voteCountByCandidateId = new Map<string, number>();

  for (const candidate of candidates) {
    voteCountByCandidateId.set(candidate.id, 0);
  }

  for (const selection of selections) {
    if (!selection.candidate_id) {
      continue;
    }

    voteCountByCandidateId.set(
      selection.candidate_id,
      (voteCountByCandidateId.get(selection.candidate_id) ?? 0) + 1
    );
  }

  for (const tally of offlineTallies) {
    if (tally.phase !== 'final' || !tally.candidate_id) {
      continue;
    }

    voteCountByCandidateId.set(
      tally.candidate_id,
      (voteCountByCandidateId.get(tally.candidate_id) ?? 0) + Math.max(0, tally.count ?? 0)
    );
  }

  return voteCountByCandidateId;
}

function countFinalOfflineTallies(offlineTallies: readonly ElectionOfflineTallyLike[] = []) {
  return offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'final' ? sum + Math.max(0, tally.count ?? 0) : sum),
    0
  );
}

function getEligibleCandidates(candidates: readonly CandidateLike[]) {
  return candidates.filter(candidate => candidate.status !== 'declined');
}

function sortCandidatesByVotes(
  candidates: readonly CandidateLike[],
  selections: readonly SelectionLike[],
  offlineTallies: readonly ElectionOfflineTallyLike[] = []
) {
  const eligibleCandidates = getEligibleCandidates(candidates);
  const voteCountByCandidateId = tallyCandidateVotes(
    eligibleCandidates,
    selections,
    offlineTallies
  );
  const sortedCandidates = [...eligibleCandidates].sort((left, right) => {
    const voteDelta =
      (voteCountByCandidateId.get(right.id) ?? 0) - (voteCountByCandidateId.get(left.id) ?? 0);
    if (voteDelta !== 0) {
      return voteDelta;
    }

    const orderDelta =
      (left.order_index ?? Number.MAX_SAFE_INTEGER) -
      (right.order_index ?? Number.MAX_SAFE_INTEGER);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.id.localeCompare(right.id);
  });

  return {
    sortedCandidates,
    voteCountByCandidateId,
  };
}

function resolveSingleWinner(args: {
  candidates: readonly CandidateLike[];
  selections: readonly SelectionLike[];
  offlineTallies?: readonly ElectionOfflineTallyLike[];
  majorityType?: string | null;
}): WinnerResolutionResult {
  const { sortedCandidates, voteCountByCandidateId } = sortCandidatesByVotes(
    args.candidates,
    args.selections,
    args.offlineTallies
  );

  const winner = sortedCandidates[0];
  if (!winner) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  const winnerVotes = voteCountByCandidateId.get(winner.id) ?? 0;
  if (winnerVotes <= 0) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  const runnerUpVotes = sortedCandidates[1]
    ? (voteCountByCandidateId.get(sortedCandidates[1].id) ?? 0)
    : -1;
  if (winnerVotes === runnerUpVotes) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: true,
      tiedCandidateIds: sortedCandidates
        .filter(candidate => (voteCountByCandidateId.get(candidate.id) ?? 0) === winnerVotes)
        .map(candidate => candidate.id),
    };
  }

  const totalVotes = args.selections.length + countFinalOfflineTallies(args.offlineTallies);
  if (args.majorityType === 'absolute' && winnerVotes <= totalVotes / 2) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  if (args.majorityType === 'two_thirds' && winnerVotes < (totalVotes * 2) / 3) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  return {
    winners: [winner],
    voteCountByCandidateId,
    requiresRunoff: false,
    tiedCandidateIds: [],
  };
}

function resolveMultiSeatWinners(args: {
  candidates: readonly CandidateLike[];
  selections: readonly SelectionLike[];
  offlineTallies?: readonly ElectionOfflineTallyLike[];
  seatCount: number;
}): WinnerResolutionResult {
  const seatCount = Math.max(0, args.seatCount);
  if (seatCount === 0) {
    return {
      winners: [],
      voteCountByCandidateId: new Map<string, number>(),
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  const { sortedCandidates, voteCountByCandidateId } = sortCandidatesByVotes(
    args.candidates,
    args.selections,
    args.offlineTallies
  );

  const positiveVoteCandidates = sortedCandidates.filter(
    candidate => (voteCountByCandidateId.get(candidate.id) ?? 0) > 0
  );
  const winners = positiveVoteCandidates.slice(0, seatCount);

  if (winners.length === 0) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  const boundaryWinner = winners[winners.length - 1];
  const nextCandidate = positiveVoteCandidates[winners.length];
  if (!boundaryWinner || !nextCandidate) {
    return {
      winners,
      voteCountByCandidateId,
      requiresRunoff: false,
      tiedCandidateIds: [],
    };
  }

  const boundaryVotes = voteCountByCandidateId.get(boundaryWinner.id) ?? 0;
  const nextVotes = voteCountByCandidateId.get(nextCandidate.id) ?? 0;
  if (boundaryVotes > 0 && boundaryVotes === nextVotes) {
    return {
      winners: [],
      voteCountByCandidateId,
      requiresRunoff: true,
      tiedCandidateIds: positiveVoteCandidates
        .filter(candidate => (voteCountByCandidateId.get(candidate.id) ?? 0) === boundaryVotes)
        .map(candidate => candidate.id),
    };
  }

  return {
    winners,
    voteCountByCandidateId,
    requiresRunoff: false,
    tiedCandidateIds: [],
  };
}

export const electionWinnerResolutionTestApi = {
  resolveMultiSeatWinners,
  resolveSingleWinner,
  tallyCandidateVotes,
};

async function addEventParticipantRoleLink(
  tx: ElectionServerTx,
  args: {
    eventParticipantId: string;
    roleId: string;
    assignedById?: string | null;
  }
) {
  const existingLink = await tx.run(
    zql.event_participant_role
      .where('event_participant_id', args.eventParticipantId)
      .where('role_id', args.roleId)
      .one()
  );

  if (existingLink) {
    return;
  }

  const now = Date.now();
  await tx.mutate.event_participant_role.insert({
    id: crypto.randomUUID(),
    event_participant_id: args.eventParticipantId,
    role_id: args.roleId,
    assigned_at: now,
    assigned_by_id: args.assignedById ?? null,
    created_at: now,
  });
}

async function resolveDefaultActiveParticipantRoleId(tx: ElectionServerTx, eventId: string) {
  const roles = await tx.run(
    zql.role.where('event_id', eventId).where('scope', 'event').orderBy('sort_order', 'asc')
  );

  return (
    roles.find(role => role.default_invite_role && role.assignee_kind !== 'guest')?.id ??
    roles.find(role => role.name === 'Voter' && role.assignee_kind !== 'guest')?.id ??
    roles.find(role => role.name === 'Participant' && role.assignee_kind !== 'guest')?.id ??
    roles.find(role => role.assignee_kind !== 'guest')?.id ??
    null
  );
}

async function ensureActiveEventParticipant(
  tx: ElectionServerTx,
  args: {
    eventId: string;
    userId: string;
    assignedById?: string | null;
  }
) {
  const existingParticipant = await tx.run(
    zql.event_participant.where('event_id', args.eventId).where('user_id', args.userId).one()
  );
  const event = await tx.run(zql.event.where('id', args.eventId).one());
  const now = Date.now();

  let participantId = existingParticipant?.id ?? null;

  if (!existingParticipant) {
    participantId = crypto.randomUUID();
    await tx.mutate.event_participant.insert({
      id: participantId,
      event_id: args.eventId,
      user_id: args.userId,
      group_id: event?.group_id ?? null,
      status: 'active',
      visibility: event?.visibility ?? 'public',
      instance_date: null,
      created_at: now,
    });
  } else if (existingParticipant.status !== 'active') {
    await tx.mutate.event_participant.update({
      id: existingParticipant.id,
      status: 'active',
      group_id: event?.group_id ?? existingParticipant.group_id ?? null,
    });
  }

  if (!participantId) {
    return null;
  }

  const defaultRoleId = await resolveDefaultActiveParticipantRoleId(tx, args.eventId);
  if (defaultRoleId) {
    await addEventParticipantRoleLink(tx, {
      eventParticipantId: participantId,
      roleId: defaultRoleId,
      assignedById: args.assignedById,
    });
  }

  await syncUserWithEventConversation(tx, {
    eventId: args.eventId,
    userId: args.userId,
  });

  return participantId;
}

async function syncRoleHoldersForRole(
  tx: ElectionServerTx,
  args: {
    roleId: string;
    userIds: string[];
    updateRoleTerm?: boolean;
  }
) {
  const role = await tx.run(zql.role.where('id', args.roleId).one());
  if (!role) {
    return;
  }

  const desiredUserIds = [...new Set(args.userIds.filter(Boolean))];
  const desiredUserIdSet = new Set(desiredUserIds);
  const now = Date.now();
  const currentEntries = await tx.run(zql.role_holder_history.where('role_id', args.roleId));
  const activeEntries = currentEntries.filter(entry => !entry.end_date);
  const activeUserIdSet = new Set(activeEntries.map(entry => entry.user_id));

  for (const entry of activeEntries) {
    if (desiredUserIdSet.has(entry.user_id)) {
      continue;
    }

    await tx.mutate.role_holder_history.update({
      id: entry.id,
      end_date: now,
      reason: 'term_ended',
    });
  }

  for (const userId of desiredUserIds) {
    if (activeUserIdSet.has(userId)) {
      continue;
    }

    await tx.mutate.role_holder_history.insert({
      id: crypto.randomUUID(),
      role_id: args.roleId,
      user_id: userId,
      start_date: now,
      end_date: null,
      reason: 'elected',
      created_at: now,
    });
  }

  if (args.updateRoleTerm && desiredUserIds.length > 0) {
    await tx.mutate.role.update({
      id: role.id,
      term_start_date: now,
      scheduled_revote_date: computeRoleScheduledRevoteDate({
        termStartDate: now,
        recurrencePattern: role.recurrence_pattern,
        recurrenceInterval: role.recurrence_interval,
      }),
    });
  }
}

async function assignHolderToRole(
  tx: ElectionServerTx,
  args: {
    roleId: string;
    userId: string;
    updateRoleTerm?: boolean;
  }
) {
  await syncRoleHoldersForRole(tx, {
    roleId: args.roleId,
    userIds: [args.userId],
    updateRoleTerm: args.updateRoleTerm,
  });
}

async function syncUsersToEventRole(
  tx: ElectionServerTx,
  args: {
    roleId: string;
    eventId: string;
    userIds: string[];
    assignedById?: string | null;
  }
) {
  const desiredUserIds = [...new Set(args.userIds.filter(Boolean))];
  const desiredUserIdSet = new Set(desiredUserIds);
  const participants = await tx.run(
    zql.event_participant.where('event_id', args.eventId).related('participant_roles')
  );

  for (const participant of participants) {
    for (const link of participant.participant_roles || []) {
      if (link.role_id !== args.roleId || desiredUserIdSet.has(participant.user_id)) {
        continue;
      }

      await tx.mutate.event_participant_role.delete({ id: link.id });
    }
  }

  for (const userId of desiredUserIds) {
    const participantId = await ensureActiveEventParticipant(tx, {
      eventId: args.eventId,
      userId,
      assignedById: args.assignedById,
    });

    if (!participantId) {
      continue;
    }

    await addEventParticipantRoleLink(tx, {
      eventParticipantId: participantId,
      roleId: args.roleId,
      assignedById: args.assignedById,
    });
  }

  await recomputeEventCounters(tx, args.eventId);
}

async function syncConfirmedDelegatesFromSeatRoles(
  tx: ElectionServerTx,
  args: {
    meta: DelegateElectionAssignmentMeta;
    assignedById?: string | null;
    correlationId?: string | null;
  }
) {
  const allSeatRoleIds = [...new Set(args.meta.allSeatRoleIds.filter(Boolean))];
  if (allSeatRoleIds.length === 0) {
    return;
  }

  const holderHistory = await tx.run(
    zql.role_holder_history.where('role_id', 'IN', allSeatRoleIds)
  );
  const activeHolderByRoleId = new Map<string, (typeof holderHistory)[number]>();

  for (const entry of holderHistory) {
    if (entry.end_date) {
      continue;
    }

    activeHolderByRoleId.set(entry.role_id, entry);
  }

  const desiredSeatCountByUserId = new Map<string, number>();
  for (const roleId of allSeatRoleIds) {
    const activeHolder = activeHolderByRoleId.get(roleId);
    if (!activeHolder) {
      continue;
    }

    desiredSeatCountByUserId.set(
      activeHolder.user_id,
      (desiredSeatCountByUserId.get(activeHolder.user_id) ?? 0) + 1
    );
  }

  const existingDelegates = await tx.run(
    zql.event_delegate
      .where('event_id', args.meta.targetEventId)
      .where('group_id', args.meta.sourceGroupId)
  );
  const existingDelegateByUserId = new Map(
    existingDelegates.map(delegate => [delegate.user_id, delegate])
  );
  const now = Date.now();
  const upsertedDelegates: { userId: string; seatCount: number }[] = [];
  const removedDelegateUserIds: string[] = [];

  for (const [userId, seatCount] of desiredSeatCountByUserId.entries()) {
    const existingDelegate = existingDelegateByUserId.get(userId);
    if (existingDelegate) {
      await tx.mutate.event_delegate.update({
        id: existingDelegate.id,
        status: 'confirmed',
        seat_count: seatCount,
      });
      existingDelegateByUserId.delete(userId);
    } else {
      await tx.mutate.event_delegate.insert({
        id: crypto.randomUUID(),
        event_id: args.meta.targetEventId,
        user_id: userId,
        group_id: args.meta.sourceGroupId,
        status: 'confirmed',
        seat_count: seatCount,
        created_at: now,
      });
    }

    upsertedDelegates.push({ userId, seatCount });

    await ensureActiveEventParticipant(tx, {
      eventId: args.meta.targetEventId,
      userId,
      assignedById: args.assignedById,
    });
  }

  for (const staleDelegate of existingDelegateByUserId.values()) {
    await tx.mutate.event_delegate.delete({ id: staleDelegate.id });
    removedDelegateUserIds.push(staleDelegate.user_id);
  }

  await recomputeEventCounters(tx, args.meta.targetEventId);

  logElectionFlowServer('election-close-final-vote', 'delegate-sync-finished', {
    correlationId: args.correlationId ?? null,
    targetEventId: args.meta.targetEventId,
    sourceGroupId: args.meta.sourceGroupId,
    upsertedDelegates,
    removedDelegateUserIds,
  });
}

async function applyElectionAssignments(
  tx: ElectionServerTx,
  args: {
    electionId: string;
    assignedById?: string | null;
    correlationId?: string | null;
  }
): Promise<ElectionAssignmentResult> {
  const election = await tx.run(
    zql.election
      .where('id', args.electionId)
      .related('role')
      .related('candidates')
      .related('final_selections')
      .related('offline_tallies')
      .one()
  );

  if (!election?.role?.id) {
    return {
      outcome: 'skipped',
      winners: [],
      seatCount: 0,
      tiedCandidateIds: [],
    };
  }

  const metadata = parseDelegateElectionMetadata(election.description);
  const resolvedMode = resolveElectionMode({
    electionMode: election.election_mode,
    seatCount: election.seat_count,
    maxVotes: election.max_votes,
    delegateAssignmentMode: metadata?.mode ?? null,
  });
  const resolvedSeatCount = metadata
    ? Math.max(1, metadata.seatRoleIds.length)
    : resolveElectionSeatCount({
        electionMode: resolvedMode,
        seatCount: election.seat_count,
        maxVotes: election.max_votes,
        fallbackSeatCount: 1,
      });

  const winnerResolution =
    metadata?.mode === 'list' || resolvedMode === 'list' || resolvedSeatCount > 1
      ? resolveMultiSeatWinners({
          candidates: election.candidates || [],
          selections: election.final_selections || [],
          offlineTallies: election.offline_tallies || [],
          seatCount: resolvedSeatCount,
        })
      : resolveSingleWinner({
          candidates: election.candidates || [],
          selections: election.final_selections || [],
          offlineTallies: election.offline_tallies || [],
          majorityType: election.majority_type,
        });

  logElectionFlowServer('election-close-final-vote', 'winner-resolution-computed', {
    correlationId: args.correlationId ?? null,
    electionId: election.id,
    roleId: election.role.id,
    mode: resolvedMode,
    seatCount: resolvedSeatCount,
    winnerIds: winnerResolution.winners.map(winner => winner.id),
    tiedCandidateIds: winnerResolution.tiedCandidateIds,
    requiresRunoff: winnerResolution.requiresRunoff,
  });

  if (winnerResolution.requiresRunoff) {
    await tx.mutate.election.update({
      id: election.id,
      status: 'runoff_required',
      updated_at: Date.now(),
    });

    logElectionFlowServer('election-close-final-vote', 'runoff-required', {
      correlationId: args.correlationId ?? null,
      electionId: election.id,
      tiedCandidateIds: winnerResolution.tiedCandidateIds,
      seatCount: resolvedSeatCount,
    });

    return {
      outcome: 'runoff_required',
      winners: [],
      seatCount: resolvedSeatCount,
      tiedCandidateIds: winnerResolution.tiedCandidateIds,
    };
  }

  if (metadata) {
    for (const [index, roleId] of metadata.seatRoleIds.entries()) {
      const winner = winnerResolution.winners[index];
      if (!winner?.user_id) {
        continue;
      }

      await assignHolderToRole(tx, {
        roleId,
        userId: winner.user_id,
        updateRoleTerm: false,
      });
    }

    logElectionFlowServer('election-close-final-vote', 'delegate-seat-roles-synced', {
      correlationId: args.correlationId ?? null,
      electionId: election.id,
      seatRoleIds: metadata.seatRoleIds,
      assignedWinnerIds: winnerResolution.winners
        .map(winner => winner.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    });

    await syncConfirmedDelegatesFromSeatRoles(tx, {
      meta: metadata,
      assignedById: args.assignedById,
      correlationId: args.correlationId,
    });

    return {
      outcome: winnerResolution.winners.length > 0 ? 'applied' : 'no_winner',
      winners: winnerResolution.winners,
      seatCount: resolvedSeatCount,
      tiedCandidateIds: [],
    };
  }

  const winnerUserIds = [
    ...new Set(
      winnerResolution.winners
        .map(winner => winner.user_id)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];

  if (winnerUserIds.length === 0) {
    return {
      outcome: 'no_winner',
      winners: [],
      seatCount: resolvedSeatCount,
      tiedCandidateIds: [],
    };
  }

  await syncRoleHoldersForRole(tx, {
    roleId: election.role.id,
    userIds: winnerUserIds,
    updateRoleTerm: election.role.scope === 'group',
  });

  logElectionFlowServer('election-close-final-vote', 'role-holders-synced', {
    correlationId: args.correlationId ?? null,
    electionId: election.id,
    roleId: election.role.id,
    scope: election.role.scope ?? null,
    winnerUserIds,
  });

  if (election.role.scope === 'event' && election.role.event_id) {
    await syncUsersToEventRole(tx, {
      roleId: election.role.id,
      eventId: election.role.event_id,
      userIds: winnerUserIds,
      assignedById: args.assignedById,
    });

    logElectionFlowServer('election-close-final-vote', 'event-participants-synced', {
      correlationId: args.correlationId ?? null,
      electionId: election.id,
      eventId: election.role.event_id,
      roleId: election.role.id,
      winnerUserIds,
    });
  }

  return {
    outcome: 'applied',
    winners: winnerResolution.winners,
    seatCount: resolvedSeatCount,
    tiedCandidateIds: [],
  };
}

/** Server-only mutators — override shared mutators with additional server-side logic. */
export const electionServerMutators = {
  createElection: defineMutator(createElectionSchema, async ({ tx, ctx, args }) => {
    await mutators.elections.createElection.fn({ tx, ctx, args });

    const delegateAssignmentMeta = parseDelegateElectionMetadata(args.description);
    logElectionFlowServer(
      delegateAssignmentMeta ? 'delegate-assignment-create' : 'agenda-election-create',
      'create-election-confirmed',
      {
        correlationId: args.debug_correlation_id ?? null,
        electionId: args.id,
        agendaItemId: args.agenda_item_id ?? null,
        roleId: args.role_id ?? null,
        mode: args.election_mode ?? null,
        seatCount: args.seat_count ?? null,
        delegateAssignment: Boolean(delegateAssignmentMeta),
        targetEventId: delegateAssignmentMeta?.targetEventId ?? null,
      }
    );

    if (args.agenda_item_id) {
      const agendaItem = await tx.run(zql.agenda_item.where('id', args.agenda_item_id).one());
      if (agendaItem?.event_id) {
        await recomputeEventCounters(tx, agendaItem.event_id);
      }
    }
  }),

  addCandidate: defineMutator(createElectionCandidateSchema, async ({ tx, ctx, args }) => {
    if (args.user_id === ctx.userID) {
      await requireConfiguredRecentVotingPasswordVerification(tx, ctx.userID);
    }

    await mutators.elections.addCandidate.fn({ tx, ctx, args });

    const election = await tx.run(zql.election.where('id', args.election_id).one());
    if (!election?.agenda_item_id) {
      return;
    }

    const agendaItem = await tx.run(zql.agenda_item.where('id', election.agenda_item_id).one());
    if (!agendaItem?.event_id) {
      return;
    }

    const [eTitle, fallbackCandidateName] = await Promise.all([
      eventTitle(tx, agendaItem.event_id),
      userName(tx, args.user_id),
    ]);

    fireNotification('notifyCandidateAdded', {
      senderId: ctx.userID,
      eventId: agendaItem.event_id,
      eventTitle: eTitle,
      candidateName: args.name ?? fallbackCandidateName,
    });
  }),

  deleteCandidate: defineMutator(deleteElectionCandidateSchema, async ({ tx, ctx, args }) => {
    const candidate = await tx.run(zql.election_candidate.where('id', args.id).one());
    if (candidate?.user_id === ctx.userID) {
      await requireConfiguredRecentVotingPasswordVerification(tx, ctx.userID);
    }

    await mutators.elections.deleteCandidate.fn({ tx, ctx, args });
  }),

  updateElection: defineMutator(updateElectionSchema, async ({ tx, ctx, args }) => {
    const oldElection = await tx.run(zql.election.where('id', args.id).one());
    const isStartingFinalVote =
      oldElection &&
      !isFinalElectionVoteStatus(oldElection.status) &&
      isFinalElectionVoteStatus(args.status);
    const isClosingFinalVote =
      oldElection && oldElection.status !== 'closed' && args.status === 'closed';

    await mutators.elections.updateElection.fn({ tx, ctx, args });

    if (oldElection?.agenda_item_id) {
      const agendaItem = await tx.run(
        zql.agenda_item.where('id', oldElection.agenda_item_id).one()
      );
      if (agendaItem?.event_id) {
        await recomputeEventCounters(tx, agendaItem.event_id);

        if (isStartingFinalVote || isClosingFinalVote) {
          const eTitle = await eventTitle(tx, agendaItem.event_id);
          const electionTitle = args.title ?? oldElection.title ?? 'Election';

          if (isStartingFinalVote) {
            fireNotification('notifyElectionStarted', {
              senderId: ctx.userID,
              eventId: agendaItem.event_id,
              eventTitle: eTitle,
              electionTitle,
            });
          }

          if (isClosingFinalVote) {
            fireNotification('notifyElectionEnded', {
              senderId: ctx.userID,
              eventId: agendaItem.event_id,
              eventTitle: eTitle,
              electionTitle,
            });
          }
        }
      }
    }

    if (isClosingFinalVote && oldElection?.agenda_item_id) {
      const assignmentResult = await applyElectionAssignments(tx, {
        electionId: args.id,
        assignedById: ctx.userID,
        correlationId: args.debug_correlation_id ?? null,
      });

      const ai = await tx.run(zql.agenda_item.where('id', oldElection.agenda_item_id).one());
      if (ai?.event_id && assignmentResult.outcome !== 'runoff_required') {
        fireNotification('notifyElectionResult', {
          senderId: ctx.userID,
          eventId: ai.event_id,
          electionId: args.id,
        });
      }

      logElectionFlowServer('election-close-final-vote', 'close-election-finished', {
        correlationId: args.debug_correlation_id ?? null,
        electionId: args.id,
        agendaItemId: oldElection.agenda_item_id,
        outcome: assignmentResult.outcome,
        winnerUserIds: assignmentResult.winners
          .map(winner => winner.user_id)
          .filter((userId): userId is string => Boolean(userId)),
        seatCount: assignmentResult.seatCount,
        tiedCandidateIds: assignmentResult.tiedCandidateIds,
      });
    }
  }),
  castIndicativeElectionVote: defineMutator(
    createIndicativeElectorParticipationSchema,
    async ({ tx, ctx, args }) => {
      await requireRecentVotingPasswordVerification(tx, ctx.userID);
      await assertOnlineElectionVoteAllowed(tx, {
        electionId: args.election_id,
        userId: ctx.userID,
      });
      await mutators.elections.castIndicativeElectionVote.fn({ tx, ctx, args });
    }
  ),

  replaceIndicativeElectionVote: defineMutator(
    replaceIndicativeElectionVoteSchema,
    async ({ tx, ctx, args }) => {
      await requireRecentVotingPasswordVerification(tx, ctx.userID);
      await assertOnlineElectionVoteAllowed(tx, {
        electionId: args.participation.election_id,
        userId: ctx.userID,
      });
      await mutators.elections.replaceIndicativeElectionVote.fn({ tx, ctx, args });
    }
  ),

  castFinalElectionVote: defineMutator(
    createFinalElectorParticipationSchema,
    async ({ tx, ctx, args }) => {
      await requireRecentVotingPasswordVerification(tx, ctx.userID);
      await assertOnlineElectionVoteAllowed(tx, {
        electionId: args.election_id,
        userId: ctx.userID,
      });
      await mutators.elections.castFinalElectionVote.fn({ tx, ctx, args });
    }
  ),

  upsertOfflineTally: defineMutator(upsertElectionOfflineTallySchema, async ({ tx, ctx, args }) => {
    console.info('Server validation started', {
      flow: 'election-offline-tally-upsert',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      electionId: args.election_id,
      phase: args.phase,
      candidateId: args.candidate_id,
      count: args.count,
    });

    await requireRecentVotingPasswordVerification(tx, ctx.userID);
    await assertOfflineElectionTallyWithinCap(tx, {
      electionId: args.election_id,
      phase: args.phase,
      nextCandidateId: args.candidate_id,
      nextCount: args.count,
    });
    await mutators.elections.upsertOfflineTally.fn({ tx, ctx, args });

    console.info('Server successful', {
      flow: 'election-offline-tally-upsert',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      electionId: args.election_id,
      phase: args.phase,
      candidateId: args.candidate_id,
      count: args.count,
    });
  }),
};
