import { describe, expect, it } from 'vitest';
import {
  compareMutations,
  mutationFailures,
  mutationSummary,
  type MutationMeasurement,
} from '../mutation-metrics';
import {
  correlateMutationAPI,
  externalMutationDelivery,
  externalMutationDeliveryFailures,
  mutationReportFailures,
  type MutationAPIRecord,
} from '../mutation-report';

function measurement(): MutationMeasurement {
  return {
    key: 'mutation/users.updateProfile/update/owner',
    expectation: {
      key: 'mutation/users.updateProfile/update/owner',
      name: 'users.updateProfile',
      variant: 'update',
      actor: 'owner',
      outcome: 'success',
      observer: { query: 'users.byId' },
      oracleDigest: 'a'.repeat(64),
    },
    failures: [],
    samples: Array.from({ length: 5 }, (_, index) => ({
      clientID: `writer-${index}`,
      clientGroupID: `writers-${index}`,
      mutationID: 1,
      observerClientID: `reader-${index}`,
      observerGroupID: `readers-${index}`,
      startedAt: 10,
      clientAppliedAt: 20,
      confirmedAt: 40,
      observedAt: 50,
      snapshotMutationID: 1,
      snapshotAppliedAt: 40,
      clientApplyMs: 10,
      serverConfirmedMs: 30,
      observerTotalMs: 40,
      observerAfterConfirmMs: 10,
      outcome: 'success',
      databaseVerified: true,
      rollbackVerified: true,
      restored: true,
      attempts: [
        {
          requestID: `request-${index}`,
          clientID: `writer-${index}`,
          clientGroupID: `writers-${index}`,
          mutationID: 1,
          name: 'users.updateProfile',
          authMs: 1,
          requestMs: 20,
          deliveryMs: 1,
          transactionMs: [8],
          transactionOutcomes: ['committed'],
          lockMs: [1],
          afterCommitMs: [2],
        },
      ],
    })),
  };
}
function api(row: MutationMeasurement): MutationAPIRecord[] {
  return row.samples.flatMap(sample => {
    const requestID = sample.attempts[0].requestID;
    const identity = {
      clientID: sample.clientID,
      clientGroupID: sample.clientGroupID,
      name: row.expectation.name,
      mutationID: 1,
    };
    return [
      {
        benchmark: 'mutation-api',
        requestID,
        phase: 'arrival',
        at: 100,
        elapsed: 0,
        identities: [identity],
      },
      { benchmark: 'mutation-api', requestID, phase: 'auth', at: 101, elapsed: 1 },
      {
        benchmark: 'mutation-api',
        requestID,
        phase: 'transaction',
        at: 110,
        elapsed: 8,
        identity,
        outcome: 'committed',
      },
      {
        benchmark: 'mutation-api',
        requestID,
        phase: 'authority-lock',
        at: 103,
        elapsed: 1,
        identity,
      },
      {
        benchmark: 'mutation-api',
        requestID,
        phase: 'after-commit',
        at: 112,
        elapsed: 2,
        identity,
      },
      { benchmark: 'mutation-api', requestID, phase: 'delivery', at: 114, elapsed: 1 },
      { benchmark: 'mutation-api', requestID, phase: 'response', at: 120, elapsed: 20 },
      {
        benchmark: 'mutation-api',
        requestID,
        phase: 'registry',
        at: 100,
        elapsed: 0,
        names: [row.expectation.name],
      },
    ];
  });
}
describe('mutation performance budgets', () => {
  it('passes inclusive boundaries', () => {
    const row = measurement();
    for (const sample of row.samples)
      Object.assign(sample, {
        clientAppliedAt: 60,
        clientApplyMs: 50,
        confirmedAt: 1010,
        serverConfirmedMs: 1000,
        observedAt: 2010,
        observerAfterConfirmMs: 1000,
        observerTotalMs: 2000,
      });
    expect(mutationFailures(row)).toEqual([]);
    expect(mutationSummary(row).serverConfirmedMaxMs).toBe(1000);
  });
  it.each(['missing', 'different-id', 'before-start', 'non-finite'])(
    'rejects %s replicated snapshot proof',
    variant => {
      const row = measurement(),
        sample = row.samples[0];
      row.expectation.outcome = 'server-error';
      for (const value of row.samples) value.outcome = 'server-error';
      if (variant === 'missing') delete sample.snapshotAppliedAt;
      if (variant === 'different-id') sample.snapshotMutationID = 2;
      if (variant === 'before-start') sample.snapshotAppliedAt = 9;
      if (variant === 'non-finite') sample.snapshotAppliedAt = Infinity;
      expect(mutationFailures(row)).toContain(
        'Missing or invalid replicated mutation snapshot proof'
      );
    }
  );
  it('accepts genuine successes without replicated response markers and validates optional markers', () => {
    const row = measurement();
    for (const sample of row.samples) {
      delete sample.snapshotAppliedAt;
      delete sample.snapshotMutationID;
    }
    expect(mutationFailures(row)).toEqual([]);
    row.samples[0].snapshotMutationID = 2;
    row.samples[0].snapshotAppliedAt = 40;
    expect(mutationFailures(row)).toContain(
      'Missing or invalid replicated mutation snapshot proof'
    );
  });
  it('requires both marker fields for server rejection rollback proof', () => {
    const row = measurement();
    row.expectation.outcome = 'server-error';
    for (const sample of row.samples) {
      sample.outcome = 'server-error';
      delete sample.snapshotAppliedAt;
      delete sample.snapshotMutationID;
    }
    expect(mutationFailures(row)).toContain(
      'Missing or invalid replicated mutation snapshot proof'
    );
  });
  it('requires client rejections to omit server and snapshot evidence', () => {
    const row = measurement();
    row.expectation.outcome = 'client-error';
    for (const sample of row.samples) {
      sample.outcome = 'client-error';
      sample.attempts = [];
      delete sample.confirmedAt;
      delete sample.serverConfirmedMs;
      delete sample.snapshotAppliedAt;
      delete sample.snapshotMutationID;
    }
    expect(mutationFailures(row)).toEqual([]);
    row.samples[0].snapshotAppliedAt = 40;
    expect(mutationFailures(row)).toContain('Client rejection unexpectedly reached server');
  });
  it.each(['client-error', 'no-query'] as const)(
    'requires fresh independent identities for %s samples',
    variant => {
      const row = measurement();
      if (variant === 'client-error') {
        row.expectation.outcome = 'client-error';
        for (const sample of row.samples) {
          sample.outcome = 'client-error';
          sample.attempts = [];
          delete sample.confirmedAt;
          delete sample.serverConfirmedMs;
          delete sample.snapshotAppliedAt;
          delete sample.snapshotMutationID;
        }
      } else {
        row.expectation.observer = {
          reason: 'No public query exposes this state; independent SQL oracle applies',
        };
        for (const sample of row.samples) {
          delete sample.observedAt;
          delete sample.observerAfterConfirmMs;
          delete sample.observerTotalMs;
        }
      }
      expect(mutationFailures(row)).toEqual([]);
      const reusedObserver = structuredClone(row);
      reusedObserver.samples[1].observerGroupID = reusedObserver.samples[0].observerGroupID;
      expect(mutationFailures(reusedObserver)).toContain('Missing or reused independent observer');
      const reusedObserverID = structuredClone(row);
      reusedObserverID.samples[1].observerClientID = reusedObserverID.samples[0].observerClientID;
      expect(mutationFailures(reusedObserverID)).toContain(
        'Missing or reused independent observer'
      );
      const sharedGroup = structuredClone(row);
      sharedGroup.samples[0].observerGroupID = sharedGroup.samples[0].clientGroupID;
      expect(mutationFailures(sharedGroup)).toContain('Missing or reused independent observer');
      const reusedWriter = structuredClone(row);
      reusedWriter.samples[1].clientGroupID = reusedWriter.samples[0].observerGroupID!;
      expect(mutationFailures(reusedWriter)).toContain('Missing or reused mutation client group');
      const missing = structuredClone(row);
      delete missing.samples[0].observerClientID;
      expect(mutationFailures(missing)).toContain('Missing or reused independent observer');
    }
  );
  it.each(['clientApplyMs', 'serverConfirmedMs', 'observerAfterConfirmMs'] as const)(
    'rejects one slow %s sample',
    field => {
      const row = measurement(),
        sample = row.samples[3];
      if (field === 'clientApplyMs')
        Object.assign(sample, { clientApplyMs: 51, clientAppliedAt: 61 });
      if (field === 'serverConfirmedMs')
        Object.assign(sample, {
          serverConfirmedMs: 1001,
          confirmedAt: 1011,
          observedAt: 1021,
          observerTotalMs: 1011,
        });
      if (field === 'observerAfterConfirmMs')
        Object.assign(sample, {
          observerAfterConfirmMs: 1001,
          observerTotalMs: 1031,
          observedAt: 1041,
        });
      expect(mutationFailures(row).some(value => value.includes('exceeds'))).toBe(true);
    }
  );
  it.each([undefined, -1, Infinity, NaN])('rejects invalid timing %s', value => {
    const row = measurement();
    row.samples[0].serverConfirmedMs = value;
    expect(mutationFailures(row).length).toBeGreaterThan(0);
  });
  it('accepts an observer result that arrived before confirmation', () => {
    const row = measurement();
    Object.assign(row.samples[0], {
      observedAt: 35,
      observerTotalMs: 25,
      observerAfterConfirmMs: 0,
    });
    expect(mutationFailures(row)).toEqual([]);
  });
  it('does not turn internal server diagnostic changes into regressions', () => {
    const before = measurement(),
      after = measurement();
    for (const sample of after.samples) {
      sample.attempts[0].requestMs = 900;
      sample.attempts[0].transactionMs = [800];
    }
    expect(compareMutations([before], [after])).toEqual([]);
  });
  it('requires both relative and absolute user-time increases', () => {
    const before = measurement(),
      after = measurement();
    for (const sample of after.samples)
      Object.assign(sample, {
        confirmedAt: 141,
        serverConfirmedMs: 131,
        observedAt: 151,
        observerTotalMs: 141,
      });
    expect(compareMutations([before], [after])[0].reasons).toEqual([
      'serverConfirmedMs regression',
    ]);
  });
  it('rejects missing state proof, a reused observer and unexplained observer exemptions', () => {
    const row = measurement();
    row.samples[0].databaseVerified = false;
    row.samples[0].observerGroupID = row.samples[0].clientGroupID;
    row.expectation.observer = { reason: '' };
    expect(mutationFailures(row).length).toBeGreaterThan(2);
  });
});
describe('mutation raw API reconciliation', () => {
  it('fails closed on absent or contradictory external delivery metadata', () => {
    const row = measurement(),
      records = api(row),
      actual = externalMutationDelivery(records);
    expect(externalMutationDeliveryFailures([row.expectation], actual, records)).toEqual([]);
    for (const declared of [
      undefined,
      { ...actual, mode: 'live' },
      { ...actual, usedProviders: ['web-push'] },
      { ...actual, acceptedDeliveries: 1 },
      { ...actual, configuredProviders: [] },
      { ...actual, failedDeliveries: -1 },
    ]) {
      expect(externalMutationDeliveryFailures([row.expectation], declared, records)).toContain(
        'Missing or contradictory mutation external delivery metadata'
      );
    }
    expect(externalMutationDeliveryFailures([row.expectation], actual, undefined)).toContain(
      'Missing raw mutation external delivery diagnostics'
    );
    expect(externalMutationDeliveryFailures([], undefined, undefined)).toEqual([]);
  });
  it('treats provider failure as a functional error even when declared counts match', () => {
    const row = measurement(),
      records = api(row);
    records.push({
      ...records[6],
      phase: 'external-web-push',
      at: 113,
      elapsed: 1,
      outcome: 'failed',
    });
    expect(
      externalMutationDeliveryFailures(
        [row.expectation],
        externalMutationDelivery(records),
        records
      )
    ).toEqual(['Mutation external delivery failed']);
    const provider = records.at(-1);
    if (!provider) throw new Error('Missing provider fixture');
    provider.requestID = 'unrelated-request';
    expect(
      externalMutationDeliveryFailures(
        [row.expectation],
        externalMutationDelivery(records),
        records
      )
    ).toContain('Invalid raw mutation external delivery diagnostics');
  });
  it('reconstructs deterministic provider mode, use and delivery counts from raw provider phases', () => {
    const row = measurement(),
      records = api(row);
    expect(externalMutationDelivery(records)).toEqual({
      mode: 'deterministic-local',
      configuredProviders: ['web-push'],
      usedProviders: [],
      acceptedDeliveries: 0,
      failedDeliveries: 0,
    });
    const accepted: MutationAPIRecord = {
      ...records[6],
      phase: 'external-web-push',
      at: 113,
      elapsed: 1,
      outcome: 'completed',
    };
    const failed: MutationAPIRecord = { ...accepted, at: 114, outcome: 'failed' };
    records.push(accepted, failed);
    expect(externalMutationDelivery(records)).toEqual({
      mode: 'deterministic-local',
      configuredProviders: ['web-push'],
      usedProviders: ['web-push'],
      acceptedDeliveries: 1,
      failedDeliveries: 1,
    });
    correlateMutationAPI([row], records);
    expect(mutationReportFailures([row.expectation], [row], records)).toEqual([]);
  });
  it('rejects transaction outcomes used for an external provider phase', () => {
    const row = measurement(),
      records = api(row);
    records.push({
      ...records[6],
      phase: 'external-web-push',
      at: 113,
      elapsed: 1,
      outcome: 'committed',
    });
    correlateMutationAPI([row], records);
    expect(mutationFailures(row)).toContain('Missing mutation API correlation');
  });
  it('rejects external provider outcomes used for a transaction phase', () => {
    const row = measurement(),
      records = api(row);
    records[2].outcome = 'completed';
    correlateMutationAPI([row], records);
    expect(mutationFailures(row)).toContain('Missing mutation API correlation');
  });
  it('attributes another named mutation in the same client batch only to its own phases', () => {
    const row = measurement(),
      records = api(row);
    const other = { ...records[0].identities![0], mutationID: 2, name: 'users.updateAvatar' };
    records[0].identities!.push(other);
    records.push(
      { ...records[2], identity: other },
      { ...records[3], identity: other },
      { ...records[4], identity: other }
    );
    correlateMutationAPI([row], records);
    expect(row.samples[0].attempts[0].transactionMs).toEqual([8]);
    expect(mutationReportFailures([row.expectation], [row], records)).toEqual([]);
  });
  it('rejects ambiguous same-name mutation IDs instead of guessing', () => {
    const row = measurement(),
      records = api(row);
    delete row.samples[0].snapshotMutationID;
    records[0].identities!.push({ ...records[0].identities![0], mutationID: 2 });
    correlateMutationAPI([row], records);
    expect(row.failures).toContain(
      'Ambiguous same-name mutation API identities; no independently proven mutation ID'
    );
    expect(row.samples[0].attempts).toEqual([]);
  });
  it('uses independent replicated snapshot evidence to identify a same-name batch mutation', () => {
    const row = measurement(),
      records = api(row);
    const other = { ...records[0].identities![0], mutationID: 2 };
    records[0].identities!.push(other);
    records.push({ ...records[2], identity: other });
    correlateMutationAPI([row], records);
    expect(row.samples[0].mutationID).toBe(1);
    expect(row.samples[0].attempts[0].transactionMs).toEqual([8]);
    expect(mutationReportFailures([row.expectation], [row], records)).toEqual([]);
  });
  it.each(['auth', 'transaction', 'authority-lock', 'after-commit', 'delivery'])(
    'rejects a %s duration that starts before request arrival',
    phase => {
      const row = measurement(),
        records = api(row);
      const record = records.find(item => item.phase === phase)!;
      record.elapsed = record.at - records[0].at + 1;
      correlateMutationAPI([row], records);
      expect(mutationFailures(row)).toContain('Missing mutation API correlation');
    }
  );
  it.each(['transactionMs', 'lockMs', 'afterCommitMs'] as const)(
    'rejects aggregate %s durations longer than their request',
    field => {
      const row = measurement();
      row.samples[0].attempts[0][field] = [21];
      expect(mutationFailures(row)).toContain('Invalid mutation server diagnostics');
    }
  );
  it('reconstructs all identities without reading arguments', () => {
    const row = measurement();
    const records = api(row);
    correlateMutationAPI([row], records);
    expect(mutationReportFailures([row.expectation], [row], records)).toEqual([]);
  });
  it('retains distinct delivery retries and the original client duration', () => {
    const row = measurement();
    const records = api(row);
    records.push(
      ...records.slice(0, 7).map(record => ({ ...record, requestID: 'retry', at: record.at + 30 }))
    );
    correlateMutationAPI([row], records);
    expect(row.samples[0].attempts).toHaveLength(2);
    expect(row.samples[0].serverConfirmedMs).toBe(30);
  });
  it('fails duplicate request records, missing phases and mismatched mutation identities', () => {
    for (const variant of ['duplicate', 'missing', 'identity']) {
      const row = measurement(),
        records = api(row);
      if (variant === 'duplicate') records.push(records[0]);
      if (variant === 'missing') records.splice(1, 1);
      if (variant === 'identity') records[2].identity = { ...records[2].identity!, mutationID: 2 };
      correlateMutationAPI([row], records);
      expect(mutationFailures(row)).toContain('Missing mutation API correlation');
    }
  });
  it('rejects changed expectations and duplicate/missing cases', () => {
    const row = measurement(),
      records = api(row);
    correlateMutationAPI([row], records);
    expect(mutationReportFailures([row.expectation], [row, row], records).length).toBeGreaterThan(
      0
    );
    expect(mutationReportFailures([row.expectation], [], records)).toContain(`Missing ${row.key}`);
    const changed = { ...row.expectation, outcome: 'server-error' as const };
    expect(mutationReportFailures([changed], [row], records)).toContain(
      `${row.key}: Changed mutation expectation`
    );
  });
});
