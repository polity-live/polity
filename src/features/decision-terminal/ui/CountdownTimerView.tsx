import { featureThemeClassName } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { Clock } from 'lucide-react';

function getUrgencyClasses(urgency: string): string {
  switch (urgency) {
    case 'critical':
      return featureThemeClassName('decisionterminalDecisionStatusDangerText');
    case 'urgent':
      return featureThemeClassName('decisionterminalCountdownTimerWarningText');
    case 'closing':
      return featureThemeClassName('decisionterminalCountdownTimerWarningText');
    default:
      return featureThemeClassName('authNameStepSuccessText');
  }
}

export function CountdownTimerView({
  className,
  showIcon,
  compact,
  compactLabel,
  timeRemaining,
  formattedTime,
  urgency,
  labels,
}: {
  className?: string;
  showIcon: boolean;
  compact: boolean;
  compactLabel?: string;
  timeRemaining: { isExpired: boolean };
  formattedTime: string;
  urgency: string;
  labels: { ended: string };
}) {
  const urgencyClasses = getUrgencyClasses(urgency);

  if (timeRemaining.isExpired) {
    return (
      <span className={cn('text-muted-foreground font-mono text-xs', className)}>
        {labels.ended}
      </span>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex flex-col', className)}>
        {compactLabel ? (
          <span className={featureThemeClassName('decisionterminalCountdownTimerThemedText')}>
            {compactLabel}
          </span>
        ) : null}
        <span className={cn('font-mono text-xs font-medium', urgencyClasses)}>{formattedTime}</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {showIcon && <Clock className={cn('h-3.5 w-3.5', urgencyClasses)} />}
      <span className={cn('font-mono text-sm font-semibold tabular-nums', urgencyClasses)}>
        {formattedTime}
      </span>
    </div>
  );
}

export function EndedAgoView({ className, label }: { className?: string; label: string | null }) {
  if (!label) {
    return null;
  }

  return <span className={cn('text-muted-foreground font-mono text-xs', className)}>{label}</span>;
}
