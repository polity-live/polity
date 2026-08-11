import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expectedCommit = process.env.E2E_REUSE_COMMIT;
const expectedSchema = process.env.E2E_REUSE_SCHEMA_HASH;
const appUrl = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000');
const zeroUrl = new URL(process.env.E2E_ZERO_KEEPALIVE_URL ?? 'http://127.0.0.1:4848/keepalive');
const supabaseUrl = new URL(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://invalid.example'
);

function fail(message) {
  throw new Error(`Refusing E2E_REUSE_SERVER=1: ${message}`);
}

function schemaHash() {
  const directory = path.join(root, 'supabase', 'migrations');
  const hash = crypto.createHash('sha256');
  for (const file of fs
    .readdirSync(directory)
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(directory, file)));
  }
  return hash.digest('hex').slice(0, 16);
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const schema = schemaHash();

if (!expectedCommit) fail(`E2E_REUSE_COMMIT is required (current: ${commit})`);
if (expectedCommit !== commit)
  fail(`commit mismatch; expected ${expectedCommit}, current ${commit}`);
if (!expectedSchema) fail(`E2E_REUSE_SCHEMA_HASH is required (current: ${schema})`);
if (expectedSchema !== schema)
  fail(`schema mismatch; expected ${expectedSchema}, current ${schema}`);
if (!['localhost', '127.0.0.1'].includes(appUrl.hostname))
  fail(`non-local app origin ${appUrl.origin}`);
if (!['localhost', '127.0.0.1'].includes(supabaseUrl.hostname))
  fail(`non-local Supabase origin ${supabaseUrl.origin}`);

const appResponse = await fetch(appUrl, { redirect: 'manual' }).catch(() => null);
if (!appResponse?.ok && !appResponse?.status.toString().startsWith('3')) {
  fail(`app is not ready at ${appUrl.origin}`);
}

const zeroResponse = await fetch(zeroUrl).catch(() => null);
if (!zeroResponse?.ok) fail(`Zero is not ready at ${zeroUrl}`);

console.info(
  `Verified reusable E2E stack: commit=${commit}, schema=${schema}, origin=${appUrl.origin}`
);
