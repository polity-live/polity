import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const responses: unknown[][] = [];
  const sql = Object.assign(
    vi.fn((strings: TemplateStringsArray) => {
      const statement = strings.join('?').trim();
      if (!/^(?:INSERT|SELECT|UPDATE)\b/.test(statement)) return { statement };
      return Promise.resolve(responses.shift() ?? []);
    }),
    { json: vi.fn((value: unknown) => value) }
  );
  return {
    responses,
    sql,
    assertContribute: vi.fn(),
    assertManage: vi.fn(),
    assertRead: vi.fn(),
    canRead: vi.fn(),
    downloadText: vi.fn(),
    uploadBytes: vi.fn(),
    multiPoints: vi.fn(),
    normalizeText: vi.fn((value: string) => value.replaceAll('&amp;', '&').trim()),
  };
});

vi.mock('../db', () => ({ datasetSql: mocks.sql }));
vi.mock('../access', () => ({
  assertCanContributeGroupDatasets: mocks.assertContribute,
  assertCanManageGroupDatasets: mocks.assertManage,
  assertCanReadDataset: mocks.assertRead,
  userCanReadDataset: mocks.canRead,
}));
vi.mock('../storage', async importOriginal => {
  const actual = await importOriginal<typeof import('../storage')>();
  return {
    ...actual,
    downloadSnapshotText: mocks.downloadText,
    uploadSnapshotBytes: mocks.uploadBytes,
  };
});
vi.mock('../projection', () => ({ buildMultiMeasureProjectionPoints: mocks.multiPoints }));
vi.mock('@/server/govdata/catalogue', () => ({ normalizeGovDataText: mocks.normalizeText }));

import {
  archiveDataset,
  createDatasetProjection,
  getDatasetColumnValues,
  loadDatasetDetails,
  loadSnapshotTable,
  persistDatasetSnapshot,
  searchStoredDatasets,
} from '../service';

const table = {
  columns: ['category', 'series', 'value', 'other'],
  rows: [
    { category: 'B', series: 'One', value: '10', other: '20' },
    { category: 'A', series: 'One', value: '2', other: 'invalid' },
    { category: 'A', series: 'Two', value: '3', other: '30' },
    { category: '', series: 'Two', value: 'invalid', other: '' },
  ],
};

function dataset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dataset-1',
    provider: 'UPLOAD',
    provider_dataset_id: null,
    provider_resource_id: null,
    title: 'Dataset title',
    description: null,
    license: null,
    publisher: null,
    language: 'en',
    source_url: null,
    structure_summary: '4 columns',
    dimensions: [],
    columns: table.columns,
    column_profiles: [],
    time_coverage: {},
    spatial_coverage: {},
    topics: [],
    metadata: {},
    visibility: 'public',
    owner_user_id: 'user-1',
    group_id: null,
    status: 'active',
    created_by_id: 'user-1',
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-02T00:00:00Z'),
    ...overrides,
  };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-1',
    dataset_id: 'dataset-1',
    snapshot_key: 'snapshot-key',
    storage_bucket: 'dataset-snapshots',
    storage_path: 'dataset-1/snapshot-1.csv',
    format: 'csv',
    content_hash: 'hash',
    byte_size: 100,
    row_count: table.rows.length,
    column_count: table.columns.length,
    columns: table.columns,
    column_profiles: [],
    dimensions: [],
    metadata: {},
    status: 'ready',
    snapshot_taken_at: new Date('2025-01-03T00:00:00Z'),
    created_by_id: 'user-1',
    error: null,
    created_at: new Date('2025-01-03T00:00:00Z'),
    updated_at: new Date('2025-01-03T00:00:00Z'),
    ...overrides,
  };
}

function queue(...responses: unknown[][]) {
  mocks.responses.push(...responses);
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'UPLOAD' as const,
    title: 'Dataset title',
    createdById: 'user-1',
    table,
    ...overrides,
  };
}

