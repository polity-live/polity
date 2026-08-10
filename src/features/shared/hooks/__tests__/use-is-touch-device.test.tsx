/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsTouchDevice } from '../use-is-touch-device';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as Window & { ontouchstart?: unknown }).ontouchstart;
});

function setTouchPoints(value: number) {
  vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: value });
}

describe('useIsTouchDevice', () => {
  it('detects pointer-only, touch-point, and touch-event environments', () => {
    let prototype: object | null = window;
    while (prototype) {
      if (Object.prototype.hasOwnProperty.call(prototype, 'ontouchstart')) {
        Reflect.deleteProperty(prototype, 'ontouchstart');
      }
      prototype = Object.getPrototypeOf(prototype);
    }
    setTouchPoints(0);
    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);

    setTouchPoints(1);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(result.current).toBe(true);

    setTouchPoints(0);
    Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
    act(() => window.dispatchEvent(new Event('resize')));
    expect(result.current).toBe(true);
  });
});
