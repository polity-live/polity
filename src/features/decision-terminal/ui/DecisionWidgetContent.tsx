'use client';

import type { ReactNode } from 'react';
import { Award, BarChart3, Clock3, Vote } from 'lucide-react';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { cn } from '@/features/shared/utils/utils';
import type { DecisionTerminalWidgetConfig } from '@/zero/preferences';
import { CandidateBarCompact, VoteBarCompact, type VoteData } from './VoteProgressBar';
import { CountdownTimer, EndedAgo } from './CountdownTimer';
import { DecisionTable } from './DecisionTable';
import { DecisionVoteButton } from './DecisionVoteButton';
import { ResultCompact } from './ResultBadge';
import { TrendIndicator } from './TrendIndicator';
import type { DecisionItem } from './types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface DecisionWidgetContentProps {
  widget: DecisionTerminalWidgetConfig;
  decisions: DecisionItem[];
  isLoading?: boolean;
  onVoteDecision: (decision: DecisionItem) => void;
}

function formatInt(value: number | null | undefined) {
  return Math.round(value ?? 0).toString();
}

function formatPercent(value: number | null | undefined) {
  return `${Math.round(value ?? 0).toFixed(0)}%`;
}

function getVoteData(decision: DecisionItem): VoteData | null {
  if (decision.type !== 'vote') return null;
  if (decision.isIndicationPhase && decision.indicationVotes) return decision.indicationVotes;
  return decision.votes ?? null;
}

function getDecisionTotal(decision: DecisionItem) {
  if (typeof decision.votedCount === 'number') return Math.round(decision.votedCount);
  const votes = getVoteData(decision);
  if (votes) return Math.round(votes.support + votes.oppose + votes.abstain);
  if (decision.candidates?.length) {
    return Math.round(
      decision.candidates.reduce(
        (sum, candidate) =>
          sum +
          (decision.isIndicationPhase ? (candidate.indicationVotes ?? 0) : (candidate.votes ?? 0)),
        0
      )
    );
  }
  return 0;
}

function getDecisionBar(decision: DecisionItem) {
  if (decision.type === 'election' && decision.candidates?.length) {
    const candidates = decision.candidates
      .map(candidate => ({
        id: candidate.id,
        label: candidate.name,
        value: decision.isIndicationPhase
          ? (candidate.indicationVotes ?? 0)
          : (candidate.votes ?? 0),
      }))
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

    return <CandidateBarCompact candidates={candidates} />;
  }

  const votes = getVoteData(decision);
  if (votes) return <VoteBarCompact votes={votes} />;

  return <div className="bg-muted h-2 rounded-full" />;
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
    <div className="text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]">
      <DecisionLink href={decision.href} className="shrink-0 font-semibold">
        {decision.id}
      </DecisionLink>
      <span className="truncate">{decision.body}</span>
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
      {decision.isIndicationPhase ? (
        <span className="text-primary shrink-0 font-semibold">
          {translateText('generated.inline.0047_ind_caba0e5d')}
        </span>
      ) : null}
    </div>
  );
}

function DecisionSummaryLine({ decision }: { decision: DecisionItem }) {
  if (!decision.summary) return null;

  return <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{decision.summary}</p>;
}

function DecisionMetricsLine({ decision }: { decision: DecisionItem }) {
  const parts: string[] = [];
  if (typeof decision.votedCount === 'number' && typeof decision.totalMembers === 'number') {
    parts.push(`${decision.votedCount}/${decision.totalMembers}`);
  }
  if (typeof decision.turnout === 'number') {
    parts.push(formatPercent(decision.turnout));
  }
  if (decision.type === 'vote') {
    const votes = getVoteData(decision);
    if (votes) {
      parts.push(`${votes.support}/${votes.oppose}/${votes.abstain}`);
    }
  }

  if (!parts.length) return null;

  return (
    <div className="text-muted-foreground mt-1 font-mono text-[11px]">{parts.join(' · ')}</div>
  );
}

function WidgetLoading() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

function WidgetEmpty() {
  return (
    <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center p-4 text-center text-sm">
      {translateText('generated.inline.0349_no_matching_decisions_04f8c20a')}
    </div>
  );
}

