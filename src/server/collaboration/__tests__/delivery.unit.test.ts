import { describe, expect, it, vi } from 'vitest';
import { Connection, Document, type WebSocketLike } from '@hocuspocus/server';
import { installDeliveryGuard, waitForDelivery } from '../delivery';

describe('outgoing collaboration authorization', () => {
  it('delivers ordered batches only while holding current authorization, including sends queued during the check', async () => {
    const socket = { readyState: 1, send: vi.fn() } as unknown as WebSocketLike;
    const doc = new Document('room');
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const authorize = vi.fn(
      async (_actor: string, _id: string, _generation: string, send: () => void) => {
        await gate;
        send();
      }
    );
    const undo = installDeliveryGuard(authorize);
    const connection = new Connection(socket, new Request('http://localhost'), doc, 'socket', {
      userId: 'actor',
      id: 'id',
      generation: 'generation',
      expires: Date.now() + 10000,
    });
    try {
      connection.sendStateless('first');
      await Promise.resolve();
      connection.sendStateless('second');
      expect(socket.send).not.toHaveBeenCalled();
      release();
      await waitForDelivery(connection);
      const output = vi
        .mocked(socket.send)
        .mock.calls.map(([bytes]) => Buffer.from(bytes as Uint8Array).toString('utf8'))
        .join('|');
      expect(output.indexOf('first')).toBeLessThan(output.indexOf('second'));
      expect(authorize).toHaveBeenCalledTimes(1);
      connection.sendStateless('third');
      await waitForDelivery(connection);
      expect(authorize).toHaveBeenCalledTimes(2);
      expect(
        Buffer.from(vi.mocked(socket.send).mock.lastCall![0] as Uint8Array).toString('utf8')
      ).toContain('third');
    } finally {
      release();
      connection.close();
      undo();
      doc.destroy();
    }
  });
  it('closes expired, unidentified and oversized sessions before disclosing queued bytes', async () => {
    for (const context of [
      { userId: '', expires: Date.now() + 10000 },
      { userId: 'actor', expires: 0 },
      { userId: 'actor', expires: Date.now() + 10000 },
    ]) {
      const socket = { readyState: 1, send: vi.fn() } as unknown as WebSocketLike;
      const doc = new Document('room');
      const authorize = vi.fn();
      const undo = installDeliveryGuard(authorize);
      const connection = new Connection(socket, new Request('http://localhost'), doc, 'socket', {
        ...context,
        id: 'id',
        generation: 'generation',
      });
      try {
        connection.send(new Uint8Array(context.userId && context.expires ? 24_000_001 : 1));
        await waitForDelivery(connection);
        expect(authorize).not.toHaveBeenCalled();
        expect(socket.send).toHaveBeenCalledTimes(1);
        connection.sendStateless('must stay private');
        await waitForDelivery(connection);
        expect(socket.send).toHaveBeenCalledTimes(1);
        expect(
          Buffer.from(vi.mocked(socket.send).mock.calls[0][0] as Uint8Array).toString('utf8')
        ).toContain('Access changed');
      } finally {
        connection.close();
        undo();
        doc.destroy();
      }
    }
    await waitForDelivery({} as Connection);
  });
  it('guards constructor awareness and drops queued data when access is revoked', async () => {
    const socket = { readyState: 1, send: vi.fn() } as unknown as WebSocketLike;
    const doc = new Document('room');
    doc.awareness.setLocalState({ user: { name: 'private-user' } });
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let allowed = true;
    const undo = installDeliveryGuard(async (_actor, _id, _generation, send) => {
      await gate;
      if (!allowed) throw new Error('revoked');
      send();
    });
    try {
      const connection = new Connection(socket, new Request('http://localhost'), doc, 'socket', {
        userId: 'actor',
        id: 'id',
        generation: 'gen',
        expires: Date.now() + 10_000,
      });
      connection.sendStateless('private-content');
      expect(socket.send).not.toHaveBeenCalled();
      allowed = false;
      release();
      await waitForDelivery(connection);
      expect(socket.send).toHaveBeenCalledTimes(1);
      const sent = Buffer.from(vi.mocked(socket.send).mock.calls[0][0] as Uint8Array).toString(
        'utf8'
      );
      expect(sent).toContain('Access changed');
      expect(sent).not.toContain('private');
      expect(doc.hasConnection(connection)).toBe(false);
    } finally {
      release();
      undo();
      doc.destroy();
    }
  });
});
