import type { Value } from 'platejs';

import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import {
  createMockCRTimelineItems,
  type CRSummary,
} from '@/features/agendas/logic/createMockCRTimelineItems';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';
import { normalizeEditingMode, type EditingMode } from '@/zero/amendments/editing-mode-policy';
import {
  countChangedCharacters,
  extractSuggestionContent,
  hasRenderableSuggestionContent,
  isRenderableSuggestionType,
} from '../utils/suggestion-extraction';
import { decorateBranchScopedChangeRequests } from './branchScopedDisplay';
import { buildCanonicalChangeRequestRecords } from './canonicalChangeRequests';

import type { ChangeRequest } from '../hooks/useChangeRequests';

interface ChangeRequestBranchStep {
  order_index?: number | null;
  source_group?: { name?: string | null } | null;
  target_group?: { name?: string | null } | null;
  workflow_step?: { label?: string | null } | null;
  event_id?: string | null;
  event?: { id?: string | null; title?: string | null } | null;
}

export interface ChangeRequestBranchSource {
  id: string;
  title?: string | null;
  status?: string | null;
  editing_mode?: string | null;
  resolution?: string | null;
  created_at?: number | string | null;
  document?: { content?: unknown } | null;
  document_version?: { content?: unknown } | null;
  discussions?: unknown;
  step_runs?: readonly ChangeRequestBranchStep[] | null;
}

export interface ChangeRequestBranchSection {
  id: string;
  branchId: string | null;
  branchDisplayNumber?: number;
  title: string;
  description?: string | null;
  status?: string | null;
  editingMode?: EditingMode | null;
  resolution?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  totalCount: number;
  openCount: number;
  approvedCount: number;
  declinedCount: number;
  timelineItems: ChangeRequestTimelineRow[];
  diffMap: Record<string, ChangeRequestDiffData>;
  discussions: TDiscussion[];
  documentContent?: Value;
}

export function getAllChangeRequests({
  openChangeRequests,
  approvedChangeRequests,
  declinedChangeRequests,
}: {
  openChangeRequests: readonly ChangeRequest[];
  approvedChangeRequests: readonly ChangeRequest[];
  declinedChangeRequests: readonly ChangeRequest[];
}) {
  return sortChangeRequestsByDisplayOrder([
    ...openChangeRequests,
    ...approvedChangeRequests,
    ...declinedChangeRequests,
  ]);
}

export function sortChangeRequestsByDisplayOrder(changeRequests: readonly ChangeRequest[]) {
  return [...changeRequests].sort((left, right) => {
    const leftNumber = Number.isFinite(left.crNumber)
      ? left.crNumber
      : parseInt(left.crId?.replace('CR-', '') || '0');
    const rightNumber = Number.isFinite(right.crNumber)
      ? right.crNumber
      : parseInt(right.crId?.replace('CR-', '') || '0');

    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    const byCreatedAt = (left.createdAt ?? 0) - (right.createdAt ?? 0);
    if (byCreatedAt !== 0) return byCreatedAt;
    return (left.title || left.crId || left.id).localeCompare(
      right.title || right.crId || right.id
    );
  });
}

export function mapChangeRequestsToSummaries(
  changeRequests: readonly ChangeRequest[]
): CRSummary[] {
  return changeRequests.map(cr => ({
    id: cr.id,
    crId: cr.crId,
    displayCrId: cr.displayCrId ?? cr.crId,
    branchDisplayNumber: cr.branchDisplayNumber,
    branchScopedCrNumber: cr.branchScopedCrNumber,
    branchSequenceNumber: cr.branchSequenceNumber,
    changedCharacterCount: cr.changedCharacterCount,
    title: cr.title || cr.crId,
    description: cr.description || '',
    status: cr.resolution
      ? cr.resolution === 'approved' || cr.resolution === 'accepted'
        ? 'approved'
        : 'declined'
      : cr.status,
    type: cr.type,
    text: cr.text,
    newText: cr.newText,
    properties: cr.properties as Record<string, string>,
    newProperties: cr.newProperties as Record<string, string>,
    justification: cr.justification,
    votesFor: cr.votesFor,
    votesAgainst: cr.votesAgainst,
    votesAbstain: cr.votesAbstain,
    suggestionId: cr.suggestionId,
    discussionId: cr.discussionId,
    changeRequestEntityId: cr.changeRequestEntityId ?? null,
    processBranchId: cr.processBranchId ?? null,
    logicalKey: cr.logicalKey ?? null,
    votingDeadline: cr.votingDeadline,
    closeTrigger: cr.closeTrigger,
    eligibleVoterCount: cr.eligibleVoterCount,
    votedCollaboratorCount: cr.votedCollaboratorCount,
    resolutionMethod: cr.resolutionMethod,
    visibilityScope: cr.visibilityScope,
    resolvedInMode: cr.resolvedInMode,
    votingStatus: cr.votingStatus,
    userVote: cr.userVote,
    confirmationStatus: cr.confirmationStatus,
    changeRequestStatus: cr.changeRequestStatus,
  }));
}

