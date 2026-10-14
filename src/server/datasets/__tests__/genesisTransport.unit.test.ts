import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertGenesisStatus, postGenesis, readGenesisJson } from '../genesisTransport';

beforeEach(() => {
  vi.stubEnv('GENESIS_API_TOKEN', 'transport-boundaries');
  vi.stubEnv('GENESIS_BASE_URL', 'https://genesis.test/');
});

it('rejects missing transport credentials and classifies buffered authentication failures', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  vi.stubEnv('GENESIS_API_TOKEN', '');
  await expect(postGenesis('missing-token', {})).rejects.toMatchObject({ code: 'authentication' });
  expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv('GENESIS_API_TOKEN', 'transport-boundaries');
  fetch.mockResolvedValue(new Response(null, { status: 403 }));
  await expect(postGenesis('forbidden', {})).rejects.toMatchObject({
    code: 'authentication',
    upstreamStatus: 403,
  });
});

it('retries a buffered request once while decrementing its shared budget', async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('retry', { status: 500 }))
    .mockResolvedValueOnce(new Response('CSV'));
  vi.stubGlobal('fetch', fetch);
  const budget = { remaining: 2 };
  const pending = postGenesis('budget-retry', {}, { budget });
  await vi.advanceTimersByTimeAsync(300);
  expect(await (await pending).text()).toBe('CSV');
  expect(budget.remaining).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not retry an exhausted buffered budget and rejects an oversized successful response', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('retry', { status: 503 }))
    .mockResolvedValueOnce(new Response('too big'));
  vi.stubGlobal('fetch', fetch);
  await expect(
    postGenesis('exhausted-after-request', {}, { budget: { remaining: 1 } })
  ).rejects.toMatchObject({ code: 'unavailable' });
  await expect(postGenesis('oversized', {}, { maxBytes: 1 })).rejects.toMatchObject({
    code: 'too_large',
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('allows known and permissive warning statuses while refusing strict warnings and authentication errors', () => {
  expect(() => assertGenesisStatus({ Status: { Code: 104 } })).not.toThrow();
  expect(() => assertGenesisStatus({ Status: { Code: 23, Type: 'Warning' } })).not.toThrow();
  expect(() => assertGenesisStatus({ Status: { Code: 23, Type: 'Warnung' } }, true)).toThrow(
    'filter parameters'
  );
  expect(() =>
    assertGenesisStatus({ Status: { Code: 23, Type: 'Error', Content: 'Invalid token' } })
  ).toThrow('authentication');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GENESIS transport boundaries', () => {
  it('observes cancellation while disposing the first failed response before retrying', async () => {
    const controller = new AbortController();
    const response = new Response('retry', { status: 500 });
    vi.spyOn(response.body!, 'cancel').mockImplementation(async () => {
      controller.abort();
    });
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    await expect(
      postGenesis('dispose-abort', {}, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('starts a fresh flight after the last caller cancels while the abandoned request settles late', async () => {
    let release!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>(resolve => {
            release = resolve;
          })
      )
      .mockResolvedValue(new Response('fresh'));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const abandoned = postGenesis('replacement', {}, { signal: controller.signal });
    const assertion = expect(abandoned).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(release).toBeDefined());
    controller.abort();
    await assertion;
    const fresh = postGenesis('replacement', {});
    release(new Response('stale'));
    expect(await (await fresh).text()).toBe('fresh');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects pre-cancelled callers and exhausted budgets without fetching', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(
      postGenesis('catalogue/tables', {}, { signal: controller.signal })
    ).rejects.toThrow('cancelled');
    await expect(
      postGenesis('catalogue/tables', {}, { budget: { remaining: 0 } })
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('classifies network failure while releasing a rejected credential queue for its successor', async () => {
    let reject!: (error: Error) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          })
      )
      .mockResolvedValue(new Response('next'));
    vi.stubGlobal('fetch', fetch);
    const first = postGenesis('first', {});
    const assertion = expect(first).rejects.toMatchObject({ code: 'unavailable' });
    const next = postGenesis('next', {});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    reject(new TypeError('connection closed'));
    await assertion;
    expect(await (await next).text()).toBe('next');
  });
  it('cancels during the retry delay without making a second request', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(new Response('retry', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const pending = postGenesis('retry-abort', {}, { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(300);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('preserves timeout errors raised while fetch is active', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
          )
      )
    );
    const pending = postGenesis('fetch-timeout', {}, { timeoutMs: 10 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });
  it('preserves caller cancellation while a response body is streaming', async () => {
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                stream = controller;
              },
            })
          )
      )
    );
    const controller = new AbortController();
    const pending = postGenesis('stream-abort', {}, { signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow('stream cancelled');
    await vi.waitFor(() => expect(stream).toBeDefined());
    controller.abort(new Error('stream cancelled'));
    stream.error(new TypeError('stream closed'));
    await assertion;
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  it('allows one subscriber to cancel while another receives the same completed response', async () => {
    let release!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          release = resolve;
        })
    );
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const first = postGenesis('shared', {}, { signal: controller.signal });
    const assertion = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const other = postGenesis('shared', {});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    controller.abort();
    await assertion;
    release(new Response('retained'));
    expect(await (await other).text()).toBe('retained');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('keeps the original caller signal if the borrowed options object changes while waiting', async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(resolve => {
            release = resolve;
          })
      )
    );
    const controller = new AbortController();
    const options: { signal?: AbortSignal } = { signal: controller.signal };
    const pending = postGenesis('borrowed-options', {}, options);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(release).toBeDefined());
    options.signal = undefined;
    controller.abort();
    await assertion;
    release(new Response('late'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  it('uses a legacy AbortSignal fallback when no reason is exposed', async () => {
    const controller = new AbortController();
    Object.defineProperty(controller.signal, 'reason', { value: undefined });
    controller.abort();
    await expect(postGenesis('legacy', {}, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  it('handles cancellation during caller-listener registration', async () => {
    const controller = new AbortController();
    const register = controller.signal.addEventListener.bind(controller.signal);
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation((...args) => {
      register(...args);
      controller.abort();
    });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      postGenesis('registration-race', {}, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('emits opt-in diagnostics without credentials and classifies malformed JSON', async () => {
    vi.stubEnv('DATASET_PROVIDER_DIAGNOSTICS', '1');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{broken')));
    await expect(
      readGenesisJson(await postGenesis('diagnostics', { term: 'population', language: 'en' }))
    ).rejects.toMatchObject({ code: 'invalid_response' });
    expect(info).toHaveBeenCalledWith(
      '[dataset-provider]',
      expect.stringContaining('"term":"population"')
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('transport-boundaries');
  });
  it.each([null, 'bad', 1])('rejects non-object status payload %j', value => {
    expect(() => assertGenesisStatus(value)).toThrow('invalid response');
  });
  it.each([
    { Code: '' },
    { Code: NaN },
    {},
    { Code: 23 },
    { Code: 23, Type: 'Error', Content: 'unknown request' },
  ])('rejects missing or unknown statuses %j', Status => {
    expect(() => assertGenesisStatus({ Status })).toThrow();
  });
});
