import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mocks = vi.hoisted(() => ({ execSync: vi.fn() }));

vi.mock('node:child_process', () => ({ execSync: mocks.execSync }));

describe('deployment CLI dry-run', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('declares the private Studio bucket with the upload contract', () => {
    const config = readFileSync(resolve('supabase/config.toml'), 'utf8');
    const storage = config.match(/\[storage\]\s*([\s\S]*?)(?=\r?\n\[|$)/)?.[1];
    const section = config.match(/\[storage\.buckets\.studio\]\s*([\s\S]*?)(?=\r?\n\[|$)/)?.[1];
    expect(storage).toContain('file_size_limit = "100MiB"');
    expect(section).toBeDefined();
    expect(section).toContain('public = false');
    expect(section).toContain('file_size_limit = "100MiB"');
    const mimeTypes = JSON.parse(section!.match(/allowed_mime_types\s*=\s*(\[[^\]]*\])/)![1]);
    expect(mimeTypes).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'application/pdf',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
  });

  it('prints migrations, bucket provisioning, and production seed in order without executing them', async () => {
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
    const migration = output.indexOf('supabase db push');
    const buckets = output.indexOf('supabase seed buckets --linked');
    const seed = output.indexOf('supabase db query --linked --file supabase/seed.production.sql');
    expect(migration).toBeGreaterThanOrEqual(0);
    expect(buckets).toBeGreaterThan(migration);
    expect(seed).toBeGreaterThan(buckets);
    expect(mocks.execSync.mock.calls.map(([command]) => command)).not.toContain('supabase db push');
  });
});
