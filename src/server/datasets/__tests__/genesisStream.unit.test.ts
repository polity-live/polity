import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { postGenesis, postGenesisStream } from '../genesisTransport';
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GENESIS_API_TOKEN', 'test-token');
});

it('requires configured credentials and uses the configured base for form-encoded downloads', async () => {
  vi.stubEnv('GENESIS_API_TOKEN', '');
  await expect(postGenesisStream('data/tablefile', {})).rejects.toMatchObject({
    code: 'authentication',
    httpStatus: 503,
  });
  expect(fetchMock).not.toHaveBeenCalled();
  vi.stubEnv('GENESIS_API_TOKEN', 'test-token');
  vi.stubEnv('GENESIS_BASE_URL', 'https://genesis.test/rest');
  fetchMock.mockResolvedValue(new Response('CSV'));
  expect(
    await (
      await postGenesisStream('data/tablefile', { name: '13211-0002', compress: false, year: 2025 })
    ).text()
  ).toBe('CSV');
  expect(fetchMock.mock.calls[0][0]).toBe('https://genesis.test/rest/data/tablefile');
  expect(String(fetchMock.mock.calls[0][1].body)).toBe('name=13211-0002&compress=false&year=2025');
});

it.each([401, 403, 404])(
  'classifies a rejected download status %s and releases the queue',
  async status => {
    const source = new Response('error', { status });
    const cancel = vi.spyOn(source.body!, 'cancel');
    fetchMock.mockResolvedValueOnce(source).mockResolvedValueOnce(new Response('next'));
    await expect(
      postGenesisStream('data/tablefile', { name: String(status) })
    ).rejects.toMatchObject({
      code: status === 404 ? 'unavailable' : 'authentication',
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(await (await postGenesisStream('data/tablefile', { name: 'next' })).text()).toBe('next');
  }
);

it('classifies connection failures and a second transient response without another retry', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('secret connection details'));
  await expect(postGenesisStream('network', {})).rejects.toMatchObject({
    code: 'unavailable',
    message: 'GENESIS connection failed',
  });
  vi.useFakeTimers();
  fetchMock
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 502 }));
  const rejected = expect(postGenesisStream('repeated', {})).rejects.toMatchObject({
    code: 'unavailable',
    message: 'GENESIS download is unavailable',
  });
  await vi.advanceTimersByTimeAsync(300);
  await rejected;
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('expires an active connection and refuses a pre-cancelled request without fetching', async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
      })
  );
  const pending = expect(postGenesisStream('timeout', {}, { timeoutMs: 10 })).rejects.toMatchObject(
    { code: 'timeout' }
  );
  await vi.advanceTimersByTimeAsync(10);
  await pending;
  const controller = new AbortController();
  controller.abort(new Error('caller stopped'));
  await expect(postGenesisStream('stopped', {}, { signal: controller.signal })).rejects.toThrow(
    'caller stopped'
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('keeps queued callers ordered after a preceding buffered request fails', async () => {
  let reject!: (error: Error) => void;
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    )
    .mockResolvedValueOnce(new Response('CSV'));
  const first = expect(postGenesis('preceding', {})).rejects.toMatchObject({ code: 'unavailable' });
  await vi.waitFor(() => expect(reject).toBeDefined());
  const next = postGenesisStream('data/tablefile', {});
  reject(new Error('failed'));
  await first;
  expect(await (await next).text()).toBe('CSV');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('keeps the shared credential queue locked through the raw body and does not merge two downloads', async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  fetchMock.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          source = controller;
          controller.enqueue(new Uint8Array([65]));
        },
      })
    )
  );
  fetchMock.mockResolvedValueOnce(new Response('second CSV'));
  const first = await postGenesisStream('data/tablefile', { name: '13211-0002' });
  const next = postGenesisStream('data/tablefile', { name: '13211-0002' });
  await Promise.resolve();
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledOnce();
  source.close();
  expect(await first.text()).toBe('A');
  expect(await (await next).text()).toBe('second CSV');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('retries one transient response after 300ms and releases the queue after transfer', async () => {
  vi.useFakeTimers();
  fetchMock
    .mockResolvedValueOnce(new Response('failure', { status: 500 }))
    .mockResolvedValueOnce(new Response('CSV'));
  const pending = postGenesisStream('data/tablefile', { name: '13211-0002' });
  await vi.advanceTimersByTimeAsync(299);
  expect(fetchMock).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(await (await pending).text()).toBe('CSV');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('removes cancelled waiters promptly without allowing later requests to bypass the active transfer', async () => {
  vi.useFakeTimers();
  fetchMock
    .mockResolvedValueOnce(new Response(new ReadableStream()))
    .mockResolvedValueOnce(Response.json({ Tables: [] }));
  const first = await postGenesisStream('data/tablefile', { name: '13211-0002' });
  const expired = expect(
    postGenesisStream('data/tablefile', { name: '12411-0001' }, { timeoutMs: 100 })
  ).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(100);
  await expired;
  const later = postGenesis('find/find', { term: 'Population', category: 'tables' });
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledOnce();
  await first.body!.cancel();
  expect(await (await later).json()).toEqual({ Tables: [] });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('releases a cancelled raw transfer so regular buffered catalogue requests continue', async () => {
  const cancel = vi.fn();
  fetchMock
    .mockResolvedValueOnce(new Response(new ReadableStream({ cancel })))
    .mockResolvedValueOnce(Response.json({ Tables: [] }));
  const abort = new AbortController();
  const first = await postGenesisStream(
    'data/tablefile',
    { name: '13211-0002' },
    { signal: abort.signal }
  );
  const next = postGenesis('find/find', { term: 'Prices', category: 'tables' });
  const failed = expect(first.body!.getReader().read()).rejects.toMatchObject({
    name: 'AbortError',
  });
  abort.abort();
  await failed;
  expect(await (await next).json()).toEqual({ Tables: [] });
  expect(cancel).toHaveBeenCalledOnce();
});
