import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';

import {
  assertLocalStack,
  currentStackIdentity,
  writeBuildProvenance,
} from './build-provenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadDotEnv({ path: path.join(root, '.env.development.local'), override: false, quiet: true });
loadDotEnv({ path: path.join(root, '.env.test.local'), override: false, quiet: true });

const identity = currentStackIdentity(root);
assertLocalStack(identity);

const result = spawnSync(
  process.execPath,
  [
    'tools/e2e/run-with-env.mjs',
    'node',
    'node_modules/vite/bin/vite.js',
    'build',
    '--mode',
    'production',
  ],
  { cwd: root, env: process.env, stdio: 'inherit', shell: false }
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Production-mode E2E build failed with exit code ${result.status ?? 'unknown'}.`);
}

writeBuildProvenance(root, identity);
console.info(
  `Recorded E2E build provenance: commit=${identity.commit}, schema=${identity.schemaHash}, Supabase=${identity.supabaseOrigin}`
);
