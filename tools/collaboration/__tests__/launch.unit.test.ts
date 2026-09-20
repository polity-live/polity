import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ config: vi.fn(), target: vi.fn() }));
vi.mock('dotenv', () => ({ config: io.config }));
vi.mock('../server.ts', () => {
  io.target('server');
  return {};
});
vi.mock('../migrate.ts', () => {
  io.target('migrate');
  return {};
});
vi.mock('../rehearsal.ts', () => {
  io.target('rehearsal');
  return {};
});
vi.mock('../seed.ts', () => {
  io.target('seed');
  return {};
});
vi.mock('../verify.ts', () => {
  io.target('verify');
  return {};
});
vi.mock('../../e2e/collaboration/acceptance.ts', () => {
  io.target('acceptance');
  return {};
});
vi.mock('../../e2e/collaboration/studio-acceptance.ts', () => {
  io.target('studio-acceptance');
  return {};
});
vi.mock('../../e2e/collaboration/faults.ts', () => {
  io.target('faults');
  return {};
});
vi.mock('../../e2e/collaboration/restart.ts', () => {
  io.target('restart');
  return {};
});
vi.mock('../../studio/worker.ts', () => {
  io.target('worker');
  return {};
});
vi.mock('../../studio/collaboration-server.ts', () => {
  io.target('collaboration-server');
  return {};
});
const argv = process.argv;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('COLLABORATION_TEST_DATABASE', '');
  vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://unused@localhost:54322/postgres');
  vi.stubEnv('STUDIO_DATABASE_URL', '');
  vi.stubEnv('CLI_TEST_SETTING', 'inherited');
  io.config.mockImplementation(() => {
    process.env.CLI_TEST_SETTING = 'file';
  });
});
afterEach(() => {
  process.argv = argv;
  vi.unstubAllEnvs();
});
describe('explicit collaboration and export entrypoints', () => {
  it('refuses remapping when an upstream database was not configured', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', undefined);
    vi.stubEnv('COLLABORATION_TEST_DATABASE', 'polity_collaboration_acceptance_123');
    process.argv = [process.execPath, 'launch.ts', 'server'];
    await expect(import('../launch')).rejects.toThrow('Invalid URL');
    expect(io.target).not.toHaveBeenCalled();
  });
  it('loads development env files in order while preserving explicit shell values', async () => {
    process.argv = [process.execPath, 'launch.ts', 'server'];
    await import('../launch');
    expect(io.config.mock.calls.map(([c]) => c.path.split(/[\\/]/).at(-1))).toEqual([
      '.env',
      '.env.local',
      '.env.development',
      '.env.development.local',
    ]);
    expect(process.env.CLI_TEST_SETTING).toBe('inherited');
    expect(io.target).toHaveBeenCalledWith('server');
  });
  it('dispatches every supported command without permitting arbitrary module imports', async () => {
    for (const target of [
      'migrate',
      'rehearsal',
      'seed',
      'verify',
      'acceptance',
      'studio-acceptance',
      'faults',
      'restart',
    ]) {
      vi.resetModules();
      process.argv = [process.execPath, 'launch.ts', target];
      await import('../launch');
      expect(io.target).toHaveBeenLastCalledWith(target);
    }
    vi.resetModules();
    io.target.mockClear();
    process.argv[2] = '../../outside';
    await expect(import('../launch')).rejects.toThrow('Expected server');
    expect(io.target).not.toHaveBeenCalled();
  });
  it('remaps both database clients only to an explicitly named local test copy', async () => {
    process.argv = [process.execPath, 'launch.ts', 'server'];
    vi.stubEnv('COLLABORATION_TEST_DATABASE', 'polity_collaboration_acceptance_123');
    await import('../launch');
    expect(new URL(process.env.ZERO_UPSTREAM_DB!).pathname).toBe(
      '/polity_collaboration_acceptance_123'
    );
    expect(process.env.STUDIO_DATABASE_URL).toBe(process.env.ZERO_UPSTREAM_DB);
    for (const [database, name] of [
      ['postgres://unused@example.invalid/postgres', 'polity_collaboration_test'],
      ['postgres://unused@localhost/postgres', 'bad;drop'],
    ]) {
      vi.resetModules();
      vi.stubEnv('ZERO_UPSTREAM_DB', database);
      vi.stubEnv('COLLABORATION_TEST_DATABASE', name);
      await expect(import('../launch')).rejects.toThrow('Invalid isolated test database');
    }
  });
  it('does not load local env files in production and also guards the Studio entrypoint', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.argv = [process.execPath, 'launch.ts', 'server'];
    await import('../launch');
    expect(io.config).not.toHaveBeenCalled();
    process.argv[2] = 'worker';
    await import('../../studio/launch');
    expect(io.config).not.toHaveBeenCalled();
    expect(io.target).toHaveBeenLastCalledWith('worker');
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    process.argv[2] = 'collaboration-server';
    await import('../../studio/launch');
    expect(io.config).toHaveBeenCalledTimes(4);
    expect(process.env.CLI_TEST_SETTING).toBe('inherited');
    vi.resetModules();
    process.argv[2] = 'unknown';
    await expect(import('../../studio/launch')).rejects.toThrow(
      'Expected collaboration-server or worker'
    );
  });
});
