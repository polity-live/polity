import { useMemo } from 'react';
import { useAgendaItemByAmendment } from '@/zero/agendas/useAgendaState';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { ChangeRequestsView } from './ChangeRequestsView';
import {
  coerceDocumentContent,
  getAllChangeRequests,
  isVotingEditingMode,
  mapChangeRequestsToDiffMap,
  mapChangeRequestsToDiscussions,
  mapChangeRequestsToTimelineItems,
} from '../logic/changeRequestsViewModel';

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
  const isInVotingStage = isVotingEditingMode(amendment?.editing_mode);

  const allChangeRequests = useMemo(
    () =>
      getAllChangeRequests({
        openChangeRequests,
        approvedChangeRequests,
        declinedChangeRequests,
      }),
    [openChangeRequests, approvedChangeRequests, declinedChangeRequests]
  );

  const timelineItems = useMemo(
    () => mapChangeRequestsToTimelineItems(allChangeRequests),
    [allChangeRequests]
  );

  const diffMap = useMemo(() => mapChangeRequestsToDiffMap(allChangeRequests), [allChangeRequests]);

  const discussions = useMemo(
    () => mapChangeRequestsToDiscussions(allChangeRequests),
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
      documentContent={coerceDocumentContent(document?.content)}
      editingMode={amendment?.editing_mode}
      hasAmendment={Boolean(amendment)}
      isInVotingStage={isInVotingStage}
      isLoading={isLoading}
      timelineItems={timelineItems}
      userId={userId}
    />
  );
}
