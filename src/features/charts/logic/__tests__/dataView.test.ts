import { describe, expect, it } from 'vitest';
import type { DatasetColumnProfile } from '../../types';
import {
  getDataViewTitle,
  getFilterableProfiles,
  getValueColumnLayout,
  inferDataViewConfiguration,
  serializeDatasetTable,
} from '../dataView';

function profile(
  name: string,
  role: DatasetColumnProfile['role'],
  overrides: Partial<DatasetColumnProfile> = {}
): DatasetColumnProfile {
  return {
    name,
    label: name,
    type: role === 'measure' ? 'number' : 'category',
    role,
    nullCount: 0,
    distinctCount: 1,
    ...overrides,
  };
}

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

  it('classifies empty, selected, year, and mixed value-column layouts', () => {
    const profiles = [
      profile('Category', 'dimension'),
      profile('2023', 'measure'),
      profile('2024', 'measure'),
      profile('Other', 'measure'),
    ];

    expect(getValueColumnLayout([], undefined)).toBe('long');
    expect(getValueColumnLayout(profiles, ['missing'])).toBe('long');
    expect(getValueColumnLayout(profiles, ['2023'])).toBe('wide');
    expect(getValueColumnLayout(profiles, ['2023', '2024'])).toBe('wide');
    expect(getValueColumnLayout(profiles, ['Other'])).toBe('multi');
    expect(getValueColumnLayout([profile('Value', 'measure')])).toBe('long');
  });

  it('falls back through numeric measures and all dimension role priorities', () => {
    const numericFallback = inferDataViewConfiguration([
      profile('Value', 'label', { type: 'number' }),
      profile('Region', 'dimension'),
    ]);
    expect(numericFallback.query).toMatchObject({
      measureColumn: 'Value',
      dimensionColumn: 'Region',
    });
    expect(numericFallback.chartType).toBe('bar');

    expect(
      inferDataViewConfiguration([profile('Value', 'measure'), profile('Country', 'geo')]).query
        .dimensionColumn
    ).toBe('Country');
    expect(
      inferDataViewConfiguration([profile('Value', 'measure'), profile('Topic', 'dimension')]).query
        .dimensionColumn
    ).toBe('Topic');
    expect(
      inferDataViewConfiguration([profile('Value', 'measure'), profile('Label', 'label')]).query
        .dimensionColumn
    ).toBe('Label');

    const empty = inferDataViewConfiguration([]);
    expect(empty.query).toMatchObject({ measureColumn: null, dimensionColumn: null });
    expect(empty.presentation.title).toBe('');
  });

  it('sorts and limits filterable profiles while excluding measures and empty domains', () => {
    const profiles = [
      profile('Measure', 'measure', { distinctCount: 1 }),
      profile('Empty', 'dimension', { distinctCount: 0 }),
      ...Array.from({ length: 10 }, (_, index) =>
        profile(`Dimension ${index}`, 'dimension', { distinctCount: 10 - index })
      ),
    ];

    expect(getFilterableProfiles(profiles).map(item => item.distinctCount)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('builds titles for chart, table, and stat fallbacks', () => {
    expect(
      getDataViewTitle({ datasetTitle: 'Dataset', view: 'table', measureLabel: 'Value' })
    ).toBe('Dataset');
    expect(getDataViewTitle({ datasetTitle: 'Dataset', view: 'stat', measureLabel: 'Value' })).toBe(
      'Value'
    );
    expect(getDataViewTitle({ datasetTitle: 'Dataset', view: 'stat', measureLabel: '' })).toBe(
      'Dataset'
    );
    expect(
      getDataViewTitle({
        datasetTitle: 'Dataset',
        view: 'chart',
        measureLabel: 'Value',
        dimensionLabel: 'Year',
      })
    ).not.toBe('Dataset');
    expect(
      getDataViewTitle({ datasetTitle: 'Dataset', view: 'chart', measureLabel: 'Value' })
    ).toBe('Dataset');
  });

  it('serializes missing values and CSV-sensitive headers and cells', () => {
    expect(
      serializeDatasetTable(
        ['Plain', 'Header,quoted', 'Quote"header'],
        [{ Plain: 'line\nbreak', 'Header,quoted': 'a,b', 'Quote"header': 'say "yes"' }, {}]
      )
    ).toBe(
      'Plain,"Header,quoted","Quote""header"\n"line\nbreak","a,b","say ""yes"""\n,, '.trimEnd()
    );
  });
});
