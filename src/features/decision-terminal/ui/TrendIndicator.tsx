'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';

export type TrendDirection = 'up' | 'down' | 'stable' | 'volatile';

export interface TrendData {
  direction: TrendDirection;
  percentage: number;
}

export interface TrendIndicatorProps {
  trend: TrendData;
  showPercentage?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Get trend configuration for display
 */
export function getTrendConfig(direction: TrendDirection) {
  switch (direction) {
    case 'up':
      return {
        symbol: '▲',
        Icon: TrendingUp,
        colorClass: featureThemeClassName('authNameStepSuccessText'),
        bgClass: featureThemeClassName('decisionterminalTrendIndicatorSuccessBackground'),
      };
    case 'down':
      return {
        symbol: '▼',
        Icon: TrendingDown,
        colorClass: featureThemeClassName('decisionterminalDecisionStatusDangerTextAlpha'),
        bgClass: featureThemeClassName('decisionterminalFlashRowDangerBackground'),
      };
    case 'stable':
      return {
        symbol: '●',
        Icon: Minus,
        colorClass: 'text-muted-foreground',
        bgClass: 'bg-muted',
      };
    case 'volatile':
      return {
        symbol: '◆',
        Icon: Activity,
        colorClass: featureThemeClassName('decisionterminalCountdownTimerWarningText'),
        bgClass: featureThemeClassName('decisionterminalTrendIndicatorWarningBackground'),
      };
    default:
      return {
        symbol: '●',
        Icon: Minus,
        colorClass: 'text-muted-foreground',
        bgClass: 'bg-muted',
      };
  }
}

/**
 * Format percentage change with sign
 */
export function formatPercentageChange(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(0)}%`;
}

/**
 * Trend indicator component for Decision Terminal
 * Shows direction arrow/symbol and optional percentage change
 */
export function TrendIndicator({
  trend,
  showPercentage = true,
  compact = false,
  className,
}: TrendIndicatorProps) {
  const config = getTrendConfig(trend.direction);
  const Icon = config.Icon;

  if (compact) {
    const tooltip = `Trend: ${formatPercentageChange(trend.percentage)}`;
    return (
      <TooltipHint content={tooltip}>
        <span className={cn('font-mono text-xs font-medium', config.colorClass, className)}>
          {config.symbol}
          {showPercentage && (
            <span className="ml-0.5">{formatPercentageChange(trend.percentage)}</span>
          )}
        </span>
      </TooltipHint>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        config.bgClass,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', config.colorClass)} />
      {showPercentage && (
        <span className={cn('font-mono text-xs font-medium', config.colorClass)}>
          {formatPercentageChange(trend.percentage)}
        </span>
      )}
    </div>
  );
}

/**
 * Simple trend arrow for compact displays
 */
export function TrendArrow({
  direction,
  className,
}: {
  direction: TrendDirection;
  className?: string;
}) {
  const config = getTrendConfig(direction);

  return (
    <TooltipHint content={`Trend: ${direction}`}>
      <span className={cn('font-mono', config.colorClass, className)}>{config.symbol}</span>
    </TooltipHint>
  );
}
