import { isDeepStrictEqual } from 'node:util';
import {
  mutationFailures,
  mutationSummary,
  type MutationAttempt,
  type MutationExpectation,
  type MutationMeasurement,
} from './mutation-metrics';
import { coverageFailures } from './sharding';

export interface MutationAPIRecord {
  benchmark: 'mutation-api';
  requestID: string;
  phase: string;
  at: number;
  elapsed: number;
  identities?: { clientGroupID: string; clientID: string; mutationID: number; name: string }[];
  identity?: { clientGroupID: string; clientID: string; mutationID: number; name?: string };
  outcome?: 'committed' | 'rolled-back' | 'completed' | 'failed';
  names?: string[];
}
export function externalMutationDelivery(records: MutationAPIRecord[]) {
  const attempts = records.filter(record => record.phase === 'external-web-push');
  return {
    mode: 'deterministic-local' as const,
    configuredProviders: ['web-push'],
    usedProviders: attempts.length ? ['web-push'] : [],
    acceptedDeliveries: attempts.filter(record => record.outcome === 'completed').length,
    failedDeliveries: attempts.filter(record => record.outcome !== 'completed').length,
  };
}
/** Provider use is reconstructed from raw records, never accepted from declared metadata. */
export function externalMutationDeliveryFailures(
  expectations: MutationExpectation[],
  metadata: unknown,
  records: MutationAPIRecord[] | undefined
): string[] {
  if (!expectations.length) return [];
  if (!Array.isArray(records)) return ['Missing raw mutation external delivery diagnostics'];
  const failures: string[] = [];
  const actual = externalMutationDelivery(records);
  if (!isDeepStrictEqual(metadata, actual))
    failures.push('Missing or contradictory mutation external delivery metadata');
  for (const record of records.filter(item => item.phase === 'external-web-push')) {
    const arrival = records.filter(
      item => item.requestID === record.requestID && item.phase === 'arrival'
    );
    const response = records.filter(
      item => item.requestID === record.requestID && item.phase === 'response'
    );
    if (
      record.benchmark !== 'mutation-api' ||
      !record.requestID ||
      (record.outcome !== 'completed' && record.outcome !== 'failed') ||
      !Number.isFinite(record.at) ||
      !Number.isFinite(record.elapsed) ||
      record.elapsed < 0 ||
      arrival.length !== 1 ||
      response.length !== 1 ||
      record.at < arrival[0].at ||
      record.at > response[0].at ||
      record.elapsed > record.at - arrival[0].at + 0.1
    )
      failures.push('Invalid raw mutation external delivery diagnostics');
  }
  // A failed provider is a functional failure, independent of any performance budget.
  if (actual.failedDeliveries) failures.push('Mutation external delivery failed');
  return [...new Set(failures)];
}
export function correlateMutationAPI(rows: MutationMeasurement[], records: MutationAPIRecord[]) {
  const groups = new Map<string, MutationAPIRecord[]>();
  for (const record of records) {
    if (record.benchmark !== 'mutation-api' || typeof record.requestID !== 'string') continue;
    groups.set(record.requestID, [...(groups.get(record.requestID) ?? []), record]);
  }
  for (const row of rows)
    for (const sample of row.samples) {
      sample.attempts = [];
      delete sample.mutationID;
      if (sample.outcome === 'client-error') continue;
      const found: MutationAttempt[] = [];
      const mutationIDs = new Set<number>();
      let invalid = false;
      for (const [requestID, group] of groups) {
        const arrivals = group.filter(item => item.phase === 'arrival');
        let matching = arrivals
          .flatMap(item => item.identities ?? [])
          .filter(
            identity =>
              identity.clientID === sample.clientID &&
              identity.clientGroupID === sample.clientGroupID &&
              identity.name === row.expectation.name
          );
        if (!matching.length) continue;
        // The replicated snapshot key is independent evidence; a prior API-derived ID is not.
        const { snapshotMutationID, snapshotAppliedAt } = sample;
        if (
          matching.length > 1 &&
          typeof snapshotMutationID === 'number' &&
          Number.isSafeInteger(snapshotMutationID) &&
          snapshotMutationID > 0 &&
          typeof snapshotAppliedAt === 'number' &&
          Number.isFinite(snapshotAppliedAt) &&
          snapshotAppliedAt >= sample.startedAt
        ) {
          matching = matching.filter(identity => identity.mutationID === snapshotMutationID);
        }
        if (matching.length !== 1 || arrivals.length !== 1) {
          if (arrivals.length === 1 && new Set(matching.map(item => item.mutationID)).size > 1) {
            const failure =
              'Ambiguous same-name mutation API identities; no independently proven mutation ID';
            if (!row.failures.includes(failure)) row.failures.push(failure);
          }
          invalid = true;
          continue;
        }
        const identity = matching[0];
        mutationIDs.add(identity.mutationID);
        const one = (phase: string) => {
          const items = group.filter(item => item.phase === phase);
          return items.length === 1 ? items[0] : undefined;
        };
        const auth = one('auth'),
          response = one('response'),
          delivery = one('delivery');
        if (
          !auth ||
          !response ||
          !delivery ||
          group.some(
            item =>
              !Number.isFinite(item.at) ||
              !Number.isFinite(item.elapsed) ||
              item.elapsed < 0 ||
              item.at < arrivals[0].at ||
              item.at > response.at ||
              item.elapsed > item.at - arrivals[0].at + 0.1 ||
              (item.phase === 'external-web-push' &&
                item.outcome !== 'completed' &&
                item.outcome !== 'failed')
          ) ||
          Math.abs(response.elapsed - (response.at - arrivals[0].at)) > 0.1
        ) {
          invalid = true;
          continue;
        }
        const phases = (phase: string) =>
          group.filter(
            item =>
              item.phase === phase &&
              item.identity?.clientGroupID === identity.clientGroupID &&
              item.identity.clientID === identity.clientID &&
              item.identity.mutationID === identity.mutationID
          );
        const transactions = phases('transaction');
        if (
          !transactions.length ||
          transactions.some(item => !['committed', 'rolled-back'].includes(item.outcome ?? '')) ||
          group.some(item => {
            const phaseIdentity = item.identity;
            return (
              phaseIdentity &&
              !(arrivals[0].identities ?? []).some(
                arrival =>
                  phaseIdentity.clientGroupID === arrival.clientGroupID &&
                  phaseIdentity.clientID === arrival.clientID &&
                  phaseIdentity.mutationID === arrival.mutationID &&
                  (phaseIdentity.name === undefined || phaseIdentity.name === arrival.name)
              )
            );
          })
        ) {
          invalid = true;
          continue;
        }
        found.push({
          requestID,
          ...identity,
          authMs: auth.elapsed,
          requestMs: response.elapsed,
          deliveryMs: delivery.elapsed,
          transactionMs: transactions.map(item => item.elapsed),
          transactionOutcomes: transactions.map(
            item => item.outcome
          ) as MutationAttempt['transactionOutcomes'],
          lockMs: phases('authority-lock').map(item => item.elapsed),
          afterCommitMs: phases('after-commit').map(item => item.elapsed),
        });
      }
      if (!invalid && mutationIDs.size === 1) {
        sample.mutationID = [...mutationIDs][0];
        sample.attempts = found;
      }
    }
}

