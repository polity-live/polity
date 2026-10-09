export const BUDGETS = Object.freeze({ totalMs: 1_000, clientMs: 50, serverP95Ms: 100 });
export const REPETITIONS = Object.freeze({ materialize: 5, warmup: 3, analyze: 20 });
export interface Sample {
  api?: {
    requestID: string;
    authMs: number;
    transformMs: number;
    requestMs: number;
    arrivalAt: number;
    responseAt: number;
    responseToAuthoritativeMs: number;
    structure: { bytes: number; queries: number; conditions: number; maxQueryDepth: number };
  };
  queryID?: string;
  activatedAt?: number;
  authoritativeAt?: number;
  totalMs: number;
  clientMs: number;
  serverMs: number;
  clientGroupID: string;
  clientID: string;
  connectionMs: number;
}
export interface Measurement {
  relatedChecks?: {
    rootID: string;
    expected: Record<string, string[]>;
    observed: Record<string, string[]>[];
  };
  key: string;
  name: string;
  variant: string;
  profile: string;
  actor: string;
  revision: number;
  reason: string;
  args: unknown;
  expectedIDs: string[];
  observedIDs: string[][];
  samples: Sample[];
  analyzeMs: number[];
  readRows: number;
  scannedRows: number;
  syncedRows: number;
  plans: unknown;
  warnings: string[];
  failures: string[];
}
export function percentile(values: readonly number[], fraction: number) {
  if (!values.length || values.some(n => !Number.isFinite(n) || n < 0))
    throw new Error('Missing or invalid timing samples');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}
