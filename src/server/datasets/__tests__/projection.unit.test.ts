import { describe, expect, it } from 'vitest';
import { buildMultiMeasureProjectionPoints } from '../projection';

describe('buildMultiMeasureProjectionPoints', () => {
  it('creates one chart series per selected value column', () => {
    const points = buildMultiMeasureProjectionPoints({
      table: {
        columns: ['Jahr', 'Arbeitslose (absolut)', 'Arbeitslosenquote'],
        rows: [
          {
            Jahr: '2024',
            'Arbeitslose (absolut)': '1200',
            Arbeitslosenquote: '5,4',
          },
          {
            Jahr: '2025',
            'Arbeitslose (absolut)': '1300',
            Arbeitslosenquote: '5,8',
          },
        ],
      },
      dimensionColumn: 'Jahr',
      valueColumns: ['Arbeitslose (absolut)', 'Arbeitslosenquote'],
      aggregation: 'sum',
    });

    expect(points).toEqual([
      { x: '2024', value: 1200, series: 'Arbeitslose (absolut)' },
      { x: '2024', value: 5.4, series: 'Arbeitslosenquote' },
      { x: '2025', value: 1300, series: 'Arbeitslose (absolut)' },
      { x: '2025', value: 5.8, series: 'Arbeitslosenquote' },
    ]);
  });
});
