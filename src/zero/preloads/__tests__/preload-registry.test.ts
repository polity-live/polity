import { describe, expect, it, vi } from 'vitest';
import {
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
    expect(stableStringify({ b: 2, a: 1, ignored: undefined })).toBe('{"a":1,"b":2}');
    expect(preloadKey('queries.search.searchDocumentPage', { sort: 'recent', query: '' })).toBe(
      preloadKey('queries.search.searchDocumentPage', { query: '', sort: 'recent' })
    );
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
  });
});
