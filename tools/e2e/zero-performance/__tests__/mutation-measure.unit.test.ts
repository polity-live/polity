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
  authenticate: vi.fn(async (_user: unknown) => undefined),
  invoke: vi.fn(),
  ready: vi.fn(async () => undefined),
  requestCompletion: vi.fn(async () => ({
    requestIDs: ['request'],
    observedAt: performance.now(),
  })),
}));
vi.mock('../mutation-request-completion', () => ({
  MutationRequestCompletion: class {
    wait = harness.requestCompletion;
  },
}));
vi.mock('postgres', () => ({ default: vi.fn(() => Object.assign(vi.fn(), { end: harness.end })) }));
vi.mock('../../../../src/zero/schema', () => ({ schema: {} }));
vi.mock('../../../../src/zero/mutators', () => ({
  mutators: { fixture: { update: (args: unknown) => ({ args }) } },
}));
vi.mock('../../../../e2e/fixtures/auth', () => ({
  actorUser: () => ({ namespace: 'unit', actor: 'owner' }),
  ensureE2EAuthUser: harness.authenticate,
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
  waitForZeroReady: harness.ready,
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
      harness.invoke();
      if (harness.mode === 'server-mirrors-local-error-first')
        return {
          client: Promise.resolve().then(() => ({
            type: 'error',
            error: { code: 'permission_denied' },
          })),
          server: Promise.resolve({ type: 'error', error: { code: 'permission_denied' } }),
        };
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
  vi.stubEnv('ZERO_PERFORMANCE_OUTPUT', 'unit-output');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('mutation measurement engine lifecycle', () => {
  it('reports only schema labels from database assertion failures', async () => {
    harness.verify.mockRejectedValueOnce(
      new Error('Database field proof: vote.closing_type\nSECRET SQL row and credentials')
    );
    const { rows, run } = fixture();
    await run();
    expect(rows[0].failures).toContain(
      'Mutation sample 1: independent database verification failed (Database field proof: vote.closing_type)'
    );
    expect(JSON.stringify(rows)).not.toContain('SECRET');
  });
  it('reports only schema labels from rollback assertion failures', async () => {
    harness.mode = 'client-result-error';
    const { entry, rows, run } = fixture();
    const prepare = entry.prepare;
    entry.prepare = async context => ({
      ...(await prepare(context)),
      verifyRollback: async () => {
        throw new Error('Rollback field proof: user.created_at\nSECRET row and credentials');
      },
    });
    await run();
    expect(rows[0].failures).toContain(
      'Mutation sample 1: optimistic rollback verification failed (Rollback field proof: user.created_at)'
    );
    expect(JSON.stringify(rows)).not.toContain('SECRET');
  });
  it('waits for queued API work before SQL verification without moving the SDK confirmation', async () => {
    let complete!: (value: { requestIDs: string[]; observedAt: number }) => void;
    harness.requestCompletion.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    );
    const { rows, run } = fixture();
    const result = run();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.requestCompletion).toHaveBeenCalledOnce();
    const sdkConfirmedAt = rows[0].samples[0].confirmedAt;
    expect(sdkConfirmedAt).toBeTypeOf('number');
    expect(harness.verify).not.toHaveBeenCalled();
    expect(harness.restore).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    const observedAt = performance.now();
    complete({ requestIDs: ['request'], observedAt });
    await result;
    const sample = rows[0].samples[0];
    expect(sample.confirmedAt).toBe(sdkConfirmedAt);
    expect(sample.serverConfirmedMs).toBe(sdkConfirmedAt! - sample.startedAt);
    expect(sample.serverWorkObservedAt).toBe(observedAt);
    expect(sample.completionRequestIDs).toEqual(['request']);
    expect(harness.verify).toHaveBeenCalledTimes(5);
    expect(harness.restore).toHaveBeenCalledTimes(5);
  });
  it('stops without SQL verification or cleanup when API completion is unproved', async () => {
    harness.requestCompletion.mockRejectedValueOnce(new Error('SECRET diagnostic contents'));
    const { rows, run } = fixture();
    await expect(run()).rejects.toThrow('still in flight');
    expect(rows[0].samples).toHaveLength(1);
    expect(rows[0].samples[0].confirmedAt).toBeTypeOf('number');
    expect(rows[0].samples[0].restored).toBe(false);
    expect(rows[0].failures).toEqual(['Mutation sample 1: mutation API completion failed']);
    expect(JSON.stringify(rows)).not.toContain('SECRET');
    expect(harness.verify).not.toHaveBeenCalled();
    expect(harness.restore).not.toHaveBeenCalled();
    expect(harness.clients.every(client => client.close.mock.calls.length === 1)).toBe(true);
  });
  it('exports only the owned restoration proof label without assertion values', async () => {
    harness.verifyRestored.mockRejectedValueOnce(
      new Error('Scope restoration proof: event_activity.event_id\nSECRET SQL row and credentials')
    );
    const { rows, run } = fixture();
    await expect(run()).rejects.toThrow('restoration unproved');
    expect(rows[0].failures).toContain(
      'Mutation fixture restoration independent verification failed (Scope restoration proof: event_activity.event_id)'
    );
    expect(JSON.stringify(rows)).not.toContain('SECRET');
  });
  it.each(['cleanup', 'independent verification', 'WAL replication'])(
    'stops and names the actual failed restoration phase: %s',
    async stage => {
      const failure = Object.assign(new Error('SECRET SQL arguments'), { code: '23503' });
      if (stage === 'cleanup') harness.restore.mockRejectedValueOnce(failure);
      if (stage === 'independent verification')
        harness.verifyRestored.mockRejectedValueOnce(failure);
      if (stage === 'WAL replication')
        harness.ready.mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure);
      const { rows, run } = fixture();
      await expect(run()).rejects.toThrow('restoration unproved');
      expect(rows[0].samples).toHaveLength(1);
      expect(rows[0].samples[0].restored).toBe(false);
      expect(rows[0].failures).toContain(
        `Mutation fixture restoration ${stage} failed (SQLSTATE 23503)`
      );
      expect(JSON.stringify(rows)).not.toContain('SECRET');
      expect(harness.clients).toHaveLength(2);
      expect(harness.clients.every(client => client.close.mock.calls.length === 1)).toBe(true);
    }
  );
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
  it('restores prepared fixtures and closes the writer when constructing its observer fails', async () => {
    harness.mode = 'observer-constructor-fails';
    const { rows, run } = fixture();
    await run();
    expect(harness.clients).toHaveLength(9);
    expect(harness.clients[0].close).toHaveBeenCalledOnce();
    expect(harness.end).toHaveBeenCalledOnce();
    expect(rows[0].samples).toHaveLength(4);
    expect(rows[0].failures).toContain('Mutation sample 1: observer setup failed');
    expect(harness.restore).toHaveBeenCalledTimes(5);
  });
  it('uses an independent client with the writer identity for actor-filtered observations', async () => {
    const { entry, rows } = fixture();
    entry.actor = 'outsider';
    const prepare = entry.prepare;
    entry.prepare = async context => {
      const prepared = await prepare(context);
      prepared.observe!.actor = 'writer';
      return prepared;
    };
    // Match the registry expectation to the changed actor.
    const expectation: MutationExpectation = {
      key: 'mutation/fixture.update/authorized/outsider',
      name: entry.name,
      variant: entry.variant,
      actor: entry.actor,
      outcome: entry.outcome,
      observer: entry.observer,
      oracleDigest: 'a'.repeat(64),
    };
    await measureMutations(
      [entry],
      [expectation],
      undefined,
      rows,
      [],
      async () => undefined,
      () => false
    );
    expect(harness.clients).toHaveLength(10);
    expect(harness.clients.every(client => client.options.userID === 'outsider')).toBe(true);
    expect(rows[0].samples.every(sample => sample.clientID !== sample.observerClientID)).toBe(true);
    expect(rows[0].failures).toEqual([]);
  });
  it('exports only a SQLSTATE and stops when fixture setup cannot prove restoration', async () => {
    const { entry, rows, run } = fixture();
    entry.prepare = async () => {
      throw Object.assign(new Error('SECRET password and SQL parameters'), { code: '22P02' });
    };
    await expect(run()).rejects.toThrow('restoration unproved');
    expect(rows[0].failures).toEqual(['Mutation sample 1: fixture setup failed (SQLSTATE 22P02)']);
    expect(JSON.stringify(rows)).not.toContain('SECRET');
    expect(rows[0].samples).toEqual([]);
    expect(harness.clients[0].close).toHaveBeenCalledOnce();
    expect(harness.end).toHaveBeenCalledOnce();
  });
  it('creates both real authenticated FK parents before an anonymous-first SQL fixture', async () => {
    const { entry, rows } = fixture();
    entry.actor = 'anonymous';
    const prepare = entry.prepare;
    entry.prepare = async context => {
      expect(harness.authenticate.mock.calls.map(([user]) => (user as { id: string }).id)).toEqual([
        'owner',
        'outsider',
      ]);
      return prepare(context);
    };
    const expected: MutationExpectation = {
      key: 'mutation/fixture.update/authorized/anonymous',
      name: entry.name,
      variant: entry.variant,
      actor: entry.actor,
      outcome: entry.outcome,
      observer: entry.observer,
      oracleDigest: 'a'.repeat(64),
    };
    await measureMutations(
      [entry],
      [expected],
      undefined,
      rows,
      [],
      async () => undefined,
      () => false
    );
    expect(rows[0].samples).toHaveLength(5);
    expect(rows[0].failures).toEqual([]);
    expect(harness.authenticate).toHaveBeenCalledTimes(2);
  });
  it('completes additional real writer preloads before revocation and measured invocation', async () => {
    const { entry, rows, run } = fixture();
    const prepare = entry.prepare;
    entry.prepare = async context => ({
      ...(await prepare(context)),
      writerPreloads: [
        {
          request: { name: 'fixture.parent' },
          before: data => (data as { phase: string }).phase === 'before',
        },
      ],
      beforeInvoke: async () => {
        expect(harness.views.length % 3).toBe(0);
      },
    });
    await run();
    expect(harness.views).toHaveLength(15);
    expect(harness.invoke).toHaveBeenCalledTimes(5);
    expect(rows[0].failures).toEqual([]);
  });
  it('never invokes a mutation whose required additional writer preload is incomplete', async () => {
    const { entry, rows, run } = fixture();
    const prepare = entry.prepare;
    entry.prepare = async context => ({
      ...(await prepare(context)),
      writerPreloads: [{ request: { name: 'fixture.parent' }, before: () => false }],
    });
    const result = run();
    await vi.advanceTimersByTimeAsync(75001);
    await result;
    expect(harness.invoke).not.toHaveBeenCalled();
    expect(rows[0].samples).toEqual([]);
    expect(rows[0].failures).toHaveLength(5);
    expect(
      rows[0].failures.every(value =>
        value.includes('additional writer fixture replication failed')
      )
    ).toBe(true);
    expect(harness.restore).toHaveBeenCalledTimes(5);
  });
  it('does not call a mirrored local rejection a server confirmation when the server promise settles first', async () => {
    harness.mode = 'server-mirrors-local-error-first';
    const { rows, run } = fixture();
    await run();
    expect(rows[0].samples).toHaveLength(5);
    for (const sample of rows[0].samples) {
      expect(sample.outcome).toBe('client-error');
      expect(sample.confirmedAt).toBeUndefined();
      expect(sample.serverConfirmedMs).toBeUndefined();
      expect(sample.attempts).toEqual([]);
    }
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
    expect(harness.restore).not.toHaveBeenCalled();
    expect(harness.verify).not.toHaveBeenCalled();
    expect(harness.clients).toHaveLength(2);
    harness.lateResolve?.({ type: 'success' });
    await Promise.resolve();
    expect(rows[0].samples[0].restored).toBe(false);
    expect(harness.clients).toHaveLength(2);
  });
  it('rechecks a complete no-op state after start and retains server, SQL and restoration proofs', async () => {
    harness.mode = 'prestart-only';
    await vi.advanceTimersByTimeAsync(7);
    const { rows, run } = fixture();
    const result = run();
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(rows[0].samples).toHaveLength(5);
    expect(
      rows[0].samples.every(
        sample =>
          typeof sample.observedAt === 'number' &&
          sample.observedAt >= sample.startedAt &&
          sample.observedAt > 0 &&
          sample.confirmedAt !== undefined &&
          sample.databaseVerified &&
          sample.rollbackVerified &&
          sample.restored
      )
    ).toBe(true);
    expect(rows[0].failures).toEqual([]);
    expect(harness.verify).toHaveBeenCalledTimes(5);
    expect(harness.restore).toHaveBeenCalledTimes(5);
  });
});
