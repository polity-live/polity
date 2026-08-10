// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useUserBasicState: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/zero/users/useUserBasicState.ts', () => ({
  useUserBasicState: (...args: unknown[]) => mocks.useUserBasicState(...args),
}));

import { useNavUserAvatarController } from '../useNavUserAvatarController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useUserBasicState.mockReturnValue({
    user: {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      avatar: 'https://example.test/avatar.png',
    },
    isLoading: false,
  });
});

describe('useNavUserAvatarController', () => {
  it('loads only the narrow base-user state for the navigation avatar', () => {
    const { result } = renderHook(() =>
      useNavUserAvatarController({
        navigationView: 'asButton',
        authUser: { id: 'user-1', email: 'ada@example.test' },
      })
    );

    expect(mocks.useUserBasicState).toHaveBeenCalledWith('user-1');
    expect(result.current.displayName).toBe('Ada Lovelace');
    expect(result.current.displayAvatar).toBe('https://example.test/avatar.png');
    expect(result.current.userInitials).toBe('AL');
  });

  it('retains the email fallback and profile navigation behavior', () => {
    mocks.useUserBasicState.mockReturnValue({ user: undefined, isLoading: false });

    const { result } = renderHook(() =>
      useNavUserAvatarController({
        navigationView: 'asButton',
        authUser: { id: 'user-1', email: 'ada@example.test' },
      })
    );

    expect(result.current.displayName).toBe('ada');

    act(() => result.current.onAsButtonClick());

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/user/user-1' });
  });

  it('uses the generic fallback and ignores profile clicks in other navigation views', () => {
    mocks.useUserBasicState.mockReturnValue({ user: undefined, isLoading: false });
    const { result } = renderHook(() =>
      useNavUserAvatarController({
        navigationView: 'asButtonList',
        authUser: { id: 'user-2' },
      })
    );

    expect(result.current.displayName).toBe('User');
    expect(result.current.userInitials).toBe('U');
    act(() => result.current.onAsButtonClick());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('supports partial names and both dropdown state APIs', () => {
    mocks.useUserBasicState.mockReturnValue({
      user: { id: 'user-3', first_name: 'Grace', last_name: null },
      isLoading: false,
    });
    const { result } = renderHook(() =>
      useNavUserAvatarController({
        navigationView: 'asLabeledButtonList',
        authUser: { id: 'user-3', email: 'grace@example.test' },
      })
    );

    expect(result.current.displayName).toBe('Grace');
    act(() => result.current.onNameClick());
    expect(result.current.isDropdownOpen).toBe(true);
    act(() => result.current.onNameClick());
    expect(result.current.isDropdownOpen).toBe(false);
    act(() => result.current.onDropdownOpenChange(true));
    expect(result.current.isDropdownOpen).toBe(true);
    act(() => result.current.onDropdownOpenChange(false));
    expect(result.current.isDropdownOpen).toBe(false);
  });
});
