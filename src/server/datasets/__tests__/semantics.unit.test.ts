import { describe, expect, it } from 'vitest';
import { genesisSemantics, normalizeGenesisTable, totalIdentity } from '../semantics';
import { aggregateDatasetValues, parseDatasetNumber } from '../csv';
import { filterPreviewRows } from '../previewRows';
import { genesisObservations } from './fixtures/genesis-observations';
import { assertProviderProjectionScope } from '../projection';

describe('13211-0002 monthly observations and 13211-0001 annual observations', () => {
  it('preserves the precision of quarterly and daily provider observations', () => {
    const quarterly = normalizeGenesisTable({
      columns: ['time', 'value', '1_variable_code', '1_variable_attribute_code'],
      rows: [
        {
          time: '2025',
          value: '1',
          '1_variable_code': 'QUARTAL',
          '1_variable_attribute_code': 'QUARTAL03',
        },
      ],
    });
    expect(quarterly.rows[0].observation_period).toBe('2025-Q3');
    const daily = normalizeGenesisTable({
      columns: [
        'time',
        'value',
        '1_variable_code',
        '1_variable_attribute_code',
        '2_variable_code',
        '2_variable_attribute_code',
      ],
      rows: [
        {
          time: '2025',
          value: '1',
          '1_variable_code': 'MONAT',
          '1_variable_attribute_code': 'MONAT03',
          '2_variable_code': 'TAG',
          '2_variable_attribute_code': 'TAG09',
        },
      ],
    });
    expect(daily.rows[0].observation_period).toBe('2025-03-09');
  });
  it('keeps year and month, distinguishes missing keys from official totals, and resolves two measures', () => {
    const original = genesisObservations();
    const semantic = genesisSemantics(original, [], 'de', 'Arbeitslose: Deutschland, Monate');
    expect(semantic.table.rows[0]).toMatchObject({
      time: '2025',
      MONAT: 'MONAT03',
      observation_period: '2025-03',
      DINSGF: totalIdentity('DINSGF'),
    });
    expect(original.rows[0]).not.toHaveProperty('DINSGF');
    expect(semantic.metadata.measureOptions).toHaveLength(2);
    expect(semantic.profiles.find(item => item.name === 'statistics_code')?.technical).toBe(true);
    expect(semantic.profiles.find(item => item.name === 'time_code')?.technical).toBe(true);
    expect(semantic.profiles.find(item => item.name === 'MONAT')?.technical).toBe(true);
    const missing = { ...original.rows[0], '2_variable_attribute_label': '' };
    expect(
      normalizeGenesisTable({ columns: original.columns, rows: [missing] }).rows[0].DINSGF
    ).toBe('');
  });
  it('produces twelve Germany observations with separated counts and percentages, chronologically ordered', () => {
    const semantic = genesisSemantics(genesisObservations(), [], 'de', 'Deutschland');
    const rows = filterPreviewRows(
      semantic.table,
      { DINSGF: totalIdentity('DINSGF'), value_variable_code: 'ERW006', value_unit: 'Anzahl' },
      { column: 'observation_period', startYear: 2025, endYear: 2025 }
    ).sort((a, b) => a.observation_period.localeCompare(b.observation_period));
    expect(rows).toHaveLength(12);
    expect(rows.map(row => row.observation_period)).toEqual(
      Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, '0')}`)
    );
    expect(
      rows.every(row => row.value_unit === 'Anzahl' && row.DINSGF === totalIdentity('DINSGF'))
    ).toBe(true);
    expect(
      rows.map(row => aggregateDatasetValues([parseDatasetNumber(row.value)], 'none'))[0]
    ).toBe(2_901_000);
  });
  it('leaves annual observations annual and rejects implicit duplicate or percentage sums', () => {
    const semantic = genesisSemantics(genesisObservations(false), [], 'de', 'Deutschland');
    expect(semantic.table.rows[0].observation_period).toBe('2025');
    expect(() => aggregateDatasetValues([5, 7], 'none')).toThrow('dataset_observations_ambiguous');
    expect(() =>
      assertProviderProjectionScope(
        { columns: ['value_unit'], rows: [{ value_unit: 'Prozent' }] },
        { filters: {}, aggregation: 'sum' },
        { providerDimensions: [] }
      )
    ).toThrow('dataset_non_additive');
  });
});
