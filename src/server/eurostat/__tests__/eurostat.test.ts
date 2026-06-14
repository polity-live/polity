import { describe, expect, it } from 'vitest';
import type { EurostatDimension } from '@/features/charts/types';
import { createStableHash, stableStringify } from '../hash';
import { estimateEurostatDatasetBytes } from '../metadata';
import { buildEurostatPartitions, estimatePartitionCells } from '../partition';
import {
  normalizeEurostatValueField,
  validateProjectionDimensions,
} from '../projection-validation';
import { readEurostatCsvResponse } from '../response';
import { gzipSync } from 'node:zlib';

function dimension(id: string, valueCount: number): EurostatDimension {
  return {
    id,
    label: id,
    position: 1,
    values: Array.from({ length: valueCount }, (_, index) => ({ id: String(index) })),
  };
}

describe('Eurostat utilities', () => {
  it('creates canonical hashes independent of object key order', () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(createStableHash({ a: 1, b: 2 })).toBe(createStableHash({ b: 2, a: 1 }));
  });

  it('includes row reserve and safety margin in the size estimate', () => {
    expect(estimateEurostatDatasetBytes(10, 72)).toBe(2_400);
  });

  it('partitions the Cartesian product below the configured cell target', () => {
    const partitions = buildEurostatPartitions(
      [dimension('geo', 130), dimension('time', 80), dimension('unit', 7)],
      20_000
    );

    expect(partitions.length).toBeGreaterThan(1);
    expect(partitions.every(partition => partition.estimatedCells <= 20_000)).toBe(true);
    expect(
      partitions.every(partition =>
        Object.values(partition.filters).every(values => values.length <= 100)
      )
    ).toBe(true);
    expect(
      partitions.reduce((total, partition) => total + estimatePartitionCells(partition.filters), 0)
    ).toBe(130 * 80 * 7);
  });

  it('requires exactly one filter for every unused dimension', () => {
    expect(() =>
      validateProjectionDimensions(['geo', 'unit', 'time'], {
        datasetId: 'dataset',
        xDimension: 'time',
        seriesDimension: 'geo',
        filters: {},
      })
    ).toThrow('Dimension unit must be filtered to one value');

    expect(() =>
      validateProjectionDimensions(['geo', 'unit', 'time'], {
        datasetId: 'dataset',
        xDimension: 'time',
        seriesDimension: 'geo',
        filters: { unit: 'PC' },
      })
    ).not.toThrow();
  });

  it('normalizes and validates the Eurostat projection value field', () => {
    expect(normalizeEurostatValueField()).toBe('OBS_VALUE');
    expect(normalizeEurostatValueField('OBS_VALUE')).toBe('OBS_VALUE');
    expect(() => normalizeEurostatValueField('OTHER_VALUE')).toThrow(
      'Unsupported Eurostat value field'
    );
  });

  it('decompresses Eurostat CSV attachments without content-encoding', async () => {
    const response = new Response(gzipSync('geo,OBS_VALUE\nDE,42\n'), {
      headers: {
        'content-disposition': 'attachment; filename="dataset.csv.gz"',
      },
    });

    await expect(readEurostatCsvResponse(response)).resolves.toBe('geo,OBS_VALUE\nDE,42\n');
  });
});
