/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSyncedVotingTimer, useVotingTimer } from '../useVotingTimer';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-02T10:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('voting timers', () => {
  it('starts, pauses, resumes, expires once, and resets a local countdown', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useVotingTimer({ onExpire }));
    act(() => result.current.start(2));
    expect(result.current).toMatchObject({ timeRemaining: 2, isRunning: true, isExpired: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeRemaining).toBe(1);
    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.timeRemaining).toBe(1);
    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toMatchObject({ timeRemaining: 0, isRunning: false, isExpired: true });
    expect(onExpire).toHaveBeenCalledOnce();
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ timeRemaining: 0, isRunning: false, isExpired: false });
  });

  it('synchronizes remaining time to the server timestamp and exposes read-only controls', () => {
    const onExpire = vi.fn();
    const startedAt = Date.now() - 2000;
    const { result, rerender } = renderHook(
      ({ start }) => useSyncedVotingTimer(start, 3, onExpire),
      { initialProps: { start: startedAt as number | undefined } }
    );
    expect(result.current).toMatchObject({ timeRemaining: 1, formattedTime: '0:01' });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toMatchObject({ timeRemaining: 0, isExpired: true, isRunning: false });
    expect(onExpire).toHaveBeenCalledOnce();
    rerender({ start: undefined });
    expect(result.current).toMatchObject({ timeRemaining: 3, isExpired: false, isRunning: false });
    act(() => {
      result.current.start(10);
      result.current.pause();
      result.current.resume();
      result.current.reset();
    });
    expect(result.current.timeRemaining).toBe(3);
  });

  it('auto-starts, expires without a callback, and cleans up a live interval', () => {
    const auto = renderHook(() => useVotingTimer({ autoStart: true, initialDuration: 2 }));
    expect(auto.result.current.isRunning).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(auto.result.current).toMatchObject({ timeRemaining: 0, isExpired: true });
    auto.unmount();

    const live = renderHook(() => useVotingTimer({ autoStart: true, initialDuration: 5 }));
    act(() => vi.advanceTimersByTime(1000));
    expect(live.result.current.timeRemaining).toBe(4);
    live.unmount();
  });

  it('keeps zero-duration local controls inert and cleans up without an interval', () => {
    const { result, unmount } = renderHook(() =>
      useVotingTimer({ autoStart: true, initialDuration: 0 })
    );
    expect(result.current.isRunning).toBe(false);
    act(() => {
      result.current.pause();
      result.current.resume();
      result.current.reset();
    });
    expect(result.current.timeRemaining).toBe(0);
    unmount();
  });

  it('ticks and expires a synced countdown without an expiry callback', () => {
    const runningStart = Date.now();
    const running = renderHook(() => useSyncedVotingTimer(runningStart, 3));
    act(() => vi.advanceTimersByTime(1000));
    expect(running.result.current.timeRemaining).toBe(2);
    running.unmount();

    const expiringStart = Date.now();
    const expiring = renderHook(() => useSyncedVotingTimer(expiringStart, 1));
    act(() => vi.advanceTimersByTime(1000));
    expect(expiring.result.current).toMatchObject({ timeRemaining: 0, isExpired: true });
    expiring.unmount();
  });
});
