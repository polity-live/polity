import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
import { can } from '../rbac/can';
import { requireOwner } from '../rbac/authorize';
import { PermissionError, isPermissionError } from '../rbac/errors';
import { defaultVoteBallotVisibility, isNamedBallot } from '../shared';
import {
  createVoteSchema,
  updateVoteSchema,
  deleteVoteSchema,
  closeExpiredFinalVotesForEventSchema,
  createVoteChoiceSchema,
  updateVoteChoiceSchema,
  deleteVoteChoiceSchema,
  createVoterSchema,
  deleteVoterSchema,
  createIndicativeVoterParticipationSchema,
  createIndicativeChoiceDecisionSchema,
  replaceIndicativeVoteSchema,
  createFinalVoterParticipationSchema,
  createFinalChoiceDecisionSchema,
  upsertVoteOfflineTallySchema,
  deleteVoteOfflineTallySchema,
} from './schema';
import { normalizeVotePurpose, normalizeVoteStatus } from './vote-workflow';

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
    try {
      await can(tx, ctx, { action: 'manage_votes', resource: 'events', eventId: scope.eventId });
      return;
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      if (!scope.amendmentId) {
        throw error;
      }
    }
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

async function assertActiveVotingRightForVote(tx: VoteTx, ctx: VoteCtx, voteId: string) {
  if (tx.location === 'client') return;
  const { eventId } = await loadVoteScope(tx, voteId);
  if (!eventId) throw new PermissionError('active_voting', 'events', 'event required');
  await can(tx, ctx, { action: 'active_voting', resource: 'events', eventId });
}

async function assertSelfActiveVotingRightOrVoteManager(
  tx: VoteTx,
  ctx: VoteCtx,
  args: {
    voteId: string;
    userId: string;
  }
) {
  if (tx.location === 'client') return;

  if (args.userId === ctx.userID) {
    try {
      await assertActiveVotingRightForVote(tx, ctx, args.voteId);
      return;
    } catch (error) {
      if (!isPermissionError(error)) throw error;
    }
  }

  await assertVoteManager(tx, ctx, args.voteId);
}

