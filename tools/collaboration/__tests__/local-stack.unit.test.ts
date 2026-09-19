import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  spawn: vi.fn(),
  sync: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  open: vi.fn(),
  http: vi.fn(),
  net: vi.fn(),
  sql: vi.fn(),
  end: vi.fn(),
  config: vi.fn(),
}));
vi.mock('node:child_process', () => ({ spawn: io.spawn, spawnSync: io.sync }));
vi.mock('node:fs', () => ({
  readFileSync: io.read,
  writeFileSync: io.write,
  mkdirSync: vi.fn(),
  openSync: io.open,
}));
vi.mock('node:http', () => ({ createServer: io.http }));
vi.mock('node:net', () => ({ createConnection: io.net }));
vi.mock('dotenv', () => ({ config: io.config }));
vi.mock('postgres', () => ({ default: () => Object.assign(io.sql, { end: io.end }) }));

const initialEnv = { ...process.env },
  argv = process.argv;
const exit = new Error('captured process exit');
const local = {
  DB_URL: 'postgres://unused:unused@127.0.0.1:54322/postgres',
  API_URL: 'http://127.0.0.1:54321',
  ANON_KEY: 'synthetic',
  SERVICE_ROLE_KEY: 'synthetic',
};
let saved: any,
  runtime: any,
  health: any,
  control: any,
  port: string,
  handler: any,
  children: any[],
  timers: (() => void)[],
  supervisor: any;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  saved = undefined;
  runtime = undefined;
  control = null;
  health = undefined;
  port = 'error';
  children = [];
  timers = [];
  process.argv = [process.execPath, 'local-stack.mjs', 'status'];
  delete process.env.COLLABORATION_TEST_DATABASE;
  delete process.env.FFMPEG_PATH;
  vi.spyOn(process, 'chdir').mockImplementation(() => undefined);
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw exit;
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((body: () => void, delay: number) => {
    if (delay === 1000) timers.push(body);
    else queueMicrotask(body);
    return 123;
  }) as any);
  io.read.mockImplementation((file: string) => {
    const value = file.endsWith('stack.json')
      ? saved
      : file.endsWith('runtime.json')
        ? runtime
        : file.endsWith('exports-health.json')
          ? health
          : undefined;
    if (value === undefined) throw new Error('missing');
    return JSON.stringify(value);
  });
  io.sync.mockImplementation((_command, args) => ({
    status: 0,
    stdout: args.includes('status')
      ? JSON.stringify(local)
      : args.includes('--list')
        ? '1; 0 1 TABLE public document postgres\n2; 0 2 EVENT TRIGGER - zero_ddl_end_0 postgres\n3; 0 3 EVENT TRIGGER - zero_ddl_start_0 postgres\n'
        : '',
  }));
  io.open.mockReturnValue(10);
  io.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      pid: children.length + 100,
      unref: vi.fn(),
      kill: vi.fn(),
    });
    children.push(child);
    return child;
  });
  io.net.mockImplementation(() => {
    const socket = Object.assign(new EventEmitter(), { setTimeout: vi.fn(), destroy: vi.fn() });
    queueMicrotask(() => socket.emit(port));
    return socket;
  });
  io.sql.mockResolvedValue([
    {
      name: 'postgres',
      phase: 'active',
      documents: 6,
      pending_deliveries: 0,
      application_conflicts: 0,
    },
  ]);
  supervisor = {
    listen: vi.fn((_port, _host, callback) => callback()),
    address: () => ({ port: 9999 }),
    close: vi.fn(callback => callback()),
  };
  io.http.mockImplementation(callback => {
    handler = callback;
    return supervisor;
  });
  fetcher = vi.fn(async (url: string) =>
    url.includes(':9999/')
      ? { ok: true, json: async () => control }
      : { ok: true, json: async () => ({ leader: true, integrityErrors: 0 }) }
  );
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env))
    if (!(key in initialEnv)) Reflect.deleteProperty(process.env, key);
  Object.assign(process.env, initialEnv);
});
async function command(name?: string) {
  process.argv = [process.execPath, 'local-stack.mjs', ...(name ? [name] : [])];
  return import('../local-stack.mjs');
}
function tracked() {
  saved = { token: 'supervisor-secret', controlPort: 9999 };
}
async function request(url = '/status', authenticated = true) {
  const state = JSON.parse(io.write.mock.calls.find(([file]) => file.endsWith('stack.json'))![1]);
  const res = { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
  await handler(
    { headers: { authorization: authenticated ? `Bearer ${state.token}` : 'wrong' }, url },
    res
  );
  return { res, result: res.end.mock.calls[0]?.[0] && JSON.parse(res.end.mock.calls[0][0]) };
}

describe('safe local development stack lifecycle', () => {
  it('reports stopped, current or unreachable authenticated supervisors without leaking tokens', async () => {
    await command('status');
    expect(console.log).toHaveBeenLastCalledWith(JSON.stringify({ running: false }, null, 2));
    vi.resetModules();
    tracked();
    control = { running: true, services: [] };
    await command('status');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer supervisor-secret' },
    });
    vi.resetModules();
    fetcher.mockResolvedValueOnce({ ok: false });
    await command('status');
    expect(console.log).toHaveBeenLastCalledWith(JSON.stringify({ running: false }, null, 2));
    vi.resetModules();
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await command('status');
    expect(io.spawn).not.toHaveBeenCalled();
  });
  it('never resets during normal start, hides subprocesses and waits until every service is ready', async () => {
    runtime = { ffmpegPath: 'C:/local/ffmpeg.exe' };
    process.env.KEEP_LOCAL_SETTING = 'inherited';
    io.config.mockImplementation(() => {
      process.env.KEEP_LOCAL_SETTING = 'file';
    });
    io.spawn.mockImplementation(() => {
      tracked();
      control = { running: true, services: [{ ready: false }] };
      const child = { unref: vi.fn() };
      return child;
    });
    let checks = 0;
    fetcher.mockImplementation(async () => ({
      ok: true,
      json: async () => (++checks < 2 ? control : { running: true, services: [{ ready: true }] }),
    }));
    await command();
    expect(io.sync.mock.calls.flat(2)).not.toContain('reset');
    expect(io.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['supervise']),
      expect.objectContaining({ detached: true, windowsHide: true })
    );
    expect(process.env.FFMPEG_PATH).toBe(runtime.ffmpegPath);
    expect(process.env.KEEP_LOCAL_SETTING).toBe('inherited');
    expect(process.env.VITE_APP_URL).toBe('http://localhost:3000');
    expect(process.env.VITE_ZERO_CACHE_URL).toBe('http://localhost:4848');
    expect(process.env.VITE_ZERO_API_URL).toBe('http://host.docker.internal:3000');
    expect(checks).toBe(2);
  });
  it('does not create a second supervisor and waits for a stopping supervisor to leave', async () => {
    tracked();
    control = { running: true };
    await expect(command('start')).rejects.toBe(exit);
    expect(io.spawn).not.toHaveBeenCalled();
    vi.resetModules();
    let calls = 0;
    fetcher.mockImplementation(async () => ({
      ok: true,
      json: async () =>
        ++calls === 1
          ? { running: false }
          : calls === 2
            ? { running: false }
            : calls === 3
              ? null
              : { running: true, services: [{ ready: true }] },
    }));
    await command('start');
    expect(io.spawn).toHaveBeenCalledTimes(1);
  });
  it('rejects occupied ports and reports startup timeout instead of claiming readiness', async () => {
    port = 'connect';
    await expect(command('start')).rejects.toThrow('already in use');
    expect(io.sync).not.toHaveBeenCalled();
    vi.resetModules();
    port = 'timeout';
    await expect(command('start')).rejects.toThrow('did not become ready');
    expect(io.net).toHaveBeenCalledWith({ host: '::1', port: 1236 });
  });
  it('guards reset against running stacks, isolated databases and nonlocal endpoints', async () => {
    process.env.COLLABORATION_TEST_DATABASE = 'polity_collaboration_test';
    await expect(command('reset')).rejects.toThrow('Unset test database');
    delete process.env.COLLABORATION_TEST_DATABASE;
    vi.resetModules();
    tracked();
    control = { running: true };
    await expect(command('reset')).rejects.toThrow('Stop dev:stack');
    vi.resetModules();
    saved = undefined;
    io.sync.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ ...local, API_URL: 'https://example.invalid:54321' }),
    });
    await expect(command('reset')).rejects.toThrow('LOCAL Supabase');
    expect(io.sync.mock.calls.some(([, args]) => args.includes('reset'))).toBe(false);
  });
  it('resets only the verified local stack, clears Zero and recreates the seed separately', async () => {
    await command('reset');
    expect(io.sync.mock.calls.map(([, args]) => args.slice(1))).toEqual([
      ['start'],
      ['status', '--output', 'json'],
      ['db', 'reset', '--local', '--no-seed'],
      [],
      ['tsx', 'tools/collaboration/launch.ts', 'seed'],
    ]);
    expect(process.env.ZERO_UPSTREAM_DB).toBe(local.DB_URL);
    expect(process.env.COLLABORATION_WEBSOCKET_URL).toBe('ws://localhost:1236');
    expect(process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS).toBe('host.docker.internal');
  });
  it('keeps isolated test database and replica names separate and rejects unsafe names', async () => {
    process.env.COLLABORATION_TEST_DATABASE = 'unsafe;drop';
    await expect(command('supervise')).rejects.toThrow('Invalid local test');
    expect(io.spawn).not.toHaveBeenCalled();
    vi.resetModules();
    process.env.COLLABORATION_TEST_DATABASE = 'polity_collaboration_test';
    process.env.FFMPEG_PATH = 'chosen';
    runtime = { ffmpegPath: 'ignored' };
    await command('supervise');
    expect(new URL(process.env.ZERO_UPSTREAM_DB!).pathname).toBe('/polity_collaboration_test');
    expect(process.env.ZERO_REPLICA_FILE).toContain('polity_collaboration_test.db');
    expect(process.env.ZERO_CVR_DB).toBe(process.env.ZERO_UPSTREAM_DB);
    expect(process.env.ZERO_CHANGE_DB).toBe(process.env.ZERO_UPSTREAM_DB);
    expect(new URL(process.env.POLITY_LOCAL_ZERO_DATABASE!).hostname).toBe('host.docker.internal');
    expect(new URL(process.env.POLITY_LOCAL_ZERO_DATABASE!).pathname).toBe(
      '/polity_collaboration_test'
    );
    expect(process.env.FFMPEG_PATH).toBe('chosen');
  });
  it('stops child services before stopping Supabase, also when no supervisor exists', async () => {
    tracked();
    let count = 0;
    fetcher.mockImplementation(async () => ({
      ok: true,
      json: async () => (++count <= 2 ? { stopping: true } : null),
    }));
    await command('stop');
    expect(count).toBe(3);
    expect(io.sync.mock.calls[0][1]).toContain('down');
    expect(io.sync.mock.calls[1][1]).toContain('stop');
    vi.resetModules();
    saved = undefined;
    await command('stop');
    expect(console.log).toHaveBeenLastCalledWith({ running: false });
  });
  it('clones a consistent local snapshot without terminating background workers and cleans its dump on errors', async () => {
    tracked();
    let count = 0;
    fetcher.mockImplementation(async () => ({
      ok: true,
      json: async () => (++count <= 2 ? { stopping: true } : null),
    }));
    await command('clone');
    const admin = io.sync.mock.calls.filter(([name]) => name === 'docker');
    expect(admin[0][1].at(-1)).toMatch(/^\/tmp\/polity_collaboration_acceptance_\d+\.dump$/);
    expect(admin[1][1].at(-1)).toMatch(
      /^create database polity_collaboration_acceptance_\d+ owner postgres template template0$/
    );
    expect(admin.map(([, args]) => args[5])).toEqual([
      'pg_dump',
      'psql',
      'pg_restore',
      'tee',
      'pg_restore',
      'tee',
      'pg_restore',
      'rm',
    ]);
    expect(admin[3][2].input).toContain('TABLE public document');
    expect(admin[3][2].input).not.toContain('EVENT TRIGGER');
    expect(admin[5][2].input).toContain('EVENT TRIGGER - zero_ddl_end_0 postgres');
    expect(admin[5][2].input).not.toContain('TABLE');
    expect(admin[4][1]).not.toContain('--use-set-session-authorization');
    expect(admin[6][1]).toContain('--use-set-session-authorization');
    expect(admin[7][1].slice(-3)).toEqual([
      expect.stringMatching(/\.dump$/),
      expect.stringMatching(/\.list$/),
      expect.stringMatching(/\.events\.list$/),
    ]);
    expect(admin[0][1]).toEqual(
      expect.arrayContaining([
        '--exclude-extension=pg_cron',
        '--exclude-schema=cron',
        '--exclude-schema=graphql_public',
      ])
    );
    expect(io.write).toHaveBeenCalledWith(
      expect.stringContaining('test-database.json'),
      expect.stringContaining('"source":"postgres"')
    );
    vi.resetModules();
    io.write.mockClear();
    io.sync.mockImplementation((name, args) =>
      name === 'docker' && args.at(-1).startsWith('create database')
        ? { status: 1, stderr: 'clone_failed' }
        : { status: 0, stdout: JSON.stringify(local) }
    );
    await expect(command('clone')).rejects.toThrow('clone_failed');
    expect(io.sync.mock.calls.at(-1)![1]).toContain('rm');
    expect(io.write).not.toHaveBeenCalled();
  });
  it('restores a legacy source without Zero event triggers in a single admin pass', async () => {
    io.sync.mockImplementation((_name, args) => ({
      status: 0,
      stdout: args.includes('status')
        ? JSON.stringify(local)
        : '1; 0 1 TABLE public document postgres\n',
    }));
    await command('clone');
    expect(io.sync.mock.calls.flat(2)).not.toContain('--use-set-session-authorization');
    expect(io.write).toHaveBeenCalledWith(
      expect.stringContaining('test-database.json'),
      expect.any(String)
    );
  });
  it('propagates subprocess spawn and status failures', async () => {
    io.sync.mockReturnValueOnce({ error: new Error('spawn_failed') });
    await expect(command('reset')).rejects.toThrow('spawn_failed');
    vi.resetModules();
    io.sync.mockReturnValueOnce({ status: 7 });
    await expect(command('reset')).rejects.toThrow('Local command failed (7)');
    vi.resetModules();
    io.sync.mockImplementation(name =>
      name === 'docker'
        ? { error: new Error('docker_failed') }
        : { status: 0, stdout: JSON.stringify(local) }
    );
    await expect(command('clone')).rejects.toThrow('docker_failed');
  });
  it('authenticates supervision and reports fresh export heartbeat, writer diagnostics and database phase', async () => {
    await command('supervise');
    expect(children).toHaveLength(4);
    expect(supervisor.listen).toHaveBeenCalledWith(0, '127.0.0.1', expect.any(Function));
    expect((await request('/status', false)).res.writeHead).toHaveBeenCalledWith(403);
    health = { pid: children[3].pid, at: Date.now(), ready: true };
    let { result } = await request();
    expect(result.running).toBe(true);
    expect(result.services.every((s: any) => s.ready)).toBe(true);
    expect(result.database.phase).toBe('active');
    expect(result.services[2].diagnostics.leader).toBe(true);
    health = { pid: -1, at: Date.now() - 31_000, ready: true };
    ({ result } = await request());
    expect(result.services[3].ready).toBe(false);
    health = undefined;
    io.sql.mockRejectedValueOnce(new Error('offline'));
    fetcher.mockRejectedValueOnce(new Error('offline'));
    ({ result } = await request());
    expect(result.database).toEqual({ error: 'database_unavailable' });
    expect(result.services[0].ready).toBe(false);
    expect(result.services[3].ready).toBe(false);
  });
  it('restarts failed services, counts attempts, then stops every process and database connection', async () => {
    await command('supervise');
    children[0].emit('exit');
    expect((await request()).result.services[0]).toMatchObject({ ready: false, restarts: 1 });
    timers.shift()!();
    expect(children).toHaveLength(5);
    await expect(request('/stop')).rejects.toBe(exit);
    expect(io.end).toHaveBeenCalled();
    expect(supervisor.close).toHaveBeenCalled();
    expect(io.sync.mock.calls.filter(([name]) => name === 'taskkill')).toHaveLength(
      process.platform === 'win32' ? 4 : 0
    );
    const count = timers.length;
    children[1].emit('exit');
    expect(timers).toHaveLength(count);
  });
  it('does not resurrect a crashed child when its restart timer fires during shutdown', async () => {
    await command('supervise');
    children[0].emit('exit');
    await expect(request('/stop')).rejects.toBe(exit);
    timers.shift()!();
    expect(children).toHaveLength(4);
  });
  it('acknowledges shutdown only after writers and database connections have closed', async () => {
    await command('supervise');
    let finish!: () => void;
    io.end.mockReturnValueOnce(new Promise<void>(resolve => (finish = resolve)));
    const state = JSON.parse(io.write.mock.calls.find(([file]) => file.endsWith('stack.json'))![1]);
    const res = { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
    const pending = handler(
      { headers: { authorization: `Bearer ${state.token}` }, url: '/stop' },
      res
    ).catch((error: unknown) => error);
    expect(io.end).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(supervisor.close).not.toHaveBeenCalled();
    finish();
    expect(await pending).toBe(exit);
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ stopping: true }));
    expect(supervisor.close).toHaveBeenCalled();
  });
  it('uses graceful POSIX shutdown and rejects unknown commands', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    await command('supervise');
    await expect(request('/stop')).rejects.toBe(exit);
    expect(children.every(child => child.kill.mock.calls[0][0] === 'SIGTERM')).toBe(true);
    vi.resetModules();
    await expect(command('unknown')).rejects.toThrow('Expected start');
  });
  it('terminates every Windows writer process tree on shutdown', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    await command('supervise');
    await expect(request('/stop')).rejects.toBe(exit);
    const terminations = io.sync.mock.calls.filter(([name]) => name === 'taskkill');
    expect(terminations).toHaveLength(4);
    for (const child of children) {
      expect(terminations).toContainEqual([
        'taskkill',
        ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true, stdio: 'ignore' },
      ]);
    }
  });
});
