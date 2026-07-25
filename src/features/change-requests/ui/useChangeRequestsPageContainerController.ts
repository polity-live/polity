import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useAgendaItemByAmendment } from '@/zero/agendas/useAgendaState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { usePermissions } from '@/zero/rbac';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import {
  getVotePhase,
  useAgendaItemCRVoting,
} from '@/features/agendas/hooks/useAgendaItemCRVoting';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
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
import { normalizeEditingMode, type EditingMode } from '@/zero/amendments/editing-mode-policy';
import type { VoteSubmissionContext } from '@/features/shared/ui/voting';

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

function isEventVoteCardsMode(editingMode: EditingMode | null | undefined) {
  return editingMode === 'suggest_event' || editingMode === 'event_final_closing_vote';
}

function getTimelineItemBranchId(item: ChangeRequestTimelineRow): string | null {
  const rawItem = item as ChangeRequestTimelineRow & {
    processBranchId?: string | null;
    _processBranchId?: string | null;
  };
  const rawChangeRequest = item.change_request as
    { process_branch_id?: string | null; processBranchId?: string | null } | null | undefined;

  return (
    item.process_branch_id ??
    rawItem.processBranchId ??
    rawItem._processBranchId ??
    rawChangeRequest?.process_branch_id ??
    rawChangeRequest?.processBranchId ??
    null
  );
}

function filterTimelineItemsForBranch(
  items: readonly ChangeRequestTimelineRow[],
  branchId: string | null
) {
  return items.filter(item => {
    const itemBranchId = getTimelineItemBranchId(item);
    return branchId ? itemBranchId === branchId : !itemBranchId;
  });
}

function isObsoleteTimelineItem(item: ChangeRequestTimelineRow) {
  const changeRequest = item.change_request as
    | {
        status?: string | null;
        change_request_status?: string | null;
        obsolete_at?: number | null;
        obsolete_reason?: string | null;
      }
    | null
    | undefined;

  return Boolean(
    changeRequest?.status === 'obsolete' ||
    changeRequest?.change_request_status === 'obsolete' ||
    changeRequest?.obsolete_at ||
    changeRequest?.obsolete_reason
  );
}

