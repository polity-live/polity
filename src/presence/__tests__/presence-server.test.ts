import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handlePresenceConnection } from '../presence-server';

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  listeners = new Map<string, (event: any) => void>();

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, listener);
  }

  send(data: string) {
    this.sent.push(data);
  }

  message(message: unknown) {
    this.listeners.get('message')?.({ data: JSON.stringify(message) });
  }

  close() {
    this.listeners.get('close')?.({});
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', { OPEN: 1 });
});

describe('handlePresenceConnection', () => {
  it('shares peer snapshots and broadcasts join, update, publish, and leave lifecycle events', () => {
    const first = new FakeSocket();
    const second = new FakeSocket();
    handlePresenceConnection(first as any);
    handlePresenceConnection(second as any);

    first.message({
      type: 'join',
      room: 'editor:doc-1',
      peer: { userId: 'user-1', name: 'Ada', color: 'red' },
    });
    second.message({
      type: 'join',
      room: 'editor:doc-1',
      peer: { userId: 'user-2', name: 'Grace', color: 'blue' },
    });
    expect(JSON.parse(second.sent[0]).peers).toHaveLength(2);
    expect(first.sent.map(value => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: 'join', peer: expect.objectContaining({ userId: 'user-2' }) })
    );

    second.message({
      type: 'update',
      room: 'ignored',
      peer: { userId: 'user-2', name: 'Rear Admiral Grace', color: 'blue' },
    });
    second.message({ type: 'publish', room: 'ignored', topic: 'cursor', data: { color: 'blue' } });
    expect(first.sent.map(value => JSON.parse(value))).toContainEqual(
      expect.objectContaining({
        type: 'update',
        peer: expect.objectContaining({ name: 'Rear Admiral Grace' }),
      })
    );
    expect(first.sent.map(value => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: 'publish', topic: 'cursor', data: { color: 'blue' } })
    );

    second.close();
    expect(first.sent.map(value => JSON.parse(value))).toContainEqual(
      expect.objectContaining({
        type: 'leave',
        peer: expect.objectContaining({ userId: 'user-2' }),
      })
    );
    first.close();
  });

  it('ignores malformed lifecycle order, absent join peers, and non-open recipients', () => {
    const socket = new FakeSocket();
    const closedRecipient = new FakeSocket();
    closedRecipient.readyState = 0;
    handlePresenceConnection(socket as any);
    handlePresenceConnection(closedRecipient as any);
    socket.message({ type: 'update', room: 'room-1', peer: { name: 'Ignored' } });
    socket.message({ type: 'publish', room: 'room-1', topic: 'ignored' });
    socket.message({ type: 'join', room: 'room-1' });
    closedRecipient.message({
      type: 'join',
      room: 'room-1',
      peer: { userId: 'closed', name: 'Closed', color: 'gray' },
    });
    expect(socket.sent).toEqual([]);
    socket.close();
    closedRecipient.close();
  });

  it('handles messages and repeated closes after peers have left', () => {
    const survivor = new FakeSocket();
    const departing = new FakeSocket();
    handlePresenceConnection(survivor as any);
    handlePresenceConnection(departing as any);
    survivor.message({
      type: 'join',
      room: 'room-edge',
      peer: { userId: 'survivor', name: 'Survivor', color: 'green' },
    });
    departing.message({
      type: 'join',
      room: 'room-edge',
      peer: { userId: 'departing', name: 'Departing', color: 'blue' },
    });
    departing.message({ type: 'update', room: 'ignored' });
    departing.close();
    departing.message({
      type: 'update',
      room: 'ignored',
      peer: { userId: 'departing', name: 'Late', color: 'gray' },
    });
    departing.message({ type: 'publish', room: 'ignored', topic: 'late', data: {} });
    departing.close();
    survivor.close();
    survivor.message({
      type: 'update',
      room: 'ignored',
      peer: { userId: 'survivor', name: 'Late', color: 'gray' },
    });
    survivor.message({ type: 'publish', room: 'ignored', topic: 'after-room-delete' });
    survivor.close();
  });
});
