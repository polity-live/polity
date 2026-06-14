import Papa from 'papaparse/papaparse.min.js';
import {
  MAX_CHART_POINTS,
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
  MAX_MANUAL_CSV_BYTES,
  type ChartMapping,
  type ChartPoint,
} from '../types';

export interface ParsedChartTable {
  columns: string[];
  rows: Record<string, string>[];
}

export function parseChartCsv(text: string): ParsedChartTable {
  if (new TextEncoder().encode(text).byteLength > MAX_MANUAL_CSV_BYTES) {
    throw new Error('CSV_FILE_TOO_LARGE');
  }

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header, index) => header.trim() || `Column ${index + 1}`,
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || 'CSV_PARSE_FAILED');
  }

  const columns = (result.meta.fields ?? []).map(column => column.trim()).filter(Boolean);
  if (columns.length === 0) {
    throw new Error('CSV_HAS_NO_COLUMNS');
  }
  if (columns.length > MAX_MANUAL_CHART_COLUMNS) {
    throw new Error('CSV_HAS_TOO_MANY_COLUMNS');
  }

  const rows = result.data
    .slice(0, MAX_MANUAL_CHART_ROWS + 1)
    .map(row =>
      Object.fromEntries(columns.map(column => [column, String(row[column] ?? '').trim()]))
    )
    .filter(row => columns.some(column => row[column] !== ''));

  if (rows.length > MAX_MANUAL_CHART_ROWS) {
    throw new Error('CSV_HAS_TOO_MANY_ROWS');
  }

  return { columns, rows };
}

export function inferChartMapping(table: ParsedChartTable): ChartMapping {
  const xColumn = table.columns[0] ?? '';
  const valueColumn =
    table.columns.find(column =>
      table.rows.some(row => {
        const value = Number(row[column]);
        return row[column] !== '' && Number.isFinite(value);
      })
    ) ??
    table.columns[1] ??
    xColumn;

  return {
    xColumn,
    valueColumn,
    seriesColumn: null,
  };
}

export function buildChartPoints(
  rows: readonly Record<string, string>[],
  mapping: ChartMapping
): ChartPoint[] {
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

    const value = Number(rawValue);
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
