export const VOTE_STATUS = {
  indicativeOpen: 'indicative_open',
  finalOpen: 'final_open',
  closed: 'closed',
} as const;

export const VOTE_PURPOSE = {
  mergeVariant: 'merge_variant',
  changeRequest: 'change_request',
  finalClosing: 'final_closing',
} as const;

export type CanonicalVoteStatus = (typeof VOTE_STATUS)[keyof typeof VOTE_STATUS];
export type CanonicalVotePurpose = (typeof VOTE_PURPOSE)[keyof typeof VOTE_PURPOSE];

export function normalizeVoteStatus(status: string | null | undefined): CanonicalVoteStatus {
  if (status === VOTE_STATUS.closed) {
    return VOTE_STATUS.closed;
  }

  if (status === VOTE_STATUS.finalOpen || status === 'final' || status === 'final_vote') {
    return VOTE_STATUS.finalOpen;
  }

  return VOTE_STATUS.indicativeOpen;
}

export function isFinalOpenVoteStatus(status: string | null | undefined) {
  return normalizeVoteStatus(status) === VOTE_STATUS.finalOpen;
}

export function isIndicativeOpenVoteStatus(status: string | null | undefined) {
  return normalizeVoteStatus(status) === VOTE_STATUS.indicativeOpen;
}

export function isClosedVoteStatus(status: string | null | undefined) {
  return normalizeVoteStatus(status) === VOTE_STATUS.closed;
}

export function normalizeVotePurpose(purpose: string | null | undefined): string {
  if (purpose === 'variant_selection') {
    return VOTE_PURPOSE.mergeVariant;
  }

  if (purpose === 'final_amendment') {
    return VOTE_PURPOSE.finalClosing;
  }

  return purpose ?? 'general';
}

export function isMergeVariantVotePurpose(purpose: string | null | undefined) {
  return normalizeVotePurpose(purpose) === VOTE_PURPOSE.mergeVariant;
}

export function isChangeRequestVotePurpose(purpose: string | null | undefined) {
  return normalizeVotePurpose(purpose) === VOTE_PURPOSE.changeRequest;
}

export function isFinalClosingVotePurpose(purpose: string | null | undefined) {
  return normalizeVotePurpose(purpose) === VOTE_PURPOSE.finalClosing;
}