export function median(values: readonly number[]) {
  percentile(values, 0.5); // Reject missing/nonfinite values before calculating the middle pair.
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function checkBudgets(measurement: Measurement, requireAPI = true): string[] {
  const failures: string[] = [...measurement.failures];
  if (requireAPI) {
    for (const sample of measurement.samples) {
      const api = sample.api;
      if (
        !sample.queryID ||
        !Number.isFinite(sample.activatedAt) ||
        !Number.isFinite(sample.authoritativeAt) ||
        !api?.requestID ||
        !api.structure ||
        [
          api.authMs,
          api.transformMs,
          api.requestMs,
          api.arrivalAt,
          api.responseAt,
          api.responseToAuthoritativeMs,
          api.structure.bytes,
          api.structure.queries,
          api.structure.conditions,
          api.structure.maxQueryDepth,
        ].some(value => !Number.isFinite(value) || value < 0) ||
        api.structure.bytes < 1 ||
        api.structure.queries < 1 ||
        api.structure.maxQueryDepth < 1 ||
        api.authMs > api.requestMs ||
        api.transformMs > api.requestMs ||
        api.arrivalAt < (sample.activatedAt ?? NaN) ||
        api.responseAt < api.arrivalAt ||
        api.responseAt > (sample.authoritativeAt ?? NaN) ||
        Math.abs(
          api.responseToAuthoritativeMs - ((sample.authoritativeAt ?? NaN) - api.responseAt)
        ) > 0.001
      )
        failures.push('Missing or invalid correlated Auth/API/transform timings');
    }
  }
  if (
    measurement.observedIDs.length !== REPETITIONS.materialize ||
    measurement.observedIDs.some(
      ids => JSON.stringify(ids) !== JSON.stringify(measurement.expectedIDs)
    )
  )
    failures.push('Missing or incorrect authoritative result checks');
  const plans = measurement.plans as {
    sqlite?: unknown;
    joins?: unknown;
    joinsArtifact?: unknown;
    scansByQuery?: unknown;
    readsByQuery?: unknown;
    exportMs?: unknown;
    exportMode?: unknown;
  } | null;
  const record = (value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  if (
    !plans ||
    !record(plans.sqlite) ||
    !(Array.isArray(plans.joins) || isJoinPlanArtifact(plans.joinsArtifact)) ||
    !record(plans.scansByQuery) ||
    !record(plans.readsByQuery)
  )
    failures.push('Missing query plans');
  if (
    !plans ||
    plans.exportMode !== 'separate' ||
    typeof plans.exportMs !== 'number' ||
    !Number.isFinite(plans.exportMs) ||
    plans.exportMs < 0
  )
    failures.push('Missing separate query plan export timing');
  if (measurement.relatedChecks) {
    const check = measurement.relatedChecks;
    if (
      !check.rootID ||
      check.observed.length !== REPETITIONS.materialize ||
      check.observed.some(observed => JSON.stringify(observed) !== JSON.stringify(check.expected))
    )
      failures.push('Missing or incorrect independent related-result checks');
  }
  if (
    measurement.samples.some(
      sample =>
        !sample.clientGroupID ||
        !sample.clientID ||
        !Number.isFinite(sample.connectionMs) ||
        sample.connectionMs < 0
    ) ||
    new Set(measurement.samples.map(sample => sample.clientGroupID)).size !==
      REPETITIONS.materialize
  )
    failures.push(
      'Materializations must use distinct fresh client groups with recorded connection setup'
    );
  if (measurement.samples.length !== REPETITIONS.materialize)
    failures.push(
      `Expected ${REPETITIONS.materialize} materializations, got ${measurement.samples.length}`
    );
  if (measurement.analyzeMs.length !== REPETITIONS.analyze)
    failures.push(`Expected ${REPETITIONS.analyze} analyses, got ${measurement.analyzeMs.length}`);
  try {
    if (
      percentile(
        measurement.samples.map(s => s.totalMs),
        1
      ) > BUDGETS.totalMs
    )
      failures.push(`Total exceeds ${BUDGETS.totalMs} ms`);
    if (
      percentile(
        measurement.samples.map(s => s.clientMs),
        1
      ) > BUDGETS.clientMs
    )
      failures.push(`Client exceeds ${BUDGETS.clientMs} ms`);
    if (percentile(measurement.analyzeMs, 0.95) > BUDGETS.serverP95Ms)
      failures.push(`Server p95 exceeds ${BUDGETS.serverP95Ms} ms`);
    percentile(
      measurement.samples.map(s => s.serverMs),
      1
    );
  } catch (error) {
    failures.push(String(error));
  }
  for (const key of ['readRows', 'scannedRows', 'syncedRows'] as const) {
    if (!Number.isFinite(measurement[key]) || measurement[key] < 0) failures.push(`Missing ${key}`);
  }
  const scans = (
    measurement.plans as { scansByQuery?: Record<string, Record<string, number>> } | null
  )?.scansByQuery;
  if (
    scans &&
    Object.values(scans).some(counts =>
      Object.values(counts).some(count => !Number.isFinite(count) || count < 0)
    )
  )
    failures.push('Analyzer returned unavailable or invalid scan counts');
  if (measurement.warnings.length)
    failures.push(`${measurement.warnings.length} slow-query warnings`);
  return [...new Set(failures)];
}
export function compare(base: Measurement[], head: Measurement[]) {
  const lookup = new Map(base.map(item => [item.key, item]));
  return head.flatMap(item => {
    const old = lookup.get(item.key);
    if (!old) return [];
    const issues: { key: string; metric: string; before: number; after: number; kind: string }[] =
      [];
    for (const [metric, before, after, minimum] of [
      ['server', median(old.analyzeMs), median(item.analyzeMs), 10],
      [
        'total',
        median(old.samples.map(s => s.totalMs)),
        median(item.samples.map(s => s.totalMs)),
        100,
      ],
    ] as const) {
      if (after > before * 1.2 && after - before > minimum)
        issues.push({ key: item.key, metric, before, after, kind: 'timing' });
    }
    for (const metric of ['readRows', 'scannedRows'] as const) {
      if (
        item[metric] > old[metric] &&
        (item.revision === old.revision ||
          item.revision < old.revision ||
          item.reason === old.reason)
      )
        issues.push({
          key: item.key,
          metric,
          before: old[metric],
          after: item[metric],
          kind: 'work',
        });
    }
    return issues;
  });
}
/** Absolute budget failures are still comparable; missing or incorrect telemetry is not. */
export function comparisonEligible(measurement: Measurement) {
  return checkBudgets(measurement).every(failure =>
    /^(Total exceeds \d+ ms|Client exceeds \d+ ms|Server p95 exceeds \d+ ms|\d+ slow-query warnings)$/.test(
      failure
    )
  );
}
export function confirmedRegressions(
  first: ReturnType<typeof compare>,
  second: ReturnType<typeof compare>
) {
  const confirmed = new Set(second.map(item => `${item.key}:${item.metric}`));
  return first.filter(item => confirmed.has(`${item.key}:${item.metric}`));
}
import { isJoinPlanArtifact } from './plan-artifacts';
