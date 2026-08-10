'use client';

import { useState, type ReactNode } from 'react';
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
import { getAgendaDisplayType } from '../logic/agendaUiHelpers';
import { EventLivestreamPlayer } from '@/features/events/ui/EventLivestreamPlayer';
import { getSpeakerGenderLabel } from '../logic/speakerListGenderQuota';
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
  FileEdit,
  PencilLine,
  Play,
  Radio,
  UserMinus,
  UserPlus,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { AgendaDialogContent } from './AgendaUiSystem';

interface EventLiveFocusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string, fallback?: string | Record<string, unknown>) => string;
  streamUrl?: string | null;
  currentAgendaItem: any;
  currentAgendaItemTopNumber?: number;
  streamRuntimeStatus?: string | null;
  streamIsLive: boolean;
  eventStartTimestamp?: number | null;
  speakerList: any[];
  showSpeakerGender?: boolean;
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
  onJumpToNextVoteStep?: () => void;
  onEditItem?: () => void;
  startVoteLabel?: string | null;
  startFinalVoteLabel?: string | null;
  closeFinalVoteLabel?: string | null;
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
  showOfflineTallyButton?: boolean;
  onOfflineTallyClick?: () => void;
  offlineTallyMode?: 'create' | 'edit' | null;
  offlineTallyLabel?: string | null;
  canBeCandidate?: boolean;
  isUserCandidate?: boolean;
  candidateLoading?: boolean;
  onBecomeCandidate?: () => void;
  onWithdrawCandidacy?: () => void;
  attendanceMode?: 'online' | 'hybrid' | 'offline' | null;
  confirmedOfflineParticipantCount?: number;
  eligibleFinalVoterCount?: number;
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
  votingWorkspace?: ReactNode;
}

type AgendaVisualStatus = AgendaItemStatus | 'active';

