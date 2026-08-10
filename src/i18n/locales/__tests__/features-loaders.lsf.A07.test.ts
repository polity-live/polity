import { describe, expect, it } from 'vitest';

import { features as deFeatures } from '../de/features';
import { features as enFeatures } from '../en/features';

async function loadEveryFeature(features: Record<string, () => Promise<unknown>>) {
  const entries = await Promise.all(
    Object.entries(features).map(async ([name, load]) => [name, await load()] as const)
  );
  return Object.fromEntries(entries);
}

describe('A07 locale feature loader contracts', () => {
  it('loads every German feature namespace', async () => {
    const loaded = await loadEveryFeature(deFeatures);
    expect(Object.keys(loaded)).toEqual(Object.keys(deFeatures));
    expect(Object.values(loaded).every(value => value !== undefined)).toBe(true);
  });

  it('loads every English feature namespace', async () => {
    const loaded = await loadEveryFeature(enFeatures);
    expect(Object.keys(loaded)).toEqual(Object.keys(enFeatures));
    expect(Object.values(loaded).every(value => value !== undefined)).toBe(true);
  });
});
