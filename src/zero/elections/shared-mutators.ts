import { defineMutator } from '@rocicorp/zero';
import {
  deriveElectionMaxVotes,
  resolveElectionMode,
  resolveElectionSeatCount,
} from '@/features/elections/logic/electionMode';
import { zql } from '../schema';
import { can } from '../rbac/can';
import { requireOwner } from '../rbac/authorize';
import { PermissionError, isPermissionError } from '../rbac/errors';
import { defaultElectionBallotVisibility } from '../shared';
import {
  createElectionSchema,
  updateElectionSchema,
  deleteElectionSchema,
  createElectionCandidateSchema,
  updateElectionCandidateSchema,
  deleteElectionCandidateSchema,
  createElectorSchema,
  deleteElectorSchema,
  createIndicativeElectorParticipationSchema,
  createIndicativeCandidateSelectionSchema,
  createFinalElectorParticipationSchema,
  createFinalCandidateSelectionSchema,
  upsertElectionOfflineTallySchema,
  deleteElectionOfflineTallySchema,
} from './schema';

type ElectionTx = Parameters<typeof can>[0];
type ElectionCtx = Parameters<typeof can>[1];

async function loadElection(tx: ElectionTx, electionId: string) {
  const election = await tx.run(zql.election.where('id', electionId).one());
  if (!election) throw new Error('Election not found');
  return election;
}

async function loadElectionEventId(tx: ElectionTx, electionId: string) {
  const election = await loadElection(tx, electionId);
  if (!election.agenda_item_id) return { election, eventId: null as string | null };
  const agendaItem = await tx.run(zql.agenda_item.where('id', election.agenda_item_id).one());
  return { election, eventId: agendaItem?.event_id ?? null };
}

async function assertElectionManagerForEvent(
  tx: ElectionTx,
  ctx: ElectionCtx,
  eventId: string | null | undefined
) {
  if (tx.location === 'client') return;
  if (!eventId) throw new PermissionError('manage_votes', 'events', 'event required');

  try {
    await can(tx, ctx, { action: 'manage', resource: 'elections', eventId });
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    await can(tx, ctx, { action: 'manage_votes', resource: 'events', eventId });
  }
}

async function assertElectionManager(tx: ElectionTx, ctx: ElectionCtx, electionId: string) {
  if (tx.location === 'client') return;
  const { eventId } = await loadElectionEventId(tx, electionId);
  await assertElectionManagerForEvent(tx, ctx, eventId);
}

async function assertElectionManagerForAgendaItem(
  tx: ElectionTx,
  ctx: ElectionCtx,
  agendaItemId: string | null | undefined
) {
  if (tx.location === 'client') return;
  if (!agendaItemId) throw new PermissionError('manage', 'elections', 'agenda item required');
  const agendaItem = await tx.run(zql.agenda_item.where('id', agendaItemId).one());
  await assertElectionManagerForEvent(tx, ctx, agendaItem?.event_id);
}

async function assertElectionEventRight(
  tx: ElectionTx,
  ctx: ElectionCtx,
  electionId: string,
  action: 'active_voting' | 'passive_voting'
) {
  if (tx.location === 'client') return;
  const { eventId } = await loadElectionEventId(tx, electionId);
  if (!eventId) throw new PermissionError(action, 'events', 'event required');
  await can(tx, ctx, { action, resource: 'events', eventId });
}

async function assertSelfElectionEventRightOrManager(
  tx: ElectionTx,
  ctx: ElectionCtx,
  args: {
    electionId: string;
    userId: string;
    action: 'active_voting' | 'passive_voting';
  }
) {
  if (tx.location === 'client') return;

  if (args.userId === ctx.userID) {
    try {
      await assertElectionEventRight(tx, ctx, args.electionId, args.action);
      return;
    } catch (error) {
      if (!isPermissionError(error)) throw error;
    }
  }

  await assertElectionManager(tx, ctx, args.electionId);
}

async function assertElectorOwner(
  tx: ElectionTx,
  ctx: ElectionCtx,
  electorId: string,
  electionId: string
) {
  if (tx.location === 'client') return;
  const elector = await tx.run(zql.elector.where('id', electorId).one());
  if (!elector || elector.election_id !== electionId) {
    throw new Error('Elector not found for this election.');
  }
  requireOwner(tx, ctx, elector.user_id, { action: 'active_voting', resource: 'events' });
  const { eventId } = await loadElectionEventId(tx, electionId);
  if (eventId) {
    await can(tx, ctx, { action: 'active_voting', resource: 'events', eventId });
  }
}

async function assertElectorParticipationOwner(
  tx: ElectionTx,
  ctx: ElectionCtx,
  participationId: string,
  phase: 'indicative' | 'final'
) {
  if (tx.location === 'client') return;
  const participation =
    phase === 'indicative'
      ? await tx.run(zql.indicative_elector_participation.where('id', participationId).one())
      : await tx.run(zql.final_elector_participation.where('id', participationId).one());
  if (!participation) throw new Error('Election participation not found');
  await assertElectorOwner(tx, ctx, participation.elector_id, participation.election_id);
}

