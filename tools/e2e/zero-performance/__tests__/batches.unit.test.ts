import { describe, expect, it } from 'vitest';
import { queryBatches, batchCoverageFailures } from '../batches';
import type { Measurement } from '../metrics';

describe('bounded sequential query collection', () => {
  it('preserves every case exactly once, including the last partial batch', () => {
    const keys = Array.from({ length: 550 }, (_, index) => `query-${index}/default`);
    const batches = queryBatches(keys);
    expect(batches).toHaveLength(28);
    expect(Math.max(...batches.map(batch => batch.length))).toBe(20);
    expect(batches.flat()).toEqual(keys);
    expect(() => queryBatches(['duplicate', 'duplicate'])).toThrow();
    expect(() => queryBatches(keys, 0)).toThrow();
  });
  it('rejects missing, duplicate and unexpected worker results independently', () => {
    const rows = (keys: string[]) => keys.map(key => ({ key }) as Measurement);
    expect(batchCoverageFailures(['a', 'b'], rows(['a', 'b']))).toEqual([]);
    expect(batchCoverageFailures(['a', 'b'], rows(['a', 'a', 'extra']))).toEqual([
      'Missing worker measurement: b',
      'Unexpected worker measurement: extra',
      'Duplicate worker measurements',
    ]);
  });
});
