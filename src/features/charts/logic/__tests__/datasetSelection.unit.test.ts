import { expect, it } from 'vitest';
import {
  datasetMeasureOptions,
  sameDatasetSelection,
  selectedDatasetMeasure,
} from '../datasetSelection';

it('matches dataset identities and reads optional official measure metadata', () => {
  const identity = { provider: 'UPLOAD' as const, datasetId: 'one' };
  expect(sameDatasetSelection(identity, identity)).toBe(true);
  expect(sameDatasetSelection(identity, { ...identity, datasetId: 'two' })).toBe(false);
  expect(datasetMeasureOptions(null)).toEqual([]);
  expect(datasetMeasureOptions({ provenance: { measureOptions: [] } } as any)).toEqual([]);
});

it('selects a single unconstrained measure and evaluates text, empty and bounded header predicates', () => {
  const count = {
    id: 'count',
    label: 'Unemployed',
    unit: 'Number',
    filters: { value_unit: 'Number' },
  };
  const blank = { id: 'blank', label: ' ', unit: '', filters: {} };
  const query = (rowConditions: any[]) => ({
    aggregation: 'none' as const,
    filters: { unrelated: '', area: 'DE' },
    rowConditions,
  });
  expect(selectedDatasetMeasure([count], query([]))).toBe(count);
  expect(
    selectedDatasetMeasure(
      [count, blank],
      query([{ column: 'value_variable_label', operator: 'contains', value: 'EMPLOY' }])
    )
  ).toBe(count);
  expect(
    selectedDatasetMeasure(
      [count, blank],
      query([{ column: 'value_variable_label', operator: 'empty' }])
    )
  ).toBe(blank);
  expect(
    selectedDatasetMeasure([count, blank], query([{ column: 'value_unit', operator: 'empty' }]))
  ).toBe(blank);
  for (const bounds of [
    { min: 'M', max: 'Z' },
    { min: 'M', max: '' },
  ]) {
    expect(
      selectedDatasetMeasure(
        [count, blank],
        query([{ column: 'value_unit', operator: 'range', ...bounds }])
      )
    ).toBe(count);
  }
  expect(
    selectedDatasetMeasure(
      [count],
      query([{ column: 'value_unit', operator: 'range', min: '', max: 'Z' }])
    )
  ).toBe(count);
  expect(
    selectedDatasetMeasure(
      [count],
      query([{ column: 'value_unit', operator: 'range', min: 'N', max: 'M' }])
    )
  ).toBeUndefined();
});

it('rejects annual tables, different resources and different snapshots even when titles are alike', () => {
  const expected = { provider: 'GENESIS_DESTATIS' as const, providerDatasetId: '13211-0002' };
  expect(sameDatasetSelection(expected, { ...expected, providerDatasetId: '13211-0001' })).toBe(
    false
  );
  expect(
    sameDatasetSelection({ ...expected, snapshotId: 'old' }, { ...expected, snapshotId: 'new' })
  ).toBe(false);
  expect(
    sameDatasetSelection(
      { ...expected, providerResourceId: 'one' },
      { ...expected, providerResourceId: 'two' }
    )
  ).toBe(false);
});
it('resolves only unique official metric and unit combinations from explicit table filters', () => {
  const options = [
    {
      id: 'count',
      label: 'Arbeitslose',
      unit: 'Anzahl',
      filters: { value_variable_code: 'ERW006', value_unit: 'Anzahl' },
    },
    {
      id: 'rate',
      label: 'Arbeitslosenquote',
      unit: 'Prozent',
      filters: { value_variable_code: 'ERW112', value_unit: 'Prozent' },
    },
  ];
  expect(selectedDatasetMeasure(options, { aggregation: 'none', filters: {} })).toBeUndefined();
  expect(
    selectedDatasetMeasure(options, {
      aggregation: 'none',
      filters: { value_variable_code: 'ERW006' },
    })
  ).toMatchObject({ id: 'count' });
  expect(
    selectedDatasetMeasure(options, { aggregation: 'none', filters: options[0].filters })?.id
  ).toBe('count');
});

it('recognizes one official measure from header label and unit filters, retaining ambiguity and contradictions', () => {
  const options = [
    {
      id: 'count',
      label: 'Unemployed',
      unit: 'Number',
      filters: { value_variable_code: 'ERW006', value_unit: 'Number' },
    },
    {
      id: 'rate',
      label: 'Unemployment rate',
      unit: 'Percent',
      filters: { value_variable_code: 'ERW112', value_unit: 'Percent' },
    },
  ];
  expect(
    selectedDatasetMeasure(options, {
      aggregation: 'none',
      filters: { value_variable_label: 'Unemployed', value_unit: 'Number' },
    })?.id
  ).toBe('count');
  expect(
    selectedDatasetMeasure(options, {
      aggregation: 'none',
      filters: {},
      rowConditions: [{ column: 'value_variable_label', operator: 'in', values: ['Unemployed'] }],
    })?.id
  ).toBe('count');
  expect(
    selectedDatasetMeasure(options, {
      aggregation: 'none',
      filters: {},
      rowConditions: [
        {
          column: 'value_variable_label',
          operator: 'in',
          values: ['Unemployed', 'Unemployment rate'],
        },
      ],
    })
  ).toBeUndefined();
  expect(
    selectedDatasetMeasure(options, {
      aggregation: 'none',
      filters: options[0].filters,
      rowConditions: [{ column: 'value_unit', operator: 'in', values: ['Percent'] }],
    })
  ).toBeUndefined();
});