export function mapChangeRequestsToTimelineItems(
  changeRequests: readonly ChangeRequest[]
): ChangeRequestTimelineRow[] {
  return createMockCRTimelineItems(
    mapChangeRequestsToSummaries(changeRequests)
  ) as unknown as ChangeRequestTimelineRow[];
}

export function mapChangeRequestsToDiffMap(
  changeRequests: readonly ChangeRequest[]
): Record<string, ChangeRequestDiffData> {
  const map: Record<string, ChangeRequestDiffData> = {};

  for (const cr of changeRequests) {
    const hasTextDiff = !!cr.text || !!cr.newText;
    const hasPropertyDiff =
      Object.keys(cr.properties ?? {}).length > 0 || Object.keys(cr.newProperties ?? {}).length > 0;

    if (!isRenderableSuggestionType(cr.type) || (!hasTextDiff && !hasPropertyDiff)) {
      continue;
    }

    const diff = {
      changeType: cr.type,
      originalText: cr.text || undefined,
      newText: cr.newText || undefined,
      properties: cr.properties as Record<string, string> | undefined,
      newProperties: cr.newProperties as Record<string, string> | undefined,
      justification: cr.justification || undefined,
    };

    map[cr.id] = diff;
    if (cr.logicalKey) {
      map[cr.logicalKey] = diff;
    }
    if (cr.crId) {
      map[cr.crId] = diff;
    }
    if (cr.suggestionId) {
      map[cr.suggestionId] = diff;
    }
    if (cr.changeRequestEntityId) {
      map[cr.changeRequestEntityId] = diff;
    }
  }

  return map;
}

export function mapChangeRequestsToDiscussions(
  changeRequests: readonly ChangeRequest[]
): TDiscussion[] {
  return changeRequests
    .filter(cr => !!cr.crId)
    .map(cr => ({
      id: cr.discussionId ?? cr.suggestionId ?? cr.id,
      crId: cr.crId,
      displayCrId: cr.displayCrId ?? cr.crId,
      branchDisplayNumber: cr.branchDisplayNumber,
      branchScopedCrNumber: cr.branchScopedCrNumber,
      branchSequenceNumber: cr.branchSequenceNumber,
      title: cr.title || cr.crId,
      userId: cr.userId,
      comments: [],
      createdAt: new Date(cr.createdAt),
      isResolved: cr.isResolved,
      votesFor: cr.votesFor,
      votesAgainst: cr.votesAgainst,
      votesAbstain: cr.votesAbstain,
      votingDeadline: cr.votingDeadline,
      closeTrigger: cr.closeTrigger,
      eligibleVoterCount: cr.eligibleVoterCount,
      votedCollaboratorCount: cr.votedCollaboratorCount,
      resolutionMethod: cr.resolutionMethod,
      visibilityScope: cr.visibilityScope,
      resolvedInMode: cr.resolvedInMode,
      votingStatus: cr.votingStatus,
      confirmationStatus: cr.confirmationStatus ?? undefined,
      changeRequestStatus: cr.changeRequestStatus ?? null,
      changeRequestEntityId: cr.changeRequestEntityId,
      processBranchId: cr.processBranchId,
    }));
}

function isApprovedStatus(status: string | null | undefined) {
  return status === 'approved' || status === 'accepted';
}

function isDeclinedStatus(status: string | null | undefined) {
  return status === 'declined' || status === 'rejected';
}

