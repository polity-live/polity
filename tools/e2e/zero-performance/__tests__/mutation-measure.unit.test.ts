import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationCase } from '../mutation-case-types';
import type { MutationExpectation, MutationMeasurement } from '../mutation-metrics';

const harness = vi.hoisted(() => ({
  clients: [] as {
    clientID: string;
    clientGroupID: string;
    close: ReturnType<typeof vi.fn>;
    options: Record<string, unknown>;
  }[],
  views: [] as { emit: (data: unknown) => void }[],
  mode: 'success',
  constructs: 0,
  end: vi.fn(async () => undefined),
  restore: vi.fn(async () => undefined),
  verify: vi.fn(async () => undefined),
  verifyRestored: vi.fn(async () => undefined),
  lateResolve: undefined as undefined | ((value: unknown) => void),
}));
vi.mock('postgres', () => ({ default: vi.fn(() => Object.assign(vi.fn(), { end: harness.end })) }));
vi.mock('../../../../src/zero/schema', () => ({ schema: {} }));
vi.mock('../../../../src/zero/mutators', () => ({
  mutators: { fixture: { update: (args: unknown) => ({ args }) } },
}));
vi.mock('../../../../e2e/fixtures/auth', () => ({
  actorUser: () => ({ namespace: 'unit', actor: 'owner' }),
  ensureE2EAuthUser: async () => undefined,
}));
vi.mock('../../../../e2e/fixtures/domains/datasets', () => ({
  getLocalActorAccessToken: async () =>
    `header.${Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url')}.signature`,
}));
vi.mock('../catalog', () => ({
  OWNER: { userID: 'owner', email: 'owner@example.invalid' },
  OUTSIDER: { userID: 'outsider', email: 'outsider@example.invalid' },
}));
vi.mock('../../../../e2e/fixtures/zero-readiness', () => ({
  waitForZeroReady: async () => undefined,
}));
vi.mock('../mutation-snapshot', () => ({
  watchMutationSnapshot: () => ({
    promise: Promise.resolve({ at: performance.now(), mutationID: 1 }),
    cancel: vi.fn(),
  }),
  waitForRollback: async () => undefined,
}));
vi.mock('@rocicorp/zero', () => ({
  Zero: class {
    clientID: string;
    clientGroupID: string;
    options: Record<string, unknown>;
    close = vi.fn(async () => undefined);
    connection = { state: { current: { name: 'connected' } } };
    constructor(options: Record<string, unknown>) {
      const index = harness.constructs++;
      if (harness.mode === 'observer-constructor-fails' && index === 1)
        throw new Error('Observer setup failed');
      this.options = options;
      this.clientID = `client-${index}`;
      this.clientGroupID = `group-${index}`;
      harness.clients.push(this);
    }
    materialize() {
      let data: unknown = { phase: 'before' };
      const listeners = new Set<(data: unknown, type: string) => void>();
      const view = {
        addListener: (listener: (data: unknown, type: string) => void) => {
          listeners.add(listener);
          listener(data, 'complete');
          return () => listeners.delete(listener);
        },
        destroy: vi.fn(() => listeners.clear()),
        emit: (next: unknown) => {
          data = next;
          for (const listener of listeners) listener(data, 'complete');
        },
      };
      harness.views.push(view);
      return view;
    }
    mutate() {
      if (harness.mode === 'client-result-error')
        return {
          client: Promise.resolve({ type: 'error', error: { code: 'permission_denied' } }),
          server: Promise.resolve({ type: 'success' }),
        };
      if (harness.mode === 'late-server')
        return {
          client: Promise.resolve({ type: 'success' }),
          server: new Promise(resolve => {
            harness.lateResolve = resolve;
          }),
        };
      if (harness.mode !== 'prestart-only')
        for (const view of harness.views) view.emit({ phase: 'after' });
      return {
        client: Promise.resolve({ type: 'success' }),
        server: Promise.resolve({ type: 'success' }),
      };
    }
  },
}));

import { measureMutations } from '../mutation-measure';
import { mutationFailures } from '../mutation-metrics';

