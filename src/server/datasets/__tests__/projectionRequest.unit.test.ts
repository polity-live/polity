import { describe, expect, it } from 'vitest';
import { datasetProjectionRequestSchema } from '../projectionRequest';

describe('datasetProjectionRequestSchema', () => {
  it('validates ordered year ranges before passing them to projection', () => {
    expect(
      datasetProjectionRequestSchema.safeParse({
        view: 'chart',
        aggregation: 'sum',
        filters: {},
        timeRange: { column: 'year', startYear: 2025, endYear: 2024 },
      }).success
    ).toBe(false);
    expect(
      datasetProjectionRequestSchema.parse({
        view: 'chart',
        aggregation: 'sum',
        filters: {},
        timeRange: { column: 'year', startYear: 2024, endYear: 2025 },
      }).timeRange
    ).toEqual({ column: 'year', startYear: 2024, endYear: 2025 });
  });
  it('preserves multi-measure chart configuration', () => {
    const request = datasetProjectionRequestSchema.parse({
      view: 'chart',
      dimensionColumn: 'Jahr',
      measureColumn: 'Arbeitslose (absolut)',
      filters: {},
      aggregation: 'sum',
      layout: 'multi',
      valueColumns: ['Arbeitslose (absolut)', 'Arbeitslosenquote'],
    });

    expect(request).toMatchObject({
      layout: 'multi',
      valueColumns: ['Arbeitslose (absolut)', 'Arbeitslosenquote'],
    });
  });
});
