import { describe, expect, it } from 'vitest';

import {
  MAX_CHART_POINTS,
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
} from '@/features/charts/types';
import {
  aggregateDatasetValues,
  buildDatasetProjectionPoints,
  getDescriptiveStats,
  parseDatasetCsv,
  parseDatasetNumber,
  profileDatasetColumns,
  summarizeDatasetStructure,
  tableToCsv,
  type DatasetTable,
} from '../csv';

describe('dataset CSV parsing and serialization', () => {
  it('serializes empty cells, commas, quotes and newlines safely', () => {
    expect(
      tableToCsv({
        columns: ['plain', 'with,comma', 'quote"column'],
        rows: [{ plain: 'line\nbreak', 'with,comma': 'a,b', 'quote"column': undefined as any }],
      })
    ).toBe('plain,"with,comma","quote""column"\n"line\nbreak","a,b",');
  });

  it.each([
    ['a,b\n1,2', ['a', 'b'], { a: '1', b: '2' }],
    ['a;b\n1;2', ['a', 'b'], { a: '1', b: '2' }],
    ['a\tb\n1\t2', ['a', 'b'], { a: '1', b: '2' }],
  ])('detects the delimiter in %j', (csv, columns, row) => {
    expect(parseDatasetCsv(csv)).toEqual({ columns, rows: [row] });
  });

  it('normalizes blank and duplicate headers, trims cells and removes empty rows', () => {
    expect(parseDatasetCsv(' ,Name,Name\n 1 , Alice , A \n,,\n2,Bob')).toEqual({
      columns: ['Column 1', 'Name', 'Name_1'],
      rows: [
        { 'Column 1': '1', Name: 'Alice', Name_1: 'A' },
        { 'Column 1': '2', Name: 'Bob', Name_1: '' },
      ],
    });
  });

  it('rejects unparseable, column-less, over-wide and over-long input', () => {
    expect(() => parseDatasetCsv('"unterminated')).toThrow('CSV_PARSE_FAILED');
    expect(() => parseDatasetCsv('')).toThrow('CSV_HAS_NO_COLUMNS');

    const columns = Array.from({ length: MAX_MANUAL_CHART_COLUMNS + 1 }, (_, index) => `c${index}`);
    expect(() => parseDatasetCsv(columns.join(','))).toThrow('CSV_HAS_TOO_MANY_COLUMNS');

    const rows = Array.from({ length: MAX_MANUAL_CHART_ROWS + 1 }, (_, index) => String(index));
    expect(() => parseDatasetCsv(['value', ...rows].join('\n'))).toThrow('CSV_HAS_TOO_MANY_ROWS');
  });
});

describe('dataset number parsing', () => {
  it.each([
    ['', Number.NaN],
    [' 12 % ', 12],
    ['1 234,50', 1234.5],
    ['1.234,50', 1234.5],
    ['1,234.50', 1234.5],
    ['1,25', 1.25],
    ['1,234,567', 1234567],
    ['1234.5', 1234.5],
    ['not-a-number', Number.NaN],
  ])('parses %j', (raw, expected) => {
    const value = parseDatasetNumber(raw);
    if (Number.isNaN(expected)) expect(value).toBeNaN();
    else expect(value).toBe(expected);
  });
});

