import { spawn } from 'node:child_process';
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
} = {}) {
  const child = spawnChild(command, args, { detached: true, stdio: 'inherit' });
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
  processState.on('SIGTERM', stop);
  processState.on('SIGINT', stop);
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
  }
}

export async function runCacheCli({ runCache, processState }) {
  processState.exitCode = await runCache();
}

await runCliIfMain(
  import.meta.url,
  runCacheCli.bind(null, { runCache: superviseCache, processState: process })
);
