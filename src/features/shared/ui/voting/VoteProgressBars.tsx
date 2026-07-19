'use client';

import type { CSSProperties, ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipHint,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

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

export interface VoteOption {
  key: string;
  label: string;
  icon?: ReactNode;
  color: string;
  lightColor: string;
  finalCount: number;
  finalPercent: number;
  indicationCount: number;
  indicationPercent: number;
}

export interface GroupedVoteResultBarProps {
  options: VoteOption[];
  isIndicationPhase: boolean;
  showBoth: boolean;
  totalFinal: number;
  totalIndication: number;
  className?: string;
}

const ELECTION_SEGMENT_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

function ProgressSegment({
  className,
  style,
  tooltip,
}: {
  className?: string;
  style: CSSProperties;
  tooltip: string;
}) {
  return (
    <TooltipHint content={tooltip}>
      <div className={className} style={style} />
    </TooltipHint>
  );
}

function CompactStackedBar({
  segments,
  className,
}: {
  segments: (CompactBarSegment & { colorClass: string })[];
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className={cn('bg-muted/40 flex h-2 overflow-hidden rounded-full', className)}>
      {total > 0
        ? segments
            .filter(segment => segment.value > 0)
            .map(segment => {
              const percentage = (segment.value / total) * 100;

              return (
                <ProgressSegment
                  key={segment.id}
                  className={cn(segment.colorClass, 'transition-all duration-300')}
                  style={{ width: `${Math.round(percentage)}%` }}
                  tooltip={`${segment.label}: ${Math.round(segment.value)} (${Math.round(percentage)}%)`}
                />
              );
            })
        : null}
    </div>
  );
}

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

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'bg-muted/40 flex w-full overflow-hidden rounded-full',
          compact ? 'h-2' : 'h-3'
        )}
        role="progressbar"
        aria-valuenow={percentages.support}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {percentages.support > 0 ? (
          <ProgressSegment
            className={cn(
              'bg-[var(--badge-success-fg)]',
              animated && 'transition-all duration-500'
            )}
            style={{ width: `${Math.round(percentages.support)}%` }}
            tooltip={t('features.timeline.terminal.support', { count: votes.support })}
          />
        ) : null}
        {percentages.oppose > 0 ? (
          <ProgressSegment
            className={cn('bg-[var(--badge-danger-fg)]', animated && 'transition-all duration-500')}
            style={{ width: `${Math.round(percentages.oppose)}%` }}
            tooltip={t('features.timeline.terminal.oppose', { count: votes.oppose })}
          />
        ) : null}
        {percentages.abstain > 0 ? (
          <ProgressSegment
            className={cn('bg-muted-foreground/45', animated && 'transition-all duration-500')}
            style={{ width: `${Math.round(percentages.abstain)}%` }}
            tooltip={t('features.timeline.terminal.abstain', { count: votes.abstain })}
          />
        ) : null}
      </div>

      {showLabels || showPercentages ? (
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--badge-success-fg)]" />
            {showLabels ? (
              <span className="text-muted-foreground">
                {t('features.timeline.terminal.support')}
              </span>
            ) : null}
            {showPercentages ? (
              <span className="font-mono font-medium text-[var(--badge-success-fg)]">
                {percentages.support}%
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--badge-danger-fg)]" />
            {showLabels ? (
              <span className="text-muted-foreground">
                {t('features.timeline.terminal.oppose')}
              </span>
            ) : null}
            {showPercentages ? (
              <span className="font-mono font-medium text-[var(--badge-danger-fg)]">
                {percentages.oppose}%
              </span>
            ) : null}
          </div>
          {votes.abstain > 0 || showLabels ? (
            <div className="flex items-center gap-1">
              <span className="bg-muted-foreground/45 h-2 w-2 rounded-full" />
              {showLabels ? (
                <span className="text-muted-foreground">
                  {t('features.timeline.terminal.abstain')}
                </span>
              ) : null}
              {showPercentages ? (
                <span className="text-muted-foreground font-mono font-medium">
                  {percentages.abstain}%
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function VoteBarCompact({ votes, className }: { votes: VoteData; className?: string }) {
  const segments = [
    {
      id: 'support',
      label: translateText('generated.inline.0083_support_f32d5a3b'),
      value: votes.support,
      colorClass: 'bg-[var(--badge-success-fg)]',
    },
    {
      id: 'oppose',
      label: translateText('generated.inline.0084_oppose_3ea20ee5'),
      value: votes.oppose,
      colorClass: 'bg-[var(--badge-danger-fg)]',
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

function BarRow({
  percent,
  count,
  total,
  barClass,
  suffix,
  tooltipLabel,
}: {
  percent: number;
  count: number;
  total: number;
  barClass: string;
  suffix?: string;
  tooltipLabel: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className="bg-muted/40 h-2.5 flex-1 overflow-hidden rounded-full">
            <div
              className={cn('h-full transition-all', barClass)}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-muted-foreground min-w-[60px] text-right text-xs">
            {count} ({percent.toFixed(0)}%){suffix}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {tooltipLabel}: {count} / {total}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function GroupedVoteResultBar({
  options,
  isIndicationPhase,
  showBoth,
  totalFinal,
  totalIndication,
  className,
}: GroupedVoteResultBarProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <div className={cn('space-y-3', className)}>
        {options.map(option => (
          <div key={option.key} className="bg-card space-y-2 rounded-lg border px-3 py-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {option.icon}
              <span>{option.label}</span>
            </div>
            <div className="space-y-1 pl-1">
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'w-16 text-[10px]',
                    isIndicationPhase ? 'text-muted-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  {t('features.events.agenda.actualShort')}
                </span>
                <div className="flex-1">
                  <BarRow
                    percent={option.finalPercent}
                    count={option.finalCount}
                    total={totalFinal}
                    barClass={option.color}
                    tooltipLabel={t('features.events.agenda.actual')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'w-16 text-[10px]',
                    !showBoth && !isIndicationPhase
                      ? 'text-muted-foreground/70'
                      : 'text-muted-foreground'
                  )}
                >
                  {t('features.events.agenda.indicationShort')}
                </span>
                <div className="flex-1">
                  <BarRow
                    percent={option.indicationPercent}
                    count={option.indicationCount}
                    total={totalIndication}
                    barClass={option.lightColor}
                    suffix=" *"
                    tooltipLabel={t('features.events.agenda.indication')}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        {totalFinal === 0 && totalIndication === 0 ? (
          <div className="text-muted-foreground text-xs">
            {t('features.events.agenda.noVotesYet')}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
