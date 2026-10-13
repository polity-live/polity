import { checkBudgets, type Measurement } from './metrics';
import { serverWarningFailures, type Report } from './report';
import { isDeepStrictEqual } from 'node:util';
import { freshGroupFailures } from './distributed-report';

export const PURE_TIMING =
  /^(Total exceeds \d+ ms|Client exceeds \d+ ms|Server materialization exceeds \d+ ms)$/;
export const workloadKey = (key: string) => key.split('/').slice(0, 2).join('/');
const diagnosticTimingFailure = (failure: string) =>
  PURE_TIMING.test(failure) || /^\d+ slow-query warnings$/.test(failure);
const selectionKey = (report: Report, key: string) =>
  report.layer === 'security' ? key : workloadKey(key);
export function warningEvidence(report: Report, row: Measurement) {
  return (report.serverWarnings ?? []).filter(line => {
    try {
      const warning = JSON.parse(line);
      return (
        warning.queryName === row.name &&
        row.samples.some(sample => sample.clientGroupID === warning.clientGroupID)
      );
    } catch {
      return false;
    }
  });
}
export function absoluteCandidates(report?: Report): Measurement[] {
  if (
    !report ||
    !['queries', 'security'].includes(report.layer) ||
    report.infrastructure.length ||
    serverWarningFailures(report, false).length
  )
    return [];
  return report.measurements.filter(row => {
    const failures = checkBudgets(row);
    const expectation = (report.expectedSecurityCases ?? []).find(item => item.key === row.key);
    if (
      report.layer === 'security' &&
      (!expectation ||
        !isDeepStrictEqual(expectation.expectedIDs, row.expectedIDs) ||
        (expectation.related &&
          !isDeepStrictEqual(
            expectation.related,
            row.relatedChecks && {
              rootID: row.relatedChecks.rootID,
              relations: row.relatedChecks.expected,
            }
          )))
    )
      return false;
    return (
      (failures.length > 0 || warningEvidence(report, row).length > 0) &&
      failures.every(diagnosticTimingFailure)
    );
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
    !isDeepStrictEqual(row.args, candidate.args) ||
    !isDeepStrictEqual(row.expectedIDs, candidate.expectedIDs) ||
    !isDeepStrictEqual(row.relatedChecks?.expected, candidate.relatedChecks?.expected) ||
    row.relatedChecks?.rootID !== candidate.relatedChecks?.rootID ||
    original.layer !== confirmation.layer ||
    (original.layer === 'security' &&
      !isDeepStrictEqual(
        (original.expectedSecurityCases ?? []).find(item => item.key === candidate.key),
        (confirmation.expectedSecurityCases ?? []).find(item => item.key === candidate.key)
      )) ||
    confirmation.infrastructure.length > 0 ||
    serverWarningFailures(confirmation, false).length > 0 ||
    failures.some(failure => !diagnosticTimingFailure(failure)) ||
    confirmation.measurements.some(item =>
      checkBudgets(item).some(failure => !diagnosticTimingFailure(failure))
    ) ||
    freshGroupFailures([original, confirmation]).length > 0;
  return {
    key: candidate.key,
    status: invalid ? 'invalid' : failures.length ? 'exceeded-again' : 'not-exceeded-again',
    reason: invalid
      ? 'Invalid identity, workload, results, telemetry or reused client groups'
      : 'Original gate failure remains unchanged',
    failures,
    originalWarnings: warningEvidence(original, candidate),
    confirmationWarnings: row ? warningEvidence(confirmation, row) : [],
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
  const reused = candidates.filter(row =>
    options.relativeSelection.includes(selectionKey(options.original, row.key))
  );
  const extra = candidates.filter(
    row => !options.relativeSelection.includes(selectionKey(options.original, row.key))
  );
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
        [...new Set(extra.map(row => selectionKey(options.original, row.key)))].sort(),
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
