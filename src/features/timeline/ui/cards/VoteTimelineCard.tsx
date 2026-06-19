'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { ThumbsUp, ThumbsDown, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Progress } from '@/features/shared/ui/ui/progress';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardActions,
} from './TimelineCardBase';

export interface VoteTimelineCardProps {
  vote: {
    id: string;
    amendmentId: string;
    amendmentTitle: string;
    question?: string;
    status: 'open' | 'closing_soon' | 'last_hour' | 'final_minutes' | 'passed' | 'failed' | 'tied';
    endTime?: string | Date;
    supportPercentage: number;
    supportCount: number;
    opposeCount: number;
    abstainCount?: number;
    totalVoters?: number;
    votedCount?: number;
    trend?: 'up' | 'down' | 'stable';
    trendPercentage?: number;
    hasVoted?: boolean;
    userVote?: 'support' | 'oppose' | 'abstain';
    agendaEventId?: string;
    agendaItemId?: string;
    // Indication support
    isIndicationPhase?: boolean;
    indicationSupportPercentage?: number;
    indicationSupportCount?: number;
    indicationOpposeCount?: number;
    indicationAbstainCount?: number;
  };
  onVoteSupport?: () => void;
  onVoteOppose?: () => void;
  onDiscuss?: () => void;
  href?: string;
  className?: string;
}

/**
 * Format remaining time for display
 */
