'use client';

import { useState } from 'react';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Dialog, DialogDescription, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { BadgeControl } from '@/features/shared/ui/status';
import { featureThemeClassName } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { AgendaCountdownPill, AgendaStatusBadge, AgendaTypeBadge } from './AgendaBadges';
import type { AgendaItemStatus } from './AgendaCard';
import { AgendaElectionSection, isAutoAssignedRoleElection } from './AgendaElectionSection';
import { AgendaVoteSection } from './AgendaVoteSection';
import { getAgendaDisplayType, getYouTubeVideoId } from '../logic/agendaUiHelpers';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import {
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock,
  Gavel,
  Mic,
  MicOff,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Users,
  Vote,
  X,
} from 'lucide-react';

interface EventLiveFocusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string, fallback?: string | Record<string, unknown>) => string;
  streamUrl?: string | null;
  currentAgendaItem: any;
  currentAgendaItemTopNumber?: number;
  streamRuntimeStatus?: string | null;
  streamIsLive: boolean;
  isEventStarted: boolean;
  eventStartTimestamp?: number | null;
  speakerList: any[];
  userId?: string;
  isUserInSpeakerList: boolean;
  speakerLoading?: boolean;
  onJoinSpeakerList?: () => void;
  onLeaveSpeakerList?: () => void;
  onMarkSpeakerCompleted?: (speakerId: string) => void;
  canManageAgenda: boolean;
  navigationLoading?: boolean;
  onStartVote?: () => void;
  onStartFinalVote?: () => void;
  onCloseFinalVote?: () => void;
  onCompleteItem?: () => void;
  completeItemDisabled?: boolean;
  onNextItem?: () => void;
  nextItemDisabled?: boolean;
  votingPhase?: string | null;
  isVotingActionAvailable?: boolean;
  canVote: boolean;
  hasUserVoted?: boolean;
  voteLoading?: boolean;
  disableVoteButton?: boolean;
  disabledVoteTooltip?: string | null;
  onVoteClick?: () => void;
  attendanceMode?: 'online' | 'hybrid' | 'offline' | null;
  confirmedOfflineParticipantCount?: number;
  streamElection?: any;
  streamVote?: any;
  streamDelegateTargetEvent?: any;
  streamForwardingPreview?: any;
  indicativeSelections: readonly any[];
  finalSelections: readonly any[];
  userHasElectionVoted: boolean;
  userSelectedCandidateIds: string[];
  indicativeDecisions: readonly any[];
  finalDecisions: readonly any[];
  userHasVoteVoted: boolean;
  userSelectedChoiceIds: string[];
}

type AgendaVisualStatus = AgendaItemStatus | 'active';

interface SpeakerFocusPanelProps {
  className?: string;
  t: (key: string, fallback?: string | Record<string, unknown>) => string;
  speakerList: any[];
  userId?: string;
  canManageAgenda: boolean;
  onMarkSpeakerCompleted?: (speakerId: string) => void;
  onCollapse?: () => void;
}

function getInitials(name?: string | null) {
  if (!name) return 'U';

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'U';
}

function getSpeakerName(speaker: any, fallback: string) {
  return speaker.user?.name || speaker.user?.email || speaker.title || fallback;
}

function canShowVotingAction(phase?: string | null) {
  return phase !== 'closed';
}

function getAgendaVisualStatus(status?: string | null, isLive?: boolean): AgendaVisualStatus {
  if (isLive) return 'active';

  if (
    status === 'completed' ||
    status === 'in-progress' ||
    status === 'pending' ||
    status === 'planned'
  ) {
    return status;
  }

  return 'planned';
}

