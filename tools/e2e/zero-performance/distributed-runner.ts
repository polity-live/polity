import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { mkdir, readFile } from 'node:fs/promises';
import { readPerformanceReport } from './plan-artifacts';
import {
  comparisons,
  confirmationFailures,
  confirmationSelection,
  partialReportFailures,
  shardMeasurementKeys,
} from './distributed-report';
import {
  command,
  git,
  harnessDigest,
  harnessRoot,
  option,
  readJSON,
  writeJSON,
} from './distributed-io';
import { ACTIVE_BUDGET_MS, type Execution, type Manifest, type Revision } from './sharding';
import type { Report } from './report';

export interface ShardRun {
  revision: Revision;
  phase: Execution['phase'];
  output: string;
  selected: string[];
  code: number;
  elapsedMs: number;
}
export interface ShardResult {
  manifestDigest: string;
  shardID: string;
  runnerID: string;
  runs: ShardRun[];
  failures: string[];
  elapsedMs: number;
  setupMs: number;
  measurementMs: number;
  confirmationMs: number;
  cleanupMs: number;
  diagnostics?: { control: number; integrity: number };
  bootstrap?: string;
}

class Session {
  child: ChildProcess;
  setupMs = 0;
  private events: any[] = [];
  private resolve?: () => void;
  private exited = false;
  constructor(args: string[]) {
    this.child = spawn(
      process.execPath,
      ['tools/e2e/zero-performance/run.mjs', ...args, '--session', '--collect-all'],
      { stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true }
    );
    this.child.on('message', event => {
      this.events.push(event);
      this.resolve?.();
    });
    this.child.on('error', error => {
      this.events.push({ type: 'error', error: String(error) });
      this.resolve?.();
    });
    this.child.on('exit', () => {
      this.exited = true;
      this.resolve?.();
    });
  }
  async event(type: string) {
    while (true) {
      const next = this.events.shift();
      if (next?.type === type) return next;
      if (next?.type === 'error' || this.exited)
        throw new Error(next?.error ?? 'Owned session exited before completing its measurement');
      if (!this.events.length)
        await new Promise<void>(resolve => {
          this.resolve = resolve;
        });
      this.resolve = undefined;
    }
  }
  async stop() {
    if (this.exited) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.child.kill('SIGINT');
        reject(new Error('Owned session cleanup timeout'));
      }, 90_000);
      this.child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      if (this.child.connected)
        this.child.send({ type: 'stop' }, error => {
          if (error) this.child.kill('SIGINT');
        });
      else this.child.kill('SIGINT');
    });
    if (this.child.exitCode !== 0) throw new Error('Owned stack cleanup failed');
  }
}

