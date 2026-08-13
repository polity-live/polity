/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  updateProfile: vi.fn((args: unknown) => ({ mutation: 'updateProfile', args })),
  follow: vi.fn((args: unknown) => ({ mutation: 'follow', args })),
  unfollow: vi.fn((args: unknown) => ({ mutation: 'unfollow', args })),
  success: vi.fn(),
  error: vi.fn(),
  serverErrorCallbacks: [] as (() => void)[],
  serverConfirmed: vi.fn(async (_result?: unknown) => undefined),
  waitForClientApply: vi.fn(async (_result?: unknown) => undefined),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
}));
vi.mock('../../mutators', () => ({
  mutators: {
    users: {
      updateProfile: mocks.updateProfile,
      follow: mocks.follow,
      unfollow: mocks.unfollow,
    },
  },
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (_result: unknown, callback: () => void) =>
    mocks.serverErrorCallbacks.push(callback),
  serverConfirmed: (result: unknown) => mocks.serverConfirmed(result),
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));

import { useUserActions } from '../useUserActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.serverErrorCallbacks = [];
  mocks.mutate.mockImplementation(token => ({
    token,
    server: Promise.resolve({ type: 'success' }),
  }));
});
afterEach(cleanup);

describe('A07 user action facade execution contracts', () => {
  it('invokes every mutation, confirmation wait, and deferred error notification', async () => {
    const { result } = renderHook(() => useUserActions());

    act(() => result.current.updateProfile({ first_name: 'Ada' } as never));
    await act(() => result.current.updateProfileClientApplied({ last_name: 'Lovelace' } as never));
    await act(() => result.current.updateProfileServerConfirmed({ avatar: 'ada.png' } as never));
    act(() => result.current.follow({ id: 'follow-1', followee_id: 'user-2' } as never));
    act(() => result.current.unfollow('follow-1'));

    expect(mocks.mutate).toHaveBeenCalledTimes(5);
    expect(mocks.waitForClientApply).toHaveBeenCalledTimes(1);
    expect(mocks.serverConfirmed).toHaveBeenCalledTimes(1);
    expect(mocks.serverErrorCallbacks).toHaveLength(5);
    for (const callback of mocks.serverErrorCallbacks) callback();
    expect(mocks.error.mock.calls.map(([message]) => message)).toEqual([
      'features.user.toasts.profileUpdateFailed',
      'features.user.toasts.profileUpdateFailed',
      'features.user.toasts.profileUpdateFailed',
      'features.user.toasts.followFailed',
      'features.user.toasts.unfollowFailed',
    ]);
  });
});
