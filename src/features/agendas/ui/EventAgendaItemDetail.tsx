import { Link, useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useEventAgendaItem } from '../hooks/useEventAgendaItem';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { AgendaItemContextCard } from './AgendaItemContextCard';
import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { AgendaSpeakerListSection } from './AgendaSpeakerListSection';
import { AgendaVoteSection } from './AgendaVoteSection';
import { AgendaElectionSection } from './AgendaElectionSection';
import { OfflineTallyDialog } from './OfflineTallyDialog';
import { AgendaActionBar } from './AgendaActionBar';
import { EditElectionVoteDialog } from './EditElectionVoteDialog';
import { useAgendaActionBar } from '../hooks/useAgendaActionBar';
import { useAgendaNavigation } from '../hooks/useAgendaNavigation';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import { ChangeRequestCardsList } from './ChangeRequestCardsList';
import {
  MergeVariantComparisonPanel,
  type MergeVariantCandidate,
} from './MergeVariantComparisonPanel';
import { AccreditationSection } from './AccreditationSection';
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
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
  isLikelyActiveAmendmentStep,
} from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
import {
  getOfflineTallyDialogTitle,
  getOfflineTallySuccessMessage,
  getOfflineTallyTooltip,
  resolveOfflineTallyMode,
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
} from '../logic/offlineTallyToolbar';
import {
  buildNamedElectionResultsModel,
  buildNamedVoteResultsModel,
} from '../logic/buildNamedBallotResults';
import { NamedBallotResultsDialog } from './NamedBallotResultsDialog';
import { useDelegateAssemblyParticipantsComposition } from '@/features/events/hooks/useDelegateAssemblyParticipantsComposition';
import { isNamedBallot } from '@/zero/shared';

function getEffectiveVotingPhase(status?: string | null, fallback?: string | null): string | null {
  const normalizePhase = (value?: string | null) => {
    if (value === 'final' || value === 'final_vote') return 'final_vote';
    if (value === 'closed') return 'closed';
    if (value === 'indicative' || value === 'indication') return 'indication';
    return null;
  };

  const resolvedStatus = normalizePhase(status);
  const resolvedFallback = normalizePhase(fallback);

  if (resolvedStatus === 'closed' || resolvedFallback === 'closed') return 'closed';
  if (resolvedStatus === 'final_vote' || resolvedFallback === 'final_vote') return 'final_vote';

  return 'indication';
}

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

