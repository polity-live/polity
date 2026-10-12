import { beforeEach, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { genesisObservations } from './fixtures/genesis-observations';
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  metadata: vi.fn(),
  read: vi.fn(),
  selection: vi.fn(),
  prepare: vi.fn(),
  fetch: vi.fn(),
  pkg: vi.fn(),
  csv: vi.fn(),
}));
vi.mock('../service', () => ({ loadSnapshotTable: mocks.load }));
vi.mock('../genesis', () => ({
  getGenesisTableMetadata: mocks.metadata,
  readGenesisTable: mocks.read,
  loadGenesisSelection: mocks.selection,
}));
vi.mock('../providers', () => ({ prepareEurostatDataset: mocks.prepare }));
vi.mock('@/server/govdata/catalogue', () => ({
  loadGovDataPackage: mocks.pkg,
  isGovDataCsvResource: mocks.csv,
}));
import { previewDataset, DATASET_PREVIEW_BYTES } from '../preview';
import { normalizeGenesisTable } from '../semantics';
import { clearDatasetSearchCache } from '../searchRuntime';
const request = {
  provider: 'GENESIS_DESTATIS' as const,
  providerDatasetId: '13211-0002',
  language: 'de',
  filters: { area: 'Deutschland', period: { start: 2025, end: 2025 } },
};
beforeEach(() => {
  clearDatasetSearchCache();
  vi.clearAllMocks();
  mocks.metadata.mockResolvedValue({
    Code: '13211-0002',
    Content: 'Arbeitslose: Deutschland, Monate',
    Time: { From: '2005', To: '2026' },
    Structure: { Columns: [{ Code: 'ERW006' }] },
  });
  mocks.read.mockResolvedValue(normalizeGenesisTable(genesisObservations()));
  mocks.csv.mockReturnValue(true);
  vi.stubGlobal('fetch', mocks.fetch);
});
it('pages a complete snapshot after filtering, returns facets and checks access on every page', async () => {
  const columns = [
    { name: 'value', label: 'Value', type: 'number', role: 'measure', technical: false },
  ];
  mocks.load.mockResolvedValue({
    dataset: { id: 'dataset', provider: 'UPLOAD' },
    snapshot: { column_profiles: columns, metadata: {} },
    table: {
      columns: ['value', 'area'],
      rows: Array.from({ length: 450 }, (_, index) => ({
        value: String(index),
        area: index % 2 ? 'A' : 'B',
      })),
    },
  });
  const selection = {
    provider: 'UPLOAD' as const,
    snapshotId: 'snapshot',
    rowConditions: [{ column: 'area', operator: 'in' as const, values: ['A'] }],
    sort: { column: 'value', direction: 'asc' as const },
  };
  const first = await previewDataset({ ...selection, page: { offset: 0, limit: 200 } }, 'allowed');
  const next = await previewDataset({ ...selection, page: { offset: 200, limit: 200 } }, 'allowed');
  expect(first.rows).toHaveLength(200);
  expect(first.page).toEqual({ offset: 0, limit: 200, total: 225, nextOffset: 200 });
  expect(next.rows).toHaveLength(25);
  expect(next.rows[0].value).toBe('401');
  expect(next.page?.nextOffset).toBeNull();
  expect(first.facets?.area).toEqual({ values: ['B', 'A'], complete: true });
  expect(first.facets?.value.complete).toBe(false);
  expect(mocks.load).toHaveBeenCalledTimes(2);
});
it('reuses a bounded external sample across pages and applies predicates beyond its first five rows', async () => {
  const selected = { ...request, page: { offset: 0, limit: 200 } };
  const all = await previewDataset(selected);
  expect(all.rows.length).toBeGreaterThan(5);
  const last = all.rows.at(-1)!;
  const filtered = await previewDataset({
    ...selected,
    rowConditions: [
      { column: 'observation_period', operator: 'in', values: [last.observation_period] },
    ],
  });
  expect(filtered.rows.length).toBeGreaterThan(0);
  expect(filtered.rows.every(row => row.observation_period === last.observation_period)).toBe(true);
  expect(mocks.read).toHaveBeenCalledOnce();
});
it('returns five real national rows, profiles and scope without snapshot persistence, then caches the exact selection', async () => {
  const preview = await previewDataset(request, 'user');
  expect(preview.identity.providerDatasetId).toBe('13211-0002');
  expect(preview.rows).toHaveLength(5);
  expect(preview.rows.every(row => row.DINSGF === '__total__:DINSGF')).toBe(true);
  expect(preview.columns.find(column => column.name === 'observation_period')?.role).toBe('time');
  expect(mocks.read).toHaveBeenCalledWith(
    '13211-0002',
    'de',
    { startyear: '2025', endyear: '2025' },
    expect.any(AbortSignal),
    DATASET_PREVIEW_BYTES
  );
  await previewDataset(request, 'other-user');
  expect(mocks.read).toHaveBeenCalledOnce();
  await previewDataset({
    ...request,
    filters: { ...request.filters, dimensions: { value_variable_code: 'ERW006' } },
  });
  expect(mocks.read.mock.calls[1][2]).toHaveProperty('contents', 'ERW006');
});
it('authorizes private snapshots every time, does not cache them, and rejects changed identity', async () => {
  const snapshotRequest = {
    provider: 'UPLOAD' as const,
    snapshotId: 'snapshot',
    datasetId: 'dataset',
  };
  mocks.load.mockResolvedValue({
    dataset: {
      id: 'dataset',
      provider: 'UPLOAD',
      provider_dataset_id: null,
      provider_resource_id: null,
    },
    snapshot: { column_profiles: [], metadata: {} },
    table: { columns: ['value'], rows: [{ value: '' }] },
  });
  await previewDataset(snapshotRequest, 'allowed');
  await previewDataset(snapshotRequest, 'allowed');
  expect(mocks.load).toHaveBeenCalledTimes(2);
  await expect(
    previewDataset({ ...snapshotRequest, datasetId: 'wrong' }, 'allowed')
  ).rejects.toMatchObject({ httpStatus: 409 });
  mocks.load.mockRejectedValue(new Error('Dataset access denied'));
  await expect(previewDataset(snapshotRequest, 'denied')).rejects.toThrow('access denied');
});
it('returns fewer rows and no aggregation for a filtered snapshot', async () => {
  mocks.load.mockResolvedValue({
    dataset: { id: 'dataset', provider: 'UPLOAD' },
    snapshot: { column_profiles: [{ name: 'time', role: 'time' }], metadata: {} },
    table: {
      columns: ['time', 'value'],
      rows: [
        { time: '2025-02', value: '2' },
        { time: '2024-01', value: '7' },
        { time: '2025-01', value: '1' },
      ],
    },
  });
  const result = await previewDataset(
    {
      provider: 'UPLOAD',
      snapshotId: 'snapshot',
      timeRange: { column: 'time', startYear: 2025, endYear: 2025 },
    },
    'user'
  );
  expect(result.rows).toEqual([
    { time: '2025-01', value: '1' },
    { time: '2025-02', value: '2' },
  ]);
});
it('enforces the 20-second whole preview deadline and cancels an obsolete request', async () => {
  vi.useFakeTimers();
  try {
    mocks.read.mockImplementation(
      (_code, _lang, _data, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason))
        )
    );
    const pending = previewDataset(request).catch(error => error);
    await vi.advanceTimersByTimeAsync(20_001);
    expect((await pending).name).toBe('TimeoutError');
    const controller = new AbortController();
    const obsolete = previewDataset(request, 'user', controller.signal).catch(error => error);
    controller.abort();
    expect((await obsolete).name).toBe('AbortError');
  } finally {
    vi.useRealTimers();
  }
});
it('streams GovData samples without persisting, preserves split UTF-8 and cancels after five rows', async () => {
  mocks.pkg.mockResolvedValue({
    resources: [{ id: 'csv', download_url: 'https://catalog.example/sample.csv' }],
  });
  const encoded = new TextEncoder().encode(
    'Jahr;Gebiet;Wert;Name\n2025;Deutschland;1;März\n2025;Deutschland;2;März\n2025;Deutschland;3;März\n2025;Deutschland;4;März\n2025;Deutschland;5;März\n2025;Deutschland;6;März\n'
  );
  const split = encoded.lastIndexOf(0xc3) + 1;
  const cancel = vi.fn();
  mocks.fetch.mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoded.subarray(0, split));
        },
        pull(controller) {
          controller.enqueue(encoded.subarray(split));
        },
        cancel,
      })
    )
  );
  const sample = await previewDataset({
    provider: 'GOVDATA',
    providerDatasetId: 'package',
    providerResourceId: 'csv',
    filters: { area: 'Deutschland', period: { start: 2025, end: 2025 } },
  });
  expect(sample.rows).toHaveLength(5);
  expect(sample.rows.every(row => row.Name === 'März')).toBe(true);
  expect(cancel).toHaveBeenCalledOnce();
  expect(mocks.load).not.toHaveBeenCalled();
});
it('rejects streamed samples over 2 MiB and cancels the reader', async () => {
  mocks.pkg.mockResolvedValue({
    resources: [{ id: 'csv', download_url: 'https://catalog.example/huge.csv' }],
  });
  const cancel = vi.fn();
  mocks.fetch.mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(DATASET_PREVIEW_BYTES + 1));
        },
        cancel,
      })
    )
  );
  await expect(
    previewDataset({
      provider: 'GOVDATA',
      providerDatasetId: 'huge-package',
      providerResourceId: 'csv',
    })
  ).rejects.toMatchObject({ code: 'too_large', httpStatus: 413 });
  expect(cancel).toHaveBeenCalledOnce();
});
it('requests a constrained Eurostat sample, exposes extra restrictions and rejects changed coverage', async () => {
  mocks.prepare.mockResolvedValue({
    provider: 'EUROSTAT',
    code: 'unemployment',
    geoDimension: 'geo',
    timeDimension: 'TIME_PERIOD',
    dimensions: [
      { id: 'geo', values: [{ id: 'DE', label: 'Germany' }] },
      { id: 'TIME_PERIOD', values: [{ id: '2025-01' }, { id: '2025-02' }] },
      {
        id: 'unit',
        values: [
          { id: 'NR', label: 'Number' },
          { id: 'PC', label: 'Percent' },
        ],
      },
    ],
  });
  const selection = {
    provider: 'EUROSTAT' as const,
    providerDatasetId: 'unemployment',
    filters: { area: 'Deutschland', period: { start: 2025, end: 2025 } },
  };
  mocks.fetch.mockResolvedValueOnce(
    new Response('geo,TIME_PERIOD,unit,OBS_VALUE\nDE,2025-01,NR,2992658\nDE,2025-02,NR,2989220\n')
  );
  const sample = await previewDataset(selection);
  expect(sample.rows).toHaveLength(2);
  expect(sample.appliedFilters.dimensions).toHaveProperty('unit', 'NR');
  expect(sample.columns.find(column => column.name === 'OBS_VALUE')?.role).toBe('measure');
  expect(new URL(String(mocks.fetch.mock.calls[0][0])).searchParams.get('c[geo]')).toBe('DE');
  clearDatasetSearchCache();
  mocks.fetch.mockResolvedValueOnce(
    new Response('geo,TIME_PERIOD,unit,OBS_VALUE\nFR,2025-01,NR,10\n')
  );
  await expect(previewDataset(selection)).rejects.toMatchObject({ code: 'invalid_scope' });
});

