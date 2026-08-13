/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useConnectionState: vi.fn(),
  useUserState: vi.fn(),
  refreshAuthState: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useConnectionState: mocks.useConnectionState,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: mocks.useUserState,
}));

import { browserIsOnline, useEnsureUserController } from '../useEnsureUserController';

describe('useEnsureUserController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      refreshAuthState: mocks.refreshAuthState,
      signOut: mocks.signOut,
    });
    mocks.useUserState.mockReturnValue({ isLoading: false });
    mocks.useConnectionState.mockReturnValue({ name: 'connected' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('treats server rendering as online and respects the browser network state', () => {
    vi.stubGlobal('navigator', undefined);
    expect(browserIsOnline()).toBe(true);
    vi.unstubAllGlobals();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(browserIsOnline()).toBe(false);
    const { result } = renderHook(() => useEnsureUserController());
    expect(result.current).toMatchObject({
      zeroConnectionState: 'disconnected',
      connectionNotice: 'offline',
      connectionStatus: 'disconnected',
    });
  });

  it('announces an offline-to-online reconnect until the stable connection delay elapses', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useEnsureUserController());

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current).toMatchObject({
      zeroConnectionState: 'disconnected',
      connectionNotice: 'offline',
    });

    mocks.useConnectionState.mockReturnValue({ name: 'disconnected' });
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current).toMatchObject({
      zeroConnectionState: 'connecting',
      connectionNotice: 'reconnecting',
    });

    mocks.useConnectionState.mockReturnValue({ name: 'connected' });
    rerender();
    act(() => vi.advanceTimersByTime(750));
    expect(result.current).toMatchObject({
      zeroConnectionState: 'connected',
      connectionNotice: null,
    });
  });

  it('removes browser listeners and clears a pending reconnect timer on unmount', () => {
    vi.useFakeTimers();
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useEnsureUserController());

    act(() => window.dispatchEvent(new Event('offline')));
    act(() => window.dispatchEvent(new Event('online')));
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(clearTimeout).toHaveBeenCalledOnce();
  });

  it.each([
    ['connected', 'syncing'],
    ['disconnected', 'disconnected'],
    ['connecting', 'connecting'],
  ] as const)('maps %s to the stable %s status', (name, connectionStatus) => {
    mocks.useConnectionState.mockReturnValue({ name });

    const { result } = renderHook(() => useEnsureUserController());

    expect(result.current).toMatchObject({
      hasUser: true,
      isLoading: false,
      zeroConnectionState: name,
      connectionStatus,
      signOut: mocks.signOut,
    });
  });

  it('waits for auth and authenticated user hydration but not anonymous user state', () => {
    mocks.useAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      refreshAuthState: mocks.refreshAuthState,
      signOut: mocks.signOut,
    });
    mocks.useUserState.mockReturnValue({ isLoading: true });
    const { result, rerender } = renderHook(() => useEnsureUserController());
    expect(result.current.isLoading).toBe(true);

    mocks.useAuth.mockReturnValue({
      user: null,
      loading: false,
      refreshAuthState: mocks.refreshAuthState,
      signOut: mocks.signOut,
    });
    rerender();
    expect(result.current).toMatchObject({ hasUser: false, isLoading: false });

    mocks.useAuth.mockReturnValue({
      user: null,
      loading: true,
      refreshAuthState: mocks.refreshAuthState,
      signOut: mocks.signOut,
    });
    rerender();
    expect(result.current.isLoading).toBe(true);
  });

  it('refreshes the auth state through retry', async () => {
    mocks.refreshAuthState.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnsureUserController());

    await act(() => result.current.retry());

    expect(mocks.refreshAuthState).toHaveBeenCalledOnce();
  });
});
