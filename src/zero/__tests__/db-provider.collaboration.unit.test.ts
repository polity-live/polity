import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  initialize: vi.fn(),
  identity: vi.fn(),
  events: [] as string[],
}));
vi.mock('@rocicorp/zero/server/adapters/postgresjs', () => ({
  zeroPostgresJS: () => {
    const connection = {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        io.events.push('begin');
        try {
          const result = await callback({ query: io.query });
          io.events.push('commit');
          return result;
        } catch (error) {
          io.events.push('rollback');
          throw error;
        }
      },
    };
    return {
      connection,
      transaction: (callback: (tx: unknown) => Promise<unknown>, identity: unknown) => {
        io.identity(identity);
        return connection.transaction(callback);
      },
    };
  },
}));
vi.mock('../schema', () => ({ schema: {} }));
vi.mock('@/lib/env', () => ({ getRequiredEnvVar: () => 'local-test' }));
import { dbProvider } from '../db-provider';
import { afterCommit } from '@/server/after-commit';
import { withMutationDiagnostics } from '@/server/zero-mutation-diagnostics';
beforeEach(() => {
  io.events = [];
  io.identity.mockReset();
  io.query.mockReset().mockImplementation(async () => {
    io.events.push('authority');
    return [];
  });
  io.initialize.mockReset().mockImplementation(async () => {
    io.events.push('initialize');
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('acquires authority before domain reads before committing domain writes', async () => {
  const result = await dbProvider.connection.transaction(async () => {
    io.events.push('domain');
    return 'created';
  });
  expect(result).toBe('created');
  expect(io.query).toHaveBeenCalledWith('select pg_advisory_xact_lock($1)', [1886351981]);
  expect(io.events).toEqual(['begin', 'authority', 'domain', 'commit']);
});
it('rolls the transaction back when the domain command fails', async () => {
  await expect(
    dbProvider.connection.transaction(async () => {
      io.events.push('domain');
      throw new Error('write_failed');
    })
  ).rejects.toThrow('write_failed');
  expect(io.events).toEqual(['begin', 'authority', 'domain', 'rollback']);
});
it('forwards mutation identity while preserving authority, commit and delivery ordering', async () => {
  vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
  const logs = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const identity = { clientGroupID: 'group', clientID: 'client', mutationID: 7 };
  const request = new Request('http://localhost/api/mutate', {
    method: 'POST',
    body: JSON.stringify({
      clientGroupID: identity.clientGroupID,
      mutations: [{ clientID: identity.clientID, id: identity.mutationID, name: 'groups.update' }],
    }),
  });
  const result = await withMutationDiagnostics(request, () =>
    dbProvider.transaction(async () => {
      io.events.push('domain');
      afterCommit('delivery', async () => {
        io.events.push('delivery');
      });
      return 'updated';
    }, identity)
  );
  expect(result).toBe('updated');
  expect(io.identity).toHaveBeenCalledExactlyOnceWith(identity);
  expect(io.events).toEqual(['begin', 'authority', 'domain', 'commit', 'delivery']);
  const phases = logs.mock.calls.map(([entry]) => JSON.parse(String(entry)));
  expect(phases.map(entry => entry.phase)).toEqual([
    'arrival',
    'authority-lock',
    'transaction',
    'after-commit',
    'response',
  ]);
  for (const entry of phases.slice(1, 4)) {
    expect(entry.identity).toEqual({ ...identity, name: 'groups.update' });
  }
});