async function assertCandidateBelongsToElection(
  tx: ElectionTx,
  electionId: string,
  candidateId: string
) {
  if (tx.location === 'client') return;
  const candidate = await tx.run(zql.election_candidate.where('id', candidateId).one());
  if (!candidate || candidate.election_id !== electionId) {
    throw new Error('Election candidate not found for this election.');
  }
}

async function assertSecretElectionSelectionOwner(
  tx: ElectionTx,
  ctx: ElectionCtx,
  electionId: string,
  phase: 'indicative' | 'final'
) {
  if (tx.location === 'client') return;
  const { eventId } = await loadElectionEventId(tx, electionId);
  if (!eventId) {
    throw new PermissionError('active_voting', 'events', 'event required');
  }

  const elector = await tx.run(
    zql.elector.where('election_id', electionId).where('user_id', ctx.userID).one()
  );
  if (!elector) {
    throw new PermissionError('active_voting', 'events', `election:${electionId}`);
  }

  await assertElectorOwner(tx, ctx, elector.id, electionId);

  const participation =
    phase === 'indicative'
      ? await tx.run(
          zql.indicative_elector_participation
            .where('election_id', electionId)
            .where('elector_id', elector.id)
            .one()
        )
      : await tx.run(
          zql.final_elector_participation
            .where('election_id', electionId)
            .where('elector_id', elector.id)
            .one()
        );

  if (!participation) throw new Error('Election participation not found');
}

async function assertSecretElectionSelectionOwnerOrManager(
  tx: ElectionTx,
  ctx: ElectionCtx,
  electionId: string,
  phase: 'indicative' | 'final'
) {
  if (tx.location === 'client') return;

  try {
    await assertSecretElectionSelectionOwner(tx, ctx, electionId, phase);
  } catch {
    await assertElectionManager(tx, ctx, electionId);
  }
}

