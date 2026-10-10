import { describe, expect, it } from 'vitest';
import { createManifest, type Manifest, type Shard } from '../sharding';
import {
  comparisons,
  confirmationFailures,
  confirmationSelection,
  freshGroupFailures,
  partialReportFailures,
  shardMeasurementKeys,
} from '../distributed-report';
import { correlateQueryAPI, REPORT_FORMAT, MEASUREMENT_PROTOCOL, type Report } from '../report';
import type { Measurement } from '../metrics';
import { resultsCSV } from '../results';

function fixture() {
  const manifest = createManifest(
    {
      protocol: MEASUREMENT_PROTOCOL,
      runID: 'run',
      headSHA: 'a'.repeat(40),
      baseSHA: 'b'.repeat(40),
      harnessDigest: 'c'.repeat(64),
      workloads: {
        head: {
          queries: ['q/default'],
          security: [{ key: 'q/security-private/security/owner', expectedIDs: [] }],
        },
        base: {
          queries: ['q/default'],
          security: [{ key: 'q/security-private/security/owner', expectedIDs: [] }],
        },
      },
    },
    {}
  );
  return { manifest, shard: manifest.shards[0] };
}
function report(
  manifest: Manifest,
  shard: Shard,
  revision: 'head' | 'base' = 'head',
  phase: 'initial' | 'confirmation' = 'initial',
  serverMs = 30
): Report {
  const structure = { bytes: 100, queries: 1, conditions: 1, maxQueryDepth: 1 };
  const records: any[] = [];
  const measurements: Measurement[] = shardMeasurementKeys(shard, revision).map((key, row) => ({
    key,
    name: 'q',
    variant: 'default',
    actor: key.split('/').at(-1)!,
    profile: key.split('/').at(-2)!,
    revision: 1,
    reason: 'Initial',
    args: {},
    expectedIDs: [],
    observedIDs: Array.from({ length: 5 }, () => []),
    samples: Array.from({ length: 5 }, (_, index) => {
      const requestID = `${revision}-${row}-${index}`,
        correlation = `correlation-${requestID}`;
      const identity = { requestID, clientCorrelationID: correlation };
      records.push(
        { ...identity, phase: 'arrival', at: 100 },
        { ...identity, phase: 'auth', elapsed: 10 },
        { ...identity, phase: 'transform', name: 'q', elapsed: 1 },
        {
          ...identity,
          phase: 'query-identities',
          at: 110,
          queries: [{ id: 'query', name: 'q', structure }],
        },
        { ...identity, phase: 'response', at: 120, elapsed: 20 }
      );
      return {
        queryID: 'query',
        clientCorrelationID: correlation,
        activatedAt: 100,
        authoritativeAt: 200,
        totalMs: 100,
        serverMs,
        clientMs: 5,
        clientGroupID: `group-${requestID}`,
        clientID: `client-${requestID}`,
        connectionMs: 20,
      };
    }),
    analyzeMs: [180],
    readRows: 0,
    scannedRows: 0,
    syncedRows: 0,
    plans: {
      sqlite: {},
      joins: [],
      scansByQuery: {},
      readsByQuery: {},
      exportMs: 1,
      exportMode: 'separate',
    },
    warnings: [],
    failures: [],
  }));
  correlateQueryAPI(measurements, records);
  return {
    format: REPORT_FORMAT,
    protocol: MEASUREMENT_PROTOCOL,
    layer: shard.layer,
    filtered: true,
    expectedKeys: measurements.map(item => item.key),
    expectedSecurityCases: manifest.workloads[revision]!.security.filter(entry =>
      shard[revision].includes(entry.key)
    ),
    infrastructure: [],
    measurements,
    apiDiagnostics: records,
    serverWarnings: [],
    execution: {
      manifestDigest: manifest.digest,
      shardID: shard.id,
      revision,
      sourceSHA: revision === 'head' ? manifest.headSHA : manifest.baseSHA!,
      harnessDigest: manifest.harnessDigest,
      runnerID: 'runner',
      phase,
    },
    fixturePreflight: { expected: shard[revision], completed: shard[revision], failures: [] },
  };
}

