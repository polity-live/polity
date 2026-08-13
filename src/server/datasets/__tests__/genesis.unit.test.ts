import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  parseCsv: vi.fn(),
  persist: vi.fn(),
  readBytes: vi.fn(),
  bytesToText: vi.fn(),
  unzip: vi.fn(),
}));

vi.mock('../csv', () => ({ parseDatasetCsv: mocks.parseCsv }));
vi.mock('../service', () => ({ persistDatasetSnapshot: mocks.persist }));
vi.mock('../storage', () => ({
  readLimitedResponseBytes: mocks.readBytes,
  bytesToText: mocks.bytesToText,
}));
vi.mock('../zip', () => ({ unzipFirstTextFile: mocks.unzip }));

import { importGenesisDatasetSnapshot, searchGenesisDatasets } from '../genesis';

function response({
  ok = true,
  status = 200,
  json = {},
  contentType = null,
}: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  contentType?: string | null;
} = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(json),
    headers: { get: vi.fn().mockReturnValue(contentType) },
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  delete process.env.GENESIS_BASE_URL;
  process.env.GENESIS_API_TOKEN = 'test-token';
  mocks.parseCsv.mockReturnValue({ columns: ['year'], rows: [['2025']] });
  mocks.persist.mockImplementation(async value => ({ id: 'snapshot-1', ...value }));
  mocks.readBytes.mockResolvedValue(new Uint8Array([0x31, 0x2c, 0x32]));
  mocks.bytesToText.mockReturnValue('year,value\n2025,2');
  mocks.unzip.mockReturnValue('year,value\n2025,3');
});

