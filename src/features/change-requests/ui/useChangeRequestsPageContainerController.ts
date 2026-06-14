import { useMemo } from 'react';
import { useAgendaItemByAmendment } from '@/zero/agendas/useAgendaState';
import { useChangeRequests } from '../hooks/useChangeRequests';
import {
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
export function useChangeRequestsPageContainerController({
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

  return {
    amendmentId,
    userId,
    amendment,
    document,
    openChangeRequests,
    approvedChangeRequests,
    declinedChangeRequests,
    isLoading,
    agendaItemId,
    isInVotingStage,
    allChangeRequests,
    timelineItems,
    diffMap,
    discussions,
  };
}
