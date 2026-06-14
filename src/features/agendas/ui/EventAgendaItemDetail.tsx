import { useNavigate } from '@tanstack/react-router';
import { useEventAgendaItem } from '../hooks/useEventAgendaItem';
import { useAgendaActionBar } from '../hooks/useAgendaActionBar';
import { useAgendaNavigation } from '../hooks/useAgendaNavigation';
import { type MergeVariantCandidate } from './MergeVariantComparisonPanel';
import { usePermissions } from '@/zero/rbac';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useEventById } from '@/zero/events';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/editor/types';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAgendaItemCRVoting, getVotePhase } from '../hooks/useAgendaItemCRVoting';
import { extractAmendmentCRSummaries } from '../logic/extractAmendmentCRSummaries';
import { createMockCRTimelineItems } from '../logic/createMockCRTimelineItems';
import { buildFinalVoteFromAgendaVote } from '../logic/buildFinalVoteFromAgendaVote';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import { extractSuggestionContent } from '@/features/change-requests/utils/suggestion-extraction';
import type { ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
  isLikelyActiveAmendmentStep,
} from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
import {
  getOfflineTallySuccessMessage,
  resolveOfflineTallyMode,
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
} from '../logic/offlineTallyToolbar';
import {
  buildNamedElectionResultsModel,
  buildNamedVoteResultsModel,
} from '../logic/buildNamedBallotResults';
import { useDelegateAssemblyParticipantsComposition } from '@/features/events/hooks/useDelegateAssemblyParticipantsComposition';
import { getEffectiveVotingPhase, resolveAttendanceMode } from '../logic/agendaUiHelpers';

