import { median } from './metrics';
import type { Execution } from './sharding';

export const MUTATION_BUDGETS = Object.freeze({
  clientApplyMs: 50,
  serverConfirmedMs: 1_000,
  observerAfterConfirmMs: 1_000,
});
export type MutationOutcome = 'success' | 'server-error' | 'client-error';
export interface MutationExpectation {
  key: string;
  name: string;
  variant: string;
  actor: string;
  outcome: MutationOutcome;
  error?: string;
  observer: { query: string } | { reason: string };
  oracleDigest: string;
}
export interface MutationAttempt {
  requestID: string;
  clientGroupID: string;
  clientID: string;
  mutationID: number;
  name: string;
  authMs: number;
  requestMs: number;
  transactionMs: number[];
  transactionOutcomes: ('committed' | 'rolled-back')[];
  lockMs: number[];
  afterCommitMs: number[];
  deliveryMs: number;
}
export interface MutationSample {
  clientGroupID: string;
  clientID: string;
  observerGroupID?: string;
  observerClientID?: string;
  mutationID?: number;
  snapshotMutationID?: number;
  snapshotAppliedAt?: number;
  startedAt: number;
  clientAppliedAt: number;
  confirmedAt?: number;
  observedAt?: number;
  clientApplyMs: number;
  serverConfirmedMs?: number;
  observerAfterConfirmMs?: number;
  observerTotalMs?: number;
  outcome: MutationOutcome;
  error?: string;
  databaseVerified: boolean;
  rollbackVerified: boolean;
  restored: boolean;
  attempts: MutationAttempt[];
}
export interface MutationMeasurement {
  /** Full case wall time, including fixture/setup/cleanup, for scheduling only. */
  elapsedMs?: number;
  execution?: Execution;
  expectation: MutationExpectation;
  key: string;
  samples: MutationSample[];
  failures: string[];
}
const valid = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function mutationFailures(row: MutationMeasurement, absolute = true): string[] {
  const failures = row.failures.filter(
    failure =>
      absolute ||
      !/^Mutation (client apply exceeds 50 ms|server confirmation exceeds 1000 ms|observer exceeds 1000 ms after confirmation)$/.test(
        failure
      )
  );
  const expected = row.expectation;
  if (
    !expected ||
    row.key !== expected.key ||
    !expected.oracleDigest ||
    !/^[a-f0-9]{64}$/.test(expected.oracleDigest)
  )
    return [...failures, 'Invalid mutation expectation'];
  if (
    !expected.observer ||
    ('reason' in expected.observer && !expected.observer.reason.trim()) ||
    ('query' in expected.observer && !expected.observer.query.trim())
  )
    failures.push('Invalid observer declaration');
  if (row.samples.length !== 5) failures.push('Expected five mutation samples');
  const clients = new Set<string>();
  const clientIDs = new Set<string>();
  for (const sample of row.samples) {
    if (
      !sample.clientID ||
      !sample.clientGroupID ||
      clients.has(sample.clientGroupID) ||
      clientIDs.has(sample.clientID)
    )
      failures.push('Missing or reused mutation client group');
    clients.add(sample.clientGroupID);
    clientIDs.add(sample.clientID);
    if (
      !sample.observerClientID ||
      !sample.observerGroupID ||
      clientIDs.has(sample.observerClientID) ||
      clients.has(sample.observerGroupID)
    )
      failures.push('Missing or reused independent observer');
    if (sample.observerGroupID) clients.add(sample.observerGroupID);
    if (sample.observerClientID) clientIDs.add(sample.observerClientID);
    if (sample.outcome !== expected.outcome || sample.error !== expected.error)
      failures.push('Unexpected mutation outcome');
    for (const field of ['startedAt', 'clientAppliedAt', 'clientApplyMs'] as const)
      if (!valid(sample[field])) failures.push(`Missing or invalid ${field}`);
    if (
      valid(sample.clientAppliedAt) &&
      valid(sample.startedAt) &&
      (sample.clientAppliedAt < sample.startedAt ||
        Math.abs(sample.clientApplyMs - (sample.clientAppliedAt - sample.startedAt)) > 0.01)
    )
      failures.push('Client timing does not match raw events');
    if (absolute && sample.clientApplyMs > MUTATION_BUDGETS.clientApplyMs)
      failures.push('Mutation client apply exceeds 50 ms');
    if (!sample.databaseVerified || !sample.rollbackVerified || !sample.restored)
      failures.push('Missing mutation state, rollback or restoration proof');
    if (expected.outcome === 'client-error') {
      if (
        sample.attempts.length ||
        sample.confirmedAt !== undefined ||
        sample.serverConfirmedMs !== undefined ||
        sample.snapshotMutationID !== undefined ||
        sample.snapshotAppliedAt !== undefined
      )
        failures.push('Client rejection unexpectedly reached server');
      continue;
    }
    if (
      !valid(sample.confirmedAt) ||
      !valid(sample.serverConfirmedMs) ||
      (sample.confirmedAt ?? NaN) < sample.startedAt ||
      Math.abs(
        (sample.serverConfirmedMs ?? NaN) - ((sample.confirmedAt ?? NaN) - sample.startedAt)
      ) > 0.01
    )
      failures.push('Missing or invalid server confirmation timing');
    if (absolute && (sample.serverConfirmedMs ?? NaN) > MUTATION_BUDGETS.serverConfirmedMs)
      failures.push('Mutation server confirmation exceeds 1000 ms');
    if (
      !Number.isSafeInteger(sample.mutationID) ||
      (sample.mutationID ?? NaN) < 1 ||
      !sample.attempts.length
    )
      failures.push('Missing mutation API correlation');
    // Zero persists replicated mutation-response markers for server rejections.
    // Successful responses may omit a marker; their observer, SQL and API proofs remain required.
    const needsSnapshotProof =
      expected.outcome === 'server-error' ||
      sample.snapshotMutationID !== undefined ||
      sample.snapshotAppliedAt !== undefined;
    if (
      needsSnapshotProof &&
      (!Number.isSafeInteger(sample.snapshotMutationID) ||
        (sample.snapshotMutationID ?? NaN) < 1 ||
        sample.snapshotMutationID !== sample.mutationID ||
        !valid(sample.snapshotAppliedAt) ||
        (sample.snapshotAppliedAt ?? NaN) < sample.startedAt)
    )
      failures.push('Missing or invalid replicated mutation snapshot proof');
    const requestIDs = new Set<string>();
    for (const attempt of sample.attempts) {
      if (
        !attempt.requestID ||
        requestIDs.has(attempt.requestID) ||
        attempt.clientGroupID !== sample.clientGroupID ||
        attempt.clientID !== sample.clientID ||
        attempt.mutationID !== sample.mutationID ||
        attempt.name !== expected.name
      )
        failures.push('Invalid mutation API identity');
      requestIDs.add(attempt.requestID);
      if (
        ![
          attempt.authMs,
          attempt.requestMs,
          attempt.deliveryMs,
          ...attempt.transactionMs,
          ...attempt.lockMs,
          ...attempt.afterCommitMs,
        ].every(valid) ||
        attempt.authMs > attempt.requestMs ||
        attempt.deliveryMs > attempt.requestMs ||
        [...attempt.transactionMs, ...attempt.lockMs, ...attempt.afterCommitMs].some(
          duration => duration > attempt.requestMs + 0.1
        ) ||
        attempt.transactionMs.length !== attempt.transactionOutcomes.length ||
        attempt.transactionOutcomes.some(value => !['committed', 'rolled-back'].includes(value))
      )
        failures.push('Invalid mutation server diagnostics');
    }
    if ('query' in expected.observer) {
      if (
        !valid(sample.observedAt) ||
        !valid(sample.observerAfterConfirmMs) ||
        !valid(sample.observerTotalMs) ||
        (sample.observedAt ?? NaN) < sample.startedAt ||
        Math.abs(
          (sample.observerTotalMs ?? NaN) - ((sample.observedAt ?? NaN) - sample.startedAt)
        ) > 0.01 ||
        Math.abs(
          (sample.observerAfterConfirmMs ?? NaN) -
            Math.max(0, (sample.observedAt ?? NaN) - (sample.confirmedAt ?? NaN))
        ) > 0.01
      )
        failures.push('Missing or invalid observer timing');
      if (
        absolute &&
        (sample.observerAfterConfirmMs ?? NaN) > MUTATION_BUDGETS.observerAfterConfirmMs
      )
        failures.push('Mutation observer exceeds 1000 ms after confirmation');
    } else if (
      sample.observedAt !== undefined ||
      sample.observerAfterConfirmMs !== undefined ||
      sample.observerTotalMs !== undefined
    )
      failures.push('Unexpected observer timing');
  }
  return [...new Set(failures)];
}
export function mutationSummary(row: MutationMeasurement) {
  const summary: Record<string, number | string | undefined> = { key: row.key };
  for (const field of [
    'clientApplyMs',
    'serverConfirmedMs',
    'observerAfterConfirmMs',
    'observerTotalMs',
  ] as const) {
    const values = row.samples.map(sample => sample[field]);
    if (values.length === 5 && values.every(valid)) {
      summary[`${field.replace(/Ms$/, '')}MaxMs`] = Math.max(...values);
      summary[`${field.replace(/Ms$/, '')}MedianMs`] = median(values);
    }
  }
  return summary;
}
export interface MutationRegression {
  key: string;
  reasons: string[];
  changes: { key: string; metric: string; before: number; after: number; kind: string }[];
}
export function compareMutations(
  base: MutationMeasurement[],
  head: MutationMeasurement[]
): MutationRegression[] {
  return head.flatMap(row => {
    const old = base.find(item => item.key === row.key);
    if (
      !old ||
      old.expectation.oracleDigest !== row.expectation.oracleDigest ||
      mutationFailures(old, false).length ||
      mutationFailures(row, false).length
    )
      return [];
    const reasons: string[] = [];
    const changes: MutationRegression['changes'] = [];
    for (const field of ['clientApplyMs', 'serverConfirmedMs', 'observerAfterConfirmMs'] as const) {
      const oldValues = old.samples.map(sample => sample[field]);
      const newValues = row.samples.map(sample => sample[field]);
      if (!oldValues.every(valid) || !newValues.every(valid)) continue;
      const before = median(oldValues);
      const after = median(newValues);
      const threshold = field === 'clientApplyMs' ? 10 : 100;
      if (after > before * 1.2 && after - before > threshold) {
        reasons.push(`${field} regression`);
        changes.push({ key: row.key, metric: field, before, after, kind: 'timing' });
      }
    }
    return reasons.length ? [{ key: row.key, reasons, changes }] : [];
  });
}
