import { describe, expect, it } from 'vitest';

import {
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
  MAX_MANUAL_CSV_BYTES,
} from '@/features/charts/types';
import { parseGovDataCsvTable } from '../csv';

describe('parseGovDataCsvTable contracts', () => {
  it.each([
    ['a,b\n1,2', ['a', 'b']],
    ['a;b\n1;2', ['a', 'b']],
    ['a\tb\n1\t2', ['a', 'b']],
  ])('detects delimiters for %j', (input, columns) => {
    expect(parseGovDataCsvTable(input).columns).toEqual(columns);
  });

  it('normalizes duplicate and blank headers, missing cells and empty rows', () => {
    expect(parseGovDataCsvTable(' ,Name,Name\n1,Alice,A\n,,\n2,Bob')).toEqual({
      columns: ['Column 1', 'Name', 'Name_1'],
      rows: [
        { 'Column 1': '1', Name: 'Alice', Name_1: 'A' },
        { 'Column 1': '2', Name: 'Bob', Name_1: '' },
      ],
    });
  });

  it('rejects invalid, empty, oversized, over-wide and over-long CSV', () => {
    expect(() => parseGovDataCsvTable('"unterminated')).toThrow('CSV_PARSE_FAILED');
    expect(() => parseGovDataCsvTable('')).toThrow('CSV_HAS_NO_COLUMNS');
    expect(() => parseGovDataCsvTable('x'.repeat(MAX_MANUAL_CSV_BYTES + 1))).toThrow(
      'CSV_FILE_TOO_LARGE'
    );
    expect(() =>
      parseGovDataCsvTable(
        Array.from({ length: MAX_MANUAL_CHART_COLUMNS + 1 }, (_, index) => `c${index}`).join(',')
      )
    ).toThrow('CSV_HAS_TOO_MANY_COLUMNS');
    expect(() =>
      parseGovDataCsvTable(
        [
          'value',
          ...Array.from({ length: MAX_MANUAL_CHART_ROWS + 1 }, (_, index) => String(index)),
        ].join('\n')
      )
    ).toThrow('CSV_HAS_TOO_MANY_ROWS');
  });
});
