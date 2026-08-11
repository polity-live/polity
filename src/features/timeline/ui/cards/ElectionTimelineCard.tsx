'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Award, Users, Calendar, Crown, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardActionButton,
} from './TimelineCardBase';

export interface ElectionCandidate {
  id: string;
  name: string;
  avatarUrl?: string;
  votePercentage?: number;
  voteCount?: number;
  // Indication support
  indicationPercentage?: number;
  indicationCount?: number;
}

export interface ElectionTimelineCardProps {
  election: {
    id: string;
    title: string;
    roleName: string;
    groupId?: string;
    groupName?: string;
    status: 'nominations_open' | 'voting_open' | 'closed' | 'winner_announced';
    nominationsEndDate?: string | Date;
    votingEndDate?: string | Date;
    candidates: ElectionCandidate[];
    winnerId?: string;
    winnerName?: string;
    winnerAvatarUrl?: string;
    winnerVotePercentage?: number;
    totalCandidates: number;
    totalVoters?: number;
    turnoutPercentage?: number;
    agendaEventId?: string;
    agendaItemId?: string;
    // Indication support
    isIndicationPhase?: boolean;
  };
  onCastVote?: () => void;
  onNominate?: () => void;
  onViewCandidates?: () => void;
  onViewResults?: () => void;
  href?: string;
  className?: string;
}

/**
 * Status configuration for election cards
 */
const STATUS_CONFIG: Record<
  string,
  { color: string; bgColor: string; icon: React.ReactNode; pulse?: boolean }
> = {
  nominations_open: {
    color: featureThemeClassName('decisionterminalDecisionStatusSuccessText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardSuccessBackground'),
    icon: <Users className="h-3 w-3" />,
  },
  voting_open: {
    color: featureThemeClassName('decisionterminalDecisionSummaryInfoText'),
    bgColor: featureThemeClassName('timelineActionTimelineCardInfoBackground'),
    icon: <Award className="h-3 w-3" />,
    pulse: true,
  },
  closed: {
    color: featureThemeClassName('decisionterminalDecisionStatusNeutralText'),
    bgColor: featureThemeClassName('timelineElectionTimelineCardNeutralBackground'),
    icon: <Calendar className="h-3 w-3" />,
  },
  winner_announced: {
    color: featureThemeClassName('decisionterminalCountdownTimerWarningText'),
    bgColor: featureThemeClassName('timelineActionTimelineCardWarningBackground'),
    icon: <Trophy className="h-3 w-3" />,
  },
};

/**
 * Format date for display
 */
export function formatElectionDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get initials from name
 */
export function getElectionInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function normalizeElectionPercent(percent: number | null | undefined) {
  if (!Number.isFinite(percent ?? 0)) {
    return 0;
  }

  return Math.max(0, Math.min(100, percent ?? 0));
}

export function formatElectionCountPercent(
  count: number | null | undefined,
  percent: number | null | undefined
) {
  return `${Math.round(count ?? 0)} · ${normalizeElectionPercent(percent).toFixed(0)}%`;
}

/**
 * Election phase type
 */
type ElectionPhase = 'nomination' | 'voting' | 'results';

/**
 * Get current phase from status
 */
export function getElectionCurrentPhase(status: string): ElectionPhase {
  if (status === 'nominations_open') return 'nomination';
  if (status === 'voting_open') return 'voting';
  return 'results';
}

/**
 * Phase timeline indicator component
 */
