export interface VoteSequenceItemLike {
  id: string;
  is_closing_vote?: boolean | null;
  vote?: { id?: string | null } | null;
  _votePlaceholder?: boolean;
  _voteStepKind?: string;
}

export function getVoteStepKind(item: unknown) {
  return (item as { _voteStepKind?: string } | null | undefined)?._voteStepKind ?? null;
}

export function isChangeRequestVotesPlaceholder(item: unknown) {
  return getVoteStepKind(item) === 'change_request_votes_placeholder';
}

export function isClosingVotePlaceholder(item: unknown) {
  return getVoteStepKind(item) === 'closing_placeholder';
}

export function isRealClosingVoteItem(item?: VoteSequenceItemLike | null) {
  return Boolean(item?.is_closing_vote && item.vote?.id && !item._votePlaceholder);
}

export function resolveClosingJumpTarget(args: {
  item: VoteSequenceItemLike | null | undefined;
  nonFinalItemCount: number;
  sequenceItems: readonly VoteSequenceItemLike[];
}) {
  if (!isChangeRequestVotesPlaceholder(args.item) || args.nonFinalItemCount !== 0) {
    return {
      isClosingJump: false,
      shouldInitialize: false,
      targetItemId: null as string | null,
    };
  }

  const existingClosingVoteItem = args.sequenceItems.find(isRealClosingVoteItem);
  if (existingClosingVoteItem?.id) {
    return {
      isClosingJump: true,
      shouldInitialize: false,
      targetItemId: existingClosingVoteItem.id,
    };
  }

  const closingPlaceholderItem = args.sequenceItems.find(isClosingVotePlaceholder);
  return {
    isClosingJump: true,
    shouldInitialize: true,
    targetItemId: closingPlaceholderItem?.id ?? null,
  };
}