describe('distributed measurement acceptance', () => {
  it('retains source, runner and shard provenance in partial and merged CSVs', () => {
    const { manifest, shard } = fixture(),
      value = report(manifest, shard);
    const partial = resultsCSV(value.measurements, value.execution);
    const merged = resultsCSV(
      value.measurements.map(item => ({ ...item, execution: value.execution }))
    );
    expect(partial).toBe(merged);
    expect(partial).toContain('sourceRevision,sourceSHA,runnerID,shardID,manifestDigest');
    expect(partial).toContain(JSON.stringify(manifest.headSHA));
    expect(partial).toContain(JSON.stringify(shard.id));
  });
  it('accepts 30 ms real server work with a 180 ms analyzer diagnosis', () => {
    const { manifest, shard } = fixture();
    expect(
      partialReportFailures(report(manifest, shard), manifest, shard, 'head', 'initial', 'runner')
    ).toEqual([]);
  });
  it('rejects one slow sample and does not replace maxima by medians', () => {
    const { manifest, shard } = fixture(),
      value = report(manifest, shard);
    value.measurements[0].samples[4].serverMs = 101;
    expect(
      partialReportFailures(value, manifest, shard, 'head', 'initial', 'runner').some(failure =>
        failure.includes('Server materialization exceeds')
      )
    ).toBe(true);
  });
  it.each([
    'missing',
    'duplicate',
    'old-protocol',
    'wrong-revision',
    'missing-preflight',
    'incomplete-preflight',
    'raw-correlation',
  ] as const)('rejects %s reports', failure => {
    const { manifest, shard } = fixture(),
      value = report(manifest, shard);
    if (failure === 'missing') value.measurements.pop();
    if (failure === 'duplicate') value.measurements.push(value.measurements[0]);
    if (failure === 'old-protocol') value.protocol = 'zero-performance/v9';
    if (failure === 'wrong-revision') value.execution!.sourceSHA = manifest.baseSHA!;
    if (failure === 'missing-preflight') delete value.fixturePreflight;
    if (failure === 'incomplete-preflight') value.fixturePreflight!.completed = [];
    if (failure === 'raw-correlation') value.measurements[0].samples[0].api!.authMs = 0;
    expect(
      partialReportFailures(value, manifest, shard, 'head', 'initial', 'runner').length
    ).toBeGreaterThan(0);
  });
  it('ignores analyzer-duration changes for timing regressions', () => {
    const { manifest, shard } = fixture(),
      head = report(manifest, shard),
      base = report(manifest, shard, 'base');
    head.measurements.forEach(item => {
      item.analyzeMs = [9000];
    });
    expect(comparisons(base, head)).toEqual([]);
  });
  it('rejects client store reuse between otherwise complete initial and confirmation measurements', () => {
    const { manifest, shard } = fixture();
    const initial = report(manifest, shard),
      confirmation = report(manifest, shard, 'head', 'confirmation');
    expect(freshGroupFailures([initial])).toEqual([]);
    expect(freshGroupFailures([initial, confirmation])).toHaveLength(4);
    expect(freshGroupFailures([initial, report(manifest, shard, 'base')])).toEqual([]);
  });
  it('requires complete comparable remeasurement of both versions on the same runner', () => {
    const { manifest, shard } = fixture(),
      base = report(manifest, shard, 'base'),
      head = report(manifest, shard, 'head', 'initial', 50);
    const first = comparisons(base, head),
      selected = confirmationSelection(shard, first),
      keys = shardMeasurementKeys(shard, 'head', selected);
    expect(selected).toEqual(['q/default']);
    expect(confirmationFailures(first, [], keys)).toEqual([
      'Missing or incomplete regression confirmation',
    ]);
    const repeatedBase = report(manifest, shard, 'base', 'confirmation'),
      repeatedHead = report(manifest, shard, 'head', 'confirmation', 50);
    expect(
      confirmationFailures(
        first,
        comparisons(repeatedBase, repeatedHead),
        keys,
        repeatedBase,
        repeatedHead
      ).length
    ).toBe(4);
    repeatedHead.measurements[0].samples[0].serverMs = NaN;
    expect(confirmationFailures(first, [], keys, repeatedBase, repeatedHead)).toEqual([
      'Invalid regression confirmation telemetry/results',
    ]);
    const wrongRunner = report(manifest, shard, 'head', 'confirmation');
    wrongRunner.execution!.runnerID = 'other';
    expect(
      partialReportFailures(wrongRunner, manifest, shard, 'head', 'confirmation', 'runner').length
    ).toBeGreaterThan(0);
  });
  it('rejects changed security expectations while retaining the full security state replay', () => {
    const { manifest } = fixture(),
      shard = manifest.shards.find(shard => shard.layer === 'security' && shard.head.length)!;
    const value = report(manifest, shard);
    value.expectedSecurityCases = [];
    expect(partialReportFailures(value, manifest, shard, 'head', 'initial', 'runner')).toContain(
      'Changed shard security expectations'
    );
  });
});
