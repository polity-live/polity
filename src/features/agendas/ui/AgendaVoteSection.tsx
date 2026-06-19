'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { useMemo, type KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { BarChart3, CheckCircle2, Expand, Users, Vote } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VoteResultsDisplay, type VoteBarOption } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VoteResultSentence } from '@/features/vote-cast/ui/VoteResultSentence';
import { VotingPhaseBadge as VotePhaseBadge } from '@/features/shared/ui/voting';
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
  {
    color: featureThemeClassName('agendaAgendaVoteSectionSuccessBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionSuccessBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionDangerBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionDangerBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionNeutralBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionNeutralBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionInfoBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionInfoBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionAccentBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionAccentBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionWarningBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionWarningBackgroundAlpha'),
  },
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
  const visibleTotal = isIndicationPhase ? totalIndicative : totalFinal;
  const turnout =
    totalEligibleVoters && totalEligibleVoters > 0
      ? Math.round((visibleTotal / totalEligibleVoters) * 100)
      : undefined;
  const voteOptions = useMemo<VoteBarOption[]>(() => {
    return choiceStats.map((cs, idx) => {
      const colors = CHOICE_COLORS[idx % CHOICE_COLORS.length];

      return {
        key: cs.choice.id,
        label: cs.choice.label || `Choice ${idx + 1}`,
        color: colors.color,
        lightColor: colors.light,
        finalCount: cs.finalCount,
        finalPercent: cs.finalPercentage,
        indicationCount: cs.indicativeCount,
        indicationPercent: cs.indicativePercentage,
      };
    });
  }, [choiceStats]);
  const handleResultsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || !onOpenNamedResults) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenNamedResults();
    }
  };

  return (
    <Card className={cn('overflow-hidden rounded-lg shadow-sm', className)}>
      <CardHeader className="border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Vote className="text-brand h-5 w-5" />
              {t('features.events.agenda.voteResults')}
            </CardTitle>
            <p className="text-muted-foreground mt-1 truncate text-sm">{voteTitle}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {attendanceMode ? (
              <BadgeControl variant="outline" textTransform="capitalize">
                {attendanceMode}
              </BadgeControl>
            ) : null}
            <VotePhaseBadge
              phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'}
            />
            {isInteractive ? (
              <BadgeControl variant="secondary" className="gap-1">
                <Expand className="h-3 w-3" />
                {translateText('generated.inline.0013_namentlich_8d49da42')}
              </BadgeControl>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div
          {...(isInteractive
            ? {
                role: 'button' as const,
                tabIndex: 0,
                onClick: onOpenNamedResults,
                onKeyDown: handleResultsKeyDown,
                className:
                  'block w-full space-y-5 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              }
            : { className: 'space-y-5' })}
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

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="bg-muted/20 rounded-md border px-3 py-2 text-xs">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                {isIndicationPhase
                  ? t('features.events.agenda.indicationVotes')
                  : t('features.events.agenda.votes')}
              </div>
              <div className="mt-1 text-base font-semibold">{visibleTotal}</div>
            </div>
            <div className="bg-muted/20 rounded-md border px-3 py-2 text-xs">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t('features.events.voting.eligible')}
              </div>
              <div className="mt-1 text-base font-semibold">{totalEligibleVoters ?? '-'}</div>
            </div>
            <div className="bg-muted/20 rounded-md border px-3 py-2 text-xs">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('features.events.voting.share')}
              </div>
              <div className="mt-1 text-base font-semibold">
                {turnout !== undefined ? `${turnout}%` : '-'}
              </div>
            </div>
          </div>

          <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
            <span>
              {visibleTotal}{' '}
              {isIndicationPhase
                ? t('features.events.agenda.indicationVotes')
                : t('features.events.agenda.votes')}
            </span>
            <div className="flex items-center gap-2">
              {isIndicationPhase ? (
                <BadgeControl variant="secondary" size="xs">
                  * {t('features.events.agenda.indicationOnly')}
                </BadgeControl>
              ) : null}
              {isInteractive ? (
                <BadgeControl variant="outline" size="xs">
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
            <VoteResultsDisplay
              options={voteOptions}
              phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final_vote'}
              totalFinal={totalFinal}
              totalIndication={totalIndicative}
              totalEligible={totalEligibleVoters}
              selectedOptionIds={userSelectedChoiceIds}
              winnerOptionId={isIndicationPhase ? null : winningChoiceId}
              showWinner={!isIndicationPhase}
            />
          )}

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
      </CardContent>
    </Card>
  );
}
