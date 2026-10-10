import { describe, expect, it } from 'vitest';
import {
  mutationWeightCLIOptions,
  updateMutationSchedulingWeights,
} from '../mutation-scheduling-weights';
import type { MutationMeasurement } from '../mutation-metrics';

function measurement(elapsedMs: number | undefined = 12000): MutationMeasurement {
  const key = 'mutation/users.updateProfile/authorized/owner';
  return {
    key,
    elapsedMs,
    expectation: {
      key,
      name: 'users.updateProfile',
      variant: 'authorized',
      actor: 'owner',
      outcome: 'success',
      observer: { query: 'users.byId' },
      oracleDigest: 'a'.repeat(64),
    },
    failures: [],
    samples: Array.from({ length: 5 }, (_, index) => ({
      clientID: `writer-${index}`,
      clientGroupID: `writers-${index}`,
      observerClientID: `reader-${index}`,
      observerGroupID: `readers-${index}`,
      mutationID: 1,
      snapshotMutationID: 1,
      snapshotAppliedAt: 40,
      startedAt: 10,
      clientAppliedAt: 20,
      confirmedAt: 40,
      observedAt: 50,
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
const report = (...mutations: unknown[]) => ({
  format: 12,
  protocol: 'zero-performance/v12',
  mutations,
});
describe('measured mutation scheduling weights', () => {
  it('preserves query/security weights and uses full elapsed duration instead of fast user latency', () => {
    const base = { 'users.byId/default': 9123, 'users.byId/private/security/owner': 3456 };
    const result = updateMutationSchedulingWeights(base, [report(measurement(15000.2))]);
    expect(result.weights).toEqual({
      ...base,
      'mutation/users.updateProfile/authorized/owner': 15001,
    });
    expect(result.acceptedMeasurements).toBe(1);
    expect(base).not.toHaveProperty('mutation/users.updateProfile/authorized/owner');
  });
  it('uses a conservative maximum across reports and existing known costs regardless of input ordering', () => {
    const rows = [
      report(measurement(14000)),
      report(measurement(17000)),
      report(measurement(13000)),
    ];
    const first = updateMutationSchedulingWeights(
      { 'z.query/default': 10, 'a.query/default': 20 },
      rows
    );
    expect(first.weights['mutation/users.updateProfile/authorized/owner']).toBe(17000);
    expect(first.weights).toEqual(
      updateMutationSchedulingWeights(
        { 'a.query/default': 20, 'z.query/default': 10 },
        rows.reverse()
      ).weights
    );
    expect(Object.keys(first.weights)).toEqual([...Object.keys(first.weights)].sort());
    expect(
      updateMutationSchedulingWeights(
        { ...first.weights, 'mutation/users.updateProfile/authorized/owner': 20000 },
        rows
      ).weights['mutation/users.updateProfile/authorized/owner']
    ).toBe(20000);
  });
  it.each([undefined, 0, -1, NaN, Infinity])(
    'ignores missing or invalid case elapsed duration %s',
    duration => {
      const row = measurement();
      row.elapsedMs = duration;
      const result = updateMutationSchedulingWeights({}, [report(row)]);
      expect(result.weights).toEqual({});
      expect(result.ignoredMeasurements).toBe(1);
    }
  );
  it.each([
    'partial',
    'missing-proof',
    'invalid-outcome',
    'fixture-failure',
    'wrong-key',
    'malformed',
  ])('ignores %s measurement evidence', kind => {
    const row = measurement();
    let candidate: unknown = row;
    if (kind === 'partial') row.samples.pop();
    if (kind === 'missing-proof') row.samples[0].restored = false;
    if (kind === 'invalid-outcome') row.samples[0].outcome = 'server-error';
    if (kind === 'fixture-failure') row.failures.push('fixture setup failed');
    if (kind === 'wrong-key') row.key = 'users.byId/default';
    if (kind === 'malformed') candidate = { key: row.key, elapsedMs: 9000 };
    expect(updateMutationSchedulingWeights({}, [report(candidate)]).weights).toEqual({});
  });
  it('accepts valid evidence above latency budgets when deriving scheduling cost', () => {
    const row = measurement(30000);
    for (const sample of row.samples) {
      sample.clientAppliedAt = 70;
      sample.clientApplyMs = 60;
    }
    expect(updateMutationSchedulingWeights({}, [report(row)]).acceptedMeasurements).toBe(1);
  });
  it('rejects non-v12 input and invalid existing weights', () => {
    expect(() =>
      updateMutationSchedulingWeights({}, [
        { format: 11, protocol: 'zero-performance/v11', mutations: [] },
      ])
    ).toThrow('v12');
    expect(() => updateMutationSchedulingWeights({ 'query/default': 0 }, [report()])).toThrow(
      'existing scheduling weight'
    );
  });
  it('requires explicit output and supports multiple reports without implicit CI rewriting', () => {
    expect(() =>
      mutationWeightCLIOptions(['--weights', 'weights.json', '--report', 'report.json'])
    ).toThrow('Required');
    expect(
      mutationWeightCLIOptions([
        '--weights',
        'weights.json',
        '--report',
        'first.json',
        '--report',
        'second.json',
        '--output',
        'review.json',
      ])
    ).toEqual({
      weights: 'weights.json',
      reports: ['first.json', 'second.json'],
      output: 'review.json',
    });
    expect(() => mutationWeightCLIOptions(['--output', '--report'])).toThrow('Missing value');
  });
});