function PhaseTimeline({ currentPhase }: { currentPhase: ElectionPhase }) {
  const { t } = useTranslation();
  const phases: { key: ElectionPhase; label: string }[] = [
    { key: 'nomination', label: t('features.timeline.cards.election.phases.nomination') },
    { key: 'voting', label: t('features.timeline.cards.election.phases.voting') },
    { key: 'results', label: t('features.timeline.cards.election.phases.results') },
  ];

  const currentIndex = phases.findIndex(p => p.key === currentPhase);

  return (
    <div className="mt-3 flex items-center justify-center gap-1">
      {phases.map((phase, index) => (
        <div key={phase.key} className="flex items-center gap-1">
          <div
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              index < currentIndex
                ? featureThemeClassName('timelineElectionTimelineCardDangerBackground')
                : index === currentIndex
                  ? featureThemeClassName('timelineElectionTimelineCardDangerBackgroundAlpha')
                  : featureThemeClassName('timelineElectionTimelineCardNeutralBackgroundAlpha')
            )}
          />
          {index < phases.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-4',
                index < currentIndex
                  ? featureThemeClassName('timelineElectionTimelineCardDangerBackground')
                  : featureThemeClassName('timelineElectionTimelineCardNeutralBackgroundAlpha')
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Candidate avatars row component
 */
function CandidateAvatars({
  candidates,
  maxDisplay = 5,
  winnerId,
  winnerName,
  isIndicationPhase,
}: {
  candidates: ElectionCandidate[];
  maxDisplay?: number;
  winnerId?: string;
  winnerName?: string;
  isIndicationPhase?: boolean;
}) {
  const { t } = useTranslation();
  const [showIndicationResults, setShowIndicationResults] = useState(false);
  const displayCandidates = candidates.slice(0, maxDisplay);
  const remaining = candidates.length - maxDisplay;

  const hasIndication = displayCandidates.some(
    c => c.indicationCount !== undefined || c.indicationPercentage !== undefined
  );
  const hasFinalVotes = displayCandidates.some(
    c => (c.voteCount ?? 0) > 0 || (c.votePercentage ?? 0) > 0
  );
  const canToggleIndicationResults = !isIndicationPhase && hasFinalVotes && hasIndication;

  return (
    <div className="space-y-2">
      {canToggleIndicationResults ? (
        <div className="flex justify-end">
          <BadgeControl asChild variant={showIndicationResults ? 'secondary' : 'outline'} size="xs">
            <button
              data-action-id="timeline.election.indication-results.toggle"
              data-action-kind="selection"
              type="button"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                setShowIndicationResults(current => !current);
              }}
            >
              {showIndicationResults
                ? t('features.events.agenda.hideIndicationResults', 'Hide indication results')
                : t('features.events.agenda.showIndicationResults', 'Show indication results')}
            </button>
          </BadgeControl>
        </div>
      ) : null}
      {displayCandidates.map(candidate => {
        const visiblePercentage =
          isIndicationPhase && candidate.indicationPercentage !== undefined
            ? candidate.indicationPercentage
            : (candidate.votePercentage ?? candidate.indicationPercentage ?? 0);
        const visibleCount =
          isIndicationPhase && candidate.indicationCount !== undefined
            ? candidate.indicationCount
            : (candidate.voteCount ?? candidate.indicationCount);
        const isWinner =
          (winnerId !== undefined && candidate.id === winnerId) ||
          (winnerId === undefined && winnerName !== undefined && candidate.name === winnerName);

        return (
          <div
            key={candidate.id}
            className={cn(
              'bg-card space-y-2 rounded-lg border px-3 py-2 shadow-sm transition-[background-color,border-color,box-shadow]',
              isWinner && featureThemeClassName('timelineElectionTimelineCardWarningRing')
            )}
            data-election-candidate-row="true"
            data-winner={isWinner ? 'true' : undefined}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0 rounded-md">
                <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                <AvatarFallback
                  className={cn(
                    'rounded-md text-xs font-semibold',
                    featureThemeClassName('timelineElectionTimelineCardDangerBackgroundBeta')
                  )}
                >
                  {getElectionInitials(candidate.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                  <span className="truncate font-medium">{candidate.name}</span>
                  {isWinner ? (
                    <BadgeControl tone="warning" size="tiny" className="gap-1">
                      <Crown className="h-3 w-3" />
                      {t('features.timeline.cards.election.winnerAnnounced')}
                    </BadgeControl>
                  ) : null}
                </div>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatElectionCountPercent(visibleCount, visiblePercentage)}
              </span>
            </div>
            <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', isWinner ? 'bg-brand' : 'bg-brand/70')}
                style={{ width: `${Math.max(0, Math.min(100, visiblePercentage))}%` }}
              />
            </div>
            {canToggleIndicationResults && showIndicationResults ? (
              <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2">
                <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  {t('features.events.agenda.indicationShort', 'IND')}
                </span>
                <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-brand/35 h-full rounded-full"
                    style={{
                      width: `${normalizeElectionPercent(candidate.indicationPercentage)}%`,
                    }}
                  />
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatElectionCountPercent(
                    candidate.indicationCount,
                    candidate.indicationPercentage
                  )}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
      {remaining > 0 ? (
        <div className="text-muted-foreground bg-muted/20 rounded-md border px-3 py-2 text-center text-xs">
          +{remaining}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Winner display component
 */
function WinnerDisplay({
  name,
  avatarUrl,
  votePercentage,
  roleName,
}: {
  name: string;
  avatarUrl?: string;
  votePercentage?: number;
  roleName: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-card rounded-lg border p-4 text-center shadow-sm">
      <div className="text-muted-foreground text-sm font-medium">
        {t('features.timeline.cards.election.winnerAnnounced')}
      </div>
      <div className="relative mx-auto mt-2 w-fit">
        <Avatar className={featureThemeClassName('timelineElectionTimelineCardWarningBorder')}>
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback
            className={featureThemeClassName('timelineElectionTimelineCardDangerBackgroundGamma')}
          >
            {getElectionInitials(name)}
          </AvatarFallback>
        </Avatar>
        <Crown
          className={featureThemeClassName('timelineElectionTimelineCardWarningNeutralIconAlpha')}
        />
      </div>
      <div className="mt-2">
        <div className="font-semibold">{name}</div>
        <div className="text-muted-foreground text-sm">{roleName}</div>
        {votePercentage !== undefined && (
          <div className={featureThemeClassName('timelineElectionTimelineCardWarningText')}>
            {votePercentage}% {t('features.timeline.cards.election.ofVotes')}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ElectionTimelineCard - Leadership Election card
 *
 * Displays an election with:
 * - Rose-pink gradient header
 * - Status badge (nominations open, voting, closed, winner)
 * - Role and group context
 * - Candidate avatars with winner highlight
 * - Phase timeline indicator
 * - Stats (candidates, voters, turnout)
 * - Action buttons based on status
 */
export function ElectionTimelineCard({
  election,
  onCastVote,
  onNominate,
  onViewCandidates,
  onViewResults,
  href,
  className,
}: ElectionTimelineCardProps) {
  const { t } = useTranslation();
  const statusConfig = STATUS_CONFIG[election.status] ?? STATUS_CONFIG.closed;
  const currentPhase = getElectionCurrentPhase(election.status);
  const isWinnerAnnounced = election.status === 'winner_announced';
  const isVotingOpen = election.status === 'voting_open';
  const isNominationsOpen = election.status === 'nominations_open';

  const agendaHref =
    election.agendaEventId && election.agendaItemId
      ? `/event/${election.agendaEventId}/agenda/${election.agendaItemId}`
      : undefined;
  const fallbackHref = election.groupId ? `/group/${election.groupId}` : undefined;
  const electionHref = href ?? agendaHref ?? fallbackHref;
  // Get status label
  const getStatusLabel = () => {
    switch (election.status) {
      case 'nominations_open':
        return t('features.timeline.cards.election.status.nominationsOpen');
      case 'voting_open':
        return t('features.timeline.cards.election.status.votingOpen');
      case 'closed':
        return t('features.timeline.cards.election.status.closed');
      case 'winner_announced':
        return t('features.timeline.cards.election.status.elected');
      default:
        return '';
    }
  };

  // Get date display text
  const getDateText = () => {
    if (isNominationsOpen && election.nominationsEndDate) {
      return `${t('features.timeline.cards.election.submitBy')} ${formatElectionDate(election.nominationsEndDate)}`;
    }
    if (isVotingOpen && election.votingEndDate) {
      return `${t('features.timeline.cards.election.endsOn')} ${formatElectionDate(election.votingEndDate)}`;
    }
    return null;
  };

  const dateText = getDateText();

  return (
    <TimelineCardBase contentType="election" className={className} href={electionHref}>
      <TimelineCardHeader
        contentType="election"
        title={election.title}
        href={electionHref}
        subtitle={election.groupName}
        subtitleHref={election.groupId ? `/group/${election.groupId}` : undefined}
        badge={
          <BadgeControl
            variant="outline"
            className={cn(
              'flex items-center gap-1 text-xs',
              statusConfig.bgColor,
              statusConfig.color,
              statusConfig.pulse && 'animate-pulse'
            )}
          >
            {statusConfig.icon}
            {getStatusLabel()}
          </BadgeControl>
        }
      >
        {dateText && (
          <div className="text-muted-foreground mt-2 text-center text-xs">{dateText}</div>
        )}
      </TimelineCardHeader>

      <TimelineCardContent>
        {/* Role being elected */}
        <div className="mb-3 text-center">
          <span className="text-muted-foreground text-sm">
            {t('features.timeline.cards.election.electionFor')}:{' '}
          </span>
          <span className="font-medium">{election.roleName}</span>
        </div>

        {/* Winner display or candidate avatars */}
        {election.candidates.length > 0 ? (
          <CandidateAvatars
            candidates={election.candidates}
            winnerId={isWinnerAnnounced ? election.winnerId : undefined}
            winnerName={isWinnerAnnounced ? election.winnerName : undefined}
            isIndicationPhase={election.isIndicationPhase}
          />
        ) : isWinnerAnnounced && election.winnerName ? (
          <WinnerDisplay
            name={election.winnerName}
            avatarUrl={election.winnerAvatarUrl}
            votePercentage={election.winnerVotePercentage}
            roleName={election.roleName}
          />
        ) : null}

        <div className="mt-auto space-y-3">
          {/* Phase timeline */}
          <div>
            <PhaseTimeline currentPhase={currentPhase} />
            <div className="text-muted-foreground mt-1 text-center text-xs">
              {currentPhase === 'nomination' &&
                t('features.timeline.cards.election.phases.nomination')}
              {currentPhase === 'voting' && t('features.timeline.cards.election.phases.voting')}
              {currentPhase === 'results' &&
                t('features.timeline.cards.election.phases.results')}{' '}
              {t('features.timeline.cards.election.phase')}
            </div>
          </div>

          {/* Stats */}
          <div className="text-muted-foreground flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5" />
              <span>
                {election.totalCandidates} {t('features.timeline.cards.election.candidates')}
              </span>
            </div>
            {election.totalVoters !== undefined && (
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {election.totalVoters} {t('features.timeline.cards.election.voted')}
                </span>
              </div>
            )}
            {election.turnoutPercentage !== undefined && (
              <span className="font-medium">
                {election.turnoutPercentage}% {t('features.timeline.cards.election.turnout')}
              </span>
            )}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {/* Primary action based on status */}
        {isNominationsOpen && onNominate && (
          <TimelineCardActionButton
            data-action-id="timeline.election.nomination.open"
            onClick={e => {
              e?.preventDefault();
              onNominate?.();
            }}
            variant="default"
            size="sm"
            label={t('features.timeline.cards.election.nominate')}
          />
        )}
        {isVotingOpen && onCastVote && (
          <TimelineCardActionButton
            data-action-id="timeline.election.ballot.open"
            onClick={e => {
              e?.preventDefault();
              onCastVote?.();
            }}
            variant="default"
            size="sm"
            label={t('features.timeline.cards.castVote')}
          />
        )}
        {(election.status === 'closed' || isWinnerAnnounced) && onViewResults && (
          <TimelineCardActionButton
            data-action-id="timeline.election.results.open"
            onClick={e => {
              e?.preventDefault();
              onViewResults?.();
            }}
            variant="default"
            size="sm"
            label={t('features.timeline.cards.viewResults')}
          />
        )}

        {/* View candidates */}
        {onViewCandidates && !isWinnerAnnounced && (
          <TimelineCardActionButton
            data-action-id="timeline.election.candidates.open"
            onClick={e => {
              e?.preventDefault();
              onViewCandidates?.();
            }}
            variant="outline"
            size="sm"
            label={t('features.timeline.cards.election.viewCandidates')}
          />
        )}
        <div onClick={e => e.preventDefault()}>
          <ShareButton
            data-action-id="timeline.election.share"
            url={electionHref || `/election/${election.id}`}
            title={election.title}
            description={election.roleName}
            variant="outline"
            size="sm"
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}

export default ElectionTimelineCard;
