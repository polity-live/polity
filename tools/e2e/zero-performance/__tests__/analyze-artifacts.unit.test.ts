import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeArtifacts,
  analyzeQuery,
  classify,
  confirmationStatus,
  repeatKey,
  summarize,
} from '../analyze-artifacts';
import type { Measurement } from '../metrics';

function measurement(values: number[]): Measurement {
  return {
    key: 'studio.canvasReceipt/default/minimal/anonymous',
    name: 'studio.canvasReceipt',
    variant: 'default',
    profile: 'minimal',
    actor: 'anonymous',
    revision: 1,
    reason: 'fixture',
    args: {},
    expectedIDs: [],
    observedIDs: values.map(() => []),
    samples: values.map((totalMs, index) => ({
      totalMs,
      clientMs: 1,
      serverMs: 5,
      connectionMs: 20,
      clientGroupID: `group-${index}`,
      clientID: `client-${index}`,
      queryID: 'query',
      clientCorrelationID: `correlation-${index}`,
      activatedAt: 100,
      authoritativeAt: 100 + totalMs,
      api: {
        requestID: `request-${index}`,
        clientCorrelationID: `correlation-${index}`,
        authMs: 0.1,
        transformMs: 0.1,
        requestMs: 1,
        arrivalAt: 100,
        responseAt: 101,
        clock: 'api-server',
        structure: { bytes: 100, queries: 1, conditions: 1, maxQueryDepth: 1 },
      },
    })),
    analyzeMs: [1],
    readRows: 0,
    scannedRows: 0,
    syncedRows: 0,
    plans: {
      sqlite: {},
      joins: [],
      scansByQuery: {},
      readsByQuery: {},
      exportMode: 'separate',
      exportMs: 1,
    },
    warnings: [],
    failures: [],
  };
}

