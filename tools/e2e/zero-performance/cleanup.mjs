import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { assertOutputDirectory, safeEnvironment } from './isolation.mjs';
import { stopOwnedRuntime } from './linux-runtime.mjs';

const root = process.cwd();
const artifacts = path.join(root, 'output/zero-performance');
async function visit(directory) {
  let items;
  try {
    items = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (items.some(item => item.name === 'stack.json')) {
    const owned = JSON.parse(await readFile(path.join(directory, 'stack.json'), 'utf8'));
    assertOutputDirectory(root, directory);
    if (
      path.resolve(owned.artifactRoot) !== path.resolve(directory) ||
      path.resolve(owned.sandbox) !== path.join(path.resolve(directory), 'project') ||
      !/^polity-zero-performance-[a-f0-9]{8}$/.test(owned.projectID)
    )
      throw new Error('Invalid isolated stack identity');
    const config = await readFile(path.join(owned.sandbox, 'supabase/config.toml'), 'utf8');
    if (!config.includes(`project_id = "${owned.projectID}"`))
      throw new Error('Stack project identity mismatch');
    if (owned.runtimeContainer) stopOwnedRuntime(owned.projectID, owned.runtimeContainer);
    if (owned.appContainer) stopOwnedRuntime(owned.projectID, owned.appContainer);
    const stopped = spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/supabase/dist/supabase.js'),
        '--workdir',
        owned.sandbox,
        'stop',
        '--no-backup',
      ],
      { env: safeEnvironment(process.env), stdio: 'inherit', windowsHide: true, timeout: 120_000 }
    );
    if (stopped.status !== 0) process.exitCode = 1;
  }
  for (const item of items)
    if (
      item.isDirectory() &&
      !['project', 'linux-build', 'build-cache', 'node_modules'].includes(item.name)
    )
      await visit(path.join(directory, item.name));
}
await visit(artifacts);
