/** Local acceptance for the reported month-table regression. Never prints session credentials. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const origin = 'http://localhost:3000';
assert.equal(new URL(origin).hostname, 'localhost');
const fixture = JSON.parse(await readFile('output/dataset-repair/fixture-private.json', 'utf8'));
const state = JSON.parse(await readFile('output/dataset-repair/browser-state.json', 'utf8'));
const cookies = state.cookies
  .filter((cookie: { name: string }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
if (cookies.length) {
  try {
    const raw = cookies.map((cookie: { value: string }) => cookie.value).join('');
    const session = JSON.parse(
      raw.startsWith('base64-') ? Buffer.from(raw.slice(7), 'base64url').toString('utf8') : raw
    );
    if (session.access_token) fixture.accessToken = session.access_token;
  } catch {
    throw new Error('Local browser authentication could not be read');
  }
}
const call = async (path: string, body?: object) => {
  const response = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${fixture.accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120_000),
  });
  const value = await response.json();
  assert(response.ok, `${path}: HTTP ${response.status} (${value.error?.code ?? 'unknown'})`);
  return value;
};
const selection = {
  provider: 'GENESIS_DESTATIS',
  providerDatasetId: '13211-0002',
  language: 'de',
  filters: { area: 'Deutschland', period: { start: 2025, end: 2025 } },
};
const sample = await call('/api/datasets/preview', selection);
assert.equal(sample.identity.providerDatasetId, '13211-0002');
assert.equal(sample.rows.length, 5);
assert(
  sample.rows.every(
    (row: any) => row.DINSGF === '__total__:DINSGF' && row.observation_period.startsWith('2025-')
  )
);
const paged = await call('/api/datasets/preview', {
  ...selection,
  page: { offset: 0, limit: 200 },
});
assert.equal(paged.page.total, 72);
assert.equal(paged.rows.length, 72);
const rowConditions = [
  { column: 'observation_period', operator: 'range', min: '2025-03', max: '2025-06' },
];
const tableSelected = await call('/api/datasets/preview', {
  ...selection,
  page: { offset: 0, limit: 200 },
  rowFilters: { value_variable_code: 'ERW006', value_unit: 'Anzahl' },
  rowConditions,
});
assert.equal(tableSelected.rows.length, 4);
assert.deepEqual(
  tableSelected.rows.map((row: any) => row.observation_period),
  ['2025-03', '2025-04', '2025-05', '2025-06']
);
const snapshot = await call('/api/datasets/snapshots', {
  provider: selection.provider,
  code: selection.providerDatasetId,
  language: 'de',
  filters: selection.filters,
});
assert.equal(snapshot.providerDatasetId, '13211-0002');
assert.equal(snapshot.provenance.measureOptions.length, 6);
const rowFilters = {
  DINSGF: '__total__:DINSGF',
  value_variable_code: 'ERW006',
  value_unit: 'Anzahl',
};
const query = {
  view: 'chart',
  measureColumn: 'value',
  dimensionColumn: 'observation_period',
  aggregation: 'none',
  filters: rowFilters,
  timeRange: { column: 'observation_period', startYear: 2025, endYear: 2025 },
};
const chart = await call(`/api/datasets/${snapshot.snapshotId}/projection`, query);
assert.equal(chart.points.length, 12);
assert.deepEqual(
  chart.points.map((point: any) => point.x),
  Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, '0')}`)
);
assert.equal(chart.points[2].value, 2_967_080);
const selectedChart = await call(`/api/datasets/${snapshot.snapshotId}/projection`, {
  ...query,
  rowConditions,
});
assert.deepEqual(
  selectedChart.points.map((point: any) => point.x),
  tableSelected.rows.map((row: any) => row.observation_period)
);
assert.equal(selectedChart.points[0].value, 2_967_080);
const filtered = await call('/api/datasets/preview', {
  ...selection,
  filters: undefined,
  datasetId: snapshot.datasetId,
  snapshotId: snapshot.snapshotId,
  providerResourceId: snapshot.providerResourceId,
  rowFilters,
  timeRange: query.timeRange,
});
assert.equal(filtered.rows.length, 5);
assert(
  filtered.rows.every(
    (row: any) => row.value_variable_code === 'ERW006' && row.value_unit === 'Anzahl'
  )
);
const details = await call(
  `/api/datasets/${snapshot.datasetId}/details?snapshotId=${snapshot.snapshotId}`
);
assert.equal(details.snapshotId, snapshot.snapshotId);
assert.equal(details.providerDatasetId, '13211-0002');
const report = {
  providerDatasetId: snapshot.providerDatasetId,
  datasetId: snapshot.datasetId,
  snapshotId: snapshot.snapshotId,
  previewRows: sample.rows.length,
  virtualPreviewRows: paged.rows.length,
  tableFilteredRows: tableSelected.rows.length,
  tableFilteredChartPoints: selectedChart.points.length,
  measureChoices: snapshot.provenance.measureOptions.length,
  chronologicalMonths: chart.points.length,
  marchCount: chart.points[2].value,
  filteredPreviewRows: filtered.rows.length,
  restored: true,
};
await writeFile('output/dataset-repair/monthly-acceptance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
