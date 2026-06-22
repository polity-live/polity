import { useNavigate } from '@tanstack/react-router';
import { useEventAgendaItem } from '../hooks/useEventAgendaItem';
import { useAgendaActionBar } from '../hooks/useAgendaActionBar';
import { useAgendaNavigation } from '../hooks/useAgendaNavigation';
import { type MergeVariantCandidate } from './MergeVariantComparisonPanel';
import { usePermissions } from '@/zero/rbac';
import { useUserState } from '@/zero/users/useUserState';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useEventById, useEventParticipantsByParticipatedEventIds } from '@/zero/events';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/editor/types';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAgendaItemCRVoting, getVotePhase, getVoteResult } from '../hooks/useAgendaItemCRVoting';
import { extractAmendmentCRSummaries } from '../logic/extractAmendmentCRSummaries';
import {
  createMockCRTimelineItems,
  isPendingSubmissionCRTimelineItem,
} from '../logic/createMockCRTimelineItems';
import {
  buildClosingVoteFromAgendaVote,
  buildVariantVoteFromAgendaVote,
  buildVoteSequencePlaceholder,
} from '../logic/buildClosingVoteFromAgendaVote';
import {
  getVoteStepKind,
  isChangeRequestVotesPlaceholder,
  resolveClosingJumpTarget,
} from '../logic/voteSequenceJump';
import {
  resolveCurrentVoteSequenceItem,
  resolveNextStartableVoteSequenceItem,
  resolveVoteSequenceSelectionUpdate,
} from '../logic/voteSequenceSelection';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import {
  extractSuggestionContent,
  hasRenderableSuggestionContent,
  suggestionContentFromChangeRequestSnapshot,
} from '@/features/change-requests/utils/suggestion-extraction';
import {
  decorateBranchScopedChangeRequests,
  decorateBranchScopedTimelineItems,
  filterTimelineItemsForProcessBranch,
} from '@/features/change-requests/logic/branchScopedDisplay';
import type { ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
} from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
import {
  getOfflineTallySuccessMessage,
  resolveOfflineTallyMode,
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
} from '../logic/offlineTallyToolbar';
import { buildOfflineTallyEntity } from '../logic/offlineTallyEntity';
import {
  buildNamedElectionResultsModel,
  buildNamedVoteResultsModel,
} from '../logic/buildNamedBallotResults';
import { useDelegateAssemblyParticipantsComposition } from '@/features/events/hooks/useDelegateAssemblyParticipantsComposition';
import { getEffectiveVotingPhase, resolveAttendanceMode } from '../logic/agendaUiHelpers';
import { VOTE_PHASE, VOTE_PURPOSE } from '@/zero/votes/vote-workflow';
import {
  buildBranchDiffCandidates,
  getBranchEditingMode,
  getOrderedBranches,
  type AmendmentProcessBranchSource,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { normalizeEditingMode } from '@/zero/amendments/editing-mode-policy';
import {
  getSelectableAgendaBranches,
  resolveSelectableAgendaBranchId,
} from '../logic/selectableAgendaBranches';
import { logAgendaChangeRequestItems } from '../logic/logAgendaChangeRequestItems';
import { getFinalVoteActionLabels } from '../logic/finalVoteActionLabels';
import { buildVoteDialogDocumentPreviewModel } from '../logic/changeRequestDocumentPreview';
import { resolveClosingVoteForAgendaItem } from '../logic/resolveClosingVoteForAgendaItem';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { computeEligibleFinalVoterCount } from '@/features/votes/logic/computeEligibleVoters';
import { useAgendaArrowNavigation } from '../hooks/useAgendaArrowNavigation';

function getEffectiveCRVotingPhase(
  item?: {
    status?: string | null;
    vote?: { status?: string | null } | null;
  } | null
): string | null {
  if (!item) return null;
  if (item.status === 'pending') return 'pending';

  const phase = getVotePhase(item as Parameters<typeof getVotePhase>[0]);
  if (phase === 'final') return 'final';
  if (phase === 'closed') return 'closed';
  return 'indication';
}

type ChangeRequestTimelineIdentitySource = Record<string, any>;

function addTimelineIdentityKey(keys: Set<string>, value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const normalized = String(value).trim();
  if (normalized.length > 0) keys.add(normalized);
}

function collectTimelineItemIdentityKeys(item: ChangeRequestTimelineIdentitySource) {
  const keys = new Set<string>();
  const changeRequest = item.change_request ?? {};
  const branchId =
    item.process_branch_id ??
    item.processBranchId ??
    item._processBranchId ??
    changeRequest.process_branch_id ??
    changeRequest.processBranchId ??
    null;
  const logicalKey =
    item.logical_key ??
    item.logicalKey ??
    changeRequest.logical_key ??
    changeRequest.logicalKey ??
    null;

  [
    item.id,
    item.change_request_id,
    item.suggestion_id,
    item.suggestionId,
    item.discussion_id,
    item.discussionId,
    item.changeRequestEntityId,
    logicalKey,
    changeRequest.id,
    changeRequest.cr_id,
    changeRequest.crId,
    changeRequest.display_cr_id,
    changeRequest.displayCrId,
    changeRequest.suggestion_id,
    changeRequest.suggestionId,
    changeRequest.discussion_id,
    changeRequest.discussionId,
    changeRequest.changeRequestEntityId,
    changeRequest.logical_key,
    changeRequest.logicalKey,
  ].forEach(value => addTimelineIdentityKey(keys, value));

  if (branchId && logicalKey) {
    addTimelineIdentityKey(keys, `${branchId}:${logicalKey}`);
  }

  if (keys.size === 0) {
    addTimelineIdentityKey(keys, changeRequest.title);
  }

  return keys;
}

function collectCRSummaryIdentityKeys(summary: {
  id?: string | null;
  changeRequestEntityId?: string | null;
  suggestionId?: string | null;
  discussionId?: string | null;
  logicalKey?: string | null;
  processBranchId?: string | null;
  crId?: string | null;
  displayCrId?: string | null;
  title?: string | null;
}) {
  const keys = new Set<string>();
  [
    summary.id,
    summary.changeRequestEntityId,
    summary.suggestionId,
    summary.discussionId,
    summary.logicalKey,
    summary.crId,
    summary.displayCrId,
  ].forEach(value => addTimelineIdentityKey(keys, value));

  if (summary.processBranchId && summary.logicalKey) {
    addTimelineIdentityKey(keys, `${summary.processBranchId}:${summary.logicalKey}`);
  }

  if (keys.size === 0) {
    addTimelineIdentityKey(keys, summary.title);
  }

  return keys;
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
  const { updateSpeaker, initializeChangeRequestVoting, ensureEventSuggestionChangeRequestVotes } =
    useAgendaActions();
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
    votesByAgendaItem,
    choices,
    userElector,
    userVoter,
    estimatedStartTime,
    forwardingContext,
    handleDelete,
    handleAddToSpeakerList,
    canJoinSpeakerList,
  } = useEventAgendaItem(eventId, agendaItemId);
  const { user: userRecord } = useUserState({ userId: user?.id });
  const mappedUserRecord = useMemo(
    () =>
      userRecord
        ? {
            id: userRecord.id,
            name:
              `${userRecord.first_name ?? ''} ${userRecord.last_name ?? ''}`.trim() || undefined,
            email: userRecord.email ?? undefined,
            avatar: userRecord.avatar ?? undefined,
            gender: userRecord.gender ?? null,
          }
        : undefined,
    [userRecord]
  );
  const delegateAssignmentMeta = (
    election as { delegate_assignment_meta?: { targetEventId?: string } | null } | null
  )?.delegate_assignment_meta;
  const { event: delegateTargetEvent } = useEventById(delegateAssignmentMeta?.targetEventId);

  const { can, canVote, canBeCandidate } = usePermissions({ eventId });
  const { can: canAmendment } = usePermissions({
    eventId,
    amendment: agendaItem?.amendment ?? undefined,
  });
  const canManageAgenda = can('manage', 'agendaItems');
  const canManageVotes = can('manage_votes', 'events');
  const canManageAmendment = canAmendment('manage', 'amendments');
  const canManageVoteSequence = canManageVotes || canManageAmendment;
  const canManageOfflineTallies = can('manage_votes', 'events') || canManageAgenda;
  const hasVotingRight = canVote();
  const hasCandidateRight = canBeCandidate();
  const { event: rosterEvent } = useEventById(eventId);
  const eventParticipantEventIds = useMemo(() => [eventId], [eventId]);
  const { participants: activeEventParticipants } =
    useEventParticipantsByParticipatedEventIds(eventParticipantEventIds);
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
  const {
    updateVote: updateAgendaVote,
    upsertOfflineTally: upsertVoteOfflineTally,
    closeExpiredFinalVotesForEvent,
  } = useVoteActions();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordVerifying, setIsPasswordVerifying] = useState(false);
  const [offlineTallyDialogOpen, setOfflineTallyDialogOpen] = useState(false);
  const [offlineTallyPasswordError, setOfflineTallyPasswordError] = useState<string | null>(null);
  const [offlineTallySubmitError, setOfflineTallySubmitError] = useState<string | null>(null);
  const [isOfflineTallySubmitting, setIsOfflineTallySubmitting] = useState(false);
  const [namedResultsTarget, setNamedResultsTarget] = useState<'election' | 'vote' | null>(null);
  const [sequenceVotingLoading, setSequenceVotingLoading] = useState<string | null>(null);
  const effectiveVotingPhase = getEffectiveVotingPhase(
    election?.status ?? vote?.status,
    agendaItem?.voting_phase ?? null
  );

  useEffect(() => {
    const closeExpiredVotes = () => {
      closeExpiredFinalVotesForEvent({ event_id: eventId }).catch(error => {
        console.error('Failed to close expired final votes:', error);
      });
    };

    closeExpiredVotes();
    const intervalId = window.setInterval(closeExpiredVotes, 5000);
    return () => window.clearInterval(intervalId);
  }, [closeExpiredFinalVotesForEvent, eventId]);

  const {
    crTimeline,
    currentItem: currentCRItem,
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
    eventGenderQuotaEnabled: Boolean(event?.gender_quota_enabled),
  });

  const [, setMarkingSpeakerComplete] = useState<string | null>(null);
  const [selectedCRToolbarItemId, setSelectedCRToolbarItemId] = useState<string | null>(null);
  const [requestedAgendaBranchId, setRequestedAgendaBranchId] = useState<string | null>(null);

  const agendaProcessBranches = useMemo(
    () =>
      getOrderedBranches(
        (agendaItem?.amendment?.current_process_run?.branches ??
          []) as readonly AmendmentProcessBranchSource[]
      ),
    [agendaItem?.amendment?.current_process_run?.branches]
  );
  const agendaBranchLabelsById = useMemo(
    () => new Map(agendaProcessBranches.map(branch => [branch.id, branch.title ?? null])),
    [agendaProcessBranches]
  );
  const selectableAgendaBranchesResult = useMemo(
    () =>
      getSelectableAgendaBranches({
        branches: agendaProcessBranches,
        vote,
        votes: votesByAgendaItem ?? [],
        agendaStepRuns: forwardingContext.agendaStepRuns ?? [],
        currentStepRun: forwardingContext.currentStepRun ?? null,
      }),
    [
      agendaProcessBranches,
      forwardingContext.agendaStepRuns,
      forwardingContext.currentStepRun,
      vote,
      votesByAgendaItem,
    ]
  );
  const selectableAgendaBranches = selectableAgendaBranchesResult.branches;
  const selectedAgendaBranchId = useMemo(
    () =>
      resolveSelectableAgendaBranchId({
        branches: selectableAgendaBranches,
        requestedBranchId: requestedAgendaBranchId,
        preferredBranchId: selectableAgendaBranchesResult.preferredBranchId,
      }),
    [
      requestedAgendaBranchId,
      selectableAgendaBranches,
      selectableAgendaBranchesResult.preferredBranchId,
    ]
  );
  const agendaProcessBranch = useMemo(
    () => selectableAgendaBranches.find(branch => branch.id === selectedAgendaBranchId) ?? null,
    [selectableAgendaBranches, selectedAgendaBranchId]
  );
  const handleAgendaBranchChange = useCallback((branchId: string | null) => {
    setRequestedAgendaBranchId(branchId);
  }, []);

  const agendaBranchChangeRequests = useMemo(() => {
    const branchChangeRequests = agendaProcessBranch?.change_requests;
    if (Array.isArray(branchChangeRequests)) {
      return branchChangeRequests;
    }

    const changeRequests =
      (agendaItem?.amendment?.change_requests as
        | readonly ({ process_branch_id?: string | null } & Record<string, unknown>)[]
        | null
        | undefined) ?? [];

    if (agendaProcessBranch?.id) {
      return changeRequests.filter(
        changeRequest => changeRequest.process_branch_id === agendaProcessBranch.id
      );
    }

    return changeRequests.filter(changeRequest => !changeRequest.process_branch_id);
  }, [
    agendaItem?.amendment?.change_requests,
    agendaProcessBranch?.change_requests,
    agendaProcessBranch?.id,
  ]);

  const agendaBranchDiscussionsRaw =
    agendaProcessBranch?.discussions ?? agendaItem?.amendment?.discussions;
  const agendaBranchEditingMode = getBranchEditingMode(agendaProcessBranch);
  const agendaItemAmendmentEditingMode = normalizeEditingMode(
    (agendaItem?.amendment as { editing_mode?: string | null } | null | undefined)?.editing_mode
  );
  const isEventSuggestionBranchMode =
    agendaBranchEditingMode === 'suggest_event' ||
    (!agendaProcessBranch && agendaItemAmendmentEditingMode === 'suggest_event');

  const documentContent = (agendaProcessBranch?.document?.content ??
    agendaProcessBranch?.document_version?.content ??
    agendaItem?.amendment?.document?.content) as Value | undefined;
  const branchDiffCandidates = useMemo(
    () =>
      buildBranchDiffCandidates({
        branches: selectableAgendaBranches,
        originalContent: agendaItem?.amendment?.document?.content ?? null,
        activeBranchId: selectedAgendaBranchId,
      }),
    [agendaItem?.amendment?.document?.content, selectableAgendaBranches, selectedAgendaBranchId]
  );
  const defaultBranchDiffRightCandidateId = selectedAgendaBranchId;
  const eventSuggestionChangeRequestSignal = useMemo(
    () =>
      (agendaBranchChangeRequests as readonly any[])
        .map(
          changeRequest =>
            `${changeRequest.id ?? ''}:${changeRequest.status ?? ''}:${changeRequest.voting_status ?? ''}:${changeRequest.confirmation_status ?? ''}:${changeRequest.process_branch_id ?? 'main'}`
        )
        .sort()
        .join('|'),
    [agendaBranchChangeRequests]
  );

  useEffect(() => {
    if (!agendaItem?.id || !agendaItem.amendment_id) return;
    if (!isEventSuggestionBranchMode) return;
    if (!hasVotingRight && !canManageVoteSequence) return;

    void ensureEventSuggestionChangeRequestVotes({
      amendment_id: agendaItem.amendment_id,
      agenda_item_id: agendaItem.id,
      process_branch_id: selectedAgendaBranchId ?? null,
    });
  }, [
    agendaItem?.amendment_id,
    agendaItem?.id,
    canManageVoteSequence,
    ensureEventSuggestionChangeRequestVotes,
    eventSuggestionChangeRequestSignal,
    hasVotingRight,
    isEventSuggestionBranchMode,
    selectedAgendaBranchId,
  ]);

  // Build mock CR items for pre-voting display
  const mockCRItems = useMemo(() => {
    if (!agendaItem?.amendment_id) return [];

    const amendment = agendaItem.amendment;
    if (!amendment) return [];

    const summaries = extractAmendmentCRSummaries(
      agendaBranchDiscussionsRaw as readonly unknown[] | null | undefined,
      agendaBranchChangeRequests as unknown as
        | readonly {
            id: string;
            process_branch_id?: string | null;
            title?: string | null;
            description?: string | null;
            status?: string | null;
            voting_status?: string | null;
            votes_for?: number | null;
            votes_against?: number | null;
            votes_abstain?: number | null;
            voting_deadline?: number | null;
            resolution_method?: string | null;
            visibility_scope?: string | null;
            resolved_in_mode?: string | null;
            change_type?: string | null;
            original_text?: string | null;
            new_text?: string | null;
            original_properties?: Record<string, string> | null;
            new_properties?: Record<string, string> | null;
          }[]
        | null
        | undefined,
      {
        branches: agendaProcessBranches,
        processBranchId: agendaProcessBranch?.id ?? null,
      }
    );

    const timelineKeys = new Set<string>();
    for (const item of crTimeline) {
      collectTimelineItemIdentityKeys(item).forEach(key => timelineKeys.add(key));
    }

    const pendingSummaries = summaries.filter(summary => {
      const isPending =
        summary.status === 'pending_submission' ||
        summary.votingStatus === 'pending_submission' ||
        summary.confirmationStatus === 'pending' ||
        summary.changeRequestStatus === 'pending_submission';
      if (!isPending) return false;

      return (
        crTimeline.length === 0 ||
        ![...collectCRSummaryIdentityKeys(summary)].some(value => timelineKeys.has(value))
      );
    });

    return createMockCRTimelineItems(pendingSummaries);
  }, [
    agendaBranchChangeRequests,
    agendaBranchDiscussionsRaw,
    agendaProcessBranch?.id,
    agendaProcessBranches,
    agendaItem?.amendment_id,
    agendaItem?.amendment,
    crTimeline,
  ]);

  // Build TDiscussion array from amendment discussions for SuggestionViewToggle mapping
  const amendmentDiscussions = useMemo<TDiscussion[]>(() => {
    const rawDiscussions = agendaBranchDiscussionsRaw;
    if (!rawDiscussions || !Array.isArray(rawDiscussions)) return [];
    const displayChangeRequests = decorateBranchScopedChangeRequests(
      agendaProcessBranches,
      (agendaBranchChangeRequests as readonly any[]).map(changeRequest => ({
        id: changeRequest.id,
        process_branch_id: changeRequest.process_branch_id ?? agendaProcessBranch?.id ?? null,
        cr_id: changeRequest.title ?? null,
        title: changeRequest.title ?? null,
        status: changeRequest.status ?? null,
        branch_sequence_number: changeRequest.branch_sequence_number ?? null,
        branchSequenceNumber: changeRequest.branch_sequence_number ?? null,
        created_at: changeRequest.created_at ?? null,
      }))
    );

    return (rawDiscussions as Record<string, unknown>[]).map(d => ({
      ...(() => {
        const changeRequestEntityId = (d.changeRequestEntityId as string) ?? undefined;
        const crId = (d.crId as string) ?? null;
        const matchingRequest = displayChangeRequests.find(
          changeRequest =>
            changeRequest.id === changeRequestEntityId ||
            (!!crId && (changeRequest.cr_id === crId || changeRequest.title === crId))
        );

        return {
          id: (d.id as string) ?? '',
          crId,
          displayCrId: matchingRequest?.displayCrId ?? (d.displayCrId as string) ?? crId,
          branchDisplayNumber: matchingRequest?.branchDisplayNumber,
          branchScopedCrNumber: matchingRequest?.branchScopedCrNumber,
          branchSequenceNumber:
            matchingRequest?.branchSequenceNumber ?? (d.branchSequenceNumber as number) ?? null,
          title: (d.title as string) ?? '',
          userId: (d.userId as string) ?? '',
          comments: (d.comments as TDiscussion['comments']) ?? [],
          createdAt: new Date((d.createdAt as number) ?? 0),
          isResolved: (d.isResolved as boolean) ?? false,
          confirmationStatus:
            matchingRequest?.status === 'pending_submission'
              ? 'pending'
              : ((d.confirmationStatus as TDiscussion['confirmationStatus']) ?? undefined),
          changeRequestStatus: matchingRequest?.status ?? (d.changeRequestStatus as string) ?? null,
          changeRequestEntityId,
        };
      })(),
    }));
  }, [
    agendaBranchChangeRequests,
    agendaBranchDiscussionsRaw,
    agendaProcessBranch?.id,
    agendaProcessBranches,
  ]);

  // Build diffMap from document content for each discussion
  const crDiffMap = useMemo<Record<string, ChangeRequestDiffData>>(() => {
    const map: Record<string, ChangeRequestDiffData> = {};
    const changeRequests = agendaBranchChangeRequests as readonly {
      id?: string | null;
      title?: string | null;
      change_type?: string | null;
      original_text?: string | null;
      new_text?: string | null;
      original_properties?: any;
      new_properties?: any;
    }[];

    const setDiff = (keys: (string | null | undefined)[], diff: ChangeRequestDiffData | null) => {
      if (!diff) return;
      for (const key of keys) {
        if (key) map[key] = diff;
      }
    };

    for (const cr of changeRequests) {
      const content = suggestionContentFromChangeRequestSnapshot(cr);
      if (!hasRenderableSuggestionContent(content)) continue;

      const discussion = amendmentDiscussions.find(
        d =>
          d.changeRequestEntityId === cr.id ||
          (cr.title && (d.crId === cr.title || d.title === cr.title))
      );
      setDiff([cr.id, cr.title, discussion?.id], {
        changeType: content.type,
        originalText: content.text || undefined,
        newText: content.newText || undefined,
        properties: content.properties as Record<string, string> | undefined,
        newProperties: content.newProperties as Record<string, string> | undefined,
      });
    }

    if (!documentContent || !amendmentDiscussions.length) return map;

    for (const d of amendmentDiscussions) {
      if (!d.id) continue;
      const content = extractSuggestionContent(d.id, documentContent);
      if (!hasRenderableSuggestionContent(content)) continue;
      setDiff([d.id, d.crId, d.changeRequestEntityId], {
        changeType: content.type,
        originalText: content.text || undefined,
        newText: content.newText || undefined,
        properties: content.properties as Record<string, string> | undefined,
        newProperties: content.newProperties as Record<string, string> | undefined,
      });
    }
    return map;
  }, [agendaBranchChangeRequests, documentContent, amendmentDiscussions]);

  const hasAmendmentCRs = crTimeline.length > 0 || mockCRItems.length > 0;
  const decoratedCRTimeline = useMemo(() => {
    const maxTimelineOrderIndex = crTimeline.reduce((maxOrderIndex, item) => {
      return typeof item.order_index === 'number'
        ? Math.max(maxOrderIndex, item.order_index)
        : maxOrderIndex;
    }, -1);
    const supplementalMockItems = (mockCRItems as unknown as ChangeRequestTimelineRow[]).map(
      (item, index) => ({
        ...item,
        order_index:
          crTimeline.length > 0 && maxTimelineOrderIndex >= 0
            ? maxTimelineOrderIndex + index + 1
            : item.order_index,
      })
    );

    return decorateBranchScopedTimelineItems(agendaProcessBranches, [
      ...crTimeline,
      ...supplementalMockItems,
    ]);
  }, [agendaProcessBranches, crTimeline, mockCRItems]);
  const crDisplayItemsBase = useMemo(
    () => filterTimelineItemsForProcessBranch(decoratedCRTimeline, selectedAgendaBranchId),
    [decoratedCRTimeline, selectedAgendaBranchId]
  );
  const votableCRDisplayItemsBase = useMemo(
    () => crDisplayItemsBase.filter(item => !isPendingSubmissionCRTimelineItem(item)),
    [crDisplayItemsBase]
  );
  const crVoteIdsKey = useMemo(
    () =>
      crTimeline
        .map(item => item.vote_id)
        .filter((voteId): voteId is string => Boolean(voteId))
        .sort()
        .join('|'),
    [crTimeline]
  );
  const crVoteIds = useMemo(
    () => new Set(crVoteIdsKey ? crVoteIdsKey.split('|') : []),
    [crVoteIdsKey]
  );
  const variantVote = useMemo(() => {
    const votes = votesByAgendaItem ?? [];
    return (
      votes.find(
        (candidate: { purpose?: string | null }) => candidate.purpose === VOTE_PURPOSE.mergeVariant
      ) ??
      votes.find((candidate: { id: string; title?: string | null }) => {
        if (crVoteIds.has(candidate.id)) return false;
        const title = candidate.title?.toLowerCase() ?? '';
        return title.includes('merge round') || title.includes('variant');
      }) ??
      null
    );
  }, [crVoteIds, votesByAgendaItem]);

  const timelineHasClosingVote = crDisplayItemsBase.some(i => i.is_closing_vote);
  const closingVote = useMemo(
    () => resolveClosingVoteForAgendaItem([...(votesByAgendaItem ?? []), ...(vote ? [vote] : [])]),
    [vote, votesByAgendaItem]
  );
  const timelineHasVariantVote = useMemo(
    () => crTimeline.some(item => getVoteStepKind(item) === 'merge_variant'),
    [crTimeline]
  );
  const synthesizedVariantVoteItem = useMemo(() => {
    if (!variantVote || !agendaItem?.amendment_id || timelineHasVariantVote) return null;
    return buildVariantVoteFromAgendaVote(variantVote, 0) as unknown as ChangeRequestTimelineRow;
  }, [agendaItem?.amendment_id, timelineHasVariantVote, variantVote]);
  const synthesizedClosingVoteItem = useMemo(() => {
    if (timelineHasClosingVote) return null;
    if (!closingVote || !agendaItem?.amendment_id) return null;
    const orderIndex = votableCRDisplayItemsBase.length + (synthesizedVariantVoteItem ? 1 : 0);
    return buildClosingVoteFromAgendaVote(
      closingVote,
      orderIndex
    ) as unknown as ChangeRequestTimelineRow;
  }, [
    agendaItem?.amendment_id,
    votableCRDisplayItemsBase.length,
    closingVote,
    synthesizedVariantVoteItem,
    timelineHasClosingVote,
  ]);
  const changeRequestVotesPlaceholderItem = useMemo(() => {
    if (!synthesizedVariantVoteItem || votableCRDisplayItemsBase.length > 0 || !agendaItem?.id) {
      return null;
    }

    const changeRequestVotesWereSkipped =
      closingVote?.status === VOTE_PHASE.final ||
      closingVote?.status === 'final' ||
      closingVote?.status === 'closed';

    return {
      ...buildVoteSequencePlaceholder({
        agendaItemId: agendaItem.id,
        orderIndex: synthesizedVariantVoteItem ? 1 : 0,
        kind: 'change_request_votes_placeholder',
        title: t(
          'features.agendas.crTimeline.changeRequestVotesPlaceholder',
          'Change request votes'
        ),
        description: t(
          changeRequestVotesWereSkipped
            ? 'features.agendas.crTimeline.changeRequestVotesSkippedDescription'
            : 'features.agendas.crTimeline.changeRequestVotesPlaceholderDescription',
          changeRequestVotesWereSkipped
            ? 'Change request votes were skipped because there were no change requests to vote on.'
            : 'The exact change request votes will appear after the variant final vote is decided.'
        ),
      }),
      status: changeRequestVotesWereSkipped ? 'completed' : 'pending',
    } as unknown as ChangeRequestTimelineRow;
  }, [
    agendaItem?.id,
    votableCRDisplayItemsBase.length,
    closingVote?.status,
    synthesizedVariantVoteItem,
    t,
  ]);
  const closingVotePlaceholderItem = useMemo(() => {
    if (
      !synthesizedVariantVoteItem ||
      synthesizedClosingVoteItem ||
      timelineHasClosingVote ||
      !agendaItem?.id
    ) {
      return null;
    }

    const orderIndex =
      (synthesizedVariantVoteItem ? 1 : 0) +
      votableCRDisplayItemsBase.length +
      (changeRequestVotesPlaceholderItem ? 1 : 0);

    return buildVoteSequencePlaceholder({
      agendaItemId: agendaItem.id,
      orderIndex,
      kind: 'closing_placeholder',
      title: t('features.agendas.crTimeline.finalVotePlaceholder', 'Final vote'),
      description: t(
        'features.agendas.crTimeline.finalVotePlaceholderDescription',
        'The exact final vote will appear after the variant final vote is decided.'
      ),
    }) as unknown as ChangeRequestTimelineRow;
  }, [
    agendaItem?.id,
    changeRequestVotesPlaceholderItem,
    votableCRDisplayItemsBase.length,
    synthesizedClosingVoteItem,
    synthesizedVariantVoteItem,
    timelineHasClosingVote,
    t,
  ]);

  // Combine CR items + synthesized closing vote
  const crDisplayItems = useMemo(() => {
    return [
      ...(synthesizedVariantVoteItem ? [synthesizedVariantVoteItem] : []),
      ...(changeRequestVotesPlaceholderItem ? [changeRequestVotesPlaceholderItem] : []),
      ...crDisplayItemsBase,
      ...(synthesizedClosingVoteItem ? [synthesizedClosingVoteItem] : []),
      ...(closingVotePlaceholderItem ? [closingVotePlaceholderItem] : []),
    ];
  }, [
    changeRequestVotesPlaceholderItem,
    closingVotePlaceholderItem,
    crDisplayItemsBase,
    synthesizedClosingVoteItem,
    synthesizedVariantVoteItem,
  ]);

  const effectiveClosingVoteItem = useMemo(
    () => crDisplayItems.find(i => i.is_closing_vote) ?? null,
    [crDisplayItems]
  );

  // Whether the vote is embedded in the CR list (so we can hide standalone AgendaVoteSection)
  const isVoteInCRList =
    !!vote && crDisplayItems.some(item => item.vote_id === vote.id || item.vote?.id === vote.id);

  const nonFinalCRItems = useMemo(
    () =>
      crDisplayItemsBase.filter(
        item =>
          !item.is_closing_vote &&
          !isPendingSubmissionCRTimelineItem(item) &&
          getVoteStepKind(item) !== 'merge_variant'
      ),
    [crDisplayItemsBase]
  );
  const sequenceDisplayItems = useMemo(
    () => crDisplayItems.filter(item => !isPendingSubmissionCRTimelineItem(item)),
    [crDisplayItems]
  );
  const sequenceCompletedItems = useMemo(
    () => sequenceDisplayItems.filter(item => item.status === 'completed'),
    [sequenceDisplayItems]
  );
  const isVoteSequenceActive = Boolean(agendaItem?.amendment_id && sequenceDisplayItems.length > 0);
  const currentSequenceItem = useMemo(
    () =>
      resolveCurrentVoteSequenceItem({
        currentItemId: currentCRItem?.id ?? null,
        sequenceItems: sequenceDisplayItems,
      }),
    [currentCRItem, sequenceDisplayItems]
  );

  const fallbackSelectedCRItemId = useMemo(() => {
    if (currentSequenceItem?.id) return currentSequenceItem.id;
    return effectiveClosingVoteItem?.id ?? null;
  }, [currentSequenceItem?.id, effectiveClosingVoteItem?.id]);

  useEffect(() => {
    const nextSelectedItemId = resolveVoteSequenceSelectionUpdate({
      selectedItemId: selectedCRToolbarItemId,
      sequenceItems: sequenceDisplayItems,
      fallbackItemId: fallbackSelectedCRItemId,
      currentItemId: currentSequenceItem?.id ?? null,
    });

    if (nextSelectedItemId !== undefined) {
      setSelectedCRToolbarItemId(nextSelectedItemId);
    }
  }, [
    currentSequenceItem?.id,
    fallbackSelectedCRItemId,
    selectedCRToolbarItemId,
    sequenceDisplayItems,
  ]);

  const selectedCRToolbarItem = useMemo(
    () =>
      sequenceDisplayItems.find(item => item.id === selectedCRToolbarItemId) ??
      sequenceDisplayItems.find(item => item.id === fallbackSelectedCRItemId) ??
      null,
    [fallbackSelectedCRItemId, selectedCRToolbarItemId, sequenceDisplayItems]
  );
  const nextStartableSequenceItem = useMemo(
    () =>
      resolveNextStartableVoteSequenceItem({
        selectedItemId: selectedCRToolbarItem?.id ?? selectedCRToolbarItemId,
        sequenceItems: sequenceDisplayItems,
      }),
    [selectedCRToolbarItem?.id, selectedCRToolbarItemId, sequenceDisplayItems]
  );

  const isCRToolbarActive =
    !!agendaItem?.amendment_id && sequenceDisplayItems.length > 0 && !!selectedCRToolbarItem;
  const selectedCRPhase = getEffectiveCRVotingPhase(selectedCRToolbarItem);
  const isSelectedClosingVote = !!selectedCRToolbarItem?.is_closing_vote;
  const hasUserVotedOnSelectedCR = useMemo(
    () => (selectedCRToolbarItem ? hasUserVotedOnCR(selectedCRToolbarItem) : false),
    [hasUserVotedOnCR, selectedCRToolbarItem]
  );

  const selectedCRToolbarIndex = useMemo(() => {
    if (!selectedCRToolbarItem) return -1;
    return sequenceDisplayItems.findIndex(item => item.id === selectedCRToolbarItem.id);
  }, [selectedCRToolbarItem, sequenceDisplayItems]);

  const hasPreviousChangeRequest = useMemo(() => {
    if (!selectedCRToolbarItem) return false;
    return selectedCRToolbarIndex > 0;
  }, [selectedCRToolbarItem, selectedCRToolbarIndex]);

  const hasNextChangeRequest = useMemo(() => {
    if (!selectedCRToolbarItem) return false;
    return selectedCRToolbarIndex >= 0 && selectedCRToolbarIndex < sequenceDisplayItems.length - 1;
  }, [selectedCRToolbarItem, selectedCRToolbarIndex, sequenceDisplayItems.length]);

  const handlePreviousChangeRequest = useCallback(() => {
    if (!selectedCRToolbarItem) return;

    const previousItem = sequenceDisplayItems[selectedCRToolbarIndex - 1];
    if (previousItem) setSelectedCRToolbarItemId(previousItem.id);
  }, [selectedCRToolbarItem, sequenceDisplayItems, selectedCRToolbarIndex]);

  const handleNextChangeRequest = useCallback(() => {
    if (!selectedCRToolbarItem) return;

    const nextItem = sequenceDisplayItems[selectedCRToolbarIndex + 1];
    if (nextItem) {
      setSelectedCRToolbarItemId(nextItem.id);
    }
  }, [selectedCRToolbarItem, sequenceDisplayItems, selectedCRToolbarIndex]);

  const isCRArrowNavigationActive = canManageAgenda && isCRToolbarActive;
  useAgendaArrowNavigation({
    agendaNav,
    changeRequestNav: {
      enabled: isCRArrowNavigationActive,
      hasPrevious: hasPreviousChangeRequest,
      hasNext: hasNextChangeRequest,
      onPrevious: handlePreviousChangeRequest,
      onNext: handleNextChangeRequest,
    },
  });

  const handleJumpToNextStartableSequenceItem = useCallback(() => {
    if (nextStartableSequenceItem?.id) {
      setSelectedCRToolbarItemId(nextStartableSequenceItem.id);
    }
  }, [nextStartableSequenceItem?.id]);

  const handleStartSequenceFinalVote = useCallback(
    async (itemId: string) => {
      const item = sequenceDisplayItems.find(sequenceItem => sequenceItem.id === itemId);
      const closingJump = resolveClosingJumpTarget({
        item,
        nonFinalItemCount: nonFinalCRItems.length,
        sequenceItems: sequenceDisplayItems,
      });
      if (closingJump.isClosingJump) {
        setSequenceVotingLoading(itemId);
        try {
          if (closingJump.shouldInitialize) {
            if (!agendaItem?.amendment_id || !agendaItem?.id) {
              throw new Error('Missing amendment agenda item context.');
            }

            await initializeChangeRequestVoting({
              amendment_id: agendaItem.amendment_id,
              agenda_item_id: agendaItem.id,
              start_final_vote_if_no_change_requests: false,
            });
          }

          if (closingJump.targetItemId) {
            setSelectedCRToolbarItemId(closingJump.targetItemId);
          }
        } catch (error) {
          console.error('Failed to jump to final vote:', error);
          toast.error(
            t(
              'features.agendas.crTimeline.jumpToFinalVoteFailed',
              'Could not start the final vote.'
            )
          );
        } finally {
          setSequenceVotingLoading(null);
        }
        return;
      }

      if (!item?.vote) return;

      if (getVoteStepKind(item)) {
        await updateAgendaVote({ id: item.vote.id, status: VOTE_PHASE.final });
        return;
      }

      await startFinalPhase(itemId);
    },
    [
      agendaItem?.amendment_id,
      agendaItem?.id,
      initializeChangeRequestVoting,
      nonFinalCRItems.length,
      sequenceDisplayItems,
      startFinalPhase,
      t,
      updateAgendaVote,
    ]
  );

  const handleStartSequenceIndicativeVote = useCallback(
    async (itemId: string) => {
      const item = sequenceDisplayItems.find(sequenceItem => sequenceItem.id === itemId);
      if (!item?.vote) return;

      if (getVoteStepKind(item)) {
        await updateAgendaVote({ id: item.vote.id, status: VOTE_PHASE.indicative });
        return;
      }

      await startIndicativePhase(itemId);
    },
    [sequenceDisplayItems, startIndicativePhase, updateAgendaVote]
  );

  const handleCloseSequenceVoting = useCallback(
    async (itemId: string) => {
      const item = sequenceDisplayItems.find(sequenceItem => sequenceItem.id === itemId);
      if (!item?.vote) return;

      if ((item as { _voteStepKind?: string })._voteStepKind) {
        await updateAgendaVote({
          id: item.vote.id,
          status: 'closed',
          closed_reason: 'manual',
          closed_at: Date.now(),
          closed_by_id: user?.id ?? null,
        });
        return;
      }

      await closeVoting(itemId);
    },
    [closeVoting, sequenceDisplayItems, updateAgendaVote, user?.id]
  );

  const handleToolbarStartVote = useCallback(() => {
    if (!selectedCRToolbarItem) return;
    void handleStartSequenceFinalVote(selectedCRToolbarItem.id);
  }, [handleStartSequenceFinalVote, selectedCRToolbarItem]);

  const handleToolbarStartFinalVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!selectedCRToolbarItem) return;
      void handleStartSequenceFinalVote(selectedCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleStartFinalVote();
  }, [actionBarHook, handleStartSequenceFinalVote, isCRToolbarActive, selectedCRToolbarItem]);

  const handleToolbarCloseVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!selectedCRToolbarItem) return;
      void handleCloseSequenceVoting(selectedCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleCloseFinalVote();
  }, [actionBarHook, handleCloseSequenceVoting, isCRToolbarActive, selectedCRToolbarItem]);

  const handleCastCRVoteFromDialog = useCallback(
    async (choiceId: string) => {
      if (!selectedCRToolbarItem) return;
      await castCRVote(selectedCRToolbarItem, choiceId);
    },
    [selectedCRToolbarItem, castCRVote]
  );

  const selectedCRTitle = useMemo(() => {
    if (!selectedCRToolbarItem) return agendaItem?.title ?? undefined;
    const placeholderTitle = (selectedCRToolbarItem as { _placeholderTitle?: string | null })
      ._placeholderTitle;
    if (placeholderTitle) return placeholderTitle;
    if ((selectedCRToolbarItem as { _voteStepKind?: string })._voteStepKind === 'merge_variant') {
      return selectedCRToolbarItem.vote?.title ?? 'Variant final vote';
    }
    if (selectedCRToolbarItem.is_closing_vote) {
      return t('features.agendas.crTimeline.acceptAmendment');
    }

    const changeRequestIndex = nonFinalCRItems.findIndex(
      item => item.id === selectedCRToolbarItem.id
    );
    const selectedChangeRequest = selectedCRToolbarItem.change_request as
      | (NonNullable<typeof selectedCRToolbarItem.change_request> & {
          display_cr_id?: string | null;
          displayCrId?: string | null;
        })
      | null
      | undefined;
    return (
      selectedChangeRequest?.display_cr_id ||
      selectedChangeRequest?.displayCrId ||
      selectedCRToolbarItem.change_request?.title ||
      `${t('features.agendas.crTimeline.changeRequest')} ${changeRequestIndex + 1}`
    );
  }, [agendaItem?.title, nonFinalCRItems, selectedCRToolbarItem, t]);

  const selectedCRChoices = useMemo(
    () =>
      (selectedCRToolbarItem?.vote?.choices ?? []).map(choice => ({
        id: choice.id,
        label: choice.label || 'Choice',
      })),
    [selectedCRToolbarItem?.vote?.choices]
  );

  const selectedCRDialogPhase = useMemo(() => {
    if (selectedCRPhase === 'final') return 'final' as const;
    if (selectedCRPhase === 'closed') return 'closed' as const;
    return 'indication' as const;
  }, [selectedCRPhase]);
  const voteDialogDocumentPreviewModel = useMemo(
    () =>
      buildVoteDialogDocumentPreviewModel({
        activeItem: isCRToolbarActive ? selectedCRToolbarItem : null,
        items: sequenceDisplayItems,
        discussions: amendmentDiscussions,
        isVotingActive: true,
        getVoteResult,
      }),
    [amendmentDiscussions, isCRToolbarActive, selectedCRToolbarItem, sequenceDisplayItems]
  );
  const voteDialogDocumentPreviewContent = useMemo(() => {
    if (!documentContent || !agendaItem?.amendment_id || !voteDialogDocumentPreviewModel) {
      return null;
    }

    return (
      <CREditorPreview
        documentContent={documentContent}
        suggestionIds={voteDialogDocumentPreviewModel.suggestionIds}
        suggestionResolutions={voteDialogDocumentPreviewModel.suggestionResolutions}
        editingMode={agendaBranchEditingMode}
        amendmentId={agendaItem.amendment_id}
        userId={user?.id}
        userRecord={mappedUserRecord}
        agendaItemId={agendaItem.id}
      />
    );
  }, [
    agendaBranchEditingMode,
    agendaItem?.amendment_id,
    agendaItem?.id,
    documentContent,
    mappedUserRecord,
    user?.id,
    voteDialogDocumentPreviewModel,
  ]);
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
      ? isSelectedClosingVote
      : Boolean(agendaItem?.amendment_id && vote);

    return shouldShowPreview ? agendaForwardingPreview : null;
  }, [
    agendaForwardingPreview,
    agendaItem?.amendment_id,
    isCRToolbarActive,
    isSelectedClosingVote,
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
    logAgendaChangeRequestItems('agenda-details', {
      agendaItemId,
      amendmentId: agendaItem?.amendment_id ?? null,
      editingMode: agendaBranchEditingMode,
      selectedBranchId: selectedAgendaBranchId,
      selectedItemId: selectedCRToolbarItem?.id ?? null,
      items: crDisplayItems,
      pendingDisplayItems: mockCRItems as unknown as ChangeRequestTimelineRow[],
    });
  }, [
    agendaBranchEditingMode,
    agendaItem?.amendment_id,
    agendaItemId,
    crDisplayItems,
    mockCRItems,
    selectedAgendaBranchId,
    selectedCRToolbarItem?.id,
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

  const selectedFinalVoteActionLabels = isCRToolbarActive
    ? getFinalVoteActionLabels({
        item: selectedCRToolbarItem,
        agendaTitle: agendaItem?.title ?? null,
        amendmentTitle: agendaItem?.amendment?.title ?? null,
        branchLabelsById: agendaBranchLabelsById,
        fallbackTarget: selectedCRTitle ?? 'Step',
      })
    : null;

  const startVoteTooltip = isCRToolbarActive
    ? isChangeRequestVotesPlaceholder(selectedCRToolbarItem) && nonFinalCRItems.length === 0
      ? t('features.agendas.crTimeline.jumpToFinalVote', 'Jump to final vote')
      : selectedFinalVoteActionLabels?.start
    : undefined;

  const startFinalVoteTooltip = isCRToolbarActive
    ? isChangeRequestVotesPlaceholder(selectedCRToolbarItem) && nonFinalCRItems.length === 0
      ? t('features.agendas.crTimeline.jumpToFinalVote', 'Jump to final vote')
      : selectedFinalVoteActionLabels?.start
    : undefined;

  const closeVoteTooltip = isCRToolbarActive ? selectedFinalVoteActionLabels?.close : undefined;

  const castIndicativeVoteTooltip = isCRToolbarActive
    ? isSelectedClosingVote
      ? t('features.events.agenda.actions.castIndicativeVote')
      : t('features.agendas.crTimeline.castIndicative')
    : undefined;

  const castFinalVoteTooltip = isCRToolbarActive
    ? (selectedFinalVoteActionLabels?.castFinal ??
      (isSelectedClosingVote
        ? t('features.events.agenda.actions.castFinalVote')
        : t('features.agendas.crTimeline.castFinal')))
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
            gender: speaker.user.gender ?? null,
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
  const eligibleFinalVoterCount = useMemo(
    () =>
      computeEligibleFinalVoterCount({
        participants:
          activeEventParticipants.length > 0
            ? activeEventParticipants
            : (rosterEvent?.participants ?? []),
        offlineParticipants: rosterEvent?.offline_participants ?? [],
      }),
    [activeEventParticipants, rosterEvent?.offline_participants, rosterEvent?.participants]
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
    if (phase === VOTE_PHASE.final) {
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
      phase === VOTE_PHASE.final
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
    if (phase === VOTE_PHASE.final) {
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
      phase === VOTE_PHASE.final
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

  const offlineTallyElection = isCRToolbarActive ? null : election;
  const offlineTallyVote = isCRToolbarActive ? (selectedCRToolbarItem?.vote ?? null) : vote;
  const offlineTallyVoteChoices = isCRToolbarActive
    ? (selectedCRToolbarItem?.vote?.choices ?? [])
    : choices;
  const offlineTallyEntity = useMemo(
    () =>
      buildOfflineTallyEntity({
        phase: offlineTallyPhase,
        agendaTitle: agendaItem?.title ?? null,
        election: offlineTallyElection,
        electionCandidates: candidates,
        vote: offlineTallyVote,
        voteChoices: offlineTallyVoteChoices,
        participantCount: confirmedOfflineParticipantCount,
      }),
    [
      agendaItem?.title,
      candidates,
      confirmedOfflineParticipantCount,
      offlineTallyElection,
      offlineTallyPhase,
      offlineTallyVote,
      offlineTallyVoteChoices,
    ]
  );
  const offlineTallyActionMode = resolveOfflineTallyMode(offlineTallyEntity?.tallies ?? []);
  const showOfflineTallyButton =
    Boolean(offlineTallyEntity?.choices.length) &&
    shouldShowOfflineTallyToolbarButton({
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
      agendaBranchEditingMode={agendaBranchEditingMode}
      branchSelectorBranches={selectableAgendaBranches}
      selectedBranchId={selectedAgendaBranchId}
      branchDiffCandidates={branchDiffCandidates}
      defaultBranchDiffRightCandidateId={defaultBranchDiffRightCandidateId}
      onBranchChange={handleAgendaBranchChange}
      event={event}
      user={user}
      userRecord={mappedUserRecord}
      isLoading={isLoading}
      votingLoading={votingLoading ?? sequenceVotingLoading}
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
      canManageVoteSequence={canManageVoteSequence}
      canJoinSpeakerList={canJoinSpeakerList}
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
      completedItems={sequenceCompletedItems}
      progress={
        sequenceDisplayItems.length > 0
          ? sequenceCompletedItems.length / sequenceDisplayItems.length
          : progress
      }
      isTimelineComplete={
        sequenceDisplayItems.length > 0
          ? sequenceDisplayItems.every(item => item.status === 'completed')
          : isTimelineComplete
      }
      allCRsProcessed={allCRsProcessed}
      hasUserVotedOnCR={hasUserVotedOnCR}
      getUserSelectedChoiceIds={getUserSelectedChoiceIds}
      startIndicativePhase={handleStartSequenceIndicativeVote}
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
      isCRVotingActive={isVoteSequenceActive}
      timelineHasClosingVote={timelineHasClosingVote}
      synthesizedClosingVoteItem={synthesizedClosingVoteItem}
      crDisplayItems={crDisplayItems}
      effectiveClosingVoteItem={effectiveClosingVoteItem}
      isVoteInCRList={isVoteInCRList}
      nonFinalCRItems={nonFinalCRItems}
      fallbackSelectedCRItemId={fallbackSelectedCRItemId}
      selectedCRToolbarItem={selectedCRToolbarItem}
      currentCRSequenceItemId={currentSequenceItem?.id ?? null}
      nextStartableSequenceItem={nextStartableSequenceItem}
      isCRToolbarActive={isCRToolbarActive}
      selectedCRPhase={selectedCRPhase}
      isSelectedClosingVote={isSelectedClosingVote}
      hasUserVotedOnSelectedCR={hasUserVotedOnSelectedCR}
      selectedCRToolbarIndex={selectedCRToolbarIndex}
      hasPreviousChangeRequest={hasPreviousChangeRequest}
      hasNextChangeRequest={hasNextChangeRequest}
      handlePreviousChangeRequest={handlePreviousChangeRequest}
      handleNextChangeRequest={handleNextChangeRequest}
      handleJumpToNextStartableSequenceItem={handleJumpToNextStartableSequenceItem}
      handleStartSequenceFinalVote={handleStartSequenceFinalVote}
      handleToolbarStartVote={handleToolbarStartVote}
      handleToolbarStartFinalVote={handleToolbarStartFinalVote}
      handleToolbarCloseVote={handleToolbarCloseVote}
      handleCastCRVoteFromDialog={handleCastCRVoteFromDialog}
      selectedCRTitle={selectedCRTitle}
      selectedCRChoices={selectedCRChoices}
      selectedCRDialogPhase={selectedCRDialogPhase}
      voteDialogDocumentPreviewContent={voteDialogDocumentPreviewContent}
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
      showSpeakerGender={Boolean(event?.gender_quota_enabled)}
      isUserInSpeakerList={isUserInSpeakerList}
      activeRosterParticipants={activeRosterParticipants}
      isDelegateAssembly={isDelegateAssembly}
      participantsWithProvenance={participantsWithProvenance}
      eligibleParticipantsForNamedResults={eligibleParticipantsForNamedResults}
      confirmedOfflineParticipants={confirmedOfflineParticipants}
      eligibleFinalVoterCount={eligibleFinalVoterCount}
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
