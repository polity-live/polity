import { expect, it } from 'vitest';
import { filterPreviewRows } from '../previewRows';
import { datasetProjectionRequestSchema } from '../projectionRequest';

const table = {
  columns: ['period', 'area', 'value', 'note'],
  rows: [
    { period: '2025-03', area: 'Deutschland', value: '1.234,5', note: 'März' },
    { period: '2025-01', area: 'Deutschland', value: '500', note: '' },
    { period: '2024-12', area: 'Bayern', value: '20', note: 'März' },
    { period: '2025-02', area: 'Bayern', value: '', note: 'Februar' },
  ],
};
it('combines selected values, numeric ranges, text and existing year filters over all rows', () => {
  expect(
    filterPreviewRows(table, {}, { column: 'period', startYear: 2025, endYear: 2025 }, [
      { column: 'area', operator: 'in', values: ['Deutschland', 'Bayern'] },
      { column: 'value', operator: 'range', min: '1000', max: '1500', numeric: true },
      { column: 'note', operator: 'contains', value: 'MÄR' },
    ])
  ).toEqual([table.rows[0]]);
});
it('keeps empty selections distinct and filters chronological periods without aggregating', () => {
  expect(
    filterPreviewRows(table, {}, null, [{ column: 'value', operator: 'in', values: [''] }])
  ).toEqual([table.rows[3]]);
  expect(filterPreviewRows(table, {}, null, [{ column: 'note', operator: 'empty' }])).toEqual([
    table.rows[1],
  ]);
  expect(
    filterPreviewRows(table, {}, null, [
      { column: 'period', operator: 'range', min: '2025-02', max: '2025-03' },
    ])
  ).toEqual([table.rows[0], table.rows[3]]);
  expect(() =>
    filterPreviewRows(table, {}, null, [{ column: 'missing', operator: 'empty' }])
  ).toThrow('Unknown preview column');
});
it('bounds predicates in API validation and retains them for chart and table requests', () => {
  const rowConditions = [{ column: 'area', operator: 'in', values: ['Deutschland', 'Bayern'] }];
  expect(
    datasetProjectionRequestSchema.parse({ view: 'chart', rowConditions }).rowConditions
  ).toEqual(rowConditions);
  expect(
    datasetProjectionRequestSchema.safeParse({
      view: 'table',
      rowConditions: [{ column: 'value', operator: 'range' }],
    }).success
  ).toBe(false);
  expect(
    datasetProjectionRequestSchema.safeParse({
      view: 'table',
      rowConditions: [{ column: 'area', operator: 'in', values: Array(101).fill('a') }],
    }).success
  ).toBe(false);
});
