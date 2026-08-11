import { parse } from 'csv-parse/sync';
import {
  type DataAggregation,
  type DatasetColumnProfile,
  MAX_CHART_POINTS,
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
  type ChartMapping,
  type ChartPoint,
  type ChartTableMode,
} from '@/features/charts/types';

export interface DatasetTable {
  columns: string[];
  rows: Record<string, string>[];
}

const CSV_DELIMITERS = [',', ';', '\t'] as const;

function escapeCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function tableToCsv(table: DatasetTable) {
  const header = table.columns.map(escapeCsvCell).join(',');
  const rows = table.rows.map(row =>
    table.columns.map(column => escapeCsvCell(String(row[column] ?? ''))).join(',')
  );
  return [header, ...rows].join('\n');
}

function normalizeHeaderRow(headerRow: readonly string[]): string[] {
  const seen = new Map<string, number>();

  return headerRow.map((header, index) => {
    const baseName = header.trim() || `Column ${index + 1}`;
    const previousCount = seen.get(baseName) ?? 0;
    seen.set(baseName, previousCount + 1);
    return previousCount === 0 ? baseName : `${baseName}_${previousCount}`;
  });
}

function parseRows(text: string, delimiter: (typeof CSV_DELIMITERS)[number]) {
  return parse(text, {
    bom: true,
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as string[][];
}

export function parseDatasetCsv(text: string): DatasetTable {
  const attempts = CSV_DELIMITERS.map(delimiter => {
    try {
      const rows = parseRows(text, delimiter);
      const headerWidth = rows[0]?.length ?? 0;
      const rowWidthScore = rows
        .slice(1, 11)
        .filter(row => row.length === headerWidth && row.some(cell => String(cell).trim())).length;
      return { delimiter, rows, headerWidth, rowWidthScore };
    } catch {
      return null;
    }
  }).filter(Boolean) as {
    delimiter: (typeof CSV_DELIMITERS)[number];
    rows: string[][];
    headerWidth: number;
    rowWidthScore: number;
  }[];

  const best = attempts.sort(
    (left, right) =>
      right.headerWidth - left.headerWidth ||
      right.rowWidthScore - left.rowWidthScore ||
      CSV_DELIMITERS.indexOf(left.delimiter) - CSV_DELIMITERS.indexOf(right.delimiter)
  )[0];

  if (!best) throw new Error('CSV_PARSE_FAILED');

  const [headerRow = [], ...dataRows] = best.rows;
  const columns = normalizeHeaderRow(headerRow);
  if (columns.length === 0) throw new Error('CSV_HAS_NO_COLUMNS');
  if (columns.length > MAX_MANUAL_CHART_COLUMNS) throw new Error('CSV_HAS_TOO_MANY_COLUMNS');

  const rows = dataRows
    .slice(0, MAX_MANUAL_CHART_ROWS + 1)
    .map(row =>
      Object.fromEntries(columns.map((column, index) => [column, String(row[index] ?? '').trim()]))
    )
    .filter(row => columns.some(column => row[column] !== ''));

  if (rows.length > MAX_MANUAL_CHART_ROWS) throw new Error('CSV_HAS_TOO_MANY_ROWS');
  return { columns, rows };
}

export function parseDatasetNumber(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) return Number.NaN;

  const withoutPercent = normalized.replace(/%$/, '').trim();
  const withoutSpaces = withoutPercent.replace(/\s+/g, '');
  const commaCount = (withoutSpaces.match(/,/g) ?? []).length;
  const dotCount = (withoutSpaces.match(/\./g) ?? []).length;
  let numericText = withoutSpaces;

  if (commaCount > 0 && dotCount > 0) {
    numericText =
      withoutSpaces.lastIndexOf(',') > withoutSpaces.lastIndexOf('.')
        ? withoutSpaces.replace(/\./g, '').replace(',', '.')
        : withoutSpaces.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    numericText = withoutSpaces.replace(',', '.');
  } else if (commaCount > 1 && dotCount === 0) {
    numericText = withoutSpaces.replace(/,/g, '');
  }

  return Number(numericText);
}

function isDateValue(value: string) {
  const normalized = value.trim();
  if (/^(?:19|20)\d{2}$/.test(normalized)) return true;
  if (
    /^(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])(?:[-/.](?:0?[1-9]|[12]\d|3[01]))?$/.test(normalized)
  ) {
    return true;
  }
  if (/^(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)?\d{2}$/.test(normalized)) {
    return true;
  }
  return false;
}

function hasNameHint(name: string, hints: readonly string[]) {
  const normalized = name.toLocaleLowerCase('de');
  return hints.some(hint => normalized.includes(hint));
}

