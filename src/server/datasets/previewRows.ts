import type { DatasetPreviewRequest, DatasetRowCondition } from '@/features/charts/types';
import type { DatasetTable } from './csv';
import { parseDatasetNumber } from './csv';
import { datasetYear } from './importScope';
import { DatasetProviderFailure } from './providerError';

export function filterPreviewRows(
  table: DatasetTable,
  rowFilters: Record<string, string> = {},
  timeRange?: DatasetPreviewRequest['timeRange'],
  conditions: DatasetRowCondition[] = []
) {
  for (const column of [
    ...Object.keys(rowFilters),
    ...(timeRange ? [timeRange.column] : []),
    ...conditions.map(filter => filter.column),
  ])
    if (!table.columns.includes(column))
      throw new DatasetProviderFailure('Unknown preview column', 'invalid_scope', 422);
  return table.rows.filter(
    row =>
      Object.entries(rowFilters).every(([column, value]) => !value || row[column] === value) &&
      conditions.every(filter => {
        const raw = row[filter.column] ?? '';
        if (filter.operator === 'in') return filter.values.includes(raw);
        if (filter.operator === 'empty') return raw.trim() === '';
        if (filter.operator === 'contains')
          return raw.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase());
        if (!raw.trim()) return false;
        if (filter.numeric) {
          const number = parseDatasetNumber(raw);
          const min = filter.min ? parseDatasetNumber(filter.min) : -Infinity;
          const max = filter.max ? parseDatasetNumber(filter.max) : Infinity;
          return (
            Number.isFinite(number) &&
            !Number.isNaN(min) &&
            !Number.isNaN(max) &&
            number >= min &&
            number <= max
          );
        }
        return (!filter.min || raw >= filter.min) && (!filter.max || raw <= filter.max);
      }) &&
      (!timeRange ||
        (() => {
          const year = datasetYear(row[timeRange.column] ?? '');
          return year !== null && year >= timeRange.startYear && year <= timeRange.endYear;
        })())
  );
}
