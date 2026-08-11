import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  persist: vi.fn(),
  searchStored: vi.fn(),
  readBytes: vi.fn(),
  bytesToText: vi.fn((bytes: Uint8Array) => new TextDecoder().decode(bytes)),
  fetch: vi.fn(),
}));

vi.mock('@/server/eurostat/catalogue', () => ({ searchEurostatCatalogue: mocks.searchEurostat }));
vi.mock('@/server/eurostat/metadata', () => ({
  createEurostatDataUrl: mocks.eurostatUrl,
  getEurostatDatasetDetails: mocks.eurostatDetails,
}));
vi.mock('@/server/govdata/catalogue', () => ({
  isGovDataCsvResource: mocks.isGovCsv,
  loadGovDataPackage: mocks.loadGovPackage,
  normalizeGovDataText: mocks.normalizeGovText,
  searchGovDataCatalogue: mocks.searchGovData,
}));
vi.mock('@/server/govdata/safety', () => ({ assertSafePublicHttpUrl: mocks.assertSafeUrl }));
vi.mock('../csv', () => ({ parseDatasetCsv: mocks.parseCsv }));
vi.mock('../genesis', () => ({ searchGenesisDatasets: mocks.searchGenesis }));
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
  importEurostatDatasetSnapshot,
  importGovDataDatasetSnapshot,
  searchDatasetProviders,
} from '../providers';

const table = { columns: ['time', 'value'], rows: [{ time: '2024', value: '1' }] };

function response({
  ok = true,
  status = 200,
  contentDisposition = null,
}: { ok?: boolean; status?: number; contentDisposition?: string | null } = {}) {
  return {
    ok,
    status,
    headers: {
      get: vi.fn((name: string) =>
        name.toLowerCase() === 'content-disposition' ? contentDisposition : null
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
    [' Arbeitslosigkeit ', ['Arbeitslosigkeit', 'unemployment']],
    ['Bevoelkerung', ['Bevoelkerung', 'Bevölkerung', 'population']],
    ['x', []],
    ['custom query', ['custom query']],
  ])('expands %j without duplicates and discards short queries', (query, expected) => {
    expect(getDatasetSearchQueries(query)).toEqual(expected);
  });
});

describe('GovData snapshot import', () => {
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
  it('rejects blocked, failed and asynchronous responses', async () => {
    mocks.eurostatDetails.mockResolvedValueOnce(eurostatDetails({ importAllowed: false }));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toThrow('Estimated Eurostat dataset size exceeds');

    mocks.fetch.mockResolvedValueOnce(response({ ok: false, status: 503 }));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toThrow('Eurostat data request failed with 503');

    mocks.readBytes.mockResolvedValueOnce(new TextEncoder().encode('  <xml>pending</xml>'));
    await expect(
      importEurostatDatasetSnapshot({ code: 'code', language: 'en', userId: 'u1' })
    ).rejects.toThrow('Eurostat returned an asynchronous or non-CSV response');
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
    expect(mocks.parseCsv).toHaveBeenNthCalledWith(1, csv);
    expect(mocks.parseCsv).toHaveBeenNthCalledWith(2, csv);
    expect(mocks.parseCsv).toHaveBeenNthCalledWith(3, csv);
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
      title: 'Euro title',
      lastUpdate: null,
      structureLastChange: '2025-01-01',
      dataStart: '2020',
      dataEnd: '2025',
      type: 'dataset',
      valueCount: 10,
    };
    mocks.searchStored.mockResolvedValue([
      { id: 'stored-1', provider: 'UPLOAD', providerDatasetId: null },
      { id: 'stored-1', provider: 'UPLOAD', providerDatasetId: null },
    ]);
    mocks.searchEurostat.mockResolvedValue([euroEntry]);
    mocks.searchGovData.mockResolvedValue([
      {
        id: 'gov-1',
        name: 'gov-name',
        title: 'Gov title',
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
      { id: 'genesis-1', provider: 'GENESIS_DESTATIS', providerDatasetId: 'g1' },
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
          title: 'Gov title · First',
          publisher: 'Organization',
          formatSummary: 'CSV',
        }),
        expect.objectContaining({ title: 'Gov title · Second', modified: '2024-02-01' }),
      ])
    );
    expect(mocks.searchGenesis).toHaveBeenCalledWith(expect.any(String), 'de', 15);
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
    expect(mocks.searchGenesis).toHaveBeenCalledWith('custom', 'en', 15);
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([
      { provider: 'UPLOAD', message: 'stored failed' },
      { provider: 'GENESIS_DESTATIS', message: 'Provider search failed' },
    ]);
  });

  it('maps incomplete Eurostat time coverage without adding an empty separator', async () => {
    mocks.searchEurostat.mockResolvedValue([
      {
        code: 'euro-2',
        title: 'Entry',
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
        title: 'Single resource title',
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
    expect(result.results[1]).toMatchObject({ title: 'Single resource title' });
  });
});
