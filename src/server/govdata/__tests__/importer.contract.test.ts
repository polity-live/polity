import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_MANUAL_CSV_BYTES } from '@/features/charts/types';

const mocks = vi.hoisted(() => ({
  loadPackage: vi.fn(),
  isCsv: vi.fn(),
  normalize: vi.fn((value: unknown) => (typeof value === 'string' ? value.trim() : '')),
  parse: vi.fn(),
  safeUrl: vi.fn((value: string) => new URL(value)),
  fetch: vi.fn(),
}));

vi.mock('../catalogue', () => ({
  isGovDataCsvResource: mocks.isCsv,
  loadGovDataPackage: mocks.loadPackage,
  normalizeGovDataText: mocks.normalize,
}));
vi.mock('../csv', () => ({ parseGovDataCsvTable: mocks.parse }));
vi.mock('../safety', () => ({ assertSafePublicHttpUrl: mocks.safeUrl }));

import { createGovDataCsvSnapshot } from '../importer';

function pkg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pkg-1',
    name: 'package-name',
    title: 'Package title',
    maintainer: 'Maintainer',
    license_title: 'License',
    modified: '2025-01-01',
    organization: { title: 'Organization' },
    extras: [{ key: 'publisher_name', value: 'Publisher' }],
    resources: [
      {
        id: 'res-1',
        name: 'Resource',
        download_url: 'https://data.example/file.csv',
        modified: '2025-02-01',
        hash: 'hash-1',
      },
    ],
    ...overrides,
  };
}

function response(overrides: Partial<Response> & { contentLength?: string | null } = {}) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: vi.fn((name: string) =>
        name.toLowerCase() === 'content-length' ? (overrides.contentLength ?? null) : null
      ),
    },
    body: null,
    text: vi.fn().mockResolvedValue('a,b\n1,2'),
    ...overrides,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.loadPackage.mockResolvedValue(pkg());
  mocks.isCsv.mockReturnValue(true);
  mocks.parse.mockReturnValue({ columns: ['a', 'b'], rows: [{ a: '1', b: '2' }] });
  mocks.fetch.mockResolvedValue(response());
});

describe('createGovDataCsvSnapshot', () => {
  it('rejects omitted, missing and non-CSV resources', async () => {
    mocks.loadPackage.mockResolvedValueOnce(pkg({ resources: undefined }));
    await expect(createGovDataCsvSnapshot('pkg-1', 'missing')).rejects.toThrow(
      'GovData resource was not found'
    );
    mocks.loadPackage.mockResolvedValueOnce(pkg({ resources: [] }));
    await expect(createGovDataCsvSnapshot('pkg-1', 'missing')).rejects.toThrow(
      'GovData resource was not found'
    );
    mocks.isCsv.mockReturnValueOnce(false);
    await expect(createGovDataCsvSnapshot('pkg-1', 'res-1')).rejects.toThrow(
      'GovData resource is not an importable CSV'
    );
  });

  it('uses direct and access URL fallbacks and reports HTTP errors', async () => {
    mocks.fetch.mockResolvedValueOnce(response({ ok: false, status: 503 }));
    await expect(createGovDataCsvSnapshot('pkg-1', 'res-1')).rejects.toThrow(
      'GovData resource download failed with 503'
    );

    mocks.loadPackage.mockResolvedValueOnce(
      pkg({ resources: [{ id: 'res-1', url: 'https://data.example/direct.csv' }] })
    );
    await createGovDataCsvSnapshot('pkg-1', 'res-1');
    expect(mocks.safeUrl).toHaveBeenLastCalledWith('https://data.example/direct.csv');

    mocks.loadPackage.mockResolvedValueOnce(
      pkg({ resources: [{ id: 'res-1', access_url: 'https://data.example/access.csv' }] })
    );
    await createGovDataCsvSnapshot('pkg-1', 'res-1');
    expect(mocks.safeUrl).toHaveBeenLastCalledWith('https://data.example/access.csv');
  });

  it('rejects oversized declared and body-less text responses', async () => {
    mocks.fetch.mockResolvedValueOnce(
      response({ contentLength: String(MAX_MANUAL_CSV_BYTES + 1) })
    );
    await expect(createGovDataCsvSnapshot('pkg-1', 'res-1')).rejects.toThrow('CSV_FILE_TOO_LARGE');

    mocks.fetch.mockResolvedValueOnce(
      response({
        contentLength: 'unknown',
        text: vi.fn().mockResolvedValue('x'.repeat(MAX_MANUAL_CSV_BYTES + 1)),
      })
    );
    await expect(createGovDataCsvSnapshot('pkg-1', 'res-1')).rejects.toThrow('CSV_FILE_TOO_LARGE');
  });

  it('joins streamed chunks and ignores empty values', async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: undefined })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('a,b\n') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('1,2') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      cancel: vi.fn(),
    };
    mocks.fetch.mockResolvedValue(
      response({ contentLength: '7', body: { getReader: () => reader } as any })
    );
    const result = await createGovDataCsvSnapshot('pkg-1', 'res-1');
    expect(mocks.parse).toHaveBeenCalledWith('a,b\n1,2');
    expect(result.columns).toEqual(['a', 'b']);
  });

  it('cancels oversized streams and tolerates cancellation failure', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('closed'));
    mocks.fetch.mockResolvedValue(
      response({
        contentLength: 'unknown',
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({
              done: false,
              value: { byteLength: MAX_MANUAL_CSV_BYTES + 1 },
            }),
            cancel,
          }),
        } as any,
      })
    );
    await expect(createGovDataCsvSnapshot('pkg-1', 'res-1')).rejects.toThrow('CSV_FILE_TOO_LARGE');
    expect(cancel).toHaveBeenCalledOnce();
    await Promise.resolve();
  });

  it('returns rich provenance and a stable content snapshot hash', async () => {
    const first = await createGovDataCsvSnapshot('pkg-1', 'res-1');
    const second = await createGovDataCsvSnapshot('pkg-1', 'res-1');
    expect(first.snapshotKey).toBe(second.snapshotKey);
    expect(first.provenance).toMatchObject({
      packageId: 'pkg-1',
      packageName: 'package-name',
      packageTitle: 'Package title',
      resourceName: 'Resource',
      publisher: 'Publisher',
      organizationTitle: 'Organization',
      modified: '2025-01-01',
      resourceModified: '2025-02-01',
      licenseTitle: 'License',
      importedAt: expect.any(String),
    });
  });

  it('applies sparse provenance fallbacks', async () => {
    mocks.loadPackage.mockResolvedValue(
      pkg({
        id: null,
        name: 'fallback-name',
        title: '',
        maintainer: '',
        license_title: null,
        modified: null,
        metadata_modified: '2024-01-01',
        organization: { name: 'Fallback org' },
        extras: undefined,
        resources: [
          {
            id: 'res-1',
            name: '',
            access_url: 'https://data.example/access.csv',
            last_modified: '2024-02-01',
          },
        ],
      })
    );
    const result = await createGovDataCsvSnapshot('pkg-1', 'res-1');
    expect(result.provenance).toMatchObject({
      packageId: '',
      packageTitle: 'fallback-name',
      resourceName: 'CSV resource',
      publisher: null,
      organizationTitle: 'Fallback org',
      modified: '2024-01-01',
      resourceModified: '2024-02-01',
      licenseTitle: null,
    });
  });
});
