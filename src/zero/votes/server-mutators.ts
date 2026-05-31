import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import {
  eventAllowsOnlineVoting,
  getConfirmedOfflineAttendeeCount,
  isUserForcedOfflineForEvent,
} from '../offline-roster-helpers';
import { zql } from '../schema';
import { recomputeEventCounters, requireRecentVotingPasswordVerification } from '../server-helpers';
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

    await mutators.votes.updateVote.fn({ tx, ctx, args });

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
