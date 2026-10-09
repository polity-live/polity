import path from 'node:path';
import { statSync } from 'node:fs';
import { createInterface } from 'node:readline';

/** Locate the installed Corepack without relying on shell shims or downloading another version. */
export function corepackPNPMEntryPoint(
  nodeExecutable,
  platform = process.platform,
  isFile = candidate => {
    try {
      return statSync(candidate).isFile();
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
      throw error;
    }
  }
) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const directory = paths.dirname(nodeExecutable);
  const candidates = [
    paths.join(directory, 'node_modules/corepack/dist/pnpm.js'),
    paths.resolve(directory, '../lib/node_modules/corepack/dist/pnpm.js'),
  ];
  const found = candidates.find(isFile);
  if (!found)
    throw new Error(
      'Installed Corepack pnpm entrypoint is missing; enable the pinned package manager before measurement'
    );
  return found;
}

/** Prevent stdout/stderr chunks from interleaving inside structured log records. */
export function pipeRuntimeLogLines(source, destination) {
  const reader = createInterface({ input: source, crlfDelay: Infinity });
  reader.on('line', line => destination.write(`${line}\n`));
  return reader;
}

export function assertOutputDirectory(root, directory) {
  const allowed = path.resolve(root, 'output/zero-performance');
  const relative = path.relative(allowed, path.resolve(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Benchmark output must be a new child of output/zero-performance');
}
export function isolatedPorts(start) {
  if (!Number.isInteger(start) || start < 55620 || start >= 55820)
    throw new Error('Invalid isolated port block');
  return {
    app: start,
    zero: start + 1,
    zeroChange: start + 2,
    zeroReplication: start + 3,
    api: start + 4,
    database: start + 5,
    shadow: start + 6,
  };
}
export function safeEnvironment(source) {
  const allowed = new Set([
    'PATH',
    'Path',
    'SYSTEMROOT',
    'SystemRoot',
    'WINDIR',
    'COMSPEC',
    'ComSpec',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'PATHEXT',
    'CI',
    'DOCKER_HOST',
    'DOCKER_CONTEXT',
  ]);
  return Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key)));
}

export function isolatedBuildEnvironment(sandbox) {
  return {
    POLITY_VITE_CACHE_DIR: path.resolve(sandbox, '../build-cache/vite'),
    POLITY_NITRO_BUILD_DIR: path.resolve(sandbox, '../build-cache/nitro'),
  };
}

export function applicationStorageBuckets(configuration) {
  const sections = configuration
    .split(/(?=^\[)/m)
    .filter(section => /^\[storage\.buckets\.[\w-]+\]/.test(section));
  if (sections.some(section => /^\s*objects_path\s*=/m.test(section)))
    throw new Error('Benchmark storage buckets cannot seed existing object contents');
  return sections.join('\n');
}

/** Run existing DB contracts only against the verified, newly created benchmark DB. */
export function isolatedIntegrityEnvironment(source, verifiedDatabaseURL) {
  const address = new URL(verifiedDatabaseURL);
  const start = Number(address.port) - 5;
  const ports = isolatedPorts(start);
  if (
    address.protocol !== 'postgresql:' ||
    address.hostname !== '127.0.0.1' ||
    address.pathname !== '/postgres' ||
    start % 10 !== 0 ||
    source.ZERO_UPSTREAM_DB !== verifiedDatabaseURL ||
    source.SUPABASE_URL !== `http://127.0.0.1:${ports.api}`
  )
    throw new Error('Integrity tests require the verified isolated benchmark database');
  return {
    ...source,
    NODE_ENV: 'test',
    ZERO_UPSTREAM_DB: verifiedDatabaseURL,
    DATABASE_URL: verifiedDatabaseURL,
    SUPABASE_DB_URL: verifiedDatabaseURL,
    E2E_DATABASE_URL: verifiedDatabaseURL,
    STUDIO_DATABASE_URL: verifiedDatabaseURL,
    STUDIO_TEST_DATABASE_URL: verifiedDatabaseURL,
  };
}

export async function verifyBuildAssets(appURL, request = fetch) {
  const response = await request(appURL);
  if (!response.ok) throw new Error('Production build readiness failed');
  const html = await response.text();
  const assets = [
    ...new Set([...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(match => match[1])),
  ];
  if (!assets.some(asset => new URL(asset, appURL).pathname.endsWith('.js')))
    throw new Error('Production build has no browser entry');
  const stylesheets = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(link => /\brel="stylesheet"/i.test(link));
  if (
    !stylesheets.length ||
    stylesheets.some(link => !/\bhref="[^"\s]+"/i.test(link)) ||
    !assets.some(asset => new URL(asset, appURL).pathname.endsWith('.css'))
  )
    throw new Error('Production build has no valid application stylesheet');
  for (const asset of assets) {
    const address = new URL(asset, appURL);
    if (address.origin !== new URL(appURL).origin)
      throw new Error('Production build references another environment');
    if (!(await request(address, { method: 'HEAD' })).ok)
      throw new Error(`Production build references missing asset: ${address.pathname}`);
  }
  return assets.length;
}
