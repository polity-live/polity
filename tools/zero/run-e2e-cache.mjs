import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

// Zero forks detached workers on Linux. Playwright's process-group kill cannot
// reach those workers, which can retain its output pipes after the runner exits.
// Track only this cache's descendants, including their birth time to reject PID reuse.
export function readProcesses(procRoot = '/proc') {
  const processes = new Map();
  for (const name of readdirSync(procRoot)) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`${procRoot}/${name}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      processes.set(Number(name), {
        parent: Number(fields[1]),
        born: fields[19],
        state: fields[0],
      });
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
    }
  }
  return processes;
}

export function readWindowsProcesses(execute = execFileSync) {
  const output = execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference="Stop"; @((Get-CimInstance Win32_Process) | Where-Object {$null -ne $_.CreationDate} | ForEach-Object { @{pid=$_.ProcessId;parent=$_.ParentProcessId;born=$_.CreationDate.ToUniversalTime().Ticks.ToString()} }) | ConvertTo-Json -Compress',
    ],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }
  );
  const rows = JSON.parse(output);
  if (!Array.isArray(rows)) throw new Error('Unavailable Windows process inventory');
  const processes = new Map();
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.pid) ||
      row.pid < 0 ||
      !Number.isSafeInteger(row.parent) ||
      row.parent < 0 ||
      typeof row.born !== 'string' ||
      !/^\d+$/.test(row.born)
    )
      throw new Error('Invalid Windows process identity');
    processes.set(row.pid, { parent: row.parent, born: row.born, state: 'R' });
  }
  return processes;
}

export function terminateWindowsTree(
  pid,
  born,
  snapshot = readWindowsProcesses,
  execute = execFileSync
) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || typeof born !== 'string' || !/^\d+$/.test(born))
    throw new Error('Unavailable owned Windows process identity');
  if (snapshot().get(pid)?.born !== born) return;
  try {
    execute('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'pipe',
    });
  } catch (error) {
    // A process can exit between the identity check and taskkill. Other failures
    // are fatal: offline SQLite maintenance cannot proceed with a living worker.
    if (snapshot().get(pid)?.born === born) throw error;
  }
}

export function discoverDescendants(owned, processes) {
  let added;
  do {
    added = false;
    for (const [pid, info] of processes) {
      const parent = processes.get(info.parent);
      if (!owned.has(pid) && parent && owned.get(info.parent) === parent.born) {
        owned.set(pid, info.born);
        added = true;
      }
    }
  } while (added);
}

export function livingDescendants(owned, processes) {
  return [...owned.keys()].filter(pid => {
    const info = processes.get(pid);
    return info && info.born === owned.get(pid) && info.state !== 'Z';
  });
}

/**
 * @param {{command?: string, args?: string[], graceMs?: number,
 * processState?: import('node:events').EventEmitter,
 * snapshot?: typeof readProcesses, spawnChild?: typeof spawn,
 * signal?: (pid: number, name: NodeJS.Signals) => void,
 * logger?: {error: (...values: unknown[]) => void}, env?: NodeJS.ProcessEnv,
 * onReady?: (stop: () => void) => void}} [options]
 */
export async function superviseCache({
  command = process.execPath,
  args = [
    fileURLToPath(
      new URL('../../node_modules/@rocicorp/zero/out/zero/src/cli.js', import.meta.url)
    ),
  ],
  graceMs = 8_000,
  processState = process,
  snapshot = readProcesses,
  spawnChild = spawn,
  signal = (pid, name) => {
    process.kill(pid, name);
  },
  logger = { error: console.error },
  env,
  onReady,
} = {}) {
  const child = spawnChild(command, args, {
    detached: true,
    windowsHide: true,
    stdio: onReady ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
    ...(env ? { env } : {}),
  });
  if (!child.pid) {
    return await new Promise(resolve =>
      child.once('error', error => {
        logger.error(error);
        resolve(1);
      })
    );
  }
  const owned = new Map([[child.pid, snapshot().get(child.pid)?.born]]);
  let stoppingAt;
  let exitCode;
  let requested = false;
  const send = (pid, name) => {
    try {
      signal(pid, name);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  const stop = () => {
    if (stoppingAt !== undefined) return;
    requested = true;
    stoppingAt = Date.now();
    const processes = snapshot();
    discoverDescendants(owned, processes);
    if (livingDescendants(owned, processes).includes(child.pid)) send(child.pid, 'SIGTERM');
  };
  child.on('message', message => {
    if (Array.isArray(message) && message[0] === 'ready' && message[1]?.ready === true)
      onReady?.(stop);
  });
  processState.on('SIGTERM', stop);
  processState.on('SIGINT', stop);
  processState.on('SIGQUIT', stop);
  child.once('exit', (code, childSignal) => {
    exitCode = requested ? 0 : (code ?? (childSignal ? 1 : 0));
    stoppingAt ??= Date.now();
  });
  try {
    while (true) {
      const processes = snapshot();
      discoverDescendants(owned, processes);
      const living = livingDescendants(owned, processes);
      if (exitCode !== undefined && living.length === 0) return exitCode;
      if (stoppingAt !== undefined && Date.now() - stoppingAt >= graceMs) {
        for (const pid of living) send(pid, 'SIGKILL');
        if (living.length)
          logger.error(
            `[e2e-zero] Reaped ${living.length} cache processes after graceful shutdown.`
          );
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally {
    processState.off('SIGTERM', stop);
    processState.off('SIGINT', stop);
    processState.off('SIGQUIT', stop);
  }
}

export async function runCacheCli({ runCache, processState }) {
  processState.exitCode = await runCache();
}

await runCliIfMain(
  import.meta.url,
  runCacheCli.bind(null, { runCache: superviseCache, processState: process })
);