it('returns canonical table header filters and removing quick scope preserves manual predicates', async () => {
  const semantic = await import('../semantics').then(module =>
    module.genesisSemantics(
      normalizeGenesisTable(genesisObservations()),
      [],
      'de',
      'Arbeitslose: Deutschland, Monate'
    )
  );
  mocks.load.mockResolvedValue({
    dataset: { id: 'dataset', provider: 'GENESIS_DESTATIS', provider_dataset_id: '13211-0002' },
    snapshot: { column_profiles: semantic.profiles, metadata: semantic.metadata },
    table: semantic.table,
  });
  const selection = {
    ...request,
    snapshotId: 'snapshot',
    datasetId: 'dataset',
    page: { offset: 0, limit: 200 },
  };
  const initial = await previewDataset(selection);
  expect(initial.rowFilters.DINSGF).toBe('__total__:DINSGF');
  expect(initial.timeRange).toEqual({
    column: 'observation_period',
    startYear: 2025,
    endYear: 2025,
  });
  const cleared = await previewDataset({
    ...selection,
    filters: { area: null, period: null },
    rowConditions: [{ column: 'value_variable_label', operator: 'in', values: ['Arbeitslose'] }],
  });
  expect(cleared.rowFilters).toEqual({});
  expect(cleared.timeRange).toBeUndefined();
  expect(new Set(cleared.rows.map(row => row.DINSGF)).size).toBe(3);
  expect(cleared.rows.every(row => row.value_variable_code === 'ERW006')).toBe(true);
  await expect(
    previewDataset({ ...selection, filters: { area: 'Unknown', period: null } })
  ).rejects.toMatchObject({ code: 'invalid_scope' });
});

