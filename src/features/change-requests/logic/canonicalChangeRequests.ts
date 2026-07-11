import type { ReadonlyJSONValue } from '@rocicorp/zero';
import {
  hasRenderableSuggestionContent,
  suggestionContentFromChangeRequestSnapshot,
} from '../utils/suggestion-extraction';
import { formatChangeRequestCrId, getChangeRequestSequenceNumber } from './changeRequestNumbering';

export interface CanonicalDiscussionEntry {
  id: string;
  crId?: string | null;
  changeRequestEntityId?: string | null;
  processBranchId?: string | null;
  process_branch_id?: string | null;
  title?: string | null;
  status?: string | null;
  confirmationStatus?: 'pending' | 'confirmed' | null;
  changeRequestStatus?: string | null;
}

export interface CanonicalSavedChangeRequest {
  id: string;
  process_branch_id?: string | null;
  processBranchId?: string | null;
  suggestion_id?: string | null;
  suggestionId?: string | null;
  title?: string | null;
  status?: string | null;
  voting_status?: string | null;
  votes_for?: number | null;
  votes_against?: number | null;
  votes_abstain?: number | null;
  votes?: readonly unknown[] | null;
  branch_sequence_number?: number | null;
  branchSequenceNumber?: number | null;
  changed_character_count?: number | null;
  changedCharacterCount?: number | null;
  source_type?: string | null;
  source_id?: string | null;
  source_title?: string | null;
  change_type?: string | null;
  original_text?: string | null;
  new_text?: string | null;
  original_properties?: ReadonlyJSONValue | null;
  new_properties?: ReadonlyJSONValue | null;
  created_at?: number | null;
  updated_at?: number | null;
}

export interface CanonicalChangeRequestRecord<
  TChangeRequest extends CanonicalSavedChangeRequest = CanonicalSavedChangeRequest,
  TDiscussion extends CanonicalDiscussionEntry = CanonicalDiscussionEntry,
> {
  logicalKey: string;
  discussion: TDiscussion | null;
  changeRequest: TChangeRequest | null;
  snapshotChangeRequest: TChangeRequest | null;
  duplicateChangeRequests: TChangeRequest[];
  displayCrId: string | null;
  displayTitle: string;
}

function stringKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getDiscussionProcessBranchId(discussion: CanonicalDiscussionEntry | null | undefined) {
  return discussion?.processBranchId ?? discussion?.process_branch_id ?? null;
}

function getChangeRequestProcessBranchId(
  changeRequest: Pick<CanonicalSavedChangeRequest, 'process_branch_id' | 'processBranchId'>
) {
  return changeRequest.process_branch_id ?? changeRequest.processBranchId ?? null;
}

function branchScopeKey(processBranchId: string | null | undefined) {
  return processBranchId ?? 'main';
}

function scopedLabelKey(processBranchId: string | null | undefined, label: string | null) {
  return label ? `${branchScopeKey(processBranchId)}:${label}` : null;
}

function addFirst<TKey, TValue>(map: Map<TKey, TValue>, key: TKey | null, value: TValue) {
  if (key == null || map.has(key)) {
    return;
  }

  map.set(key, value);
}

function isFinalChangeRequestStatus(status: string | null | undefined) {
  return (
    status === 'accepted' || status === 'approved' || status === 'rejected' || status === 'declined'
  );
}

function hasVoteSignal(changeRequest: CanonicalSavedChangeRequest) {
  return (
    (changeRequest.votes_for ?? 0) > 0 ||
    (changeRequest.votes_against ?? 0) > 0 ||
    (changeRequest.votes_abstain ?? 0) > 0 ||
    (changeRequest.votes?.length ?? 0) > 0
  );
}

export function hasChangeRequestDiffSnapshot(changeRequest: CanonicalSavedChangeRequest | null) {
  return (
    !!changeRequest &&
    hasRenderableSuggestionContent(suggestionContentFromChangeRequestSnapshot(changeRequest))
  );
}

function rowTimestamp(changeRequest: CanonicalSavedChangeRequest) {
  return changeRequest.updated_at ?? changeRequest.created_at ?? 0;
}

