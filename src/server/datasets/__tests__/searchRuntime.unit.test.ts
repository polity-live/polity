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
