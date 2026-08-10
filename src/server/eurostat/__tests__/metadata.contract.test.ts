import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  catalogue: vi.fn(),
  hash: vi.fn(),
  readCsv: vi.fn(),
  parseCsv: vi.fn(),
  parseXml: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/features/charts/types', () => ({ MAX_EUROSTAT_DATASET_BYTES: 1_000 }));
vi.mock('../constants', () => ({
  DETAILS_CACHE_MS: 1_000,
  EUROSTAT_BASE_URL: 'https://eurostat.test',
}));
vi.mock('../catalogue', () => ({ findEurostatCatalogueEntry: mocks.catalogue }));
vi.mock('../hash', () => ({ createStableHash: mocks.hash }));
vi.mock('../response', () => ({ readEurostatCsvResponse: mocks.readCsv }));
vi.mock('csv-parse/sync', () => ({ parse: mocks.parseCsv }));
vi.mock('fast-xml-parser', () => ({
  XMLParser: class {
    parse(text: string) {
      return mocks.parseXml(text);
    }
  },
}));

function response({ ok = true, text = '' }: { ok?: boolean; text?: string } = {}) {
  return { ok, text: vi.fn().mockResolvedValue(text) } as unknown as Response;
}

function catalogueEntry(overrides: Record<string, unknown> = {}) {
  return {
    code: 'DATA',
    title: 'Dataset',
    description: null,
    valueCount: 1,
    lastUpdate: '2026-01-01',
    structureLastChange: '2025-12-01',
    ...overrides,
  } as any;
}

