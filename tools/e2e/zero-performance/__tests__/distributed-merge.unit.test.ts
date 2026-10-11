import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createManifest, type Execution, type Manifest, type Shard } from '../sharding';
import { shardMeasurementKeys } from '../distributed-report';
import { correlateQueryAPI, type Report } from '../report';
import { writeJoinPlanArtifact } from '../plan-artifacts';
import { writeJSON } from '../distributed-io';
import { mergeShards } from '../distributed-merge';
import type { ShardResult } from '../distributed-runner';

const context = vi.hoisted(() => ({ manifestPath: '' }));
vi.mock('../distributed-io', async importOriginal => ({
  ...(await importOriginal<typeof import('../distributed-io')>()),
  git: () => 'a'.repeat(40),
  harnessDigest: async () => 'c'.repeat(64),
  requiredOption: () => context.manifestPath,
}));
// Isolate the distributed controller from the product's full catalog validator.
// Partial telemetry, provenance, plan and coverage checks remain real.
vi.mock('../report', async importOriginal => ({
  ...(await importOriginal<typeof import('../report')>()),
  reportFailures: async () => [],
}));
const roots: string[] = [];
beforeEach(() => {
  vi.stubEnv('GITHUB_ACTIONS', '');
  vi.stubEnv('GITHUB_STEP_SUMMARY', '');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  process.exitCode = 0;
  for (const root of roots.splice(0)) {
    const relative = path.relative(tmpdir(), root);
    if (!relative.startsWith('zero-distributed-test-') || relative.includes(path.sep))
      throw new Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true });
  }
});

async function partial(
  manifest: Manifest,
  shard: Shard,
  destination: string,
  phase: Execution['phase'] = 'initial'
): Promise<Report> {
  const execution: Execution = {
    manifestDigest: manifest.digest,
    sourceSHA: manifest.headSHA,
    revision: 'head',
    harnessDigest: manifest.harnessDigest,
    shardID: shard.id,
    runnerID: `runner-${shard.id}`,
    phase,
  };
  const apiDiagnostics: any[] = [];
  const measurements = await Promise.all(
    shardMeasurementKeys(shard, 'head').map(async (key, row) => {
      const samples = Array.from({ length: 5 }, (_, index) => {
        const identity = {
          requestID: `${shard.id}-${phase}-${row}-${index}`,
          clientCorrelationID: `correlation-${shard.id}-${phase}-${row}-${index}`,
        };
        const structure = { bytes: 100, queries: 1, conditions: 1, maxQueryDepth: 1 };
        apiDiagnostics.push(
          { ...identity, phase: 'arrival', at: 100 },
          { ...identity, phase: 'auth', elapsed: 10 },
          { ...identity, phase: 'transform', name: 'users.current', elapsed: 1 },
          {
            ...identity,
            phase: 'query-identities',
            at: 110,
            mutations: [],
            queries: [{ id: 'query', name: 'users.current', structure }],
          },
          { ...identity, phase: 'response', at: 120, elapsed: 20 }
        );
        return {
          queryID: 'query',
          clientCorrelationID: identity.clientCorrelationID,
          activatedAt: 100,
          authoritativeAt: 200,
          totalMs: 100,
          clientMs: 5,
          serverMs: 30,
          connectionMs: 20,
          clientGroupID: `group-${identity.requestID}`,
          clientID: `client-${identity.requestID}`,
        };
      });
      const joinsArtifact = await writeJoinPlanArtifact(destination, key, []);
      return {
        key,
        execution,
        name: 'users.current',
        variant: key.split('/')[1],
        profile: shard.layer === 'security' ? 'security' : key.split('/')[2],
        actor: key.split('/').at(-1) ?? 'owner',
        revision: 1,
        reason: 'Initial',
        args: {},
        expectedIDs: [],
        observedIDs: Array.from({ length: 5 }, () => []),
        samples,
        analyzeMs: [180],
        readRows: 0,
        scannedRows: 0,
        syncedRows: 0,
        plans: {
          sqlite: {},
          joinsArtifact,
          scansByQuery: {},
          readsByQuery: {},
          exportMode: 'separate',
          exportMs: 1,
        },
        warnings: [],
        failures: [],
      };
    })
  );
  correlateQueryAPI(measurements, apiDiagnostics);
  return {
    format: 12,
    expectedMutations: [],
    mutations: [],
    mutationDiagnostics: [],
    protocol: 'zero-performance/v12',
    execution,
    layer: shard.layer,
    filtered: true,
    expectedKeys: measurements.filter(row => row.profile !== 'security').map(row => row.key),
    expectedSecurityCases: manifest.workloads.head.security.filter(entry =>
      shard.head.includes(entry.key)
    ),
    fixturePreflight: { expected: shard.head, completed: shard.head, failures: [] },
    measurements,
    infrastructure: [],
    serverWarnings: [],
    apiDiagnostics,
    journeys: [],
  };
}
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'zero-distributed-test-'));
  const relative = path.relative(tmpdir(), root);
  if (!relative.startsWith('zero-distributed-test-') || relative.includes(path.sep))
    throw new Error('Unsafe fixture directory');
  roots.push(root);
  const manifest = createManifest(
    {
      protocol: 'zero-performance/v12',
      headSHA: 'a'.repeat(40),
      harnessDigest: 'c'.repeat(64),
      runID: 'run',
      bootstrap: 'Fixture bootstrap',
      workloads: {
        head: {
          mutations: [],
          queries: ['users.current/default'],
          security: [{ key: 'users.current/security-allow/security/owner', expectedIDs: [] }],
        },
      },
    },
    {}
  );
  context.manifestPath = path.join(root, 'manifest.json');
  await writeJSON(context.manifestPath, manifest);
  await writeJSON(path.join(root, 'prepare.json'), {
    manifestDigest: manifest.digest,
    elapsedMs: 100,
  });
  const artifacts = path.join(root, 'artifacts');
  for (const shard of manifest.shards) {
    const runnerRoot = path.join(artifacts, shard.id);
    const result: ShardResult = {
      manifestDigest: manifest.digest,
      shardID: shard.id,
      runnerID: `runner-${shard.id}`,
      runs: [],
      failures: [],
      elapsedMs: 100,
      setupMs: 10,
      measurementMs: 80,
      confirmationMs: 0,
      cleanupMs: 10,
    };
    if (shard.layer === 'diagnostics') {
      const control = await partial(
        manifest,
        { ...shard, layer: 'queries', head: ['users.current/default'] },
        path.join(runnerRoot, 'control'),
        'control'
      );
      await writeJSON(path.join(runnerRoot, 'control/report.json'), control);
      await writeJSON(path.join(runnerRoot, 'integrity/integrity.json'), {
        isolated: true,
        outcome: 'passed',
        execution: control.execution,
      });
      result.diagnostics = { control: 0, integrity: 0 };
    } else if (shard.head.length || shard.layer === 'journeys') {
      const destination = path.join(runnerRoot, 'head/initial');
      await writeJSON(
        path.join(destination, 'report.json'),
        await partial(manifest, shard, destination)
      );
      result.runs.push({
        revision: 'head',
        phase: 'initial',
        selected: shard.head,
        output: 'head/initial',
        code: 0,
        elapsedMs: 80,
      });
    }
    await writeJSON(path.join(runnerRoot, 'runner.json'), result);
  }
  return { root, artifacts, manifest };
}
async function outcome(value: Awaited<ReturnType<typeof fixture>>) {
  await mergeShards(value.manifest, value.artifacts, path.join(value.root, 'merged'));
  return JSON.parse(await readFile(path.join(value.root, 'merged/gate.json'), 'utf8'));
}

