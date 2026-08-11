import { describe, expect, it } from 'vitest';
import {
  buildChartPoints,
  createEmptyChartTable,
  getChartMappingValueColumns,
  inferChartMapping,
  parseChartCsv,
} from '../chartData';
import {
  MAX_CHART_POINTS,
  MAX_MANUAL_CHART_COLUMNS,
  MAX_MANUAL_CHART_ROWS,
  MAX_MANUAL_CSV_BYTES,
} from '../../types';

describe('chart data', () => {
  it('parses quoted CSV values and infers a numeric column', () => {
    const table = parseChartCsv('Category,Value,Series\n"North, East",12,A\nSouth,8,B');

    expect(table).toEqual({
      columns: ['Category', 'Value', 'Series'],
      rows: [
        { Category: 'North, East', Value: '12', Series: 'A' },
        { Category: 'South', Value: '8', Series: 'B' },
      ],
    });
    expect(inferChartMapping(table)).toMatchObject({
      xColumn: 'Category',
      valueColumn: 'Value',
    });
  });

  it('omits fully empty rows and values', () => {
    const table = parseChartCsv('Category,Value\nA,1\n,\nB,2\n');
    expect(buildChartPoints(table.rows, inferChartMapping(table))).toEqual([
      { x: 'A', value: 1, series: null },
      { x: 'B', value: 2, series: null },
    ]);
  });

  it('rejects invalid numbers and duplicate x/series points', () => {
    expect(() =>
      buildChartPoints([{ x: 'A', value: 'not-a-number' }], { xColumn: 'x', valueColumn: 'value' })
    ).toThrow('CHART_INVALID_NUMBER');

    expect(() =>
      buildChartPoints(
        [
          { x: 'A', value: '1', series: 'one' },
          { x: 'A', value: '2', series: 'one' },
        ],
        { xColumn: 'x', valueColumn: 'value', seriesColumn: 'series' }
      )
    ).toThrow('CHART_DUPLICATE_POINT');
  });

  it('maps wide percentage tables with dates on the X-axis and rows as series', () => {
    const table = parseChartCsv(
      'Column 1,31.12.2019,31.03.2020\nStadt Kleve,"5,70%","4,90%"\nKreis Kleve,"4,80%","4,90%"'
    );
    const mapping = inferChartMapping(table);

    expect(mapping).toMatchObject({
      tableMode: 'rowsAsSeries',
      xColumn: 'Column 1',
      valueColumns: ['31.12.2019', '31.03.2020'],
    });
    expect(buildChartPoints(table.rows, mapping)).toEqual([
      { x: '31.12.2019', value: 5.7, series: 'Stadt Kleve' },
      { x: '31.03.2020', value: 4.9, series: 'Stadt Kleve' },
      { x: '31.12.2019', value: 4.8, series: 'Kreis Kleve' },
      { x: '31.03.2020', value: 4.9, series: 'Kreis Kleve' },
    ]);
  });

  it('can put row labels on the X-axis and value columns into series', () => {
    const table = parseChartCsv(
      'City,31.12.2019,31.03.2020\nStadt Kleve,"5,70%","4,90%"\nKreis Kleve,"4,80%","4,90%"'
    );

    expect(
      buildChartPoints(table.rows, {
        xColumn: 'City',
        valueColumn: '31.12.2019',
        valueColumns: ['31.12.2019', '31.03.2020'],
        tableMode: 'columnsAsSeries',
      })
    ).toEqual([
      { x: 'Stadt Kleve', value: 5.7, series: '31.12.2019' },
      { x: 'Stadt Kleve', value: 4.9, series: '31.03.2020' },
      { x: 'Kreis Kleve', value: 4.8, series: '31.12.2019' },
      { x: 'Kreis Kleve', value: 4.9, series: '31.03.2020' },
    ]);
  });

  it('enforces CSV and point limits', () => {
    expect(() => parseChartCsv(`x,value\n${'a'.repeat(MAX_MANUAL_CSV_BYTES)},1`)).toThrow(
      'CSV_FILE_TOO_LARGE'
    );

    const rows = Array.from({ length: MAX_CHART_POINTS + 1 }, (_, index) => ({
      x: String(index),
      value: String(index),
    }));
    expect(() => buildChartPoints(rows, { xColumn: 'x', valueColumn: 'value' })).toThrow(
      'CHART_HAS_TOO_MANY_POINTS'
    );
  });

  it('normalizes blank and duplicate headers and missing cells', () => {
    expect(parseChartCsv(' ,Value,Value\n A , 1 , 2\nB,3,')).toEqual({
      columns: ['Column 1', 'Value', 'Value_1'],
      rows: [
        { 'Column 1': 'A', Value: '1', Value_1: '2' },
        { 'Column 1': 'B', Value: '3', Value_1: '' },
      ],
    });
    expect(() => parseChartCsv('')).toThrow('CSV_HAS_NO_COLUMNS');
    expect(() =>
      parseChartCsv(
        Array.from({ length: MAX_MANUAL_CHART_COLUMNS + 1 }, (_, i) => `c${i}`).join(',')
      )
    ).toThrow('CSV_HAS_TOO_MANY_COLUMNS');
  });

  it('rejects malformed CSV and too many nonempty rows', () => {
    expect(() => parseChartCsv('a,b\n"unterminated')).toThrow();
    const csv = `x,value\n${Array.from(
      { length: MAX_MANUAL_CHART_ROWS + 1 },
      (_, index) => `${index},${index}`
    ).join('\n')}`;
    expect(() => parseChartCsv(csv)).toThrow('CSV_HAS_TOO_MANY_ROWS');
  });

  it('parses international and formatted numeric values', () => {
    const rows = [
      { x: 'percent', value: ' 12 % ' },
      { x: 'decimal-comma', value: '1,5' },
      { x: 'european', value: '1.234,5' },
      { x: 'english', value: '1,234.5' },
      { x: 'grouped-comma', value: '1,234,567' },
      { x: 'spaced', value: '1 234' },
    ];
    expect(
      buildChartPoints(rows, { xColumn: 'x', valueColumn: 'value' }).map(point => point.value)
    ).toEqual([12, 1.5, 1234.5, 1234.5, 1234567, 1234]);
  });

  it('validates every incomplete or empty point representation', () => {
    expect(() => buildChartPoints([], { xColumn: '', valueColumn: 'value' })).toThrow(
      'CHART_MAPPING_INCOMPLETE'
    );
    expect(() => buildChartPoints([], { xColumn: 'x', valueColumn: '' })).toThrow(
      'CHART_MAPPING_INCOMPLETE'
    );
    expect(() =>
      buildChartPoints([{ x: '', value: '1' }], { xColumn: 'x', valueColumn: 'value' })
    ).toThrow('CHART_INVALID_NUMBER');
    expect(() =>
      buildChartPoints([{ x: 'A', value: '' }], { xColumn: 'x', valueColumn: 'value' })
    ).toThrow('CHART_INVALID_NUMBER');
    expect(() =>
      buildChartPoints([{ x: 'A', value: 'invalid' }], { xColumn: 'x', valueColumn: 'value' })
    ).toThrow('CHART_INVALID_NUMBER');
    expect(() =>
      buildChartPoints([{ x: '', value: '', series: '' }], {
        xColumn: 'x',
        valueColumn: 'value',
        seriesColumn: 'series',
      })
    ).toThrow('CHART_HAS_NO_POINTS');
    expect(() => buildChartPoints([{}], { xColumn: 'x', valueColumn: 'value' })).toThrow(
      'CHART_HAS_NO_POINTS'
    );
    expect(
      buildChartPoints([{ x: 'A', value: '1' }], {
        xColumn: 'x',
        valueColumn: 'value',
        seriesColumn: 'series',
      })
    ).toEqual([{ x: 'A', value: 1, series: null }]);
  });

  it('selects explicit and inferred mapping columns', () => {
    const table = {
      columns: ['label', 'value', 'other'],
      rows: [{ label: 'A', value: '1', other: 'text' }],
    };
    expect(
      getChartMappingValueColumns(table, {
        xColumn: 'label',
        valueColumn: 'value',
        valueColumns: ['missing', 'value'],
      })
    ).toEqual(['value']);
    expect(
      getChartMappingValueColumns(table, {
        xColumn: 'label',
        valueColumn: 'value',
        valueColumns: ['missing'],
      })
    ).toEqual(['value']);
    expect(getChartMappingValueColumns(table, { xColumn: 'label', valueColumn: 'value' })).toEqual([
      'value',
    ]);
    expect(
      getChartMappingValueColumns(
        { columns: ['label', 'missing'], rows: [{ label: 'A' }] },
        { xColumn: 'label', valueColumn: 'missing' }
      )
    ).toEqual([]);
  });

  it('infers wide tables from three numeric columns and handles minimal tables', () => {
    expect(
      inferChartMapping({
        columns: ['label', 'a', 'b', 'c'],
        rows: [{ label: 'row', a: '1', b: '2', c: '3' }],
      })
    ).toMatchObject({ tableMode: 'rowsAsSeries', valueColumns: ['a', 'b', 'c'] });
    expect(inferChartMapping({ columns: [], rows: [] })).toMatchObject({
      xColumn: '',
      valueColumn: '',
      tableMode: 'columnMapping',
    });
    expect(inferChartMapping({ columns: ['label', 'fallback'], rows: [] })).toMatchObject({
      valueColumn: 'fallback',
    });
  });

  it('builds wide points while skipping blank rows and values', () => {
    expect(() =>
      buildChartPoints([], {
        xColumn: '',
        valueColumn: 'v',
        valueColumns: ['v'],
        tableMode: 'rowsAsSeries',
      })
    ).toThrow('CHART_MAPPING_INCOMPLETE');
    expect(() =>
      buildChartPoints([], {
        xColumn: 'x',
        valueColumn: 'v',
        valueColumns: [],
        tableMode: 'rowsAsSeries',
      })
    ).toThrow('CHART_MAPPING_INCOMPLETE');
    expect(
      buildChartPoints(
        [
          { label: '', '*2025': '1', '2026': '2' },
          { label: 'Series', '2026': '2' },
          { '*2025': '3', '2026': '4' },
        ],
        {
          xColumn: 'label',
          valueColumn: '*2025',
          valueColumns: ['*2025', '2026'],
          tableMode: 'rowsAsSeries',
        }
      )
    ).toEqual([{ x: '2026', value: 2, series: 'Series' }]);
  });

  it('returns a valid starter chart table', () => {
    const table = createEmptyChartTable();
    expect(buildChartPoints(table.rows, inferChartMapping(table))).toHaveLength(3);
  });
});
