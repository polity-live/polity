'use client';

import { useState, type ReactNode } from 'react';
import { BarChart3, CheckCircle2, Crown, Users } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VotingPhaseBadge, type VotingPhaseValue } from './VotingControls';

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
        <div className="flex items-center gap-2" data-slot="vote-result-bar">
          <div
            className={cn('bg-muted/40 h-2 flex-1 overflow-hidden rounded-full', subtle && 'h-1.5')}
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
          <span className="text-muted-foreground min-w-[4.75rem] text-right text-xs tabular-nums">
            {formatCountPercent(count, width)}
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

export function VoteResultsDisplay({
  options,
  phase,
  totalFinal,
  totalIndication,
  totalEligible,
  openedAt,
  closedAt,
  className,
  compact = true,
  showWinner = false,
  selectedOptionIds = [],
  winnerOptionId,
  winnerOptionIds = [],
  animate = true,
}: VoteResultsDisplayProps) {
  const { t } = useTranslation();
  const [showIndicationResults, setShowIndicationResults] = useState(false);
  const isIndicationPhase = phase === 'indication';
  const canToggleIndicationResults = !isIndicationPhase && totalFinal > 0 && totalIndication > 0;
  const showIndicationRows = canToggleIndicationResults && showIndicationResults;
  const visibleTotal = isIndicationPhase ? totalIndication : totalFinal;
  const selectedOptionIdSet = new Set(selectedOptionIds);
  const winnerOptionIdSet = new Set([
    ...winnerOptionIds,
    ...(winnerOptionId ? [winnerOptionId] : []),
  ]);
  const hasAnyVotes = totalFinal > 0 || totalIndication > 0;
  const phaseVoteLabel = isIndicationPhase
    ? t('features.events.agenda.indicationVotes', 'indications')
    : t('features.events.agenda.votes', 'votes');
  const turnout =
    totalEligible !== undefined && totalEligible > 0
      ? Math.round((visibleTotal / totalEligible) * 100)
      : undefined;

  return (
    <TooltipProvider>
      <div
        className={cn('space-y-3', compact ? 'text-sm' : 'space-y-4', className)}
        data-slot="vote-results-display"
      >
        <div className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <VotingPhaseBadge phase={phase} />
            <BadgeControl variant="outline" size="xs" className="gap-1">
              <BarChart3 className="h-3 w-3" />
              {visibleTotal} {phaseVoteLabel}
            </BadgeControl>
            {turnout !== undefined ? (
              <BadgeControl variant="outline" size="xs" className="gap-1">
                <Users className="h-3 w-3" />
                {turnout}%
              </BadgeControl>
            ) : null}
          </div>
          {canToggleIndicationResults ? (
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
          ) : null}
        </div>

        <div className="space-y-2">
          {options.map(option => {
            const isSelected = selectedOptionIdSet.has(option.key);
            const isWinner = showWinner && winnerOptionIdSet.has(option.key);
            const primaryPercent = isIndicationPhase
              ? option.indicationPercent
              : option.finalPercent;
            const primaryCount = isIndicationPhase ? option.indicationCount : option.finalCount;
            const primaryTotal = isIndicationPhase ? totalIndication : totalFinal;

            return (
              <div
                key={option.key}
                className={cn(
                  'bg-card space-y-2 rounded-lg border px-3 py-3 shadow-sm transition-[background-color,border-color,box-shadow]',
                  isSelected && 'border-primary/30 bg-primary/5',
                  isWinner && 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]'
                )}
                data-selected={isSelected ? 'true' : undefined}
                data-winner={isWinner ? 'true' : undefined}
                data-slot="vote-result-option"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {option.icon ? (
                      <span className="text-muted-foreground mt-0.5 shrink-0">{option.icon}</span>
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{option.label}</span>
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
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatCountPercent(primaryCount, primaryPercent)}
                  </span>
                </div>

                <div className="space-y-1.5">
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
                    <div className="grid grid-cols-[2.25rem_1fr] items-center gap-2">
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
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {!hasAnyVotes ? (
          <div className="text-muted-foreground bg-muted/35 rounded-md border border-dashed px-3 py-2 text-center text-xs">
            {t('features.events.agenda.noVotesYet')}
          </div>
        ) : null}

        {totalEligible !== undefined && totalEligible > 0 ? (
          <div className="grid gap-2 border-t pt-2 text-xs sm:grid-cols-3">
            <span className="bg-muted/20 rounded-md border px-3 py-2">
              {t('features.events.voting.eligible')}: {totalEligible}
            </span>
            <span className="bg-muted/20 rounded-md border px-3 py-2">
              {t('features.events.voting.voted')}: {visibleTotal}
            </span>
            <span className="bg-muted/20 rounded-md border px-3 py-2">
              {t('features.events.voting.share')}:{' '}
              {Math.round((visibleTotal / totalEligible) * 100)}%
            </span>
          </div>
        ) : null}

        {openedAt || closedAt ? (
          <div className="text-muted-foreground flex justify-between text-xs">
            {openedAt ? (
              <span>
                {t('features.events.voting.opened')}: {openedAt}
              </span>
            ) : null}
            {closedAt ? (
              <span>
                {t('features.events.voting.closed')}: {closedAt}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
