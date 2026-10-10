import { useEffect, useMemo } from 'react';
import { useZero } from '@rocicorp/zero/react';
import type { TTL } from '@rocicorp/zero';
import { observePreload } from './query-lifecycle';

interface PreloadHandle {
  cleanup: () => void;
  complete: Promise<void>;
}

interface PreloadableZero {
  preload: (query: unknown, options?: { ttl?: TTL }) => PreloadHandle;
  clientID?: string;
}

export interface ZeroPreloadEntry {
  key: string;
  query: unknown;
  ttl?: TTL;
}

interface PreloadRecord {
  count: number;
  cleanup: () => void;
  complete: Promise<void>;
  settled: boolean;
  abandoned?: ReturnType<typeof setTimeout>;
}

export interface RetainedZeroPreload {
  release: () => void;
  complete: Promise<void>;
}

const registries = new WeakMap<object, Map<string, PreloadRecord>>();
let activationSequence = 0;

function getRegistry(zero: object) {
  let registry = registries.get(zero);
  if (!registry) {
    registry = new Map();
    registries.set(zero, registry);
  }
  return registry;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

export function preloadKey(name: string, args: unknown): string {
  return `${name}:${stableStringify(args)}`;
}

export function createPreloadEntry(name: string, args: unknown, query: unknown): ZeroPreloadEntry {
  return {
    key: preloadKey(name, args),
    query,
  };
}

export function retainZeroPreload(zero: PreloadableZero, entry: ZeroPreloadEntry): () => void {
  return retainZeroPreloadHandle(zero, entry).release;
}

export function retainZeroPreloadHandle(
  zero: PreloadableZero,
  entry: ZeroPreloadEntry
): RetainedZeroPreload {
  const registry = getRegistry(zero);
  const existing = registry.get(entry.key);

  if (existing) {
    existing.count += 1;
    clearTimeout(existing.abandoned);
    return {
      complete: existing.complete,
      release: releaseOnce(registry, entry.key),
    };
  }

  const ttl = entry.ttl ?? 'none';
  const activationID = `${zero.clientID ?? 'unknown'}:${++activationSequence}`;
  observePreload(zero.clientID, entry.key, 'preload-start', ttl, activationID);
  let handle: PreloadHandle;
  try {
    handle = zero.preload(entry.query, { ttl });
  } catch (error) {
    observePreload(zero.clientID, entry.key, 'preload-error', ttl, activationID);
    throw error;
  }
  const record: PreloadRecord = {
    count: 1,
    cleanup: () => {
      clearTimeout(record.abandoned);
      observePreload(zero.clientID, entry.key, 'preload-release', ttl, activationID);
      handle.cleanup();
    },
    complete: handle.complete,
    settled: false,
  };
  registry.set(entry.key, record);
  const settle = () => {
    record.settled = true;
    if (record.count === 0 && registry.get(entry.key) === record) {
      registry.delete(entry.key);
      record.cleanup();
    }
  };
  void handle.complete.then(
    () => {
      observePreload(zero.clientID, entry.key, 'preload-complete', ttl, activationID);
      settle();
    },
    error => {
      observePreload(zero.clientID, entry.key, 'preload-error', ttl, activationID);
      console.warn(`Zero preload failed for ${entry.key}`, error);
      settle();
    }
  );

  return {
    complete: handle.complete,
    release: releaseOnce(registry, entry.key),
  };
}

function releaseOnce(registry: Map<string, PreloadRecord>, key: string) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseZeroPreload(registry, key);
  };
}

function releaseZeroPreload(registry: Map<string, PreloadRecord>, key: string) {
  const record = registry.get(key);
  if (!record) return;

  record.count -= 1;

  if (record.count > 0) return;

  if (record.settled) {
    registry.delete(key);
    record.cleanup();
  } else {
    // Keep an in-flight subscription observable and reusable after route preemption.
    // Bound abandoned handles if the connection never delivers a completion.
    record.abandoned = setTimeout(() => {
      if (record.count !== 0 || registry.get(key) !== record) return;
      registry.delete(key);
      record.cleanup();
    }, 10_000);
  }
}

export function useZeroPreloads(entries: readonly ZeroPreloadEntry[]) {
  const zero = useZero() as PreloadableZero;
  const entryKey = useMemo(
    () => stableStringify(entries.map(entry => [entry.key, entry.ttl ?? 'none'])),
    [entries]
  );

  useEffect(() => {
    if (entries.length === 0) return;

    const releases = entries.map(entry => retainZeroPreload(zero, entry));
    return () => {
      for (const release of releases) {
        release();
      }
    };
    // The key includes the complete query identity and TTL; array identity is irrelevant.
  }, [entryKey, zero]);
}

export function useDerivedZeroPreloads(entries: readonly ZeroPreloadEntry[], enabled = true) {
  const stableEntries = useMemo(() => (enabled ? entries : []), [enabled, entries]);
  useZeroPreloads(stableEntries);
}
