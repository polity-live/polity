import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cachedPublicDatasetSearch, clearDatasetSearchCache } from '../searchRuntime';

beforeEach(() => {
  clearDatasetSearchCache();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
it('coalesces concurrent queries and expires successful public results after five minutes', async () => {
  const run = vi.fn(async () => ['dataset']);
  const first = cachedPublicDatasetSearch('public', run);
  const concurrent = cachedPublicDatasetSearch('public', run);
  expect(concurrent).toBe(first);
  await expect(first).resolves.toEqual(['dataset']);
  await cachedPublicDatasetSearch('public', run);
  expect(run).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
  await cachedPublicDatasetSearch('public', run);
  expect(run).toHaveBeenCalledTimes(2);
});
it('aborts and rejects requests after eight seconds, then permits a retry', async () => {
  let signal!: AbortSignal;
  const pending = cachedPublicDatasetSearch('slow', input => {
    signal = input;
    return new Promise<unknown[]>(() => {
      // This request deliberately never settles, including after cancellation.
    });
  });
  const assertion = expect(pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(8000);
  await assertion;
  expect(signal.aborted).toBe(true);
  await expect(cachedPublicDatasetSearch('slow', async () => ['retry'])).resolves.toEqual([
    'retry',
  ]);
});
it('does not cache failures', async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await expect(cachedPublicDatasetSearch('failed', run)).rejects.toThrow('offline');
  await expect(cachedPublicDatasetSearch('failed', run)).resolves.toEqual([]);
  expect(run).toHaveBeenCalledTimes(2);
});

it('rejects an already cancelled caller before starting provider work', async () => {
  const controller = new AbortController();
  const reason = new Error('caller left');
  controller.abort(reason);
  const run = vi.fn(async () => ['unexpected']);
  await expect(cachedPublicDatasetSearch('cancelled', run, controller.signal)).rejects.toBe(reason);
  expect(run).not.toHaveBeenCalled();
});

it('keeps shared work alive when only one of its callers leaves', async () => {
  const controller = new AbortController();
  let release!: (value: string[]) => void;
  let providerSignal!: AbortSignal;
  const run = vi.fn((signal: AbortSignal) => {
    providerSignal = signal;
    return new Promise<string[]>(resolve => {
      release = resolve;
    });
  });
  const leaving = cachedPublicDatasetSearch('shared', run, controller.signal);
  const survivor = cachedPublicDatasetSearch('shared', run);
  await Promise.resolve();
  const reason = new Error('caller left');
  const cancelled = expect(leaving).rejects.toBe(reason);
  controller.abort(reason);
  await cancelled;
  expect(providerSignal.aborted).toBe(false);
  release(['shared result']);
  await expect(survivor).resolves.toEqual(['shared result']);
  await expect(cachedPublicDatasetSearch('shared', run)).resolves.toEqual(['shared result']);
  expect(run).toHaveBeenCalledOnce();
});

it.each(['resolve', 'reject'] as const)(
  'evicts abandoned work while a late provider %s cannot replace its retry',
  async settlement => {
    await cachedPublicDatasetSearch('unrelated', async () => ['other']);
    const controller = new AbortController();
    let finish!: (value: string[]) => void;
    let fail!: (error: Error) => void;
    let providerSignal!: AbortSignal;
    const pending = cachedPublicDatasetSearch(
      'abandoned',
      signal => {
        providerSignal = signal;
        return new Promise<string[]>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        });
      },
      controller.signal
    );
    await Promise.resolve();
    const reason = new Error('no viewers remain');
    const assertion = expect(pending).rejects.toBe(reason);
    controller.abort(reason);
    await assertion;
    expect(providerSignal.aborted).toBe(true);
    expect(providerSignal.reason).toBe(reason);
    const retry = vi.fn(async () => ['retry']);
    await expect(cachedPublicDatasetSearch('abandoned', retry)).resolves.toEqual(['retry']);
    if (settlement === 'resolve') finish(['stale']);
    else fail(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);
    await expect(cachedPublicDatasetSearch('abandoned', retry)).resolves.toEqual(['retry']);
    expect(retry).toHaveBeenCalledOnce();
  }
);

it('delivers provider results and failures to callers with cancellation signals', async () => {
  const controller = new AbortController();
  await expect(
    cachedPublicDatasetSearch('success', async () => ['result'], controller.signal)
  ).resolves.toEqual(['result']);
  const failure = new Error('provider failed');
  await expect(
    cachedPublicDatasetSearch(
      'failure',
      async () => {
        throw failure;
      },
      controller.signal
    )
  ).rejects.toBe(failure);
  controller.abort();
  await expect(cachedPublicDatasetSearch('success', async () => ['new'])).resolves.toEqual([
    'result',
  ]);
});

it('bounds successful catalogue entries by evicting the oldest key', async () => {
  const first = vi.fn(async () => ['first']);
  const last = vi.fn(async () => ['last']);
  await cachedPublicDatasetSearch('entry-0', first);
  for (let index = 1; index < 200; index++)
    await cachedPublicDatasetSearch(`entry-${index}`, async () => [String(index)]);
  await cachedPublicDatasetSearch('entry-200', last);
  await cachedPublicDatasetSearch('entry-200', last);
  expect(last).toHaveBeenCalledOnce();
  await cachedPublicDatasetSearch('entry-0', first);
  expect(first).toHaveBeenCalledTimes(2);
});

it('does not repopulate a cleared cache when old work finishes', async () => {
  let release!: (value: string[]) => void;
  const pending = cachedPublicDatasetSearch(
    'cleared',
    () =>
      new Promise<string[]>(resolve => {
        release = resolve;
      })
  );
  await Promise.resolve();
  clearDatasetSearchCache();
  release(['old']);
  await expect(pending).resolves.toEqual(['old']);
  const retry = vi.fn(async () => ['fresh']);
  await expect(cachedPublicDatasetSearch('cleared', retry)).resolves.toEqual(['fresh']);
  expect(retry).toHaveBeenCalledOnce();
});

it.each([true, false])(
  'supplies an AbortError for cancellation signals without a reason (already cancelled=%s)',
  async alreadyCancelled => {
    const controller = new AbortController();
    // Older AbortSignal implementations expose cancellation without a reason.
    Object.defineProperty(controller.signal, 'reason', { value: undefined });
    if (alreadyCancelled) controller.abort();
    const pending = cachedPublicDatasetSearch(
      'legacy-cancellation',
      async () => ['unused'],
      controller.signal
    );
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    if (!alreadyCancelled) controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(0);
    await expect(
      cachedPublicDatasetSearch('legacy-cancellation', async () => ['retry'])
    ).resolves.toEqual(['retry']);
  }
);

it('handles cancellation during listener registration without retaining abandoned work', async () => {
  const controller = new AbortController();
  const reason = new Error('cancelled while subscribing');
  const register = controller.signal.addEventListener.bind(controller.signal);
  vi.spyOn(controller.signal, 'addEventListener').mockImplementationOnce((...args) => {
    register(...args);
    controller.abort(reason);
  });
  const run = vi.fn(async (signal: AbortSignal) => {
    signal.throwIfAborted();
    return ['stale'];
  });
  await expect(cachedPublicDatasetSearch('registration-race', run, controller.signal)).rejects.toBe(
    reason
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(run.mock.calls[0][0].aborted).toBe(true);
  await expect(
    cachedPublicDatasetSearch('registration-race', async () => ['retry'])
  ).resolves.toEqual(['retry']);
});
