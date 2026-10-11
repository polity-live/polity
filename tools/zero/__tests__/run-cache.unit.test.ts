import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ supervise: vi.fn(), snapshot: vi.fn(), terminate: vi.fn() }));
vi.mock('../run-e2e-cache.mjs', async original => ({
  ...(await original<typeof import('../run-e2e-cache.mjs')>()),
  superviseCache: io.supervise,
  readWindowsProcesses: io.snapshot,
  terminateWindowsTree: io.terminate,
}));
vi.mock('node:net', async original => ({ ...(await original<typeof import('node:net')>()) }));
import {
  availablePort,
  runCache,
  startCache,
  startDevelopment,
  superviseLocalCache,
} from '../run-cache.mjs';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  io.supervise.mockReset();
  io.snapshot.mockReset();
  io.terminate.mockReset();
});

it('starts serving only after native ready, complete bootstrap shutdown and bounded offline maintenance', async () => {
  const calls: string[] = [];
  const state = new EventEmitter();
  const env = { ZERO_PORT: '4848', ZERO_NUM_SYNC_WORKERS: '3', ZERO_LAZY_STARTUP: 'true' };
  const supervise = vi.fn(async options => {
    if (options.onReady) {
      expect(options.env).toMatchObject({
        ZERO_PORT: '6100',
        ZERO_CHANGE_STREAMER_PORT: '6101',
        ZERO_CHANGE_STREAMER_ADDRESS: '127.0.0.1:6101',
        ZERO_LITESTREAM_PORT: '6102',
        ZERO_NUM_SYNC_WORKERS: '0',
        ZERO_LAZY_STARTUP: 'false',
      });
      calls.push('ready');
      options.onReady(() => calls.push('stop'));
      calls.push('all-workers-closed');
      return 0;
    }
    calls.push('serve');
    expect(options.env).toBe(env);
    return 7;
  });
  const port = vi
    .fn()
    .mockResolvedValueOnce(6100)
    .mockResolvedValueOnce(6101)
    .mockResolvedValueOnce(6102);
  expect(
    await startCache({
      environment: env,
      replicaFile: 'owned.db',
      supervise,
      maintain: file => {
        expect(file).toBe('owned.db');
        calls.push('analyze');
        return { status: 'analyzed' };
      },
      port,
      processState: state,
      logger: { info: vi.fn() },
    })
  ).toBe(7);
  expect(calls).toEqual(['ready', 'stop', 'all-workers-closed', 'analyze', 'serve']);
  expect(state.listenerCount('SIGTERM')).toBe(0);
});
it.each([{ PATH: 'prior' }, { Path: 'windows' }, {}])(
  'preserves SDK dev permissions watch while routing cache subprocesses through shared maintenance: %j',
  async environment => {
    const supervise = vi.fn().mockResolvedValue(5),
      state = new EventEmitter();
    const sdkCli = path.resolve('verified/out/zero/src/cli.js');
    expect(
      await startDevelopment({
        environment,
        argv: ['--path', 'schema.ts'],
        sdkCli,
        supervise,
        processState: state,
      })
    ).toBe(5);
    expect(supervise.mock.calls[0][0].args).toEqual([
      path.resolve('verified/out/zero/src/zero-cache-dev.js'),
      '--path',
      'schema.ts',
    ]);
    const env = supervise.mock.calls[0][0].env;
    expect(env.POLITY_ZERO_CLI).toBe(sdkCli);
    expect(env.PATH.split(path.delimiter)[0]).toBe(path.resolve('tools/zero/bin'));
    expect(Object.keys(env).filter(key => key.toLowerCase() === 'path')).toEqual(['PATH']);
  }
);
it('uses the SDK dev runner for the development entrypoint without parsing away its legacy permission flags', async () => {
  const develop = vi.fn().mockResolvedValue(11),
    load = vi.fn();
  expect(
    await runCache({
      argv: ['--development', '--path', 'schema.ts'],
      environment: {},
      load,
      develop,
    })
  ).toBe(11);
  expect(develop).toHaveBeenCalledWith({
    environment: {},
    argv: ['--path', 'schema.ts'],
    sdkCli: expect.stringMatching(/zero[\\/]src[\\/]cli.js$/),
  });
  expect(load).not.toHaveBeenCalled();
  io.supervise.mockResolvedValue(0);
  expect(await runCache({ argv: ['--development'], environment: {} })).toBe(0);
});
it.each([1, 0])(
  'fails closed without successful native readiness/shutdown: exit %s',
  async exit => {
    const maintain = vi.fn(),
      supervise = vi.fn(async () => exit),
      state = new EventEmitter();
    await expect(
      startCache({
        environment: {},
        replicaFile: 'owned',
        supervise,
        maintain,
        port: async () => 6100,
        processState: state,
      })
    ).rejects.toThrow('before a clean ready shutdown');
    expect(maintain).not.toHaveBeenCalled();
    expect(supervise).toHaveBeenCalledOnce();
    expect(state.listenerCount('SIGINT')).toBe(0);
  }
);
it('rejects an unclean shutdown even after receiving native ready', async () => {
  const supervise = vi.fn(async options => {
    options.onReady(vi.fn());
    return 1;
  });
  await expect(
    startCache({
      environment: {},
      replicaFile: 'owned',
      supervise,
      maintain: vi.fn(),
      port: async () => 6100,
      processState: new EventEmitter(),
    })
  ).rejects.toThrow('clean ready shutdown');
});
it.each(['allocation', 'bootstrap', 'maintenance'])(
  'stops startup without publishing a serving process on interruption during %s',
  async phase => {
    const state = new EventEmitter();
    const maintain = vi.fn(() => ({ status: 'analyzed' }));
    const supervise = vi.fn(async options => {
      state.emit('SIGTERM');
      expect(options.processState.listenerCount('SIGTERM')).toBe(0);
      return 0;
    });
    expect(
      await startCache({
        environment: {},
        replicaFile: 'owned',
        port: async () => {
          if (phase === 'allocation') state.emit('SIGINT');
          return 6100;
        },
        processState: state,
        maintain,
        supervise:
          phase === 'maintenance'
            ? async options => {
                options.onReady(vi.fn());
                return 0;
              }
            : supervise,
        logger: {
          info: () => {
            if (phase === 'maintenance') state.emit('SIGTERM');
          },
        },
      })
    ).toBe(0);
    if (phase !== 'maintenance') expect(maintain).not.toHaveBeenCalled();
    expect(state.listenerCount('SIGTERM')).toBe(0);
  }
);
it('propagates offline SQLite failure without starting public serving', async () => {
  const error = new Error('SQLite locked'),
    supervise = vi.fn(async options => {
      options.onReady(vi.fn());
      return 0;
    });
  await expect(
    startCache({
      environment: {},
      replicaFile: 'owned',
      port: async () => 6100,
      processState: new EventEmitter(),
      supervise,
      maintain: () => {
        throw error;
      },
    })
  ).rejects.toBe(error);
  expect(supervise).toHaveBeenCalledOnce();
});
it('allocates an actual private bootstrap port and propagates listen/close failures', async () => {
  expect(await availablePort()).toBeGreaterThan(0);
  const error = new Error('listen unavailable');
  const server = new EventEmitter();
  Object.assign(server, {
    listen: () => {
      server.emit('error', error);
      return server;
    },
  });
  vi.spyOn(net, 'createServer').mockReturnValueOnce(server as never);
  await expect(availablePort()).rejects.toBe(error);
  const closing = {
    once: vi.fn().mockReturnThis(),
    listen: (_port: number, _host: string, ready: () => void) => ready(),
    address: () => ({ port: 6100 }),
    close: (done: (error?: Error) => void) => done(error),
  };
  vi.spyOn(net, 'createServer').mockReturnValueOnce(closing as never);
  await expect(availablePort()).rejects.toBe(error);
});
it('retains Linux detached-worker supervision', async () => {
  const options = { args: ['sdk-cli'], processState: new EventEmitter() };
  io.supervise.mockResolvedValue(9);
  expect(await superviseLocalCache(options, { platform: 'linux' })).toBe(9);
  expect(io.supervise).toHaveBeenCalledWith(options);
});
it('uses the Windows descendant reaper and preserves original identities across PID reuse', async () => {
  io.snapshot
    .mockReturnValueOnce(new Map([[10, { parent: 1, born: '100', state: 'R' }]]))
    .mockReturnValueOnce(new Map([[10, { parent: 1, born: '200', state: 'R' }]]));
  io.supervise.mockImplementation(async options => {
    expect(options.snapshot().get(10).born).toBe('100');
    expect(options.snapshot().get(10).born).toBe('200');
    options.signal(10, 'SIGTERM');
    return 0;
  });
  const state = new EventEmitter();
  expect(
    await superviseLocalCache(
      { args: ['verified-cli'], processState: state },
      { platform: 'win32' }
    )
  ).toBe(0);
  expect(io.terminate).toHaveBeenCalledWith(10, '100');
  expect(io.supervise.mock.calls[0][0].processState).toBe(state);
});
it.each([{ uri: 'http://remote', mode: 'dedicated' }, { mode: 'external' }])(
  'fails closed for incompatible replica ownership %j',
  async changeStreamer => {
    const load = async (specifier: string) =>
      specifier.endsWith('zero-config.js')
        ? { zeroOptions: {}, ZERO_ENV_VAR_PREFIX: 'ZERO' }
        : specifier.endsWith('options.js')
          ? {
              parseOptionsAdvanced: () => ({
                config: { changeStreamer, replica: { file: 'own' } },
                env: {},
              }),
            }
          : {};
    await expect(runCache({ argv: [], environment: {}, load, run: vi.fn() })).rejects.toThrow(
      'local dedicated change streamer'
    );
  }
);
it('resolves config and SQLite from the explicit verified SDK entry, preserving parsed CLI settings', async () => {
  const requests: string[] = [];
  const run = vi.fn().mockResolvedValue(13);
  const parse = vi.fn(() => ({
    config: { changeStreamer: { mode: 'dedicated' }, replica: { file: 'owned' } },
    env: { ZERO_PORT: '6300' },
  }));
  const load = async (specifier: string) => {
    requests.push(specifier);
    return specifier.endsWith('zero-config.js')
      ? { zeroOptions: {}, ZERO_ENV_VAR_PREFIX: 'ZERO' }
      : specifier.endsWith('options.js')
        ? { parseOptionsAdvanced: parse }
        : {};
  };
  expect(
    await runCache({
      argv: ['--port', '6300'],
      environment: { POLITY_ZERO_CLI: '/verified/out/zero/src/cli.js' },
      load,
      run,
    })
  ).toBe(13);
  expect(
    requests.every(url =>
      url.startsWith(new URL('../../', pathToFileURL('/verified/out/zero/src/cli.js')).href)
    )
  ).toBe(true);
  expect(run).toHaveBeenCalledWith({
    environment: {
      POLITY_ZERO_CLI: '/verified/out/zero/src/cli.js',
      ZERO_PORT: '6300',
      ZERO_TASK_ID: expect.stringMatching(/^polity-[0-9a-f-]+$/),
    },
    replicaFile: 'owned',
    sdkCli: '/verified/out/zero/src/cli.js',
  });
});
it('loads the real SDK config and native driver while using only a private temporary replica', async () => {
  const require = createRequire(import.meta.url);
  const cli = require.resolve('@rocicorp/zero').replace(/zero\.js$/, 'cli.js');
  const D = createRequire(cli)('@rocicorp/zero-sqlite3');
  const directory = mkdtempSync(path.join(tmpdir(), 'polity-startup-'));
  const file = path.join(directory, 'owned.db');
  const db = new D(file);
  db.exec(
    'CREATE TABLE search_document(id TEXT PRIMARY KEY,entity_type TEXT,created_at REAL);CREATE INDEX recent ON search_document(entity_type,created_at DESC,id DESC)'
  );
  db.close();
  io.supervise.mockImplementation(async options => {
    options.onReady?.(vi.fn());
    return 0;
  });
  const env = {
    ZERO_UPSTREAM_DB: 'postgresql://postgres:postgres@127.0.0.1:65499/postgres',
    ZERO_REPLICA_FILE: file,
    ZERO_NUM_SYNC_WORKERS: '1',
    ZERO_ADMIN_PASSWORD: 'private-unit-only',
    ZERO_CHANGE_STREAMER_MODE: 'dedicated',
  };
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    expect(await runCache({ argv: [], environment: env })).toBe(0);
    expect(info).toHaveBeenCalledWith(
      '[zero-search-statistics]',
      expect.stringContaining('analyzed')
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  { argv: [], environment: { ZERO_TASK_ID: 'configured-env' }, expected: 'configured-env' },
  { argv: ['--task-id', 'configured-cli'], environment: {}, expected: 'configured-cli' },
])(
  'preserves explicitly configured SDK task identity %j',
  async ({ argv, environment, expected }) => {
    const run = vi.fn().mockResolvedValue(0);
    await runCache({
      argv,
      environment: {
        ZERO_UPSTREAM_DB: 'postgresql://postgres:postgres@127.0.0.1:65499/postgres',
        ...environment,
      },
      run,
    });
    expect(run.mock.calls[0][0].environment.ZERO_TASK_ID).toBe(expected);
  }
);
it('preserves a configured development task identity through the SDK watcher', async () => {
  const supervise = vi.fn().mockResolvedValue(0);
  await startDevelopment({
    environment: { ZERO_TASK_ID: 'configured-dev' },
    argv: [],
    sdkCli: path.resolve('verified/out/zero/src/cli.js'),
    supervise,
  });
  expect(supervise.mock.calls[0][0].env.ZERO_TASK_ID).toBe('configured-dev');
});
