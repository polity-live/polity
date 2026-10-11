import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), persist: vi.fn() }));
vi.mock('../service', () => ({ persistDatasetSnapshot: mocks.persist }));
import {
  searchGenesisDatasets,
  importGenesisDatasetSnapshot,
  getGenesisTableMetadata,
  prepareGenesisDataset,
} from '../genesis';
import { assertGenesisStatus, postGenesis } from '../genesisTransport';
import { clearDatasetSearchCache } from '../searchRuntime';

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
