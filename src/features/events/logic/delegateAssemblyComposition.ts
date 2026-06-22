import { parseDelegateElectionMetadata } from '@/features/elections/logic/electionAssignmentMetadata';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type DelegateAssemblyCompositionChartId = 'planned' | 'scheduled' | 'elected';
export type DelegateAssemblyCompositionMetric = DelegateAssemblyCompositionChartId;

export interface DelegateAssemblyCompositionGroupLike {
  id?: string | null;
  name?: string | null;
}

export interface DelegateAssemblyAllocationLike {
  group_id?: string | null;
  allocated_seats?: number | null;
  group?: DelegateAssemblyCompositionGroupLike | null;
}

export interface DelegateAssemblyDelegateLike {
  group_id?: string | null;
  seat_count?: number | null;
  status?: string | null;
  group?: DelegateAssemblyCompositionGroupLike | null;
}

export interface DelegateAssemblyScheduledElectionLike {
  description?: string | null;
  agenda_item?: {
    event?: {
      id?: string | null;
      status?: string | null;
      start_date?: number | null;
      end_date?: number | null;
    } | null;
  } | null;
}

export interface DelegateAssemblyCompositionRow {
  key: string;
  groupId: string;
  label: string;
  plannedSeatCount: number;
  scheduledSeatCount: number;
  electedSeatCount: number;
  value: number;
  percentage: number;
}

export interface DelegateAssemblyCompositionSectionRow {
  key: string;
  label: string;
  groupId?: string;
  value: number;
  share: number;
  kind: 'group' | 'remainder';
}

export interface DelegateAssemblyCompositionSection {
  id: DelegateAssemblyCompositionChartId;
  rows: DelegateAssemblyCompositionSectionRow[];
  total: number;
}

type DelegateAssemblyScheduledEventLike = NonNullable<
  NonNullable<DelegateAssemblyScheduledElectionLike['agenda_item']>['event']
>;

interface BuildDelegateAssemblyCompositionBaseArgs {
  targetEventId: string;
  allocations: readonly DelegateAssemblyAllocationLike[];
  delegates: readonly DelegateAssemblyDelegateLike[];
  scheduledElections: readonly DelegateAssemblyScheduledElectionLike[];
  referenceTime?: number;
}

interface BuildDelegateAssemblyCompositionRowsArgs extends BuildDelegateAssemblyCompositionBaseArgs {
  metric: DelegateAssemblyCompositionMetric;
}

interface MutableCompositionRow {
  groupId: string;
  label: string;
  plannedSeatCount: number;
  scheduledSeatCount: number;
  electedSeatCount: number;
}

function isFutureOrOngoingEvent(
  event: DelegateAssemblyScheduledEventLike | null | undefined,
  referenceTime: number
) {
  if (!event || event.status === 'cancelled') {
    return false;
  }

  const endDate = event.end_date ?? event.start_date ?? 0;
  return endDate >= referenceTime;
}

function getGroupId(
  item: Pick<DelegateAssemblyAllocationLike, 'group_id' | 'group'> | null | undefined
) {
  return item?.group_id || item?.group?.id || null;
}

function getOrCreateRow(
  rowsByGroupId: Map<string, MutableCompositionRow>,
  groupId: string,
  label?: string | null
) {
  const existingRow = rowsByGroupId.get(groupId);
  if (existingRow) {
    if ((!existingRow.label || existingRow.label === groupId) && label) {
      existingRow.label = label;
    }
    return existingRow;
  }

  const row: MutableCompositionRow = {
    groupId,
    label: label || groupId,
    plannedSeatCount: 0,
    scheduledSeatCount: 0,
    electedSeatCount: 0,
  };
  rowsByGroupId.set(groupId, row);
  return row;
}

function getMetricValue(row: MutableCompositionRow, metric: DelegateAssemblyCompositionMetric) {
  switch (metric) {
    case 'scheduled':
      return row.scheduledSeatCount;
    case 'elected':
      return row.electedSeatCount;
    case 'planned':
    default:
      return row.plannedSeatCount;
  }
}

