import type { ChartPoint, DataAggregation } from '@/features/charts/types';
import { aggregateDatasetValues, parseDatasetNumber, type DatasetTable } from './csv';

export function buildMultiMeasureProjectionPoints({
  table,
  dimensionColumn,
  valueColumns,
  aggregation,
}: {
  table: DatasetTable;
  dimensionColumn: string;
  valueColumns: readonly string[];
  aggregation: DataAggregation;
}) {
  const groups = new Map<string, { x: string; series: string; values: number[] }>();

  for (const row of table.rows) {
    const x = String(row[dimensionColumn] ?? '').trim();
    if (!x) continue;
    for (const valueColumn of valueColumns) {
      const rawValue = String(row[valueColumn] ?? '').trim();
      if (!rawValue) continue;
      const value = aggregation === 'count' ? 1 : parseDatasetNumber(rawValue);
      if (!Number.isFinite(value)) continue;
      const key = `${x}\u0000${valueColumn}`;
      const group = groups.get(key) ?? { x, series: valueColumn, values: [] };
      group.values.push(value);
      groups.set(key, group);
    }
  }

  return [...groups.values()].flatMap<ChartPoint>(group => {
    const value = aggregateDatasetValues(group.values, aggregation) as number;
    return [{ x: group.x, value, series: group.series }];
  });
}
