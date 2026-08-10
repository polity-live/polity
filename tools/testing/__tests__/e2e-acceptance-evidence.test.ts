import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createAcceptanceIteration,
  recordAcceptanceIteration,
  validateAcceptanceEvidence,
} from '../e2e-acceptance-evidence.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const temporaryDirectories: string[] = [];

function iteration(
  suite: 'critical-repeat' | 'cold-stack',
  index: number,
  overrides: Record<string, unknown> = {}
) {
  return createAcceptanceIteration({
    suite,
    iteration: index,
    runId: `${suite}-run-${index}`,
    stackRunId:
      suite === 'cold-stack' ? `cold-stack-${index}` : `critical-stack-${Math.ceil(index / 5)}`,
    commitSha: SHA,
    status: 'passed',
    startedAtMs: 1_800_000_000_000 + index * 10_000,
    completedAtMs: 1_800_000_005_000 + index * 10_000,
    freshStack: suite === 'cold-stack' ? 'true' : 'false',
    ...overrides,
  });
}

function document(
  suite: 'critical-repeat' | 'cold-stack',
  iterations: ReturnType<typeof iteration>[]
) {
  return {
    schemaVersion: 1,
    suite,
    expectedIterations: suite === 'critical-repeat' ? 20 : 30,
    workflow: {
      repository: 'polity-live/polity',
      runId: '1234',
      runAttempt: 1,
      commitSha: SHA,
    },
    iterations,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('E2E acceptance evidence', () => {
  it.each([
    ['critical-repeat', 20],
    ['cold-stack', 30],
  ] as const)('accepts exactly %s green independent iterations', (suite, count) => {
    const proof = validateAcceptanceEvidence(
      [
        document(
          suite,
          Array.from({ length: count }, (_, index) => iteration(suite, index + 1))
        ),
      ],
      { suite, commitSha: SHA }
    );

    expect(proof).toMatchObject({
      suite,
      expectedIterations: count,
      status: 'passed',
      workflow: { commitSha: SHA },
    });
    expect(proof.iterations).toHaveLength(count);
  });

  it.each([
    ['a missing iteration', (rows: any[]) => rows.slice(0, -1), /29\/30|missing iteration 30/u],
    [
      'a duplicate iteration',
      (rows: any[]) => [...rows.slice(0, -1), { ...rows[0], runId: 'different-run' }],
      /duplicate iteration 1|missing iteration 30/u,
    ],
    [
      'a duplicate run id',
      (rows: any[]) =>
        rows.map((row, index) => (index === 1 ? { ...row, runId: rows[0].runId } : row)),
      /duplicate runId/u,
    ],
    [
      'a mixed commit',
      (rows: any[]) =>
        rows.map((row, index) => (index === 2 ? { ...row, commitSha: 'f'.repeat(40) } : row)),
      /mixed commit SHA/u,
    ],
    [
      'a failed result',
      (rows: any[]) => rows.map((row, index) => (index === 3 ? { ...row, status: 'failed' } : row)),
      /status must be passed/u,
    ],
    [
      'a reused cold stack',
      (rows: any[]) =>
        rows.map((row, index) => (index === 4 ? { ...row, freshStack: false } : row)),
      /requires a fresh stack/u,
    ],
  ])('rejects %s', (_label, mutate, message) => {
    const rows = Array.from({ length: 30 }, (_, index) => iteration('cold-stack', index + 1));
    expect(() =>
      validateAcceptanceEvidence([document('cold-stack', mutate(rows))], {
        suite: 'cold-stack',
        commitSha: SHA,
      })
    ).toThrow(message);
  });

  it('records shard evidence while rejecting duplicate iteration numbers', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'polity-e2e-evidence-'));
    temporaryDirectories.push(directory);
    const file = path.join(directory, 'critical-shard-1.json');
    const options = {
      suite: 'critical-repeat',
      iteration: 1,
      runId: 'critical-run-1',
      stackRunId: 'critical-stack-1',
      commitSha: SHA,
      status: 'passed',
      startedAtMs: 1_800_000_000_000,
      completedAtMs: 1_800_000_005_000,
      freshStack: 'false',
      repository: 'polity-live/polity',
      workflowRunId: '1234',
      workflowRunAttempt: 1,
    };

    const evidence = await recordAcceptanceIteration(file, options);
    expect(evidence.iterations).toHaveLength(1);
    await expect(recordAcceptanceIteration(file, options)).rejects.toThrow(
      /duplicate iteration 1/u
    );
  });
});
