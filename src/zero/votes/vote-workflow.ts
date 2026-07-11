export const VOTE_PHASE = {
  pending: 'pending',
  internal: 'internal',
  indicative: 'indicative',
  final: 'final',
  closed: 'closed',
} as const;

export const VOTE_PURPOSE = {
  mergeVariant: 'merge_variant',
  changeRequest: 'change_request',
  closing: 'closing',
} as const;

export type CanonicalVotePhase = (typeof VOTE_PHASE)[keyof typeof VOTE_PHASE];
export type CanonicalVotePurpose = (typeof VOTE_PURPOSE)[keyof typeof VOTE_PURPOSE];

export function normalizeVotePhase(phase: string | null | undefined): CanonicalVotePhase {
  if (phase == null) {
    return VOTE_PHASE.indicative;
  }

  if (
    phase === VOTE_PHASE.internal ||
    phase === VOTE_PHASE.pending ||
    phase === VOTE_PHASE.indicative ||
    phase === VOTE_PHASE.final ||
    phase === VOTE_PHASE.closed
  ) {
    return phase;
  }

  throw new Error(`Unknown vote phase: ${phase}`);
}

export function isInternalVotePhase(phase: string | null | undefined) {
  return normalizeVotePhase(phase) === VOTE_PHASE.internal;
}

export function isFinalVotePhase(status: string | null | undefined) {
  return normalizeVotePhase(status) === VOTE_PHASE.final;
}

export function isIndicativeVotePhase(status: string | null | undefined) {
  return normalizeVotePhase(status) === VOTE_PHASE.indicative;
}

export function isClosedVotePhase(status: string | null | undefined) {
  return normalizeVotePhase(status) === VOTE_PHASE.closed;
}

export const VOTE_STATUS = VOTE_PHASE;
export type CanonicalVoteStatus = CanonicalVotePhase;
export const normalizeVoteStatus = normalizeVotePhase;
export const isClosedVoteStatus = isClosedVotePhase;
