import { mutationFailures, type MutationMeasurement } from './mutation-metrics';

export type SchedulingWeights = Record<string, number>;
export interface MutationWeightUpdate {
  weights: SchedulingWeights;
  acceptedMeasurements: number;
  ignoredMeasurements: number;
  updatedKeys: string[];
}

/** Scheduling costs are full five-repetition case durations, never mutation latency. */
export function updateMutationSchedulingWeights(
  base: unknown,
  reports: readonly unknown[]
): MutationWeightUpdate {
  if (!base || typeof base !== 'object' || Array.isArray(base))
    throw new Error('Scheduling weights must be a JSON object');
  const weights: SchedulingWeights = {};
  for (const [key, value] of Object.entries(base)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
      throw new Error(`Invalid existing scheduling weight: ${key}`);
    Object.defineProperty(weights, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  let acceptedMeasurements = 0,
    ignoredMeasurements = 0;
  const updatedKeys = new Set<string>();
  for (const input of reports) {
    if (!input || typeof input !== 'object') throw new Error('Expected a v12 report');
    const report = input as { format?: unknown; protocol?: unknown; mutations?: unknown };
    if (
      report.format !== 12 ||
      report.protocol !== 'zero-performance/v12' ||
      !Array.isArray(report.mutations)
    )
      throw new Error('Expected a v12 report with mutation measurements');
    for (const candidate of report.mutations) {
      const row = candidate as MutationMeasurement;
      let complete = false;
      try {
        complete =
          !!row &&
          /^mutation\/[^/]+\/[^/]+\/[^/]+$/.test(row.key) &&
          row.key ===
            `mutation/${row.expectation.name}/${row.expectation.variant}/${row.expectation.actor}` &&
          Array.isArray(row.samples) &&
          row.samples.length === 5 &&
          typeof row.elapsedMs === 'number' &&
          Number.isFinite(row.elapsedMs) &&
          row.elapsedMs > 0 &&
          mutationFailures(row, false).length === 0;
      } catch {
        /* Malformed or partial measurements cannot provide scheduling evidence. */
      }
      const elapsedMs = row.elapsedMs;
      if (!complete || typeof elapsedMs !== 'number') {
        ignoredMeasurements++;
        continue;
      }
      acceptedMeasurements++;
      const cost = Math.ceil(elapsedMs);
      const previous = weights[row.key];
      if (previous === undefined || cost > previous) {
        weights[row.key] = cost;
        updatedKeys.add(row.key);
      }
    }
  }
  const ordered = Object.fromEntries(
    Object.entries(weights).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
  return {
    weights: ordered,
    acceptedMeasurements,
    ignoredMeasurements,
    updatedKeys: [...updatedKeys].sort(),
  };
}

export function mutationWeightCLIOptions(args: readonly string[]) {
  let weights: string | undefined, output: string | undefined;
  const reports: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--weights') {
      if (weights) throw new Error('Duplicate --weights');
      weights = value;
    } else if (flag === '--output') {
      if (output) throw new Error('Duplicate --output');
      output = value;
    } else if (flag === '--report') reports.push(value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!weights || !output || !reports.length)
    throw new Error(
      'Required: --weights <file> --report <v12-report> [--report <v12-report>] --output <file>'
    );
  return { weights, output, reports };
}
