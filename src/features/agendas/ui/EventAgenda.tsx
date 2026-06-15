'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEventData } from '@/features/events/hooks/useEventData';
import { useAgendaItems } from '../hooks/useAgendaItems';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
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
import { useAgendaItemCRVoting } from '../hooks/useAgendaItemCRVoting';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import {
  getEffectiveCRVotingPhase,
  getEffectiveVotingPhase,
  normalizeSearchToken,
  resolveAttendanceMode,
} from '../logic/agendaUiHelpers';
import { canJoinEventSpeakerList } from '../logic/speakerListPermissions';
import { buildFinalVoteFromAgendaVote } from '../logic/buildFinalVoteFromAgendaVote';
import {
  getOfflineTallySuccessMessage,
  resolveOfflineTallyMode,
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
} from '../logic/offlineTallyToolbar';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import { useEventById } from '@/zero/events';

interface EventAgendaProps {
  eventId: string;
}

type EventAgendaItemRow = ReturnType<typeof useAgendaItems>['agendaItems'][number];
import { EventAgendaView } from './EventAgendaView';
export function EventAgenda({ eventId }: EventAgendaProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { event, isLoading: eventLoading } = useEventData(eventId);
  const { agendaItems, isLoading } = useAgendaItems(eventId);
  const { can } = usePermissions({ eventId });
  const { addSpeaker, updateSpeaker, removeSpeaker, reorderAgendaItems } = useAgendaActions();
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
  const { upsertOfflineTally: upsertVoteOfflineTally } = useVoteActions();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const attendanceMode = resolveAttendanceMode(event);
  const disableVoteButton = attendanceMode === 'offline';
  const allowsOfflineElectionTallies = attendanceMode === 'hybrid' || attendanceMode === 'offline';
  const confirmedOfflineParticipantCount =
    event?.offline_participants?.filter(
      participant =>
        participant.attendance_status === 'confirmed' &&
        participant.participation_channel === 'offline'
    ).length ?? 0;
  const [isPasswordVerifying, setIsPasswordVerifying] = useState(false);
  const [offlineTallyDialogOpen, setOfflineTallyDialogOpen] = useState(false);
  const [offlineTallyPasswordError, setOfflineTallyPasswordError] = useState<string | null>(null);
  const [offlineTallySubmitError, setOfflineTallySubmitError] = useState<string | null>(null);
  const [isOfflineTallySubmitting, setIsOfflineTallySubmitting] = useState(false);
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
  const streamVote = streamAgendaItem?.votes?.[0] ?? null;
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
  const synthesizedFinalVoteItem = useMemo(() => {
    if (!streamAgendaItem?.amendment_id || !streamVote) return null;
    if (crVoting.finalVoteItem) return null;
    return buildFinalVoteFromAgendaVote(
      streamVote,
      crVoting.crTimeline.length
    ) as unknown as ChangeRequestTimelineRow;
  }, [
    crVoting.crTimeline.length,
    crVoting.finalVoteItem,
    streamAgendaItem?.amendment_id,
    streamVote,
  ]);
  const effectiveFinalVoteItem = useMemo(
    () => crVoting.finalVoteItem ?? synthesizedFinalVoteItem,
    [crVoting.finalVoteItem, synthesizedFinalVoteItem]
  );
  const nonFinalCRItems = useMemo(
    () => crVoting.crTimeline.filter(item => !item.is_final_vote),
    [crVoting.crTimeline]
  );
  const nextPendingCRItem = useMemo(
    () => nonFinalCRItems.find(item => item.status !== 'completed') ?? null,
    [nonFinalCRItems]
  );
  const fallbackSelectedCRItemId = useMemo(() => {
    if (crVoting.currentItem?.id) return crVoting.currentItem.id;
    if (nextPendingCRItem?.id) return nextPendingCRItem.id;
    return effectiveFinalVoteItem?.id ?? null;
  }, [crVoting.currentItem?.id, effectiveFinalVoteItem?.id, nextPendingCRItem?.id]);

  useEffect(() => {
    if (!streamAgendaItem?.amendment_id) {
      if (selectedCRToolbarItemId) {
        setSelectedCRToolbarItemId(null);
      }
      return;
    }

    if (crVoting.currentItem?.id && crVoting.currentItem.id !== selectedCRToolbarItemId) {
      setSelectedCRToolbarItemId(crVoting.currentItem.id);
      return;
    }

    const selectedItemStillExists = selectedCRToolbarItemId
      ? crVoting.crTimeline.some(item => item.id === selectedCRToolbarItemId) ||
        effectiveFinalVoteItem?.id === selectedCRToolbarItemId
      : false;

    if (!selectedItemStillExists && fallbackSelectedCRItemId) {
      setSelectedCRToolbarItemId(fallbackSelectedCRItemId);
      return;
    }

    if (!selectedItemStillExists && selectedCRToolbarItemId) {
      setSelectedCRToolbarItemId(null);
    }
  }, [
    crVoting.crTimeline,
    crVoting.currentItem?.id,
    effectiveFinalVoteItem?.id,
    fallbackSelectedCRItemId,
    selectedCRToolbarItemId,
    streamAgendaItem?.amendment_id,
  ]);

  const activeCRToolbarItem = useMemo(
    () =>
      crVoting.crTimeline.find(item => item.id === selectedCRToolbarItemId) ??
      (effectiveFinalVoteItem?.id === selectedCRToolbarItemId ? effectiveFinalVoteItem : null) ??
      crVoting.crTimeline.find(item => item.id === fallbackSelectedCRItemId) ??
      (effectiveFinalVoteItem?.id === fallbackSelectedCRItemId ? effectiveFinalVoteItem : null) ??
      null,
    [crVoting.crTimeline, effectiveFinalVoteItem, fallbackSelectedCRItemId, selectedCRToolbarItemId]
  );
  const isCRToolbarActive =
    !!streamAgendaItem?.amendment_id && crVoting.crTimeline.length > 0 && !!activeCRToolbarItem;
  const selectedCRPhase = getEffectiveCRVotingPhase(activeCRToolbarItem);
  const isSelectedCRFinalVote = !!activeCRToolbarItem?.is_final_vote;
  const hasUserVotedOnSelectedCR = useMemo(
    () => (activeCRToolbarItem ? crVoting.hasUserVoted(activeCRToolbarItem) : false),
    [activeCRToolbarItem, crVoting]
  );
  const selectedCRTitle = useMemo(() => {
    if (!activeCRToolbarItem) return streamAgendaItem?.title ?? undefined;
    if (activeCRToolbarItem.is_final_vote) {
      return t('features.agendas.crTimeline.acceptAmendment');
    }

    return (
      activeCRToolbarItem.change_request?.title || t('features.agendas.crTimeline.changeRequest')
    );
  }, [activeCRToolbarItem, streamAgendaItem?.title, t]);
  const selectedCRChoices = useMemo(
    () =>
      (activeCRToolbarItem?.vote?.choices ?? []).map(choice => ({
        id: choice.id,
        label: choice.label || 'Choice',
      })),
    [activeCRToolbarItem?.vote?.choices]
  );
  const selectedCRDialogPhase = useMemo(() => {
    if (selectedCRPhase === 'final_vote') return 'final_vote' as const;
    if (selectedCRPhase === 'closed') return 'closed' as const;
    return 'indication' as const;
  }, [selectedCRPhase]);
  const streamForwardingPreview = useMemo(() => {
    const nextStepRun = streamForwardingContext.nextStepRun;
    if (!nextStepRun?.event) {
      return null;
    }

    const shouldShowPreview = isCRToolbarActive
      ? isSelectedCRFinalVote
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
    isSelectedCRFinalVote,
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

  const toolbarOfflineTallyEntity = useMemo(() => {
    if (!toolbarOfflineTallyPhase) {
      return null;
    }

    if (toolbarElection) {
      return {
        kind: 'election' as const,
        itemId: toolbarElection.id,
        title: toolbarElection.title ?? streamAgendaItem?.title ?? 'this election',
        choices: (toolbarElection.candidates ?? [])
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
        tallies: (toolbarElection.offline_tallies ?? [])
          .filter(tally => tally.phase === toolbarOfflineTallyPhase && tally.candidate_id)
          .map(tally => ({
            id: tally.candidate_id ?? '',
            count: tally.count ?? 0,
          })),
        maxTotalVotes:
          confirmedOfflineParticipantCount * Math.max(1, toolbarElection.max_votes ?? 1),
      };
    }

    if (streamVote) {
      return {
        kind: 'vote' as const,
        itemId: streamVote.id,
        title: streamVote.title ?? streamAgendaItem?.title ?? 'this vote',
        choices: (streamVote.choices ?? []).map((choice, index) => ({
          id: choice.id,
          label: choice.label || `Choice ${index + 1}`,
        })),
        tallies: (streamVote.offline_tallies ?? [])
          .filter(tally => tally.phase === toolbarOfflineTallyPhase && tally.choice_id)
          .map(tally => ({
            id: tally.choice_id ?? '',
            count: tally.count ?? 0,
          })),
        maxTotalVotes: confirmedOfflineParticipantCount,
      };
    }

    return null;
  }, [
    confirmedOfflineParticipantCount,
    streamAgendaItem?.title,
    streamVote,
    toolbarElection,
    toolbarOfflineTallyPhase,
  ]);
  const toolbarOfflineTallyMode = resolveOfflineTallyMode(toolbarOfflineTallyEntity?.tallies ?? []);
  const showOfflineTallyButton = shouldShowOfflineTallyToolbarButton({
    attendanceMode,
    canManageVotes,
    phase: toolbarOfflineTallyPhase,
  });
  useEffect(() => {
    console.debug('[offline-tally-toolbar][agenda]', {
      eventId,
      attendanceMode,
      agendaItemVotingPhase: streamAgendaItem?.voting_phase ?? null,
      electionStatus: toolbarElection?.status ?? null,
      voteStatus: streamVote?.status ?? null,
      canManageVotes,
      canManageAgenda,
      canManageOfflineTallies,
      effectiveToolbarVotingPhase,
      toolbarOfflineTallyPhaseSource,
      toolbarOfflineTallyPhase,
      isCRToolbarActive,
      showOfflineTallyButton,
      streamAgendaItemId: streamAgendaItem?.id ?? null,
    });
  }, [
    attendanceMode,
    canManageAgenda,
    canManageOfflineTallies,
    canManageVotes,
    effectiveToolbarVotingPhase,
    eventId,
    isCRToolbarActive,
    showOfflineTallyButton,
    streamAgendaItem?.voting_phase,
    streamAgendaItem?.id,
    streamVote?.status,
    toolbarOfflineTallyPhaseSource,
    toolbarElection?.status,
    toolbarOfflineTallyPhase,
  ]);
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
    if (phase === 'final' || phase === 'final_vote') {
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
      phase === 'final' || phase === 'final_vote'
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
    if (phase === 'final' || phase === 'final_vote') {
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
      phase === 'final' || phase === 'final_vote'
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
  const handleToolbarStartVote = useCallback(() => {
    if (!activeCRToolbarItem) return;
    void crVoting.startIndicativePhase(activeCRToolbarItem.id);
  }, [activeCRToolbarItem, crVoting]);
  const handleToolbarStartFinalVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!activeCRToolbarItem) return;
      void crVoting.startFinalPhase(activeCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleStartFinalVote();
  }, [actionBarHook, activeCRToolbarItem, crVoting, isCRToolbarActive]);
  const handleToolbarCloseVote = useCallback(() => {
    if (isCRToolbarActive) {
      if (!activeCRToolbarItem) return;
      void crVoting.closeVoting(activeCRToolbarItem.id);
      return;
    }

    void actionBarHook.handleCloseFinalVote();
  }, [actionBarHook, activeCRToolbarItem, crVoting, isCRToolbarActive]);
  useEffect(() => {
    console.debug('[event-agenda][final-vote-props]', {
      eventId,
      isCRToolbarActive,
      selectedCRPhase,
      toolbarVotingPhase,
      effectiveToolbarVotingPhase,
      streamAgendaItemId: streamAgendaItem?.id ?? null,
      streamAgendaItemStatus: streamAgendaItem?.status ?? null,
      streamAgendaItemType: streamAgendaItem?.type ?? null,
      currentAgendaRuntimeStatus: toolbarAgendaItem
        ? getAgendaRuntimeStatus({
            id: toolbarAgendaItem.id,
            status: toolbarAgendaItem.status,
            start_time: toolbarAgendaItem.start_time,
            end_time: toolbarAgendaItem.end_time,
            activated_at: toolbarAgendaItem.activated_at,
            completed_at: toolbarAgendaItem.completed_at,
            currentAgendaItemId: liveAgendaItemId,
          })
        : null,
      canManageAgenda,
      hasHandleToolbarStartFinalVote: Boolean(
        isCRToolbarActive
          ? selectedCRPhase === 'indication'
            ? handleToolbarStartFinalVote
            : undefined
          : effectiveToolbarVotingPhase === 'indication'
            ? handleToolbarStartFinalVote
            : undefined
      ),
    });
  }, [
    canManageAgenda,
    effectiveToolbarVotingPhase,
    eventId,
    handleToolbarStartFinalVote,
    isCRToolbarActive,
    liveAgendaItemId,
    selectedCRPhase,
    streamAgendaItem?.id,
    streamAgendaItem?.status,
    streamAgendaItem?.type,
    toolbarAgendaItem,
    toolbarVotingPhase,
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
      synthesizedFinalVoteItem={synthesizedFinalVoteItem}
      effectiveFinalVoteItem={effectiveFinalVoteItem}
      nextPendingCRItem={nextPendingCRItem}
      activeCRToolbarItem={activeCRToolbarItem}
      isCRToolbarActive={isCRToolbarActive}
      selectedCRPhase={selectedCRPhase}
      isSelectedCRFinalVote={isSelectedCRFinalVote}
      hasUserVotedOnSelectedCR={hasUserVotedOnSelectedCR}
      selectedCRTitle={selectedCRTitle}
      selectedCRChoices={selectedCRChoices}
      selectedCRDialogPhase={selectedCRDialogPhase}
      streamForwardingPreview={streamForwardingPreview}
      effectiveToolbarVotingPhase={effectiveToolbarVotingPhase}
      toolbarOfflineTallyPhaseSource={toolbarOfflineTallyPhaseSource}
      toolbarOfflineTallyPhase={toolbarOfflineTallyPhase}
      toolbarOfflineTallyEntity={toolbarOfflineTallyEntity}
      toolbarOfflineTallyMode={toolbarOfflineTallyMode}
      showOfflineTallyButton={showOfflineTallyButton}
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
