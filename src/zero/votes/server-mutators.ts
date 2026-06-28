import { defineMutator } from '@rocicorp/zero';
import {
  computeVoteResultSummary,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { mutators } from '../mutators';
import {
  eventAllowsOnlineVoting,
  getConfirmedOfflineAttendeeCount,
  getHybridOfflineOverrideUserIdsForEvent,
  isUserForcedOfflineForEvent,
} from '../offline-roster-helpers';
import { zql } from '../schema';
import {
  eventTitle,
  recomputeEventCounters,
  requireRecentVotingPasswordVerification,
} from '../server-helpers';
import { fireNotification } from '../server-notify';
import { resolveAmendmentProcessVote } from '../amendments/process-engine';
import { notifyProcessVoteResolution } from '../amendments/process-notifications';
import { finalizeInternalChangeRequestsForEventPhaseTransition } from '../change-requests/internal-voting';
import { discardPendingEventSuggestions } from '../change-requests/event-suggestions';
import { resolveChangeRequestByVoteResult } from '../change-requests/server-resolution';
import {
  createVoteSchema,
  updateVoteSchema,
  closeExpiredFinalVotesForEventSchema,
  createIndicativeVoterParticipationSchema,
  replaceIndicativeVoteSchema,
  createFinalVoterParticipationSchema,
  createFinalChoiceDecisionSchema,
  castFinalVoteFullSchema,
  upsertVoteOfflineTallySchema,
} from './schema';
import { VOTE_PHASE, isFinalVotePhase, VOTE_PURPOSE, normalizeVotePhase } from './vote-workflow';

async function loadVoteEventId(
  tx: Parameters<typeof mutators.votes.createVote.fn>[0]['tx'],
  voteId: string
) {
  const vote = await tx.run(zql.vote.where('id', voteId).one());
  if (!vote?.agenda_item_id) {
    return null;
  }

  const agendaItem = await tx.run(zql.agenda_item.where('id', vote.agenda_item_id).one());
  return agendaItem?.event_id ?? null;
}

async function assertOnlineVoteAllowed(
  tx: Parameters<typeof mutators.votes.createVote.fn>[0]['tx'],
  args: {
    voteId: string;
    userId: string;
  }
) {
  const eventId = await loadVoteEventId(tx, args.voteId);
  if (!eventId) {
    return;
  }

  const [onlineVotingAllowed, forcedOffline] = await Promise.all([
    eventAllowsOnlineVoting(tx, eventId),
    isUserForcedOfflineForEvent(tx, eventId, args.userId),
  ]);
  if (!onlineVotingAllowed || forcedOffline) {
    throw new Error('This vote must be entered via the offline tally flow for this participant.');
  }
}

async function assertOfflineVoteTallyWithinCap(
  tx: Parameters<typeof mutators.votes.createVote.fn>[0]['tx'],
  args: {
    voteId: string;
    phase: 'indicative' | 'final';
    nextChoiceId: string;
    nextCount: number;
  }
) {
  const eventId = await loadVoteEventId(tx, args.voteId);
  if (!eventId) {
    throw new Error('Vote is not linked to an event.');
  }

  const confirmedOfflineAttendeeCount = await getConfirmedOfflineAttendeeCount(tx, eventId);
  const existingTallies = await tx.run(zql.vote_offline_tally.where('vote_id', args.voteId));
  const hasMatchingChoice = existingTallies.some(
    tally => tally.phase === args.phase && tally.choice_id === args.nextChoiceId
  );
  const totalCount =
    existingTallies.reduce((sum, tally) => {
      if (tally.phase !== args.phase) {
        return sum;
      }

      return sum + (tally.choice_id === args.nextChoiceId ? args.nextCount : tally.count);
    }, 0) + (hasMatchingChoice ? 0 : args.nextCount);

  if (totalCount > confirmedOfflineAttendeeCount) {
    throw new Error('Offline vote totals cannot exceed the number of confirmed offline attendees.');
  }
}

type VoteTx = Parameters<typeof mutators.votes.updateVote.fn>[0]['tx'];
type VoteCtx = Parameters<typeof mutators.votes.updateVote.fn>[0]['ctx'];

function isFinalizingVoteStatus(status?: string | null) {
  return isFinalVotePhase(status) || normalizeVotePhase(status) === VOTE_PHASE.closed;
}

interface VoteContext {
  isChangeRequestVote: boolean;
  isFinalChangeRequestVote: boolean;
}

const ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];

