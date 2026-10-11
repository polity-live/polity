import type { Measurement } from './metrics';
import { mutationBrowserFailures } from './mutation-browser-metrics';

export const QUERY_BATCH_SIZE = 20;
export const PROFILE_SUFFIXES = [
  'empty/owner',
  'minimal/owner',
  'minimal/outsider',
  'minimal/anonymous',
];

/** Fresh worker processes bound client-side resource retention; the server stack stays identical. */
export function queryBatches(keys: readonly string[], size = QUERY_BATCH_SIZE): string[][] {
  if (!Number.isSafeInteger(size) || size < 1 || new Set(keys).size !== keys.length)
    throw new Error('Invalid query batch catalog');
  return Array.from({ length: Math.ceil(keys.length / size) }, (_, index) =>
    keys.slice(index * size, (index + 1) * size)
  );
}

export function batchCoverageFailures(expected: readonly string[], measurements: Measurement[]) {
  const actual = measurements.map(row => row.key);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return [
    ...expected.filter(key => !actualSet.has(key)).map(key => `Missing worker measurement: ${key}`),
    ...actual
      .filter(key => !expectedSet.has(key))
      .map(key => `Unexpected worker measurement: ${key}`),
    ...(actualSet.size !== actual.length ? ['Duplicate worker measurements'] : []),
  ];
}

/** A failed browser budget is a recorded outcome, not an unexplained process crash. */
export function unexplainedWorkerExit(
  code: number,
  report: {
    infrastructure?: readonly string[];
    measurements: readonly Pick<Measurement, 'failures'>[];
    journeys?: readonly { failures: readonly string[] }[];
    browserMutations?: Parameters<typeof mutationBrowserFailures>[0];
  }
) {
  if (code === 0) return false;
  if (code !== 1) return true;
  return !(
    report.infrastructure?.length ||
    report.measurements.some(row => row.failures.length) ||
    report.journeys?.some(row => row.failures.length) ||
    (Array.isArray(report.journeys) &&
      report.browserMutations !== undefined &&
      report.browserMutations.length > 0 &&
      mutationBrowserFailures(report.browserMutations).length > 0)
  );
}
