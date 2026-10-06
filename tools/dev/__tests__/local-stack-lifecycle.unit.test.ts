import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  run: vi.fn(),
  spawn: vi.fn(),
  fetch: vi.fn(),
  connect: vi.fn(),
  sql: vi.fn(),
  end: vi.fn(),
  env: vi.fn(),
  handler: null as any,
  children: [] as any[],
  server: { listen: vi.fn(), address: vi.fn(), close: vi.fn() },
}));
vi.mock('node:fs', () => ({
  readFileSync: io.read,
  writeFileSync: io.write,
  mkdirSync: vi.fn(),
  openSync: () => 1,
}));
vi.mock('node:child_process', () => ({ spawnSync: io.run, spawn: io.spawn }));
vi.mock('node:net', () => ({ createConnection: io.connect }));
vi.mock('node:http', () => ({
  createServer: (handler: unknown) => {
    io.handler = handler;
    return io.server;
  },
}));
vi.mock('dotenv', () => ({ config: io.env }));
vi.mock('postgres', () => ({ default: () => Object.assign(io.sql, { end: io.end }) }));
const originalArgv = process.argv;
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
let environment: NodeJS.ProcessEnv;
const local = {
  DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  API_URL: 'http://127.0.0.1:54321',
  ANON_KEY: 'test-anon',
  SERVICE_ROLE_KEY: 'test-service',
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  environment = { ...process.env };
  delete process.env.ZERO_TEST_DATABASE;
  io.children = [];
  io.read.mockImplementation(() => {
    throw new Error('missing file');
  });
  io.run.mockReturnValue({ status: 0, stdout: JSON.stringify(local) });
  io.sql.mockResolvedValue([{ name: 'postgres', projects: 3 }]);
  io.end.mockResolvedValue(undefined);
  io.fetch.mockResolvedValue({ ok: true, json: async () => ({ running: false }) });
  vi.stubGlobal('fetch', io.fetch);
  io.connect.mockImplementation(() => {
    const socket = {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      once: vi.fn((event, callback) => {
        if (event === 'error') queueMicrotask(callback);
        return socket;
      }),
    };
    return socket;
  });
  io.spawn.mockImplementation(() => {
    const callbacks = new Map();
    const child = {
      pid: 100 + io.children.length,
      unref: vi.fn(),
      kill: vi.fn(),
      on: vi.fn((event, callback) => {
        callbacks.set(event, callback);
        return child;
      }),
      callbacks,
    };
    io.children.push(child);
    return child;
  });
  io.server.listen.mockImplementation((_port, _host, callback) => callback());
  io.server.address.mockReturnValue({ port: 12345 });
  io.server.close.mockImplementation(callback => callback());
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  process.argv = originalArgv;
  Object.defineProperty(process, 'platform', originalPlatform);
  for (const key of Object.keys(process.env))
    if (!(key in environment)) Reflect.deleteProperty(process.env, key);
  Object.assign(process.env, environment);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function command(name?: string) {
  process.argv = [...originalArgv.slice(0, 2), ...(name ? [name] : [])];
  await import('../local-stack.mjs');
}
it('stops only the local docker and Supabase stacks when no supervisor is available', async () => {
  await command('stop');
  expect(io.run.mock.calls[0][0]).toBe('docker');
  expect(io.run.mock.calls[0][1]).toContain('down');
  expect(io.run.mock.calls[1][1]).toContain('stop');
  expect(io.spawn).not.toHaveBeenCalled();
});
it('rejects a reset with a test database or a running supervisor before invoking destructive commands', async () => {
  process.env.ZERO_TEST_DATABASE = 'polity_zero_test';
  await expect(command('reset')).rejects.toThrow('Unset test database');
  expect(io.run).not.toHaveBeenCalled();
  delete process.env.ZERO_TEST_DATABASE;
  vi.resetModules();
  io.read.mockReturnValue(JSON.stringify({ controlPort: 12345, token: 'fixture' }));
  io.fetch.mockResolvedValue({ ok: true, json: async () => ({ running: true }) });
  await expect(command('reset')).rejects.toThrow('Stop dev:stack');
  expect(io.run).not.toHaveBeenCalled();
});
it('resets only after validating the local database and loads runtime and inherited environment settings', async () => {
  process.env.CUSTOM_ENV_FIXTURE = 'inherited';
  delete process.env.FFMPEG_PATH;
  io.read.mockImplementation(file => {
    if (String(file).endsWith('runtime.json'))
      return JSON.stringify({ ffmpegPath: 'C:/fixture/ffmpeg.exe' });
    throw new Error('missing');
  });
  io.env.mockImplementation(() => {
    process.env.CUSTOM_ENV_FIXTURE = 'file';
  });
  await command('reset');
  expect(process.env.CUSTOM_ENV_FIXTURE).toBe('inherited');
  expect(process.env.FFMPEG_PATH).toBe('C:/fixture/ffmpeg.exe');
  expect(process.env.STUDIO_DATABASE_URL).toBe(local.DB_URL);
  expect(process.env.POLITY_LOCAL_ZERO_DATABASE).toContain('host.docker.internal:54322');
  expect(io.run.mock.calls[2][1]).toEqual(
    expect.arrayContaining(['db', 'reset', '--local', '--no-seed'])
  );
  expect(io.run.mock.calls[3][1]).toEqual(['tools/zero/clean-dev-cache.mjs']);
});
it.each([
  { DB_URL: 'postgresql://postgres:postgres@production.example:54322/postgres' },
  { DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/other' },
  { API_URL: 'https://www.polity.live' },
  { API_URL: 'http://localhost:9999' },
])('rejects non-local Supabase coordinates %j before reset', async override => {
  io.run.mockReturnValue({ status: 0, stdout: JSON.stringify({ ...local, ...override }) });
  await expect(command('reset')).rejects.toThrow('Expected the Polity LOCAL');
  expect(io.run.mock.calls.some(([, args]) => args.includes('reset'))).toBe(false);
});
it('reports command failures and rejects unknown commands without spawning services', async () => {
  io.run.mockReturnValue({ status: 2 });
  await expect(command('reset')).rejects.toThrow('Local command failed');
  vi.resetModules();
  io.run.mockReturnValue({ status: 0, error: new Error('process unavailable') });
  await expect(command('stop')).rejects.toThrow('process unavailable');
  vi.resetModules();
  await expect(command('invalid')).rejects.toThrow('Expected start, status, stop or reset');
  expect(io.spawn).not.toHaveBeenCalled();
});
it('authenticates supervisor status and reports service health without starting real processes', async () => {
  await command('supervise');
  expect(io.spawn).toHaveBeenCalledTimes(3);
  expect(io.spawn.mock.calls[1][0]).toBe('docker');
  expect(io.spawn.mock.calls[2][1]).toContain('worker');
  const state = JSON.parse(io.write.mock.calls[0][1]);
  expect(state.controlPort).toBe(12345);
  const response = () => ({ writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() });
  const denied = response();
  await io.handler({ headers: {}, url: '/status' }, denied);
  expect(denied.writeHead).toHaveBeenCalledWith(403);
  const allowed = response();
  io.read.mockReturnValue(JSON.stringify({ pid: 102, at: Date.now(), ready: true }));
  await io.handler(
    { headers: { authorization: `Bearer ${state.token}` }, url: '/status' },
    allowed
  );
  const status = JSON.parse(allowed.end.mock.calls[0][0]);
  expect(status.database).toEqual({ name: 'postgres', projects: 3 });
  expect(status.services.every((service: any) => service.ready)).toBe(true);
  io.fetch.mockRejectedValue(new Error('offline'));
  io.read.mockImplementation(() => {
    throw new Error('missing heartbeat');
  });
  io.sql.mockRejectedValue(new Error('db offline'));
  const unavailable = response();
  await io.handler(
    { headers: { authorization: `Bearer ${state.token}` }, url: '/status' },
    unavailable
  );
  const failure = JSON.parse(unavailable.end.mock.calls[0][0]);
  expect(failure.database).toEqual({ error: 'database_unavailable' });
  expect(failure.services.every((service: any) => !service.ready)).toBe(true);
});

it('starts a hidden supervisor after checking ports and waits for every service to become ready', async () => {
  io.read.mockImplementation(file => {
    if (String(file).endsWith('stack.json'))
      return JSON.stringify({ controlPort: 12345, token: 'fixture' });
    throw new Error('no runtime');
  });
  io.fetch
    .mockResolvedValueOnce({ ok: true, json: async () => null })
    .mockResolvedValue({ ok: true, json: async () => ({ services: [{ ready: true }] }) });
  await command();
  expect(io.connect).toHaveBeenCalledTimes(4);
  expect(io.spawn.mock.calls[0][1].at(-1)).toBe('supervise');
  expect(io.spawn.mock.calls[0][2]).toMatchObject({ detached: true, windowsHide: true });
  expect(io.children[0].unref).toHaveBeenCalledTimes(1);
});
it('does not start a second supervisor or take over an occupied local application port', async () => {
  io.read.mockReturnValue(JSON.stringify({ controlPort: 12345, token: 'fixture' }));
  io.fetch.mockResolvedValue({ ok: true, json: async () => ({ running: true }) });
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('intentional exit');
  });
  await expect(command('start')).rejects.toThrow('intentional exit');
  expect(io.spawn).not.toHaveBeenCalled();
  vi.resetModules();
  io.read.mockImplementation(() => {
    throw new Error('no state');
  });
  io.connect.mockImplementation(() => {
    const socket = {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      once: vi.fn((event, callback) => {
        if (event === 'connect') queueMicrotask(callback);
        return socket;
      }),
    };
    return socket;
  });
  await expect(command('start')).rejects.toThrow('already in use');
  expect(io.run).not.toHaveBeenCalled();
});
it.each(['win32', 'linux'])(
  'acknowledges %s supervisor shutdown only after its writers and database connection stop',
  async platform => {
    Object.defineProperty(process, 'platform', { configurable: true, value: platform });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await command('supervise');
    const state = JSON.parse(io.write.mock.calls[0][1]);
    const response = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
    await io.handler(
      { headers: { authorization: `Bearer ${state.token}` }, url: '/stop' },
      response
    );
    expect(io.end).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ stopping: true }));
    expect(io.end.mock.invocationCallOrder[0]).toBeLessThan(
      response.end.mock.invocationCallOrder[0]
    );
    expect(exit).toHaveBeenCalledWith(0);
    if (platform === 'win32')
      expect(io.run.mock.calls.filter(([program]) => program === 'taskkill')).toHaveLength(3);
    else expect(io.children.every(child => child.kill.mock.calls[0][0] === 'SIGTERM')).toBe(true);
    const spawned = io.spawn.mock.calls.length;
    io.children[0].callbacks.get('exit')();
    expect(io.spawn).toHaveBeenCalledTimes(spawned);
  }
);
it('restarts exited services and distinguishes stale worker heartbeats from readiness', async () => {
  vi.useFakeTimers();
  await command('supervise');
  const state = JSON.parse(io.write.mock.calls[0][1]);
  io.children[0].callbacks.get('exit')();
  await vi.advanceTimersByTimeAsync(1000);
  expect(io.spawn).toHaveBeenCalledTimes(4);
  io.read.mockReturnValue(JSON.stringify({ pid: 102, at: Date.now() - 31_000, ready: true }));
  const response = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
  await io.handler(
    { headers: { authorization: `Bearer ${state.token}` }, url: '/status' },
    response
  );
  const status = JSON.parse(response.end.mock.calls[0][0]);
  expect(status.services.find((service: any) => service.name === 'app').restarts).toBe(1);
  expect(status.services.find((service: any) => service.name === 'exports').ready).toBe(false);
});

