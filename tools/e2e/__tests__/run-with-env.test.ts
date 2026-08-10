import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('run-with-env CLI', () => {
  it('preserves explicit CI stack variables over local dotenv defaults', () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const sentinel = 'http://explicit-zero.invalid:4848';
    const result = spawnSync(
      process.execPath,
      [
        'tools/e2e/run-with-env.mjs',
        'node',
        '--eval',
        'process.stdout.write(process.env.VITE_ZERO_CACHE_URL ?? "missing")',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, VITE_ZERO_CACHE_URL: sentinel },
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(sentinel);
  });

  it('rejects an empty command', () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const result = spawnSync(process.execPath, ['tools/e2e/run-with-env.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('run-with-env requires a command');
  });
});
