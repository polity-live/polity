import { describe, expect, it } from 'vitest';
import { buildChartPoints, inferChartMapping, parseChartCsv } from '../chartData';
import { MAX_CHART_POINTS, MAX_MANUAL_CSV_BYTES } from '../../types';

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
});
