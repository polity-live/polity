import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const node = process.execPath;
const supabaseCli = path.join(projectRoot, 'node_modules', 'supabase', 'dist', 'supabase.js');

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

run(node, [supabaseCli, 'start'], 'Starting the local Supabase stack');

if (process.env.E2E_REUSE_SERVER === '1') {
  run(node, ['tools/e2e/verify-reused-stack.mjs'], 'Verifying the reusable E2E stack');
}

if (process.env.E2E_REUSE_SERVER !== '1' && process.env.E2E_SKIP_DB_RESET !== '1') {
  const resetArgs = [supabaseCli, 'db', 'reset', '--local'];
  if (process.env.E2E_WITH_SEED !== '1') resetArgs.push('--no-seed');
  run(node, resetArgs, 'Resetting the E2E database');
}

if (process.env.E2E_REUSE_SERVER !== '1') {
  run(node, ['tools/zero/clean-dev-cache.mjs'], 'Cleaning the local Zero replica');
}