/** Shared mutators — run on both client and server. */
export const electionSharedMutators = {
  // Create an election
  createElection: defineMutator(createElectionSchema, async ({ tx, ctx, args }) => {
    await assertElectionManagerForAgendaItem(tx, ctx, args.agenda_item_id);
    const now = Date.now();
    const { position_id, debug_correlation_id, ...restArgs } = args;
    void debug_correlation_id;
    const electionMode = resolveElectionMode({
      electionMode: args.election_mode,
      seatCount: args.seat_count,
      maxVotes: args.max_votes,
    });
    const seatCount = resolveElectionSeatCount({
      electionMode,
      seatCount: args.seat_count,
      maxVotes: args.max_votes,
    });
    await tx.mutate.election.insert({
      ...restArgs,
      role_id: args.role_id ?? position_id ?? null,
      ballot_visibility: args.ballot_visibility ?? defaultElectionBallotVisibility,
      election_mode: electionMode,
      seat_count: seatCount,
      max_votes: deriveElectionMaxVotes(electionMode, seatCount),
      created_at: now,
      updated_at: now,
    });
  }),

  // Update an election
  updateElection: defineMutator(updateElectionSchema, async ({ tx, ctx, args }) => {
    await assertElectionManager(tx, ctx, args.id);
    const currentElection = await tx.run(zql.election.where('id', args.id).one());
    const { position_id, debug_correlation_id, ...restArgs } = args;
    void debug_correlation_id;
    const electionMode =
      args.election_mode !== undefined ||
      args.seat_count !== undefined ||
      args.max_votes !== undefined
        ? resolveElectionMode({
            electionMode: args.election_mode ?? currentElection?.election_mode,
            seatCount: args.seat_count ?? currentElection?.seat_count,
            maxVotes: args.max_votes ?? currentElection?.max_votes,
          })
        : undefined;
    const seatCount =
      electionMode !== undefined
        ? resolveElectionSeatCount({
            electionMode,
            seatCount: args.seat_count ?? currentElection?.seat_count,
            maxVotes: args.max_votes ?? currentElection?.max_votes,
          })
        : undefined;
    await tx.mutate.election.update({
      ...restArgs,
      role_id: args.role_id ?? position_id ?? undefined,
      ...(electionMode !== undefined ? { election_mode: electionMode } : {}),
      ...(seatCount !== undefined ? { seat_count: seatCount } : {}),
      ...(electionMode !== undefined || seatCount !== undefined || args.max_votes !== undefined
        ? { max_votes: deriveElectionMaxVotes(electionMode ?? 'single', seatCount) }
        : {}),
      updated_at: Date.now(),
    });
  }),

  // Delete an election
  deleteElection: defineMutator(deleteElectionSchema, async ({ tx, ctx, args }) => {
    await assertElectionManager(tx, ctx, args.id);
    await tx.mutate.election.delete({ id: args.id });
  }),

  // Add a candidate to an election
  addCandidate: defineMutator(createElectionCandidateSchema, async ({ tx, ctx, args }) => {
    await assertSelfElectionEventRightOrManager(tx, ctx, {
      electionId: args.election_id,
      userId: args.user_id,
      action: 'passive_voting',
    });
    const now = Date.now();
    await tx.mutate.election_candidate.insert({
      ...args,
      created_at: now,
    });
  }),

  // Update a candidate
  updateCandidate: defineMutator(updateElectionCandidateSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const candidate = await tx.run(zql.election_candidate.where('id', args.id).one());
      if (!candidate) throw new Error('Election candidate not found');
      await assertElectionManager(tx, ctx, candidate.election_id);
    }
    await tx.mutate.election_candidate.update(args);
  }),

  // Delete a candidate
  deleteCandidate: defineMutator(deleteElectionCandidateSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const candidate = await tx.run(zql.election_candidate.where('id', args.id).one());
      if (!candidate) throw new Error('Election candidate not found');
      await assertElectionManager(tx, ctx, candidate.election_id);
    }
    await tx.mutate.election_candidate.delete({ id: args.id });
  }),

  // Add an elector
  createElector: defineMutator(createElectorSchema, async ({ tx, ctx, args }) => {
    await assertSelfElectionEventRightOrManager(tx, ctx, {
      electionId: args.election_id,
      userId: args.user_id,
      action: 'active_voting',
    });
    const now = Date.now();
    await tx.mutate.elector.insert({
      ...args,
      created_at: now,
    });
  }),

  // Remove an elector
  deleteElector: defineMutator(deleteElectorSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const elector = await tx.run(zql.elector.where('id', args.id).one());
      if (!elector) throw new Error('Elector not found');
      await assertElectionManager(tx, ctx, elector.election_id);
    }
    await tx.mutate.elector.delete({ id: args.id });
  }),

  // Cast indicative election vote (creates participation + selection(s))
  castIndicativeElectionVote: defineMutator(
    createIndicativeElectorParticipationSchema,
    async ({ tx, ctx, args }) => {
      await assertElectorOwner(tx, ctx, args.elector_id, args.election_id);
      const now = Date.now();
      await tx.mutate.indicative_elector_participation.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  // Record an indicative candidate selection
  createIndicativeCandidateSelection: defineMutator(
    createIndicativeCandidateSelectionSchema,
    async ({ tx, ctx, args }) => {
      await assertCandidateBelongsToElection(tx, args.election_id, args.candidate_id);
      if (args.elector_participation_id) {
        await assertElectorParticipationOwner(tx, ctx, args.elector_participation_id, 'indicative');
      } else {
        await assertSecretElectionSelectionOwnerOrManager(tx, ctx, args.election_id, 'indicative');
      }
      const now = Date.now();
      await tx.mutate.indicative_candidate_selection.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  // Cast final election vote (creates participation + selection(s))
  castFinalElectionVote: defineMutator(
    createFinalElectorParticipationSchema,
    async ({ tx, ctx, args }) => {
      await assertElectorOwner(tx, ctx, args.elector_id, args.election_id);
      const now = Date.now();
      await tx.mutate.final_elector_participation.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  // Record a final candidate selection
  createFinalCandidateSelection: defineMutator(
    createFinalCandidateSelectionSchema,
    async ({ tx, ctx, args }) => {
      await assertCandidateBelongsToElection(tx, args.election_id, args.candidate_id);
      if (args.elector_participation_id) {
        await assertElectorParticipationOwner(tx, ctx, args.elector_participation_id, 'final');
      } else {
        await assertSecretElectionSelectionOwnerOrManager(tx, ctx, args.election_id, 'final');
      }
      const now = Date.now();
      await tx.mutate.final_candidate_selection.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  upsertOfflineTally: defineMutator(upsertElectionOfflineTallySchema, async ({ tx, ctx, args }) => {
    await assertElectionManager(tx, ctx, args.election_id);
    const now = Date.now();
    const { debug_correlation_id, ...tallyArgs } = args;
    void debug_correlation_id;

    const existingTally =
      tallyArgs.id != null
        ? await tx.run(zql.election_offline_tally.where('id', tallyArgs.id).one())
        : await tx.run(
            zql.election_offline_tally
              .where('election_id', tallyArgs.election_id)
              .where('phase', tallyArgs.phase)
              .where('candidate_id', tallyArgs.candidate_id)
              .one()
          );

    if (existingTally) {
      await tx.mutate.election_offline_tally.update({
        id: existingTally.id,
        count: tallyArgs.count,
        updated_by_id: ctx.userID,
        updated_at: now,
      });
      return;
    }

    await tx.mutate.election_offline_tally.insert({
      id: tallyArgs.id ?? crypto.randomUUID(),
      election_id: tallyArgs.election_id,
      phase: tallyArgs.phase,
      candidate_id: tallyArgs.candidate_id,
      count: tallyArgs.count,
      updated_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });
  }),

  deleteOfflineTally: defineMutator(deleteElectionOfflineTallySchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const tally = await tx.run(zql.election_offline_tally.where('id', args.id).one());
      if (!tally) throw new Error('Election offline tally not found');
      await assertElectionManager(tx, ctx, tally.election_id);
    }
    await tx.mutate.election_offline_tally.delete({ id: args.id });
  }),
};
