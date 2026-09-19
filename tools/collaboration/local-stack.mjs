import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const directory = path.join(root, 'output/local-stack'),
  statePath = path.join(directory, 'stack.json');
mkdirSync(directory, { recursive: true });
const cli = path.join(root, 'node_modules/supabase/dist/supabase.js');
const compose = [
  'compose',
  '--project-name',
  'polity-collaboration-local',
  '--file',
  path.join(root, 'tools/collaboration/compose.yaml'),
];
function run(args, quiet = false, executable = process.execPath) {
  const r = spawnSync(executable, args, {
    cwd: root,
    env: process.env,
    windowsHide: true,
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : 'inherit',
  });
  if (r.error || r.status !== 0)
    throw r.error ?? new Error(`Local command failed (${r.status}): ${args[0]}`);
  return r.stdout;
}
function state() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}
async function control(action) {
  const s = state();
  if (!s) return null;
  try {
    const r = await fetch(`http://127.0.0.1:${s.controlPort}/${action}`, {
      headers: { Authorization: `Bearer ${s.token}` },
      signal: AbortSignal.timeout(action === 'stop' ? 120_000 : 3000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
async function assertPortsFree() {
  for (const port of [3000, 4848, 1236])
    for (const host of ['127.0.0.1', '::1']) {
      const occupied = await new Promise(resolve => {
        const socket = createConnection({ host, port });
        socket.setTimeout(500);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => resolve(false));
        socket.once('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
      if (occupied)
        throw new Error(
          `Local port ${host}:${port} is already in use. Stop the existing Polity service before starting dev:stack.`
        );
    }
}
function localEnvironment() {
  const inherited = { ...process.env };
  for (const f of ['.env', '.env.local', '.env.development', '.env.development.local'])
    config({ path: f, override: true, quiet: true });
  Object.assign(process.env, inherited);
  try {
    const runtime = JSON.parse(readFileSync(path.join(directory, 'runtime.json'), 'utf8'));
    if (!process.env.FFMPEG_PATH && typeof runtime.ffmpegPath === 'string')
      process.env.FFMPEG_PATH = runtime.ffmpegPath;
  } catch {
    /* Use FFmpeg from PATH unless configured explicitly. */
  }
  const s = JSON.parse(run([cli, 'status', '--output', 'json'], true));
  const db = new URL(s.DB_URL),
    api = new URL(s.API_URL);
  if (
    !['127.0.0.1', 'localhost'].includes(db.hostname) ||
    db.port !== '54322' ||
    db.pathname !== '/postgres' ||
    !['127.0.0.1', 'localhost'].includes(api.hostname) ||
    api.port !== '54321'
  )
    throw new Error('Expected the Polity LOCAL Supabase stack on 54321/54322');
  Object.assign(process.env, {
    NODE_ENV: 'development',
    ZERO_UPSTREAM_DB: s.DB_URL,
    ZERO_CVR_DB: s.DB_URL,
    ZERO_CHANGE_DB: s.DB_URL,
    STUDIO_DATABASE_URL: s.DB_URL,
    SUPABASE_URL: s.API_URL,
    SUPABASE_ANON_KEY: s.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY,
    VITE_SUPABASE_URL: s.API_URL,
    VITE_SUPABASE_ANON_KEY: s.ANON_KEY,
    VITE_ZERO_URL: 'http://localhost:4848',
    VITE_ZERO_CACHE_URL: 'http://localhost:4848',
    VITE_APP_URL: 'http://localhost:3000',
    VITE_ZERO_API_URL: 'http://host.docker.internal:3000',
    ZERO_QUERY_URL: 'http://localhost:3000/api/query',
    ZERO_MUTATE_URL: 'http://localhost:3000/api/mutate',
    __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: 'host.docker.internal',
    POLITY_VITE_CACHE_DIR: path.join(directory, 'vite-cache'),
    COLLABORATION_WEBSOCKET_URL: 'ws://localhost:1236',
    STUDIO_ENABLED: 'true',
  });
  if (process.env.COLLABORATION_TEST_DATABASE) {
    if (!/^polity_collaboration_[a-z0-9_]+$/.test(process.env.COLLABORATION_TEST_DATABASE))
      throw new Error('Invalid local test database');
    db.pathname = `/${process.env.COLLABORATION_TEST_DATABASE}`;
    process.env.ZERO_UPSTREAM_DB = db.toString();
    process.env.ZERO_CVR_DB = db.toString();
    process.env.ZERO_CHANGE_DB = db.toString();
    process.env.STUDIO_DATABASE_URL = db.toString();
    process.env.ZERO_REPLICA_FILE = path.join(
      directory,
      `${process.env.COLLABORATION_TEST_DATABASE}.db`
    );
  }
  const containerDatabase = new URL(process.env.ZERO_UPSTREAM_DB);
  containerDatabase.hostname = 'host.docker.internal';
  process.env.POLITY_LOCAL_ZERO_DATABASE = containerDatabase.toString();
}
const command = process.argv[2] ?? 'start';
if (command === 'clone') {
  await control('stop');
  for (let i = 0; i < 60 && (await control('status')); i++)
    await new Promise(r => setTimeout(r, 250));
  localEnvironment();
  const name = `polity_collaboration_acceptance_${Date.now()}`;
  const docker = (args, input) => {
    const result = spawnSync(
      'docker',
      ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_polity', ...args],
      {
        windowsHide: true,
        encoding: 'utf8',
        input,
        env: {
          ...process.env,
          PGPASSWORD: decodeURIComponent(new URL(process.env.ZERO_UPSTREAM_DB).password),
        },
      }
    );
    if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
    return result.stdout;
  };
  const dump = `/tmp/${name}.dump`;
  const restoreList = `/tmp/${name}.list`;
  const eventList = `/tmp/${name}.events.list`;
  try {
    // A logical snapshot also works while Supabase's pg_net and pg_cron
    // background workers hold the source open. Do not terminate those workers.
    docker([
      'pg_dump',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '-Fc',
      '--exclude-extension=pg_cron',
      '--exclude-extension=pg_graphql',
      '--exclude-schema=cron',
      '--exclude-schema=graphql_public',
      '-f',
      dump,
    ]);
    docker([
      'psql',
      '-U',
      'supabase_admin',
      '-d',
      'template1',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `create database ${name} owner postgres template template0`,
    ]);
    const entries = docker(['pg_restore', '--list', dump]).split('\n');
    // Supabase permits Zero's non-superuser-owned event triggers. PostgreSQL
    // nevertheless refuses to recreate them as a superuser after restoring
    // their functions' original ownership. Restore only those entries under
    // their original session owner; other Supabase objects need admin restore.
    const zeroEvent = line => / EVENT TRIGGER - zero_ddl_(?:start|end)_\d+ postgres\s*$/.test(line);
    const events = entries.filter(zeroEvent);
    docker(['tee', restoreList], entries.filter(line => !zeroEvent(line)).join('\n'));
    docker([
      'pg_restore',
      '-U',
      'supabase_admin',
      '-d',
      name,
      '--exit-on-error',
      '--use-list',
      restoreList,
      dump,
    ]);
    function restoreZeroEvents() {
      if (!events.length) return;
      docker(['tee', eventList], events.join('\n'));
      docker([
        'pg_restore',
        '-U',
        'supabase_admin',
        '-d',
        name,
        '--exit-on-error',
        '--use-set-session-authorization',
        '--use-list',
        eventList,
        dump,
      ]);
    }
    restoreZeroEvents();
  } finally {
    docker(['rm', '-f', '--', dump, restoreList, eventList]);
  }
  writeFileSync(
    path.join(directory, 'test-database.json'),
    JSON.stringify({ name, source: 'postgres', createdAt: new Date().toISOString() })
  );
  console.log(JSON.stringify({ testDatabase: name }));
} else if (command === 'stop') {
  const result = await control('stop');
  console.log(result ?? { running: false });
  if (result) {
    for (let i = 0; i < 60 && (await control('status')); i++)
      await new Promise(r => setTimeout(r, 250));
  }
  run([...compose, 'down'], true, 'docker');
  run([cli, 'stop']);
} else if (command === 'status') {
  const result = await control('status');
  console.log(JSON.stringify(result ?? { running: false }, null, 2));
} else if (command === 'reset') {
  if (process.env.COLLABORATION_TEST_DATABASE)
    throw new Error('Unset test database before resetting the final development environment');
  if (await control('status'))
    throw new Error('Stop dev:stack before resetting its local database');
  run([cli, 'start'], true);
  localEnvironment();
  run([cli, 'db', 'reset', '--local', '--no-seed']);
  run(['tools/zero/clean-dev-cache.mjs']);
  run(['--import', 'tsx', 'tools/collaboration/launch.ts', 'seed']);
} else if (command === 'start') {
  const running = await control('status');
  if (running?.running) {
    console.log('Local stack is already running.');
    process.exit(0);
  }
  if (running)
    for (let i = 0; i < 60 && (await control('status')); i++)
      await new Promise(r => setTimeout(r, 250));
  await assertPortsFree();
  run([cli, 'start'], true);
  localEnvironment();
  const log = openSync(path.join(directory, 'supervisor.log'), 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'supervise'], {
    cwd: root,
    env: process.env,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  let ready = false;
  for (let i = 0; i < 180; i++) {
    const s = await control('status');
    if (s?.services?.every(x => x.ready)) {
      ready = true;
      console.log(JSON.stringify(s, null, 2));
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!ready) throw new Error('Stack did not become ready; see output/local-stack/*.log');
} else if (command === 'supervise') {
  localEnvironment();
  const token = randomUUID(),
    processes = new Map(),
    restarts = new Map();
  let stopping = false;
  const specs = [
    {
      name: 'app',
      port: 3000,
      args: [
        'node_modules/vite/bin/vite.js',
        'dev',
        '--port',
        '3000',
        '--strictPort',
        '--host',
        '::',
      ],
    },
    {
      name: 'zero',
      port: 4848,
      command: 'docker',
      args: [
        ...compose,
        'up',
        '--force-recreate',
        '--no-color',
        '--abort-on-container-exit',
        'zero',
      ],
    },
    {
      name: 'collaboration',
      port: 1236,
      args: ['--import', 'tsx', 'tools/collaboration/launch.ts', 'server'],
    },
    {
      name: 'exports',
      port: null,
      args: [
        '--import',
        'tsx',
        'tools/studio/launch.ts',
        'worker',
        `--health-file=${path.join(directory, 'exports-health.json')}`,
      ],
    },
  ];
  function start(spec) {
    if (stopping) return;
    const log = openSync(path.join(directory, `${spec.name}.log`), 'a');
    const child = spawn(spec.command ?? process.execPath, spec.args, {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', log, log],
    });
    processes.set(spec.name, child);
    child.on('exit', () => {
      processes.delete(spec.name);
      if (!stopping) {
        restarts.set(spec.name, (restarts.get(spec.name) ?? 0) + 1);
        setTimeout(() => start(spec), 1000);
      }
    });
  }
  const sql = postgres(process.env.ZERO_UPSTREAM_DB, { max: 1 });
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.url === '/stop') {
      stopping = true;
      run([...compose, 'down'], true, 'docker');
      for (const child of processes.values()) {
        if (process.platform === 'win32')
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          });
        else child.kill('SIGTERM');
      }
      await sql.end();
      // Acknowledge shutdown only after the writers and their database
      // connection have stopped. Cloning must not race Docker shutdown.
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ stopping: true }));
      server.close(() => process.exit(0));
      return;
    }
    const services = await Promise.all(
      specs.map(async s => {
        let ready = processes.has(s.name);
        let diagnostics;
        if (ready && s.port) {
          try {
            const response = await fetch(
              `http://127.0.0.1:${s.port}${s.name === 'collaboration' ? '/health' : ''}`,
              { signal: AbortSignal.timeout(2000) }
            );
            ready = response.ok;
            if (s.name === 'collaboration' && response.ok) diagnostics = await response.json();
          } catch {
            ready = false;
          }
        }
        if (ready && s.name === 'exports') {
          try {
            const health = JSON.parse(
              readFileSync(path.join(directory, 'exports-health.json'), 'utf8')
            );
            ready =
              health.pid === processes.get(s.name)?.pid &&
              Date.now() - health.at < 30_000 &&
              health.ready;
            diagnostics = { ready: health.ready, heartbeatAgeMs: Date.now() - health.at };
          } catch {
            ready = false;
          }
        }
        return {
          name: s.name,
          pid: processes.get(s.name)?.pid,
          ready,
          restarts: restarts.get(s.name) ?? 0,
          ...(diagnostics ? { diagnostics } : {}),
        };
      })
    );
    let database;
    try {
      [database] =
        await sql`select current_database() as name,phase,(select count(*)::int from collaboration_document where not deleted) as documents,(select count(*)::int from collaboration_outbox where delivered_at is null) as pending_deliveries,(select count(*)::int from collaboration_proposal p join collaboration_document d on d.id=p.document_id where p.application_status='conflict' and not d.deleted) as application_conflicts from collaboration_control where singleton`;
    } catch {
      database = { error: 'database_unavailable' };
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ running: !stopping, services, database }));
  });
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    writeFileSync(
      statePath,
      JSON.stringify({ pid: process.pid, controlPort: address.port, token })
    );
    for (const spec of specs) start(spec);
  });
} else throw new Error('Expected start, status, stop or reset');