function resolveAttendanceMode(
  event?: {
    attendance_mode?: string | null;
    location_type?: string | null;
  } | null
) {
  if (event?.attendance_mode === 'online' || event?.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event?.location_type === 'online' ? 'online' : 'offline';
}

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-muted h-8 animate-pulse rounded"></div>
        <div className="bg-muted h-64 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!agendaItem || !event) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-2xl font-bold">
            {translateText('generated.inline.0051_tagesordnungspunkt_nicht_gefunden_6faf6631')}
          </h2>
          <p className="text-muted-foreground mb-4">
            {translateText(
              'generated.inline.0052_der_gesuchte_tagesordnungspunkt_existiert_nic_234c07d7'
            )}
          </p>
          <Button asChild>
            <Link to="/event/$id/agenda" params={{ id: eventId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0053_zur_ck_zur_tagesordnung_c45114ea')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fixed Action Bar */}
      <AgendaActionBar
        eventId={eventId}
        currentAgendaItem={{
          id: agendaItem.id,
          type: agendaItem.type,
          status: detailRuntimeStatus,
          voting_phase: toolbarVotingPhase,
          election: election ? { id: election.id } : null,
          vote: isCRToolbarActive
            ? selectedCRToolbarItem?.vote
              ? { id: selectedCRToolbarItem.vote.id }
              : null
            : vote
              ? { id: vote.id }
              : null,
        }}
        canManageAgenda={actionBarHook.canManageAgenda}
        canVote={actionBarHook.hasVotingRight}
        canBeCandidate={actionBarHook.hasCandidateRight}
        isEventStarted={event?.status === 'active' || event?.status === 'in-progress'}
        isUserInSpeakerList={actionBarHook.isUserInSpeakerList}
        isUserCandidate={actionBarHook.isUserCandidate}
        currentItemLabel={
          toolbarAgendaItemTopNumber ? `TOP-${toolbarAgendaItemTopNumber}` : undefined
        }
        currentItemTitle={toolbarAgendaItem?.title ?? undefined}
        onOpenCurrentItem={
          toolbarAgendaItem
            ? () =>
                navigate({
                  to: '/event/$id/agenda/$agendaItemId',
                  params: { id: eventId, agendaItemId: toolbarAgendaItem.id },
                })
            : undefined
        }
        hasPreviousItem={agendaNav.hasPreviousItem}
        hasNextItem={agendaNav.hasNextItem}
        hasStartableItem={agendaNav.hasStartableItem}
        canMoveToNextItem={agendaNav.canMoveToNextItem}
        isCurrentItemCompleted={agendaNav.isCurrentItemCompleted}
        onStartItem={handleToolbarStartItem}
        onPreviousItem={agendaNav.moveToPreviousItem}
        onNextItem={agendaNav.moveToNextItem}
        onCompleteItem={agendaNav.completeCurrentItem}
        hasPreviousChangeRequest={isCRToolbarActive ? hasPreviousChangeRequest : undefined}
        hasNextChangeRequest={isCRToolbarActive ? hasNextChangeRequest : undefined}
        onPreviousChangeRequest={isCRToolbarActive ? handlePreviousChangeRequest : undefined}
        onNextChangeRequest={isCRToolbarActive ? handleNextChangeRequest : undefined}
        navigationLoading={agendaNav.isLoading}
        speakerLoading={actionBarHook.speakerLoading}
        candidateLoading={actionBarHook.candidateLoading}
        onBackToAgenda={() => navigate({ to: '/event/$id/agenda', params: { id: eventId } })}
        onEditItem={actionBarHook.handleEditClick}
        onDeleteItem={handleDelete}
        onJoinSpeakerList={actionBarHook.handleJoinSpeakerList}
        onLeaveSpeakerList={actionBarHook.handleLeaveSpeakerList}
        onBecomeCandidate={actionBarHook.handleBecomeCandidate}
        onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
        onStartVote={
          isCRToolbarActive
            ? toolbarVotingPhase === 'pending'
              ? handleToolbarStartVote
              : undefined
            : toolbarVotingPhase === 'pending'
              ? actionBarHook.handleStartVote
              : undefined
        }
        onStartFinalVote={
          isCRToolbarActive
            ? toolbarVotingPhase === 'indication'
              ? handleToolbarStartFinalVote
              : undefined
            : handleToolbarStartFinalVote
        }
        onCloseFinalVote={
          isCRToolbarActive
            ? toolbarVotingPhase === 'final_vote'
              ? handleToolbarCloseVote
              : undefined
            : handleToolbarCloseVote
        }
        onVoteClick={
          isCRToolbarActive
            ? toolbarVotingPhase !== 'pending' &&
              toolbarVotingPhase !== 'closed' &&
              !hasUserVotedOnSelectedCR
              ? actionBarHook.handleVoteClick
              : undefined
            : actionBarHook.handleVoteClick
        }
        disableVoteButton={!isCRToolbarActive && disableVoteButton}
        disabledVoteTooltip={translateText(
          'generated.inline.0005_offline_votes_are_entered_via_tallies_0ab8a792'
        )}
        showOfflineTallyButton={!isCRToolbarActive && showOfflineTallyButton}
        onOfflineTallyClick={
          !isCRToolbarActive && showOfflineTallyButton ? handleOpenOfflineTallyDialog : undefined
        }
        offlineTallyMode={offlineTallyActionMode}
        offlineTallyTooltip={getOfflineTallyTooltip({
          phase: offlineTallyPhase,
          mode: offlineTallyActionMode,
        })}
        startVoteTooltip={startVoteTooltip}
        startFinalVoteTooltip={startFinalVoteTooltip}
        closeVoteTooltip={closeVoteTooltip}
        castIndicativeVoteTooltip={castIndicativeVoteTooltip}
        castFinalVoteTooltip={castFinalVoteTooltip}
      />
      {/* Spacer for fixed toolbar */}
      <div className="h-10" />

      <OfflineTallyDialog
        open={offlineTallyDialogOpen}
        onOpenChange={handleOfflineTallyDialogOpenChange}
        title={getOfflineTallyDialogTitle(offlineTallyPhase ?? 'indicative')}
        description={`Enter aggregated offline or hybrid selections for ${offlineTallyEntity?.title ?? 'this item'} and confirm with your voting PIN.`}
        phase={offlineTallyPhase ?? 'indicative'}
        choices={offlineTallyEntity?.choices ?? []}
        tallies={offlineTallyEntity?.tallies ?? []}
        maxTotalVotes={offlineTallyEntity?.maxTotalVotes ?? null}
        isSubmitting={isOfflineTallySubmitting}
        passwordError={offlineTallyPasswordError}
        submitError={offlineTallySubmitError}
        onSubmit={handleSubmitOfflineTally}
      />

      <NamedBallotResultsDialog
        open={namedResultsTarget !== null}
        onOpenChange={open => {
          if (!open) {
            setNamedResultsTarget(null);
          }
        }}
        title={namedResultsDialogConfig?.title ?? 'Namentliche Ergebnisse'}
        description={namedResultsDialogConfig?.description ?? ''}
        model={namedResultsDialogConfig?.model ?? null}
      />

      {/* Vote Cast Dialog (with password support) */}
      <VoteCastDialog
        open={actionBarHook.voteDialogOpen}
        onOpenChange={actionBarHook.setVoteDialogOpen}
        phase={isCRToolbarActive ? selectedCRDialogPhase : actionBarHook.voteCasting.phase}
        title={isCRToolbarActive ? selectedCRTitle : (agendaItem.title ?? undefined)}
        forwardingPreview={voteDialogForwardingPreview}
        candidates={
          isCRToolbarActive
            ? undefined
            : election
              ? candidates.map(c => ({
                  id: c.id,
                  name: c.user
                    ? `${c.user.first_name ?? ''} ${c.user.last_name ?? ''}`.trim() ||
                      c.user.email ||
                      'Candidate'
                    : c.name || 'Candidate',
                  avatar: c.user?.avatar ?? undefined,
                }))
              : undefined
        }
        maxVotes={election?.max_votes ?? 1}
        electionMode={
          election?.election_mode ? normalizeElectionMode(election.election_mode) : null
        }
        seatCount={election?.seat_count ?? null}
        choices={
          isCRToolbarActive
            ? selectedCRChoices
            : vote
              ? choices.map(c => ({
                  id: c.id,
                  label: c.label || 'Choice',
                }))
              : undefined
        }
        requirePassword
        passwordError={passwordError}
        isPasswordVerifying={isPasswordVerifying}
        onPasswordSubmit={async (password: string) => {
          setPasswordError(null);
          setIsPasswordVerifying(true);
          try {
            await verifyVotingPassword(password);
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : translateText('generated.inline.0010_verification_failed_e10d7e51');
            setPasswordError(message);
            throw err;
          } finally {
            setIsPasswordVerifying(false);
          }
        }}
        onCastVote={
          isCRToolbarActive
            ? handleCastCRVoteFromDialog
            : actionBarHook.voteCasting.castAmendmentVote
        }
        onCastElectionVote={
          isCRToolbarActive ? undefined : actionBarHook.voteCasting.castElectionVote
        }
        isLoading={isCRToolbarActive ? false : actionBarHook.voteCasting.isLoading}
      />

      {/* Edit Election/Vote Dialog */}
      <EditElectionVoteDialog
        open={actionBarHook.editDialogOpen}
        onOpenChange={actionBarHook.setEditDialogOpen}
        agendaItemId={agendaItem.id}
        agendaItemTitle={agendaItem.title ?? null}
        agendaItemDescription={agendaItem.description ?? null}
        agendaItemDuration={agendaItem.duration ?? null}
        election={election ?? undefined}
        vote={vote ?? undefined}
        choices={choices.map(c => ({
          id: c.id,
          label: c.label,
          order_index: c.order_index,
        }))}
      />

      {/* Section 1: Context Card */}
      <AgendaItemContextCard
        agendaItem={{
          id: agendaItem.id,
          title: agendaItem.title || '',
          description: agendaItem.description ?? undefined,
          type: agendaItem.type === 'amendment' ? 'vote' : agendaItem.type || '',
          status: detailRuntimeStatus,
          duration: agendaItem.duration ?? undefined,
          scheduledTime:
            estimatedStartTime?.toISOString() ?? agendaItem.scheduled_time ?? undefined,
          startTime: agendaItem.start_time ? new Date(agendaItem.start_time) : undefined,
          endTime: agendaItem.end_time ? new Date(agendaItem.end_time) : undefined,
          activatedAt: agendaItem.activated_at ? new Date(agendaItem.activated_at) : undefined,
          completedAt: agendaItem.completed_at ? new Date(agendaItem.completed_at) : undefined,
        }}
        amendment={agendaItem.amendment ?? undefined}
        amendmentForwardingPreview={agendaForwardingPreview}
        amendmentPathVisualizationData={detailPathVisualizationData}
        amendmentGroupTypeById={detailGroupTypeById}
        onAmendmentGroupClick={groupId => navigate({ to: '/group/$id', params: { id: groupId } })}
        onAmendmentEventClick={targetEventId =>
          navigate({ to: '/event/$id/agenda', params: { id: targetEventId } })
        }
        election={election ?? undefined}
        votingStartTime={agendaItem.start_time ? new Date(agendaItem.start_time) : undefined}
        votingEndTime={
          (election?.closing_end_time ?? vote?.closing_end_time)
            ? new Date(election?.closing_end_time ?? vote?.closing_end_time ?? 0)
            : undefined
        }
      />

      {delegateTargetEvent ? <EventSearchCard event={delegateTargetEvent} /> : null}

      <MergeVariantComparisonPanel candidates={mergeVariantCandidates} />

      {/* Section 2: Speaker List */}
      <AgendaSpeakerListSection
        speakers={speakerListData}
        isUserInSpeakerList={isUserInSpeakerList}
        canManageSpeakers={canManageAgenda}
        isAddingSpeaker={addingSpeaker}
        isRemovingSpeaker={actionBarHook.speakerLoading}
        userId={user?.id}
        agendaStartTime={agendaItem.start_time ?? undefined}
        onAddToSpeakerList={handleAddToSpeakerList}
        onRemoveFromSpeakerList={actionBarHook.handleLeaveSpeakerList}
        onMarkCompleted={handleMarkSpeakerCompleted}
      />

      {/* Accreditation Section */}
      {agendaItem.type === 'accreditation' && (
        <AccreditationSection eventId={eventId} agendaItemId={agendaItemId} />
      )}

      {/* Change Request Cards — always shown for amendment agenda items */}
      {agendaItem.amendment_id && hasAmendmentCRs && (
        <ChangeRequestCardsList
          items={crDisplayItems}
          editingMode={agendaItem.amendment?.editing_mode}
          isVotingActive={isCRVotingActive}
          userId={user?.id}
          canManage={canManageAgenda}
          canVote={hasVotingRight}
          currentItemId={isCRVotingActive ? currentCRItem?.id : null}
          progress={isCRVotingActive ? progress : undefined}
          completedCount={isCRVotingActive ? completedItems.length : undefined}
          allCRsProcessed={isCRVotingActive ? allCRsProcessed : undefined}
          isTimelineComplete={isCRVotingActive ? isTimelineComplete : undefined}
          diffMap={crDiffMap}
          documentContent={documentContent}
          discussions={amendmentDiscussions}
          amendmentId={agendaItem.amendment_id ?? undefined}
          agendaItemId={agendaItemId}
          hasUserVoted={isCRVotingActive ? hasUserVotedOnCR : undefined}
          getUserSelectedChoiceIds={isCRVotingActive ? getUserSelectedChoiceIds : undefined}
          onCastVote={isCRVotingActive ? castCRVote : undefined}
          onStartIndicative={isCRVotingActive ? startIndicativePhase : undefined}
          onStartFinal={isCRVotingActive ? startFinalPhase : undefined}
          onCloseVoting={isCRVotingActive ? closeVoting : undefined}
        />
      )}

      {/* Section 3: Election */}
      {election && (
        <div className="space-y-4">
          <AgendaElectionSection
            roleName={election.title ?? t('features.events.agenda.role')}
            electionMode={
              election.election_mode ? normalizeElectionMode(election.election_mode) : null
            }
            seatCount={election.seat_count}
            candidates={[...candidates] as CandidatesByElectionRow[]}
            indicativeSelections={indicativeSelections}
            finalSelections={finalSelections}
            offlineTallies={election.offline_tallies ?? []}
            attendanceMode={attendanceMode}
            userHasVoted={userHasElectionVoted}
            userSelectedCandidateIds={userSelectedCandidateIds}
            electionStatus={election.status}
            canVote={hasVotingRight}
            canBeCandidate={hasCandidateRight}
            isUserCandidate={actionBarHook.isUserCandidate}
            isVotingLoading={votingLoading === election.id}
            isCandidateLoading={actionBarHook.candidateLoading}
            onBecomeCandidate={actionBarHook.handleBecomeCandidate}
            onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
            onOpenNamedResults={
              isNamedBallot(election.ballot_visibility)
                ? () => setNamedResultsTarget('election')
                : undefined
            }
          />
        </div>
      )}

      {/* Section 3: Vote — hidden when vote is embedded in the CR list */}
      {vote && !isVoteInCRList && (
        <div className="space-y-4">
          <AgendaVoteSection
            voteId={vote.id}
            voteTitle={vote.title || agendaItem.title || 'Vote'}
            choices={[...choices] as ChoicesByVoteRow[]}
            indicativeDecisions={indicativeDecisions}
            finalDecisions={finalDecisions}
            offlineTallies={vote.offline_tallies ?? []}
            attendanceMode={attendanceMode}
            userHasVoted={userHasVoteVoted}
            userSelectedChoiceIds={userSelectedChoiceIds}
            voteStatus={vote.status}
            majorityType={vote.majority_type}
            totalEligibleVoters={(vote.voters?.length ?? 0) + confirmedOfflineParticipantCount}
            canManageOfflineResults={canManageAgenda}
            offlineEligibleCount={confirmedOfflineParticipantCount}
            onOpenNamedResults={
              isNamedBallot(vote.ballot_visibility)
                ? () => setNamedResultsTarget('vote')
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
