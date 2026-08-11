'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  Vote,
  UserPlus,
  CheckCircle2,
  Crown,
  User,
  Loader2,
  Expand,
  CircleHelp,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipHint,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VotingPhaseBadge as VotePhaseBadge } from '@/features/shared/ui/voting';
import {
  getElectionModeSummaryLabel,
  type ElectionMode,
} from '@/features/elections/logic/electionMode';
import {
  calculateElectionStats,
  getVotingPhase,
} from '@/features/agendas/hooks/useAgendaItemVoting';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';

interface CandidateSelection {
  candidate_id: string;
}

interface ElectionOfflineTallyLike {
  candidate_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

interface AutoAssignedRoleElectionLike {
  role?: {
    scope?: string | null;
    event_id?: string | null;
  } | null;
}

interface AgendaElectionSectionProps {
  roleName: string;
  electionMode?: ElectionMode | null;
  seatCount?: number | null;
  candidates: CandidatesByElectionRow[];
  indicativeSelections: readonly CandidateSelection[];
  finalSelections: readonly CandidateSelection[];
  userHasVoted: boolean;
  userSelectedCandidateIds: string[];
  electionStatus?: string | null;
  canVote: boolean;
  canBeCandidate: boolean;
  isUserCandidate: boolean;
  isVotingLoading?: boolean;
  isCandidateLoading?: boolean;
  onBecomeCandidate: () => void;
  onWithdrawCandidacy?: () => void;
  winnerName?: string;
  winnerVoteSharePercent?: number;
  attendanceMode?: 'online' | 'hybrid' | 'offline' | null;
  offlineTallies?: readonly ElectionOfflineTallyLike[];
  delegateTargetEventId?: string | null;
  delegateTargetEventTitle?: string | null;
  showRoleAssignedMessage?: boolean;
  showEventRoleAssignedMessage?: boolean;
  onOpenNamedResults?: () => void;
  className?: string;
}

export function isEventRoleElection(election: AutoAssignedRoleElectionLike | null | undefined) {
  return election?.role?.scope === 'event' && Boolean(election.role.event_id);
}

export function isAutoAssignedRoleElection(
  election: AutoAssignedRoleElectionLike | null | undefined
) {
  return election?.role?.scope === 'event' || election?.role?.scope === 'group';
}

function getCandidateDisplayName(candidate: CandidatesByElectionRow): string {
  const user = candidate.user;
  if (!user) return candidate.name || 'Unknown';
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return full || user.email || candidate.name || 'Unknown';
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

function getWinningCandidateIds(args: {
  candidateStats: {
    candidate: CandidatesByElectionRow;
    finalCount: number;
  }[];
  electionMode?: ElectionMode | null;
  seatCount?: number | null;
}): string[] {
  const positiveVoteCandidates = [...args.candidateStats]
    .filter(candidate => candidate.finalCount > 0)
    .sort((left, right) => {
      const voteDelta = right.finalCount - left.finalCount;
      if (voteDelta !== 0) {
        return voteDelta;
      }

      const orderDelta =
        (left.candidate.order_index ?? Number.MAX_SAFE_INTEGER) -
        (right.candidate.order_index ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) {
        return orderDelta;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    });

  if (positiveVoteCandidates.length === 0) {
    return [];
  }

  if (args.electionMode !== 'list') {
    // The empty case returned above, so index zero is present by construction.
    const winner = positiveVoteCandidates[0] as (typeof positiveVoteCandidates)[number];
    const runnerUp = positiveVoteCandidates[1];

    if (runnerUp && winner.finalCount === runnerUp.finalCount) {
      return [];
    }

    return [winner.candidate.id];
  }

  const resolvedSeatCount = Math.max(1, args.seatCount ?? 1);
  const winners = positiveVoteCandidates.slice(0, resolvedSeatCount);
  const boundaryWinner = winners[winners.length - 1];
  const nextCandidate = positiveVoteCandidates[winners.length];

  if (
    boundaryWinner &&
    nextCandidate &&
    boundaryWinner.finalCount > 0 &&
    boundaryWinner.finalCount === nextCandidate.finalCount
  ) {
    return [];
  }

  return winners.map(candidate => candidate.candidate.id);
}

/**
 * AgendaElectionSection - Displays election results for an agenda item.
 *
 * Shows candidates with TWO result bars (indicative + final).
 * Winner gets a golden border + Crown icon when status=closed.
 */
export function AgendaElectionSection({
  roleName,
  electionMode,
  seatCount,
  candidates,
  indicativeSelections,
  finalSelections,
  userHasVoted,
  userSelectedCandidateIds,
  electionStatus,
  canBeCandidate,
  isUserCandidate,
  isCandidateLoading,
  onBecomeCandidate,
  onWithdrawCandidacy,
  attendanceMode = 'online',
  offlineTallies = [],
  delegateTargetEventId,
  delegateTargetEventTitle,
  showRoleAssignedMessage,
  showEventRoleAssignedMessage,
  onOpenNamedResults,
  className,
}: AgendaElectionSectionProps) {
  const { t } = useTranslation();
  const [showIndicationResults, setShowIndicationResults] = useState(false);

  const phase = getVotingPhase(electionStatus);
  const isIndicationPhase = phase === 'indicative';
  const isClosed = phase === 'closed';

  // Show all candidates except withdrawn
  const visibleCandidates = useMemo(() => {
    return candidates.filter(c => c.status !== 'withdrawn');
  }, [candidates]);

  const {
    candidates: candidateStats,
    totalIndicative,
    totalFinal,
  } = useMemo(() => {
    return calculateElectionStats(
      visibleCandidates,
      indicativeSelections,
      finalSelections,
      offlineTallies
    );
  }, [finalSelections, indicativeSelections, offlineTallies, visibleCandidates]);

  const winningCandidateIds = useMemo(() => {
    if (!isClosed) {
      return [];
    }

    return getWinningCandidateIds({
      candidateStats,
      electionMode,
      seatCount,
    });
  }, [candidateStats, electionMode, isClosed, seatCount]);

  const isInteractive = Boolean(onOpenNamedResults);
  const openNamedResultsLabel = translateText(
    'generated.inline.0015_klick_fuer_einzelansicht_9d7ff135',
    'Klick für Einzelansicht'
  );
  const noCandidatesLabel = t('features.events.agenda.noCandidates');
  const showDelegateParticipantsAddedMessage =
    isClosed && Boolean(delegateTargetEventId) && winningCandidateIds.length > 0;
  const showRoleWinnersAssignedMessage =
    isClosed &&
    Boolean(showRoleAssignedMessage || showEventRoleAssignedMessage) &&
    !showDelegateParticipantsAddedMessage &&
    winningCandidateIds.length > 0;
  const assignmentSuccessMessage = showDelegateParticipantsAddedMessage
    ? t('features.events.agenda.delegateParticipantsAdded')
    : showRoleWinnersAssignedMessage
      ? t('features.events.agenda.roleWinnersAssigned')
      : null;
  const isCandidateActionBlocked = !canBeCandidate;
  const candidateActionTooltip = isCandidateActionBlocked
    ? t(
        'features.events.agenda.actions.candidateRequiresPassiveVotingRight',
        'Passive Voting Rights are required to become a candidate in this event.'
      )
    : t('features.events.agenda.becomeCandidate');
  const visibleTotal = isIndicationPhase ? totalIndicative : totalFinal;
  const visibleTotalLabel = isIndicationPhase
    ? t('features.events.agenda.indicationVotes')
    : t('features.events.agenda.votes');
  const canToggleIndicationResults = !isIndicationPhase && totalFinal > 0 && totalIndicative > 0;

  return (
    <Card className={cn('overflow-hidden rounded-lg shadow-sm', className)}>
      <CardHeader className="border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Vote className="text-brand h-5 w-5" />
              {t('features.events.agenda.electionResults')}
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BadgeControl variant="outline" className="gap-1">
              {visibleTotal} {visibleTotalLabel}
            </BadgeControl>
            <VotePhaseBadge
              phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final'}
            />
            {attendanceMode ? (
              <BadgeControl
                tone={
                  attendanceMode === 'online'
                    ? 'info'
                    : attendanceMode === 'hybrid'
                      ? 'warning'
                      : 'neutral'
                }
                textTransform="capitalize"
              >
                {attendanceMode}
              </BadgeControl>
            ) : null}
            {electionMode ? (
              <BadgeControl tone="election">
                {getElectionModeSummaryLabel(electionMode, seatCount)}
              </BadgeControl>
            ) : null}
            {isInteractive ? (
              <BadgeControl tone="info" className="gap-1">
                <Expand className="h-3 w-3" />
                {translateText('generated.inline.0013_namentlich_8d49da42')}
              </BadgeControl>
            ) : null}
            {delegateTargetEventId ? (
              <TooltipHint
                content={delegateTargetEventTitle ?? ''}
                disabled={!delegateTargetEventTitle}
              >
                <BadgeControl asChild tone="event" className="hover:opacity-90">
                  <Link to="/event/$id" params={{ id: delegateTargetEventId }}>
                    {roleName}
                  </Link>
                </BadgeControl>
              </TooltipHint>
            ) : (
              <BadgeControl variant="outline">{roleName}</BadgeControl>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {electionStatus === 'runoff_required' ? (
          <div className={featureThemeClassName('agendaAgendaElectionSectionWarningBadge')}>
            {translateText(
              'generated.inline.0014_gleichstand_am_letzten_sitz_fuer_diese_wahl_i_2e1eafc5'
            )}
          </div>
        ) : null}

        <div className="space-y-5">
          <div className="flex items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              {isIndicationPhase ? (
                <BadgeControl variant="secondary" size="xs">
                  * {t('features.events.agenda.indicationOnly')}
                </BadgeControl>
              ) : null}
              {canToggleIndicationResults ? (
                <BadgeControl
                  asChild
                  variant={showIndicationResults ? 'secondary' : 'outline'}
                  size="xs"
                >
                  <button
                    data-action-id="agendas.election.indication-results.toggle"
                    data-action-kind="selection"
                    type="button"
                    onClick={() => setShowIndicationResults(current => !current)}
                  >
                    {showIndicationResults
                      ? t('features.events.agenda.hideIndicationResults', 'Hide indication results')
                      : t(
                          'features.events.agenda.showIndicationResults',
                          'Show indication results'
                        )}
                  </button>
                </BadgeControl>
              ) : null}
              {isInteractive && onOpenNamedResults ? (
                <BadgeControl asChild tone="accent" size="xs" className="cursor-pointer gap-1">
                  <button
                    data-action-id="agendas.election.named-results.open"
                    data-action-kind="interaction"
                    type="button"
                    onClick={onOpenNamedResults}
                  >
                    <Expand className="h-3 w-3" />
                    {openNamedResultsLabel}
                  </button>
                </BadgeControl>
              ) : null}
            </div>
          </div>

          {visibleCandidates.length === 0 ? (
            isInteractive && onOpenNamedResults ? (
              <button
                data-action-id="agendas.election.named-results.open"
                data-action-kind="interaction"
                type="button"
                onClick={onOpenNamedResults}
                className="group focus-visible:ring-ring w-full rounded-lg border border-dashed border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] p-6 text-center text-[var(--badge-info-fg)] transition-[color,background-color,border-color,box-shadow] hover:border-[var(--badge-info-border)] hover:bg-[var(--badge-info-bg)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <User className="mx-auto mb-2 h-8 w-8 text-current/70 transition-colors group-hover:text-current" />
                <p className="font-medium">{noCandidatesLabel}</p>
                <BadgeControl tone="accent" size="xs" className="mt-3 inline-flex gap-1">
                  <Expand className="h-3 w-3" />
                  {openNamedResultsLabel}
                </BadgeControl>
              </button>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] p-6 text-center text-[var(--badge-neutral-fg)]">
                <User className="mx-auto mb-2 h-8 w-8 text-current/70" />
                <p>{noCandidatesLabel}</p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {visibleCandidates.map(candidate => {
                const stats = candidateStats.find(s => s.candidate.id === candidate.id);
                if (!stats) return null;
                const isLeading = winningCandidateIds.includes(candidate.id);
                const isSelected = isInteractive && userSelectedCandidateIds.includes(candidate.id);
                const shouldFrameCandidate = isSelected || (isLeading && isClosed);
                const displayName = getCandidateDisplayName(candidate);
                const visibleCount = isIndicationPhase ? stats.indicativeCount : stats.finalCount;
                const visiblePercent = isIndicationPhase
                  ? stats.indicativePercentage
                  : stats.finalPercentage;
                const indicationCount = stats.indicativeCount;
                const indicationPercent = stats.indicativePercentage;

                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      'space-y-2 px-3 py-2 transition-[background-color,border-color,box-shadow]',
                      shouldFrameCandidate && 'bg-card rounded-lg border py-3 shadow-sm',
                      isSelected && 'border-primary/30 bg-primary/5',
                      isLeading &&
                        isClosed &&
                        featureThemeClassName('agendaAgendaElectionSectionWarningSurface')
                    )}
                    data-election-candidate-row="true"
                    data-winner={isLeading && isClosed ? 'true' : undefined}
                    data-selected={isSelected ? 'true' : undefined}
                    data-framed={shouldFrameCandidate ? 'true' : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 rounded-md">
                        <AvatarImage src={candidate.user?.avatar ?? undefined} alt={displayName} />
                        <AvatarFallback className="rounded-md text-sm font-semibold">
                          {displayName
                            .split(' ')
                            .map(part => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{displayName}</span>
                          <BadgeControl
                            tone={candidate.status === 'accepted' ? 'success' : 'warning'}
                            size="xs"
                          >
                            {candidate.status === 'accepted'
                              ? t('features.events.agenda.candidateAccepted')
                              : t('features.events.agenda.candidateNominated')}
                          </BadgeControl>
                          {isLeading && isClosed ? (
                            <BadgeControl tone="warning" size="xs" className="gap-1">
                              <Crown className="h-3.5 w-3.5" />
                              {t('features.events.agenda.winner', 'Winner')}
                            </BadgeControl>
                          ) : null}
                          {isSelected ? (
                            <BadgeControl variant="secondary" size="xs" className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t('features.events.agenda.selected', 'Selected')}
                            </BadgeControl>
                          ) : null}
                        </div>
                        {candidate.user?.email && displayName !== candidate.user.email ? (
                          <span className="text-muted-foreground block truncate text-sm">
                            {candidate.user.email}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {formatCountPercent(visibleCount, visiblePercent)}
                      </span>
                    </div>
                    <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          isLeading && isClosed ? 'bg-brand' : 'bg-brand/70'
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, visiblePercent))}%` }}
                      />
                    </div>
                    {canToggleIndicationResults && showIndicationResults ? (
                      <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2">
                        <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                          {t('features.events.agenda.indicationShort')}
                        </span>
                        <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                          <div
                            className="bg-brand/35 h-full rounded-full"
                            style={{ width: `${normalizePercent(indicationPercent)}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatCountPercent(indicationCount, indicationPercent)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {assignmentSuccessMessage ? (
            <div className="flex items-start gap-2 rounded-md border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-2 text-sm text-[var(--badge-success-fg)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{assignmentSuccessMessage}</span>
            </div>
          ) : null}

          {userHasVoted ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <CheckCircle2
                className={featureThemeClassName('agendaAgendaElectionSectionSuccessIcon')}
              />
              <span className="text-muted-foreground">
                {isIndicationPhase
                  ? t('features.events.agenda.yourIndication')
                  : t('features.events.agenda.yourVote')}
              </span>
            </div>
          ) : null}
        </div>

        {/* Become Candidate Button */}
        {!isClosed && !isUserCandidate && onBecomeCandidate && (
          <div className="flex justify-center pt-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-action-id="agendas.election.candidacy.become"
                  data-action-kind="async-action"
                  variant="outline"
                  onClick={isCandidateActionBlocked ? undefined : onBecomeCandidate}
                  disabled={isCandidateLoading}
                  aria-disabled={isCandidateActionBlocked || undefined}
                  className={cn(
                    isCandidateActionBlocked &&
                      'border-muted-foreground/30 text-muted-foreground opacity-70'
                  )}
                >
                  {isCandidateLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {t('features.events.agenda.becomeCandidate')}
                  {isCandidateActionBlocked ? <CircleHelp className="h-4 w-4" /> : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{candidateActionTooltip}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Withdraw Candidacy */}
        {!isClosed && isUserCandidate && onWithdrawCandidacy && (
          <div className="flex justify-center pt-4">
            <Button
              data-action-id="agendas.election.candidacy.withdraw"
              data-action-kind="async-action"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={onWithdrawCandidacy}
              disabled={isCandidateLoading}
            >
              {t('features.events.agenda.withdrawCandidacy')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
