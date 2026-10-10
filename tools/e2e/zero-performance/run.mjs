import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, writeFile, symlink, access, open, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';
import { mechanics } from './mechanics.mjs';
import {
  assertOutputDirectory,
  isolatedPorts,
  safeEnvironment,
  isolatedBuildEnvironment,
  isolatedIntegrityEnvironment,
  applicationStorageBuckets,
  verifyBuildAssets,
  pipeRuntimeLogLines,
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
const securitySelectionFile = option('--security-selection-file');
const sessionMode = args.includes('--session');
const harnessRoot = option('--harness-root');
const sessionQueue = [];
let wakeSession;
if (sessionMode) {
  if (!process.send) throw new Error('Sessions require an owned IPC parent');
  process.on('message', message => {
    sessionQueue.push(message);
    wakeSession?.();
  });
  process.on('disconnect', () => {
    sessionQueue.push({ type: 'stop' });
    wakeSession?.();
  });
}
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
let browserContainer;

function executable(relative) {
  return path.join(sandbox, 'node_modules', relative);
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
  if (label === 'zero') {
    if (child.stdout) pipeRuntimeLogLines(child.stdout, log);
    if (child.stderr) pipeRuntimeLogLines(child.stderr, log);
  } else if (label !== 'stack-start') child.stdout?.pipe(log, { end: false });
  else child.stdout?.resume();
  if (label !== 'zero') child.stderr?.pipe(log, { end: false });
  return {
    child,
    done: new Promise((resolve, reject) => {
      child.once('error', error => {
        log.end();
        reject(error);
      });
      child.once('close', (code, signal) => {
        log.end(() => {
          if (code === 0) resolve();
          else
            reject(
              new Error(
                `${label} failed (${code ?? signal}); see ${path.join(artifactRoot, `${label}.log`)}`
              )
            );
        });
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
  for (let start = 15620; start < 15820; start += 10) {
    if (Array.from({ length: 8 }, (_, i) => start + i).some(port => allocated.has(port))) continue;
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
      (await Promise.all(Array.from({ length: 8 }, (_, i) => portFree(start + i)))).every(Boolean)
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
      try {
        await cp(path.join(root, file), target);
      } catch (error) {
        // Tracked deletions belong to the current working tree as well.
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  if (harnessRoot) {
    // Measurement mechanics are identical; workload/expectation files remain revision-owned.
    for (const file of mechanics)
      await cp(
        path.join(path.resolve(harnessRoot), file),
        path.join(sandbox, 'tools/e2e/zero-performance', file)
      );
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
  for (const container of [browserContainer, runtimeContainer, appContainer].filter(Boolean)) {
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
  if (
    args.includes('--linux-browser') &&
    (option('--layer') !== 'journeys' || !args.includes('--linux-app') || !option('--zero-image'))
  )
    throw new Error('--linux-browser requires a journeys diagnostic, --linux-app and --zero-image');
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
  if (args.includes('--inventory-only')) {
    await command(
      [
        '--import',
        'tsx',
        'tools/e2e/zero-performance/inventory.ts',
        '--output',
        path.join(artifactRoot, 'inventory.json'),
      ],
      'inventory'
    );
    process.exitCode = 0;
  } else {
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
    if (securitySelectionFile) {
      const selection = JSON.parse(await readFile(path.resolve(securitySelectionFile), 'utf8'));
      if (
        !Array.isArray(selection) ||
        !selection.length ||
        selection.some(key => typeof key !== 'string') ||
        new Set(selection).size !== selection.length
      )
        throw new Error('Invalid security case selection');
      await writeFile(
        path.join(sandbox, '.zero-performance-security-selection.json'),
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
    const storageBuckets = applicationStorageBuckets(
      await readFile(path.join(sandbox, 'supabase/config.toml'), 'utf8')
    );
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
${storageBuckets}
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
      // Documented forwarding allowlist, restricted to the diagnostic UUID.
      // Production configuration and the pinned Zero package remain unchanged.
      ZERO_QUERY_ALLOWED_CLIENT_HEADERS: 'x-zero-performance-client-id',
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
      ZERO_PERFORMANCE_LOG_OUTPUT: artifactRoot,
      ...(option('--execution-file')
        ? { ZERO_PERFORMANCE_EXECUTION: path.resolve(option('--execution-file')) }
        : {}),
      ZERO_PERFORMANCE_QUERY: filter ?? '',
      ZERO_PERFORMANCE_CASE: selectedCase ?? '',
      ZERO_PERFORMANCE_LAYER: option('--layer') ?? 'all',
      ZERO_PERFORMANCE_COLLECT_ALL: args.includes('--collect-all') ? '1' : '',
      ZERO_PERFORMANCE_CPU_PROFILE: args.includes('--profile-navigation') ? '1' : '',
      ...(selectionFile
        ? { ZERO_PERFORMANCE_SELECTION: path.join(sandbox, '.zero-performance-selection.json') }
        : {}),
      ...(securitySelectionFile
        ? {
            ZERO_PERFORMANCE_SECURITY_SELECTION: path.join(
              sandbox,
              '.zero-performance-security-selection.json'
            ),
          }
        : {}),
    };
    if (option('--layer') === 'integrity') {
      if (filter || selectedCase || selectionFile)
        throw new Error('The isolated integrity layer must run the full database test project');
      environment = isolatedIntegrityEnvironment(environment, configuration.DB_URL);
      const integrityAt = performance.now();
      let integrityError;
      try {
        await command(
          [
            executable('vitest/vitest.mjs'),
            'run',
            '--project',
            'database-integration',
            '--maxWorkers=1',
          ],
          'integrity'
        );
      } catch (error) {
        integrityError = error;
      }
      startup.integrityMs = performance.now() - integrityAt;
      await writeFile(
        path.join(artifactRoot, 'integrity.json'),
        JSON.stringify({
          layer: 'integrity',
          isolated: true,
          projectID: `polity-zero-performance-${runID}`,
          elapsedMs: startup.integrityMs,
          outcome: integrityError ? 'failed' : 'passed',
          ...(option('--execution-file')
            ? {
                execution: JSON.parse(
                  await readFile(path.resolve(option('--execution-file')), 'utf8')
                ),
              }
            : {}),
        })
      );
      await writeFile(
        path.join(artifactRoot, 'startup.json'),
        JSON.stringify({
          runID,
          sourceRef: sourceRef ?? 'working-tree',
          startup,
          appURL,
          cacheURL,
          supabaseURL,
        })
      );
      if (integrityError) throw integrityError;
    } else if (option('--layer') === 'fixtures') {
      await command(['--import', 'tsx', 'tools/e2e/zero-performance/fixture-check.ts'], 'fixtures');
    } else {
      if (!filter && !selectedCase && !['journeys', 'security'].includes(option('--layer')))
        await command(
          ['--import', 'tsx', 'tools/e2e/zero-performance/fixture-check.ts'],
          'fixtures'
        );
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
        for (const key of [
          'ZERO_UPSTREAM_DB',
          'ZERO_CVR_DB',
          'ZERO_CHANGE_DB',
          'E2E_DATABASE_URL',
        ]) {
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
      if (args.includes('--linux-browser')) {
        if (!appContainer || !runtimeContainer)
          throw new Error('--linux-browser requires --linux-app and a verified --zero-image');
        const projectID = `polity-zero-performance-${runID}`;
        browserContainer = `polity-zero-performance-browser-${runID}`;
        const playwright = JSON.parse(
          await readFile(executable('@playwright/test/package.json'), 'utf8')
        ).version;
        if (!/^\d+\.\d+\.\d+$/.test(playwright)) throw new Error('Invalid pinned browser version');
        const packageManager = JSON.parse(
          await readFile(path.join(sandbox, 'package.json'), 'utf8')
        ).packageManager;
        if (!/^pnpm@\d+\.\d+\.\d+$/.test(packageManager))
          throw new Error('Invalid pinned browser package manager');
        const browserImage = `mcr.microsoft.com/playwright:v${playwright}-noble`;
        await writeFile(
          path.join(artifactRoot, 'stack.json'),
          JSON.stringify({
            projectID,
            sandbox,
            artifactRoot,
            runtimeContainer,
            appContainer,
            browserContainer,
          })
        );
        const launchedAt = Date.now();
        const server = run(
          'docker',
          [
            'run',
            '--rm',
            '--name',
            browserContainer,
            '--label',
            `polity.zero-performance.project=${projectID}`,
            '--network',
            `supabase_network_${projectID}`,
            '--publish',
            `127.0.0.1:${start + 7}:${start + 7}`,
            '--mount',
            `type=bind,source=${artifactRoot},target=/benchmark`,
            '--env',
            `ZERO_PERFORMANCE_BROWSER_PROJECT=${projectID}`,
            '--env',
            `ZERO_PERFORMANCE_BROWSER_PORT=${start}`,
            '--env',
            `ZERO_PERFORMANCE_PLAYWRIGHT_VERSION=${playwright}`,
            browserImage,
            'sh',
            '-c',
            `mkdir -p /tmp/zero-performance-browser && corepack ${packageManager} --dir /tmp/zero-performance-browser add --ignore-scripts --save-exact playwright@${playwright} && node /benchmark/project/tools/e2e/zero-performance/linux-browser.mjs`,
          ],
          { label: 'browser' }
        );
        server.done.catch(() => {
          /* Readiness checks retain the startup failure. */
        });
        const ready = path.join(artifactRoot, 'browser-ready.json');
        let browserReady;
        while (!browserReady) {
          if (server.child.exitCode !== null || Date.now() - launchedAt > 180_000)
            throw new Error('Isolated Ubuntu browser readiness failed');
          try {
            browserReady = JSON.parse(await readFile(ready, 'utf8'));
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        await unlink(ready);
        const endpoint = new URL(browserReady.endpoint);
        if (endpoint.protocol !== 'ws:' || Number(endpoint.port) !== start + 7)
          throw new Error('Invalid isolated browser control endpoint');
        endpoint.hostname = '127.0.0.1';
        environment.ZERO_PERFORMANCE_BROWSER_ENDPOINT = endpoint.toString();
        startup.browserRuntime = {
          image: browserImage,
          ...browserReady.runtime,
          setupMs: Date.now() - launchedAt,
        };
      }
      await writeFile(
        path.join(artifactRoot, 'startup.json'),
        JSON.stringify(
          { runID, sourceRef: sourceRef ?? 'working-tree', startup, appURL, cacheURL, supabaseURL },
          null,
          2
        )
      );
      if (!sessionMode)
        await command(['--import', 'tsx', 'tools/e2e/zero-performance/collect.ts'], 'measure');
      else {
        process.send({ type: 'ready', output: artifactRoot });
        while (true) {
          if (!sessionQueue.length)
            await new Promise(resolve => {
              wakeSession = resolve;
            });
          wakeSession = undefined;
          const request = sessionQueue.shift();
          if (request?.type === 'stop') break;
          if (request?.type !== 'measure') throw new Error('Invalid session request');
          const destination = path.resolve(request.output);
          if (!destination.startsWith(artifactRoot + path.sep))
            throw new Error('Session output escapes its owned directory');
          await mkdir(destination, { recursive: false });
          for (const file of ['startup.json', 'preflight.json']) {
            try {
              await cp(path.join(artifactRoot, file), path.join(destination, file));
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
            }
          }
          environment.ZERO_PERFORMANCE_OUTPUT = destination;
          environment.ZERO_PERFORMANCE_EXECUTION = path.resolve(request.executionFile);
          environment.ZERO_PERFORMANCE_LAYER = request.layer;
          environment.ZERO_PERFORMANCE_SELECTION = request.selectionFile
            ? path.resolve(request.selectionFile)
            : '';
          environment.ZERO_PERFORMANCE_SECURITY_SELECTION = request.securitySelectionFile
            ? path.resolve(request.securitySelectionFile)
            : '';
          let code = 0;
          const measuredAt = performance.now();
          try {
            await command(['--import', 'tsx', 'tools/e2e/zero-performance/collect.ts'], 'measure');
          } catch (error) {
            code = 1;
            console.error(String(error));
          }
          process.send({
            type: 'measured',
            output: destination,
            code,
            elapsedMs: performance.now() - measuredAt,
          });
        }
      }
    }
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
  if (sessionMode && process.connected) process.disconnect();
}
