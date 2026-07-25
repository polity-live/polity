'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useAgendaTimingState } from '@/zero/agendas/useAgendaState';
import { useAuth } from '@/providers/auth-provider';
import type { ElectionWithDetailsRow } from '@/zero/elections';
import { queries } from '@/zero/queries';
import {
  computeVoteResultSummary,
  type MajorityType,
} from '@/features/vote-cast/logic/computeVoteResults';
import type { VoteWithDetailsRow } from '@/zero/votes';
import type { DecisionItem } from '../ui/types';
import type { Visibility } from '@/features/auth/logic/checkEntityAccess';
import type { TrendData } from '../ui/TrendIndicator';
import { stripDelegateElectionMetadata } from '@/features/elections/logic/electionAssignmentMetadata';
import {
  getDecisionStatus,
  isUrgent,
  isClosingSoon,
  isOpeningSoon,
  isRecentlyClosed,
  generateDecisionId,
} from '../logic/decision-status';
import { normalizeDecisionVotingPhase } from '../logic/decision-phase';
import {
  getDecisionAgendaRuntimeTimes,
  resolveDecisionTiming,
  type DecisionAgendaTimingSource,
} from '../logic/decision-timing';
import {
  calculateSupportPercentage,
  calculateTrend,
  calculateTurnout,
} from '../logic/trend-calculation';
import { translateVoteChoiceLabel } from '../logic/voteChoiceTranslation';

function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

function mapClosedVoteResult(
  result: 'passed' | 'rejected' | 'tie'
): Extract<DecisionItem['status'], 'passed' | 'failed' | 'tied'> {
  switch (result) {
    case 'rejected':
      return 'failed';
    case 'tie':
      return 'tied';
    case 'passed':
    default:
      return 'passed';
  }
}

