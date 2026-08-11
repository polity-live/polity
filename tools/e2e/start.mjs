import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';

import {
  assertLocalStack,
  currentStackIdentity,
  provenanceRegressions,
  readBuildProvenance,
} from './build-provenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadDotEnv({ path: path.join(root, '.env.development.local'), override: false, quiet: true });
loadDotEnv({ path: path.join(root, '.env.test.local'), override: false, quiet: true });

const identity = currentStackIdentity(root);
assertLocalStack(identity);
const regressions = provenanceRegressions(readBuildProvenance(root), identity);
if (regressions.length) {
  throw new Error(
    `Refusing start:e2e because .output was not built for this stack:\n- ${regressions.join('\n- ')}\nRun npm run build:e2e first.`
  );
}

const child = spawn(
  process.execPath,
  ['tools/e2e/run-with-env.mjs', 'node', '.output/server/index.mjs'],
  { cwd: root, env: process.env, stdio: 'inherit', shell: false }
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', error => {
  throw error;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
