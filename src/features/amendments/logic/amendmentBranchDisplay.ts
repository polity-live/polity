import type { VariantDiffCandidate } from '@/features/agendas/ui/MergeVariantComparisonPanel';
import { translate } from '@/features/shared/hooks/use-translation';
import {
  AMENDMENT_EDITING_MODE_ORDER,
  getAmendmentEditingModePolicy,
  isAgendaItemStarted,
  normalizeEditingMode,
  type EditingMode,
  type NonTerminalEditingMode,
} from '@/zero/amendments/editing-mode-policy';

export const TERMINAL_BRANCH_STATUSES = new Set(['rejected', 'withdrawn', 'completed']);
export const READONLY_BRANCH_RESOLUTIONS = new Set(['merge_loser', 'rejected', 'withdrawn']);

export interface AmendmentProcessBranchStep {
  order_index?: number | null;
  source_group?: { name?: string | null } | null;
  target_group?: { name?: string | null } | null;
  workflow_step?: { label?: string | null } | null;
  status?: string | null;
  event_id?: string | null;
  event?: { id?: string | null; title?: string | null } | null;
  agenda_item_id?: string | null;
  agenda_item?: {
    status?: string | null;
    activated_at?: number | null;
    start_time?: number | null;
    completed_at?: number | null;
  } | null;
}

export interface AmendmentProcessBranchSource {
  id: string;
  title?: string | null;
  status?: string | null;
  editing_mode?: string | null;
  resolution?: string | null;
  created_at?: number | string | null;
  document?: { content?: unknown } | null;
  document_version?: { content?: unknown } | null;
  merged_into_branch_id?: string | null;
  merged_into_branch?: AmendmentProcessBranchSource | null;
  change_requests?:
    | readonly ({
        id?: string | null;
        process_branch_id?: string | null;
        status?: string | null;
        voting_status?: string | null;
      } & Record<string, unknown>)[]
    | null;
  discussions?: unknown;
  step_runs?: readonly AmendmentProcessBranchStep[] | null;
}

