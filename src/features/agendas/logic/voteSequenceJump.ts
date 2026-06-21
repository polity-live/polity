export interface VoteSequenceItemLike {
  id: string;
  is_final_vote?: boolean | null;
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

export function isFinalAmendmentPlaceholder(item: unknown) {
  return getVoteStepKind(item) === 'final_amendment_placeholder';
}

export function isRealFinalAmendmentVoteItem(item?: VoteSequenceItemLike | null) {
  return Boolean(item?.is_final_vote && item.vote?.id && !item._votePlaceholder);
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

  const existingFinalVoteItem = args.sequenceItems.find(isRealFinalAmendmentVoteItem);
  if (existingFinalVoteItem?.id) {
    return {
      isClosingJump: true,
      shouldInitialize: false,
      targetItemId: existingFinalVoteItem.id,
    };
  }

  const finalPlaceholderItem = args.sequenceItems.find(isFinalAmendmentPlaceholder);
  return {
    isClosingJump: true,
    shouldInitialize: true,
    targetItemId: finalPlaceholderItem?.id ?? null,
  };
}
