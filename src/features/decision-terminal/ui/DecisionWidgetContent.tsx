'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { useState, type ReactNode } from 'react';
import { Award, BarChart3, Clock3, Crown, Vote } from 'lucide-react';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { DecisionResultCompact as ResultCompact } from '@/features/shared/ui/voting';
import { BadgeControl } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { cn } from '@/features/shared/utils/utils';
import type { DecisionTerminalWidgetConfig } from '@/zero/preferences';
import { VoteBarCompact, type VoteData } from './VoteProgressBar';
import { CountdownTimer, EndedAgo } from './CountdownTimer';
import { DecisionTable } from './DecisionTable';
import { DecisionVoteButton } from './DecisionVoteButton';
import { TrendIndicator } from './TrendIndicator';
import type { DecisionItem } from './types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';

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

function normalizePercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value ?? 0));
}

function formatCountPercent(count: number | null | undefined, percent: number | null | undefined) {
  return `${Math.round(count ?? 0)} · ${normalizePercent(percent).toFixed(0)}%`;
}

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
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
    return <ElectionCandidateRows decision={decision} limit={2} compact />;
  }

  const votes = getVoteData(decision);
  if (votes) return <VoteBarCompact votes={votes} />;

  return <div className="bg-muted/40 h-2 rounded-full" />;
}

function getElectionCandidateRows(decision: DecisionItem, limit?: number) {
  const candidates =
    decision.candidates?.map(candidate => {
      const finalValue = candidate.votes ?? 0;
      const indicationValue = candidate.indicationVotes ?? 0;
      const value = decision.isIndicationPhase ? indicationValue : finalValue;
      const isWinner =
        Boolean(candidate.isWinner) ||
        (decision.isClosed &&
          Boolean(decision.winnerName) &&
          decision.winnerName === candidate.name);

      return {
        id: candidate.id,
        label: candidate.name,
        avatarUrl: candidate.avatarUrl,
        value,
        finalValue,
        indicationValue,
        finalExplicitPercent: candidate.actualPercentage,
        indicationExplicitPercent: candidate.indicationPercentage,
        isWinner,
      };
    }) ?? [];

  const total = candidates.reduce((sum, candidate) => sum + candidate.value, 0);
  const finalTotal = candidates.reduce((sum, candidate) => sum + candidate.finalValue, 0);
  const indicationTotal = candidates.reduce((sum, candidate) => sum + candidate.indicationValue, 0);
  const rows = candidates
    .map(candidate => ({
      ...candidate,
      percent:
        (decision.isIndicationPhase
          ? candidate.indicationExplicitPercent
          : candidate.finalExplicitPercent) !== undefined
          ? Math.round(
              decision.isIndicationPhase
                ? (candidate.indicationExplicitPercent ?? 0)
                : (candidate.finalExplicitPercent ?? 0)
            )
          : total > 0
            ? Math.round((candidate.value / total) * 100)
            : 0,
      finalPercent:
        candidate.finalExplicitPercent !== undefined
          ? Math.round(candidate.finalExplicitPercent)
          : finalTotal > 0
            ? Math.round((candidate.finalValue / finalTotal) * 100)
            : 0,
      indicationPercent:
        candidate.indicationExplicitPercent !== undefined
          ? Math.round(candidate.indicationExplicitPercent)
          : indicationTotal > 0
            ? Math.round((candidate.indicationValue / indicationTotal) * 100)
            : 0,
    }))
    .sort(
      (left, right) =>
        Number(right.isWinner) - Number(left.isWinner) ||
        right.value - left.value ||
        left.label.localeCompare(right.label)
    );

  return limit ? rows.slice(0, limit) : rows;
}

