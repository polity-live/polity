export interface BranchDisplaySource {
  id: string;
  created_at?: number | string | null;
}

export interface ChangeRequestDisplaySource {
  id: string;
  processBranchId?: string | null;
  process_branch_id?: string | null;
  crId?: string | null;
  cr_id?: string | null;
  title?: string | null;
  crNumber?: number | null;
  createdAt?: number | string | Date | null;
  created_at?: number | string | Date | null;
  order_index?: number | null;
}

export interface BranchScopedDisplayFields {
  displayCrId?: string;
  branchDisplayNumber?: number;
  branchScopedCrNumber?: number;
}

export interface TimelineChangeRequestDisplayFields {
  display_cr_id?: string;
  displayCrId?: string;
  branch_display_number?: number;
  branchDisplayNumber?: number;
  branch_scoped_cr_number?: number;
  branchScopedCrNumber?: number;
}

function getVoteStepKind(item: unknown) {
  return (item as { _voteStepKind?: string } | null | undefined)?._voteStepKind ?? null;
}

function isSequenceBoundaryItem(item: unknown) {
  const row = item as { is_final_vote?: boolean | null } | null | undefined;
  const stepKind = getVoteStepKind(item);
  return (
    Boolean(row?.is_final_vote) ||
    stepKind === 'variant_selection' ||
    stepKind === 'merge_variant' ||
    stepKind === 'change_request_votes_placeholder' ||
    stepKind === 'final_amendment' ||
    stepKind === 'final_amendment_placeholder'
  );
}

function timestamp(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseCrNumber(value: string | null | undefined) {
  const match = value?.match(/^CR-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function existingCrId(row: ChangeRequestDisplaySource) {
  return row.crId ?? row.cr_id ?? (row.title?.startsWith('CR-') ? row.title : null);
}

function stableCrNumber(row: ChangeRequestDisplaySource) {
  if (typeof row.crNumber === 'number' && Number.isFinite(row.crNumber)) {
    return row.crNumber;
  }
  return parseCrNumber(existingCrId(row));
}

function processBranchId(row: ChangeRequestDisplaySource) {
  return row.processBranchId ?? row.process_branch_id ?? null;
}

function compareBranchOrder(left: BranchDisplaySource, right: BranchDisplaySource) {
  const byCreatedAt = timestamp(left.created_at) - timestamp(right.created_at);
  return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
}

function compareChangeRequestOrder(
  left: ChangeRequestDisplaySource,
  right: ChangeRequestDisplaySource
) {
  const byOrderIndex = (left.order_index ?? 0) - (right.order_index ?? 0);
  if ((left.order_index ?? null) !== null || (right.order_index ?? null) !== null) {
    if (byOrderIndex !== 0) return byOrderIndex;
  }

  const leftNumber = stableCrNumber(left);
  const rightNumber = stableCrNumber(right);
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;

  const byCreatedAt =
    timestamp(left.createdAt ?? left.created_at) - timestamp(right.createdAt ?? right.created_at);
  if (byCreatedAt !== 0) return byCreatedAt;

  return (left.title ?? left.crId ?? left.id).localeCompare(right.title ?? right.crId ?? right.id);
}

export function createBranchDisplayNumberMap(branches: readonly BranchDisplaySource[]) {
  const map = new Map<string, number>();
  [...branches].sort(compareBranchOrder).forEach((branch, index) => {
    map.set(branch.id, index + 1);
  });
  return map;
}

export function createBranchScopedChangeRequestDisplayMap<
  TChangeRequest extends ChangeRequestDisplaySource,
>(branches: readonly BranchDisplaySource[], changeRequests: readonly TChangeRequest[]) {
  const branchNumbers = createBranchDisplayNumberMap(branches);
  const displayById = new Map<string, BranchScopedDisplayFields>();
  const requestsByBranch = new Map<string, TChangeRequest[]>();

  for (const request of changeRequests) {
    const branchId = processBranchId(request);
    if (!branchId || !branchNumbers.has(branchId)) {
      displayById.set(request.id, {
        displayCrId: existingCrId(request) ?? request.title ?? undefined,
      });
      continue;
    }

    const branchRequests = requestsByBranch.get(branchId) ?? [];
    branchRequests.push(request);
    requestsByBranch.set(branchId, branchRequests);
  }

  for (const [branchId, requests] of requestsByBranch) {
    const branchDisplayNumber = branchNumbers.get(branchId);
    if (!branchDisplayNumber) continue;

    [...requests].sort(compareChangeRequestOrder).forEach((request, index) => {
      const branchScopedCrNumber = index + 1;
      displayById.set(request.id, {
        displayCrId: `Branch ${branchDisplayNumber} CR-${branchScopedCrNumber}`,
        branchDisplayNumber,
        branchScopedCrNumber,
      });
    });
  }

  return displayById;
}

export function decorateBranchScopedChangeRequests<
  TChangeRequest extends ChangeRequestDisplaySource,
>(branches: readonly BranchDisplaySource[], changeRequests: readonly TChangeRequest[]) {
  const displayById = createBranchScopedChangeRequestDisplayMap(branches, changeRequests);

  return changeRequests.map(request => ({
    ...request,
    ...displayById.get(request.id),
  }));
}

export function decorateBranchScopedTimelineItems<TTimelineItem extends Record<string, any>>(
  branches: readonly BranchDisplaySource[],
  items: readonly TTimelineItem[]
): TTimelineItem[] {
  const requestSources: ChangeRequestDisplaySource[] = [];

  for (const item of items) {
    const changeRequest = item.change_request;
    if (!changeRequest || item.is_final_vote) continue;

    requestSources.push({
      id: item.change_request_id ?? changeRequest.id ?? item.id,
      process_branch_id:
        changeRequest.process_branch_id ?? changeRequest.processBranchId ?? item._processBranchId,
      cr_id: changeRequest.cr_id ?? changeRequest.crId ?? null,
      title: changeRequest.title ?? null,
      created_at: changeRequest.created_at ?? null,
      order_index: item.order_index ?? null,
    });
  }
  const displayById = createBranchScopedChangeRequestDisplayMap(branches, requestSources);

  return items.map(item => {
    const changeRequest = item.change_request;
    if (!changeRequest || item.is_final_vote) return item;

    const id = item.change_request_id ?? changeRequest.id ?? item.id;
    const display = displayById.get(id);
    if (!display?.displayCrId) return item;

    return {
      ...item,
      change_request: {
        ...changeRequest,
        display_cr_id: display.displayCrId,
        displayCrId: display.displayCrId,
        branch_display_number: display.branchDisplayNumber,
        branchDisplayNumber: display.branchDisplayNumber,
        branch_scoped_cr_number: display.branchScopedCrNumber,
        branchScopedCrNumber: display.branchScopedCrNumber,
      } satisfies typeof changeRequest & TimelineChangeRequestDisplayFields,
    };
  });
}

export function getTimelineItemProcessBranchId(item: Record<string, any>) {
  return (
    item.process_branch_id ??
    item.processBranchId ??
    item.change_request?.process_branch_id ??
    item.change_request?.processBranchId ??
    item._processBranchId ??
    null
  );
}

export function filterTimelineItemsForProcessBranch<TTimelineItem extends Record<string, any>>(
  items: readonly TTimelineItem[],
  processBranchId?: string | null
): TTimelineItem[] {
  return items.filter(item => {
    if (isSequenceBoundaryItem(item)) return true;

    const itemBranchId = getTimelineItemProcessBranchId(item);
    return processBranchId ? itemBranchId === processBranchId : !itemBranchId;
  });
}