function countVoteChoices(vote: VoteWithDetailsRow, decisionType: 'indicative' | 'final') {
  const decisions =
    decisionType === 'indicative' ? vote.indicative_decisions || [] : vote.final_decisions || [];
  const sortedChoices = [...(vote.choices || [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const choiceCounts = new Map<string, number>();

  for (const decision of decisions) {
    const choiceId = decision.choice_id;
    choiceCounts.set(choiceId, (choiceCounts.get(choiceId) || 0) + 1);
  }

  return {
    support: sortedChoices[0] ? choiceCounts.get(sortedChoices[0].id) || 0 : 0,
    oppose: sortedChoices[1] ? choiceCounts.get(sortedChoices[1].id) || 0 : 0,
    abstain: sortedChoices[2] ? choiceCounts.get(sortedChoices[2].id) || 0 : 0,
  };
}

type ElectionCandidateRow = NonNullable<ElectionWithDetailsRow['candidates']>[number];

function getUserFullName(user?: ElectionCandidateRow['user'] | null): string | null {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return fullName || null;
}

function getCandidateDisplayName(candidate: ElectionCandidateRow): string {
  return getUserFullName(candidate.user) || candidate.name?.trim() || 'Candidate';
}

const CONFIRMED_EVENT_ROLE_STATUSES = new Set(['active', 'member', 'admin', 'confirmed']);

function hasConfirmedEventRole(
  event:
    | {
        participants?:
          | readonly {
              readonly user_id?: string | null;
              readonly status?: string | null;
              readonly participant_roles?: readonly unknown[] | null;
            }[]
          | null;
      }
    | null
    | undefined,
  userId?: string
) {
  if (!event || !userId) return false;

  return (event.participants ?? []).some(
    participant =>
      participant.user_id === userId &&
      CONFIRMED_EVENT_ROLE_STATUSES.has(participant.status ?? '') &&
      (participant.participant_roles?.length ?? 0) > 0
  );
}

function mergeDecisionAgendaTimingSource(
  agendaItem: DecisionAgendaTimingSource | null | undefined,
  calculatedAgendaItem: DecisionAgendaTimingSource | null | undefined
): DecisionAgendaTimingSource | null {
  if (!agendaItem && !calculatedAgendaItem) {
    return null;
  }

  return {
    status: calculatedAgendaItem?.status ?? agendaItem?.status,
    duration: calculatedAgendaItem?.duration ?? agendaItem?.duration,
    activated_at: calculatedAgendaItem?.activated_at ?? agendaItem?.activated_at,
    completed_at: calculatedAgendaItem?.completed_at ?? agendaItem?.completed_at,
    start_time: calculatedAgendaItem?.start_time ?? agendaItem?.start_time,
    end_time: calculatedAgendaItem?.end_time ?? agendaItem?.end_time,
    calculated_start_time: calculatedAgendaItem?.calculated_start_time,
    calculated_end_time: calculatedAgendaItem?.calculated_end_time,
  };
}

// Re-export DecisionItem for use in other hooks
export type { DecisionItem } from '../ui/types';

export interface UseDecisionTerminalOptions {
  /** Only include decisions from these group IDs */
  groupIds?: string[];
  /** Include recently closed (last N days) */
  recentlyClosedDays?: number;
}

export interface UseDecisionTerminalReturn {
  decisions: DecisionItem[];
  isLoading: boolean;
  error: Error | null;
  urgentCount: number;
  activeCount: number;
  recentlyClosedCount: number;
  refetch: () => void;
}

/**
 * Hook to fetch and manage Decision Terminal data
 */
export function useDecisionTerminal(
  options: UseDecisionTerminalOptions = {}
): UseDecisionTerminalReturn {
  const { user } = useAuth();
  const groupIds = options.groupIds ?? [];

  const [electionRowsData, electionResult] = useQuery(
    queries.elections.decisionPage({
      status: undefined,
      statuses: [],
      groupIds,
      query: '',
      limit: 100,
      start: null,
      dir: 'forward',
    })
  );
  const [voteRowsData, voteResult] = useQuery(
    queries.votes.decisionPage({
      status: undefined,
      statuses: [],
      groupIds,
      query: '',
      limit: 100,
      start: null,
      dir: 'forward',
    })
  );
  const electionRows = (electionRowsData ?? []) as unknown as ElectionWithDetailsRow[];
  const voteRows = (voteRowsData ?? []) as unknown as VoteWithDetailsRow[];
  const electionsLoading = electionResult.type === 'unknown';
  const votesLoading = voteResult.type === 'unknown';

  const agendaEventIds = useMemo(() => {
    const eventIds = new Set<string>();

    for (const election of electionRows || []) {
      const eventId = election.agenda_item?.event?.id;
      if (eventId) {
        eventIds.add(eventId);
      }
    }

    for (const vote of voteRows || []) {
      const eventId = vote.agenda_item?.event?.id;
      if (eventId) {
        eventIds.add(eventId);
      }
    }

    return Array.from(eventIds);
  }, [electionRows, voteRows]);

  const { agendaItems, isLoading: agendaLoading } = useAgendaTimingState(
    agendaEventIds.length > 0 ? agendaEventIds : undefined
  );

  const agendaItemsById = useMemo(() => {
    return new Map(agendaItems.map(item => [item.id, item]));
  }, [agendaItems]);

  const isLoading = electionsLoading || votesLoading || agendaLoading;

  const decisions = useMemo(() => {
    const items: DecisionItem[] = [];
    const now = new Date();

    const elections = electionRows || [];
    elections.forEach((election, index) => {
      const calculatedAgendaItem = election.agenda_item?.id
        ? agendaItemsById.get(election.agenda_item.id)
        : undefined;

      const agendaTimingSource = mergeDecisionAgendaTimingSource(
        election.agenda_item,
        calculatedAgendaItem
      );
      const decisionTimes = getDecisionAgendaRuntimeTimes({
        agendaItem: agendaTimingSource,
        closingEndTime: election.closing_end_time,
        createdAt: election.created_at,
        updatedAt: election.updated_at,
        fallbackNow: now,
      });
      const { startsAt, endsAt, sortStartsAt, sortEndsAt, hasExplicitClosingEnd } = decisionTimes;

      const candidates = election.candidates || [];
      const indicativeSelections = election.indicative_selections || [];
      const finalSelections = election.final_selections || [];

      // Count indicative selections per candidate
      const indicationCounts = new Map<string, number>();
      for (const sel of indicativeSelections) {
        const candidateId = sel.candidate_id;
        indicationCounts.set(candidateId, (indicationCounts.get(candidateId) || 0) + 1);
      }

      // Count final selections per candidate
      const voteCounts = new Map<string, number>();
      for (const sel of finalSelections) {
        const candidateId = sel.candidate_id;
        voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + 1);
      }

      const phase = normalizeDecisionVotingPhase(election.status);
      const isIndicationPhase = phase === 'indication';
      const totalElectors = election.electors?.length;
      const totalFinalSelections = finalSelections.length;
      const totalIndicationSelections = indicativeSelections.length;

      const candidateSummaries: {
        id: string;
        name: string;
        avatarUrl?: string;
        votes: number;
        isWinner: boolean;
        indicationVotes?: number;
        indicationPercentage?: number;
        actualPercentage?: number;
      }[] = candidates.map(candidate => {
        const finalVoteCount = voteCounts.get(candidate.id) || 0;
        const indicationVoteCount = indicationCounts.get(candidate.id) || 0;
        return {
          id: candidate.id,
          name: getCandidateDisplayName(candidate),
          avatarUrl: candidate.image_url ?? candidate.user?.avatar ?? undefined,
          votes: finalVoteCount,
          isWinner: false,
          indicationVotes: indicationVoteCount > 0 ? indicationVoteCount : undefined,
          indicationPercentage:
            totalIndicationSelections > 0
              ? (indicationVoteCount / totalIndicationSelections) * 100
              : undefined,
          actualPercentage:
            totalFinalSelections > 0 ? (finalVoteCount / totalFinalSelections) * 100 : undefined,
        };
      });

      const winner = [...candidateSummaries].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
      const timing = resolveDecisionTiming({
        phase,
        startsAt,
        endsAt,
        hasExplicitClosingEnd,
      });
      const { isActiveDecision, isFutureDecision, isEnded, temporalBucket } = timing;
      const currentSelectionCount =
        isEnded || !isIndicationPhase ? totalFinalSelections : totalIndicationSelections;
      const turnout = totalElectors
        ? calculateTurnout(currentSelectionCount, totalElectors)
        : undefined;

      if (winner && isEnded) {
        candidateSummaries.forEach((candidate: { id: string; isWinner: boolean }) => {
          candidate.isWinner = candidate.id === winner.id;
        });
      }

      const status = isEnded ? 'elected' : getDecisionStatus(endsAt);
      const agendaItemId = election.agenda_item?.id;
      const agendaEventId = election.agenda_item?.event?.id;
      const confirmedEventRole = hasConfirmedEventRole(election.agenda_item?.event, user?.id);
      const electionHref =
        agendaItemId && agendaEventId ? `/event/${agendaEventId}/agenda/${agendaItemId}` : '#';
      const electorId = election.electors?.find(elector => elector.user_id === user?.id)?.id;

      items.push({
        id: generateDecisionId('election', index + 1),
        sourceId: election.id,
        type: 'election',
        title: election.title || 'Election',
        body: election.role?.name || election.agenda_item?.event?.title || 'Election',
        endsAt,
        startsAt,
        sortStartsAt,
        sortEndsAt,
        temporalBucket,
        isActiveDecision,
        isFutureDecision,
        status,
        isClosed: isEnded,
        isClosingSoon: isActiveDecision && isClosingSoon(endsAt),
        isOpeningSoon: isFutureDecision && startsAt ? isOpeningSoon(startsAt) : false,
        isRecentlyClosed: isEnded ? isRecentlyClosed(endsAt) : false,
        isUrgent: isActiveDecision && isUrgent(endsAt),
        visibility: (election.visibility as Visibility) ?? 'public',
        trend: { direction: 'stable', percentage: 0 },
        votedCount: currentSelectionCount,
        totalMembers: totalElectors,
        turnout,
        winnerName: isEnded ? winner?.name : undefined,
        href: electionHref,
        summary: stripDelegateElectionMetadata(election.description) || undefined,
        eventId: agendaEventId,
        agendaItemId,
        electionId: election.id,
        phase,
        ballotVisibility: election.ballot_visibility ?? null,
        electorId,
        canOpenVoteDialog: Boolean(agendaEventId && agendaItemId && isActiveDecision),
        eventRoleFilterApplies: Boolean(agendaEventId),
        hasConfirmedEventRole: confirmedEventRole,
        maxVotes: election.max_votes ?? 1,
        electionMode:
          election.election_mode === 'list' || election.election_mode === 'single'
            ? election.election_mode
            : null,
        seatCount: election.seat_count ?? null,
        candidates: candidateSummaries,
        // Indication phase data
        isIndicationPhase,
        agendaItem:
          agendaItemId && agendaEventId
            ? {
                id: agendaItemId,
                name: election.agenda_item?.title || election.title || 'Election',
                href: electionHref,
              }
            : undefined,
      });
    });

    const votes = voteRows || [];
    votes.forEach((vote, index) => {
      const calculatedAgendaItem = vote.agenda_item?.id
        ? agendaItemsById.get(vote.agenda_item.id)
        : undefined;

      const agendaTimingSource = mergeDecisionAgendaTimingSource(
        vote.agenda_item,
        calculatedAgendaItem
      );
      const decisionTimes = getDecisionAgendaRuntimeTimes({
        agendaItem: agendaTimingSource,
        closingEndTime: vote.closing_end_time,
        createdAt: vote.created_at,
        updatedAt: vote.updated_at,
        fallbackNow: now,
      });
      const {
        startsAt: voteStartsAt,
        endsAt,
        sortStartsAt,
        sortEndsAt,
        hasExplicitClosingEnd,
      } = decisionTimes;

      const phase = normalizeDecisionVotingPhase(vote.status);
      const isIndicationPhase = phase === 'indication';
      const timing = resolveDecisionTiming({
        phase,
        startsAt: voteStartsAt,
        endsAt,
        hasExplicitClosingEnd,
      });
      const { isActiveDecision, isFutureDecision, isEnded, temporalBucket } = timing;
      const finalVotes = countVoteChoices(vote, 'final');
      const indicationVotes = countVoteChoices(vote, 'indicative');
      const hasIndicationData = isIndicationPhase || (vote.indicative_decisions?.length || 0) > 0;
      const currentVotes = isIndicationPhase ? indicationVotes : finalVotes;
      const totalMembers = vote.voters?.length;
      const votedCount = isIndicationPhase
        ? vote.indicative_decisions?.length || 0
        : vote.final_decisions?.length || 0;
      const turnout = totalMembers ? calculateTurnout(votedCount, totalMembers) : undefined;
      const supportPercentage = calculateSupportPercentage(
        isEnded || !isIndicationPhase ? finalVotes : currentVotes
      );
      const indicationSupportPercentage = hasIndicationData
        ? calculateSupportPercentage(indicationVotes)
        : undefined;
      const voteResultSummary =
        isEnded && vote.choices && vote.choices.length > 0
          ? computeVoteResultSummary(
              vote.choices.map((choice, choiceIndex) => ({
                id: choice.id,
                label: choice.label || `Choice ${choiceIndex + 1}`,
                order_index: choice.order_index ?? choiceIndex,
              })),
              vote.final_decisions || [],
              totalMembers ?? (vote.final_decisions?.length || 0),
              normalizeMajorityType(vote.majority_type)
            )
          : null;
      const status = isEnded
        ? voteResultSummary
          ? mapClosedVoteResult(voteResultSummary.result)
          : 'tied'
        : getDecisionStatus(endsAt);
      const agendaItemId = vote.agenda_item?.id;
      const agendaEventId = vote.agenda_item?.event?.id;
      const confirmedEventRole = hasConfirmedEventRole(vote.agenda_item?.event, user?.id);
      const voterId = vote.voters?.find(voter => voter.user_id === user?.id)?.id;
      const trend: TrendData =
        !isIndicationPhase && hasIndicationData
          ? calculateTrend(finalVotes, indicationVotes)
          : { direction: 'stable', percentage: 0 };
      const voteTitle = vote.title || vote.agenda_item?.title || vote.amendment?.title || 'Vote';
      const voteBody = vote.agenda_item?.event?.title || vote.amendment?.title || 'Vote';

      items.push({
        id: generateDecisionId('vote', index + 1),
        sourceId: vote.id,
        type: 'vote',
        title: voteTitle,
        body: voteBody,
        endsAt,
        startsAt: voteStartsAt,
        sortStartsAt,
        sortEndsAt,
        temporalBucket,
        isActiveDecision,
        isFutureDecision,
        status,
        isClosed: isEnded,
        isClosingSoon: isActiveDecision && isClosingSoon(endsAt),
        isOpeningSoon: isFutureDecision && voteStartsAt ? isOpeningSoon(voteStartsAt) : false,
        isRecentlyClosed: isEnded ? isRecentlyClosed(endsAt) : false,
        isUrgent: isActiveDecision && isUrgent(endsAt),
        visibility: (vote.visibility as Visibility) ?? 'public',
        trend,
        votes: currentVotes,
        turnout,
        totalMembers,
        votedCount,
        supportPercentage,
        href:
          agendaItemId && agendaEventId
            ? `/event/${agendaEventId}/agenda/${agendaItemId}`
            : vote.amendment?.id
              ? `/amendment/${vote.amendment.id}`
              : '#',
        summary: vote.description || undefined,
        eventId: agendaEventId,
        agendaItemId,
        voteId: vote.id,
        phase,
        ballotVisibility: vote.ballot_visibility ?? null,
        voterId,
        canOpenVoteDialog: Boolean(agendaEventId && agendaItemId && isActiveDecision),
        eventRoleFilterApplies: Boolean(agendaEventId),
        hasConfirmedEventRole: confirmedEventRole,
        choices: (vote.choices || []).map((choice, choiceIndex) => ({
          id: choice.id,
          label: translateVoteChoiceLabel(choice, choiceIndex),
        })),
        entity: vote.amendment?.id
          ? {
              id: vote.amendment.id,
              name: vote.amendment.title || voteTitle,
              type: 'amendment',
              href: `/amendment/${vote.amendment.id}`,
            }
          : undefined,
        agendaItem:
          agendaItemId && agendaEventId
            ? {
                id: agendaItemId,
                name: vote.agenda_item?.title || voteTitle,
                href: `/event/${agendaEventId}/agenda/${agendaItemId}`,
              }
            : undefined,
        isIndicationPhase,
        indicationVotes: hasIndicationData ? indicationVotes : undefined,
        indicationSupportPercentage,
      });
    });

    items.sort((a, b) => {
      const bucketOrder = { active: 0, future: 1, past: 2 } as const;
      const leftBucket = a.temporalBucket ?? (a.isClosed ? 'past' : 'active');
      const rightBucket = b.temporalBucket ?? (b.isClosed ? 'past' : 'active');

      if (leftBucket !== rightBucket) {
        return bucketOrder[leftBucket] - bucketOrder[rightBucket];
      }

      if (leftBucket === 'future') {
        return (
          new Date(a.sortStartsAt ?? a.startsAt ?? a.endsAt).getTime() -
          new Date(b.sortStartsAt ?? b.startsAt ?? b.endsAt).getTime()
        );
      }

      if (leftBucket === 'past') {
        return (
          new Date(b.sortEndsAt ?? b.endsAt).getTime() -
          new Date(a.sortEndsAt ?? a.endsAt).getTime()
        );
      }

      return (
        new Date(a.sortEndsAt ?? a.endsAt).getTime() - new Date(b.sortEndsAt ?? b.endsAt).getTime()
      );
    });

    return items;
  }, [agendaItemsById, electionRows, user?.id, voteRows]);

  const error = null;

  // Calculate counts
  const urgentCount = useMemo(
    () => decisions.filter(d => !d.isClosed && d.isUrgent).length,
    [decisions]
  );

  const activeCount = useMemo(
    () => decisions.filter(d => d.isActiveDecision ?? (!d.isClosed && !d.isOpeningSoon)).length,
    [decisions]
  );

  const recentlyClosedCount = useMemo(() => decisions.filter(d => d.isClosed).length, [decisions]);

  // Refetch function (placeholder for real implementation)
  const refetch = useCallback(() => {
    // InstantDB useQuery updates automatically; keep placeholder for API parity.
  }, []);

  return {
    decisions,
    isLoading,
    error,
    urgentCount,
    activeCount,
    recentlyClosedCount,
    refetch,
  };
}
