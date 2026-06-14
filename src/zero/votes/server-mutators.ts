import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import {
  eventAllowsOnlineVoting,
  getConfirmedOfflineAttendeeCount,
  isUserForcedOfflineForEvent,
} from '../offline-roster-helpers';
import { zql } from '../schema';
import { recomputeEventCounters, requireRecentVotingPasswordVerification } from '../server-helpers';
import { resolveAmendmentProcessVote } from '../amendments/process-engine';
import { notifyProcessVoteResolution } from '../amendments/process-notifications';
import {
  createVoteSchema,
  updateVoteSchema,
  createIndicativeVoterParticipationSchema,
  createFinalVoterParticipationSchema,
  upsertVoteOfflineTallySchema,
} from './schema';

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

function isFinalizingVoteStatus(status?: string | null) {
  return status === 'final' || status === 'final_vote' || status === 'closed';
}

async function assertCurrentCRVoteOrder(
  tx: VoteTx,
  agendaItemChangeRequest: {
    id: string;
    agenda_item_id: string;
    is_final_vote: boolean;
  }
) {
  if (agendaItemChangeRequest.is_final_vote) {
    return;
  }

  const timeline = await tx.run(
    zql.agenda_item_change_request
      .where('agenda_item_id', agendaItemChangeRequest.agenda_item_id)
      .orderBy('order_index', 'asc')
  );
  const firstIncomplete = timeline.find(item => !item.is_final_vote && item.status !== 'completed');

  if (firstIncomplete?.id && firstIncomplete.id !== agendaItemChangeRequest.id) {
    throw new Error('Change requests must be voted in their configured order.');
  }
}

async function assertNoOpenChangeRequestsBeforeFinalVote(
  tx: VoteTx,
  vote: {
    id: string;
    agenda_item_id?: string | null;
    amendment_id?: string | null;
  }
) {
  if (!vote.agenda_item_id) {
    return { isChangeRequestVote: false };
  }

  const timelineLink = await tx.run(zql.agenda_item_change_request.where('vote_id', vote.id).one());

  if (timelineLink) {
    await assertCurrentCRVoteOrder(tx, timelineLink);
    return { isChangeRequestVote: true };
  }

  const stepRuns = await tx.run(
    zql.amendment_process_step_run.where('agenda_item_id', vote.agenda_item_id)
  );
  if (stepRuns.some(step => step.step_kind === 'merge_vote')) {
    return { isChangeRequestVote: false };
  }

  const pendingTimelineItems = await tx.run(
    zql.agenda_item_change_request.where('agenda_item_id', vote.agenda_item_id)
  );
  const hasIncompleteTimelineItem = pendingTimelineItems.some(
    item => !item.is_final_vote && item.status !== 'completed'
  );
  if (hasIncompleteTimelineItem) {
    throw new Error('All change request votes must be completed before the final vote.');
  }

  if (vote.amendment_id) {
    const openChangeRequests = await tx.run(
      zql.change_request.where('amendment_id', vote.amendment_id).where('status', 'open')
    );
    if (openChangeRequests.length > 0) {
      throw new Error('All open change requests must be voted before the final vote.');
    }
  }

  return { isChangeRequestVote: false };
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
    const voteContext =
      oldVote && !isFinalizingVoteStatus(oldVote.status) && isFinalizingVoteStatus(args.status)
        ? await assertNoOpenChangeRequestsBeforeFinalVote(tx, oldVote)
        : { isChangeRequestVote: false };

    await mutators.votes.updateVote.fn({ tx, ctx, args });

    if (
      !voteContext.isChangeRequestVote &&
      oldVote?.status !== 'closed' &&
      args.status === 'closed' &&
      oldVote?.agenda_item_id
    ) {
      const resolution = await resolveAmendmentProcessVote(tx, {
        agenda_item_id: oldVote.agenda_item_id,
      });
      await notifyProcessVoteResolution(tx, ctx.userID, oldVote.agenda_item_id, resolution);
    }

    if (oldVote?.agenda_item_id) {
      const agendaItem = await tx.run(zql.agenda_item.where('id', oldVote.agenda_item_id).one());
      if (agendaItem?.event_id) {
        await recomputeEventCounters(tx, agendaItem.event_id);
      }
    }
  }),

  castIndicativeVote: defineMutator(
    createIndicativeVoterParticipationSchema,
    async ({ tx, ctx, args }) => {
      await requireRecentVotingPasswordVerification(tx, ctx.userID);
      await assertOnlineVoteAllowed(tx, { voteId: args.vote_id, userId: ctx.userID });
      await mutators.votes.castIndicativeVote.fn({ tx, ctx, args });
    }
  ),

  castFinalVote: defineMutator(createFinalVoterParticipationSchema, async ({ tx, ctx, args }) => {
    await requireRecentVotingPasswordVerification(tx, ctx.userID);
    await assertOnlineVoteAllowed(tx, { voteId: args.vote_id, userId: ctx.userID });
    await mutators.votes.castFinalVote.fn({ tx, ctx, args });
  }),

  upsertOfflineTally: defineMutator(upsertVoteOfflineTallySchema, async ({ tx, ctx, args }) => {
    console.info('Server validation started', {
      flow: 'vote-offline-tally-upsert',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      voteId: args.vote_id,
      phase: args.phase,
      choiceId: args.choice_id,
      count: args.count,
    });

    await assertOfflineVoteTallyWithinCap(tx, {
      voteId: args.vote_id,
      phase: args.phase,
      nextChoiceId: args.choice_id,
      nextCount: args.count,
    });
    await mutators.votes.upsertOfflineTally.fn({ tx, ctx, args });

    console.info('Server successful', {
      flow: 'vote-offline-tally-upsert',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      voteId: args.vote_id,
      phase: args.phase,
      choiceId: args.choice_id,
      count: args.count,
    });
  }),
};
