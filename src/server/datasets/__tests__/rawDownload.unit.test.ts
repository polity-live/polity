import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
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
  signRawDownloadTicket,
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('rejects absent signing configuration, oversized tickets and signed malformed payloads', async () => {
  const { value } = await ticket({ provider: 'EUROSTAT', providerDatasetId: 'demo' });
  for (const invalid of ['', 'x'.repeat(12_001), '.x', 'x.', 'x.y.z', '!.' + 'a'.repeat(43)]) {
    expect(() => verifyRawDownloadTicket(invalid)).toThrow(RawDownloadDenied);
  }
  for (const invalid of ['not json', JSON.stringify({ ...value, actor: 'invalid' })]) {
    const encoded = Buffer.from(invalid).toString('base64url');
    const signature = createHmac('sha256', 'unit-test-signing-key')
      .update(encoded)
      .digest('base64url');
    expect(() => verifyRawDownloadTicket(`${encoded}.${signature}`)).toThrow(RawDownloadDenied);
  }
  expect(() =>
    verifyRawDownloadTicket(signRawDownloadTicket({ ...value, expires: Date.now() + 600_000 }))
  ).toThrow('Expired');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  expect(() => signRawDownloadTicket(value)).toThrow('signing is unavailable');
});

it('requires exact snapshot, dataset and provider identities for private downloads', async () => {
  const dataset = {
    id: datasetId,
    provider: 'GOVDATA',
    provider_dataset_id: 'package',
    provider_resource_id: 'csv-resource',
    title: 'Private',
  };
  mocks.snapshot.mockResolvedValue({ dataset });
  for (const mismatch of [
    { provider: 'EUROSTAT' as const },
    { datasetId: actor },
    { providerDatasetId: 'other' },
    { providerResourceId: 'other' },
  ]) {
    await expect(
      prepareRawDownload({ provider: 'GOVDATA', snapshotId, ...mismatch }, actor)
    ).rejects.toThrow('identity mismatch');
  }
  await expect(prepareRawDownload({ provider: 'UPLOAD' }, actor)).rejects.toThrow(
    'Snapshot identity required'
  );
  await expect(prepareRawDownload({ provider: 'UPLOAD', datasetId }, actor)).rejects.toThrow(
    'Snapshot identity required'
  );
  await expect(prepareRawDownload({ provider: 'EUROSTAT' }, actor)).rejects.toMatchObject({
    code: 'invalid_scope',
  });
  await expect(
    prepareRawDownload({ provider: 'GOVDATA', providerDatasetId: 'package' }, actor)
  ).rejects.toMatchObject({ code: 'invalid_scope' });
  await expect(
    prepareRawDownload({ provider: 'GENESIS_DESTATIS', providerDatasetId: 'bad' }, actor)
  ).rejects.toMatchObject({ code: 'invalid_scope' });
});

it('resolves registry access URLs and sanitizes decoded file names including control characters', async () => {
  const input = {
    provider: 'GOVDATA' as const,
    providerDatasetId: 'package',
    providerResourceId: 'csv-resource',
  };
  for (const [url, expected] of [
    ['https://source.example/%00%7Fbad%3C%3E.csv', '__bad__.csv'],
    ['https://source.example/%E0%A4%A', 'dataset.csv'],
    ['https://source.example/', 'dataset.csv'],
    ['https://source.example/...', 'dataset.csv'],
  ]) {
    mocks.pkg.mockResolvedValueOnce({ resources: [{ id: 'csv-resource', access_url: url }] });
    expect((await prepareRawDownload(input, actor)).fileName).toBe(expected);
  }
  mocks.pkg.mockResolvedValueOnce({});
  await expect(prepareRawDownload(input, actor)).rejects.toMatchObject({ code: 'unavailable' });
});

it('rejects revoked or missing stored files and refuses storage redirects', async () => {
  mocks.snapshot.mockResolvedValue({
    storage_bucket: 'bucket',
    storage_path: 'file',
    dataset: {
      id: datasetId,
      provider: 'UPLOAD',
      provider_dataset_id: null,
      provider_resource_id: null,
      title: 'private',
    },
  });
  const { value } = await ticket({ provider: 'UPLOAD', snapshotId });
  for (const unavailable of [{ error: new Error('denied') }, { data: null }, { data: {} }]) {
    mocks.storage.mockResolvedValueOnce(unavailable);
    await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
      code: 'unavailable',
    });
  }
  mocks.storage.mockResolvedValue({ data: { signedUrl: 'http://127.0.0.1/storage/file' } });
  mocks.fetch.mockResolvedValue(
    new Response(null, { status: 302, headers: { Location: 'https://source.example/file' } })
  );
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'invalid_response',
  });
});

it('follows safe relative redirects and classifies missing redirects, unavailable bodies and network errors', async () => {
  const { value } = await ticket({
    provider: 'GOVDATA',
    providerDatasetId: 'package',
    providerResourceId: 'csv-resource',
  });
  mocks.fetch
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: '/new.csv' } }))
    .mockResolvedValueOnce(new Response('data'));
  expect(await (await streamRawDownload(value, new AbortController().signal)).text()).toBe('data');
  expect(String(mocks.fetch.mock.calls[1][0])).toBe('https://source.example/new.csv');
  mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 302 }));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'invalid_response',
  });
  mocks.fetch.mockResolvedValueOnce(new Response('error', { status: 404 }));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'unavailable',
  });
  mocks.fetch.mockRejectedValueOnce(new TypeError('network details'));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'unavailable',
    message: 'Source connection failed',
  });
  mocks.fetch.mockResolvedValue(
    new Response(null, { status: 302, headers: { Location: '/loop' } })
  );
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toThrow(
    'Too many source redirects'
  );
});

