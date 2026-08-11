import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  postgres: vi.fn(),
}));

vi.mock('postgres', () => ({ default: mocks.postgres }));

beforeEach(() => {
  vi.resetModules();
  mocks.postgres.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('app tutorial database connection', () => {
  it('fails with the domain error when the database is not configured', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', '');
    const { AppTutorialDatabaseUnavailableError, getAppTutorialSql } = await import('../db');

    expect(() => getAppTutorialSql()).toThrow(AppTutorialDatabaseUnavailableError);
    expect(mocks.postgres).not.toHaveBeenCalled();
  });

  it('creates and caches the bounded tutorial SQL client', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://tutorial');
    const sql = { connection: 'tutorial' };
    mocks.postgres.mockReturnValue(sql);
    const { getAppTutorialSql } = await import('../db');

    expect(getAppTutorialSql()).toBe(sql);
    expect(getAppTutorialSql()).toBe(sql);
    expect(mocks.postgres).toHaveBeenCalledOnce();
    expect(mocks.postgres).toHaveBeenCalledWith('postgres://tutorial', {
      max: 4,
      idle_timeout: 20,
    });
  });
});