it('bounds open-ended GENESIS quick periods to official provider availability for native requests', async () => {
  await previewDataset({
    ...request,
    page: { offset: 0, limit: 200 },
    filters: { area: 'Deutschland', period: { start: 2025, end: 2199 } },
  });
  expect(mocks.read.mock.calls.at(-1)?.[2]).toMatchObject({ startyear: '2025', endyear: '2026' });
});
it('resolves one-sided Eurostat quick periods using available years without inventing missing observations', async () => {
  const { resolveImportFilters } = await import('../importScope');
  const preparation = {
    provider: 'EUROSTAT' as const,
    code: 'test',
    title: 'Test',
    dimensions: [
      {
        id: 'TIME_PERIOD',
        label: 'Period',
        position: 0,
        values: [{ id: '2024-01' }, { id: '2025-01' }, { id: '2027-01' }],
      },
    ],
    timeDimension: 'TIME_PERIOD',
    estimatedBytes: null,
    importAllowed: true,
    suggestedFilters: {},
  };
  expect(
    resolveImportFilters(preparation, { period: { start: 2025, end: 2199 } }).TIME_PERIOD
  ).toEqual(['2025-01', '2027-01']);
  expect(
    resolveImportFilters(preparation, { period: { start: 1800, end: 2024 } }).TIME_PERIOD
  ).toEqual(['2024-01']);
  expect(() => resolveImportFilters(preparation, { period: { start: 2025, end: 2027 } })).toThrow(
    'not fully available'
  );
});