describe('dataset column profiles', () => {
  it('covers empty, numeric, date, geo, category and high-cardinality text columns', () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      Empty: '',
      Amount: index === 49 ? 'unknown' : String(index),
      Datum:
        index === 0 ? '' : index % 3 === 0 ? '2024' : index % 3 === 1 ? '2024-12' : '31.12.2024',
      Stadt: index % 2 ? 'Berlin' : 'Hamburg',
      Category: index % 3 ? 'A' : 'B',
      Description: `unique value ${index}`,
    }));
    const profiles = profileDatasetColumns({
      columns: ['Empty', 'Amount', 'Datum', 'Stadt', 'Category', 'Description'],
      rows,
    });
    expect(profiles.map(({ name, type, role }) => ({ name, type, role }))).toEqual([
      { name: 'Empty', type: 'category', role: 'dimension' },
      { name: 'Amount', type: 'number', role: 'measure' },
      { name: 'Datum', type: 'date', role: 'time' },
      { name: 'Stadt', type: 'category', role: 'geo' },
      { name: 'Category', type: 'category', role: 'dimension' },
      { name: 'Description', type: 'text', role: 'label' },
    ]);
    expect(profiles.find(profile => profile.name === 'Amount')).toMatchObject({
      nullCount: 0,
      min: 0,
      max: 48,
    });
    expect(profiles.find(profile => profile.name === 'Datum')).toMatchObject({
      min: '2024',
      max: '31.12.2024',
    });
    expect(profiles.find(profile => profile.name === 'Empty')).toMatchObject({
      min: undefined,
      max: undefined,
    });
  });

  it('handles absent cells and empty date-hinted columns', () => {
    const profiles = profileDatasetColumns({
      columns: ['Date', 'Value'],
      rows: [{}, { Date: '', Value: '1' }],
    });
    expect(profiles[0]).toMatchObject({ type: 'date', min: null, max: null, nullCount: 2 });
    expect(profiles[1]).toMatchObject({ type: 'number', min: 1, max: 1, nullCount: 1 });
  });

  it('recognizes additional valid date layouts and rejects invalid or blank dates', () => {
    const profiles = profileDatasetColumns({
      columns: ['Period'],
      rows: [{ Period: '2024/01/31' }, { Period: '1-2-24' }, { Period: 'invalid' }, { Period: '' }],
    });
    expect(profiles[0]).toMatchObject({ type: 'date', role: 'time', nullCount: 1 });
  });
});

describe('dataset aggregations and statistics', () => {
  it('covers every aggregation and empty input', () => {
    expect(aggregateDatasetValues([], 'count')).toBe(0);
    expect(aggregateDatasetValues([], 'sum')).toBeNull();
    expect(aggregateDatasetValues([3, 1, 2], 'sum')).toBe(6);
    expect(aggregateDatasetValues([3, 1, 2], 'mean')).toBe(2);
    expect(aggregateDatasetValues([3, 1, 2], 'min')).toBe(1);
    expect(aggregateDatasetValues([3, 1, 2], 'max')).toBe(3);
    expect(aggregateDatasetValues([3, 1, 2], 'median')).toBe(2);
    expect(aggregateDatasetValues([4, 1, 3, 2], 'median')).toBe(2.5);
  });

  it('returns odd, even and empty descriptive statistics', () => {
    const table = {
      columns: ['value'],
      rows: [{ value: '3' }, { value: 'bad' }, { value: '1' }, { value: '2' }],
    };
    expect(getDescriptiveStats(table, 'value')).toEqual({
      column: 'value',
      count: 3,
      min: 1,
      max: 3,
      mean: 2,
      median: 2,
      sum: 6,
    });
    expect(
      getDescriptiveStats({ columns: ['value'], rows: [{ value: '1' }, { value: '3' }] }, 'value')
    ).toMatchObject({ median: 2 });
    expect(getDescriptiveStats({ columns: ['value'], rows: [{ value: '' }] }, 'value')).toBeNull();
    expect(getDescriptiveStats({ columns: ['value'], rows: [{}] }, 'value')).toBeNull();
  });
});