function queueSnapshotLoad(overrides: Record<string, unknown> = {}) {
  queue([{ ...snapshot(), dataset: dataset(), ...overrides }]);
  mocks.downloadText.mockResolvedValue(
    'category,series,value,other\nB,One,10,20\nA,One,2,invalid\nA,Two,3,30\n,Two,invalid,'
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.responses.splice(0);
  mocks.assertContribute.mockResolvedValue(undefined);
  mocks.assertManage.mockResolvedValue(undefined);
  mocks.assertRead.mockResolvedValue(undefined);
  mocks.canRead.mockResolvedValue(true);
  mocks.uploadBytes.mockResolvedValue(undefined);
  mocks.multiPoints.mockReturnValue([{ x: 'A', value: 1, series: null }]);
});

describe('dataset snapshot persistence', () => {
  it('updates a group dataset and reuses a ready snapshot', async () => {
    const existing = dataset({ group_id: 'group-1' });
    const updated = dataset({ group_id: 'group-1', title: 'Updated' });
    const ready = snapshot();
    queue([existing], [updated], [ready]);

    const result = await persistDatasetSnapshot(
      input({
        groupId: 'group-1',
        providerDatasetId: 'provider-dataset',
        providerResourceId: 'resource',
        title: 'Updated',
        description: 'Description',
        license: 'License',
        publisher: 'Publisher',
        language: 'de',
        sourceUrl: 'https://example.test',
        structureSummary: 'Explicit structure',
        dimensions: ['category'],
        timeCoverage: { start: '2020' },
        spatialCoverage: { countries: ['DE'] },
        topics: ['population'],
        metadata: { source: 'fixture' },
        ownerUserId: 'owner-1',
      })
    );

    expect(mocks.assertContribute).toHaveBeenCalledWith('user-1', 'group-1');
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      datasetId: 'dataset-1',
      snapshotId: 'snapshot-1',
      title: 'Updated',
      snapshotTakenAt: '2025-01-03T00:00:00.000Z',
      provenance: { source: 'fixture' },
    });
  });

  it('inserts a public dataset and uploads a new snapshot with defaults', async () => {
    const created = dataset();
    const createdSnapshot = snapshot();
    queue([], [created], [], [createdSnapshot]);

    await expect(persistDatasetSnapshot(input())).resolves.toMatchObject({
      datasetId: 'dataset-1',
      snapshotId: 'snapshot-1',
      columnProfiles: expect.any(Array),
    });
    expect(mocks.assertContribute).not.toHaveBeenCalled();
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      expect.stringMatching(/^dataset-1\/.+\.csv$/),
      expect.any(Uint8Array)
    );
    expect(mocks.sql.json).toHaveBeenCalled();
  });

  it('inserts a private group dataset when visibility is omitted', async () => {
    const created = dataset({ group_id: 'group-1', visibility: 'private' });
    queue([], [created], [snapshot()]);
    await expect(persistDatasetSnapshot(input({ groupId: 'group-1' }))).resolves.toMatchObject({
      datasetId: 'dataset-1',
    });
    expect(mocks.assertContribute).toHaveBeenCalledWith('user-1', 'group-1');
  });

  it('falls back to existing metadata and snapshot ids and validates missing writes', async () => {
    const existing = dataset();
    queue([existing], [], [snapshot({ snapshot_taken_at: 'invalid', column_profiles: null })]);
    await expect(persistDatasetSnapshot(input())).resolves.toMatchObject({
      datasetId: 'dataset-1',
      columnProfiles: [],
      snapshotTakenAt: expect.any(String),
    });

    queue([], []);
    await expect(persistDatasetSnapshot(input())).rejects.toThrow(
      'Dataset metadata could not be saved'
    );

    const failedSnapshot = snapshot({ id: 'failed-snapshot', status: 'failed' });
    queue([existing], [existing], [failedSnapshot], []);
    await expect(
      persistDatasetSnapshot(input({ snapshotTakenAt: '2025-02-01T00:00:00Z' }))
    ).rejects.toThrow('Dataset snapshot metadata could not be saved');
    expect(mocks.uploadBytes).toHaveBeenLastCalledWith(
      'dataset-1/failed-snapshot.csv',
      expect.any(Uint8Array)
    );
  });
});

