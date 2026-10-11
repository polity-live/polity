import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeDatasetText } from '../text';
import { clearDatasetSearchCache } from '../searchRuntime';
import type { PersistDatasetSnapshotInput } from '../service';
import type { EurostatDimension } from '@/features/charts/types';

const mocks = vi.hoisted(() => ({
  searchEurostat: vi.fn(),
  eurostatDetails: vi.fn(),
  eurostatUrl: vi.fn(),
  isGovCsv: vi.fn(),
  loadGovPackage: vi.fn(),
  normalizeGovText: vi.fn((value: unknown) => (typeof value === 'string' ? value.trim() : '')),
  searchGovData: vi.fn(),
  assertSafeUrl: vi.fn((value: string) => new URL(value)),
  parseCsv: vi.fn(),
  searchGenesis: vi.fn(),
  genesisMetadata: vi.fn(),
  persist: vi.fn(),
  searchStored: vi.fn(),
  readBytes: vi.fn(),
  bytesToText: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/server/eurostat/catalogue', () => ({ searchEurostatCatalogue: mocks.searchEurostat }));
vi.mock('@/server/eurostat/metadata', () => ({
  createEurostatDataUrl: mocks.eurostatUrl,
  getEurostatDatasetMetadata: mocks.eurostatDetails,
}));
vi.mock('@/server/govdata/catalogue', () => ({
  isGovDataCsvResource: mocks.isGovCsv,
  loadGovDataPackage: mocks.loadGovPackage,
  normalizeGovDataText: mocks.normalizeGovText,
  searchGovDataCatalogue: mocks.searchGovData,
}));
vi.mock('@/server/govdata/safety', () => ({ assertSafePublicHttpUrl: mocks.assertSafeUrl }));
vi.mock('../csv', async importOriginal => ({
  ...(await importOriginal<typeof import('../csv')>()),
  parseDatasetCsv: mocks.parseCsv,
}));
vi.mock('../genesis', async importOriginal => ({
  ...(await importOriginal<typeof import('../genesis')>()),
  searchGenesisDatasets: mocks.searchGenesis,
  getGenesisTableMetadata: mocks.genesisMetadata,
}));
vi.mock('../service', () => ({
  persistDatasetSnapshot: mocks.persist,
  searchStoredDatasets: mocks.searchStored,
}));
vi.mock('../storage', () => ({
  bytesToText: mocks.bytesToText,
  readLimitedResponseBytes: mocks.readBytes,
}));

import {
  getDatasetSearchQueries,
  getGovDataSearchQueries,
  importEurostatDatasetSnapshot,
  importGovDataDatasetSnapshot,
  searchDatasetProviders,
  prepareEurostatDataset,
} from '../providers';

const table = { columns: ['time', 'value'], rows: [{ time: '2024', value: '1' }] };

function response({
  ok = true,
  status = 200,
  contentDisposition = null,
  contentType = null,
}: {
  ok?: boolean;
  status?: number;
  contentDisposition?: string | null;
  contentType?: string | null;
} = {}) {
  return {
    ok,
    status,
    headers: {
      get: vi.fn((name: string) =>
        name.toLowerCase() === 'content-disposition'
          ? contentDisposition
          : name.toLowerCase() === 'content-type'
            ? contentType
            : null
      ),
    },
  } as unknown as Response;
}

function govPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'package-1',
    name: 'package-name',
    title: 'Package title',
    notes: 'Description',
    maintainer: 'Maintainer',
    license_title: 'License',
    modified: '2025-01-01',
    organization: { title: 'Organization' },
    extras: [{ key: 'publisher_name', value: 'Publisher' }],
    resources: [
      {
        id: 'resource-1',
        name: 'Resource',
        download_url: 'https://data.example/file.csv',
        modified: '2025-02-01',
      },
    ],
    ...overrides,
  };
}

function eurostatDetails(overrides: Record<string, unknown> = {}) {
  return {
    code: 'demo_r_d3dens',
    title: 'Population density',
    language: 'en',
    importAllowed: true,
    estimatedBytes: 100,
    dimensions: [{ id: 'geo', label: 'Geo', values: [] }],
    dataStart: '2020',
    dataEnd: '2025',
    snapshotKey: 'snapshot-1',
    lastUpdate: '2025-03-01',
    structureLastChange: '2025-02-01',
    attributes: [],
    valueCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  clearDatasetSearchCache();
  mocks.bytesToText.mockImplementation(decodeDatasetText);
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.loadGovPackage.mockResolvedValue(govPackage());
  mocks.isGovCsv.mockReturnValue(true);
  mocks.fetch.mockResolvedValue(response());
  mocks.readBytes.mockResolvedValue(new TextEncoder().encode('time,value\n2024,1'));
  mocks.parseCsv.mockReturnValue(table);
  mocks.persist.mockImplementation(async value => value);
  mocks.eurostatDetails.mockResolvedValue(eurostatDetails());
  mocks.eurostatUrl.mockReturnValue('https://ec.europa.eu/data.csv');
  mocks.searchStored.mockResolvedValue([]);
  mocks.searchEurostat.mockResolvedValue([]);
  mocks.searchGovData.mockResolvedValue([]);
  mocks.searchGenesis.mockResolvedValue([]);
});

describe('dataset query concepts', () => {
  it.each([
    [' Arbeitslosigkeit ', ['Arbeitslosigkeit', 'Arbeitslose', 'unemployment']],
    ['Bevoelkerung', ['Bevoelkerung', 'Bevölkerung', 'population']],
    ['x', []],
    ['custom query', ['custom query']],
  ])('expands %j without duplicates and discards short queries', (query, expected) => {
    expect(getDatasetSearchQueries(query)).toEqual(expected);
  });
});

describe('GovData snapshot import', () => {
  it.each([null, 'text/csv; charset=windows-1252'])(
    'decodes legacy CSVs with content type %s',
    async contentType => {
      const csv = 'Veränderung;Stadt\n42;Düsseldorf';
      mocks.readBytes.mockResolvedValue(Uint8Array.from(Buffer.from(csv, 'latin1')));
      mocks.fetch.mockResolvedValue(response({ contentType }));
      await importGovDataDatasetSnapshot({
        packageId: 'package-1',
        resourceId: 'resource-1',
        userId: 'u1',
      });
      expect(mocks.parseCsv).toHaveBeenCalledWith(csv);
    }
  );
  it('rejects missing and non-CSV resources', async () => {
    mocks.loadGovPackage.mockResolvedValueOnce(govPackage({ resources: [] }));
    await expect(
      importGovDataDatasetSnapshot({ packageId: 'package-1', resourceId: 'missing', userId: 'u1' })
    ).rejects.toThrow('GovData resource was not found');

    mocks.loadGovPackage.mockResolvedValueOnce(govPackage({ resources: undefined }));
    await expect(
      importGovDataDatasetSnapshot({ packageId: 'package-1', resourceId: 'missing', userId: 'u1' })
    ).rejects.toThrow('GovData resource was not found');

    mocks.isGovCsv.mockReturnValueOnce(false);
    await expect(
      importGovDataDatasetSnapshot({
        packageId: 'package-1',
        resourceId: 'resource-1',
        userId: 'u1',
      })
    ).rejects.toThrow('GovData resource is not an importable CSV');
  });

  it('uses download, direct and access URL fallbacks and reports HTTP failures', async () => {
    mocks.fetch.mockResolvedValueOnce(response({ ok: false, status: 403 }));
    await expect(
      importGovDataDatasetSnapshot({
        packageId: 'package-1',
        resourceId: 'resource-1',
        userId: 'u1',
      })
    ).rejects.toThrow('GovData resource download failed with 403');

    mocks.loadGovPackage.mockResolvedValueOnce(
      govPackage({ resources: [{ id: 'resource-1', url: 'https://data.example/direct.csv' }] })
    );
    await importGovDataDatasetSnapshot({
      packageId: 'package-1',
      resourceId: 'resource-1',
      userId: 'u1',
    });
    expect(mocks.assertSafeUrl).toHaveBeenLastCalledWith('https://data.example/direct.csv');

    mocks.loadGovPackage.mockResolvedValueOnce(
      govPackage({
        resources: [{ id: 'resource-1', access_url: 'https://data.example/access.csv' }],
      })
    );
    await importGovDataDatasetSnapshot({
      packageId: 'package-1',
      resourceId: 'resource-1',
      userId: 'u1',
    });
    expect(mocks.assertSafeUrl).toHaveBeenLastCalledWith('https://data.example/access.csv');
  });

  it('persists rich metadata and parses the limited response', async () => {
    const result = await importGovDataDatasetSnapshot({
      packageId: 'package-1',
      resourceId: 'resource-1',
      userId: 'u1',
    });
    expect(mocks.fetch).toHaveBeenCalledWith(new URL('https://data.example/file.csv'), {
      headers: { Accept: 'text/csv,application/csv,text/plain;q=0.9,*/*;q=0.1' },
    });
    expect(mocks.readBytes).toHaveBeenCalledWith(expect.anything(), 'GovData resource');
    expect(result).toMatchObject({
      provider: 'GOVDATA',
      providerDatasetId: 'package-1',
      providerResourceId: 'resource-1',
      title: 'Package title',
      publisher: 'Publisher',
      snapshotTakenAt: '2025-02-01',
      createdById: 'u1',
      table,
      metadata: { organizationTitle: 'Organization', resourceName: 'Resource' },
    });
  });

  it('applies sparse metadata fallbacks', async () => {
    mocks.loadGovPackage.mockResolvedValue(
      govPackage({
        id: null,
        name: '',
        title: '',
        notes: null,
        maintainer: '',
        license_title: '',
        modified: null,
        metadata_modified: '2024-01-01',
        organization: { name: 'Org fallback' },
        extras: undefined,
        resources: [
          {
            id: 'resource-1',
            name: '',
            access_url: 'https://data.example/access.csv',
            metadata_modified: '2024-02-01',
          },
        ],
      })
    );
    const result = await importGovDataDatasetSnapshot({
      packageId: 'package-1',
      resourceId: 'resource-1',
      userId: 'u1',
    });
    expect(result).toMatchObject({
      title: 'GovData dataset',
      description: null,
      publisher: 'Org fallback',
      license: null,
      snapshotTakenAt: '2024-02-01',
      metadata: { packageId: '', packageName: '', resourceName: 'CSV resource' },
    });
  });
});

describe('Eurostat snapshot import', () => {
  it('prepares labelled geography, code fallbacks and selectors without downloading observations', async () => {
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({
        dimensions: [
          { id: 'geo', label: 'Countries', values: [{ id: 'DE', label: 'Germany' }, { id: 'FR' }] },
          { id: 'TIME_PERIOD', label: 'Year', values: [{ id: '2025' }] },
        ],
      })
    );
    expect(await prepareEurostatDataset('POP', 'en')).toMatchObject({
      geoDimension: 'geo',
      timeDimension: 'TIME_PERIOD',
      spatialCoverage: ['Germany', 'FR'],
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('imports scoped SDMX observations with the correct column roles and actual dimensions', async () => {
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({
        dimensions: [
          { id: 'geo', label: 'Countries', values: [{ id: 'DE', label: 'Germany' }, { id: 'FR' }] },
          { id: 'TIME_PERIOD', label: 'Year', values: [{ id: '2025' }, { id: '2024' }] },
          { id: 'unit', label: 'Unit', values: [{ id: 'NR' }] },
          { id: 'missing', label: 'Absent', values: [{ id: 'X' }] },
        ],
      })
    );
    mocks.parseCsv.mockReturnValue({
      columns: ['geo', 'TIME_PERIOD', 'unit', 'OBS_VALUE', 'OBS_FLAG'],
      rows: [{ geo: 'DE', TIME_PERIOD: '2025', unit: 'NR', OBS_VALUE: '42', OBS_FLAG: 'p' }],
    });
    const result = await importEurostatDatasetSnapshot({
      code: 'POP',
      language: 'en',
      userId: 'u1',
      filters: { area: 'Germany', period: { start: 2025, end: 2025 } },
    });
    expect(result.columnProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'geo', role: 'geo', label: 'Countries' }),
        expect.objectContaining({ name: 'TIME_PERIOD', role: 'time', type: 'date' }),
        expect.objectContaining({ name: 'unit', role: 'dimension', type: 'category' }),
        expect.objectContaining({ name: 'OBS_VALUE', role: 'measure', type: 'number' }),
        expect.objectContaining({ name: 'OBS_FLAG', role: 'label' }),
      ])
    );
    const saved = mocks.persist.mock.lastCall?.[0] as PersistDatasetSnapshotInput;
    expect((saved.dimensions as EurostatDimension[]).map(item => item.id)).toEqual([
      'geo',
      'TIME_PERIOD',
      'unit',
    ]);
    expect(saved.spatialCoverage).toEqual(['Germany']);
    expect(saved.timeCoverage).toEqual({ start: '2025', end: '2025' });
    expect((saved.dimensions as EurostatDimension[])[0].values).toEqual([
      { id: 'DE', label: 'Germany' },
    ]);
  });
  it('falls back to geography codes when labels are absent', async () => {
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({ estimatedBytes: null, dimensions: [{ id: 'geo', values: [{ id: 'FR' }] }] })
    );
    mocks.parseCsv.mockReturnValue({
      columns: ['geo', 'OBS_VALUE'],
      rows: [{ geo: 'FR', OBS_VALUE: '2' }],
    });
    await importEurostatDatasetSnapshot({ code: 'POP', language: 'en', userId: 'u1' });
    const saved = mocks.persist.mock.lastCall?.[0] as PersistDatasetSnapshotInput;
    expect(saved.spatialCoverage).toEqual(['FR']);
  });
  it('rejects empty observations and provider responses that ignore selected dimension filters', async () => {
    mocks.parseCsv.mockReturnValueOnce({ columns: ['OBS_VALUE'], rows: [] });
    await expect(
      importEurostatDatasetSnapshot({ code: 'POP', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'invalid_scope', httpStatus: 422 });
    clearDatasetSearchCache();
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({ dimensions: [{ id: 'geo', values: [{ id: 'DE' }] }] })
    );
    mocks.parseCsv.mockReturnValue({
      columns: ['geo', 'OBS_VALUE'],
      rows: [{ geo: 'FR', OBS_VALUE: '2' }],
    });
    await expect(
      importEurostatDatasetSnapshot({
        code: 'POP',
        language: 'en',
        userId: 'u1',
        filters: { dimensions: { geo: 'DE' } },
      })
    ).rejects.toMatchObject({ code: 'invalid_scope', httpStatus: 422 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it.each(['metadata', 'fetch', 'body'])(
    'preserves cancellation during the %s import phase',
    async phase => {
      const controller = new AbortController();
      const reason = new Error('caller cancelled');
      if (phase === 'metadata')
        mocks.eurostatDetails.mockImplementation(async (_code, _language, innerSignal) => {
          controller.abort(reason);
          throw innerSignal.reason;
        });
      else if (phase === 'fetch')
        mocks.fetch.mockImplementation(async () => {
          controller.abort(reason);
          throw new TypeError('fetch aborted');
        });
      else
        mocks.readBytes.mockImplementation(async () => {
          controller.abort(reason);
          throw new TypeError('stream aborted');
        });
      await expect(
        importEurostatDatasetSnapshot({
          code: 'POP',
          language: 'en',
          userId: 'u1',
          signal: controller.signal,
        })
      ).rejects.toBe(reason);
      expect(mocks.persist).not.toHaveBeenCalled();
    }
  );
  it('rejects a response that expands beyond the limit after legacy text decoding', async () => {
    mocks.readBytes.mockResolvedValue(new Uint8Array(30 * 1024 * 1024).fill(0xe9));
    mocks.fetch.mockResolvedValue(response({ contentType: 'text/csv; charset=windows-1252' }));
    await expect(
      importEurostatDatasetSnapshot({ code: 'POP', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'too_large', httpStatus: 413 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  beforeEach(() =>
    mocks.parseCsv.mockReturnValue({
      columns: ['TIME_PERIOD', 'OBS_VALUE'],
      rows: [{ TIME_PERIOD: '2024', OBS_VALUE: '1' }],
    })
  );

  it('rejects unavailable metadata and non-SDMX payloads before persisting', async () => {
    mocks.eurostatDetails.mockRejectedValueOnce(new Error('metadata unavailable'));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'invalid_response', httpStatus: 502 });
    mocks.parseCsv.mockReturnValueOnce({
      columns: ['error'],
      rows: [{ error: 'invalid request' }],
    });
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'invalid_response', httpStatus: 502 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('classifies broken downloads, gzip archives and CSV parsing without saving snapshots', async () => {
    mocks.fetch.mockRejectedValueOnce(new TypeError('connection failed'));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'unavailable', httpStatus: 502 });
    mocks.fetch.mockResolvedValueOnce(
      response({ contentDisposition: 'attachment; filename=data.csv.gz' })
    );
    mocks.readBytes.mockResolvedValueOnce(new TextEncoder().encode('broken gzip'));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'invalid_response', httpStatus: 502 });
    mocks.parseCsv.mockImplementationOnce(() => {
      throw new Error('malformed CSV');
    });
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toMatchObject({ code: 'invalid_response', httpStatus: 502 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('rejects blocked, failed and asynchronous responses', async () => {
    mocks.eurostatDetails.mockResolvedValueOnce(
      eurostatDetails({ importAllowed: false, estimatedBytes: 60 * 1024 * 1024 })
    );
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toThrow('Estimated Eurostat dataset size exceeds');
    clearDatasetSearchCache();

    mocks.fetch.mockResolvedValueOnce(response({ ok: false, status: 503 }));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toThrow('Eurostat data request failed with 503');

    mocks.readBytes.mockResolvedValueOnce(new TextEncoder().encode('  <xml>pending</xml>'));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toThrow('Eurostat returned an asynchronous response');
  });

  it('decodes raw, disposition-gzipped and magic-byte-gzipped CSV', async () => {
    const csv = 'time,value\n2024,1';
    const compressed = new Uint8Array(gzipSync(csv));
    await importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' });

    mocks.fetch.mockResolvedValueOnce(
      response({ contentDisposition: 'attachment; filename=data.csv.gz' })
    );
    mocks.readBytes.mockResolvedValueOnce(compressed);
    await importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' });

    mocks.readBytes.mockResolvedValueOnce(compressed);
    await importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' });
    expect(mocks.parseCsv).toHaveBeenNthCalledWith(1, csv, { maxRows: 1_000_000 });
    expect(mocks.parseCsv).toHaveBeenNthCalledWith(2, csv, { maxRows: 1_000_000 });
    expect(mocks.parseCsv).toHaveBeenNthCalledWith(3, csv, { maxRows: 1_000_000 });
  });

  it('persists details and falls back to the import timestamp', async () => {
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({ code: 'code/with space', lastUpdate: null })
    );
    const result = await importEurostatDatasetSnapshot({
      code: 'code/with space',
      language: 'de',
      userId: 'u1',
    });
    expect(result).toMatchObject({
      provider: 'EUROSTAT',
      publisher: 'Eurostat',
      sourceUrl: expect.stringContaining('code%2Fwith%20space'),
      snapshotTakenAt: expect.any(String),
      createdById: 'u1',
    });
  });
});

describe('provider search aggregation', () => {
  it.each([new Error('synchronous stored failure'), 'synchronous rejection'])(
    'captures synchronous provider invocation errors %s',
    failure => {
      mocks.searchStored.mockImplementation(() => {
        throw failure;
      });
      return expect(
        searchDatasetProviders({ query: 'custom', providers: ['UPLOAD'] })
      ).resolves.toMatchObject({
        errors: [
          {
            provider: 'UPLOAD',
            message: failure instanceof Error ? failure.message : 'Provider search failed',
          },
        ],
      });
    }
  );
  it('uses German for an unknown topic when the interface language is German', async () => {
    await searchDatasetProviders({
      query: 'custom',
      providers: ['GENESIS_DESTATIS'],
      language: 'de',
    });
    expect(mocks.searchGenesis).toHaveBeenCalledWith(
      'custom',
      'de',
      50,
      expect.any(AbortSignal),
      expect.any(Object)
    );
  });
  it('keeps short queries local and handles non-Error stored search failures', async () => {
    mocks.searchStored.mockRejectedValue('offline');
    expect(await searchDatasetProviders({ query: 'x', providers: [] })).toMatchObject({
      results: [],
      errors: [{ provider: 'UPLOAD', message: 'Provider search failed' }],
    });
    expect(mocks.searchGenesis).not.toHaveBeenCalled();
  });
  it('keeps successful Eurostat variants and reports provider errors', async () => {
    mocks.searchEurostat.mockRejectedValueOnce(new Error('catalogue unavailable'));
    const response = await searchDatasetProviders({ query: 'population', providers: ['EUROSTAT'] });
    expect(response.errors).toContainEqual(
      expect.objectContaining({ provider: 'EUROSTAT', message: 'catalogue unavailable' })
    );
  });
  it('stops GENESIS synonyms once its shared provider budget is exhausted', async () => {
    mocks.searchGenesis.mockImplementation(async (_query, _language, _limit, _signal, budget) => {
      budget.remaining = 0;
      return [];
    });
    await searchDatasetProviders({ query: 'population', providers: ['GENESIS_DESTATIS'] });
    expect(mocks.searchGenesis).toHaveBeenCalledOnce();
  });
  it('stops GENESIS synonyms once a useful page has six results', async () => {
    mocks.searchGenesis.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        id: `g${index}`,
        provider: 'GENESIS_DESTATIS',
        providerDatasetId: `12411-000${index}`,
        title: `Population ${index}`,
      }))
    );
    expect(
      (await searchDatasetProviders({ query: 'population', providers: ['GENESIS_DESTATIS'] }))
        .results
    ).toHaveLength(6);
    expect(mocks.searchGenesis).toHaveBeenCalledOnce();
  });
  it('marks missing GENESIS codes as unverified and enriches the remaining candidates', async () => {
    mocks.searchGenesis.mockResolvedValue([
      { id: 'missing', provider: 'GENESIS_DESTATIS', title: 'Population' },
      {
        id: 'valid',
        provider: 'GENESIS_DESTATIS',
        providerDatasetId: '12411-0001',
        title: 'Population',
      },
    ]);
    mocks.genesisMetadata.mockResolvedValue({ Content: 'Population Germany', Time: '2025' });
    const response = await searchDatasetProviders({
      query: 'Population 2025 Germany',
      providers: ['GENESIS_DESTATIS'],
    });
    expect(response.errors).toContainEqual(
      expect.objectContaining({ code: 'incomplete_metadata' })
    );
    expect(response.results.find(item => item.id === 'valid')?.spatialCoverage).toEqual([
      'Deutschland',
    ]);
  });
  it('stops metadata enrichment when its parent caller cancels', async () => {
    const controller = new AbortController();
    mocks.searchGenesis.mockResolvedValue([
      {
        id: 'first',
        provider: 'GENESIS_DESTATIS',
        providerDatasetId: '12411-0001',
        title: 'Population',
      },
      {
        id: 'next',
        provider: 'GENESIS_DESTATIS',
        providerDatasetId: '12411-0002',
        title: 'Population',
      },
    ]);
    mocks.genesisMetadata.mockImplementation(async () => {
      controller.abort();
      return { Content: 'Population Germany', Time: '2025' };
    });
    const response = await searchDatasetProviders({
      query: 'Population 2025 Germany',
      providers: ['GENESIS_DESTATIS'],
      signal: controller.signal,
    });
    expect(response.errors).toContainEqual(
      expect.objectContaining({ code: 'incomplete_metadata' })
    );
    expect(mocks.genesisMetadata).toHaveBeenCalledOnce();
  });
  it('does not start GENESIS catalogue calls for an already cancelled search', async () => {
    const controller = new AbortController();
    controller.abort();
    await searchDatasetProviders({
      query: 'population',
      providers: ['GENESIS_DESTATIS'],
      signal: controller.signal,
    });
    expect(mocks.searchGenesis).not.toHaveBeenCalled();
  });
  it('retains metadata but marks unavailable Eurostat scope combinations as other results', async () => {
    mocks.searchEurostat.mockResolvedValue([
      { code: 'POP', title: 'Population', type: 'dataset', valueCount: 10 },
    ]);
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({
        dimensions: [{ id: 'geo', label: 'Countries', values: [{ id: 'FR', label: 'France' }] }],
      })
    );
    const response = await searchDatasetProviders({
      query: 'Population Germany',
      providers: ['EUROSTAT'],
    });
    expect(response.results[0].metadata?.searchScopeMatches).toBe(false);
    expect(response.results[0].searchMatch?.group).toBe('other');
  });
  it('enriches direct Eurostat codes without imposing area or time filters', async () => {
    mocks.searchEurostat.mockResolvedValue([
      { code: 'DEMO_R_D3DENS', title: 'Density', type: 'dataset', valueCount: 10 },
    ]);
    const response = await searchDatasetProviders({
      query: 'demo_r_d3dens',
      providers: ['EUROSTAT'],
    });
    expect(response.results[0].metadata?.searchScopeMatches).toBeUndefined();
    expect(mocks.eurostatDetails).toHaveBeenCalledOnce();
  });
  it('builds area-only, period-only and punctuation-safe GovData queries', () => {
    expect(getGovDataSearchQueries('custom', { area: 'Germany', period: null })[0]).toBe(
      '+"custom" +"Germany"'
    );
    expect(
      getGovDataSearchQueries('custom', { area: null, period: { start: 2025, end: 2025 } })[0]
    ).toBe('+"custom"  +"2025"');
    expect(getGovDataSearchQueries('***')).toEqual(['']);
  });
  it('finds known topics in the German GENESIS catalogue independently of interface language', async () => {
    await searchDatasetProviders({
      query: 'Arbeitslose 2025 Deutschland',
      providers: ['GENESIS_DESTATIS'],
      language: 'en',
    });
    expect(mocks.searchGenesis.mock.calls[0]).toEqual([
      'Arbeitslose',
      'de',
      50,
      expect.any(AbortSignal),
      expect.any(Object),
    ]);
    clearDatasetSearchCache();
    mocks.searchGenesis.mockClear();
    await searchDatasetProviders({
      query: 'unemployment 2025 Germany',
      providers: ['GENESIS_DESTATIS'],
      language: 'en',
    });
    expect(mocks.searchGenesis.mock.calls[0][0]).toBe('Arbeitslose');
  });
  it.each(['Arbeitslose', 'Bevölkerung', 'Bruttoinlandsprodukt', 'Inflation'])(
    'confirms national %s metadata before municipal results',
    async topic => {
      const catalogTitle = topic === 'Inflation' ? 'Verbraucherpreisindex' : topic;
      mocks.searchGenesis.mockResolvedValue([
        {
          id: 'genesis:12411-0001',
          provider: 'GENESIS_DESTATIS',
          providerDatasetId: '12411-0001',
          title: `${catalogTitle}: Deutschland, Jahre`,
        },
      ]);
      mocks.genesisMetadata.mockResolvedValue({
        Code: '12411-0001',
        Content: `${catalogTitle}: Deutschland, Jahre`,
        Time: { From: '01.01.2020', To: '31.12.2025' },
        Structure: {
          Head: { Code: 'DINSG', Content: 'Deutschland insgesamt', Type: 'Merkmal', Values: 1 },
        },
      });
      mocks.searchGovData.mockResolvedValue([
        {
          id: 'local',
          title: `${catalogTitle}: Stadt Recklinghausen`,
          timeCoverage: { start: '2020', end: '2025' },
          spatialCoverage: ['Recklinghausen'],
          resources: [{ id: 'csv', name: 'CSV' }],
        },
      ]);
      const response = await searchDatasetProviders({
        query: `${topic} 2025 Deutschland`,
        providers: ['GENESIS_DESTATIS', 'GOVDATA'],
        language: 'de',
      });
      expect(response.results[0]).toMatchObject({
        provider: 'GENESIS_DESTATIS',
        searchMatch: {
          group: 'matching',
          area: { source: 'metadata' },
          period: { source: 'metadata' },
        },
      });
      expect(response.results[1].searchMatch?.group).toBe('other');
      expect(mocks.parseCsv).not.toHaveBeenCalled();
      expect(mocks.searchGenesis.mock.calls.length).toBeLessThanOrEqual(3);
      expect(mocks.genesisMetadata).toHaveBeenCalledOnce();
    }
  );

  it('checks at most six shortlisted Eurostat candidates and marks the remaining coverage unverified', async () => {
    mocks.searchEurostat.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        code: `POP_${index}`,
        title: `Population ${index}`,
        type: 'dataset',
        valueCount: 100,
        dataStart: '2000',
        dataEnd: '2025',
      }))
    );
    mocks.eurostatDetails.mockResolvedValue(
      eurostatDetails({
        dimensions: [
          { id: 'geo', position: 1, values: [{ id: 'DE', label: 'Germany' }] },
          { id: 'TIME_PERIOD', position: 2, values: [{ id: '2025' }] },
        ],
      })
    );
    const response = await searchDatasetProviders({
      query: 'Population 2025 Germany',
      providers: ['EUROSTAT'],
    });
    expect(mocks.eurostatDetails).toHaveBeenCalledTimes(6);
    expect(response.results.filter(item => item.searchMatch?.group === 'matching')).toHaveLength(6);
    expect(response.errors).toEqual([expect.objectContaining({ code: 'incomplete_metadata' })]);
    expect(mocks.readBytes).not.toHaveBeenCalled();
  });
  it('caps resource candidates at fifty per external query without fetching CSV data', async () => {
    mocks.searchGovData.mockResolvedValue([
      {
        id: 'custom',
        title: 'Custom data',
        resources: Array.from({ length: 80 }, (_, i) => ({ id: String(i), name: `CSV ${i}` })),
      },
    ]);
    const result = await searchDatasetProviders({ query: 'custom', providers: ['GOVDATA'] });
    expect(result.results).toHaveLength(50);
    expect(mocks.searchGovData).toHaveBeenCalledOnce();
    expect(mocks.parseCsv).not.toHaveBeenCalled();
    expect(mocks.readBytes).not.toHaveBeenCalled();
  });
  it('requires topic tokens and scopes GovData without injecting query syntax', () => {
    expect(getGovDataSearchQueries('Arbeitslose 2025 Deutschland')).toEqual([
      '+"Arbeitslose" +"Deutschland" +"2025"',
      '+"Arbeitslose"',
      '+"unemployment"',
    ]);
    expect(getGovDataSearchQueries('Arbeitslose OR *:*')).toEqual([
      '+"Arbeitslose" +"OR"',
      '+"Arbeitslosigkeit" +"OR"',
      '+"unemployment" +"OR"',
    ]);
    expect(
      getGovDataSearchQueries('Arbeitslose 2025 Deutschland', { area: null, period: null })[0]
    ).toBe('+"Arbeitslose"');
  });

  it('keeps successful variants, jointly ranks scopes and never shares group results in cache', async () => {
    mocks.searchGovData
      .mockRejectedValueOnce(new Error('scoped variant unavailable'))
      .mockResolvedValue([
        {
          id: 'local',
          title: '2023-2025_Arbeitslose_Gesamt_RE',
          notes: '#Inhalt: Zahlen für Recklinghausen gesamt',
          resources: [{ id: 'csv-local', name: 'CSV' }],
        },
        {
          id: 'national',
          title: 'Arbeitslose Deutschland',
          timeCoverage: { start: '2023', end: '2025' },
          spatialCoverage: ['Deutschland'],
          resources: [{ id: 'csv-national', name: 'CSV' }],
        },
        {
          id: 'income',
          title: 'Einkommensstatistik',
          notes: 'Auch Arbeitslose werden erfasst',
          resources: [{ id: 'csv-income', name: 'CSV' }],
        },
      ]);
    const options = { query: 'Arbeitslose 2025 Deutschland', providers: ['GOVDATA'] };
    const first = await searchDatasetProviders(options);
    expect(first.results.map(item => item.providerDatasetId)).toEqual([
      'national',
      'local',
      'income',
    ]);
    expect(first.results[0].searchMatch?.group).toBe('matching');
    expect(first.results[1].searchMatch?.group).toBe('other');
    expect(first.errors).toEqual([{ provider: 'GOVDATA', message: 'scoped variant unavailable' }]);
    expect(mocks.searchGovData).toHaveBeenCalledTimes(3);
    expect(mocks.searchGovData).toHaveBeenCalledWith(
      expect.any(String),
      50,
      expect.any(AbortSignal)
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
    await searchDatasetProviders(options);
    // Only the failed public variant is retried; permission-dependent stored queries always run.
    expect(mocks.searchGovData).toHaveBeenCalledTimes(4);
    expect(mocks.searchStored).toHaveBeenCalledTimes(6);
    await searchDatasetProviders({ ...options, groupId: 'private-group', userId: 'another-user' });
    expect(mocks.searchStored).toHaveBeenCalledTimes(9);
    expect(mocks.searchStored).toHaveBeenLastCalledWith(
      expect.objectContaining({ groupId: 'private-group', userId: 'another-user' })
    );
    expect(mocks.searchGovData).toHaveBeenCalledTimes(4);
  });
  it('keeps group searches local unless external search is explicit', async () => {
    await searchDatasetProviders({ query: 'population', providers: [], groupId: 'group-1' });
    expect(mocks.searchStored).toHaveBeenCalled();
    expect(mocks.searchEurostat).not.toHaveBeenCalled();
    expect(mocks.searchGovData).not.toHaveBeenCalled();
    expect(mocks.searchGenesis).not.toHaveBeenCalled();

    await searchDatasetProviders({
      query: 'population',
      providers: ['eurostat'],
      groupId: 'group-1',
      includeExternal: true,
    });
    expect(mocks.searchEurostat).toHaveBeenCalled();
  });

  it('maps all providers, normalizes language and deduplicates stable provider keys', async () => {
    const euroEntry = {
      code: 'euro-1',
      title: 'Population Euro title',
      lastUpdate: null,
      structureLastChange: '2025-01-01',
      dataStart: '2020',
      dataEnd: '2025',
      type: 'dataset',
      valueCount: 10,
    };
    mocks.searchStored.mockResolvedValue([
      { id: 'stored-1', provider: 'UPLOAD', providerDatasetId: null, title: 'Population uploaded' },
      { id: 'stored-1', provider: 'UPLOAD', providerDatasetId: null, title: 'Population uploaded' },
    ]);
    mocks.searchEurostat.mockResolvedValue([euroEntry]);
    mocks.searchGovData.mockResolvedValue([
      {
        id: 'gov-1',
        name: 'gov-name',
        title: 'Population Gov title',
        notes: 'Notes',
        publisher: '',
        organizationTitle: 'Organization',
        modified: '2024-01-01',
        resources: [
          { id: 'r1', name: 'First', modified: null, format: '', size: 5 },
          { id: 'r2', name: 'Second', modified: '2024-02-01', format: 'CSV', size: 6 },
        ],
      },
    ]);
    mocks.searchGenesis.mockResolvedValue([
      {
        id: 'genesis-1',
        provider: 'GENESIS_DESTATIS',
        providerDatasetId: 'g1',
        title: 'Population Genesis',
      },
    ]);

    const result = await searchDatasetProviders({
      query: 'population',
      providers: [],
      language: 'de',
    });
    expect(result.results).toHaveLength(5);
    expect(result.results.find(item => item.provider === 'EUROSTAT')).toMatchObject({
      id: 'eurostat:euro-1',
      modified: '2025-01-01',
      structureSummary: '2020-2025 · dataset',
      valueSummary: '10',
    });
    expect(result.results.filter(item => item.provider === 'GOVDATA')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Population Gov title · First',
          publisher: 'Organization',
          formatSummary: 'CSV',
        }),
        expect.objectContaining({ title: 'Population Gov title · Second', modified: '2024-02-01' }),
      ])
    );
    expect(mocks.searchGenesis).toHaveBeenCalledWith(
      expect.any(String),
      'de',
      50,
      expect.any(AbortSignal),
      expect.objectContaining({ remaining: 3 })
    );
    expect(result.errors).toEqual([]);
  });

  it('selects individual providers and captures Error and non-Error failures', async () => {
    mocks.searchStored.mockRejectedValue(new Error('stored failed'));
    mocks.searchGenesis.mockRejectedValue('offline');
    const result = await searchDatasetProviders({
      query: 'custom',
      providers: ['genesis_destatis'],
      language: 'fr',
    });
    expect(mocks.searchEurostat).not.toHaveBeenCalled();
    expect(mocks.searchGovData).not.toHaveBeenCalled();
    expect(mocks.searchGenesis).toHaveBeenCalledWith(
      'custom',
      'en',
      50,
      expect.any(AbortSignal),
      expect.objectContaining({ remaining: 3 })
    );
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([
      { provider: 'UPLOAD', message: 'stored failed' },
      { provider: 'GENESIS_DESTATIS', message: 'Provider search failed', code: 'unavailable' },
    ]);
  });

  it('maps incomplete Eurostat time coverage without adding an empty separator', async () => {
    mocks.searchEurostat.mockResolvedValue([
      {
        code: 'euro-2',
        title: 'Custom Entry',
        lastUpdate: '2025-01-01',
        structureLastChange: null,
        dataStart: '2020',
        dataEnd: null,
        type: 'dataset',
        valueCount: 0,
      },
    ]);
    mocks.searchGovData.mockResolvedValue([
      {
        id: 'gov-2',
        name: 'gov-name',
        title: 'Single resource custom title',
        notes: null,
        publisher: 'Publisher',
        organizationTitle: null,
        modified: null,
        resources: [{ id: 'single', name: 'Only CSV', modified: null, format: 'CSV', size: 1 }],
      },
    ]);
    const result = await searchDatasetProviders({
      query: 'custom',
      providers: ['EUROSTAT', 'GOVDATA'],
    });
    expect(result.results[0]).toMatchObject({
      structureSummary: 'dataset',
      modified: '2025-01-01',
    });
    expect(result.results[1]).toMatchObject({ title: 'Single resource custom title' });
  });
});
