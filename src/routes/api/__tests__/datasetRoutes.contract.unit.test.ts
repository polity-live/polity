import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  assertSize: vi.fn(),
  bytesToText: vi.fn(),
  createProjection: vi.fn(),
  getEurostatDetails: vi.fn(),
  getSession: vi.fn(),
  getValues: vi.fn(),
  importEurostat: vi.fn(),
  importGenesis: vi.fn(),
  importGovData: vi.fn(),
  loadDetails: vi.fn(),
  loadGroupName: vi.fn(),
  parseCsv: vi.fn(),
  persist: vi.fn(),
  projectionParse: vi.fn(),
  searchEurostat: vi.fn(),
  searchGovData: vi.fn(),
  searchProviders: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/datasets/access', () => ({
  loadDatasetContributionGroupName: mocks.loadGroupName,
}));
vi.mock('@/server/datasets/csv', () => ({ parseDatasetCsv: mocks.parseCsv }));
vi.mock('@/server/datasets/genesis', () => ({
  importGenesisDatasetSnapshot: mocks.importGenesis,
}));
vi.mock('@/server/datasets/projectionRequest', () => ({
  datasetProjectionRequestSchema: { parse: mocks.projectionParse },
}));
vi.mock('@/server/datasets/providers', () => ({
  importEurostatDatasetSnapshot: mocks.importEurostat,
  importGovDataDatasetSnapshot: mocks.importGovData,
  searchDatasetProviders: mocks.searchProviders,
}));
vi.mock('@/server/datasets/service', () => ({
  archiveDataset: mocks.archive,
  createDatasetProjection: mocks.createProjection,
  getDatasetColumnValues: mocks.getValues,
  loadDatasetDetails: mocks.loadDetails,
  persistDatasetSnapshot: mocks.persist,
}));
vi.mock('@/server/datasets/storage', () => ({
  assertDatasetSize: mocks.assertSize,
  bytesToText: mocks.bytesToText,
}));
vi.mock('@/server/eurostat/catalogue', () => ({
  searchEurostatCatalogue: mocks.searchEurostat,
}));
vi.mock('@/server/eurostat/metadata', () => ({
  getEurostatDatasetDetails: mocks.getEurostatDetails,
}));
vi.mock('@/server/govdata/catalogue', () => ({
  searchGovDataCatalogue: mocks.searchGovData,
}));

import { Route as ArchiveRoute } from '../datasets/archive';
import { Route as DetailsRoute } from '../datasets/$datasetId/details';
import { Route as ProjectionRoute } from '../datasets/$snapshotId/projection';
import { Route as ValuesRoute } from '../datasets/$snapshotId/values';
import { Route as SearchRoute } from '../datasets/search';
import { Route as SnapshotsRoute } from '../datasets/snapshots';
import { Route as UploadRoute } from '../datasets/upload';
import { Route as EurostatCatalogueRoute } from '../eurostat/catalogue';
import { Route as EurostatDetailsRoute } from '../eurostat/details';
import { Route as EurostatImportStepRoute } from '../eurostat/import-step';
import { Route as EurostatImportRoute } from '../eurostat/import';
import { Route as EurostatProjectionRoute } from '../eurostat/projection';
import { Route as GovDataCatalogueRoute } from '../govdata/catalogue';
import { Route as GovDataImportRoute } from '../govdata/import';

type Handler = (input: { request: Request; params?: Record<string, string> }) => Promise<Response>;

function handler(route: unknown, method: 'GET' | 'POST'): Handler {
  return (route as { server: { handlers: Record<string, Handler> } }).server.handlers[method];
}

