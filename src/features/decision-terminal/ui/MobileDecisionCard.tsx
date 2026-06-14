'use client';

import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import { Vote, Award, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { StatusBadge, type DecisionStatus } from './StatusBadge';
import { CountdownTimer, EndedAgo } from './CountdownTimer';
import { CandidateBarCompact, VoteBarCompact } from './VoteProgressBar';
import { TrendIndicator } from './TrendIndicator';
import { ResultBadge } from './ResultBadge';
import type { DecisionItem } from './types';

export interface MobileDecisionCardProps {
  decision: DecisionItem;
  onClick: () => void;
  className?: string;
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

export function MobileDecisionCard({ decision, onClick, className }: MobileDecisionCardProps) {
  const { t } = useTranslation();
  const Icon = decision.type === 'vote' ? Vote : Award;
  const electionBarData = getElectionBarData(decision);
  const votes =
    decision.isIndicationPhase && decision.indicationVotes
      ? decision.indicationVotes
      : decision.votes;

  return (
    <article
      className={cn(
        'bg-card cursor-pointer rounded-lg border p-3 shadow-sm',
        decision.isUrgent && !decision.isClosed && 'border-destructive/50 bg-destructive/5',
        className
      )}
      onClick={onClick}
      data-testid="decision-card"
      data-swipeable="true"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {decision.isClosed ? (
          <ResultBadge
            result={decision.status as 'passed' | 'failed' | 'tied' | 'elected'}
            winnerName={decision.winnerName}
          />
        ) : (
          <StatusBadge status={decision.status as DecisionStatus} />
        )}
        <div className="text-right">
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
      </div>

      <div className="mb-2 flex items-start gap-2">
        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground mr-2 font-mono text-[10px]">{decision.id}</span>
          <h3 className="truncate text-sm leading-tight font-semibold">{decision.title}</h3>
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px] tracking-[1px] uppercase">
            {decision.body}
          </p>
        </div>
      </div>

      {decision.type === 'election' && electionBarData ? (
        <div className="mt-2 mb-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <CandidateBarCompact
              candidates={electionBarData.candidates}
              className="min-w-0 flex-1"
            />
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
              {Math.round(electionBarData.totalSelections)}
            </span>
          </div>
          {!decision.isClosed && <TrendIndicator trend={decision.trend} compact />}
        </div>
      ) : votes ? (
        <div className="mt-2 mb-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <VoteBarCompact votes={votes} className="min-w-0 flex-1" />
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
              {Math.round(votes.support)}/{Math.round(votes.oppose)}/{Math.round(votes.abstain)}
            </span>
          </div>
          {!decision.isClosed && <TrendIndicator trend={decision.trend} compact />}
        </div>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        className="mt-1 h-8 w-full justify-between rounded-md"
        onClick={event => {
          event.stopPropagation();
          onClick();
        }}
      >
        {decision.isClosed ? t('timeline.terminal.viewResults') : t('timeline.terminal.castVote')}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </article>
  );
}
