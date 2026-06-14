'use client';

import { cn } from '@/features/shared/utils/utils';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Check, X, Minus, Trophy } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

export type ResultType = 'passed' | 'failed' | 'tied' | 'elected';

export interface ResultBadgeProps {
  result: ResultType;
  winnerName?: string;
  percentage?: number;
  className?: string;
  showIcon?: boolean;
}

/**
 * Get result configuration for display
 */
export function getResultConfig(result: ResultType) {
  switch (result) {
    case 'passed':
      return {
        labelKey: 'timeline.terminal.results.passed',
        Icon: Check,
        colorClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
      };
    case 'failed':
      return {
        labelKey: 'timeline.terminal.results.failed',
        Icon: X,
        colorClass:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
      };
    case 'tied':
      return {
        labelKey: 'timeline.terminal.results.tied',
        Icon: Minus,
        colorClass: 'border-border bg-muted text-muted-foreground',
      };
    case 'elected':
      return {
        labelKey: 'timeline.terminal.results.elected',
        Icon: Trophy,
        colorClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
      };
    default:
      return {
        labelKey: 'timeline.terminal.results.unspecified',
        Icon: Minus,
        colorClass: 'border-border bg-muted text-muted-foreground',
      };
  }
}

/**
 * Result badge for closed decisions
 * Shows PASSED, FAILED, TIED, or ELECTED with winner name
 */
export function ResultBadge({
  result,
  winnerName,
  percentage,
  className,
  showIcon = true,
}: ResultBadgeProps) {
  const { t } = useTranslation();
  const config = getResultConfig(result);
  const Icon = config.Icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full rounded-md px-2 py-0.5 font-mono text-xs font-bold tracking-wide uppercase',
        config.colorClass,
        className
      )}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      <span>{t(config.labelKey)}</span>
      {result === 'elected' && winnerName && (
        <span className="ml-1 truncate font-normal normal-case" title={winnerName}>
          {winnerName}
        </span>
      )}
      {percentage !== undefined && <span className="ml-1 font-normal">{percentage}%</span>}
    </Badge>
  );
}

/**
 * Compact result display for table rows
 */
export function ResultCompact({
  result,
  winnerName,
  className,
}: {
  result: ResultType;
  winnerName?: string;
  className?: string;
}) {
  const label =
    result === translateText('generated.inline.0048_elected_7b1d05c6') && winnerName
      ? winnerName
      : result.toUpperCase();

  return (
    <span
      className={cn(
        'flex max-w-full min-w-0 items-center font-mono text-xs font-medium',
        className
      )}
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
