'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlInput,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEventData } from '@/features/events/hooks/useEventData';
import { useAgendaItems } from '../hooks/useAgendaItems';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import {
  Calendar,
  Vote,
  Gavel,
  Plus,
  FileText,
  Search as SearchIcon,
  Filter,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Radio,
  Clock,
  Info,
  GripVertical,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { TimelineItem } from '@/features/agendas/ui/TimelineItem.tsx';
import { AgendaItemContextCard } from './AgendaItemContextCard';
import { AgendaRelatedRoleCard } from './AgendaRelatedEntityCard';
import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { AgendaSpeakerListSection } from './AgendaSpeakerListSection';
import { AgendaElectionSection } from './AgendaElectionSection';
import { AgendaVoteSection } from './AgendaVoteSection';
import { OfflineTallyDialog } from './OfflineTallyDialog';
import { AgendaCard, type AgendaItemStatus } from '@/features/agendas/ui/AgendaCard.tsx';
import {
  AgendaCountdownPill,
  AgendaEndedPill,
  AgendaStatusBadge,
  AgendaTypeBadge,
} from './AgendaBadges';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import { AgendaActionBar } from './AgendaActionBar';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import { useAgendaItemForwardingContext } from '@/zero/amendments';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAgendaActionBar } from '../hooks/useAgendaActionBar';
import { useAgendaNavigation } from '../hooks/useAgendaNavigation';
import { useAgendaItemCRVoting } from '../hooks/useAgendaItemCRVoting';
import { getAgendaDisplayTimes } from '../logic/getAgendaDisplayTimes';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import {
  getAgendaDisplayType,
  getEffectiveCRVotingPhase,
  getEffectiveVotingPhase,
  getYouTubeVideoId,
  normalizeSearchToken,
  resolveAttendanceMode,
} from '../logic/agendaUiHelpers';
import { buildFinalVoteFromAgendaVote } from '../logic/buildFinalVoteFromAgendaVote';
import {
  getOfflineTallyDialogTitle,
  getOfflineTallySuccessMessage,
  getOfflineTallyTooltip,
  resolveOfflineTallyMode,
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
} from '../logic/offlineTallyToolbar';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { useEventById } from '@/zero/events';

interface EventAgendaProps {
  eventId: string;
}

