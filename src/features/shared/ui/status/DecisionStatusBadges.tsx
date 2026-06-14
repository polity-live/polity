import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { StatusBadgeWithDot, StatusDotIndicator } from './StatusBadges';

export type DecisionStatus =
  | 'open'
  | 'closing_soon'
  | 'last_hour'
  | 'final_minutes'
  | 'passed'
  | 'failed'
  | 'tied'
  | 'elected';

export interface DecisionStatusBadgeProps {
  status: DecisionStatus;
  className?: string;
}

export function getDecisionStatusConfig(status: DecisionStatus) {
  switch (status) {
    case 'open':
      return {
        label: translateText('generated.inline.0074_open_cf9b7706'),
        tone: 'success' as const,
        pulse: false,
      };
    case 'closing_soon':
      return {
        label: translateText('generated.inline.0075_closing_76a032e9'),
        tone: 'warning' as const,
        pulse: false,
      };
    case 'last_hour':
      return {
        label: translateText('generated.inline.0076_last_hour_1e84a813'),
        tone: 'warning' as const,
        pulse: false,
      };
    case 'final_minutes':
      return {
        label: translateText('generated.inline.0077_final_672b22cc'),
        tone: 'destructive' as const,
        pulse: true,
      };
    case 'passed':
      return {
        label: translateText('generated.inline.0078_passed_271d60f4'),
        tone: 'success' as const,
        pulse: false,
      };
    case 'failed':
      return {
        label: translateText('generated.inline.0079_failed_09fef5d8'),
        tone: 'destructive' as const,
        pulse: false,
      };
    case 'tied':
      return {
        label: translateText('generated.inline.0080_tied_2e9807f6'),
        tone: 'neutral' as const,
        pulse: false,
      };
    case 'elected':
      return {
        label: translateText('generated.inline.0081_elected_27d35d1d'),
        tone: 'success' as const,
        pulse: false,
      };
    default:
      return {
        label: translateText('generated.inline.0082_unknown_bc7819b3'),
        tone: 'neutral' as const,
        pulse: false,
      };
  }
}

export function DecisionStatusBadge({ status, className }: DecisionStatusBadgeProps) {
  const config = getDecisionStatusConfig(status);

  return (
    <StatusDotIndicator
      tone={config.tone}
      pulse={config.pulse}
      className={className}
      title={config.label}
    />
  );
}

export function DecisionStatusDot({
  status,
  className,
}: {
  status: DecisionStatus;
  className?: string;
}) {
  const config = getDecisionStatusConfig(status);

  return (
    <StatusBadgeWithDot
      status={status}
      tone={config.tone}
      dotTone={config.tone}
      pulse={config.pulse}
      className={className}
    >
      {config.label}
    </StatusBadgeWithDot>
  );
}
