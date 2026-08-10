import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execSync: vi.fn() }));

vi.mock('node:child_process', () => ({ execSync: mocks.execSync }));

describe('deployment CLI dry-run', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('prints both production database steps without executing either command', async () => {
    process.argv = [
      process.execPath,
      'tools/deploy/deploy.mjs',
      '--dry-run',
      '--skip-fly',
      '--skip-vercel',
    ];
    mocks.execSync.mockImplementation((command: string) => {
      if (command === 'git rev-parse --abbrev-ref HEAD') return 'master\n';
      if (command.includes('supabase')) return '';
      throw new Error(`Unexpected command: ${command}`);
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const deploymentModule = '../deploy.mjs';
    await import(deploymentModule);

    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('supabase db push');
    expect(output).toContain('supabase db query --linked --file supabase/seed.production.sql');
    expect(mocks.execSync.mock.calls.map(([command]) => command)).not.toContain('supabase db push');
  });
});