it('sorts incomplete numeric snapshot cells in both directions and rejects unknown sort columns', async () => {
  mocks.load.mockResolvedValue({
    dataset: { id: 'dataset', provider: 'UPLOAD' },
    snapshot: {
      column_profiles: [{ name: 'value', type: 'number', role: 'measure', technical: false }],
      metadata: null,
    },
    table: {
      columns: ['value', 'note'],
      rows: [{ value: '2' }, {}, { value: 'invalid' }, { value: '1' }],
    },
  });
  const selected = {
    provider: 'UPLOAD' as const,
    snapshotId: 'snapshot',
    page: { offset: 0, limit: 20 },
  };
  const ascending = await previewDataset(
    { ...selected, sort: { column: 'value', direction: 'asc' } },
    'user'
  );
  expect(ascending.rows.map(row => row.value)).toEqual([undefined, 'invalid', '1', '2']);
  expect(ascending.facets?.note).toEqual({ values: [''], complete: true });
  expect(ascending.metadata).toEqual({});
  const descending = await previewDataset(
    { ...selected, sort: { column: 'value', direction: 'desc' } },
    'user'
  );
  expect(descending.rows.map(row => row.value)).toEqual(['2', '1', undefined, 'invalid']);
  await expect(
    previewDataset({ ...selected, sort: { column: 'missing', direction: 'asc' } }, 'user')
  ).rejects.toMatchObject({ code: 'invalid_scope' });
  await expect(
    previewDataset({ ...selected, filters: { area: 'Deutschland' } }, 'user')
  ).rejects.toMatchObject({ code: 'invalid_scope' });
});

