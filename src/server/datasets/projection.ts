import type {
  ChartPoint,
  DataAggregation,
  DataViewQuery,
  EurostatDimension,
} from '@/features/charts/types';
import { aggregateDatasetValues, parseDatasetNumber, type DatasetTable } from './csv';
import { DatasetProviderFailure } from './providerError';
import { encodeAppError } from '@/features/shared/errors/app-error';

export function assertProviderProjectionScope(
  table: DatasetTable,
  query: DataViewQuery,
  metadata?: Record<string, unknown>
) {
  const dimensions = metadata?.providerDimensions;
  if (!Array.isArray(dimensions)) return;
  for (const dimension of dimensions as EurostatDimension[]) {
    if (!table.columns.includes(dimension.id) || dimension.id === metadata?.timeDimension) continue;
    const fixed = /^(unit|freq|value_unit|value_variable_code)$/i.test(dimension.id);
    if (!fixed && [query.dimensionColumn, query.seriesColumn].includes(dimension.id)) continue;
    let first: string | undefined;
    for (const row of table.rows) {
      const value = String(row[dimension.id] ?? '');
      if (first === undefined) first = value;
      else if (first !== value)
        throw new DatasetProviderFailure(
          `Choose one value for ${dimension.label} before combining observations`,
          'invalid_scope',
          422
        );
    }
  }
  if (
    query.aggregation === 'sum' &&
    table.rows.some(row =>
      /%|percent|prozent|index|^PC(?:_|$)|^I\d/i.test(row.value_unit ?? row.unit ?? '')
    )
  )
    throw new Error(encodeAppError('dataset_non_additive'));
}

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
