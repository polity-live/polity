import type { ComponentProps, ComponentType, ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import { Check, Loader2, Minus, X } from 'lucide-react';

export type VotingChoiceValue = 'accept' | 'reject' | 'abstain';
export type VotingPhaseValue = 'internal' | 'indication' | 'final' | 'closed';
export type VotingResultValue = 'passed' | 'failed' | 'tied' | 'elected';

export interface VotingChoiceLabels {
  accept: string;
  reject: string;
  abstain: string;
}

export interface SelectedVoteLabels extends VotingChoiceLabels {
  prefix: string;
}

const choiceConfig: Record<
  VotingChoiceValue,
  {
    Icon: ComponentType<{ className?: string }>;
    buttonVariant: ButtonProps['variant'];
    buttonClassName?: string;
    tone: BadgeTone;
  }
> = {
  accept: {
    Icon: Check,
    buttonVariant: 'default',
    buttonClassName:
      'bg-[var(--badge-success-fg)] text-white hover:bg-[var(--badge-success-fg)] hover:opacity-90',
    tone: 'success',
  },
  reject: {
    Icon: X,
    buttonVariant: 'destructive',
    tone: 'destructive',
  },
  abstain: {
    Icon: Minus,
    buttonVariant: 'secondary',
    tone: 'neutral',
  },
};

export interface VoteChoiceButtonsProps {
  labels: VotingChoiceLabels;
  onVote: (vote: VotingChoiceValue) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  size?: Extract<ButtonProps['size'], 'sm' | 'default' | 'lg'>;
  className?: string;
}

export function VoteChoiceButtons({
  labels,
  onVote,
  isLoading = false,
  disabled = false,
  size = 'default',
  className,
}: VoteChoiceButtonsProps) {
  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {(Object.keys(choiceConfig) as VotingChoiceValue[]).map(choice => {
        const config = choiceConfig[choice];
        const Icon = config.Icon;

        return (
          <Button
            key={choice}
            variant={config.buttonVariant}
            size={size}
            onClick={() => onVote(choice)}
            disabled={disabled || isLoading}
            className={config.buttonClassName}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icon className="mr-2 h-4 w-4" />
            )}
            {labels[choice]}
          </Button>
        );
      })}
    </div>
  );
}

export interface SelectedVoteBadgeProps extends Omit<
  ComponentProps<typeof StatusBadge>,
  'children'
> {
  vote: VotingChoiceValue;
  labels: SelectedVoteLabels;
}

export function SelectedVoteBadge({ vote, labels, className, ...props }: SelectedVoteBadgeProps) {
  const config = choiceConfig[vote];
  const Icon = config.Icon;

  return (
    <StatusBadge tone={config.tone} className={cn('px-4 py-2', className)} {...props}>
      <Icon className="mr-2 h-4 w-4" />
      {labels.prefix}: {labels[vote]}
    </StatusBadge>
  );
}

export function VotingUnavailableMessage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-muted-foreground text-center text-sm', className)}>{children}</div>
  );
}

export interface VotingPhaseBadgeProps extends Omit<
  ComponentProps<typeof StatusBadge>,
  'children' | 'status'
> {
  phase: VotingPhaseValue;
  labels?: Partial<Record<VotingPhaseValue, ReactNode>>;
}

export function VotingPhaseBadge({ phase, labels, className, ...props }: VotingPhaseBadgeProps) {
  const { t } = useTranslation();
  const resolvedLabels = {
    internal: labels?.internal ?? t('features.events.voting.phases.internal', 'Internal vote'),
    indication: labels?.indication ?? t('features.events.voting.phases.indication'),
    final: labels?.final ?? t('features.events.voting.phases.finalVote'),
    closed: labels?.closed ?? t('features.events.voting.phases.closed'),
  };

  if (phase === 'final') {
    return (
      <StatusBadge
        status={phase}
        tone="success"
        className={cn(
          'animate-pulse border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-xs font-semibold text-[var(--badge-success-fg)]',
          className
        )}
        {...props}
      >
        {resolvedLabels.final}
      </StatusBadge>
    );
  }

  return (
    <StatusBadge
      status={phase}
      tone={phase === 'closed' ? 'success' : 'neutral'}
      className={cn(
        'text-xs',
        phase === 'closed' && 'border-[var(--badge-success-border)] text-[var(--badge-success-fg)]',
        className
      )}
      {...props}
    >
      {resolvedLabels[phase]}
    </StatusBadge>
  );
}

export interface VotingResultBadgeProps extends Omit<
  ComponentProps<typeof StatusBadge>,
  'children'
> {
  label: ReactNode;
  Icon?: ComponentType<{ className?: string }>;
  winnerName?: string;
  percentage?: number;
  showIcon?: boolean;
}

export function VotingResultBadge({
  label,
  Icon,
  winnerName,
  percentage,
  showIcon = true,
  className,
  tone = 'neutral',
  ...props
}: VotingResultBadgeProps) {
  return (
    <StatusBadge
      tone={tone}
      className={cn(
        'max-w-full rounded-md px-2 py-0.5 font-mono text-xs font-bold tracking-wide uppercase shadow-sm',
        className
      )}
      {...props}
    >
      {showIcon && Icon ? <Icon className="mr-1 h-3 w-3" /> : null}
      <span>{label}</span>
      {winnerName ? (
        <span className="ml-1 truncate font-normal normal-case" title={winnerName}>
          {winnerName}
        </span>
      ) : null}
      {percentage !== undefined ? <span className="ml-1 font-normal">{percentage}%</span> : null}
    </StatusBadge>
  );
}

export function VotingResultCompact({
  label,
  tone = 'neutral',
  className,
}: {
  label: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={tone}
      className={cn(
        'inline-flex max-w-full min-w-0 items-center rounded-md px-2 py-1 font-mono text-xs font-medium',
        className
      )}
      title={typeof label === 'string' ? label : undefined}
    >
      <span className="min-w-0 truncate">{label}</span>
    </StatusBadge>
  );
}
