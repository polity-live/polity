import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ config: vi.fn(), worker: vi.fn() }));
vi.mock('dotenv', () => ({ config: io.config }));
const argv = process.argv;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doMock('../worker', () => {
    io.worker();
    return {};
  });
  process.argv = [...argv.slice(0, 2), 'worker'];
});
afterEach(() => {
  process.argv = argv;
  vi.unstubAllEnvs();
});
it('loads local environment files while preserving inherited worker settings', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('STUDIO_DATABASE_URL', 'inherited');
  io.config.mockImplementation(() => {
    process.env.STUDIO_DATABASE_URL = 'from-file';
  });
  await import('../launch');
  expect(io.config).toHaveBeenCalledTimes(4);
  expect(process.env.STUDIO_DATABASE_URL).toBe('inherited');
  expect(io.worker).toHaveBeenCalledOnce();
});
it('launches production without reading local credentials and rejects unknown targets', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await import('../launch');
  expect(io.config).not.toHaveBeenCalled();
  expect(io.worker).toHaveBeenCalledOnce();
  vi.resetModules();
  process.argv[2] = 'unknown';
  await expect(import('../launch')).rejects.toThrow('Expected worker');
});
