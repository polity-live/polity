import type { Value } from 'platejs';

import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import {
  createMockCRTimelineItems,
  type CRSummary,
} from '@/features/agendas/logic/createMockCRTimelineItems';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';
import { isRenderableSuggestionType } from '../utils/suggestion-extraction';

import type { ChangeRequest } from '../hooks/useChangeRequests';

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
      changeRequestEntityId: cr.changeRequestEntityId,
    }));
}

export function isVotingEditingMode(editingMode: string | null | undefined): boolean {
  return editingMode === 'vote_event' || editingMode === 'vote_internal';
}

export function coerceDocumentContent(content: unknown): Value | undefined {
  return content as Value | undefined;
}