describe('offline artifact diagnostics', () => {
  it('retains the historical single outlier and successful repeat separately', () => {
    const failed = analyzeQuery(measurement([1090.9, 41.9, 50.2, 48.5, 95.5]));
    const passed = analyzeQuery(measurement([44.4, 34.9, 39, 37.9, 37.4]));
    expect(failed.metrics.total).toMatchObject({ maximum: 1090.9, median: 50.2, exceedances: 1 });
    expect(failed.findings).toContainEqual({
      category: 'absolute-budget',
      message: 'Total exceeds 1000 ms',
    });
    expect(passed.metrics.total.exceedances).toBe(0);
    expect(failed.samples).toHaveLength(5);
  });
  it('distinguishes sustained slowness, invalid telemetry and wrong results', () => {
    expect(
      analyzeQuery(measurement([1100, 1200, 1300, 1400, 1500])).metrics.total.exceedances
    ).toBe(5);
    expect(summarize([1, NaN, -1], 100).valid).toBe(false);
    expect(summarize([], 100).maximum).toBeNull();
    const wrong = measurement([1, 2, 3, 4, 5]);
    wrong.observedIDs[0] = ['unexpected'];
    expect(analyzeQuery(wrong).findings).toContainEqual({
      category: 'invalid-measurement',
      message: 'Missing or incorrect authoritative result checks',
    });
    expect(classify('Inspector authentication timed out')).toBe('infrastructure');
    expect(classify('Missing query plans')).toBe('invalid-measurement');
  });
  it('does not treat absent or invalid confirmation as recovery', () => {
    const candidate = [{ key: 'q', metric: 'total' }];
    expect(confirmationStatus(candidate, [], false, false).status).toBe('missing');
    expect(confirmationStatus(candidate, [], true, false).status).toBe('invalid');
    expect(confirmationStatus(candidate, [], true, true).findings?.[0].category).toBe(
      'unconfirmed-regression'
    );
    expect(confirmationStatus(candidate, candidate, true, true).findings?.[0].category).toBe(
      'confirmed-regression'
    );
    expect(confirmationStatus([], [], false, false).reason).toContain(
      'absolute budget failures alone'
    );
  });
  it('compares only matching source, harness and workload while recording different runners', () => {
    const execution = { sourceSHA: 'a', harnessDigest: 'b', shardID: 'q', runnerID: 'one' };
    const key = repeatKey(execution, 'q', { args: { a: 1, b: 2 } });
    expect(repeatKey({ ...execution, runnerID: 'two' }, 'q', { args: { b: 2, a: 1 } })).toBe(key);
    expect(
      repeatKey({ ...execution, sourceSHA: 'changed' }, 'q', { args: { a: 1, b: 2 } })
    ).not.toBe(key);
    expect(
      repeatKey({ ...execution, harnessDigest: 'changed' }, 'q', { args: { a: 1, b: 2 } })
    ).not.toBe(key);
    expect(repeatKey(execution, 'q', { args: { a: 2, b: 2 } })).not.toBe(key);
    expect(repeatKey({}, 'q', {})).toBeNull();
  });
  it('reads aggregate reports once, retains original frames and reports corrupt artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zero-diagnostics-'));
    try {
      const directory = path.join(root, 'head', 'initial');
      const worker = path.join(directory, 'workers', 'journeys');
      await mkdir(worker, { recursive: true });
      const report = {
        format: 12,
        protocol: 'zero-performance/v12',
        execution: { sourceSHA: 'a', harnessDigest: 'b', shardID: 'journeys' },
        infrastructure: [],
        measurements: [],
        journeys: [
          {
            route: '/messages',
            visit: 'back',
            cachedDisplayMs: 50.1,
            failures: ['Cached display exceeds 50 ms'],
            processing: { longTasks: [{ duration: 55 }] },
          },
        ],
      };
      await writeFile(path.join(directory, 'report.json'), JSON.stringify(report));
      await writeFile(path.join(worker, 'report.json'), JSON.stringify(report));
      await writeFile(
        path.join(worker, 'navigation-original-frames.ndjson'),
        JSON.stringify({
          scope: 'original-measured-navigation',
          route: '/messages',
          visit: 'back',
          frames: [{ duration: 55 }],
        })
      );
      await mkdir(path.join(root, 'corrupt'));
      await writeFile(path.join(root, 'corrupt', 'report.json'), '{');
      const analysis = await analyzeArtifacts(root);
      expect(analysis.reports).toHaveLength(1);
      expect(analysis.issues).toHaveLength(1);
      expect(analysis.reports[0].journeys[0].originalFrames).toHaveLength(1);
      expect(analysis.reports[0].journeys[0].longTasks).toEqual([{ duration: 55 }]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('requires matching confirmation identities and complete candidate telemetry', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zero-confirmation-'));
    try {
      const query = measurement([10, 11, 12, 13, 14]);
      const candidate = { key: query.key, metric: 'total', before: 10, after: 200 };
      await writeFile(
        path.join(root, 'comparison.json'),
        JSON.stringify({ first: [candidate], second: [] })
      );
      for (const revision of ['base', 'head']) {
        for (const phase of ['initial', 'confirmation']) {
          const directory = path.join(root, revision, phase);
          await mkdir(directory, { recursive: true });
          await writeFile(
            path.join(directory, 'report.json'),
            JSON.stringify({
              format: 12,
              protocol: 'zero-performance/v12',
              layer: 'queries',
              execution: {
                sourceSHA: revision,
                harnessDigest: 'h',
                runnerID: 'r',
                manifestDigest: 'm',
                shardID: 'q',
                revision,
                phase,
              },
              infrastructure: [],
              measurements: [query],
              mutations: [],
            })
          );
        }
      }
      expect((await analyzeArtifacts(root)).comparisons[0].confirmation.status).toBe('executed');
      const target = path.join(root, 'head', 'confirmation', 'report.json');
      const changed = JSON.parse(await readFile(target, 'utf8'));
      changed.execution.runnerID = 'another-runner';
      await writeFile(target, JSON.stringify(changed));
      expect((await analyzeArtifacts(root)).comparisons[0].confirmation.status).toBe('invalid');
      changed.execution.runnerID = 'r';
      changed.measurements = [];
      await writeFile(target, JSON.stringify(changed));
      expect((await analyzeArtifacts(root)).comparisons[0].confirmation.status).toBe('invalid');
      await rm(target);
      expect((await analyzeArtifacts(root)).comparisons[0].confirmation.status).toBe('missing');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('loads query time components and diagnostic status without changing original budget findings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zero-sidecars-'));
    try {
      const execution = {
        sourceSHA: 's',
        harnessDigest: 'h',
        runnerID: 'r',
        shardID: 'q',
        manifestDigest: 'm',
        phase: 'initial',
      };
      const query = measurement([1090.9, 41.9, 50.2, 48.5, 95.5]);
      await writeFile(
        path.join(root, 'report.json'),
        JSON.stringify({
          format: 12,
          protocol: 'zero-performance/v12',
          layer: 'queries',
          execution,
          measurements: [query],
          infrastructure: [],
        })
      );
      const legacy = await analyzeArtifacts(root);
      expect(legacy.reports[0].queries[0].timeComponents.source).toContain('unknown');
      await writeFile(
        path.join(root, 'query-timeline.json'),
        JSON.stringify({
          format: 'zero-query-timeline/v1',
          samples: [
            {
              key: query.key,
              clientCorrelationID: query.samples[0].clientCorrelationID,
              execution,
              elapsedMs: 1090.9,
              sdkHydrateTotalMs: 40,
              totalSource: 'elapsed',
              budgetExceededBy: ['elapsed'],
              clock: 'node-performance-now',
              events: {
                materializeStart: null,
                materializeEnd: null,
                listenerStart: null,
                listenerEnd: null,
                firstCallback: null,
                completeCallback: null,
              },
            },
          ],
        })
      );
      await writeFile(
        path.join(root, 'absolute-confirmation.json'),
        JSON.stringify({
          format: 'zero-absolute-confirmation/v1',
          findings: [{ key: query.key, status: 'not-exceeded-again', reason: 'Diagnostic only' }],
        })
      );
      const updated = await analyzeArtifacts(root);
      expect(updated.reports[0].queries[0].timeComponents.elapsed.maximum).toBe(1090.9);
      expect(updated.reports[0].queries[0].findings).toEqual(legacy.reports[0].queries[0].findings);
      expect(updated.absoluteConfirmations[0].findings[0].status).toBe('not-exceeded-again');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
