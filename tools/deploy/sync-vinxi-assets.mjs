import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

export async function syncVinxiAssets(options = {}) {
  const workspace = path.resolve(options.workspace ?? '.');
  const sourceDir = path.resolve(
    options.sourceDir ?? path.join(workspace, '.vinxi/build/client/_build')
  );
  const targetDirs = options.targetDirs ?? [
    path.join(workspace, 'public/_build'),
    path.join(workspace, '.output/public/_build'),
  ];

  for (const target of targetDirs) {
    const targetDir = path.resolve(target);
    if (targetDir === workspace || !targetDir.startsWith(`${workspace}${path.sep}`)) {
      throw new Error(`Refusing to replace asset target outside workspace: ${targetDir}`);
    }
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(path.dirname(targetDir), { recursive: true });
    await cp(sourceDir, targetDir, { recursive: true });
  }
}

await runCliIfMain(import.meta.url, syncVinxiAssets);