function fixture() {
  const entry: MutationCase = {
    name: 'fixture.update',
    variant: 'authorized',
    actor: 'owner',
    outcome: 'success',
    observer: { query: 'fixture.byId' },
    specification: { oracle: 'explicit phase transition' },
    prepare: vi.fn(async () => ({
      args: { id: 'fixture' },
      observe: {
        request: { name: 'fixture.byId' },
        before: () => true,
        after: (data: unknown) =>
          harness.mode === 'prestart-only' || (data as { phase: string }).phase === 'after',
      },
      verify: harness.verify,
      restore: harness.restore,
      verifyRestored: harness.verifyRestored,
    })),
  };
  const expectation: MutationExpectation = {
    key: 'mutation/fixture.update/authorized/owner',
    name: entry.name,
    variant: entry.variant,
    actor: entry.actor,
    outcome: entry.outcome,
    observer: entry.observer,
    oracleDigest: 'a'.repeat(64),
  };
  const rows: MutationMeasurement[] = [];
  return {
    entry,
    rows,
    run: () =>
      measureMutations(
        [entry],
        [expectation],
        undefined,
        rows,
        [],
        async () => undefined,
        () => false
      ),
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
  harness.clients = [];
  harness.views = [];
  harness.mode = 'success';
  harness.constructs = 0;
  harness.lateResolve = undefined;
  vi.clearAllMocks();
  vi.stubEnv('E2E_DATABASE_URL', 'postgres://mock.invalid/isolated-unit');
  vi.stubEnv('VITE_ZERO_CACHE_URL', 'http://mock.invalid');
  vi.stubEnv('VITE_APP_URL', 'http://mock.invalid');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('mutation measurement engine lifecycle', () => {
  it('creates five independent writer/observer pairs and closes every client', async () => {
    const { entry, rows, run } = fixture();
    await run();
    expect(entry.prepare).toHaveBeenCalledTimes(5);
    expect(harness.clients).toHaveLength(10);
    expect(new Set(harness.clients.map(client => client.options.storageKey)).size).toBe(10);
    expect(
      new Set(rows[0].samples.flatMap(sample => [sample.clientID, sample.observerClientID])).size
    ).toBe(10);
    expect(rows[0].samples).toHaveLength(5);
    expect(rows[0].failures).toEqual([]);
    expect(
      rows[0].samples.every(
        sample => sample.outcome === 'success' && sample.restored && sample.databaseVerified
      )
    ).toBe(true);
    for (const client of harness.clients) expect(client.close).toHaveBeenCalledOnce();
    expect(harness.end).toHaveBeenCalledOnce();
  });
  it('records resolved client error results as errors and fails a success expectation', async () => {
    harness.mode = 'client-result-error';
    const { rows, run } = fixture();
    await run();
    expect(rows[0].samples).toHaveLength(5);
    expect(
      rows[0].samples.every(
        sample => sample.outcome === 'client-error' && sample.error === 'permission_denied'
      )
    ).toBe(true);
    expect(rows[0].samples.every(sample => sample.confirmedAt === undefined)).toBe(true);
    expect(mutationFailures(rows[0])).toContain('Unexpected mutation outcome');
  });
  it('closes the writer when constructing its observer fails', async () => {
    harness.mode = 'observer-constructor-fails';
    const { rows, run } = fixture();
    await expect(run()).rejects.toThrow('restoration unproved');
    expect(harness.clients).toHaveLength(1);
    expect(harness.clients[0].close).toHaveBeenCalledOnce();
    expect(harness.end).toHaveBeenCalledOnce();
    expect(rows[0].samples).toEqual([]);
    expect(harness.restore).not.toHaveBeenCalled();
  });
  it('stops after an unsettled server deadline and never guesses a client rejection or proves restoration', async () => {
    harness.mode = 'late-server';
    const { rows, run } = fixture();
    const result = run();
    const rejection = expect(result).rejects.toThrow('still in flight');
    await vi.advanceTimersByTimeAsync(15001);
    await rejection;
    expect(rows[0].samples).toHaveLength(1);
    expect(rows[0].samples[0].restored).toBe(false);
    expect(rows[0].samples[0].outcome).toBe('success');
    expect(rows[0].samples[0].confirmedAt).toBeUndefined();
    expect(harness.restore).toHaveBeenCalledOnce();
    expect(harness.verify).not.toHaveBeenCalled();
    expect(harness.clients).toHaveLength(2);
    harness.lateResolve?.({ type: 'success' });
    await Promise.resolve();
    expect(rows[0].samples[0].restored).toBe(false);
    expect(harness.clients).toHaveLength(2);
  });
  it('does not let an eager pre-start matching callback satisfy success observation', async () => {
    harness.mode = 'prestart-only';
    const { rows, run } = fixture();
    const result = run();
    await vi.advanceTimersByTimeAsync(75001);
    await result;
    expect(rows[0].samples).toHaveLength(5);
    expect(rows[0].samples.every(sample => sample.observedAt === undefined)).toBe(true);
    expect(rows[0].failures).toHaveLength(5);
    expect(rows[0].failures.every(message => message.includes('observer replication failed'))).toBe(
      true
    );
    expect(harness.restore).toHaveBeenCalledTimes(5);
  });
});