it('validates every supplied snapshot identity and tolerates absent display cells when sorting text', async () => {
  mocks.load.mockResolvedValue({
    dataset: {
      id: 'dataset',
      provider: 'GOVDATA',
      provider_dataset_id: 'package',
      provider_resource_id: 'csv',
    },
    snapshot: { column_profiles: [{ name: 'time', type: 'date', role: 'time', technical: false }] },
    table: { columns: ['time'], rows: [{ time: '2025' }, {}, { time: '2024' }] },
  });
  const selected = { provider: 'GOVDATA' as const, snapshotId: 'snapshot' };
  expect((await previewDataset(selected, 'user')).rows.map(row => row.time)).toEqual([
    undefined,
    '2024',
    '2025',
  ]);
  for (const identity of [{ providerDatasetId: 'wrong' }, { providerResourceId: 'wrong' }]) {
    await expect(previewDataset({ ...selected, ...identity }, 'user')).rejects.toMatchObject({
      httpStatus: 409,
    });
  }
});

it('rejects requests without a source code and providers without an external preview', async () => {
  await expect(previewDataset({ provider: 'GOVDATA' })).rejects.toMatchObject({
    code: 'invalid_scope',
  });
  await expect(
    previewDataset({ provider: 'UPLOAD', providerDatasetId: 'upload' })
  ).rejects.toMatchObject({ code: 'invalid_scope' });
});

it('uses the latest known GENESIS year for a sample while an explicitly broad browsing request stays broad', async () => {
  mocks.metadata.mockResolvedValue({ Time: { To: '2025' }, Content: 'Deutschland' });
  const latest = await previewDataset({ ...request, filters: {}, language: undefined });
  expect(latest.appliedFilters.period).toEqual({ start: 2025, end: 2025 });
  expect(mocks.read.mock.calls[0][2]).toEqual({ startyear: '2025', endyear: '2025' });
  await previewDataset({ ...request, filters: { period: null }, page: { offset: 0, limit: 200 } });
  expect(mocks.read.mock.calls.at(-1)?.[2]).toEqual({});
  mocks.metadata.mockResolvedValue({ Content: 'Deutschland' });
  clearDatasetSearchCache();
  const undated = await previewDataset({ ...request, filters: {} });
  expect(undated.appliedFilters.period).toBeUndefined();
});

it('bounds fully open GENESIS periods even when catalogue years are unavailable and checks scalar measures', async () => {
  mocks.metadata.mockResolvedValue({
    Content: 'Deutschland',
    Structure: { Columns: { Code: 'ERW006' } },
  });
  await previewDataset({
    ...request,
    filters: { period: { start: 1800, end: 2199 }, dimensions: { value_variable_code: 'ERW006' } },
  });
  expect(mocks.read.mock.calls[0][2]).toEqual({
    startyear: '1800',
    endyear: '2199',
    contents: 'ERW006',
  });
  clearDatasetSearchCache();
  mocks.metadata.mockResolvedValue({});
  await expect(
    previewDataset({ ...request, filters: { dimensions: { value_variable_code: 'missing' } } })
  ).rejects.toMatchObject({ code: 'invalid_scope' });
  mocks.metadata.mockResolvedValue({ Time: { From: '2005', To: '2026' }, Content: 'Deutschland' });
  await previewDataset({ ...request, filters: { period: { start: 1800, end: 2025 } } });
  expect(mocks.read.mock.calls.at(-1)?.[2]).toMatchObject({ startyear: '2005' });
});