describe('dataset and snapshot loading', () => {
  it('rejects absent datasets and maps sparse details without snapshots', async () => {
    queue([]);
    await expect(loadDatasetDetails('missing')).rejects.toThrow('Dataset not found');

    const sparse = dataset({
      dimensions: null,
      columns: null,
      column_profiles: null,
      updated_at: 'invalid',
      metadata: null,
    });
    queue([sparse], []);
    await expect(loadDatasetDetails('dataset-1')).resolves.toMatchObject({
      dimensions: [],
      columns: [],
      columnProfiles: [],
      snapshots: [],
      modified: null,
      formatSummary: undefined,
      snapshotId: null,
      rowCount: null,
      metadata: {},
    });
  });

  it('normalizes GovData metadata and maps the latest snapshot', async () => {
    const gov = dataset({
      provider: 'GOVDATA',
      title: '   ',
      description: 'Description &amp; details',
      publisher: 'Publisher',
      license: 'License',
      structure_summary: 'Structure',
      dimensions: ['region'],
      column_profiles: [{ name: 'value' }],
    });
    const latest = snapshot({ snapshot_taken_at: 'invalid', error: 'previous failure' });
    queue([gov], [latest]);
    const result = await loadDatasetDetails('dataset-1', 'user-1');
    expect(mocks.assertRead).toHaveBeenCalledWith('user-1', gov);
    expect(result).toMatchObject({
      title: '   ',
      description: 'Description & details',
      formatSummary: 'CSV',
      valueSummary: '4 rows · 4 columns',
      snapshotId: 'snapshot-1',
      snapshotTakenAt: null,
      rowCount: 4,
      byteSize: 100,
      snapshots: [{ error: 'previous failure', snapshotTakenAt: null }],
    });
  });

  it('rejects absent and pending snapshots and parses ready CSV', async () => {
    queue([]);
    await expect(loadSnapshotTable('missing')).rejects.toThrow('Dataset snapshot not found');

    queue([{ ...snapshot({ status: 'pending' }), dataset: dataset() }]);
    await expect(loadSnapshotTable('pending', 'user-1')).rejects.toThrow(
      'Dataset snapshot is not ready'
    );

    queueSnapshotLoad();
    await expect(loadSnapshotTable('snapshot-1', 'user-1')).resolves.toMatchObject({
      table: { columns: table.columns, rows: expect.any(Array) },
    });
    expect(mocks.assertRead).toHaveBeenLastCalledWith(
      'user-1',
      expect.objectContaining({ id: 'dataset-1' })
    );
  });
});

async function project(request: Record<string, unknown>, csv?: string) {
  queueSnapshotLoad();
  if (csv !== undefined) mocks.downloadText.mockResolvedValueOnce(csv);
  return createDatasetProjection({ snapshotId: 'snapshot-1', ...request } as never, 'user-1');
}

