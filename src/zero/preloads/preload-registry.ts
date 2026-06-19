import { useEffect, useMemo } from 'react';
import { useZero } from '@rocicorp/zero/react';
import type { TTL } from '@rocicorp/zero';

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
}

const registries = new WeakMap<object, Map<string, PreloadRecord>>();

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
  const registry = getRegistry(zero);
  const existing = registry.get(entry.key);

  if (existing) {
    existing.count += 1;
    return () => releaseZeroPreload(registry, entry.key);
  }

  const handle = zero.preload(entry.query, { ttl: entry.ttl ?? 'none' });
  handle.complete.catch(error => {
    console.warn(`Zero preload failed for ${entry.key}`, error);
  });

  registry.set(entry.key, {
    count: 1,
    cleanup: handle.cleanup,
  });

  return () => releaseZeroPreload(registry, entry.key);
}

function releaseZeroPreload(registry: Map<string, PreloadRecord>, key: string) {
  const record = registry.get(key);
  if (!record) return;

  record.count -= 1;

  if (record.count > 0) return;

  registry.delete(key);
  record.cleanup();
}

export function useZeroPreloads(entries: readonly ZeroPreloadEntry[]) {
  const zero = useZero() as PreloadableZero;
  const entryKey = useMemo(() => entries.map(entry => entry.key).join('|'), [entries]);

  useEffect(() => {
    if (entries.length === 0) return;

    const releases = entries.map(entry => retainZeroPreload(zero, entry));
    return () => {
      for (const release of releases) {
        release();
      }
    };
  }, [entryKey, entries, zero]);
}

export function useDerivedZeroPreloads(entries: readonly ZeroPreloadEntry[], enabled = true) {
  const stableEntries = useMemo(() => (enabled ? entries : []), [enabled, entries]);
  useZeroPreloads(stableEntries);
}
