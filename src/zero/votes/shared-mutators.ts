import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
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

/** Shared mutators — run on both client and server. */
export const voteSharedMutators = {
  // Create a vote
  createVote: defineMutator(createVoteSchema, async ({ tx, args }) => {
    const now = Date.now();
    const vote = {
      ...args,
      status: args.status ?? 'indicative',
      majority_type: args.majority_type ?? 'relative',
      closing_type: args.closing_type ?? 'moderator',
      visibility: args.visibility ?? 'public',
    };

    await tx.mutate.vote.insert({
      ...vote,
      created_at: now,
      updated_at: now,
    });
  }),

  // Update a vote
  updateVote: defineMutator(updateVoteSchema, async ({ tx, args }) => {
    await tx.mutate.vote.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  // Delete a vote
  deleteVote: defineMutator(deleteVoteSchema, async ({ tx, args }) => {
    await tx.mutate.vote.delete({ id: args.id });
  }),

  // Create a vote choice
  createVoteChoice: defineMutator(createVoteChoiceSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.vote_choice.insert({
      ...args,
      created_at: now,
    });
  }),

  // Update a vote choice
  updateVoteChoice: defineMutator(updateVoteChoiceSchema, async ({ tx, args }) => {
    await tx.mutate.vote_choice.update(args);
  }),

  // Delete a vote choice
  deleteVoteChoice: defineMutator(deleteVoteChoiceSchema, async ({ tx, args }) => {
    await tx.mutate.vote_choice.delete({ id: args.id });
  }),

  // Add a voter
  createVoter: defineMutator(createVoterSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.voter.insert({
      ...args,
      created_at: now,
    });
  }),

  // Remove a voter
  deleteVoter: defineMutator(deleteVoterSchema, async ({ tx, args }) => {
    await tx.mutate.voter.delete({ id: args.id });
  }),

  // Cast indicative vote (creates participation)
  castIndicativeVote: defineMutator(
    createIndicativeVoterParticipationSchema,
    async ({ tx, args }) => {
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
    async ({ tx, args }) => {
      const now = Date.now();
      await tx.mutate.indicative_choice_decision.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  // Cast final vote (creates participation)
  castFinalVote: defineMutator(createFinalVoterParticipationSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.final_voter_participation.insert({
      ...args,
      created_at: now,
    });
  }),

  // Record a final choice decision
  createFinalChoiceDecision: defineMutator(
    createFinalChoiceDecisionSchema,
    async ({ tx, args }) => {
      const now = Date.now();
      await tx.mutate.final_choice_decision.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  upsertOfflineTally: defineMutator(upsertVoteOfflineTallySchema, async ({ tx, ctx, args }) => {
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

  deleteOfflineTally: defineMutator(deleteVoteOfflineTallySchema, async ({ tx, args }) => {
    await tx.mutate.vote_offline_tally.delete({ id: args.id });
  }),
};
