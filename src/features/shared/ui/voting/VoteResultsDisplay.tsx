'use client';

import { useState, type ReactNode } from 'react';
import { CheckCircle2, Crown } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type { VotingPhaseValue } from './VotingControls';
import { getLocalizedVoteChoiceLabel } from './voteChoiceLabels';

export interface VoteBarOption {
  key: string;
  label: string;
  icon?: ReactNode;
  color: string;
  lightColor: string;
  finalCount: number;
  finalPercent: number;
  indicationCount: number;
  indicationPercent: number;
  description?: string;
  badge?: ReactNode;
}

export interface VoteResultsDisplayProps {
  options: VoteBarOption[];
  phase: VotingPhaseValue;
  totalFinal: number;
  totalIndication: number;
  totalEligible?: number;
  openedAt?: string;
  closedAt?: string;
  className?: string;
  compact?: boolean;
  showWinner?: boolean;
  showSelectedOptionState?: boolean;
  selectedOptionIds?: string[];
  winnerOptionId?: string | null;
  winnerOptionIds?: string[];
  animate?: boolean;
}

function normalizePercent(percent: number) {
  if (!Number.isFinite(percent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, percent));
}

function formatCountPercent(count: number, percent: number) {
  return `${Math.round(count)} · ${normalizePercent(percent).toFixed(0)}%`;
}

function ResultBar({
  percent,
  count,
  total,
  barClass,
  tooltipLabel,
  animate,
  subtle,
}: {
  percent: number;
  count: number;
  total: number;
  barClass: string;
  tooltipLabel: string;
  animate: boolean;
  subtle?: boolean;
}) {
  const width = normalizePercent(percent);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn('bg-muted/40 h-1.5 flex-1 overflow-hidden rounded-full', subtle && 'h-1')}
          data-slot="vote-result-bar"
        >
          <div
            className={cn(
              'h-full rounded-full',
              animate && 'transition-[width] duration-500 ease-out',
              barClass,
              subtle && 'opacity-70'
            )}
            style={{ width: `${width}%` }}
          />
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

export function VoteResultsDisplay({
  options,
  phase,
  totalFinal,
  totalIndication,
  className,
  compact = true,
  showWinner = false,
  showSelectedOptionState = true,
  selectedOptionIds = [],
  winnerOptionId,
  winnerOptionIds = [],
  animate = true,
}: VoteResultsDisplayProps) {
  const { t } = useTranslation();
  const [showIndicationResults, setShowIndicationResults] = useState(false);
  const isIndicationPhase = phase === 'indication';
  const canToggleIndicationResults = !isIndicationPhase && totalIndication > 0;
  const showIndicationRows = canToggleIndicationResults && showIndicationResults;
  const selectedOptionIdSet = new Set(selectedOptionIds);
  const winnerOptionIdSet = new Set([
    ...winnerOptionIds,
    ...(winnerOptionId ? [winnerOptionId] : []),
  ]);
  const hasAnyVotes = totalFinal > 0 || totalIndication > 0;

  return (
    <TooltipProvider>
      <div
        className={cn('space-y-3', compact ? 'text-sm' : 'space-y-4', className)}
        data-slot="vote-results-display"
      >
        {canToggleIndicationResults ? (
          <div className="flex justify-end">
            <BadgeControl
              asChild
              variant={showIndicationResults ? 'secondary' : 'outline'}
              size="xs"
            >
              <button
                type="button"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowIndicationResults(current => !current);
                }}
              >
                {showIndicationResults
                  ? t('features.events.agenda.hideIndicationResults', 'Hide indication results')
                  : t('features.events.agenda.showIndicationResults', 'Show indication results')}
              </button>
            </BadgeControl>
          </div>
        ) : null}

        <div className="space-y-2">
          {options.map((option, index) => {
            const localizedLabel = getLocalizedVoteChoiceLabel(
              option.label,
              t,
              t(
                'features.events.agenda.defaultChoiceLabels.choiceWithNumber',
                {
                  count: index + 1,
                },
                `Choice ${index + 1}`
              )
            );
            const isSelected = showSelectedOptionState && selectedOptionIdSet.has(option.key);
            const isWinner = showWinner && winnerOptionIdSet.has(option.key);
            const shouldFrameOption = isSelected || isWinner;
            const primaryPercent = isIndicationPhase
              ? option.indicationPercent
              : option.finalPercent;
            const primaryCount = isIndicationPhase ? option.indicationCount : option.finalCount;
            const primaryTotal = isIndicationPhase ? totalIndication : totalFinal;
            return (
              <div
                key={option.key}
                className={cn(
                  'space-y-2 px-3 py-2 transition-[background-color,border-color,box-shadow]',
                  shouldFrameOption && 'bg-card rounded-lg border py-3 shadow-sm',
                  isSelected && 'border-primary/30 bg-primary/5',
                  isWinner && 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]'
                )}
                data-selected={isSelected ? 'true' : undefined}
                data-winner={isWinner ? 'true' : undefined}
                data-framed={shouldFrameOption ? 'true' : undefined}
                data-slot="vote-result-option"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {option.icon ? (
                        <span className="text-muted-foreground shrink-0">{option.icon}</span>
                      ) : null}
                      <span className="truncate font-medium">{localizedLabel}</span>
                      {option.badge}
                      {isSelected ? (
                        <BadgeControl variant="secondary" size="tiny" className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('features.events.agenda.selected', 'Selected')}
                        </BadgeControl>
                      ) : null}
                      {isWinner ? (
                        <BadgeControl tone="warning" size="tiny" className="gap-1">
                          <Crown className="h-3.5 w-3.5" />
                          {t('features.events.agenda.winner', 'Winner')}
                        </BadgeControl>
                      ) : null}
                    </div>
                    {option.description ? (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    {formatCountPercent(primaryCount, primaryPercent)}
                  </span>
                </div>
                <ResultBar
                  percent={primaryPercent}
                  count={primaryCount}
                  total={primaryTotal}
                  barClass={isIndicationPhase ? option.lightColor : option.color}
                  tooltipLabel={
                    isIndicationPhase
                      ? t('features.events.agenda.indication')
                      : t('features.events.agenda.actual')
                  }
                  animate={animate}
                />
                {showIndicationRows ? (
                  <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                      {t('features.events.agenda.indicationShort')}
                    </span>
                    <ResultBar
                      percent={option.indicationPercent}
                      count={option.indicationCount}
                      total={totalIndication}
                      barClass={option.lightColor}
                      tooltipLabel={t('features.events.agenda.indication')}
                      animate={animate}
                      subtle
                    />
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatCountPercent(option.indicationCount, option.indicationPercent)}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {!hasAnyVotes ? (
          <div className="text-muted-foreground bg-muted/35 rounded-md border border-dashed px-3 py-2 text-center text-xs">
            {t('features.events.agenda.noVotesYet')}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
