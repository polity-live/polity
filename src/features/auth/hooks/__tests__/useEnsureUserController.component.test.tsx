/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useEnsureUserController } from '../useEnsureUserController';

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
