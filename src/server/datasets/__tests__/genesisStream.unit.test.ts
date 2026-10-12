import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { postGenesis, postGenesisStream } from '../genesisTransport';
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GENESIS_API_TOKEN', 'test-token');
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
