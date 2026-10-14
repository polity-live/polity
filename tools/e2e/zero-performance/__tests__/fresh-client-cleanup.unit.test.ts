import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Zero } from '@rocicorp/zero';
import { schema } from '../../../../src/zero/schema';
import { deleteFreshBenchmarkClient } from '../fresh-client-cleanup';

describe('disposable benchmark client storage', () => {
  it.each([{ userID: 'benchmark-storage-owner' }, { userID: undefined }])(
    'drops the real named MemStore retained by close while preserving another fresh client: $userID',
    async ({ userID }) => {
      const require = createRequire(import.meta.url);
      const modulePath = path.resolve(
        path.dirname(require.resolve('@rocicorp/zero')),
        '../../replicache/src/kv/mem-store.js'
      );
      const { MemStore } = await import(pathToFileURL(modulePath).href);
      const clients = Array.from(
        { length: 2 },
        () =>
          new Zero<typeof schema>({
            schema,
            userID,
            context: { userID: userID ?? 'anon', email: '' },
            storageKey: `benchmark-${randomUUID()}`,
            cacheURL: null,
            kvStore: 'mem',
            logLevel: 'error',
          })
      );
      const marker = 'benchmark-lifecycle-proof';
      const deleted = new Set<Zero<typeof schema>>();
      async function readMarker(name: string) {
        const store = new MemStore(name);
        const read = await store.read();
        try {
          return await read.get(marker);
        } finally {
          read.release();
          await store.close();
        }
      }
      try {
        await Promise.all(clients.map(client => client.clientGroupID));
        expect(clients[0].idbName).not.toBe(clients[1].idbName);
        for (const client of clients) {
          const store = new MemStore(client.idbName);
          const write = await store.write();
          await write.put(marker, { ownedStorage: client.storageKey });
          await write.commit();
          await store.close();
        }
        await clients[0].close();
        expect(await readMarker(clients[0].idbName)).toEqual({
          ownedStorage: clients[0].storageKey,
        });
        await deleteFreshBenchmarkClient(clients[0]);
        deleted.add(clients[0]);
        expect(clients[0].closed).toBe(true);
        expect(await readMarker(clients[0].idbName)).toBeUndefined();
        expect(await readMarker(clients[1].idbName)).toEqual({
          ownedStorage: clients[1].storageKey,
        });
      } finally {
        await Promise.all(
          clients.filter(client => !deleted.has(client)).map(deleteFreshBenchmarkClient)
        );
      }
    }
  );

  it('rejects returned deletion errors instead of accepting incomplete cleanup', async () => {
    const failure = new Error('Owned storage deletion failed');
    const client = { idbName: 'owned', delete: async () => ({ deleted: [], errors: [failure] }) };
    await expect(deleteFreshBenchmarkClient(client)).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [failure],
    });
  });

  it('propagates an SDK deletion rejection', async () => {
    const failure = new Error('SDK deletion rejected');
    const client = {
      idbName: 'owned',
      delete: async () => {
        throw failure;
      },
    };
    await expect(deleteFreshBenchmarkClient(client)).rejects.toBe(failure);
  });

  it.each([{ deleted: [] }, { deleted: ['different-storage'] }])(
    'rejects deletion without the registered own database: $deleted',
    async ({ deleted }) => {
      await expect(
        deleteFreshBenchmarkClient({
          idbName: 'owned',
          delete: async () => ({ deleted, errors: [] }),
        })
      ).rejects.toThrow('did not delete its own registered database');
    }
  );
});
