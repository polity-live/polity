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
});
