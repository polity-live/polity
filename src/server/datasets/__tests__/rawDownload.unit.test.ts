import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  pkg: vi.fn(),
  fetch: vi.fn(),
  storage: vi.fn(),
  genesis: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock('../service', () => ({ loadRawSnapshotRecord: mocks.snapshot }));
vi.mock('@/server/govdata/catalogue', () => ({ loadGovDataPackage: mocks.pkg }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ storage: { from: () => ({ createSignedUrl: mocks.storage }) } }),
}));
vi.mock('../genesis', () => ({ getGenesisTableMetadata: mocks.metadata }));
vi.mock('../genesisTransport', async original => ({
  ...(await original<typeof import('../genesisTransport')>()),
  postGenesisStream: mocks.genesis,
}));
import {
  prepareRawDownload,
  verifyRawDownloadTicket,
  streamRawDownload,
  RawDownloadDenied,
  rawDownloadRequestSchema,
} from '../rawDownload';
const actor = '00000000-0000-4000-8000-000000000001';
const snapshotId = '00000000-0000-4000-8000-000000000002';
const datasetId = '00000000-0000-4000-8000-000000000003';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'unit-test-signing-key');
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.metadata.mockResolvedValue({ Time: { From: '2005', To: '2026' } });
  mocks.pkg.mockResolvedValue({
    resources: [{ id: 'csv-resource', url: 'https://source.example/original.csv' }],
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function ticket(input: Parameters<typeof prepareRawDownload>[0]) {
  const prepared = await prepareRawDownload(input, actor);
  return {
    prepared,
    value: verifyRawDownloadTicket(
      new URL(prepared.url, 'http://localhost').searchParams.get('ticket')!
    ),
  };
}
it('binds identity and actor to an expiring signature and rejects filters, forged tickets and expiry', async () => {
  const { prepared, value } = await ticket({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: '13211-0002',
    language: 'de',
  });
  expect(prepared).toMatchObject({
    fileName: '13211-0002.csv',
    fullDataset: true,
    kind: 'provider',
  });
  expect(value.actor).toBe(actor);
  expect(value.selection.providerDatasetId).toBe('13211-0002');
  const token = new URL(prepared.url, 'http://localhost').searchParams.get('ticket')!;
  expect(() => verifyRawDownloadTicket(token, value.expires + 1)).toThrow(RawDownloadDenied);
  expect(() => verifyRawDownloadTicket(token + '!')).toThrow(RawDownloadDenied);
  const [body, signature] = token.split('.');
  const changed = Buffer.from(JSON.stringify({ ...value, actor: datasetId })).toString('base64url');
  expect(() => verifyRawDownloadTicket(`${changed}.${signature}`)).toThrow(RawDownloadDenied);
  expect(() => verifyRawDownloadTicket(`${body}.invalid`)).toThrow(RawDownloadDenied);
  expect(() =>
    rawDownloadRequestSchema.parse({
      provider: 'EUROSTAT',
      providerDatasetId: 'une_rt_m',
      filters: { area: 'DE' },
    })
  ).toThrow();
});
it('streams GovData bytes without decoding or parsing and checks redirect destinations', async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0xe4, 0xff, 0x0a, 0x00]);
  mocks.fetch.mockResolvedValue(new Response(bytes));
  const { value } = await ticket({
    provider: 'GOVDATA',
    providerDatasetId: 'package',
    providerResourceId: 'csv-resource',
  });
  const response = await streamRawDownload(value, new AbortController().signal);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get('content-disposition')).toContain('original.csv');
  expect(mocks.fetch.mock.calls[0][1].redirect).toBe('manual');
  mocks.fetch.mockResolvedValueOnce(
    new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } })
  );
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'unavailable',
  });
  await expect(
    prepareRawDownload(
      { provider: 'GOVDATA', providerDatasetId: 'package', providerResourceId: 'other' },
      actor
    )
  ).rejects.toMatchObject({ code: 'unavailable' });
});
it('streams more than the 50-MiB import limit using bounded chunks, without materializing the file', async () => {
  const chunk = new Uint8Array(1024 * 1024).fill(65);
  let remaining = 51;
  mocks.fetch.mockResolvedValue(
    new Response(
      new ReadableStream({
        pull(controller) {
          if (remaining--) controller.enqueue(chunk);
          else controller.close();
        },
      }),
      { headers: { 'Content-Length': String(51 * chunk.length) } }
    )
  );
  const { value } = await ticket({
    provider: 'GOVDATA',
    providerDatasetId: 'package',
    providerResourceId: 'csv-resource',
  });
  const response = await streamRawDownload(value, new AbortController().signal);
  const reader = response.body!.getReader();
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    expect(next.value[0]).toBe(65);
  }
  expect(size).toBe(51 * 1024 * 1024);
  expect(response.headers.get('content-length')).toBeNull();
});
it('requests the complete Eurostat file without dimension, time or observation filters and preserves compression', async () => {
  const gzip = new Uint8Array([0x1f, 0x8b, 1, 2, 3]);
  mocks.fetch.mockResolvedValue(new Response(gzip));
  const { value } = await ticket({ provider: 'EUROSTAT', providerDatasetId: 'une_rt_m' });
  const response = await streamRawDownload(value, new AbortController().signal);
  const url = new URL(String(mocks.fetch.mock.calls[0][0]));
  expect(
    [...url.searchParams.keys()].some(
      key => key.startsWith('c[') || /period|observations/i.test(key)
    )
  ).toBe(false);
  expect(url.searchParams.get('compressed')).toBe('true');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(gzip);
  expect(response.headers.get('content-disposition')).toContain('une_rt_m.csv.gz');
});
it('requests the exact complete GENESIS table and refuses status envelopes instead of saving them as CSV', async () => {
  const bytes = new TextEncoder().encode('statistics_code;time;value\n13211;2025;1\n');
  mocks.genesis.mockResolvedValue(new Response(bytes));
  const { value } = await ticket({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: '13211-0002',
    language: 'de',
  });
  const response = await streamRawDownload(value, new AbortController().signal);
  expect(mocks.genesis.mock.calls[0][1]).toEqual({
    name: '13211-0002',
    area: 'free',
    format: 'ffcsv',
    compress: false,
    language: 'de',
    startyear: '2005',
    endyear: '2026',
  });
  expect(
    createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex')
  ).toBe(createHash('sha256').update(bytes).digest('hex'));
  mocks.genesis.mockResolvedValueOnce(
    Response.json({
      Status: { Code: 999, Type: 'Error', Content: 'Hintergrundverarbeitung' },
      Parameters: { username: 'do-not-echo' },
    })
  );
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'too_large',
  });
  mocks.genesis.mockResolvedValueOnce(Response.json({ Status: { Code: 0, Type: 'Information' } }));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'invalid_response',
  });
});
it('recovers a stored CSV without a readiness/parser dependency, and rechecks revoked access at transfer time', async () => {
  mocks.snapshot.mockResolvedValue({
    status: 'error',
    storage_bucket: 'dataset-snapshots',
    storage_path: 'protected/snapshot.csv',
    dataset: {
      id: datasetId,
      provider: 'UPLOAD',
      provider_dataset_id: 'data.csv',
      provider_resource_id: null,
      title: 'Private data',
    },
  });
  mocks.storage.mockResolvedValue({
    data: { signedUrl: 'http://127.0.0.1:54321/storage/private.csv' },
  });
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([0xe4, 0x0a])));
  const { prepared, value } = await ticket({ provider: 'UPLOAD', datasetId, snapshotId });
  expect(prepared.kind).toBe('snapshot');
  expect(prepared.fullDataset).toBe(false);
  const response = await streamRawDownload(value, new AbortController().signal);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xe4, 0x0a]));
  expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  expect(mocks.snapshot).toHaveBeenLastCalledWith(snapshotId, actor);
  mocks.snapshot.mockRejectedValueOnce(new Error('Access denied'));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toBeInstanceOf(
    RawDownloadDenied
  );
  mocks.snapshot.mockRejectedValueOnce(new Error('Not found'));
  await expect(
    prepareRawDownload(
      { provider: 'UPLOAD', datasetId, snapshotId: '00000000-0000-4000-8000-000000000004' },
      actor
    )
  ).rejects.toBeInstanceOf(RawDownloadDenied);
});

it('detects a GENESIS error envelope even when the BOM and JSON are split across tiny chunks', async () => {
  const raw = new TextEncoder().encode(
    '\uFEFF  ' +
      JSON.stringify({ Status: { Code: 999, Type: 'Error', Content: 'Hintergrundverarbeitung' } })
  );
  let offset = 0;
  mocks.genesis.mockResolvedValue(
    new Response(
      new ReadableStream({
        pull(controller) {
          if (offset < raw.length) controller.enqueue(raw.subarray(offset, ++offset));
          else controller.close();
        },
      })
    )
  );
  const { value } = await ticket({ provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' });
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'too_large',
  });
});

it('refuses a silently restricted GENESIS download if complete source bounds cannot be determined', async () => {
  mocks.metadata.mockResolvedValue({ Time: { To: '2026' } });
  const { value } = await ticket({ provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' });
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'invalid_response',
  });
  expect(mocks.genesis).not.toHaveBeenCalled();
});