function compareCanonicalChangeRequests(
  discussion: CanonicalDiscussionEntry | null,
  left: CanonicalSavedChangeRequest,
  right: CanonicalSavedChangeRequest
) {
  const leftExplicit = discussion?.changeRequestEntityId === left.id ? 1 : 0;
  const rightExplicit = discussion?.changeRequestEntityId === right.id ? 1 : 0;
  const leftVoteSignal = hasVoteSignal(left) ? 1 : 0;
  const rightVoteSignal = hasVoteSignal(right) ? 1 : 0;
  if (leftVoteSignal !== rightVoteSignal) return rightVoteSignal - leftVoteSignal;

  if (leftExplicit !== rightExplicit) return rightExplicit - leftExplicit;

  const leftCompleted = left.voting_status === 'completed' ? 1 : 0;
  const rightCompleted = right.voting_status === 'completed' ? 1 : 0;
  if (leftCompleted !== rightCompleted) return rightCompleted - leftCompleted;

  const leftFinal = isFinalChangeRequestStatus(left.status) ? 1 : 0;
  const rightFinal = isFinalChangeRequestStatus(right.status) ? 1 : 0;
  if (leftFinal !== rightFinal) return rightFinal - leftFinal;

  const leftSnapshot = hasChangeRequestDiffSnapshot(left) ? 1 : 0;
  const rightSnapshot = hasChangeRequestDiffSnapshot(right) ? 1 : 0;
  if (leftSnapshot !== rightSnapshot) return rightSnapshot - leftSnapshot;

  const byTimestamp = rowTimestamp(right) - rowTimestamp(left);
  return byTimestamp !== 0 ? byTimestamp : right.id.localeCompare(left.id);
}

export function findDiscussionForChangeRequest<TDiscussion extends CanonicalDiscussionEntry>(
  discussions: readonly TDiscussion[],
  changeRequest: Pick<
    CanonicalSavedChangeRequest,
    | 'id'
    | 'title'
    | 'process_branch_id'
    | 'processBranchId'
    | 'suggestion_id'
    | 'suggestionId'
    | 'branch_sequence_number'
    | 'branchSequenceNumber'
  >
) {
  const processBranchId = getChangeRequestProcessBranchId(changeRequest);
  const canonicalCrId = formatChangeRequestCrId(getChangeRequestSequenceNumber(changeRequest));
  const suggestionId = changeRequest.suggestion_id ?? changeRequest.suggestionId ?? null;

  return (
    discussions.find(discussion => suggestionId && discussion.id === suggestionId) ??
    discussions.find(discussion => discussion.changeRequestEntityId === changeRequest.id) ??
    discussions.find(
      discussion =>
        getDiscussionProcessBranchId(discussion) === processBranchId &&
        !!canonicalCrId &&
        (discussion.crId === canonicalCrId || discussion.title === canonicalCrId)
    ) ??
    discussions.find(
      discussion =>
        getDiscussionProcessBranchId(discussion) === processBranchId &&
        !!changeRequest.title &&
        (discussion.crId === changeRequest.title || discussion.title === changeRequest.title)
    ) ??
    null
  );
}

export function buildCanonicalChangeRequestRecords<
  TChangeRequest extends CanonicalSavedChangeRequest,
  TDiscussion extends CanonicalDiscussionEntry,
