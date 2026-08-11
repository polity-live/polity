import { describe, expect, it, vi } from 'vitest';

import {
  waitForZeroReady,
  ZERO_READY_TIMEOUT_MS,
  zeroReplicaCount,
} from '../../../e2e/fixtures/zero-readiness';

function statz(replicas: number) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => `numReplicas: [\n  {\n    "c": ${replicas}\n  }\n]`,
  };
}

function fakeClock() {
  let current = 0;
  return {
    now: () => current,
    sleep: async (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

describe('Zero E2E readiness', () => {
  it('parses the initialized replica count from statz output', () => {
    expect(zeroReplicaCount('numReplicas: [\n  {\n    "c": 2\n  }\n]')).toBe(2);
    expect(zeroReplicaCount('numReplicas: []')).toBe(0);
  });

  it('waits for both a replica and an active caught-up replication slot', async () => {
    const clock = fakeClock();
    const fetcher = vi.fn().mockResolvedValueOnce(statz(0)).mockResolvedValue(statz(1));
    const database = {
      currentWalLsn: vi.fn().mockResolvedValue('0/1234'),
      replicationStatus: vi
        .fn()
        .mockResolvedValueOnce({ activeSlots: 0, caughtUp: false })
        .mockResolvedValue({ activeSlots: 1, caughtUp: true }),
    };

    await expect(
      waitForZeroReady({ database, fetcher, ...clock, pollIntervalMs: 10, timeoutMs: 100 })
    ).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(database.replicationStatus).toHaveBeenLastCalledWith('0/1234');
  });

  it('recovers from a temporary HTTP error', async () => {
    const clock = fakeClock();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => '',
      })
      .mockResolvedValue(statz(1));
    const database = {
      currentWalLsn: vi.fn().mockResolvedValue('0/5678'),
      replicationStatus: vi.fn().mockResolvedValue({ activeSlots: 1, caughtUp: true }),
    };

    await expect(
      waitForZeroReady({ database, fetcher, ...clock, pollIntervalMs: 10, timeoutMs: 100 })
    ).resolves.toBeUndefined();
  });

  it('reports the last database failure after the readiness deadline', async () => {
    const clock = fakeClock();
    const database = {
      currentWalLsn: vi.fn().mockResolvedValue('0/9ABC'),
      replicationStatus: vi.fn().mockRejectedValue(new Error('replication query unavailable')),
    };

    await expect(
      waitForZeroReady({
        database,
        fetcher: vi.fn().mockResolvedValue(statz(1)),
        ...clock,
        pollIntervalMs: 10,
        timeoutMs: 20,
      })
    ).rejects.toThrow(
      'Zero replica did not become ready within 20ms (last probe: replication query unavailable).'
    );
  });

  it('fails when the replication slot stays inactive and keeps the 120 second default', async () => {
    const clock = fakeClock();
    const database = {
      currentWalLsn: vi.fn().mockResolvedValue('0/DEF0'),
      replicationStatus: vi.fn().mockResolvedValue({ activeSlots: 0, caughtUp: false }),
    };

    expect(ZERO_READY_TIMEOUT_MS).toBe(120_000);
    await expect(
      waitForZeroReady({
        database,
        fetcher: vi.fn().mockResolvedValue(statz(1)),
        ...clock,
        pollIntervalMs: 10,
        timeoutMs: 20,
      })
    ).rejects.toThrow('replicas=1, activeSlots=0, caughtUp=false');
  });
});
