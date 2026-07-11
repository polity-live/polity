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

export function resolveCurrentVoteSequenceItem<T extends VoteSequenceStartableItem>({
  currentItemId,
  sequenceItems,
}: {
  currentItemId?: string | null;
  sequenceItems: readonly T[];
}): T | null {
  const finalOpenItem = sequenceItems.find(item => item.vote?.status === 'final');
  if (finalOpenItem) return finalOpenItem;

  const currentItem = currentItemId
    ? sequenceItems.find(item => item.id === currentItemId)
    : undefined;
  if (currentItem) return currentItem;

  return sequenceItems.find(item => item.status !== 'completed') ?? null;
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

export function resolvePreferredReorderedVoteSequenceItem<T extends VoteSequenceStartableItem>({
  sequenceItems,
}: {
  sequenceItems: readonly T[];
}): T | null {
  const finalOpenItem = sequenceItems.find(item => item.vote?.status === 'final');
  if (finalOpenItem) return finalOpenItem;

  return (
    sequenceItems.find(isStartableVoteSequenceItem) ??
    sequenceItems.find(item => item.status !== 'completed') ??
    null
  );
}

/**
 * Resolve the single sequence step that may enter its final phase. Indicative
 * votes can be open on multiple rows at once, but final votes remain strictly
 * ordered by the persisted sequence.
 */
export function resolveFinalStartableVoteSequenceItem<T extends VoteSequenceStartableItem>({
  sequenceItems,
}: {
  sequenceItems: readonly T[];
}): T | null {
  const finalOpenItem = sequenceItems.find(item => item.vote?.status === 'final');
  if (finalOpenItem) return finalOpenItem;

  return sequenceItems.find(isStartableVoteSequenceItem) ?? null;
}

export function resolveNextStartableVoteSequenceItem({
  selectedItemId,
  sequenceItems,
}: {
  selectedItemId: string | null;
  sequenceItems: readonly VoteSequenceStartableItem[];
}): VoteSequenceStartableItem | null {
  const finalStartableItem = resolveFinalStartableVoteSequenceItem({ sequenceItems });
  return finalStartableItem?.id === selectedItemId ? null : finalStartableItem;
}

export function resolveVoteSequenceSelectionUpdate({
  selectedItemId,
  sequenceItems,
  fallbackItemId,
  currentItemId,
  preferredItemId,
  preferSequenceItem = false,
}: {
  selectedItemId: string | null;
  sequenceItems: readonly VoteSequenceSelectionItem[];
  fallbackItemId: string | null;
  currentItemId?: string | null;
  preferredItemId?: string | null;
  preferSequenceItem?: boolean;
}): string | null | undefined {
  const selectedItem = selectedItemId
    ? sequenceItems.find(item => item.id === selectedItemId)
    : null;
  const currentItem = currentItemId ? sequenceItems.find(item => item.id === currentItemId) : null;
  const preferredItem = preferredItemId
    ? sequenceItems.find(item => item.id === preferredItemId)
    : null;

  if (!selectedItem) {
    return fallbackItemId ?? (selectedItemId ? null : undefined);
  }

  if (preferSequenceItem) {
    const itemToPrefer = preferredItem ?? currentItem;
    if (itemToPrefer && itemToPrefer.id !== selectedItem.id) {
      return itemToPrefer.id;
    }
  }

  if (selectedItem.status === 'completed' && currentItem && currentItem.id !== selectedItem.id) {
    return currentItem.id;
  }

  return undefined;
}
