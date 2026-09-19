import { afterEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@hocuspocus/server';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { commitBeforeSync } from '../protocol';
import type { CollaborationConnectionContext } from '../delivery';
import type { StoredDocument } from '../store';
import { CollaborationError } from '@/features/collaboration/logic/types';

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) await close();
  cleanup.length = 0;
});
async function pair(commit: () => Promise<void>) {
  const durable = new Y.Doc();
  durable.getText('body').insert(0, 'base');
  const id = crypto.randomUUID(),
    generation = crypto.randomUUID();
  let revision = 1;
  const persisted = () => Y.encodeStateAsUpdate(durable);
  const dependencies = {
    committedState: vi.fn(async () => ({
      id,
      generation,
      bytes: Buffer.from(persisted()),
      state: Buffer.from(persisted()).toString('base64'),
      revision,
      checksum: 'proof',
      reference: { kind: 'document' as const, entityId: id, branchId: null, workspaceId: null },
      capabilities: {
        read: true,
        edit: true,
        suggest: true,
        comment: true,
        vote: false,
        manage: true,
      },
      websocket: '',
      room: id,
    })),
    acceptUpdate: vi.fn(
      async (_actor: string, _id: string, _generation: string, update: Uint8Array) => {
        const duplicate = Y.snapshotContainsUpdate(Y.snapshot(durable), update);
        if (!duplicate) {
          await commit();
          Y.applyUpdate(durable, update);
          revision++;
        }
        return {
          document: {
            id,
            generation,
            revision,
            state: persisted(),
            checksum: 'proof',
          } as StoredDocument,
          revisionId: crypto.randomUUID(),
          duplicate,
        };
      }
    ),
  };
  const server = new Server<CollaborationConnectionContext>({
    port: 0,
    address: '127.0.0.1',
    quiet: true,
    stopOnSignals: false,
    onAuthenticate: async () => ({ userId: 'test', id, generation, expires: Date.now() + 60_000 }),
    onLoadDocument: async ({ document }) => {
      Y.applyUpdate(document, persisted());
      return document;
    },
    beforeSync: commitBeforeSync(dependencies),
  });
  await server.listen();
  cleanup.push(async () => {
    await server.destroy();
    durable.destroy();
  });
  const clients = [new Y.Doc(), new Y.Doc()];
  const sockets = clients.map(
    () =>
      new HocuspocusProviderWebsocket({
        url: `ws://127.0.0.1:${server.address.port}`,
        WebSocketPolyfill: WebSocket,
      })
  );
  const providers = clients.map(
    (document, index) =>
      new HocuspocusProvider({
        name: id,
        document,
        token: 'test',
        websocketProvider: sockets[index],
      })
  );
  providers.forEach(provider => provider.attach());
  cleanup.push(() => {
    providers.forEach(p => p.destroy());
    sockets.forEach(s => s.destroy());
    clients.forEach(d => d.destroy());
  });
  await vi.waitFor(
    () => expect(providers.every(p => p.isSynced && !p.hasUnsyncedChanges)).toBe(true),
    { timeout: 5000 }
  );
  dependencies.acceptUpdate.mockClear();
  return { server, clients, providers, durable, dependencies };
}
describe('pinned Hocuspocus commit boundary', () => {
  it('requests a complete state for incomplete deltas without acknowledging or exposing them to peers', async () => {
    const { clients, providers, durable, dependencies } = await pair(async () => {
      throw new CollaborationError('incomplete_update');
    });
    const messages: string[] = [];
    providers[0].on('stateless', ({ payload }: { payload: string }) => messages.push(payload));
    clients[0].getText('body').insert(4, ' uncommitted');
    await vi.waitFor(() =>
      expect(messages.some(m => JSON.parse(m).type === 'resync_required')).toBe(true)
    );
    expect(dependencies.acceptUpdate).toHaveBeenCalled();
    expect(durable.getText('body').toString()).toBe('base');
    expect(clients[1].getText('body').toString()).toBe('base');
    expect(messages.some(m => JSON.parse(m).type === 'committed')).toBe(false);
  });
  it('reconnects after an incomplete delta and commits subsequent edits through the new channel', async () => {
    let rejected = false;
    const { clients, providers, durable } = await pair(async () => {
      if (!rejected) {
        rejected = true;
        throw new CollaborationError('incomplete_update');
      }
    });
    clients[0].getText('body').insert(4, ' during recovery');
    await vi.waitFor(
      () => expect(durable.getText('body').toString()).toBe('base during recovery'),
      {
        timeout: 10000,
      }
    );
    clients[0].getText('body').insert(24, ' afterwards');
    await vi.waitFor(() => {
      expect(clients[1].getText('body').toString()).toBe('base during recovery afterwards');
      expect(providers[0].hasUnsyncedChanges).toBe(false);
    });
  });
  it('does not acknowledge or broadcast an incoming update before commit resolves', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const { clients, providers, durable, dependencies } = await pair(() => gate);
    clients[0].getText('body').insert(4, ' committed');
    await vi.waitFor(() => expect(dependencies.acceptUpdate).toHaveBeenCalled());
    expect(durable.getText('body').toString()).toBe('base');
    expect(clients[1].getText('body').toString()).toBe('base');
    expect(providers[0].hasUnsyncedChanges).toBe(true);
    release();
    await vi.waitFor(() => expect(clients[1].getText('body').toString()).toBe('base committed'));
    await vi.waitFor(() => expect(providers[0].hasUnsyncedChanges).toBe(false));
  });
  it('keeps a rejected update out of both durable state and the peer document', async () => {
    const { clients, durable, dependencies } = await pair(async () => {
      throw new Error('write_denied');
    });
    clients[0].getText('body').insert(0, 'unauthorized ');
    await vi.waitFor(() => expect(dependencies.acceptUpdate).toHaveBeenCalled());
    expect(durable.getText('body').toString()).toBe('base');
    expect(clients[1].getText('body').toString()).toBe('base');
  });
});
