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

  it.each(['', '0', '-1', 'NaN', 'Infinity', '12.5', '9007199254740992'])(
    'rejects invalid run budget %j before starting services',
    async timeout => {
      await expect(configuration(timeout)).rejects.toThrow('E2E_GLOBAL_TIMEOUT_MS');
    }
  );
});
