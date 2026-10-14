import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), persist: vi.fn() }));
vi.mock('../service', () => ({ persistDatasetSnapshot: mocks.persist }));
import {
  searchGenesisDatasets,
  importGenesisDatasetSnapshot,
  getGenesisTableMetadata,
  prepareGenesisDataset,
  searchGenesisTableCatalogue,
  genesisMetadataDimensions,
  genesisSearchMetadata,
  normalizeGenesisTable,
  loadGenesisSelection,
  readGenesisTable,
} from '../genesis';
import { assertGenesisStatus, postGenesis } from '../genesisTransport';
import { clearDatasetSearchCache } from '../searchRuntime';
import type { PersistDatasetSnapshotInput } from '../service';
import type { EurostatDimension } from '@/features/charts/types';
import { genesisObservations } from './fixtures/genesis-observations';
import { tableToCsv } from '../csv';

const status = { Code: 0, Type: 'Information', Content: 'erfolgreich' };
const metadata = {
  Code: '12411-0001',
  Content: 'Bevölkerung: Deutschland, Stichtag',
  Time: { From: '31.12.1950', To: '31.12.2025' },
  Structure: {
    Head: {
      Code: '12411',
      Type: 'Statistik',
      Structure: [
        { Code: 'DINSG', Content: 'Deutschland insgesamt', Type: 'Merkmal', Values: '1' },
      ],
    },
  },
};
const csv =
  'statistics_code;statistics_label;time_code;time_label;time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label\n12411;Bevölkerung;STAG;Stichtag;2025-12-31;DINSG;Deutschland insgesamt;DG;Deutschland;83467117;Anzahl;BEVSTD;Bevölkerungsstand';
function json(body: object) {
  return Response.json({ Status: status, ...body });
}
beforeEach(() => {
  clearDatasetSearchCache();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  delete process.env.GENESIS_BASE_URL;
  process.env.GENESIS_API_TOKEN = 'test-token';
  mocks.persist.mockImplementation(async value => value);
  mocks.fetch.mockImplementation(async (url: string) =>
    url.endsWith('metadata/table')
      ? json({ Object: metadata })
      : url.endsWith('catalogue/values2variable')
        ? json({ List: [{ Code: 'DG', Content: 'Deutschland' }] })
        : url.endsWith('data/tablefile')
          ? new Response(csv)
          : json({
              Tables: [
                {
                  Code: '12411-0001',
                  Content: metadata.Content,
                  Time: '1950-2025',
                  Information: 'false',
                },
              ],
            })
  );
});
afterEach(() => vi.useRealTimers());