it.each([true, false])(
  'clones a logical database snapshot and restores Zero event triggers when present (%s)',
  async withEvents => {
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    const entries = [
      '1; TABLE public user postgres',
      ...(withEvents
        ? [
            '2; EVENT TRIGGER - zero_ddl_start_42 postgres',
            '3; EVENT TRIGGER - zero_ddl_end_42 postgres',
          ]
        : []),
    ].join('\n');
    io.run.mockImplementation((program, args) => ({
      status: 0,
      stdout:
        program === 'docker' ? (args.includes('--list') ? entries : '') : JSON.stringify(local),
    }));
    await command('clone');
    const docker = io.run.mock.calls
      .filter(([program]) => program === 'docker')
      .map(([, args]) => args);
    const mainRestore = docker.find(
      args =>
        args.includes('pg_restore') &&
        !args.includes('--list') &&
        !args.includes('--use-set-session-authorization')
    );
    expect(mainRestore).toEqual(
      expect.arrayContaining(['--exit-on-error', '--use-list', 'polity_zero_acceptance_12345'])
    );
    expect(docker.some(args => args.includes('--use-set-session-authorization'))).toBe(withEvents);
    const filteredList = io.run.mock.calls.find(
      ([, args]) => args.includes('tee') && args.includes('/tmp/polity_zero_acceptance_12345.list')
    )![2].input;
    expect(filteredList).not.toContain('EVENT TRIGGER');
    expect(docker.at(-1)).toEqual(
      expect.arrayContaining(['rm', '-f', '--', '/tmp/polity_zero_acceptance_12345.dump'])
    );
    expect(JSON.parse(io.write.mock.calls[0][1])).toMatchObject({
      name: 'polity_zero_acceptance_12345',
      source: 'postgres',
    });
  }
);
it('cleans up temporary clone files after a failed restore without publishing a test database', async () => {
  io.run.mockImplementation((program, args) =>
    program === 'docker' && args.includes('pg_restore')
      ? { status: 1, stderr: 'restore failed' }
      : { status: 0, stdout: program === 'docker' ? '' : JSON.stringify(local) }
  );
  await expect(command('clone')).rejects.toThrow('restore failed');
  expect(io.run.mock.calls.at(-1)![1]).toEqual(expect.arrayContaining(['rm', '-f', '--']));
  expect(io.write).not.toHaveBeenCalled();
});
it('validates the test database name before constructing database URLs and replica paths', async () => {
  process.env.ZERO_TEST_DATABASE = 'production; drop database';
  await expect(command('supervise')).rejects.toThrow('Invalid local test database');
  expect(io.spawn).not.toHaveBeenCalled();
  vi.resetModules();
  process.env.ZERO_TEST_DATABASE = 'polity_zero_fixture';
  await command('supervise');
  expect(new URL(process.env.STUDIO_DATABASE_URL!).pathname).toBe('/polity_zero_fixture');
  expect(process.env.ZERO_REPLICA_FILE).toContain('polity_zero_fixture.db');
  expect(process.env.POLITY_LOCAL_ZERO_DATABASE).toContain(
    'host.docker.internal:54322/polity_zero_fixture'
  );
});

