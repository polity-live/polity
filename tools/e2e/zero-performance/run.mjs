import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, writeFile, symlink, access, open, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';
import {
  assertOutputDirectory,
  isolatedPorts,
  safeEnvironment,
  isolatedBuildEnvironment,
  verifyBuildAssets,
} from './isolation.mjs';
import {
  verifyLinuxImage,
  linuxEnvironment,
  stopOwnedRuntime,
  dependencyVersions,
} from './linux-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const filter = option('--query');
const selectedCase = option('--case');
const sourceRef = option('--source-ref');
const selectionFile = option('--selection-file');
const runID = randomUUID().slice(0, 8);
const artifactRoot = path.resolve(
  option('--output') ?? path.join(root, 'output/zero-performance', runID)
);
const sandbox = path.join(artifactRoot, 'project');
assertOutputDirectory(root, artifactRoot);
const processes = [];
const startup = {};
let stackStarted = false;
let environment;
let stopping = false;
let reservation;
let runtimeContainer;
let appContainer;

function executable(relative) {
  return path.join(root, 'node_modules', relative);
}
function run(command, argv, options = {}) {
  const label = options.label ?? path.basename(command);
  const log = createWriteStream(path.join(artifactRoot, `${label}.log`), { flags: 'a' });
  const child = spawn(command, argv, {
    cwd: sandbox,
    env: environment,
    shell: false,
    windowsHide: true,
  });
  processes.push(child);
  // Supabase's stdout startup summary contains ephemeral API/S3 credentials.
  if (label !== 'stack-start') child.stdout?.pipe(log, { end: false });
  else child.stdout?.resume();
  child.stderr?.pipe(log, { end: false });
  return {
    child,
    done: new Promise((resolve, reject) => {
      child.once('error', error => {
        log.end();
        reject(error);
      });
      child.once('exit', (code, signal) => {
        log.end();
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `${label} failed (${code ?? signal}); see ${path.join(artifactRoot, `${label}.log`)}`
            )
          );
      });
    }),
  };
}
async function command(argv, label) {
  await run(process.execPath, argv, { label }).done;
}
async function portFree(port) {
  return new Promise(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
async function ports() {
  const containers = spawnSync('docker', ['ps', '--format', '{{.Ports}}'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (containers.status !== 0) throw new Error('Cannot inspect Docker port allocations');
  const allocated = new Set(
    [...containers.stdout.matchAll(/:(\d+)->/g)].map(match => Number(match[1]))
  );
  const locks = path.join(root, 'output/zero-performance/.ports');
  await mkdir(locks, { recursive: true });
  for (let start = 55620; start < 55820; start += 10) {
    if (Array.from({ length: 7 }, (_, i) => start + i).some(port => allocated.has(port))) continue;
    const lock = path.join(locks, `${start}.lock`);
    let handle;
    try {
      handle = await open(lock, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try {
        owner = JSON.parse(await readFile(lock, 'utf8'));
      } catch {
        continue; /* Another runner may still be writing its atomic reservation. */
      }
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) continue;
      try {
        process.kill(owner.pid, 0);
        continue;
      } catch (error) {
        if (error.code !== 'ESRCH') continue;
      }
      await unlink(lock);
      try {
        handle = await open(lock, 'wx');
      } catch (error) {
        if (error.code === 'EEXIST') continue;
        throw error;
      }
    }
    await handle.writeFile(JSON.stringify({ runID, pid: process.pid }));
    await handle.close();
    if (
      (await Promise.all(Array.from({ length: 7 }, (_, i) => portFree(start + i)))).every(Boolean)
    ) {
      reservation = lock;
      return start;
    }
    await unlink(lock);
  }
  throw new Error('No unused port block for the isolated benchmark');
}
async function copySource() {
  if (sourceRef) {
    const archive = path.join(artifactRoot, 'source.tar');
    const archived = spawnSync('git', ['archive', '--format=tar', '-o', archive, sourceRef], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (archived.status !== 0)
      throw new Error(`Cannot archive baseline ${sourceRef}: ${archived.stderr}`);
    const extracted = spawnSync('tar', ['-xf', archive, '-C', sandbox], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (extracted.status !== 0) throw new Error(`Cannot extract baseline: ${extracted.stderr}`);
  } else {
    const result = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) throw new Error('Cannot inventory working tree');
    for (const file of new Set(result.stdout.split('\0').filter(Boolean))) {
      if (
        file.startsWith('.env') ||
        file.startsWith('output/') ||
        file.startsWith('node_modules/') ||
        file.startsWith('.git/')
      )
        continue;
      const target = path.join(sandbox, file);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(root, file), target);
    }
  }
  const rootLock = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
  const copiedLock = await readFile(path.join(sandbox, 'pnpm-lock.yaml'), 'utf8');
  const locked = parseYAML(copiedLock).packages;
  const unpinned = dependencyVersions(path.join(root, 'node_modules/@rocicorp/zero')).filter(
    dependency => !locked[dependency]
  );
  if (rootLock !== copiedLock || unpinned.length || args.includes('--frozen-dependencies')) {
    const dependenciesAt = Date.now();
    const corepack = path.join(
      path.dirname(process.execPath),
      'node_modules/corepack/dist/pnpm.js'
    );
    await command(
      [corepack, 'install', '--frozen-lockfile', '--ignore-scripts'],
      'dependencies-install'
    );
    await command([corepack, 'rebuild', '@rocicorp/zero-sqlite3'], 'dependencies-native');
    startup.dependenciesMs = Date.now() - dependenciesAt;
    startup.replacedUnpinnedDependencies = unpinned;
  } else {
    await symlink(
      path.join(root, 'node_modules'),
      path.join(sandbox, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  }
}
async function waitHTTP(url, child, deadlineMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    if (child.exitCode !== null) throw new Error(`Service exited before readiness: ${url}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2_000) })).ok) return;
    } catch {
      /* starting */
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Service readiness timeout: ${url}`);
}
async function stop() {
  if (stopping) return;
  stopping = true;
  let runtimeCleanupError;
  for (const container of [runtimeContainer, appContainer].filter(Boolean)) {
    try {
      stopOwnedRuntime(`polity-zero-performance-${runID}`, container);
    } catch (error) {
      runtimeCleanupError = error;
    }
  }
  for (const child of processes.slice().reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    else {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 10_000)),
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }
  if (stackStarted) {
    const result = spawnSync(
      process.execPath,
      [executable('supabase/dist/supabase.js'), '--workdir', sandbox, 'stop', '--no-backup'],
      { cwd: sandbox, env: environment, encoding: 'utf8', windowsHide: true, timeout: 120_000 }
    );
    await writeFile(
      path.join(artifactRoot, 'stack-stop.log'),
      `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    );
    if (result.status !== 0)
      throw new Error('Isolated Supabase cleanup failed; see stack-stop.log');
  }
  if (reservation) {
    await unlink(reservation);
    reservation = undefined;
  }
  if (runtimeCleanupError) throw runtimeCleanupError;
}

for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    stop().then(
      () => process.exit(signal === 'SIGINT' ? 130 : 143),
      error => {
        console.error(String(error));
        process.exit(1);
      }
    );
  });

try {
  let exists = false;
  try {
    await access(sandbox);
    exists = true;
  } catch {
    /* new directory */
  }
  if (exists) throw new Error('Benchmark sandbox already exists; choose a new --output directory');
  await mkdir(sandbox, { recursive: true });
  environment = safeEnvironment(process.env);
  await copySource();
  if (selectionFile) {
    const selection = JSON.parse(await readFile(path.resolve(selectionFile), 'utf8'));
    if (
      !Array.isArray(selection) ||
      !selection.length ||
      selection.some(key => typeof key !== 'string')
    )
      throw new Error('Invalid confirmation case selection');
    await writeFile(
      path.join(sandbox, '.zero-performance-selection.json'),
      JSON.stringify(selection)
    );
  }
  await access(path.join(sandbox, 'tools/e2e/zero-performance/measure.ts'));
  await command(['--import', 'tsx', 'tools/e2e/zero-performance/check.ts'], 'catalog');
  const start = await ports();
  isolatedPorts(start);
  const appURL = `http://127.0.0.1:${start}`;
  const cacheURL = `http://127.0.0.1:${start + 1}`;
  // Zero also owns port+1 (change streamer) and port+2 (replication manager).
  const supabaseURL = `http://127.0.0.1:${start + 4}`;
  await writeFile(
    path.join(sandbox, 'supabase/config.toml'),
    `project_id = "polity-zero-performance-${runID}"
[api]
enabled = true
port = ${start + 4}
schemas = ["public"]
[db]
port = ${start + 5}
shadow_port = ${start + 6}
major_version = 17
[db.settings]
max_connections = 300
[db.seed]
enabled = false
[studio]
enabled = false
[analytics]
enabled = false
[local_smtp]
enabled = false
[auth]
enabled = true
site_url = "${appURL}"
additional_redirect_urls = ["${appURL}/auth/callback"]
[auth.email]
enable_signup = true
enable_confirmations = false
[storage]
enabled = true
`
  );
  console.info(`Isolated benchmark ${runID}; artifacts: ${artifactRoot}`);
  const stackAt = Date.now();
  stackStarted = true;
  await writeFile(
    path.join(artifactRoot, 'stack.json'),
    JSON.stringify({ projectID: `polity-zero-performance-${runID}`, sandbox, artifactRoot })
  );
  await command(
    [executable('supabase/dist/supabase.js'), '--workdir', sandbox, 'start'],
    'stack-start'
  );
  // start applies migrations to a new project; reset is unnecessary and forbidden here.
  const status = spawnSync(
    process.execPath,
    [executable('supabase/dist/supabase.js'), '--workdir', sandbox, 'status', '-o', 'json'],
    { cwd: sandbox, env: environment, encoding: 'utf8', windowsHide: true }
  );
  if (status.status !== 0) throw new Error('Cannot read isolated stack configuration');
  const configuration = JSON.parse(status.stdout);
  startup.supabaseMs = Date.now() - stackAt;
  if (
    configuration.API_URL !== supabaseURL ||
    !String(configuration.DB_URL).includes(`:${start + 5}/`)
  )
    throw new Error('Supabase isolation identity mismatch');
  environment = {
    ...environment,
    ...isolatedBuildEnvironment(sandbox),
    NODE_ENV: 'production',
    VITE_APP_URL: appURL,
    VITE_ZERO_API_URL: args.includes('--linux-app')
      ? `http://polity-zero-performance-app-${runID}:${start}`
      : option('--zero-image')
        ? appURL.replace('127.0.0.1', 'host.docker.internal')
        : appURL,
    VITE_ZERO_CACHE_URL: cacheURL,
    VITE_SUPABASE_URL: supabaseURL,
    VITE_SUPABASE_ANON_KEY: configuration.ANON_KEY,
    SUPABASE_URL: supabaseURL,
    SUPABASE_ANON_KEY: configuration.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: configuration.SERVICE_ROLE_KEY,
    E2E_DATABASE_URL: configuration.DB_URL,
    ZERO_UPSTREAM_DB: configuration.DB_URL,
    ZERO_CVR_DB: configuration.DB_URL,
    ZERO_CHANGE_DB: configuration.DB_URL,
    ZERO_QUERY_URL: `${appURL}/api/query`,
    ZERO_MUTATE_URL: `${appURL}/api/mutate`,
    ZERO_PORT: String(start + 1),
    ZERO_REPLICA_FILE: path.join(artifactRoot, 'replica.db'),
    ZERO_NUM_SYNC_WORKERS: '1',
    ZERO_ADMIN_PASSWORD: `benchmark-${runID}`,
    ZERO_LOG_FORMAT: 'json',
    ZERO_QUERY_HYDRATION_STATS: 'true',
    ZERO_PERFORMANCE_DIAGNOSTICS: '1',
    PORT: String(start),
    HOST: '127.0.0.1',
    ZERO_PERFORMANCE_OUTPUT: artifactRoot,
    ZERO_PERFORMANCE_QUERY: filter ?? '',
    ZERO_PERFORMANCE_CASE: selectedCase ?? '',
    ZERO_PERFORMANCE_LAYER: option('--layer') ?? 'all',
    ZERO_PERFORMANCE_COLLECT_ALL: args.includes('--collect-all') ? '1' : '',
    ZERO_PERFORMANCE_CPU_PROFILE: args.includes('--profile-navigation') ? '1' : '',
    ...(selectionFile
      ? { ZERO_PERFORMANCE_SELECTION: path.join(sandbox, '.zero-performance-selection.json') }
      : {}),
  };
  if (option('--layer') === 'fixtures') {
    await command(['--import', 'tsx', 'tools/e2e/zero-performance/fixture-check.ts'], 'fixtures');
  } else {
    if (
      !filter &&
      !selectedCase &&
      !selectionFile &&
      !['journeys', 'security'].includes(option('--layer'))
    )
      await command(['--import', 'tsx', 'tools/e2e/zero-performance/fixture-check.ts'], 'fixtures');
    const buildAt = Date.now();
    await command(
      [path.join(sandbox, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'production'],
      'build'
    );
    startup.buildMs = Date.now() - buildAt;
    const image = option('--zero-image');
    if (args.includes('--linux-app') && !image)
      throw new Error('--linux-app requires a verified --zero-image');
    if (image) {
      const verificationAt = Date.now();
      startup.zeroRuntime = verifyLinuxImage(
        image,
        path.join(sandbox, 'node_modules/@rocicorp/zero')
      );
      startup.runtimeVerificationMs = Date.now() - verificationAt;
    }
    const appAt = Date.now();
    let app;
    if (args.includes('--linux-app')) {
      // Nitro traces Windows dependencies as absolute directory junctions. Copy
      // their actual files into this run's private artifact directory so Linux
      // resolves the same build without depending on Windows junction handling.
      const appCopyAt = Date.now();
      await cp(path.join(sandbox, '.output'), path.join(artifactRoot, 'linux-build'), {
        recursive: true,
        dereference: true,
        errorOnExist: true,
        force: false,
      });
      startup.appCopyMs = Date.now() - appCopyAt;
      appContainer = `polity-zero-performance-app-${runID}`;
      await writeFile(
        path.join(artifactRoot, 'stack.json'),
        JSON.stringify({
          projectID: `polity-zero-performance-${runID}`,
          sandbox,
          artifactRoot,
          appContainer,
        })
      );
      const dockerArgs = [
        'run',
        '--rm',
        '--name',
        appContainer,
        '--label',
        `polity.zero-performance.project=polity-zero-performance-${runID}`,
        '--network',
        `supabase_network_polity-zero-performance-${runID}`,
        '--publish',
        `127.0.0.1:${start}:${start}`,
        '--mount',
        `type=bind,source=${artifactRoot},target=/benchmark`,
        '--workdir',
        '/benchmark/project',
      ];
      const appEnvironment = {
        ...environment,
        HOST: '0.0.0.0',
        SUPABASE_URL: `http://supabase_kong_polity-zero-performance-${runID}:8000`,
        ZERO_PERFORMANCE_OUTPUT: '/benchmark',
      };
      for (const key of ['ZERO_UPSTREAM_DB', 'ZERO_CVR_DB', 'ZERO_CHANGE_DB', 'E2E_DATABASE_URL']) {
        const address = new URL(appEnvironment[key]);
        address.hostname = `supabase_db_polity-zero-performance-${runID}`;
        address.port = '5432';
        appEnvironment[key] = address.toString();
      }
      for (const [key, value] of Object.entries(appEnvironment))
        if (
          /^(VITE_|SUPABASE_|ZERO_)/.test(key) ||
          ['NODE_ENV', 'PORT', 'HOST', 'E2E_DATABASE_URL'].includes(key)
        )
          dockerArgs.push('--env', `${key}=${value}`);
      dockerArgs.push(
        image,
        'node',
        '--import',
        './tools/e2e/zero-performance/api-timing.mjs',
        '/benchmark/linux-build/server/index.mjs'
      );
      app = run('docker', dockerArgs, { label: 'app' });
      startup.appRuntime = startup.zeroRuntime;
    } else
      app = run(
        process.execPath,
        ['--import', './tools/e2e/zero-performance/api-timing.mjs', '.output/server/index.mjs'],
        { label: 'app' }
      );
    app.done.catch(() => {
      /* Readiness and child exit checks report service failures. */
    });
    await waitHTTP(appURL, app.child);
    startup.verifiedAssets = await verifyBuildAssets(appURL);
    startup.appMs = Date.now() - appAt;
    const zeroAt = Date.now();
    const zeroArgs =
      process.platform === 'linux'
        ? ['tools/zero/run-e2e-cache.mjs']
        : [path.join(sandbox, 'node_modules/@rocicorp/zero/out/zero/src/cli.js')];
    let zero;
    if (image) {
      runtimeContainer = `polity-zero-performance-runtime-${runID}`;
      await writeFile(
        path.join(artifactRoot, 'stack.json'),
        JSON.stringify({
          projectID: `polity-zero-performance-${runID}`,
          sandbox,
          artifactRoot,
          runtimeContainer,
          ...(appContainer ? { appContainer } : {}),
        })
      );
      const dockerArgs = [
        'run',
        '--rm',
        '--name',
        runtimeContainer,
        '--label',
        `polity.zero-performance.project=polity-zero-performance-${runID}`,
        '--publish',
        `127.0.0.1:${start + 1}:${start + 1}`,
        '--tmpfs',
        '/replica',
      ];
      const zeroEnvironment = linuxEnvironment(environment);
      if (appContainer) {
        dockerArgs.push('--network', `supabase_network_polity-zero-performance-${runID}`);
        zeroEnvironment.ZERO_QUERY_URL = `http://${appContainer}:${start}/api/query`;
        zeroEnvironment.ZERO_MUTATE_URL = `http://${appContainer}:${start}/api/mutate`;
        for (const key of ['ZERO_UPSTREAM_DB', 'ZERO_CVR_DB', 'ZERO_CHANGE_DB']) {
          const address = new URL(zeroEnvironment[key]);
          address.hostname = `supabase_db_polity-zero-performance-${runID}`;
          address.port = '5432';
          zeroEnvironment[key] = address.toString();
        }
      }
      for (const [key, value] of Object.entries(zeroEnvironment))
        dockerArgs.push('--env', `${key}=${value}`);
      dockerArgs.push(image, 'node', '/app/node_modules/@rocicorp/zero/out/zero/src/cli.js');
      zero = run('docker', dockerArgs, { label: 'zero' });
    } else zero = run(process.execPath, zeroArgs, { label: 'zero' });
    zero.done.catch(() => {
      /* Readiness and child exit checks report service failures. */
    });
    await waitHTTP(`${cacheURL}/keepalive`, zero.child);
    startup.zeroMs = Date.now() - zeroAt;
    await writeFile(
      path.join(artifactRoot, 'startup.json'),
      JSON.stringify(
        { runID, sourceRef: sourceRef ?? 'working-tree', startup, appURL, cacheURL, supabaseURL },
        null,
        2
      )
    );
    await command(['--import', 'tsx', 'tools/e2e/zero-performance/collect.ts'], 'measure');
  }
} catch (error) {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    path.join(artifactRoot, 'failure.json'),
    JSON.stringify(
      { error: error instanceof Error ? error.message : String(error), startup },
      null,
      2
    )
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  try {
    await stop();
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
  // Preserve files and logs for failed runs. The stack is always stopped.
  try {
    await access(path.join(artifactRoot, 'results.csv'));
    console.info(
      `Measurement tables: ${path.join(artifactRoot, 'results.csv')} (full diagnostics in report.json)`
    );
  } catch {
    /* interrupted or fixture-only run */
  }
}
