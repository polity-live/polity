/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFlashClasses, useDecisionFlash } from '../useDecisionFlash';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDecisionFlash', () => {
  it('ignores sub-threshold changes and classifies every direction and intensity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const { result } = renderHook(() =>
      useDecisionFlash({ flashDuration: 100, minChangeThreshold: 2, highIntensityThreshold: 10 })
    );

    act(() => result.current.triggerFlash('ignored', 1));
    expect(result.current.isFlashing('ignored')).toBe(false);

    act(() => result.current.triggerFlash('low-up', 2));
    act(() => result.current.triggerFlash('medium-down', -4));
    act(() => result.current.triggerFlash('high-up', 10));
    expect(result.current.getFlashState('low-up')).toMatchObject({ type: 'up', intensity: 'low' });
    expect(result.current.getFlashState('medium-down')).toMatchObject({
      type: 'down',
      intensity: 'medium',
    });
    expect(result.current.getFlashState('high-up')).toMatchObject({
      type: 'up',
      intensity: 'high',
    });
    expect(result.current.getFlashState('missing')).toBeUndefined();

    act(() => result.current.triggerFlash('low-up', 3));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.isFlashing('low-up')).toBe(false);
  });

  it('supports neutral flashes, clearing, and unmount cleanup', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() =>
      useDecisionFlash({ flashDuration: 500, minChangeThreshold: 0, highIntensityThreshold: 1 })
    );

    act(() => result.current.triggerFlash('neutral', 0));
    expect(result.current.getFlashState('neutral')).toMatchObject({
      type: 'neutral',
      intensity: 'medium',
    });
    act(() => result.current.clearAll());
    expect(result.current.flashStates.size).toBe(0);

    act(() => result.current.triggerFlash('unmount', -2));
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe('getFlashClasses', () => {
  it('formats absent and all flash variants', () => {
    expect(getFlashClasses(undefined)).toBe('');
    expect(getFlashClasses({ itemId: '1', type: 'up', intensity: 'low', timestamp: 0 })).toContain(
      'flash-up flash-intensity-low'
    );
    expect(
      getFlashClasses({ itemId: '2', type: 'down', intensity: 'medium', timestamp: 0 })
    ).toContain('flash-down flash-intensity-medium');
    expect(
      getFlashClasses({ itemId: '3', type: 'neutral', intensity: 'high', timestamp: 0 })
    ).toContain('flash-neutral flash-intensity-high');
  });
});
