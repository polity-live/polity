'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Vote, CheckCircle2, Crown, Expand } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VoteResultsDisplay } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VoteResultSentence } from '@/features/vote-cast/ui/VoteResultSentence';
import { VotePhaseBadge } from '@/features/vote-cast/ui/VotePhaseBadge';
import {
  computeVoteResultSummary,
  type ChoiceOfflineTally,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { calculateVoteStats, getVotingPhase } from '@/features/agendas/hooks/useAgendaItemVoting';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';

interface ChoiceDecision {
  choice_id: string;
}

type VoteOfflineTallyLike = ChoiceOfflineTally;

function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

// Color palette for choices
const CHOICE_COLORS = [
  { color: 'bg-green-500', light: 'bg-green-300/60' },
  { color: 'bg-red-500', light: 'bg-red-300/60' },
  { color: 'bg-gray-400', light: 'bg-gray-300/60' },
  { color: 'bg-blue-500', light: 'bg-blue-300/60' },
  { color: 'bg-purple-500', light: 'bg-purple-300/60' },
  { color: 'bg-orange-500', light: 'bg-orange-300/60' },
];

interface AgendaVoteSectionProps {
  voteTitle: string;
  choices: ChoicesByVoteRow[];
  indicativeDecisions: readonly ChoiceDecision[];
  finalDecisions: readonly ChoiceDecision[];
  userHasVoted: boolean;
  userSelectedChoiceIds: string[];
  voteStatus?: string | null;
  voteResult?: 'passed' | 'rejected' | 'tie';
  voteSharePercent?: number;
  majorityType?: string | null;
  totalEligibleVoters?: number;
  voteId?: string;
  attendanceMode?: 'online' | 'hybrid' | 'offline' | null;
  offlineTallies?: readonly VoteOfflineTallyLike[];
  canManageOfflineResults?: boolean;
  offlineEligibleCount?: number;
  onOpenNamedResults?: () => void;
  className?: string;
}

/**
 * AgendaVoteSection - Displays vote results for an agenda item.
 *
 * Shows dynamic choices from vote_choice table with TWO result bars
 * (indicative + final). Winner gets golden border + crown when status=closed.
 */
export function AgendaVoteSection({
  voteTitle,
  choices,
  indicativeDecisions,
  finalDecisions,
  userHasVoted,
  userSelectedChoiceIds,
  voteStatus,
  voteResult,
  voteSharePercent,
  majorityType,
  totalEligibleVoters,
  attendanceMode = 'online',
  offlineTallies = [],
  onOpenNamedResults,
  className,
}: AgendaVoteSectionProps) {
  const { t } = useTranslation();

  const phase = getVotingPhase(voteStatus);
  const isIndicationPhase = phase === 'indicative';
  const isClosed = phase === 'closed';

  const {
    choices: choiceStats,
    totalIndicative,
    totalFinal,
  } = useMemo(() => {
    return calculateVoteStats(choices, indicativeDecisions, finalDecisions, offlineTallies);
  }, [choices, finalDecisions, indicativeDecisions, offlineTallies]);

  const computedVoteSummary = useMemo(() => {
    if (!isClosed || choiceStats.length === 0) {
      return null;
    }

    return computeVoteResultSummary(
      choices.map((choice, idx) => ({
        id: choice.id,
        label: choice.label || `Choice ${idx + 1}`,
        order_index: choice.order_index ?? idx,
      })),
      finalDecisions,
      totalEligibleVoters ?? totalFinal,
      normalizeMajorityType(majorityType),
      offlineTallies
    );
  }, [
    choiceStats.length,
    choices,
    finalDecisions,
    isClosed,
    majorityType,
    offlineTallies,
    totalEligibleVoters,
    totalFinal,
  ]);

  const resolvedVoteResult: VoteResult | undefined = voteResult ?? computedVoteSummary?.result;

  // Find the winning choice in final results
  const leadingChoiceId = useMemo(() => {
    if (choiceStats.length === 0) return null;
    const maxVotes = Math.max(
      ...choiceStats.map(s => (isClosed || !isIndicationPhase ? s.finalCount : s.indicativeCount))
    );
    if (maxVotes === 0) return null;
    return choiceStats.find(
      s => (isClosed || !isIndicationPhase ? s.finalCount : s.indicativeCount) === maxVotes
    )?.choice.id;
  }, [choiceStats, isIndicationPhase, isClosed]);

  const winningChoiceId = useMemo(() => {
    if (resolvedVoteResult === 'tie') {
      return null;
    }

    if (isClosed) {
      return computedVoteSummary?.winningChoiceId ?? leadingChoiceId;
    }

    return leadingChoiceId;
  }, [computedVoteSummary?.winningChoiceId, isClosed, leadingChoiceId, resolvedVoteResult]);

  const winningLabel = useMemo(() => {
    if (!winningChoiceId) return undefined;
    const choice = choices.find(c => c.id === winningChoiceId);
    return choice?.label || undefined;
  }, [winningChoiceId, choices]);

  const resolvedVoteSharePercent = useMemo(() => {
    if (voteSharePercent !== undefined) {
      return voteSharePercent;
    }

    if (!winningChoiceId) {
      return undefined;
    }

    if (isClosed) {
      return computedVoteSummary?.winningPercent ?? undefined;
    }

    const winningStats = choiceStats.find(choice => choice.choice.id === winningChoiceId);
    if (!winningStats) {
      return undefined;
    }

    return Math.round(winningStats.finalPercentage);
  }, [
    choiceStats,
    computedVoteSummary?.winningPercent,
    isClosed,
    voteSharePercent,
    winningChoiceId,
  ]);

  const isInteractive = Boolean(onOpenNamedResults);
  const ResultsWrapper = isInteractive ? 'button' : 'div';

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          {t('features.events.agenda.voteResults')}
          {attendanceMode ? (
            <BadgeControl variant="outline" className="capitalize">
              {attendanceMode}
            </BadgeControl>
          ) : null}
          <VotePhaseBadge
            phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'}
            className="ml-auto"
          />
          {isInteractive ? (
            <BadgeControl variant="secondary" className="gap-1">
              <Expand className="h-3 w-3" />
              {translateText('generated.inline.0013_namentlich_8d49da42')}
            </BadgeControl>
          ) : null}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
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
          {isClosed && resolvedVoteResult && (
            <VoteResultSentence
              type="vote"
              result={resolvedVoteResult}
              winnerName={winningLabel}
              voteSharePercent={resolvedVoteSharePercent}
              isFinal
            />
          )}

          <h3 className="font-semibold">{voteTitle}</h3>

          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>
              {isIndicationPhase
                ? `${totalIndicative} ${t('features.events.agenda.indicationVotes')}`
                : `${totalFinal} ${t('features.events.agenda.votes')}`}
            </span>
            <div className="flex items-center gap-2">
              {isIndicationPhase ? (
                <BadgeControl variant="secondary" className="text-xs">
                  * {t('features.events.agenda.indicationOnly')}
                </BadgeControl>
              ) : null}
              {isInteractive ? (
                <BadgeControl variant="outline" className="text-xs">
                  {translateText('generated.inline.0015_klick_fuer_einzelansicht_9d7ff135')}
                </BadgeControl>
              ) : null}
            </div>
          </div>

          {choices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground">{t('features.events.agenda.noChoices')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {choiceStats.map((cs, idx) => {
                const isWinner = cs.choice.id === winningChoiceId && !isIndicationPhase;
                const isSelected = userSelectedChoiceIds.includes(cs.choice.id);
                const colors = CHOICE_COLORS[idx % CHOICE_COLORS.length];

                return (
                  <div
                    key={cs.choice.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      isSelected && 'border-primary bg-primary/5',
                      isWinner && isClosed && 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-medium">{cs.choice.label || `Choice ${idx + 1}`}</span>
                      {isWinner && isClosed && <Crown className="h-4 w-4 text-yellow-500" />}
                      {isSelected && <CheckCircle2 className="text-primary h-4 w-4" />}
                    </div>

                    <VoteResultsDisplay
                      options={[
                        {
                          key: cs.choice.id,
                          label: cs.choice.label || `Choice ${idx + 1}`,
                          color: colors.color,
                          lightColor: colors.light,
                          finalCount: cs.finalCount,
                          finalPercent: cs.finalPercentage,
                          indicationCount: cs.indicativeCount,
                          indicationPercent: cs.indicativePercentage,
                        },
                      ]}
                      phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'}
                      totalFinal={totalFinal}
                      totalIndication={totalIndicative}
                    />
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
      </CardContent>
    </Card>
  );
}