export function mutationReportFailures(
  expectations: MutationExpectation[],
  measurements: MutationMeasurement[],
  diagnostics: MutationAPIRecord[],
  absolute = true
) {
  const failures = coverageFailures(
    expectations.map(item => item.key),
    measurements.map(item => item.key)
  );
  const reconstructed = structuredClone(measurements);
  if (expectations.length) {
    const registries = diagnostics.filter(record => record.phase === 'registry');
    if (
      !registries.length ||
      registries.some(
        record => !Array.isArray(record.names) || new Set(record.names).size !== record.names.length
      )
    )
      failures.push('Missing or invalid composed server mutation registry');
    if (
      registries.length &&
      registries.some(record => !isDeepStrictEqual(record.names, registries[0].names))
    )
      failures.push('Contradictory composed server mutation registries');
    const registryNames = registries[0]?.names;
    if (registryNames && expectations.some(entry => !registryNames.includes(entry.name)))
      failures.push('Mutation absent from composed server registry');
  }
  correlateMutationAPI(reconstructed, diagnostics);
  for (let index = 0; index < measurements.length; index++) {
    const row = measurements[index];
    for (const sample of row.samples)
      if (
        sample.outcome === 'client-error' &&
        diagnostics.some(
          record =>
            record.phase === 'arrival' &&
            record.identities?.some(
              identity =>
                identity.clientID === sample.clientID &&
                identity.clientGroupID === sample.clientGroupID &&
                identity.name === row.expectation.name
            )
        )
      )
        failures.push(`${row.key}: Client rejection reached mutation API`);
    if (
      !isDeepStrictEqual(
        row.expectation,
        expectations.find(item => item.key === row.key)
      )
    )
      failures.push(`${row.key}: Changed mutation expectation`);
    if (
      !isDeepStrictEqual(
        row.samples.map(sample => ({ mutationID: sample.mutationID, attempts: sample.attempts })),
        reconstructed[index].samples.map(sample => ({
          mutationID: sample.mutationID,
          attempts: sample.attempts,
        }))
      )
    )
      failures.push(`${row.key}: Mutation API correlation does not match raw diagnostics`);
    failures.push(...mutationFailures(row, absolute).map(failure => `${row.key}: ${failure}`));
  }
  return [...new Set(failures)];
}
export function mutationResultsCSV(rows: MutationMeasurement[]) {
  const summaries = rows.map(mutationSummary);
  const columns = [
    'key',
    'clientApplyMaxMs',
    'clientApplyMedianMs',
    'serverConfirmedMaxMs',
    'serverConfirmedMedianMs',
    'observerAfterConfirmMaxMs',
    'observerAfterConfirmMedianMs',
    'observerTotalMaxMs',
    'observerTotalMedianMs',
    'observerException',
    'failures',
  ];
  const cell = (value: unknown) => `"${String(value ?? 'missing').replaceAll('"', '""')}"`;
  return (
    [
      columns.join(','),
      ...rows.map((row, index) =>
        columns
          .map(column =>
            cell(
              column === 'failures'
                ? row.failures.join('; ')
                : column === 'observerException'
                  ? 'reason' in row.expectation.observer
                    ? row.expectation.observer.reason
                    : ''
                  : summaries[index][column]
            )
          )
          .join(',')
      ),
    ].join('\n') + '\n'
  );
}
