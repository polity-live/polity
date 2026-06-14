'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Vote, UserPlus, CheckCircle2, Crown, User, Loader2, Expand } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VoteResultsDisplay, type VoteBarOption } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VoteResultSentence } from '@/features/vote-cast/ui/VoteResultSentence';
import { VotePhaseBadge } from '@/features/vote-cast/ui/VotePhaseBadge';
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
  onOpenNamedResults?: () => void;
  className?: string;
}

/**
 * Build VoteBarOption for a candidate
 */
function buildCandidateOption(
  candidateId: string,
  candidateName: string,
  indicativeCount: number,
  indicativePercent: number,
  finalCount: number,
  finalPercent: number
): VoteBarOption {
  return {
    key: candidateId,
    label: candidateName,
    color: 'bg-primary',
    lightColor: 'bg-blue-400/50',
    finalCount,
    finalPercent,
    indicationCount: indicativeCount,
    indicationPercent: indicativePercent,
  };
}

function getCandidateDisplayName(candidate: CandidatesByElectionRow): string {
  const user = candidate.user;
  if (!user) return candidate.name || 'Unknown';
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return full || user.email || candidate.name || 'Unknown';
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
    const winner = positiveVoteCandidates[0];
    const runnerUp = positiveVoteCandidates[1];

    if (winner && runnerUp && winner.finalCount === runnerUp.finalCount) {
      return [];
    }

    return winner ? [winner.candidate.id] : [];
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
  winnerName,
  winnerVoteSharePercent,
  attendanceMode = 'online',
  offlineTallies = [],
  onOpenNamedResults,
  className,
}: AgendaElectionSectionProps) {
  const { t } = useTranslation();

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
  const ResultsWrapper = isInteractive ? 'button' : 'div';

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            {t('features.events.agenda.electionResults')}
            <VotePhaseBadge
              phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'}
            />
          </CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {attendanceMode ? (
              <Badge variant="outline" className="capitalize">
                {attendanceMode}
              </Badge>
            ) : null}
            {electionMode ? (
              <Badge variant="secondary">
                {getElectionModeSummaryLabel(electionMode, seatCount)}
              </Badge>
            ) : null}
            {isInteractive ? (
              <Badge variant="secondary" className="gap-1">
                <Expand className="h-3 w-3" />
                {translateText('generated.inline.0013_namentlich_8d49da42')}
              </Badge>
            ) : null}
            <Badge variant="outline">{roleName}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {electionStatus === 'runoff_required' ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            {translateText(
              'generated.inline.0014_gleichstand_am_letzten_sitz_fuer_diese_wahl_i_2e1eafc5'
            )}
          </div>
        ) : null}

        <ResultsWrapper
          {...(isInteractive
            ? {
                type: 'button' as const,
                onClick: onOpenNamedResults,
                className:
                  'w-full space-y-6 text-left transition-opacity hover:opacity-95 focus-visible:outline-none',
              }
            : { className: 'space-y-6' })}
        >
          {isClosed && winnerName ? (
            <VoteResultSentence
              type="election"
              result={winnerName ? 'passed' : 'tie'}
              winnerName={winnerName}
              roleName={roleName}
              voteSharePercent={winnerVoteSharePercent}
              isFinal
            />
          ) : null}

          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>
              {isIndicationPhase
                ? `${totalIndicative} ${t('features.events.agenda.indicationVotes')}`
                : `${totalFinal} ${t('features.events.agenda.votes')}`}
            </span>
            <div className="flex items-center gap-2">
              {isIndicationPhase ? (
                <Badge variant="secondary" className="text-xs">
                  * {t('features.events.agenda.indicationOnly')}
                </Badge>
              ) : null}
              {isInteractive ? (
                <Badge variant="outline" className="text-xs">
                  {translateText('generated.inline.0015_klick_fuer_einzelansicht_9d7ff135')}
                </Badge>
              ) : null}
            </div>
          </div>

          {visibleCandidates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <User className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground">{t('features.events.agenda.noCandidates')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleCandidates.map(candidate => {
                const stats = candidateStats.find(s => s.candidate.id === candidate.id);
                const isLeading = winningCandidateIds.includes(candidate.id);
                const isSelected = userSelectedCandidateIds.includes(candidate.id);
                const displayName = getCandidateDisplayName(candidate);

                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      'rounded-lg border p-4 transition-colors',
                      isSelected && 'border-primary bg-primary/5',
                      isLeading &&
                        isClosed &&
                        'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
                    )}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={candidate.user?.avatar ?? undefined} alt={displayName} />
                        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{displayName}</span>
                          <Badge
                            variant={candidate.status === 'accepted' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {candidate.status === 'accepted'
                              ? t('features.events.agenda.candidateAccepted')
                              : t('features.events.agenda.candidateNominated')}
                          </Badge>
                          {isLeading && isClosed ? (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          ) : null}
                          {isSelected ? <CheckCircle2 className="text-primary h-4 w-4" /> : null}
                        </div>
                        {candidate.user?.email && displayName !== candidate.user.email ? (
                          <span className="text-muted-foreground text-sm">
                            {candidate.user.email}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {stats ? (
                      <VoteResultsDisplay
                        options={[
                          buildCandidateOption(
                            candidate.id,
                            displayName,
                            stats.indicativeCount,
                            stats.indicativePercentage,
                            stats.finalCount,
                            stats.finalPercentage
                          ),
                        ]}
                        phase={
                          isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'
                        }
                        totalFinal={totalFinal}
                        totalIndication={totalIndicative}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {userHasVoted ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">
                {isIndicationPhase
                  ? t('features.events.agenda.yourIndication')
                  : t('features.events.agenda.yourVote')}
              </span>
            </div>
          ) : null}
        </ResultsWrapper>

        {/* Become Candidate Button */}
        {!isClosed && canBeCandidate && !isUserCandidate && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={onBecomeCandidate} disabled={isCandidateLoading}>
              {isCandidateLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {t('features.events.agenda.becomeCandidate')}
            </Button>
          </div>
        )}

        {/* Withdraw Candidacy */}
        {!isClosed && isUserCandidate && onWithdrawCandidacy && (
          <div className="flex justify-center pt-4">
            <Button
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
