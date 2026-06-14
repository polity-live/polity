'use client';

import type { ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';
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
          <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
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

export function VoteResultsDisplay({
  options,
  phase,
  totalFinal,
  totalIndication,
  totalEligible,
  openedAt,
  closedAt,
  className,
}: VoteResultsDisplayProps) {
  const { t } = useTranslation();
  const showBoth = phase !== 'indication' && totalIndication > 0;
  const isIndicationPhase = phase === 'indication';
  const visibleTotal = isIndicationPhase ? totalIndication : totalFinal;

  return (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <VotingPhaseBadge phase={phase} />
          <span className="text-muted-foreground text-xs">
            {isIndicationPhase
              ? `${totalIndication} ${t('features.events.agenda.indicationVotes', 'indications')}`
              : `${totalFinal} ${t('features.events.agenda.votes', 'votes')}`}
          </span>
        </div>

        {options.map(option => (
          <div key={option.key} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {option.icon}
              <span>{option.label}</span>
            </div>

            <div className="space-y-1 pl-1">
              {!isIndicationPhase || showBoth ? (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground w-16 text-[10px]">
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
              ) : null}
              {isIndicationPhase || showBoth ? (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground w-16 text-[10px]">
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
              ) : null}
            </div>
          </div>
        ))}

        {totalFinal === 0 && totalIndication === 0 ? (
          <div className="text-muted-foreground text-xs">
            {t('features.events.agenda.noVotesYet')}
          </div>
        ) : null}

        {totalEligible !== undefined && totalEligible > 0 ? (
          <div className="text-muted-foreground flex justify-between border-t pt-2 text-xs">
            <span>
              {t('features.events.voting.eligible')}: {totalEligible}
            </span>
            <span>
              {t('features.events.voting.voted')}: {visibleTotal}
            </span>
            <span>
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