interface SpeakerFocusPanelProps {
  className?: string;
  t: (key: string, fallback?: string | Record<string, unknown>) => string;
  speakerList: any[];
  showGender?: boolean;
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

function formatGenderBadgeLabel(
  t: (key: string, fallback?: string | Record<string, unknown>) => string,
  gender?: string | null
) {
  const labelKey =
    gender === 'male'
      ? 'male'
      : gender === 'female'
        ? 'female'
        : gender === 'diverse'
          ? 'diverse'
          : 'unspecified';

  return t(
    `features.events.agenda.genderQuota.genderLabels.${labelKey}`,
    getSpeakerGenderLabel(gender)
  );
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

const ignoreCandidateAction = () => undefined;

export const eventLiveFocusDialogTestApi = {
  canShowVotingAction,
  formatGenderBadgeLabel,
  getAgendaVisualStatus,
  getInitials,
  getSpeakerName,
  ignoreCandidateAction,
};

function SpeakerFocusPanel({
  className,
  t,
  speakerList,
  showGender,
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
            <BadgeControl variant="secondary">
              {t('features.events.agenda.youSpeakerPosition', {
                position: userSpeakerPosition,
              })}
            </BadgeControl>
          ) : null}
          {onCollapse ? (
            <Button
              data-action-id="agendas.live-focus.speakers.collapse"
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
                {showGender ? (
                  <BadgeControl variant="outline" size="xs" className="ml-2">
                    {formatGenderBadgeLabel(t, currentSpeaker.user?.gender)}
                  </BadgeControl>
                ) : null}
                <p className="mt-2 truncate text-lg font-semibold">
                  {getSpeakerName(currentSpeaker, t('common.unspecified'))}
                </p>
                <p className="text-muted-foreground text-sm">
                  {currentSpeaker.time ?? 3} {t('common.minutes')}
                </p>
              </div>
              {canManageAgenda && onMarkSpeakerCompleted ? (
                <Button
                  data-action-id="agendas.live-focus.speaker.complete"
                  data-action-kind="async-action"
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
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('features.events.agenda.upNext')}
            </p>
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
                  {showGender ? (
                    <BadgeControl variant="outline">
                      {formatGenderBadgeLabel(t, speaker.user?.gender)}
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
        data-action-id="agendas.live-focus.speakers.expand"
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
        data-action-id="agendas.live-focus.speakers.expand"
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
  eventStartTimestamp,
  speakerList,
  showSpeakerGender,
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
  onJumpToNextVoteStep,
  onEditItem,
  startVoteLabel,
  startFinalVoteLabel,
  closeFinalVoteLabel,
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
  showOfflineTallyButton = false,
  onOfflineTallyClick,
  offlineTallyMode,
  offlineTallyLabel,
  canBeCandidate = false,
  isUserCandidate = false,
  candidateLoading = false,
  onBecomeCandidate,
  onWithdrawCandidacy,
  attendanceMode,
  confirmedOfflineParticipantCount = 0,
  eligibleFinalVoterCount,
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
  votingWorkspace,
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
  const visualStatus = getAgendaVisualStatus(streamRuntimeStatus, streamIsLive);
  const activeSpeakersCount = speakerList.filter(speaker => !speaker.completed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AgendaDialogContent size="fullscreen" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('features.events.stream.liveFocus')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('features.events.stream.liveFocusDescription')}
        </DialogDescription>

        <header className="bg-background/95 border-border/70 flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Radio className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">
                  {t('features.events.stream.liveFocus')}
                </p>
                {streamIsLive ? (
                  <BadgeControl variant="default" pulse>
                    {t('features.events.stream.live', 'LIVE')}
                  </BadgeControl>
                ) : null}
              </div>
              <p className="text-muted-foreground truncate text-xs">{agendaTitle}</p>
            </div>
          </div>
          <Button
            data-action-id="agendas.live-focus.dialog.close"
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.actions.close', 'Close')}
            title={t('common.actions.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="bg-muted/10 flex-1 overflow-y-auto lg:overflow-hidden">
          <div
            className={cn(
              'mx-auto grid min-h-full w-full max-w-[1600px] gap-4 p-4 lg:h-full lg:p-5',
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
                  <div className="bg-card/80 border-border/70 rounded-xl border p-4 shadow-none md:p-5">
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
                    showGender={showSpeakerGender}
                    userId={userId}
                    canManageAgenda={canManageAgenda}
                    onMarkSpeakerCompleted={onMarkSpeakerCompleted}
                  />

                  {streamIsLive ? (
                    <EventLivestreamPlayer
                      streamUrl={streamUrl}
                      title={t('features.events.stream.liveStream')}
                      containerClassName={featureThemeClassName(
                        'agendaEventAgendaContrastBackground'
                      )}
                    />
                  ) : null}

                  {votingWorkspace ??
                    (streamElection ? (
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
                        onBecomeCandidate={ignoreCandidateAction}
                      />
                    ) : null)}

                  {!votingWorkspace && streamVote ? (
                    <AgendaVoteSection
                      className="shadow-sm"
                      voteId={streamVote.id}
                      voteTitle={
                        streamVote.title ||
                        currentAgendaItem.title ||
                        t('features.events.agenda.vote')
                      }
                      choices={streamVote.choices ?? []}
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
              showGender={showSpeakerGender}
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

        <footer className="bg-background/95 border-border/70 shrink-0 border-t p-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {showVoteButton ? (
                <Button
                  data-action-id="agendas.live-focus.ballot.cast"
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
                  {t('features.events.agenda.voteSubmitted')}
                </BadgeControl>
              ) : null}

              {currentAgendaItem && !isUserInSpeakerList && onJoinSpeakerList ? (
                <Button
                  data-action-id="agendas.live-focus.speaker.join"
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
                  data-action-id="agendas.live-focus.speaker.leave"
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

              {isElectionItem && !isUserCandidate && onBecomeCandidate ? (
                <Button
                  data-action-id="agendas.live-focus.candidacy.become"
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={canBeCandidate ? onBecomeCandidate : undefined}
                  disabled={candidateLoading}
                  loading={candidateLoading}
                  aria-disabled={!canBeCandidate || undefined}
                >
                  <UserPlus className="h-4 w-4" />
                  {t('features.events.agenda.actions.becomeCandidate')}
                </Button>
              ) : null}

              {isElectionItem && isUserCandidate && onWithdrawCandidacy ? (
                <Button
                  data-action-id="agendas.live-focus.candidacy.withdraw"
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onWithdrawCandidacy}
                  disabled={candidateLoading}
                  loading={candidateLoading}
                >
                  <UserMinus className="h-4 w-4" />
                  {t('features.events.agenda.actions.withdrawCandidacy')}
                </Button>
              ) : null}

              {isVoteActionBlocked && isVotable ? (
                <p className="text-muted-foreground text-sm">{voteBlockedReason}</p>
              ) : null}
            </div>

            {canManageAgenda ? (
              <div className="flex flex-wrap items-center gap-2">
                {showOfflineTallyButton || onOfflineTallyClick ? (
                  <Button
                    data-action-id="agendas.live-focus.offline-tally.open"
                    data-action-kind="interaction"
                    type="button"
                    variant="outline"
                    onClick={onOfflineTallyClick}
                    disabled={!onOfflineTallyClick}
                    title={offlineTallyLabel ?? undefined}
                  >
                    {offlineTallyMode === 'edit' ? (
                      <PencilLine className="h-4 w-4" />
                    ) : (
                      <FileEdit className="h-4 w-4" />
                    )}
                    {offlineTallyLabel ?? t('features.events.agenda.manageOfflineTally')}
                  </Button>
                ) : null}
                {onJumpToNextVoteStep ? (
                  <Button
                    data-action-id="agendas.live-focus.vote-step.next"
                    type="button"
                    variant="outline"
                    onClick={onJumpToNextVoteStep}
                    disabled={voteLoading}
                    loading={voteLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                    {t('features.agendas.crTimeline.nextVotingStep', 'Next voting step')}
                  </Button>
                ) : null}
                {onStartVote ? (
                  <Button
                    data-action-id="agendas.live-focus.vote.start"
                    data-action-kind="async-action"
                    type="button"
                    variant="outline"
                    onClick={onStartVote}
                  >
                    <Play className="h-4 w-4" />
                    {startVoteLabel ?? t('features.events.agenda.actions.startVote')}
                  </Button>
                ) : null}
                {onStartFinalVote ? (
                  <Button
                    data-action-id="agendas.live-focus.vote.start-final"
                    data-action-kind="async-action"
                    type="button"
                    variant="outline"
                    onClick={onStartFinalVote}
                  >
                    <Gavel className="h-4 w-4" />
                    {startFinalVoteLabel ?? t('features.events.agenda.actions.startFinalVote')}
                  </Button>
                ) : null}
                {onCloseFinalVote ? (
                  <Button
                    data-action-id="agendas.live-focus.vote.close-final"
                    data-action-kind="async-action"
                    type="button"
                    variant="outline"
                    onClick={onCloseFinalVote}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {closeFinalVoteLabel ?? t('features.events.agenda.actions.closeFinalVote')}
                  </Button>
                ) : null}
                {onEditItem ? (
                  <Button
                    data-action-id="agendas.live-focus.item.edit"
                    type="button"
                    variant="outline"
                    onClick={onEditItem}
                  >
                    <PencilLine className="h-4 w-4" />
                    {t('common.actions.edit', 'Edit')}
                  </Button>
                ) : null}
                {onCompleteItem ? (
                  <Button
                    data-action-id="agendas.live-focus.item.complete"
                    type="button"
                    variant="outline"
                    onClick={onCompleteItem}
                    disabled={completeItemDisabled || navigationLoading}
                    loading={navigationLoading}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('features.events.agenda.completeCurrentItem')}
                  </Button>
                ) : null}
                {onNextItem ? (
                  <Button
                    data-action-id="agendas.live-focus.item.next"
                    type="button"
                    variant="outline"
                    onClick={onNextItem}
                    disabled={nextItemDisabled || navigationLoading}
                    loading={navigationLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                    {t('features.events.agenda.nextAgendaItem')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </footer>
      </AgendaDialogContent>
    </Dialog>
  );
}
