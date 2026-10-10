import { beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceReportFile } from '../atomic-report';

const filesystem = vi.hoisted(() => ({ rename: vi.fn(), delay: vi.fn() }));
vi.mock('node:fs/promises', () => ({ rename: filesystem.rename }));
vi.mock('node:timers/promises', () => ({ setTimeout: filesystem.delay }));

beforeEach(() => {
  filesystem.rename.mockReset().mockResolvedValue(undefined);
  filesystem.delay.mockReset().mockResolvedValue(undefined);
});

describe('atomic benchmark report replacement', () => {
  it('replaces a complete temporary file without waiting on success', async () => {
    await replaceReportFile('progress.json.tmp', 'progress.json');
    expect(filesystem.rename).toHaveBeenCalledExactlyOnceWith('progress.json.tmp', 'progress.json');
    expect(filesystem.delay).not.toHaveBeenCalled();
  });

  it.each(['EPERM', 'EACCES', 'EBUSY'])(
    'retries a temporary %s using the same complete file',
    async code => {
      const failure = Object.assign(new Error('temporarily busy'), { code });
      filesystem.rename.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure);
      await replaceReportFile('progress.json.tmp', 'progress.json');
      expect(filesystem.rename).toHaveBeenCalledTimes(3);
      expect(
        filesystem.rename.mock.calls.every(
          call => call[0] === 'progress.json.tmp' && call[1] === 'progress.json'
        )
      ).toBe(true);
      expect(filesystem.delay.mock.calls).toEqual([[25], [50]]);
    }
  );

  it('still rejects a persistent file lock after bounded retries', async () => {
    const failure = Object.assign(new Error('persistently busy'), { code: 'EPERM' });
    filesystem.rename.mockRejectedValue(failure);
    await expect(replaceReportFile('report.json.tmp', 'report.json')).rejects.toBe(failure);
    expect(filesystem.rename).toHaveBeenCalledTimes(8);
    expect(filesystem.delay.mock.calls).toEqual([[25], [50], [100], [200], [400], [400], [400]]);
  });

  it.each(['ENOENT', 'ENOSPC', undefined])(
    'immediately preserves a non-transient %s error',
    async code => {
      const failure = Object.assign(new Error('cannot replace'), { code });
      filesystem.rename.mockRejectedValue(failure);
      await expect(replaceReportFile('report.json.tmp', 'report.json')).rejects.toBe(failure);
      expect(filesystem.rename).toHaveBeenCalledTimes(1);
      expect(filesystem.delay).not.toHaveBeenCalled();
    }
  );
});
