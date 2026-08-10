import { computeVoteResult, type MajorityType } from '@/features/votes/logic/computeVoteResult';

export type AmendmentProcessStatus =
  | 'pending_event'
  | 'scheduled'
  | 'in_vote'
  | 'approved'
  | 'rejected'
  | 'merged'
  | 'withdrawn'
  | 'completed';

const TERMINAL_STEP_STATUSES = new Set<AmendmentProcessStatus>([
  'approved',
  'rejected',
  'merged',
  'withdrawn',
  'completed',
]);
const TERMINAL_BRANCH_STATUSES = new Set(['completed', 'rejected', 'withdrawn', 'merged']);

export function isTerminalStepStatus(
  status: string | null | undefined
): status is AmendmentProcessStatus {
  return TERMINAL_STEP_STATUSES.has((status ?? 'scheduled') as AmendmentProcessStatus);
}

export function isTerminalBranchStatus(status: string | null | undefined) {
  return TERMINAL_BRANCH_STATUSES.has(status ?? '');
}

export function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

function normalizeDecisionChoiceLabel(label?: string | null) {
  return label?.trim().toLowerCase() ?? null;
}

export function isAcceptDecisionChoice(label?: string | null) {
  const normalized = normalizeDecisionChoiceLabel(label);
  return normalized === 'accept' || normalized === 'yes';
}

export function isRejectDecisionChoice(label?: string | null) {
  const normalized = normalizeDecisionChoiceLabel(label);
  return normalized === 'reject' || normalized === 'no';
}

export function getEventOrderingAnchor(args: {
  eventStartDate?: number | null;
  eventEndDate?: number | null;
}) {
  return args.eventEndDate ?? args.eventStartDate ?? null;
}

export function getStepRunFingerprint(stepRun: {
  process_run_id: string;
  workflow_step_id?: string | null;
  target_group_id?: string | null;
  event_id?: string | null;
  order_index: number;
  step_kind: string;
}) {
  if (stepRun.workflow_step_id) {
    return `workflow:${stepRun.workflow_step_id}`;
  }

  if (stepRun.step_kind === 'merge_vote' && stepRun.event_id && stepRun.target_group_id) {
    return `auto-merge:${stepRun.process_run_id}:${stepRun.target_group_id}:${stepRun.event_id}`;
  }

  return `runtime:${stepRun.process_run_id}:${stepRun.target_group_id ?? 'none'}:${stepRun.order_index}:${stepRun.step_kind}`;
}

export function compareStepRunsByProcessOrder(
  left: { id: string; order_index: number },
  right: { id: string; order_index: number }
) {
  const byOrderIndex = left.order_index - right.order_index;
  return byOrderIndex !== 0 ? byOrderIndex : left.id.localeCompare(right.id);
}

export function getBranchStartGroupIdFromStepRuns(
  stepRuns: readonly {
    order_index: number;
    target_group_id?: string | null;
    source_group_id?: string | null;
  }[]
) {
  const firstStepRun = [...stepRuns].sort((left, right) => left.order_index - right.order_index)[0];
  return firstStepRun?.target_group_id ?? firstStepRun?.source_group_id ?? null;
}

export function computeConfirmedAgendaTailOrderIndex(
  agendaItems: readonly {
    id: string;
    forwarding_status?: string | null;
    order_index?: number | null;
  }[],
  excludeAgendaItemId?: string | null
) {
  return agendaItems.reduce((maxOrderIndex, agendaItem) => {
    if (excludeAgendaItemId && agendaItem.id === excludeAgendaItemId) {
      return maxOrderIndex;
    }

    if (agendaItem.forwarding_status === 'previous_decision_outstanding') {
      return maxOrderIndex;
    }

    return Math.max(maxOrderIndex, agendaItem.order_index ?? 0);
  }, 0);
}