function buildMutableCompositionRows({
  targetEventId,
  allocations,
  delegates,
  scheduledElections,
  referenceTime = Date.now(),
}: BuildDelegateAssemblyCompositionBaseArgs): MutableCompositionRow[] {
  const rowsByGroupId = new Map<string, MutableCompositionRow>();

  for (const allocation of allocations) {
    const groupId = getGroupId(allocation);
    if (!groupId) {
      continue;
    }

    const row = getOrCreateRow(rowsByGroupId, groupId, allocation.group?.name);
    row.plannedSeatCount += Math.max(0, allocation.allocated_seats ?? 0);
  }

  for (const delegate of delegates) {
    if (delegate.status !== 'confirmed') {
      continue;
    }

    const groupId = getGroupId(delegate);
    if (!groupId) {
      continue;
    }

    const row = getOrCreateRow(rowsByGroupId, groupId, delegate.group?.name);
    row.electedSeatCount += Math.max(1, delegate.seat_count ?? 1);
  }

  const scheduledSeatIdsByGroupId = new Map<string, Set<string>>();
  for (const election of scheduledElections) {
    const metadata = parseDelegateElectionMetadata(election.description);
    if (!metadata || metadata.targetEventId !== targetEventId || !metadata.sourceGroupId) {
      continue;
    }

    if (!isFutureOrOngoingEvent(election.agenda_item?.event ?? null, referenceTime)) {
      continue;
    }

    const scheduledSeatIds =
      scheduledSeatIdsByGroupId.get(metadata.sourceGroupId) ?? new Set<string>();
    for (const seatRoleId of metadata.allSeatRoleIds.length > 0
      ? metadata.allSeatRoleIds
      : metadata.seatRoleIds) {
      scheduledSeatIds.add(seatRoleId);
    }
    scheduledSeatIdsByGroupId.set(metadata.sourceGroupId, scheduledSeatIds);
  }

  for (const [groupId, seatRoleIds] of scheduledSeatIdsByGroupId.entries()) {
    const row = getOrCreateRow(rowsByGroupId, groupId);
    row.scheduledSeatCount = seatRoleIds.size;
  }

  const rows = [...rowsByGroupId.values()].filter(
    row => row.plannedSeatCount > 0 || row.scheduledSeatCount > 0 || row.electedSeatCount > 0
  );

  return rows;
}

function sortSectionRows<T extends { label: string; value: number }>(rows: T[]) {
  return [...rows].sort(
    (left, right) =>
      right.value - left.value ||
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
  );
}

function finalizeSection(
  id: DelegateAssemblyCompositionChartId,
  groupRows: Omit<DelegateAssemblyCompositionSectionRow, 'share'>[],
  remainderRow?: Omit<DelegateAssemblyCompositionSectionRow, 'share'>
): DelegateAssemblyCompositionSection {
  const rowsWithoutShares = [
    ...sortSectionRows(groupRows),
    ...(remainderRow ? [remainderRow] : []),
  ];
  const total = rowsWithoutShares.reduce((sum, row) => sum + row.value, 0);

  return {
    id,
    total,
    rows: rowsWithoutShares.map(row => ({
      ...row,
      share: total > 0 ? (row.value / total) * 100 : 0,
    })),
  };
}

export function buildDelegateAssemblyCompositionSections(
  args: BuildDelegateAssemblyCompositionBaseArgs
): DelegateAssemblyCompositionSection[] {
  const rows = buildMutableCompositionRows(args);
  const plannedTotal = rows.reduce((sum, row) => sum + row.plannedSeatCount, 0);
  const scheduledTotal = rows.reduce((sum, row) => sum + row.scheduledSeatCount, 0);
  const electedTotal = rows.reduce((sum, row) => sum + row.electedSeatCount, 0);

  const plannedRows = rows
    .filter(row => row.plannedSeatCount > 0)
    .map(row => ({
      key: row.groupId,
      label: row.label,
      groupId: row.groupId,
      value: row.plannedSeatCount,
      kind: 'group' as const,
    }));

  const scheduledRows = rows
    .filter(row => row.scheduledSeatCount > 0)
    .map(row => ({
      key: row.groupId,
      label: row.label,
      groupId: row.groupId,
      value: row.scheduledSeatCount,
      kind: 'group' as const,
    }));

  const electedRows = rows
    .filter(row => row.electedSeatCount > 0)
    .map(row => ({
      key: row.groupId,
      label: row.label,
      groupId: row.groupId,
      value: row.electedSeatCount,
      kind: 'group' as const,
    }));

  return [
    finalizeSection('planned', plannedRows),
    finalizeSection(
      'scheduled',
      scheduledRows,
      plannedTotal > 0 || scheduledTotal > 0
        ? {
            key: 'unscheduled',
            label: translateText('features.events.participants.composition.remainder.unscheduled'),
            value: Math.max(0, plannedTotal - scheduledTotal),
            kind: 'remainder' as const,
          }
        : undefined
    ),
    finalizeSection(
      'elected',
      electedRows,
      plannedTotal > 0 || electedTotal > 0
        ? {
            key: 'not-yet-elected',
            label: translateText(
              'features.events.participants.composition.remainder.notYetElected'
            ),
            value: Math.max(0, plannedTotal - electedTotal),
            kind: 'remainder' as const,
          }
        : undefined
    ),
  ];
}

export function buildDelegateAssemblyCompositionRows({
  metric,
  ...args
}: BuildDelegateAssemblyCompositionRowsArgs): DelegateAssemblyCompositionRow[] {
  const rows = buildMutableCompositionRows(args);
  const total = rows.reduce((sum, row) => sum + getMetricValue(row, metric), 0);

  return rows
    .map(row => {
      const value = getMetricValue(row, metric);
      return {
        key: row.groupId,
        groupId: row.groupId,
        label: row.label,
        plannedSeatCount: row.plannedSeatCount,
        scheduledSeatCount: row.scheduledSeatCount,
        electedSeatCount: row.electedSeatCount,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      };
    })
    .sort(
      (left, right) =>
        right.value - left.value ||
        right.plannedSeatCount - left.plannedSeatCount ||
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    );
}