describe('dataset projections', () => {
  it('validates filters and supports legacy mappings with optional stats', async () => {
    await expect(project({ view: 'table', filters: { missing: 'x' } })).rejects.toThrow(
      'Unknown dataset column: missing'
    );

    await expect(
      project({
        mapping: { xColumn: 'category', valueColumn: 'value' },
        filters: { category: '', value: '2' },
      })
    ).resolves.toMatchObject({ rowCount: 1, stats: null });
    await expect(
      project(
        { mapping: { xColumn: 'category', valueColumn: 'value' }, statsColumn: 'value' },
        'category,value\nA,1\nB,2'
      )
    ).resolves.toMatchObject({ stats: expect.any(Object), columnCount: 2 });
  });

  it('projects table columns, numeric and text sorting, filtering and bounded limits', async () => {
    await expect(
      project(
        {
          view: 'table',
          columns: ['missing'],
          sort: { column: 'value', direction: 'desc' },
          limit: 0,
        },
        'category,series,value,other\nB,One,10,20\nA,One,2,invalid\nA,Two,3,30'
      )
    ).resolves.toMatchObject({
      columns: table.columns,
      rows: [{ category: 'B', series: 'One', value: '10', other: '20' }],
      rowCount: 3,
    });

    await expect(
      project(
        {
          view: 'table',
          columns: ['category', 'value'],
          sort: { column: 'category', direction: 'asc' },
          limit: 100,
        },
        'category,series,value,other\nB,One,10,20\nA,One,,invalid'
      )
    ).resolves.toMatchObject({
      columns: ['category', 'value'],
      rows: [
        { category: 'A', value: '' },
        { category: 'B', value: '10' },
      ],
    });

    await expect(
      project({ view: 'table', sort: { column: 'missing', direction: 'asc' } })
    ).resolves.toMatchObject({ rows: expect.any(Array) });
  });

  it('validates and computes count and numeric stat views', async () => {
    await expect(project({ view: 'stat', aggregation: 'sum' })).rejects.toThrow(
      'Choose a numeric measure'
    );
    await expect(
      project({ view: 'stat', aggregation: 'sum', measureColumn: 'missing' })
    ).rejects.toThrow('Choose a numeric measure');
    await expect(
      project(
        { view: 'stat', aggregation: 'sum', measureColumn: 'value' },
        'category,value\nA,invalid'
      )
    ).rejects.toThrow('No numeric values match the selected filters');
    await expect(project({ view: 'stat', aggregation: 'count' })).resolves.toMatchObject({
      label: 'Count',
      value: 4,
    });
    await expect(
      project({ view: 'stat', aggregation: 'sum', measureColumn: 'value' })
    ).resolves.toMatchObject({ label: 'value', value: 15 });
  });

  it('validates chart dimensions, series and multi-measure layouts', async () => {
    await expect(
      project({ view: 'chart', aggregation: 'count', dimensionColumn: null })
    ).rejects.toThrow('Choose a dimension');
    await expect(
      project({ view: 'chart', aggregation: 'count', dimensionColumn: 'missing' })
    ).rejects.toThrow('Choose a dimension');
    await expect(
      project({
        view: 'chart',
        aggregation: 'count',
        dimensionColumn: 'category',
        seriesColumn: 'missing',
      })
    ).rejects.toThrow('Unknown series column');
    await expect(
      project({ view: 'chart', layout: 'multi', aggregation: 'count', dimensionColumn: 'category' })
    ).rejects.toThrow('Choose at least one value column');

    mocks.multiPoints.mockReturnValueOnce([]);
    await expect(
      project({
        view: 'chart',
        layout: 'multi',
        aggregation: 'sum',
        measureColumn: 'value',
        dimensionColumn: 'category',
        valueColumns: ['missing', 'value'],
      })
    ).rejects.toThrow('No values match the selected configuration');

    mocks.multiPoints.mockReturnValueOnce(
      Array.from({ length: 5_001 }, (_, index) => ({ x: String(index), value: index }))
    );
    await expect(
      project({
        view: 'chart',
        layout: 'multi',
        aggregation: 'count',
        dimensionColumn: 'category',
        valueColumns: ['value'],
      })
    ).rejects.toThrow('The selected view contains too many points');

    await expect(
      project({
        view: 'chart',
        layout: 'multi',
        aggregation: 'count',
        dimensionColumn: 'category',
        valueColumns: ['value'],
      })
    ).resolves.toMatchObject({ view: 'chart', points: expect.any(Array) });
  });

  it('builds wide and long chart groups while skipping empty and nonnumeric cells', async () => {
    await expect(
      project({
        view: 'chart',
        layout: 'wide',
        aggregation: 'sum',
        measureColumn: 'value',
        dimensionColumn: 'category',
      })
    ).rejects.toThrow('Choose at least one value column');

    await expect(
      project({
        view: 'chart',
        layout: 'wide',
        aggregation: 'sum',
        measureColumn: 'value',
        dimensionColumn: 'category',
        valueColumns: ['value', 'other', 'missing'],
      })
    ).resolves.toMatchObject({
      view: 'chart',
      points: expect.arrayContaining([
        { x: 'value', series: 'A', value: 5 },
        { x: 'other', series: 'A', value: 30 },
      ]),
    });

    await expect(
      project({
        view: 'chart',
        layout: 'long',
        aggregation: 'sum',
        measureColumn: 'value',
        dimensionColumn: 'category',
        seriesColumn: 'series',
      })
    ).resolves.toMatchObject({
      points: expect.arrayContaining([{ x: 'A', series: 'One', value: 2 }]),
    });
    await expect(
      project({ view: 'chart', layout: 'long', aggregation: 'count', dimensionColumn: 'category' })
    ).resolves.toMatchObject({
      points: expect.arrayContaining([{ x: 'A', series: null, value: 2 }]),
    });

    await expect(
      project(
        {
          view: 'chart',
          layout: 'long',
          aggregation: 'sum',
          measureColumn: 'value',
          dimensionColumn: 'category',
        },
        'category,value\nA,invalid'
      )
    ).rejects.toThrow('No values match the selected configuration');
  });
});

