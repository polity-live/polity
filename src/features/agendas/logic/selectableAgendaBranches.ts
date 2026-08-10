import {
  getOrderedBranches,
  type AmendmentProcessBranchSource,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { VOTE_PURPOSE } from '@/zero/votes/vote-workflow';

export interface SelectableAgendaBranchVoteChoice {
  process_branch_id?: string | null;
  order_index?: number | null;
}

export interface SelectableAgendaBranchVote {
  purpose?: string | null;
  choices?: readonly SelectableAgendaBranchVoteChoice[] | null;
}

export interface SelectableAgendaBranchStepRun {
  id?: string | null;
  branch_id?: string | null;
  step_kind?: string | null;
  order_index?: number | null;
  created_at?: number | string | null;
  branch?: { id?: string | null; created_at?: number | string | null } | null;
}

export interface SelectableAgendaBranchesResult<TBranch extends AmendmentProcessBranchSource> {
  branches: TBranch[];
  preferredBranchId: string | null;
  isMergeAgendaItem: boolean;
}

function timestamp(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function uniqueBranchIds(values: readonly (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getCurrentStepBranchId(currentStepRun?: SelectableAgendaBranchStepRun | null) {
  return currentStepRun?.branch_id ?? currentStepRun?.branch?.id ?? null;
}

function isMergeStepRun(stepRun: SelectableAgendaBranchStepRun) {
  return stepRun.step_kind === 'merge_vote' || stepRun.step_kind === VOTE_PURPOSE.mergeVariant;
}

function getMergeChoiceBranchIds(vote?: SelectableAgendaBranchVote | null) {
  return uniqueBranchIds(
    [...(vote?.choices ?? [])]
      .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
      .map(choice => choice.process_branch_id)
  );
}

function getMergeStepBranchIds(stepRuns: readonly SelectableAgendaBranchStepRun[]) {
  return uniqueBranchIds(
    [...stepRuns]
      .filter(isMergeStepRun)
      .sort((left, right) => {
        const leftCreatedAt = timestamp(left.branch?.created_at ?? left.created_at);
        const rightCreatedAt = timestamp(right.branch?.created_at ?? right.created_at);
        if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
        return (left.order_index ?? 0) - (right.order_index ?? 0);
      })
      .map(stepRun => stepRun.branch_id ?? stepRun.branch?.id)
  );
}

function findMergeVote(
  vote: SelectableAgendaBranchVote | null | undefined,
  votes: readonly SelectableAgendaBranchVote[]
) {
  return (
    votes.find(candidate => candidate.purpose === VOTE_PURPOSE.mergeVariant) ??
    (vote?.purpose === VOTE_PURPOSE.mergeVariant ? vote : null)
  );
}

function mapBranchIdsToBranches<TBranch extends AmendmentProcessBranchSource>(
  branches: readonly TBranch[],
  branchIds: readonly string[]
) {
  const branchById = new Map(getOrderedBranches(branches).map(branch => [branch.id, branch]));

  return branchIds.map(branchId => branchById.get(branchId)).filter(Boolean) as TBranch[];
}

export function getSelectableAgendaBranches<TBranch extends AmendmentProcessBranchSource>({
  branches,
  vote,
  votes = [],
  agendaStepRuns = [],
  currentStepRun,
}: {
  branches: readonly TBranch[];
  vote?: SelectableAgendaBranchVote | null;
  votes?: readonly SelectableAgendaBranchVote[];
  agendaStepRuns?: readonly SelectableAgendaBranchStepRun[];
  currentStepRun?: SelectableAgendaBranchStepRun | null;
}): SelectableAgendaBranchesResult<TBranch> {
  const currentStepBranchId = getCurrentStepBranchId(currentStepRun);
  const mergeVote = findMergeVote(vote, votes);
  const mergeStepBranchIds = getMergeStepBranchIds(agendaStepRuns);
  const isMergeAgendaItem = Boolean(mergeVote || mergeStepBranchIds.length > 0);

  if (!isMergeAgendaItem) {
    return {
      branches: mapBranchIdsToBranches(branches, currentStepBranchId ? [currentStepBranchId] : []),
      preferredBranchId: currentStepBranchId,
      isMergeAgendaItem,
    };
  }

  const mergeChoiceBranchIds = getMergeChoiceBranchIds(mergeVote);
  const selectableBranchIds =
    mergeChoiceBranchIds.length >= 2
      ? mergeChoiceBranchIds
      : mergeStepBranchIds.length > 0
        ? mergeStepBranchIds
        : mergeChoiceBranchIds;

  return {
    branches: mapBranchIdsToBranches(branches, selectableBranchIds),
    preferredBranchId: null,
    isMergeAgendaItem,
  };
}

export function resolveSelectableAgendaBranchId<TBranch extends { id: string }>({
  branches,
  requestedBranchId,
  preferredBranchId,
}: {
  branches: readonly TBranch[];
  requestedBranchId?: string | null;
  preferredBranchId?: string | null;
}) {
  if (requestedBranchId && branches.some(branch => branch.id === requestedBranchId)) {
    return requestedBranchId;
  }

  if (preferredBranchId && branches.some(branch => branch.id === preferredBranchId)) {
    return preferredBranchId;
  }

  return branches[0]?.id ?? null;
}
