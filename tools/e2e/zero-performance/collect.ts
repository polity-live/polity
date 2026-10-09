import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, stat, rename, link, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { loadCases } from './catalog';
import { securityCaseManifest } from './security';
import { BUDGETS, REPETITIONS, checkBudgets, type Measurement } from './metrics';
import {
  REPORT_FORMAT,
  MEASUREMENT_PROTOCOL,
  correlateQueryAPI,
  isAbsoluteBudgetFailure,
  measuredServerWarnings,
  type Report,
} from './report';
import { PROFILE_SUFFIXES, queryBatches, batchCoverageFailures } from './batches';
import { required } from './required';
import { waitForZeroReady } from '../../../e2e/fixtures/zero-readiness';
import { closeDb } from '../../../e2e/fixtures/db';
import { isJoinPlanArtifact } from './plan-artifacts';
import { resultsCSV } from './results';

const output = required(process.env.ZERO_PERFORMANCE_OUTPUT);
const layer = process.env.ZERO_PERFORMANCE_LAYER ?? 'all';
const selection: string[] | undefined = process.env.ZERO_PERFORMANCE_SELECTION
  ? JSON.parse(await readFile(process.env.ZERO_PERFORMANCE_SELECTION, 'utf8'))
  : undefined;
const all = loadCases();
if (selection?.some(key => !all.some(entry => `${entry.name}/${entry.variant}` === key)))
  throw new Error('Selection includes an unregistered query case');
const entries = all.filter(
  entry =>
    (!selection || selection.includes(`${entry.name}/${entry.variant}`)) &&
    (!process.env.ZERO_PERFORMANCE_QUERY || entry.name === process.env.ZERO_PERFORMANCE_QUERY) &&
    (!process.env.ZERO_PERFORMANCE_CASE || entry.variant === process.env.ZERO_PERFORMANCE_CASE)
);
if (!entries.length) throw new Error('No matching query/case; refusing a vacuous success');
const keys = entries.map(entry => `${entry.name}/${entry.variant}`);
const expectedKeys = keys.flatMap(key => PROFILE_SUFFIXES.map(suffix => `${key}/${suffix}`));
const expectedSecurityCases = await securityCaseManifest();
const filtered = Boolean(
  selection || process.env.ZERO_PERFORMANCE_QUERY || process.env.ZERO_PERFORMANCE_CASE
);
const failFast = layer === 'all' && process.env.ZERO_PERFORMANCE_COLLECT_ALL !== '1';
const measurements: Measurement[] = [];
const infrastructure: string[] = [];
const workers: {
  label: string;
  keys: string[];
  startedAt: string;
  elapsedMs?: number;
  code?: number;
}[] = [];
let journeys: Report['journeys'];
let runtime: unknown;
let readyAt: string;
let warningOffset = 0;
let activeChild: ReturnType<typeof spawn> | undefined;
let pendingProgress = Promise.resolve();
let interrupted = false;

async function save(final = false, extra: Record<string, unknown> = {}) {
  const target = path.join(output, final ? 'report.json' : 'progress.json');
  await writeFile(
    `${target}.tmp`,
    JSON.stringify(
      {
        format: REPORT_FORMAT,
        protocol: MEASUREMENT_PROTOCOL,
        runtime,
        budgets: BUDGETS,
        repetitions: REPETITIONS,
        layer,
        filtered,
        expectedKeys,
        expectedSecurityCases,
        infrastructure,
        queryCount: new Set(measurements.map(row => row.name)).size,
        ...(final
          ? { measurements }
          : { measurementsCount: measurements.length, lastMeasurement: measurements.at(-1)?.key }),
        readyAt,
        journeys,
        workers,
        ...extra,
      },
      null,
      2
    )
  );
  await rename(`${target}.tmp`, target);
}

