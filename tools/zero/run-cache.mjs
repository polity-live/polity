import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';
import {
  superviseCache,
  runCacheCli,
  readWindowsProcesses,
  terminateWindowsTree,
} from './run-e2e-cache.mjs';
import { maintainSearchReplica } from './search-replica-statistics.mjs';

const cli = fileURLToPath(
  new URL('../../node_modules/@rocicorp/zero/out/zero/src/cli.js', import.meta.url)
);

// Windows signals forcibly terminate Node. Track creation times and terminate
// the owned tree before waiting for every descendant to leave the replica.
export async function superviseLocalCache(options, { platform = process.platform } = {}) {
  if (platform !== 'win32') return superviseCache(options);
  const identities = new Map();
  return superviseCache({
    ...options,
    snapshot: () => {
      const processes = readWindowsProcesses();
      for (const [pid, info] of processes) if (!identities.has(pid)) identities.set(pid, info.born);
      return processes;
    },
    signal: pid => terminateWindowsTree(pid, identities.get(pid)),
  });
}

export async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve)
  );
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
  return port;
}

export async function startCache({
  environment,
  replicaFile,
  sdkCli = cli,
  supervise = superviseLocalCache,
  maintain = file => maintainSearchReplica(file, sdkCli),
  port = availablePort,
  processState = /** @type {import('node:events').EventEmitter} */ (process),
  logger = /** @type {Pick<Console, 'info'>} */ (console),
}) {
  let interrupted = false;
  const bootstrapState = new EventEmitter();
  const stop = () => {
    interrupted = true;
    bootstrapState.emit('SIGTERM');
  };
  processState.on('SIGTERM', stop);
  processState.on('SIGINT', stop);
  processState.on('SIGQUIT', stop);
  let ready = false;
  try {
    const [cachePort, changePort, backupPort] = await Promise.all([port(), port(), port()]);
    if (interrupted) return 0;
    const bootstrap = await supervise({
      args: [sdkCli],
      processState: bootstrapState,
      env: {
        ...environment,
        ZERO_PORT: String(cachePort),
        ZERO_CHANGE_STREAMER_PORT: String(changePort),
        ZERO_CHANGE_STREAMER_ADDRESS: `127.0.0.1:${changePort}`,
        ZERO_LITESTREAM_PORT: String(backupPort),
        ZERO_NUM_SYNC_WORKERS: '0',
        ZERO_LAZY_STARTUP: 'false',
      },
      onReady: shutdown => {
        ready = true;
        shutdown();
      },
    });
    if (interrupted) return 0;
    if (bootstrap !== 0 || !ready)
      throw new Error('Replica bootstrap exited before a clean ready shutdown');
    const result = maintain(replicaFile);
    logger.info('[zero-search-statistics]', JSON.stringify(result));
  } finally {
    processState.off('SIGTERM', stop);
    processState.off('SIGINT', stop);
    processState.off('SIGQUIT', stop);
  }
  if (interrupted) return 0;
  return supervise({ args: [sdkCli], env: environment, processState });
}

export async function startDevelopment({
  environment,
  argv,
  sdkCli,
  supervise = superviseLocalCache,
  processState = /** @type {import('node:events').EventEmitter} */ (process),
}) {
  // The SDK dev runner retains its legacy permission deployment and file watch.
  // Its zero-cache subprocess resolves our small launcher before the SDK bin.
  const bin = fileURLToPath(new URL('bin', import.meta.url));
  const priorPath =
    Object.entries(environment).find(([key]) => key.toLowerCase() === 'path')?.[1] ?? '';
  const env = Object.fromEntries(
    Object.entries(environment).filter(([key]) => key.toLowerCase() !== 'path')
  );
  return supervise({
    args: [fileURLToPath(new URL('zero-cache-dev.js', pathToFileURL(sdkCli))), ...argv],
    processState,
    env: {
      ...env,
      ZERO_TASK_ID: environment.ZERO_TASK_ID ?? `polity-${randomUUID()}`,
      POLITY_ZERO_CLI: sdkCli,
      PATH: `${bin}${path.delimiter}${priorPath}`,
    },
  });
}

export async function runCache({
  argv = process.argv.slice(2),
  environment = process.env,
  sdkCli = environment.POLITY_ZERO_CLI ?? cli,
  load = specifier => import(specifier),
  run = startCache,
  develop = startDevelopment,
} = {}) {
  if (argv[0] === '--development') return develop({ environment, argv: argv.slice(1), sdkCli });
  const root = new URL('../../', pathToFileURL(sdkCli));
  await load(new URL('shared/src/dotenv.js', root).href);
  const { zeroOptions, ZERO_ENV_VAR_PREFIX } = await load(
    new URL('zero-cache/src/config/zero-config.js', root).href
  );
  const { parseOptionsAdvanced } = await load(new URL('shared/src/options.js', root).href);
  const options = {
    argv,
    env: environment,
    envNamePrefix: ZERO_ENV_VAR_PREFIX,
    emitDeprecationWarnings: false,
  };
  const { config } = parseOptionsAdvanced(zeroOptions, options);
  // Parse the full config for paths/defaults, but forward only explicit settings
  // so deprecated SDK defaults do not become freshly configured environment flags.
  const { env } = parseOptionsAdvanced(zeroOptions, { ...options, includeDefaults: false });
  if (config.changeStreamer.uri || config.changeStreamer.mode !== 'dedicated')
    throw new Error(
      'Search replica startup maintenance requires the local dedicated change streamer'
    );
  return run({
    environment: {
      ...environment,
      ...env,
      ZERO_TASK_ID: config.taskID ?? `polity-${randomUUID()}`,
    },
    replicaFile: config.replica.file,
    sdkCli,
  });
}

await runCliIfMain(import.meta.url, runCacheCli.bind(null, { runCache, processState: process }));
