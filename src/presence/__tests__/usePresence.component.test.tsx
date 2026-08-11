/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const manager = vi.hoisted(() => {
  const channel = { track: vi.fn(), send: vi.fn() };
  return {
    channel,
    subscribed: false,
    available: true,
    presenceCallback: undefined as undefined | ((peers: unknown[]) => void),
    statusCallback: undefined as undefined | ((connected: boolean) => void),
    unsubscribePresence: vi.fn(),
    unsubscribeStatus: vi.fn(),
    topicUnsubscribe: vi.fn(),
    acquire: vi.fn(() => ({ channel, isSubscribed: manager.subscribed })),
    onPresenceSync: vi.fn((_room: string, callback: (peers: unknown[]) => void) => {
      manager.presenceCallback = callback;
      return manager.unsubscribePresence;
    }),
    onStatusChange: vi.fn((_room: string, callback: (connected: boolean) => void) => {
      manager.statusCallback = callback;
      return manager.unsubscribeStatus;
    }),
    release: vi.fn(),
    getChannel: vi.fn(() => (manager.available ? channel : undefined)),
    subscribeTopic: vi.fn(() => manager.topicUnsubscribe),
  };
});

vi.mock('../channelManager', () => manager);

import { usePresence } from '../usePresence';

beforeEach(() => {
  vi.clearAllMocks();
  manager.subscribed = false;
  manager.available = true;
  manager.presenceCallback = undefined;
  manager.statusCallback = undefined;
});

describe('presence hook lifecycle', () => {
  it('does not acquire channels while disabled or when the room is empty', () => {
    const { rerender } = renderHook(({ roomId, enabled }) => usePresence(roomId, { enabled }), {
      initialProps: { roomId: 'room-1', enabled: false },
    });
    expect(manager.acquire).not.toHaveBeenCalled();
    rerender({ roomId: '', enabled: true });
    expect(manager.acquire).not.toHaveBeenCalled();
  });

  it('tracks connection and peers, publishes merged state and topics, and releases subscriptions', () => {
    const initialData = {
      userId: 'ada',
      name: 'Ada',
      color: 'blue',
    };
    const { result, rerender, unmount } = renderHook(
      ({ data }) => usePresence('room-1', { initialData: data }),
      { initialProps: { data: initialData } }
    );
    expect(manager.acquire).toHaveBeenCalledWith('room-1', 'ada');

    act(() => manager.statusCallback?.(true));
    expect(result.current.isConnected).toBe(true);
    expect(manager.channel.track).toHaveBeenCalledWith(initialData);
    const peers = [{ ...initialData, avatar: '/ada.png' }];
    act(() => manager.presenceCallback?.(peers));
    expect(result.current.peers).toEqual(peers);

    rerender({ data: { ...initialData, name: 'Ada Lovelace' } });
    act(() => result.current.publishPresence({ color: 'purple' }));
    expect(manager.channel.track).toHaveBeenLastCalledWith({
      ...initialData,
      name: 'Ada Lovelace',
      color: 'purple',
    });
    act(() => result.current.publishTopic('agenda-started', { agendaId: 'agenda-1' }));
    expect(manager.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'agenda-started',
      payload: { agendaId: 'agenda-1' },
    });
    const callback = vi.fn();
    expect(result.current.subscribeTopic('vote-opened', callback)).toBe(manager.topicUnsubscribe);
    expect(manager.subscribeTopic).toHaveBeenCalledWith('room-1', 'vote-opened', callback);

    unmount();
    expect(manager.unsubscribePresence).toHaveBeenCalledTimes(1);
    expect(manager.unsubscribeStatus).toHaveBeenCalledTimes(1);
    expect(manager.release).toHaveBeenCalledWith('room-1');
  });

  it('hydrates an already subscribed channel and safely ignores missing publish channels', () => {
    manager.subscribed = true;
    const { result } = renderHook(() =>
      usePresence('room-2', {
        initialData: { userId: 'grace', name: 'Grace', color: 'green' },
      })
    );
    expect(result.current.isConnected).toBe(true);
    expect(manager.channel.track).toHaveBeenCalledWith({
      userId: 'grace',
      name: 'Grace',
      color: 'green',
    });

    manager.available = false;
    act(() => result.current.publishPresence({ avatar: '/grace.png' }));
    act(() => result.current.publishTopic('offline', {}));
    expect(manager.getChannel).toHaveBeenCalledTimes(2);
  });

  it('handles disconnected status and subscribed channels without initial data', () => {
    manager.subscribed = true;
    const { result } = renderHook(() => usePresence('room-3'));
    expect(result.current.isConnected).toBe(true);
    expect(manager.channel.track).not.toHaveBeenCalled();

    act(() => manager.statusCallback?.(false));
    expect(result.current.isConnected).toBe(false);
    expect(manager.channel.track).not.toHaveBeenCalled();
  });
});
