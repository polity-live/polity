import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function configuration(timeout: string | undefined, ci: string | undefined = '1') {
  vi.resetModules();
  vi.stubEnv('CI', ci);
  vi.stubEnv('E2E_GLOBAL_TIMEOUT_MS', timeout);
  return (await import('../../../playwright.config')).default;
}

describe('Playwright run budgets', () => {
  it('keeps the PR budget and permits unbounded local debugging by default', async () => {
    expect((await configuration(undefined)).globalTimeout).toBe(900_000);
    expect((await configuration(undefined, '')).globalTimeout).toBeUndefined();
  });

  it.each(['4500000', '19800000'])(
    'accepts the explicit nightly budget %s without retries',
    async timeout => {
      const config = await configuration(timeout);
      expect(config.globalTimeout).toBe(Number(timeout));
      expect(config.retries).toBe(0);
      expect(config.timeout).toBe(120_000);
    }
  );

  it('starts a private collaboration writer and waits for its health endpoint', async () => {
    vi.stubEnv('E2E_REUSE_SERVER', undefined);
    vi.stubEnv('E2E_COLLABORATION_URL', 'http://127.0.0.1:1238');
    const config = await configuration(undefined);
    expect(config.webServer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'pnpm run collaboration:server',
          url: 'http://127.0.0.1:1238/health',
          env: { PORT: '1238' },
          reuseExistingServer: false,
          gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
        }),
        expect.objectContaining({
          env: expect.objectContaining({
            STUDIO_ENABLED: 'true',
            COLLABORATION_WEBSOCKET_URL: 'ws://127.0.0.1:1238',
          }),
        }),
      ])
    );
  });

  it('runs the cache directly against the configured isolated stack', async () => {
    vi.stubEnv('E2E_ZERO_COMMAND', undefined);
    vi.stubEnv('E2E_DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:55322/postgres');
    vi.stubEnv('PLAYWRIGHT_BASE_URL', 'http://localhost:3100');
    vi.stubEnv('VITE_ZERO_CACHE_URL', 'http://127.0.0.1:4948');
    expect((await configuration(undefined)).webServer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'pnpm exec zero-cache',
          url: 'http://127.0.0.1:4948/keepalive',
          env: expect.objectContaining({
            ZERO_ADMIN_PASSWORD: 'polity-e2e-local-only',
            ZERO_UPSTREAM_DB: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
            ZERO_QUERY_URL: 'http://localhost:3100/api/query',
            ZERO_MUTATE_URL: 'http://localhost:3100/api/mutate',
            ZERO_PORT: '4948',
          }),
          gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
        }),
      ])
    );
  });

  it.each(['', '0', '-1', 'NaN', 'Infinity', '12.5', '9007199254740992'])(
    'rejects invalid run budget %j before starting services',
    async timeout => {
      await expect(configuration(timeout)).rejects.toThrow('E2E_GLOBAL_TIMEOUT_MS');
    }
  );
});
