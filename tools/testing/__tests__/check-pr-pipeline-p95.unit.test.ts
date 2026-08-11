import { describe, expect, it, vi } from 'vitest';
import {
  evaluatePrPipelineP95,
  nearestRankPercentile,
  parsePrPipelineP95Options,
  runPrPipelineP95Cli,
} from '../check-pr-pipeline-p95.mjs';

function successfulRun(id: number, durationSeconds: number, completedOffsetMinutes = id) {
  const completedAt = new Date(Date.UTC(2026, 0, 2, 0, completedOffsetMinutes));
  const startedAt = new Date(completedAt.getTime() - durationSeconds * 1000);
  return {
    id,
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    run_started_at: startedAt.toISOString(),
    updated_at: completedAt.toISOString(),
  };
}

describe('PR pipeline P95 gate', () => {
  it('uses deterministic nearest-rank P95 and accepts the exact 900-second boundary', () => {
    const durations = [...Array.from({ length: 18 }, (_, index) => 100 + index), 900, 1200];
    const result = evaluatePrPipelineP95(
      { workflow_runs: durations.map((duration, index) => successfulRun(index, duration)) },
      { thresholdSeconds: 900, minSamples: 20, maxSamples: 50 }
    );

    expect(nearestRankPercentile(durations, 0.95)).toBe(900);
    expect(result).toMatchObject({ status: 'pass', sampleCount: 20, p95Seconds: 900 });
  });

  it('fails when P95 is even one second above the limit', () => {
    const durations = [...Array.from({ length: 18 }, () => 300), 901, 1200];

    const workflowRuns = durations.map((duration, index) => successfulRun(index, duration));

    expect(
      evaluatePrPipelineP95(
        { workflow_runs: workflowRuns },
        { thresholdSeconds: 900, minSamples: 20, maxSamples: 50 }
      )
    ).toMatchObject({ status: 'over-threshold', p95Seconds: 901 });

    expect(
      runPrPipelineP95Cli({
        argv: ['--input', 'fixture.json'],
        readFile: () => JSON.stringify({ workflow_runs: workflowRuns }),
        stdout: vi.fn(),
        stderr: vi.fn(),
      })
    ).toBe(1);
  });

  it('uses only the latest configured window of completed successful PR runs', () => {
    const eligible = Array.from({ length: 55 }, (_, index) =>
      successfulRun(index, index < 5 ? 2000 : 300, index)
    );
    const ignored = [
      { ...successfulRun(100, 300), conclusion: 'failure' },
      { ...successfulRun(101, 300), status: 'in_progress', conclusion: null },
      { ...successfulRun(102, 300), event: 'push' },
    ];

    expect(
      evaluatePrPipelineP95(
        { workflow_runs: [...ignored, ...eligible] },
        { thresholdSeconds: 900, minSamples: 20, maxSamples: 50 }
      )
    ).toMatchObject({ status: 'pass', sampleCount: 50, p95Seconds: 300 });
  });

  it('returns a non-green insufficient-samples result', () => {
    const runs = Array.from({ length: 19 }, (_, index) => successfulRun(index, 300));
    const stderr = vi.fn();
    const stdout = vi.fn();

    const exitCode = runPrPipelineP95Cli({
      argv: ['--input', 'fixture.json'],
      readFile: () => JSON.stringify({ workflow_runs: runs }),
      stdout,
      stderr,
    });

    expect(exitCode).toBe(2);
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({
      status: 'insufficient-samples',
      sampleCount: 19,
      minSamples: 20,
    });
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('19/20'));
  });

  it('fails closed for malformed qualifying records and conflicting duplicates', () => {
    const malformed = { ...successfulRun(1, 300), updated_at: 'not-a-date' };
    expect(() => evaluatePrPipelineP95({ workflow_runs: [malformed] })).toThrow(
      'invalid timestamps'
    );

    expect(() =>
      evaluatePrPipelineP95({
        workflow_runs: [successfulRun(7, 300), successfulRun(7, 301)],
      })
    ).toThrow('Conflicting records');
  });

  it('validates CLI limits and accepts both named-option forms', () => {
    expect(
      parsePrPipelineP95Options([
        '--input=runs.json',
        '--threshold-seconds=900',
        '--min-samples',
        '20',
        '--max-samples',
        '50',
      ])
    ).toMatchObject({ thresholdSeconds: 900, minSamples: 20, maxSamples: 50 });
    expect(() =>
      parsePrPipelineP95Options([
        '--input',
        'runs.json',
        '--min-samples',
        '51',
        '--max-samples',
        '50',
      ])
    ).toThrow('cannot exceed');
  });
});
