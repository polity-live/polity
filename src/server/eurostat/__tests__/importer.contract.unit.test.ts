import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_EUROSTAT_DATASET_BYTES } from '@/features/charts/types';

const mocks = vi.hoisted(() => ({
  sqlResults: [] as unknown[],
  transactionResults: [] as unknown[],
  sql: null as any,
  transaction: null as any,
  buildPartitions: vi.fn(),
  readCsv: vi.fn(),
  dataUrl: vi.fn(() => new URL('https://ec.europa.eu/data')),
  fetch: vi.fn(),
}));

function consume(queue: unknown[]) {
  const result = queue.shift() ?? [];
  if (result instanceof Error) throw result;
  return Promise.resolve(result);
}

vi.mock('../db', () => {
  const transaction: any = vi.fn((first: unknown) => {
    if (Array.isArray(first) && 'raw' in first) return consume(mocks.transactionResults);
    return { rows: first };
  });
  const sql: any = vi.fn((first: unknown) => {
    if (Array.isArray(first) && 'raw' in first) return consume(mocks.sqlResults);
    return { rows: first };
  });
  sql.json = vi.fn((value: unknown) => value);
  sql.begin = vi.fn((callback: (tx: unknown) => unknown) => callback(transaction));
  mocks.sql = sql;
  mocks.transaction = transaction;
  return { eurostatSql: sql };
});
vi.mock('../partition', () => ({ buildEurostatPartitions: mocks.buildPartitions }));
vi.mock('../response', () => ({ readEurostatCsvResponse: mocks.readCsv }));
vi.mock('../metadata', () => ({ createEurostatDataUrl: mocks.dataUrl }));

import {
  createOrResumeEurostatImport,
  eurostatImporterContracts,
  processEurostatImportStep,
} from '../importer';

function dataset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dataset-1',
    code: 'demo_r_d3dens',
    status: 'importing',
    partition_count: 1,
    completed_partitions: 0,
    observation_count: 0,
    estimated_bytes: 100,
    actual_bytes: 0,
    error: null,
    dimensions: [{ id: 'geo' }, { id: 'TIME_PERIOD' }],
    ...overrides,
  };
}

function details(overrides: Record<string, unknown> = {}) {
  return {
    code: 'demo_r_d3dens',
    title: 'Population density',
    language: 'en',
    snapshotKey: 'snapshot-1',
    lastUpdate: '2026-01-01',
    structureLastChange: '2025-01-01',
    dataStart: '2020',
    dataEnd: '2026',
    valueCount: 10,
    estimatedBytes: 100,
    dimensions: [{ id: 'geo', values: [{ id: 'DE' }] }],
    attributes: [],
    importAllowed: true,
    ...overrides,
  } as any;
}

function partition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'partition-1',
    dataset_id: 'dataset-1',
    filters: { geo: ['DE'] },
    status: 'processing',
    async_request_id: null,
    ...overrides,
  };
}

function response(body: string, contentType = 'text/csv', status = 200) {
  return new Response(body, { status, headers: { 'content-type': contentType } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sqlResults = [];
  mocks.transactionResults = [];
  mocks.buildPartitions.mockReturnValue([
    { index: 0, filters: { geo: ['DE'] }, estimatedCells: 1 },
  ]);
  mocks.readCsv.mockResolvedValue('geo,TIME_PERIOD,OBS_VALUE,UNIT\nDE,2026,42,PC\n');
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
});

describe('Eurostat import creation and resume', () => {
  it('creates blocked imports without partitions', async () => {
    mocks.sqlResults = [[dataset({ status: 'blocked', error: 'too large' })]];
    await expect(
      createOrResumeEurostatImport(details({ importAllowed: false }), 'user-1')
    ).resolves.toMatchObject({ status: 'blocked', error: 'too large' });
    expect(mocks.buildPartitions).not.toHaveBeenCalled();
  });

  it('reports a snapshot that neither inserts nor exists', async () => {
    mocks.sqlResults = [[], []];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).rejects.toThrow(
      'Failed to create Eurostat snapshot'
    );
  });

  it('returns an existing non-error snapshot unchanged', async () => {
    mocks.sqlResults = [[], [dataset({ status: 'ready' })]];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).resolves.toMatchObject({
      status: 'ready',
    });
  });

  it('resumes an errored snapshot and tolerates an empty update response', async () => {
    mocks.sqlResults = [[], [dataset({ status: 'error', error: 'old failure' })], [], []];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).resolves.toMatchObject({
      status: 'error',
    });

    mocks.sqlResults = [
      [],
      [dataset({ status: 'error', error: 'old failure' })],
      [],
      [dataset({ status: 'importing', error: null })],
    ];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).resolves.toMatchObject({
      status: 'importing',
    });
  });

  it('marks a newly inserted snapshot with no importable partition', async () => {
    mocks.buildPartitions.mockReturnValue([]);
    mocks.sqlResults = [[dataset({ status: 'pending' })], []];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).resolves.toMatchObject({
      status: 'pending',
    });
  });

  it('creates deterministic partitions and uses both update return paths', async () => {
    mocks.sqlResults = [[dataset({ status: 'pending' })], [], []];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).resolves.toMatchObject({
      status: 'pending',
    });

    mocks.sqlResults = [
      [dataset({ status: 'pending' })],
      [],
      [dataset({ status: 'importing', partition_count: 1 })],
    ];
    await expect(createOrResumeEurostatImport(details(), 'user-1')).resolves.toMatchObject({
      status: 'importing',
      partitionCount: 1,
    });
  });
});