export function getStepDecisionStatus(
  stepRun: { id: string; status?: string | null; decision_status?: string | null },
  firstUnresolvedStepId: string | null | undefined
) {
  if (stepRun.status === 'approved' || stepRun.status === 'completed') return 'approved';
  if (stepRun.status === 'rejected') return 'rejected';
  if (stepRun.status === 'merged') return 'merged';
  if (stepRun.status === 'withdrawn') return 'withdrawn';
  if (stepRun.decision_status === 'tie') return 'tie';
  return firstUnresolvedStepId === stepRun.id
    ? 'forward_confirmed'
    : 'previous_decision_outstanding';
}

export function deriveProcessRunState(branches: readonly { id: string; status?: string | null }[]) {
  const nonTerminalBranches = branches.filter(branch => !isTerminalBranchStatus(branch.status));

  let status: AmendmentProcessStatus = 'completed';
  if (nonTerminalBranches.some(branch => branch.status === 'in_vote')) {
    status = 'in_vote';
  } else if (nonTerminalBranches.some(branch => branch.status === 'scheduled')) {
    status = 'scheduled';
  } else if (nonTerminalBranches.some(branch => branch.status === 'pending_event')) {
    status = 'pending_event';
  } else if (branches.some(branch => branch.status === 'rejected')) {
    status = 'rejected';
  }

  return {
    status,
    activeBranchId: nonTerminalBranches[0]?.id ?? null,
  };
}

export function getForwardedEventEditingMode(eventId: string | null | undefined) {
  return eventId ? 'suggest_event' : 'view';
}

export function getEvaluationTargetGroupId(
  selectedTargetGroupId: string | null | undefined,
  stepTargetGroupId: string | null | undefined
) {
  return selectedTargetGroupId ?? stepTargetGroupId ?? null;
}

export function resolveReplannedStepSchedule<
  TStepRun extends {
    id: string;
    event_id?: string | null;
    starts_at?: number | null;
  },
  TEvent extends {
    start_date?: number | null;
    end_date?: number | null;
  },
>(
  stepRun: TStepRun,
  updatesByStepRunId: ReadonlyMap<string, string | null>,
  eventsById: ReadonlyMap<string, TEvent>
) {
  const nextEventId = updatesByStepRunId.has(stepRun.id)
    ? (updatesByStepRunId.get(stepRun.id) ?? null)
    : (stepRun.event_id ?? null);
  const event = nextEventId ? (eventsById.get(nextEventId) ?? null) : null;
  const existingScheduleFallback =
    nextEventId === stepRun.event_id ? (stepRun.starts_at ?? null) : null;

  return {
    stepRun,
    eventId: nextEventId,
    eventStartDate: event?.start_date ?? existingScheduleFallback,
    eventEndDate: event?.end_date ?? event?.start_date ?? existingScheduleFallback,
  };
}

export function addCalendarOffset(args: {
  timestamp: number;
  months?: number | null;
  years?: number | null;
}) {
  const baseDate = new Date(args.timestamp);
  const originalDay = baseDate.getDate();
  const result = new Date(args.timestamp);
  result.setDate(1);
  result.setFullYear(result.getFullYear() + (args.years ?? 0));
  result.setMonth(result.getMonth() + (args.months ?? 0));
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result.getTime();
}

export function resolveConcreteEvaluationDate(args: {
  evaluationMode?: 'fixed_date' | 'relative_to_vote' | null;
  evaluationDate?: number | null;
  evaluationOffsetMonths?: number | null;
  evaluationOffsetYears?: number | null;
  decisionTimestamp: number;
}) {
  if (args.evaluationMode === 'fixed_date') {
    return args.evaluationDate ?? null;
  }

  if (args.evaluationMode === 'relative_to_vote') {
    return addCalendarOffset({
      timestamp: args.decisionTimestamp,
      months: args.evaluationOffsetMonths ?? 0,
      years: args.evaluationOffsetYears ?? 0,
    });
  }

  return null;
}

export interface ProcessVoteDetails {
  majority_type?: string | null;
  choices?: readonly {
    id: string;
    label?: string | null;
    order_index?: number | null;
    process_branch_id?: string | null;
  }[];
  offline_tallies?: readonly {
    choice_id: string;
    phase?: string | null;
    count: number;
  }[];
  voters?: readonly unknown[];
  final_participations?: readonly unknown[];
  final_decisions?: readonly { choice_id: string }[];
}