it.each(['stop', 'clone'])(
  'waits for a stopping supervisor before %s and authenticates stop requests',
  async name => {
    io.read.mockImplementation(file => {
      if (String(file).endsWith('stack.json'))
        return JSON.stringify({ controlPort: 12345, token: 'fixture' });
      throw new Error('missing');
    });
    io.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stopping: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ running: true }) })
      .mockResolvedValue({ ok: true, json: async () => null });
    io.run.mockImplementation((program, _args) => ({
      status: 0,
      stdout: program === 'docker' ? '' : JSON.stringify(local),
    }));
    await command(name);
    expect(io.fetch.mock.calls[0][0]).toBe('http://127.0.0.1:12345/stop');
    expect(io.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture');
    expect(io.fetch).toHaveBeenCalledTimes(3);
  }
);
it('waits for previous shutdown, tolerates port-probe timeouts and waits for service readiness', async () => {
  io.read.mockImplementation(file => {
    if (String(file).endsWith('stack.json'))
      return JSON.stringify({ controlPort: 12345, token: 'fixture' });
    throw new Error('missing');
  });
  io.fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ running: false }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ running: false }) })
    .mockResolvedValueOnce({ ok: true, json: async () => null })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ services: [{ ready: false }] }) })
    .mockResolvedValue({ ok: true, json: async () => ({ services: [{ ready: true }] }) });
  io.connect.mockImplementation(() => {
    const socket = {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      once: vi.fn((event, callback) => {
        if (event === 'timeout') queueMicrotask(callback);
        return socket;
      }),
    };
    return socket;
  });
  await command('start');
  expect(io.spawn).toHaveBeenCalledTimes(1);
  expect(io.fetch).toHaveBeenCalledTimes(5);
});
it('fails a bounded startup when services never become ready', async () => {
  vi.useFakeTimers();
  io.read.mockImplementation(file => {
    if (String(file).endsWith('stack.json'))
      return JSON.stringify({ controlPort: 12345, token: 'fixture' });
    throw new Error('missing');
  });
  io.fetch
    .mockResolvedValueOnce({ ok: true, json: async () => null })
    .mockResolvedValue({ ok: true, json: async () => ({ services: [{ ready: false }] }) });
  let started!: () => void;
  const supervisorStarted = new Promise<void>(resolve => {
    started = resolve;
  });
  const spawn = io.spawn.getMockImplementation()!;
  io.spawn.mockImplementation((...args) => {
    const result = spawn(...args);
    started();
    return result;
  });
  const failure = command('start').catch(error => error);
  await supervisorStarted;
  await vi.advanceTimersByTimeAsync(90_000);
  expect((await failure).message).toContain('Stack did not become ready');
  expect(io.fetch).toHaveBeenCalledTimes(181);
});
it('cancels a scheduled restart after shutdown begins', async () => {
  vi.useFakeTimers();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  await command('supervise');
  const state = JSON.parse(io.write.mock.calls[0][1]);
  io.children[0].callbacks.get('exit')();
  const response = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
  await io.handler({ headers: { authorization: `Bearer ${state.token}` }, url: '/stop' }, response);
  await vi.advanceTimersByTimeAsync(1000);
  expect(io.spawn).toHaveBeenCalledTimes(3);
});