function participantHasActiveVotingRight(
  participant: {
    participant_roles?: readonly {
      role?: {
        action_rights?: readonly {
          action?: string | null;
          resource?: string | null;
          event_id?: string | null;
        }[];
      } | null;
    }[];
  },
  eventId: string
) {
  return (
    participant.participant_roles?.some(participantRole =>
      participantRole.role?.action_rights?.some(
        right =>
          right.action === 'active_voting' &&
          right.resource === 'events' &&
          right.event_id === eventId
      )
    ) ?? false
  );
}

function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

function normalizeChoiceLabel(label?: string | null) {
  return label?.trim().toLowerCase() ?? null;
}

function isAcceptChoice(label?: string | null) {
  const normalized = normalizeChoiceLabel(label);
  return normalized === 'accept' || normalized === 'yes';
}

function isRejectChoice(label?: string | null) {
  const normalized = normalizeChoiceLabel(label);
  return normalized === 'reject' || normalized === 'no';
}

async function assertCurrentCRVoteOrder(
  tx: VoteTx,
  agendaItemChangeRequest: {
    id: string;
    agenda_item_id: string;
    is_closing_vote: boolean;
  }
) {
  if (agendaItemChangeRequest.is_closing_vote) {
    return;
  }

  const timelineResult = await tx.run(
    zql.agenda_item_change_request
      .where('agenda_item_id', agendaItemChangeRequest.agenda_item_id)
      .orderBy('order_index', 'asc')
  );
  const timeline = Array.isArray(timelineResult) ? timelineResult : [];
  const firstIncomplete = timeline.find(
    item => !item.is_closing_vote && item.status !== 'completed'
  );

  if (firstIncomplete?.id && firstIncomplete.id !== agendaItemChangeRequest.id) {
    throw new Error('Change requests must be voted in their configured order.');
  }
}

async function findProcessBranchIdForAgendaItem(tx: VoteTx, agendaItemId: string) {
  const stepRun = await tx.run(
    zql.amendment_process_step_run.where('agenda_item_id', agendaItemId).one()
  );

  return stepRun?.branch_id ?? null;
}

async function findProcessBranchIdsForVote(
  tx: VoteTx,
  vote: {
    id: string;
    agenda_item_id?: string | null;
  }
) {
  const branchIds = new Set<string>();
  const timelineLink = await tx.run(zql.agenda_item_change_request.where('vote_id', vote.id).one());
  if (timelineLink?.process_branch_id) {
    branchIds.add(timelineLink.process_branch_id);
  }

  const choicesResult = await tx.run(zql.vote_choice.where('vote_id', vote.id));
  const choices = Array.isArray(choicesResult) ? choicesResult : [];
  for (const choice of choices) {
    if (choice.process_branch_id) {
      branchIds.add(choice.process_branch_id);
    }
  }

  if (branchIds.size === 0 && vote.agenda_item_id) {
    const stepRunsResult = await tx.run(
      zql.amendment_process_step_run.where('agenda_item_id', vote.agenda_item_id)
    );
    const stepRuns = Array.isArray(stepRunsResult) ? stepRunsResult : [];
    for (const stepRun of stepRuns) {
      if (stepRun.branch_id) {
        branchIds.add(stepRun.branch_id);
      }
    }
  }

  return [...branchIds];
}

