import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_THRESHOLD_SECONDS = 900;
export const DEFAULT_MIN_SAMPLES = 20;
export const DEFAULT_MAX_SAMPLES = 50;

export const PR_PIPELINE_P95_USAGE = `Usage:
  node tools/testing/check-pr-pipeline-p95.mjs --input <workflow-runs.json>
    [--threshold-seconds 900] [--min-samples 20] [--max-samples 50]`;

function parsePositiveInteger(value, option) {
  if (!/^\d+$/.test(value ?? '') || Number(value) < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return Number(value);
}

export function parsePrPipelineP95Options(argv = process.argv.slice(2)) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    const match = argument.match(
      /^--(input|threshold-seconds|min-samples|max-samples)(?:=(.*))?$/u
    );
    if (!match) throw new Error(`Unknown option ${argument}.`);
    const value = match[2] ?? argv[index + 1];
    if (!value || (match[2] === undefined && value.startsWith('--'))) {
      throw new Error(`Missing value for --${match[1]}.`);
    }
    if (values.has(match[1])) throw new Error(`Duplicate option --${match[1]}.`);
    values.set(match[1], value);
    if (match[2] === undefined) index += 1;
  }

  const input = values.get('input');
  if (!input) throw new Error('--input is required.');
  const thresholdSeconds = parsePositiveInteger(
    values.get('threshold-seconds') ?? String(DEFAULT_THRESHOLD_SECONDS),
    '--threshold-seconds'
  );
  const minSamples = parsePositiveInteger(
    values.get('min-samples') ?? String(DEFAULT_MIN_SAMPLES),
    '--min-samples'
  );
  const maxSamples = parsePositiveInteger(
    values.get('max-samples') ?? String(DEFAULT_MAX_SAMPLES),
    '--max-samples'
  );
  if (minSamples > maxSamples) {
    throw new Error('--min-samples cannot exceed --max-samples.');
  }

  return {
    help: false,
    input: path.resolve(input),
    thresholdSeconds,
    minSamples,
    maxSamples,
  };
}

function qualifyingRun(run) {
  return (
    run &&
    typeof run === 'object' &&
    run.event === 'pull_request' &&
    run.status === 'completed' &&
    run.conclusion === 'success'
  );
}

function normalizeRun(run) {
  if (run.id === undefined || run.id === null) {
    throw new Error('A qualifying workflow run is missing its id.');
  }
  const startedAtMs = Date.parse(run.run_started_at);
  const completedAtMs = Date.parse(run.updated_at);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) {
    throw new Error(`Qualifying workflow run ${run.id} has invalid timestamps.`);
  }
  if (completedAtMs < startedAtMs) {
    throw new Error(`Qualifying workflow run ${run.id} completes before it starts.`);
  }
  return {
    id: String(run.id),
    startedAtMs,
    completedAtMs,
    durationSeconds: (completedAtMs - startedAtMs) / 1000,
  };
}

function deduplicateRuns(runs) {
  const byId = new Map();
  for (const run of runs) {
    const previous = byId.get(run.id);
    if (
      previous &&
      (previous.startedAtMs !== run.startedAtMs ||
        previous.completedAtMs !== run.completedAtMs ||
        previous.durationSeconds !== run.durationSeconds)
    ) {
      throw new Error(`Conflicting records found for workflow run ${run.id}.`);
    }
    byId.set(run.id, run);
  }
  return [...byId.values()];
}

export function nearestRankPercentile(values, percentile) {
  if (values.length === 0) throw new Error('Cannot calculate a percentile without samples.');
  if (!(percentile > 0 && percentile <= 1)) {
    throw new Error('Percentile must be greater than 0 and at most 1.');
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function evaluatePrPipelineP95(
  payload,
  {
    thresholdSeconds = DEFAULT_THRESHOLD_SECONDS,
    minSamples = DEFAULT_MIN_SAMPLES,
    maxSamples = DEFAULT_MAX_SAMPLES,
  } = {}
) {
  if (!payload || !Array.isArray(payload.workflow_runs)) {
    throw new Error('Input must be a GitHub workflow-runs response with workflow_runs[].');
  }
  if (minSamples < 1 || maxSamples < minSamples || thresholdSeconds < 1) {
    throw new Error('Invalid P95 evaluation limits.');
  }

  const eligibleRuns = deduplicateRuns(
    payload.workflow_runs.filter(qualifyingRun).map(normalizeRun)
  )
    .sort(
      (left, right) => right.completedAtMs - left.completedAtMs || right.id.localeCompare(left.id)
    )
    .slice(0, maxSamples);

  if (eligibleRuns.length < minSamples) {
    return {
      status: 'insufficient-samples',
      sampleCount: eligibleRuns.length,
      minSamples,
      maxSamples,
      thresholdSeconds,
      p95Seconds: null,
    };
  }

  const p95Seconds = nearestRankPercentile(
    eligibleRuns.map(run => run.durationSeconds),
    0.95
  );
  return {
    status: p95Seconds <= thresholdSeconds ? 'pass' : 'over-threshold',
    sampleCount: eligibleRuns.length,
    minSamples,
    maxSamples,
    thresholdSeconds,
    p95Seconds,
  };
}

export function runPrPipelineP95Cli({
  argv = process.argv.slice(2),
  readFile = file => fs.readFileSync(file, 'utf8'),
  stdout = console.log,
  stderr = console.error,
} = {}) {
  let options;
  try {
    options = parsePrPipelineP95Options(argv);
    if (options.help) {
      stdout(PR_PIPELINE_P95_USAGE);
      return 0;
    }
    const payload = JSON.parse(readFile(options.input));
    const result = evaluatePrPipelineP95(payload, options);
    stdout(JSON.stringify(result));
    if (result.status === 'pass') return 0;
    if (result.status === 'insufficient-samples') {
      stderr(
        `PR pipeline P95 gate has only ${result.sampleCount}/${result.minSamples} required successful samples.`
      );
      return 2;
    }
    stderr(`PR pipeline P95 ${result.p95Seconds}s exceeds the ${result.thresholdSeconds}s limit.`);
    return 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    stderr(PR_PIPELINE_P95_USAGE);
    return 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  process.exitCode = runPrPipelineP95Cli();
}
