import {
  EUROSTAT_DEFAULT_VALUE_FIELD,
  EUROSTAT_VALUE_FIELDS,
  type ChartPoint,
  type ChartType,
  type EurostatDimension,
  type EurostatDimensionValue,
} from '../types';
import type { ParsedChartTable } from './chartData';

export type EurostatChartPreset = 'compareCountriesInYear' | 'showTimeSeriesForCountry';

export interface EurostatObservationLike {
  id?: string;
  value: number;
  dimensions: unknown;
  attributes?: unknown;
}

export interface EurostatPreviewRowView {
  id: string;
  dimensionValues: Record<string, string>;
  value: string;
  attributesText: string;
}

export interface EurostatProjectionPreviewKeyInput {
  datasetId: string | null;
  filters: Record<string, string>;
  xDimension: string;
  seriesDimension?: string | null;
  valueField?: string | null;
  chartType: ChartType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeEurostatJsonRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== null && nested !== undefined && nested !== '')
      .map(([key, nested]) => [key, String(nested)])
  );
}

function findDimensionValue(
  values: readonly EurostatDimensionValue[],
  valueId: string
): EurostatDimensionValue | undefined {
  return values.find(value => value.id === valueId);
}

export function formatEurostatDimensionValue(
  dimension: EurostatDimension,
  valueId: string | null | undefined
) {
  const normalizedValue = String(valueId ?? '').trim();
  if (!normalizedValue) return '';

  const label = findDimensionValue(dimension.values, normalizedValue)?.label?.trim();
  return label ? `${normalizedValue} · ${label}` : normalizedValue;
}

export function createEurostatPreviewRows(
  rows: readonly EurostatObservationLike[],
  dimensions: readonly EurostatDimension[]
): EurostatPreviewRowView[] {
  return rows.slice(0, 5).map((row, index) => {
    const rowDimensions = normalizeEurostatJsonRecord(row.dimensions);
    const attributes = normalizeEurostatJsonRecord(row.attributes);

    return {
      id: row.id ?? `${index}`,
      dimensionValues: Object.fromEntries(
        dimensions.map(dimension => [
          dimension.id,
          formatEurostatDimensionValue(dimension, rowDimensions[dimension.id]),
        ])
      ),
      value: String(row.value),
      attributesText: Object.entries(attributes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · '),
    };
  });
}

export function createEurostatPreviewTable(
  rows: readonly EurostatObservationLike[],
  dimensions: readonly EurostatDimension[]
): ParsedChartTable {
  const hasAttributes = rows.some(
    row => Object.keys(normalizeEurostatJsonRecord(row.attributes)).length > 0
  );
  const columns = [
    ...dimensions.map(dimension =>
      dimension.label ? `${dimension.id} · ${dimension.label}` : dimension.id
    ),
    EUROSTAT_DEFAULT_VALUE_FIELD,
    ...(hasAttributes ? ['Attributes'] : []),
  ];
  const previewRows = createEurostatPreviewRows(rows, dimensions);

  return {
    columns,
    rows: previewRows.map(row => ({
      ...Object.fromEntries(
        dimensions.map(dimension => [
          dimension.label ? `${dimension.id} · ${dimension.label}` : dimension.id,
          row.dimensionValues[dimension.id] || '',
        ])
      ),
      [EUROSTAT_DEFAULT_VALUE_FIELD]: row.value,
      ...(hasAttributes ? { Attributes: row.attributesText } : {}),
    })),
  };
}

export function createEurostatEditableTable({
  points,
  xDimension,
  valueField = EUROSTAT_DEFAULT_VALUE_FIELD,
  seriesDimension,
}: {
  points: readonly ChartPoint[];
  xDimension: string;
  valueField?: string | null;
  seriesDimension?: string | null;
}): ParsedChartTable {
  const normalizedValueField = valueField || EUROSTAT_DEFAULT_VALUE_FIELD;
  const normalizedSeriesDimension = seriesDimension || null;
  const columns = [
    xDimension,
    normalizedValueField,
    ...(normalizedSeriesDimension ? [normalizedSeriesDimension] : []),
  ];

  return {
    columns,
    rows: points.map(point => ({
      [xDimension]: point.x,
      [normalizedValueField]: String(point.value),
      ...(normalizedSeriesDimension ? { [normalizedSeriesDimension]: point.series ?? '' } : {}),
    })),
  };
}

export function getDefaultEurostatXDimension(dimensions: readonly EurostatDimension[]) {
  return (
    dimensions.find(dimension => dimension.id === 'TIME_PERIOD')?.id ?? dimensions.at(-1)?.id ?? ''
  );
}

export function getEurostatValueFields() {
  return EUROSTAT_VALUE_FIELDS;
}

export function createDefaultEurostatFilters(
  dimensions: readonly EurostatDimension[],
  xDimension: string,
  seriesDimension: string | null | undefined,
  previousFilters: Record<string, string> = {}
) {
  return Object.fromEntries(
    dimensions
      .filter(dimension => dimension.id !== xDimension && dimension.id !== seriesDimension)
      .map(dimension => [
        dimension.id,
        previousFilters[dimension.id] || dimension.values[0]?.id || '',
      ])
  );
}

export function canApplyEurostatChartPreset(
  dimensions: readonly EurostatDimension[],
  preset: EurostatChartPreset
) {
  const dimensionIds = new Set(dimensions.map(dimension => dimension.id));
  return preset === 'compareCountriesInYear'
    ? dimensionIds.has('geo') && dimensionIds.has('TIME_PERIOD')
    : dimensionIds.has('TIME_PERIOD') && dimensionIds.has('geo');
}

export function createEurostatChartPresetRoles(
  dimensions: readonly EurostatDimension[],
  preset: EurostatChartPreset,
  previousFilters: Record<string, string> = {}
) {
  const preferredXDimension = preset === 'compareCountriesInYear' ? 'geo' : 'TIME_PERIOD';
  const xDimension =
    dimensions.find(dimension => dimension.id === preferredXDimension)?.id ??
    getDefaultEurostatXDimension(dimensions);
  const seriesDimension = null;

  return {
    xDimension,
    seriesDimension,
    filters: createDefaultEurostatFilters(dimensions, xDimension, seriesDimension, previousFilters),
  };
}

export function getRequiredEurostatFilterIds(
  dimensions: readonly EurostatDimension[],
  xDimension: string,
  seriesDimension: string | null | undefined
) {
  return dimensions
    .map(dimension => dimension.id)
    .filter(dimensionId => dimensionId !== xDimension && dimensionId !== seriesDimension);
}

export function countMissingEurostatFilters(
  dimensions: readonly EurostatDimension[],
  xDimension: string,
  seriesDimension: string | null | undefined,
  filters: Record<string, string>
) {
  return getRequiredEurostatFilterIds(dimensions, xDimension, seriesDimension).filter(
    dimensionId => !filters[dimensionId]
  ).length;
}

export function normalizeEurostatProjectionFilters(filters: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function createEurostatProjectionPreviewKey({
  datasetId,
  filters,
  xDimension,
  seriesDimension,
  valueField,
  chartType,
}: EurostatProjectionPreviewKeyInput) {
  return JSON.stringify({
    datasetId,
    filters: normalizeEurostatProjectionFilters(filters),
    xDimension,
    seriesDimension: seriesDimension ?? null,
    valueField: valueField || EUROSTAT_DEFAULT_VALUE_FIELD,
    chartType,
  });
}
