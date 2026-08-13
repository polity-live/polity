/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DecisionItem } from '../../ui/types';
import { useSingleDecisionSubscription, useTerminalSubscription } from '../useTerminalSubscription';

const mocks = vi.hoisted(() => ({ triggerFlash: vi.fn() }));

vi.mock('../useDecisionFlash', () => ({
  useDecisionFlash: () => ({
    flashStates: new Map(),
    triggerFlash: mocks.triggerFlash,
    isFlashing: vi.fn(),
    getFlashState: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

const decision = (overrides: Partial<DecisionItem> = {}) =>
  ({
    id: 'decision-1',
    type: 'vote',
    title: 'Vote',
    body: 'Body',
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    status: 'active',
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    isClosed: false,
    supportPercentage: 0,
    ...overrides,
  }) as DecisionItem;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => vi.useRealTimers());

describe('useTerminalSubscription', () => {
  it('reports new, changed, closed, and removed decisions', () => {
    const onNewDecision = vi.fn();
    const onDecisionChange = vi.fn();
    const onDecisionClosed = vi.fn();
    const first = decision({ supportPercentage: undefined });
    const { result, rerender } = renderHook(
      ({ decisions }) =>
        useTerminalSubscription(decisions, {
          pollInterval: 100,
          onNewDecision,
          onDecisionChange,
          onDecisionClosed,
        }),
      { initialProps: { decisions: [first] } }
    );

    expect(onNewDecision).toHaveBeenCalledWith(first);
    expect(result.current.isSubscribed).toBe(true);
    act(() => result.current.refresh());
    expect(mocks.triggerFlash).not.toHaveBeenCalled();

    const changed = decision({ supportPercentage: 3, isClosed: true });
    rerender({ decisions: [changed] });
    expect(mocks.triggerFlash).toHaveBeenCalledWith('decision-1', 3);
    expect(onDecisionChange).toHaveBeenCalledWith(changed, 0);
    expect(onDecisionClosed).toHaveBeenCalledWith(changed);

    rerender({ decisions: [] });
    expect(onDecisionClosed).toHaveBeenCalledWith(changed);
    expect(result.current.lastUpdate).not.toBeNull();
  });

  it('does not emit callbacks for small or unchanged updates and supports disabled mode', () => {
    const onDecisionChange = vi.fn();
    const onDecisionClosed = vi.fn();
    const { result, rerender } = renderHook(
      ({ decisions, enabled }) =>
        useTerminalSubscription(decisions, { enabled, onDecisionChange, onDecisionClosed }),
      { initialProps: { decisions: [decision({ supportPercentage: 4 })], enabled: false } }
    );

    expect(result.current.isSubscribed).toBe(false);
    rerender({ decisions: [decision({ supportPercentage: 4 })], enabled: true });
    rerender({ decisions: [decision({ supportPercentage: 5 })], enabled: true });
    expect(onDecisionChange).not.toHaveBeenCalled();
    expect(onDecisionClosed).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(5_000));
    expect(mocks.triggerFlash).not.toHaveBeenCalled();
  });

  it('works when optional callbacks are omitted', () => {
    const { rerender, unmount } = renderHook(
      ({ decisions }) => useTerminalSubscription(decisions),
      { initialProps: { decisions: [decision()] } }
    );
    rerender({ decisions: [decision({ supportPercentage: 5, isClosed: true })] });
    rerender({ decisions: [] });
    expect(mocks.triggerFlash).toHaveBeenCalled();
    unmount();
  });
});

describe('useSingleDecisionSubscription', () => {
  it('tracks changes and optional notification callbacks', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useSingleDecisionSubscription('decision-1', { enabled: false, onUpdate })
    );
    expect(result.current.isSubscribed).toBe(false);
    act(() => result.current.updateSupport(10));
    act(() => result.current.updateSupport(10));
    expect(onUpdate).not.toHaveBeenCalled();
    act(() => result.current.updateSupport(12));
    expect(onUpdate).toHaveBeenCalledWith(12, 10);

    const withoutCallback = renderHook(() => useSingleDecisionSubscription('decision-2'));
    act(() => withoutCallback.result.current.updateSupport(1));
    act(() => withoutCallback.result.current.updateSupport(2));
    expect(withoutCallback.result.current.isSubscribed).toBe(true);
  });
});
