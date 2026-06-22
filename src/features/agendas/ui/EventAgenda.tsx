'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEventData } from '@/features/events/hooks/useEventData';
import { useAgendaItems } from '../hooks/useAgendaItems';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useUserState } from '@/zero/users/useUserState';
import { toast as sonnerToast } from '@/features/shared/ui/ui/sonner';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAgendaItemForwardingContext } from '@/zero/amendments';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAgendaActionBar } from '../hooks/useAgendaActionBar';
import { useAgendaNavigation } from '../hooks/useAgendaNavigation';
import { getVoteResult, useAgendaItemCRVoting } from '../hooks/useAgendaItemCRVoting';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import {
  getEffectiveCRVotingPhase,
  getEffectiveVotingPhase,
  normalizeSearchToken,
  resolveAttendanceMode,
} from '../logic/agendaUiHelpers';
import { canJoinEventSpeakerList } from '../logic/speakerListPermissions';
import {
  getGenderQuotaFeedbackMessage,
  validateSpeakerGenderQuota,
} from '../logic/speakerListGenderQuota';
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
import {
  getOfflineTallySuccessMessage,
  resolveOfflineTallyMode,
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
} from '../logic/offlineTallyToolbar';
import { buildOfflineTallyEntity } from '../logic/offlineTallyEntity';
import { logAgendaChangeRequestItems } from '../logic/logAgendaChangeRequestItems';
import { getFinalVoteActionLabels } from '../logic/finalVoteActionLabels';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/editor/types';
import { useEventById, useEventParticipantsByParticipatedEventIds } from '@/zero/events';
import { VOTE_PHASE, VOTE_PURPOSE } from '@/zero/votes/vote-workflow';
import {
  getOrderedBranches,
  type AmendmentProcessBranchSource,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { normalizeEditingMode } from '@/zero/amendments/editing-mode-policy';
import { buildVoteDialogDocumentPreviewModel } from '../logic/changeRequestDocumentPreview';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { computeEligibleFinalVoterCount } from '@/features/votes/logic/computeEligibleVoters';
import { useAgendaArrowNavigation } from '../hooks/useAgendaArrowNavigation';
import { resolveClosingVoteForAgendaItem } from '../logic/resolveClosingVoteForAgendaItem';

interface EventAgendaProps {
  eventId: string;
}

type EventAgendaItemRow = ReturnType<typeof useAgendaItems>['agendaItems'][number];
import { EventAgendaView } from './EventAgendaView';
export function EventAgenda({ eventId }: EventAgendaProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const navigate = useNavigate();
  const { event, isLoading: eventLoading } = useEventData(eventId);
  const { agendaItems, isLoading } = useAgendaItems(eventId);
  const { can } = usePermissions({ eventId });
  const {
    addSpeaker,
    updateSpeaker,
    removeSpeaker,
    reorderAgendaItems,
    initializeChangeRequestVoting,
  } = useAgendaActions();
  const agendaNav = useAgendaNavigation(eventId);

  // Track current agenda item changes for toast notifications
  const previousAgendaItemIdRef = useRef<string | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  const currentAgendaItemId = event?.current_agenda_item_id ?? undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [streamOpen, setStreamOpen] = useState(true);
  const [streamDetailsOpen, setStreamDetailsOpen] = useState(false);
  const [liveFocusOpen, setLiveFocusOpen] = useState(false);
  const [selectedCRToolbarItemId, setSelectedCRToolbarItemId] = useState<string | null>(null);
  const [addingSpeaker, setAddingSpeaker] = useState(false);
  const [removingSpeaker, setRemovingSpeaker] = useState(false);
  const [, setMarkingSpeakerComplete] = useState<string | null>(null);
  const { verifyVotingPassword } = useVotingPasswordActions();
  const { upsertOfflineTally: upsertElectionOfflineTally } = useElectionActions();
  const {
    updateVote: updateAgendaVote,
    upsertOfflineTally: upsertVoteOfflineTally,
    closeExpiredFinalVotesForEvent,
  } = useVoteActions();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const attendanceMode = resolveAttendanceMode(event);
  const disableVoteButton = attendanceMode === 'offline';
  const eventParticipantEventIds = useMemo(() => [eventId], [eventId]);
  const { participants: activeEventParticipants } =
    useEventParticipantsByParticipatedEventIds(eventParticipantEventIds);

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
  const allowsOfflineElectionTallies = attendanceMode === 'hybrid' || attendanceMode === 'offline';
  const confirmedOfflineParticipantCount =
    event?.offline_participants?.filter(
      participant =>
        participant.attendance_status === 'confirmed' &&
        participant.participation_channel === 'offline'
    ).length ?? 0;
  const eligibleFinalVoterCount = useMemo(
    () =>
      computeEligibleFinalVoterCount({
        participants:
          activeEventParticipants.length > 0
            ? activeEventParticipants
            : (event?.participants ?? []),
        offlineParticipants: event?.offline_participants ?? [],
      }),
    [activeEventParticipants, event?.offline_participants, event?.participants]
  );
  const [isPasswordVerifying, setIsPasswordVerifying] = useState(false);
  const [offlineTallyDialogOpen, setOfflineTallyDialogOpen] = useState(false);
  const [offlineTallyPasswordError, setOfflineTallyPasswordError] = useState<string | null>(null);
  const [offlineTallySubmitError, setOfflineTallySubmitError] = useState<string | null>(null);
  const [isOfflineTallySubmitting, setIsOfflineTallySubmitting] = useState(false);
  const [sequenceVotingLoading, setSequenceVotingLoading] = useState<string | null>(null);
  const [dismissedOverdueAgendaItemId, setDismissedOverdueAgendaItemId] = useState<string | null>(
    null
  );

  // Show toast and auto-scroll when current agenda item changes
  useEffect(() => {
    if (currentAgendaItemId && currentAgendaItemId !== previousAgendaItemIdRef.current) {
      const currentItem = agendaItems.find(item => item.id === currentAgendaItemId);
      if (currentItem && previousAgendaItemIdRef.current !== null) {
        // Only show toast if this is not the initial load
        toast.message(t('features.events.agenda.itemActivated'), {
          description: currentItem.title,
        });
      }
      previousAgendaItemIdRef.current = currentAgendaItemId;

      // Auto-scroll to active item after a short delay
      setTimeout(() => {
        activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [currentAgendaItemId, agendaItems, toast, t]);

  // Check if user can manage agenda items
  const canManageAgenda = can('manage', 'agendaItems');
  const canManageVotes = can('manage_votes', 'events');
  const canJoinSpeakerList = canJoinEventSpeakerList(can);
  const canManageOfflineTallies = can('manage_votes', 'events') || canManageAgenda;
  const [draggedAgendaItemId, setDraggedAgendaItemId] = useState<string | null>(null);
  const [dragOverAgendaItemId, setDragOverAgendaItemId] = useState<string | null>(null);
  const [dragInsertPosition, setDragInsertPosition] = useState<'above' | 'below' | null>(null);
  const orderedAgendaItems = useMemo(
    () =>
      [...agendaItems].sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)),
    [agendaItems]
  );

  const resetAgendaDragState = useCallback(() => {
    setDraggedAgendaItemId(null);
    setDragOverAgendaItemId(null);
    setDragInsertPosition(null);
  }, []);

  const isAgendaItemDraggable = useCallback(
    (runtimeStatus: string) =>
      canManageAgenda && (runtimeStatus === 'planned' || runtimeStatus === 'pending'),
    [canManageAgenda]
  );

  const handleAgendaDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, agendaItemId: string) => {
      if (!canManageAgenda) return;

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', agendaItemId);
      setDraggedAgendaItemId(agendaItemId);
      setDragOverAgendaItemId(agendaItemId);
    },
    [canManageAgenda]
  );

  const handleAgendaDrop = useCallback(
    (dropAgendaItemId: string, position: 'above' | 'below' = 'below') => {
      if (!draggedAgendaItemId || draggedAgendaItemId === dropAgendaItemId) {
        resetAgendaDragState();
        return;
      }

      const sourceIndex = orderedAgendaItems.findIndex(item => item.id === draggedAgendaItemId);
      const targetIndex = orderedAgendaItems.findIndex(item => item.id === dropAgendaItemId);

      if (sourceIndex < 0 || targetIndex < 0) {
        resetAgendaDragState();
        return;
      }

      const reorderedAgendaItems = [...orderedAgendaItems];
      const [movedItem] = reorderedAgendaItems.splice(sourceIndex, 1);
      let insertionIndex = targetIndex;
      if (position === 'below') {
        insertionIndex += 1;
      }
      if (sourceIndex < targetIndex) {
        insertionIndex -= 1;
      }
      insertionIndex = Math.max(0, Math.min(insertionIndex, reorderedAgendaItems.length));
      reorderedAgendaItems.splice(insertionIndex, 0, movedItem);

      const reorderPayload: Parameters<typeof reorderAgendaItems>[0] = {
        items: reorderedAgendaItems.map((item, index) => ({
          id: item.id,
          order_index: index + 1,
        })),
      };

      reorderAgendaItems(reorderPayload);

      resetAgendaDragState();
    },
    [draggedAgendaItemId, orderedAgendaItems, reorderAgendaItems, resetAgendaDragState]
  );

  const handleAgendaDragEnd = useCallback(() => {
    resetAgendaDragState();
  }, [resetAgendaDragState]);

  // Event status
  const isEventStarted = event?.status === 'active' || event?.status === 'in-progress';
  const eventStartTimestamp = typeof event?.start_date === 'number' ? event.start_date : null;

  const activeAgendaItem = useMemo<EventAgendaItemRow | null>(
    () =>
      agendaItems.find(
        item =>
          getAgendaRuntimeStatus({
            id: item.id,
            status: item.status,
            start_time: item.start_time,
            end_time: item.end_time,
            activated_at: item.activated_at,
            completed_at: item.completed_at,
          }) === 'in-progress'
      ) ?? null,
    [agendaItems]
  );

  const liveAgendaItem = useMemo<EventAgendaItemRow | null>(() => {
    if (currentAgendaItemId) {
      const eventCurrentItem = agendaItems.find(item => item.id === currentAgendaItemId);
      const eventCurrentRuntimeStatus = eventCurrentItem
        ? getAgendaRuntimeStatus({
            id: eventCurrentItem.id,
            status: eventCurrentItem.status,
            start_time: eventCurrentItem.start_time,
            end_time: eventCurrentItem.end_time,
            activated_at: eventCurrentItem.activated_at,
            completed_at: eventCurrentItem.completed_at,
            currentAgendaItemId,
          })
        : null;

      if (eventCurrentItem && eventCurrentRuntimeStatus !== 'completed') {
        return eventCurrentItem;
      }
    }

    if (agendaNav.currentAgendaItem?.id) {
      return (
        agendaItems.find(item => item.id === agendaNav.currentAgendaItem?.id) ?? activeAgendaItem
      );
    }

    return activeAgendaItem;
  }, [agendaItems, currentAgendaItemId, agendaNav.currentAgendaItem?.id, activeAgendaItem]);
  const liveAgendaItemId = liveAgendaItem?.id;

  // Unified spotlight used by stream panel, toolbar TOP label and agenda pointer.
  const spotlightAgendaItem = useMemo<EventAgendaItemRow | null>(() => {
    if (liveAgendaItem) {
      return liveAgendaItem;
    }

    if (agendaNav.startableAgendaItem?.id) {
      return agendaItems.find(item => item.id === agendaNav.startableAgendaItem?.id) ?? null;
    }

    return null;
  }, [agendaItems, agendaNav.startableAgendaItem?.id, liveAgendaItem]);
  const spotlightAgendaItemId = spotlightAgendaItem?.id;
  const streamAgendaItem = spotlightAgendaItem as EventAgendaItemRow | null;
  const streamAgendaItemAmendment = streamAgendaItem?.amendment as
    | {
        title?: string | null;
        editing_mode?: string | null;
        current_process_run?: { branches?: readonly AmendmentProcessBranchSource[] | null } | null;
        document?: { content?: unknown } | null;
        discussions?: readonly unknown[] | null;
      }
    | null
    | undefined;
  const streamAgendaItemAmendmentEditingMode = normalizeEditingMode(
    streamAgendaItemAmendment?.editing_mode
  );
  const { can: canStreamAmendment } = usePermissions({
    eventId,
    amendment: streamAgendaItem?.amendment ?? undefined,
  });
  const canManageAgendaVoteSequence = canManageVotes || canStreamAmendment('manage', 'amendments');

  const streamRuntimeStatus = streamAgendaItem
    ? getAgendaRuntimeStatus({
        id: streamAgendaItem.id,
        status: streamAgendaItem.status,
        start_time: streamAgendaItem.start_time,
        end_time: streamAgendaItem.end_time,
        activated_at: streamAgendaItem.activated_at,
        completed_at: streamAgendaItem.completed_at,
        currentAgendaItemId: liveAgendaItemId,
      })
    : null;
  const streamIsLive =
    streamRuntimeStatus === 'in-progress' &&
    Boolean(streamAgendaItem?.id) &&
    streamAgendaItem?.id === liveAgendaItemId;

  const overdueStartCandidate = useMemo(() => {
    if (!canManageAgenda || liveAgendaItem || !agendaNav.startableAgendaItem) {
      return null;
    }

    const candidate = agendaItems.find(item => item.id === agendaNav.startableAgendaItem?.id);
    if (!candidate || typeof candidate.calculated_start_time !== 'number') {
      return null;
    }

    if (candidate.calculated_start_time >= Date.now()) {
      return null;
    }

    return candidate;
  }, [agendaItems, agendaNav.startableAgendaItem, canManageAgenda, liveAgendaItem]);

  useEffect(() => {
    if (!overdueStartCandidate || dismissedOverdueAgendaItemId === overdueStartCandidate.id) {
      return;
    }

    const toastId = `agenda-start-reminder-${overdueStartCandidate.id}`;
    const markReminderDismissed = () => {
      setDismissedOverdueAgendaItemId(current =>
        current === overdueStartCandidate.id ? current : overdueStartCandidate.id
      );
    };
    const dismissReminder = () => {
      markReminderDismissed();
      sonnerToast.dismiss(toastId);
    };

    sonnerToast.warning(t('features.events.agenda.startReminderTitle'), {
      id: toastId,
      description: overdueStartCandidate.title
        ? `${t('features.events.agenda.startReminderDescription')} (${overdueStartCandidate.title})`
        : t('features.events.agenda.startReminderDescription'),
      duration: 15000,
      action: {
        label: t('features.events.navigation.start'),
        onClick: () => {
          dismissReminder();
          void agendaNav.startFirstPendingItem();
        },
      },
      cancel: {
        label: t('common.actions.later'),
        onClick: dismissReminder,
      },
      onAutoClose: markReminderDismissed,
      onDismiss: markReminderDismissed,
    });
  }, [agendaNav.startFirstPendingItem, overdueStartCandidate, dismissedOverdueAgendaItemId, t]);

  const streamSpeakerListData = useMemo(() => {
    return (streamAgendaItem?.speaker_list || []).map(speaker => ({
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
  }, [streamAgendaItem?.speaker_list]);

  const isUserInSpeakerList = useMemo(() => {
    return streamSpeakerListData.some(
      speaker => speaker.user?.id === user?.id && !speaker.completed
    );
  }, [streamSpeakerListData, user?.id]);

  const streamElection = streamAgendaItem?.election?.[0] ?? null;
  const streamVotes = streamAgendaItem?.votes ?? [];
  const streamClosingVote = resolveClosingVoteForAgendaItem(streamVotes);
  const streamVariantVote =
    streamVotes.find(
      (candidate: { purpose?: string | null }) => candidate.purpose === VOTE_PURPOSE.mergeVariant
    ) ?? null;
  const streamVote =
    streamClosingVote ??
    streamVotes.find(
      (candidate: { purpose?: string | null }) => candidate.purpose !== VOTE_PURPOSE.mergeVariant
    ) ??
    streamVotes[0] ??
    null;
  const streamDelegateAssignmentMeta = (
    streamElection as { delegate_assignment_meta?: { targetEventId?: string } | null } | null
  )?.delegate_assignment_meta;
  const { event: streamDelegateTargetEvent } = useEventById(
    streamDelegateAssignmentMeta?.targetEventId
  );
  const streamForwardingContext = useAgendaItemForwardingContext(streamAgendaItem?.id);
  const crVoting = useAgendaItemCRVoting(streamAgendaItem?.id ?? '', user?.id);
  const { election: actionBarElection, candidates: actionBarCandidates } = useElectionState({
    agendaItemId: streamAgendaItem?.id,
  });
  const toolbarElection = useMemo(() => {
    if (!actionBarElection) {
      return streamElection;
    }

    return {
      ...streamElection,
      ...actionBarElection,
      candidates:
        actionBarCandidates.length > 0
          ? actionBarCandidates
          : (actionBarElection.candidates ?? streamElection?.candidates ?? []),
    };
  }, [actionBarCandidates, actionBarElection, streamElection]);
  const streamVotingPhase = getEffectiveVotingPhase(
    streamElection?.status ?? streamVote?.status,
    streamAgendaItem?.voting_phase ?? null
  );
  const toolbarVotingPhase = getEffectiveVotingPhase(
    toolbarElection?.status ?? streamVote?.status,
    streamAgendaItem?.voting_phase ?? null
  );
  const timelineHasVariantVote = useMemo(
    () => crVoting.crTimeline.some(item => getVoteStepKind(item) === 'merge_variant'),
    [crVoting.crTimeline]
  );
  const synthesizedVariantVoteItem = useMemo(() => {
    if (!streamAgendaItem?.amendment_id || !streamVariantVote || timelineHasVariantVote) {
      return null;
    }
    return buildVariantVoteFromAgendaVote(
      streamVariantVote,
      0
    ) as unknown as ChangeRequestTimelineRow;
  }, [streamAgendaItem?.amendment_id, streamVariantVote, timelineHasVariantVote]);
  const synthesizedClosingVoteItem = useMemo(() => {
    if (!streamAgendaItem?.amendment_id || !streamClosingVote) return null;
    if (crVoting.closingVoteItem) return null;
    return buildClosingVoteFromAgendaVote(
      streamClosingVote,
      crVoting.crTimeline.length + (synthesizedVariantVoteItem ? 1 : 0)
    ) as unknown as ChangeRequestTimelineRow;
  }, [
    crVoting.crTimeline.length,
    crVoting.closingVoteItem,
    synthesizedVariantVoteItem,
    streamAgendaItem?.amendment_id,
    streamClosingVote,
  ]);
  const effectiveClosingVoteItem = useMemo(
    () => crVoting.closingVoteItem ?? synthesizedClosingVoteItem,
    [crVoting.closingVoteItem, synthesizedClosingVoteItem]
  );
  const streamChangeRequestVotesPlaceholderItem = useMemo(() => {
    if (!synthesizedVariantVoteItem || crVoting.crTimeline.length > 0 || !streamAgendaItem?.id) {
      return null;
    }

    const changeRequestVotesWereSkipped =
      effectiveClosingVoteItem?.vote?.status === VOTE_PHASE.final ||
      effectiveClosingVoteItem?.vote?.status === 'final' ||
      effectiveClosingVoteItem?.vote?.status === 'closed';

    return {
      ...buildVoteSequencePlaceholder({
        agendaItemId: streamAgendaItem.id,
        orderIndex: 1,
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
    crVoting.crTimeline.length,
    effectiveClosingVoteItem?.vote?.status,
    streamAgendaItem?.id,
    synthesizedVariantVoteItem,
    t,
  ]);
  const streamClosingVotePlaceholderItem = useMemo(() => {
    if (
      !synthesizedVariantVoteItem ||
      effectiveClosingVoteItem ||
      crVoting.closingVoteItem ||
      !streamAgendaItem?.id
    ) {
      return null;
    }

    return buildVoteSequencePlaceholder({
      agendaItemId: streamAgendaItem.id,
      orderIndex:
        1 + crVoting.crTimeline.length + (streamChangeRequestVotesPlaceholderItem ? 1 : 0),
      kind: 'closing_placeholder',
      title: t('features.agendas.crTimeline.finalVotePlaceholder', 'Final vote'),
      description: t(
        'features.agendas.crTimeline.finalVotePlaceholderDescription',
        'The exact final vote will appear after the variant final vote is decided.'
      ),
    }) as unknown as ChangeRequestTimelineRow;
  }, [
    crVoting.crTimeline.length,
    crVoting.closingVoteItem,
    effectiveClosingVoteItem,
    streamAgendaItem?.id,
    streamChangeRequestVotesPlaceholderItem,
    synthesizedVariantVoteItem,
    t,
  ]);
  const streamVoteSequenceItems = useMemo(
    () => [
      ...(synthesizedVariantVoteItem ? [synthesizedVariantVoteItem] : []),
      ...(streamChangeRequestVotesPlaceholderItem ? [streamChangeRequestVotesPlaceholderItem] : []),
      ...crVoting.crTimeline,
      ...(synthesizedClosingVoteItem ? [synthesizedClosingVoteItem] : []),
      ...(streamClosingVotePlaceholderItem ? [streamClosingVotePlaceholderItem] : []),
    ],
    [
      crVoting.crTimeline,
      streamChangeRequestVotesPlaceholderItem,
      streamClosingVotePlaceholderItem,
      synthesizedClosingVoteItem,
      synthesizedVariantVoteItem,
    ]
  );
  const nonFinalCRItems = useMemo(
    () =>
      crVoting.crTimeline.filter(
        item => !item.is_closing_vote && getVoteStepKind(item) !== 'merge_variant'
      ),
    [crVoting.crTimeline]
  );
  const currentSequenceItem = useMemo(
    () =>
      resolveCurrentVoteSequenceItem({
        currentItemId: crVoting.currentItem?.id ?? null,
        sequenceItems: streamVoteSequenceItems,
      }),
    [crVoting.currentItem?.id, streamVoteSequenceItems]
  );
  const fallbackSelectedCRItemId = useMemo(() => {
    if (currentSequenceItem?.id) return currentSequenceItem.id;
    return effectiveClosingVoteItem?.id ?? null;
  }, [currentSequenceItem?.id, effectiveClosingVoteItem?.id]);

  useEffect(() => {
    if (!streamAgendaItem?.amendment_id) {
      if (selectedCRToolbarItemId) {
        setSelectedCRToolbarItemId(null);
      }
      return;
    }

    const nextSelectedItemId = resolveVoteSequenceSelectionUpdate({
      selectedItemId: selectedCRToolbarItemId,
      sequenceItems: streamVoteSequenceItems,
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
    streamVoteSequenceItems,
    streamAgendaItem?.amendment_id,
  ]);

  const activeCRToolbarItem = useMemo(
    () =>
      streamVoteSequenceItems.find(item => item.id === selectedCRToolbarItemId) ??
      streamVoteSequenceItems.find(item => item.id === fallbackSelectedCRItemId) ??
      null,
    [fallbackSelectedCRItemId, selectedCRToolbarItemId, streamVoteSequenceItems]
  );
  const nextStartableSequenceItem = useMemo(
    () =>
      resolveNextStartableVoteSequenceItem({
        selectedItemId: activeCRToolbarItem?.id ?? selectedCRToolbarItemId,
        sequenceItems: streamVoteSequenceItems,
      }),
    [activeCRToolbarItem?.id, selectedCRToolbarItemId, streamVoteSequenceItems]
  );
  const isCRToolbarActive =
    !!streamAgendaItem?.amendment_id && streamVoteSequenceItems.length > 0 && !!activeCRToolbarItem;
  const selectedCRPhase = getEffectiveCRVotingPhase(activeCRToolbarItem);
  const isSelectedClosingVote = !!activeCRToolbarItem?.is_closing_vote;
  const hasUserVotedOnSelectedCR = useMemo(
    () => (activeCRToolbarItem ? crVoting.hasUserVoted(activeCRToolbarItem) : false),
    [activeCRToolbarItem, crVoting]
  );
  const selectedCRTitle = useMemo(() => {
    if (!activeCRToolbarItem) return streamAgendaItem?.title ?? undefined;
    const placeholderTitle = (activeCRToolbarItem as { _placeholderTitle?: string | null })
      ._placeholderTitle;
    if (placeholderTitle) return placeholderTitle;
    if ((activeCRToolbarItem as { _voteStepKind?: string })._voteStepKind === 'merge_variant') {
      return activeCRToolbarItem.vote?.title ?? 'Variant final vote';
    }
    if (activeCRToolbarItem.is_closing_vote) {
      return t('features.agendas.crTimeline.acceptAmendment');
    }

    const changeRequestIndex = nonFinalCRItems.findIndex(
      item => item.id === activeCRToolbarItem.id
    );
    return (
      activeCRToolbarItem.change_request?.title ||
      `${t('features.agendas.crTimeline.changeRequest')} ${changeRequestIndex + 1}`
    );
  }, [activeCRToolbarItem, nonFinalCRItems, streamAgendaItem?.title, t]);
  const selectedCRChoices = useMemo(
    () =>
      (activeCRToolbarItem?.vote?.choices ?? []).map(choice => ({
        id: choice.id,
        label: choice.label || 'Choice',
      })),
    [activeCRToolbarItem?.vote?.choices]
  );
  const selectedCRDialogPhase = useMemo(() => {
    if (selectedCRPhase === 'final') return 'final' as const;
    if (selectedCRPhase === 'closed') return 'closed' as const;
    return 'indication' as const;
  }, [selectedCRPhase]);
  const streamAgendaProcessBranches = useMemo(
    () =>
      getOrderedBranches(
        (streamAgendaItemAmendment?.current_process_run?.branches ??
          []) as readonly AmendmentProcessBranchSource[]
      ),
    [streamAgendaItemAmendment?.current_process_run?.branches]
  );
  const streamBranchLabelsById = useMemo(
    () => new Map(streamAgendaProcessBranches.map(branch => [branch.id, branch.title ?? null])),
    [streamAgendaProcessBranches]
  );
  const activeCRProcessBranchId =
    (activeCRToolbarItem?.change_request as { process_branch_id?: string | null } | null)
      ?.process_branch_id ??
    (activeCRToolbarItem as { process_branch_id?: string | null } | null)?.process_branch_id ??
    null;
  const streamPreviewBranchId =
    activeCRProcessBranchId ??
    streamForwardingContext.currentStepRun?.branch_id ??
    streamForwardingContext.currentStepRun?.branch?.id ??
    streamForwardingContext.processRun?.active_branch_id ??
    null;
  const streamPreviewProcessBranch = useMemo(
    () =>
      streamPreviewBranchId
        ? (streamAgendaProcessBranches.find(branch => branch.id === streamPreviewBranchId) ?? null)
        : null,
    [streamAgendaProcessBranches, streamPreviewBranchId]
  );
  const streamDocumentContent = (streamPreviewProcessBranch?.document?.content ??
    streamPreviewProcessBranch?.document_version?.content ??
    streamAgendaItemAmendment?.document?.content) as Value | undefined;
  const streamDiscussionsRaw =
    streamPreviewProcessBranch?.discussions ?? streamAgendaItemAmendment?.discussions;
  const streamAmendmentDiscussions = useMemo<TDiscussion[]>(() => {
    if (!Array.isArray(streamDiscussionsRaw)) return [];

    return (streamDiscussionsRaw as Record<string, unknown>[]).map(d => ({
      id: (d.id as string) ?? '',
      crId: (d.crId as string) ?? null,
      displayCrId: (d.displayCrId as string) ?? (d.crId as string) ?? null,
      branchSequenceNumber: (d.branchSequenceNumber as number) ?? null,
      title: (d.title as string) ?? '',
      userId: (d.userId as string) ?? '',
      comments: (d.comments as TDiscussion['comments']) ?? [],
      createdAt: new Date((d.createdAt as number) ?? 0),
      isResolved: (d.isResolved as boolean) ?? false,
      confirmationStatus: (d.confirmationStatus as TDiscussion['confirmationStatus']) ?? undefined,
      changeRequestStatus: (d.changeRequestStatus as string) ?? null,
      changeRequestEntityId: (d.changeRequestEntityId as string) ?? undefined,
    }));
  }, [streamDiscussionsRaw]);
  const streamVoteDialogDocumentPreviewModel = useMemo(
    () =>
      buildVoteDialogDocumentPreviewModel({
        activeItem: isCRToolbarActive ? activeCRToolbarItem : null,
        items: streamVoteSequenceItems,
        discussions: streamAmendmentDiscussions,
        isVotingActive: true,
        getVoteResult,
      }),
    [activeCRToolbarItem, isCRToolbarActive, streamAmendmentDiscussions, streamVoteSequenceItems]
  );
  const streamVoteDialogDocumentPreviewContent = useMemo(() => {
    if (
      !streamDocumentContent ||
      !streamAgendaItem?.amendment_id ||
      !streamVoteDialogDocumentPreviewModel
    ) {
      return null;
    }

    return (
      <CREditorPreview
        documentContent={streamDocumentContent}
        suggestionIds={streamVoteDialogDocumentPreviewModel.suggestionIds}
        suggestionResolutions={streamVoteDialogDocumentPreviewModel.suggestionResolutions}
        editingMode={normalizeEditingMode(
          streamPreviewProcessBranch?.editing_mode ?? streamAgendaItemAmendmentEditingMode
        )}
        amendmentId={streamAgendaItem.amendment_id}
        userId={user?.id}
        agendaItemId={streamAgendaItem.id}
      />
    );
  }, [
    streamAgendaItem?.amendment_id,
    streamAgendaItem?.id,
    streamAgendaItemAmendmentEditingMode,
    streamDocumentContent,
    streamPreviewProcessBranch?.editing_mode,
    streamVoteDialogDocumentPreviewModel,
    user?.id,
  ]);
  const streamForwardingPreview = useMemo(() => {
    const nextStepRun = streamForwardingContext.nextStepRun;
    if (!nextStepRun?.event) {
      return null;
    }

    const shouldShowPreview = isCRToolbarActive
      ? isSelectedClosingVote
      : Boolean(streamAgendaItem?.amendment_id && streamVote);

    if (!shouldShowPreview) {
      return null;
    }

    return {
      nextEventId: nextStepRun.event.id ?? null,
      nextGroupName: nextStepRun.target_group?.name ?? null,
      nextEventTitle: nextStepRun.event.title ?? 'Next event',
      nextEventStartDate: nextStepRun.event.start_date ?? null,
    };
  }, [
    isCRToolbarActive,
    isSelectedClosingVote,
    streamAgendaItem?.amendment_id,
    streamForwardingContext.nextStepRun,
    streamVote,
  ]);
  const effectiveToolbarVotingPhase = isCRToolbarActive ? selectedCRPhase : toolbarVotingPhase;
  const toolbarOfflineTallyPhaseSource = effectiveToolbarVotingPhase;
  const toolbarOfflineTallyPhase = useMemo(
    () =>
      resolveOfflineTallyPhase({
        allowsOfflineTallies: allowsOfflineElectionTallies,
        canManageOfflineTallies,
        votingPhase: toolbarOfflineTallyPhaseSource,
      }),
    [allowsOfflineElectionTallies, canManageOfflineTallies, toolbarOfflineTallyPhaseSource]
  );

  const toolbarOfflineTallyElection = isCRToolbarActive ? null : toolbarElection;
  const toolbarOfflineTallyVote = isCRToolbarActive
    ? (activeCRToolbarItem?.vote ?? null)
    : streamVote;
  const toolbarOfflineTallyEntity = useMemo(
    () =>
      buildOfflineTallyEntity({
        phase: toolbarOfflineTallyPhase,
        agendaTitle: streamAgendaItem?.title ?? null,
        election: toolbarOfflineTallyElection,
        vote: toolbarOfflineTallyVote,
        participantCount: confirmedOfflineParticipantCount,
      }),
    [
      confirmedOfflineParticipantCount,
      streamAgendaItem?.title,
      toolbarOfflineTallyElection,
      toolbarOfflineTallyPhase,
      toolbarOfflineTallyVote,
    ]
  );
  const toolbarOfflineTallyMode = resolveOfflineTallyMode(toolbarOfflineTallyEntity?.tallies ?? []);
  const showOfflineTallyButton =
    Boolean(toolbarOfflineTallyEntity?.choices.length) &&
    shouldShowOfflineTallyToolbarButton({
      attendanceMode,
      canManageVotes,
      phase: toolbarOfflineTallyPhase,
    });
  const selectedFinalVoteActionLabels = isCRToolbarActive
    ? getFinalVoteActionLabels({
        item: activeCRToolbarItem,
        agendaTitle: streamAgendaItem?.title ?? null,
        amendmentTitle: streamAgendaItemAmendment?.title ?? null,
        branchLabelsById: streamBranchLabelsById,
        fallbackTarget: selectedCRTitle ?? null,
      })
    : null;
  const startVoteTooltip = isCRToolbarActive
    ? isChangeRequestVotesPlaceholder(activeCRToolbarItem) && nonFinalCRItems.length === 0
      ? t('features.agendas.crTimeline.jumpToFinalVote', 'Jump to final vote')
      : selectedFinalVoteActionLabels?.start
    : undefined;
  const startFinalVoteTooltip = isCRToolbarActive
    ? isChangeRequestVotesPlaceholder(activeCRToolbarItem) && nonFinalCRItems.length === 0
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

  const indicativeSelections = useMemo(
    () => streamElection?.indicative_selections ?? [],
    [streamElection?.indicative_selections]
  );
  const finalSelections = useMemo(
    () => streamElection?.final_selections ?? [],
    [streamElection?.final_selections]
  );
  const userElector = useMemo(() => {
    return streamElection?.electors?.find(
      (elector: { user_id?: string | null }) => elector.user_id === user?.id
    );
  }, [streamElection?.electors, user?.id]);
  const userHasElectionVoted = useMemo(() => {
    if (!userElector) return false;
    const phase = streamElection?.status;
    if (phase === VOTE_PHASE.final) {
      return (streamElection?.final_participations ?? []).some(
        (participation: { elector_id?: string | null }) =>
          participation.elector_id === userElector.id
      );
    }
    return (streamElection?.indicative_participations ?? []).some(
      (participation: { elector_id?: string | null }) => participation.elector_id === userElector.id
    );
  }, [streamElection, userElector]);
  const userSelectedCandidateIds = useMemo(() => {
    if (!userElector) return [];
    const phase = streamElection?.status;
    const participations =
      phase === VOTE_PHASE.final
        ? (streamElection?.final_participations ?? [])
        : (streamElection?.indicative_participations ?? []);
    const userParticipation = participations.find(
      (participation: { elector_id?: string | null }) => participation.elector_id === userElector.id
    );
    if (!userParticipation) return [];

    return (userParticipation.selections ?? [])
      .map(
        (selection: { candidate_id?: string | null; candidate?: { id: string } | null }) =>
          selection.candidate?.id ?? selection.candidate_id ?? ''
      )
      .filter(Boolean);
  }, [streamElection, userElector]);

  const indicativeDecisions = useMemo(
    () => streamVote?.indicative_decisions ?? [],
    [streamVote?.indicative_decisions]
  );
  const finalDecisions = useMemo(
    () => streamVote?.final_decisions ?? [],
    [streamVote?.final_decisions]
  );
  const userVoter = useMemo(() => {
    return streamVote?.voters?.find(
      (voter: { user_id?: string | null }) => voter.user_id === user?.id
    );
  }, [streamVote?.voters, user?.id]);
  const toolbarVote = useMemo(
    () => (isCRToolbarActive ? (activeCRToolbarItem?.vote ?? streamVote) : streamVote),
    [activeCRToolbarItem?.vote, isCRToolbarActive, streamVote]
  );
  const toolbarUserVoter = useMemo(() => {
    return toolbarVote?.voters?.find(
      (voter: { user_id?: string | null }) => voter.user_id === user?.id
    );
  }, [toolbarVote?.voters, user?.id]);
  const actionBarHook = useAgendaActionBar({
    eventId,
    currentAgendaItem: streamAgendaItem
      ? {
          id: streamAgendaItem.id,
          type: streamAgendaItem.type,
          status: streamAgendaItem.status,
          voting_phase: streamVotingPhase,
          speaker_list: streamAgendaItem.speaker_list,
        }
      : null,
    eventTitle: event?.title,
    election: toolbarElection,
    vote: toolbarVote,
    electorId: userElector?.id,
    voterId: toolbarUserVoter?.id,
    eventGenderQuotaEnabled: Boolean(event?.gender_quota_enabled),
  });
  const toolbarAgendaItem = spotlightAgendaItem as EventAgendaItemRow | null;
  const topNumberByAgendaItemId = useMemo(
    () => new Map(orderedAgendaItems.map((item, index) => [item.id, index + 1])),
    [orderedAgendaItems]
  );
  const toolbarAgendaItemTopNumber =
    toolbarAgendaItem?.id != null ? topNumberByAgendaItemId.get(toolbarAgendaItem.id) : undefined;
  const streamAgendaItemTopNumber =
    streamAgendaItem?.id != null ? topNumberByAgendaItemId.get(streamAgendaItem.id) : undefined;
  const userHasVoteVoted = useMemo(() => {
    if (!userVoter) return false;
    const phase = streamVote?.status;
    if (phase === VOTE_PHASE.final) {
      return (streamVote?.final_participations ?? []).some(
        (participation: { voter_id?: string | null }) => participation.voter_id === userVoter.id
      );
    }
    return (streamVote?.indicative_participations ?? []).some(
      (participation: { voter_id?: string | null }) => participation.voter_id === userVoter.id
    );
  }, [streamVote, userVoter]);
  const userSelectedChoiceIds = useMemo(() => {
    if (!userVoter) return [];
    const phase = streamVote?.status;
    const participations =
      phase === VOTE_PHASE.final
        ? (streamVote?.final_participations ?? [])
        : (streamVote?.indicative_participations ?? []);
    const userParticipation = participations.find(
      (participation: { voter_id?: string | null }) => participation.voter_id === userVoter.id
    );
    if (!userParticipation) return [];

    return (userParticipation.decisions ?? [])
      .map((decision: { choice_id?: string | null; choice?: { id: string } | null }) => {
        return decision.choice?.id ?? decision.choice_id ?? '';
      })
      .filter(Boolean);
  }, [streamVote, userVoter]);
  const handleStartSequenceFinalVote = useCallback(
    async (itemId: string) => {
      const item = streamVoteSequenceItems.find(sequenceItem => sequenceItem.id === itemId);
      const closingJump = resolveClosingJumpTarget({
        item,
        nonFinalItemCount: nonFinalCRItems.length,
        sequenceItems: streamVoteSequenceItems,
      });
      if (closingJump.isClosingJump) {
        setSequenceVotingLoading(itemId);
        try {
          if (closingJump.shouldInitialize) {
            if (!streamAgendaItem?.amendment_id || !streamAgendaItem?.id) {
              throw new Error('Missing amendment agenda item context.');
            }

            await initializeChangeRequestVoting({
              amendment_id: streamAgendaItem.amendment_id,
              agenda_item_id: streamAgendaItem.id,
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

      await crVoting.startFinalPhase(itemId);
    },
    [
      crVoting,
      initializeChangeRequestVoting,
      nonFinalCRItems.length,
      streamAgendaItem?.amendment_id,
      streamAgendaItem?.id,
      streamVoteSequenceItems,
      t,
      updateAgendaVote,
    ]
  );
  const handleToolbarStartVote = useCallback(() => {
    if (!activeCRToolbarItem) return;
    void handleStartSequenceFinalVote(activeCRToolbarItem.id);
  }, [activeCRToolbarItem, handleStartSequenceFinalVote]);
  const handleJumpToNextStartableSequenceItem = useCallback(() => {
    if (nextStartableSequenceItem?.id) {
      setSelectedCRToolbarItemId(nextStartableSequenceItem.id);
    }
  }, [nextStartableSequenceItem?.id]);

  useAgendaArrowNavigation({ agendaNav });

  const handleToolbarStartFinalVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!activeCRToolbarItem) return;
      void handleStartSequenceFinalVote(activeCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleStartFinalVote();
  }, [actionBarHook, activeCRToolbarItem, handleStartSequenceFinalVote, isCRToolbarActive]);
  const handleToolbarCloseVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!activeCRToolbarItem) return;
      if ((activeCRToolbarItem as { _voteStepKind?: string })._voteStepKind) {
        if (activeCRToolbarItem.vote?.id) {
          void updateAgendaVote({ id: activeCRToolbarItem.vote.id, status: 'closed' });
        }
        return;
      }
      void crVoting.closeVoting(activeCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleCloseFinalVote();
  }, [actionBarHook, activeCRToolbarItem, crVoting, isCRToolbarActive, updateAgendaVote]);
  useEffect(() => {
    logAgendaChangeRequestItems('agenda-overview', {
      agendaItemId: streamAgendaItem?.id ?? null,
      amendmentId: streamAgendaItem?.amendment_id ?? null,
      editingMode: streamAgendaItemAmendmentEditingMode,
      selectedItemId: activeCRToolbarItem?.id ?? null,
      items: streamVoteSequenceItems,
    });
  }, [
    activeCRToolbarItem?.id,
    streamAgendaItemAmendmentEditingMode,
    streamAgendaItem?.amendment_id,
    streamAgendaItem?.id,
    streamVoteSequenceItems,
  ]);
  const handleCastCRVoteFromDialog = useCallback(
    async (choiceId: string) => {
      if (!activeCRToolbarItem) return;
      await crVoting.castCRVote(activeCRToolbarItem, choiceId);
    },
    [activeCRToolbarItem, crVoting]
  );
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
      if (!toolbarOfflineTallyEntity || !toolbarOfflineTallyPhase) {
        return;
      }

      setOfflineTallyPasswordError(null);
      setOfflineTallySubmitError(null);
      setIsOfflineTallySubmitting(true);

      try {
        await verifyVotingPassword(password);

        const correlationId = `${toolbarOfflineTallyEntity.kind}-offline-tally:${crypto.randomUUID()}`;
        const existingCountByChoiceId = new Map(
          toolbarOfflineTallyEntity.tallies.map(tally => [tally.id, tally.count ?? 0])
        );
        const updates = toolbarOfflineTallyEntity.choices
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
          if (toolbarOfflineTallyEntity.kind === 'election') {
            await upsertElectionOfflineTally({
              election_id: toolbarOfflineTallyEntity.itemId,
              phase: toolbarOfflineTallyPhase,
              candidate_id: update.choiceId,
              count: update.count,
              debug_correlation_id: correlationId,
            });
          } else {
            await upsertVoteOfflineTally({
              vote_id: toolbarOfflineTallyEntity.itemId,
              phase: toolbarOfflineTallyPhase,
              choice_id: update.choiceId,
              count: update.count,
              debug_correlation_id: correlationId,
            });
          }
        }

        toast.success(getOfflineTallySuccessMessage(toolbarOfflineTallyPhase));
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
          action: message.includes('Offline election totals exceed the current cap')
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
      toolbarOfflineTallyEntity,
      toolbarOfflineTallyPhase,
      upsertElectionOfflineTally,
      upsertVoteOfflineTally,
      verifyVotingPassword,
    ]
  );

  const handleAddToSpeakerList = async () => {
    if (!user?.id || !streamAgendaItem?.id || !canJoinSpeakerList) return;

    setAddingSpeaker(true);
    try {
      const quotaResult = validateSpeakerGenderQuota({
        enabled: Boolean(event?.gender_quota_enabled && currentUser),
        speakerGender: currentUser?.gender ?? null,
        speakers: streamSpeakerListData,
      });

      if (!quotaResult.allowed) {
        toast.error(getGenderQuotaFeedbackMessage(quotaResult, t));
        return;
      }

      const maxOrder =
        streamSpeakerListData.length > 0
          ? Math.max(...streamSpeakerListData.map(speaker => speaker.order || 0))
          : 0;

      await addSpeaker({
        id: crypto.randomUUID(),
        title: translateText('generated.inline.0001_speaker_7c23b0d9'),
        time: 3,
        completed: false,
        order_index: maxOrder + 1,
        user_id: user.id,
        agenda_item_id: streamAgendaItem.id,
        start_time: null,
        end_time: null,
      });
    } catch (error) {
      console.error('Error adding to speaker list:', error);
    } finally {
      setAddingSpeaker(false);
    }
  };

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

      const sorted = [...streamSpeakerListData].sort((a, b) => a.order - b.order);
      const activeAfter = sorted.filter(speaker => !speaker.completed && speaker.id !== speakerId);
      if (activeAfter.length > 0) {
        await updateSpeaker({
          id: activeAfter[0].id,
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

  const handleRemoveFromSpeakerList = async () => {
    if (!user?.id) return;

    const userSpeaker = streamSpeakerListData.find(
      speaker => speaker.user?.id === user.id && !speaker.completed
    );

    if (!userSpeaker) return;

    setRemovingSpeaker(true);
    try {
      await removeSpeaker(userSpeaker.id);
    } catch (error) {
      console.error('Error removing from speaker list:', error);
    } finally {
      setRemovingSpeaker(false);
    }
  };

  // Apply filters
  const loweredSearchQuery = searchQuery.trim().toLowerCase();
  const normalizedSearchQuery = normalizeSearchToken(searchQuery);
  const filteredAgendaItems = orderedAgendaItems.filter(item => {
    const topNumber = topNumberByAgendaItemId.get(item.id);
    const topLabel =
      typeof topNumber === translateText('generated.inline.0008_number_53b0a1b2')
        ? `top-${topNumber}`
        : '';
    const topLabelCompact = typeof topNumber === 'number' ? `top${topNumber}` : '';
    const normalizedTopLabel = normalizeSearchToken(topLabel);

    const matchesTopSearch =
      loweredSearchQuery.length > 0 &&
      (topLabel.includes(loweredSearchQuery) ||
        topLabelCompact.includes(normalizedSearchQuery) ||
        normalizedTopLabel.includes(normalizedSearchQuery));

    const matchesSearch =
      loweredSearchQuery.length === 0 ||
      item.title?.toLowerCase().includes(loweredSearchQuery) ||
      item.description?.toLowerCase().includes(loweredSearchQuery) ||
      matchesTopSearch;

    const matchesType =
      typeFilter === 'all' ||
      item.type === typeFilter ||
      (typeFilter === 'vote' && item.type === 'amendment');
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });
  const confirmedAgendaItems = useMemo(
    () =>
      filteredAgendaItems.filter(
        item => item.forwarding_status !== 'previous_decision_outstanding'
      ),
    [filteredAgendaItems]
  );
  const scheduledButUnconfirmedAgendaItems = useMemo(
    () =>
      filteredAgendaItems.filter(
        item => item.forwarding_status === 'previous_decision_outstanding'
      ),
    [filteredAgendaItems]
  );

  const formatTime = (value?: number | Date | null) => {
    if (!value) {
      return '--:--';
    }

    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <EventAgendaView
      eventId={eventId}
      t={t}
      user={user}
      navigate={navigate}
      event={event}
      eventLoading={eventLoading}
      agendaItems={agendaItems}
      isLoading={isLoading}
      can={can}
      addSpeaker={addSpeaker}
      updateSpeaker={updateSpeaker}
      removeSpeaker={removeSpeaker}
      reorderAgendaItems={reorderAgendaItems}
      agendaNav={agendaNav}
      previousAgendaItemIdRef={previousAgendaItemIdRef}
      activeItemRef={activeItemRef}
      currentAgendaItemId={currentAgendaItemId}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      statsOpen={statsOpen}
      setStatsOpen={setStatsOpen}
      streamOpen={streamOpen}
      setStreamOpen={setStreamOpen}
      streamDetailsOpen={streamDetailsOpen}
      setStreamDetailsOpen={setStreamDetailsOpen}
      liveFocusOpen={liveFocusOpen}
      setLiveFocusOpen={setLiveFocusOpen}
      addingSpeaker={addingSpeaker}
      setAddingSpeaker={setAddingSpeaker}
      removingSpeaker={removingSpeaker}
      setRemovingSpeaker={setRemovingSpeaker}
      setMarkingSpeakerComplete={setMarkingSpeakerComplete}
      verifyVotingPassword={verifyVotingPassword}
      upsertElectionOfflineTally={upsertElectionOfflineTally}
      upsertVoteOfflineTally={upsertVoteOfflineTally}
      passwordError={passwordError}
      setPasswordError={setPasswordError}
      attendanceMode={attendanceMode}
      disableVoteButton={disableVoteButton}
      allowsOfflineElectionTallies={allowsOfflineElectionTallies}
      confirmedOfflineParticipantCount={confirmedOfflineParticipantCount}
      eligibleFinalVoterCount={eligibleFinalVoterCount}
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
      dismissedOverdueAgendaItemId={dismissedOverdueAgendaItemId}
      setDismissedOverdueAgendaItemId={setDismissedOverdueAgendaItemId}
      canManageAgenda={canManageAgenda}
      canManageVotes={canManageVotes}
      canManageVoteSequence={canManageAgendaVoteSequence}
      canJoinSpeakerList={canJoinSpeakerList}
      canManageOfflineTallies={canManageOfflineTallies}
      draggedAgendaItemId={draggedAgendaItemId}
      setDraggedAgendaItemId={setDraggedAgendaItemId}
      dragOverAgendaItemId={dragOverAgendaItemId}
      setDragOverAgendaItemId={setDragOverAgendaItemId}
      dragInsertPosition={dragInsertPosition}
      setDragInsertPosition={setDragInsertPosition}
      orderedAgendaItems={orderedAgendaItems}
      resetAgendaDragState={resetAgendaDragState}
      isAgendaItemDraggable={isAgendaItemDraggable}
      handleAgendaDragStart={handleAgendaDragStart}
      handleAgendaDrop={handleAgendaDrop}
      handleAgendaDragEnd={handleAgendaDragEnd}
      isEventStarted={isEventStarted}
      eventStartTimestamp={eventStartTimestamp}
      activeAgendaItem={activeAgendaItem}
      liveAgendaItem={liveAgendaItem}
      liveAgendaItemId={liveAgendaItemId}
      spotlightAgendaItem={spotlightAgendaItem}
      spotlightAgendaItemId={spotlightAgendaItemId}
      streamAgendaItem={streamAgendaItem}
      streamRuntimeStatus={streamRuntimeStatus}
      streamIsLive={streamIsLive}
      overdueStartCandidate={overdueStartCandidate}
      streamSpeakerListData={streamSpeakerListData}
      isUserInSpeakerList={isUserInSpeakerList}
      streamElection={streamElection}
      streamVote={streamVote}
      streamDelegateAssignmentMeta={streamDelegateAssignmentMeta}
      streamDelegateTargetEvent={streamDelegateTargetEvent}
      streamForwardingContext={streamForwardingContext}
      crVoting={crVoting}
      actionBarElection={actionBarElection}
      actionBarCandidates={actionBarCandidates}
      toolbarElection={toolbarElection}
      streamVotingPhase={streamVotingPhase}
      toolbarVotingPhase={toolbarVotingPhase}
      synthesizedClosingVoteItem={synthesizedClosingVoteItem}
      effectiveClosingVoteItem={effectiveClosingVoteItem}
      nextPendingCRItem={currentSequenceItem}
      activeCRToolbarItem={activeCRToolbarItem}
      nextStartableSequenceItem={nextStartableSequenceItem}
      isCRToolbarActive={isCRToolbarActive}
      selectedCRPhase={selectedCRPhase}
      isSelectedClosingVote={isSelectedClosingVote}
      hasUserVotedOnSelectedCR={hasUserVotedOnSelectedCR}
      selectedCRTitle={selectedCRTitle}
      selectedCRChoices={selectedCRChoices}
      selectedCRDialogPhase={selectedCRDialogPhase}
      streamForwardingPreview={streamForwardingPreview}
      voteDialogDocumentPreviewContent={streamVoteDialogDocumentPreviewContent}
      effectiveToolbarVotingPhase={effectiveToolbarVotingPhase}
      toolbarOfflineTallyPhaseSource={toolbarOfflineTallyPhaseSource}
      toolbarOfflineTallyPhase={toolbarOfflineTallyPhase}
      toolbarOfflineTallyEntity={toolbarOfflineTallyEntity}
      toolbarOfflineTallyMode={toolbarOfflineTallyMode}
      showOfflineTallyButton={showOfflineTallyButton}
      sequenceVotingLoading={sequenceVotingLoading}
      startVoteTooltip={startVoteTooltip}
      startFinalVoteTooltip={startFinalVoteTooltip}
      closeVoteTooltip={closeVoteTooltip}
      castIndicativeVoteTooltip={castIndicativeVoteTooltip}
      castFinalVoteTooltip={castFinalVoteTooltip}
      indicativeSelections={indicativeSelections}
      finalSelections={finalSelections}
      userElector={userElector}
      userHasElectionVoted={userHasElectionVoted}
      userSelectedCandidateIds={userSelectedCandidateIds}
      indicativeDecisions={indicativeDecisions}
      finalDecisions={finalDecisions}
      userVoter={userVoter}
      actionBarHook={actionBarHook}
      toolbarAgendaItem={toolbarAgendaItem}
      topNumberByAgendaItemId={topNumberByAgendaItemId}
      toolbarAgendaItemTopNumber={toolbarAgendaItemTopNumber}
      streamAgendaItemTopNumber={streamAgendaItemTopNumber}
      userHasVoteVoted={userHasVoteVoted}
      userSelectedChoiceIds={userSelectedChoiceIds}
      handleToolbarStartVote={handleToolbarStartVote}
      handleJumpToNextStartableSequenceItem={handleJumpToNextStartableSequenceItem}
      handleToolbarStartFinalVote={handleToolbarStartFinalVote}
      handleToolbarCloseVote={handleToolbarCloseVote}
      handleCastCRVoteFromDialog={handleCastCRVoteFromDialog}
      handleOfflineTallyDialogOpenChange={handleOfflineTallyDialogOpenChange}
      handleOpenOfflineTallyDialog={handleOpenOfflineTallyDialog}
      handleSubmitOfflineTally={handleSubmitOfflineTally}
      handleAddToSpeakerList={handleAddToSpeakerList}
      handleMarkSpeakerCompleted={handleMarkSpeakerCompleted}
      handleRemoveFromSpeakerList={handleRemoveFromSpeakerList}
      loweredSearchQuery={loweredSearchQuery}
      normalizedSearchQuery={normalizedSearchQuery}
      filteredAgendaItems={filteredAgendaItems}
      confirmedAgendaItems={confirmedAgendaItems}
      scheduledButUnconfirmedAgendaItems={scheduledButUnconfirmedAgendaItems}
      formatTime={formatTime}
    />
  );
}
