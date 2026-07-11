// Table
export {
  election,
  electionCandidate,
  elector,
  indicativeElectorParticipation,
  indicativeCandidateSelection,
  finalElectorParticipation,
  finalCandidateSelection,
} from './table';

// Zod Schemas
export {
  selectElectionSchema,
  createElectionSchema,
  updateElectionSchema,
  deleteElectionSchema,
  selectElectionCandidateSchema,
  createElectionCandidateSchema,
  updateElectionCandidateSchema,
  deleteElectionCandidateSchema,
  selectElectorSchema,
  createElectorSchema,
  deleteElectorSchema,
  selectIndicativeElectorParticipationSchema,
  createIndicativeElectorParticipationSchema,
  selectIndicativeCandidateSelectionSchema,
  createIndicativeCandidateSelectionSchema,
  replaceIndicativeElectionVoteSchema,
  startElectionSchema,
  submitElectionVoteSchema,
  selectFinalElectorParticipationSchema,
  createFinalElectorParticipationSchema,
  selectFinalCandidateSelectionSchema,
  createFinalCandidateSelectionSchema,
  castFinalElectionVoteFullSchema,
  selectElectionOfflineTallySchema,
  upsertElectionOfflineTallySchema,
  deleteElectionOfflineTallySchema,
  type Election,
  type ElectionCandidate,
  type Elector,
  type IndicativeElectorParticipation,
  type IndicativeCandidateSelection,
  type FinalElectorParticipation,
  type FinalCandidateSelection,
  type ElectionOfflineTally,
} from './schema';

// Queries
export { electionQueries } from './queries';
export type {
  ElectionByAgendaItemRow,
  ElectionByIdRow,
  CandidatesByElectionRow,
  ElectorsByElectionRow,
  IndicativeResultRow,
  FinalResultRow,
  UserIndicativeParticipationRow,
  UserFinalParticipationRow,
  ElectionWithDetailsRow,
  ElectionForSearchRow,
  UserElectorRow,
  ElectionOfflineTallyRow,
} from './queries';

// Shared Mutators
export { electionSharedMutators } from './shared-mutators';

// Server Mutators
export { electionServerMutators } from './server-mutators';

// State Hook
export { useElectionState } from './useElectionState';

// Action Hook
export { useElectionActions } from './useElectionActions';
