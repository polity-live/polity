/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getSwipeActionIndicator,
  useSwipeGestures,
  type SwipeGestureOptions,
} from '../useSwipeGestures';

function touch(x: number, y: number) {
  return {
    touches: [{ clientX: x, clientY: y }],
    preventDefault: vi.fn(),
  } as any;
}

function performSwipe(options: SwipeGestureOptions, endX: number, endY: number) {
  const hook = renderHook(() => useSwipeGestures(options));
  const start = touch(100, 100);
  const move = touch(endX, endY);
  act(() => hook.result.current.handlers.onTouchStart(start));
  act(() => hook.result.current.handlers.onTouchMove(move));
  return { ...hook, move };
}

describe('useSwipeGestures', () => {
  it('keeps disabled and incomplete gestures inert and resettable', () => {
    const disabled = renderHook(() => useSwipeGestures({ enabled: false }));
    act(() => {
      disabled.result.current.handlers.onTouchStart(touch(0, 0));
      disabled.result.current.handlers.onTouchMove(touch(200, 0));
      disabled.result.current.handlers.onTouchEnd({} as any);
      disabled.result.current.handlers.onTouchCancel();
      disabled.result.current.reset();
    });
    expect(disabled.result.current.state.isSwiping).toBe(false);
    expect(disabled.result.current.style).toEqual({
      transform: 'translate3d(0, 0, 0)',
      transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
      opacity: 1,
    });

    const enabled = renderHook(() => useSwipeGestures());
    act(() => enabled.result.current.handlers.onTouchMove(touch(200, 0)));
    act(() => enabled.result.current.handlers.onTouchEnd({} as any));
    expect(enabled.result.current.state).toMatchObject({ offsetX: 0, offsetY: 0 });
  });

  it('tracks below-threshold movement without locking a direction', () => {
    const hook = performSwipe({}, 110, 110);
    expect(hook.result.current.state).toMatchObject({
      direction: null,
      isSwiping: true,
      offsetX: 0,
      offsetY: 0,
      thresholdReached: false,
    });
    expect(hook.result.current.style.transform).toBe('translate3d(0px, 0px, 0)');
    act(() => hook.result.current.handlers.onTouchEnd({} as any));
    expect(hook.result.current.state.isSwiping).toBe(false);
  });

  it('keeps the initially locked direction across subsequent movement', () => {
    const hook = performSwipe({ enableHorizontal: true, enableVertical: true }, 220, 100);
    act(() => hook.result.current.handlers.onTouchMove(touch(230, 160)));
    expect(hook.result.current.state.direction).toBe('right');
    act(() => hook.result.current.handlers.onTouchCancel());
  });

  it.each([
    ['left', 0, 100, 'onSwipeLeft'],
    ['right', 220, 100, 'onSwipeRight'],
    ['up', 100, 0, 'onSwipeUp'],
    ['down', 100, 220, 'onSwipeDown'],
  ] as const)('detects and dispatches a %s swipe', (direction, x, y, callbackName) => {
    const callback = vi.fn();
    const options: SwipeGestureOptions = {
      actionThreshold: 100,
      enableHorizontal: true,
      enableVertical: true,
      [callbackName]: callback,
    };
    const hook = performSwipe(options, x, y);
    expect(hook.result.current.state).toMatchObject({ direction, thresholdReached: true });
    expect(hook.result.current.style.opacity).toBe(0.7);
    expect(hook.result.current.style.transition).toBe('none');
    if (direction === 'left' || direction === 'right') {
      expect(hook.move.preventDefault).toHaveBeenCalledOnce();
      expect(hook.result.current.state.offsetX).not.toBe(0);
    } else {
      expect(hook.move.preventDefault).not.toHaveBeenCalled();
      expect(hook.result.current.state.offsetY).not.toBe(0);
    }
    act(() => hook.result.current.handlers.onTouchEnd({} as any));
    expect(callback).toHaveBeenCalledOnce();
    expect(hook.result.current.state).toMatchObject({ isSwiping: false, direction: null });
  });

  it('does not dispatch absent callbacks or disabled axes', () => {
    const noCallback = performSwipe({ enableVertical: true }, 100, 220);
    act(() => noCallback.result.current.handlers.onTouchEnd({} as any));
    expect(noCallback.result.current.state.isSwiping).toBe(false);

    const horizontalDisabled = performSwipe(
      { enableHorizontal: false, enableVertical: true },
      220,
      105
    );
    expect(horizontalDisabled.result.current.state.direction).toBeNull();

    const verticalDisabled = performSwipe(
      { enableHorizontal: true, enableVertical: false },
      105,
      220
    );
    expect(verticalDisabled.result.current.state.direction).toBeNull();
  });
});

describe('getSwipeActionIndicator', () => {
  it('maps thresholds and every direction to the matching semantic indicator', () => {
    expect(getSwipeActionIndicator('left', false)).toEqual({ icon: null, color: '' });
    expect(getSwipeActionIndicator(null, true)).toEqual({ icon: null, color: '' });
    expect(getSwipeActionIndicator('left', true).icon).toBe('react');
    expect(getSwipeActionIndicator('right', true).icon).toBe('dismiss');
    expect(getSwipeActionIndicator('up', true).icon).toBe('hide');
    expect(getSwipeActionIndicator('down', true).icon).toBe('share');
    expect(getSwipeActionIndicator('diagonal' as any, true)).toEqual({ icon: null, color: '' });
  });
});
