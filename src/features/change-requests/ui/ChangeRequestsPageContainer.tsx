import { useMemo } from 'react';
import type { Value } from 'platejs';
import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import {
  createMockCRTimelineItems,
  type CRSummary,
} from '@/features/agendas/logic/createMockCRTimelineItems';
import { useAgendaItemByAmendment } from '@/zero/agendas/useAgendaState';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { ChangeRequestsView } from './ChangeRequestsView';

interface ChangeRequestsPageContainerProps {
  amendmentId: string;
  userId?: string;
}

export function ChangeRequestsPageContainer({
  amendmentId,
  userId,
}: ChangeRequestsPageContainerProps) {
  const {
    amendment,
    document,
    openChangeRequests,
    approvedChangeRequests,
    declinedChangeRequests,
    isLoading,
  } = useChangeRequests(amendmentId);

  const { agendaItemId } = useAgendaItemByAmendment(amendmentId);
  const isInVotingStage =
    amendment?.editing_mode === 'vote_event' || amendment?.editing_mode === 'vote_internal';

  const allChangeRequests = useMemo(
    () => [...openChangeRequests, ...approvedChangeRequests, ...declinedChangeRequests],
    [openChangeRequests, approvedChangeRequests, declinedChangeRequests]
  );

  const crSummaries = useMemo<CRSummary[]>(
    () =>
      allChangeRequests.map(cr => ({
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
      })),
    [allChangeRequests]
  );

  const timelineItems = useMemo(
    () => createMockCRTimelineItems(crSummaries) as unknown as ChangeRequestTimelineRow[],
    [crSummaries]
  );

  const diffMap = useMemo<Record<string, ChangeRequestDiffData>>(() => {
    const map: Record<string, ChangeRequestDiffData> = {};
    for (const cr of allChangeRequests) {
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
  }, [allChangeRequests]);

  const discussions = useMemo<TDiscussion[]>(
    () =>
      allChangeRequests
        .filter(cr => !!cr.crId)
        .map(cr => ({
          id: cr.id,
          crId: cr.crId,
          title: cr.title || cr.crId,
          userId: cr.userId,
          comments: [],
          createdAt: new Date(cr.createdAt),
          isResolved: cr.isResolved,
        })),
    [allChangeRequests]
  );

  return (
    <ChangeRequestsView
      amendmentId={amendmentId}
      approvedCount={approvedChangeRequests.length}
      declinedCount={declinedChangeRequests.length}
      openCount={openChangeRequests.length}
      allChangeRequestsCount={allChangeRequests.length}
      agendaItemId={agendaItemId ?? undefined}
      diffMap={diffMap}
      discussions={discussions}
      documentContent={document?.content as Value | undefined}
      editingMode={amendment?.editing_mode}
      hasAmendment={Boolean(amendment)}
      isInVotingStage={isInVotingStage}
      isLoading={isLoading}
      timelineItems={timelineItems}
      userId={userId}
    />
  );
}