describe('searchGenesisDatasets', () => {
  it('does not call GENESIS for blank or one-character terms', async () => {
    await expect(searchGenesisDatasets('  ')).resolves.toEqual([]);
    await expect(searchGenesisDatasets(' x ')).resolves.toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('requires an API token before sending a request', async () => {
    delete process.env.GENESIS_API_TOKEN;
    await expect(searchGenesisDatasets('population')).rejects.toThrow(
      'GENESIS_API_TOKEN is not configured'
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('reports non-successful GENESIS responses with their status', async () => {
    mocks.fetch.mockResolvedValue(response({ ok: false, status: 503 }));
    await expect(searchGenesisDatasets('population')).rejects.toThrow(
      'GENESIS request failed with 503'
    );
  });

  it('maps all supported catalogue field aliases and filters incomplete entries', async () => {
    mocks.fetch.mockResolvedValue(
      response({
        json: {
          List: [
            {
              Code: 'A-1',
              Content: 'Population',
              Information: 'Primary information',
              LatestUpdate: '2026-01-01',
              Time: 'annual',
              State: 'current',
            },
            {
              Code: null,
              Name: 'B-2',
              Content: null,
              Title: 'Employment',
              Information: null,
              Description: 'Secondary information',
              LatestUpdate: null,
              Date: '2025-12-01',
              Time: null,
              State: 'archived',
            },
            {
              Code: undefined,
              Name: null,
              name: 'C-3',
              Content: undefined,
              Title: null,
              title: 'Prices',
              Information: undefined,
              Description: undefined,
              LatestUpdate: undefined,
              Date: undefined,
              Time: undefined,
              State: null,
              Type: 'index',
            },
            { Code: null, Name: null, name: null, Content: 'Missing code' },
            { Code: 'D-4', Content: null, Title: null, title: null },
          ],
        },
      })
    );

    await expect(searchGenesisDatasets('  labour  ')).resolves.toEqual([
      expect.objectContaining({
        id: 'genesis:A-1',
        providerDatasetId: 'A-1',
        title: 'Population',
        description: 'Primary information',
        modified: '2026-01-01',
        structureSummary: 'annual',
        valueSummary: 'current',
      }),
      expect.objectContaining({
        id: 'genesis:B-2',
        title: 'Employment',
        description: 'Secondary information',
        modified: '2025-12-01',
        structureSummary: 'archived',
      }),
      expect.objectContaining({
        id: 'genesis:C-3',
        title: 'Prices',
        description: null,
        modified: null,
        structureSummary: 'index',
        valueSummary: null,
      }),
    ]);

    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://genesis.destatis.de/genesisWS/rest/2020/find/find');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        username: 'test-token',
        password: '',
      },
    });
    expect(String(init.body)).toBe('term=labour&category=all&pagelength=20&language=de');
  });

  it('uses a configured base URL, custom language and limit, and handles non-list bodies', async () => {
    process.env.GENESIS_BASE_URL = 'https://genesis.example/custom';
    mocks.fetch
      .mockResolvedValueOnce(response({ json: { List: [{ Code: 'A', Content: 'One' }] } }))
      .mockResolvedValueOnce(response({ json: null }));

    await expect(searchGenesisDatasets('query', 'en', 1)).resolves.toHaveLength(1);
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://genesis.example/custom/find/find');
    expect(String((mocks.fetch.mock.calls[0]?.[1] as RequestInit | undefined)?.body)).toContain(
      'language=en'
    );
    await expect(searchGenesisDatasets('query', 'en', 2)).resolves.toEqual([]);
  });
});

describe('importGenesisDatasetSnapshot', () => {
  it('requires a non-empty dataset code', async () => {
    await expect(importGenesisDatasetSnapshot({ code: '  ', userId: 'user-1' })).rejects.toThrow(
      'GENESIS dataset code is required'
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('unzips content declared as ZIP without inspecting the magic byte', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response({ contentType: 'application/zip' }))
      .mockResolvedValueOnce(response({ json: { List: [] } }));
    mocks.readBytes.mockResolvedValue(new Uint8Array([0x00]));

    await importGenesisDatasetSnapshot({ code: '  TABLE-1 ', userId: 'user-1' });
    expect(mocks.unzip).toHaveBeenCalledWith(new Uint8Array([0x00]));
    expect(mocks.bytesToText).not.toHaveBeenCalled();
    expect(mocks.parseCsv).toHaveBeenCalledWith('year,value\n2025,3');
  });

  it('detects ZIP files by their magic byte when the content type is not ZIP', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response({ contentType: 'application/octet-stream' }))
      .mockResolvedValueOnce(response({ json: { List: [] } }));
    mocks.readBytes.mockResolvedValue(new Uint8Array([0x50, 0x4b]));

    await importGenesisDatasetSnapshot({ code: 'TABLE-1', language: 'en', userId: 'user-1' });
    expect(mocks.unzip).toHaveBeenCalled();
  });

  it('surfaces a GENESIS JSON error message and its generic fallback', async () => {
    mocks.fetch.mockResolvedValue(response());
    mocks.bytesToText.mockReturnValueOnce(' {"Status":{"Code":1,"Content":"No access"}} ');
    await expect(
      importGenesisDatasetSnapshot({ code: 'TABLE-1', userId: 'user-1' })
    ).rejects.toThrow('No access');

    mocks.bytesToText.mockReturnValueOnce('{"Status":{"Code":2}}');
    await expect(
      importGenesisDatasetSnapshot({ code: 'TABLE-1', userId: 'user-1' })
    ).rejects.toThrow('GENESIS dataset could not be downloaded');
    expect(mocks.parseCsv).not.toHaveBeenCalled();
  });

  it('persists a plain-text table with catalogue metadata', async () => {
    mocks.fetch.mockResolvedValueOnce(response({ contentType: null })).mockResolvedValueOnce(
      response({
        json: {
          List: [
            {
              Code: 'TABLE-1',
              Content: 'Population table',
              Information: 'A description',
              Time: 'annual',
            },
          ],
        },
      })
    );

    await expect(
      importGenesisDatasetSnapshot({ code: ' TABLE-1 ', userId: 'user-1' })
    ).resolves.toMatchObject({ id: 'snapshot-1', title: 'Population table' });
    expect(mocks.bytesToText).toHaveBeenCalled();
    expect(mocks.persist).toHaveBeenCalledWith({
      provider: 'GENESIS_DESTATIS',
      providerDatasetId: 'TABLE-1',
      title: 'Population table',
      description: 'A description',
      publisher: 'Statistisches Bundesamt (Destatis)',
      sourceUrl: 'https://www-genesis.destatis.de/genesis/online',
      structureSummary: 'annual',
      metadata: expect.objectContaining({ Code: 'TABLE-1', source: 'GENESIS/Destatis' }),
      createdById: 'user-1',
      table: { columns: ['year'], rows: [['2025']] },
    });
  });

  it('falls back to the code and empty metadata when catalogue lookup has no result', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response({ contentType: 'text/csv' }))
      .mockResolvedValueOnce(response({ json: { unexpected: true } }));

    await importGenesisDatasetSnapshot({ code: 'TABLE-2', language: 'en', userId: 'user-2' });
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        providerDatasetId: 'TABLE-2',
        title: 'TABLE-2',
        description: undefined,
        sourceUrl: undefined,
        structureSummary: undefined,
        metadata: { source: 'GENESIS/Destatis' },
      })
    );
  });
});