async function assertVoterOwner(tx: VoteTx, ctx: VoteCtx, voterId: string, voteId: string) {
  if (tx.location === 'client') return;
  const voter = await tx.run(zql.voter.where('id', voterId).one());
  if (!voter || voter.vote_id !== voteId) {
    throw new Error('Voter not found for this vote.');
  }
  requireOwner(tx, ctx, voter.user_id, { action: 'active_voting', resource: 'events' });
  const { eventId } = await loadVoteScope(tx, voteId);
  if (eventId) {
    await can(tx, ctx, { action: 'active_voting', resource: 'events', eventId });
  }
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

async function assertChoiceBelongsToVote(tx: VoteTx, voteId: string, choiceId: string) {
  if (tx.location === 'client') return;
  const choice = await tx.run(zql.vote_choice.where('id', choiceId).one());
  if (!choice || choice.vote_id !== voteId) {
    throw new Error('Vote choice not found for this vote.');
  }
}

async function assertSecretChoiceDecisionOwner(
  tx: VoteTx,
  ctx: VoteCtx,
  voteId: string,
  phase: 'indicative' | 'final'
) {
  if (tx.location === 'client') return;
  const { eventId } = await loadVoteScope(tx, voteId);
  if (!eventId) {
    throw new PermissionError('active_voting', 'events', 'event required');
  }

  const voter = await tx.run(zql.voter.where('vote_id', voteId).where('user_id', ctx.userID).one());
  if (!voter) {
    throw new PermissionError('active_voting', 'events', `vote:${voteId}`);
  }

  await assertVoterOwner(tx, ctx, voter.id, voteId);

  const participation =
    phase === 'indicative'
      ? await tx.run(
          zql.indicative_voter_participation
            .where('vote_id', voteId)
            .where('voter_id', voter.id)
            .one()
        )
      : await tx.run(
          zql.final_voter_participation.where('vote_id', voteId).where('voter_id', voter.id).one()
        );

  if (!participation) throw new Error('Vote participation not found');
}

async function assertSecretChoiceDecisionOwnerOrManager(
  tx: VoteTx,
  ctx: VoteCtx,
  voteId: string,
  phase: 'indicative' | 'final'
) {
  if (tx.location === 'client') return;

  try {
    await assertSecretChoiceDecisionOwner(tx, ctx, voteId, phase);
  } catch {
    await assertVoteManager(tx, ctx, voteId);
  }
}

/** Shared mutators — run on both client and server. */
export const voteSharedMutators = {
  // Create a vote
  createVote: defineMutator(createVoteSchema, async ({ tx, ctx, args }) => {
    await assertVoteManagerForAgendaItem(tx, ctx, args.agenda_item_id, args.amendment_id);
    const now = Date.now();
    const vote = {
      ...args,
      status: normalizeVoteStatus(args.status),
      purpose: normalizeVotePurpose(args.purpose),
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
    const normalizedArgs = {
      ...args,
      ...(args.status !== undefined ? { status: normalizeVoteStatus(args.status) } : {}),
      ...(args.purpose !== undefined ? { purpose: normalizeVotePurpose(args.purpose) } : {}),
    };
    await tx.mutate.vote.update({
      ...normalizedArgs,
      updated_at: Date.now(),
    });
  }),

  // Delete a vote
  deleteVote: defineMutator(deleteVoteSchema, async ({ tx, ctx, args }) => {
    await assertVoteManager(tx, ctx, args.id);
    await tx.mutate.vote.delete({ id: args.id });
  }),

  closeExpiredFinalVotesForEvent: defineMutator(closeExpiredFinalVotesForEventSchema, async () => {
    // Server-only sweep; keep client optimistic state untouched.
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
    await assertSelfActiveVotingRightOrVoteManager(tx, ctx, {
      voteId: args.vote_id,
      userId: args.user_id,
    });
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
      await assertChoiceBelongsToVote(tx, args.vote_id, args.choice_id);
      if (args.voter_participation_id) {
        await assertVoterParticipationOwner(tx, ctx, args.voter_participation_id, 'indicative');
      } else {
        await assertSecretChoiceDecisionOwnerOrManager(tx, ctx, args.vote_id, 'indicative');
      }
      const now = Date.now();
      await tx.mutate.indicative_choice_decision.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  replaceIndicativeVote: defineMutator(replaceIndicativeVoteSchema, async ({ tx, ctx, args }) => {
    const { participation, decisions } = args;
    await assertVoterOwner(tx, ctx, participation.voter_id, participation.vote_id);

    const vote = await loadVote(tx, participation.vote_id);
    const isNamed = isNamedBallot(vote.ballot_visibility ?? defaultVoteBallotVisibility);

    for (const decision of decisions) {
      if (decision.vote_id !== participation.vote_id) {
        throw new Error('Indicative vote decision does not belong to this vote.');
      }
      await assertChoiceBelongsToVote(tx, participation.vote_id, decision.choice_id);
    }

    const existingParticipation = await tx.run(
      zql.indicative_voter_participation
        .where('vote_id', participation.vote_id)
        .where('voter_id', participation.voter_id)
        .one()
    );

    if (existingParticipation && !isNamed) {
      throw new Error(
        'You have already voted in this secret indicative vote. Secret indicative votes cannot be changed.'
      );
    }

    if (isNamed && decisions.some(decision => !decision.voter_participation_id)) {
      throw new Error('Named indicative votes require linked participation decisions.');
    }

    const now = Date.now();
    const resolvedParticipation = existingParticipation ?? participation;

    if (!existingParticipation) {
      await tx.mutate.indicative_voter_participation.insert({
        ...participation,
        created_at: now,
      });
    } else {
      const previousDecisions = await tx.run(
        zql.indicative_choice_decision.where('voter_participation_id', existingParticipation.id)
      );

      for (const previousDecision of previousDecisions) {
        await tx.mutate.indicative_choice_decision.delete({ id: previousDecision.id });
      }
    }

    for (const decision of decisions) {
      await tx.mutate.indicative_choice_decision.insert({
        ...decision,
        voter_participation_id: isNamed ? resolvedParticipation.id : null,
        created_at: now,
      });
    }
  }),

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
      await assertChoiceBelongsToVote(tx, args.vote_id, args.choice_id);
      if (args.voter_participation_id) {
        await assertVoterParticipationOwner(tx, ctx, args.voter_participation_id, 'final');
      } else {
        await assertSecretChoiceDecisionOwnerOrManager(tx, ctx, args.vote_id, 'final');
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