describe('dataset value lookup, search and archive', () => {
  it('validates columns, filters and caps distinct values', async () => {
    queueSnapshotLoad();
    await expect(
      getDatasetColumnValues({ snapshotId: 'snapshot-1', column: 'missing' })
    ).rejects.toThrow('Dataset column not found');

    queueSnapshotLoad();
    await expect(
      getDatasetColumnValues({ snapshotId: 'snapshot-1', column: 'category', query: 'a', limit: 1 })
    ).resolves.toEqual(['A']);

    queueSnapshotLoad();
    await expect(
      getDatasetColumnValues({ snapshotId: 'snapshot-1', column: 'category', limit: 0 })
    ).resolves.toEqual(['B']);

    queueSnapshotLoad();
    await expect(
      getDatasetColumnValues({ snapshotId: 'snapshot-1', column: 'category', limit: 100 })
    ).resolves.toEqual(['A', 'B']);
  });

  it('normalizes provider filters and returns only readable stored datasets', async () => {
    mocks.canRead.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    queue([
      { ...dataset({ id: 'hidden' }), latest_snapshot: null },
      { ...dataset({ id: 'visible' }), latest_snapshot: snapshot() },
      { ...dataset({ id: 'after-limit' }), latest_snapshot: null },
    ]);
    await expect(
      searchStoredDatasets({
        query: ' 100%_data ',
        providers: [' upload ', 'invalid'],
        groupId: 'group-1',
        userId: 'user-1',
        limit: 1,
      })
    ).resolves.toMatchObject([{ id: 'visible', snapshotId: 'snapshot-1' }]);
    expect(mocks.canRead).toHaveBeenCalledTimes(2);

    queue([]);
    await expect(searchStoredDatasets({ query: 'x', providers: [], limit: 2 })).resolves.toEqual(
      []
    );
  });

  it('validates archive ownership and updates authorized group datasets', async () => {
    queue([]);
    await expect(archiveDataset('missing', 'user-1')).rejects.toThrow('Dataset not found');

    queue([dataset()]);
    await expect(archiveDataset('dataset-1', 'user-1')).rejects.toThrow(
      'Only group-owned datasets can be archived here'
    );

    queue([dataset({ group_id: 'group-1' })], []);
    await expect(archiveDataset('dataset-1', 'user-1')).resolves.toBeUndefined();
    expect(mocks.assertManage).toHaveBeenCalledWith('user-1', 'group-1');
  });
});
