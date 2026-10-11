import { isDeepStrictEqual } from 'node:util';
import { compareMutations, mutationFailures } from './mutation-metrics';
import { externalMutationDeliveryFailures, mutationReportFailures } from './mutation-report';
import { checkBudgets, compare, comparisonEligible, confirmedRegressions } from './metrics';
import {
  correlateQueryAPI,
  isAbsoluteBudgetFailure,
  MEASUREMENT_PROTOCOL,
  REPORT_FORMAT,
  serverWarningFailures,
  type Report,
} from './report';
import {
  coverageFailures,
  executionFailures,
  PROFILE_KEYS,
  isMutationKey,
  type Execution,
  type Manifest,
  type Revision,
  type Shard,
} from './sharding';

export function shardMeasurementKeys(shard: Shard, revision: Revision, selected = shard[revision]) {
  return shard.layer === 'queries'
    ? selected.flatMap(key =>
        isMutationKey(key) ? [key] : PROFILE_KEYS.map(profile => `${key}/${profile}`)
      )
    : shard.layer === 'security'
      ? selected
      : [];
}
export function partialReportFailures(
  report: Report,
  manifest: Manifest,
  shard: Shard,
  revision: Revision,
  phase: Execution['phase'],
  runnerID: string,
  selected = shard[revision]
) {
  const absolute = revision === 'head';
  const failures = executionFailures(report.execution, manifest, shard, revision, phase, runnerID);
  if (
    report.format !== REPORT_FORMAT ||
    report.protocol !== MEASUREMENT_PROTOCOL ||
    report.layer !== shard.layer
  )
    failures.push('Invalid shard report protocol/layer');
  failures.push(
    ...coverageFailures(shardMeasurementKeys(shard, revision, selected), [
      ...report.measurements.map(item => item.key),
      ...(report.mutations ?? []).map(item => item.key),
    ])
  );
  const expectedMutations =
    manifest.workloads[revision]?.mutations.filter(
      entry => shard.layer === 'queries' && selected.includes(entry.key)
    ) ?? [];
  if (!isDeepStrictEqual(report.expectedMutations, expectedMutations))
    failures.push('Changed shard mutation expectations');
  failures.push(
    ...externalMutationDeliveryFailures(
      expectedMutations,
      report.externalDelivery,
      report.mutationDiagnostics
    )
  );
  if (!Array.isArray(report.mutations) || !Array.isArray(report.mutationDiagnostics))
    failures.push('Missing mutation measurements or raw diagnostics');
  else {
    failures.push(
      ...mutationReportFailures(
        expectedMutations,
        report.mutations,
        report.mutationDiagnostics,
        absolute
      )
    );
    for (const row of report.mutations)
      failures.push(
        ...executionFailures(row.execution, manifest, shard, revision, phase, runnerID).map(
          failure => `${row.key}: ${failure}`
        )
      );
  }
  failures.push(
    ...report.infrastructure.filter(failure => absolute || !isAbsoluteBudgetFailure(failure)),
    ...serverWarningFailures(report, absolute)
  );
  if (!Array.isArray(report.apiDiagnostics)) failures.push('Missing raw API diagnostics');
  else {
    const reconstructed = report.measurements.map(item => ({
      ...item,
      samples: item.samples.map(sample => ({ ...sample })),
    }));
    correlateQueryAPI(reconstructed, report.apiDiagnostics);
    for (let index = 0; index < reconstructed.length; index++)
      if (
        !isDeepStrictEqual(
          reconstructed[index].samples.map(sample => sample.api),
          report.measurements[index].samples.map(sample => sample.api)
        )
      )
        failures.push(
          `${reconstructed[index].key}: API correlation does not match raw diagnostics`
        );
  }
  for (const measurement of report.measurements) {
    failures.push(
      ...executionFailures(measurement.execution, manifest, shard, revision, phase, runnerID).map(
        failure => `${measurement.key}: ${failure}`
      )
    );
    failures.push(
      ...checkBudgets(measurement)
        .filter(failure => absolute || !isAbsoluteBudgetFailure(failure))
        .map(failure => `${measurement.key}: ${failure}`)
    );
  }
  if (shard.layer === 'security') {
    const expected =
      manifest.workloads[revision]?.security.filter(entry => selected.includes(entry.key)) ?? [];
    if (!isDeepStrictEqual(report.expectedSecurityCases, expected))
      failures.push('Changed shard security expectations');
    for (const entry of expected) {
      const measurement = report.measurements.find(item => item.key === entry.key);
      if (
        measurement &&
        (!isDeepStrictEqual(measurement.expectedIDs, entry.expectedIDs) ||
          !isDeepStrictEqual(
            measurement.relatedChecks && {
              rootID: measurement.relatedChecks.rootID,
              relations: measurement.relatedChecks.expected,
            },
            entry.related
          ))
      )
        failures.push(`${entry.key}: Changed independent security result expectations`);
    }
  }
  if (shard.layer === 'queries' && phase === 'initial') {
    const preflight = report.fixturePreflight;
    if (
      !preflight ||
      coverageFailures(
        selected.filter(key => !isMutationKey(key)),
        preflight.expected
      ).length ||
      coverageFailures(
        selected.filter(key => !isMutationKey(key)),
        preflight.completed
      ).length ||
      preflight.failures.length
    )
      failures.push('Missing, incomplete or failed fixture preflight');
  }
  return [...new Set(failures)];
}
export function comparisons(base?: Report, head?: Report) {
  return base && head
    ? [
        ...compare(
          base.measurements.filter(comparisonEligible),
          head.measurements.filter(comparisonEligible)
        ),
        ...compareMutations(base.mutations ?? [], head.mutations ?? []).flatMap(
          change => change.changes
        ),
      ]
    : [];
}
export function freshGroupFailures(reports: Report[]) {
  const groups = new Set<string>();
  const correlations = new Set<string>();
  const failures: string[] = [];
  for (const report of reports)
    for (const measurement of report.measurements)
      for (const sample of measurement.samples) {
        if (
          groups.has(sample.clientGroupID) ||
          (sample.clientCorrelationID && correlations.has(sample.clientCorrelationID))
        )
          failures.push(
            `${measurement.key}: Reused client group or API correlation across measurements`
          );
        groups.add(sample.clientGroupID);
        if (sample.clientCorrelationID) correlations.add(sample.clientCorrelationID);
      }
  for (const report of reports)
    for (const row of report.mutations ?? [])
      for (const sample of row.samples)
        for (const group of [sample.clientGroupID, sample.observerGroupID].filter(
          (value): value is string => !!value
        )) {
          if (groups.has(group))
            failures.push(`${row.key}: Reused client group across measurements`);
          groups.add(group);
        }
  return [...new Set(failures)];
}
export function confirmationSelection(shard: Shard, first: ReturnType<typeof compare>) {
  const keys = new Set(
    first.map(change =>
      shard.layer === 'queries' && !isMutationKey(change.key)
        ? change.key.split('/').slice(0, 2).join('/')
        : change.key
    )
  );
  return [...keys].sort();
}
export function confirmationFailures(
  first: ReturnType<typeof compare>,
  second: ReturnType<typeof compare>,
  expected: string[],
  base?: Report,
  head?: Report
) {
  if (!first.length) return [];
  if (
    !base ||
    !head ||
    coverageFailures(expected, [
      ...base.measurements.map(item => item.key),
      ...(base.mutations ?? []).map(item => item.key),
    ]).length ||
    coverageFailures(expected, [
      ...head.measurements.map(item => item.key),
      ...(head.mutations ?? []).map(item => item.key),
    ]).length
  )
    return ['Missing or incomplete regression confirmation'];
  // A non-comparable second sample is an error, not evidence that a regression disappeared.
  if (
    expected.some(key =>
      isMutationKey(key)
        ? !base.mutations?.some(
            item => item.key === key && !mutationFailures(item, false).length
          ) ||
          !head.mutations?.some(item => item.key === key && !mutationFailures(item, false).length)
        : !base.measurements.some(item => item.key === key && comparisonEligible(item)) ||
          !head.measurements.some(item => item.key === key && comparisonEligible(item))
    )
  )
    return ['Invalid regression confirmation telemetry/results'];
  return confirmedRegressions(first, second).map(
    change => `Confirmed regression: ${change.key}/${change.metric}`
  );
}