async function assertNoOpenChangeRequestsBeforeFinalVote(
  tx: VoteTx,
  vote: {
    id: string;
    agenda_item_id?: string | null;
    amendment_id?: string | null;
    purpose?: string | null;
  }
) {
  if (!vote.agenda_item_id) {
    return { isChangeRequestVote: false, isFinalChangeRequestVote: false };
  }

  const agendaVotesResult = await tx.run(zql.vote.where('agenda_item_id', vote.agenda_item_id));
  const agendaVotes = Array.isArray(agendaVotesResult) ? agendaVotesResult : [];
  const activeOtherFinalVote = agendaVotes.find(
    agendaVote => agendaVote.id !== vote.id && isFinalVotePhase(agendaVote.status)
  );
  if (activeOtherFinalVote) {
    throw new Error('Another final vote is already active for this agenda item.');
  }

  if (vote.purpose === VOTE_PURPOSE.changeRequest || vote.purpose === VOTE_PURPOSE.closing) {
    const variantVotes = agendaVotes.filter(
      variantVote => variantVote.purpose === VOTE_PURPOSE.mergeVariant
    );
    const openVariantVote = variantVotes.find(
      variantVote =>
        variantVote.id !== vote.id && normalizeVotePhase(variantVote.status) !== VOTE_PHASE.closed
    );
    if (openVariantVote) {
      throw new Error('Variant final vote must be completed before change request voting starts.');
    }
  }

  const timelineLink = await tx.run(zql.agenda_item_change_request.where('vote_id', vote.id).one());

  if (timelineLink) {
    await assertCurrentCRVoteOrder(tx, timelineLink);
    return {
      isChangeRequestVote: true,
      isFinalChangeRequestVote: Boolean(timelineLink.is_closing_vote),
    };
  }

  const stepRunsResult = await tx.run(
    zql.amendment_process_step_run.where('agenda_item_id', vote.agenda_item_id)
  );
  const stepRuns = Array.isArray(stepRunsResult) ? stepRunsResult : [];
  if (
    vote.purpose !== VOTE_PURPOSE.closing &&
    stepRuns.some(step => step.step_kind === 'merge_vote')
  ) {
    return { isChangeRequestVote: false, isFinalChangeRequestVote: false };
  }

  const pendingTimelineItemsResult = await tx.run(
    zql.agenda_item_change_request.where('agenda_item_id', vote.agenda_item_id)
  );
  const pendingTimelineItems = Array.isArray(pendingTimelineItemsResult)
    ? pendingTimelineItemsResult
    : [];
  const hasIncompleteTimelineItem = pendingTimelineItems.some(
    item => !item.is_closing_vote && item.status !== 'completed'
  );
  if (hasIncompleteTimelineItem) {
    throw new Error('All change request votes must be completed before the final vote.');
  }

  if (vote.amendment_id) {
    const branchId = await findProcessBranchIdForAgendaItem(tx, vote.agenda_item_id);
    const allOpenChangeRequestsResult = await tx.run(
      zql.change_request.where('amendment_id', vote.amendment_id).where('status', 'open')
    );
    const allOpenChangeRequests = Array.isArray(allOpenChangeRequestsResult)
      ? allOpenChangeRequestsResult
      : [];
    const openChangeRequests = allOpenChangeRequests.filter(changeRequest =>
      branchId ? changeRequest.process_branch_id === branchId : !changeRequest.process_branch_id
    );
    if (openChangeRequests.length > 0) {
      throw new Error('All open change requests must be voted before the final vote.');
    }
  }

  return { isChangeRequestVote: false, isFinalChangeRequestVote: false };
}

async function loadVoteContext(
  tx: VoteTx,
  vote: {
    id: string;
    agenda_item_id?: string | null;
  }
) {
  if (!vote.agenda_item_id) {
    return { isChangeRequestVote: false, isFinalChangeRequestVote: false };
  }

  const timelineLink = await tx.run(zql.agenda_item_change_request.where('vote_id', vote.id).one());
  return {
    isChangeRequestVote: Boolean(timelineLink),
    isFinalChangeRequestVote: Boolean(timelineLink?.is_closing_vote),
  };
}

