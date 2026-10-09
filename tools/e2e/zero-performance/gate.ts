import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { compare, comparisonEligible, confirmedRegressions, checkBudgets } from './metrics';
import {
  reportFailures,
  REPORT_FORMAT,
  MEASUREMENT_PROTOCOL,
  isAbsoluteBudgetFailure,
  serverWarningFailures,
  type Report,
} from './report';
import { assertOutputDirectory } from './isolation.mjs';
import { readPerformanceReport } from './plan-artifacts';

const root = process.cwd();
const argv = process.argv.slice(2);
const readOption = (name: string) => {
  const i = argv.indexOf(name);
  return i < 0 ? undefined : argv[i + 1];
};
const baseline = readOption('--baseline-ref') ?? process.env.ZERO_PERFORMANCE_BASE_REF;
const directory = path.resolve(
  readOption('--output') ?? `output/zero-performance/gate-${randomUUID().slice(0, 8)}`
);
assertOutputDirectory(root, directory);
const runs: {
  label: string;
  code: number;
  report?: Report;
  error?: string;
  selection?: string[];
}[] = [];

async function run(label: string, reference?: string, selection?: string[]) {
  const output = path.join(directory, label);
  const arguments_ = ['tools/e2e/zero-performance/run.mjs', '--output', output];
  const image = readOption('--zero-image');
  if (image) arguments_.push('--zero-image', image);
  for (const flag of ['--linux-app', '--frozen-dependencies', '--profile-navigation'])
    if (argv.includes(flag)) arguments_.push(flag);
  if (argv.includes('--collect-all') || reference) arguments_.push('--collect-all');
  if (reference) arguments_.push('--source-ref', reference);
  if (selection) {
    const file = path.join(directory, `${label}-cases.json`);
    await writeFile(file, JSON.stringify(selection));
    arguments_.push('--selection-file', file, '--layer', 'queries');
  }
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  const record: (typeof runs)[number] = { label, code, selection };
  try {
    record.report = await readPerformanceReport(path.join(output, 'report.json'));
  } catch (error) {
    record.error = String(error);
  }
  runs.push(record);
  return record;
}
async function valid(record: (typeof runs)[number]) {
  const report = record.report;
  const absoluteBudgets = !record.label.startsWith('base');
  if (record.selection && report) {
    const expected = record.selection.flatMap(key =>
      ['empty/owner', 'minimal/owner', 'minimal/outsider', 'minimal/anonymous'].map(
        suffix => `${key}/${suffix}`
      )
    );
    return (
      (record.code === 0 || (!absoluteBudgets && record.code === 1)) &&
      report.format === REPORT_FORMAT &&
      report.protocol === MEASUREMENT_PROTOCOL &&
      report.filtered &&
      report.layer === 'queries' &&
      !serverWarningFailures(report, absoluteBudgets).length &&
      !report.infrastructure.filter(failure => absoluteBudgets || !isAbsoluteBudgetFailure(failure))
        .length &&
      report.measurements.length === expected.length &&
      new Set(report.measurements.map(item => item.key)).size === expected.length &&
      expected.every(key => report.measurements.some(item => item.key === key)) &&
      report.measurements.every(
        item =>
          !checkBudgets(item).filter(
            failure => absoluteBudgets || !isAbsoluteBudgetFailure(failure)
          ).length
      )
    );
  }
  return (
    (record.code === 0 || (!absoluteBudgets && record.code === 1)) &&
    Boolean(report && !(await reportFailures(report, absoluteBudgets)).length)
  );
}

await mkdir(directory, { recursive: true });
let firstComparison: ReturnType<typeof compare> = [];
let secondComparison: ReturnType<typeof compare> = [];
let bootstrap: string | undefined;
try {
  const head = await run('head');
  if (!(await valid(head)))
    throw new Error(
      'Head failed absolute budgets, complete coverage or result checks; see head/report.json and head diagnostics'
    );
  if (baseline) {
    const resolved = spawnSync('git', ['rev-parse', '--verify', `${baseline}^{commit}`], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (resolved.status !== 0) throw new Error(`Invalid baseline reference ${baseline}`);
    const exists = spawnSync(
      'git',
      ['cat-file', '-e', `${resolved.stdout.trim()}:tools/e2e/zero-performance/measure.ts`],
      { stdio: 'ignore', windowsHide: true }
    );
    if (exists.status !== 0)
      bootstrap =
        'Baseline predates the benchmark. Absolute budgets and full coverage remain mandatory.';
    else {
      const base = await run('base', resolved.stdout.trim());
      if (head.report && base.report) {
        const comparable = (report: Report) => report.measurements.filter(comparisonEligible);
        firstComparison = compare(comparable(base.report), comparable(head.report));
        if (firstComparison.length) {
          // Repeat implicated cases on this runner; the complete first reports remain mandatory.
          const selection = [
            ...new Set(firstComparison.map(item => item.key.split('/').slice(0, 2).join('/'))),
          ];
          const baseConfirmation = await run(
            'base-confirmation',
            resolved.stdout.trim(),
            selection
          );
          const headConfirmation = await run('head-confirmation', undefined, selection);
          if (baseConfirmation.report && headConfirmation.report)
            secondComparison = compare(
              comparable(baseConfirmation.report),
              comparable(headConfirmation.report)
            );
        }
      }
    }
  } else
    bootstrap = 'No baseline reference supplied; absolute budgets and full coverage were checked.';
  const confirmed = confirmedRegressions(firstComparison, secondComparison);
  await writeFile(
    path.join(directory, 'comparison.json'),
    JSON.stringify(
      {
        baseline,
        bootstrap,
        firstComparison,
        secondComparison,
        confirmed,
        runs: await Promise.all(
          runs.map(async record => ({
            label: record.label,
            code: record.code,
            error: record.error,
            selection: record.selection,
            valid: await valid(record),
            cases: record.report?.measurements.length,
            comparisonExcluded: record.report?.measurements
              .filter(item => !comparisonEligible(item))
              .map(item => ({ key: item.key, failures: checkBudgets(item) })),
          }))
        ),
      },
      null,
      2
    )
  );
  console.table(confirmed);
  if (confirmed.length || !(await Promise.all(runs.map(valid))).every(Boolean))
    process.exitCode = 1;
} catch (error) {
  await writeFile(
    path.join(directory, 'gate-failure.json'),
    JSON.stringify(
      { error: String(error), runs: runs.map(({ report: _report, ...r }) => r) },
      null,
      2
    )
  );
  console.error(String(error));
  process.exitCode = 1;
}