export interface VoteOutcome {
  result: 'passed' | 'rejected' | 'tie';
  totalEligible: number;
  tallyByChoiceId: Map<string, number>;
}

export function buildTallyByChoiceId(vote: ProcessVoteDetails) {
  const tallyByChoiceId = new Map<string, number>();

  for (const choice of vote.choices ?? []) {
    tallyByChoiceId.set(choice.id, 0);
  }

  for (const decision of vote.final_decisions ?? []) {
    tallyByChoiceId.set(decision.choice_id, (tallyByChoiceId.get(decision.choice_id) ?? 0) + 1);
  }

  for (const tally of vote.offline_tallies ?? []) {
    if (tally.phase !== 'final') {
      continue;
    }

    tallyByChoiceId.set(tally.choice_id, (tallyByChoiceId.get(tally.choice_id) ?? 0) + tally.count);
  }

  return tallyByChoiceId;
}

export function resolveDecisionVoteOutcome(vote: ProcessVoteDetails): VoteOutcome {
  const sortedChoices = [...(vote.choices ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const acceptChoice =
    sortedChoices.find(choice => isAcceptDecisionChoice(choice.label)) ?? sortedChoices[0] ?? null;
  const rejectChoice =
    sortedChoices.find(choice => isRejectDecisionChoice(choice.label)) ?? sortedChoices[1] ?? null;
  const tallyByChoiceId = buildTallyByChoiceId(vote);
  const acceptCount = acceptChoice ? Number(tallyByChoiceId.get(acceptChoice.id)) : 0;
  const rejectCount = rejectChoice ? Number(tallyByChoiceId.get(rejectChoice.id)) : 0;
  const totalEligible = Math.max(
    vote.voters?.length ?? 0,
    (vote.final_participations?.length ?? 0) +
      (vote.offline_tallies ?? [])
        .filter(tally => tally.phase === 'final')
        .reduce((sum, tally) => sum + tally.count, 0)
  );

  return {
    result: computeVoteResult(
      acceptCount,
      rejectCount,
      totalEligible,
      normalizeMajorityType(vote.majority_type)
    ),
    totalEligible,
    tallyByChoiceId,
  };
}

export interface MergeRoundOneOutcome {
  result: 'tie' | 'winner';
  winnerBranchId: string | null;
  winnerChoiceId: string | null;
  loserBranchIds: string[];
}

export function resolveMergeRoundOneOutcome(args: {
  vote: ProcessVoteDetails;
  candidateStepRuns: readonly {
    branch_id: string;
    created_at: number;
  }[];
}): MergeRoundOneOutcome {
  const sortedChoices = [...(args.vote.choices ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const sortedCandidates = [...args.candidateStepRuns].sort(
    (left, right) => left.created_at - right.created_at
  );
  const tallyByChoiceId = buildTallyByChoiceId(args.vote);
  const ranked = sortedChoices.map((choice, index) => ({
    choiceId: choice.id,
    branchId: choice.process_branch_id ?? sortedCandidates[index]?.branch_id ?? null,
    count: Number(tallyByChoiceId.get(choice.id)),
  }));
  const sortedRanked = [...ranked].sort((left, right) => right.count - left.count);
  const best = sortedRanked[0] ?? null;
  const secondBest = sortedRanked[1] ?? null;

  if (!best || !best.branchId) {
    return {
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    };
  }

  if (secondBest && secondBest.count === best.count) {
    return {
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    };
  }

  return {
    result: 'winner',
    winnerBranchId: best.branchId,
    winnerChoiceId: best.choiceId,
    loserBranchIds: ranked
      .filter((entry): entry is typeof entry & { branchId: string } =>
        Boolean(entry.branchId && entry.branchId !== best.branchId)
      )
      .map(entry => entry.branchId),
  };
}