async function loadEligibleFinalVoteCounts(
  tx: VoteTx,
  vote: {
    id: string;
    agenda_item_id?: string | null;
  }
) {
  if (!vote.agenda_item_id) {
    return { eligibleFinalVoterCount: 0, recordedFinalVoteCount: 0 };
  }

  const agendaItem = await tx.run(zql.agenda_item.where('id', vote.agenda_item_id).one());
  if (!agendaItem?.event_id) {
    return { eligibleFinalVoterCount: 0, recordedFinalVoteCount: 0 };
  }

  const eventId = agendaItem.event_id;
  const [
    participants,
    forcedOfflineUserIds,
    confirmedOfflineAttendeeCount,
    voters,
    finalParticipations,
    offlineTallies,
  ] = await Promise.all([
    tx.run(
      zql.event_participant
        .where('event_id', eventId)
        .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
        .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
    ),
    getHybridOfflineOverrideUserIdsForEvent(tx, eventId),
    getConfirmedOfflineAttendeeCount(tx, eventId),
    tx.run(zql.voter.where('vote_id', vote.id)),
    tx.run(zql.final_voter_participation.where('vote_id', vote.id)),
    tx.run(zql.vote_offline_tally.where('vote_id', vote.id)),
  ]);

  const eligibleOnlineUserIds = new Set<string>();
  for (const participant of participants) {
    if (
      participant.user_id &&
      !forcedOfflineUserIds.has(participant.user_id) &&
      participantHasActiveVotingRight(participant, eventId)
    ) {
      eligibleOnlineUserIds.add(participant.user_id);
    }
  }

  const voterUserIdById = new Map(
    voters
      .filter(voter => Boolean(voter.id && voter.user_id))
      .map(voter => [voter.id, voter.user_id] as const)
  );
  const recordedOnlineUserIds = new Set<string>();
  for (const participation of finalParticipations) {
    const userId = voterUserIdById.get(participation.voter_id);
    if (userId && eligibleOnlineUserIds.has(userId)) {
      recordedOnlineUserIds.add(userId);
    }
  }

  const offlineFinalCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'final' ? sum + Math.max(0, tally.count ?? 0) : sum),
    0
  );

  return {
    eligibleFinalVoterCount: eligibleOnlineUserIds.size + confirmedOfflineAttendeeCount,
    recordedFinalVoteCount: recordedOnlineUserIds.size + offlineFinalCount,
  };
}

async function syncAgendaItemClosedForAgendaVote(
  tx: VoteTx,
  vote: {
    agenda_item_id?: string | null;
  },
  voteContext: VoteContext,
  now: number
) {
  if (!vote.agenda_item_id || voteContext.isChangeRequestVote) {
    return;
  }

  await tx.mutate.agenda_item.update({
    id: vote.agenda_item_id,
    voting_phase: 'closed',
    updated_at: now,
  });
}

async function maybeCloseVoteWhenAllFinalVotersVoted(tx: VoteTx, ctx: VoteCtx, voteId: string) {
  const vote = await tx.run(zql.vote.where('id', voteId).one());
  if (!vote || !isFinalVotePhase(vote.status)) {
    return;
  }

  const { eligibleFinalVoterCount, recordedFinalVoteCount } = await loadEligibleFinalVoteCounts(
    tx,
    vote
  );

  if (eligibleFinalVoterCount > 0 && recordedFinalVoteCount >= eligibleFinalVoterCount) {
    await voteServerMutators.updateVote.fn({
      tx,
      ctx,
      args: {
        id: voteId,
        status: 'closed',
        closed_reason: 'all_voters',
        closed_at: Date.now(),
        closed_by_id: ctx.userID,
      },
    });
  }
}

async function syncVoteEventEditingMode(
  tx: VoteTx,
  ctx: { readonly userID: string },
  amendmentId: string | null | undefined,
  processBranchIds: readonly string[],
  editingMode: 'suggest_event' | 'event_final_closing_vote'
) {
  if (!amendmentId || processBranchIds.length === 0) {
    return;
  }

  for (const processBranchId of [...new Set(processBranchIds)]) {
    const branch = await tx.run(zql.amendment_process_branch.where('id', processBranchId).one());
    if (!branch || branch.editing_mode === 'passed' || branch.editing_mode === 'rejected') {
      continue;
    }

    if (editingMode === 'event_final_closing_vote') {
      await discardPendingEventSuggestions({
        tx,
        ctx,
        amendmentId,
        processBranchId: branch.id,
        now: Date.now(),
      });
    }

    if (branch.editing_mode === editingMode) {
      continue;
    }

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx,
      ctx,
      amendmentId,
      processBranchId: branch.id,
      now: Date.now(),
    });

    await tx.mutate.amendment_process_branch.update({
      id: branch.id,
      editing_mode: editingMode,
      updated_at: Date.now(),
    });
  }
}

