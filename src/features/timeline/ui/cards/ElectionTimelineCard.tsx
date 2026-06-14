'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Award, Users, Calendar, Crown, Trophy } from 'lucide-react';
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
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Election phase type
 */
type ElectionPhase = 'nomination' | 'voting' | 'results';

/**
 * Get current phase from status
 */
function getCurrentPhase(status: string): ElectionPhase {
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
  isIndicationPhase,
}: {
  candidates: ElectionCandidate[];
  maxDisplay?: number;
  winnerId?: string;
  isIndicationPhase?: boolean;
}) {
  const displayCandidates = candidates.slice(0, maxDisplay);
  const remaining = candidates.length - maxDisplay;

  // Check if we have indication data
  const hasIndication = displayCandidates.some(c => c.indicationPercentage !== undefined);
  const showBothResults = !isIndicationPhase && hasIndication;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex -space-x-2">
        {displayCandidates.map(candidate => (
          <div key={candidate.id} className="relative">
            <Avatar
              className={cn(
                'border-background h-10 w-10 border-2',
                candidate.id === winnerId &&
                  featureThemeClassName('timelineElectionTimelineCardWarningRing')
              )}
            >
              <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
              <AvatarFallback
                className={featureThemeClassName(
                  'timelineElectionTimelineCardDangerBackgroundBeta'
                )}
              >
                {getInitials(candidate.name)}
              </AvatarFallback>
            </Avatar>
            {candidate.id === winnerId && (
              <Crown
                className={featureThemeClassName('timelineElectionTimelineCardWarningNeutralIcon')}
              />
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div className={featureThemeClassName('timelineElectionTimelineCardNeutralRoundIcon')}>
            +{remaining}
          </div>
        )}
      </div>
      {/* Candidate names and vote percentages */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {displayCandidates.slice(0, 3).map(candidate => (
          <span key={candidate.id} className="flex items-center gap-1">
            <span className="text-muted-foreground">{candidate.name}</span>
            {/* Show indication or actual percentage */}
            {isIndicationPhase && candidate.indicationPercentage !== undefined ? (
              <span className={featureThemeClassName('discussionsCommentTreeInfoText')}>
                {candidate.indicationPercentage}% *
              </span>
            ) : showBothResults && candidate.indicationPercentage !== undefined ? (
              <span className="text-muted-foreground">
                <span className={featureThemeClassName('notificationNotificationInfoTextAlpha')}>
                  {candidate.indicationPercentage}%
                </span>
                {' → '}
                <span className="text-foreground font-medium">{candidate.votePercentage}%</span>
              </span>
            ) : candidate.votePercentage !== undefined ? (
              <span className="font-medium">{candidate.votePercentage}%</span>
            ) : null}
          </span>
        ))}
        {candidates.length > 3 && <span className="text-muted-foreground">...</span>}
      </div>
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
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="text-muted-foreground text-sm font-medium">
        🎉 {t('features.timeline.cards.election.winnerAnnounced')}
      </div>
      <div className="relative">
        <Avatar className={featureThemeClassName('timelineElectionTimelineCardWarningBorder')}>
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback
            className={featureThemeClassName('timelineElectionTimelineCardDangerBackgroundGamma')}
          >
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <Crown
          className={featureThemeClassName('timelineElectionTimelineCardWarningNeutralIconAlpha')}
        />
      </div>
      <div className="text-center">
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
  className,
}: ElectionTimelineCardProps) {
  const { t } = useTranslation();
  const statusConfig = STATUS_CONFIG[election.status];
  const currentPhase = getCurrentPhase(election.status);
  const isWinnerAnnounced = election.status === 'winner_announced';
  const isVotingOpen = election.status === 'voting_open';
  const isNominationsOpen = election.status === 'nominations_open';

  const agendaHref =
    election.agendaEventId && election.agendaItemId
      ? `/event/${election.agendaEventId}/agenda/${election.agendaItemId}`
      : undefined;
  const fallbackHref = election.groupId ? `/group/${election.groupId}` : undefined;
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
      return `${t('features.timeline.cards.election.submitBy')} ${formatDate(election.nominationsEndDate)}`;
    }
    if (isVotingOpen && election.votingEndDate) {
      return `${t('features.timeline.cards.election.endsOn')} ${formatDate(election.votingEndDate)}`;
    }
    return null;
  };

  const dateText = getDateText();

  return (
    <TimelineCardBase
      contentType="election"
      className={className}
      href={agendaHref || fallbackHref}
    >
      <TimelineCardHeader
        contentType="election"
        title={election.title}
        href={agendaHref || fallbackHref}
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
        {isWinnerAnnounced && election.winnerName ? (
          <WinnerDisplay
            name={election.winnerName}
            avatarUrl={election.winnerAvatarUrl}
            votePercentage={election.winnerVotePercentage}
            roleName={election.roleName}
          />
        ) : (
          election.candidates.length > 0 && (
            <CandidateAvatars
              candidates={election.candidates}
              winnerId={isWinnerAnnounced ? election.winnerId : undefined}
              isIndicationPhase={election.isIndicationPhase}
            />
          )
        )}

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
            url={agendaHref || fallbackHref || `/election/${election.id}`}
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
