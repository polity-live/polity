import { featureThemeClassName } from '@/features/shared/theme';
/**
 * Pure helper functions for amendment wiki page.
 */

import type { AmendmentFullRow } from '@/zero/amendments/queries';
import type { VoteValue } from '@/features/shared/ui/voting/VoteButtons';

export function getSupportStatus(
  groupId: string,
  supportConfirmations: { group?: { id: string }; status?: string }[]
): 'active' | 'pending' | 'declined' {
  const confirmation = supportConfirmations.find(
    c => c.group?.id === groupId && c.status !== 'confirmed'
  );
  if (!confirmation) return 'active';
  if (confirmation.status === 'pending') return 'pending';
  if (confirmation.status === 'declined') return 'declined';
  return 'active';
}

type VotableAmendment = Pick<
  NonNullable<AmendmentFullRow>,
  'upvotes' | 'downvotes' | 'support_votes'
>;

type SupportVoteRow = NonNullable<NonNullable<AmendmentFullRow>['support_votes']>[number];

function normalizeVoteValue(vote: number | null | undefined): Exclude<VoteValue, 0> {
  return vote === -1 ? -1 : 1;
}

export function deriveVoteState(amendment: VotableAmendment, userId: string | undefined) {
  const supportVotes = amendment.support_votes ?? [];
  const hasSupportVotes = supportVotes.length > 0;

  const upvotes = hasSupportVotes
    ? supportVotes.filter(vote => normalizeVoteValue(vote.vote) === 1).length
    : amendment.upvotes || 0;
  const downvotes = hasSupportVotes
    ? supportVotes.filter(vote => normalizeVoteValue(vote.vote) === -1).length
    : amendment.downvotes || 0;
  const score = upvotes - downvotes;

  const userVote = userId
    ? supportVotes.find(vote => (vote.user?.id ?? vote.user_id) === userId)
    : undefined;
  const currentVoteValue: VoteValue = userVote ? normalizeVoteValue(userVote.vote) : 0;

  return {
    score,
    upvotes,
    downvotes,
    supporterCount: upvotes,
    userVote: userVote as SupportVoteRow | undefined,
    currentVoteValue,
    hasUpvoted: currentVoteValue === 1,
    hasDownvoted: currentVoteValue === -1,
  };
}

export const AMENDMENT_STATUS_COLORS: Record<string, string> = {
  passed: featureThemeClassName('amendmentAmendmentHelpersSuccessBadge'),
  rejected: featureThemeClassName('amendmentAmendmentHelpersDangerBadge'),
  vote_internal: featureThemeClassName('amendmentAmendmentHelpersWarningBadge'),
  vote_event: featureThemeClassName('amendmentAmendmentHelpersWarningBadge'),
  suggest_internal: featureThemeClassName('amendmentAmendmentHelpersWarningBadgeAlpha'),
  suggest_event: featureThemeClassName('amendmentAmendmentHelpersWarningBadgeAlpha'),
  edit: featureThemeClassName('amendmentAmendmentHelpersInfoBadge'),
  view: featureThemeClassName('amendmentAmendmentHelpersNeutralBadge'),
};
