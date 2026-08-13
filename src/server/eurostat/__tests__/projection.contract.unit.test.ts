import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_CHART_POINTS, type EurostatProjectionRequest } from '@/features/charts/types';

const mocks = vi.hoisted(() => ({
  responses: [] as (unknown | { reject: unknown })[],
  queries: [] as string[],
  values: [] as unknown[][],
  json: vi.fn((value: unknown) => ({ json: value })),
  transactionQueries: [] as string[],
  transactionBatches: [] as unknown[][],
  beginError: undefined as unknown,
}));

vi.mock('../db', () => {
  const transaction = vi.fn((strings: TemplateStringsArray | unknown[], ...values: unknown[]) => {
    if (!Array.isArray(strings) || !('raw' in strings)) {
      mocks.transactionBatches.push(strings as unknown[]);
      return { batch: strings, columns: values };
    }
    mocks.transactionQueries.push(Array.from(strings).join('?'));
    return Promise.resolve([]);
  });

  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    mocks.queries.push(Array.from(strings).join('?'));
    mocks.values.push(values);
    const response = mocks.responses.shift();
    if (response && typeof response === 'object' && 'reject' in response) {
      return Promise.reject((response as { reject: unknown }).reject);
    }
    return Promise.resolve(response ?? []);
  }) as any;
  sql.json = mocks.json;
  sql.begin = vi.fn(async (callback: (transaction: typeof sql) => unknown) => {
    if (mocks.beginError !== undefined) throw mocks.beginError;
    return callback(transaction as any);
  });

  return { eurostatSql: sql };
});

import { createEurostatProjection } from '../projection';

const request: EurostatProjectionRequest = {
  datasetId: 'dataset-1',
  filters: { unit: 'NR', empty: '', geo: 'DE' },
  xDimension: 'time',
  valueField: ' OBS_VALUE ',
};

function dataset(status = 'ready', dimensions = ['time', 'geo', 'unit']) {
  return [{ id: 'dataset-1', status, dimensions: dimensions.map(id => ({ id })) }];
}

beforeEach(() => {
  mocks.responses.length = 0;
  mocks.queries.length = 0;
  mocks.values.length = 0;
  mocks.transactionQueries.length = 0;
  mocks.transactionBatches.length = 0;
  mocks.beginError = undefined;
  mocks.json.mockClear();
});

describe('createEurostatProjection', () => {
  it('rejects missing and non-ready snapshots', async () => {
    mocks.responses.push([]);
    await expect(createEurostatProjection(request, 'user-1')).rejects.toThrow(
      'Eurostat snapshot is not ready'
    );

    mocks.responses.push(dataset('importing'));
    await expect(createEurostatProjection(request, 'user-1')).rejects.toThrow(
      'Eurostat snapshot is not ready'
    );
  });

  it('returns and numerically normalizes points from a ready cached projection', async () => {
    mocks.responses.push(
      dataset(),
      [{ id: 'cached-projection', status: 'ready' }],
      [
        { x_value: '2024', series_value: null, value: '12.5' },
        { x_value: '2025', series_value: 'women', value: 13 },
      ]
    );

    await expect(createEurostatProjection(request, 'user-1')).resolves.toEqual({
      projectionId: 'cached-projection',
      points: [
        { x: '2024', series: null, value: 12.5 },
        { x: '2025', series: 'women', value: 13 },
      ],
    });
    expect(mocks.queries).toHaveLength(3);
  });

  it('creates, batches and commits a projection with normalized filters', async () => {
    mocks.responses.push(
      dataset(),
      [{ id: 'pending-projection', status: 'pending' }],
      [],
      [
        { dimensions: { time: '2024' }, value: '1.5', sort_key: '1' },
        { dimensions: { time: '2025' }, value: 2, sort_key: '2' },
      ]
    );

    const result = await createEurostatProjection(request, 'user-1');
    expect(result.projectionId).toMatch(/^projection_/);
    expect(result.points).toEqual([
      { x: '2024', series: null, value: 1.5 },
      { x: '2025', series: null, value: 2 },
    ]);
    expect(mocks.json).toHaveBeenCalledWith({ geo: 'DE', unit: 'NR' });
    expect(mocks.transactionBatches).toHaveLength(1);
    expect(mocks.transactionBatches[0]).toHaveLength(2);
    expect(mocks.transactionQueries.join('\n')).toContain('DELETE FROM chart_projection_point');
    expect(mocks.transactionQueries.join('\n')).toContain("SET status = 'ready'");
  });

  it('supports an explicit series and converts a missing series value to null', async () => {
    const seriesRequest = {
      ...request,
      filters: { geo: 'DE', unit: 'NR' },
      seriesDimension: 'sex',
    };
    mocks.responses.push(
      dataset('ready', ['time', 'sex', 'geo', 'unit']),
      [],
      [],
      [
        { dimensions: { time: '2024', sex: 'women' }, value: 1, sort_key: '1' },
        { dimensions: { time: '2025' }, value: 2, sort_key: '2' },
      ]
    );

    await expect(createEurostatProjection(seriesRequest, 'user-1')).resolves.toMatchObject({
      points: [
        { x: '2024', series: 'women', value: 1 },
        { x: '2025', series: null, value: 2 },
      ],
    });
  });

  it('rejects result sets over the chart point limit and persists the error', async () => {
    const rows = Array.from({ length: MAX_CHART_POINTS + 1 }, (_, index) => ({
      dimensions: { time: String(index) },
      value: index,
      sort_key: String(index),
    }));
    mocks.responses.push(dataset(), [], [], rows, []);

    await expect(createEurostatProjection(request, 'user-1')).rejects.toThrow(
      `Projection exceeds ${MAX_CHART_POINTS} chart points`
    );
    expect(mocks.queries.at(-1)).toContain("SET status = 'error'");
  });

  it('skips rows without X and rejects a projection with no remaining observations', async () => {
    mocks.responses.push(dataset(), [], [], [{ dimensions: {}, value: 1, sort_key: '1' }], []);
    await expect(createEurostatProjection(request, 'user-1')).rejects.toThrow(
      'Projection contains no observations'
    );
  });

  it('rejects duplicate X/series points', async () => {
    mocks.responses.push(
      dataset(),
      [],
      [],
      [
        { dimensions: { time: '2024' }, value: 1, sort_key: '1' },
        { dimensions: { time: '2024' }, value: 2, sort_key: '2' },
      ],
      []
    );
    await expect(createEurostatProjection(request, 'user-1')).rejects.toThrow(
      'Projection contains duplicate X/series points'
    );
  });

  it('persists stringified non-Error failures and rethrows the original value', async () => {
    mocks.responses.push(dataset(), [], [], { reject: 'database offline' }, []);
    await expect(createEurostatProjection(request, 'user-1')).rejects.toBe('database offline');
    expect(mocks.values.at(-1)).toContain('database offline');
  });

  it('marks transaction failures as projection errors', async () => {
    mocks.beginError = new Error('commit failed');
    mocks.responses.push(
      dataset(),
      [],
      [],
      [{ dimensions: { time: '2024' }, value: 1, sort_key: '1' }],
      []
    );
    await expect(createEurostatProjection(request, 'user-1')).rejects.toThrow('commit failed');
  });
});
