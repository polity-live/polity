import { Check, Minus, Trophy, X } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { VotingResultBadge, VotingResultCompact } from './VotingControls';

export type DecisionResultType = 'passed' | 'failed' | 'tied' | 'elected';

export interface DecisionResultBadgeProps {
  result: DecisionResultType;
  winnerName?: string;
  percentage?: number;
  className?: string;
  showIcon?: boolean;
}

export function getDecisionResultConfig(result: DecisionResultType) {
  switch (result) {
    case 'passed':
      return {
        labelKey: 'features.timeline.terminal.results.passed',
        Icon: Check,
        tone: 'success' as const,
      };
    case 'failed':
      return {
        labelKey: 'features.timeline.terminal.results.failed',
        Icon: X,
        tone: 'destructive' as const,
      };
    case 'tied':
      return {
        labelKey: 'features.timeline.terminal.results.tied',
        Icon: Minus,
        tone: 'neutral' as const,
      };
    case 'elected':
      return {
        labelKey: 'features.timeline.terminal.results.elected',
        Icon: Trophy,
        tone: 'success' as const,
      };
    default:
      return {
        labelKey: 'features.timeline.terminal.results.unspecified',
        Icon: Minus,
        tone: 'neutral' as const,
      };
  }
}

export function DecisionResultBadge({
  result,
  winnerName,
  percentage,
  className,
  showIcon = true,
}: DecisionResultBadgeProps) {
  const { t } = useTranslation();
  const config = getDecisionResultConfig(result);
  const Icon = config.Icon;

  return (
    <VotingResultBadge
      status={result}
      tone={config.tone}
      label={t(config.labelKey)}
      Icon={Icon}
      winnerName={result === 'elected' ? winnerName : undefined}
      percentage={percentage}
      showIcon={showIcon}
      className={className}
    />
  );
}

export function DecisionResultCompact({
  result,
  winnerName,
  className,
}: {
  result: DecisionResultType;
  winnerName?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const label =
    result === 'elected' && winnerName ? winnerName : t(getDecisionResultConfig(result).labelKey);
  const tone =
    result === 'passed' || result === 'elected'
      ? 'success'
      : result === 'failed' || result === 'tied'
        ? 'destructive'
        : 'neutral';

  return <VotingResultCompact label={label} tone={tone} className={className} />;
}
