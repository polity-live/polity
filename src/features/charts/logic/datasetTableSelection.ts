import { selectedDatasetMeasure } from './datasetSelection';
import type {
  DatasetMeasureOption,
  DataViewQuery,
  DatasetColumnProfile,
  DatasetTableSelection,
} from '../types';

/** Table filtering and chart projection share one persisted selection. Visibility does not remove filters. */
export function applyDatasetTableSelection(
  query: DataViewQuery,
  selection: DatasetTableSelection,
  profiles: DatasetColumnProfile[],
  measureOptions: DatasetMeasureOption[] = []
): DataViewQuery {
  const columns = selection.columns.filter(name => profiles.some(profile => profile.name === name));
  const measures = profiles.filter(
    profile =>
      columns.includes(profile.name) && profile.role === 'measure' && profile.type === 'number'
  );
  const dimensions = profiles.filter(
    profile => columns.includes(profile.name) && profile.role !== 'measure' && !profile.technical
  );
  let filters = { ...selection.rowFilters };
  const conditions = selection.rowConditions.filter(condition => {
    if (
      condition.operator === 'in' &&
      condition.values.length === 1 &&
      condition.values[0] !== ''
    ) {
      filters[condition.column] = condition.values[0];
      return false;
    }
    filters = Object.fromEntries(
      Object.entries(filters).filter(([column]) => column !== condition.column)
    );
    return true;
  });
  const measure = selectedDatasetMeasure(measureOptions, {
    ...query,
    filters,
    rowConditions: conditions,
  });
  if (measure) filters = { ...filters, ...measure.filters };
  return {
    ...query,
    filters,
    rowConditions: conditions,
    timeRange: selection.timeRange,
    columns,
    sort: selection.sort,
    measureColumn: measures.some(profile => profile.name === query.measureColumn)
      ? query.measureColumn
      : (measures[0]?.name ?? null),
    dimensionColumn: dimensions.some(profile => profile.name === query.dimensionColumn)
      ? query.dimensionColumn
      : ((dimensions.find(profile => profile.role === 'time') ?? dimensions[0])?.name ?? null),
    seriesColumn:
      query.seriesColumn && columns.includes(query.seriesColumn) ? query.seriesColumn : null,
    ...(query.layout === 'multi' || query.layout === 'wide'
      ? {
          valueColumns: measures.map(profile => profile.name),
          layout: measures.length > 1 ? query.layout : ('long' as const),
        }
      : {}),
  };
}
