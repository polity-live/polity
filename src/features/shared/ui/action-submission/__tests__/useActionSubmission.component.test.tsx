// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTION_SUBMISSION_DEFAULT_STEPS, useActionSubmission } from '../useActionSubmission';

const customSteps = [
  { key: 'prepare' as const, status: 'pending' as const, copy: { key: 'prepare' } },
  { key: 'commit' as const, status: 'pending' as const, copy: { key: 'commit' } },
  { key: 'sync' as const, status: 'pending' as const, copy: { key: 'sync' } },
];

describe('useActionSubmission', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes defaults, reports progress, and resets custom state', () => {
    const { result } = renderHook(() => useActionSubmission('workflow', customSteps));
    expect(result.current.status).toBe('idle');
    expect(result.current.isActive).toBe(false);
    expect(result.current.progressSteps).toEqual(customSteps);
    expect(result.current.progressSteps).not.toBe(customSteps);

    act(() =>
      result.current.reportProgress({
        key: 'prepare',
        status: 'active',
      })
    );
    expect(result.current.status).toBe('submitting');
    expect(result.current.progressSteps[0].copy).toEqual({ key: 'prepare' });

    act(() =>
      result.current.reportProgress({
        copy: { key: 'replacement' },
        key: 'commit',
        status: 'complete',
      })
    );
    expect(result.current.progressSteps[1].copy).toEqual({ key: 'replacement' });

    act(() => result.current.reportProgress({ key: 'sync', status: 'error' }));
    expect(result.current.status).toBe('error');
    expect(result.current.isActive).toBe(true);

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('falls back to kind defaults for an empty custom step list', () => {
    const { result } = renderHook(() => useActionSubmission('invite', []));
    expect(result.current.progressSteps).toEqual(ACTION_SUBMISSION_DEFAULT_STEPS.invite);
  });

  it('completes synchronous and result-like actions and schedules success callbacks', async () => {
    const onSuccess = vi.fn();
    const action = vi.fn(() => ({ success: true, value: 1 }));
    const { result } = renderHook(() => useActionSubmission('process'));

    await act(async () => {
      await result.current.retry();
      await result.current.runActionWithSubmission(action, { onSuccess, successDelayMs: 10 });
    });

    expect(result.current.status).toBe('success');
    expect(result.current.progressSteps.every(step => step.status === 'complete')).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(10));
    expect(onSuccess).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.retry();
    });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('defers sync completion and honors context finalization', async () => {
    const { result } = renderHook(() => useActionSubmission('tally'));

    await act(async () => {
      const value = await result.current.runActionWithSubmission(() => 'deferred', {
        deferSyncCompletion: true,
      });
      expect(value).toBe('deferred');
    });
    expect(result.current.status).toBe('submitting');
    expect(result.current.progressSteps.find(step => step.key === 'sync')?.status).toBe('active');

    act(() => result.current.completeSuccess());
    act(() => result.current.completeSuccess());
    expect(result.current.status).toBe('success');
    act(() => vi.advanceTimersByTime(720));

    await act(async () => {
      await result.current.runActionWithSubmission(
        context => {
          context.completeSuccess?.();
          return null;
        },
        { deferSyncCompletion: true }
      );
    });
    expect(result.current.status).toBe('success');

    const failure = new Error('manual failure');
    await act(async () => {
      await result.current.runActionWithSubmission(
        context => {
          context.failSubmission?.(failure);
          return { anything: true };
        },
        { deferSyncCompletion: true }
      );
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(failure);
  });

  it.each([
    ['string', 'plain failure', 'plain failure'],
    ['error', new Error('typed failure'), 'typed failure'],
    ['unknown', { reason: 'bad' }, 'Die Aktion konnte nicht abgeschlossen werden.'],
  ] as const)('normalizes %s failed action results', async (_label, error, message) => {
    const { result } = renderHook(() => useActionSubmission('link'));
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.runActionWithSubmission(() => ({ error, success: false }));
      } catch (error) {
        caught = error;
      }
    });
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(message);
    expect(result.current.status).toBe('error');
    expect(result.current.progressSteps.some(step => step.status === 'error')).toBe(true);
  });

  it('marks the final step when failure occurs without an active step', () => {
    const steps = [
      { key: 'custom-one' as any, status: 'pending' as const, copy: { key: 'one' } },
      { key: 'custom-two' as any, status: 'pending' as const, copy: { key: 'two' } },
    ];
    const failure = new Error('direct');
    const { result } = renderHook(() => useActionSubmission('accept', steps));

    act(() => result.current.failSubmission(failure));
    expect(result.current.progressSteps.map(step => step.status)).toEqual(['pending', 'error']);
  });

  it('clears pending success timers on rerun, reset, and unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { result, unmount } = renderHook(() => useActionSubmission('workflow'));

    act(() => result.current.completeSuccess());
    await act(async () => {
      await result.current.runActionWithSubmission(() => undefined);
    });
    act(() => result.current.reset());
    act(() => result.current.completeSuccess());
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('preserves thrown action errors', async () => {
    const failure = new Error('action rejected');
    const { result } = renderHook(() => useActionSubmission('workflow'));
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.runActionWithSubmission(() => {
          throw failure;
        });
      } catch (error) {
        caught = error;
      }
    });
    expect(caught).toBe(failure);
    expect(result.current.error).toBe(failure);
  });
});
