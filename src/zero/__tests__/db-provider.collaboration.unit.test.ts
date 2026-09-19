import { beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ query: vi.fn(), initialize: vi.fn(), events: [] as string[] }));
vi.mock('@rocicorp/zero/server/adapters/postgresjs', () => ({
  zeroPostgresJS: () => ({
    connection: {
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
    },
  }),
}));
vi.mock('../schema', () => ({ schema: {} }));
vi.mock('@/lib/env', () => ({ getRequiredEnvVar: () => 'local-test' }));
vi.mock('@/server/collaboration/finalize', () => ({
  initializeTransactionDocuments: io.initialize,
}));
import { dbProvider } from '../db-provider';
beforeEach(() => {
  io.events = [];
  io.query.mockReset().mockImplementation(async () => {
    io.events.push('authority');
    return [];
  });
  io.initialize.mockReset().mockImplementation(async () => {
    io.events.push('initialize');
  });
});
it('acquires authority before domain reads and initializes new documents before the same commit', async () => {
  const result = await dbProvider.connection.transaction(async () => {
    io.events.push('domain');
    return 'created';
  });
  expect(result).toBe('created');
  expect(io.query).toHaveBeenCalledWith('select pg_advisory_xact_lock($1)', [1886351981]);
  expect(io.events).toEqual(['begin', 'authority', 'domain', 'initialize', 'commit']);
});
it('rolls the entire creation back if shared state initialization fails', async () => {
  io.initialize.mockRejectedValue(new Error('integrity_failure'));
  await expect(
    dbProvider.connection.transaction(async () => {
      io.events.push('domain');
    })
  ).rejects.toThrow('integrity_failure');
  expect(io.events).toEqual(['begin', 'authority', 'domain', 'rollback']);
});