function ElectionCandidateRows({
  decision,
  limit,
  compact,
}: {
  decision: DecisionItem;
  limit?: number;
  compact?: boolean;
}) {
  const [showIndicationResults, setShowIndicationResults] = useState(false);
  const rows = getElectionCandidateRows(decision, limit);
  if (!rows.length) return null;

  const canToggleIndicationResults =
    !decision.isIndicationPhase &&
    Boolean(decision.candidates?.some(candidate => (candidate.votes ?? 0) > 0)) &&
    Boolean(
      decision.candidates?.some(
        candidate =>
          (candidate.indicationVotes ?? 0) > 0 || candidate.indicationPercentage !== undefined
      )
    );

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {canToggleIndicationResults ? (
        <div className="flex justify-end">
          <BadgeControl asChild variant={showIndicationResults ? 'secondary' : 'outline'} size="xs">
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setShowIndicationResults(current => !current);
              }}
            >
              {showIndicationResults
                ? translateText(
                    'features.events.agenda.hideIndicationResults',
                    'Hide indication results'
                  )
                : translateText(
                    'features.events.agenda.showIndicationResults',
                    'Show indication results'
                  )}
            </button>
          </BadgeControl>
        </div>
      ) : null}
      {rows.map(candidate => (
        <div
          key={candidate.id}
          className={cn(
            'bg-card space-y-1.5 rounded-lg border px-2.5 py-2 shadow-sm',
            candidate.isWinner &&
              'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]'
          )}
          data-election-candidate-row="true"
          data-winner={candidate.isWinner ? 'true' : undefined}
        >
          <div className="flex items-center gap-2">
            <Avatar className={cn('shrink-0 rounded-md', compact ? 'h-8 w-8' : 'h-9 w-9')}>
              <AvatarImage src={candidate.avatarUrl} alt={candidate.label} />
              <AvatarFallback className="rounded-md text-xs font-semibold">
                {getInitials(candidate.label)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-medium">{candidate.label}</span>
                {candidate.isWinner ? (
                  <BadgeControl tone="warning" size="tiny" className="gap-1">
                    <Crown className="h-3 w-3" />
                    {translateText('generated.inline.0352_winner_8fbf76a8', 'Winner')}
                  </BadgeControl>
                ) : null}
              </div>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatCountPercent(candidate.value, candidate.percent)}
            </span>
          </div>
          <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full', candidate.isWinner ? 'bg-brand' : 'bg-brand/70')}
              style={{ width: `${Math.max(0, Math.min(100, candidate.percent))}%` }}
            />
          </div>
          {canToggleIndicationResults && showIndicationResults ? (
            <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2">
              <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                {translateText('features.events.agenda.indicationShort', 'IND')}
              </span>
              <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-brand/35 h-full rounded-full"
                  style={{ width: `${normalizePercent(candidate.indicationPercent)}%` }}
                />
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatCountPercent(candidate.indicationValue, candidate.indicationPercent)}
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
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
    <SmartLink href={href} className={cn('hover:text-primary hover:underline', className)}>
      {children}
    </SmartLink>
  );
}

function DecisionContextLinks({ decision }: { decision: DecisionItem }) {
  return (
    <div className={featureThemeClassName('decisionterminalDecisionWidgetContentThemedText')}>
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
    <div className={featureThemeClassName('decisionterminalDecisionWidgetContentThemedTextAlpha')}>
      {parts.join(' · ')}
    </div>
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
  const hasElectionCandidates =
    decision.type === 'election' && Boolean(decision.candidates?.length);

  return (
    <div
      className={cn(
        'bg-card hover:bg-muted/30 grid grid-cols-[minmax(0,1fr)_96px] gap-3 rounded-lg border px-3 py-2.5 shadow-sm transition-colors',
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
        {hasElectionCandidates ? (
          <div className="mt-2">
            <ElectionCandidateRows decision={decision} limit={2} compact />
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">{getDecisionBar(decision)}</div>
            <span
              className={featureThemeClassName(
                'decisionterminalDecisionWidgetContentThemedTextBeta'
              )}
            >
              {formatInt(getDecisionTotal(decision))}
            </span>
          </div>
        )}
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
            winnerName={decision.type === 'election' ? undefined : decision.winnerName}
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
    <div className="space-y-2 p-2">
      {decisions.map(decision => {
        const turnout = Math.round(decision.turnout ?? 0);
        return (
          <div
            key={decision.id}
            className="bg-card grid grid-cols-[minmax(0,1fr)_64px] gap-3 rounded-lg border px-3 py-2 shadow-sm"
          >
            <div className="min-w-0">
              <DecisionLink href={decision.href} className="block truncate text-sm font-medium">
                {decision.title}
              </DecisionLink>
              <div
                className={featureThemeClassName(
                  'decisionterminalDecisionWidgetContentThemedTextGamma'
                )}
              >
                <DecisionLink href={decision.href}>{decision.id}</DecisionLink> ·{' '}
                {formatInt(decision.votedCount)} / {formatInt(decision.totalMembers)}
              </div>
              <DecisionContextLinks decision={decision} />
              <div className="bg-muted/40 mt-2 h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full',
                    turnout >= 50
                      ? featureThemeClassName(
                          'decisionterminalDecisionWidgetContentSuccessBackground'
                        )
                      : featureThemeClassName(
                          'decisionterminalDecisionWidgetContentWarningBackground'
                        )
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
    <div className="space-y-2 p-2">
      {decisions.map(decision => {
        const leaders = getElectionCandidateRows(decision, 3);
        const top = leaders[0];

        return (
          <div
            key={decision.id}
            className="bg-card space-y-2 rounded-lg border px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DecisionLink href={decision.href} className="block truncate text-sm font-medium">
                  {decision.title}
                </DecisionLink>
                <div
                  className={featureThemeClassName(
                    'decisionterminalDecisionWidgetContentThemedTextDelta'
                  )}
                >
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
                <div className="font-mono text-sm font-semibold">
                  {formatCountPercent(top?.value, top?.percent)}
                </div>
                <div
                  className={featureThemeClassName(
                    'decisionterminalDecisionWidgetContentThemedTextEpsilon'
                  )}
                >
                  {top?.label ?? translateText('generated.inline.0055_no_votes_e32c7ba3')}
                </div>
              </div>
            </div>
            <ElectionCandidateRows decision={decision} limit={3} compact />
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
    <div className="min-h-0 space-y-2 p-2">
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
