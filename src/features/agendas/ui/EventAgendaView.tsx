'use client';

import type { CSSProperties } from 'react';

import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlInput,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Link } from '@tanstack/react-router';
import { useAgendaItems } from '../hooks/useAgendaItems';
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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  GripVertical,
  Maximize2,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { TimelineItem } from '@/features/agendas/ui/TimelineItem.tsx';
import { AgendaItemContextCard } from './AgendaItemContextCard';
import { AgendaRelatedRoleCard } from './AgendaRelatedEntityCard';
import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { AgendaSpeakerListSection } from './AgendaSpeakerListSection';
import { AgendaElectionSection, isAutoAssignedRoleElection } from './AgendaElectionSection';
import { AgendaVoteSection } from './AgendaVoteSection';
import { OfflineTallyDialog } from './OfflineTallyDialog';
import { AgendaCard, type AgendaItemStatus } from '@/features/agendas/ui/AgendaCard.tsx';
import { AgendaCountdownPill, AgendaEndedPill } from './AgendaBadges';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import { AgendaActionBar } from './AgendaActionBar';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import { CandidacyPasswordDialog } from '@/features/elections/ui/CandidacyPasswordDialog';
import { EditElectionVoteDialog } from './EditElectionVoteDialog';
import { NamedBallotResultsDialog } from './NamedBallotResultsDialog';
import { isNamedBallot } from '@/zero/shared';
import { EventLiveFocusDialog } from './EventLiveFocusDialog';
import { getAgendaDisplayTimes } from '../logic/getAgendaDisplayTimes';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import { getAgendaDisplayType } from '../logic/agendaUiHelpers';
import { EventLivestreamPlayer } from '@/features/events/ui/EventLivestreamPlayer';
import { computeAgendaStats } from '../logic/computeAgendaStats';
import { getOfflineTallyDialogTitle, getOfflineTallyTooltip } from '../logic/offlineTallyToolbar';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { VirtualAgendaChangeRequestCardsList } from './VirtualAgendaChangeRequestCardsList';
import { AgendaActiveItemHeader } from './AgendaActiveItemHeader';
import {
  AgendaContextTabs,
  AgendaPageShell,
  AgendaSectionHeading,
  AgendaSurface,
  AgendaVotingWorkspace,
  type AgendaVotingWorkspaceMode,
} from './AgendaUiSystem';
import { getAppTutorialElectionCopy } from '@/features/app-tutorial/amendment-fixture';
import { resolveAppTutorialFixtureText } from '@/features/app-tutorial/fixture-copy';
type EventAgendaItemRow = ReturnType<typeof useAgendaItems>['agendaItems'][number];
export interface EventAgendaViewProps {
  virtualizeChangeRequests?: boolean;
  eventId: any;
  t: any;
  language?: string;
  user: any;
  navigate: any;
  event: any;
  eventLoading: any;
  agendaItems: any;
  isLoading: any;
  can: any;
  addSpeaker: any;
  updateSpeaker: any;
  removeSpeaker: any;
  reorderAgendaItems: any;
  agendaNav: any;
  previousAgendaItemIdRef: any;
  activeItemRef: any;
  currentAgendaItemId: any;
  searchQuery: any;
  setSearchQuery: any;
  typeFilter: any;
  setTypeFilter: any;
  statusFilter: any;
  setStatusFilter: any;
  showFilters: any;
  setShowFilters: any;
  statsOpen: any;
  setStatsOpen: any;
  streamOpen: any;
  setStreamOpen: any;
  streamContextPane: 'details' | 'speakers';
  setStreamContextPane: (pane: 'details' | 'speakers') => void;
  liveFocusOpen: any;
  setLiveFocusOpen: any;
  addingSpeaker: any;
  setAddingSpeaker: any;
  removingSpeaker: any;
  setRemovingSpeaker: any;
  setMarkingSpeakerComplete: any;
  verifyVotingPassword: any;
  upsertElectionOfflineTally: any;
  upsertVoteOfflineTally: any;
  passwordError: any;
  setPasswordError: any;
  attendanceMode: any;
  disableVoteButton: any;
  allowsOfflineElectionTallies: any;
  confirmedOfflineParticipantCount: any;
  eligibleFinalVoterCount?: number;
  isPasswordVerifying: any;
  setIsPasswordVerifying: any;
  offlineTallyDialogOpen: any;
  setOfflineTallyDialogOpen: any;
  offlineTallyPasswordError: any;
  setOfflineTallyPasswordError: any;
  offlineTallySubmitError: any;
  setOfflineTallySubmitError: any;
  isOfflineTallySubmitting: any;
  setIsOfflineTallySubmitting: any;
  dismissedOverdueAgendaItemId: any;
  setDismissedOverdueAgendaItemId: any;
  canManageAgenda: any;
  canManageVotes: any;
  canManageVoteSequence?: any;
  canJoinSpeakerList: any;
  canManageOfflineTallies: any;
  draggedAgendaItemId: any;
  setDraggedAgendaItemId: any;
  dragOverAgendaItemId: any;
  setDragOverAgendaItemId: any;
  dragInsertPosition: any;
  setDragInsertPosition: any;
  orderedAgendaItems: any;
  resetAgendaDragState: any;
  isAgendaItemDraggable: any;
  handleAgendaDragStart: any;
  handleAgendaDrop: any;
  handleAgendaDragEnd: any;
  isEventStarted: any;
  eventStartTimestamp: any;
  activeAgendaItem: any;
  liveAgendaItem: any;
  liveAgendaItemId: any;
  spotlightAgendaItem: any;
  spotlightAgendaItemId: any;
  streamAgendaItem: any;
  streamRuntimeStatus: any;
  streamIsLive: any;
  overdueStartCandidate: any;
  streamSpeakerListData: any;
  isUserInSpeakerList: any;
  streamElection: any;
  streamVote: any;
  streamDelegateAssignmentMeta: any;
  streamDelegateTargetEvent: any;
  streamForwardingContext: any;
  crVoting: any;
  streamVoteSequenceItems?: any[];
  streamAgendaItemAmendmentEditingMode?: any;
  streamDocumentContent?: any;
  streamAmendmentDiscussions?: any[];
  actionBarElection: any;
  actionBarCandidates: any;
  toolbarElection: any;
  streamVotingPhase: any;
  toolbarVotingPhase: any;
  synthesizedClosingVoteItem: any;
  effectiveClosingVoteItem: any;
  nextPendingCRItem: any;
  activeCRToolbarItem: any;
  nextStartableSequenceItem?: any;
  canStartSelectedCRFinalVote?: boolean;
  isCRToolbarActive: any;
  selectedCRPhase: any;
  isSelectedClosingVote: any;
  hasUserVotedOnSelectedCR: any;
  selectedCRTitle: any;
  selectedCRChoices: any;
  selectedCRDialogPhase: any;
  streamForwardingPreview: any;
  voteDialogDocumentPreviewContent?: any;
  effectiveToolbarVotingPhase: any;
  toolbarOfflineTallyPhaseSource: any;
  toolbarOfflineTallyPhase: any;
  toolbarOfflineTallyEntity: any;
  toolbarOfflineTallyMode: any;
  showOfflineTallyButton: any;
  sequenceVotingLoading: any;
  startVoteTooltip: any;
  startFinalVoteTooltip: any;
  closeVoteTooltip: any;
  castIndicativeVoteTooltip: any;
  castFinalVoteTooltip: any;
  indicativeSelections: any;
  finalSelections: any;
  userElector: any;
  userHasElectionVoted: any;
  userSelectedCandidateIds: any;
  indicativeDecisions: any;
  finalDecisions: any;
  userVoter: any;
  actionBarHook: any;
  toolbarAgendaItem: any;
  topNumberByAgendaItemId: any;
  toolbarAgendaItemTopNumber: any;
  streamAgendaItemTopNumber: any;
  userHasVoteVoted: any;
  userSelectedChoiceIds: any;
  namedResultsTarget?: 'election' | 'vote' | null;
  setNamedResultsTarget?: (target: 'election' | 'vote' | null) => void;
  namedResultsDialogConfig?: any;
  handleToolbarStartVote: any;
  handleStartSequenceFinalVote?: any;
  setSelectedCRToolbarItemId?: any;
  handleJumpToNextStartableSequenceItem?: any;
  handleToolbarStartFinalVote: any;
  handleToolbarCloseVote: any;
  handleCastCRVoteFromDialog: any;
  handleOfflineTallyDialogOpenChange: any;
  handleOpenOfflineTallyDialog: any;
  handleSubmitOfflineTally: any;
  handleAddToSpeakerList: any;
  handleMarkSpeakerCompleted: any;
  handleRemoveFromSpeakerList: any;
  loweredSearchQuery: any;
  normalizedSearchQuery: any;
  filteredAgendaItems: any;
  confirmedAgendaItems: any;
  scheduledButUnconfirmedAgendaItems: any;
  formatTime: any;
}

