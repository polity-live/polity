import { useCallback, useEffect, useMemo } from 'react';
import { useAgendaItemByAmendment } from '@/zero/agendas/useAgendaState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { usePermissions } from '@/zero/rbac';
import {
  buildBranchDiffCandidates,
  getBranchEditingMode,
  getLatestBranchWithContent,
  getOrderedBranches,
  getWinnerBranch,
  type AmendmentProcessBranchSource,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { useChangeRequests } from '../hooks/useChangeRequests';
import {
  buildChangeRequestBranchSections,
  getAllChangeRequests,
  isVotingEditingMode,
  mapChangeRequestsToDiffMap,
  mapChangeRequestsToDiscussions,
  mapChangeRequestsToTimelineItems,
} from '../logic/changeRequestsViewModel';

interface ChangeRequestsPageContainerProps {
  amendmentId: string;
  userId?: string;
  requestedBranchId?: string;
  onBranchChange?: (branchId: string | null, options?: { replace?: boolean }) => void;
}

interface ProcessRunWithBranches {
  branches?: readonly AmendmentProcessBranchSource[] | null;
}

interface AmendmentProcessWithBranches {
  current_process_run?: ProcessRunWithBranches | null;
  process_runs?: readonly ProcessRunWithBranches[] | null;
}

function getAllProcessBranches(
  amendmentProcess: AmendmentProcessWithBranches | null | undefined
): AmendmentProcessBranchSource[] {
  const branchesById = new Map<string, AmendmentProcessBranchSource>();
  const addBranches = (branches: readonly AmendmentProcessBranchSource[] | null | undefined) => {
    for (const branch of branches ?? []) {
      if (!branchesById.has(branch.id)) {
        branchesById.set(branch.id, branch);
      }
    }
  };

  addBranches(amendmentProcess?.current_process_run?.branches);
  for (const processRun of amendmentProcess?.process_runs ?? []) {
    addBranches(processRun.branches);
  }

  return getOrderedBranches([...branchesById.values()]);
}

export function useChangeRequestsPageContainerController({
  amendmentId,
  userId,
  requestedBranchId,
  onBranchChange,
}: ChangeRequestsPageContainerProps) {
  const {
    amendment,
    document,
    openChangeRequests,
    approvedChangeRequests,
    declinedChangeRequests,
    isLoading,
  } = useChangeRequests(amendmentId, userId);
  const { amendmentProcess } = useAmendmentState({
    amendmentId,
    includeProcessData: true,
  });
  const currentRun = amendmentProcess?.current_process_run;
  const currentBranches = useMemo<AmendmentProcessBranchSource[]>(
    () => [...(currentRun?.branches ?? [])] as AmendmentProcessBranchSource[],
    [currentRun?.branches]
  );
  const branches = useMemo(
    () =>
      getAllProcessBranches(amendmentProcess as AmendmentProcessWithBranches | null | undefined),
    [amendmentProcess]
  );
  const activeBranchId = currentRun?.active_branch_id ?? null;
  const allChangeRequests = useMemo(
    () =>
      getAllChangeRequests({
        openChangeRequests,
        approvedChangeRequests,
        declinedChangeRequests,
      }),
    [openChangeRequests, approvedChangeRequests, declinedChangeRequests]
  );
  const selectedBranchId = useMemo(() => {
    if (!requestedBranchId) return null;
    if (branches.some(branch => branch.id === requestedBranchId)) return requestedBranchId;
    if (
      allChangeRequests.some(changeRequest => changeRequest.processBranchId === requestedBranchId)
    ) {
      return requestedBranchId;
    }
    return null;
  }, [allChangeRequests, branches, requestedBranchId]);
  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );
  const selectedBranchEditingMode = getBranchEditingMode(selectedBranch);

  const { agendaItemId } = useAgendaItemByAmendment(amendmentId);
  const {
    finalizeExpiredInternalChangeRequestVotes,
    finalizeInternalChangeRequestVote,
    voteOnChangeRequest,
  } = useAmendmentActions();
  const permissions = usePermissions({ amendment: amendment as never });

  const isInVotingStage = isVotingEditingMode(selectedBranchEditingMode);
  const canManageInternalVotes = Boolean(amendment) && permissions.canManage('amendments');
  const canVoteInternal = Boolean(amendment) && permissions.can('vote', 'amendments');
  const internalVotingBranchIds = useMemo(
    () =>
      currentBranches
        .filter(branch => getBranchEditingMode(branch) === 'vote_internal')
        .map(branch => branch.id),
    [currentBranches]
  );

  useEffect(() => {
    const selectedBranchIsCurrent = currentBranches.some(branch => branch.id === selectedBranchId);
    const targetBranchIds =
      selectedBranchIsCurrent && selectedBranchId && selectedBranchEditingMode === 'vote_internal'
        ? [selectedBranchId]
        : internalVotingBranchIds;
    const shouldFinalizeExpiredVotes =
      targetBranchIds.length > 0 && amendment?.internal_cr_voting_close_trigger === 'after_minutes';

    if (!shouldFinalizeExpiredVotes) return;

    let cancelled = false;
    const finalizeExpired = () => {
      if (cancelled) return;
      for (const branchId of targetBranchIds) {
        void finalizeExpiredInternalChangeRequestVotes({
          amendment_id: amendmentId,
          process_branch_id: branchId,
        });
      }
    };

    finalizeExpired();
    const intervalId = window.setInterval(finalizeExpired, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    amendment?.internal_cr_voting_close_trigger,
    amendmentId,
    finalizeExpiredInternalChangeRequestVotes,
    internalVotingBranchIds,
    currentBranches,
    selectedBranchEditingMode,
    selectedBranchId,
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

  const timelineItems = useMemo(
    () => mapChangeRequestsToTimelineItems(allChangeRequests),
    [allChangeRequests]
  );

  const diffMap = useMemo(() => mapChangeRequestsToDiffMap(allChangeRequests), [allChangeRequests]);

  const discussions = useMemo(
    () => mapChangeRequestsToDiscussions(allChangeRequests),
    [allChangeRequests]
  );

  const branchSections = useMemo(
    () =>
      buildChangeRequestBranchSections({
        branches,
        changeRequests: allChangeRequests,
        fallbackDocumentContent: document?.content as never,
        fallbackDiscussions: discussions,
      }),
    [allChangeRequests, branches, discussions, document]
  );

  const branchDiffCandidates = useMemo(
    () =>
      buildBranchDiffCandidates({
        branches: currentBranches,
        originalContent: document?.content ?? null,
        activeBranchId,
      }),
    [activeBranchId, currentBranches, document?.content]
  );
  const defaultDiffRightBranch =
    getWinnerBranch(currentBranches, activeBranchId) ?? getLatestBranchWithContent(currentBranches);

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
    branchSections,
    branchSelectorBranches: branches,
    selectedBranchId,
    selectedBranchEditingMode,
    branchDiffCandidates,
    defaultBranchDiffRightCandidateId: defaultDiffRightBranch?.id ?? null,
    onBranchChange,
    canManageInternalVotes,
    canVoteInternal,
    onCastInternalVote: handleCastInternalVote,
    onFinalizeInternalVote: handleFinalizeInternalVote,
  };
}
