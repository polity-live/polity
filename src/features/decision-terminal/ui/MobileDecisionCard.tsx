'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import {
  BadgeControl,
  DecisionStatusBadge as StatusBadge,
  type DecisionStatus,
} from '@/features/shared/ui/status';
import { DecisionResultBadge as ResultBadge } from '@/features/shared/ui/voting';
import { Vote, Award, ChevronRight, Crown } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useState } from 'react';
import { CountdownTimer, EndedAgo } from './CountdownTimer';
import { VoteBarCompact } from './VoteProgressBar';
import { TrendIndicator } from './TrendIndicator';
import type { DecisionItem } from './types';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';

export interface MobileDecisionCardProps {
  decision: DecisionItem;
  onClick: () => void;
  className?: string;
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

function normalizePercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value ?? 0));
}

function formatCountPercent(count: number | null | undefined, percent: number | null | undefined) {
  return `${Math.round(count ?? 0)} · ${normalizePercent(percent).toFixed(0)}%`;
}

function getElectionCandidateRows(decision: DecisionItem) {
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

function ElectionCandidateRows({ decision }: { decision: DecisionItem }) {
  const [showIndicationResults, setShowIndicationResults] = useState(false);
  const rows = getElectionCandidateRows(decision);
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
    <div className="space-y-1.5">
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

export function MobileDecisionCard({ decision, onClick, className }: MobileDecisionCardProps) {
  const { t } = useTranslation();
  const Icon = decision.type === 'vote' ? Vote : Award;
  const hasElectionCandidates =
    decision.type === 'election' && Boolean(decision.candidates?.length);
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
            winnerName={decision.type === 'election' ? undefined : decision.winnerName}
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
          <span className={featureThemeClassName('decisionterminalMobileDecisionCardThemedText')}>
            {decision.id}
          </span>
          <h3 className="truncate text-sm leading-tight font-semibold">{decision.title}</h3>
          <p className={featureThemeClassName('decisionterminalMobileDecisionCardThemedTextAlpha')}>
            {decision.body}
          </p>
        </div>
      </div>

      {hasElectionCandidates ? (
        <div className="mt-2 mb-2 space-y-1.5">
          <ElectionCandidateRows decision={decision} />
          {!decision.isClosed && <TrendIndicator trend={decision.trend} compact />}
        </div>
      ) : votes ? (
        <div className="mt-2 mb-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <VoteBarCompact votes={votes} className="min-w-0 flex-1" />
            <span className={featureThemeClassName('decisionterminalDecisionRowThemedTextDelta')}>
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