function getBranchCreatedAt(branch: ChangeRequestBranchSource) {
  const value = branch.created_at;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getOrderedBranchSteps(branch: ChangeRequestBranchSource) {
  return [...(branch.step_runs ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
}

export function getChangeRequestBranchLabel(branch: ChangeRequestBranchSource) {
  const stepLabels = getOrderedBranchSteps(branch)
    .map(
      step =>
        step.target_group?.name ??
        step.source_group?.name ??
        step.workflow_step?.label ??
        (typeof step.order_index === 'number' ? `Step ${step.order_index + 1}` : null)
    )
    .filter(Boolean);

  return stepLabels.length > 0 ? stepLabels.join(' -> ') : (branch.title ?? 'Branch');
}

function getBranchDisplayEvent(branch: ChangeRequestBranchSource) {
  return getOrderedBranchSteps(branch).find(step => step.event_id || step.event?.id) ?? null;
}

function getBranchDocumentContent(branch: ChangeRequestBranchSource) {
  return branch.document?.content ?? branch.document_version?.content ?? null;
}

function getChangeRequestCounts(changeRequests: readonly ChangeRequest[]) {
  const approvedCount = changeRequests.filter(
    request => isApprovedStatus(request.status) || isApprovedStatus(request.resolution)
  ).length;
  const declinedCount = changeRequests.filter(
    request => isDeclinedStatus(request.status) || isDeclinedStatus(request.resolution)
  ).length;

  return {
    totalCount: changeRequests.length,
    approvedCount,
    declinedCount,
    openCount: Math.max(0, changeRequests.length - approvedCount - declinedCount),
  };
}

function discussionTimestamp(discussion: TDiscussion) {
  const value = discussion.createdAt;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeRawDiscussionDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return new Date(Number.isFinite(parsed) ? parsed : 0);
  }
  return new Date(0);
}

function normalizeRawDiscussionStatus(value: unknown): TDiscussion['status'] {
  return value === 'pending' || value === 'accepted' || value === 'rejected' ? value : undefined;
}

function normalizeRawConfirmationStatus(value: unknown): TDiscussion['confirmationStatus'] {
  return value === 'pending' || value === 'confirmed' ? value : undefined;
}

export function mapRawDiscussionsToDiscussions(
  rawDiscussions: unknown,
  processBranchId?: string | null
): TDiscussion[] {
  if (!Array.isArray(rawDiscussions)) return [];

  return rawDiscussions
    .filter((discussion): discussion is Record<string, unknown> => {
      return Boolean(discussion && typeof discussion === 'object' && 'id' in discussion);
    })
    .map(discussion => ({
      id: String(discussion.id),
      crId: typeof discussion.crId === 'string' ? discussion.crId : undefined,
      displayCrId: typeof discussion.displayCrId === 'string' ? discussion.displayCrId : undefined,
      branchDisplayNumber:
        typeof discussion.branchDisplayNumber === 'number'
          ? discussion.branchDisplayNumber
          : undefined,
      branchScopedCrNumber:
        typeof discussion.branchScopedCrNumber === 'number'
          ? discussion.branchScopedCrNumber
          : undefined,
      branchSequenceNumber:
        typeof discussion.branchSequenceNumber === 'number'
          ? discussion.branchSequenceNumber
          : undefined,
      title: typeof discussion.title === 'string' ? discussion.title : undefined,
      userId: typeof discussion.userId === 'string' ? discussion.userId : '',
      comments: Array.isArray(discussion.comments) ? (discussion.comments as never[]) : [],
      createdAt: normalizeRawDiscussionDate(discussion.createdAt),
      isResolved: Boolean(discussion.isResolved),
      status: normalizeRawDiscussionStatus(discussion.status),
      confirmationStatus: normalizeRawConfirmationStatus(discussion.confirmationStatus),
      changeRequestStatus:
        typeof discussion.changeRequestStatus === 'string' ? discussion.changeRequestStatus : null,
      changeRequestEntityId:
        typeof discussion.changeRequestEntityId === 'string'
          ? discussion.changeRequestEntityId
          : undefined,
      processBranchId,
    }));
}

function isDiscussionRepresentedByRequest(
  discussion: TDiscussion,
  changeRequests: readonly ChangeRequest[]
) {
  return changeRequests.some(changeRequest => {
    return (
      changeRequest.discussionId === discussion.id ||
      changeRequest.suggestionId === discussion.id ||
      (!!discussion.changeRequestEntityId &&
        (changeRequest.id === discussion.changeRequestEntityId ||
          changeRequest.changeRequestEntityId === discussion.changeRequestEntityId)) ||
      (!!discussion.crId &&
        (changeRequest.crId === discussion.crId || changeRequest.title === discussion.crId)) ||
      (!!discussion.title && changeRequest.title === discussion.title)
    );
  });
}

function findDiscussionForRequest(
  discussions: readonly TDiscussion[],
  changeRequest: ChangeRequest
) {
  return (
    discussions.find(
      discussion =>
        !!discussion.changeRequestEntityId &&
        (discussion.changeRequestEntityId === changeRequest.id ||
          discussion.changeRequestEntityId === changeRequest.changeRequestEntityId)
    ) ??
    discussions.find(
      discussion =>
        discussion.id === changeRequest.discussionId || discussion.id === changeRequest.suggestionId
    ) ??
    discussions.find(
      discussion =>
        !!discussion.crId &&
        (discussion.crId === changeRequest.crId || discussion.crId === changeRequest.title)
    ) ??
    discussions.find(
      discussion => !!discussion.title && discussion.title === changeRequest.title
    ) ??
    null
  );
}

function withBranchDiscussionContent({
  changeRequests,
  discussions,
  documentContent,
}: {
  changeRequests: readonly ChangeRequest[];
  discussions: readonly TDiscussion[];
  documentContent?: Value;
}) {
  return changeRequests.map(changeRequest => {
    const discussion = findDiscussionForRequest(discussions, changeRequest);
    if (!discussion?.id) {
      return changeRequest;
    }

    const suggestionContent = extractSuggestionContent(discussion.id, documentContent);
    const discussionPatch = {
      discussionId: changeRequest.discussionId ?? discussion.id,
      suggestionId: changeRequest.suggestionId ?? discussion.id,
    };

    if (!hasRenderableSuggestionContent(suggestionContent)) {
      return {
        ...changeRequest,
        ...discussionPatch,
      };
    }

    return {
      ...changeRequest,
      ...discussionPatch,
      type: suggestionContent.type,
      text: suggestionContent.text,
      newText: suggestionContent.newText,
      properties: suggestionContent.properties,
      newProperties: suggestionContent.newProperties,
      proposedChange: suggestionContent.newText || suggestionContent.text,
    };
  });
}

function createDiscussionFallbackChangeRequest({
  discussion,
  logicalKey,
  displayCrId,
  displayTitle,
  documentContent,
  processBranchId,
}: {
  discussion: TDiscussion;
  logicalKey: string;
  displayCrId: string | null;
  displayTitle: string;
  documentContent?: Value;
  processBranchId: string | null;
}): ChangeRequest {
  const suggestionContent = discussion.id
    ? extractSuggestionContent(discussion.id, documentContent)
    : { type: 'unknown', text: '', newText: '', properties: {}, newProperties: {} };
  const persistedChangedCharacterCount =
    (
      discussion as {
        changed_character_count?: number | null;
        changedCharacterCount?: number | null;
      }
    ).changed_character_count ??
    (
      discussion as {
        changed_character_count?: number | null;
        changedCharacterCount?: number | null;
      }
    ).changedCharacterCount;
  const computedChangedCharacterCount = countChangedCharacters(suggestionContent);
  const resolvedStatus = discussion.status;
  const isResolved = isApprovedStatus(resolvedStatus) || isDeclinedStatus(resolvedStatus);
  const isPendingSubmission = discussion.confirmationStatus === 'pending';
  const crId = displayCrId ?? discussion.crId ?? '';
  const createdAt = discussionTimestamp(discussion);

  return {
    id: discussion.changeRequestEntityId ?? discussion.id ?? logicalKey,
    processBranchId,
    logicalKey,
    discussionId: discussion.id,
    suggestionId: discussion.id,
    crId,
    crNumber: parseInt(crId.replace('CR-', '') || '0'),
    title: displayTitle,
    description: (discussion as { description?: string | null }).description ?? '',
    type: suggestionContent.type,
    text: suggestionContent.text,
    newText: suggestionContent.newText,
    properties: suggestionContent.properties,
    newProperties: suggestionContent.newProperties,
    proposedChange: suggestionContent.newText || suggestionContent.text,
    justification: (discussion as { justification?: string | null }).justification ?? '',
    isResolved,
    status: isPendingSubmission ? 'pending_submission' : (resolvedStatus ?? 'open'),
    resolution: isResolved ? (resolvedStatus ?? null) : null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt,
    userId: discussion.userId ?? '',
    votesFor: discussion.votesFor ?? 0,
    votesAgainst: discussion.votesAgainst ?? 0,
    votesAbstain: discussion.votesAbstain ?? 0,
    votingDeadline: discussion.votingDeadline ?? null,
    closeTrigger: discussion.closeTrigger ?? null,
    eligibleVoterCount: discussion.eligibleVoterCount ?? 0,
    votedCollaboratorCount: discussion.votedCollaboratorCount ?? 0,
    resolutionMethod: discussion.resolutionMethod ?? null,
    visibilityScope: discussion.visibilityScope ?? null,
    resolvedInMode: discussion.resolvedInMode ?? null,
    votingStatus: isPendingSubmission ? 'pending_submission' : (discussion.votingStatus ?? null),
    branchSequenceNumber: discussion.branchSequenceNumber ?? null,
    changedCharacterCount:
      typeof persistedChangedCharacterCount === 'number' &&
      Number.isFinite(persistedChangedCharacterCount) &&
      persistedChangedCharacterCount > 0
        ? persistedChangedCharacterCount
        : computedChangedCharacterCount,
    confirmationStatus: discussion.confirmationStatus ?? null,
    changeRequestStatus:
      discussion.changeRequestStatus ?? (isPendingSubmission ? 'pending_submission' : null),
    userVote: null,
    comments: discussion.comments || [],
    votes: [],
    changeRequestEntityId: discussion.changeRequestEntityId,
  };
}

function createDiscussionFallbackChangeRequests({
  discussions,
  changeRequests,
  documentContent,
  processBranchId,
}: {
  discussions: readonly TDiscussion[];
  changeRequests: readonly ChangeRequest[];
  documentContent?: Value;
  processBranchId: string | null;
}) {
  const records = buildCanonicalChangeRequestRecords({
    discussions,
    changeRequests: [],
  });

  return records
    .filter(record => record.discussion)
    .map(record => {
      const discussion = record.discussion as TDiscussion;
      if (isDiscussionRepresentedByRequest(discussion, changeRequests)) {
        return null;
      }

      return createDiscussionFallbackChangeRequest({
        discussion,
        logicalKey: record.logicalKey,
        displayCrId: record.displayCrId,
        displayTitle: record.displayTitle,
        documentContent,
        processBranchId,
      });
    })
    .filter(Boolean) as ChangeRequest[];
}

function withDisplayFieldsFromGeneratedDiscussions(
  discussions: readonly TDiscussion[],
  generatedDiscussions: readonly TDiscussion[]
): TDiscussion[] {
  return discussions.map(discussion => {
    const generatedDiscussion = generatedDiscussions.find(candidate => {
      return (
        candidate.id === discussion.id ||
        (!!discussion.changeRequestEntityId &&
          candidate.changeRequestEntityId === discussion.changeRequestEntityId) ||
        (!!discussion.crId && candidate.crId === discussion.crId)
      );
    });

    if (!generatedDiscussion?.displayCrId) {
      return discussion;
    }

    return {
      ...discussion,
      displayCrId: generatedDiscussion.displayCrId,
      branchDisplayNumber: generatedDiscussion.branchDisplayNumber,
      branchScopedCrNumber: generatedDiscussion.branchScopedCrNumber,
    };
  });
}

export function buildChangeRequestBranchSections({
  branches,
  changeRequests,
}: {
  branches: readonly ChangeRequestBranchSource[];
  changeRequests: readonly ChangeRequest[];
}): ChangeRequestBranchSection[] {
  const sortedBranches = [...branches].sort((left, right) => {
    const byCreatedAt = getBranchCreatedAt(left) - getBranchCreatedAt(right);
    return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
  });
  const knownBranchIds = new Set(sortedBranches.map(branch => branch.id));
  const sortedChangeRequests = sortChangeRequestsByDisplayOrder(changeRequests);
  const requestsByBranchId = new Map<string, ChangeRequest[]>();
  const historicalRequestsByBranchId = new Map<string, ChangeRequest[]>();

  for (const changeRequest of sortedChangeRequests) {
    const branchId = changeRequest.processBranchId;
    if (!branchId) {
      continue;
    }

    const targetMap = knownBranchIds.has(branchId)
      ? requestsByBranchId
      : historicalRequestsByBranchId;
    const branchRequests = targetMap.get(branchId) ?? [];
    branchRequests.push(changeRequest);
    targetMap.set(branchId, branchRequests);
  }

  const sections: ChangeRequestBranchSection[] = sortedBranches.map(branch => {
    const branchDocumentContent = getBranchDocumentContent(branch) as Value | undefined;
    const rawDiscussions = mapRawDiscussionsToDiscussions(branch.discussions, branch.id);
    const branchRowRequests = withBranchDiscussionContent({
      changeRequests: requestsByBranchId.get(branch.id) ?? [],
      discussions: rawDiscussions,
      documentContent: branchDocumentContent,
    });
    const branchFallbackRequests = createDiscussionFallbackChangeRequests({
      discussions: rawDiscussions,
      changeRequests: branchRowRequests,
      documentContent: branchDocumentContent,
      processBranchId: branch.id,
    });
    const branchRequests = decorateBranchScopedChangeRequests(sortedBranches, [
      ...branchRowRequests,
      ...branchFallbackRequests,
    ]);
    const fallbackBranchDiscussions = mapChangeRequestsToDiscussions(branchRequests);
    const branchDiscussions =
      rawDiscussions.length > 0
        ? withDisplayFieldsFromGeneratedDiscussions(rawDiscussions, fallbackBranchDiscussions)
        : fallbackBranchDiscussions;
    const branchEvent = getBranchDisplayEvent(branch);
    const counts = getChangeRequestCounts(branchRequests);
    const branchDisplayNumber =
      sortedBranches.findIndex(candidate => candidate.id === branch.id) + 1;

    return {
      id: `branch-${branch.id}`,
      branchId: branch.id,
      branchDisplayNumber,
      title: getChangeRequestBranchLabel(branch),
      description: branch.title ?? null,
      status: branch.status ?? null,
      editingMode: normalizeEditingMode(branch.editing_mode),
      resolution: branch.resolution ?? null,
      eventId: branchEvent?.event_id ?? branchEvent?.event?.id ?? null,
      eventTitle: branchEvent?.event?.title ?? null,
      ...counts,
      timelineItems: mapChangeRequestsToTimelineItems(branchRequests),
      diffMap: mapChangeRequestsToDiffMap(branchRequests),
      discussions: branchDiscussions,
      documentContent: branchDocumentContent,
    } satisfies ChangeRequestBranchSection;
  });

  const historicalBranchIds = [...historicalRequestsByBranchId.keys()].sort((left, right) => {
    const leftCreatedAt = historicalRequestsByBranchId.get(left)?.[0]?.createdAt ?? 0;
    const rightCreatedAt = historicalRequestsByBranchId.get(right)?.[0]?.createdAt ?? 0;
    const byCreatedAt = leftCreatedAt - rightCreatedAt;
    return byCreatedAt !== 0 ? byCreatedAt : left.localeCompare(right);
  });

  for (const branchId of historicalBranchIds) {
    const branchRequests = historicalRequestsByBranchId.get(branchId) ?? [];

    sections.push({
      id: `historical-branch-${branchId}`,
      branchId,
      title: `Historical branch ${branchId.slice(0, 8)}`,
      description: 'Change requests from an earlier process branch',
      ...getChangeRequestCounts(branchRequests),
      timelineItems: mapChangeRequestsToTimelineItems(branchRequests),
      diffMap: mapChangeRequestsToDiffMap(branchRequests),
      discussions: mapChangeRequestsToDiscussions(branchRequests),
    });
  }

  return sections;
}

export function isVotingEditingMode(editingMode: EditingMode | null | undefined): boolean {
  return editingMode === 'event_final_closing_vote' || editingMode === 'vote_internal';
}