it('delegates regional and dimension-scoped GENESIS samples to validated selections', async () => {
  mocks.selection.mockResolvedValue({
    table: {
      columns: ['REGION', 'time', 'value'],
      rows: [{ REGION: 'Berlin', time: '2025', value: '1' }],
    },
    profiles: [
      { name: 'REGION', role: 'geo', type: 'category', technical: false },
      { name: 'time', role: 'time', type: 'date', technical: false },
      { name: 'value', role: 'measure', type: 'number', technical: false },
    ],
    metadata: {},
  });
  const region = await previewDataset({
    ...request,
    filters: { area: 'Berlin', period: { start: 2025, end: 2025 } },
  });
  expect(region.rows).toEqual([{ REGION: 'Berlin', time: '2025', value: '1' }]);
  await previewDataset({ ...request, filters: { dimensions: { REGION: 'Berlin' } } });
  expect(mocks.selection).toHaveBeenCalledTimes(2);
});

it('requires positive national evidence and rejects out-of-scope or undated GENESIS observations', async () => {
  mocks.read.mockResolvedValue({
    columns: ['time', 'value'],
    rows: [{ time: '2025', value: '1' }],
  });
  await expect(previewDataset(request)).rejects.toThrow('National total cannot be confirmed');
  mocks.read.mockResolvedValue({
    columns: ['time', 'value', 'DINSG'],
    rows: [{ time: '2025', value: '1', DINSG: 'Germany' }],
  });
  const national = await previewDataset({ ...request, providerDatasetId: 'other' });
  expect(national.rows).toHaveLength(1);
  for (const time of ['unknown', '2024', '2026']) {
    clearDatasetSearchCache();
    mocks.read.mockResolvedValue({ columns: ['time', 'value'], rows: [{ time, value: '1' }] });
    await expect(
      previewDataset({ ...request, filters: { period: { start: 2025, end: 2025 } } })
    ).rejects.toThrow('Response changed the selected period');
  }
});

function eurostatPreparation() {
  return {
    provider: 'EUROSTAT',
    code: 'sample',
    timeDimension: 'TIME_PERIOD',
    geoDimension: 'geo',
    dimensions: [
      { id: 'geo', values: [{ id: 'DE', label: 'Germany' }] },
      { id: 'TIME_PERIOD', values: [{ id: '2024' }, { id: '2025' }] },
      { id: 'unit', values: [{ id: 'NR' }] },
      { id: 'empty', values: [] },
    ],
  };
}

it('decodes compressed Eurostat samples and fixes the latest time only for a small sample', async () => {
  mocks.prepare.mockResolvedValue(eurostatPreparation());
  mocks.fetch.mockResolvedValue(
    new Response(gzipSync('geo,TIME_PERIOD,unit,extra,OBS_VALUE\nDE,2025,NR,x,2\n'))
  );
  const selected = { provider: 'EUROSTAT' as const, providerDatasetId: 'sample' };
  const sample = await previewDataset(selected);
  expect(sample.appliedFilters.dimensions).toMatchObject({
    geo: 'DE',
    TIME_PERIOD: '2025',
    unit: 'NR',
  });
  expect(sample.columns.find(column => column.name === 'extra')).toMatchObject({
    role: 'dimension',
    technical: true,
  });
  mocks.fetch.mockResolvedValue(
    new Response('geo,TIME_PERIOD,unit,OBS_VALUE\nDE,2024,NR,1\nDE,2025,NR,2\n')
  );
  const browser = await previewDataset({ ...selected, page: { offset: 0, limit: 200 } });
  expect(browser.rows).toHaveLength(2);
  expect(browser.appliedFilters.dimensions).not.toHaveProperty('TIME_PERIOD');
});

it('rejects unavailable or malformed Eurostat samples without caching provider failures', async () => {
  mocks.prepare.mockResolvedValue(eurostatPreparation());
  const selected = { provider: 'EUROSTAT' as const, providerDatasetId: 'sample' };
  mocks.fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'unavailable' });
  mocks.fetch.mockResolvedValueOnce(new Response('geo,TIME_PERIOD,value\nDE,2025,1\n'));
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'invalid_response' });
  mocks.fetch.mockResolvedValueOnce(new Response(new Uint8Array([0x1f, 0])));
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'invalid_response' });
});

