import { mkdtemp, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeAtomicReport } from '../atomic-report';

const directories: string[] = [];
async function target() {
  const directory = await mkdtemp(path.join(tmpdir(), 'polity-zero-performance-report-'));
  directories.push(directory);
  return path.join(directory, 'report.json');
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    for (const name of await readdir(directory)) await unlink(path.join(directory, name));
    await rmdir(directory);
  }
});

describe('atomic performance report persistence', () => {
  it.each(['EPERM', 'EACCES', 'EBUSY'])(
    'recovers a transient %s without changing measurements',
    async code => {
      const destination = await target();
      const record = { samples: [{ serverMs: 123, totalMs: 1101 }], failures: ['Budget exceeded'] };
      let calls = 0;
      const replace = vi.fn(async (...[source, output]: Parameters<typeof rename>) => {
        if (++calls <= 2) throw Object.assign(new Error('Temporarily locked'), { code });
        await rename(source, output);
      });
      const sleep = vi.fn(async (_milliseconds: number) => undefined);
      await writeAtomicReport(destination, JSON.stringify(record), { rename: replace, sleep });
      expect(JSON.parse(await readFile(destination, 'utf8'))).toEqual(record);
      expect(replace).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([25, 50]);
      expect(await readdir(path.dirname(destination))).toEqual(['report.json']);
    }
  );

  it('fails bounded retries, retains the prior report, and removes only its own temporary file', async () => {
    const destination = await target();
    await writeFile(destination, '{"previous":true}');
    const error = Object.assign(new Error('Persistent lock'), { code: 'EPERM' });
    const replace = vi.fn(async () => {
      throw error;
    });
    const sleep = vi.fn(async (_milliseconds: number) => undefined);
    await expect(
      writeAtomicReport(destination, '{"new":true}', { rename: replace, sleep })
    ).rejects.toBe(error);
    expect(replace).toHaveBeenCalledTimes(5);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([25, 50, 100, 200]);
    expect(await readFile(destination, 'utf8')).toBe('{"previous":true}');
    expect(await readdir(path.dirname(destination))).toEqual(['report.json']);
  });

  it('does not retry other filesystem errors or hide the failure', async () => {
    const destination = await target();
    const error = Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
    const replace = vi.fn(async () => {
      throw error;
    });
    const sleep = vi.fn(async (_milliseconds: number) => undefined);
    await expect(writeAtomicReport(destination, '{}', { rename: replace, sleep })).rejects.toBe(
      error
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(await readdir(path.dirname(destination))).toEqual([]);
  });

  it('keeps concurrent saves as complete JSON snapshots with no shared temporary filename', async () => {
    const destination = await target();
    const records = [1, 2, 3].map(value => ({ value, samples: Array(100).fill(value) }));
    await Promise.all(
      records.map(record => writeAtomicReport(destination, JSON.stringify(record)))
    );
    expect(records).toContainEqual(JSON.parse(await readFile(destination, 'utf8')));
    expect(await readdir(path.dirname(destination))).toEqual(['report.json']);
  });
});