function shouldReturnEventVoteToSuggesting(
  vote: {
    agenda_item_id?: string | null;
    amendment_id?: string | null;
    purpose?: string | null;
  },
  voteContext: VoteContext
) {
  if (!vote.agenda_item_id || !vote.amendment_id) {
    return false;
  }

  if (vote.purpose === VOTE_PURPOSE.closing || voteContext.isFinalChangeRequestVote) {
    return false;
  }

  return (
    vote.purpose === VOTE_PURPOSE.mergeVariant ||
    vote.purpose === VOTE_PURPOSE.changeRequest ||
    voteContext.isChangeRequestVote
  );
}

async function summarizeFinalVoteResult(
  tx: VoteTx,
  vote: {
    id: string;
    majority_type?: string | null;
  }
): Promise<{ result: VoteResult; acceptVotes: number; rejectVotes: number }> {
  const [choices, finalDecisions, voters, offlineTallies] = await Promise.all([
    tx.run(zql.vote_choice.where('vote_id', vote.id)),
    tx.run(zql.final_choice_decision.where('vote_id', vote.id)),
    tx.run(zql.voter.where('vote_id', vote.id)),
    tx.run(zql.vote_offline_tally.where('vote_id', vote.id)),
  ]);

  const sortedChoices = [...choices].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const acceptChoice = choices.find(choice => isAcceptChoice(choice.label)) ?? sortedChoices[0];
  const rejectChoice = choices.find(choice => isRejectChoice(choice.label)) ?? sortedChoices[1];
  const offlineFinalCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'final' ? sum + (tally.count ?? 0) : sum),
    0
  );
  const summary = computeVoteResultSummary(
    sortedChoices.map((choice, index) => ({
      id: choice.id,
      label: choice.label ?? `Choice ${index + 1}`,
      order_index: choice.order_index ?? index,
    })),
    finalDecisions
      .map(decision => ({ choice_id: decision.choice_id ?? '' }))
      .filter(decision => Boolean(decision.choice_id)),
    Math.max(voters.length, finalDecisions.length + offlineFinalCount),
    normalizeMajorityType(vote.majority_type),
    offlineTallies
  );

  return {
    result: summary.result,
    acceptVotes: acceptChoice
      ? (summary.choiceTallies.find(tally => tally.choiceId === acceptChoice.id)?.count ?? 0)
      : 0,
    rejectVotes: rejectChoice
      ? (summary.choiceTallies.find(tally => tally.choiceId === rejectChoice.id)?.count ?? 0)
      : 0,
  };
}

async function materializeFinalVoteTiming<
  TArgs extends {
    closing_duration_seconds?: number | null;
    closing_end_time?: number | null;
  },
>(
  tx: VoteTx,
  vote: {
    agenda_item_id?: string | null;
    closing_duration_seconds?: number | null;
  },
  args: TArgs
) {
  if (args.closing_end_time !== undefined) {
    return args;
  }

  let durationSeconds =
    typeof args.closing_duration_seconds === 'number'
      ? args.closing_duration_seconds
      : (vote.closing_duration_seconds ?? null);

  if (!durationSeconds && vote.agenda_item_id) {
    const agendaItem = await tx.run(zql.agenda_item.where('id', vote.agenda_item_id).one());
    if (agendaItem?.event_id) {
      const event = await tx.run(zql.event.where('id', agendaItem.event_id).one());
      durationSeconds = event?.default_final_vote_duration_seconds ?? null;
    }
  }

  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return args;
  }

  return {
    ...args,
    closing_duration_seconds: Math.floor(durationSeconds),
    closing_end_time: Date.now() + Math.floor(durationSeconds) * 1000,
  };
}

async function markTimelineVoteResult(
  tx: VoteTx,
  ctx: VoteCtx,
  vote: {
    id: string;
  },
  voteResult: VoteResult,
  now: number
) {
  const timelineLink = await tx.run(zql.agenda_item_change_request.where('vote_id', vote.id).one());
  if (!timelineLink) {
    return null;
  }

  if (voteResult === 'tie') {
    await tx.mutate.agenda_item_change_request.update({
      id: timelineLink.id,
      status: 'blocked_tie',
      blocked_reason: 'tie',
      result_status: voteResult,
      updated_at: now,
    });
    return timelineLink;
  }

  if (timelineLink.change_request_id) {
    await resolveChangeRequestByVoteResult({
      tx,
      ctx,
      changeRequestId: timelineLink.change_request_id,
      voteResult,
      now,
    });
  }

  await tx.mutate.agenda_item_change_request.update({
    id: timelineLink.id,
    status: 'completed',
    result_status: voteResult,
    updated_at: now,
  });

  return timelineLink;
}

