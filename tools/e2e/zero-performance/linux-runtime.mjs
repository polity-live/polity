import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** @param {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptionsWithStringEncoding) => Pick<import('node:child_process').SpawnSyncReturns<string>, 'status' | 'stdout'>} [execute] */
export function stopOwnedRuntime(projectID, container, execute = spawnSync) {
  const match = /^polity-zero-performance-([a-f0-9]{8})$/.exec(projectID);
  if (
    !match ||
    ![
      `polity-zero-performance-runtime-${match[1]}`,
      `polity-zero-performance-app-${match[1]}`,
      `polity-zero-performance-browser-${match[1]}`,
    ].includes(container)
  )
    throw new Error('Invalid isolated runtime identity');
  /** @type {import('node:child_process').SpawnSyncOptionsWithStringEncoding} */
  const options = { encoding: 'utf8', windowsHide: true, timeout: 30_000 };
  const present = execute(
    'docker',
    ['ps', '-a', '--filter', `name=^${container}$`, '--format', '{{.Names}}'],
    options
  );
  if (present.status !== 0) throw new Error('Cannot inspect isolated runtime cleanup');
  if (!present.stdout.trim()) return;
  if (present.stdout.trim() !== container) throw new Error('Runtime container identity mismatch');
  const inspected = execute(
    'docker',
    ['inspect', '--format', '{{json .Config.Labels}}', container],
    options
  );
  if (
    inspected.status !== 0 ||
    JSON.parse(inspected.stdout)?.['polity.zero-performance.project'] !== projectID
  )
    throw new Error('Runtime ownership label mismatch');
  if (execute('docker', ['stop', '--time', '10', container], options).status !== 0)
    throw new Error('Isolated Linux Zero cleanup failed');
}

export function verifyLinuxImage(image, installedZero) {
  const fingerprint = `(${javascriptFingerprint.toString()})('/app/node_modules/@rocicorp/zero')`;
  const dependencies = `(${dependencyVersions.toString()})('/app/node_modules/@rocicorp/zero')`;
  const script = `const {createHash}=require('node:crypto'); const {readFileSync,readdirSync,realpathSync,existsSync}=require('node:fs'); const {createRequire}=require('node:module'); const path=require('node:path'); console.log(JSON.stringify({node:process.version, zero:require('/app/node_modules/@rocicorp/zero/package.json').version, fingerprint:${fingerprint}, dependencies:${dependencies}}));`;
  const checked = spawnSync('docker', ['run', '--rm', image, 'node', '-e', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  });
  if (checked.status !== 0) throw new Error('Cannot verify the Linux Zero runtime image');
  const actual = JSON.parse(checked.stdout);
  const version = JSON.parse(
    readFileSync(path.join(installedZero, 'package.json'), 'utf8')
  ).version;
  if (
    actual.node !== process.version ||
    actual.zero !== version ||
    actual.fingerprint !== javascriptFingerprint(installedZero) ||
    JSON.stringify(actual.dependencies) !== JSON.stringify(dependencyVersions(installedZero))
  )
    throw new Error(
      'Linux runtime changes pinned Node/Zero, Zero JavaScript, or runtime dependency versions'
    );
  return { image, platform: 'linux', ...actual };
}

/** Resolve the full required dependency closure; platform optional binaries differ. */
export function dependencyVersions(root) {
  const visited = new Set();
  const versions = new Set();
  const visit = directory => {
    directory = realpathSync(directory);
    if (visited.has(directory)) return;
    visited.add(directory);
    const manifest = path.join(directory, 'package.json');
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    versions.add(`${pkg.name}@${pkg.version}`);
    const resolve = createRequire(manifest);
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      if (name in (pkg.optionalDependencies ?? {})) continue;
      if (resolve.resolve.paths(name) === null) continue; // Built-ins are pinned by Node.
      // Package exports can hide package.json, and ESM-only packages can have no
      // CommonJS entry. Resolve installed metadata through Node's search paths.
      const metadata = (resolve.resolve.paths(name) ?? [])
        .map(base => path.join(base, name, 'package.json'))
        .find(file => existsSync(file));
      if (!metadata) throw new Error(`Missing runtime dependency metadata: ${name}`);
      visit(path.dirname(metadata));
    }
  };
  visit(root);
  return [...versions].sort();
}

export function javascriptFingerprint(root) {
  const hash = createHash('sha256');
  function visit(relative) {
    for (const item of readdirSync(path.join(root, relative), { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name, 'en')
    )) {
      const file = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) visit(file);
      else if (item.name.endsWith('.js'))
        hash
          .update(file)
          .update('\0')
          .update(readFileSync(path.join(root, file)));
    }
  }
  visit('out');
  return hash.digest('hex');
}

export function linuxEnvironment(environment) {
  const result = Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) => key.startsWith('ZERO_') && !key.startsWith('ZERO_PERFORMANCE_')
    )
  );
  for (const key of [
    'ZERO_UPSTREAM_DB',
    'ZERO_CVR_DB',
    'ZERO_CHANGE_DB',
    'ZERO_QUERY_URL',
    'ZERO_MUTATE_URL',
  ]) {
    const address = new URL(result[key]);
    if (!['127.0.0.1', 'localhost'].includes(address.hostname))
      throw new Error('Docker runtime requires the isolated local stack');
    address.hostname = 'host.docker.internal';
    result[key] = address.toString();
  }
  result.ZERO_REPLICA_FILE = '/replica/zero.db';
  result.NODE_ENV = 'production';
  return result;
}
