import { checkBudgets, type Measurement } from './metrics';
import type { Report } from './report';
import { freshGroupFailures } from './distributed-report';

export const PURE_TIMING =
  /^(Total exceeds \d+ ms|Client exceeds \d+ ms|Server materialization exceeds \d+ ms)$/;
export const workloadKey = (key: string) => key.split('/').slice(0, 2).join('/');
export function absoluteCandidates(report?: Report): Measurement[] {
  if (
    !report ||
    report.layer !== 'queries' ||
    report.infrastructure.length ||
    report.serverWarnings?.length
  )
    return [];
  return report.measurements.filter(row => {
    const failures = checkBudgets(row);
    return failures.length > 0 && failures.every(failure => PURE_TIMING.test(failure));
  });
}
export function diagnosticReservation(initialMs: number, remainingMs: number) {
  const reservedMs = Math.max(30_000, Math.ceil(initialMs * 1.5 + 10_000));
  return {
    reservedMs,
    eligible:
      Number.isFinite(initialMs) &&
      initialMs > 0 &&
      Number.isFinite(remainingMs) &&
      reservedMs + 10_000 < remainingMs,
  };
}
export function absoluteStatus(
  original: Report,
  confirmation: Report | undefined,
  candidate: Measurement
) {
  if (!confirmation)
    return { key: candidate.key, status: 'not-executed', reason: 'No confirmation report' };
  const row = confirmation.measurements.find(row => row.key === candidate.key);
  const identity = [
    'sourceSHA',
    'harnessDigest',
    'runnerID',
    'manifestDigest',
    'shardID',
    'revision',
  ] as const;
  const failures = row ? checkBudgets(row) : ['Missing candidate'];
  const invalid =
    !original.execution ||
    !confirmation.execution ||
    original.execution?.phase !== 'initial' ||
    confirmation.execution?.phase !== 'confirmation' ||
    identity.some(
      key => !original.execution?.[key] || original.execution[key] !== confirmation.execution?.[key]
    ) ||
    !row ||
    !row.execution ||
    identity.some(key => row.execution?.[key] !== confirmation.execution?.[key]) ||
    row.execution?.phase !== 'confirmation' ||
    row.revision !== candidate.revision ||
    row.reason !== candidate.reason ||
    JSON.stringify(row.args) !== JSON.stringify(candidate.args) ||
    JSON.stringify(row.expectedIDs) !== JSON.stringify(candidate.expectedIDs) ||
    confirmation.infrastructure.length > 0 ||
    Boolean(confirmation.serverWarnings?.length) ||
    failures.some(failure => !PURE_TIMING.test(failure)) ||
    confirmation.measurements.some(item =>
      checkBudgets(item).some(failure => !PURE_TIMING.test(failure))
    ) ||
    freshGroupFailures([original, confirmation]).length > 0;
  return {
    key: candidate.key,
    status: invalid ? 'invalid' : failures.length ? 'exceeded-again' : 'not-exceeded-again',
    reason: invalid
      ? 'Invalid identity, workload, results, telemetry or reused client groups'
      : 'Original gate failure remains unchanged',
    failures,
  };
}

/** Sidecar-only orchestration: optional diagnostic failure never becomes a gate failure. */
export async function confirmAbsolute(options: {
  original: Report;
  relativeSelection: string[];
  relativeConfirmation?: Report;
  initialMs: number;
  remainingMs: number;
  measure: (selection: string[], timeoutMs: number) => Promise<Report>;
}) {
  const candidates = absoluteCandidates(options.original);
  const reused = candidates.filter(row => options.relativeSelection.includes(workloadKey(row.key)));
  const extra = candidates.filter(row => !options.relativeSelection.includes(workloadKey(row.key)));
  const reservation = diagnosticReservation(options.initialMs, options.remainingMs);
  const findings: any[] = reused.map(row => ({
    ...absoluteStatus(options.original, options.relativeConfirmation, row),
    reusedRelative: true,
  }));
  if (!extra.length) return { format: 'zero-absolute-confirmation/v1', reservation, findings };
  if (!reservation.eligible) {
    findings.push(
      ...extra.map(row => ({
        key: row.key,
        status: 'not-executed',
        reason: 'Insufficient reserved runner time',
      }))
    );
  } else {
    try {
      const report = await options.measure(
        [...new Set(extra.map(row => workloadKey(row.key)))].sort(),
        reservation.reservedMs
      );
      findings.push(...extra.map(row => absoluteStatus(options.original, report, row)));
    } catch (error) {
      findings.push(
        ...extra.map(row => ({
          key: row.key,
          status: 'invalid',
          reason: `Diagnostic execution failed: ${String(error)}`,
        }))
      );
    }
  }
  return { format: 'zero-absolute-confirmation/v1', reservation, findings };
}
