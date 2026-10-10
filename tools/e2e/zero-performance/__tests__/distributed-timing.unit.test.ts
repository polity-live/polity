import { describe, expect, it, vi } from 'vitest';
import { activeTiming, nativeTiming, type JobTiming } from '../distributed-timing';
import { measurementDeadlineMs, stopOwnedSessions } from '../distributed-runner';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const stamp = (minutes: number) => new Date(Date.UTC(2026, 9, 10, 0, minutes)).toISOString();
const job = (name: string, start: number, end: number): JobTiming => ({
  name,
  started_at: stamp(start),
  completed_at: stamp(end),
  steps: [{ name: 'Upload diagnostics', started_at: stamp(end - 1), completed_at: stamp(end) }],
});

describe('active Zero CI budget', () => {
  it('keeps the fifteen-minute budget while leaving confirmation time before cleanup', () => {
    const setupMs = 30_000;
    expect(measurementDeadlineMs(setupMs) + setupMs + 45_000).toBe(900_000);
    expect(measurementDeadlineMs(900_000)).toBe(1);
    expect(827_383 + 21_844).toBeLessThan(measurementDeadlineMs(0));
  });
  it('stops both independent stacks concurrently and waits for both exits', async () => {
    vi.useFakeTimers();
    try {
      let stopped = 0;
      const stop = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 18_000));
        stopped++;
      });
      const pending = stopOwnedSessions([{ stop }, { stop }], true);
      expect(stop).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(18_000);
      expect(await pending).toEqual([]);
      expect(stopped).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it('retains every cleanup failure even when another stack exits successfully', async () => {
    expect(
      await stopOwnedSessions([
        {
          stop: async () => {
            throw new Error('head failed');
          },
        },
        { stop: async () => undefined },
        {
          stop: async () => {
            throw new Error('base failed');
          },
        },
      ])
    ).toEqual(['Error: head failed', 'Error: base failed']);
  });
  it('uses serial session cleanup on hosts without the Linux prune lock', async () => {
    vi.useFakeTimers();
    try {
      const stop = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 18_000));
      });
      const pending = stopOwnedSessions([{ stop }, { stop }], false);
      expect(stop).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(18_000);
      expect(stop).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(18_000);
      expect(await pending).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
  it('accepts all exact boundaries and rejects any phase overrunning its allowance', () => {
    expect(activeTiming(180_000, 900_000, 120_000)).toMatchObject({
      activeMs: 1_200_000,
      failed: false,
    });
    expect(activeTiming(180_001, 100, 100).failed).toBe(true);
    expect(activeTiming(100, 900_001, 100).failed).toBe(true);
    expect(activeTiming(100, 100, 120_001).failed).toBe(true);
    for (const invalid of [NaN, Infinity, -1])
      expect(activeTiming(invalid, 100, 100).failed).toBe(true);
  });
  it('excludes a long GitHub wait and includes artifacts in the longest active job', () => {
    const value = nativeTiming(
      [
        job('Zero preparation', 0, 3),
        job('Zero measurements / queries-01', 63, 78),
        job('Zero measurements / queries-02', 4, 14),
      ],
      120_000,
      ['queries-01', 'queries-02']
    );
    expect(value.activeMs).toBe(1_200_000);
    expect(value.failed).toBe(false);
    expect(value.queueByRunnerMs[0].queuedMs).toBe(60 * 60_000);
    expect(value.artifactByRunnerMs[0].artifactMs).toBe(60_000);
  });
  it('rejects missing, repeated, unfinished and substituted jobs', () => {
    const preparation = job('Zero preparation', 0, 3),
      runner = job('Zero measurements / a', 3, 10);
    for (const jobs of [
      [preparation],
      [preparation, runner, runner],
      [preparation, job('Zero measurements / foreign', 3, 10)],
    ])
      expect(() => nativeTiming(jobs, 100, ['a'])).toThrow();
    expect(nativeTiming([preparation, { ...runner, completed_at: '' }], 100, ['a']).failed).toBe(
      true
    );
  });
  it('keeps the required gate name, 20 isolated standard runners and independent CI jobs', () => {
    const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    const prepare = workflow.jobs['zero-performance-prepare'],
      runners = workflow.jobs['zero-performance-shards'],
      gate = workflow.jobs['zero-query-performance'];
    expect(workflow.on.workflow_dispatch.inputs.zero_baseline_ref.required).toBe(false);
    expect(
      prepare.steps.find((step: any) => step.id === 'prepare').env.ZERO_PERFORMANCE_BASE_REF
    ).toContain('inputs.zero_baseline_ref');
    expect(prepare['runs-on']).toBe('ubuntu-24.04');
    expect(runners['runs-on']).toBe('ubuntu-24.04');
    expect(runners.strategy['max-parallel']).toBe(20);
    expect(runners.strategy['fail-fast']).toBe(false);
    expect(gate.name).toBe('Zero Query Performance');
    expect(gate.if).toBe('always()');
    expect([
      prepare['timeout-minutes'],
      runners['timeout-minutes'],
      gate['timeout-minutes'],
    ]).toEqual([3, 15, 2]);
    for (const [key, value] of Object.entries(workflow.jobs) as [string, any][])
      if (!key.startsWith('zero-'))
        expect(JSON.stringify(value.needs ?? [])).not.toContain('zero-');
  });
});
