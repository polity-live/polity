import { parse } from 'csv-parse/sync';
import {
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
  MAX_MANUAL_CSV_BYTES,
} from '@/features/charts/types';

export interface ParsedGovDataCsvTable {
  columns: string[];
  rows: Record<string, string>[];
}

const CSV_DELIMITERS = [',', ';', '\t'] as const;
type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

interface ParsedRowsAttempt {
  delimiter: CsvDelimiter;
  rows: string[][];
  headerWidth: number;
  rowWidthScore: number;
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

function parseRows(text: string, delimiter: CsvDelimiter) {
  return parse(text, {
    bom: true,
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as string[][];
}

function chooseParsedRows(text: string) {
  const attempts = CSV_DELIMITERS.map(delimiter => {
    try {
      const rows = parseRows(text, delimiter);
      const headerWidth = rows[0]?.length ?? 0;
      const rowWidthScore = rows
        .slice(1, 11)
        .filter(
          row => row.length === headerWidth && row.some(cell => String(cell).trim() !== '')
        ).length;
      return { delimiter, rows, headerWidth, rowWidthScore };
    } catch {
      return null;
    }
  }).filter((attempt): attempt is ParsedRowsAttempt => Boolean(attempt));

  const best = attempts.sort(
    (left, right) =>
      right.headerWidth - left.headerWidth ||
      right.rowWidthScore - left.rowWidthScore ||
      CSV_DELIMITERS.indexOf(left.delimiter) - CSV_DELIMITERS.indexOf(right.delimiter)
  )[0];

  if (!best) {
    throw new Error('CSV_PARSE_FAILED');
  }
  return best.rows;
}

export function parseGovDataCsvTable(text: string): ParsedGovDataCsvTable {
  if (new TextEncoder().encode(text).byteLength > MAX_MANUAL_CSV_BYTES) {
    throw new Error('CSV_FILE_TOO_LARGE');
  }

  const [headerRow = [], ...dataRows] = chooseParsedRows(text);
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
      Object.fromEntries(columns.map((column, index) => [column, String(row[index] ?? '').trim()]))
    )
    .filter(row => columns.some(column => row[column] !== ''));

  if (rows.length > MAX_MANUAL_CHART_ROWS) {
    throw new Error('CSV_HAS_TOO_MANY_ROWS');
  }

  return { columns, rows };
}
