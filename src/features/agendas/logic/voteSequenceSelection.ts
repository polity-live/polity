export interface VoteSequenceSelectionItem {
  id: string;
  status?: string | null;
}

export interface VoteSequenceStartableItem extends VoteSequenceSelectionItem {
  vote?: { id?: string | null; status?: string | null } | null;
  _originalStatus?: string | null;
  _votePlaceholder?: boolean | null;
  _voteStepKind?: string | null;
  change_request?: {
    status?: string | null;
    voting_status?: string | null;
    confirmation_status?: string | null;
    confirmationStatus?: string | null;
    change_request_status?: string | null;
    changeRequestStatus?: string | null;
  } | null;
}

function isPendingSubmissionItem(item: VoteSequenceStartableItem) {
  const cr = item.change_request;
  return (
    item._originalStatus === 'pending_submission' ||
    cr?.status === 'pending_submission' ||
    cr?.voting_status === 'pending_submission' ||
    cr?.change_request_status === 'pending_submission' ||
    cr?.changeRequestStatus === 'pending_submission' ||
    cr?.confirmation_status === 'pending' ||
    cr?.confirmationStatus === 'pending'
  );
}

function isMockVoteSequenceItem(item: VoteSequenceStartableItem) {
  return item.id.startsWith('mock-cr-') || item.vote?.id?.startsWith('mock-vote-');
}

function normalizeVotePhase(value?: string | null) {
  if (value === 'final') return 'final';
  if (value === 'closed') return 'closed';
  if (value === 'indicative') return 'indication';
  return null;
}

export function getStartableVoteSequencePhase(item: VoteSequenceStartableItem) {
  if (item.status === 'completed') return 'closed';

  const votePhase = normalizeVotePhase(item.vote?.status);
  if (votePhase === 'closed' || votePhase === 'final') return votePhase;
  if (item.status === 'pending') return 'pending';
  if (votePhase === 'indication') return 'indication';

  return null;
}

export function isStartableVoteSequenceItem(item: VoteSequenceStartableItem) {
  if (!item.vote?.id) return false;
  if (item._votePlaceholder) return false;
  if (isMockVoteSequenceItem(item)) return false;
  if (isPendingSubmissionItem(item)) return false;

  const phase = getStartableVoteSequencePhase(item);
  return phase === 'pending' || phase === 'indication';
}

export function resolveNextStartableVoteSequenceItem({
  selectedItemId,
  sequenceItems,
}: {
  selectedItemId: string | null;
  sequenceItems: readonly VoteSequenceStartableItem[];
}): VoteSequenceStartableItem | null {
  const selectedIndex = selectedItemId
    ? sequenceItems.findIndex(item => item.id === selectedItemId)
    : -1;
  const selectedItem = selectedIndex >= 0 ? sequenceItems[selectedIndex] : null;

  if (selectedItem && isStartableVoteSequenceItem(selectedItem)) {
    return null;
  }

  if (selectedIndex >= 0) {
    return sequenceItems.slice(selectedIndex + 1).find(isStartableVoteSequenceItem) ?? null;
  }

  return sequenceItems.find(isStartableVoteSequenceItem) ?? null;
}

export function resolveVoteSequenceSelectionUpdate({
  selectedItemId,
  sequenceItems,
  fallbackItemId,
  currentItemId,
}: {
  selectedItemId: string | null;
  sequenceItems: readonly VoteSequenceSelectionItem[];
  fallbackItemId: string | null;
  currentItemId?: string | null;
}): string | null | undefined {
  const selectedItem = selectedItemId
    ? sequenceItems.find(item => item.id === selectedItemId)
    : null;

  if (!selectedItem) {
    return fallbackItemId ?? (selectedItemId ? null : undefined);
  }

  if (selectedItem.status === 'completed' && currentItemId && currentItemId !== selectedItem.id) {
    return currentItemId;
  }

  return undefined;
}
