'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Vote, CheckCircle2, Crown } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VoteResultsDisplay } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VoteResultSentence } from '@/features/vote-cast/ui/VoteResultSentence';
import { VotePhaseBadge } from '@/features/vote-cast/ui/VotePhaseBadge';
import {
  computeVoteResultSummary,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { calculateVoteStats, getVotingPhase } from '@/features/agendas/hooks/useAgendaItemVoting';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { useVoteActions } from '@/zero/votes/useVoteActions';

interface ChoiceDecision {
  choice_id: string;
}

interface VoteOfflineTallyLike {
  choice_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

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
  voteId,
  attendanceMode = 'online',
  offlineTallies = [],
  canManageOfflineResults = false,
  offlineEligibleCount,
  className,
}: AgendaVoteSectionProps) {
  const { t } = useTranslation();
  const { upsertOfflineTally } = useVoteActions();
  const [offlineDraft, setOfflineDraft] = useState<Record<string, string>>({});

  const phase = getVotingPhase(voteStatus);
  const isIndicationPhase = phase === 'indicative';
  const isClosed = phase === 'closed';
  const allowsOfflineResults = attendanceMode === 'hybrid' || attendanceMode === 'offline';

  useEffect(() => {
    const nextDraft: Record<string, string> = {};
    for (const tally of offlineTallies) {
      if (!tally.choice_id || (tally.phase !== 'indicative' && tally.phase !== 'final')) {
        continue;
      }

      nextDraft[`${tally.phase}:${tally.choice_id}`] = String(tally.count ?? 0);
    }
    setOfflineDraft(nextDraft);
  }, [offlineTallies, voteId]);

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
      normalizeMajorityType(majorityType)
    );
  }, [
    choiceStats.length,
    choices,
    finalDecisions,
    isClosed,
    majorityType,
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

    const winningStats = choiceStats.find(choice => choice.choice.id === winningChoiceId);
    if (!winningStats) {
      return undefined;
    }

    return Math.round(winningStats.finalPercentage);
  }, [choiceStats, voteSharePercent, winningChoiceId]);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          {t('features.events.agenda.voteResults', 'Vote Results')}
          {attendanceMode ? (
            <Badge variant="outline" className="capitalize">
              {attendanceMode}
            </Badge>
          ) : null}
          <VotePhaseBadge
            phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'}
            className="ml-auto"
          />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Result sentence when voting is closed */}
        {isClosed && resolvedVoteResult && (
          <VoteResultSentence
            type="vote"
            result={resolvedVoteResult}
            winnerName={winningLabel}
            voteSharePercent={resolvedVoteSharePercent}
            isFinal
          />
        )}

        {/* Vote title */}
        <h3 className="font-semibold">{voteTitle}</h3>

        {/* Vote count header */}
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {isIndicationPhase
              ? `${totalIndicative} ${t('features.events.agenda.indicationVotes')}`
              : `${totalFinal} ${t('features.events.agenda.votes')}`}
          </span>
          {isIndicationPhase && (
            <Badge variant="secondary" className="text-xs">
              * {t('features.events.agenda.indicationOnly')}
            </Badge>
          )}
        </div>

        {/* Choices with result bars */}
        {choices.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground">
              {t('features.events.agenda.noChoices', 'No choices defined')}
            </p>
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

        {/* User's current vote indicator */}
        {userHasVoted && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">
              {isIndicationPhase
                ? t('features.events.agenda.yourIndication')
                : t('features.events.agenda.yourVote')}
            </span>
          </div>
        )}

        {allowsOfflineResults && canManageOfflineResults && voteId ? (
          <div className="space-y-4 rounded-xl border border-dashed p-4">
            <div className="space-y-1">
              <h4 className="font-medium">Offline vote tallies</h4>
              <p className="text-muted-foreground text-sm">
                Enter aggregated offline or hybrid results for this vote.
                {offlineEligibleCount != null
                  ? ` Maximum offline votes per phase: ${offlineEligibleCount}.`
                  : ''}
              </p>
            </div>
            {(['indicative', 'final'] as const).map(currentPhase => (
              <div key={currentPhase} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{currentPhase}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const correlationId = `vote-offline-tally:${crypto.randomUUID()}`;
                      console.info('[offline-roster]', {
                        flow: 'vote-offline-tally',
                        stage: 'submit-started',
                        correlationId,
                        voteId,
                        phase: currentPhase,
                      });
                      for (const choice of choices) {
                        const draftValue = offlineDraft[`${currentPhase}:${choice.id}`] ?? '0';
                        await upsertOfflineTally({
                          vote_id: voteId,
                          phase: currentPhase,
                          choice_id: choice.id,
                          count: Math.max(0, Number.parseInt(draftValue, 10) || 0),
                          debug_correlation_id: correlationId,
                        });
                      }
                      console.info('[offline-roster]', {
                        flow: 'vote-offline-tally',
                        stage: 'submit-confirmed',
                        correlationId,
                        voteId,
                        phase: currentPhase,
                      });
                    }}
                  >
                    Save {currentPhase}
                  </Button>
                </div>
                <div className="grid gap-3">
                  {choices.map(choice => (
                    <div
                      key={`${currentPhase}-${choice.id}`}
                      className="grid gap-2 md:grid-cols-[1fr_120px] md:items-center"
                    >
                      <LabelText>{choice.label || 'Choice'}</LabelText>
                      <Input
                        type="number"
                        min="0"
                        value={offlineDraft[`${currentPhase}:${choice.id}`] ?? '0'}
                        onChange={event =>
                          setOfflineDraft(current => ({
                            ...current,
                            [`${currentPhase}:${choice.id}`]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LabelText({ children }: { children: string }) {
  return <span className="text-sm font-medium">{children}</span>;
}
