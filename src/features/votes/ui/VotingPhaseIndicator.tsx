'use client';

import { featureThemeClassName } from '@/features/shared/theme';
/**
 * VotingPhaseIndicator Component
 *
 * Visual indicator showing the current voting phase with timer
 * and result display when completed.
 */

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSyncedVotingTimer } from '../hooks/useVotingTimer';
import { CheckCircle, PlayCircle, PauseCircle, Timer } from 'lucide-react';

type VotingPhase = 'setup' | 'introduction' | 'voting' | 'closed' | 'indication' | 'final_vote';
type VotingResult = 'passed' | 'rejected' | 'tie' | null;

interface VotingPhaseIndicatorProps {
  phase: VotingPhase;
  duration?: number;
  startedAt?: number;
  result?: VotingResult;
  acceptCount?: number;
  rejectCount?: number;
  abstainCount?: number;
  totalEligible?: number;
  onExpire?: () => void;
  className?: string;
}

const phaseConfig: Record<VotingPhase, { icon: React.ElementType; color: string }> = {
  setup: {
    icon: PauseCircle,
    color: featureThemeClassName('timelineUseSwipeGesturesNeutralBackground'),
  },
  introduction: {
    icon: PlayCircle,
    color: featureThemeClassName('agendaAgendaVoteSectionInfoBackground'),
  },
  voting: {
    icon: Timer,
    color: featureThemeClassName('decisionterminalDecisionWidgetContentWarningBackground'),
  },
  closed: {
    icon: CheckCircle,
    color: featureThemeClassName('agendaAgendaVoteSectionSuccessBackground'),
  },
  indication: {
    icon: PauseCircle,
    color: featureThemeClassName('voteVotingPhaseIndicatorInfoBackground'),
  },
  final_vote: {
    icon: Timer,
    color: featureThemeClassName('decisionterminalDecisionWidgetContentWarningBackground'),
  },
};
import { VotingPhaseIndicatorView } from './VotingPhaseIndicatorView';
export function VotingPhaseIndicator({
  phase,
  duration = 0,
  startedAt,
  result,
  acceptCount = 0,
  rejectCount = 0,
  abstainCount = 0,
  totalEligible = 0,
  onExpire,
  className,
}: VotingPhaseIndicatorProps) {
  const { t } = useTranslation();

  const { formattedTime, timeRemaining, isExpired } = useSyncedVotingTimer(
    phase === 'voting' ? startedAt : undefined,
    duration,
    onExpire
  );

  const totalVoted = acceptCount + rejectCount + abstainCount;
  const voteProgress = totalEligible > 0 ? (totalVoted / totalEligible) * 100 : 0;

  const config = phaseConfig[phase];
  const PhaseIcon = config.icon;
  return (
    <VotingPhaseIndicatorView
      phase={phase}
      duration={duration}
      startedAt={startedAt}
      result={result}
      acceptCount={acceptCount}
      rejectCount={rejectCount}
      abstainCount={abstainCount}
      totalEligible={totalEligible}
      onExpire={onExpire}
      className={className}
      t={t}
      formattedTime={formattedTime}
      timeRemaining={timeRemaining}
      isExpired={isExpired}
      totalVoted={totalVoted}
      voteProgress={voteProgress}
      config={config}
      PhaseIcon={PhaseIcon}
    />
  );
}
