import { useCallback, useEffect, useMemo } from 'react';
import { useAgendaItemByAmendment } from '@/zero/agendas/useAgendaState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { usePermissions } from '@/zero/rbac';
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
  } = useChangeRequests(amendmentId, userId);

  const { agendaItemId } = useAgendaItemByAmendment(amendmentId);
  const {
    finalizeExpiredInternalChangeRequestVotes,
    finalizeInternalChangeRequestVote,
    voteOnChangeRequest,
  } = useAmendmentActions();
  const permissions = usePermissions({ amendment: amendment as never });

  const isInVotingStage = isVotingEditingMode(amendment?.editing_mode);
  const canManageInternalVotes = Boolean(amendment) && permissions.canUpdate('amendments');
  const canVoteInternal = Boolean(amendment) && permissions.can('vote', 'amendments');

  useEffect(() => {
    const shouldFinalizeExpiredVotes =
      amendment?.editing_mode === 'vote_internal' &&
      amendment?.internal_cr_voting_close_trigger === 'after_minutes';

    if (!shouldFinalizeExpiredVotes) return;

    let cancelled = false;
    const finalizeExpired = () => {
      if (cancelled) return;
      void finalizeExpiredInternalChangeRequestVotes({ amendment_id: amendmentId });
    };

    finalizeExpired();
    const intervalId = window.setInterval(finalizeExpired, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    amendment?.editing_mode,
    amendment?.internal_cr_voting_close_trigger,
    amendmentId,
    finalizeExpiredInternalChangeRequestVotes,
  ]);

  const handleFinalizeInternalVote = useCallback(
    async (changeRequestId: string) => {
      await finalizeInternalChangeRequestVote({ change_request_id: changeRequestId });
    },
    [finalizeInternalChangeRequestVote]
  );

  const handleCastInternalVote = useCallback(
    async (item: { change_request_id?: string | null; id?: string }, choiceId: string) => {
      const changeRequestId = item.change_request_id ?? item.id;
      if (!changeRequestId) return;
      const vote = choiceId.includes('-yes-')
        ? 'accept'
        : choiceId.includes('-no-')
          ? 'reject'
          : 'abstain';

      await voteOnChangeRequest({
        id: crypto.randomUUID(),
        change_request_id: changeRequestId,
        vote,
      });
    },
    [voteOnChangeRequest]
  );

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
    canManageInternalVotes,
    canVoteInternal,
    onCastInternalVote: handleCastInternalVote,
    onFinalizeInternalVote: handleFinalizeInternalVote,
  };
}
