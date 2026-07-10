import { describe, expect, it } from 'vitest';
import { datasetProjectionRequestSchema } from '../projectionRequest';

describe('datasetProjectionRequestSchema', () => {
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
