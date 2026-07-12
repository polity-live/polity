/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStreetDesignRemoteCursors } from '../useStreetDesignRemoteCursors';

const presence = vi.hoisted(() => ({
  publishTopic: vi.fn(),
  subscribeTopic: vi.fn(),
  subscriber: null as ((payload: Record<string, unknown>) => void) | null,
}));

vi.mock('@/presence/usePresence', () => ({
  usePresence: () => ({
    publishTopic: presence.publishTopic,
    subscribeTopic: presence.subscribeTopic.mockImplementation(
      (_topic: string, callback: (payload: Record<string, unknown>) => void) => {
        presence.subscriber = callback;
        return () => {
          presence.subscriber = null;
        };
      }
    ),
    isConnected: true,
    peers: [],
    publishPresence: vi.fn(),
  }),
}));

describe('useStreetDesignRemoteCursors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    presence.publishTopic.mockReset();
    presence.subscribeTopic.mockClear();
    presence.subscriber = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('broadcasts immediately, then throttles trailing cursor movement', () => {
    const { result } = renderHook(() =>
      useStreetDesignRemoteCursors({
        entityId: 'street-design:design-1',
        userId: 'user-local',
        userName: 'Ada Lovelace',
        userColor: '#dc2626',
      })
    );

    act(() => result.current.broadcastCursor({ x: 1, z: 2 }, 'design'));
    expect(presence.publishTopic).toHaveBeenCalledTimes(1);

    act(() => result.current.broadcastCursor({ x: 3, z: 4 }, 'original'));
    expect(presence.publishTopic).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(100));
    expect(presence.publishTopic).toHaveBeenCalledTimes(2);
    expect(presence.publishTopic).toHaveBeenLastCalledWith(
      'street-cursor',
      expect.objectContaining({ position: { x: 3, z: 4 }, layer: 'original' })
    );
  });

  it('tracks valid remote cursors and removes them on clear or inactivity', () => {
    const { result } = renderHook(() =>
      useStreetDesignRemoteCursors({
        entityId: 'street-design:design-1',
        userId: 'user-local',
      })
    );
    const payload = {
      senderId: 'user-remote',
      userName: 'Grace Hopper',
      userColor: '#2563eb',
      position: { x: 5, z: 7 },
      layer: 'design',
    };

    act(() => presence.subscriber?.(payload));
    expect(result.current.remoteCursors).toEqual([
      {
        userId: 'user-remote',
        name: 'Grace Hopper',
        color: '#2563eb',
        position: { x: 5, z: 7 },
        layer: 'design',
      },
    ]);
    expect(result.current.activeCursorUserIds.has('user-remote')).toBe(true);

    act(() => presence.subscriber?.({ ...payload, position: null }));
    expect(result.current.remoteCursors).toEqual([]);

    act(() => presence.subscriber?.(payload));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.remoteCursors).toEqual([]);
  });

  it('ignores local and malformed cursor messages', () => {
    const { result } = renderHook(() =>
      useStreetDesignRemoteCursors({
        entityId: 'street-design:design-1',
        userId: 'user-local',
      })
    );

    act(() => {
      presence.subscriber?.({
        senderId: 'user-local',
        userName: 'Ada',
        userColor: '#dc2626',
        position: { x: 1, z: 2 },
        layer: 'design',
      });
      presence.subscriber?.({
        senderId: 'user-remote',
        userName: 'Grace',
        userColor: '#2563eb',
        position: { x: Number.NaN, z: 2 },
        layer: 'design',
      });
    });

    expect(result.current.remoteCursors).toEqual([]);
  });

  it('sends a clear message immediately and cancels a pending movement', () => {
    const { result } = renderHook(() =>
      useStreetDesignRemoteCursors({
        entityId: 'street-design:design-1',
        userId: 'user-local',
      })
    );

    act(() => result.current.broadcastCursor({ x: 1, z: 2 }, 'design'));
    act(() => result.current.broadcastCursor({ x: 3, z: 4 }, 'design'));
    act(() => result.current.broadcastCursor(null, 'design'));

    expect(presence.publishTopic).toHaveBeenCalledTimes(2);
    expect(presence.publishTopic).toHaveBeenLastCalledWith(
      'street-cursor',
      expect.objectContaining({ position: null })
    );
    act(() => vi.advanceTimersByTime(100));
    expect(presence.publishTopic).toHaveBeenCalledTimes(2);
  });
});
