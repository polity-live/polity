import { describe, expect, it } from 'vitest';
import { createManifest, digest, validateManifest, type Workload } from '../sharding';
import {
  confirmationFailures,
  confirmationSelection,
  partialReportFailures,
  shardMeasurementKeys,
} from '../distributed-report';
import type { MutationExpectation } from '../mutation-metrics';
import { externalMutationDelivery, type MutationAPIRecord } from '../mutation-report';
import { reportFailures, MEASUREMENT_PROTOCOL, REPORT_FORMAT, type Report } from '../report';

const mutation = (name: string, variant: string): MutationExpectation => ({
  key: `mutation/${name}/${variant}/owner`,
  name,
  variant,
  actor: 'owner',
  outcome: 'success',
  observer: { query: 'users.byId' },
  oracleDigest: 'd'.repeat(64),
});
const workload = (): Workload => ({
  queries: ['q/default'],
  security: [{ key: 'q/security-private/security/owner', expectedIDs: [] }],
  mutations: [
    mutation('studio.canvas.command', 'insert'),
    mutation('studio.canvas.command', 'delete'),
    mutation('users.updateProfile', 'save'),
  ],
});
function manifest(base: Workload = workload()) {
  return createManifest(
    {
      protocol: 'zero-performance/v12',
      runID: 'unit',
      headSHA: 'a'.repeat(40),
      baseSHA: 'b'.repeat(40),
      harnessDigest: 'c'.repeat(64),
      workloads: { head: workload(), base },
    },
    { 'q/default': 100, 'mutation/studio.canvas.command/insert/owner': 300 }
  );
}
describe('mutation CI scheduling and confirmation', () => {
  it('weights each revision actually measured, including a mutation-only bootstrap', () => {
    const entry = mutation('fixture.write', 'save');
    const head: Workload = {
      queries: ['q/default', ...Array.from({ length: 15 }, (_, i) => `f${i}/default`)],
      security: workload().security,
      mutations: [entry],
    };
    const weights = Object.fromEntries(
      head.queries.map(key => [key, key === 'q/default' ? 100 : 1])
    );
    weights[entry.key] = 150;
    const plan = (compareMutations: boolean) =>
      createManifest(
        {
          protocol: 'zero-performance/v12',
          runID: 'revision-costs',
          headSHA: 'a'.repeat(40),
          baseSHA: 'b'.repeat(40),
          harnessDigest: 'c'.repeat(64),
          workloads: {
            head,
            base: {
              ...head,
              mutations: compareMutations ? [entry] : [],
              ...(compareMutations
                ? {}
                : { mutationBootstrap: 'Baseline has no mutation catalog' }),
            },
          },
        },
        weights
      );
    // Query cost is 2*100; bootstrap mutation cost is only 150.
    expect(plan(false).shards[0].head).toEqual(['q/default']);
    // A supported baseline adds the second genuine 150-ms mutation workload.
    expect(plan(true).shards[0].head).toEqual([entry.key]);
    expect(() => validateManifest(plan(false))).not.toThrow();
    expect(() => validateManifest(plan(true))).not.toThrow();
  });
  it('validates external metadata against raw delivery counts in full and partial reports', async () => {
    const plan = manifest(),
      entry = workload().mutations[0];
    const shard = plan.shards.find(value => value.head.includes(entry.key));
    expect(shard).toBeDefined();
    if (!shard) throw new Error('Missing mutation shard');
    const diagnostics: MutationAPIRecord[] = [
      { benchmark: 'mutation-api', requestID: 'delivery', phase: 'arrival', at: 100, elapsed: 0 },
      {
        benchmark: 'mutation-api',
        requestID: 'delivery',
        phase: 'external-web-push',
        at: 110,
        elapsed: 3,
        outcome: 'completed',
      },
      { benchmark: 'mutation-api', requestID: 'delivery', phase: 'response', at: 120, elapsed: 20 },
    ];
    const value: Report = {
      format: REPORT_FORMAT,
      protocol: MEASUREMENT_PROTOCOL,
      filtered: false,
      layer: 'all',
      expectedKeys: [],
      expectedMutations: [entry],
      mutationBootstrap: 'Baseline fixture',
      mutations: [],
      mutationDiagnostics: diagnostics,
      measurements: [],
      infrastructure: [],
      apiDiagnostics: [],
      serverWarnings: [],
      externalDelivery: externalMutationDelivery(diagnostics),
    };
    const externalFailures = (failures: string[]) =>
      failures.filter(failure => failure.includes('external delivery'));
    expect(externalFailures(await reportFailures(value, false))).toEqual([]);
    const partial = {
      ...value,
      expectedMutations: plan.workloads.head.mutations.filter(item =>
        shard.head.includes(item.key)
      ),
      layer: 'queries',
      filtered: true,
    };
    expect(
      externalFailures(partialReportFailures(partial, plan, shard, 'head', 'initial', 'runner'))
    ).toEqual([]);
    delete value.externalDelivery;
    delete partial.externalDelivery;
    expect(externalFailures(await reportFailures(value, false))).toContain(
      'Missing or contradictory mutation external delivery metadata'
    );
    expect(
      externalFailures(partialReportFailures(partial, plan, shard, 'head', 'initial', 'runner'))
    ).toContain('Missing or contradictory mutation external delivery metadata');
    value.externalDelivery = { ...externalMutationDelivery(diagnostics), acceptedDeliveries: 2 };
    partial.externalDelivery = value.externalDelivery;
    expect(externalFailures(await reportFailures(value, false))).toContain(
      'Missing or contradictory mutation external delivery metadata'
    );
    expect(
      externalFailures(partialReportFailures(partial, plan, shard, 'head', 'initial', 'runner'))
    ).toContain('Missing or contradictory mutation external delivery metadata');
    diagnostics[1].outcome = 'failed';
    value.externalDelivery = externalMutationDelivery(diagnostics);
    partial.externalDelivery = value.externalDelivery;
    expect(externalFailures(await reportFailures(value, false))).toContain(
      'Mutation external delivery failed'
    );
    expect(
      externalFailures(partialReportFailures(partial, plan, shard, 'head', 'initial', 'runner'))
    ).toContain('Mutation external delivery failed');
  });
  it('covers queries and mutations on the existing sixteen catalog jobs and keeps nested variants together', () => {
    const plan = manifest();
    expect(plan.shards).toHaveLength(20);
    expect(plan.shards.filter(shard => shard.layer === 'queries')).toHaveLength(16);
    const assigned = plan.shards
      .flatMap(shard => (shard.layer === 'queries' ? shard.head : []))
      .sort();
    expect(assigned).toEqual(
      [...workload().queries, ...workload().mutations.map(row => row.key)].sort()
    );
    const studio = plan.shards.filter(shard =>
      shard.head.some(key => key.includes('studio.canvas.command'))
    );
    expect(studio).toHaveLength(1);
    expect(studio[0].head.filter(key => key.includes('studio.canvas.command'))).toHaveLength(2);
    expect(studio[0].base).toEqual(studio[0].head);
    expect(shardMeasurementKeys(studio[0], 'head')).toEqual(studio[0].head);
  });
  it('reports only the mutation baseline as bootstrap while retaining all base queries', () => {
    const base = workload();
    base.mutations = [];
    expect(() => manifest(base)).toThrow('mutation baseline bootstrap');
    base.mutationBootstrap = 'Revision predates the mutation catalog';
    const plan = manifest(base);
    expect(plan.bootstrap).toBeUndefined();
    expect(plan.shards.flatMap(shard => (shard.layer === 'queries' ? shard.base : []))).toEqual([
      'q/default',
    ]);
  });
  it('rejects duplicate and missing mutation assignments even with a recomputed checksum', () => {
    for (const variant of ['missing', 'duplicate']) {
      const plan = manifest();
      const shard = plan.shards.find(row => row.head.some(key => key.startsWith('mutation/')))!;
      if (variant === 'missing') shard.head.shift();
      else shard.head.push(shard.head[0]);
      const { digest: _checksum, ...unsigned } = plan;
      plan.digest = digest(unsigned);
      expect(() => validateManifest(plan)).toThrow();
    }
  });
  it('confirms an exact mutation key and refuses missing repeat evidence', () => {
    const plan = manifest();
    const entry = workload().mutations[0];
    const shard = plan.shards.find(row => row.head.includes(entry.key))!;
    const first = [
      { key: entry.key, metric: 'serverConfirmedMs', before: 100, after: 220, kind: 'timing' },
    ];
    expect(confirmationSelection(shard, first)).toEqual([entry.key]);
    expect(confirmationFailures(first, [], [entry.key])).toContain(
      'Missing or incomplete regression confirmation'
    );
  });
});
