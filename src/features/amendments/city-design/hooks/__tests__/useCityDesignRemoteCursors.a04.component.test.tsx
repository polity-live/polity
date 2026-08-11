/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const presence = vi.hoisted(() => ({
  connected: true,
  publish: vi.fn(),
  subscribe: vi.fn(),
  subscriber: null as ((payload: Record<string, unknown>) => void) | null,
}));

vi.mock('@/presence/usePresence', () => ({
  usePresence: () => ({
    publishTopic: presence.publish,
    subscribeTopic: presence.subscribe.mockImplementation(
      (_topic: string, callback: (payload: Record<string, unknown>) => void) => {
        presence.subscriber = callback;
        return vi.fn();
      }
    ),
    isConnected: presence.connected,
  }),
}));

import {
  cityDesignRemoteCursorInternals,
  useCityDesignRemoteCursors,
} from '../useCityDesignRemoteCursors';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  presence.connected = true;
  presence.publish.mockReset();
  presence.subscribe.mockClear();
  presence.subscriber = null;
});
afterEach(() => vi.useRealTimers());

describe('useCityDesignRemoteCursors A04 alternatives', () => {
  it('does not subscribe or broadcast when disabled or unidentified', () => {
    const { result } = renderHook(() =>
      useCityDesignRemoteCursors({ entityId: '', userId: undefined, enabled: false })
    );
    act(() => result.current.broadcastCursor({ x: 1, z: 2 }));
    expect(presence.subscribe).not.toHaveBeenCalled();
    expect(presence.publish).not.toHaveBeenCalled();
  });

  it('does not publish while disconnected', () => {
    presence.connected = false;
    const { result } = renderHook(() =>
      useCityDesignRemoteCursors({ entityId: 'entity', userId: 'local' })
    );
    act(() => result.current.broadcastCursor({ x: 1, z: 2 }));
    expect(presence.publish).not.toHaveBeenCalled();
  });

  it('uses identity defaults, updates existing cursors, and resets inactivity timers', () => {
    const { result, unmount } = renderHook(() =>
      useCityDesignRemoteCursors({ entityId: 'entity', userId: 'local' })
    );
    act(() => result.current.broadcastCursor({ x: 1, z: 2 }));
    expect(presence.publish).toHaveBeenCalledWith(
      'street-cursor',
      expect.objectContaining({ userName: 'Anonymous', userColor: '#888888', layer: 'design' })
    );
    const payload = {
      senderId: 'remote',
      userName: 'Remote',
      userColor: '#fff',
      position: { x: 1, z: 2 },
      layer: 'design',
    };
    act(() => presence.subscriber?.(payload));
    act(() => presence.subscriber?.({ ...payload, position: { x: 3, z: 4 } }));
    expect(result.current.remoteCursors).toHaveLength(1);
    expect(result.current.remoteCursors[0].position).toEqual({ x: 3, z: 4 });
    unmount();
  });

  it('sends elapsed movements immediately and replaces an existing trailing timer', () => {
    const { result, unmount } = renderHook(() =>
      useCityDesignRemoteCursors({ entityId: 'entity', userId: 'local' })
    );
    act(() => result.current.broadcastCursor({ x: 1, z: 1 }));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.broadcastCursor({ x: 2, z: 2 }));
    act(() => result.current.broadcastCursor({ x: 3, z: 3 }));
    act(() => result.current.broadcastCursor({ x: 4, z: 4 }));
    expect(presence.publish).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('clears a pending trailing timer for both a clear and a newly immediate movement', () => {
    const { result } = renderHook(() =>
      useCityDesignRemoteCursors({ entityId: 'entity', userId: 'local' })
    );
    act(() => result.current.broadcastCursor(null));
    act(() => result.current.broadcastCursor({ x: 1, z: 1 }));
    act(() => result.current.broadcastCursor({ x: 2, z: 2 }));
    act(() => result.current.broadcastCursor(null));

    act(() => result.current.broadcastCursor({ x: 3, z: 3 }));
    act(() => result.current.broadcastCursor({ x: 4, z: 4 }));
    vi.setSystemTime(1_100);
    act(() => result.current.broadcastCursor({ x: 5, z: 5 }));

    expect(presence.publish).toHaveBeenLastCalledWith(
      'street-cursor',
      expect.objectContaining({ position: { x: 5, z: 5 } })
    );
  });

  it('removes clear messages that have no inactivity timeout', () => {
    renderHook(() => useCityDesignRemoteCursors({ entityId: 'entity', userId: 'local' }));
    act(() =>
      presence.subscriber?.({
        senderId: 'remote',
        userName: 'Remote',
        userColor: '#fff',
        position: null,
        layer: 'original',
      })
    );
  });

  it('rejects each malformed payload field and accepts finite coordinates', () => {
    const parse = cityDesignRemoteCursorInternals.parseCursorPayload;
    expect(parse({})).toBeNull();
    expect(parse({ senderId: 1, userName: 'n', userColor: 'c', layer: 'design' })).toBeNull();
    expect(parse({ senderId: 's', userName: 1, userColor: 'c', layer: 'design' })).toBeNull();
    expect(parse({ senderId: 's', userName: 'n', userColor: 1, layer: 'design' })).toBeNull();
    expect(parse({ senderId: 's', userName: 'n', userColor: 'c', layer: 'bad' })).toBeNull();
    expect(
      parse({ senderId: 's', userName: 'n', userColor: 'c', layer: 'design', position: 'bad' })
    ).toBeNull();
    expect(
      parse({ senderId: 's', userName: 'n', userColor: 'c', layer: 'design', position: { x: 1 } })
    ).toBeNull();
    expect(
      parse({
        senderId: 's',
        userName: 'n',
        userColor: 'c',
        layer: 'design',
        position: { x: 1, z: 2 },
      })
    ).toMatchObject({ position: { x: 1, z: 2 } });
  });
});