type EventAgendaItemRow = ReturnType<typeof useAgendaItems>['agendaItems'][number];

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
    if (agendaNav.currentAgendaItem?.id) {
      return (
        agendaItems.find(item => item.id === agendaNav.currentAgendaItem?.id) ?? activeAgendaItem
      );
    }

    return activeAgendaItem;
  }, [agendaItems, agendaNav.currentAgendaItem?.id, activeAgendaItem]);
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
  const nextPendingCRItem = useMemo(
    () =>
      crVoting.crTimeline.find(item => !item.is_final_vote && item.status !== 'completed') ?? null,
    [crVoting.crTimeline]
  );
  const activeCRToolbarItem = useMemo(
    () =>
      crVoting.currentItem ??
      nextPendingCRItem ??
      (crVoting.allCRsProcessed ? effectiveFinalVoteItem : null),
    [crVoting.allCRsProcessed, crVoting.currentItem, effectiveFinalVoteItem, nextPendingCRItem]
  );
  const isCRToolbarActive = !!streamAgendaItem?.amendment_id && !!activeCRToolbarItem;
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
    vote: streamVote,
    electorId: userElector?.id,
    voterId: userVoter?.id,
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
    if (!user?.id || !streamAgendaItem?.id) return;

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

  const renderAgendaTimer = (agendaItem: {
    status?: string | null;
    calculated_start_time?: number;
    calculated_end_time?: number;
    start_time?: number | null;
    end_time?: number | null;
    activated_at?: number | null;
    completed_at?: number | null;
  }) => {
    const { displayEndTime } = getAgendaDisplayTimes(agendaItem);
    const isCompleted =
      agendaItem.status === 'completed' || typeof agendaItem.completed_at === 'number';
    const isOngoing = agendaItem.status === 'in-progress' || agendaItem.status === 'active';

    if (isCompleted && displayEndTime) {
      return <AgendaEndedPill endedAt={new Date(displayEndTime)} />;
    }

    if (
      isOngoing &&
      agendaItem.calculated_end_time &&
      agendaItem.calculated_end_time > Date.now()
    ) {
      return (
        <AgendaCountdownPill
          label={t('features.events.agenda.endsIn')}
          endsAt={new Date(agendaItem.calculated_end_time)}
          tone="active"
        />
      );
    }

    if (agendaItem.calculated_start_time && agendaItem.calculated_start_time > Date.now()) {
      return (
        <AgendaCountdownPill
          label={t('features.events.stream.startsIn')}
          endsAt={new Date(agendaItem.calculated_start_time)}
          tone="start"
        />
      );
    }

    return null;
  };

  const renderAgendaItemsList = (items: EventAgendaItemRow[]) => (
    <div className="space-y-6">
      {items.map((item, index) => {
        const runtimeStatus = getAgendaRuntimeStatus({
          id: item.id,
          status: item.status,
          start_time: item.start_time,
          end_time: item.end_time,
          activated_at: item.activated_at,
          completed_at: item.completed_at,
          currentAgendaItemId: liveAgendaItemId,
        });
        const isLiveItem = liveAgendaItemId === item.id;
        const isActive = runtimeStatus === 'in-progress';
        const isSpotlightItem = spotlightAgendaItemId === item.id;
        const isCompleted = runtimeStatus === 'completed';
        const topNumber = topNumberByAgendaItemId.get(item.id) ?? index + 1;
        const displayTimes = getAgendaDisplayTimes({
          activated_at: item.activated_at,
          completed_at: item.completed_at,
          start_time: item.start_time,
          end_time: item.end_time,
          calculated_start_time: item.calculated_start_time,
          calculated_end_time: item.calculated_end_time,
        });

        return (
          <div
            key={item.id}
            ref={isSpotlightItem ? activeItemRef : undefined}
            className={cn(
              'relative rounded-lg transition-colors',
              draggedAgendaItemId === item.id ? 'opacity-50' : '',
              dragOverAgendaItemId === item.id && draggedAgendaItemId !== item.id
                ? 'bg-accent/40'
                : ''
            )}
            onDragOver={event => {
              if (!isAgendaItemDraggable(runtimeStatus)) return;
              event.preventDefault();
              const target = event.currentTarget as HTMLDivElement;
              const rect = target.getBoundingClientRect();
              const isAbove = event.clientY < rect.top + rect.height / 2;
              setDragOverAgendaItemId(item.id);
              setDragInsertPosition(isAbove ? 'above' : 'below');
            }}
            onDragEnter={event => {
              if (!isAgendaItemDraggable(runtimeStatus)) return;
              const target = event.currentTarget as HTMLDivElement;
              const rect = target.getBoundingClientRect();
              const isAbove = event.clientY < rect.top + rect.height / 2;
              setDragOverAgendaItemId(item.id);
              setDragInsertPosition(isAbove ? 'above' : 'below');
            }}
            onDragLeave={() => {
              if (dragOverAgendaItemId === item.id) {
                setDragOverAgendaItemId(null);
                setDragInsertPosition(null);
              }
            }}
            onDrop={event => {
              if (!isAgendaItemDraggable(runtimeStatus)) return;
              event.preventDefault();
              handleAgendaDrop(item.id, dragInsertPosition ?? 'below');
            }}
          >
            {dragOverAgendaItemId === item.id && dragInsertPosition === 'above' && (
              <div className="bg-primary absolute -top-3 right-6 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
            )}
            {isSpotlightItem && (
              <div className="absolute top-1/2 -left-4 flex -translate-y-1/2 items-center gap-2">
                <div className={isLiveItem ? 'animate-pulse' : undefined}>
                  <Play className="fill-primary text-primary h-5 w-5" />
                </div>
              </div>
            )}
            <TimelineItem
              order={item.order_index ?? 0}
              startTime={formatTime(displayTimes.displayStartTime)}
              endTime={formatTime(displayTimes.displayEndTime)}
              duration={item.duration || 30}
            >
              <div
                className={cn(
                  'relative',
                  isSpotlightItem && isLiveItem ? 'animate-pulse-subtle' : '',
                  isCompleted ? 'opacity-70' : ''
                )}
              >
                {isCompleted && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                )}
                <AgendaCard
                  id={item.id}
                  title={`TOP-${topNumber}-${item.title ?? ''}`}
                  description={item.description ?? undefined}
                  type={getAgendaDisplayType(item.type)}
                  status={runtimeStatus as AgendaItemStatus}
                  creatorName={
                    [item.creator?.first_name, item.creator?.last_name].filter(Boolean).join(' ') ||
                    (item.creator?.email ?? undefined)
                  }
                  detailsLink={`/event/${eventId}/agenda/${item.id}`}
                  isActive={isActive}
                  footerRight={renderAgendaTimer(item)}
                  className={cn(
                    isCompleted ? 'border-emerald-500/70' : undefined,
                    isSpotlightItem
                      ? isLiveItem
                        ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]'
                        : 'border-primary/60'
                      : undefined
                  )}
                  dragHandle={renderAgendaDragHandle(item.id, runtimeStatus)}
                  amendment={item.amendment ?? undefined}
                  election={
                    item.election?.[0]
                      ? {
                          election_mode: item.election[0].election_mode
                            ? normalizeElectionMode(item.election[0].election_mode)
                            : null,
                          seat_count: item.election[0].seat_count ?? null,
                          role: item.election[0].role ?? null,
                        }
                      : undefined
                  }
                />
              </div>
            </TimelineItem>
            {dragOverAgendaItemId === item.id && dragInsertPosition === 'below' && (
              <div className="bg-primary absolute right-6 -bottom-3 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderAgendaDragHandle = (itemId: string, runtimeStatus: string) => {
    if (!isAgendaItemDraggable(runtimeStatus)) {
      return null;
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 cursor-grab active:cursor-grabbing"
        draggable
        aria-label={t('features.events.agenda.dragToReorder')}
        title={t('features.events.agenda.dragToReorder')}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragStart={event => handleAgendaDragStart(event, itemId)}
        onDragEnd={handleAgendaDragEnd}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
    );
  };

  if (isLoading || eventLoading) {
    return (
      <div>
        <div className="space-y-6">
          <div className="bg-muted h-8 animate-pulse rounded"></div>
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted h-32 animate-pulse rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div>
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="mb-2 text-2xl font-bold">{t('features.events.wiki.notFound')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('features.events.wiki.notFoundDescription')}
            </p>
            <Button asChild>
              <Link to="/calendar">{t('features.events.backToCalendar')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fixed Action Bar (positioned outside page layout) */}
      <AgendaActionBar
        eventId={eventId}
        canManageAgenda={canManageAgenda}
        canVote={actionBarHook.hasVotingRight}
        canBeCandidate={actionBarHook.hasCandidateRight}
        isEventStarted={isEventStarted}
        isUserInSpeakerList={actionBarHook.isUserInSpeakerList}
        isUserCandidate={actionBarHook.isUserCandidate}
        currentAgendaItem={
          toolbarAgendaItem
            ? {
                id: toolbarAgendaItem.id,
                type: toolbarAgendaItem.type,
                status: getAgendaRuntimeStatus({
                  id: toolbarAgendaItem.id,
                  status: toolbarAgendaItem.status,
                  start_time: toolbarAgendaItem.start_time,
                  end_time: toolbarAgendaItem.end_time,
                  activated_at: toolbarAgendaItem.activated_at,
                  completed_at: toolbarAgendaItem.completed_at,
                  currentAgendaItemId: liveAgendaItemId,
                }),
                voting_phase: effectiveToolbarVotingPhase,
                election: toolbarElection ? { id: toolbarElection.id } : null,
                vote: isCRToolbarActive
                  ? activeCRToolbarItem?.vote
                    ? { id: activeCRToolbarItem.vote.id }
                    : null
                  : streamVote
                    ? { id: streamVote.id }
                    : null,
              }
            : null
        }
        currentItemLabel={
          typeof toolbarAgendaItemTopNumber === 'number'
            ? `TOP-${toolbarAgendaItemTopNumber}`
            : undefined
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
        onStartItem={agendaNav.startFirstPendingItem}
        onPreviousItem={agendaNav.moveToPreviousItem}
        onNextItem={agendaNav.moveToNextItem}
        onCompleteItem={agendaNav.completeCurrentItem}
        navigationLoading={agendaNav.isLoading}
        speakerLoading={actionBarHook.speakerLoading}
        candidateLoading={actionBarHook.candidateLoading}
        onJoinSpeakerList={actionBarHook.handleJoinSpeakerList}
        onLeaveSpeakerList={actionBarHook.handleLeaveSpeakerList}
        onBecomeCandidate={actionBarHook.handleBecomeCandidate}
        onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
        onStartVote={
          isCRToolbarActive
            ? selectedCRPhase === 'pending'
              ? handleToolbarStartVote
              : undefined
            : effectiveToolbarVotingPhase === 'pending'
              ? actionBarHook.handleStartVote
              : undefined
        }
        onStartFinalVote={
          isCRToolbarActive
            ? selectedCRPhase === 'indication'
              ? handleToolbarStartFinalVote
              : undefined
            : effectiveToolbarVotingPhase === 'indication'
              ? handleToolbarStartFinalVote
              : undefined
        }
        onCloseFinalVote={
          isCRToolbarActive
            ? selectedCRPhase === 'final_vote'
              ? handleToolbarCloseVote
              : undefined
            : effectiveToolbarVotingPhase === 'final_vote'
              ? handleToolbarCloseVote
              : undefined
        }
        onVoteClick={
          isCRToolbarActive
            ? selectedCRPhase !== 'pending' &&
              selectedCRPhase !== 'closed' &&
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
        offlineTallyMode={toolbarOfflineTallyMode}
        offlineTallyTooltip={getOfflineTallyTooltip({
          phase: toolbarOfflineTallyPhase,
          mode: toolbarOfflineTallyMode,
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
        title={getOfflineTallyDialogTitle(toolbarOfflineTallyPhase ?? 'indicative')}
        description={`Enter aggregated offline or hybrid selections for ${toolbarOfflineTallyEntity?.title ?? 'this item'} and confirm with your voting PIN.`}
        phase={toolbarOfflineTallyPhase ?? 'indicative'}
        choices={toolbarOfflineTallyEntity?.choices ?? []}
        tallies={toolbarOfflineTallyEntity?.tallies ?? []}
        maxTotalVotes={toolbarOfflineTallyEntity?.maxTotalVotes ?? null}
        isSubmitting={isOfflineTallySubmitting}
        passwordError={offlineTallyPasswordError}
        submitError={offlineTallySubmitError}
        onSubmit={handleSubmitOfflineTally}
      />

      {/* Stream Section */}
      <Collapsible open={streamOpen} onOpenChange={setStreamOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-0 hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-lg">
                    {t('features.events.stream.liveStream')}
                  </CardTitle>
                  {streamIsLive && (
                    <BadgeControl variant="default" className="animate-pulse">
                      {t('features.events.stream.live', 'LIVE')}
                    </BadgeControl>
                  )}
                </div>
                {streamOpen ? (
                  <ChevronUp className="text-muted-foreground h-5 w-5" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-5 w-5" />
                )}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {!streamAgendaItem ? (
                <div className="text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed p-4">
                  <Info className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">{t('features.events.stream.noActiveItem')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Collapsible open={streamDetailsOpen} onOpenChange={setStreamDetailsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="bg-primary/5 hover:bg-primary/10 h-auto w-full justify-start rounded-lg p-3 text-left whitespace-normal transition-colors"
                      >
                        <div className="bg-primary text-primary-foreground relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                          <Play className="h-4 w-4 fill-current" />
                          {isEventStarted ? (
                            <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-green-500" />
                          ) : (
                            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {typeof streamAgendaItemTopNumber === 'number'
                                ? `TOP-${streamAgendaItemTopNumber}${streamAgendaItem.title ? `-${streamAgendaItem.title}` : ''}`
                                : (streamAgendaItem.title ?? '')}
                            </p>
                            <AgendaStatusBadge
                              status={streamIsLive ? 'active' : (streamRuntimeStatus ?? 'planned')}
                            />
                            {!streamIsLive && eventStartTimestamp != null ? (
                              <AgendaCountdownPill
                                label={t('features.events.stream.startsIn')}
                                endsAt={new Date(eventStartTimestamp)}
                                tone="start"
                              />
                            ) : null}
                          </div>
                          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                            <AgendaTypeBadge type={getAgendaDisplayType(streamAgendaItem.type)} />
                            {streamAgendaItem.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {streamAgendaItem.duration}
                                {translateText('generated.inline.0009_min_b6c935d4')}
                              </span>
                            )}
                            {!isEventStarted && eventStartTimestamp != null && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatTime(eventStartTimestamp)}
                              </span>
                            )}
                          </div>
                        </div>
                        {streamDetailsOpen ? (
                          <ChevronUp className="text-muted-foreground h-4 w-4" />
                        ) : (
                          <ChevronDown className="text-muted-foreground h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-6 pt-3">
                      {/* Stream Video */}
                      {isEventStarted &&
                        event.stream_url &&
                        (() => {
                          const videoId = getYouTubeVideoId(event.stream_url);
                          return videoId ? (
                            <div className="relative w-full overflow-hidden rounded-lg bg-black">
                              <div className="aspect-video">
                                <iframe
                                  className="h-full w-full"
                                  src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=0&rel=0&modestbranding=1`}
                                  title={t('features.events.stream.liveStream')}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          ) : null;
                        })()}

                      <AgendaItemContextCard
                        agendaItem={{
                          id: streamAgendaItem.id,
                          title: streamAgendaItem.title || '',
                          description: streamAgendaItem.description ?? undefined,
                          type: streamAgendaItem.type || 'discussion',
                          status: streamRuntimeStatus ?? 'planned',
                          duration: streamAgendaItem.duration ?? undefined,
                          scheduledTime:
                            streamAgendaItem.scheduled_time ??
                            (typeof streamAgendaItem.calculated_start_time === 'number'
                              ? new Date(streamAgendaItem.calculated_start_time).toISOString()
                              : undefined),
                          startTime: streamAgendaItem.start_time
                            ? new Date(streamAgendaItem.start_time)
                            : undefined,
                          endTime: streamAgendaItem.end_time
                            ? new Date(streamAgendaItem.end_time)
                            : undefined,
                          activatedAt: streamAgendaItem.activated_at
                            ? new Date(streamAgendaItem.activated_at)
                            : undefined,
                          completedAt: streamAgendaItem.completed_at
                            ? new Date(streamAgendaItem.completed_at)
                            : undefined,
                        }}
                        showHeaderStatusBadge={false}
                        agendaDetailLink={{
                          eventId,
                          agendaItemId: streamAgendaItem.id,
                        }}
                      />

                      {streamDelegateTargetEvent ? (
                        <EventSearchCard event={streamDelegateTargetEvent} />
                      ) : null}

                      {(streamAgendaItem.type === 'speech' || streamSpeakerListData.length > 0) && (
                        <AgendaSpeakerListSection
                          speakers={streamSpeakerListData}
                          isUserInSpeakerList={isUserInSpeakerList}
                          canManageSpeakers={canManageAgenda}
                          isAddingSpeaker={addingSpeaker}
                          isRemovingSpeaker={removingSpeaker}
                          userId={user?.id}
                          agendaStartTime={streamAgendaItem.start_time ?? undefined}
                          onAddToSpeakerList={handleAddToSpeakerList}
                          onRemoveFromSpeakerList={handleRemoveFromSpeakerList}
                          onMarkCompleted={canManageAgenda ? handleMarkSpeakerCompleted : undefined}
                        />
                      )}

                      {streamElection && (
                        <div className="space-y-4">
                          <AgendaElectionSection
                            roleName={streamElection.title ?? t('features.events.agenda.role')}
                            candidates={streamElection.candidates as CandidatesByElectionRow[]}
                            indicativeSelections={indicativeSelections}
                            finalSelections={finalSelections}
                            offlineTallies={streamElection.offline_tallies ?? []}
                            attendanceMode={attendanceMode}
                            userHasVoted={userHasElectionVoted}
                            userSelectedCandidateIds={userSelectedCandidateIds}
                            electionStatus={streamElection.status}
                            canVote={false}
                            canBeCandidate={false}
                            isUserCandidate={false}
                            onBecomeCandidate={() => undefined}
                          />
                          {streamElection.role && (
                            <AgendaRelatedRoleCard role={streamElection.role} />
                          )}
                        </div>
                      )}

                      {streamVote && (
                        <div className="space-y-4">
                          <AgendaVoteSection
                            voteId={streamVote.id}
                            voteTitle={streamVote.title || streamAgendaItem.title || 'Vote'}
                            choices={streamVote.choices as ChoicesByVoteRow[]}
                            indicativeDecisions={indicativeDecisions}
                            finalDecisions={finalDecisions}
                            offlineTallies={streamVote.offline_tallies ?? []}
                            attendanceMode={attendanceMode}
                            userHasVoted={userHasVoteVoted}
                            userSelectedChoiceIds={userSelectedChoiceIds}
                            voteStatus={streamVote.status}
                            majorityType={streamVote.majority_type}
                            totalEligibleVoters={
                              (streamVote.voters?.length ?? 0) + confirmedOfflineParticipantCount
                            }
                            canManageOfflineResults={canManageAgenda}
                            offlineEligibleCount={confirmedOfflineParticipantCount}
                          />
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Agenda Statistics */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-0 hover:bg-transparent"
              >
                <CardTitle className="text-lg">{t('features.events.agenda.statistics')}</CardTitle>
                {statsOpen ? (
                  <ChevronUp className="text-muted-foreground h-5 w-5" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-5 w-5" />
                )}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 md:h-10 md:w-10 dark:bg-purple-900">
                    <Vote className="h-4 w-4 text-purple-600 md:h-5 md:w-5 dark:text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold md:text-2xl">
                      {agendaItems.filter(item => item.election).length}
                    </p>
                    <p className="text-muted-foreground truncate text-xs md:text-sm">
                      {agendaItems.filter(item => item.election).length === 1
                        ? t('features.events.agenda.election')
                        : t('features.events.agenda.elections')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 md:h-10 md:w-10 dark:bg-orange-900">
                    <Gavel className="h-4 w-4 text-orange-600 md:h-5 md:w-5 dark:text-orange-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold md:text-2xl">
                      {agendaItems.filter(item => item.amendment).length}
                    </p>
                    <p className="text-muted-foreground truncate text-xs md:text-sm">
                      {agendaItems.filter(item => item.amendment).length === 1
                        ? t('features.events.agenda.amendment')
                        : t('features.events.agenda.amendments')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 md:h-10 md:w-10 dark:bg-blue-900">
                    <FileText className="h-4 w-4 text-blue-600 md:h-5 md:w-5 dark:text-blue-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold md:text-2xl">
                      {agendaItems.reduce(
                        (count: number, item) =>
                          count +
                          (item.amendment?.change_requests?.filter(
                            cr => cr.status === 'open' || !cr.status
                          ).length || 0),
                        0
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-xs md:text-sm">
                      {t('features.events.agenda.openChangeRequests')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {t('features.events.agenda.itemsCount', { count: filteredAgendaItems.length })}
          </h2>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <FormControlInput
              placeholder={t('features.events.agenda.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle>{t('features.events.agenda.filters')}</CardTitle>
              <CardDescription>{t('features.events.agenda.filtersDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FormControlLabel htmlFor="type-filter">
                    {t('features.events.agenda.type')}
                  </FormControlLabel>
                  <FormControlSelect value={typeFilter} onValueChange={setTypeFilter}>
                    <FormControlSelectTrigger id="type-filter">
                      <FormControlSelectValue />
                    </FormControlSelectTrigger>
                    <FormControlSelectContent>
                      <FormControlSelectItem value="all">
                        {t('features.events.agenda.allTypes')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="election">
                        {t('features.events.agenda.typeElection')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="vote">
                        {t('features.events.agenda.typeVote')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="speech">
                        {t('features.events.agenda.typeSpeech')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="discussion">
                        {t('features.events.agenda.typeDiscussion')}
                      </FormControlSelectItem>
                    </FormControlSelectContent>
                  </FormControlSelect>
                </div>

                <div className="space-y-2">
                  <FormControlLabel htmlFor="status-filter">
                    {t('features.events.agenda.statusLabel')}
                  </FormControlLabel>
                  <FormControlSelect value={statusFilter} onValueChange={setStatusFilter}>
                    <FormControlSelectTrigger id="status-filter">
                      <FormControlSelectValue />
                    </FormControlSelectTrigger>
                    <FormControlSelectContent>
                      <FormControlSelectItem value="all">
                        {t('features.events.agenda.allStatus')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="pending">
                        {t('features.events.agenda.statusPending')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="in-progress">
                        {t('features.events.agenda.statusInProgress')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="completed">
                        {t('features.events.agenda.statusCompleted')}
                      </FormControlSelectItem>
                      <FormControlSelectItem value="planned">
                        {t('features.events.agenda.statusPlanned')}
                      </FormControlSelectItem>
                    </FormControlSelectContent>
                  </FormControlSelect>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Agenda Items List */}
      {filteredAgendaItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">{t('features.events.agenda.noItems')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('features.events.agenda.noItemsDescription')}
            </p>
            <Button asChild>
              <Link to="/create/agenda-item" search={{ eventId }}>
                <Plus className="mr-2 h-4 w-4" />
                {t('features.events.agenda.createFirstItem')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {confirmedAgendaItems.length > 0 ? renderAgendaItemsList(confirmedAgendaItems) : null}

          {scheduledButUnconfirmedAgendaItems.length > 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>{t('features.events.agenda.scheduledButUnconfirmedTitle')}</CardTitle>
                <CardDescription>
                  {t('features.events.agenda.scheduledButUnconfirmedDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>{renderAgendaItemsList(scheduledButUnconfirmedAgendaItems)}</CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <VoteCastDialog
        open={actionBarHook.voteDialogOpen}
        onOpenChange={actionBarHook.setVoteDialogOpen}
        phase={isCRToolbarActive ? selectedCRDialogPhase : actionBarHook.voteCasting.phase}
        title={isCRToolbarActive ? selectedCRTitle : (streamAgendaItem?.title ?? undefined)}
        forwardingPreview={streamForwardingPreview}
        candidates={
          isCRToolbarActive
            ? undefined
            : streamElection
              ? (streamElection.candidates as CandidatesByElectionRow[]).map(candidate => ({
                  id: candidate.id,
                  name: candidate.user
                    ? `${candidate.user.first_name ?? ''} ${candidate.user.last_name ?? ''}`.trim() ||
                      candidate.user.email ||
                      'Candidate'
                    : candidate.name || 'Candidate',
                  avatar: candidate.user?.avatar ?? undefined,
                }))
              : undefined
        }
        maxVotes={streamElection?.max_votes ?? 1}
        electionMode={
          streamElection?.election_mode ? normalizeElectionMode(streamElection.election_mode) : null
        }
        seatCount={streamElection?.seat_count ?? null}
        choices={
          isCRToolbarActive
            ? selectedCRChoices
            : streamVote
              ? (streamVote.choices as ChoicesByVoteRow[]).map(choice => ({
                  id: choice.id,
                  label: choice.label || 'Choice',
                }))
              : undefined
        }
        requirePassword
        passwordError={passwordError}
        isPasswordVerifying={isPasswordVerifying}
        onPasswordSubmit={async password => {
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
    </div>
  );
}