it('rejects absent or non-CSV GovData resources and unavailable bodies', async () => {
  const selected = {
    provider: 'GOVDATA' as const,
    providerDatasetId: 'package',
    providerResourceId: 'csv',
  };
  mocks.pkg.mockResolvedValue({});
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'invalid_scope' });
  mocks.pkg.mockResolvedValue({ resources: [{ id: 'csv', url: 'https://catalog.example/csv' }] });
  mocks.csv.mockReturnValueOnce(false);
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'invalid_scope' });
  mocks.fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'unavailable' });
  mocks.fetch.mockResolvedValueOnce(new Response(null));
  await expect(previewDataset(selected)).rejects.toMatchObject({ code: 'unavailable' });
});

it('reads terminal GovData rows through access URLs and rejects unresolved geographic or time scope', async () => {
  mocks.pkg.mockResolvedValue({
    resources: [{ id: 'csv', access_url: 'https://catalog.example/csv' }],
  });
  const selected = {
    provider: 'GOVDATA' as const,
    providerDatasetId: 'package',
    providerResourceId: 'csv',
  };
  mocks.fetch.mockImplementation(async () => new Response('Name,Value\nA,1\nB,2\n'));
  const sample = await previewDataset(selected);
  expect(sample.rows).toHaveLength(2);
  expect(sample.sampled).toBe(false);
  for (const filters of [{ area: 'Deutschland' }, { period: { start: 2025, end: 2025 } }]) {
    await expect(previewDataset({ ...selected, filters })).rejects.toMatchObject({
      code: 'invalid_scope',
    });
  }
});

it('does not reinterpret incomplete or empty streamed CSV as a successful sample', async () => {
  mocks.pkg.mockResolvedValue({ resources: [{ id: 'csv', url: 'https://catalog.example/csv' }] });
  for (const body of ['', 'Name,Value\n"unfinished']) {
    mocks.fetch.mockResolvedValueOnce(new Response(body));
    await expect(
      previewDataset({
        provider: 'GOVDATA',
        providerDatasetId: 'package',
        providerResourceId: 'csv',
      })
    ).rejects.toMatchObject({ code: 'invalid_response' });
  }
});

it('resolves snapshot geography from provider codes without treating absent labels or cells as evidence', async () => {
  mocks.load.mockResolvedValue({
    dataset: { id: 'dataset', provider: 'EUROSTAT' },
    snapshot: {
      column_profiles: [{ name: 'geo', role: 'geo', type: 'category', technical: false }],
      metadata: {
        providerDimensions: [{ id: 'geo', values: [{ id: 'DE', label: 'Germany' }, { id: 'FR' }] }],
      },
    },
    table: { columns: ['geo'], rows: [{ geo: 'DE' }, {}] },
  });
  const sample = await previewDataset(
    { provider: 'EUROSTAT', snapshotId: 'snapshot', filters: { area: 'Deutschland' } },
    'user'
  );
  expect(sample.rows).toEqual([{ geo: 'DE' }]);
});

it('rejects a full byte budget containing no matching CSV observations and ignores cancellation cleanup errors', async () => {
  mocks.pkg.mockResolvedValue({ resources: [{ id: 'csv', url: 'https://catalog.example/csv' }] });
  const selected = {
    provider: 'GOVDATA' as const,
    providerDatasetId: 'package',
    providerResourceId: 'csv',
  };
  const outside =
    'Jahr;Gebiet;Wert;Name\n2024;Deutschland;1;old\n2025;Deutschland;1;' +
    'x'.repeat(DATASET_PREVIEW_BYTES);
  mocks.fetch.mockResolvedValueOnce(new Response(outside));
  await expect(
    previewDataset({ ...selected, filters: { period: { start: 2025, end: 2025 } } })
  ).rejects.toMatchObject({ code: 'too_large', httpStatus: 413 });
  const cancel = vi.fn(() => {
    throw new Error('Provider cleanup unavailable');
  });
  mocks.fetch.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Name,Value\nA,1\nB,2\nC,3\nD,4\nE,5\n'));
        },
        cancel,
      })
    )
  );
  const sample = await previewDataset(selected);
  expect(sample.rows).toHaveLength(5);
  expect(cancel).toHaveBeenCalledOnce();
});
