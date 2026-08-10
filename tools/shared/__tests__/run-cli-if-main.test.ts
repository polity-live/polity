import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runCliIfMain } from '../run-cli-if-main.mjs';

describe('runCliIfMain', () => {
  const entry = path.resolve('tools/shared/example-cli.mjs');
  const moduleUrl = pathToFileURL(entry).href;

  it.each([null, path.resolve('tools/shared/another-cli.mjs')])(
    'does not run a non-entry module for argv %s',
    async argvEntry => {
      const runner = vi.fn();
      await expect(runCliIfMain(moduleUrl, runner, { argvEntry })).resolves.toBe(false);
      expect(runner).not.toHaveBeenCalled();
    }
  );

  it('runs and awaits the matching entry module', async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    await expect(runCliIfMain(moduleUrl, runner, { argvEntry: entry })).resolves.toBe(true);
    expect(runner).toHaveBeenCalledOnce();
  });

  it('rethrows entry failures when no error boundary is supplied', async () => {
    const failure = new Error('entry failed');
    await expect(
      runCliIfMain(moduleUrl, () => Promise.reject(failure), { argvEntry: entry })
    ).rejects.toBe(failure);
  });

  it('reports entry failures through an explicit error boundary', async () => {
    const failure = new Error('entry failed');
    const onError = vi.fn();
    await expect(
      runCliIfMain(moduleUrl, () => Promise.reject(failure), { argvEntry: entry, onError })
    ).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
