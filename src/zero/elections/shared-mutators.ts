import { defineMutator } from '@rocicorp/zero';
import {
  deriveElectionMaxVotes,
  resolveElectionMode,
  resolveElectionSeatCount,
} from '@/features/elections/logic/electionMode';
import { zql } from '../schema';
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
} from './schema';

/** Shared mutators — run on both client and server. */
export const electionSharedMutators = {
  // Create an election
  createElection: defineMutator(createElectionSchema, async ({ tx, args }) => {
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
      election_mode: electionMode,
      seat_count: seatCount,
      max_votes: deriveElectionMaxVotes(electionMode, seatCount),
      created_at: now,
      updated_at: now,
    });
  }),

  // Update an election
  updateElection: defineMutator(updateElectionSchema, async ({ tx, args }) => {
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
  deleteElection: defineMutator(deleteElectionSchema, async ({ tx, args }) => {
    await tx.mutate.election.delete({ id: args.id });
  }),

  // Add a candidate to an election
  addCandidate: defineMutator(createElectionCandidateSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.election_candidate.insert({
      ...args,
      created_at: now,
    });
  }),

  // Update a candidate
  updateCandidate: defineMutator(updateElectionCandidateSchema, async ({ tx, args }) => {
    await tx.mutate.election_candidate.update(args);
  }),

  // Delete a candidate
  deleteCandidate: defineMutator(deleteElectionCandidateSchema, async ({ tx, args }) => {
    await tx.mutate.election_candidate.delete({ id: args.id });
  }),

  // Add an elector
  createElector: defineMutator(createElectorSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.elector.insert({
      ...args,
      created_at: now,
    });
  }),

  // Remove an elector
  deleteElector: defineMutator(deleteElectorSchema, async ({ tx, args }) => {
    await tx.mutate.elector.delete({ id: args.id });
  }),

  // Cast indicative election vote (creates participation + selection(s))
  castIndicativeElectionVote: defineMutator(
    createIndicativeElectorParticipationSchema,
    async ({ tx, args }) => {
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
    async ({ tx, args }) => {
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
    async ({ tx, args }) => {
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
    async ({ tx, args }) => {
      const now = Date.now();
      await tx.mutate.final_candidate_selection.insert({
        ...args,
        created_at: now,
      });
    }
  ),
};
