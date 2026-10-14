import { expect, it } from 'vitest';
import { applyDatasetSearchIntent, requiredProviderDimensions } from '../providerDataView';
import { interpretDatasetSearch } from '../datasetSearch';
import { inferDataViewConfiguration } from '../dataView';
import type { DatasetSnapshotImportResult } from '../../types';

const snapshot: DatasetSnapshotImportResult = {
  datasetId: 'dataset',
  snapshotId: 'snapshot',
  snapshotKey: 'key',
  provider: 'EUROSTAT',
  title: 'Dataset',
  columns: ['geo', 'TIME_PERIOD', 'unit', 'OBS_VALUE'],
  rows: [],
  rowCount: 100,
  columnCount: 4,
  byteSize: 100,
  snapshotTakenAt: '2026-10-11',
  columnProfiles: [
    { name: 'geo', label: 'Area', type: 'category', role: 'geo', nullCount: 0, distinctCount: 2 },
    {
      name: 'TIME_PERIOD',
      label: 'Time',
      type: 'date',
      role: 'time',
      nullCount: 0,
      distinctCount: 3,
    },
    {
      name: 'unit',
      label: 'Unit',
      type: 'category',
      role: 'dimension',
      nullCount: 0,
      distinctCount: 2,
    },
    {
      name: 'OBS_VALUE',
      label: 'Value',
      type: 'number',
      role: 'measure',
      nullCount: 0,
      distinctCount: 100,
    },
  ],
  provenance: {
    providerDimensions: [
      {
        id: 'geo',
        label: 'Area',
        values: [
          { id: 'DE', label: 'Deutschland' },
          { id: 'FR', label: 'France' },
        ],
      },
      { id: 'unit', label: 'Unit', values: [{ id: 'NR' }, { id: 'PC' }] },
    ],
  },
};
it('uses matching raw geographic cells when provider dimension metadata is absent', () => {
  const query = inferDataViewConfiguration(snapshot.columnProfiles!).query;
  expect(
    applyDatasetSearchIntent(
      query,
      { ...snapshot, provenance: {}, rows: [{}, { geo: 'DE' }] },
      interpretDatasetSearch('population Germany')
    ).filters.geo
  ).toBe('DE');
  expect(
    applyDatasetSearchIntent(
      query,
      { ...snapshot, columnProfiles: undefined },
      interpretDatasetSearch('population Germany')
    )
  ).toEqual(query);
  expect(applyDatasetSearchIntent(query, snapshot)).toBe(query);
  expect(
    applyDatasetSearchIntent(
      query,
      {
        ...snapshot,
        provenance: { providerDimensions: [{ id: 'geo', values: [{ id: 'UNKNOWN' }] }] },
      },
      interpretDatasetSearch('population Germany')
    ).filters.geo
  ).toBe('Deutschland');
});
it('omits absent, scalar, time, measure and plotted provider dimensions', () => {
  const query = inferDataViewConfiguration(snapshot.columnProfiles!).query;
  const dimensions = ['missing', 'TIME_PERIOD', 'OBS_VALUE', 'geo', 'unit'].map(id => ({
    id,
    position: 1,
    label: id,
    values: [],
  }));
  expect(
    requiredProviderDimensions(
      { ...snapshot, provenance: { providerDimensions: dimensions } },
      { ...query, dimensionColumn: 'geo', seriesColumn: null, filters: {} }
    ).map(item => item.id)
  ).toEqual(['unit']);
  expect(
    requiredProviderDimensions(
      {
        ...snapshot,
        columnProfiles: snapshot.columnProfiles!.map(item => ({ ...item, distinctCount: 1 })),
      },
      query
    )
  ).toEqual([]);
});
it.each(['Arbeitslose', 'Bevölkerung', 'Inflation', 'Bruttoinlandsprodukt'])(
  'transfers area and period for %s without unemployment-specific defaults',
  topic => {
    const inferred = inferDataViewConfiguration(snapshot.columnProfiles!);
    const query = applyDatasetSearchIntent(
      inferred.query,
      snapshot,
      interpretDatasetSearch(`${topic} 2024-2025 Deutschland`)
    );
    expect(query.filters).toEqual({ geo: 'DE' });
    expect(query.timeRange).toEqual({ column: 'TIME_PERIOD', startYear: 2024, endYear: 2025 });
    expect(requiredProviderDimensions(snapshot, query).map(item => item.id)).toEqual(['unit']);
    expect(
      requiredProviderDimensions(snapshot, { ...query, filters: { ...query.filters, unit: 'NR' } })
    ).toEqual([]);
  }
);
it('does not silently drop an unavailable requested area or reactivate removed search filters', () => {
  const query = inferDataViewConfiguration(snapshot.columnProfiles!).query;
  expect(
    applyDatasetSearchIntent(
      query,
      snapshot,
      interpretDatasetSearch('population', { area: 'Berlin' })
    ).filters.geo
  ).toBe('Berlin');
  expect(
    applyDatasetSearchIntent(
      query,
      snapshot,
      interpretDatasetSearch('population 2025 Germany', { area: null, period: null })
    )
  ).toEqual(query);
});
it('requires a single unit even when the unit was chosen as a plotted dimension', () => {
  const query = inferDataViewConfiguration(snapshot.columnProfiles!).query;
  expect(
    requiredProviderDimensions(snapshot, {
      ...query,
      dimensionColumn: 'unit',
      filters: { geo: 'DE' },
    }).map(item => item.id)
  ).toEqual(['unit']);
});