export async function runShard(manifest: Manifest, id: string, directory: string) {
  if (
    git('rev-parse', 'HEAD') !== manifest.headSHA ||
    (await harnessDigest()) !== manifest.harnessDigest
  )
    throw new Error('Checked-out source/harness differs from the preparation manifest');
  const shard = manifest.shards.find(entry => entry.id === id);
  if (!shard) throw new Error('Unknown shard');
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true });
  const started = performance.now();
  const jobStartFile = option('--job-start-file');
  const priorSetupMs = jobStartFile
    ? os.uptime() * 1000 - Number(await readFile(jobStartFile, 'utf8')) * 1000
    : 0;
  if (!Number.isFinite(priorSetupMs) || priorSetupMs < 0)
    throw new Error('Invalid active runner start');
  const runnerID = `${process.env.RUNNER_NAME ?? 'local'}-${randomUUID()}`;
  const result: ShardResult = {
    manifestDigest: manifest.digest,
    shardID: id,
    runnerID,
    runs: [],
    failures: [],
    elapsedMs: 0,
    setupMs: priorSetupMs,
    measurementMs: 0,
    confirmationMs: 0,
    cleanupMs: 0,
    bootstrap: manifest.bootstrap,
  };
  const sessions: Partial<Record<Revision, Session>> = {};
  const reports: Partial<Record<Revision, Report>> = {};
  const abort = new AbortController();
  const signal = () => {
    abort.abort();
    for (const session of Object.values(sessions)) session?.child.kill('SIGINT');
  };
  // Leave two minutes inside the fifteen-minute job for cleanup and artifacts.
  const timer = setTimeout(
    () => {
      result.failures.push('Runner measurement deadline exceeded');
      signal();
    },
    Math.max(1, ACTIVE_BUDGET_MS.runner - 120_000 - priorSetupMs)
  );
  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);
  const measure = async (revision: Revision, phase: Execution['phase'], selected: string[]) => {
    if (abort.signal.aborted) throw new Error('Runner measurement deadline interrupted execution');
    const sourceSHA = revision === 'head' ? manifest.headSHA : manifest.baseSHA;
    if (!sourceSHA) throw new Error('Missing revision source SHA');
    const execution: Execution = {
      manifestDigest: manifest.digest,
      shardID: id,
      revision,
      sourceSHA,
      harnessDigest: manifest.harnessDigest,
      runnerID,
      phase,
    };
    const executionFile = path.join(root, `${revision}-${phase}-execution.json`);
    await writeJSON(executionFile, execution);
    const selectionFile = selected.length
      ? path.join(root, `${revision}-${phase}-selection.json`)
      : undefined;
    if (selectionFile) await writeJSON(selectionFile, selected);
    if (abort.signal.aborted) throw new Error('Runner measurement deadline interrupted setup');
    let session = sessions[revision];
    if (!session) {
      const setupAt = performance.now();
      const args = [
        '--output',
        path.join(root, revision),
        '--layer',
        shard.layer,
        '--harness-root',
        harnessRoot,
        '--execution-file',
        executionFile,
      ];
      if (revision === 'base') args.push('--source-ref', sourceSHA);
      if (selectionFile)
        args.push(
          shard.layer === 'security' ? '--security-selection-file' : '--selection-file',
          selectionFile
        );
      session = new Session(args);
      sessions[revision] = session;
      await session.event('ready');
      result.setupMs += performance.now() - setupAt;
    }
    if (abort.signal.aborted) throw new Error('Runner measurement deadline interrupted activation');
    const destination = path.join(root, revision, phase);
    session.child.send({
      type: 'measure',
      output: destination,
      executionFile,
      layer: shard.layer,
      ...(selectionFile
        ? {
            [shard.layer === 'security' ? 'securitySelectionFile' : 'selectionFile']: selectionFile,
          }
        : {}),
    });
    const completed = await session.event('measured');
    result.runs.push({
      revision,
      phase,
      output: path.relative(root, destination).replaceAll('\\', '/'),
      selected,
      code: completed.code,
      elapsedMs: completed.elapsedMs,
    });
    if (completed.code !== 0 && !(revision === 'base' && completed.code === 1))
      result.failures.push(`${revision}/${phase}: Measurement process exited ${completed.code}`);
    if (phase === 'confirmation') result.confirmationMs += completed.elapsedMs;
    else result.measurementMs += completed.elapsedMs;
    const report = await readPerformanceReport(path.join(destination, 'report.json'));
    result.failures.push(
      ...partialReportFailures(report, manifest, shard, revision, phase, runnerID, selected).map(
        failure => `${revision}/${phase}: ${failure}`
      )
    );
    return report;
  };
  try {
    if (shard.layer === 'diagnostics') {
      const execution: Execution = {
        manifestDigest: manifest.digest,
        shardID: id,
        revision: 'head',
        sourceSHA: manifest.headSHA,
        harnessDigest: manifest.harnessDigest,
        runnerID,
        phase: 'control',
      };
      const executionFile = path.join(root, 'control-execution.json');
      await writeJSON(executionFile, execution);
      const diagnosticsAt = performance.now();
      const common = ['--harness-root', harnessRoot, '--execution-file', executionFile];
      const integrity = await command(
        [
          'tools/e2e/zero-performance/run.mjs',
          '--layer',
          'integrity',
          '--output',
          path.join(root, 'integrity'),
          ...common,
        ],
        process.env,
        abort.signal
      );
      if (abort.signal.aborted) throw new Error('Runner deadline interrupted integrity/control');
      const control = await command(
        [
          'tools/e2e/zero-performance/run.mjs',
          '--query',
          'users.current',
          '--case',
          'default',
          '--layer',
          'queries',
          '--collect-all',
          '--output',
          path.join(root, 'control'),
          ...common,
        ],
        process.env,
        abort.signal
      );
      result.diagnostics = { integrity, control };
      const integrityReport = await readJSON(path.join(root, 'integrity/integrity.json'));
      const controlReport = await readPerformanceReport(path.join(root, 'control/report.json'));
      if (
        integrity ||
        control ||
        integrityReport.outcome !== 'passed' ||
        controlReport.measurements.length !== 4 ||
        controlReport.measurements.some(measurement => measurement.failures.length) ||
        controlReport.infrastructure.length
      )
        result.failures.push('Control query or database integrity failed');
      let setupMs = 0;
      for (const layer of ['integrity', 'control']) {
        const startup = (await readJSON(path.join(root, layer, 'startup.json'))).startup;
        setupMs +=
          (startup.supabaseMs ?? 0) + (startup.dependenciesMs ?? 0) + (startup.buildMs ?? 0);
      }
      result.setupMs += setupMs;
      result.measurementMs += Math.max(0, performance.now() - diagnosticsAt - setupMs);
    } else {
      for (const revision of ['head', 'base'] as const) {
        if (revision === 'base' && !manifest.workloads.base) continue;
        if (shard.layer !== 'journeys' && !shard[revision].length) continue;
        reports[revision] = await measure(revision, 'initial', shard[revision]);
      }
      const first = comparisons(reports.base, reports.head);
      const selected = confirmationSelection(shard, first);
      let baseConfirmation: Report | undefined, headConfirmation: Report | undefined;
      if (selected.length) {
        baseConfirmation = await measure('base', 'confirmation', selected);
        headConfirmation = await measure('head', 'confirmation', selected);
      }
      const second = comparisons(baseConfirmation, headConfirmation);
      result.failures.push(
        ...confirmationFailures(
          first,
          second,
          shardMeasurementKeys(shard, 'head', selected),
          baseConfirmation,
          headConfirmation
        )
      );
      await writeJSON(path.join(root, 'comparison.json'), {
        first,
        second,
        bootstrap: manifest.bootstrap,
      });
    }
  } catch (error) {
    result.failures.push(String(error));
  } finally {
    const cleanupAt = performance.now();
    for (const session of Object.values(sessions))
      try {
        await session?.stop();
      } catch (error) {
        result.failures.push(String(error));
      }
    result.cleanupMs = performance.now() - cleanupAt;
    clearTimeout(timer);
    process.removeListener('SIGINT', signal);
    process.removeListener('SIGTERM', signal);
    result.elapsedMs = priorSetupMs + performance.now() - started;
    if (result.elapsedMs > ACTIVE_BUDGET_MS.runner)
      result.failures.push('Runner exceeded fifteen-minute active budget');
    result.failures = [...new Set(result.failures)];
    await writeJSON(path.join(root, 'runner.json'), result);
    if (result.failures.length) process.exitCode = 1;
  }
}
