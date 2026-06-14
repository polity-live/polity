'use client';

import { featureThemeClassName } from '@/features/shared/theme';
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
  Check,
  ChevronDown,
  ChevronUp,
  Radio,
  Clock,
  Info,
  GripVertical,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
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
import { getAgendaDisplayTimes } from '../logic/getAgendaDisplayTimes';
import { getAgendaRuntimeStatus } from '../logic/getAgendaRuntimeStatus';
import { getAgendaDisplayType, getYouTubeVideoId } from '../logic/agendaUiHelpers';
import { getOfflineTallyDialogTitle, getOfflineTallyTooltip } from '../logic/offlineTallyToolbar';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
type EventAgendaItemRow = ReturnType<typeof useAgendaItems>['agendaItems'][number];
export interface EventAgendaViewProps {
  eventId: any;
  t: any;
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
  streamDetailsOpen: any;
  setStreamDetailsOpen: any;
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
  actionBarElection: any;
  actionBarCandidates: any;
  toolbarElection: any;
  streamVotingPhase: any;
  toolbarVotingPhase: any;
  synthesizedFinalVoteItem: any;
  effectiveFinalVoteItem: any;
  nextPendingCRItem: any;
  activeCRToolbarItem: any;
  isCRToolbarActive: any;
  selectedCRPhase: any;
  isSelectedCRFinalVote: any;
  hasUserVotedOnSelectedCR: any;
  selectedCRTitle: any;
  selectedCRChoices: any;
  selectedCRDialogPhase: any;
  streamForwardingPreview: any;
  effectiveToolbarVotingPhase: any;
  toolbarOfflineTallyPhaseSource: any;
  toolbarOfflineTallyPhase: any;
  toolbarOfflineTallyEntity: any;
  toolbarOfflineTallyMode: any;
  showOfflineTallyButton: any;
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
  handleToolbarStartVote: any;
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
  eventId,
  t,
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
  streamDetailsOpen,
  setStreamDetailsOpen,
  addingSpeaker,
  removingSpeaker,
  verifyVotingPassword,
  passwordError,
  setPasswordError,
  attendanceMode,
  disableVoteButton,
  confirmedOfflineParticipantCount,
  isPasswordVerifying,
  setIsPasswordVerifying,
  offlineTallyDialogOpen,
  offlineTallyPasswordError,
  offlineTallySubmitError,
  isOfflineTallySubmitting,
  canManageAgenda,
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
  toolbarElection,
  activeCRToolbarItem,
  isCRToolbarActive,
  selectedCRPhase,
  hasUserVotedOnSelectedCR,
  selectedCRTitle,
  selectedCRChoices,
  selectedCRDialogPhase,
  streamForwardingPreview,
  effectiveToolbarVotingPhase,
  toolbarOfflineTallyPhase,
  toolbarOfflineTallyEntity,
  toolbarOfflineTallyMode,
  showOfflineTallyButton,
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
  handleToolbarStartVote,
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
                className={cn(
                  'relative',
                  isSpotlightItem && isLiveItem ? 'animate-pulse-subtle' : '',
                  isCompleted ? 'opacity-70' : ''
                )}
              >
                {isCompleted && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div
                      className={featureThemeClassName('agendaEventAgendaSuccessContrastRoundIcon')}
                    >
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
                className={featureThemeClassName('agendaEventAgendaThemedPanel')}
              >
                <div className="flex items-center gap-2">
                  <Radio className={featureThemeClassName('agendaEventAgendaDangerIcon')} />
                  <CardTitle className="text-lg">
                    {t('features.events.stream.liveStream')}
                  </CardTitle>
                  {streamIsLive && (
                    <BadgeControl variant="default" pulse>
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
                          <Play className={featureThemeClassName('agendaEventAgendaThemedStyle')} />
                          {isEventStarted ? (
                            <div
                              className={featureThemeClassName('agendaEventAgendaSuccessPulseDot')}
                            />
                          ) : (
                            <div
                              className={featureThemeClassName('agendaEventAgendaWarningRoundIcon')}
                            />
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
                            <div
                              className={featureThemeClassName(
                                'agendaEventAgendaContrastBackground'
                              )}
                            >
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
                className={featureThemeClassName('agendaEventAgendaThemedPanel')}
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
                  <div className={featureThemeClassName('agendaEventAgendaAccentRoundIcon')}>
                    <Vote className={featureThemeClassName('agendaEventAgendaAccentIcon')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold md:text-2xl">
                      {agendaItems.filter((item: any) => item.election).length}
                    </p>
                    <p className="text-muted-foreground truncate text-xs md:text-sm">
                      {agendaItems.filter((item: any) => item.election).length === 1
                        ? t('features.events.agenda.election')
                        : t('features.events.agenda.elections')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                  <div className={featureThemeClassName('agendaEventAgendaWarningRoundIconAlpha')}>
                    <Gavel className={featureThemeClassName('agendaEventAgendaWarningIcon')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold md:text-2xl">
                      {agendaItems.filter((item: any) => item.amendment).length}
                    </p>
                    <p className="text-muted-foreground truncate text-xs md:text-sm">
                      {agendaItems.filter((item: any) => item.amendment).length === 1
                        ? t('features.events.agenda.amendment')
                        : t('features.events.agenda.amendments')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border p-2 md:gap-3 md:p-4">
                  <div className={featureThemeClassName('agendaEventAgendaInfoRoundIcon')}>
                    <FileText className={featureThemeClassName('agendaEventAgendaInfoIcon')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold md:text-2xl">
                      {agendaItems.reduce(
                        (count: number, item: any) =>
                          count +
                          (item.amendment?.change_requests?.filter(
                            (cr: any) => cr.status === 'open' || !cr.status
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
        <div className="space-y-6">
          {confirmedAgendaItems.length > 0 ? renderAgendaItemsList(confirmedAgendaItems) : null}

          {scheduledButUnconfirmedAgendaItems.length > 0 ? (
            <Card borderStyle="dashed">
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
              ? (streamElection.candidates as CandidatesByElectionRow[]).map((candidate: any) => ({
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
              ? (streamVote.choices as ChoicesByVoteRow[]).map((choice: any) => ({
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
