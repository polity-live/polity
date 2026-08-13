import { describe, expect, it } from 'vitest';

import { buildMultiMeasureProjectionPoints } from '../projection';

describe('buildMultiMeasureProjectionPoints contracts', () => {
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
