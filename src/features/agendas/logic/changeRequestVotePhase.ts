import {
  VOTE_PHASE,
  normalizeVotePhase,
  type CanonicalVotePhase,
} from '@/zero/votes/vote-workflow';

export type ChangeRequestVotePhase = CanonicalVotePhase;

interface ChangeRequestVotePhaseSource {
  is_closing_vote?: boolean | null;
  status?: string | null;
  vote?: {
    status?: string | null;
  } | null;
  change_request?: {
    id?: string | null;
    status?: string | null;
    voting_status?: string | null;
  } | null;
}

function isFinalChangeRequestStatus(status: string | null | undefined) {
  return (
    status === 'accepted' || status === 'approved' || status === 'rejected' || status === 'declined'
  );
}

function isClosedChangeRequest(item: ChangeRequestVotePhaseSource) {
  return (
    item.status === 'completed' ||
    item.change_request?.voting_status === 'completed' ||
    isFinalChangeRequestStatus(item.change_request?.status)
  );
}

function isOpenInternalChangeRequest(item: ChangeRequestVotePhaseSource) {
  return Boolean(item.change_request?.id) && !item.is_closing_vote && !isClosedChangeRequest(item);
}

/** Derive the canonical voting phase for a change-request timeline item. */
export function deriveChangeRequestVotePhase(
  item: ChangeRequestVotePhaseSource,
  editingMode?: string | null
): ChangeRequestVotePhase {
  if (item.vote?.status) {
    return normalizeVotePhase(item.vote.status);
  }

  if (isClosedChangeRequest(item)) {
    return VOTE_PHASE.closed;
  }

  if (editingMode === 'vote_internal' && isOpenInternalChangeRequest(item)) {
    return VOTE_PHASE.internal;
  }

  return VOTE_PHASE.indicative;
}
