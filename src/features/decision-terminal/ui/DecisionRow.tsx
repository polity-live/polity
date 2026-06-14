'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/features/shared/utils/utils';
import {
  DecisionStatusBadge as StatusBadge,
  type DecisionStatus,
} from '@/features/shared/ui/status';
import { DecisionResultCompact as ResultCompact } from '@/features/shared/ui/voting';
import { Vote, Award } from 'lucide-react';
import { TrendIndicator } from './TrendIndicator';
import { CountdownTimer, EndedAgo } from './CountdownTimer';
import { CandidateBarCompact, VoteBarCompact } from './VoteProgressBar';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { DecisionItem } from './types';

export interface DecisionRowProps {
  decision: DecisionItem;
}

function getElectionBarData(decision: DecisionItem) {
  if (decision.type !== 'election' || !decision.candidates?.length) {
    return null;
  }

  const candidates = decision.candidates
    .map(candidate => ({
      id: candidate.id,
      label: candidate.name,
      value: decision.isIndicationPhase ? candidate.indicationVotes || 0 : candidate.votes || 0,
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

  return {
    totalSelections:
      decision.votedCount ?? candidates.reduce((total, candidate) => total + candidate.value, 0),
    candidates,
  };
}

function hasHref(href?: string | null): href is string {
  return Boolean(href && href !== '#');
}

function DecisionLink({
  href,
  children,
  className,
}: {
  href?: string | null;
  children: ReactNode;
  className?: string;
}) {
  if (!hasHref(href)) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a href={href} className={cn('hover:text-primary hover:underline', className)}>
      {children}
    </a>
  );
}

function DecisionContextLinks({ decision }: { decision: DecisionItem }) {
  return (
    <div className={featureThemeClassName('decisionterminalDecisionRowThemedText')}>
      {decision.entity ? (
        <DecisionLink href={decision.entity.href} className="truncate">
          {decision.entity.name}
        </DecisionLink>
      ) : null}
      {decision.agendaItem ? (
        <DecisionLink href={decision.agendaItem.href} className="truncate">
          {decision.agendaItem.name}
        </DecisionLink>
      ) : null}
      {decision.summary ? (
        <span className="line-clamp-1 normal-case">{decision.summary}</span>
      ) : null}
    </div>
  );
}

/**
 * Single row in the Decision Table
 * Shows ID, title, body, time, status, and trend
 * Includes flash effect when values change significantly
 */
export function DecisionRow({ decision }: DecisionRowProps) {
  const { t } = useTranslation();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTrendRef = useRef(decision.trend.percentage);
  const electionBarData = getElectionBarData(decision);
  const gridColumnsClass = 'grid-cols-[70px_minmax(0,0.9fr)_120px_92px_104px_170px_72px]';

  // Flash effect when trend changes significantly (> 2%)
  useEffect(() => {
    const change = Math.abs(decision.trend.percentage - prevTrendRef.current);
    if (change >= 2) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 500);
      prevTrendRef.current = decision.trend.percentage;
      return () => clearTimeout(timer);
    }
    prevTrendRef.current = decision.trend.percentage;
  }, [decision.trend.percentage]);

  const Icon = decision.type === 'vote' ? Vote : Award;

  return (
    <div
      className={cn(
        'grid gap-2 px-2 py-1.5 transition-colors',
        gridColumnsClass,
        'hover:bg-muted/50',
        isFlashing && 'animate-flash-yellow'
      )}
      role="row"
      data-testid={decision.type === 'vote' ? 'vote-row' : 'election-row'}
      data-vote-id={decision.type === 'vote' ? decision.sourceId : undefined}
      data-election-id={decision.type === 'election' ? decision.sourceId : undefined}
    >
      {/* ID */}
      <div className="flex items-center gap-1">
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
        <DecisionLink
          href={decision.href}
          className={featureThemeClassName('decisionterminalDecisionRowThemedTextAlpha')}
        >
          {decision.id}
        </DecisionLink>
      </div>

      {/* Title */}
      <div className="min-w-0">
        <DecisionLink href={decision.href} className="block truncate text-xs font-medium">
          {decision.title}
        </DecisionLink>
        <DecisionContextLinks decision={decision} />
      </div>

      {/* Body/Category */}
      <div className="flex items-center">
        <span className={featureThemeClassName('decisionterminalDecisionRowThemedTextBeta')}>
          {decision.body}
        </span>
      </div>

      {/* Time */}
      <div className="flex items-center">
        {decision.isClosed ? (
          <EndedAgo endedAt={decision.endsAt} />
        ) : decision.isOpeningSoon && decision.startsAt ? (
          <CountdownTimer
            endsAt={decision.startsAt}
            compact
            compactLabel={t('timeline.terminal.startsIn')}
          />
        ) : (
          <CountdownTimer
            endsAt={decision.endsAt}
            compact
            compactLabel={t('timeline.terminal.closesIn')}
          />
        )}
      </div>

      {/* Status */}
      <div className="flex min-w-0 items-center">
        {decision.isClosed ? (
          <ResultCompact
            result={decision.status as 'passed' | 'failed' | 'tied' | 'elected'}
            winnerName={decision.winnerName}
          />
        ) : (
          <StatusBadge
            status={decision.status as DecisionStatus}
            className={featureThemeClassName('agendaAccreditationSectionThemedText')}
          />
        )}
      </div>

      {/* Votes */}
      <div className="flex items-center">
        {decision.type === 'election' && electionBarData ? (
          <div className="flex w-full items-center gap-2 overflow-hidden">
            {decision.isIndicationPhase && (
              <span className="text-primary shrink-0 font-mono text-[9px] font-semibold uppercase">
                {t('timeline.terminal.indication')}
              </span>
            )}
            {!decision.isIndicationPhase && electionBarData.candidates.some(c => c.value > 0) && (
              <span className={featureThemeClassName('decisionterminalDecisionRowThemedTextGamma')}>
                {t('timeline.terminal.indication')} →
              </span>
            )}
            <CandidateBarCompact
              candidates={electionBarData.candidates}
              className="min-w-0 flex-1"
            />
            <span className={featureThemeClassName('decisionterminalDecisionRowThemedTextDelta')}>
              {electionBarData.totalSelections}
            </span>
          </div>
        ) : decision.votes ? (
          <div className="flex w-full items-center gap-2 overflow-hidden">
            {decision.isIndicationPhase && decision.indicationVotes ? (
              <span className="text-primary shrink-0 font-mono text-[9px] font-semibold uppercase">
                {t('timeline.terminal.indication')}
              </span>
            ) : decision.indicationVotes && !decision.isIndicationPhase ? (
              <span className={featureThemeClassName('decisionterminalDecisionRowThemedTextGamma')}>
                {t('timeline.terminal.indication')} →
              </span>
            ) : null}
            <VoteBarCompact
              votes={
                decision.isIndicationPhase && decision.indicationVotes
                  ? decision.indicationVotes
                  : decision.votes
              }
              className={cn('min-w-0 flex-1', decision.isIndicationPhase && 'opacity-70')}
            />
            <span className={featureThemeClassName('decisionterminalDecisionRowThemedTextDelta')}>
              {(() => {
                const v =
                  decision.isIndicationPhase && decision.indicationVotes
                    ? decision.indicationVotes
                    : decision.votes;
                return `${v.support}/${v.oppose}/${v.abstain}`;
              })()}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </div>

      {/* Trend */}
      <div className="flex items-center">
        {decision.isClosed && decision.supportPercentage !== undefined ? (
          <span className="text-muted-foreground font-mono text-xs">
            {decision.supportPercentage}%
          </span>
        ) : (
          <TrendIndicator trend={decision.trend} compact />
        )}
      </div>
    </div>
  );
}
