import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
import { can } from '../rbac/can';
import { requireOwner } from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';
import { defaultVoteBallotVisibility } from '../shared';
import {
  createVoteSchema,
  updateVoteSchema,
  deleteVoteSchema,
  createVoteChoiceSchema,
  updateVoteChoiceSchema,
  deleteVoteChoiceSchema,
  createVoterSchema,
  deleteVoterSchema,
  createIndicativeVoterParticipationSchema,
  createIndicativeChoiceDecisionSchema,
  createFinalVoterParticipationSchema,
  createFinalChoiceDecisionSchema,
  upsertVoteOfflineTallySchema,
  deleteVoteOfflineTallySchema,
} from './schema';

type VoteTx = Parameters<typeof can>[0];
type VoteCtx = Parameters<typeof can>[1];

async function loadVote(tx: VoteTx, voteId: string) {
  const vote = await tx.run(zql.vote.where('id', voteId).one());
  if (!vote) throw new Error('Vote not found');
  return vote;
}

async function loadVoteScope(tx: VoteTx, voteId: string) {
  const vote = await loadVote(tx, voteId);
  if (!vote.agenda_item_id) {
    return { vote, eventId: null as string | null, amendmentId: vote.amendment_id ?? null };
  }

  const agendaItem = await tx.run(zql.agenda_item.where('id', vote.agenda_item_id).one());
  return {
    vote,
    eventId: agendaItem?.event_id ?? null,
    amendmentId: vote.amendment_id ?? agendaItem?.amendment_id ?? null,
  };
}

async function assertVoteManagerForScope(
  tx: VoteTx,
  ctx: VoteCtx,
  scope: { eventId?: string | null; amendmentId?: string | null }
) {
  if (tx.location === 'client') return;

  if (scope.eventId) {
    await can(tx, ctx, { action: 'manage_votes', resource: 'events', eventId: scope.eventId });
    return;
  }

  if (scope.amendmentId) {
    await can(tx, ctx, {
      action: 'manage',
      resource: 'amendments',
      amendmentId: scope.amendmentId,
    });
    return;
  }

  throw new PermissionError('manage_votes', 'events', 'vote parent required');
}

async function assertVoteManagerForAgendaItem(
  tx: VoteTx,
  ctx: VoteCtx,
  agendaItemId: string | null | undefined,
  amendmentId: string | null | undefined
) {
  if (tx.location === 'client') return;

  if (agendaItemId) {
    const agendaItem = await tx.run(zql.agenda_item.where('id', agendaItemId).one());
    await assertVoteManagerForScope(tx, ctx, {
      eventId: agendaItem?.event_id,
      amendmentId: amendmentId ?? agendaItem?.amendment_id,
    });
    return;
  }

  await assertVoteManagerForScope(tx, ctx, { amendmentId });
}

async function assertVoteManager(tx: VoteTx, ctx: VoteCtx, voteId: string) {
  if (tx.location === 'client') return;
  const { eventId, amendmentId } = await loadVoteScope(tx, voteId);
  await assertVoteManagerForScope(tx, ctx, { eventId, amendmentId });
}

async function assertVoterOwner(tx: VoteTx, ctx: VoteCtx, voterId: string, voteId: string) {
  if (tx.location === 'client') return;
  const voter = await tx.run(zql.voter.where('id', voterId).one());
  if (!voter || voter.vote_id !== voteId) {
    throw new Error('Voter not found for this vote.');
  }
  requireOwner(tx, ctx, voter.user_id, { action: 'active_voting', resource: 'events' });
}

async function assertVoterParticipationOwner(
  tx: VoteTx,
  ctx: VoteCtx,
  participationId: string,
  phase: 'indicative' | 'final'
) {
  if (tx.location === 'client') return;
  const participation =
    phase === 'indicative'
      ? await tx.run(zql.indicative_voter_participation.where('id', participationId).one())
      : await tx.run(zql.final_voter_participation.where('id', participationId).one());
  if (!participation) throw new Error('Vote participation not found');
  await assertVoterOwner(tx, ctx, participation.voter_id, participation.vote_id);
}

