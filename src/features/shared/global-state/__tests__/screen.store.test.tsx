/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScreenResponsiveDetector, useScreenStore } from '../screen.store';

describe('responsive screen detector', () => {
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;

  beforeEach(() => {
    useScreenStore.setState({ screenType: 'automatic', isMobileScreen: false });
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: true,
        media: '(max-width: 767px)',
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          changeListener = listener;
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    changeListener = undefined;
  });

  it('resolves the mobile media query in the client layout effect', () => {
    renderHook(() => useScreenResponsiveDetector());

    expect(useScreenStore.getState().isMobileScreen).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('keeps the store synchronized with breakpoint changes', () => {
    renderHook(() => useScreenResponsiveDetector());

    act(() => changeListener?.({ matches: false } as MediaQueryListEvent));

    expect(useScreenStore.getState().isMobileScreen).toBe(false);
  });
});
