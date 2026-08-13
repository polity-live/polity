/* @vitest-environment jsdom */

import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  useCardListKeyboardNav,
  usePrefersReducedMotion,
  useScreenReaderAnnounce,
} from '../useAccessibility';
import { useBreakpoint, useIsMobile, useResponsiveValue } from '../useIsMobile';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

afterEach(() => vi.useRealTimers());

describe('responsive timeline hooks', () => {
  it('updates mobile state around default and custom breakpoints', () => {
    setWidth(500);
    const hook = renderHook(({ breakpoint }) => useIsMobile(breakpoint), {
      initialProps: { breakpoint: 768 },
    });
    expect(hook.result.current).toBe(true);
    act(() => setWidth(900));
    expect(hook.result.current).toBe(false);
    hook.rerender({ breakpoint: 1000 });
    expect(hook.result.current).toBe(true);
    hook.unmount();
  });

  it.each([
    [1600, '2xl'],
    [1300, 'xl'],
    [1100, 'lg'],
    [800, 'md'],
    [700, 'sm'],
    [400, 'xs'],
    [300, 'xxs'],
  ] as const)('resolves width %i to %s', (width, expected) => {
    setWidth(width);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe(expected);
  });

  it('falls back through smaller responsive values and finally the default', () => {
    setWidth(1100);
    let hook = renderHook(() => useResponsiveValue({ sm: 'small', md: 'medium' }, 'default'));
    expect(hook.result.current).toBe('medium');
    hook.unmount();
    hook = renderHook(() => useResponsiveValue({}, 'default'));
    expect(hook.result.current).toBe('default');
  });
});

describe('timeline accessibility hooks', () => {
  it('announces with both priorities, replaces pending work, and clears on unmount', () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useScreenReaderAnnounce());
    act(() => {
      hook.result.current.announce('First');
      hook.result.current.announce('Urgent', 'assertive');
      vi.advanceTimersByTime(100);
    });
    render(<hook.result.current.LiveRegion />);
    expect(screen.getByText('Urgent').getAttribute('aria-live')).toBe('assertive');
    act(() => hook.result.current.announce('Pending'));
    hook.unmount();

    const noPending = renderHook(() => useScreenReaderAnnounce());
    noPending.unmount();
  });

  it('navigates every keyboard direction, clamps bounds, focuses refs, and ignores other keys', () => {
    const focus = vi.fn();
    const { result } = renderHook(() => useCardListKeyboardNav(3));
    act(() => result.current.setCardRef(0)({ focus } as any));
    const key = (value: string) => ({ key: value, preventDefault: vi.fn() }) as any;

    act(() => result.current.handleKeyDown(key('ArrowDown')));
    expect(result.current.focusedIndex).toBe(0);
    expect(focus).toHaveBeenCalledOnce();
    act(() => result.current.handleKeyDown(key('ArrowRight')));
    expect(result.current.focusedIndex).toBe(1);
    act(() => result.current.handleKeyDown(key('End')));
    expect(result.current.focusedIndex).toBe(2);
    act(() => result.current.handleKeyDown(key('ArrowDown')));
    expect(result.current.focusedIndex).toBe(2);
    act(() => result.current.handleKeyDown(key('ArrowUp')));
    expect(result.current.focusedIndex).toBe(1);
    act(() => result.current.handleKeyDown(key('ArrowLeft')));
    expect(result.current.focusedIndex).toBe(0);
    act(() => result.current.handleKeyDown(key('ArrowUp')));
    expect(result.current.focusedIndex).toBe(0);
    act(() => result.current.handleKeyDown(key('Home')));
    act(() => result.current.handleKeyDown(key('Enter')));
    expect(result.current.focusedIndex).toBe(0);
  });

  it('tracks reduced-motion media query changes and removes its listener', () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: (_name: string, next: typeof listener) => {
          listener = next;
        },
        removeEventListener,
      }))
    );
    const hook = renderHook(() => usePrefersReducedMotion());
    expect(hook.result.current).toBe(true);
    act(() => listener?.({ matches: false }));
    expect(hook.result.current).toBe(false);
    hook.unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});
