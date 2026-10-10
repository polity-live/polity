import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { stageArtifacts } from '../stage-artifacts.mjs';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    const relative = path.relative(tmpdir(), root);
    if (!relative.startsWith('zero-staging-test-') || relative.includes(path.sep))
      throw new Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true });
  }
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'zero-staging-test-'));
  roots.push(root);
  const source = path.join(root, 'source'),
    target = path.join(root, 'staged');
  await mkdir(source);
  const save = async (relative: string, value: string) => {
    const filename = path.join(source, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, value);
  };
  return { root, source, target, save };
}
describe('original CI artifact staging', () => {
  it('preserves report, original API records, plans and partial worker diagnostics byte for byte', async () => {
    const { source, target, save } = await fixture();
    const paths = [
      'runner.json',
      'comparison.json',
      'head/initial/report.json',
      'head/initial/plans/query.json',
      'head/initial/workers/001/measurements.ndjson',
      'base/failure.json',
      'base/stack-start.log',
      'head/query-api.ndjson',
      'head/initial/screenshots/failure.png',
    ];
    for (const relative of paths) await save(relative, `original\r\n${relative}\r\n`);
    const staged = await stageArtifacts(source, target);
    expect(staged.files).toBe(paths.length);
    for (const relative of paths) {
      const digest = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
      expect(digest(await readFile(path.join(target, relative)))).toBe(
        digest(await readFile(path.join(source, relative)))
      );
    }
  });
  it('does not traverse app copies, build caches or symlinked dependency trees', async () => {
    const { root, source, target, save } = await fixture();
    await save('runner.json', '{}');
    await save('head/project/public/pwa/screenshots/polity.png', 'app asset');
    await save('head/project/node_modules/dependency/report.json', 'dependency');
    await save('head/build-cache/nitro/report.json', 'compiled app');
    await save('head/.env', 'credential');
    const external = path.join(root, 'dependencies');
    await mkdir(external);
    await writeFile(path.join(external, 'report.json'), 'linked dependency');
    await symlink(external, path.join(source, 'linked'), 'junction');
    expect((await stageArtifacts(source, target)).files).toBe(1);
    expect(await readdir(target)).toEqual(['runner.json']);
  });
  it('rejects recursive destinations and existing outputs without overwriting them', async () => {
    const { source, target, save } = await fixture();
    await save('runner.json', 'original');
    await expect(stageArtifacts(source, path.join(source, 'nested'))).rejects.toThrow('outside');
    await mkdir(target);
    await writeFile(path.join(target, 'runner.json'), 'retained');
    await expect(stageArtifacts(source, target)).rejects.toThrow();
    expect(await readFile(path.join(target, 'runner.json'), 'utf8')).toBe('retained');
  });
});