export function getOrderedBranchSteps(branch: AmendmentProcessBranchSource | null | undefined) {
  return [...(branch?.step_runs ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
}

export function getOrderedBranches<T extends AmendmentProcessBranchSource>(
  branches: readonly T[] | null | undefined
) {
  return [...(branches ?? [])].sort((left, right) => {
    const byCreatedAt = getBranchCreatedAt(left) - getBranchCreatedAt(right);
    return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
  });
}

export function getBranchEditingMode(
  branch: AmendmentProcessBranchSource | null | undefined
): EditingMode {
  return normalizeEditingMode(branch?.editing_mode);
}

export interface AmendmentBranchStatusChip {
  branchId: string;
  label: string;
  editingMode: EditingMode;
  processStatus: string | null;
  resolution: string | null;
}

export function mapAmendmentBranchStatusChips(
  branches: readonly AmendmentProcessBranchSource[] | null | undefined
): AmendmentBranchStatusChip[] {
  return getOrderedBranches(branches).map(branch => ({
    branchId: branch.id,
    label: getBranchPathLabel(branch),
    editingMode: getBranchEditingMode(branch),
    processStatus: branch.status ?? null,
    resolution: branch.resolution ?? null,
  }));
}

export function getBranchPathLabel(branch: AmendmentProcessBranchSource | null | undefined) {
  if (!branch) return translate('features.amendments.branches.branch');

  const stepLabels = getOrderedBranchSteps(branch)
    .map(
      step =>
        step.target_group?.name ??
        step.source_group?.name ??
        step.workflow_step?.label ??
        (typeof step.order_index === 'number'
          ? translate('features.amendments.branches.step', {
              number: step.order_index + 1,
            })
          : null)
    )
    .filter(Boolean);

  return stepLabels.length > 0
    ? stepLabels.join(' -> ')
    : (branch.title ?? translate('features.amendments.branches.branch'));
}

export function getBranchDisplayEvent(branch: AmendmentProcessBranchSource | null | undefined) {
  const steps = getOrderedBranchSteps(branch);
  return (
    steps.find(step => step.event_id && !TERMINAL_BRANCH_STATUSES.has(step.status ?? '')) ??
    steps.find(step => step.event_id) ??
    null
  );
}

export function countOpenChangeRequests(branch: AmendmentProcessBranchSource | null | undefined) {
  return (branch?.change_requests ?? []).filter(changeRequest => {
    if (changeRequest.voting_status === 'completed') return false;
    return !['accepted', 'approved', 'rejected', 'declined'].includes(changeRequest.status ?? '');
  }).length;
}

export function isBranchEditable(branch: AmendmentProcessBranchSource | null | undefined) {
  return (
    !TERMINAL_BRANCH_STATUSES.has(branch?.status ?? '') &&
    !READONLY_BRANCH_RESOLUTIONS.has(branch?.resolution ?? '')
  );
}

export function getBranchEditingModePolicyContext(
  branch: AmendmentProcessBranchSource | null | undefined
) {
  const currentMode = getBranchEditingMode(branch);
  const firstEventStep = getOrderedBranchSteps(branch).find(step => Boolean(step.event_id));
  const firstAgendaItem = firstEventStep?.agenda_item ?? null;

  return {
    currentMode,
    hasProcess: Boolean(branch),
    firstAgendaItemStarted: isAgendaItemStarted(firstAgendaItem),
    eventSuggestionOpen: currentMode === 'suggest_event',
    eventVotingOpen: currentMode === 'event_final_closing_vote',
  };
}

export function getBranchEditingModeDisabledReasons(
  branch: AmendmentProcessBranchSource | null | undefined
): Partial<Record<NonTerminalEditingMode, string>> {
  if (branch && !isBranchEditable(branch)) {
    return Object.fromEntries(
      AMENDMENT_EDITING_MODE_ORDER.map(mode => [mode, 'branch-readonly'])
    ) as Partial<Record<NonTerminalEditingMode, string>>;
  }

  return getAmendmentEditingModePolicy(getBranchEditingModePolicyContext(branch))
    .disabledModeReasons;
}

export function getBranchDocumentContent(branch: AmendmentProcessBranchSource | null | undefined) {
  return branch?.document?.content ?? branch?.document_version?.content ?? null;
}

export function getBranchCreatedAt(branch: AmendmentProcessBranchSource | null | undefined) {
  const value = branch?.created_at;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function getWinnerBranch(
  branches: readonly AmendmentProcessBranchSource[],
  activeBranchId?: string | null
) {
  return (
    branches.find(branch => branch.resolution === 'winner' || branch.resolution === 'accepted') ??
    branches.find(branch => branch.status === 'merged' || branch.status === 'completed') ??
    branches.find(branch => branch.id === activeBranchId) ??
    null
  );
}

export function getResolvedMergeWinnerBranch(
  branches: readonly AmendmentProcessBranchSource[],
  activeBranchId?: string | null
) {
  const orderedBranches = getOrderedBranches(branches);
  const branchById = new Map(orderedBranches.map(branch => [branch.id, branch]));
  const mergedIntoBranchId = orderedBranches.find(branch =>
    branch.merged_into_branch_id ? branchById.has(branch.merged_into_branch_id) : false
  )?.merged_into_branch_id;

  if (mergedIntoBranchId) {
    return branchById.get(mergedIntoBranchId) ?? null;
  }

  const explicitWinner =
    orderedBranches.find(
      branch => branch.resolution === 'winner' || branch.resolution === 'accepted'
    ) ??
    orderedBranches.find(branch => branch.status === 'merged' || branch.status === 'completed') ??
    null;

  if (explicitWinner) {
    return explicitWinner;
  }

  const hasMergeResult = orderedBranches.some(
    branch => branch.resolution === 'merge_loser' || Boolean(branch.merged_into_branch_id)
  );

  return hasMergeResult && activeBranchId ? (branchById.get(activeBranchId) ?? null) : null;
}

export function resolveEventDetailSelectedBranchId({
  branches,
  requestedBranchId,
  activeBranchId,
}: {
  branches: readonly AmendmentProcessBranchSource[];
  requestedBranchId?: string | null;
  activeBranchId?: string | null;
}) {
  const orderedBranches = getOrderedBranches(branches);
  if (orderedBranches.length === 0) return null;

  const requestedBranch = orderedBranches.find(branch => branch.id === requestedBranchId);
  if (requestedBranch) return requestedBranch.id;

  const winnerBranch = getResolvedMergeWinnerBranch(orderedBranches, activeBranchId);
  if (winnerBranch) return winnerBranch.id;

  return orderedBranches[0]?.id ?? null;
}

export function getLatestBranchWithContent(branches: readonly AmendmentProcessBranchSource[]) {
  return [...branches]
    .filter(branch => getBranchDocumentContent(branch))
    .sort((left, right) => getBranchCreatedAt(right) - getBranchCreatedAt(left))[0];
}

export function resolveSelectedBranchId({
  branches,
  requestedBranchId,
  activeBranchId,
}: {
  branches: readonly AmendmentProcessBranchSource[];
  requestedBranchId?: string | null;
  activeBranchId?: string | null;
}) {
  if (branches.length === 0) return null;

  const requestedBranch = branches.find(branch => branch.id === requestedBranchId);
  if (requestedBranch) return requestedBranch.id;

  const activeBranch = branches.find(branch => branch.id === activeBranchId);
  if (activeBranch) return activeBranch.id;

  const firstEditableBranch = branches.find(isBranchEditable);
  if (firstEditableBranch) return firstEditableBranch.id;

  const winnerBranch =
    branches.find(branch => branch.resolution === 'winner') ??
    branches.find(branch => branch.status === 'merged' || branch.status === 'completed');
  return winnerBranch?.id ?? null;
}

export function buildBranchDiffCandidates({
  branches,
  originalContent,
  activeBranchId,
}: {
  branches: readonly AmendmentProcessBranchSource[];
  originalContent?: unknown;
  activeBranchId?: string | null;
}): VariantDiffCandidate[] {
  const winnerBranch = getWinnerBranch(branches, activeBranchId);

  return [
    originalContent
      ? {
          id: 'original-document',
          label: translate('features.amendments.branches.originalDocument'),
          content: originalContent,
          isOriginal: true,
        }
      : null,
    ...branches
      .map(branch => {
        const content = getBranchDocumentContent(branch);
        if (!content) return null;

        return {
          id: branch.id,
          label: getBranchPathLabel(branch),
          groupName:
            branch.status || branch.resolution
              ? [branch.status, branch.resolution].filter(Boolean).join(' / ')
              : null,
          content,
          isWinner: branch.id === winnerBranch?.id,
        };
      })
      .filter(Boolean),
  ].filter(Boolean) as VariantDiffCandidate[];
}