async function closeExpiredFinalVote(
  tx: VoteTx,
  ctx: VoteCtx,
  vote: {
    id: string;
    agenda_item_id?: string | null;
    amendment_id?: string | null;
    title?: string | null;
    status?: string | null;
    purpose?: string | null;
    majority_type?: string | null;
  },
  now: number
) {
  const voteContext = await loadVoteContext(tx, vote);
  const summary = await summarizeFinalVoteResult(tx, vote);

  await tx.mutate.vote.update({
    id: vote.id,
    status: VOTE_PHASE.closed,
    closed_reason: 'time_elapsed',
    closed_at: now,
    closed_by_id: null,
    updated_at: now,
  });

  await markTimelineVoteResult(tx, ctx, vote, summary.result, now);
  await syncAgendaItemClosedForAgendaVote(tx, vote, voteContext, now);

  const shouldResolveProcessVote = Boolean(
    vote.agenda_item_id &&
    (!voteContext.isChangeRequestVote ||
      voteContext.isFinalChangeRequestVote ||
      vote.purpose === VOTE_PURPOSE.closing)
  );

  if (shouldResolveProcessVote && vote.agenda_item_id) {
    const resolution = await resolveAmendmentProcessVote(
      tx,
      {
        agenda_item_id: vote.agenda_item_id,
      },
      ctx.userID
    );
    await notifyProcessVoteResolution(tx, ctx.userID, vote.agenda_item_id, resolution);
  }

  if (summary.result !== 'tie' && shouldReturnEventVoteToSuggesting(vote, voteContext)) {
    await syncVoteEventEditingMode(
      tx,
      ctx,
      vote.amendment_id,
      await findProcessBranchIdsForVote(tx, vote),
      'suggest_event'
    );
  }

  if (vote.agenda_item_id) {
    const agendaItem = await tx.run(zql.agenda_item.where('id', vote.agenda_item_id).one());
    if (agendaItem?.event_id) {
      await recomputeEventCounters(tx, agendaItem.event_id);

      if (!voteContext.isChangeRequestVote || voteContext.isFinalChangeRequestVote) {
        const eTitle = await eventTitle(tx, agendaItem.event_id);
        fireNotification('notifyVotingCompleted', {
          senderId: ctx.userID,
          eventId: agendaItem.event_id,
          eventTitle: eTitle,
          agendaItemTitle: agendaItem.title ?? vote.title ?? 'Agenda item',
          result: summary.result,
          acceptVotes: summary.acceptVotes,
          rejectVotes: summary.rejectVotes,
        });
      }
    }
  }
}