describe('Eurostat importer helpers', () => {
  it('normalizes progress numbers and claims optional partitions', async () => {
    expect(
      eurostatImporterContracts.toProgress(
        dataset({
          partition_count: '2',
          completed_partitions: '1',
          observation_count: '3',
          estimated_bytes: '4',
          actual_bytes: '5',
        }) as any
      )
    ).toMatchObject({
      partitionCount: 2,
      completedPartitions: 1,
      observationCount: 3,
      estimatedBytes: 4,
      actualBytes: 5,
    });
    mocks.sqlResults = [[], [partition()]];
    await expect(eurostatImporterContracts.claimNextPartition('dataset-1')).resolves.toBeNull();
    await expect(eurostatImporterContracts.claimNextPartition('dataset-1')).resolves.toMatchObject({
      id: 'partition-1',
    });
  });

  it('finds direct and deeply nested XML values safely', () => {
    expect(eurostatImporterContracts.findNestedValue(null, 'id')).toBeNull();
    expect(eurostatImporterContracts.findNestedValue('value', 'id')).toBeNull();
    expect(eurostatImporterContracts.findNestedValue({ id: 'direct' }, 'id')).toBe('direct');
    expect(
      eurostatImporterContracts.findNestedValue({ id: 4, wrapper: { id: 'nested' } }, 'id')
    ).toBe('nested');
    expect(eurostatImporterContracts.findNestedValue({ wrapper: { value: 1 } }, 'id')).toBeNull();
  });

  it('parses finite observations, dimensions, attributes, and sparse time values', () => {
    const rows = eurostatImporterContracts.parseObservations(
      [
        'geo,TIME_PERIOD,OBS_VALUE,UNIT,EMPTY',
        'DE,2026,42,PC,',
        'FR,,3.5,NR,',
        'IT,2026,not-a-number,PC,',
      ].join('\n'),
      'dataset-1',
      ['geo', 'TIME_PERIOD']
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ time_period: '2026', value: 42 });
    expect(rows[1]).toMatchObject({ time_period: '', value: 3.5 });
    expect(
      eurostatImporterContracts.parseObservations('geo,OBS_VALUE\nDE,1\n', 'dataset-1', [
        'geo',
        'missing',
      ])[0].time_period
    ).toBeNull();
  });

  it('reads optional datasets', async () => {
    mocks.sqlResults = [[], [dataset()]];
    await expect(eurostatImporterContracts.readDataset('dataset-1')).resolves.toBeNull();
    await expect(eurostatImporterContracts.readDataset('dataset-1')).resolves.toMatchObject({
      id: 'dataset-1',
    });
  });
});

describe('Eurostat synchronous and asynchronous responses', () => {
  it.each(['ERROR', 'EXPIRED', 'UNKNOWN_REQUEST'])(
    'rejects terminal async status %s',
    async status => {
      mocks.fetch.mockResolvedValue(
        response(`<root><status>${status}</status></root>`, 'text/xml')
      );
      await expect(
        eurostatImporterContracts.resolvePartitionResponse(
          partition({ async_request_id: 'request-1' }),
          'code'
        )
      ).rejects.toThrow(`Eurostat async request ended with ${status}`);
    }
  );

  it('waits for pending async work and downloads available data', async () => {
    mocks.fetch.mockResolvedValueOnce(
      response('<root><status>PROCESSING</status></root>', 'text/xml')
    );
    await expect(
      eurostatImporterContracts.resolvePartitionResponse(
        partition({ async_request_id: 'request-1' }),
        'code'
      )
    ).resolves.toBeNull();

    const dataResponse = response('csv');
    mocks.fetch
      .mockResolvedValueOnce(response('<root><status>AVAILABLE</status></root>', 'text/xml'))
      .mockResolvedValueOnce(dataResponse);
    await expect(
      eurostatImporterContracts.resolvePartitionResponse(
        partition({ async_request_id: 'request-1' }),
        'code'
      )
    ).resolves.toBe(dataResponse);
  });

  it.each(['SUBMITTED', 'PROCESSING'])(
    'stores a new async request with %s status',
    async status => {
      mocks.fetch.mockResolvedValue(
        response(`<root><id>request-2</id><status>${status}</status></root>`, 'application/xml')
      );
      mocks.sqlResults = [[]];
      await expect(
        eurostatImporterContracts.resolvePartitionResponse(partition(), 'code')
      ).resolves.toBeNull();
    }
  );

  it('returns CSV and reports XML faults and generic XML', async () => {
    const csv = response('csv', 'text/csv');
    mocks.fetch.mockResolvedValueOnce(csv);
    await expect(
      eurostatImporterContracts.resolvePartitionResponse(partition(), 'code')
    ).resolves.toBe(csv);

    const responseWithoutContentType = {
      headers: { get: () => null },
    } as unknown as Response;
    mocks.fetch.mockResolvedValueOnce(responseWithoutContentType);
    await expect(
      eurostatImporterContracts.resolvePartitionResponse(partition(), 'code')
    ).resolves.toBe(responseWithoutContentType);

    mocks.fetch.mockResolvedValueOnce(
      response('<root><faultstring>upstream fault</faultstring></root>', 'application/xml')
    );
    await expect(
      eurostatImporterContracts.resolvePartitionResponse(partition(), 'code')
    ).rejects.toThrow('upstream fault');

    mocks.fetch.mockResolvedValueOnce(response('<root><status>OTHER</status></root>', 'text/xml'));
    await expect(
      eurostatImporterContracts.resolvePartitionResponse(partition(), 'code')
    ).rejects.toThrow('Eurostat returned XML');
  });
});