function getDialogPhaseForItem(item: ChangeRequestTimelineRow | null) {
  if (!item) return 'indication' as const;
  const phase = getVotePhase(item);
  if (phase === 'final') return 'final' as const;
  if (phase === 'closed') return 'closed' as const;
  return 'indication' as const;
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
    streetDesigns,
    openChangeRequests,
    approvedChangeRequests,
    declinedChangeRequests,
    obsoleteChangeRequests = [],
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
      [...allChangeRequests, ...obsoleteChangeRequests].some(
        changeRequest => changeRequest.processBranchId === requestedBranchId
      )
    ) {
      return requestedBranchId;
    }
    return null;
  }, [allChangeRequests, branches, obsoleteChangeRequests, requestedBranchId]);
  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );
  const selectedBranchEditingMode = getBranchEditingMode(selectedBranch);
  const amendmentEditingMode = normalizeEditingMode(
    (amendment as { editing_mode?: string | null } | null | undefined)?.editing_mode
  );

  const { agendaItem, agendaItemId } = useAgendaItemByAmendment(amendmentId);
  const {
    finalizeExpiredInternalChangeRequestVotes,
    finalizeInternalChangeRequestVote,
    voteOnChangeRequest,
  } = useAmendmentActions();
  const { ensureEventSuggestionChangeRequestVotes } = useAgendaActions();
  const agendaCrVoting = useAgendaItemCRVoting(agendaItemId, userId);
  const { verifyVotingPassword } = useVotingPasswordActions();
  const amendmentPermissions = usePermissions({ amendment: amendment as never });
  const eventId = agendaItem?.event_id ?? agendaItem?.event?.id ?? undefined;
  const eventPermissions = usePermissions({ eventId });
  const [eventVoteDialogOpen, setEventVoteDialogOpen] = useState(false);
  const [selectedEventVoteItemId, setSelectedEventVoteItemId] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordVerifying, setIsPasswordVerifying] = useState(false);

  const isInVotingStage =
    isVotingEditingMode(selectedBranchEditingMode) ||
    isEventVoteCardsMode(selectedBranchEditingMode) ||
    isEventVoteCardsMode(amendmentEditingMode);
  const canManageInternalVotes = Boolean(amendment) && amendmentPermissions.canManage('amendments');
  const canVoteInternal = Boolean(amendment) && amendmentPermissions.can('vote', 'amendments');
  const canVoteEvent = Boolean(eventId) && eventPermissions.canVote();
  const internalVotingBranchIds = useMemo(
    () =>
      currentBranches
        .filter(branch => getBranchEditingMode(branch) === 'vote_internal')
        .map(branch => branch.id),
    [currentBranches]
  );
  const eventSuggestionBranchIds = useMemo<(string | null)[]>(() => {
    if (selectedBranchId) {
      return selectedBranchEditingMode === 'suggest_event' ? [selectedBranchId] : [];
    }

    const branchIds = branches
      .filter(branch => getBranchEditingMode(branch) === 'suggest_event')
      .map(branch => branch.id);
    if (branchIds.length > 0) {
      return branchIds;
    }

    return branches.length === 0 && amendmentEditingMode === 'suggest_event' ? [null] : [];
  }, [amendmentEditingMode, branches, selectedBranchEditingMode, selectedBranchId]);
  const eventSuggestionBranchIdsKey = eventSuggestionBranchIds.map(id => id ?? 'main').join('|');
  const eventSuggestionChangeRequestSignal = useMemo(
    () =>
      allChangeRequests
        .map(
          changeRequest =>
            `${changeRequest.id}:${changeRequest.status}:${changeRequest.processBranchId ?? 'main'}:${changeRequest.confirmationStatus ?? ''}:${changeRequest.changeRequestStatus ?? ''}`
        )
        .join('|'),
    [allChangeRequests]
  );

  useEffect(() => {
    if (!agendaItemId || eventSuggestionBranchIds.length === 0) return;

    for (const branchId of eventSuggestionBranchIds) {
      void ensureEventSuggestionChangeRequestVotes({
        amendment_id: amendmentId,
        agenda_item_id: agendaItemId,
        process_branch_id: branchId,
      });
    }
  }, [
    agendaItemId,
    amendmentId,
    ensureEventSuggestionChangeRequestVotes,
    eventSuggestionChangeRequestSignal,
    eventSuggestionBranchIds,
    eventSuggestionBranchIdsKey,
  ]);

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

  const mockTimelineItems = useMemo(
    () => mapChangeRequestsToTimelineItems(allChangeRequests),
    [allChangeRequests]
  );
  const realAgendaTimelineItems = agendaCrVoting.crTimeline;
  const activeAgendaTimelineItems = useMemo(
    () => realAgendaTimelineItems.filter(item => !isObsoleteTimelineItem(item)),
    [realAgendaTimelineItems]
  );
  const timelineItems = useMemo(() => {
    const branchFilteredItems = selectedBranchId
      ? filterTimelineItemsForBranch(activeAgendaTimelineItems, selectedBranchId)
      : activeAgendaTimelineItems;

    return branchFilteredItems.length > 0 ? branchFilteredItems : mockTimelineItems;
  }, [activeAgendaTimelineItems, mockTimelineItems, selectedBranchId]);
  const selectedEventVoteItem = useMemo(
    () =>
      activeAgendaTimelineItems.find(item => item.id === selectedEventVoteItemId) ??
      timelineItems.find(item => item.id === selectedEventVoteItemId) ??
      null,
    [activeAgendaTimelineItems, selectedEventVoteItemId, timelineItems]
  );
  const selectedEventVoteChoices = useMemo(
    () =>
      (selectedEventVoteItem?.vote?.choices ?? []).map(choice => ({
        id: choice.id,
        label: choice.label || 'Choice',
      })),
    [selectedEventVoteItem?.vote?.choices]
  );
  const selectedEventVoteTitle = useMemo(() => {
    if (!selectedEventVoteItem) return amendment?.title ?? undefined;
    if (selectedEventVoteItem.vote?.title) return selectedEventVoteItem.vote.title;
    if (selectedEventVoteItem.change_request?.title) {
      return selectedEventVoteItem.change_request.title;
    }
    return amendment?.title ?? undefined;
  }, [amendment?.title, selectedEventVoteItem]);
  const selectedEventVotePhase = getDialogPhaseForItem(selectedEventVoteItem);

  const handleOpenEventVoteDialog = useCallback((itemId: string) => {
    setSelectedEventVoteItemId(itemId);
    setPasswordError(null);
    setEventVoteDialogOpen(true);
  }, []);

  const handleCastEventVote = useCallback(
    async (item: ChangeRequestTimelineRow, choiceId: string) => {
      await agendaCrVoting.castCRVote(item, choiceId);
    },
    [agendaCrVoting]
  );

  const handleCastEventVoteFromDialog = useCallback(
    async (choiceId: string, context?: VoteSubmissionContext) => {
      if (!selectedEventVoteItem) return;
      await agendaCrVoting.castCRVote(selectedEventVoteItem, choiceId, context);
    },
    [agendaCrVoting, selectedEventVoteItem]
  );

  const handleSubmitVotingPassword = useCallback(
    async (password: string) => {
      setPasswordError(null);
      setIsPasswordVerifying(true);
      try {
        await verifyVotingPassword(password);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : translateText('generated.inline.0010_verification_failed_e10d7e51');
        setPasswordError(message);
        throw error;
      } finally {
        setIsPasswordVerifying(false);
      }
    },
    [verifyVotingPassword]
  );

  const diffMap = useMemo(() => mapChangeRequestsToDiffMap(allChangeRequests), [allChangeRequests]);

  const discussions = useMemo(
    () => mapChangeRequestsToDiscussions(allChangeRequests),
    [allChangeRequests]
  );

  const branchSections = useMemo(() => {
    const sections = buildChangeRequestBranchSections({
      branches,
      changeRequests: allChangeRequests,
    });

    return sections.map(section => {
      if (!isEventVoteCardsMode(section.editingMode)) {
        return section;
      }

      const realItems = filterTimelineItemsForBranch(activeAgendaTimelineItems, section.branchId);
      if (realItems.length === 0) {
        return section;
      }

      return {
        ...section,
        totalCount: realItems.length,
        openCount: realItems.filter(item => item.status !== 'completed').length,
        approvedCount: section.approvedCount,
        declinedCount: section.declinedCount,
        timelineItems: realItems,
      };
    });
  }, [activeAgendaTimelineItems, allChangeRequests, branches]);

  const obsoleteBranchSections = useMemo(
    () =>
      buildChangeRequestBranchSections({
        branches,
        changeRequests: obsoleteChangeRequests,
      }),
    [branches, obsoleteChangeRequests]
  );
  const obsoleteTimelineItems = useMemo(() => {
    if (selectedBranchId) {
      return (
        obsoleteBranchSections.find(section => section.branchId === selectedBranchId)
          ?.timelineItems ?? []
      );
    }

    if (obsoleteBranchSections.length > 0) {
      return obsoleteBranchSections.flatMap(section => section.timelineItems);
    }

    return mapChangeRequestsToTimelineItems(obsoleteChangeRequests);
  }, [obsoleteBranchSections, obsoleteChangeRequests, selectedBranchId]);
  const obsoleteDiffMap = useMemo(
    () => mapChangeRequestsToDiffMap(obsoleteChangeRequests),
    [obsoleteChangeRequests]
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
    streetDesigns,
    openChangeRequests,
    approvedChangeRequests,
    declinedChangeRequests,
    obsoleteChangeRequests,
    isLoading,
    agendaItemId,
    isInVotingStage,
    allChangeRequests,
    timelineItems,
    diffMap,
    discussions,
    branchSections,
    obsoleteBranchSections,
    obsoleteTimelineItems,
    obsoleteDiffMap,
    branchSelectorBranches: branches,
    selectedBranchId,
    selectedBranchEditingMode,
    branchDiffCandidates,
    defaultBranchDiffRightCandidateId: defaultDiffRightBranch?.id ?? null,
    onBranchChange,
    canManageInternalVotes,
    canVoteInternal,
    canVoteEvent,
    hasUserVotedOnEventCR: agendaCrVoting.hasUserVoted,
    getEventCRSelectedChoiceIds: agendaCrVoting.getUserSelectedChoiceIds,
    onCastEventCRVote: handleCastEventVote,
    onOpenEventCRVoteDialog: handleOpenEventVoteDialog,
    eventVoteDialogOpen,
    setEventVoteDialogOpen,
    selectedEventVoteTitle,
    selectedEventVoteChoices,
    selectedEventVotePhase,
    onCastEventVoteFromDialog: handleCastEventVoteFromDialog,
    onSubmitVotingPassword: handleSubmitVotingPassword,
    passwordError,
    isPasswordVerifying,
    onCastInternalVote: handleCastInternalVote,
    onFinalizeInternalVote: handleFinalizeInternalVote,
  };
}
