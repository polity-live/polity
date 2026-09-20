import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
const run = promisify(execFile);
it('rejects demo seeding outside the explicit local primary database before creating users or media', async () => {
  for (const url of [
    'postgresql://unused:unused@example.invalid:54322/postgres',
    'postgresql://unused:unused@127.0.0.1:54322/production',
    'postgresql://unused:unused@127.0.0.1:5432/postgres',
  ]) {
    await expect(
      run(process.execPath, ['--import', 'tsx', 'tools/collaboration/launch.ts', 'seed'], {
        timeout: 15_000,
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          ZERO_UPSTREAM_DB: url,
          COLLABORATION_TEST_DATABASE: '',
        },
      })
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Demo seed requires the local Polity database'),
    });
  }
}, 50_000);