const archive = handler(ArchiveRoute, 'POST');
const details = handler(DetailsRoute, 'GET');
const projection = handler(ProjectionRoute, 'POST');
const values = handler(ValuesRoute, 'GET');
const search = handler(SearchRoute, 'GET');
const snapshots = handler(SnapshotsRoute, 'POST');
const upload = handler(UploadRoute, 'POST');
const eurostatCatalogue = handler(EurostatCatalogueRoute, 'GET');
const eurostatDetails = handler(EurostatDetailsRoute, 'GET');
const eurostatImportStep = handler(EurostatImportStepRoute, 'POST');
const eurostatImport = handler(EurostatImportRoute, 'POST');
const eurostatProjection = handler(EurostatProjectionRoute, 'POST');
const govDataCatalogue = handler(GovDataCatalogueRoute, 'GET');
const govDataImport = handler(GovDataImportRoute, 'POST');

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function uuid(suffix: number) {
  return `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.bytesToText.mockReturnValue('a,b\n1,2');
  mocks.parseCsv.mockReturnValue({ columns: ['a', 'b'], rows: [['1', '2']] });
  mocks.loadGroupName.mockResolvedValue('Civic Group');
  mocks.persist.mockResolvedValue({ datasetId: 'dataset-1' });
  mocks.searchProviders.mockResolvedValue({ results: [{ id: 'dataset-1' }], status: 'ok' });
  mocks.importEurostat.mockResolvedValue({ datasetId: 'euro-1', rowCount: 7, byteSize: 70 });
  mocks.importGovData.mockResolvedValue({ datasetId: 'gov-1' });
  mocks.importGenesis.mockResolvedValue({ datasetId: 'genesis-1' });
  mocks.archive.mockResolvedValue(undefined);
  mocks.loadDetails.mockResolvedValue({ snapshots: [{ id: 'snapshot-1', status: 'ready' }] });
  mocks.projectionParse.mockReturnValue({ filters: {}, mapping: { xColumn: 'year' } });
  mocks.createProjection.mockResolvedValue({ snapshotId: 'snapshot-1', points: [] });
  mocks.getValues.mockResolvedValue(['A']);
  mocks.searchEurostat.mockResolvedValue([{ code: 'demo' }]);
  mocks.getEurostatDetails.mockResolvedValue({
    code: 'demo',
    language: 'en',
    estimatedBytes: 100,
  });
  mocks.searchGovData.mockResolvedValue([{ id: 'package-1' }]);
});

afterEach(() => errorSpy.mockRestore());

describe('dataset upload route', () => {
  it('rejects anonymous, missing-file and missing-group uploads', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await upload({
      request: new Request('http://localhost/api/datasets/upload', { method: 'POST' }),
    });
    expect(response.status).toBe(401);

    response = await upload({
      request: new Request('http://localhost/api/datasets/upload', {
        method: 'POST',
        body: new FormData(),
      }),
    });
    expect(response.status).toBe(400);

    const form = new FormData();
    form.set('file', new File(['a'], 'data.csv'));
    response = await upload({
      request: new Request('http://localhost/api/datasets/upload', {
        method: 'POST',
        body: form,
      }),
    });
    expect(response.status).toBe(400);
  });

  it.each([
    { title: '', description: '', type: '', expectedTitle: 'data.csv', expectedDescription: null },
    {
      title: '  Dataset title  ',
      description: '  Description  ',
      type: 'text/csv',
      expectedTitle: 'Dataset title',
      expectedDescription: 'Description',
    },
  ])('persists a valid upload with normalized metadata', async sample => {
    const form = new FormData();
    form.set('file', new File(['a,b\n1,2'], 'data.csv', { type: sample.type }));
    form.set('groupId', '  group-1  ');
    if (sample.title) form.set('title', sample.title);
    if (sample.description) form.set('description', sample.description);
    const request = sample.type
      ? new Request('http://localhost/api/datasets/upload', {
          method: 'POST',
          body: form,
        })
      : ({ formData: async () => form } as Request);
    const response = await upload({ request });
    expect(response.status).toBe(200);
    expect(mocks.assertSize).toHaveBeenCalledTimes(2);
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        title: sample.expectedTitle,
        description: sample.expectedDescription,
        groupId: 'group-1',
        createdById: 'user-1',
        metadata: expect.objectContaining({ fileType: sample.type || null }),
      })
    );
  });

  it('maps upload processing failures to 400', async () => {
    mocks.assertSize.mockImplementation(() => {
      throw new Error('too large');
    });
    const form = new FormData();
    form.set('file', new File(['a'], 'data.csv'));
    form.set('groupId', 'group-1');
    const response = await upload({
      request: new Request('http://localhost/api/datasets/upload', {
        method: 'POST',
        body: form,
      }),
    });
    expect(response.status).toBe(400);
  });
});

describe('dataset search and read routes', () => {
  it('uses defaults and optionally returns provider status', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await search({ request: new Request('http://localhost/api/datasets/search') });
    await expect(response.json()).resolves.toEqual([{ id: 'dataset-1' }]);
    expect(mocks.searchProviders).toHaveBeenLastCalledWith({
      query: '',
      providers: [],
      groupId: null,
      userId: undefined,
      language: 'en',
      includeExternal: false,
    });

    response = await search({
      request: new Request(
        'http://localhost/api/datasets/search?q=climate&providers=EUROSTAT,%20,GOVDATA&groupId=g1&lang=de&includeExternal=true&withStatus=true'
      ),
    });
    await expect(response.json()).resolves.toEqual({
      results: [{ id: 'dataset-1' }],
      status: 'ok',
    });
    expect(mocks.searchProviders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        providers: ['EUROSTAT', 'GOVDATA'],
        userId: 'user-1',
        includeExternal: true,
      })
    );
  });

  it('maps provider search errors to 502', async () => {
    mocks.searchProviders.mockRejectedValue(new Error('offline'));
    const response = await search({ request: new Request('http://localhost/api/datasets/search') });
    expect(response.status).toBe(502);
  });

  it('loads public details and distinguishes denied from missing failures', async () => {
    mocks.getSession.mockResolvedValueOnce({});
    let response = await details({
      request: new Request('http://localhost/api/datasets/dataset-1/details'),
      params: { datasetId: 'dataset-1' },
    });
    expect(response.status).toBe(200);
    expect(mocks.loadDetails).toHaveBeenCalledWith('dataset-1', undefined);

    for (const [failure, status] of [
      [new Error('access denied'), 403],
      [new Error('missing'), 404],
      ['primitive', 404],
    ] as const) {
      mocks.loadDetails.mockRejectedValueOnce(failure);
      response = await details({
        request: new Request('http://localhost/api/datasets/dataset-1/details'),
        params: { datasetId: 'dataset-1' },
      });
      expect(response.status).toBe(status);
    }
  });

  it('validates and loads distinct dataset column values', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await values({
      request: new Request('http://localhost/api/datasets/snapshot-1/values'),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(401);

    response = await values({
      request: new Request('http://localhost/api/datasets/snapshot-1/values?column=%20'),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(400);

    response = await values({
      request: new Request('http://localhost/api/datasets/snapshot-1/values?column=region'),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(200);
    expect(mocks.getValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '', limit: 50 })
    );

    response = await values({
      request: new Request(
        'http://localhost/api/datasets/snapshot-1/values?column=region&q=berlin&limit=5'
      ),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(200);
    expect(mocks.getValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'berlin', limit: 5 })
    );

    mocks.getValues.mockRejectedValueOnce(new Error('bad column'));
    response = await values({
      request: new Request('http://localhost/api/datasets/snapshot-1/values?column=region'),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(400);
  });
});

describe('dataset mutation routes', () => {
  it.each([
    ['EUROSTAT', { provider: 'EUROSTAT', code: 'demo' }, mocks.importEurostat, 'euro-1'],
    [
      'GOVDATA',
      { provider: 'GOVDATA', packageId: 'package-1', resourceId: 'resource-1' },
      mocks.importGovData,
      'gov-1',
    ],
    [
      'GENESIS_DESTATIS',
      { provider: 'GENESIS_DESTATIS', code: 'table-1' },
      mocks.importGenesis,
      'genesis-1',
    ],
  ] as const)('imports %s snapshots', async (_provider, body, importer, datasetId) => {
    const response = await snapshots({
      request: jsonRequest('http://localhost/api/datasets/snapshots', body),
    });
    expect(response.status).toBe(200);
    expect(importer).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ datasetId });
  });

  it('guards and validates snapshot imports, then maps provider failures', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await snapshots({
      request: jsonRequest('http://localhost/api/datasets/snapshots', {}),
    });
    expect(response.status).toBe(401);

    response = await snapshots({
      request: jsonRequest('http://localhost/api/datasets/snapshots', {}),
    });
    expect(response.status).toBe(400);

    mocks.importEurostat.mockRejectedValueOnce(new Error('provider failed'));
    response = await snapshots({
      request: jsonRequest('http://localhost/api/datasets/snapshots', {
        provider: 'EUROSTAT',
        code: 'demo',
      }),
    });
    expect(response.status).toBe(500);
  });

  it('archives datasets with authentication and structured errors', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await archive({
      request: jsonRequest('http://localhost/api/datasets/archive', { datasetId: uuid(1) }),
    });
    expect(response.status).toBe(401);

    response = await archive({
      request: jsonRequest('http://localhost/api/datasets/archive', { datasetId: 'invalid' }),
    });
    expect(response.status).toBe(400);

    response = await archive({
      request: jsonRequest('http://localhost/api/datasets/archive', { datasetId: uuid(1) }),
    });
    expect(response.status).toBe(200);

    mocks.archive.mockRejectedValueOnce(new Error('forbidden'));
    response = await archive({
      request: jsonRequest('http://localhost/api/datasets/archive', { datasetId: uuid(1) }),
    });
    expect(response.status).toBe(403);
  });

  it('creates projections and distinguishes validation from domain failures', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await projection({
      request: jsonRequest('http://localhost/api/datasets/snapshot-1/projection', {}),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(401);

    response = await projection({
      request: jsonRequest('http://localhost/api/datasets/snapshot-1/projection', { x: 1 }),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(200);
    expect(mocks.createProjection).toHaveBeenCalledWith(
      { snapshotId: 'snapshot-1', filters: {}, mapping: { xColumn: 'year' } },
      'user-1'
    );

    const { z } = await import('zod');
    mocks.projectionParse.mockImplementationOnce(() => {
      throw new z.ZodError([]);
    });
    response = await projection({
      request: jsonRequest('http://localhost/api/datasets/snapshot-1/projection', {}),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(400);

    mocks.projectionParse.mockImplementationOnce(() => {
      throw new Error('not projectable');
    });
    response = await projection({
      request: jsonRequest('http://localhost/api/datasets/snapshot-1/projection', {}),
      params: { snapshotId: 'snapshot-1' },
    });
    expect(response.status).toBe(422);
  });
});

describe('Eurostat and GovData compatibility routes', () => {
  it('searches catalogues with defaults, explicit parameters and upstream errors', async () => {
    let response = await eurostatCatalogue({
      request: new Request('http://localhost/api/eurostat/catalogue'),
    });
    expect(response.status).toBe(200);
    expect(mocks.searchEurostat).toHaveBeenLastCalledWith('', 'en', 20);
    await eurostatCatalogue({
      request: new Request('http://localhost/api/eurostat/catalogue?q=jobs&lang=de'),
    });
    expect(mocks.searchEurostat).toHaveBeenLastCalledWith('jobs', 'de', 20);
    mocks.searchEurostat.mockRejectedValueOnce(new Error('offline'));
    response = await eurostatCatalogue({
      request: new Request('http://localhost/api/eurostat/catalogue'),
    });
    expect(response.status).toBe(502);

    await govDataCatalogue({
      request: new Request('http://localhost/api/govdata/catalogue'),
    });
    expect(mocks.searchGovData).toHaveBeenLastCalledWith('', 20);
    await govDataCatalogue({
      request: new Request('http://localhost/api/govdata/catalogue?q=roads'),
    });
    expect(mocks.searchGovData).toHaveBeenLastCalledWith('roads', 20);
    mocks.searchGovData.mockRejectedValueOnce(new Error('offline'));
    response = await govDataCatalogue({
      request: new Request('http://localhost/api/govdata/catalogue'),
    });
    expect(response.status).toBe(502);
  });

  it('validates and loads Eurostat details', async () => {
    let response = await eurostatDetails({
      request: new Request('http://localhost/api/eurostat/details'),
    });
    expect(response.status).toBe(400);
    response = await eurostatDetails({
      request: new Request('http://localhost/api/eurostat/details?code=%20'),
    });
    expect(response.status).toBe(400);
    await eurostatDetails({
      request: new Request('http://localhost/api/eurostat/details?code=demo'),
    });
    expect(mocks.getEurostatDetails).toHaveBeenLastCalledWith('demo', 'en');
    await eurostatDetails({
      request: new Request('http://localhost/api/eurostat/details?code=demo&lang=de'),
    });
    expect(mocks.getEurostatDetails).toHaveBeenLastCalledWith('demo', 'de');
    mocks.getEurostatDetails.mockRejectedValueOnce(new Error('offline'));
    response = await eurostatDetails({
      request: new Request('http://localhost/api/eurostat/details?code=demo'),
    });
    expect(response.status).toBe(502);
  });

  it('reports import-step defaults and snapshot progress', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await eurostatImportStep({
      request: jsonRequest('http://localhost/api/eurostat/import-step', { datasetId: uuid(1) }),
    });
    expect(response.status).toBe(401);
    response = await eurostatImportStep({
      request: jsonRequest('http://localhost/api/eurostat/import-step', { datasetId: 'invalid' }),
    });
    expect(response.status).toBe(400);

    mocks.loadDetails.mockResolvedValueOnce({ snapshots: [] });
    response = await eurostatImportStep({
      request: jsonRequest('http://localhost/api/eurostat/import-step', { datasetId: uuid(1) }),
    });
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      completedPartitions: 0,
      observationCount: 0,
      estimatedBytes: 0,
      actualBytes: 0,
      error: null,
    });

    mocks.loadDetails.mockResolvedValueOnce({
      snapshots: [{ status: 'ready', rowCount: 3, byteSize: 30, error: 'failed once' }],
    });
    response = await eurostatImportStep({
      request: jsonRequest('http://localhost/api/eurostat/import-step', { datasetId: uuid(1) }),
    });
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      completedPartitions: 1,
      observationCount: 3,
      estimatedBytes: 30,
      actualBytes: 30,
      error: expect.any(Object),
    });

    mocks.loadDetails.mockRejectedValueOnce(new Error('database failed'));
    response = await eurostatImportStep({
      request: jsonRequest('http://localhost/api/eurostat/import-step', { datasetId: uuid(1) }),
    });
    expect(response.status).toBe(500);
  });

  it.each([
    ['eurostat', eurostatImport, { code: 'demo' }],
    ['govdata', govDataImport, { packageId: 'package-1', resourceId: 'resource-1' }],
  ] as const)('guards, validates, imports and maps %s failures', async (_name, route, body) => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await route({
      request: jsonRequest('http://localhost/api/import', body),
    });
    expect(response.status).toBe(401);
    response = await route({
      request: jsonRequest('http://localhost/api/import', {}),
    });
    expect(response.status).toBe(400);
    response = await route({
      request: jsonRequest('http://localhost/api/import', body),
    });
    expect(response.status).toBe(200);

    const failingMock = route === eurostatImport ? mocks.getEurostatDetails : mocks.importGovData;
    failingMock.mockRejectedValueOnce(new Error('import failed'));
    response = await route({
      request: jsonRequest('http://localhost/api/import', body),
    });
    expect(response.status).toBe(500);
  });

  it('projects with explicit or latest snapshots and handles missing data', async () => {
    const base = {
      datasetId: uuid(1),
      filters: {},
      xDimension: 'year',
    };
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await eurostatProjection({
      request: jsonRequest('http://localhost/api/eurostat/projection', base),
    });
    expect(response.status).toBe(401);
    response = await eurostatProjection({
      request: jsonRequest('http://localhost/api/eurostat/projection', {}),
    });
    expect(response.status).toBe(400);

    response = await eurostatProjection({
      request: jsonRequest('http://localhost/api/eurostat/projection', {
        ...base,
        snapshotId: uuid(2),
        valueField: 'value',
        seriesDimension: 'region',
      }),
    });
    expect(response.status).toBe(200);
    expect(mocks.loadDetails).not.toHaveBeenCalled();
    expect(mocks.createProjection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshotId: uuid(2),
        mapping: expect.objectContaining({ valueColumn: 'value', seriesColumn: 'region' }),
      }),
      'user-1'
    );

    response = await eurostatProjection({
      request: jsonRequest('http://localhost/api/eurostat/projection', base),
    });
    expect(response.status).toBe(200);
    expect(mocks.createProjection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshotId: 'snapshot-1',
        mapping: expect.objectContaining({ valueColumn: 'OBS_VALUE', seriesColumn: null }),
      }),
      'user-1'
    );

    mocks.loadDetails.mockResolvedValueOnce({ snapshots: [] });
    response = await eurostatProjection({
      request: jsonRequest('http://localhost/api/eurostat/projection', base),
    });
    expect(response.status).toBe(404);

    mocks.loadDetails.mockRejectedValueOnce(new Error('database failed'));
    response = await eurostatProjection({
      request: jsonRequest('http://localhost/api/eurostat/projection', base),
    });
    expect(response.status).toBe(500);
  });
});
