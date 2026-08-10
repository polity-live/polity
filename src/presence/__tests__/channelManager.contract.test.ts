import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {} as Record<string, unknown[]>;
  const handlers = new Map<string, (payload?: any) => void>();
  const channel = {
    presenceState: vi.fn(() => state),
    on: vi.fn((type: string, filter: { event: string }, callback: (payload?: any) => void) => {
      handlers.set(`${type}:${filter.event}`, callback);
      return channel;
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      handlers.set('status', callback);
      return channel;
    }),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return { state, handlers, channel, client, createClient: vi.fn(() => client) };
});

vi.mock('@/lib/supabase/client', () => ({ createClient: mocks.createClient }));

import {
  acquire,
  getChannel,
  isConnected,
  onPresenceSync,
  onStatusChange,
  release,
  subscribeTopic,
} from '../channelManager';

describe('managed presence channel contract', () => {
  it('shares, dispatches, unsubscribes, and releases a managed channel', async () => {
    const noopPresence = onPresenceSync('missing', vi.fn());
    const noopStatus = onStatusChange('missing', vi.fn());
    const noopTopic = subscribeTopic('missing', 'topic', vi.fn());
    expect(noopPresence()).toBeUndefined();
    expect(noopStatus()).toBeUndefined();
    expect(noopTopic()).toBeUndefined();
    expect(getChannel('missing')).toBeNull();
    expect(isConnected('missing')).toBe(false);
    release('missing');

    const first = acquire('room', 'user-1');
    const second = acquire('room', 'user-2');
    expect(second).toBe(first);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.client.channel).toHaveBeenCalledWith('presence:room', {
      config: { presence: { key: 'user-1' } },
    });
    expect(getChannel('room')).toBe(mocks.channel);

    const presence = vi.fn();
    const status = vi.fn();
    const topicA = vi.fn();
    const topicB = vi.fn();
    const stopPresence = onPresenceSync('room', presence);
    const stopStatus = onStatusChange('room', status);
    const stopTopicA = subscribeTopic('room', 'typing', topicA);
    const stopTopicB = subscribeTopic('room', 'typing', topicB);

    Object.assign(mocks.state, {
      a: [
        { userId: 'user-1', name: '', avatar: 'a.png', color: '' },
        { userId: '', name: 'ignored' },
      ],
      b: [{ userId: 'user-2', name: 'Ada', color: '#fff' }],
    });
    mocks.handlers.get('presence:sync')?.();
    expect(presence).toHaveBeenCalledWith([
      { userId: 'user-1', name: 'Anonymous', avatar: 'a.png', color: '#888888' },
      { userId: 'user-2', name: 'Ada', avatar: undefined, color: '#fff' },
    ]);

    mocks.handlers.get('broadcast:*')?.({ payload: { ignored: true } });
    mocks.handlers.get('broadcast:*')?.({ event: 'other' });
    mocks.handlers.get('broadcast:*')?.({ event: 'typing', payload: { active: true } });
    expect(topicA).toHaveBeenCalledWith({ active: true });
    expect(topicB).toHaveBeenCalledWith({ active: true });

    mocks.handlers.get('status')?.('SUBSCRIBED');
    expect(status).toHaveBeenLastCalledWith(true);
    expect(isConnected('room')).toBe(true);
    mocks.handlers.get('status')?.('TIMED_OUT');
    mocks.handlers.get('status')?.('CLOSED');
    mocks.handlers.get('status')?.('CHANNEL_ERROR');
    expect(status).toHaveBeenLastCalledWith(false);

    stopTopicA();
    mocks.handlers.get('broadcast:*')?.({ event: 'typing' });
    expect(topicA).toHaveBeenCalledTimes(1);
    expect(topicB).toHaveBeenLastCalledWith({});
    stopTopicB();
    mocks.handlers.get('broadcast:*')?.({ event: 'typing', payload: { after: true } });

    stopPresence();
    stopStatus();
    release('room');
    expect(getChannel('room')).toBe(mocks.channel);
    release('room');
    expect(mocks.client.removeChannel).toHaveBeenCalledWith(mocks.channel);
    expect(getChannel('room')).toBeNull();
  });
});
