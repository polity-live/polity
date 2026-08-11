import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ postgres: vi.fn(() => ({ sql: true })) }));

vi.mock('postgres', () => ({ default: mocks.postgres }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.ZERO_UPSTREAM_DB;
});

describe('server database client configuration', () => {
  it('rejects missing static database configuration', async () => {
    for (const path of ['../datasets/db', '../currency/db', '../eurostat/db']) {
      await expect(import(path)).rejects.toThrow('Missing ZERO_UPSTREAM_DB');
      vi.resetModules();
    }
  });

  it('creates every static client with its pool limits', async () => {
    process.env.ZERO_UPSTREAM_DB = 'postgres://database.test/polity';
    await expect(import('../datasets/db')).resolves.toHaveProperty('datasetSql');
    vi.resetModules();
    await expect(import('../currency/db')).resolves.toHaveProperty('currencySql');
    vi.resetModules();
    await expect(import('../eurostat/db')).resolves.toHaveProperty('eurostatSql');
    expect(mocks.postgres).toHaveBeenCalledTimes(3);
  });

  it('lazily creates and reuses the tutorial database client', async () => {
    process.env.ZERO_UPSTREAM_DB = 'postgres://database.test/polity';
    const { getAppTutorialSql } = await import('../app-tutorial/db');
    const first = getAppTutorialSql();
    expect(getAppTutorialSql()).toBe(first);
    expect(mocks.postgres).toHaveBeenCalledOnce();
  });

  it('uses a typed tutorial-specific error when configuration is absent', async () => {
    const { AppTutorialDatabaseUnavailableError, getAppTutorialSql } =
      await import('../app-tutorial/db');
    expect(() => getAppTutorialSql()).toThrow(AppTutorialDatabaseUnavailableError);
  });
});
