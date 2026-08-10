/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSwipeNavigation } from '../useSwipeNavigation';

describe('swipe navigation post-typefix re-entrant reset', () => {
  it('does not prevent scrolling when a host reset occurs while reading touch data', () => {
    const { result } = renderHook(() => useSwipeNavigation({}));
    const handlers = result.current.handlers;
    const startEvent = {
      target: null,
      touches: [{ clientX: 100, clientY: 100 }],
    } as never;

    act(() => handlers.onTouchStart(startEvent));

    const preventDefault = vi.fn();
    const touches = [{ clientX: 50, clientY: 100 }];
    const moveEvent = {
      cancelable: true,
      preventDefault,
      get touches() {
        handlers.onTouchCancel();
        return touches;
      },
    } as never;

    act(() => handlers.onTouchMove(moveEvent));

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
