import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { runtimeMetadata } from '../execution';
const files = vi.hoisted(() => ({
  version: '1.9.0',
  lock: 'reviewed revision-owned lock',
  source: 'original SDK source',
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (file: string) =>
    file.endsWith('package.json')
      ? JSON.stringify({ version: files.version })
      : Buffer.from(file.endsWith('table-source.js') ? files.source : files.lock)
  ),
}));
afterEach(() => {
  files.version = '1.9.0';
  files.lock = 'reviewed revision-owned lock';
  files.source = 'original SDK source';
});
describe('shared benchmark runtime fingerprint', () => {
  it('matches collector and worker fingerprints and detects changed revision dependencies', async () => {
    const collector = await runtimeMetadata(158);
    expect(await runtimeMetadata(158)).toEqual(collector);
    expect(collector).toMatchObject({
      zero: '1.9.0',
      schemaTables: 158,
      lockSHA256: createHash('sha256').update(files.lock).digest('hex'),
      scanStatusSourceSHA256: createHash('sha256').update(files.source).digest('hex'),
    });
    files.lock = 'different revision-owned lock';
    expect((await runtimeMetadata(158)).lockSHA256).not.toBe(collector.lockSHA256);
    files.source = 'changed analyzer source';
    expect((await runtimeMetadata(158)).scanStatusSourceSHA256).not.toBe(
      collector.scanStatusSourceSHA256
    );
  });
  it('fails closed on missing runtime evidence', async () => {
    await expect(runtimeMetadata(0)).rejects.toThrow('Invalid runtime schema');
    files.version = '';
    await expect(runtimeMetadata(158)).rejects.toThrow('Missing Zero runtime version');
    files.version = '1.9.0';
    files.lock = '';
    await expect(runtimeMetadata(158)).rejects.toThrow('Missing runtime lockfile');
  });
});
