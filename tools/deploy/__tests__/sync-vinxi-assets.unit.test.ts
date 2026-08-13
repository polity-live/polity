import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { syncVinxiAssets } from '../sync-vinxi-assets.mjs';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('Vinxi asset synchronization', () => {
  it('replaces both build targets from an isolated workspace', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-vinxi-assets-'));
    roots.push(workspace);
    const source = path.join(workspace, '.vinxi/build/client/_build');
    const publicTarget = path.join(workspace, 'public/_build');
    const outputTarget = path.join(workspace, '.output/public/_build');
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(publicTarget, { recursive: true });
    fs.writeFileSync(path.join(source, 'app.js'), 'current');
    fs.writeFileSync(path.join(publicTarget, 'stale.js'), 'stale');

    await syncVinxiAssets({ workspace, sourceDir: source });

    expect(fs.readFileSync(path.join(publicTarget, 'app.js'), 'utf8')).toBe('current');
    expect(fs.readFileSync(path.join(outputTarget, 'app.js'), 'utf8')).toBe('current');
    expect(fs.existsSync(path.join(publicTarget, 'stale.js'))).toBe(false);
  });

  it('refuses destructive targets outside the exact workspace', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-vinxi-assets-'));
    roots.push(workspace);
    const source = path.join(workspace, '.vinxi/build/client/_build');
    fs.mkdirSync(source, { recursive: true });

    await expect(
      syncVinxiAssets({ workspace, targetDirs: [path.dirname(workspace)] })
    ).rejects.toThrow('outside workspace');
    await expect(syncVinxiAssets({ workspace, targetDirs: [workspace] })).rejects.toThrow(
      'outside workspace'
    );
  });

  it('resolves default workspace paths without mutating them when no targets are requested', async () => {
    await expect(syncVinxiAssets({ targetDirs: [] })).resolves.toBeUndefined();
  });
});