function CompactDecisionLine({
  decision,
  onVoteDecision,
  showVote = false,
}: {
  decision: DecisionItem;
  onVoteDecision: (decision: DecisionItem) => void;
  showVote?: boolean;
}) {
  const Icon = decision.type === 'vote' ? Vote : Award;

  return (
    <div
      className={cn(
        'hover:bg-muted/50 grid grid-cols-[minmax(0,1fr)_96px] gap-3 border-b px-3 py-2.5 last:border-b-0',
        decision.isUrgent && !decision.isClosed && 'bg-destructive/5'
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <DecisionLink href={decision.href} className="truncate text-sm font-medium">
            {decision.title}
          </DecisionLink>
        </div>
        <DecisionContextLinks decision={decision} />
        <DecisionSummaryLine decision={decision} />
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">{getDecisionBar(decision)}</div>
          <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
            {formatInt(getDecisionTotal(decision))}
          </span>
        </div>
        <DecisionMetricsLine decision={decision} />
      </div>
      <div className="flex min-w-0 flex-col items-end justify-between gap-1 overflow-hidden">
        {decision.isClosed ? (
          <EndedAgo endedAt={decision.endsAt} />
        ) : decision.isOpeningSoon && decision.startsAt ? (
          <CountdownTimer
            endsAt={decision.startsAt}
            compact
            compactLabel={translateText('generated.inline.0072_starts_fc612a2f')}
          />
        ) : (
          <CountdownTimer
            endsAt={decision.endsAt}
            compact
            compactLabel={translateText('generated.inline.0073_closes_ab16b985')}
          />
        )}
        {showVote ? (
          <DecisionVoteButton decision={decision} compact onVote={onVoteDecision} />
        ) : decision.isClosed ? (
          <ResultCompact
            result={decision.status as 'passed' | 'failed' | 'tied' | 'elected'}
            winnerName={decision.winnerName}
          />
        ) : (
          <TrendIndicator trend={decision.trend} compact />
        )}
      </div>
    </div>
  );
}

function TurnoutMonitor({ decisions }: { decisions: DecisionItem[] }) {
  if (!decisions.length) return <WidgetEmpty />;

  return (
    <div className="divide-y">
      {decisions.map(decision => {
        const turnout = Math.round(decision.turnout ?? 0);
        return (
          <div key={decision.id} className="grid grid-cols-[minmax(0,1fr)_64px] gap-3 px-3 py-2">
            <div className="min-w-0">
              <DecisionLink href={decision.href} className="block truncate text-sm font-medium">
                {decision.title}
              </DecisionLink>
              <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                <DecisionLink href={decision.href}>{decision.id}</DecisionLink> ·{' '}
                {formatInt(decision.votedCount)} / {formatInt(decision.totalMembers)}
              </div>
              <DecisionContextLinks decision={decision} />
              <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full',
                    turnout >= 50 ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, turnout))}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end font-mono text-sm font-semibold">
              {formatPercent(turnout)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ElectionLeaderboard({ decisions }: { decisions: DecisionItem[] }) {
  if (!decisions.length) return <WidgetEmpty />;

  return (
    <div className="divide-y">
      {decisions.map(decision => {
        const leaders =
          decision.candidates
            ?.map(candidate => ({
              id: candidate.id,
              label: candidate.name,
              value: decision.isIndicationPhase
                ? (candidate.indicationVotes ?? 0)
                : (candidate.votes ?? 0),
            }))
            .sort(
              (left, right) => right.value - left.value || left.label.localeCompare(right.label)
            )
            .slice(0, 3) ?? [];
        const top = leaders[0];

        return (
          <div key={decision.id} className="space-y-2 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DecisionLink href={decision.href} className="block truncate text-sm font-medium">
                  {decision.title}
                </DecisionLink>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 font-mono text-[11px]">
                  <DecisionLink href={decision.href}>{decision.id}</DecisionLink>
                  {decision.isIndicationPhase ? (
                    <span className="text-primary font-semibold">
                      {translateText('generated.inline.0047_ind_caba0e5d')}
                    </span>
                  ) : null}
                </div>
                <DecisionContextLinks decision={decision} />
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold">{formatInt(top?.value)}</div>
                <div className="text-muted-foreground truncate text-[11px]">
                  {top?.label ?? translateText('generated.inline.0055_no_votes_e32c7ba3')}
                </div>
              </div>
            </div>
            {leaders.length ? <CandidateBarCompact candidates={leaders} /> : null}
            <DecisionMetricsLine decision={decision} />
          </div>
        );
      })}
    </div>
  );
}

function MetricWidget({ decisions }: { decisions: DecisionItem[] }) {
  const averageTurnout = decisions.length
    ? Math.round(
        decisions.reduce((sum, decision) => sum + (decision.turnout ?? 0), 0) / decisions.length
      )
    : 0;
  const urgent = decisions.filter(decision => decision.isUrgent || decision.isClosingSoon).length;

  return (
    <div className="grid h-full min-h-36 grid-cols-2">
      <div className="border-r p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <BarChart3 className="h-4 w-4" />
          {translateText('generated.inline.0350_average_turnout_99582121')}
        </div>
        <div className="mt-2 font-mono text-3xl font-semibold">{formatPercent(averageTurnout)}</div>
      </div>
      <div className="p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Clock3 className="h-4 w-4" />
          {translateText('generated.inline.0351_needs_attention_a126722e')}
        </div>
        <div
          className={cn('mt-2 font-mono text-3xl font-semibold', urgent > 0 && 'text-destructive')}
        >
          {formatInt(urgent)}
        </div>
      </div>
    </div>
  );
}

export function DecisionWidgetContent({
  widget,
  decisions,
  isLoading = false,
  onVoteDecision,
}: DecisionWidgetContentProps) {
  if (isLoading) return <WidgetLoading />;
  if (decisions.length === 0) return <WidgetEmpty />;

  if (widget.displayMode === 'table') {
    return <DecisionTable decisions={decisions} />;
  }

  if (widget.type === 'turnout_monitor') {
    return <TurnoutMonitor decisions={decisions} />;
  }

  if (widget.type === 'election_leaderboard') {
    return <ElectionLeaderboard decisions={decisions} />;
  }

  if (widget.displayMode === 'metric') {
    return <MetricWidget decisions={decisions} />;
  }

  return (
    <div className="min-h-0">
      {decisions.map(decision => (
        <CompactDecisionLine
          key={decision.id}
          decision={decision}
          onVoteDecision={onVoteDecision}
          showVote={widget.type === 'my_vote_queue'}
        />
      ))}
    </div>
  );
}
