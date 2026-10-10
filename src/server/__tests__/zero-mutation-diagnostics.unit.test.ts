import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  diagnoseMutationTransaction,
  mutationDiagnostic,
  mutationIdentities,
  mutationRegistryNames,
  mutationTransactionIdentity,
  withMutationDiagnostics,
  withMutationTransactionIdentity,
} from '../zero-mutation-diagnostics';
import { afterCommit, withAfterCommit } from '../after-commit';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const identity = {
  clientGroupID: 'group',
  clientID: 'client',
  mutationID: 1,
  name: 'messages.sendMessage',
};
const request = () =>
  new Request('http://localhost/api/mutate', {
    method: 'POST',
    body: JSON.stringify({
      clientGroupID: identity.clientGroupID,
      mutations: [
        {
          id: 1,
          clientID: identity.clientID,
          name: identity.name,
          args: [{ text: 'PRIVATE', password: 'SECRET' }],
        },
      ],
      auth: 'TOKEN',
    }),
  });
describe('mutation diagnostics', () => {
  it.each([
    null,
    'body',
    1,
    {},
    { clientGroupID: 1, mutations: [] },
    { clientGroupID: 'group', mutations: null },
    {
      clientGroupID: 'group',
      mutations: [
        null,
        'mutation',
        {},
        { clientID: 'client', name: 1, id: 1 },
        { clientID: 'client', name: 'valid', id: 1.5 },
        { clientID: 'client', name: 'valid', id: 0 },
      ],
    },
  ])('ignores malformed push identities without exporting their contents: %j', body => {
    expect(mutationIdentities(body)).toEqual([]);
  });
  it('keeps instrumentation transparent when disabled or outside a request', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '');
    expect(await withMutationTransactionIdentity(identity, async () => 'disabled')).toBe(
      'disabled'
    );
    expect(await diagnoseMutationTransaction(async () => 'disabled', identity)).toBe('disabled');
    mutationDiagnostic('ignored', performance.now(), identity);
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    expect(mutationTransactionIdentity()).toBeUndefined();
    expect(await withMutationTransactionIdentity(identity, async () => 'outside')).toBe('outside');
    expect(await diagnoseMutationTransaction(async () => 'outside', identity)).toBe('outside');
    mutationDiagnostic('ignored', performance.now(), identity);
    expect(log).not.toHaveBeenCalled();
    await withMutationDiagnostics(request(), async () => {
      expect(
        await withMutationTransactionIdentity(undefined, async () => mutationTransactionIdentity())
      ).toBeUndefined();
      expect(await diagnoseMutationTransaction(async () => 'without-identity')).toBe(
        'without-identity'
      );
      await withMutationTransactionIdentity(identity, async () => {
        expect(mutationTransactionIdentity()).toEqual(identity);
      });
    });
    expect(log.mock.calls.map(([value]) => JSON.parse(value).phase)).toEqual([
      'arrival',
      'response',
    ]);
  });
  it('preserves malformed request parsing for Zero and exports only fallback identity fields', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const input = new Request('http://localhost/api/mutate', {
      method: 'POST',
      body: 'invalid-json',
    });
    await withMutationDiagnostics(
      input,
      async () => {
        expect(await input.text()).toBe('invalid-json');
        mutationDiagnostic('fallback', performance.now(), {
          ...identity,
          password: 'SECRET',
        } as typeof identity);
      },
      'not-a-registry'
    );
    const records = log.mock.calls.map(([value]) => JSON.parse(value));
    expect(records[0].identities).toEqual([]);
    expect(records[1].identity).toEqual({
      clientGroupID: 'group',
      clientID: 'client',
      mutationID: 1,
    });
    expect(JSON.stringify(records)).not.toContain('SECRET');
  });
  it('matches exact batched identities and sanitizes unmatched transaction identity', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await withMutationDiagnostics(request(), async () => {
      for (const candidate of [
        { ...identity, clientGroupID: 'other' },
        { ...identity, clientID: 'other' },
        { ...identity, mutationID: 2 },
        identity,
      ])
        mutationDiagnostic('identity', performance.now(), candidate);
    });
    const records = log.mock.calls
      .map(([value]) => JSON.parse(value))
      .filter(value => value.phase === 'identity');
    expect(records.slice(0, 3).every(value => value.identity.name === undefined)).toBe(true);
    expect(records[3].identity).toEqual(identity);
  });
  it('ignores non-mutator registry leaves and supports a callable registry exactly once', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(
      mutationRegistryNames({
        missing: () => undefined,
        invalid: Object.assign(() => undefined, { mutatorName: 1 }),
        null: null,
        primitive: 1,
      })
    ).toEqual([]);
    const registry = Object.assign(() => undefined, { mutatorName: 'users.updateProfile' });
    await withMutationDiagnostics(request(), async () => undefined, registry);
    await withMutationDiagnostics(request(), async () => undefined, registry);
    expect(
      log.mock.calls.map(([value]) => JSON.parse(value)).filter(value => value.phase === 'registry')
    ).toHaveLength(1);
  });
  it('discovers composed nested server mutations without repeatedly exporting the registry', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const registry = {
      messages: { send: Object.assign(() => undefined, { mutatorName: 'messages.sendMessage' }) },
      studio: {
        canvas: {
          command: Object.assign(() => undefined, { mutatorName: 'studio.canvas.command' }),
        },
      },
      '~': { private: Object.assign(() => undefined, { mutatorName: 'SECRET' }) },
    };
    await withMutationDiagnostics(request(), async () => 1, registry);
    await withMutationDiagnostics(request(), async () => 2, registry);
    const records = log.mock.calls.map(([value]) => JSON.parse(value));
    expect(records.filter(value => value.phase === 'registry').map(value => value.names)).toEqual([
      ['messages.sendMessage', 'studio.canvas.command'],
    ]);
    expect(records.filter(value => value.phase === 'arrival')).toHaveLength(2);
    expect(records.filter(value => value.phase === 'response')).toHaveLength(2);
  });
  it('does not confirm a request before slow after-commit work finishes', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    let release!: () => void;
    let entered!: () => void;
    const barrier = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    let confirmed = false;
    const pending = withMutationDiagnostics(request(), () =>
      withMutationTransactionIdentity(identity, () =>
        withAfterCommit(() =>
          diagnoseMutationTransaction(async () => {
            afterCommit('independent-notification', async () => {
              entered();
              await barrier;
            });
            return 'persisted';
          }, identity)
        )
      )
    ).then(value => {
      confirmed = true;
      return value;
    });
    await started;
    expect(confirmed).toBe(false);
    expect(log.mock.calls.map(([value]) => JSON.parse(value).phase)).not.toContain('response');
    release();
    expect(await pending).toBe('persisted');
    const phases = log.mock.calls.map(([value]) => JSON.parse(value).phase);
    expect(phases.indexOf('after-commit')).toBeLessThan(phases.indexOf('response'));
  });
  it('only exports non-secret mutation identities', () => {
    expect(
      mutationIdentities({
        clientGroupID: 'group',
        mutations: [{ id: 1, clientID: 'client', name: identity.name, args: ['SECRET'] }],
      })
    ).toEqual([identity]);
  });
  it('does nothing when disabled and preserves the request body', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const input = request();
    await withMutationDiagnostics(input, async () => {
      await input.json();
      return 42;
    });
    expect(log).not.toHaveBeenCalled();
  });
  it('preserves failures and reports actual transaction rollback', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = new Error('PRIVATE');
    await expect(
      withMutationDiagnostics(request(), () =>
        withMutationTransactionIdentity(identity, () =>
          diagnoseMutationTransaction(async () => {
            throw error;
          }, identity)
        )
      )
    ).rejects.toBe(error);
    const records = log.mock.calls.map(([value]) => JSON.parse(value));
    expect(records.find(value => value.phase === 'transaction').outcome).toBe('rolled-back');
    expect(JSON.stringify(records)).not.toMatch(/PRIVATE|SECRET|TOKEN|password|args/);
    expect(records.at(-1).phase).toBe('response');
  });
  it('isolates parallel requests and retains every batched identity', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await Promise.all(
      [1, 2].map(async number =>
        withMutationDiagnostics(
          new Request('http://localhost/api/mutate', {
            method: 'POST',
            body: JSON.stringify({
              clientGroupID: `group-${number}`,
              mutations: [1, 2].map(id => ({
                id,
                clientID: `client-${number}`,
                name: identity.name,
              })),
            }),
          }),
          async () => {
            await Promise.resolve();
            mutationDiagnostic('auth', performance.now());
          }
        )
      )
    );
    const records = log.mock.calls.map(([value]) => JSON.parse(value));
    const arrivals = records.filter(value => value.phase === 'arrival');
    expect(new Set(arrivals.map(value => value.requestID)).size).toBe(2);
    expect(arrivals.every(value => value.identities.length === 2)).toBe(true);
    expect(
      records
        .filter(value => value.phase === 'auth')
        .map(value => value.requestID)
        .sort()
    ).toEqual(arrivals.map(value => value.requestID).sort());
  });
});
