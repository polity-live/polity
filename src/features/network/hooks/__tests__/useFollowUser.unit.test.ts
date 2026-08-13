/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const useUserStateMock = vi.fn();
const followMock = vi.fn();
const unfollowMock = vi.fn();
const waitForClientApplyMock = vi.fn();

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: (...args: unknown[]) => useUserStateMock(...args),
}));

vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ follow: followMock, unfollow: unfollowMock }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => waitForClientApplyMock(...args),
}));

import { useFollowUser } from '../useFollowUser';

describe('useFollowUser', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useUserStateMock.mockReset();
    followMock.mockReset();
    unfollowMock.mockReset();
    waitForClientApplyMock.mockReset();
    useAuthMock.mockReturnValue({ user: null });
    useUserStateMock.mockReturnValue({ followers: [] });
    waitForClientApplyMock.mockResolvedValue(undefined);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'follow-id') });
  });

  it('rejects missing and self-follow identities without mutating', async () => {
    const { result, rerender } = renderHook(
      ({ targetUserId }: { targetUserId?: string }) => useFollowUser(targetUserId),
      { initialProps: { targetUserId: undefined } as { targetUserId?: string } }
    );

    expect(result.current.isFollowing).toBe(false);
    expect(result.current.followerCount).toBe(0);
    expect(result.current.canFollow).toBeUndefined();
    await act(async () => {
      await result.current.follow();
      await result.current.unfollow();
    });

    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    rerender({ targetUserId: undefined });
    await act(async () => {
      await result.current.follow();
      await result.current.unfollow();
    });

    rerender({ targetUserId: 'user-1' });
    expect(result.current.canFollow).toBe(false);
    await act(async () => result.current.follow());
    expect(followMock).not.toHaveBeenCalled();
    expect(unfollowMock).not.toHaveBeenCalled();
  });

  it('follows and unfollows through both toggle paths', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    useUserStateMock.mockReturnValue({ followers: [] });
    followMock.mockReturnValue('follow-result');
    unfollowMock.mockReturnValue('unfollow-result');
    const { result, rerender } = renderHook(() => useFollowUser('user-2'));

    expect(result.current.canFollow).toBe(true);
    await act(async () => result.current.toggleFollow());
    expect(followMock).toHaveBeenCalledWith({ id: 'follow-id', followee_id: 'user-2' });
    expect(waitForClientApplyMock).toHaveBeenCalledWith('follow-result');

    useUserStateMock.mockReturnValue({
      followers: [
        { id: 'record-1', follower_id: 'user-1' },
        { id: 'record-2', follower_id: 'user-3' },
      ],
    });
    rerender();
    expect(result.current.isFollowing).toBe(true);
    expect(result.current.followerCount).toBe(2);
    await act(async () => result.current.toggleFollow());
    expect(unfollowMock).toHaveBeenCalledWith('record-1');
    expect(waitForClientApplyMock).toHaveBeenCalledWith('unfollow-result');
  });

  it('handles absent records and failed follow mutations', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    useUserStateMock.mockReturnValue({ followers: [{ id: 'other', follower_id: 'user-3' }] });
    waitForClientApplyMock.mockRejectedValueOnce(new Error('follow failed'));
    const { result, rerender } = renderHook(() => useFollowUser('user-2'));

    await act(async () => {
      await result.current.unfollow();
      await result.current.follow();
    });
    expect(consoleError).toHaveBeenCalledWith('Failed to follow user:', expect.any(Error));

    useUserStateMock.mockReturnValue({ followers: [{ id: 'record-1', follower_id: 'user-1' }] });
    waitForClientApplyMock.mockRejectedValueOnce(new Error('unfollow failed'));
    rerender();
    await act(async () => result.current.unfollow());
    expect(consoleError).toHaveBeenCalledWith('Failed to unfollow user:', expect.any(Error));
    expect(result.current.isLoading).toBe(false);
    consoleError.mockRestore();
  });
});