>({
  discussions,
  changeRequests,
}: {
  discussions: readonly TDiscussion[] | null | undefined;
  changeRequests: readonly TChangeRequest[] | null | undefined;
}): CanonicalChangeRequestRecord<TChangeRequest, TDiscussion>[] {
  const discussionList = Array.isArray(discussions) ? discussions : [];
  const changeRequestList = Array.isArray(changeRequests) ? changeRequests : [];
  const recordByKey = new Map<
    string,
    {
      logicalKey: string;
      discussion: TDiscussion | null;
      changeRequests: TChangeRequest[];
    }
  >();
  const recordKeyByDiscussionId = new Map<string, string>();
  const recordKeyByEntityId = new Map<string, string>();
  const recordKeyByLabel = new Map<string, string>();

  const ensureRecord = (key: string, discussion: TDiscussion | null) => {
    let record = recordByKey.get(key);
    if (!record) {
      record = { logicalKey: key, discussion, changeRequests: [] };
      recordByKey.set(key, record);
    } else if (!record.discussion && discussion) {
      record.discussion = discussion;
    }
    return record;
  };

  for (const discussion of discussionList) {
    if (!discussion.id || (!discussion.crId && !discussion.changeRequestEntityId)) {
      continue;
    }

    const processBranchId = getDiscussionProcessBranchId(discussion);
    const recordKey = `discussion:${branchScopeKey(processBranchId)}:${discussion.id}`;
    ensureRecord(recordKey, discussion);
    recordKeyByDiscussionId.set(discussion.id, recordKey);
    addFirst(recordKeyByEntityId, stringKey(discussion.changeRequestEntityId), recordKey);
    addFirst(
      recordKeyByLabel,
      scopedLabelKey(processBranchId, stringKey(discussion.crId)),
      recordKey
    );
    addFirst(
      recordKeyByLabel,
      scopedLabelKey(processBranchId, stringKey(discussion.title)),
      recordKey
    );
  }

  for (const changeRequest of changeRequestList) {
    const processBranchId = getChangeRequestProcessBranchId(changeRequest);
    const matchingDiscussion = findDiscussionForChangeRequest(discussionList, changeRequest);
    const matchingRecordKey =
      (matchingDiscussion?.id ? recordKeyByDiscussionId.get(matchingDiscussion.id) : undefined) ??
      recordKeyByEntityId.get(changeRequest.id) ??
      (changeRequest.title
        ? recordKeyByLabel.get(
            scopedLabelKey(processBranchId, stringKey(changeRequest.title)) ?? ''
          )
        : undefined);

    const recordKey =
      matchingRecordKey ??
      (changeRequest.title
        ? `row-title:${branchScopeKey(processBranchId)}:${changeRequest.title}`
        : `row-id:${branchScopeKey(processBranchId)}:${changeRequest.id}`);
    const record = ensureRecord(recordKey, matchingDiscussion);
    record.changeRequests.push(changeRequest);
    recordKeyByEntityId.set(changeRequest.id, recordKey);
    addFirst(
      recordKeyByLabel,
      scopedLabelKey(processBranchId, stringKey(changeRequest.title)),
      recordKey
    );
  }

  return [...recordByKey.values()]
    .map(record => {
      const duplicateChangeRequests = [...record.changeRequests];
      const sorted = [...duplicateChangeRequests].sort((left, right) =>
        compareCanonicalChangeRequests(record.discussion, left, right)
      );
      const changeRequest = sorted[0] ?? null;
      const snapshotChangeRequest =
        (changeRequest && hasChangeRequestDiffSnapshot(changeRequest) ? changeRequest : null) ??
        sorted.find(hasChangeRequestDiffSnapshot) ??
        null;
      const displayCrId =
        (changeRequest
          ? formatChangeRequestCrId(getChangeRequestSequenceNumber(changeRequest))
          : null) ??
        record.discussion?.crId ??
        (changeRequest?.title?.startsWith('CR-') ? changeRequest.title : null);
      const displayTitle =
        record.discussion?.title ??
        changeRequest?.title ??
        displayCrId ??
        record.logicalKey.replace(/^(discussion|row-title|row-id):/, '');

      return {
        logicalKey: record.logicalKey,
        discussion: record.discussion,
        changeRequest,
        snapshotChangeRequest,
        duplicateChangeRequests,
        displayCrId,
        displayTitle,
      };
    })
    .sort((left, right) => {
      const leftNumber =
        getChangeRequestSequenceNumber({
          branch_sequence_number: left.changeRequest?.branch_sequence_number,
          branchSequenceNumber: left.changeRequest?.branchSequenceNumber,
          crId: left.displayCrId,
        }) ?? 0;
      const rightNumber =
        getChangeRequestSequenceNumber({
          branch_sequence_number: right.changeRequest?.branch_sequence_number,
          branchSequenceNumber: right.changeRequest?.branchSequenceNumber,
          crId: right.displayCrId,
        }) ?? 0;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      return left.displayTitle.localeCompare(right.displayTitle);
    });
}
