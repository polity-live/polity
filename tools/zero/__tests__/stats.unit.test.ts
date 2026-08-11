import { afterEach, describe, expect, it, vi } from 'vitest';

const defaultPostgres = vi.hoisted(() => vi.fn());

vi.mock('postgres', () => ({ default: defaultPostgres }));

import {
  collectZeroStats,
  extractJSON,
  readProfileStats,
  runZeroStatsCli,
  scalarCount,
} from '../stats.mjs';

function postgresClient(result: unknown = [{ groups: 2, profiles: 3 }], failure?: unknown) {
  const sql = vi.fn((first: unknown) => {
    if (Array.isArray(first)) {
      return failure === undefined ? Promise.resolve(result) : Promise.reject(failure);
    }
    return `"${String(first)}"`;
  });
  return Object.assign(sql, { end: vi.fn().mockResolvedValue(undefined) });
}

afterEach(() => {
  defaultPostgres.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Zero statz parsing', () => {
  it('extracts nested JSON while respecting brackets and escaped quotes inside strings', () => {
    const source = String.raw`
      ignored: []
      target: [{"text":"[escaped \\\" value]","nested":[1,2]}]
      following: [{"c":9}]
    `;
    expect(extractJSON(source, 'target')).toEqual([
      { text: '[escaped \\" value]', nested: [1, 2] },
    ]);
    expect(extractJSON(source, 'missing')).toBeUndefined();
    expect(extractJSON('target: no-array', 'target')).toBeUndefined();
    expect(extractJSON('target: [{"open":true}', 'target')).toBeUndefined();
  });

  it('normalizes missing and populated scalar counters', () => {
    expect(scalarCount('count: [{"c":"12"}]', 'count')).toBe(12);
    expect(scalarCount('count: []', 'count')).toBe(0);
    expect(scalarCount('', 'count')).toBe(0);
  });
});

describe('Zero profile statistics', () => {
  it('skips the database without a connection and uses explicit schema settings', async () => {
    const factory = vi.fn();
    await expect(readProfileStats({ env: {}, postgresFactory: factory })).resolves.toBeUndefined();
    expect(factory).not.toHaveBeenCalled();

    const sql = postgresClient();
    const postgresFactory = vi.fn(() => sql);
    await expect(
      readProfileStats({
        env: {
          ZERO_CVR_DB: 'postgres://cvr',
          ZERO_UPSTREAM_DB: 'postgres://upstream',
          ZERO_APP_ID: 'polity',
          ZERO_SHARD_NUM: '7',
        },
        postgresFactory,
      })
    ).resolves.toEqual({ groups: 2, profiles: 3 });
    expect(postgresFactory).toHaveBeenCalledWith('postgres://cvr', {
      max: 1,
      connect_timeout: 3,
      idle_timeout: 1,
    });
    expect(sql).toHaveBeenCalledWith('polity_7/cvr');
    expect(sql.end).toHaveBeenCalledWith({ timeout: 1 });
  });

  it('uses upstream/default schema fallbacks and always closes failed clients', async () => {
    const logger = { warn: vi.fn() };
    const sql = postgresClient(undefined, 'offline');
    await expect(
      readProfileStats({
        env: { ZERO_UPSTREAM_DB: 'postgres://upstream' },
        postgresFactory: () => sql,
        logger,
      })
    ).resolves.toBeUndefined();
    expect(sql).toHaveBeenCalledWith('zero_0/cvr');
    expect(sql.end).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith('Profilstatistik nicht verfügbar: offline');
  });

  it('uses default environment, Postgres factory and logger boundaries safely', async () => {
    const sql = postgresClient();
    defaultPostgres.mockReturnValue(sql);
    await expect(readProfileStats()).resolves.toEqual({ groups: 2, profiles: 3 });
    await expect(
      readProfileStats({ env: { ZERO_UPSTREAM_DB: 'postgres://default-factory' } })
    ).resolves.toEqual({ groups: 2, profiles: 3 });
    expect(defaultPostgres).toHaveBeenCalledTimes(2);
  });
});

describe('Zero statistics command', () => {
  it('aggregates cache and profile statistics with injected transports', async () => {
    const sql = postgresClient();
    const source = [
      'numActiveQueries: [{"c":4}]',
      'numUniqueQueryHashes: [{"c":3}]',
      'totalActiveQueriesPerClientAndClientGroup: [{"num_clients":2},{"num_clients":null},{}]',
    ].join('\n');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(source),
    });

    await expect(
      collectZeroStats({
        env: { ZERO_STATZ_URL: 'https://zero.test/statz', ZERO_UPSTREAM_DB: 'postgres://db' },
        fetchImpl,
        postgresFactory: () => sql,
      })
    ).resolves.toEqual({
      activeQueries: 4,
      uniqueQueryHashes: 3,
      queryGroups: 3,
      clients: 2,
      activeCVRGroups: 2,
      profiles: 3,
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://zero.test/statz', {
      signal: expect.any(AbortSignal),
    });
  });

  it('uses default endpoints, tolerates unavailable profile data and rejects HTTP errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    await expect(collectZeroStats({ env: {}, fetchImpl })).resolves.toEqual({
      activeQueries: 0,
      uniqueQueryHashes: 0,
      queryGroups: 0,
      clients: 0,
      activeCVRGroups: 'n/a',
      profiles: 'n/a',
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:4848/statz');

    await expect(
      collectZeroStats({
        env: {},
        fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable' }),
      })
    ).rejects.toThrow('503 Unavailable');
  });

  it('prints successful results and maps Error/non-Error failures to process state', async () => {
    const logger = { table: vi.fn(), error: vi.fn() };
    const processState: { exitCode?: number } = {};
    const stats = { activeQueries: 1 };
    await expect(
      runZeroStatsCli({ collect: vi.fn().mockResolvedValue(stats), logger, processState })
    ).resolves.toBe(stats);
    expect(logger.table).toHaveBeenCalledWith([stats]);
    expect(processState).not.toHaveProperty('exitCode');

    await expect(
      runZeroStatsCli({
        collect: vi.fn().mockRejectedValue(new Error('network')),
        logger,
        processState,
      })
    ).resolves.toBeUndefined();
    expect(processState.exitCode).toBe(1);
    expect(logger.error).toHaveBeenLastCalledWith(
      'Zero-Statistik konnte nicht geladen werden: network'
    );

    await runZeroStatsCli({ collect: vi.fn().mockRejectedValue('offline'), logger, processState });
    expect(logger.error).toHaveBeenLastCalledWith(
      'Zero-Statistik konnte nicht geladen werden: offline'
    );
  });

  it('runs entirely through default CLI dependencies with a stubbed global fetch', async () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined);
    defaultPostgres.mockReturnValue(postgresClient());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }));

    await expect(runZeroStatsCli()).resolves.toMatchObject({
      activeQueries: 0,
      profiles: 3,
    });
    expect(table).toHaveBeenCalledOnce();
  });
});
