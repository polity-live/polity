/**
 * Helper functions for voting phase management.
 */

import type { ActionType, ResourceType } from '@/zero/rbac/types';
import { translate } from '@/features/shared/hooks/use-translation';

export type VotingPhase = 'internal' | 'indication' | 'final' | 'closed';

interface AgendaItemLike {
  voting_phase?: string | null;
}

interface PermissionsLike {
  can: (action: ActionType, resource: ResourceType) => boolean;
}

/**
 * Extract the current voting phase from an agenda item.
 */
export function getVotingPhase(agendaItem: AgendaItemLike): VotingPhase {
  const phase = agendaItem.voting_phase;
  if (phase === 'internal') return 'internal';
  if (phase === 'final' || phase === 'closed') return phase;
  return 'indication';
}

/**
 * Check whether a user is allowed to vote in the current phase.
 */
export function canUserVote(permissions: PermissionsLike, phase: VotingPhase): boolean {
  if (phase === 'closed') return false;
  return permissions.can('active_voting', 'events');
}

/**
 * Check whether a user is allowed to stand as a candidate in an election.
 */
export function canUserBeCandidate(permissions: PermissionsLike): boolean {
  return permissions.can('passive_voting', 'events');
}

/**
 * Format a result sentence for display.
 *
 * For votes: "The motion was <passed|rejected> with <share>% of votes."
 * For elections: "For the election of <role>, <winner> won with <share>% of votes."
 */
export function formatVoteResultSentence(
  type: 'vote' | 'election',
  result: 'passed' | 'rejected' | 'tie',
  winnerName?: string,
  roleName?: string,
  voteSharePercent?: number
): string {
  if (type === 'election') {
    if (result === 'tie') {
      return roleName
        ? translate('features.votes.resultSentence.electionTieForRole', { role: roleName })
        : translate('features.votes.resultSentence.electionTie');
    }
    if (!winnerName) {
      return roleName
        ? translate('features.votes.resultSentence.noWinnerForRole', { role: roleName })
        : translate('features.votes.resultSentence.noWinner');
    }
    if (roleName) {
      return voteSharePercent !== undefined
        ? translate('features.votes.resultSentence.winnerForRoleWithShare', {
            role: roleName,
            winner: winnerName,
            share: voteSharePercent,
          })
        : translate('features.votes.resultSentence.winnerForRole', {
            role: roleName,
            winner: winnerName,
          });
    }
    return voteSharePercent !== undefined
      ? translate('features.votes.resultSentence.winnerWithShare', {
          winner: winnerName,
          share: voteSharePercent,
        })
      : translate('features.votes.resultSentence.winner', { winner: winnerName });
  }

  // vote type
  if (result === 'tie') return translate('features.votes.resultSentence.voteTie');
  if (result === 'passed') {
    return voteSharePercent !== undefined
      ? translate('features.votes.resultSentence.motionAcceptedWithShare', {
          share: voteSharePercent,
        })
      : translate('features.votes.resultSentence.motionAccepted');
  }
  return voteSharePercent !== undefined
    ? translate('features.votes.resultSentence.motionRejectedWithShare', {
        share: voteSharePercent,
      })
    : translate('features.votes.resultSentence.motionRejected');
}

/**
 * Determine an appropriate badge variant for a voting phase.
 */
export function getPhaseVariant(phase: VotingPhase): 'secondary' | 'default' | 'outline' {
  switch (phase) {
    case 'indication':
    case 'internal':
      return 'secondary';
    case 'final':
      return 'default';
    case 'closed':
      return 'outline';
  }
}
