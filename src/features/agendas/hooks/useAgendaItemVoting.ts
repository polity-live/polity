'use client';

import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';

interface CandidateSelectionEntry {
  candidate_id: string;
}

interface CandidateOfflineTallyEntry {
  candidate_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

interface CandidateStats {
  candidate: CandidatesByElectionRow;
  indicativeCount: number;
  finalCount: number;
  indicativePercentage: number;
  finalPercentage: number;
}

interface ChoiceDecisionEntry {
  choice_id: string;
}

interface ChoiceOfflineTallyEntry {
  choice_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

interface ChoiceStats {
  choice: ChoicesByVoteRow;
  indicativeCount: number;
  finalCount: number;
  indicativePercentage: number;
  finalPercentage: number;
}

export type VotingPhase = 'unknown' | 'indicative' | 'final' | 'closed';

/**
 * Derive the voting phase from election/vote status.
 */
export function getVotingPhase(status?: string | null): VotingPhase {
  if (!status) return 'unknown';
  if (status === 'indicative') return 'indicative';
  if (status === 'final' || status === 'final_vote') return 'final';
  if (status === 'closed' || status === 'runoff_required' || status === 'no_winner')
    return 'closed';
  return 'unknown';
}

/**
 * Calculate election stats from candidates + indicative/final selections.
 */
export function calculateElectionStats(
  candidates: CandidatesByElectionRow[],
  indicativeSelections: readonly CandidateSelectionEntry[],
  finalSelections: readonly CandidateSelectionEntry[],
  offlineTallies: readonly CandidateOfflineTallyEntry[] = []
): { candidates: CandidateStats[]; totalIndicative: number; totalFinal: number } {
  if (!candidates?.length) {
    return { candidates: [], totalIndicative: 0, totalFinal: 0 };
  }

  const indicativeOfflineCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'indicative' ? sum + (tally.count ?? 0) : sum),
    0
  );
  const finalOfflineCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'final' ? sum + (tally.count ?? 0) : sum),
    0
  );
  const totalIndicative = indicativeSelections.length + indicativeOfflineCount;
  const totalFinal = finalSelections.length + finalOfflineCount;

  const candidateStats = candidates.map(candidate => {
    const indCount = indicativeSelections.filter(s => s.candidate_id === candidate.id).length;
    const finCount = finalSelections.filter(s => s.candidate_id === candidate.id).length;
    const offlineIndicativeCount = offlineTallies.reduce(
      (sum, tally) =>
        tally.phase === 'indicative' && tally.candidate_id === candidate.id
          ? sum + (tally.count ?? 0)
          : sum,
      0
    );
    const offlineFinalCount = offlineTallies.reduce(
      (sum, tally) =>
        tally.phase === 'final' && tally.candidate_id === candidate.id
          ? sum + (tally.count ?? 0)
          : sum,
      0
    );
    const totalIndicativeCount = indCount + offlineIndicativeCount;
    const totalFinalCount = finCount + offlineFinalCount;

    return {
      candidate,
      indicativeCount: totalIndicativeCount,
      finalCount: totalFinalCount,
      indicativePercentage:
        totalIndicative > 0 ? (totalIndicativeCount / totalIndicative) * 100 : 0,
      finalPercentage: totalFinal > 0 ? (totalFinalCount / totalFinal) * 100 : 0,
    };
  });

  return { candidates: candidateStats, totalIndicative, totalFinal };
}

/**
 * Calculate vote stats from choices + indicative/final decisions.
 */
export function calculateVoteStats(
  choices: ChoicesByVoteRow[],
  indicativeDecisions: readonly ChoiceDecisionEntry[],
  finalDecisions: readonly ChoiceDecisionEntry[],
  offlineTallies: readonly ChoiceOfflineTallyEntry[] = []
): { choices: ChoiceStats[]; totalIndicative: number; totalFinal: number } {
  if (!choices?.length) {
    return { choices: [], totalIndicative: 0, totalFinal: 0 };
  }

  const indicativeOfflineCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'indicative' ? sum + (tally.count ?? 0) : sum),
    0
  );
  const finalOfflineCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'final' ? sum + (tally.count ?? 0) : sum),
    0
  );
  const totalIndicative = indicativeDecisions.length + indicativeOfflineCount;
  const totalFinal = finalDecisions.length + finalOfflineCount;

  const choiceStats = choices.map(choice => {
    const indCount = indicativeDecisions.filter(d => d.choice_id === choice.id).length;
    const finCount = finalDecisions.filter(d => d.choice_id === choice.id).length;
    const offlineIndicativeCount = offlineTallies.reduce(
      (sum, tally) =>
        tally.phase === 'indicative' && tally.choice_id === choice.id
          ? sum + (tally.count ?? 0)
          : sum,
      0
    );
    const offlineFinalCount = offlineTallies.reduce(
      (sum, tally) =>
        tally.phase === 'final' && tally.choice_id === choice.id ? sum + (tally.count ?? 0) : sum,
      0
    );
    const totalIndicativeCount = indCount + offlineIndicativeCount;
    const totalFinalCount = finCount + offlineFinalCount;

    return {
      choice,
      indicativeCount: totalIndicativeCount,
      finalCount: totalFinalCount,
      indicativePercentage:
        totalIndicative > 0 ? (totalIndicativeCount / totalIndicative) * 100 : 0,
      finalPercentage: totalFinal > 0 ? (totalFinalCount / totalFinal) * 100 : 0,
    };
  });

  return { choices: choiceStats, totalIndicative, totalFinal };
}

/**
 * Hook for accessing agenda item voting utilities.
 */
export function useAgendaItemVoting() {
  return {
    getVotingPhase,
    calculateElectionStats,
    calculateVoteStats,
  };
}
