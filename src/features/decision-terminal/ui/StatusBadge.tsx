'use client';

import { cn } from '@/features/shared/utils/utils';
import { Badge } from '@/features/shared/ui/ui/badge';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type DecisionStatus =
  | 'open'
  | 'closing_soon'
  | 'last_hour'
  | 'final_minutes'
  | 'passed'
  | 'failed'
  | 'tied'
  | 'elected';

export interface StatusBadgeProps {
  status: DecisionStatus;
  className?: string;
}

/**
 * Get status configuration for display
 */
export function getStatusConfig(status: DecisionStatus) {
  switch (status) {
    case 'open':
      return {
        label: translateText('generated.inline.0074_open_cf9b7706'),
        dotClass: 'bg-emerald-500',
        colorClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
        pulseClass: '',
      };
    case 'closing_soon':
      return {
        label: translateText('generated.inline.0075_closing_76a032e9'),
        dotClass: 'bg-amber-500',
        colorClass:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
        pulseClass: '',
      };
    case 'last_hour':
      return {
        label: translateText('generated.inline.0076_last_hour_1e84a813'),
        dotClass: 'bg-amber-500',
        colorClass:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
        pulseClass: '',
      };
    case 'final_minutes':
      return {
        label: translateText('generated.inline.0077_final_672b22cc'),
        dotClass: 'bg-red-500',
        colorClass:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
        pulseClass: 'animate-pulse',
      };
    case 'passed':
      return {
        label: translateText('generated.inline.0078_passed_271d60f4'),
        dotClass: 'bg-emerald-500',
        colorClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
        pulseClass: '',
      };
    case 'failed':
      return {
        label: translateText('generated.inline.0079_failed_09fef5d8'),
        dotClass: 'bg-red-500',
        colorClass:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
        pulseClass: '',
      };
    case 'tied':
      return {
        label: translateText('generated.inline.0080_tied_2e9807f6'),
        dotClass: 'bg-muted-foreground',
        colorClass: 'border-border bg-muted text-muted-foreground',
        pulseClass: '',
      };
    case 'elected':
      return {
        label: translateText('generated.inline.0081_elected_27d35d1d'),
        dotClass: 'bg-emerald-500',
        colorClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
        pulseClass: '',
      };
    default:
      return {
        label: translateText('generated.inline.0082_unknown_bc7819b3'),
        dotClass: 'bg-muted-foreground',
        colorClass: 'border-border bg-muted text-muted-foreground',
        pulseClass: '',
      };
  }
}

/**
 * Status badge for Decision Terminal
 * Shows status with color coding and optional pulse animation
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-xs font-bold tracking-wide uppercase',
        'rounded-md px-2 py-0.5',
        config.colorClass,
        config.pulseClass,
        className
      )}
    >
      <span className={cn('mr-1 h-1.5 w-1.5', config.dotClass)} />
      {config.label}
    </Badge>
  );
}

/**
 * Compact status indicator (just the dot/emoji)
 */
export function StatusDot({ status, className }: { status: DecisionStatus; className?: string }) {
  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'border-background inline-flex h-2 w-2 items-center justify-center rounded-full border',
        config.dotClass,
        config.pulseClass,
        className
      )}
      title={config.label}
    />
  );
}