function formatTimeRemaining(endTime: Date): string {
  const now = new Date();
  const diffMs = endTime.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ended';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    return `${days}d ${hours}h`;
  }

  if (diffHours > 0) {
    return `${diffHours}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
  }

  return `${diffMinutes}:${diffSeconds.toString().padStart(2, '0')}`;
}

function normalizePercent(percent: number | null | undefined) {
  if (!Number.isFinite(percent ?? 0)) {
    return 0;
  }

  return Math.max(0, Math.min(100, percent ?? 0));
}

function formatCountPercent(count: number | null | undefined, percent: number | null | undefined) {
  return `${Math.round(count ?? 0)} · ${normalizePercent(percent).toFixed(0)}%`;
}

/**
 * Status configuration for vote cards
 */
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; pulse?: boolean }> = {
  open: {
    color: featureThemeClassName('timelineUseTodoTimelineCardSuccessText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardSuccessBackground'),
  },
  closing_soon: {
    color: featureThemeClassName('editorEditorHeaderWarningText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardWarningBackgroundAlpha'),
  },
  last_hour: {
    color: featureThemeClassName('timelineUseTodoTimelineCardWarningText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardWarningBackground'),
  },
  final_minutes: {
    color: featureThemeClassName('timelineUseTodoTimelineCardDangerText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardDangerBackground'),
    pulse: true,
  },
  passed: {
    color: featureThemeClassName('timelineUseTodoTimelineCardSuccessText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardSuccessBackground'),
  },
  failed: {
    color: featureThemeClassName('timelineUseTodoTimelineCardDangerText'),
    bgColor: featureThemeClassName('timelineUseTodoTimelineCardDangerBackground'),
  },
  tied: {
    color: featureThemeClassName('timelineVoteTimelineCardNeutralText'),
    bgColor: featureThemeClassName('timelineElectionTimelineCardNeutralBackground'),
  },
};

/**
 * VoteTimelineCard - Active Vote card
 *
 * Displays an active or completed vote with:
 * - Red-orange gradient header
 * - Status badge with countdown timer
 * - Amendment title as link
 * - Vote question
 * - Live results progress bar
 * - Trend indicator
 * - Actions: Vote Support, Vote Oppose, Discuss
 */
export function VoteTimelineCard({ vote, href, className }: VoteTimelineCardProps) {
  const { t } = useTranslation();
  const [showIndicationResults, setShowIndicationResults] = useState(false);

  const statusConfig = STATUS_CONFIG[vote.status] || STATUS_CONFIG.open;
  const isActive = ['open', 'closing_soon', 'last_hour', 'final_minutes'].includes(vote.status);
  const endDate = vote.endTime ? new Date(vote.endTime) : null;
  const turnout =
    vote.totalVoters && vote.votedCount
      ? Math.round((vote.votedCount / vote.totalVoters) * 100)
      : undefined;

  const TrendIcon = vote.trend === 'up' ? TrendingUp : vote.trend === 'down' ? TrendingDown : Minus;

  const agendaHref =
    vote.agendaEventId && vote.agendaItemId
      ? `/event/${vote.agendaEventId}/agenda/${vote.agendaItemId}`
      : undefined;
  const fallbackHref = `/amendment/${vote.amendmentId}`;
  const voteHref = href ?? agendaHref ?? fallbackHref;

  const actualTotal = vote.supportCount + vote.opposeCount + (vote.abstainCount ?? 0);

  // Indication display logic
  const hasIndication = vote.indicationSupportPercentage !== undefined;
  const canToggleIndicationResults = !vote.isIndicationPhase && hasIndication && actualTotal > 0;
  const showIndicationRows =
    vote.isIndicationPhase || (canToggleIndicationResults && showIndicationResults);

  return (
    <TimelineCardBase
      contentType="vote"
      className={cn(
        statusConfig.pulse && featureThemeClassName('timelineVoteTimelineCardDangerRing'),
        className
      )}
      href={voteHref}
    >
      <TimelineCardHeader
        contentType="vote"
        title={t('features.timeline.contentTypes.vote')}
        href={voteHref}
        badge={
          <BadgeControl
            variant="outline"
            className={cn(
              'flex items-center gap-1.5 text-xs',
              statusConfig.bgColor,
              statusConfig.color,
              statusConfig.pulse && 'animate-pulse'
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                vote.status === 'open' &&
                  featureThemeClassName('agendaAgendaVoteSectionSuccessBackground'),
                vote.status === 'closing_soon' &&
                  featureThemeClassName('decisionterminalFlashRowWarningBackgroundAlpha'),
                vote.status === 'last_hour' &&
                  featureThemeClassName('agendaAgendaVoteSectionWarningBackground'),
                vote.status === 'final_minutes' &&
                  featureThemeClassName('timelineVoteTimelineCardDangerBackground'),
                vote.status === 'passed' &&
                  featureThemeClassName('agendaAgendaVoteSectionSuccessBackground'),
                vote.status === 'failed' &&
                  featureThemeClassName('agendaAgendaVoteSectionDangerBackground'),
                vote.status === 'tied' &&
                  featureThemeClassName('timelineUseSwipeGesturesNeutralBackground')
              )}
            />
            {vote.status.replace('_', ' ').toUpperCase()}
          </BadgeControl>
        }
      >
        {/* Timer */}
        {isActive && endDate && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Clock className={cn('h-4 w-4', statusConfig.color)} />
            <span className={cn('font-mono text-lg font-bold', statusConfig.color)}>
              {formatTimeRemaining(endDate)}
            </span>
          </div>
        )}
      </TimelineCardHeader>

      <TimelineCardContent>
        {/* Amendment Title (card click handles navigation) */}
        <p className="mb-2 line-clamp-2 text-sm font-medium">
          <SmartLink href={voteHref} onClick={e => e.stopPropagation()} className="hover:underline">
            {vote.amendmentTitle}
          </SmartLink>
        </p>

        <div className="mt-auto space-y-3">
          {vote.question && (
            <p className="text-muted-foreground line-clamp-2 text-sm">{vote.question}</p>
          )}

          {/* Vote Progress Bar */}
          <div className="space-y-2">
            {canToggleIndicationResults ? (
              <div className="flex justify-end">
                <BadgeControl
                  asChild
                  variant={showIndicationResults ? 'secondary' : 'outline'}
                  size="xs"
                >
                  <button
                    type="button"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      setShowIndicationResults(current => !current);
                    }}
                  >
                    {showIndicationResults
                      ? t('features.events.agenda.hideIndicationResults', 'Hide indication results')
                      : t(
                          'features.events.agenda.showIndicationResults',
                          'Show indication results'
                        )}
                  </button>
                </BadgeControl>
              </div>
            ) : null}

            {/* Indication results (only current phase, or expanded under final results) */}
            {showIndicationRows && hasIndication && (
              <div className="bg-card rounded-lg border px-3 py-2 shadow-sm">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    {t('features.timeline.cards.indication', { defaultValue: 'Indication' })} *
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCountPercent(
                      vote.indicationSupportCount,
                      vote.indicationSupportPercentage
                    )}
                  </span>
                </div>
                <Progress
                  value={vote.indicationSupportPercentage}
                  className={featureThemeClassName('timelineVoteTimelineCardInfoProgressFill')}
                />
              </div>
            )}

            {/* Actual results (hide if in indication phase only) */}
            {!vote.isIndicationPhase && (
              <div className="bg-card rounded-lg border px-3 py-2 shadow-sm">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">
                      {canToggleIndicationResults
                        ? t('features.timeline.cards.actual', { defaultValue: 'Actual' })
                        : t('features.timeline.cards.support')}
                    </span>
                    {vote.trend && vote.trendPercentage && (
                      <span
                        className={cn(
                          'flex items-center gap-0.5 text-xs font-medium',
                          vote.trend === 'up' &&
                            featureThemeClassName('timelineUseTodoTimelineCardSuccessText'),
                          vote.trend === 'down' &&
                            featureThemeClassName('timelineUseTodoTimelineCardDangerText'),
                          vote.trend === 'stable' &&
                            featureThemeClassName('timelineReasonDisplayNeutralText')
                        )}
                      >
                        <TrendIcon className="h-3 w-3" />
                        {vote.trend !== 'stable' && `${vote.trendPercentage}%`}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'font-medium',
                      vote.supportPercentage >= 50
                        ? featureThemeClassName('timelineUseTodoTimelineCardSuccessText')
                        : featureThemeClassName('timelineUseTodoTimelineCardDangerText')
                    )}
                  >
                    {formatCountPercent(vote.supportCount, vote.supportPercentage)}
                  </span>
                </div>
                <Progress
                  value={vote.supportPercentage}
                  className={cn(
                    'h-2.5',
                    vote.status === 'passed' &&
                      featureThemeClassName('timelineTodoTimelineCardSuccessProgressFill'),
                    vote.status === 'failed' &&
                      featureThemeClassName('timelineVoteTimelineCardDangerProgressFill')
                  )}
                />
              </div>
            )}
          </div>

          {/* Vote Stats */}
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="bg-muted/20 rounded-md border px-2 py-1.5">
              {/* Show indication counts if in indication phase */}
              {vote.isIndicationPhase && hasIndication ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ThumbsUp
                      className={featureThemeClassName('timelineVoteTimelineCardInfoIcon')}
                    />
                    {vote.indicationSupportCount} *
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown
                      className={featureThemeClassName('timelineVoteTimelineCardInfoIconAlpha')}
                    />
                    {vote.indicationOpposeCount} *
                  </span>
                  {vote.indicationAbstainCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Minus
                        className={featureThemeClassName('timelineVoteTimelineCardInfoIconBeta')}
                      />
                      {vote.indicationAbstainCount} *
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ThumbsUp
                      className={featureThemeClassName('timelineVoteTimelineCardSuccessIcon')}
                    />
                    {vote.supportCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown
                      className={featureThemeClassName('timelineVoteTimelineCardDangerIcon')}
                    />
                    {vote.opposeCount}
                  </span>
                  {vote.abstainCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Minus className="h-3 w-3" />
                      {vote.abstainCount}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="bg-muted/20 rounded-md border px-2 py-1.5">
              {vote.votedCount ?? vote.supportCount + vote.opposeCount + (vote.abstainCount ?? 0)}{' '}
              {t('features.events.voting.voted', { defaultValue: 'voted' })}
            </div>
            {turnout !== undefined && (
              <span className="bg-muted/20 rounded-md border px-2 py-1.5">
                {turnout}% {t('features.timeline.cards.turnout')}
              </span>
            )}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {vote.hasVoted && (
          <BadgeControl variant="secondary" size="xs">
            {t('features.timeline.cards.voted')}: {vote.userVote}
          </BadgeControl>
        )}
        <div onClick={e => e.preventDefault()}>
          <ShareButton
            url={voteHref}
            title={vote.amendmentTitle}
            description={vote.question || ''}
            variant="outline"
            size="sm"
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}
