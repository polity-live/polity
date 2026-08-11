import { describe, expect, it, vi } from 'vitest';
import {
  createPreloadEntry,
  preloadKey,
  retainZeroPreload,
  retainZeroPreloadHandle,
  stableStringify,
  type ZeroPreloadEntry,
} from '../preload-registry';

function createFakeZero() {
  const cleanup = vi.fn();
  const preload = vi.fn(() => ({
    cleanup,
    complete: Promise.resolve(),
  }));

  return {
    cleanup,
    zero: { preload },
  };
}

function entry(key = 'queries.users.current:{}'): ZeroPreloadEntry {
  return {
    key,
    query: { key },
  };
}

describe('Zero preload registry', () => {
  it('creates stable keys for equivalent arg objects', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(['a', { b: 2 }])).toBe('["a",{"b":2}]');
    expect(stableStringify({ b: 2, a: 1, ignored: undefined })).toBe('{"a":1,"b":2}');
    expect(preloadKey('queries.search.searchDocumentPage', { sort: 'recent', query: '' })).toBe(
      preloadKey('queries.search.searchDocumentPage', { query: '', sort: 'recent' })
    );
    expect(createPreloadEntry('query', { id: 'one' }, { query: true })).toEqual({
      key: 'query:{"id":"one"}',
      query: { query: true },
    });
  });

  it('deduplicates active preloads by key until all retainers release', () => {
    const { zero, cleanup } = createFakeZero();

    const releaseFirst = retainZeroPreload(zero, entry());
    const releaseSecond = retainZeroPreload(zero, entry());

    expect(zero.preload).toHaveBeenCalledTimes(1);

    releaseFirst();
    expect(cleanup).not.toHaveBeenCalled();

    releaseSecond();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps the same key separate for different Zero clients', () => {
    const first = createFakeZero();
    const second = createFakeZero();

    const releaseFirst = retainZeroPreload(first.zero, entry());
    const releaseSecond = retainZeroPreload(second.zero, entry());

    expect(first.zero.preload).toHaveBeenCalledTimes(1);
    expect(second.zero.preload).toHaveBeenCalledTimes(1);

    releaseFirst();
    releaseSecond();

    expect(first.cleanup).toHaveBeenCalledTimes(1);
    expect(second.cleanup).toHaveBeenCalledTimes(1);
  });

  it('shares the completion promise with every retainer', () => {
    const { zero } = createFakeZero();
    const first = retainZeroPreloadHandle(zero, entry());
    const second = retainZeroPreloadHandle(zero, entry());

    expect(first.complete).toBe(second.complete);
    first.release();
    second.release();
    second.release();
  });

  it('uses explicit TTL values and logs rejected preloads without leaking cleanup', async () => {
    const cleanup = vi.fn();
    const failure = Promise.reject(new Error('offline'));
    const preload = vi.fn(() => ({ cleanup, complete: failure }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const retained = retainZeroPreloadHandle({ preload }, { key: 'ttl', query: {}, ttl: '10m' });
    await expect(retained.complete).rejects.toThrow('offline');
    await Promise.resolve();
    expect(preload).toHaveBeenCalledWith({}, { ttl: '10m' });
    expect(warn).toHaveBeenCalledOnce();
    retained.release();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