it('expires a stalled source connection and preserves browser cancellation', async () => {
  vi.useFakeTimers();
  const { value } = await ticket({ provider: 'EUROSTAT', providerDatasetId: 'demo' });
  mocks.fetch.mockImplementation(
    (_url: URL, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
      })
  );
  const timeout = expect(
    streamRawDownload(value, new AbortController().signal)
  ).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(120_000);
  await timeout;
  const controller = new AbortController();
  const aborted = expect(streamRawDownload(value, controller.signal)).rejects.toThrow(
    'caller stopped'
  );
  await vi.advanceTimersByTimeAsync(0);
  controller.abort(new Error('caller stopped'));
  await aborted;
});

it('rejects empty and missing provider bodies, invalid status envelopes and oversized control responses', async () => {
  const { value } = await ticket({ provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' });
  mocks.genesis.mockResolvedValueOnce(new Response(null));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toThrow(
    'Source returned no file'
  );
  mocks.genesis.mockResolvedValueOnce(new Response(''));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toThrow(
    'empty file'
  );
  mocks.genesis.mockResolvedValueOnce(new Response('{invalid'));
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toThrow(
    'Invalid provider status response'
  );
  let count = 0;
  mocks.genesis.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        cancel() {
          throw new Error('provider cancellation failed');
        },
        pull(controller) {
          if (count++ < 5) controller.enqueue(new TextEncoder().encode('{' + 'x'.repeat(65_536)));
          else controller.close();
        },
      })
    )
  );
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toThrow(
    'did not return a downloadable file'
  );
  mocks.genesis.mockResolvedValueOnce(
    new Response('<error/>', { headers: { 'Content-Type': 'text/html' } })
  );
  await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
    code: 'invalid_response',
  });
});

it('rejects reversed or absent GENESIS time bounds and uses English for French requests', async () => {
  const { value } = await ticket({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: '13211-0002',
    language: 'fr',
  });
  for (const entry of [{ Time: { From: '2026', To: '2025' } }, { Time: { From: '2025' } }, {}]) {
    mocks.metadata.mockResolvedValueOnce(entry);
    await expect(streamRawDownload(value, new AbortController().signal)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  }
  mocks.genesis.mockResolvedValue(new Response('CSV'));
  expect(await (await streamRawDownload(value, new AbortController().signal)).text()).toBe('CSV');
  expect(mocks.genesis.mock.calls[0][1].language).toBe('en');
});

it('preserves compressed extensions, encodes download names and cancels an active transfer', async () => {
  for (const name of ['archive', 'archive.zip']) {
    mocks.pkg.mockResolvedValueOnce({
      resources: [{ id: 'csv-resource', download_url: `https://source.example/${name}` }],
    });
    const { value } = await ticket({
      provider: 'GOVDATA',
      providerDatasetId: 'package',
      providerResourceId: 'csv-resource',
    });
    mocks.pkg.mockResolvedValueOnce({
      resources: [{ id: 'csv-resource', download_url: `https://source.example/${name}` }],
    });
    mocks.fetch.mockResolvedValueOnce(new Response(new Uint8Array([0x50, 0x4b, 1])));
    const response = await streamRawDownload(value, new AbortController().signal);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toContain('archive.zip');
    await response.arrayBuffer();
  }
  mocks.pkg.mockResolvedValue({
    resources: [{ id: 'csv-resource', url: "https://source.example/data('%C3%A4).gz" }],
  });
  const { value } = await ticket({
    provider: 'GOVDATA',
    providerDatasetId: 'package',
    providerResourceId: 'csv-resource',
  });
  const cancel = vi.fn();
  mocks.fetch.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(64).fill(65));
        },
        cancel,
      })
    )
  );
  const response = await streamRawDownload(value, new AbortController().signal);
  expect(response.headers.get('Content-Disposition')).toContain('%28%27%C3%A4%29');
  await response.body!.cancel('browser cancelled');
  expect(cancel).toHaveBeenCalledWith('browser cancelled');
  mocks.fetch.mockResolvedValueOnce(new Response(new Uint8Array([0x1f, 0x8b])));
  const compressed = await streamRawDownload(value, new AbortController().signal);
  expect(compressed.headers.get('Content-Disposition')).not.toContain('.gz.gz');
  await compressed.arrayBuffer();
});

it('propagates a source read failure after the initial probe and ignores empty chunks', async () => {
  const { value } = await ticket({ provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' });
  let count = 0;
  const error = new Error('source read failed');
  mocks.genesis.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        pull(controller) {
          if (count++ === 0) controller.enqueue(new Uint8Array());
          else if (count === 2) controller.enqueue(new Uint8Array(64).fill(65));
          else controller.error(error);
        },
      })
    )
  );
  const response = await streamRawDownload(value, new AbortController().signal);
  await expect(response.text()).rejects.toBe(error);
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
