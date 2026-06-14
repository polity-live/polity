import type { Value } from 'platejs';

import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import {
  createMockCRTimelineItems,
  type CRSummary,
} from '@/features/agendas/logic/createMockCRTimelineItems';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';

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
  return [...openChangeRequests, ...approvedChangeRequests, ...declinedChangeRequests];
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
    map[cr.id] = {
      changeType: cr.type,
      originalText: cr.text || undefined,
      newText: cr.newText || undefined,
      properties: cr.properties as Record<string, string> | undefined,
      newProperties: cr.newProperties as Record<string, string> | undefined,
      justification: cr.justification || undefined,
    };
  }

  return map;
}

export function mapChangeRequestsToDiscussions(
  changeRequests: readonly ChangeRequest[]
): TDiscussion[] {
  return changeRequests
    .filter(cr => !!cr.crId)
    .map(cr => ({
      id: cr.id,
      crId: cr.crId,
      title: cr.title || cr.crId,
      userId: cr.userId,
      comments: [],
      createdAt: new Date(cr.createdAt),
      isResolved: cr.isResolved,
    }));
}

export function isVotingEditingMode(editingMode: string | null | undefined): boolean {
  return editingMode === 'vote_event' || editingMode === 'vote_internal';
}

export function coerceDocumentContent(content: unknown): Value | undefined {
  return content as Value | undefined;
}
