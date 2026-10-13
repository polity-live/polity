import { describe, expect, it, vi } from 'vitest';
import {
  absoluteCandidates,
  absoluteStatus,
  confirmAbsolute,
  diagnosticReservation,
} from '../absolute-confirmation';
import type { Report } from '../report';
import type { Measurement } from '../metrics';

function report(values = [1090.9, 41.9, 50.2, 48.5, 95.5], prefix = 'initial'): Report {
  const execution = {
    sourceSHA: 'head',
    harnessDigest: 'h',
    manifestDigest: 'm',
    runnerID: 'r',
    shardID: 'queries-53',
    revision: 'head' as const,
    phase: prefix === 'initial' ? ('initial' as const) : ('confirmation' as const),
  };
  const measurement: Measurement = {
    execution,
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
    samples: values.map((totalMs, i) => ({
      totalMs,
      clientMs: 1,
      serverMs: 5,
      connectionMs: 20,
      clientGroupID: `${prefix}-group-${i}`,
      clientID: `${prefix}-client-${i}`,
      queryID: 'q',
      clientCorrelationID: `${prefix}-correlation-${i}`,
      activatedAt: 100,
      authoritativeAt: 100 + totalMs,
      api: {
        requestID: `${prefix}-${i}`,
        clientCorrelationID: `${prefix}-correlation-${i}`,
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
  return {
    format: 12,
    protocol: 'zero-performance/v12',
    execution,
    layer: 'queries',
    filtered: true,
    infrastructure: [],
    measurements: [measurement],
    mutations: [],
    serverWarnings: [],
    expectedKeys: [],
    expectedSecurityCases: [],
  } as Report;
}

describe('diagnostic absolute confirmation', () => {
  it('confirms the exact revoked-role security case and retains correlated slow-query evidence', async () => {
    const original = report([133.48, 272.6, 224.55, 138.56, 141.6]);
    original.layer = 'security';
    const candidate = original.measurements[0];
    candidate.key = 'events.agendaItemsFull/security-election-role-revoked-owner/security/owner';
    candidate.name = 'events.agendaItemsFull';
    candidate.samples.forEach((sample, index) => {
      sample.serverMs = [38.29, 120.78, 51.17, 40.38, 41.07][index];
    });
    original.expectedSecurityCases = [{ key: candidate.key, expectedIDs: [] }];
    original.serverWarnings = [
      JSON.stringify({
        level: 'WARN',
        message: 'Slow query',
        queryName: candidate.name,
        clientGroupID: candidate.samples[1].clientGroupID,
      }),
    ];
    const repeated = report([40, 41, 42, 43, 44], 'security-repeat');
    repeated.layer = 'security';
    repeated.expectedSecurityCases = structuredClone(original.expectedSecurityCases);
    repeated.measurements[0].key = candidate.key;
    repeated.measurements[0].name = candidate.name;
    const measure = vi.fn(async () => repeated);
    const before = structuredClone(original);
    const result = await confirmAbsolute({
      original,
      relativeSelection: [],
      initialMs: 20_000,
      remainingMs: 200_000,
      measure,
    });
    expect(measure).toHaveBeenCalledExactlyOnceWith([candidate.key], 40_000);
    expect(result.findings[0]).toMatchObject({
      status: 'not-exceeded-again',
      originalWarnings: original.serverWarnings,
    });
    expect(original).toEqual(before);
    const reused = await confirmAbsolute({
      original,
      relativeSelection: [candidate.key],
      relativeConfirmation: repeated,
      initialMs: 20_000,
      remainingMs: 200_000,
      measure,
    });
    expect(reused.findings[0].reusedRelative).toBe(true);
    expect(measure).toHaveBeenCalledTimes(1);
    original.expectedSecurityCases[0].expectedIDs = ['forbidden'];
    expect(absoluteCandidates(original)).toEqual([]);
  });
  it('rejects malformed warnings and keeps repeated warnings as diagnostic evidence', () => {
    const original = report();
    original.serverWarnings = ['not-json'];
    expect(absoluteCandidates(original)).toEqual([]);
    original.serverWarnings = [];
    const repeated = report([1100, 1200, 1300, 1400, 1500], 'repeat');
    repeated.serverWarnings = [
      JSON.stringify({
        level: 'WARN',
        message: 'Slow query',
        queryName: repeated.measurements[0].name,
        clientGroupID: repeated.measurements[0].samples[0].clientGroupID,
      }),
    ];
    expect(absoluteStatus(original, repeated, original.measurements[0])).toMatchObject({
      status: 'exceeded-again',
      confirmationWarnings: repeated.serverWarnings,
    });
    repeated.measurements[0].observedIDs[0] = ['forbidden'];
    expect(absoluteStatus(original, repeated, original.measurements[0]).status).toBe('invalid');
  });
  it('confirms an absolute-only outlier once and preserves the original report', async () => {
    const original = report(),
      before = structuredClone(original);
    const measure = vi.fn(async () => report([44.4, 34.9, 39, 37.9, 37.4], 'diagnostic'));
    const result = await confirmAbsolute({
      original,
      relativeSelection: [],
      initialMs: 20_000,
      remainingMs: 200_000,
      measure,
    });
    expect(measure).toHaveBeenCalledExactlyOnceWith(['studio.canvasReceipt/default'], 40_000);
    expect(result.findings[0].status).toBe('not-exceeded-again');
    expect(original).toEqual(before);
  });
  it('reuses relative confirmation without duplicate execution and keeps sustained failures', async () => {
    const original = report(),
      relative = report([1100, 1200, 1300, 1400, 1500], 'relative');
    const measure = vi.fn();
    const result = await confirmAbsolute({
      original,
      relativeSelection: ['studio.canvasReceipt/default'],
      relativeConfirmation: relative,
      initialMs: 20_000,
      remainingMs: 200_000,
      measure,
    });
    expect(measure).not.toHaveBeenCalled();
    expect(result.findings[0]).toMatchObject({ status: 'exceeded-again', reusedRelative: true });
  });
  it('does not confirm invalid results, missing samples, authentication or infrastructure failures', () => {
    for (const invalid of ['result', 'samples', 'auth', 'infrastructure']) {
      const original = report();
      if (invalid === 'result') original.measurements[0].observedIDs[0] = ['wrong'];
      if (invalid === 'samples') original.measurements[0].samples.pop();
      if (invalid === 'auth')
        original.measurements[0].failures.push('Inspector authentication timed out');
      if (invalid === 'infrastructure') original.infrastructure.push('Stack failed');
      expect(absoluteCandidates(original)).toEqual([]);
    }
    expect(absoluteCandidates({ ...report(), layer: 'journeys' })).toEqual([]);
  });
  it('skips insufficient budget and contains diagnostic exceptions', async () => {
    const measure = vi.fn(async () => {
      throw new Error('worker timed out');
    });
    const options = {
      original: report(),
      relativeSelection: [],
      initialMs: 20_000,
      remainingMs: 40_000,
      measure,
    };
    expect((await confirmAbsolute(options)).findings[0].status).toBe('not-executed');
    expect(measure).not.toHaveBeenCalled();
    expect((await confirmAbsolute({ ...options, remainingMs: 100_000 })).findings[0].status).toBe(
      'invalid'
    );
    expect(diagnosticReservation(NaN, 100_000).eligible).toBe(false);
  });
  it('rejects mismatched identities and client group reuse', () => {
    const original = report(),
      candidate = original.measurements[0];
    const repeated = report([10, 11, 12, 13, 14], 'repeat');
    repeated.execution!.runnerID = 'other';
    expect(absoluteStatus(original, repeated, candidate).status).toBe('invalid');
    expect(absoluteStatus(original, report([10, 11, 12, 13, 14]), candidate).status).toBe(
      'invalid'
    );
    repeated.execution!.runnerID = 'r';
    repeated.measurements = [];
    expect(absoluteStatus(original, repeated, candidate).status).toBe('invalid');
    expect(absoluteStatus(original, undefined, candidate).status).toBe('not-executed');
  });
});