async function worker(label: string, workerLayer: string, selected?: string[]) {
  if (interrupted) throw new Error('Measurement collection interrupted');
  const directory = path.join(output, 'workers', label);
  await mkdir(directory, { recursive: true });
  const expected = selected
    ? selected.flatMap(key => PROFILE_SUFFIXES.map(suffix => `${key}/${suffix}`))
    : workerLayer === 'security'
      ? expectedSecurityCases.map(row => row.key)
      : [];
  const selectionFile = path.join(directory, 'selection.json');
  if (selected) await writeFile(selectionFile, JSON.stringify(selected));
  const record = {
    label,
    keys: expected,
    startedAt: new Date().toISOString(),
  } as (typeof workers)[number];
  workers.push(record);
  await save();
  const started = performance.now();
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'tools/e2e/zero-performance/measure.ts'],
      {
        cwd: process.cwd(),
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          ZERO_PERFORMANCE_OUTPUT: directory,
          ZERO_PERFORMANCE_LOG_OUTPUT: output,
          ZERO_PERFORMANCE_PLAN_OUTPUT: directory,
          ZERO_PERFORMANCE_LAYER: workerLayer,
          ZERO_PERFORMANCE_SELECTION: selected ? selectionFile : '',
          ZERO_PERFORMANCE_QUERY: '',
          ZERO_PERFORMANCE_CASE: '',
          ZERO_PERFORMANCE_FAIL_FAST: failFast ? '1' : '',
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      }
    );
    activeChild = child;
    let lines = '';
    let completed = 0;
    child.stdout?.on('data', data => {
      process.stdout.write(data);
      lines += data.toString();
      const chunks = lines.split('\n');
      lines = chunks.pop() ?? '';
      for (const line of chunks) {
        if (!line.startsWith('{"key":')) continue;
        try {
          const row = JSON.parse(line);
          completed++;
          const count = completed;
          pendingProgress = pendingProgress
            .then(() =>
              save(false, {
                measurementsCount: measurements.length + count,
                lastMeasurement: row.key,
              })
            )
            .catch(error => {
              infrastructure.push(`Cannot save progress: ${String(error)}`);
            });
        } catch {
          /* Console lines are not accepted as measurement data. */
        }
      }
    });
    child.once('error', reject);
    child.once('close', code => resolve(code ?? 1));
  });
  activeChild = undefined;
  await pendingProgress;
  record.elapsedMs = performance.now() - started;
  record.code = code;
  let report: Report & { runtime?: unknown };
  try {
    report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
    if (report.format !== REPORT_FORMAT || report.protocol !== MEASUREMENT_PROTOCOL)
      throw new Error('Worker protocol mismatch');
    if (runtime && JSON.stringify(runtime) !== JSON.stringify(report.runtime))
      throw new Error('Worker runtime mismatch');
    runtime ??= report.runtime;
    infrastructure.push(
      ...report.infrastructure.map(failure =>
        isAbsoluteBudgetFailure(failure) ? failure : `${label}: ${failure}`
      )
    );
    if (workerLayer === 'journeys') journeys = report.journeys;
  } catch (error) {
    infrastructure.push(`${label}: ${String(error)}`);
    // A crashed process still contributes its saved diagnostics; missing coverage stays red.
    let partial: Measurement[] = [];
    try {
      partial = (await readFile(path.join(directory, 'measurements.ndjson'), 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
    } catch (error) {
      infrastructure.push(`${label}: Cannot recover partial measurements: ${String(error)}`);
    }
    report = { measurements: partial } as Report;
  }
  if (!Array.isArray(report.measurements)) throw new Error(`${label}: Missing worker measurements`);
  await mkdir(path.join(output, 'plans'), { recursive: true });
  for (const row of report.measurements) {
    const ref = (row.plans as { joinsArtifact?: unknown } | null)?.joinsArtifact;
    if (!ref) continue;
    try {
      if (!isJoinPlanArtifact(ref)) throw new Error('Invalid worker plan reference');
      const source = path.join(directory, ref.path),
        target = path.join(output, ref.path);
      try {
        await link(source, target);
      } catch (error) {
        if (!['EXDEV', 'EPERM', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? ''))
          throw error;
        await copyFile(source, target, constants.COPYFILE_EXCL);
      }
    } catch (error) {
      infrastructure.push(`${label}/${row.key}: Cannot retain plan: ${String(error)}`);
    }
  }
  infrastructure.push(...batchCoverageFailures(expected, report.measurements));
  measurements.push(...report.measurements);
  if (
    code !== 0 &&
    !report.infrastructure?.length &&
    !report.measurements.some(row => row.failures.length)
  )
    infrastructure.push(`${label}: Worker exited ${code}`);
  await save();
  if (interrupted) throw new Error('Measurement collection interrupted');
  if (
    failFast &&
    (code !== 0 || infrastructure.length || measurements.some(row => row.failures.length))
  )
    throw new Error(`Strict gate stopped in ${label}; missing remaining coverage cannot pass`);
}

const interrupt = () => {
  interrupted = true;
  activeChild?.kill();
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
  await waitForZeroReady();
  readyAt = new Date().toISOString();
  warningOffset = (await stat(path.join(output, 'zero.log'))).size;
  if (!['security', 'journeys'].includes(layer)) {
    let index = 0;
    for (const batch of queryBatches(keys)) await worker(`queries-${++index}`, 'queries', batch);
  }
  if (!filtered && layer !== 'journeys') await worker('security', 'security');
  if (!filtered && ['all', 'journeys'].includes(layer)) await worker('journeys', 'journeys');
} catch (error) {
  infrastructure.push(String(error));
} finally {
  await closeDb();
  const apiDiagnostics = (await readFile(path.join(output, 'app.log'), 'utf8'))
    .split('\n')
    .flatMap(line => {
      const start = line.search(/\{"benchmark":"query-(?:api|http)"/);
      if (start < 0) return [];
      try {
        return [JSON.parse(line.slice(start))];
      } catch {
        infrastructure.push('Invalid query API diagnostic record');
        return [];
      }
    });
  correlateQueryAPI(measurements, apiDiagnostics);
  for (const row of measurements) row.failures = checkBudgets(row);
  const warningLog = measuredServerWarnings(
    await readFile(path.join(output, 'zero.log')),
    warningOffset
  );
  const serverWarnings = warningLog.warnings;
  infrastructure.push(...warningLog.errors);
  const warningFailure = `${serverWarnings.length} server slow-query warnings`;
  if (serverWarnings.length && !infrastructure.includes(warningFailure))
    infrastructure.push(warningFailure);
  await writeFile(
    path.join(output, 'measurements.ndjson'),
    measurements.map(row => JSON.stringify(row)).join('\n') + '\n'
  );
  await save(true, { serverWarnings, apiDiagnostics });
  await writeFile(path.join(output, 'results.csv'), resultsCSV(measurements));
  if (journeys)
    await writeFile(
      path.join(output, 'journeys.csv'),
      [
        'route,visit,visibleMs,cachedDisplayMs,authoritativeMs,failures',
        ...journeys.map(row =>
          [
            row.route,
            row.visit,
            row.visibleMs,
            row.cachedDisplayMs,
            row.authoritativeMs,
            row.failures.join('; '),
          ]
            .map(value => JSON.stringify(value))
            .join(',')
        ),
      ].join('\n')
    );
  if (
    infrastructure.length ||
    measurements.some(row => row.failures.length) ||
    journeys?.some(row => row.failures.length)
  )
    process.exitCode = 1;
}