export function EventAgendaView({
  virtualizeChangeRequests = false,
  eventId,
  t,
  language,
  user,
  navigate,
  event,
  eventLoading,
  agendaItems,
  isLoading,
  agendaNav,
  activeItemRef,
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  showFilters,
  setShowFilters,
  statsOpen,
  setStatsOpen,
  streamOpen,
  setStreamOpen,
  streamContextPane,
  setStreamContextPane,
  liveFocusOpen,
  setLiveFocusOpen,
  addingSpeaker,
  removingSpeaker,
  verifyVotingPassword,
  passwordError,
  setPasswordError,
  attendanceMode,
  disableVoteButton,
  confirmedOfflineParticipantCount,
  eligibleFinalVoterCount,
  isPasswordVerifying,
  setIsPasswordVerifying,
  offlineTallyDialogOpen,
  offlineTallyPasswordError,
  offlineTallySubmitError,
  isOfflineTallySubmitting,
  canManageAgenda,
  canManageVotes,
  canManageVoteSequence = canManageVotes || canManageAgenda,
  canJoinSpeakerList,
  draggedAgendaItemId,
  dragOverAgendaItemId,
  setDragOverAgendaItemId,
  dragInsertPosition,
  setDragInsertPosition,
  isAgendaItemDraggable,
  handleAgendaDragStart,
  handleAgendaDrop,
  handleAgendaDragEnd,
  isEventStarted,
  eventStartTimestamp,
  liveAgendaItemId,
  spotlightAgendaItemId,
  streamAgendaItem,
  streamRuntimeStatus,
  streamIsLive,
  streamSpeakerListData,
  isUserInSpeakerList,
  streamElection,
  streamVote,
  streamDelegateTargetEvent,
  crVoting,
  streamVoteSequenceItems = [],
  streamAgendaItemAmendmentEditingMode,
  streamDocumentContent,
  streamAmendmentDiscussions = [],
  toolbarElection,
  effectiveClosingVoteItem,
  activeCRToolbarItem,
  nextStartableSequenceItem,
  canStartSelectedCRFinalVote = false,
  isCRToolbarActive,
  selectedCRPhase,
  hasUserVotedOnSelectedCR,
  selectedCRTitle,
  selectedCRChoices,
  selectedCRDialogPhase,
  streamForwardingPreview,
  voteDialogDocumentPreviewContent,
  effectiveToolbarVotingPhase,
  toolbarOfflineTallyPhase,
  toolbarOfflineTallyEntity,
  toolbarOfflineTallyMode,
  showOfflineTallyButton,
  sequenceVotingLoading,
  startVoteTooltip,
  startFinalVoteTooltip,
  closeVoteTooltip,
  castIndicativeVoteTooltip,
  castFinalVoteTooltip,
  indicativeSelections,
  finalSelections,
  userHasElectionVoted,
  userSelectedCandidateIds,
  indicativeDecisions,
  finalDecisions,
  actionBarHook,
  toolbarAgendaItem,
  topNumberByAgendaItemId,
  toolbarAgendaItemTopNumber,
  streamAgendaItemTopNumber,
  userHasVoteVoted,
  userSelectedChoiceIds,
  namedResultsTarget = null,
  setNamedResultsTarget,
  namedResultsDialogConfig,
  handleToolbarStartVote,
  handleStartSequenceFinalVote,
  setSelectedCRToolbarItemId,
  handleJumpToNextStartableSequenceItem,
  handleToolbarStartFinalVote,
  handleToolbarCloseVote,
  handleCastCRVoteFromDialog,
  handleOfflineTallyDialogOpenChange,
  handleOpenOfflineTallyDialog,
  handleSubmitOfflineTally,
  handleAddToSpeakerList,
  handleMarkSpeakerCompleted,
  handleRemoveFromSpeakerList,
  filteredAgendaItems,
  confirmedAgendaItems,
  scheduledButUnconfirmedAgendaItems,
  formatTime,
}: EventAgendaViewProps) {
  const agendaStats = computeAgendaStats(agendaItems ?? []);
  const tutorialElectionCopy = getAppTutorialElectionCopy(language);
  const isTutorialElectionAgendaItem = (item: { type?: string | null } | null | undefined) =>
    Boolean(event?.tutorial_run_id && item?.type === 'election');
  const streamIsTutorialElection = isTutorialElectionAgendaItem(streamAgendaItem);
  const displayedStreamAgendaItem =
    streamAgendaItem && streamIsTutorialElection
      ? {
          ...streamAgendaItem,
          title: tutorialElectionCopy.agendaTitle,
          description: tutorialElectionCopy.agendaDescription,
        }
      : streamAgendaItem;
  const displayedStreamElection =
    streamElection && streamIsTutorialElection
      ? {
          ...streamElection,
          title: tutorialElectionCopy.electionTitle,
          description: tutorialElectionCopy.electionDescription,
        }
      : streamElection;
  const isOfflineOnlyAttendance = attendanceMode === 'offline';
  const activeCRIsPlaceholder = Boolean(
    (activeCRToolbarItem as { _votePlaceholder?: boolean } | null)?._votePlaceholder
  );
  const activeCRHasVoteChoices = selectedCRChoices.length > 0;
  const canCastActiveCRVote = !activeCRIsPlaceholder && activeCRHasVoteChoices;
  const noVotingPasswordSettingsHref = user?.id
    ? `/user/${user.id}/settings?tab=passwords`
    : undefined;
  const voteButtonDisabled =
    !isCRToolbarActive && (disableVoteButton || actionBarHook.disableSecretIndicativeVoteButton);
  const disabledVoteTooltip =
    actionBarHook.secretIndicativeVoteTooltip ??
    translateText('generated.inline.0005_offline_votes_are_entered_via_tallies_0ab8a792');
  const liveFocusVoteClick = isOfflineOnlyAttendance
    ? undefined
    : isCRToolbarActive
      ? selectedCRPhase !== 'closed' && !hasUserVotedOnSelectedCR
        ? canCastActiveCRVote
          ? actionBarHook.handleVoteClick
          : undefined
        : undefined
      : actionBarHook.handleVoteClick;
  const toolbarAgendaItemRuntimeStatus = toolbarAgendaItem
    ? getAgendaRuntimeStatus({
        id: toolbarAgendaItem.id,
        status: toolbarAgendaItem.status,
        start_time: toolbarAgendaItem.start_time,
        end_time: toolbarAgendaItem.end_time,
        activated_at: toolbarAgendaItem.activated_at,
        completed_at: toolbarAgendaItem.completed_at,
        currentAgendaItemId: liveAgendaItemId,
      })
    : null;
  const isToolbarAgendaItemActive = toolbarAgendaItemRuntimeStatus === 'in-progress';
  const liveFocusStartVoteClick = isCRToolbarActive
    ? isToolbarAgendaItemActive && selectedCRPhase === 'pending'
      ? handleToolbarStartVote
      : undefined
    : isToolbarAgendaItemActive && effectiveToolbarVotingPhase === 'pending'
      ? actionBarHook.handleStartVote
      : undefined;
  const liveFocusStartFinalVoteClick = isCRToolbarActive
    ? isToolbarAgendaItemActive && selectedCRPhase === 'indication' && canStartSelectedCRFinalVote
      ? handleToolbarStartFinalVote
      : undefined
    : isToolbarAgendaItemActive && effectiveToolbarVotingPhase === 'indication'
      ? handleToolbarStartFinalVote
      : undefined;
  const liveFocusCloseFinalVoteClick = isCRToolbarActive
    ? isToolbarAgendaItemActive && selectedCRPhase === 'final'
      ? handleToolbarCloseVote
      : undefined
    : isToolbarAgendaItemActive && effectiveToolbarVotingPhase === 'final'
      ? handleToolbarCloseVote
      : undefined;
  const liveFocusVotingPhase = isCRToolbarActive ? selectedCRPhase : effectiveToolbarVotingPhase;
  const liveFocusIsVotingActionAvailable = isCRToolbarActive
    ? Boolean(activeCRToolbarItem?.vote && canCastActiveCRVote)
    : Boolean(streamElection || streamVote);
  const liveFocusHasUserVoted = isCRToolbarActive
    ? hasUserVotedOnSelectedCR
    : Boolean(streamElection ? userHasElectionVoted : streamVote ? userHasVoteVoted : false);
  const canCompleteAgendaItem =
    !isCRToolbarActive || effectiveClosingVoteItem?.status === 'completed';
  const canManageCurrentVote = isCRToolbarActive
    ? isToolbarAgendaItemActive && (canManageVoteSequence || canManageVotes || canManageAgenda)
    : isToolbarAgendaItemActive && canManageAgenda;
  const liveFocusCompleteItemDisabled =
    !toolbarAgendaItem || Boolean(agendaNav.isCurrentItemCompleted) || Boolean(agendaNav.isLoading);
  const liveFocusNextItemDisabled =
    !agendaNav.hasNextItem ||
    !agendaNav.canMoveToNextItem ||
    Boolean(agendaNav.isLoading) ||
    !toolbarAgendaItem;
  const streamAgendaDisplayTimes = streamAgendaItem
    ? getAgendaDisplayTimes({
        status: streamAgendaItem.status,
        duration: streamAgendaItem.duration,
        activated_at: streamAgendaItem.activated_at,
        completed_at: streamAgendaItem.completed_at,
        start_time: streamAgendaItem.start_time,
        end_time: streamAgendaItem.end_time,
        calculated_start_time: streamAgendaItem.calculated_start_time,
        calculated_end_time: streamAgendaItem.calculated_end_time,
      })
    : null;

  const handleOpenCRVoteDialog = (itemId: string) => {
    setSelectedCRToolbarItemId?.(itemId);
    actionBarHook.handleVoteClick();
  };

  const renderVotingWorkspace = (mode: AgendaVotingWorkspaceMode) => {
    const hasChangeRequestSequence =
      Boolean(streamAgendaItem?.amendment_id) && streamVoteSequenceItems.length > 0;
    const changeRequestPanel = hasChangeRequestSequence ? (
      <VirtualAgendaChangeRequestCardsList
        virtualize={virtualizeChangeRequests}
        items={streamVoteSequenceItems}
        editingMode={streamAgendaItemAmendmentEditingMode ?? 'event_final_closing_vote'}
        isVotingActive
        userId={user?.id}
        canManage={canManageCurrentVote}
        canVote={actionBarHook.hasVotingRight && !isOfflineOnlyAttendance}
        hideInlineVotingControls
        showAgendaDetailsVoteActions
        voteDisabledTooltip={isOfflineOnlyAttendance ? disabledVoteTooltip : undefined}
        currentItemId={activeCRToolbarItem?.id ?? null}
        progress={crVoting?.progress}
        eligibleFinalVoterCount={eligibleFinalVoterCount}
        completedCount={crVoting?.completedItems?.length}
        allCRsProcessed={crVoting?.allCRsProcessed}
        isTimelineComplete={crVoting?.isTimelineComplete}
        documentContent={streamDocumentContent}
        agendaTitle={streamAgendaItem?.title ?? null}
        forwardingPreview={streamForwardingPreview}
        defaultSortMode={event?.change_request_vote_order ?? null}
        discussions={streamAmendmentDiscussions}
        amendmentId={streamAgendaItem?.amendment_id ?? undefined}
        agendaItemId={streamAgendaItem?.id}
        hasUserVoted={crVoting?.hasUserVoted}
        getUserSelectedChoiceIds={crVoting?.getUserSelectedChoiceIds}
        onCastVote={
          canManageCurrentVote || actionBarHook.hasVotingRight ? crVoting?.castCRVote : undefined
        }
        onOpenVoteDialog={handleOpenCRVoteDialog}
        onStartIndicative={canManageCurrentVote ? crVoting?.startIndicativePhase : undefined}
        onStartFinal={canManageCurrentVote ? handleStartSequenceFinalVote : undefined}
        onCloseVoting={canManageCurrentVote ? crVoting?.closeVoting : undefined}
      />
    ) : null;

    const electionPanel = streamElection ? (
      <div className="space-y-4">
        <AgendaElectionSection
          roleName={displayedStreamElection?.title ?? t('features.events.agenda.role')}
          electionMode={
            streamElection.election_mode
              ? normalizeElectionMode(streamElection.election_mode)
              : null
          }
          seatCount={streamElection.seat_count ?? null}
          candidates={streamElection.candidates as CandidatesByElectionRow[]}
          indicativeSelections={indicativeSelections}
          finalSelections={finalSelections}
          offlineTallies={streamElection.offline_tallies ?? []}
          attendanceMode={attendanceMode}
          delegateTargetEventId={streamDelegateTargetEvent?.id}
          delegateTargetEventTitle={streamDelegateTargetEvent?.title ?? null}
          showRoleAssignedMessage={isAutoAssignedRoleElection(streamElection)}
          userHasVoted={userHasElectionVoted}
          userSelectedCandidateIds={userSelectedCandidateIds}
          electionStatus={streamElection.status}
          canVote={false}
          canBeCandidate={false}
          isUserCandidate={false}
          onBecomeCandidate={() => undefined}
          onOpenNamedResults={
            isNamedBallot(streamElection.ballot_visibility)
              ? () => setNamedResultsTarget?.('election')
              : undefined
          }
        />
        {streamElection.role ? <AgendaRelatedRoleCard role={streamElection.role} /> : null}
      </div>
    ) : null;

    const votePanel =
      streamVote && !hasChangeRequestSequence ? (
        <AgendaVoteSection
          voteId={streamVote.id}
          voteTitle={streamVote.title || streamAgendaItem?.title || 'Vote'}
          choices={streamVote.choices as ChoicesByVoteRow[]}
          indicativeDecisions={indicativeDecisions}
          finalDecisions={finalDecisions}
          offlineTallies={streamVote.offline_tallies ?? []}
          attendanceMode={attendanceMode}
          userHasVoted={userHasVoteVoted}
          userSelectedChoiceIds={userSelectedChoiceIds}
          voteStatus={streamVote.status}
          majorityType={streamVote.majority_type}
          totalEligibleVoters={eligibleFinalVoterCount}
          canManageOfflineResults={canManageAgenda}
          offlineEligibleCount={confirmedOfflineParticipantCount}
          forwardingPreview={streamForwardingPreview}
          onOpenNamedResults={
            isNamedBallot(streamVote.ballot_visibility)
              ? () => setNamedResultsTarget?.('vote')
              : undefined
          }
        />
      ) : null;

    if (!changeRequestPanel && !electionPanel && !votePanel) return null;

    return (
      <AgendaVotingWorkspace
        mode={mode}
        title={t('features.events.agenda.voteResults', 'Voting')}
        description={t(
          'features.events.agenda.votingWorkspaceDescription',
          'Voting progress, decisions, and results for the active agenda item.'
        )}
        changeRequests={changeRequestPanel}
        election={electionPanel}
        vote={votePanel}
      />
    );
  };

  const renderAgendaTimer = (agendaItem: {
    status?: string | null;
    duration?: number | null;
    calculated_start_time?: number;
    calculated_end_time?: number;
    start_time?: number | null;
    end_time?: number | null;
    activated_at?: number | null;
    completed_at?: number | null;
  }) => {
    const { displayStartTime, displayEndTime } = getAgendaDisplayTimes(agendaItem);
    const isCompleted =
      agendaItem.status === 'completed' ||
      typeof agendaItem.completed_at === 'number' ||
      typeof agendaItem.end_time === 'number';
    const isOngoing = agendaItem.status === 'in-progress' || agendaItem.status === 'active';

    if (isCompleted && displayEndTime) {
      return <AgendaEndedPill endedAt={new Date(displayEndTime)} />;
    }

    if (isOngoing && displayEndTime && displayEndTime > Date.now()) {
      return (
        <AgendaCountdownPill
          label={t('features.events.agenda.endsIn')}
          endsAt={new Date(displayEndTime)}
          tone="active"
        />
      );
    }

    if (displayStartTime && displayStartTime > Date.now()) {
      return (
        <AgendaCountdownPill
          label={t('features.events.stream.startsIn')}
          endsAt={new Date(displayStartTime)}
          tone="start"
        />
      );
    }

    return null;
  };

  const renderAgendaItemsList = (items: EventAgendaItemRow[], revealStartIndex = 0) => (
    <div className="space-y-4">
      {items.map((item, index) => {
        const displayedTitle = isTutorialElectionAgendaItem(item)
          ? tutorialElectionCopy.agendaTitle
          : resolveAppTutorialFixtureText(item.title, {
              tutorialRunId: event?.tutorial_run_id,
              language: language === 'en' ? 'en' : 'de',
            });
        const displayedDescription = isTutorialElectionAgendaItem(item)
          ? tutorialElectionCopy.agendaDescription
          : resolveAppTutorialFixtureText(item.description, {
              tutorialRunId: event?.tutorial_run_id,
              language: language === 'en' ? 'en' : 'de',
            });
        const revealIndex = Math.min(revealStartIndex + index, 11);
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
          status: item.status,
          duration: item.duration,
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
            data-tutorial-anchor={
              event?.tutorial_run_id
                ? item.amendment_id
                  ? 'tutorial-amendment-agenda-item'
                  : item.type === 'election'
                    ? 'tutorial-election-agenda-item'
                    : undefined
                : undefined
            }
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
              <div className={featureThemeClassName('agendaEventAgendaThemedBackground')} />
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
                className="civic-load-card-reveal"
                data-agenda-item-id={item.id}
                data-slot="agenda-item-reveal"
                style={
                  {
                    '--civic-load-index': revealIndex,
                  } as CSSProperties
                }
              >
                <div
                  className={cn(
                    'relative min-w-0',
                    isSpotlightItem && isLiveItem ? 'animate-pulse-subtle' : '',
                    isCompleted ? 'opacity-70' : ''
                  )}
                >
                  {isCompleted && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div
                        className={featureThemeClassName(
                          'agendaEventAgendaSuccessContrastRoundIcon'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  )}
                  <AgendaCard
                    id={item.id}
                    title={`TOP-${topNumber}-${displayedTitle ?? ''}`}
                    description={displayedDescription ?? undefined}
                    type={getAgendaDisplayType(item.type)}
                    status={runtimeStatus as AgendaItemStatus}
                    creatorName={
                      [item.creator?.first_name, item.creator?.last_name]
                        .filter(Boolean)
                        .join(' ') ||
                      (item.creator?.email ?? undefined)
                    }
                    detailsLink={`/event/${eventId}/agenda/${item.id}`}
                    isActive={isActive}
                    footerRight={renderAgendaTimer(item)}
                    className={cn(
                      isCompleted
                        ? featureThemeClassName('agendaEventAgendaSuccessBorder')
                        : undefined,
                      isSpotlightItem
                        ? isLiveItem
                          ? featureThemeClassName('agendaEventAgendaThemedBorder')
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
              </div>
            </TimelineItem>
            {dragOverAgendaItemId === item.id && dragInsertPosition === 'below' && (
              <div className={featureThemeClassName('agendaEventAgendaThemedBackgroundAlpha')} />
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
            {Array.from({ length: 3 }).map((_: any, i: number) => (
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
          <CardContent align="center" className="p-6">
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
    <div data-tutorial-anchor={event?.tutorial_run_id ? 'tutorial-amendment-forwarded' : undefined}>
      <AgendaPageShell>
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
                  status: toolbarAgendaItemRuntimeStatus,
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
          onCompleteItem={canCompleteAgendaItem ? agendaNav.completeCurrentItem : undefined}
          onJumpToNextVoteStep={
            canManageCurrentVote && isCRToolbarActive && nextStartableSequenceItem
              ? handleJumpToNextStartableSequenceItem
              : undefined
          }
          navigationLoading={agendaNav.isLoading}
          speakerLoading={actionBarHook.speakerLoading}
          candidateLoading={actionBarHook.candidateLoading}
          voteLoading={actionBarHook.voteCasting.isLoading || Boolean(sequenceVotingLoading)}
          onJoinSpeakerList={
            actionBarHook.canJoinSpeakerList ? actionBarHook.handleJoinSpeakerList : undefined
          }
          onLeaveSpeakerList={actionBarHook.handleLeaveSpeakerList}
          onBecomeCandidate={actionBarHook.handleBecomeCandidate}
          onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
          onStartVote={
            canManageCurrentVote && isCRToolbarActive
              ? selectedCRPhase === 'pending'
                ? handleToolbarStartVote
                : undefined
              : canManageCurrentVote && effectiveToolbarVotingPhase === 'pending'
                ? actionBarHook.handleStartVote
                : undefined
          }
          onStartFinalVote={
            canManageCurrentVote && isCRToolbarActive
              ? selectedCRPhase === 'indication' && canStartSelectedCRFinalVote
                ? handleToolbarStartFinalVote
                : undefined
              : canManageCurrentVote && effectiveToolbarVotingPhase === 'indication'
                ? handleToolbarStartFinalVote
                : undefined
          }
          onCloseFinalVote={
            canManageCurrentVote && isCRToolbarActive
              ? selectedCRPhase === 'final'
                ? handleToolbarCloseVote
                : undefined
              : canManageCurrentVote && effectiveToolbarVotingPhase === 'final'
                ? handleToolbarCloseVote
                : undefined
          }
          onVoteClick={liveFocusVoteClick}
          disableVoteButton={voteButtonDisabled}
          disabledVoteTooltip={disabledVoteTooltip}
          showOfflineTallyButton={showOfflineTallyButton}
          onOfflineTallyClick={showOfflineTallyButton ? handleOpenOfflineTallyDialog : undefined}
          offlineTallyMode={toolbarOfflineTallyMode}
          offlineTallyTooltip={getOfflineTallyTooltip({
            phase: toolbarOfflineTallyPhase,
            mode: toolbarOfflineTallyMode,
          })}
          startVoteTooltip={startVoteTooltip}
          startFinalVoteTooltip={startFinalVoteTooltip}
          closeVoteTooltip={closeVoteTooltip}
          jumpToNextVoteStepTooltip={t(
            'features.agendas.crTimeline.nextVotingStep',
            'Next voting step'
          )}
          castIndicativeVoteTooltip={castIndicativeVoteTooltip}
          castFinalVoteTooltip={castFinalVoteTooltip}
        />
        {/* Spacer for fixed toolbar */}
        <div className="h-10" />

        <OfflineTallyDialog
          open={offlineTallyDialogOpen}
          onOpenChange={handleOfflineTallyDialogOpenChange}
          title={getOfflineTallyDialogTitle(toolbarOfflineTallyPhase ?? 'indicative')}
          description={translateText('features.events.agenda.offlineTallyDescription', {
            item:
              toolbarOfflineTallyEntity?.title ?? translateText('features.events.agenda.thisItem'),
          })}
          phase={toolbarOfflineTallyPhase ?? 'indicative'}
          choices={toolbarOfflineTallyEntity?.choices ?? []}
          tallies={toolbarOfflineTallyEntity?.tallies ?? []}
          maxTotalVotes={toolbarOfflineTallyEntity?.maxTotalVotes ?? null}
          maxPerEntryVotes={toolbarOfflineTallyEntity?.maxPerEntryVotes ?? null}
          maxPerEntryLimitLabel={
            toolbarOfflineTallyEntity?.kind === 'election'
              ? translateText('features.events.agenda.candidate')
              : undefined
          }
          participantCount={toolbarOfflineTallyEntity?.participantCount ?? null}
          votesPerParticipant={toolbarOfflineTallyEntity?.votesPerParticipant ?? null}
          isSubmitting={isOfflineTallySubmitting}
          passwordError={offlineTallyPasswordError}
          noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
          submitError={offlineTallySubmitError}
          onSubmit={handleSubmitOfflineTally}
        />

        <CandidacyPasswordDialog
          {...actionBarHook.candidacyDialogProps}
          noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
        />

        <EventLiveFocusDialog
          open={liveFocusOpen}
          onOpenChange={setLiveFocusOpen}
          t={t}
          streamUrl={event?.stream_url}
          currentAgendaItem={streamAgendaItem}
          currentAgendaItemTopNumber={streamAgendaItemTopNumber}
          streamRuntimeStatus={streamRuntimeStatus}
          streamIsLive={streamIsLive}
          eventStartTimestamp={eventStartTimestamp}
          speakerList={streamSpeakerListData}
          showSpeakerGender={Boolean(event?.gender_quota_enabled)}
          userId={user?.id}
          isUserInSpeakerList={actionBarHook.isUserInSpeakerList}
          speakerLoading={actionBarHook.speakerLoading}
          onJoinSpeakerList={
            actionBarHook.canJoinSpeakerList ? actionBarHook.handleJoinSpeakerList : undefined
          }
          onLeaveSpeakerList={actionBarHook.handleLeaveSpeakerList}
          onMarkSpeakerCompleted={canManageAgenda ? handleMarkSpeakerCompleted : undefined}
          canManageAgenda={canManageAgenda}
          navigationLoading={agendaNav.isLoading}
          onStartVote={liveFocusStartVoteClick}
          onStartFinalVote={liveFocusStartFinalVoteClick}
          onCloseFinalVote={liveFocusCloseFinalVoteClick}
          onJumpToNextVoteStep={
            canManageCurrentVote && isCRToolbarActive && nextStartableSequenceItem
              ? handleJumpToNextStartableSequenceItem
              : undefined
          }
          onEditItem={canManageAgenda ? actionBarHook.handleEditClick : undefined}
          startVoteLabel={startVoteTooltip}
          startFinalVoteLabel={startFinalVoteTooltip}
          closeFinalVoteLabel={closeVoteTooltip}
          onCompleteItem={canCompleteAgendaItem ? agendaNav.completeCurrentItem : undefined}
          completeItemDisabled={!canCompleteAgendaItem || liveFocusCompleteItemDisabled}
          onNextItem={agendaNav.moveToNextItem}
          nextItemDisabled={liveFocusNextItemDisabled}
          votingPhase={liveFocusVotingPhase}
          isVotingActionAvailable={liveFocusIsVotingActionAvailable}
          canVote={actionBarHook.hasVotingRight}
          hasUserVoted={liveFocusHasUserVoted}
          voteLoading={actionBarHook.voteCasting.isLoading || Boolean(sequenceVotingLoading)}
          disableVoteButton={voteButtonDisabled}
          disabledVoteTooltip={disabledVoteTooltip}
          onVoteClick={liveFocusVoteClick}
          showOfflineTallyButton={showOfflineTallyButton}
          onOfflineTallyClick={showOfflineTallyButton ? handleOpenOfflineTallyDialog : undefined}
          offlineTallyMode={toolbarOfflineTallyMode}
          offlineTallyLabel={getOfflineTallyTooltip({
            phase: toolbarOfflineTallyPhase,
            mode: toolbarOfflineTallyMode,
          })}
          canBeCandidate={actionBarHook.hasCandidateRight}
          isUserCandidate={actionBarHook.isUserCandidate}
          candidateLoading={actionBarHook.candidateLoading}
          onBecomeCandidate={actionBarHook.handleBecomeCandidate}
          onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
          attendanceMode={attendanceMode}
          confirmedOfflineParticipantCount={confirmedOfflineParticipantCount}
          eligibleFinalVoterCount={eligibleFinalVoterCount}
          streamElection={streamElection}
          streamVote={streamVote}
          streamDelegateTargetEvent={streamDelegateTargetEvent}
          indicativeSelections={indicativeSelections}
          finalSelections={finalSelections}
          userHasElectionVoted={userHasElectionVoted}
          userSelectedCandidateIds={userSelectedCandidateIds}
          indicativeDecisions={indicativeDecisions}
          finalDecisions={finalDecisions}
          userHasVoteVoted={userHasVoteVoted}
          userSelectedChoiceIds={userSelectedChoiceIds}
          streamForwardingPreview={streamForwardingPreview}
          votingWorkspace={renderVotingWorkspace('fullscreen')}
        />

        {/* Stream Section */}
        <Collapsible open={streamOpen} onOpenChange={setStreamOpen}>
          <Card className="border-border/70 bg-card/70 overflow-hidden rounded-xl shadow-none">
            <CardHeader className="p-0">
              <AgendaActiveItemHeader
                className="rounded-none border-0 bg-transparent"
                topLabel={
                  typeof streamAgendaItemTopNumber === 'number'
                    ? `TOP-${streamAgendaItemTopNumber}`
                    : undefined
                }
                isLive={streamIsLive}
                status={streamRuntimeStatus ?? 'planned'}
                type={streamAgendaItem?.type ?? 'discussion'}
                title={displayedStreamAgendaItem?.title ?? t('features.events.stream.noActiveItem')}
                description={
                  displayedStreamAgendaItem?.description ??
                  streamAgendaItem?.amendment?.reason ??
                  t(
                    'features.events.stream.liveFocusDescription',
                    'Follow the active agenda item and its current voting state.'
                  )
                }
                amendmentId={
                  streamAgendaItem?.amendment_id ?? streamAgendaItem?.amendment?.id ?? null
                }
                group={streamAgendaItem?.amendment?.group ?? null}
                timing={
                  streamAgendaItem
                    ? {
                        startAt: streamAgendaDisplayTimes?.displayStartTime,
                        endAt: streamAgendaDisplayTimes?.displayEndTime,
                        votingStartAt: streamAgendaItem.activated_at ?? streamAgendaItem.start_time,
                        votingEndAt:
                          streamElection?.closing_end_time ?? streamVote?.closing_end_time ?? null,
                        durationMinutes: streamAgendaItem.duration ?? null,
                        startIsEstimated:
                          !streamAgendaItem.activated_at && !streamAgendaItem.start_time,
                        endIsEstimated:
                          !streamAgendaItem.completed_at && !streamAgendaItem.end_time,
                      }
                    : undefined
                }
                action={
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setLiveFocusOpen(true);
                      }}
                      aria-label={t('features.events.stream.openLiveFocus', 'Open live focus')}
                      title={t('features.events.stream.openLiveFocus', 'Open live focus')}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          streamOpen
                            ? t('common.actions.collapse', 'Collapse')
                            : t('common.actions.expand', 'Expand')
                        }
                      >
                        {streamOpen ? (
                          <ChevronUp className="text-muted-foreground h-5 w-5" />
                        ) : (
                          <ChevronDown className="text-muted-foreground h-5 w-5" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </>
                }
              />
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="border-border/60 border-t p-4 sm:p-5">
                {!streamAgendaItem ? (
                  <div className="text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed p-4">
                    <Info className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">{t('features.events.stream.noActiveItem')}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {streamIsLive ? (
                      <EventLivestreamPlayer
                        streamUrl={event.stream_url}
                        title={t('features.events.stream.liveStream')}
                        containerClassName={featureThemeClassName(
                          'agendaEventAgendaContrastBackground'
                        )}
                      />
                    ) : null}

                    <AgendaContextTabs
                      value={streamContextPane}
                      onValueChange={setStreamContextPane}
                      detailsLabel={t('features.events.agenda.details', 'Details')}
                      speakersLabel={t('features.events.agenda.speakerList', 'Speaker list')}
                      details={
                        <div className="space-y-4" data-testid="agenda-overview-context-details">
                          <AgendaItemContextCard
                            presentation="embedded"
                            agendaItem={{
                              id: streamAgendaItem.id,
                              title: displayedStreamAgendaItem?.title || '',
                              description: displayedStreamAgendaItem?.description ?? undefined,
                              type: streamAgendaItem.type || 'discussion',
                              status: streamRuntimeStatus ?? 'planned',
                            }}
                            amendment={streamAgendaItem.amendment ?? undefined}
                            amendmentForwardingPreview={streamForwardingPreview}
                            election={displayedStreamElection ?? undefined}
                          />
                          {streamDelegateTargetEvent ? (
                            <EventSearchCard event={streamDelegateTargetEvent} />
                          ) : null}
                        </div>
                      }
                      speakers={
                        <div data-testid="agenda-overview-context-speakers">
                          <AgendaSpeakerListSection
                            agendaItemId={streamAgendaItem.id}
                            speakers={streamSpeakerListData}
                            isUserInSpeakerList={isUserInSpeakerList}
                            canManageSpeakers={canManageAgenda}
                            isAddingSpeaker={addingSpeaker}
                            isRemovingSpeaker={removingSpeaker}
                            userId={user?.id}
                            agendaStartTime={
                              streamAgendaItem.activated_at ??
                              streamAgendaItem.start_time ??
                              undefined
                            }
                            showGender={Boolean(event?.gender_quota_enabled)}
                            onAddToSpeakerList={
                              canJoinSpeakerList ? handleAddToSpeakerList : undefined
                            }
                            onRemoveFromSpeakerList={handleRemoveFromSpeakerList}
                            onMarkCompleted={
                              canManageAgenda ? handleMarkSpeakerCompleted : undefined
                            }
                          />
                        </div>
                      }
                    />

                    {renderVotingWorkspace('overview')}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Agenda Statistics */}
        <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
          <Card className="border-border/70 bg-card/70 overflow-hidden rounded-xl shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="hover:bg-muted/50 w-full justify-between rounded-lg px-3"
                >
                  <CardTitle className="text-lg">
                    {t('features.events.agenda.statistics')}
                  </CardTitle>
                  {statsOpen ? (
                    <ChevronUp className="text-muted-foreground h-5 w-5" />
                  ) : (
                    <ChevronDown className="text-muted-foreground h-5 w-5" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="border-border/60 border-t p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <div className="bg-background/50 flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                    <div className={featureThemeClassName('agendaEventAgendaAccentRoundIcon')}>
                      <Vote className={featureThemeClassName('agendaEventAgendaAccentIcon')} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold md:text-2xl">{agendaStats.electionsCount}</p>
                      <p className="text-muted-foreground truncate text-xs md:text-sm">
                        {agendaStats.electionsCount === 1
                          ? t('features.events.agenda.election')
                          : t('features.events.agenda.elections')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-background/50 flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                    <div
                      className={featureThemeClassName('agendaEventAgendaWarningRoundIconAlpha')}
                    >
                      <Gavel className={featureThemeClassName('agendaEventAgendaWarningIcon')} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold md:text-2xl">{agendaStats.amendmentsCount}</p>
                      <p className="text-muted-foreground truncate text-xs md:text-sm">
                        {agendaStats.amendmentsCount === 1
                          ? t('features.events.agenda.amendment')
                          : t('features.events.agenda.amendments')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-background/50 flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                    <div className={featureThemeClassName('agendaEventAgendaInfoRoundIcon')}>
                      <FileText className={featureThemeClassName('agendaEventAgendaInfoIcon')} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold md:text-2xl">
                        {agendaStats.openChangeRequestsCount}
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
        <AgendaSurface className="space-y-4 p-4 sm:p-5">
          <AgendaSectionHeading
            eyebrow={t('features.events.agenda.title', 'Agenda')}
            title={t('features.events.agenda.itemsCount', { count: filteredAgendaItems.length })}
          />

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
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-label={t('features.events.agenda.filters')}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {showFilters && (
            <Card className="bg-background/45 shadow-none">
              <CardHeader className="px-4 pt-4 pb-3">
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
        </AgendaSurface>

        {/* Agenda Items List */}
        {filteredAgendaItems.length === 0 ? (
          <Card>
            <CardContent align="center" className="p-8">
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
          <div className="space-y-4">
            {confirmedAgendaItems.length > 0 ? renderAgendaItemsList(confirmedAgendaItems) : null}

            {scheduledButUnconfirmedAgendaItems.length > 0 ? (
              <Card borderStyle="dashed" className="min-w-0 overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-xl leading-tight sm:text-2xl">
                    {t('features.events.agenda.scheduledButUnconfirmedTitle')}
                  </CardTitle>
                  <CardDescription className="leading-relaxed">
                    {t('features.events.agenda.scheduledButUnconfirmedDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  {renderAgendaItemsList(
                    scheduledButUnconfirmedAgendaItems,
                    confirmedAgendaItems.length
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        <VoteCastDialog
          open={actionBarHook.voteDialogOpen}
          onOpenChange={actionBarHook.setVoteDialogOpen}
          phase={isCRToolbarActive ? selectedCRDialogPhase : actionBarHook.voteCasting.phase}
          title={
            isCRToolbarActive ? selectedCRTitle : (displayedStreamAgendaItem?.title ?? undefined)
          }
          forwardingPreview={streamForwardingPreview}
          documentPreviewContent={voteDialogDocumentPreviewContent}
          candidates={
            isCRToolbarActive
              ? undefined
              : streamElection
                ? (streamElection.candidates as CandidatesByElectionRow[]).map(
                    (candidate: any) => ({
                      id: candidate.id,
                      name: candidate.user
                        ? `${candidate.user.first_name ?? ''} ${candidate.user.last_name ?? ''}`.trim() ||
                          candidate.user.email ||
                          translateText('features.events.agenda.candidate')
                        : candidate.name || translateText('features.events.agenda.candidate'),
                      avatar: candidate.user?.avatar ?? undefined,
                    })
                  )
                : undefined
          }
          maxVotes={streamElection?.max_votes ?? 1}
          electionMode={
            streamElection?.election_mode
              ? normalizeElectionMode(streamElection.election_mode)
              : null
          }
          seatCount={streamElection?.seat_count ?? null}
          choices={
            isCRToolbarActive
              ? selectedCRChoices
              : streamVote
                ? (streamVote.choices as ChoicesByVoteRow[]).map((choice: any) => ({
                    id: choice.id,
                    label:
                      choice.label ||
                      translateText('features.events.agenda.defaultChoiceLabels.choice'),
                    semanticKey: choice.semantic_key ?? null,
                  }))
                : undefined
          }
          tutorialAnchor={
            event?.tutorial_run_id
              ? streamElection
                ? 'agenda-election-vote'
                : 'agenda-amendment-vote'
              : undefined
          }
          requirePassword={!event?.tutorial_run_id}
          passwordError={passwordError}
          noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
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

        <NamedBallotResultsDialog
          open={namedResultsTarget !== null}
          onOpenChange={open => {
            if (!open) setNamedResultsTarget?.(null);
          }}
          title={
            streamIsTutorialElection && namedResultsTarget === 'election'
              ? tutorialElectionCopy.electionTitle
              : (namedResultsDialogConfig?.title ??
                t('features.events.agenda.namedResults.title', 'Named results'))
          }
          description={namedResultsDialogConfig?.description ?? ''}
          model={namedResultsDialogConfig?.model ?? null}
        />

        {streamAgendaItem ? (
          <EditElectionVoteDialog
            open={actionBarHook.editDialogOpen}
            onOpenChange={actionBarHook.setEditDialogOpen}
            agendaItemId={streamAgendaItem.id}
            agendaItemTitle={displayedStreamAgendaItem?.title ?? null}
            agendaItemDescription={displayedStreamAgendaItem?.description ?? null}
            agendaItemDuration={streamAgendaItem.duration ?? null}
            election={displayedStreamElection ?? undefined}
            vote={streamVote ?? undefined}
            choices={(streamVote?.choices ?? []).map((choice: any) => ({
              id: choice.id,
              label: choice.label,
              order_index: choice.order_index,
            }))}
          />
        ) : null}
      </AgendaPageShell>
    </div>
  );
}
