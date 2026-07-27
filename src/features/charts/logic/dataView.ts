import type { ChartPresentation, ChartType, DataViewQuery, DatasetColumnProfile } from '../types';
import { translate } from '@/features/shared/hooks/use-translation';

function firstProfile(
  profiles: readonly DatasetColumnProfile[],
  predicate: (profile: DatasetColumnProfile) => boolean
) {
  return profiles.find(predicate) ?? null;
}

function isYearValueColumn(profile: DatasetColumnProfile) {
  return profile.role === 'measure' && /^(?:19|20)\d{2}$/.test(profile.name.trim());
}

export function getValueColumnLayout(
  profiles: readonly DatasetColumnProfile[],
  valueColumns?: readonly string[]
): NonNullable<DataViewQuery['layout']> {
  const measures = profiles.filter(profile => profile.role === 'measure');
  const selectedMeasures = valueColumns?.length
    ? measures.filter(profile => valueColumns.includes(profile.name))
    : measures;
  if (selectedMeasures.length === 0) return 'long';
  if (
    selectedMeasures.every(isYearValueColumn) &&
    (valueColumns?.length || selectedMeasures.length >= 2)
  ) {
    return 'wide';
  }
  return selectedMeasures.length >= 2 || valueColumns?.length ? 'multi' : 'long';
}

export function inferDataViewConfiguration(profiles: readonly DatasetColumnProfile[]) {
  const measures = profiles.filter(profile => profile.role === 'measure');
  const yearMeasures = measures.filter(isYearValueColumn);
  const measure =
    firstProfile(profiles, profile => profile.role === 'measure') ??
    firstProfile(profiles, profile => profile.type === 'number');
  const dimension =
    firstProfile(profiles, profile => profile.role === 'time') ??
    firstProfile(profiles, profile => profile.role === 'geo') ??
    firstProfile(profiles, profile => profile.role === 'dimension') ??
    firstProfile(profiles, profile => profile.name !== measure?.name);
  const columns = profiles.slice(0, 6).map(profile => profile.name);
  const valueColumnLayout = getValueColumnLayout(profiles);
  const query: DataViewQuery = {
    measureColumn: measure?.name ?? null,
    dimensionColumn: dimension?.name ?? null,
    seriesColumn: null,
    filters: {},
    aggregation: 'sum',
    layout: valueColumnLayout,
    valueColumns:
      valueColumnLayout === 'wide'
        ? yearMeasures.map(profile => profile.name)
        : valueColumnLayout === 'multi'
          ? measures.map(profile => profile.name)
          : undefined,
    columns,
    sort: null,
    limit: 10,
  };
  const chartType: ChartType =
    dimension?.type === 'date' || valueColumnLayout === 'wide' ? 'line' : 'bar';
  const presentation: ChartPresentation = {
    title:
      measure && dimension
        ? translate('common.formats.measureByDimension', {
            measure: measure.label,
            dimension: dimension.label,
          })
        : (measure?.label ?? ''),
    description: '',
    showLegend: true,
    showGrid: true,
    showTooltip: true,
    donut: false,
  };

  return { query, chartType, presentation };
}

export function getFilterableProfiles(profiles: readonly DatasetColumnProfile[]) {
  return profiles
    .filter(profile => profile.role !== 'measure' && profile.distinctCount > 0)
    .sort((left, right) => left.distinctCount - right.distinctCount)
    .slice(0, 8);
}

export function getDataViewTitle({
  datasetTitle,
  measureLabel,
  dimensionLabel,
  view,
}: {
  datasetTitle: string;
  measureLabel?: string | null;
  dimensionLabel?: string | null;
  view: 'chart' | 'table' | 'stat';
}) {
  if (view === 'table') return datasetTitle;
  if (view === 'stat') return measureLabel || datasetTitle;
  return measureLabel && dimensionLabel
    ? translate('common.formats.measureByDimension', {
        measure: measureLabel,
        dimension: dimensionLabel,
      })
    : datasetTitle;
}

export function serializeDatasetTable(
  columns: readonly string[],
  rows: readonly Record<string, string>[]
) {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return [
    columns.map(column => escape(column)).join(','),
    ...rows.map(row => columns.map(column => escape(String(row[column] ?? ''))).join(',')),
  ].join('\n');
}
