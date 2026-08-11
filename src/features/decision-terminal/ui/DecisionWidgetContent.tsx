'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Award, CalendarClock, CheckCircle2, Crown, Vote } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PolityLocalListView } from '@/features/shared/virtualization';
import { stripDelegateElectionMetadata } from '@/features/elections/logic/electionAssignmentMetadata';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import {
  BadgeControl,
  DecisionStatusBadge as StatusBadge,
  type DecisionStatus,
} from '@/features/shared/ui/status';
import { DecisionResultCompact as ResultCompact } from '@/features/shared/ui/voting';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { cn } from '@/features/shared/utils/utils';
import type { DecisionTerminalWidgetConfig } from '@/zero/preferences';

import { CountdownTimer, EndedAgo } from './CountdownTimer';
import { DecisionVoteButton } from './DecisionVoteButton';
import type { DecisionItem, DecisionLiveDelta, DecisionLiveDeltaTone } from './types';

interface DecisionWidgetContentProps {
  widget: DecisionTerminalWidgetConfig;
  decisions: DecisionItem[];
  isLoading?: boolean;
  onVoteDecision: (decision: DecisionItem) => void;
}

interface ResultSnapshotEntry {
  key: string;
  label: string;
  value: number;
  tone: DecisionLiveDeltaTone;
}

export function formatInt(value: number | null | undefined) {
  return Math.round(value ?? 0).toString();
}

export function normalizePercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value ?? 0));
}

export function formatCountPercent(
  count: number | null | undefined,
  percent: number | null | undefined
) {
  return `${Math.round(count ?? 0)} · ${normalizePercent(percent).toFixed(0)}%`;
}

export function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function normalizeContextText(value?: string | null) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

export function hasHref(href?: string | null): href is string {
  return Boolean(href && href !== '#');
}

function DecisionLink({
  'data-action-id': actionId,
  href,
  children,
  className,
}: {
  'data-action-id'?: string;
  href?: string | null;
  children: ReactNode;
  className?: string;
}) {
  if (!hasHref(href)) {
    return <span className={className}>{children}</span>;
  }

  return (
    <SmartLink
      href={href}
      data-action-id={actionId}
      className={cn('hover:text-primary hover:underline', className)}
    >
      {children}
    </SmartLink>
  );
}

export function getVoteData(decision: DecisionItem) {
  if (decision.type !== 'vote') return null;
  if (decision.isIndicationPhase && decision.indicationVotes) return decision.indicationVotes;
  return decision.votes ?? null;
}

export function getDecisionTotal(decision: DecisionItem) {
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

export function getResultSnapshot(decision: DecisionItem): ResultSnapshotEntry[] {
  if (decision.type === 'election') {
    return (decision.candidates ?? []).map(candidate => ({
      key: `candidate:${candidate.id}`,
      label: candidate.name,
      value: decision.isIndicationPhase ? (candidate.indicationVotes ?? 0) : (candidate.votes ?? 0),
      tone: 'success',
    }));
  }

  const votes = getVoteData(decision);
  if (!votes) return [];

  return [
    {
      key: 'vote:support',
      label:
        decision.choices?.[0]?.label ??
        translateText('features.timeline.terminal.support', 'Support'),
      value: votes.support,
      tone: 'success',
    },
    {
      key: 'vote:oppose',
      label:
        decision.choices?.[1]?.label ??
        translateText('features.timeline.terminal.oppose', 'Oppose'),
      value: votes.oppose,
      tone: 'danger',
    },
    {
      key: 'vote:abstain',
      label:
        decision.choices?.[2]?.label ??
        translateText('features.timeline.terminal.abstain', 'Abstain'),
      value: votes.abstain,
      tone: 'neutral',
    },
  ];
}

function useDecisionLiveDeltas(decisions: DecisionItem[]) {
  const previousRef = useRef<Map<string, Map<string, ResultSnapshotEntry>>>(new Map());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [deltas, setDeltas] = useState<Map<string, DecisionLiveDelta[]>>(new Map());

  useEffect(() => {
    const nextSnapshot = new Map<string, Map<string, ResultSnapshotEntry>>();
    const previousSnapshot = previousRef.current;

    for (const decision of decisions) {
      const entries = getResultSnapshot(decision);
      const nextEntries = new Map(entries.map(entry => [entry.key, entry]));
      nextSnapshot.set(decision.id, nextEntries);

      const previousEntries = previousSnapshot.get(decision.id);
      if (!previousEntries) continue;

      const nextDeltas = entries
        .map(entry => {
          const previousValue = previousEntries.get(entry.key)?.value ?? 0;
          const change = entry.value - previousValue;
          if (change <= 0) return null;

          return {
            key: entry.key,
            label: entry.label,
            value: change,
            tone: entry.tone,
          } satisfies DecisionLiveDelta;
        })
        .filter((entry): entry is DecisionLiveDelta => entry !== null);

      if (!nextDeltas.length) continue;

      const timeoutKey = decision.id;
      const existingTimeout = timeoutsRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      setDeltas(current => {
        const next = new Map(current);
        next.set(decision.id, nextDeltas);
        return next;
      });

      const timeout = setTimeout(() => {
        setDeltas(current => {
          const next = new Map(current);
          next.delete(decision.id);
          return next;
        });
        timeoutsRef.current.delete(timeoutKey);
      }, 1800);

      timeoutsRef.current.set(timeoutKey, timeout);
    }

    previousRef.current = nextSnapshot;
  }, [decisions]);

  useEffect(
    () => () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    },
    []
  );

  return deltas;
}

