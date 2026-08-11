/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStateSwitcherController } from '../useStateSwitcherController';

const setNavigationView = vi.hoisted(() => vi.fn());
vi.mock('@/features/navigation/state/navigation.store.tsx', () => ({
  useNavigationStore: () => ({ navigationView: 'asButtonList', setNavigationView }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('useStateSwitcherController', () => {
  it('opens and closes mobile and desktop menus with their delays', () => {
    const { result, unmount } = renderHook(() =>
      useStateSwitcherController({ isMobile: false, navigationType: 'primary' })
    );
    expect(result.current.isPrimary).toBe(true);

    act(() => result.current.onMobileTriggerMouseEnter());
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.isDropdownOpen).toBe(true);
    act(() => result.current.onMobileMenuMouseLeave());
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.isDropdownOpen).toBe(false);

    act(() => result.current.onDesktopTriggerMouseEnter());
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.isExpanded).toBe(true);
    act(() => result.current.onDesktopMenuMouseLeave());
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.isExpanded).toBe(false);

    act(() => result.current.onMobileTriggerMouseEnter());
    unmount();
  });

  it('handles direct menu entry, external state, and view changes', () => {
    const { result } = renderHook(() =>
      useStateSwitcherController({ isMobile: true, navigationType: 'secondary' })
    );
    expect(result.current.isPrimary).toBe(false);
    act(() => result.current.onMobileMenuMouseEnter());
    expect(result.current.isDropdownOpen).toBe(true);
    act(() => result.current.onDesktopMenuMouseEnter());
    expect(result.current.isExpanded).toBe(true);
    act(() => result.current.onMobileStateChange('asLabeledButtonList'));
    expect(setNavigationView).toHaveBeenCalledWith('asLabeledButtonList');
    expect(result.current.isDropdownOpen).toBe(false);
    act(() => result.current.onDesktopStateChange('asButtonList'));
    expect(setNavigationView).toHaveBeenCalledWith('asButtonList');
    expect(result.current.isExpanded).toBe(false);
    act(() => result.current.setIsExpanded(true));
    act(() => result.current.setIsDropdownOpen(true));
    expect(result.current.isExpanded).toBe(true);
    expect(result.current.isDropdownOpen).toBe(true);
  });
});
