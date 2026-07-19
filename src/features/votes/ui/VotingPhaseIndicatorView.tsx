'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
/**
 * VotingPhaseIndicator Component
 *
 * Visual indicator showing the current voting phase with timer
 * and result display when completed.
 */

import { Progress } from '@/features/shared/ui/ui/progress';
import { Clock, CheckCircle, XCircle, PauseCircle } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
type VotingResult = 'passed' | 'rejected' | 'tie' | null;
const resultConfig: Record<
  NonNullable<VotingResult>,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  passed: {
    icon: CheckCircle,
    color: featureThemeClassName('timelineUseTodoTimelineCardSuccessText'),
    bgColor: featureThemeClassName('voteVotingPhaseIndicatorSuccessBackground'),
  },
  rejected: {
    icon: XCircle,
    color: featureThemeClassName('timelineUseTodoTimelineCardDangerText'),
    bgColor: featureThemeClassName('voteVotingPhaseIndicatorDangerBackground'),
  },
  tie: {
    icon: PauseCircle,
    color: featureThemeClassName('voteVotingPhaseIndicatorWarningText'),
    bgColor: featureThemeClassName('voteVotingPhaseIndicatorWarningBackground'),
  },
};
export interface VotingPhaseIndicatorViewProps {
  phase: any;
  duration: any;
  startedAt: any;
  result: any;
  acceptCount: any;
  rejectCount: any;
  abstainCount: any;
  totalEligible: any;
  onExpire: any;
  className: any;
  t: any;
  formattedTime: any;
  timeRemaining: any;
  isExpired: any;
  totalVoted: any;
  voteProgress: any;
  config: any;
  PhaseIcon: any;
}

export function VotingPhaseIndicatorView({
  phase,
  duration,
  result,
  acceptCount,
  rejectCount,
  abstainCount,
  totalEligible,
  className,
  t,
  formattedTime,
  timeRemaining,
  isExpired,
  totalVoted,
  voteProgress,
  config,
  PhaseIcon,
}: VotingPhaseIndicatorViewProps) {
  const phaseLabel =
    phase === 'internal'
      ? t('features.events.voting.phases.internal', 'Internal vote')
      : t(`features.events.voting.phases.${phase}`);

  // Show result if voting is closed
  if (phase === 'closed' && result) {
    const resConfig = resultConfig[result as NonNullable<VotingResult>];
    const ResultIcon = resConfig.icon;

    return (
      <div className={cn('rounded-lg p-4', resConfig.bgColor, className)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ResultIcon className={cn('h-5 w-5', resConfig.color)} />
            <span className={cn('font-semibold', resConfig.color)}>
              {t(`features.events.voting.${result}`)}
            </span>
          </div>
          <BadgeControl variant="outline">{t('features.events.voting.closed')}</BadgeControl>
        </div>

        {/* Vote breakdown */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className={featureThemeClassName('voteVotingPhaseIndicatorSuccessText')}>
              {acceptCount}
            </div>
            <div className="text-muted-foreground text-xs">
              {t('features.events.voting.accept')}
            </div>
          </div>
          <div>
            <div className={featureThemeClassName('voteVotingPhaseIndicatorDangerText')}>
              {rejectCount}
            </div>
            <div className="text-muted-foreground text-xs">
              {t('features.events.voting.reject')}
            </div>
          </div>
          <div>
            <div className={featureThemeClassName('voteVotingPhaseIndicatorNeutralText')}>
              {abstainCount}
            </div>
            <div className="text-muted-foreground text-xs">
              {t('features.events.voting.abstain')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {/* Phase indicator */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-md p-1', config.color)}>
            <PhaseIcon className={featureThemeClassName('authSummaryStepContrastIcon')} />
          </div>
          <span className="font-medium">{phaseLabel}</span>
        </div>

        {/* Timer for voting phase */}
        {phase === 'voting' && duration > 0 && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 font-mono text-sm',
              isExpired || timeRemaining < 30
                ? featureThemeClassName('voteVotingPhaseIndicatorDangerBackgroundAlpha')
                : 'bg-muted'
            )}
          >
            <Clock className="h-3 w-3" />
            {formattedTime}
          </div>
        )}
      </div>

      {/* Vote progress for voting phase */}
      {phase === 'voting' && totalEligible > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('features.events.voting.votes')}</span>
            <span>
              {totalVoted} / {totalEligible}
            </span>
          </div>
          <Progress value={voteProgress} className="h-2" />

          {/* Current vote counts */}
          <div className="text-muted-foreground mt-2 flex justify-between text-xs">
            <span className={featureThemeClassName('timelineUseTodoTimelineCardSuccessText')}>
              ✓ {acceptCount}
            </span>
            <span className={featureThemeClassName('timelineUseTodoTimelineCardDangerText')}>
              ✗ {rejectCount}
            </span>
            <span className={featureThemeClassName('timelineReasonDisplayNeutralText')}>
              ○ {abstainCount}
            </span>
          </div>
        </div>
      )}

      {/* Introduction phase message */}
      {phase === 'introduction' && (
        <p className="text-muted-foreground text-sm">
          {t('features.events.voting.setup.startVoting')}
        </p>
      )}

      {/* Setup phase message */}
      {phase === 'setup' && (
        <p className="text-muted-foreground text-sm">{t('features.events.voting.setup.title')}</p>
      )}
    </div>
  );
}
