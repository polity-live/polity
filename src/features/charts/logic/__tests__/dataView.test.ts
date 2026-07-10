import { describe, expect, it } from 'vitest';
import { inferDataViewConfiguration } from '../dataView';

describe('inferDataViewConfiguration', () => {
  it('uses a time axis and line chart for long time series', () => {
    const result = inferDataViewConfiguration([
      {
        name: 'Jahr',
        label: 'Jahr',
        type: 'date',
        role: 'time',
        nullCount: 0,
        distinctCount: 3,
      },
      {
        name: 'Wert',
        label: 'Wert',
        type: 'number',
        role: 'measure',
        nullCount: 0,
        distinctCount: 3,
      },
    ]);

    expect(result.chartType).toBe('line');
    expect(result.query).toMatchObject({
      layout: 'long',
      dimensionColumn: 'Jahr',
      measureColumn: 'Wert',
    });
  });

  it('recognizes wide tables with years in separate columns', () => {
    const result = inferDataViewConfiguration([
      {
        name: 'Bundesland',
        label: 'Bundesland',
        type: 'category',
        role: 'geo',
        nullCount: 0,
        distinctCount: 2,
      },
      ...['2022', '2023', '2024'].map(name => ({
        name,
        label: name,
        type: 'number' as const,
        role: 'measure' as const,
        nullCount: 0,
        distinctCount: 2,
      })),
    ]);

    expect(result.chartType).toBe('line');
    expect(result.query).toMatchObject({
      layout: 'wide',
      dimensionColumn: 'Bundesland',
      valueColumns: ['2022', '2023', '2024'],
    });
  });

  it('uses multiple measure columns as chart series over a shared dimension', () => {
    const result = inferDataViewConfiguration([
      {
        name: 'Jahr',
        label: 'Jahr',
        type: 'date',
        role: 'time',
        nullCount: 0,
        distinctCount: 3,
      },
      ...['Arbeitslose (absolut)', 'Arbeitslosenquote'].map(name => ({
        name,
        label: name,
        type: 'number' as const,
        role: 'measure' as const,
        nullCount: 0,
        distinctCount: 3,
      })),
    ]);

    expect(result.chartType).toBe('line');
    expect(result.query).toMatchObject({
      layout: 'multi',
      dimensionColumn: 'Jahr',
      valueColumns: ['Arbeitslose (absolut)', 'Arbeitslosenquote'],
    });
  });
});
