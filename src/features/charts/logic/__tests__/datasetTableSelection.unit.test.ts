import { expect, it } from 'vitest';
import { applyDatasetTableSelection } from '../datasetTableSelection';
import { dataViewConfigurationSchema } from '../dataViewConfiguration';
import type { DatasetColumnProfile } from '../../types';
const profiles: DatasetColumnProfile[] = [
  { name: 'period', label: 'Period', type: 'date', role: 'time', nullCount: 0, distinctCount: 12 },
  {
    name: 'value',
    label: 'Value',
    type: 'number',
    role: 'measure',
    nullCount: 0,
    distinctCount: 12,
  },
  { name: 'area', label: 'Area', type: 'category', role: 'geo', nullCount: 0, distinctCount: 2 },
];

it('clears missing axes, falls back to a visible category and retains multi-value layouts', () => {
  const selection = { filters: {}, rowFilters: {}, rowConditions: [], columns: [] as string[] };
  expect(
    applyDatasetTableSelection(
      { aggregation: 'sum', filters: {}, layout: 'wide' },
      selection,
      profiles
    )
  ).toMatchObject({
    measureColumn: null,
    dimensionColumn: null,
    seriesColumn: null,
    valueColumns: [],
    layout: 'long',
  });
  expect(
    applyDatasetTableSelection(
      { aggregation: 'sum', filters: {} },
      { ...selection, columns: ['area'] },
      profiles
    )
  ).toMatchObject({ dimensionColumn: 'area', measureColumn: null });
  const secondValue = { ...profiles[1], name: 'other' };
  expect(
    applyDatasetTableSelection(
      { aggregation: 'sum', filters: {}, measureColumn: 'value', dimensionColumn: 'area' },
      { ...selection, columns: ['value', 'area'] },
      profiles
    )
  ).toMatchObject({ measureColumn: 'value', dimensionColumn: 'area' });
  expect(
    applyDatasetTableSelection(
      { aggregation: 'sum', filters: {}, layout: 'multi', seriesColumn: 'area' },
      { ...selection, columns: ['value', 'other', 'area'] },
      [...profiles, secondValue]
    )
  ).toMatchObject({ layout: 'multi', valueColumns: ['value', 'other'], seriesColumn: 'area' });
});
it('retains filters on hidden columns and removes axes and series excluded from the selected columns', () => {
  const query = applyDatasetTableSelection(
    { aggregation: 'none', filters: {}, dimensionColumn: 'area', seriesColumn: 'area' },
    {
      filters: {},
      rowFilters: {},
      rowConditions: [
        { column: 'area', operator: 'in', values: ['Deutschland'] },
        { column: 'period', operator: 'range', min: '2025-03', max: '2025-06' },
      ],
      columns: ['period', 'value'],
    },
    profiles
  );
  expect(query).toMatchObject({
    filters: { area: 'Deutschland' },
    rowConditions: [{ column: 'period', operator: 'range' }],
    dimensionColumn: 'period',
    measureColumn: 'value',
    seriesColumn: null,
    aggregation: 'none',
  });
  const stored = dataViewConfigurationSchema.parse({
    type: 'data_view',
    view: 'chart',
    source: {
      kind: 'dataset',
      provider: 'UPLOAD',
      datasetId: 'dataset',
      snapshotId: 'snapshot',
      title: 'Example',
    },
    query,
    presentation: {},
    children: [{ text: '' }],
  });
  expect(stored.query.rowConditions).toEqual(query.rowConditions);
});
it('persists multiple and empty values as predicates instead of treating them as no filter', () => {
  const next = applyDatasetTableSelection(
    { aggregation: 'sum', filters: { area: 'old' } },
    {
      filters: {},
      rowFilters: { area: 'old' },
      rowConditions: [{ column: 'area', operator: 'in', values: ['', 'Deutschland'] }],
      columns: ['period', 'value'],
    },
    profiles
  );
  expect(next.filters).toEqual({});
  expect(next.rowConditions?.[0]).toMatchObject({ values: ['', 'Deutschland'] });
  expect(next.aggregation).toBe('sum');
});

it('adopts table header metric filters as the precise official measure and unit', () => {
  const result = applyDatasetTableSelection(
    { aggregation: 'none', filters: {} },
    {
      filters: {},
      rowFilters: {},
      rowConditions: [{ column: 'value_variable_label', operator: 'in', values: ['Unemployed'] }],
      columns: ['period', 'value'],
    },
    profiles,
    [
      {
        id: 'count',
        label: 'Unemployed',
        unit: 'Number',
        filters: { value_variable_code: 'ERW006', value_unit: 'Number' },
      },
    ]
  );
  expect(result.filters).toMatchObject({
    value_variable_label: 'Unemployed',
    value_variable_code: 'ERW006',
    value_unit: 'Number',
  });
});