/** Server-only mutators — override shared mutators with additional server-side logic. */
export const voteServerMutators = {
  createVote: defineMutator(createVoteSchema, async ({ tx, ctx, args }) => {
    await mutators.votes.createVote.fn({ tx, ctx, args });

    if (args.agenda_item_id) {
      const agendaItem = await tx.run(zql.agenda_item.where('id', args.agenda_item_id).one());
      if (agendaItem?.event_id) {
        await recomputeEventCounters(tx, agendaItem.event_id);
      }
    }
  }),

  updateVote: defineMutator(updateVoteSchema, async ({ tx, ctx, args }) => {
    const oldVote = await tx.run(zql.vote.where('id', args.id).one());
    const normalizedArgs =
      oldVote && isFinalVotePhase(args.status)
        ? await materializeFinalVoteTiming(tx, oldVote, {
            ...args,
            status: VOTE_PHASE.final,
          })
        : {
            ...args,
            ...(args.status !== undefined ? { status: normalizeVotePhase(args.status) } : {}),
          };
    const isStartingFinalVote =
      oldVote && !isFinalVotePhase(oldVote.status) && isFinalVotePhase(normalizedArgs.status);
    const isClosingFinalVote =
      oldVote &&
      isFinalVotePhase(oldVote.status) &&
      normalizeVotePhase(normalizedArgs.status) === VOTE_PHASE.closed;
    const startingTimelineLink =
      isStartingFinalVote && oldVote?.agenda_item_id
        ? await tx.run(zql.agenda_item_change_request.where('vote_id', oldVote.id).one())
        : null;
    const isStartingFinalClosingVote = Boolean(
      isStartingFinalVote &&
      oldVote &&
      (oldVote.purpose === VOTE_PURPOSE.closing || startingTimelineLink?.is_closing_vote)
    );
    let oldVoteProcessBranchIds: string[] | null = null;
    const getOldVoteProcessBranchIds = async () => {
      if (!oldVote) return [];
      oldVoteProcessBranchIds ??= await findProcessBranchIdsForVote(tx, oldVote);
      return oldVoteProcessBranchIds;
    };

    if (isStartingFinalClosingVote && oldVote?.amendment_id) {
      for (const processBranchId of await getOldVoteProcessBranchIds()) {
        await discardPendingEventSuggestions({
          tx,
          ctx,
          amendmentId: oldVote.amendment_id,
          processBranchId,
          now: Date.now(),
        });
      }
    }

    const voteContext =
      oldVote &&
      !isFinalizingVoteStatus(oldVote.status) &&
      isFinalizingVoteStatus(normalizedArgs.status)
        ? await assertNoOpenChangeRequestsBeforeFinalVote(tx, oldVote)
        : oldVote && isClosingFinalVote
          ? await loadVoteContext(tx, oldVote)
          : { isChangeRequestVote: false, isFinalChangeRequestVote: false };

    await mutators.votes.updateVote.fn({ tx, ctx, args: normalizedArgs });

    const closedFinalVoteSummary =
      oldVote && isClosingFinalVote ? await summarizeFinalVoteResult(tx, oldVote) : null;

    if (oldVote && closedFinalVoteSummary) {
      const now = Date.now();
      await markTimelineVoteResult(tx, ctx, oldVote, closedFinalVoteSummary.result, now);
      await syncAgendaItemClosedForAgendaVote(tx, oldVote, voteContext, now);
    }

    if (isStartingFinalClosingVote && oldVote) {
      await syncVoteEventEditingMode(
        tx,
        ctx,
        oldVote.amendment_id,
        await getOldVoteProcessBranchIds(),
        'event_final_closing_vote'
      );
    }

    if (
      (!voteContext.isChangeRequestVote ||
        voteContext.isFinalChangeRequestVote ||
        (oldVote && oldVote.purpose === VOTE_PURPOSE.closing)) &&
      oldVote?.status !== 'closed' &&
      normalizeVotePhase(normalizedArgs.status) === VOTE_PHASE.closed &&
      oldVote?.agenda_item_id
    ) {
      const resolution = await resolveAmendmentProcessVote(
        tx,
        {
          agenda_item_id: oldVote.agenda_item_id,
        },
        ctx.userID
      );
      await notifyProcessVoteResolution(tx, ctx.userID, oldVote.agenda_item_id, resolution);
    }

    if (
      oldVote &&
      oldVote?.status !== 'closed' &&
      normalizeVotePhase(normalizedArgs.status) === VOTE_PHASE.closed &&
      closedFinalVoteSummary?.result !== 'tie' &&
      shouldReturnEventVoteToSuggesting(oldVote, voteContext)
    ) {
      await syncVoteEventEditingMode(
        tx,
        ctx,
        oldVote.amendment_id,
        await getOldVoteProcessBranchIds(),
        'suggest_event'
      );
    }

    if (oldVote?.agenda_item_id) {
      const agendaItem = await tx.run(zql.agenda_item.where('id', oldVote.agenda_item_id).one());
      if (agendaItem?.event_id) {
        await recomputeEventCounters(tx, agendaItem.event_id);

        const shouldNotifyFinalVote =
          !voteContext.isChangeRequestVote ||
          voteContext.isFinalChangeRequestVote ||
          (oldVote && oldVote.purpose === VOTE_PURPOSE.closing);

        if (shouldNotifyFinalVote && (isStartingFinalVote || isClosingFinalVote)) {
          const eTitle = await eventTitle(tx, agendaItem.event_id);
          const agendaItemTitle = agendaItem.title ?? oldVote.title ?? 'Agenda item';

          if (isStartingFinalVote) {
            fireNotification('notifyVotingPhaseStarted', {
              senderId: ctx.userID,
              eventId: agendaItem.event_id,
              eventTitle: eTitle,
              agendaItemTitle,
              votingType: 'final',
            });
          }

          if (isClosingFinalVote) {
            fireNotification('notifyVotingCompleted', {
              senderId: ctx.userID,
              eventId: agendaItem.event_id,
              eventTitle: eTitle,
              agendaItemTitle,
              result: closedFinalVoteSummary?.result ?? 'tie',
              acceptVotes: closedFinalVoteSummary?.acceptVotes ?? 0,
              rejectVotes: closedFinalVoteSummary?.rejectVotes ?? 0,
            });
          }
        }
      }
    }
  }),

  closeExpiredFinalVotesForEvent: defineMutator(
    closeExpiredFinalVotesForEventSchema,
    async ({ tx, ctx, args }) => {
      const now = Date.now();
      const agendaItems = await tx.run(zql.agenda_item.where('event_id', args.event_id));

      for (const agendaItem of agendaItems) {
        const votes = await tx.run(zql.vote.where('agenda_item_id', agendaItem.id));
        for (const vote of votes) {
          if (!isFinalVotePhase(vote.status)) {
            continue;
          }
          if (!vote.closing_end_time || vote.closing_end_time > now) {
            continue;
          }

          await closeExpiredFinalVote(tx, ctx, vote, now);
        }
      }

      await recomputeEventCounters(tx, args.event_id);
    }
  ),

  castIndicativeVote: defineMutator(
    createIndicativeVoterParticipationSchema,
    async ({ tx, ctx, args }) => {
      await requireRecentVotingPasswordVerification(tx, ctx.userID);
      await assertOnlineVoteAllowed(tx, { voteId: args.vote_id, userId: ctx.userID });
      await mutators.votes.castIndicativeVote.fn({ tx, ctx, args });
    }
  ),

  replaceIndicativeVote: defineMutator(replaceIndicativeVoteSchema, async ({ tx, ctx, args }) => {
    await requireRecentVotingPasswordVerification(tx, ctx.userID);
    await assertOnlineVoteAllowed(tx, {
      voteId: args.participation.vote_id,
      userId: ctx.userID,
    });
    await mutators.votes.replaceIndicativeVote.fn({ tx, ctx, args });
  }),

  castFinalVote: defineMutator(createFinalVoterParticipationSchema, async ({ tx, ctx, args }) => {
    await requireRecentVotingPasswordVerification(tx, ctx.userID);
    await assertOnlineVoteAllowed(tx, { voteId: args.vote_id, userId: ctx.userID });
    await mutators.votes.castFinalVote.fn({ tx, ctx, args });
  }),

  createFinalChoiceDecision: defineMutator(
    createFinalChoiceDecisionSchema,
    async ({ tx, ctx, args }) => {
      await requireRecentVotingPasswordVerification(tx, ctx.userID);
      await assertOnlineVoteAllowed(tx, { voteId: args.vote_id, userId: ctx.userID });
      await mutators.votes.createFinalChoiceDecision.fn({ tx, ctx, args });
      await maybeCloseVoteWhenAllFinalVotersVoted(tx, ctx, args.vote_id);
    }
  ),

  castFinalVoteFull: defineMutator(castFinalVoteFullSchema, async ({ tx, ctx, args }) => {
    await requireRecentVotingPasswordVerification(tx, ctx.userID);
    await assertOnlineVoteAllowed(tx, {
      voteId: args.participation.vote_id,
      userId: ctx.userID,
    });
    await mutators.votes.castFinalVoteFull.fn({ tx, ctx, args });
    await maybeCloseVoteWhenAllFinalVotersVoted(tx, ctx, args.participation.vote_id);
  }),

  upsertOfflineTally: defineMutator(upsertVoteOfflineTallySchema, async ({ tx, ctx, args }) => {
    await assertOfflineVoteTallyWithinCap(tx, {
      voteId: args.vote_id,
      phase: args.phase,
      nextChoiceId: args.choice_id,
      nextCount: args.count,
    });
    await mutators.votes.upsertOfflineTally.fn({ tx, ctx, args });
    if (args.phase === 'final') {
      await maybeCloseVoteWhenAllFinalVotersVoted(tx, ctx, args.vote_id);
    }
  }),
};