export function profileDatasetColumns(table: DatasetTable): DatasetColumnProfile[] {
  const rowCount = table.rows.length;

  return table.columns.map(name => {
    const populatedValues = table.rows.map(row => String(row[name] ?? '').trim()).filter(Boolean);
    const distinctValues = new Set(populatedValues);
    const numericValues = populatedValues.map(parseDatasetNumber).filter(Number.isFinite);
    const numericRatio = populatedValues.length ? numericValues.length / populatedValues.length : 0;
    const dateRatio = populatedValues.length
      ? populatedValues.filter(isDateValue).length / populatedValues.length
      : 0;
    const timeHint = hasNameHint(name, [
      'date',
      'datum',
      'year',
      'jahr',
      'time',
      'zeit',
      'month',
      'monat',
      'quarter',
      'quartal',
      'period',
    ]);
    const geoHint = hasNameHint(name, [
      'country',
      'region',
      'land',
      'staat',
      'bundesland',
      'gemeinde',
      'kreis',
      'city',
      'stadt',
      'geo',
    ]);
    const type =
      timeHint || dateRatio >= 0.8
        ? 'date'
        : numericRatio >= 0.8
          ? 'number'
          : distinctValues.size <= Math.max(20, Math.min(200, Math.ceil(rowCount * 0.5)))
            ? 'category'
            : 'text';
    const role =
      type === 'number'
        ? 'measure'
        : type === 'date'
          ? 'time'
          : geoHint
            ? 'geo'
            : type === 'category'
              ? 'dimension'
              : 'label';
    const sortedTextValues = [...distinctValues].sort((left, right) => left.localeCompare(right));
    const sortedNumericValues = [...numericValues].sort((left, right) => left - right);

    return {
      name,
      label: name,
      type,
      role,
      nullCount: rowCount - populatedValues.length,
      distinctCount: distinctValues.size,
      min:
        type === 'number'
          ? sortedNumericValues[0]
          : type === 'date'
            ? (sortedTextValues[0] ?? null)
            : undefined,
      max:
        type === 'number'
          ? sortedNumericValues[sortedNumericValues.length - 1]
          : type === 'date'
            ? (sortedTextValues[sortedTextValues.length - 1] ?? null)
            : undefined,
    } satisfies DatasetColumnProfile;
  });
}

export function aggregateDatasetValues(values: readonly number[], aggregation: DataAggregation) {
  if (aggregation === 'count') return values.length;
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((total, value) => total + value, 0);

  if (aggregation === 'sum') return sum;
  if (aggregation === 'mean') return sum / sorted.length;
  if (aggregation === 'min') return sorted[0];
  if (aggregation === 'max') return sorted[sorted.length - 1];
  return sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

function getChartMappingValueColumns(table: DatasetTable, mapping: ChartMapping) {
  const explicitValueColumns = mapping.valueColumns?.filter(column =>
    table.columns.includes(column)
  );
  if (explicitValueColumns?.length) return explicitValueColumns;

  return table.columns.filter(
    column =>
      column !== mapping.xColumn &&
      table.rows.some(row => Number.isFinite(parseDatasetNumber(String(row[column] ?? ''))))
  );
}

function pushChartPoint(
  points: ChartPoint[],
  keys: Set<string>,
  x: string,
  rawValue: string,
  series: string
) {
  const value = parseDatasetNumber(rawValue);
  if (!x || rawValue === '' || !Number.isFinite(value)) {
    throw new Error('CHART_INVALID_NUMBER');
  }

  const key = `${x}\u0000${series}`;
  if (keys.has(key)) throw new Error('CHART_DUPLICATE_POINT');
  keys.add(key);
  points.push({ x, value, series: series || null });
}

export function buildDatasetProjectionPoints(table: DatasetTable, mapping: ChartMapping) {
  const mode: ChartTableMode = mapping.tableMode ?? 'columnMapping';
  const points: ChartPoint[] = [];
  const keys = new Set<string>();

  if (mode === 'columnMapping') {
    if (!mapping.xColumn || !mapping.valueColumn) throw new Error('CHART_MAPPING_INCOMPLETE');
    for (const row of table.rows) {
      const x = String(row[mapping.xColumn] ?? '').trim();
      const rawValue = String(row[mapping.valueColumn] ?? '').trim();
      const series = mapping.seriesColumn ? String(row[mapping.seriesColumn] ?? '').trim() : '';
      if (!x && !rawValue && !series) continue;
      pushChartPoint(points, keys, x, rawValue, series);
    }
  } else {
    if (!mapping.xColumn) throw new Error('CHART_MAPPING_INCOMPLETE');
    const valueColumns = getChartMappingValueColumns(table, mapping);
    if (valueColumns.length === 0) throw new Error('CHART_MAPPING_INCOMPLETE');

    for (const row of table.rows) {
      const rowLabel = String(row[mapping.xColumn] ?? '').trim();
      if (!rowLabel) continue;

      for (const valueColumn of valueColumns) {
        const rawValue = String(row[valueColumn] ?? '').trim();
        if (!rawValue) continue;
        if (mode === 'columnsAsSeries') {
          pushChartPoint(points, keys, rowLabel, rawValue, valueColumn);
        } else {
          pushChartPoint(points, keys, valueColumn.replace(/^\*/, ''), rawValue, rowLabel);
        }
      }
    }
  }

  if (points.length === 0) throw new Error('CHART_HAS_NO_POINTS');
  if (points.length > MAX_CHART_POINTS) throw new Error('CHART_HAS_TOO_MANY_POINTS');
  return points;
}

export function summarizeDatasetStructure(table: DatasetTable) {
  const numericColumns = table.columns.filter(column =>
    table.rows.some(row => Number.isFinite(parseDatasetNumber(String(row[column] ?? ''))))
  );
  return [
    `${table.rows.length.toLocaleString()} rows`,
    `${table.columns.length.toLocaleString()} columns`,
    numericColumns.length ? `${numericColumns.length.toLocaleString()} numeric columns` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function getDescriptiveStats(table: DatasetTable, column: string) {
  const values = table.rows
    .map(row => parseDatasetNumber(String(row[column] ?? '')))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (values.length === 0) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const median =
    values.length % 2 === 1
      ? values[(values.length - 1) / 2]
      : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;

  return {
    column,
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    mean,
    median,
    sum,
  };
}
