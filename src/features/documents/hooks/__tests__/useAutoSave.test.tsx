/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoSave } from '../useAutoSave';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useAutoSave', () => {
  it('debounces saves, replaces pending input, and reports lifecycle callbacks', async () => {
    const onSave = vi.fn();
    const onSaveStart = vi.fn();
    const onSaveEnd = vi.fn();
    const { result } = renderHook(() =>
      useAutoSave({ onSave, onSaveStart, onSaveEnd, debounceMs: 500 })
    );

    act(() => {
      result.current.save('first');
      result.current.save('latest');
    });
    await act(async () => vi.advanceTimersByTimeAsync(499));
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith('latest');
    expect(onSaveStart).toHaveBeenCalledOnce();
    expect(onSaveEnd).toHaveBeenCalledOnce();

    act(() => result.current.save('pending-before-force'));
    await act(async () => result.current.forceSave('forced'));
    expect(onSave).toHaveBeenNthCalledWith(2, 'forced');
  });

  it('throttles a save that follows a completed force-save', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave({ onSave, throttleMs: 1_000 }));

    await act(async () => result.current.forceSave('first'));
    act(() => result.current.save('second'));
    await act(async () => vi.advanceTimersByTimeAsync(999));
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onSave).toHaveBeenNthCalledWith(2, 'second');
  });

  it('queues data arriving during a save and runs only the latest queued value', async () => {
    let releaseFirst!: () => void;
    const firstSave = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => firstSave)
      .mockImplementation(() => Promise.resolve());
    const { result } = renderHook(() => useAutoSave({ onSave, throttleMs: 100 }));

    let firstForce!: Promise<void>;
    act(() => {
      firstForce = result.current.forceSave('first');
    });
    await act(async () => Promise.resolve());
    await act(async () => {
      await result.current.forceSave('queued-old');
      await result.current.forceSave('queued-latest');
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirst();
      await firstForce;
    });
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(onSave).toHaveBeenNthCalledWith(2, 'queued-latest');
  });

  it('reports save errors and still completes the lifecycle', async () => {
    const error = new Error('save failed');
    const onError = vi.fn();
    const onSaveEnd = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useAutoSave({
        onSave: vi.fn().mockRejectedValue(error),
        onError,
        onSaveEnd,
      })
    );

    await act(async () => result.current.forceSave('value'));

    expect(onError).toHaveBeenCalledWith(error);
    expect(onSaveEnd).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalled();
  });

  it('cancels debounce and throttle timers and cleans up safely on unmount', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    const onSave = vi.fn().mockImplementationOnce(() => pending);
    const { result, unmount } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 50, throttleMs: 100 })
    );

    act(() => result.current.save('debounced'));
    act(() => result.current.cancel());
    await act(async () => vi.runAllTimersAsync());
    expect(onSave).not.toHaveBeenCalled();

    let force!: Promise<void>;
    act(() => {
      force = result.current.forceSave('saving');
    });
    await act(async () => Promise.resolve());
    await act(async () => result.current.forceSave('queued'));
    await act(async () => {
      release();
      await force;
    });
    await act(async () => result.current.forceSave('forced-after-saving'));
    await act(async () => vi.runAllTimersAsync());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith('forced-after-saving');

    let releaseSecond!: () => void;
    const secondPending = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    onSave.mockImplementationOnce(() => secondPending);
    let secondForce!: Promise<void>;
    act(() => {
      secondForce = result.current.forceSave('saving-again');
    });
    await act(async () => Promise.resolve());
    await act(async () => result.current.forceSave('queued-again'));
    await act(async () => {
      releaseSecond();
      await secondForce;
    });
    act(() => result.current.cancel());
    await act(async () => vi.runAllTimersAsync());
    expect(onSave).toHaveBeenCalledTimes(3);

    act(() => result.current.cancel());
    unmount();
  });
});