function getEffectiveCRVotingPhase(
  item?: {
    status?: string | null;
    vote?: { status?: string | null } | null;
  } | null
): string | null {
  if (!item) return null;
  if (item.status === 'pending') return 'pending';

  const phase = getVotePhase(item as Parameters<typeof getVotePhase>[0]);
  if (phase === 'final_vote') return 'final_vote';
  if (phase === 'closed') return 'closed';
  return 'indication';
}
import { EventAgendaItemDetailView } from './EventAgendaItemDetailView';
export function EventAgendaItemDetail({
  eventId,
  agendaItemId,
}: {
  eventId: string;
  agendaItemId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateSpeaker } = useAgendaActions();
  const {
    agendaItem,
    event,
    user,
    isLoading,
    votingLoading,
    addingSpeaker,
    election,
    candidates,
    vote,
    choices,
    userElector,
    userVoter,
    estimatedStartTime,
    forwardingContext,
    handleDelete,
    handleAddToSpeakerList,
  } = useEventAgendaItem(eventId, agendaItemId);
  const delegateAssignmentMeta = (
    election as { delegate_assignment_meta?: { targetEventId?: string } | null } | null
  )?.delegate_assignment_meta;
  const { event: delegateTargetEvent } = useEventById(delegateAssignmentMeta?.targetEventId);

  const { can, canVote, canBeCandidate } = usePermissions({ eventId });
  const canManageAgenda = can('manage', 'agendaItems');
  const canManageVotes = can('manage_votes', 'events');
  const canManageOfflineTallies = can('manage_votes', 'events') || canManageAgenda;
  const hasVotingRight = canVote();
  const hasCandidateRight = canBeCandidate();
  const { event: rosterEvent } = useEventById(eventId);
  const attendanceMode = resolveAttendanceMode(rosterEvent);
  const disableVoteButton = attendanceMode === 'offline';
  const allowsOfflineTallies = attendanceMode === 'hybrid' || attendanceMode === 'offline';
  const confirmedOfflineParticipantCount =
    rosterEvent?.offline_participants?.filter(
      participant =>
        participant.attendance_status === 'confirmed' &&
        participant.participation_channel === 'offline'
    ).length ?? 0;

  // Agenda navigation (Previous / Complete / Next)
  const agendaNav = useAgendaNavigation(eventId);

  const { verifyVotingPassword } = useVotingPasswordActions();
  const { upsertOfflineTally: upsertElectionOfflineTally } = useElectionActions();
  const { upsertOfflineTally: upsertVoteOfflineTally } = useVoteActions();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordVerifying, setIsPasswordVerifying] = useState(false);
  const [offlineTallyDialogOpen, setOfflineTallyDialogOpen] = useState(false);
  const [offlineTallyPasswordError, setOfflineTallyPasswordError] = useState<string | null>(null);
  const [offlineTallySubmitError, setOfflineTallySubmitError] = useState<string | null>(null);
  const [isOfflineTallySubmitting, setIsOfflineTallySubmitting] = useState(false);
  const [namedResultsTarget, setNamedResultsTarget] = useState<'election' | 'vote' | null>(null);
  const effectiveVotingPhase = getEffectiveVotingPhase(
    election?.status ?? vote?.status,
    agendaItem?.voting_phase ?? null
  );

  const {
    crTimeline,
    currentItem: currentCRItem,
    completedItems,
    progress,
    isTimelineComplete,
    allCRsProcessed,
    hasUserVoted: hasUserVotedOnCR,
    getUserSelectedChoiceIds,
    startIndicativePhase,
    startFinalPhase,
    closeVoting,
    castCRVote,
  } = useAgendaItemCRVoting(agendaItemId, user?.id);

  // Action bar hook — pass election/vote data for phase management
  const actionBarHook = useAgendaActionBar({
    eventId,
    currentAgendaItem: agendaItem
      ? {
          id: agendaItem.id,
          type: agendaItem.type,
          status: agendaItem.status,
          voting_phase: effectiveVotingPhase,
          speaker_list: agendaItem.speaker_list ?? undefined,
        }
      : null,
    eventTitle: event?.title ?? undefined,
    election: election ?? undefined,
    vote: vote ?? undefined,
    electorId: userElector?.id,
    voterId: userVoter?.id,
  });

  const [, setMarkingSpeakerComplete] = useState<string | null>(null);
  const [selectedCRToolbarItemId, setSelectedCRToolbarItemId] = useState<string | null>(null);

  // Build mock CR items for pre-voting display
  const mockCRItems = useMemo(() => {
    if (!agendaItem?.amendment_id) return [];
    if (crTimeline.length > 0) return [];

    const amendment = agendaItem.amendment;
    if (!amendment) return [];

    const summaries = extractAmendmentCRSummaries(
      amendment.discussions as readonly unknown[] | null | undefined,
      amendment.change_requests as
        | readonly {
            id: string;
            title?: string | null;
            description?: string | null;
            status?: string | null;
          }[]
        | null
        | undefined
    );

    return createMockCRTimelineItems(summaries);
  }, [agendaItem?.amendment_id, agendaItem?.amendment, crTimeline.length]);

  // Extract document content for editor preview
  const documentContent = agendaItem?.amendment?.document?.content as Value | undefined;

  // Build TDiscussion array from amendment discussions for SuggestionViewToggle mapping
  const amendmentDiscussions = useMemo<TDiscussion[]>(() => {
    const rawDiscussions = agendaItem?.amendment?.discussions;
    if (!rawDiscussions || !Array.isArray(rawDiscussions)) return [];
    return (rawDiscussions as Record<string, unknown>[]).map(d => ({
      id: (d.id as string) ?? '',
      crId: (d.crId as string) ?? null,
      title: (d.title as string) ?? '',
      userId: (d.userId as string) ?? '',
      comments: (d.comments as TDiscussion['comments']) ?? [],
      createdAt: new Date((d.createdAt as number) ?? 0),
      isResolved: (d.isResolved as boolean) ?? false,
    }));
  }, [agendaItem?.amendment?.discussions]);

  // Build diffMap from document content for each discussion
  const crDiffMap = useMemo<Record<string, ChangeRequestDiffData>>(() => {
    if (!documentContent || !amendmentDiscussions.length) return {};
    const map: Record<string, ChangeRequestDiffData> = {};
    for (const d of amendmentDiscussions) {
      if (!d.id) continue;
      const content = extractSuggestionContent(d.id, documentContent);
      if (content.type === 'unknown' && !content.text && !content.newText) continue;
      map[d.id] = {
        changeType: content.type,
        originalText: content.text || undefined,
        newText: content.newText || undefined,
        properties: content.properties as Record<string, string> | undefined,
        newProperties: content.newProperties as Record<string, string> | undefined,
      };
    }
    return map;
  }, [documentContent, amendmentDiscussions]);

  const hasAmendmentCRs = crTimeline.length > 0 || mockCRItems.length > 0;
  const crDisplayItemsBase =
    crTimeline.length > 0 ? crTimeline : (mockCRItems as unknown as ChangeRequestTimelineRow[]);
  const isCRVotingActive = crTimeline.length > 0;

  // Synthesize a final vote item from the agenda item's own vote.
  // If the timeline already includes a final vote (legacy data), prefer that.
  const timelineHasFinalVote = crDisplayItemsBase.some(i => i.is_final_vote);
  const synthesizedFinalVoteItem = useMemo(() => {
    if (timelineHasFinalVote) return null;
    if (!vote || !hasAmendmentCRs) return null;
    const orderIndex = crDisplayItemsBase.length;
    return buildFinalVoteFromAgendaVote(vote, orderIndex) as unknown as ChangeRequestTimelineRow;
  }, [timelineHasFinalVote, vote, hasAmendmentCRs, crDisplayItemsBase.length]);

  // Combine CR items + synthesized final vote
  const crDisplayItems = useMemo(() => {
    if (!synthesizedFinalVoteItem) return crDisplayItemsBase;
    return [...crDisplayItemsBase, synthesizedFinalVoteItem];
  }, [crDisplayItemsBase, synthesizedFinalVoteItem]);

  // Derive the effective final vote item (from timeline or synthesized)
  const effectiveFinalVoteItem = useMemo(
    () => crDisplayItems.find(i => i.is_final_vote) ?? null,
    [crDisplayItems]
  );

  // Whether the vote is embedded in the CR list (so we can hide standalone AgendaVoteSection)
  const isVoteInCRList = hasAmendmentCRs && !!effectiveFinalVoteItem && !!vote;

  const nonFinalCRItems = useMemo(
    () => crTimeline.filter(item => !item.is_final_vote),
    [crTimeline]
  );

  const fallbackSelectedCRItemId = useMemo(() => {
    if (currentCRItem?.id) return currentCRItem.id;

    const nextPendingCR = nonFinalCRItems.find(item => item.status !== 'completed');
    if (nextPendingCR) return nextPendingCR.id;

    return effectiveFinalVoteItem?.id ?? null;
  }, [currentCRItem?.id, nonFinalCRItems, effectiveFinalVoteItem?.id]);

  useEffect(() => {
    if (currentCRItem?.id && currentCRItem.id !== selectedCRToolbarItemId) {
      setSelectedCRToolbarItemId(currentCRItem.id);
      return;
    }

    const selectedItemStillExists = selectedCRToolbarItemId
      ? crTimeline.some(item => item.id === selectedCRToolbarItemId) ||
        effectiveFinalVoteItem?.id === selectedCRToolbarItemId
      : false;

    if (!selectedItemStillExists && fallbackSelectedCRItemId) {
      setSelectedCRToolbarItemId(fallbackSelectedCRItemId);
    }
  }, [
    crTimeline,
    currentCRItem?.id,
    effectiveFinalVoteItem?.id,
    fallbackSelectedCRItemId,
    selectedCRToolbarItemId,
  ]);

  const selectedCRToolbarItem = useMemo(
    () =>
      crTimeline.find(item => item.id === selectedCRToolbarItemId) ??
      (effectiveFinalVoteItem?.id === selectedCRToolbarItemId ? effectiveFinalVoteItem : null) ??
      crTimeline.find(item => item.id === fallbackSelectedCRItemId) ??
      (effectiveFinalVoteItem?.id === fallbackSelectedCRItemId ? effectiveFinalVoteItem : null) ??
      null,
    [crTimeline, effectiveFinalVoteItem, fallbackSelectedCRItemId, selectedCRToolbarItemId]
  );

  const isCRToolbarActive =
    !!agendaItem?.amendment_id && crTimeline.length > 0 && !!selectedCRToolbarItem;
  const selectedCRPhase = getEffectiveCRVotingPhase(selectedCRToolbarItem);
  const isSelectedCRFinalVote = !!selectedCRToolbarItem?.is_final_vote;
  const hasUserVotedOnSelectedCR = useMemo(
    () => (selectedCRToolbarItem ? hasUserVotedOnCR(selectedCRToolbarItem) : false),
    [hasUserVotedOnCR, selectedCRToolbarItem]
  );

  const selectedCRToolbarIndex = useMemo(() => {
    if (!selectedCRToolbarItem) return -1;
    if (selectedCRToolbarItem.is_final_vote) return nonFinalCRItems.length;
    return nonFinalCRItems.findIndex(item => item.id === selectedCRToolbarItem.id);
  }, [selectedCRToolbarItem, nonFinalCRItems]);

  const hasPreviousChangeRequest = useMemo(() => {
    if (!selectedCRToolbarItem) return false;
    if (selectedCRToolbarItem.is_final_vote) return nonFinalCRItems.length > 0;
    return selectedCRToolbarIndex > 0;
  }, [selectedCRToolbarItem, nonFinalCRItems.length, selectedCRToolbarIndex]);

  const hasNextChangeRequest = useMemo(() => {
    if (!selectedCRToolbarItem || selectedCRToolbarItem.is_final_vote) return false;
    if (selectedCRToolbarIndex < nonFinalCRItems.length - 1) return true;
    return !!effectiveFinalVoteItem && allCRsProcessed;
  }, [
    selectedCRToolbarItem,
    selectedCRToolbarIndex,
    nonFinalCRItems.length,
    effectiveFinalVoteItem,
    allCRsProcessed,
  ]);

  const handlePreviousChangeRequest = useCallback(() => {
    if (!selectedCRToolbarItem) return;

    if (selectedCRToolbarItem.is_final_vote) {
      const lastCRItem = nonFinalCRItems[nonFinalCRItems.length - 1];
      if (lastCRItem) setSelectedCRToolbarItemId(lastCRItem.id);
      return;
    }

    const previousItem = nonFinalCRItems[selectedCRToolbarIndex - 1];
    if (previousItem) setSelectedCRToolbarItemId(previousItem.id);
  }, [selectedCRToolbarItem, nonFinalCRItems, selectedCRToolbarIndex]);

  const handleNextChangeRequest = useCallback(() => {
    if (!selectedCRToolbarItem || selectedCRToolbarItem.is_final_vote) return;

    const nextItem = nonFinalCRItems[selectedCRToolbarIndex + 1];
    if (nextItem) {
      setSelectedCRToolbarItemId(nextItem.id);
      return;
    }

    if (effectiveFinalVoteItem && allCRsProcessed) {
      setSelectedCRToolbarItemId(effectiveFinalVoteItem.id);
    }
  }, [
    selectedCRToolbarItem,
    nonFinalCRItems,
    selectedCRToolbarIndex,
    effectiveFinalVoteItem,
    allCRsProcessed,
  ]);

  const handleToolbarStartVote = useCallback(() => {
    if (!selectedCRToolbarItem) return;
    void startIndicativePhase(selectedCRToolbarItem.id);
  }, [selectedCRToolbarItem, startIndicativePhase]);

  const handleToolbarStartFinalVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!selectedCRToolbarItem) return;
      void startFinalPhase(selectedCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleStartFinalVote();
  }, [isCRToolbarActive, selectedCRToolbarItem, startFinalPhase, actionBarHook]);

  const handleToolbarCloseVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!selectedCRToolbarItem) return;
      void closeVoting(selectedCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleCloseFinalVote();
  }, [isCRToolbarActive, selectedCRToolbarItem, closeVoting, actionBarHook]);

  const handleCastCRVoteFromDialog = useCallback(
    async (choiceId: string) => {
      if (!selectedCRToolbarItem) return;
      await castCRVote(selectedCRToolbarItem, choiceId);
    },
    [selectedCRToolbarItem, castCRVote]
  );

  const selectedCRTitle = useMemo(() => {
    if (!selectedCRToolbarItem) return agendaItem?.title ?? undefined;
    if (selectedCRToolbarItem.is_final_vote) {
      return t('features.agendas.crTimeline.acceptAmendment');
    }

    return (
      selectedCRToolbarItem.change_request?.title ||
      `${t('features.agendas.crTimeline.changeRequest')} ${selectedCRToolbarIndex + 1}`
    );
  }, [agendaItem?.title, selectedCRToolbarItem, selectedCRToolbarIndex, t]);

  const selectedCRChoices = useMemo(
    () =>
      (selectedCRToolbarItem?.vote?.choices ?? []).map(choice => ({
        id: choice.id,
        label: choice.label || 'Choice',
      })),
    [selectedCRToolbarItem?.vote?.choices]
  );

  const selectedCRDialogPhase = useMemo(() => {
    if (selectedCRPhase === 'final_vote') return 'final_vote' as const;
    if (selectedCRPhase === 'closed') return 'closed' as const;
    return 'indication' as const;
  }, [selectedCRPhase]);
  const agendaForwardingPreview = useMemo(() => {
    const nextStepRun = forwardingContext.nextStepRun;
    if (!nextStepRun?.event) {
      return null;
    }

    if (!agendaItem?.amendment_id) {
      return null;
    }

    return {
      nextGroupId: nextStepRun.target_group?.id ?? null,
      nextGroupName: nextStepRun.target_group?.name ?? null,
      nextEventId: nextStepRun.event.id ?? null,
      nextEventTitle: nextStepRun.event.title ?? 'Next event',
      nextEventStartDate: nextStepRun.event.start_date ?? null,
    };
  }, [agendaItem?.amendment_id, forwardingContext.nextStepRun]);
  const voteDialogForwardingPreview = useMemo(() => {
    if (!agendaForwardingPreview) {
      return null;
    }

    const shouldShowPreview = isCRToolbarActive
      ? isSelectedCRFinalVote
      : Boolean(agendaItem?.amendment_id && vote);

    return shouldShowPreview ? agendaForwardingPreview : null;
  }, [
    agendaForwardingPreview,
    agendaItem?.amendment_id,
    isCRToolbarActive,
    isSelectedCRFinalVote,
    vote,
  ]);
  const mergeVariantCandidates = useMemo<MergeVariantCandidate[]>(() => {
    const agendaStepRuns = forwardingContext.agendaStepRuns ?? [];
    if (!agendaStepRuns.some(step => step.step_kind === 'merge_vote')) {
      return [];
    }

    return [...agendaStepRuns]
      .sort((left, right) => (left.branch?.created_at ?? 0) - (right.branch?.created_at ?? 0))
      .map((step, index) => ({
        id: step.branch_id ?? step.id,
        label: translateText('generated.inline.0006_antrag_valuee0eb_4b6d330e', {
          valuee0eb: index + 1,
        }),
        groupName: step.target_group?.name ?? step.branch?.title ?? null,
        content:
          step.branch?.document_version?.content ??
          step.process_run?.amendment?.document?.content ??
          agendaItem?.amendment?.document?.content ??
          null,
      }));
  }, [agendaItem?.amendment?.document?.content, forwardingContext.agendaStepRuns]);
  const detailGroupTypeById = useMemo(
    () => buildAmendmentPathGroupTypeById(forwardingContext.branchStepRuns),
    [forwardingContext.branchStepRuns]
  );
  const detailDerivedActiveStepRun = useMemo(
    () => findLikelyActiveAmendmentStep(forwardingContext.processRunStepRuns),
    [forwardingContext.processRunStepRuns]
  );
  const detailResolvedActiveBranchId =
    detailDerivedActiveStepRun?.branch_id ??
    forwardingContext.processRun?.active_branch_id ??
    forwardingContext.currentStepRun?.branch_id ??
    forwardingContext.currentStepRun?.branch?.id ??
    null;
  const detailFirstUnresolvedStepId = useMemo(
    () =>
      (detailDerivedActiveStepRun?.branch_id === detailResolvedActiveBranchId
        ? detailDerivedActiveStepRun.id
        : null) ?? getFirstUnresolvedAmendmentStepId(forwardingContext.branchStepRuns),
    [
      detailDerivedActiveStepRun?.branch_id,
      detailDerivedActiveStepRun?.id,
      detailResolvedActiveBranchId,
      forwardingContext.branchStepRuns,
    ]
  );
  const detailPathVisualizationData = useMemo(
    () =>
      buildAmendmentPathVisualizationData(forwardingContext.branchStepRuns, {
        activeStepId: detailFirstUnresolvedStepId,
        isEventRequestPending: step =>
          Boolean(
            step.tasks?.some(
              task => task.task_type === 'schedule_event' && task.status === 'open'
            ) && !step.event_id
          ),
      }),
    [detailFirstUnresolvedStepId, forwardingContext.branchStepRuns]
  );

  useEffect(() => {
    console.log('PROCESS LOG [event-agenda-item-detail][amendment-flow]', {
      eventId,
      agendaItemId,
      amendmentId: agendaItem?.amendment_id ?? null,
      processRunId: forwardingContext.processRun?.id ?? null,
      storedActiveBranchId: forwardingContext.processRun?.active_branch_id ?? null,
      resolvedActiveBranchId: detailResolvedActiveBranchId,
      activeBranchId: forwardingContext.currentStepRun?.branch?.id ?? null,
      firstUnresolvedStepId: detailFirstUnresolvedStepId,
      derivedActiveStepRun: detailDerivedActiveStepRun
        ? {
            id: detailDerivedActiveStepRun.id,
            branchId: detailDerivedActiveStepRun.branch_id ?? null,
            order: detailDerivedActiveStepRun.order_index,
            status: detailDerivedActiveStepRun.status ?? null,
            decisionStatus: detailDerivedActiveStepRun.decision_status ?? null,
          }
        : null,
      currentRunStepRuns: forwardingContext.processRunStepRuns.map(step => ({
        id: step.id,
        branchId: step.branch_id ?? null,
        order: step.order_index,
        groupName: step.target_group?.name ?? step.workflow_step?.label ?? null,
        status: step.status ?? null,
        decisionStatus: step.decision_status ?? null,
        eventId: step.event_id ?? null,
        isLikelyActive: isLikelyActiveAmendmentStep(step),
      })),
      branchStepRuns: forwardingContext.branchStepRuns.map(step => ({
        id: step.id,
        branchId: step.branch_id ?? null,
        order: step.order_index,
        groupName: step.target_group?.name ?? step.workflow_step?.label ?? null,
        status: step.status ?? null,
        decisionStatus: step.decision_status ?? null,
        eventId: step.event_id ?? null,
        hasOpenScheduleTask: Boolean(
          step.tasks?.some(task => task.task_type === 'schedule_event' && task.status === 'open')
        ),
        isLikelyActive: isLikelyActiveAmendmentStep(step),
      })),
      stepRuns: forwardingContext.branchStepRuns.map(step => ({
        id: step.id,
        branchId: step.branch_id ?? null,
        order: step.order_index,
        groupName: step.target_group?.name ?? step.workflow_step?.label ?? null,
        status: step.status ?? null,
        decisionStatus: step.decision_status ?? null,
        eventId: step.event_id ?? null,
        isLikelyActive: isLikelyActiveAmendmentStep(step),
      })),
      visualization: detailPathVisualizationData.map(segment => ({
        order: segment.order,
        groupName: segment.groupName,
        forwardingStatus: segment.forwardingStatus,
        rawStatus: segment.rawStatus ?? null,
        rawDecisionStatus: segment.rawDecisionStatus ?? null,
        isActiveStep: segment.isActiveStep ?? false,
      })),
    });
  }, [
    agendaItem?.amendment_id,
    agendaItemId,
    detailDerivedActiveStepRun,
    detailFirstUnresolvedStepId,
    detailPathVisualizationData,
    detailResolvedActiveBranchId,
    eventId,
    forwardingContext.branchStepRuns,
    forwardingContext.currentStepRun?.branch?.id,
    forwardingContext.currentStepRun?.branch_id,
    forwardingContext.processRun?.active_branch_id,
    forwardingContext.processRun?.id,
    forwardingContext.processRunStepRuns,
  ]);

  const toolbarVotingPhase = isCRToolbarActive ? selectedCRPhase : effectiveVotingPhase;
  const toolbarAgendaItem = agendaNav.currentAgendaItem ?? agendaItem;
  const toolbarAgendaItemIndex = toolbarAgendaItem?.id
    ? toolbarAgendaItem.id === agendaNav.currentAgendaItem?.id
      ? agendaNav.currentIndex
      : typeof agendaItem?.order_index === 'number'
        ? Math.max(agendaItem.order_index - 1, 0)
        : 0
    : -1;
  const toolbarAgendaItemTopNumber =
    toolbarAgendaItemIndex >= 0 ? toolbarAgendaItemIndex + 1 : undefined;
  const detailRuntimeStatus = agendaItem
    ? getAgendaRuntimeStatus({
        id: agendaItem.id,
        status: agendaItem.status,
        start_time: agendaItem.start_time,
        end_time: agendaItem.end_time,
        activated_at: agendaItem.activated_at,
        completed_at: agendaItem.completed_at,
        currentAgendaItemId:
          agendaNav.currentAgendaItem?.id ?? event?.current_agenda_item_id ?? null,
      })
    : 'pending';
  const handleToolbarStartItem = useCallback(() => {
    if (!agendaItem) return Promise.resolve();
    return agendaNav.activateAgendaItem(agendaItem.id);
  }, [agendaItem, agendaNav]);

  const startVoteTooltip = isCRToolbarActive
    ? isSelectedCRFinalVote
      ? t('features.events.agenda.actions.startFinalVote')
      : t('features.agendas.crTimeline.startVote')
    : undefined;

  const startFinalVoteTooltip = isCRToolbarActive
    ? isSelectedCRFinalVote
      ? t('features.events.agenda.actions.startFinalVote')
      : t('features.agendas.crTimeline.startFinal')
    : undefined;

  const closeVoteTooltip = isCRToolbarActive
    ? isSelectedCRFinalVote
      ? t('features.events.agenda.actions.closeFinalVote')
      : t('features.agendas.crTimeline.closeVoting')
    : undefined;

  const castIndicativeVoteTooltip = isCRToolbarActive
    ? isSelectedCRFinalVote
      ? t('features.events.agenda.actions.castIndicativeVote')
      : t('features.agendas.crTimeline.castIndicative')
    : undefined;

  const castFinalVoteTooltip = isCRToolbarActive
    ? isSelectedCRFinalVote
      ? t('features.events.agenda.actions.castFinalVote')
      : t('features.agendas.crTimeline.castFinal')
    : undefined;

  // Handler: Mark speaker as completed
  const handleMarkSpeakerCompleted = async (speakerId: string) => {
    if (!user || !canManageAgenda) return;

    setMarkingSpeakerComplete(speakerId);
    try {
      const now = Date.now();
      await updateSpeaker({
        id: speakerId,
        completed: true,
        end_time: now,
      });

      // Set start_time on the next active speaker (if any)
      const sorted = [...speakerListData].sort((a, b) => a.order - b.order);
      const activeAfter = sorted.filter(s => !s.completed && s.id !== speakerId);
      if (activeAfter.length > 0) {
        const next = activeAfter[0];
        await updateSpeaker({
          id: next.id,
          start_time: now,
        });
      }

      toast.success(t('features.events.agenda.markCompleted'));
    } catch (error) {
      console.error('Error marking speaker completed:', error);
      toast.error(translateText('generated.inline.0050_fehler_beim_markieren_61f5cb2c'));
    } finally {
      setMarkingSpeakerComplete(null);
    }
  };

  // Prepare speaker list data
  const speakerListData = useMemo(() => {
    return (agendaItem?.speaker_list || []).map(speaker => ({
      id: speaker.id,
      order: speaker.order_index || 0,
      time: speaker.time || 3,
      completed: speaker.completed || false,
      title: speaker.title ?? undefined,
      startTime: speaker.start_time ?? undefined,
      endTime: speaker.end_time ?? undefined,
      user: speaker.user
        ? {
            id: speaker.user.id,
            name:
              `${speaker.user.first_name ?? ''} ${speaker.user.last_name ?? ''}`.trim() ||
              undefined,
            email: speaker.user.email ?? undefined,
            avatar: speaker.user.avatar ?? undefined,
          }
        : undefined,
    }));
  }, [agendaItem?.speaker_list]);

  const isUserInSpeakerList = speakerListData.some(
    speaker => speaker.user?.id === user?.id && !speaker.completed
  );
  const activeRosterParticipants = useMemo(
    () =>
      (rosterEvent?.participants ?? []).filter(participant =>
        ['active', 'member', 'admin', 'confirmed'].includes(participant.status ?? '')
      ),
    [rosterEvent?.participants]
  );
  const { isDelegateAssembly, participantsWithProvenance } =
    useDelegateAssemblyParticipantsComposition(rosterEvent, activeRosterParticipants);
  const eligibleParticipantsForNamedResults = useMemo(
    () => (isDelegateAssembly ? participantsWithProvenance : activeRosterParticipants),
    [activeRosterParticipants, isDelegateAssembly, participantsWithProvenance]
  );
  const confirmedOfflineParticipants = useMemo(
    () =>
      (rosterEvent?.offline_participants ?? []).filter(
        participant =>
          participant.attendance_status === 'confirmed' &&
          participant.participation_channel === 'offline'
      ),
    [rosterEvent?.offline_participants]
  );

  // Derive election/vote data for section components
  const indicativeSelections = useMemo(
    () => election?.indicative_selections ?? [],
    [election?.indicative_selections]
  );
  const finalSelections = useMemo(
    () => election?.final_selections ?? [],
    [election?.final_selections]
  );
  const userHasElectionVoted = useMemo(() => {
    if (!userElector) return false;
    const phase = election?.status;
    if (phase === 'final' || phase === 'final_vote') {
      return (election?.final_participations ?? []).some(
        (p: { elector_id?: string | null }) => p.elector_id === userElector.id
      );
    }
    return (election?.indicative_participations ?? []).some(
      (p: { elector_id?: string | null }) => p.elector_id === userElector.id
    );
  }, [userElector, election]);

  const userSelectedCandidateIds = useMemo(() => {
    if (!userElector) return [];
    const phase = election?.status;
    const participations =
      phase === 'final' || phase === 'final_vote'
        ? (election?.final_participations ?? [])
        : (election?.indicative_participations ?? []);
    const userPart = participations.find(
      (p: { elector_id?: string | null }) => p.elector_id === userElector.id
    );
    if (!userPart) return [];
    return (userPart.selections ?? [])
      .map(
        (s: { candidate_id?: string | null; candidate?: { id: string } | null }) =>
          s.candidate?.id ?? s.candidate_id ?? ''
      )
      .filter(Boolean);
  }, [userElector, election]);

  const offlineTallyPhaseSource = toolbarVotingPhase;
  const offlineTallyPhase = useMemo(
    () =>
      resolveOfflineTallyPhase({
        allowsOfflineTallies,
        canManageOfflineTallies,
        votingPhase: offlineTallyPhaseSource,
      }),
    [allowsOfflineTallies, canManageOfflineTallies, offlineTallyPhaseSource]
  );

  const indicativeDecisions = useMemo(
    () => vote?.indicative_decisions ?? [],
    [vote?.indicative_decisions]
  );
  const finalDecisions = useMemo(() => vote?.final_decisions ?? [], [vote?.final_decisions]);
  const userHasVoteVoted = useMemo(() => {
    if (!userVoter) return false;
    const phase = vote?.status;
    if (phase === 'final' || phase === 'final_vote') {
      return (vote?.final_participations ?? []).some(
        (p: { voter_id?: string | null }) => p.voter_id === userVoter.id
      );
    }
    return (vote?.indicative_participations ?? []).some(
      (p: { voter_id?: string | null }) => p.voter_id === userVoter.id
    );
  }, [userVoter, vote]);

  const userSelectedChoiceIds = useMemo(() => {
    if (!userVoter) return [];
    const phase = vote?.status;
    const participations =
      phase === 'final' || phase === 'final_vote'
        ? (vote?.final_participations ?? [])
        : (vote?.indicative_participations ?? []);
    const userPart = participations.find(
      (p: { voter_id?: string | null }) => p.voter_id === userVoter.id
    );
    if (!userPart) return [];
    return (userPart.decisions ?? [])
      .map(
        (d: { choice_id?: string | null; choice?: { id: string } | null }) =>
          d.choice?.id ?? d.choice_id ?? ''
      )
      .filter(Boolean);
  }, [userVoter, vote]);
  const namedElectionResults = useMemo(
    () =>
      election
        ? buildNamedElectionResultsModel({
            election,
            eligibleParticipants: eligibleParticipantsForNamedResults,
            confirmedOfflineParticipants,
            groupedBySourceGroup: isDelegateAssembly,
          })
        : null,
    [
      confirmedOfflineParticipants,
      election,
      eligibleParticipantsForNamedResults,
      isDelegateAssembly,
    ]
  );
  const namedVoteResults = useMemo(
    () =>
      vote
        ? buildNamedVoteResultsModel({
            vote,
            eligibleParticipants: eligibleParticipantsForNamedResults,
            confirmedOfflineParticipants,
            groupedBySourceGroup: isDelegateAssembly,
          })
        : null,
    [confirmedOfflineParticipants, eligibleParticipantsForNamedResults, isDelegateAssembly, vote]
  );
  const namedResultsDialogConfig = useMemo(() => {
    if (namedResultsTarget === 'election' && election && namedElectionResults) {
      return {
        title: election.title ?? agendaItem?.title ?? 'Namentliche Wahl',
        description: translateText(
          'generated.inline.0007_live_einzelansicht_der_aktuellen_wahlentschei_a187c0ee'
        ),
        model: namedElectionResults,
      };
    }

    if (namedResultsTarget === 'vote' && vote && namedVoteResults) {
      return {
        title: vote.title ?? agendaItem?.title ?? 'Namentliche Abstimmung',
        description: translateText(
          'generated.inline.0008_live_einzelansicht_der_aktuellen_abstimmungse_5779107f'
        ),
        model: namedVoteResults,
      };
    }

    return null;
  }, [
    agendaItem?.title,
    election,
    namedElectionResults,
    namedResultsTarget,
    namedVoteResults,
    vote,
  ]);

  const offlineTallyEntity = useMemo(() => {
    if (!offlineTallyPhase) {
      return null;
    }

    if (election) {
      return {
        kind: 'election' as const,
        itemId: election.id,
        title: election.title ?? agendaItem?.title ?? 'this election',
        choices: candidates
          .filter(candidate => candidate.status !== 'withdrawn')
          .map(candidate => ({
            id: candidate.id,
            label: candidate.user
              ? `${candidate.user.first_name ?? ''} ${candidate.user.last_name ?? ''}`.trim() ||
                candidate.user.email ||
                candidate.name ||
                'Candidate'
              : candidate.name || 'Candidate',
          })),
        tallies: (election.offline_tallies ?? [])
          .filter(tally => tally.phase === offlineTallyPhase && tally.candidate_id)
          .map(tally => ({
            id: tally.candidate_id ?? '',
            count: tally.count ?? 0,
          })),
        maxTotalVotes: confirmedOfflineParticipantCount * Math.max(1, election.max_votes ?? 1),
      };
    }

    if (vote) {
      return {
        kind: 'vote' as const,
        itemId: vote.id,
        title: vote.title ?? agendaItem?.title ?? 'this vote',
        choices: choices.map((choice, index) => ({
          id: choice.id,
          label: choice.label || `Choice ${index + 1}`,
        })),
        tallies: (vote.offline_tallies ?? [])
          .filter(tally => tally.phase === offlineTallyPhase && tally.choice_id)
          .map(tally => ({
            id: tally.choice_id ?? '',
            count: tally.count ?? 0,
          })),
        maxTotalVotes: confirmedOfflineParticipantCount,
      };
    }

    return null;
  }, [
    agendaItem?.title,
    candidates,
    choices,
    confirmedOfflineParticipantCount,
    election,
    offlineTallyPhase,
    vote,
  ]);
  const offlineTallyActionMode = resolveOfflineTallyMode(offlineTallyEntity?.tallies ?? []);
  const showOfflineTallyButton = shouldShowOfflineTallyToolbarButton({
    attendanceMode,
    canManageVotes,
    phase: offlineTallyPhase,
  });

  const handleOfflineTallyDialogOpenChange = useCallback((open: boolean) => {
    setOfflineTallyDialogOpen(open);
    if (!open) {
      setOfflineTallyPasswordError(null);
      setOfflineTallySubmitError(null);
    }
  }, []);

  const handleOpenOfflineTallyDialog = useCallback(() => {
    setOfflineTallyPasswordError(null);
    setOfflineTallySubmitError(null);
    setOfflineTallyDialogOpen(true);
  }, []);

  const handleSubmitOfflineTally = useCallback(
    async ({ password, counts }: { password: string; counts: Record<string, number> }) => {
      if (!offlineTallyEntity || !offlineTallyPhase) {
        return;
      }

      setOfflineTallyPasswordError(null);
      setOfflineTallySubmitError(null);
      setIsOfflineTallySubmitting(true);

      try {
        await verifyVotingPassword(password);

        const correlationId = `${offlineTallyEntity.kind}-offline-tally:${crypto.randomUUID()}`;
        const existingCountByChoiceId = new Map(
          offlineTallyEntity.tallies.map(tally => [tally.id, tally.count ?? 0])
        );
        const updates = offlineTallyEntity.choices
          .map(choice => {
            const previousCount = existingCountByChoiceId.get(choice.id) ?? 0;
            const nextCount = counts[choice.id] ?? 0;
            return {
              choiceId: choice.id,
              count: nextCount,
              delta: nextCount - previousCount,
            };
          })
          .sort((left, right) => {
            const deltaDiff = left.delta - right.delta;
            if (deltaDiff !== 0) {
              return deltaDiff;
            }

            return left.choiceId.localeCompare(right.choiceId);
          });

        for (const update of updates) {
          if (offlineTallyEntity.kind === 'election') {
            await upsertElectionOfflineTally({
              election_id: offlineTallyEntity.itemId,
              phase: offlineTallyPhase,
              candidate_id: update.choiceId,
              count: update.count,
              debug_correlation_id: correlationId,
            });
          } else {
            await upsertVoteOfflineTally({
              vote_id: offlineTallyEntity.itemId,
              phase: offlineTallyPhase,
              choice_id: update.choiceId,
              count: update.count,
              debug_correlation_id: correlationId,
            });
          }
        }

        toast.success(getOfflineTallySuccessMessage(offlineTallyPhase));
        handleOfflineTallyDialogOpenChange(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : translateText('generated.inline.0007_failed_to_save_offline_tally_82b59509');
        const isPasswordError =
          message === 'Invalid voting password.' ||
          message === 'No voting password set. Please set your voting PIN first.';

        if (isPasswordError) {
          setOfflineTallyPasswordError(message);
        } else {
          setOfflineTallySubmitError(message);
        }

        toast.error(translateText('generated.inline.0049_failed_to_save_offline_tally_82b59509'), {
          description: message,
          action:
            message.includes('Offline election totals exceed the current cap') ||
            message.includes('Offline vote totals cannot exceed')
              ? {
                  label: translateText('generated.inline.0004_open_participants_22616da9'),
                  onClick: () =>
                    navigate({
                      to: '/event/$id/participants',
                      params: { id: eventId },
                    }),
                }
              : undefined,
        });
      } finally {
        setIsOfflineTallySubmitting(false);
      }
    },
    [
      eventId,
      handleOfflineTallyDialogOpenChange,
      navigate,
      offlineTallyEntity,
      offlineTallyPhase,
      upsertElectionOfflineTally,
      upsertVoteOfflineTally,
      verifyVotingPassword,
    ]
  );
  return (
    <EventAgendaItemDetailView
      eventId={eventId}
      agendaItemId={agendaItemId}
      t={t}
      navigate={navigate}
      updateSpeaker={updateSpeaker}
      agendaItem={agendaItem}
      event={event}
      user={user}
      isLoading={isLoading}
      votingLoading={votingLoading}
      addingSpeaker={addingSpeaker}
      election={election}
      candidates={candidates}
      vote={vote}
      choices={choices}
      userElector={userElector}
      userVoter={userVoter}
      estimatedStartTime={estimatedStartTime}
      forwardingContext={forwardingContext}
      handleDelete={handleDelete}
      handleAddToSpeakerList={handleAddToSpeakerList}
      delegateAssignmentMeta={delegateAssignmentMeta}
      delegateTargetEvent={delegateTargetEvent}
      can={can}
      canVote={canVote}
      canBeCandidate={canBeCandidate}
      canManageAgenda={canManageAgenda}
      canManageVotes={canManageVotes}
      canManageOfflineTallies={canManageOfflineTallies}
      hasVotingRight={hasVotingRight}
      hasCandidateRight={hasCandidateRight}
      rosterEvent={rosterEvent}
      attendanceMode={attendanceMode}
      disableVoteButton={disableVoteButton}
      allowsOfflineTallies={allowsOfflineTallies}
      confirmedOfflineParticipantCount={confirmedOfflineParticipantCount}
      agendaNav={agendaNav}
      verifyVotingPassword={verifyVotingPassword}
      upsertElectionOfflineTally={upsertElectionOfflineTally}
      upsertVoteOfflineTally={upsertVoteOfflineTally}
      passwordError={passwordError}
      setPasswordError={setPasswordError}
      isPasswordVerifying={isPasswordVerifying}
      setIsPasswordVerifying={setIsPasswordVerifying}
      offlineTallyDialogOpen={offlineTallyDialogOpen}
      setOfflineTallyDialogOpen={setOfflineTallyDialogOpen}
      offlineTallyPasswordError={offlineTallyPasswordError}
      setOfflineTallyPasswordError={setOfflineTallyPasswordError}
      offlineTallySubmitError={offlineTallySubmitError}
      setOfflineTallySubmitError={setOfflineTallySubmitError}
      isOfflineTallySubmitting={isOfflineTallySubmitting}
      setIsOfflineTallySubmitting={setIsOfflineTallySubmitting}
      namedResultsTarget={namedResultsTarget}
      setNamedResultsTarget={setNamedResultsTarget}
      effectiveVotingPhase={effectiveVotingPhase}
      crTimeline={crTimeline}
      currentCRItem={currentCRItem}
      completedItems={completedItems}
      progress={progress}
      isTimelineComplete={isTimelineComplete}
      allCRsProcessed={allCRsProcessed}
      hasUserVotedOnCR={hasUserVotedOnCR}
      getUserSelectedChoiceIds={getUserSelectedChoiceIds}
      startIndicativePhase={startIndicativePhase}
      startFinalPhase={startFinalPhase}
      closeVoting={closeVoting}
      castCRVote={castCRVote}
      actionBarHook={actionBarHook}
      setMarkingSpeakerComplete={setMarkingSpeakerComplete}
      selectedCRToolbarItemId={selectedCRToolbarItemId}
      setSelectedCRToolbarItemId={setSelectedCRToolbarItemId}
      mockCRItems={mockCRItems}
      documentContent={documentContent}
      amendmentDiscussions={amendmentDiscussions}
      crDiffMap={crDiffMap}
      hasAmendmentCRs={hasAmendmentCRs}
      crDisplayItemsBase={crDisplayItemsBase}
      isCRVotingActive={isCRVotingActive}
      timelineHasFinalVote={timelineHasFinalVote}
      synthesizedFinalVoteItem={synthesizedFinalVoteItem}
      crDisplayItems={crDisplayItems}
      effectiveFinalVoteItem={effectiveFinalVoteItem}
      isVoteInCRList={isVoteInCRList}
      nonFinalCRItems={nonFinalCRItems}
      fallbackSelectedCRItemId={fallbackSelectedCRItemId}
      selectedCRToolbarItem={selectedCRToolbarItem}
      isCRToolbarActive={isCRToolbarActive}
      selectedCRPhase={selectedCRPhase}
      isSelectedCRFinalVote={isSelectedCRFinalVote}
      hasUserVotedOnSelectedCR={hasUserVotedOnSelectedCR}
      selectedCRToolbarIndex={selectedCRToolbarIndex}
      hasPreviousChangeRequest={hasPreviousChangeRequest}
      hasNextChangeRequest={hasNextChangeRequest}
      handlePreviousChangeRequest={handlePreviousChangeRequest}
      handleNextChangeRequest={handleNextChangeRequest}
      handleToolbarStartVote={handleToolbarStartVote}
      handleToolbarStartFinalVote={handleToolbarStartFinalVote}
      handleToolbarCloseVote={handleToolbarCloseVote}
      handleCastCRVoteFromDialog={handleCastCRVoteFromDialog}
      selectedCRTitle={selectedCRTitle}
      selectedCRChoices={selectedCRChoices}
      selectedCRDialogPhase={selectedCRDialogPhase}
      agendaForwardingPreview={agendaForwardingPreview}
      voteDialogForwardingPreview={voteDialogForwardingPreview}
      mergeVariantCandidates={mergeVariantCandidates}
      detailGroupTypeById={detailGroupTypeById}
      detailDerivedActiveStepRun={detailDerivedActiveStepRun}
      detailResolvedActiveBranchId={detailResolvedActiveBranchId}
      detailFirstUnresolvedStepId={detailFirstUnresolvedStepId}
      detailPathVisualizationData={detailPathVisualizationData}
      toolbarVotingPhase={toolbarVotingPhase}
      toolbarAgendaItem={toolbarAgendaItem}
      toolbarAgendaItemIndex={toolbarAgendaItemIndex}
      toolbarAgendaItemTopNumber={toolbarAgendaItemTopNumber}
      detailRuntimeStatus={detailRuntimeStatus}
      handleToolbarStartItem={handleToolbarStartItem}
      startVoteTooltip={startVoteTooltip}
      startFinalVoteTooltip={startFinalVoteTooltip}
      closeVoteTooltip={closeVoteTooltip}
      castIndicativeVoteTooltip={castIndicativeVoteTooltip}
      castFinalVoteTooltip={castFinalVoteTooltip}
      handleMarkSpeakerCompleted={handleMarkSpeakerCompleted}
      speakerListData={speakerListData}
      isUserInSpeakerList={isUserInSpeakerList}
      activeRosterParticipants={activeRosterParticipants}
      isDelegateAssembly={isDelegateAssembly}
      participantsWithProvenance={participantsWithProvenance}
      eligibleParticipantsForNamedResults={eligibleParticipantsForNamedResults}
      confirmedOfflineParticipants={confirmedOfflineParticipants}
      indicativeSelections={indicativeSelections}
      finalSelections={finalSelections}
      userHasElectionVoted={userHasElectionVoted}
      userSelectedCandidateIds={userSelectedCandidateIds}
      offlineTallyPhaseSource={offlineTallyPhaseSource}
      offlineTallyPhase={offlineTallyPhase}
      indicativeDecisions={indicativeDecisions}
      finalDecisions={finalDecisions}
      userHasVoteVoted={userHasVoteVoted}
      userSelectedChoiceIds={userSelectedChoiceIds}
      namedElectionResults={namedElectionResults}
      namedVoteResults={namedVoteResults}
      namedResultsDialogConfig={namedResultsDialogConfig}
      offlineTallyEntity={offlineTallyEntity}
      offlineTallyActionMode={offlineTallyActionMode}
      showOfflineTallyButton={showOfflineTallyButton}
      handleOfflineTallyDialogOpenChange={handleOfflineTallyDialogOpenChange}
      handleOpenOfflineTallyDialog={handleOpenOfflineTallyDialog}
      handleSubmitOfflineTally={handleSubmitOfflineTally}
    />
  );
}