function SpeakerFocusPanel({
  className,
  t,
  speakerList,
  userId,
  canManageAgenda,
  onMarkSpeakerCompleted,
  onCollapse,
}: SpeakerFocusPanelProps) {
  const activeSpeakers = [...speakerList]
    .filter(speaker => !speaker.completed)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const currentSpeaker = activeSpeakers[0] ?? null;
  const nextSpeakers = activeSpeakers.slice(1);
  const userSpeaker = activeSpeakers.find(speaker => speaker.user?.id === userId) ?? null;
  const userSpeakerPosition = userSpeaker
    ? activeSpeakers.findIndex(speaker => speaker.id === userSpeaker.id) + 1
    : null;

  return (
    <aside className={cn('bg-card rounded-lg border p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="text-primary h-5 w-5" />
          <h3 className="text-lg font-semibold">
            {t('features.events.agenda.speakerList')} ({activeSpeakers.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {userSpeakerPosition ? (
            <BadgeControl variant="secondary">Du: #{userSpeakerPosition}</BadgeControl>
          ) : null}
          {onCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 lg:inline-flex"
              onClick={onCollapse}
              aria-label={t('features.events.agenda.hideSpeakerList', 'Hide speaker list')}
              title={t('features.events.agenda.hideSpeakerList', 'Hide speaker list')}
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {currentSpeaker ? (
          <div className="border-primary/40 bg-primary/5 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 border">
                <AvatarImage src={currentSpeaker.user?.avatar} />
                <AvatarFallback>
                  {getInitials(getSpeakerName(currentSpeaker, t('common.unspecified')))}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <BadgeControl variant="default" size="xs">
                  {t('features.events.agenda.currentSpeaker', 'Current speaker')}
                </BadgeControl>
                <p className="mt-2 truncate text-lg font-semibold">
                  {getSpeakerName(currentSpeaker, t('common.unspecified'))}
                </p>
                <p className="text-muted-foreground text-sm">
                  {currentSpeaker.time ?? 3} {t('common.minutes')}
                </p>
              </div>
              {canManageAgenda && onMarkSpeakerCompleted ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onMarkSpeakerCompleted(currentSpeaker.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('features.events.agenda.completedSpeaker', 'Done')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            <Mic className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm">{t('features.events.agenda.speakerListEmpty')}</p>
          </div>
        )}

        {nextSpeakers.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase">Als Nächstes</p>
            {nextSpeakers.map((speaker, index) => {
              const speakerName = getSpeakerName(speaker, t('common.unspecified'));
              const isCurrentUser = speaker.user?.id === userId;

              return (
                <div
                  key={speaker.id}
                  className={cn(
                    'bg-background/70 flex items-center gap-3 rounded-md border p-3',
                    isCurrentUser && 'border-primary bg-primary/5'
                  )}
                >
                  <BadgeControl variant={isCurrentUser ? 'default' : 'outline'}>
                    #{index + 2}
                  </BadgeControl>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={speaker.user?.avatar} />
                    <AvatarFallback>{getInitials(speakerName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{speakerName}</p>
                    <p className="text-muted-foreground text-xs">
                      {speaker.time ?? 3} {t('common.minutes')}
                    </p>
                  </div>
                  {isCurrentUser ? (
                    <BadgeControl variant="secondary">
                      {translateText('generated.inline.0055_you_905cb326')}
                    </BadgeControl>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SpeakerFocusRail({
  activeSpeakersCount,
  onExpand,
  t,
}: {
  activeSpeakersCount: number;
  onExpand: () => void;
  t: (key: string, fallback?: string | Record<string, unknown>) => string;
}) {
  return (
    <aside className="bg-card hidden min-h-0 flex-col items-center gap-3 rounded-lg border p-2 shadow-sm lg:flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={onExpand}
        aria-label={t('features.events.agenda.showSpeakerList', 'Show speaker list')}
        title={t('features.events.agenda.showSpeakerList', 'Show speaker list')}
      >
        <PanelRightOpen className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={onExpand}
        className="hover:bg-accent focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-md px-2 py-3 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
        aria-label={t('features.events.agenda.showSpeakerList', 'Show speaker list')}
      >
        <Users className="text-primary h-5 w-5" />
        <span className="text-base leading-none font-semibold">{activeSpeakersCount}</span>
        <span className="text-muted-foreground text-[10px] leading-none font-medium uppercase">
          {t('features.events.agenda.speakerList')}
        </span>
      </button>
    </aside>
  );
}

export function EventLiveFocusDialog({
  open,
  onOpenChange,
  t,
  streamUrl,
  currentAgendaItem,
  currentAgendaItemTopNumber,
  streamRuntimeStatus,
  streamIsLive,
  isEventStarted,
  eventStartTimestamp,
  speakerList,
  userId,
  isUserInSpeakerList,
  speakerLoading,
  onJoinSpeakerList,
  onLeaveSpeakerList,
  onMarkSpeakerCompleted,
  canManageAgenda,
  navigationLoading,
  onStartVote,
  onStartFinalVote,
  onCloseFinalVote,
  onCompleteItem,
  completeItemDisabled,
  onNextItem,
  nextItemDisabled,
  votingPhase,
  isVotingActionAvailable,
  canVote,
  hasUserVoted,
  voteLoading,
  disableVoteButton,
  disabledVoteTooltip,
  onVoteClick,
  attendanceMode,
  confirmedOfflineParticipantCount = 0,
  streamElection,
  streamVote,
  streamDelegateTargetEvent,
  streamForwardingPreview,
  indicativeSelections,
  finalSelections,
  userHasElectionVoted,
  userSelectedCandidateIds,
  indicativeDecisions,
  finalDecisions,
  userHasVoteVoted,
  userSelectedChoiceIds,
}: EventLiveFocusDialogProps) {
  const [desktopSpeakersOpen, setDesktopSpeakersOpen] = useState(true);
  const agendaTitle = currentAgendaItem?.title || t('features.events.stream.noActiveItem');
  const topLabel =
    typeof currentAgendaItemTopNumber === 'number' ? `TOP-${currentAgendaItemTopNumber}` : null;
  const isElectionItem = currentAgendaItem?.type === 'election' || Boolean(streamElection);
  const isVoteItem =
    currentAgendaItem?.type === 'amendment' ||
    currentAgendaItem?.type === 'vote' ||
    Boolean(streamVote);
  const isVotable = Boolean(isVotingActionAvailable) || isElectionItem || isVoteItem;
  const showVoteButton = isVotable && canShowVotingAction(votingPhase) && Boolean(onVoteClick);
  const showVotedState =
    isVotable && canVote && canShowVotingAction(votingPhase) && hasUserVoted && !onVoteClick;
  const isVoteActionBlocked = !canVote || Boolean(disableVoteButton);
  const voteBlockedReason = !canVote
    ? t(
        'features.events.agenda.actions.voteRequiresActiveVotingRight',
        'Active Voting Rights are required to vote in this event.'
      )
    : (disabledVoteTooltip ??
      t(
        'generated.inline.0005_offline_votes_are_entered_via_tallies_0ab8a792',
        'Offline votes are entered via tallies.'
      ));
  const videoId = isEventStarted && streamUrl ? getYouTubeVideoId(streamUrl) : null;
  const visualStatus = getAgendaVisualStatus(streamRuntimeStatus, streamIsLive);
  const activeSpeakersCount = speakerList.filter(speaker => !speaker.completed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        showCloseButton={false}
        className="bg-background !fixed !top-0 !left-0 !z-[100] flex !h-[100dvh] !max-h-[100dvh] !w-[100dvw] !max-w-[100dvw] !translate-x-0 !translate-y-0 flex-col !overflow-hidden !rounded-none !border-0 !p-0"
      >
        <DialogTitle className="sr-only">
          {t('features.events.stream.liveFocus', 'Live-Fokus')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t(
            'features.events.stream.liveFocusDescription',
            'Current agenda item, speaker list, voting actions and event controls.'
          )}
        </DialogDescription>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background/90 absolute top-3 right-3 z-20 h-9 w-9 shadow-sm backdrop-blur"
          onClick={() => onOpenChange(false)}
          aria-label={t('common.actions.close', 'Close')}
          title={t('common.actions.close', 'Close')}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex-1 overflow-y-auto lg:overflow-hidden">
          <div
            className={cn(
              'grid min-h-full gap-4 p-4 lg:h-full lg:p-6',
              desktopSpeakersOpen
                ? 'lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'
                : 'lg:grid-cols-[minmax(0,1fr)_72px]'
            )}
          >
            <section className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              {!currentAgendaItem ? (
                <div className="flex min-h-[45vh] items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <div className="space-y-3">
                    <Play className="text-muted-foreground mx-auto h-10 w-10" />
                    <h2 className="text-2xl font-semibold">
                      {t('features.events.stream.noActiveItem')}
                    </h2>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-card rounded-lg border p-4 shadow-sm md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {topLabel ? (
                            <BadgeControl variant="outline">{topLabel}</BadgeControl>
                          ) : null}
                          <AgendaStatusBadge status={visualStatus} />
                          <AgendaTypeBadge type={getAgendaDisplayType(currentAgendaItem.type)} />
                          {currentAgendaItem.duration ? (
                            <BadgeControl variant="outline">
                              <Clock className="mr-1 h-3 w-3" />
                              {currentAgendaItem.duration}
                              {translateText('generated.inline.0009_min_b6c935d4')}
                            </BadgeControl>
                          ) : null}
                          {!streamIsLive && eventStartTimestamp != null ? (
                            <AgendaCountdownPill
                              label={t('features.events.stream.startsIn')}
                              endsAt={new Date(eventStartTimestamp)}
                              tone="start"
                            />
                          ) : null}
                        </div>

                        <h2 className="mt-4 text-2xl leading-tight font-semibold md:text-4xl">
                          {agendaTitle}
                        </h2>
                      </div>
                    </div>

                    {currentAgendaItem.description ? (
                      <p className="text-muted-foreground mt-4 whitespace-pre-wrap md:text-lg">
                        {currentAgendaItem.description}
                      </p>
                    ) : null}
                  </div>

                  <SpeakerFocusPanel
                    className="lg:hidden"
                    t={t}
                    speakerList={speakerList}
                    userId={userId}
                    canManageAgenda={canManageAgenda}
                    onMarkSpeakerCompleted={onMarkSpeakerCompleted}
                  />

                  {videoId ? (
                    <div className={featureThemeClassName('agendaEventAgendaContrastBackground')}>
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
                  ) : null}

                  {streamElection ? (
                    <AgendaElectionSection
                      className="shadow-sm"
                      roleName={streamElection.title ?? t('features.events.agenda.role')}
                      electionMode={
                        streamElection.election_mode
                          ? normalizeElectionMode(streamElection.election_mode)
                          : null
                      }
                      seatCount={streamElection.seat_count ?? null}
                      candidates={streamElection.candidates ?? []}
                      indicativeSelections={indicativeSelections}
                      finalSelections={finalSelections}
                      offlineTallies={streamElection.offline_tallies ?? []}
                      attendanceMode={attendanceMode}
                      delegateTargetEventId={
                        streamDelegateTargetEvent?.id ??
                        (
                          streamElection as {
                            delegate_assignment_meta?: { targetEventId?: string } | null;
                          }
                        ).delegate_assignment_meta?.targetEventId
                      }
                      delegateTargetEventTitle={streamDelegateTargetEvent?.title ?? null}
                      showRoleAssignedMessage={isAutoAssignedRoleElection(streamElection)}
                      userHasVoted={userHasElectionVoted}
                      userSelectedCandidateIds={userSelectedCandidateIds}
                      electionStatus={streamElection.status}
                      canVote={false}
                      canBeCandidate={false}
                      isUserCandidate={false}
                      onBecomeCandidate={() => undefined}
                    />
                  ) : null}

                  {streamVote ? (
                    <AgendaVoteSection
                      className="shadow-sm"
                      voteId={streamVote.id}
                      voteTitle={streamVote.title || currentAgendaItem.title || 'Vote'}
                      choices={streamVote.choices ?? []}
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
                      forwardingPreview={streamForwardingPreview}
                    />
                  ) : null}
                </>
              )}
            </section>

            <SpeakerFocusPanel
              className={cn(
                'hidden lg:min-h-0 lg:overflow-y-auto',
                desktopSpeakersOpen ? 'lg:block' : 'lg:hidden'
              )}
              t={t}
              speakerList={speakerList}
              userId={userId}
              canManageAgenda={canManageAgenda}
              onMarkSpeakerCompleted={onMarkSpeakerCompleted}
              onCollapse={() => setDesktopSpeakersOpen(false)}
            />
            {!desktopSpeakersOpen ? (
              <SpeakerFocusRail
                activeSpeakersCount={activeSpeakersCount}
                onExpand={() => setDesktopSpeakersOpen(true)}
                t={t}
              />
            ) : null}
          </div>
        </div>

        <footer className="bg-background/95 shrink-0 border-t p-3 backdrop-blur md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {showVoteButton ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={isVoteActionBlocked ? undefined : onVoteClick}
                  disabled={voteLoading}
                  loading={voteLoading}
                  aria-disabled={isVoteActionBlocked || undefined}
                  title={isVoteActionBlocked ? voteBlockedReason : undefined}
                  className={cn(
                    'civic-ballot-submit',
                    'bg-background min-w-[160px] border px-3 font-semibold shadow-sm transition-all',
                    isVoteActionBlocked
                      ? 'border-muted-foreground/30 text-muted-foreground opacity-70'
                      : featureThemeClassName('agendaAgendaActionBarAccentBadge')
                  )}
                >
                  <Vote className="h-4 w-4" />
                  <span>{translateText('generated.inline.0011_vote_64f87291')}</span>
                  {isVoteActionBlocked ? <CircleHelp className="h-4 w-4" /> : null}
                </Button>
              ) : showVotedState ? (
                <BadgeControl variant="secondary" className="justify-center px-4 py-2">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Stimme abgegeben
                </BadgeControl>
              ) : null}

              {currentAgendaItem && !isUserInSpeakerList && onJoinSpeakerList ? (
                <Button
                  type="button"
                  variant={showVoteButton ? 'outline' : 'default'}
                  size="lg"
                  onClick={onJoinSpeakerList}
                  disabled={!userId || speakerLoading}
                  loading={speakerLoading}
                >
                  <Mic className="h-4 w-4" />
                  {t('features.events.agenda.actions.joinSpeakerList')}
                </Button>
              ) : null}

              {currentAgendaItem && isUserInSpeakerList && onLeaveSpeakerList ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onLeaveSpeakerList}
                  disabled={speakerLoading}
                  loading={speakerLoading}
                >
                  <MicOff className="h-4 w-4" />
                  {t('features.events.agenda.actions.leaveSpeakerList')}
                </Button>
              ) : null}

              {isVoteActionBlocked && isVotable ? (
                <p className="text-muted-foreground text-sm">{voteBlockedReason}</p>
              ) : null}
            </div>

            {canManageAgenda ? (
              <div className="flex flex-wrap items-center gap-2">
                {onStartVote ? (
                  <Button type="button" variant="outline" onClick={onStartVote}>
                    <Play className="h-4 w-4" />
                    {t('features.events.agenda.actions.startVote')}
                  </Button>
                ) : null}
                {onStartFinalVote ? (
                  <Button type="button" variant="outline" onClick={onStartFinalVote}>
                    <Gavel className="h-4 w-4" />
                    {t('features.events.agenda.actions.startFinalVote')}
                  </Button>
                ) : null}
                {onCloseFinalVote ? (
                  <Button type="button" variant="outline" onClick={onCloseFinalVote}>
                    <CheckCircle2 className="h-4 w-4" />
                    {t('features.events.agenda.actions.closeFinalVote')}
                  </Button>
                ) : null}
                {onCompleteItem ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCompleteItem}
                    disabled={completeItemDisabled || navigationLoading}
                    loading={navigationLoading}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    TOP schließen
                  </Button>
                ) : null}
                {onNextItem ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onNextItem}
                    disabled={nextItemDisabled || navigationLoading}
                    loading={navigationLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                    Nächster TOP
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </footer>
      </ScrollableDialogContent>
    </Dialog>
  );
}
