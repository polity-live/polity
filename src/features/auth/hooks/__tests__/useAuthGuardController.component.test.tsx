/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  loading: false,
  pathname: '/groups/group 1',
  searchStr: '',
  hash: '',
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({
    pathname: mocks.pathname,
    searchStr: mocks.searchStr,
    hash: mocks.hash,
  }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, loading: mocks.loading }),
}));

import { getAuthGuardRedirectTarget, useAuthGuardController } from '../useAuthGuardController';

beforeEach(() => {
  vi.useFakeTimers();
  mocks.user = null;
  mocks.loading = false;
  mocks.pathname = '/groups/group 1';
  mocks.searchStr = '';
  mocks.hash = '';
  mocks.navigate.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAuthGuardController', () => {
  it('waits while auth is loading and does not navigate', () => {
    mocks.loading = true;
    const { result } = renderHook(() => useAuthGuardController({ requireAuth: true }));

    expect(result.current).toEqual({ isReady: false, isAllowed: false });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('initializes immediately for a user and allows an authenticated route', () => {
    mocks.user = { id: 'user-1' };
    const renders: ReturnType<typeof useAuthGuardController>[] = [];
    const { result } = renderHook(() => {
      const state = useAuthGuardController({ requireAuth: true });
      renders.push(state);
      return state;
    });

    // renderHook flushes effects; its final result alone cannot detect the
    // unnecessary loading commit on a cached authenticated navigation.
    expect(renders[0]).toEqual({ isReady: true, isAllowed: true });
    expect(result.current.isReady).toBe(true);
    expect(result.current.isAllowed).toBe(true);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('keeps a present user behind the loading gate until the provider finishes initialization', () => {
    mocks.user = { id: 'user-1' };
    mocks.loading = true;
    const renders: ReturnType<typeof useAuthGuardController>[] = [];
    const { result, rerender } = renderHook(() => {
      const state = useAuthGuardController({ requireAuth: true });
      renders.push(state);
      return state;
    });
    expect(renders[0]).toEqual({ isReady: false, isAllowed: true });
    expect(result.current.isReady).toBe(false);
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.loading = false;
    rerender();
    expect(result.current).toEqual({ isReady: true, isAllowed: true });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('preserves the anonymous initialization delay before redirecting', () => {
    const renders: ReturnType<typeof useAuthGuardController>[] = [];
    const { result } = renderHook(() => {
      const state = useAuthGuardController({ requireAuth: true });
      renders.push(state);
      return state;
    });
    expect(renders[0]).toEqual({ isReady: false, isAllowed: false });
    act(() => vi.advanceTimersByTime(99));
    expect(result.current.isReady).toBe(false);
    expect(mocks.navigate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual({ isReady: true, isAllowed: false });
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it('redirects an anonymous user to an encoded auth return path after initialization', () => {
    mocks.searchStr = '?tab=members';
    mocks.hash = 'roles';
    const { result } = renderHook(() => useAuthGuardController({ requireAuth: true }));

    act(() => vi.advanceTimersByTime(100));

    expect(result.current).toEqual({ isReady: true, isAllowed: false });
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/auth?redirect=%2Fgroups%2Fgroup%201%3Ftab%3Dmembers%23roles',
    });
  });

  it('constructs browser and server-safe router targets without a window dependency', () => {
    expect(getAuthGuardRedirectTarget({ pathname: '/settings' })).toBe('/settings');
    expect(
      getAuthGuardRedirectTarget({
        pathname: '/settings',
        searchStr: '?tab=profile',
        hash: '#privacy',
      })
    ).toBe('/settings?tab=profile#privacy');
  });

  it('uses a custom redirect for an anonymous protected route', () => {
    renderHook(() => useAuthGuardController({ requireAuth: true, redirectTo: '/custom-login' }));
    act(() => vi.advanceTimersByTime(100));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/custom-login' });
  });

  it('redirects an authenticated user away from an anonymous-only route', () => {
    mocks.user = { id: 'user-1' };
    const { result } = renderHook(() => useAuthGuardController({ requireAuth: false }));

    expect(result.current.isReady).toBe(true);
    expect(result.current.isAllowed).toBe(false);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('uses a custom redirect for an authenticated anonymous-only route', () => {
    mocks.user = { id: 'user-1' };
    renderHook(() => useAuthGuardController({ requireAuth: false, redirectTo: '/dashboard' }));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/dashboard' });
  });

  it('allows an anonymous user on an anonymous-only route without navigating', () => {
    const { result } = renderHook(() => useAuthGuardController({ requireAuth: false }));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toEqual({ isReady: true, isAllowed: true });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('cancels the anonymous initialization timer when unmounted', () => {
    const { unmount } = renderHook(() => useAuthGuardController({ requireAuth: true }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