export function getDelta(deltas: DecisionLiveDelta[] | undefined, key: string) {
  return deltas?.find(delta => delta.key === key);
}

function LiveDeltaBadge({ delta }: { delta?: DecisionLiveDelta }) {
  if (!delta) return null;

  return (
    <span
      className={cn(
        'animate-in fade-in slide-in-from-bottom-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm',
        delta.tone === 'success' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60',
        delta.tone === 'danger' && 'bg-red-100 text-red-700 dark:bg-red-950/60',
        delta.tone === 'neutral' && 'bg-muted text-muted-foreground'
      )}
      aria-live="polite"
    >
      +{formatInt(delta.value)}
    </span>
  );
}

function DecisionContextLinks({ decision }: { decision: DecisionItem }) {
  const body = decision.body?.trim();
  const agendaItem = decision.agendaItem;
  const shouldShowAgendaItem = Boolean(
    agendaItem &&
    !(
      agendaItem.href === decision.href &&
      normalizeContextText(agendaItem.name) === normalizeContextText(decision.title)
    )
  );

  if (!body && !decision.entity && !shouldShowAgendaItem) {
    return null;
  }

  return (
    <div className="text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      {body ? <span className="truncate">{body}</span> : null}
      {decision.entity ? (
        <DecisionLink
          href={decision.entity.href}
          data-action-id="decision-terminal.widget.entity.open"
          className="truncate"
        >
          {decision.entity.name}
        </DecisionLink>
      ) : null}
      {shouldShowAgendaItem && agendaItem ? (
        <DecisionLink
          href={agendaItem.href}
          data-action-id="decision-terminal.widget.agenda-item.open"
          className="truncate"
        >
          {agendaItem.name}
        </DecisionLink>
      ) : null}
    </div>
  );
}

function DecisionSummaryLine({ decision }: { decision: DecisionItem }) {
  const summary = stripDelegateElectionMetadata(decision.summary)?.trim();
  if (!summary) return null;
  return <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{summary}</p>;
}

function DecisionMetricsLine({ decision }: { decision: DecisionItem }) {
  const parts: string[] = [];

  if (typeof decision.votedCount === 'number' && typeof decision.totalMembers === 'number') {
    parts.push(`${formatInt(decision.votedCount)}/${formatInt(decision.totalMembers)}`);
  }

  if (typeof decision.turnout === 'number') {
    parts.push(`${formatInt(decision.turnout)}%`);
  }

  if (decision.isIndicationPhase) {
    parts.push(translateText('features.timeline.terminal.indicationShort', 'Ind'));
  } else if (decision.phase === 'final') {
    parts.push(translateText('features.timeline.terminal.finalVote', 'Final Vote'));
  }

  if (!parts.length) return null;

  return <div className="text-muted-foreground mt-2 text-xs">{parts.join(' · ')}</div>;
}

