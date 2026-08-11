import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const BUILD_PROVENANCE_VERSION = 1;
export const BUILD_PROVENANCE_FILE = '.output/e2e-build-provenance.json';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function requiredOrigin(value, label) {
  if (!value) throw new Error(`${label} is required for the isolated E2E stack.`);
  return new URL(value).origin;
}

export function schemaHash(root) {
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

export function currentStackIdentity(root, environment = process.env) {
  return {
    appOrigin: requiredOrigin(
      environment.PLAYWRIGHT_BASE_URL ?? environment.VITE_APP_URL ?? 'http://localhost:3000',
      'VITE_APP_URL'
    ),
    supabaseOrigin: requiredOrigin(
      environment.VITE_SUPABASE_URL ?? environment.SUPABASE_URL,
      'VITE_SUPABASE_URL'
    ),
    zeroOrigin: requiredOrigin(
      environment.VITE_ZERO_CACHE_URL ?? 'http://127.0.0.1:4848',
      'VITE_ZERO_CACHE_URL'
    ),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    schemaHash: schemaHash(root),
  };
}

export function assertLocalStack(identity) {
  for (const [label, value] of [
    ['app', identity.appOrigin],
    ['Supabase', identity.supabaseOrigin],
    ['Zero', identity.zeroOrigin],
  ]) {
    const url = new URL(value);
    if (!LOCAL_HOSTS.has(url.hostname)) {
      throw new Error(`Refusing isolated E2E ${label} origin ${url.origin}.`);
    }
  }
}

export function buildProvenance(identity) {
  return {
    version: BUILD_PROVENANCE_VERSION,
    mode: 'production',
    ...identity,
  };
}

export function provenanceRegressions(actual, expectedIdentity) {
  if (!actual || typeof actual !== 'object') return ['missing or invalid provenance'];

  const expected = buildProvenance(expectedIdentity);
  return Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(
      ([key, value]) =>
        `${key} mismatch (build: ${String(actual[key])}, expected: ${String(value)})`
    );
}

export function writeBuildProvenance(root, identity) {
  const target = path.join(root, BUILD_PROVENANCE_FILE);
  fs.writeFileSync(target, `${JSON.stringify(buildProvenance(identity), null, 2)}\n`);
}

export function readBuildProvenance(root) {
  const target = path.join(root, BUILD_PROVENANCE_FILE);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}
