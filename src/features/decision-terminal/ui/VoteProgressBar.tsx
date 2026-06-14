'use client';

import { cn } from '@/features/shared/utils/utils';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

export interface VoteData {
  support: number;
  oppose: number;
  abstain: number;
}

export interface VoteProgressBarProps {
  votes: VoteData;
  showLabels?: boolean;
  showPercentages?: boolean;
  compact?: boolean;
  animated?: boolean;
  className?: string;
}

export interface CompactBarSegment {
  id: string;
  label: string;
  value: number;
}

const ELECTION_SEGMENT_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

function CompactStackedBar({
  segments,
  className,
}: {
  segments: (CompactBarSegment & { colorClass: string })[];
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className={cn('bg-muted flex h-2 overflow-hidden rounded-full', className)}>
      {total > 0 &&
        segments
          .filter(segment => segment.value > 0)
          .map(segment => {
            const percentage = (segment.value / total) * 100;

            return (
              <div
                key={segment.id}
                className={cn(segment.colorClass, 'transition-all duration-300')}
                style={{ width: `${Math.round(percentage)}%` }}
                title={`${segment.label}: ${Math.round(segment.value)} (${Math.round(percentage)}%)`}
              />
            );
          })}
    </div>
  );
}

/**
 * Calculate percentages from vote counts
 */
export function calculateVotePercentages(votes: VoteData): VoteData {
  const total = votes.support + votes.oppose + votes.abstain;
  if (total === 0) {
    return { support: 0, oppose: 0, abstain: 0 };
  }

  return {
    support: Math.round((votes.support / total) * 100),
    oppose: Math.round((votes.oppose / total) * 100),
    abstain: Math.round((votes.abstain / total) * 100),
  };
}

/**
 * Horizontal stacked bar showing vote distribution
 * Support (green) | Oppose (red) | Abstain (gray)
 */
export function VoteProgressBar({
  votes,
  showLabels = false,
  showPercentages = true,
  compact = false,
  animated = true,
  className,
}: VoteProgressBarProps) {
  const { t } = useTranslation();
  const percentages = calculateVotePercentages(votes);
  const total = votes.support + votes.oppose + votes.abstain;

  if (total === 0) {
    return <div className={cn('bg-muted h-2 w-full rounded-full', className)} />;
  }

  const barHeight = compact ? 'h-2' : 'h-3';

  return (
    <div className={cn('space-y-1', className)}>
      {/* The stacked bar */}
      <div
        className={cn('bg-muted flex w-full overflow-hidden rounded-full', barHeight)}
        role="progressbar"
        aria-valuenow={percentages.support}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Support (green) */}
        {percentages.support > 0 && (
          <div
            className={cn('bg-emerald-500', animated && 'transition-all duration-500')}
            style={{ width: `${Math.round(percentages.support)}%` }}
            title={t('timeline.terminal.support', { count: votes.support })}
          />
        )}
        {/* Oppose (red) */}
        {percentages.oppose > 0 && (
          <div
            className={cn('bg-red-500', animated && 'transition-all duration-500')}
            style={{ width: `${Math.round(percentages.oppose)}%` }}
            title={t('timeline.terminal.oppose', { count: votes.oppose })}
          />
        )}
        {/* Abstain (gray) */}
        {percentages.abstain > 0 && (
          <div
            className={cn('bg-muted-foreground/45', animated && 'transition-all duration-500')}
            style={{ width: `${Math.round(percentages.abstain)}%` }}
            title={t('timeline.terminal.abstain', { count: votes.abstain })}
          />
        )}
      </div>

      {/* Labels with percentages */}
      {(showLabels || showPercentages) && (
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {showLabels && (
              <span className="text-muted-foreground">{t('timeline.terminal.support')}</span>
            )}
            {showPercentages && (
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {percentages.support}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {showLabels && (
              <span className="text-muted-foreground">{t('timeline.terminal.oppose')}</span>
            )}
            {showPercentages && (
              <span className="font-mono font-medium text-red-600 dark:text-red-400">
                {percentages.oppose}%
              </span>
            )}
          </div>
          {(votes.abstain > 0 || showLabels) && (
            <div className="flex items-center gap-1">
              <span className="bg-muted-foreground/45 h-2 w-2 rounded-full" />
              {showLabels && (
                <span className="text-muted-foreground">{t('timeline.terminal.abstain')}</span>
              )}
              {showPercentages && (
                <span className="text-muted-foreground font-mono font-medium">
                  {percentages.abstain}%
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Simple inline vote bar for table rows
 */
export function VoteBarCompact({ votes, className }: { votes: VoteData; className?: string }) {
  const segments = [
    {
      id: 'support',
      label: translateText('generated.inline.0083_support_f32d5a3b'),
      value: votes.support,
      colorClass: 'bg-emerald-500',
    },
    {
      id: 'oppose',
      label: translateText('generated.inline.0084_oppose_3ea20ee5'),
      value: votes.oppose,
      colorClass: 'bg-red-500',
    },
    {
      id: 'abstain',
      label: translateText('generated.inline.0085_abstain_bc39d849'),
      value: votes.abstain,
      colorClass: 'bg-muted-foreground/45',
    },
  ];

  return <CompactStackedBar segments={segments} className={cn('w-full', className)} />;
}

export function CandidateBarCompact({
  candidates,
  className,
}: {
  candidates: CompactBarSegment[];
  className?: string;
}) {
  const segments = candidates.map((candidate, index) => ({
    ...candidate,
    colorClass: ELECTION_SEGMENT_COLORS[index % ELECTION_SEGMENT_COLORS.length],
  }));

  return <CompactStackedBar segments={segments} className={cn('w-full', className)} />;
}
