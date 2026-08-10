import { parse } from 'csv-parse/browser/esm/sync';
import {
  MAX_CHART_POINTS,
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
  MAX_MANUAL_CSV_BYTES,
  type ChartMapping,
  type ChartPoint,
  type ChartTableMode,
} from '../types';

export interface ParsedChartTable {
  columns: string[];
  rows: Record<string, string>[];
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

export function parseChartCsv(text: string): ParsedChartTable {
  if (new TextEncoder().encode(text).byteLength > MAX_MANUAL_CSV_BYTES) {
    throw new Error('CSV_FILE_TOO_LARGE');
  }

  let parsedRows: string[][];
  try {
    parsedRows = parse(text, {
      bom: true,
      skip_empty_lines: true,
    }) as string[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CSV_PARSE_FAILED';
    throw new Error(message, { cause: error });
  }

  const [headerRow = [], ...dataRows] = parsedRows;
  const columns = normalizeHeaderRow(headerRow);
  if (columns.length === 0) {
    throw new Error('CSV_HAS_NO_COLUMNS');
  }
  if (columns.length > MAX_MANUAL_CHART_COLUMNS) {
    throw new Error('CSV_HAS_TOO_MANY_COLUMNS');
  }

  const rows = dataRows
    .slice(0, MAX_MANUAL_CHART_ROWS + 1)
    .map(row =>
      Object.fromEntries(columns.map((column, index) => [column, String(row[index]).trim()]))
    )
    .filter(row => columns.some(column => row[column] !== ''));

  if (rows.length > MAX_MANUAL_CHART_ROWS) {
    throw new Error('CSV_HAS_TOO_MANY_ROWS');
  }

  return { columns, rows };
}

function parseChartNumber(rawValue: string) {
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

function hasNumericValue(rows: readonly Record<string, string>[], column: string) {
  return rows.some(row => Number.isFinite(parseChartNumber(String(row[column] ?? ''))));
}

function isDateLikeColumnName(column: string) {
  const value = column.trim();
  return (
    /^\d{4}$/.test(value) ||
    /^\*?\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(value) ||
    /^\d{4}[./-]\d{1,2}([./-]\d{1,2})?$/.test(value)
  );
}

export function getChartMappingValueColumns(table: ParsedChartTable, mapping: ChartMapping) {
  const explicitValueColumns = mapping.valueColumns?.filter(column =>
    table.columns.includes(column)
  );
  if (explicitValueColumns?.length) return explicitValueColumns;

  return table.columns.filter(
    column => column !== mapping.xColumn && hasNumericValue(table.rows, column)
  );
}

export function inferChartMapping(table: ParsedChartTable): ChartMapping {
  const xColumn = table.columns[0] ?? '';
  const valueColumn =
    table.columns.find(column => hasNumericValue(table.rows, column)) ??
    table.columns[1] ??
    xColumn;
  const numericColumns = table.columns.filter(
    column => column !== xColumn && hasNumericValue(table.rows, column)
  );
  const dateLikeNumericColumns = numericColumns.filter(isDateLikeColumnName);

  if (dateLikeNumericColumns.length >= 2 || numericColumns.length >= 3) {
    const valueColumns =
      dateLikeNumericColumns.length >= 2 ? dateLikeNumericColumns : numericColumns;
    return {
      xColumn,
      valueColumn: valueColumns[0],
      seriesColumn: null,
      tableMode: 'rowsAsSeries',
      valueColumns,
    };
  }

  return {
    xColumn,
    valueColumn,
    seriesColumn: null,
    tableMode: 'columnMapping',
  };
}

function pushChartPoint(
  points: ChartPoint[],
  keys: Set<string>,
  x: string,
  rawValue: string,
  series: string
) {
  const value = parseChartNumber(rawValue);
  if (!x || rawValue === '' || !Number.isFinite(value)) {
    throw new Error('CHART_INVALID_NUMBER');
  }

  const key = `${x}\u0000${series}`;
  if (keys.has(key)) {
    throw new Error('CHART_DUPLICATE_POINT');
  }
  keys.add(key);

  points.push({
    x,
    value,
    series: series || null,
  });
}

function buildColumnMappedChartPoints(
  rows: readonly Record<string, string>[],
  mapping: ChartMapping
) {
  if (!mapping.xColumn || !mapping.valueColumn) {
    throw new Error('CHART_MAPPING_INCOMPLETE');
  }

  const points: ChartPoint[] = [];
  const keys = new Set<string>();

  for (const row of rows) {
    const x = String(row[mapping.xColumn] ?? '').trim();
    const rawValue = String(row[mapping.valueColumn] ?? '').trim();
    const series = mapping.seriesColumn ? String(row[mapping.seriesColumn] ?? '').trim() : '';

    if (!x && !rawValue && !series) {
      continue;
    }

    pushChartPoint(points, keys, x, rawValue, series);
  }

  return points;
}

function buildWideTableChartPoints(rows: readonly Record<string, string>[], mapping: ChartMapping) {
  if (!mapping.xColumn || !mapping.valueColumns?.length) {
    throw new Error('CHART_MAPPING_INCOMPLETE');
  }

  const points: ChartPoint[] = [];
  const keys = new Set<string>();

  for (const row of rows) {
    const rowLabel = String(row[mapping.xColumn] ?? '').trim();
    if (!rowLabel) continue;

    for (const valueColumn of mapping.valueColumns) {
      const rawValue = String(row[valueColumn] ?? '').trim();
      if (!rawValue) continue;

      if (mapping.tableMode === 'columnsAsSeries') {
        pushChartPoint(points, keys, rowLabel, rawValue, valueColumn);
      } else {
        pushChartPoint(points, keys, valueColumn.replace(/^\*/, ''), rawValue, rowLabel);
      }
    }
  }

  return points;
}

export function buildChartPoints(
  rows: readonly Record<string, string>[],
  mapping: ChartMapping
): ChartPoint[] {
  const mode: ChartTableMode = mapping.tableMode ?? 'columnMapping';
  const points =
    mode === 'columnMapping'
      ? buildColumnMappedChartPoints(rows, mapping)
      : buildWideTableChartPoints(rows, mapping);

  if (points.length === 0) {
    throw new Error('CHART_HAS_NO_POINTS');
  }
  if (points.length > MAX_CHART_POINTS) {
    throw new Error('CHART_HAS_TOO_MANY_POINTS');
  }

  return points;
}

export function createEmptyChartTable(): ParsedChartTable {
  return {
    columns: ['Category', 'Value'],
    rows: [
      { Category: 'A', Value: '10' },
      { Category: 'B', Value: '18' },
      { Category: 'C', Value: '13' },
    ],
  };
}