describe('dataset projection points', () => {
  const table: DatasetTable = {
    columns: ['year', 'value', 'series', 'other'],
    rows: [
      { year: '2024', value: '1', series: 'A', other: '10' },
      { year: '2025', value: '2', series: 'B', other: '20' },
      { year: '', value: '', series: '', other: '' },
    ],
  };

  it('builds column-mapped points with and without a series and skips empty rows', () => {
    expect(
      buildDatasetProjectionPoints(table, {
        xColumn: 'year',
        valueColumn: 'value',
        seriesColumn: 'series',
      })
    ).toEqual([
      { x: '2024', value: 1, series: 'A' },
      { x: '2025', value: 2, series: 'B' },
    ]);
    expect(
      buildDatasetProjectionPoints(table, { xColumn: 'year', valueColumn: 'value' })[0]
    ).toEqual({
      x: '2024',
      value: 1,
      series: null,
    });
    expect(
      buildDatasetProjectionPoints(
        { columns: ['year', 'value', 'series'], rows: [{ year: '2024', value: '1' }, {}] },
        { xColumn: 'year', valueColumn: 'value', seriesColumn: 'series' }
      )
    ).toEqual([{ x: '2024', value: 1, series: null }]);
  });

  it('builds columns-as-series with explicit valid columns', () => {
    expect(
      buildDatasetProjectionPoints(table, {
        xColumn: 'year',
        valueColumn: '',
        tableMode: 'columnsAsSeries',
        valueColumns: ['value', 'missing', 'other'],
      })
    ).toEqual([
      { x: '2024', value: 1, series: 'value' },
      { x: '2024', value: 10, series: 'other' },
      { x: '2025', value: 2, series: 'value' },
      { x: '2025', value: 20, series: 'other' },
    ]);
  });

  it('discovers value columns and builds rows-as-series while skipping blanks', () => {
    const rowSeriesTable: DatasetTable = {
      columns: ['label', '*2024', '2025', 'note'],
      rows: [
        { label: 'Population', '*2024': '1', '2025': '2', note: 'text' },
        { label: 'Empty values', '*2024': '', note: '' },
        { label: '', '*2024': '3', '2025': '', note: '' },
        {},
      ],
    };
    expect(
      buildDatasetProjectionPoints(rowSeriesTable, {
        xColumn: 'label',
        valueColumn: '',
        tableMode: 'rowsAsSeries',
        valueColumns: [],
      })
    ).toEqual([
      { x: '2024', value: 1, series: 'Population' },
      { x: '2025', value: 2, series: 'Population' },
    ]);
  });

  it('rejects incomplete mappings, invalid values, duplicate points and empty output', () => {
    expect(() =>
      buildDatasetProjectionPoints(table, { xColumn: '', valueColumn: 'value' })
    ).toThrow('CHART_MAPPING_INCOMPLETE');
    expect(() => buildDatasetProjectionPoints(table, { xColumn: 'year', valueColumn: '' })).toThrow(
      'CHART_MAPPING_INCOMPLETE'
    );
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['label'], rows: [{ label: 'x' }] },
        {
          xColumn: 'label',
          valueColumn: '',
          tableMode: 'columnsAsSeries',
        }
      )
    ).toThrow('CHART_MAPPING_INCOMPLETE');
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['value'], rows: [{ value: '1' }] },
        {
          xColumn: '',
          valueColumn: '',
          tableMode: 'rowsAsSeries',
        }
      )
    ).toThrow('CHART_MAPPING_INCOMPLETE');
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['x', 'v'], rows: [{ x: '', v: '1' }] },
        { xColumn: 'x', valueColumn: 'v' }
      )
    ).toThrow('CHART_INVALID_NUMBER');
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['x', 'v'], rows: [{ x: 'a', v: '' }] },
        { xColumn: 'x', valueColumn: 'v' }
      )
    ).toThrow('CHART_INVALID_NUMBER');
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['x', 'v'], rows: [{ x: 'a', v: 'bad' }] },
        { xColumn: 'x', valueColumn: 'v' }
      )
    ).toThrow('CHART_INVALID_NUMBER');
    expect(() =>
      buildDatasetProjectionPoints(
        {
          columns: ['x', 'v'],
          rows: [
            { x: 'a', v: '1' },
            { x: 'a', v: '2' },
          ],
        },
        { xColumn: 'x', valueColumn: 'v' }
      )
    ).toThrow('CHART_DUPLICATE_POINT');
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['x', 'v'], rows: [{ x: '', v: '' }] },
        { xColumn: 'x', valueColumn: 'v' }
      )
    ).toThrow('CHART_HAS_NO_POINTS');
  });

  it('enforces the maximum projection point count', () => {
    const rows = Array.from({ length: MAX_CHART_POINTS + 1 }, (_, index) => ({
      x: String(index),
      value: String(index),
    }));
    expect(() =>
      buildDatasetProjectionPoints(
        { columns: ['x', 'value'], rows },
        { xColumn: 'x', valueColumn: 'value' }
      )
    ).toThrow('CHART_HAS_TOO_MANY_POINTS');
  });
});

describe('dataset structure summary', () => {
  it('includes numeric columns only when present', () => {
    expect(summarizeDatasetStructure({ columns: ['name'], rows: [{ name: 'Alice' }] })).toBe(
      '1 rows · 1 columns'
    );
    expect(
      summarizeDatasetStructure({
        columns: ['name', 'value'],
        rows: [{ name: 'Alice', value: '1' }],
      })
    ).toBe('1 rows · 2 columns · 1 numeric columns');
    expect(summarizeDatasetStructure({ columns: ['value'], rows: [{}] })).toBe(
      '1 rows · 1 columns'
    );
  });
});
