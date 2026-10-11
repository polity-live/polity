import { describe, expect, it } from 'vitest';
import { datasetYear, importScopeResourceId, resolveImportFilters } from '../importScope';
import { assertProviderProjectionScope } from '../projection';
import type { DatasetPreparation } from '@/features/charts/types';

const preparation: DatasetPreparation = {
  provider: 'EUROSTAT',
  code: 'dataset',
  title: 'Dataset',
  estimatedBytes: 100,
  importAllowed: true,
  suggestedFilters: {},
  geoDimension: 'geo',
  timeDimension: 'TIME_PERIOD',
  dimensions: [
    {
      id: 'geo',
      label: 'Area',
      position: 1,
      values: [
        { id: 'DE', label: 'Deutschland' },
        { id: 'FR', label: 'France' },
      ],
    },
    {
      id: 'TIME_PERIOD',
      label: 'Time',
      position: 2,
      values: ['2023-01', '2023-Q2', '2025'].map(id => ({ id })),
    },
    { id: 'unit', label: 'Unit', position: 3, values: [{ id: 'NR' }, { id: 'PC' }] },
  ],
};
describe('provider import scopes', () => {
  it('resolves German state searches against English provider labels', () => {
    const state = {
      ...preparation,
      dimensions: [{ ...preparation.dimensions[0], values: [{ id: 'DE2', label: 'Bavaria' }] }],
    };
    expect(resolveImportFilters(state, { area: 'Bayern' })).toEqual({ geo: ['DE2'] });
  });
  it.each(['DE', 'Germany', 'Deutschland'])(
    'resolves %s using available country metadata',
    area => {
      expect(
        resolveImportFilters(preparation, { area, period: { start: 2023, end: 2023 } })
      ).toEqual({ geo: ['DE'], TIME_PERIOD: ['2023-01', '2023-Q2'] });
    }
  );
  it('rejects unavailable areas, year gaps and contradictory dimensions without broadening', () => {
    expect(() => resolveImportFilters(preparation, { area: 'Berlin' })).toThrow('unavailable');
    expect(() => resolveImportFilters(preparation, { period: { start: 2023, end: 2025 } })).toThrow(
      'fully available'
    );
    expect(() =>
      resolveImportFilters(preparation, { area: 'Germany', dimensions: { geo: 'FR' } })
    ).toThrow('Conflicting');
  });
  it('keeps correlated country and period regions distinct and honors exclusions', () => {
    const correlated = {
      ...preparation,
      coverageRegions: [
        { included: true, values: { geo: ['DE'], TIME_PERIOD: ['2023-01'] } },
        { included: true, values: { geo: ['FR'], TIME_PERIOD: ['2025'] } },
      ],
    };
    expect(() =>
      resolveImportFilters(correlated, { area: 'Germany', period: { start: 2025, end: 2025 } })
    ).toThrow('combination');
    expect(
      resolveImportFilters(correlated, { area: 'France', period: { start: 2025, end: 2025 } })
    ).toEqual({ geo: ['FR'], TIME_PERIOD: ['2025'] });
    expect(() =>
      resolveImportFilters(
        {
          ...correlated,
          coverageRegions: [
            ...correlated.coverageRegions,
            { included: false, values: { geo: ['FR'], TIME_PERIOD: ['2025'] } },
          ],
        },
        { area: 'France', period: { start: 2025, end: 2025 } }
      )
    ).toThrow('combination');
  });
  it('allows a requested range to span multiple compatible included regions', () => {
    const regions = {
      ...preparation,
      dimensions: [
        preparation.dimensions[0],
        { id: 'TIME_PERIOD', label: 'Time', position: 2, values: [{ id: '2024' }, { id: '2025' }] },
      ],
      coverageRegions: [
        { included: true, values: { geo: ['DE'], TIME_PERIOD: ['2024'] } },
        { included: true, values: { geo: ['DE'], TIME_PERIOD: ['2025'] } },
      ],
    };
    expect(
      resolveImportFilters(regions, { area: 'Germany', period: { start: 2024, end: 2025 } })
        .TIME_PERIOD
    ).toEqual(['2024', '2025']);
  });
  it('creates stable distinct identities for full and restricted imports', () => {
    expect(importScopeResourceId({})).toBeUndefined();
    expect(importScopeResourceId({ geo: ['DE'], time: ['2025', '2024'] })).toBe(
      importScopeResourceId({ time: ['2024', '2025'], geo: ['DE'] })
    );
    expect(importScopeResourceId({ geo: ['DE'] })).not.toBe(importScopeResourceId({ geo: ['FR'] }));
  });
  it.each([
    ['2025', 2025],
    ['2025-12', 2025],
    ['2025-Q4', 2025],
    ['31.12.2025', 2025],
    ['2025-12-31', 2025],
    ['025', null],
  ])('extracts the observation year from %s', (value, expected) =>
    expect(datasetYear(value as string)).toBe(expected)
  );
});

it('prevents adding different units even if unit is a chart dimension, while preserving legacy queries', () => {
  const table = {
    columns: ['unit', 'value'],
    rows: [
      { unit: 'NR', value: '100' },
      { unit: 'PC', value: '5' },
    ],
  };
  const query = {
    dimensionColumn: 'unit',
    measureColumn: 'value',
    filters: {},
    aggregation: 'sum' as const,
  };
  expect(() =>
    assertProviderProjectionScope(table, query, { providerDimensions: preparation.dimensions })
  ).toThrow('Choose one value');
  expect(() => assertProviderProjectionScope(table, query, {})).not.toThrow();
  expect(() =>
    assertProviderProjectionScope({ ...table, rows: [table.rows[0]] }, query, {
      providerDimensions: preparation.dimensions,
    })
  ).not.toThrow();
});