describe('Eurostat import processing', () => {
  it('rejects missing snapshots and returns every terminal status', async () => {
    mocks.sqlResults = [[]];
    await expect(processEurostatImportStep('dataset-1')).rejects.toThrow(
      'Eurostat snapshot not found'
    );

    for (const status of ['ready', 'blocked', 'error']) {
      mocks.sqlResults = [[dataset({ status })]];
      await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({ status });
    }
  });

  it('marks exhausted partition sets ready and preserves incomplete sets', async () => {
    mocks.sqlResults = [[dataset()], [], [{ count: 1 }]];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'importing',
    });

    mocks.sqlResults = [
      [dataset()],
      [],
      [{ count: 0 }],
      [dataset({ status: 'ready', completed_partitions: 1 })],
    ];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'ready',
    });

    mocks.sqlResults = [[dataset()], [], [], []];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'importing',
    });
  });

  it('waits for async work and uses both refreshed-dataset fallbacks', async () => {
    mocks.fetch.mockImplementation(async () =>
      response('<root><status>PROCESSING</status></root>', 'application/xml')
    );
    mocks.sqlResults = [[dataset()], [partition({ async_request_id: 'request-1' })], []];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'importing',
    });

    mocks.sqlResults = [
      [dataset()],
      [partition({ async_request_id: 'request-1' })],
      [dataset({ completed_partitions: 1 })],
    ];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      completedPartitions: 1,
    });
  });

  it('imports observations transactionally', async () => {
    mocks.fetch.mockResolvedValue(response('csv'));
    mocks.sqlResults = [
      [dataset()],
      [partition()],
      [dataset({ status: 'ready', completed_partitions: 1, observation_count: 1 })],
    ];
    mocks.transactionResults = [[dataset()], [], [], []];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'ready',
      observationCount: 1,
    });
  });

  it('supports datasets without a dimension array and empty observation batches', async () => {
    mocks.fetch.mockResolvedValue(response('csv'));
    mocks.readCsv.mockResolvedValue('OBS_VALUE\nnot-a-number\n');
    mocks.sqlResults = [
      [dataset({ dimensions: null })],
      [partition()],
      [dataset({ status: 'ready', completed_partitions: 1 })],
    ];
    mocks.transactionResults = [[dataset()], [], []];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'ready',
    });
  });

  it('blocks snapshots that cross the measured byte limit', async () => {
    mocks.fetch.mockResolvedValue(response('csv'));
    mocks.sqlResults = [
      [dataset()],
      [partition()],
      [
        dataset({
          status: 'blocked',
          actual_bytes: MAX_EUROSTAT_DATASET_BYTES,
          error: 'Measured dataset size exceeds 100 MB',
        }),
      ],
    ];
    mocks.transactionResults = [
      [dataset({ actual_bytes: MAX_EUROSTAT_DATASET_BYTES })],
      [],
      [],
      [],
    ];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'blocked',
    });
  });

  it('records missing transaction snapshots and HTTP response failures', async () => {
    mocks.fetch.mockResolvedValueOnce(response('csv'));
    mocks.sqlResults = [
      [dataset()],
      [partition()],
      [],
      [],
      [dataset({ status: 'error', error: 'Eurostat snapshot disappeared' })],
    ];
    mocks.transactionResults = [[]];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'error',
    });

    mocks.fetch.mockResolvedValueOnce(response('failure', 'text/plain', 503));
    mocks.sqlResults = [[dataset()], [partition()], [], [], []];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'importing',
    });
  });

  it('records non-Error failures and falls back when the final reload is absent', async () => {
    mocks.fetch.mockResolvedValue(response('csv'));
    mocks.readCsv.mockRejectedValue('string failure');
    mocks.sqlResults = [[dataset()], [partition()], [], [], []];
    await expect(processEurostatImportStep('dataset-1')).resolves.toMatchObject({
      status: 'importing',
    });
  });
});