/** Shared mutators — run on both client and server. */
export const voteSharedMutators = {
  // Create a vote
  createVote: defineMutator(createVoteSchema, async ({ tx, ctx, args }) => {
    await assertVoteManagerForAgendaItem(tx, ctx, args.agenda_item_id, args.amendment_id);
    const now = Date.now();
    const vote = {
      ...args,
      status: args.status ?? 'indicative',
      majority_type: args.majority_type ?? 'relative',
      closing_type: args.closing_type ?? 'moderator',
      visibility: args.visibility ?? 'public',
      ballot_visibility: args.ballot_visibility ?? defaultVoteBallotVisibility,
    };

    await tx.mutate.vote.insert({
      ...vote,
      created_at: now,
      updated_at: now,
    });
  }),

  // Update a vote
  updateVote: defineMutator(updateVoteSchema, async ({ tx, ctx, args }) => {
    await assertVoteManager(tx, ctx, args.id);
    await tx.mutate.vote.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  // Delete a vote
  deleteVote: defineMutator(deleteVoteSchema, async ({ tx, ctx, args }) => {
    await assertVoteManager(tx, ctx, args.id);
    await tx.mutate.vote.delete({ id: args.id });
  }),

  // Create a vote choice
  createVoteChoice: defineMutator(createVoteChoiceSchema, async ({ tx, ctx, args }) => {
    await assertVoteManager(tx, ctx, args.vote_id);
    const now = Date.now();
    await tx.mutate.vote_choice.insert({
      ...args,
      created_at: now,
    });
  }),

  // Update a vote choice
  updateVoteChoice: defineMutator(updateVoteChoiceSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const choice = await tx.run(zql.vote_choice.where('id', args.id).one());
      if (!choice) throw new Error('Vote choice not found');
      await assertVoteManager(tx, ctx, choice.vote_id);
    }
    await tx.mutate.vote_choice.update(args);
  }),

  // Delete a vote choice
  deleteVoteChoice: defineMutator(deleteVoteChoiceSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const choice = await tx.run(zql.vote_choice.where('id', args.id).one());
      if (!choice) throw new Error('Vote choice not found');
      await assertVoteManager(tx, ctx, choice.vote_id);
    }
    await tx.mutate.vote_choice.delete({ id: args.id });
  }),

  // Add a voter
  createVoter: defineMutator(createVoterSchema, async ({ tx, ctx, args }) => {
    await assertVoteManager(tx, ctx, args.vote_id);
    const now = Date.now();
    await tx.mutate.voter.insert({
      ...args,
      created_at: now,
    });
  }),

  // Remove a voter
  deleteVoter: defineMutator(deleteVoterSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const voter = await tx.run(zql.voter.where('id', args.id).one());
      if (!voter) throw new Error('Voter not found');
      await assertVoteManager(tx, ctx, voter.vote_id);
    }
    await tx.mutate.voter.delete({ id: args.id });
  }),

  // Cast indicative vote (creates participation)
  castIndicativeVote: defineMutator(
    createIndicativeVoterParticipationSchema,
    async ({ tx, ctx, args }) => {
      await assertVoterOwner(tx, ctx, args.voter_id, args.vote_id);
      const now = Date.now();
      await tx.mutate.indicative_voter_participation.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  // Record an indicative choice decision
  createIndicativeChoiceDecision: defineMutator(
    createIndicativeChoiceDecisionSchema,
    async ({ tx, ctx, args }) => {
      if (args.voter_participation_id) {
        await assertVoterParticipationOwner(tx, ctx, args.voter_participation_id, 'indicative');
      } else {
        await assertVoteManager(tx, ctx, args.vote_id);
      }
      const now = Date.now();
      await tx.mutate.indicative_choice_decision.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  // Cast final vote (creates participation)
  castFinalVote: defineMutator(createFinalVoterParticipationSchema, async ({ tx, ctx, args }) => {
    await assertVoterOwner(tx, ctx, args.voter_id, args.vote_id);
    const now = Date.now();
    await tx.mutate.final_voter_participation.insert({
      ...args,
      created_at: now,
    });
  }),

  // Record a final choice decision
  createFinalChoiceDecision: defineMutator(
    createFinalChoiceDecisionSchema,
    async ({ tx, ctx, args }) => {
      if (args.voter_participation_id) {
        await assertVoterParticipationOwner(tx, ctx, args.voter_participation_id, 'final');
      } else {
        await assertVoteManager(tx, ctx, args.vote_id);
      }
      const now = Date.now();
      await tx.mutate.final_choice_decision.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  upsertOfflineTally: defineMutator(upsertVoteOfflineTallySchema, async ({ tx, ctx, args }) => {
    await assertVoteManager(tx, ctx, args.vote_id);
    const now = Date.now();
    const { debug_correlation_id, ...tallyArgs } = args;
    void debug_correlation_id;

    const existingTally =
      tallyArgs.id != null
        ? await tx.run(zql.vote_offline_tally.where('id', tallyArgs.id).one())
        : await tx.run(
            zql.vote_offline_tally
              .where('vote_id', tallyArgs.vote_id)
              .where('phase', tallyArgs.phase)
              .where('choice_id', tallyArgs.choice_id)
              .one()
          );

    if (existingTally) {
      await tx.mutate.vote_offline_tally.update({
        id: existingTally.id,
        count: tallyArgs.count,
        updated_by_id: ctx.userID,
        updated_at: now,
      });
      return;
    }

    await tx.mutate.vote_offline_tally.insert({
      id: tallyArgs.id ?? crypto.randomUUID(),
      vote_id: tallyArgs.vote_id,
      phase: tallyArgs.phase,
      choice_id: tallyArgs.choice_id,
      count: tallyArgs.count,
      updated_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });
  }),

  deleteOfflineTally: defineMutator(deleteVoteOfflineTallySchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const tally = await tx.run(zql.vote_offline_tally.where('id', args.id).one());
      if (!tally) throw new Error('Vote offline tally not found');
      await assertVoteManager(tx, ctx, tally.vote_id);
    }
    await tx.mutate.vote_offline_tally.delete({ id: args.id });
  }),
};
