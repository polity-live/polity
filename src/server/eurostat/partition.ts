import { EUROSTAT_PARTITION_CELL_LIMIT, type EurostatDimension } from '@/features/charts/types';
import { MAX_FILTER_VALUES_PER_REQUEST } from './constants';

export interface EurostatPartition {
  index: number;
  filters: Record<string, string[]>;
  estimatedCells: number;
}

export function estimatePartitionCells(filters: Record<string, readonly string[]>) {
  return Object.values(filters).reduce(
    (product, values) => product * Math.max(1, values.length),
    1
  );
}

export function buildEurostatPartitions(
  dimensions: readonly EurostatDimension[],
  targetCells = EUROSTAT_PARTITION_CELL_LIMIT
): EurostatPartition[] {
  const initialFilters = Object.fromEntries(
    dimensions.map(dimension => [dimension.id, dimension.values.map(value => value.id)])
  );
  const pending: Record<string, string[]>[] = [initialFilters];
  const complete: Record<string, string[]>[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    const cost = estimatePartitionCells(current);
    const splitCandidate = Object.entries(current)
      .filter(([, values]) => values.length > 1)
      .sort((left, right) => right[1].length - left[1].length)[0];

    const hasOversizedFilter = Object.values(current).some(
      values => values.length > MAX_FILTER_VALUES_PER_REQUEST
    );
    if ((!hasOversizedFilter && cost <= targetCells) || !splitCandidate) {
      complete.push(current);
      continue;
    }

    const [dimensionId, values] = splitCandidate;
    const otherCost = Math.max(1, Math.ceil(cost / values.length));
    const costBoundChunkSize = Math.max(1, Math.floor(targetCells / otherCost));
    const chunkSize = Math.max(1, Math.min(MAX_FILTER_VALUES_PER_REQUEST, costBoundChunkSize));

    for (let offset = 0; offset < values.length; offset += chunkSize) {
      pending.push({
        ...current,
        [dimensionId]: values.slice(offset, offset + chunkSize),
      });
    }
  }

  return complete
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    .map((filters, index) => ({
      index,
      filters,
      estimatedCells: estimatePartitionCells(filters),
    }));
}
