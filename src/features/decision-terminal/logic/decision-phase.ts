import type { VotingPhase } from '@/features/vote-cast/logic/votePhaseHelpers';

export function normalizeDecisionVotingPhase(status?: string | null): VotingPhase {
  if (status === 'final' || status === 'final') return 'final';
  if (status === 'closed' || status === 'completed') return 'closed';
  return 'indication';
}

export function isIndicativeDecisionStatus(status?: string | null): boolean {
  return normalizeDecisionVotingPhase(status) === 'indication';
}