describe('GENESIS catalogue and status', () => {
  it.each(['de', 'en'])(
    'searches valid table prefixes in %s and filters malformed catalogue entries',
    async language => {
      mocks.fetch.mockResolvedValue(
        json({
          List: [
            { Code: '12411-0001', Content: 'Population', Time: { From: '2020', To: '2025' } },
            { Code: '12411-0002', Content: '' },
            { Code: '12411', Content: 'Statistics' },
          ],
        })
      );
      expect(await searchGenesisTableCatalogue('12411-*', language)).toMatchObject([
        { providerDatasetId: '12411-0001', timeCoverage: { start: '2020', end: '2025' } },
      ]);
      const params = new URLSearchParams(String(mocks.fetch.mock.calls[0][1].body));
      expect(params.get('selection')).toBe('12411-*');
      expect(params.get('language')).toBe(language);
      expect(params.get('pagelength')).toBe('50');
    }
  );
  it('rejects unrestricted or malformed prefix selections without requesting the provider', async () => {
    await expect(searchGenesisTableCatalogue('*', 'de')).rejects.toMatchObject({
      code: 'invalid_scope',
      httpStatus: 422,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('normalizes non-German direct-code searches to English and clamps the provider page length', async () => {
    mocks.fetch.mockResolvedValue(json({ List: { Code: '12411-0001', Content: 'Population' } }));
    expect(await searchGenesisDatasets('12411-0001', 'fr', 100)).toHaveLength(1);
    const params = new URLSearchParams(String(mocks.fetch.mock.calls[0][1].body));
    expect(params.get('language')).toBe('en');
    expect(params.get('pagelength')).toBe('50');
  });
  it('verifies the blank national total without mutating shared cached regional values on reopening', async () => {
    mocks.fetch.mockImplementation(async (url: string, init: { body: URLSearchParams }) => {
      if (url.endsWith('metadata/table'))
        return json({
          Object: {
            Code: '13211-0002',
            Content: 'Arbeitslose: Deutschland, Monate',
            Time: { From: '2005', To: '2026' },
            Structure: {
              Columns: [{ Code: 'ERW006', Content: 'Arbeitslose', Type: 'Merkmal', Values: '-1' }],
              Rows: [{ Code: 'MONAT', Content: 'Monate', Type: 'Merkmal', Values: '12' }],
              Subtitel: { Code: 'DINSGF', Content: 'Gebiet', Type: 'Merkmal', Values: '2' },
            },
          },
        });
      if (url.endsWith('catalogue/values2variable'))
        return json({
          List:
            init.body.get('name') === 'DINSGF'
              ? [
                  { Code: 'DF', Content: 'Früheres Bundesgebiet' },
                  { Code: 'DN', Content: 'Neue Länder' },
                ]
              : [{ Code: 'MONAT01', Content: 'Januar' }],
        });
      return new Response(tableToCsv(genesisObservations()));
    });
    const first = await prepareGenesisDataset('13211-0002');
    const second = await prepareGenesisDataset('13211-0002');
    const firstGeo = first.dimensions.find(item => item.id === 'DINSGF');
    const secondGeo = second.dimensions.find(item => item.id === 'DINSGF');
    expect(secondGeo?.values.map(item => item.id)).toEqual(['DF', 'DN', '__total__:DINSGF']);
    expect(firstGeo?.values).not.toBe(secondGeo?.values);
    expect(firstGeo?.values).toEqual(secondGeo?.values);
    const dataCalls = mocks.fetch.mock.calls.filter(([url]) => url.endsWith('data/tablefile'));
    expect(dataCalls).toHaveLength(1);
    expect(dataCalls[0][1].body.get('contents')).toBe('ERW006');
  });
  it('classifies interrupted response streams and releases the credential queue', async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError('connection terminated'));
          },
        })
      )
    );
    await expect(searchGenesisDatasets('Bevölkerung')).rejects.toMatchObject({
      code: 'invalid_response',
      httpStatus: 502,
    });
    expect(await searchGenesisDatasets('Inflation')).toHaveLength(1);
  });
  it('skips short queries and requires a configured token', async () => {
    expect(await searchGenesisDatasets('x')).toEqual([]);
    delete process.env.GENESIS_API_TOKEN;
    await expect(searchGenesisDatasets('population')).rejects.toMatchObject({
      code: 'authentication',
      httpStatus: 503,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('reads Tables, uses table-only searches, omits password and ignores technical information flags', async () => {
    const results = await searchGenesisDatasets('Bevölkerung', 'de', 50);
    expect(results).toEqual([
      expect.objectContaining({
        providerDatasetId: '12411-0001',
        description: null,
        timeCoverage: { start: '1950', end: '2025' },
      }),
    ]);
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toContain('/find/find');
    expect(init.headers).not.toHaveProperty('password');
    expect(init.headers.username).toBe('test-token');
    expect(init.headers['Content-Type']).toContain('charset=UTF-8');
    expect(String(init.body)).toContain('category=tables');
  });
  it('reads List only for direct table codes and rejects non-table object entries', async () => {
    mocks.fetch.mockResolvedValue(
      json({
        List: [
          { Code: '12411-0001', Content: metadata.Content },
          { Code: '12411', Content: 'Statistics' },
          { Code: '12411BJ001', Content: 'Cube' },
        ],
      })
    );
    expect(await searchGenesisDatasets('12411-0001')).toHaveLength(1);
    expect(mocks.fetch.mock.calls[0][0]).toContain('/catalogue/tables');
    expect(String(mocks.fetch.mock.calls[0][1].body)).toContain('selection=12411-0001');
  });
  it('retains warnings with data and recognizes empty provider results', async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        json({
          Status: { Code: 22, Type: 'Warnung' },
          Tables: [{ Code: '12411-0001', Content: metadata.Content }],
        })
      )
      .mockResolvedValueOnce(json({ Status: { Code: 104, Type: 'Information' }, Tables: null }));
    expect(await searchGenesisDatasets('Bevölkerung')).toHaveLength(1);
    expect(await searchGenesisDatasets('missing')).toEqual([]);
    expect(() => assertGenesisStatus({ Status: { Code: 22, Type: 'Warnung' } }, true)).toThrow(
      'changed'
    );
  });
  it('classifies HTTP-200 authentication errors and malformed payloads', async () => {
    mocks.fetch
      .mockResolvedValueOnce(json({ Status: { Code: 1, Type: 'Error', Content: 'Token invalid' } }))
      .mockResolvedValueOnce(Response.json({ Tables: [] }));
    await expect(searchGenesisDatasets('population')).rejects.toMatchObject({
      code: 'authentication',
    });
    await expect(searchGenesisDatasets('prices')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
  it('retries HTTP 500 once after 300ms and returns recovered results', async () => {
    vi.useFakeTimers();
    mocks.fetch
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValueOnce(json({ Tables: [{ Code: '12411-0001', Content: metadata.Content }] }));
    const pending = searchGenesisDatasets('population');
    await vi.advanceTimersByTimeAsync(299);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toHaveLength(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('never retries authentication failures or exceeds a shared catalogue budget', async () => {
    mocks.fetch.mockResolvedValue(new Response('error', { status: 500 }));
    await expect(
      searchGenesisDatasets('population', 'en', 50, undefined, { remaining: 1 })
    ).rejects.toMatchObject({ upstreamStatus: 500 });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    mocks.fetch.mockResolvedValue(new Response('unauthorized', { status: 401 }));
    await expect(searchGenesisDatasets('prices')).rejects.toMatchObject({ code: 'authentication' });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('serializes different requests and coalesces identical requests with independent response bodies', async () => {
    let release!: (response: Response) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        })
    );
    const first = searchGenesisDatasets('population');
    const duplicate = searchGenesisDatasets('population');
    const next = searchGenesisDatasets('prices');
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    release(json({ Tables: [{ Code: '12411-0001', Content: metadata.Content }] }));
    expect(await first).toHaveLength(1);
    expect(await duplicate).toHaveLength(1);
    await next;
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('removes an aborted queued request without fetching it', async () => {
    let release!: (response: Response) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        })
    );
    const first = searchGenesisDatasets('population');
    const controller = new AbortController();
    const queued = searchGenesisDatasets('prices', 'en', 50, controller.signal);
    const assertion = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    release(json({ Tables: [] }));
    await first;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it('times out while waiting behind a long request, including queue time', async () => {
    vi.useFakeTimers();
    let release!: (response: Response) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        })
    );
    const first = postGenesis('data/tablefile', { name: '12411-0001' }, { timeoutMs: 120000 });
    const queued = searchGenesisDatasets('prices');
    const assertion = expect(queued).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(mocks.fetch).toHaveBeenCalledOnce();
    release(new Response(csv));
    await first;
  });
});

describe('GENESIS preparation and modern FFCSV import', () => {
  it.each([
    { start: 1800, end: 2025 },
    { start: 2025, end: 2199 },
    { start: 1800, end: 2199 },
  ])(
    'limits open-ended period %j to provider years and persists the observed bounds',
    async period => {
      await importGenesisDatasetSnapshot({
        code: '12411-0001',
        userId: 'user',
        filters: { period },
      });
      const call = mocks.fetch.mock.calls.find(([url]) => url.endsWith('data/tablefile'));
      expect(call?.[1].body.get('startyear')).toBe(
        String(period.start === 1800 ? 1950 : period.start)
      );
      expect(call?.[1].body.get('endyear')).toBe('2025');
      const persisted = mocks.persist.mock.lastCall?.[0] as PersistDatasetSnapshotInput;
      expect(persisted.timeCoverage).toEqual({ start: '2025', end: '2025' });
    }
  );

  it('rejects mismatched statistic identifiers in otherwise valid FFCSV', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(csv.replace('12411;Bevölkerung', '13211;Bevölkerung'))
    );
    await expect(readGenesisTable('12411-0001', 'en', {})).rejects.toMatchObject({
      code: 'invalid_response',
      message: 'GENESIS returned a different statistic',
    });
  });

  it('keeps selected measures and units in their own provider parameters and checks missing returned keys', async () => {
    const entry = {
      ...metadata,
      Structure: {
        ...metadata.Structure,
        Columns: [{ Code: 'BEVSTD', Content: 'Population', Type: 'Variable', Values: -1 }],
        Rows: [{ Code: 'value_unit', Content: 'Unit', Type: 'Variable', Values: 1 }],
      },
    };
    mocks.fetch.mockImplementation(async (url: string, init: { body: URLSearchParams }) =>
      url.endsWith('metadata/table')
        ? json({ Object: entry })
        : url.endsWith('catalogue/values2variable')
          ? json({
              List: [
                {
                  Code: init.body.get('name') === 'value_unit' ? 'Anzahl' : 'DG',
                  Content: 'Value',
                },
              ],
            })
          : new Response(csv)
    );
    const result = await loadGenesisSelection('12411-0001', 'en', {
      dimensions: { value_variable_code: 'BEVSTD', value_unit: 'Anzahl' },
    });
    expect(result.table.rows).toHaveLength(1);
    expect(
      result.preparation.dimensions.find(item => item.id === 'value_variable_code')?.label
    ).toBe('Measure');
    const call = mocks.fetch.mock.calls.find(([url]) => url.endsWith('data/tablefile'));
    expect(call?.[1].body.get('contents')).toBe('BEVSTD');
    expect(call?.[1].body.has('classifyingvariable1')).toBe(false);
    const old = mocks.fetch.getMockImplementation();
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(new Response('time;value;value_unit\n2025;1;Anzahl'))
        : old?.(url, init)
    );
    await expect(
      loadGenesisSelection('12411-0001', 'en', { dimensions: { value_variable_code: 'BEVSTD' } })
    ).rejects.toMatchObject({ code: 'invalid_scope' });
  });

  it.each([true, false])(
    'includes verified national totals in English only when observations confirm them: %s',
    async confirmed => {
      const observations = genesisObservations();
      mocks.fetch.mockImplementation(async (url: string, init: { body: URLSearchParams }) => {
        if (url.endsWith('metadata/table'))
          return json({
            Object: {
              Code: '13211-0002',
              Content: 'Unemployment: Germany',
              Time: { From: '2025', To: '2025' },
              Structure: {
                Columns: [{ Code: 'ERW006', Content: 'Unemployed', Type: 'Variable', Values: -1 }],
                Rows: [{ Code: 'DINSGF', Content: 'Area', Type: 'Variable', Values: 2 }],
              },
            },
          });
        if (url.endsWith('catalogue/values2variable'))
          return json({ List: [{ Code: 'DF', Content: 'West Germany' }] });
        const rows = observations.rows.filter(
          row =>
            (!init.body.get('contents') || row.value_variable_code === init.body.get('contents')) &&
            (confirmed || row['2_variable_attribute_code'])
        );
        return new Response(tableToCsv({ ...observations, rows }));
      });
      const preparation = await prepareGenesisDataset('13211-0002', 'en');
      const geography = preparation.dimensions.find(item => item.id === 'DINSGF');
      expect(geography?.values.some(item => item.id === '__total__:DINSGF')).toBe(confirmed);
      if (confirmed) {
        expect(geography?.values).toContainEqual({ id: '__total__:DINSGF', label: 'Germany' });
        const selected = await loadGenesisSelection('13211-0002', 'en', {
          dimensions: { DINSGF: '__total__:DINSGF', value_variable_code: 'ERW006' },
        });
        expect(
          selected.table.rows.every(
            row => row.DINSGF === '__total__:DINSGF' && row.value_variable_code === 'ERW006'
          )
        ).toBe(true);
        const download = mocks.fetch.mock.calls
          .filter(([url]) => url.endsWith('data/tablefile'))
          .at(-1);
        expect(download?.[1].body.has('regionalkey')).toBe(false);
      }
    }
  );

  it('skips total verification when national metadata has no parseable end year', async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith('metadata/table')
        ? json({
            Object: {
              Code: '13211-0002',
              Content: 'Germany',
              Time: { From: '2025' },
              Structure: {
                Columns: [{ Code: 'ERW006', Type: 'Variable', Values: -1 }],
                Rows: [{ Code: 'DINSGF', Type: 'Variable', Values: 2 }],
              },
            },
          })
        : json({ List: [{ Code: 'DF' }] })
    );
    const result = await prepareGenesisDataset('13211-0002');
    expect(result.dimensions.find(item => item.id === 'DINSGF')?.values).toEqual([
      { id: 'DF', label: '' },
    ]);
    expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith('data/tablefile'))).toBe(false);
  });
  it('imports required FFCSV fields without optional unit or measure columns', async () => {
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(new Response('time;value\n2025;1'))
        : original(url, init)
    );
    await importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' });
    const saved = mocks.persist.mock.lastCall?.[0] as PersistDatasetSnapshotInput;
    expect((saved.dimensions as EurostatDimension[]).map(item => item.id)).toEqual([]);
    expect(saved.table.rows).toEqual([{ time: '2025', value: '1', observation_period: '2025' }]);
    expect(saved.metadata).toMatchObject({
      timeDimension: 'observation_period',
      measureOptions: [],
    });
  });
  it('handles missing, reversed and nested metadata dimensions without inventing coverage', () => {
    expect(genesisMetadataDimensions({})).toEqual([]);
    expect(
      genesisMetadataDimensions({
        Time: '2025-2020',
        Structure: {
          Head: [
            { Code: '', Type: 'Variable', Values: 1 },
            { Code: 'EMPTY', Type: 'Variable', Values: 0 },
            {
              Code: 'HEADER',
              Type: 'Statistik',
              Values: 1,
              Structure: { Code: 'KIND', Type: 'variable', Values: 2 },
            },
          ],
        },
      })
    ).toEqual([{ id: 'KIND', label: 'KIND', position: 1, values: [] }]);
  });
  it('adds Germany coverage from its dimension and preserves other spatial metadata', async () => {
    const result = (await searchGenesisDatasets('population'))[0];
    expect(
      genesisSearchMetadata({ Content: 'Population', Structure: metadata.Structure }, result)
    ).toMatchObject({
      spatialCoverage: ['Deutschland'],
      metadata: { searchAreaSource: 'metadata' },
    });
    const european = {
      ...result,
      spatialCoverage: ['Europe'],
      metadata: { searchAreaSource: 'catalogue' },
    };
    expect(genesisSearchMetadata({ Content: 'European population' }, european)).toMatchObject({
      spatialCoverage: ['Europe'],
      metadata: { searchAreaSource: 'catalogue' },
    });
    expect(
      genesisSearchMetadata({ Content: 'Population' }, { ...result, metadata: undefined }).metadata
        ?.searchAreaSource
    ).toBeUndefined();
    expect(genesisSearchMetadata({ Content: 'Germany' }, result).spatialCoverage).toEqual([
      'Deutschland',
    ]);
  });
  it.each([{ Code: '12411-0002', Content: 'Wrong table' }, { Code: '12411-0001' }])(
    'rejects mismatched or untitled metadata %j',
    async entry => {
      mocks.fetch.mockResolvedValue(json({ Object: entry }));
      await expect(getGenesisTableMetadata('12411-0001')).rejects.toMatchObject({
        code: 'invalid_response',
      });
    }
  );
  it('detects country labels in English and filters blank variable identifiers', async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith('metadata/table')
        ? json({
            Object: {
              Code: '12411-0001',
              Content: 'Population',
              Structure: {
                Head: { Code: 'GEO', Content: 'Countries', Type: 'Variable', Values: 2 },
              },
            },
          })
        : json({ List: [{ Code: 'DE', Content: 'Germany' }, { Content: 'Broken' }] })
    );
    expect(await prepareGenesisDataset('12411-0001', 'en')).toMatchObject({
      geoDimension: 'GEO',
      timeDimension: null,
      spatialCoverage: null,
      dimensions: [{ values: [{ id: 'DE', label: 'Germany' }] }],
    });
    expect(
      mocks.fetch.mock.calls.every(
        ([, init]) => new URLSearchParams(String(init.body)).get('language') === 'en'
      )
    ).toBe(true);
  });
  it('prepares metadata without geographic or temporal selectors', async () => {
    mocks.fetch.mockResolvedValue(json({ Object: { Code: '12411-0001', Content: 'Summary' } }));
    expect(await prepareGenesisDataset('12411-0001')).toMatchObject({
      geoDimension: undefined,
      timeDimension: null,
      dimensions: [],
    });
  });
  it('preserves ordinary tables and tolerates absent FFCSV variable identities and attributes', () => {
    const ordinary = { columns: ['name'], rows: [{ name: 'ordinary' }] };
    expect(normalizeGenesisTable(ordinary)).toBe(ordinary);
    expect(
      normalizeGenesisTable({
        columns: ['time', 'value', '1_variable_code', '2_variable_code'],
        rows: [{ time: '2025', value: '1', '1_variable_code': '', '2_variable_code': 'KIND' }],
      })
    ).toMatchObject({ rows: [{ KIND: '' }] });
  });
  it('rejects blank dataset codes before requesting metadata', async () => {
    await expect(importGenesisDatasetSnapshot({ code: ' ', userId: 'user' })).rejects.toMatchObject(
      { code: 'invalid_scope', httpStatus: 422 }
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([1, 6])(
    'validates %i classifying selectors before requesting observations',
    async count => {
      const original = mocks.fetch.getMockImplementation()!;
      mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
        url.endsWith('metadata/table')
          ? Promise.resolve(
              json({
                Object: {
                  Code: '12411-0001',
                  Content: 'Summary',
                  Structure: {
                    Head: Array.from({ length: count }, (_, index) => ({
                      Code: `D${index + 1}`,
                      Content: 'Kind',
                      Type: 'Variable',
                      Values: 1,
                    })),
                  },
                },
              })
            )
          : url.endsWith('catalogue/values2variable')
            ? Promise.resolve(json({ List: [{ Code: 'A', Content: 'Selected' }] }))
            : url.endsWith('data/tablefile')
              ? Promise.resolve(new Response(csv.replace('DINSG', 'D1').replace(';DG;', ';A;')))
              : original(url, init)
      );
      const pending = importGenesisDatasetSnapshot({
        code: '12411-0001',
        userId: 'user',
        filters: {
          dimensions: Object.fromEntries(
            Array.from({ length: count }, (_, index) => [`D${index + 1}`, 'A'])
          ),
        },
      });
      if (count > 5) {
        await expect(pending).rejects.toMatchObject({ code: 'invalid_scope', httpStatus: 422 });
        expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith('data/tablefile'))).toBe(false);
      } else {
        await pending;
        const call = mocks.fetch.mock.calls.find(([url]) => url.endsWith('data/tablefile'))!;
        expect(new URLSearchParams(String(call[1].body)).get('classifyingvariable1')).toBe('D1');
        expect(new URLSearchParams(String(call[1].body)).get('classifyingkey1')).toBe('A');
      }
    }
  );
  it('imports English units with stable fallback labels when FFCSV labels are empty', async () => {
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(
            new Response(csv.replace(';Stichtag;', ';;').replace(';Bevölkerungsstand', ';'))
          )
        : original(url, init)
    );
    const result = await importGenesisDatasetSnapshot({
      code: '12411-0001',
      language: 'en',
      userId: 'user',
    });
    const saved = mocks.persist.mock.lastCall?.[0] as PersistDatasetSnapshotInput;
    expect(saved.dimensions).toContainEqual(
      expect.objectContaining({ id: 'value_unit', label: 'Unit' })
    );
    expect(saved.dimensions).toContainEqual(
      expect.objectContaining({
        id: 'value_variable_code',
        label: 'Measure',
        values: [{ id: 'BEVSTD', label: 'BEVSTD' }],
      })
    );
    expect(result.columnProfiles).toContainEqual(
      expect.objectContaining({ name: 'value', label: 'Value', role: 'measure' })
    );
    expect(result.columnProfiles).toContainEqual(
      expect.objectContaining({ name: 'observation_period', label: 'Period', role: 'time' })
    );
  });
  it('detects ZIP magic even when the content type is absent', async () => {
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(new Response(zipSync({ 'data.csv': strToU8(csv) })))
        : original(url, init)
    );
    await importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' });
    const saved = mocks.persist.mock.lastCall?.[0] as PersistDatasetSnapshotInput;
    expect(saved.table.rows).toHaveLength(1);
  });
  it('rejects valid FFCSV without observations instead of persisting an empty snapshot', async () => {
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(new Response(csv.split('\n')[0]))
        : original(url, init)
    );
    await expect(
      importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' })
    ).rejects.toMatchObject({ code: 'invalid_scope', httpStatus: 422 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('enforces the snapshot limit after decoding a smaller legacy-encoded response', async () => {
    const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(
            new Response(new Uint8Array(30 * 1024 * 1024).fill(0xe9), {
              headers: { 'Content-Type': 'text/csv;charset=windows-1252' },
            })
          )
        : original(url, init)
    );
    await expect(
      importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' })
    ).rejects.toMatchObject({ code: 'too_large', httpStatus: 413 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('loads table coverage and country selectors without downloading observations', async () => {
    const prepared = await prepareGenesisDataset('12411-0001');
    expect(prepared).toMatchObject({
      geoDimension: 'DINSG',
      estimatedBytes: null,
      timeCoverage: { start: '31.12.1950', end: '31.12.2025' },
    });
    expect(prepared.dimensions.find(item => item.id === 'DINSG')?.values).toEqual([
      { id: 'DG', label: 'Deutschland' },
    ]);
    expect(mocks.fetch.mock.calls.every(([url]) => !url.includes('data/tablefile'))).toBe(true);
  });
  it('rejects invalid codes and missing metadata before a data download', async () => {
    await expect(getGenesisTableMetadata('TABLE-1')).rejects.toMatchObject({
      code: 'invalid_scope',
    });
    mocks.fetch.mockResolvedValue(json({ Object: null }));
    await expect(
      importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' })
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it.each([false, true])(
    'imports modern FFCSV with zip=%s, dimensions, units and numeric country keys classified correctly',
    async zip => {
      if (zip)
        mocks.fetch.mockImplementation(async (url: string) =>
          url.endsWith('metadata/table')
            ? json({ Object: metadata })
            : url.endsWith('catalogue/values2variable')
              ? json({ List: [{ Code: 'DG', Content: 'Deutschland' }] })
              : new Response(zipSync({ 'folder/data.csv': strToU8(csv) }), {
                  headers: { 'Content-Type': 'application/zip' },
                })
        );
      const result = await importGenesisDatasetSnapshot({
        code: '12411-0001',
        userId: 'user',
        filters: { area: 'Deutschland', period: { start: 2025, end: 2025 } },
      });
      expect(result).toMatchObject({
        title: metadata.Content,
        providerResourceId: expect.stringMatching(/^scope:/),
        table: {
          rows: [expect.objectContaining({ DINSG: 'DG', time: '2025-12-31', value: '83467117' })],
        },
      });
      expect(result.columnProfiles).toContainEqual(
        expect.objectContaining({ name: 'DINSG', role: 'geo' })
      );
      expect(
        result
          .columnProfiles!.filter((item: any) => item.role === 'measure')
          .map((item: any) => item.name)
      ).toEqual(['value']);
      const call = mocks.fetch.mock.calls.find(([url]) => url.endsWith('data/tablefile'))!;
      expect(String(call[1].body)).toContain('regionalvariable=DINSG');
      expect(String(call[1].body)).toContain('regionalkey=DG');
      expect(String(call[1].body)).toContain('startyear=2025');
      expect(String(call[1].body)).toContain('compress=false');
    }
  );
  it('keeps full import identity separate from filtered snapshots', async () => {
    const result = await importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' });
    expect(result.providerResourceId).toBeUndefined();
  });
  it('classifies malformed variable catalogues before downloading data', async () => {
    const original = mocks.fetch.getMockImplementation();
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('catalogue/values2variable')
        ? Promise.resolve(new Response('{broken'))
        : original?.(url, init)
    );
    await expect(prepareGenesisDataset('12411-0001')).rejects.toMatchObject({
      code: 'invalid_response',
      httpStatus: 502,
    });
    expect(mocks.fetch.mock.calls.every(([url]) => !url.endsWith('data/tablefile'))).toBe(true);
  });
  it.each([
    ['JSON', '{broken', 'application/json'],
    ['ZIP', 'PKbroken', 'application/zip'],
    ['CSV', 'error;message\ninvalid;request', 'text/csv'],
  ])(
    'classifies damaged %s imports without saving a snapshot',
    async (_format, body, contentType) => {
      const original = mocks.fetch.getMockImplementation();
      mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
        url.endsWith('data/tablefile')
          ? Promise.resolve(new Response(body, { headers: { 'Content-Type': contentType } }))
          : original?.(url, init)
      );
      await expect(
        importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' })
      ).rejects.toMatchObject({ code: 'invalid_response', httpStatus: 502 });
      expect(mocks.persist).not.toHaveBeenCalled();
    }
  );
  it('rejects unavailable areas before download and detects ignored filters after download', async () => {
    await expect(
      importGenesisDatasetSnapshot({
        code: '12411-0001',
        userId: 'user',
        filters: { area: 'France' },
      })
    ).rejects.toMatchObject({ code: 'invalid_scope' });
    expect(mocks.fetch.mock.calls.every(([url]) => !url.includes('data/tablefile'))).toBe(true);
    const old = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(new Response(csv.replace('2025-12-31', '2024-12-31')))
        : old(url, init)
    );
    await expect(
      importGenesisDatasetSnapshot({
        code: '12411-0001',
        userId: 'user',
        filters: { period: { start: 2025, end: 2025 } },
      })
    ).rejects.toMatchObject({ code: 'invalid_scope' });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('classifies job-required responses and rejects changed parameter warnings without persisting', async () => {
    const old = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, init: RequestInit) =>
      url.endsWith('data/tablefile')
        ? Promise.resolve(json({ Status: { Code: 98, Type: 'Error', Content: 'job required' } }))
        : old(url, init)
    );
    await expect(
      importGenesisDatasetSnapshot({ code: '12411-0001', userId: 'user' })
    ).rejects.toMatchObject({ code: 'too_large', httpStatus: 413 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
});