function richStructure() {
  return {
    Structure: {
      Structures: {
        Codelists: {
          Codelist: [
            {
              '@_id': 'CL_GEO',
              Name: [
                { '@_lang': 'en', '#text': 'Geography' },
                { '@_lang': 'de', '#text': 'Geografie' },
              ],
              Code: [
                { '@_id': 'DE', Name: 'Germany' },
                { '@_id': 'FR', Name: [{ '@_lang': 'en', '#text': 'France' }] },
              ],
            },
            {
              '@_id': 'CL_TIME',
              Name: [{ '@_lang': 'fr', '#text': 'Temps' }],
              Code: { '@_id': '2026', Name: { '#text': '  2026  ' } },
            },
            {
              '@_id': 'CL_EMPTY',
              Name: { '@_lang': 'de' },
              Code: { '@_id': 'X', Name: null },
            },
          ],
        },
        DataStructures: {
          DataStructure: {
            DataStructureComponents: {
              DimensionList: {
                Dimension: [
                  {
                    '@_id': 'geo',
                    '@_position': '2',
                    LocalRepresentation: {
                      Enumeration: { Ref: { '@_id': 'CL_GEO', '@_version': '1.0' } },
                    },
                  },
                  { '@_id': 'unit' },
                  {
                    '@_id': 'missing_list',
                    '@_position': '4',
                    LocalRepresentation: {
                      Enumeration: { Ref: { '@_id': 'CL_MISSING' } },
                    },
                  },
                ],
                TimeDimension: {
                  '@_id': 'TIME_PERIOD',
                  '@_position': '1',
                  LocalRepresentation: {
                    Enumeration: { Ref: { '@_id': 'CL_TIME', '@_version': null } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function richConstraint() {
  return {
    Structure: {
      Structures: {
        Constraints: {
          ContentConstraint: {
            CubeRegion: {
              KeyValue: [
                { '@_id': 'geo', Value: ['DE', 'FR', 'XX'] },
                { '@_id': 'TIME_PERIOD', Value: '2026' },
                { '@_id': 'unit', Value: ['NR'] },
                { '@_id': 'missing_list', Value: ['X'] },
                { '@_id': 'unknown_dimension', Value: ['A'] },
                { '@_id': '', Value: ['ignored'] },
                { Value: ['also-ignored'] },
                { '@_id': 'empty_values', Value: null },
              ],
            },
          },
        },
      },
    },
  };
}

async function loadModule() {
  return import('../metadata');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.catalogue.mockResolvedValue(catalogueEntry());
  mocks.hash.mockReturnValue('snapshot-hash');
  mocks.readCsv.mockResolvedValue('csv');
  mocks.parseCsv.mockReturnValue([]);
  mocks.parseXml.mockImplementation((text: string) =>
    text === 'structure' ? richStructure() : richConstraint()
  );
});

describe('Eurostat metadata helpers', () => {
  it('estimates bytes and creates an encoded data URL with all filter values', async () => {
    const { createEurostatDataUrl, estimateEurostatDatasetBytes } = await loadModule();
    expect(estimateEurostatDatasetBytes(0, 64)).toBe(0);
    expect(estimateEurostatDatasetBytes(2.2, 10)).toBe(Math.ceil(2.2 * 138 * 1.2));
    const url = createEurostatDataUrl('demo data', {
      geo: ['DE', 'FR'],
      unit: [],
    });
    expect(url.pathname).toContain('/demo%20data/1.0');
    expect(url.searchParams.get('c[geo]')).toBe('DE,FR');
    expect(url.searchParams.get('c[unit]')).toBe('');
    expect(url.searchParams.get('attributes')).toBe('all');
    expect(url.searchParams.get('measures')).toBe('all');
  });
});

describe('getEurostatDatasetDetails', () => {
  it('builds localized, sorted dimensions and extracts non-dimension sample attributes', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response({ text: 'structure' }))
      .mockResolvedValueOnce(response({ text: 'constraint' }))
      .mockResolvedValueOnce(response());
    mocks.parseCsv.mockReturnValue([
      {
        TIME_PERIOD: '2026',
        geo: 'DE',
        unit: 'NR',
        STRUCTURE: 'dataflow',
        STRUCTURE_ID: 'id',
        DATAFLOW: 'flow',
        'LAST UPDATE': 'today',
        OBS_VALUE: '42',
        OBS_STATUS: 'A',
        CONF_STATUS: 'F',
      },
    ]);
    const { getEurostatDatasetDetails } = await loadModule();
    const details = await getEurostatDatasetDetails(' data ', 'de');

    expect(details).toMatchObject({
      code: 'DATA',
      language: 'de',
      snapshotKey: 'snapshot-hash',
      attributes: ['OBS_STATUS', 'CONF_STATUS'],
      sampleRowBytes: expect.any(Number),
      importAllowed: true,
    });
    expect(details.dimensions.map(dimension => dimension.id)).toEqual([
      'unit',
      'TIME_PERIOD',
      'geo',
      'missing_list',
      'unknown_dimension',
    ]);
    expect(details.dimensions[1]).toMatchObject({
      label: 'Temps',
      position: 1,
      codelistId: 'CL_TIME',
      codelistVersion: null,
      values: [{ id: '2026', label: '2026' }],
    });
    expect(details.dimensions[2]).toMatchObject({
      label: 'Geografie',
      values: [
        { id: 'DE', label: 'Germany' },
        { id: 'FR', label: 'France' },
        { id: 'XX', label: undefined },
      ],
    });
    expect(details.dimensions.at(-1)).toMatchObject({
      label: 'unknown dimension',
      position: 5,
      codelistId: null,
    });

    const sampleUrl = new URL(mocks.fetch.mock.calls[2]?.[0] as string);
    expect(sampleUrl.searchParams.get('c[TIME_PERIOD]')).toBe('2026');
    expect(sampleUrl.searchParams.get('c[geo]')).toBe('DE');
    expect(mocks.hash).toHaveBeenCalledWith({
      code: 'DATA',
      lastUpdate: '2026-01-01',
      structureLastChange: '2025-12-01',
    });
  });

  it('uses empty structure fallbacks, failed samples and the default language', async () => {
    mocks.parseXml.mockReturnValue({});
    mocks.fetch
      .mockResolvedValueOnce(response({ text: 'structure' }))
      .mockResolvedValueOnce(response({ text: 'constraint' }))
      .mockResolvedValueOnce(response({ ok: false }));
    const { getEurostatDatasetDetails } = await loadModule();
    await expect(getEurostatDatasetDetails('empty')).resolves.toMatchObject({
      code: 'EMPTY',
      language: 'en',
      dimensions: [],
      attributes: [],
      sampleRowBytes: 256,
    });
  });

  it('uses the empty-row sample fallback and rejects oversized imports', async () => {
    mocks.catalogue.mockResolvedValue(catalogueEntry({ valueCount: 100 }));
    mocks.fetch
      .mockResolvedValueOnce(response({ text: 'structure' }))
      .mockResolvedValueOnce(response({ text: 'constraint' }))
      .mockResolvedValueOnce(response());
    mocks.parseCsv.mockReturnValue([]);
    const { getEurostatDatasetDetails } = await loadModule();
    await expect(getEurostatDatasetDetails('large', 'fr')).resolves.toMatchObject({
      sampleRowBytes: 256,
      importAllowed: false,
    });
  });

  it('distinguishes structure and constraint response failures', async () => {
    mocks.fetch.mockResolvedValueOnce(response({ ok: false })).mockResolvedValueOnce(response());
    const first = await loadModule();
    await expect(first.getEurostatDatasetDetails('missing')).rejects.toThrow(
      'Eurostat metadata for MISSING is unavailable'
    );

    vi.resetModules();
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ ok: false }));
    const second = await loadModule();
    await expect(second.getEurostatDatasetDetails('missing')).rejects.toThrow(
      'Eurostat metadata for MISSING is unavailable'
    );
  });

  it('returns valid cache entries and refreshes expired ones', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    mocks.fetch.mockResolvedValue(response({ text: 'structure' }));
    mocks.parseXml.mockReturnValue({});
    const { getEurostatDatasetDetails } = await loadModule();
    const first = await getEurostatDatasetDetails('cache', 'en');
    const cached = await getEurostatDatasetDetails('cache', 'en');
    expect(cached).toBe(first);
    expect(mocks.catalogue).toHaveBeenCalledTimes(1);

    now.mockReturnValue(2_001);
    const refreshed = await getEurostatDatasetDetails('cache', 'en');
    expect(refreshed).not.toBe(first);
    expect(mocks.catalogue).toHaveBeenCalledTimes(2);
  });
});
