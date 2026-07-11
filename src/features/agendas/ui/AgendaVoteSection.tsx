'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { CheckCircle2, Expand, Vote } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VoteResultsDisplay, type VoteBarOption } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VotingPhaseBadge as VotePhaseBadge } from '@/features/shared/ui/voting';
import {
  computeVoteResultSummary,
  type ChoiceOfflineTally,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { calculateVoteStats, getVotingPhase } from '@/features/agendas/hooks/useAgendaItemVoting';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { AmendmentForwardingNotice } from '@/features/amendments/ui/AmendmentForwardingNotice';
import type { AmendmentForwardingPreviewModel } from '@/features/amendments/logic/amendmentForwardingPreview';

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
  forwardingPreview?: AmendmentForwardingPreviewModel | null;
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
  majorityType,
  totalEligibleVoters,
  attendanceMode = 'online',
  offlineTallies = [],
  forwardingPreview = null,
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
        label:
          choice.label ||
          t('features.events.agenda.defaultChoiceLabels.choiceWithNumber', { count: idx + 1 }),
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
    t,
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

  const isInteractive = Boolean(onOpenNamedResults);
  const visibleTotal = isIndicationPhase ? totalIndicative : totalFinal;
  const visibleTotalLabel = isIndicationPhase
    ? t('features.events.agenda.indicationVotes')
    : t('features.events.agenda.votes');
  const openNamedResultsLabel = t('features.events.agenda.openNamedResults');
  const namedResultsLabel = t('features.events.agenda.namedResults.label');
  const voteOptions = useMemo<VoteBarOption[]>(() => {
    return choiceStats.map((cs, idx) => {
      const colors = CHOICE_COLORS[idx % CHOICE_COLORS.length];

      return {
        key: cs.choice.id,
        label:
          cs.choice.label ||
          t('features.events.agenda.defaultChoiceLabels.choiceWithNumber', { count: idx + 1 }),
        color: colors.color,
        lightColor: colors.light,
        finalCount: cs.finalCount,
        finalPercent: cs.finalPercentage,
        indicationCount: cs.indicativeCount,
        indicationPercent: cs.indicativePercentage,
      };
    });
  }, [choiceStats, t]);

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
            <BadgeControl variant="outline" className="gap-1">
              {visibleTotal} {visibleTotalLabel}
            </BadgeControl>
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
            <VotePhaseBadge
              phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final'}
            />
            {isInteractive && onOpenNamedResults ? (
              <BadgeControl asChild tone="info" className="cursor-pointer gap-1">
                <button
                  type="button"
                  onClick={onOpenNamedResults}
                  aria-label={openNamedResultsLabel}
                >
                  <Expand className="h-3 w-3" />
                  {namedResultsLabel}
                </button>
              </BadgeControl>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="space-y-5">
          {isIndicationPhase ? (
            <div className="flex justify-end">
              <BadgeControl variant="secondary" size="xs">
                * {t('features.events.agenda.indicationOnly')}
              </BadgeControl>
            </div>
          ) : null}
          {choices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground">{t('features.events.agenda.noChoices')}</p>
            </div>
          ) : (
            <VoteResultsDisplay
              options={voteOptions}
              phase={isIndicationPhase ? 'indication' : isClosed ? 'closed' : 'final'}
              totalFinal={totalFinal}
              totalIndication={totalIndicative}
              selectedOptionIds={userSelectedChoiceIds}
              showSelectedOptionState={isInteractive}
              winnerOptionId={isClosed ? winningChoiceId : null}
              showWinner={isClosed}
            />
          )}

          {forwardingPreview ? <AmendmentForwardingNotice preview={forwardingPreview} /> : null}

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
