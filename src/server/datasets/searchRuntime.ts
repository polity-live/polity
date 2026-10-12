const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 8000;
const cache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<unknown[]>;
    controller: AbortController;
    subscribers: number;
    settled: boolean;
  }
>();
// Row samples have a larger footprint than catalogue entries; keep a separate small public cache.
const previewCache = new Map<string, NonNullable<ReturnType<typeof cache.get>>>();

export function clearDatasetSearchCache() {
  cache.clear();
  previewCache.clear();
}

/** Only public catalogue queries belong here; never cache permission-dependent dataset rows. */
export function cachedPublicDatasetSearch<T>(
  key: string,
  run: (signal: AbortSignal) => Promise<T[]>,
  signal?: AbortSignal,
  timeoutMs = TIMEOUT_MS
): Promise<T[]> {
  if (signal?.aborted)
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  const selectedCache = key.startsWith('dataset-preview:') ? previewCache : cache;
  const cached = selectedCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return subscribe(cached, signal) as Promise<T[]>;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException('Dataset search timed out', 'TimeoutError');
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  const promise = Promise.race([Promise.resolve().then(() => run(controller.signal)), timeout])
    .then(results => {
      const entry = selectedCache.get(key);
      if (entry?.promise === promise) entry.expiresAt = Date.now() + CACHE_MS;
      return results;
    })
    .catch(error => {
      if (selectedCache.get(key)?.promise === promise) selectedCache.delete(key);
      throw error;
    })
    .finally(() => {
      clearTimeout(timer);
      entry.settled = true;
    });
  // A bounded cache also coalesces identical in-flight catalogue requests.
  const oldestKey = selectedCache.keys().next().value;
  if (selectedCache.size >= (selectedCache === previewCache ? 12 : 200) && oldestKey !== undefined)
    selectedCache.delete(oldestKey);
  const entry = {
    expiresAt: Date.now() + CACHE_MS,
    promise,
    controller,
    subscribers: 0,
    settled: false,
  };
  selectedCache.set(key, entry);
  return subscribe(entry, signal) as Promise<T[]>;
}

function subscribe(
  entry: {
    promise: Promise<unknown[]>;
    controller: AbortController;
    subscribers: number;
    settled: boolean;
  },
  signal?: AbortSignal
) {
  entry.subscribers++;
  if (!signal) {
    void entry.promise.finally(() => entry.subscribers--).catch(() => undefined);
    return entry.promise;
  }
  return new Promise<unknown[]>((resolve, reject) => {
    let finished = false;
    const done = () => {
      if (finished) return false;
      finished = true;
      entry.subscribers--;
      signal.removeEventListener('abort', abort);
      return true;
    };
    const abort = () => {
      if (!done()) return;
      if (!entry.subscribers && !entry.settled) {
        for (const store of [cache, previewCache])
          for (const [key, value] of store) if (value === entry) store.delete(key);
        entry.controller.abort(signal.reason);
      }
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    entry.promise.then(
      value => {
        if (done()) resolve(value);
      },
      error => {
        if (done()) reject(error);
      }
    );
    if (signal.aborted) abort();
  });
}