export function getVoteResultBarTone(
  decision: DecisionItem,
  row: ResultSnapshotEntry,
  rows: ResultSnapshotEntry[]
): DecisionLiveDeltaTone {
  if (decision.type !== 'vote' || !decision.isClosed) {
    return row.tone;
  }

  const maxValue = Math.max(...rows.map(entry => entry.value));
  if (maxValue <= 0 || row.value !== maxValue) {
    return row.tone;
  }

  return decision.status === 'passed' ? 'success' : 'danger';
}

export function getResultBarClassName(tone: DecisionLiveDeltaTone) {
  switch (tone) {
    case 'success':
      return 'bg-[var(--badge-success-fg)]';
    case 'danger':
      return 'bg-[var(--badge-danger-fg)]';
    default:
      return 'bg-muted-foreground/45';
  }
}

function WidgetLoading() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-md" />
      ))}
    </div>
  );
}

function WidgetEmpty() {
  return (
    <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center p-4 text-center text-sm">
      {translateText(
        'generated.inline.0349_no_matching_decisions_04f8c20a',
        'No matching decisions.'
      )}
    </div>
  );
}

function VoteChoiceRows({
  decision,
  deltas,
}: {
  decision: DecisionItem;
  deltas?: DecisionLiveDelta[];
}) {
  const votes = getVoteData(decision);
  if (!votes) return null;

  const rows = getResultSnapshot(decision);
  const total = Math.max(0, votes.support + votes.oppose + votes.abstain);

  return (
    <div className="space-y-2">
      {rows.map(row => {
        const percent = total > 0 ? (row.value / total) * 100 : 0;
        const tone = getVoteResultBarTone(decision, row, rows);

        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.label}</span>
              <LiveDeltaBadge delta={getDelta(deltas, row.key)} />
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatCountPercent(row.value, percent)}
              </span>
            </div>
            <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', getResultBarClassName(tone))}
                style={{ width: `${normalizePercent(percent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function getElectionCandidateRows(decision: DecisionItem) {
  if (decision.type !== 'election' || !decision.candidates?.length) {
    return [];
  }

  const candidates = decision.candidates.map(candidate => {
    const finalValue = candidate.votes ?? 0;
    const indicationValue = candidate.indicationVotes ?? 0;
    const value = decision.isIndicationPhase ? indicationValue : finalValue;
    const isWinner =
      Boolean(candidate.isWinner) ||
      (decision.isClosed && Boolean(decision.winnerName) && decision.winnerName === candidate.name);

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
  });

  const total = candidates.reduce((sum, candidate) => sum + candidate.value, 0);
  const finalTotal = candidates.reduce((sum, candidate) => sum + candidate.finalValue, 0);
  const indicationTotal = candidates.reduce((sum, candidate) => sum + candidate.indicationValue, 0);

  return candidates
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
    )
    .slice(0, 3);
}

function ElectionCandidateRows({
  decision,
  deltas,
}: {
  decision: DecisionItem;
  deltas?: DecisionLiveDelta[];
}) {
  const rows = getElectionCandidateRows(decision);
  if (!rows.length) return null;

  return (
    <div className="space-y-2">
      {rows.map(candidate => (
        <div
          key={candidate.id}
          className={cn(
            'bg-background/60 space-y-1.5 rounded-md border px-2.5 py-2',
            candidate.isWinner &&
              'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]'
          )}
          data-election-candidate-row="true"
          data-winner={candidate.isWinner ? 'true' : undefined}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0 rounded-md">
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
                    {translateText('features.timeline.terminal.winner', 'Winner')}
                  </BadgeControl>
                ) : null}
              </div>
            </div>
            <LiveDeltaBadge delta={getDelta(deltas, `candidate:${candidate.id}`)} />
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatCountPercent(candidate.value, candidate.percent)}
            </span>
          </div>
          <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full', candidate.isWinner ? 'bg-brand' : 'bg-brand/70')}
              style={{ width: `${normalizePercent(candidate.percent)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionTime({ decision }: { decision: DecisionItem }) {
  if (decision.isClosed) {
    return <EndedAgo endedAt={decision.endsAt} />;
  }

  if (decision.isFutureDecision && decision.startsAt) {
    return (
      <CountdownTimer
        endsAt={decision.startsAt}
        compact
        compactLabel={translateText('features.timeline.terminal.startsIn', 'Starts in')}
      />
    );
  }

  return (
    <CountdownTimer
      endsAt={decision.endsAt}
      compact
      compactLabel={translateText('features.timeline.terminal.closesIn', 'Closes in')}
    />
  );
}

function DecisionStateBadge({ decision }: { decision: DecisionItem }) {
  if (decision.isClosed) {
    return (
      <ResultCompact
        result={decision.status as 'passed' | 'failed' | 'tied' | 'elected'}
        winnerName={decision.type === 'election' ? undefined : decision.winnerName}
      />
    );
  }

  if (decision.isFutureDecision) {
    return (
      <BadgeControl variant="outline" size="xs" className="gap-1">
        <CalendarClock className="h-3 w-3" />
        {translateText('features.decisionTerminal.status.future', 'Upcoming')}
      </BadgeControl>
    );
  }

  return <StatusBadge status={decision.status as DecisionStatus} />;
}

function DecisionPanelRow({
  decision,
  deltas,
  onVoteDecision,
}: {
  decision: DecisionItem;
  deltas?: DecisionLiveDelta[];
  onVoteDecision: (decision: DecisionItem) => void;
}) {
  const Icon = decision.type === 'vote' ? Vote : Award;
  const total = getDecisionTotal(decision);

  return (
    <article
      className={cn(
        'bg-card hover:bg-muted/20 rounded-md border p-3 shadow-sm transition-colors',
        decision.isUrgent && !decision.isClosed && 'border-destructive/40 bg-destructive/5'
      )}
      data-testid={decision.type === 'vote' ? 'vote-row' : 'election-row'}
      data-vote-id={decision.type === 'vote' ? decision.sourceId : undefined}
      data-election-id={decision.type === 'election' ? decision.sourceId : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DecisionLink
                href={decision.href}
                data-action-id="decision-terminal.widget.decision.open"
                className="block truncate text-sm font-semibold"
              >
                {decision.title}
              </DecisionLink>
              <DecisionContextLinks decision={decision} />
            </div>
          </div>
          <DecisionSummaryLine decision={decision} />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <DecisionStateBadge decision={decision} />
          <DecisionTime decision={decision} />
        </div>
      </div>

      <div className="mt-3">
        {decision.type === 'election' ? (
          <ElectionCandidateRows decision={decision} deltas={deltas} />
        ) : (
          <VoteChoiceRows decision={decision} deltas={deltas} />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {formatInt(total)} {translateText('features.timeline.terminal.votes', 'votes')}
          </span>
        </div>
        {decision.canOpenVoteDialog ? (
          <DecisionVoteButton decision={decision} compact onVote={onVoteDecision} />
        ) : null}
      </div>

      <DecisionMetricsLine decision={decision} />
    </article>
  );
}

function VirtualDecisionList({
  widget,
  decisions,
  deltasByDecisionId,
  onVoteDecision,
}: {
  widget: DecisionTerminalWidgetConfig;
  decisions: DecisionItem[];
  deltasByDecisionId: Map<string, DecisionLiveDelta[]>;
  onVoteDecision: (decision: DecisionItem) => void;
}) {
  return (
    <PolityLocalListView
      items={decisions}
      getItemKey={decision => `${widget.id}:${decision.sourceId}`}
      estimateSize={168}
      overscan={6}
      className="h-full overflow-auto p-2"
      renderItem={decision => (
        <DecisionPanelRow
          decision={decision}
          deltas={deltasByDecisionId.get(decision.id)}
          onVoteDecision={onVoteDecision}
        />
      )}
    />
  );
}

export function DecisionWidgetContent({
  widget,
  decisions,
  isLoading = false,
  onVoteDecision,
}: DecisionWidgetContentProps) {
  const stableDecisions = useMemo(() => decisions, [decisions]);
  const deltasByDecisionId = useDecisionLiveDeltas(stableDecisions);

  if (isLoading) return <WidgetLoading />;
  if (decisions.length === 0) return <WidgetEmpty />;

  return (
    <VirtualDecisionList
      widget={widget}
      decisions={decisions}
      deltasByDecisionId={deltasByDecisionId}
      onVoteDecision={onVoteDecision}
    />
  );
}
