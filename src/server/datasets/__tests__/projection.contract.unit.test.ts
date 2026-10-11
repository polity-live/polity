import { describe, expect, it } from 'vitest';

import { buildMultiMeasureProjectionPoints, assertProviderProjectionScope } from '../projection';

describe('buildMultiMeasureProjectionPoints contracts', () => {
  it('allows plotted categories but enforces one value for unplotted provider dimensions', () => {
    const table = {
      columns: ['geo', 'unit'],
      rows: [
        { geo: 'DE', unit: 'NR' },
        { geo: 'FR', unit: 'NR' },
      ],
    };
    const query = {
      dimensionColumn: 'geo',
      seriesColumn: null,
      measureColumn: null,
      filters: {},
      aggregation: 'count' as const,
    };
    const metadata = {
      providerDimensions: [
        { id: 'geo', label: 'Area' },
        { id: 'unit', label: 'Unit' },
        { id: 'missing', label: 'Missing' },
      ],
    };
    expect(() => assertProviderProjectionScope(table, query, metadata)).not.toThrow();
    expect(() =>
      assertProviderProjectionScope(
        { columns: ['unit'], rows: [{}, { unit: 'NR' }] },
        query,
        metadata
      )
    ).toThrow('Choose one value');
    expect(() =>
      assertProviderProjectionScope({ columns: ['unit'], rows: [{}, {}] }, query, metadata)
    ).not.toThrow();
  });
  it('skips missing dimensions, absent/empty values and non-numeric measures', () => {
    expect(
      buildMultiMeasureProjectionPoints({
        table: {
          columns: ['year', 'a', 'b'],
          rows: [
            {},
            { year: '', a: '1', b: '2' },
            { year: '2024', a: '', b: 'bad' },
            { year: '2025', a: '1' },
          ],
        },
        dimensionColumn: 'year',
        valueColumns: ['a', 'b'],
        aggregation: 'sum',
      })
    ).toEqual([{ x: '2025', value: 1, series: 'a' }]);
  });

  it('aggregates repeated groups and treats every populated count value as one', () => {
    const table = {
      columns: ['year', 'a'],
      rows: [
        { year: '2024', a: '10' },
        { year: '2024', a: 'not numeric' },
      ],
    };
    expect(
      buildMultiMeasureProjectionPoints({
        table,
        dimensionColumn: 'year',
        valueColumns: ['a'],
        aggregation: 'count',
      })
    ).toEqual([{ x: '2024', value: 2, series: 'a' }]);
    expect(
      buildMultiMeasureProjectionPoints({
        table: {
          ...table,
          rows: [
            { year: '2024', a: '1' },
            { year: '2024', a: '3' },
          ],
        },
        dimensionColumn: 'year',
        valueColumns: ['a'],
        aggregation: 'mean',
      })
    ).toEqual([{ x: '2024', value: 2, series: 'a' }]);
  });
});