describe('distributed artifact merger', () => {
  it('merges unique complete parts after the full product validator accepts them', async () => {
    const result = await outcome(await fixture());
    expect(result.passed).toBe(true);
    expect(result.coverage.failures).toEqual([]);
    expect(result.sections.head).toMatchObject({
      catalogExpected: 4,
      catalogMeasured: 4,
      securityExpected: 1,
      securityMeasured: 1,
    });
  });
  it('rejects a missing runner even when all remaining reports are individually valid', async () => {
    const value = await fixture();
    const target = path.resolve(value.artifacts, 'queries-1');
    if (!target.startsWith(value.root + path.sep))
      throw new Error('Unsafe missing-shard fixture cleanup');
    await rm(target, { recursive: true });
    const result = await outcome(value);
    expect(result.passed).toBe(false);
    expect(result.coverage.failures).toContain('Missing queries-1');
  });
  it('rejects duplicate runner artifacts', async () => {
    const value = await fixture();
    await cp(path.join(value.artifacts, 'queries-1'), path.join(value.artifacts, 'duplicate'), {
      recursive: true,
    });
    expect((await outcome(value)).failures).toContain(
      'Invalid or duplicate runner artifact: queries-1'
    );
  });
  it.each(['plan', 'revision', 'correlation', 'extra-phase'] as const)(
    'rejects %s manipulation',
    async failure => {
      const value = await fixture();
      const reportFile = path.join(value.artifacts, 'queries-1/head/initial/report.json');
      const report = JSON.parse(await readFile(reportFile, 'utf8'));
      if (failure === 'plan')
        await writeFile(
          path.join(path.dirname(reportFile), report.measurements[0].plans.joinsArtifact.path),
          '[1]'
        );
      if (failure === 'revision') report.execution.sourceSHA = 'b'.repeat(40);
      if (failure === 'correlation') report.measurements[0].samples[0].api.authMs = 0;
      if (failure === 'extra-phase') {
        const runnerFile = path.join(value.artifacts, 'queries-1/runner.json');
        const runner = JSON.parse(await readFile(runnerFile, 'utf8'));
        runner.runs.push({ ...runner.runs[0], phase: 'confirmation' });
        await writeJSON(runnerFile, runner);
      }
      await writeJSON(reportFile, report);
      const result = await outcome(value);
      expect(result.passed).toBe(false);
      expect(result.failures.join('\n')).toMatch(
        /integrity mismatch|mismatched revision|API correlation|Unexpected or missing measurement phases/
      );
    }
  );
});
