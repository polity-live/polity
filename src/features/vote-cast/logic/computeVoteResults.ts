/**
 * Pure functions for computing amendment/discussion vote results.
 * Supports grouped indicative + final vote tallying with multiple majority types.
 *
 * Works with the new choice-based decision model:
 * - vote_choice rows define available options (default: Yes/No/Abstain)
 * - indicative_choice_decision / final_choice_decision rows record each voter's pick
 */

export type MajorityType = 'simple' | 'absolute' | 'two_thirds';
export type VoteResult = 'passed' | 'rejected' | 'tie';

export interface ChoiceInfo {
  id: string;
  label: string;
  order_index: number;
}

export interface ChoiceDecision {
  choice_id: string;
}

export interface ChoiceOfflineTally {
  choice_id?: string | null;
  phase?: string | null;
  count?: number | null;
}

export interface ChoiceTally {
  choiceId: string;
  label: string;
  count: number;
  percent: number;
}

export interface VoteResultSummary {
  result: VoteResult;
  choiceTallies: ChoiceTally[];
  totalEligible: number;
  totalVoted: number;
  winningChoiceId: string | null;
  winningLabel: string | null;
  winningPercent: number | null;
  majorityType: MajorityType;
}

function normalizeChoiceLabel(label: string): string {
  return label.trim().toLowerCase();
}

function isAcceptChoiceLabel(label: string): boolean {
  const normalized = normalizeChoiceLabel(label);
  return normalized === 'yes' || normalized === 'accept';
}

function isRejectChoiceLabel(label: string): boolean {
  const normalized = normalizeChoiceLabel(label);
  return normalized === 'no' || normalized === 'reject';
}

/**
 * Tally final votes per choice from online decisions plus offline final tallies.
 */
export function tallyFinalChoiceResults(
  choices: readonly ChoiceInfo[],
  decisions: readonly ChoiceDecision[],
  offlineTallies: readonly ChoiceOfflineTally[] = []
): ChoiceTally[] {
  const countsByChoiceId = new Map<string, number>();

  for (const choice of choices) {
    countsByChoiceId.set(choice.id, 0);
  }

  for (const decision of decisions) {
    countsByChoiceId.set(decision.choice_id, (countsByChoiceId.get(decision.choice_id) ?? 0) + 1);
  }

  for (const tally of offlineTallies) {
    if (tally.phase !== 'final' || !tally.choice_id) {
      continue;
    }

    countsByChoiceId.set(
      tally.choice_id,
      (countsByChoiceId.get(tally.choice_id) ?? 0) + (tally.count ?? 0)
    );
  }

  const total = [...countsByChoiceId.values()].reduce((sum, count) => sum + count, 0) || 1;

  return choices.map(c => {
    const count = countsByChoiceId.get(c.id) ?? 0;
    return {
      choiceId: c.id,
      label: c.label,
      count,
      percent: Math.round((count / total) * 100),
    };
  });
}

/**
 * Determine the vote result based on the majority type and tallies.
 * Accept/reject choices are resolved by semantic labels first and fall back to
 * the first two ordered choices for legacy data.
 */
export function computeVoteResult(
  acceptCount: number,
  rejectCount: number,
  totalEligible: number,
  majorityType: MajorityType
): VoteResult {
  if (acceptCount === rejectCount) return 'tie';

  switch (majorityType) {
    case 'absolute':
      return acceptCount > totalEligible / 2 ? 'passed' : 'rejected';
    case 'two_thirds':
      return acceptCount >= (totalEligible * 2) / 3 ? 'passed' : 'rejected';
    case 'simple':
    default:
      return acceptCount > rejectCount ? 'passed' : 'rejected';
  }
}

/**
 * Compute full vote results including percentages and winning choice.
 */
export function computeVoteResultSummary(
  choices: readonly ChoiceInfo[],
  decisions: readonly ChoiceDecision[],
  totalEligible: number,
  majorityType: MajorityType,
  offlineTallies: readonly ChoiceOfflineTally[] = []
): VoteResultSummary {
  const tallies = tallyFinalChoiceResults(choices, decisions, offlineTallies);

  const sortedChoices = [...choices].sort((a, b) => a.order_index - b.order_index);
  const acceptChoice =
    choices.find(choice => isAcceptChoiceLabel(choice.label)) ?? sortedChoices[0];
  const rejectChoice =
    choices.find(choice => isRejectChoiceLabel(choice.label)) ?? sortedChoices[1];

  const acceptCount = acceptChoice
    ? (tallies.find(tally => tally.choiceId === acceptChoice.id)?.count ?? 0)
    : 0;
  const rejectCount = rejectChoice
    ? (tallies.find(tally => tally.choiceId === rejectChoice.id)?.count ?? 0)
    : 0;

  const result = computeVoteResult(acceptCount, rejectCount, totalEligible, majorityType);
  const totalVoted = tallies.reduce((sum, tally) => sum + tally.count, 0);

  let winningChoiceId: string | null = null;
  let winningLabel: string | null = null;
  let winningPercent: number | null = null;
  if (result === 'passed' && acceptChoice) {
    winningChoiceId = acceptChoice.id;
    winningLabel = acceptChoice.label;
    winningPercent = tallies.find(tally => tally.choiceId === acceptChoice.id)?.percent ?? null;
  } else if (result === 'rejected' && rejectChoice) {
    winningChoiceId = rejectChoice.id;
    winningLabel = rejectChoice.label;
    winningPercent = tallies.find(tally => tally.choiceId === rejectChoice.id)?.percent ?? null;
  }

  return {
    result,
    choiceTallies: tallies,
    totalEligible,
    totalVoted,
    winningChoiceId,
    winningLabel,
    winningPercent,
    majorityType,
  };
}
