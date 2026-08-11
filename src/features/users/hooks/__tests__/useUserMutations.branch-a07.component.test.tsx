/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  syncHashtags: vi.fn(),
  createTimelineEvent: vi.fn(),
}));

vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileClientApplied: mocks.updateProfile }),
}));

vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncHashtags }),
}));

vi.mock('@/features/timeline/utils/createTimelineEvent', () => ({
  createTimelineEvent: mocks.createTimelineEvent,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, options?: { name?: string }) =>
    options?.name ? `${key}:${options.name}` : key,
}));

import { useUserMutations } from '../useUserMutations';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateProfile.mockResolvedValue(undefined);
  mocks.syncHashtags.mockResolvedValue(undefined);
  mocks.createTimelineEvent.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('useUserMutations branch campaign A07', () => {
  it('updates a profile and exposes both Error and fallback failure messages', async () => {
    const { result } = renderHook(() => useUserMutations());
    await act(async () => {
      await expect(
        result.current.updateUserProfile('user-1', { first_name: 'Ada' })
      ).resolves.toEqual({ success: true });
    });
    expect(mocks.updateProfile).toHaveBeenCalledWith({ first_name: 'Ada' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    mocks.updateProfile.mockRejectedValueOnce(new Error('profile exploded'));
    await act(async () => {
      await expect(result.current.updateUserProfile('user-1', {})).resolves.toEqual({
        success: false,
        error: 'profile exploded',
      });
    });
    expect(result.current.error).toBe('profile exploded');

    mocks.updateProfile.mockRejectedValueOnce('unknown profile failure');
    await act(async () => {
      await result.current.updateUserProfile('user-1', {});
    });
    expect(result.current.error).toContain('failed_to_update_profile');
  });

  it('links avatar media, records its timeline event, and handles both error variants', async () => {
    const { result } = renderHook(() => useUserMutations());
    await act(async () => {
      await expect(result.current.linkAvatarFile('user-1', 'file-1')).resolves.toEqual({
        success: true,
      });
    });
    expect(mocks.updateProfile).toHaveBeenCalledWith({ avatar: 'file-1', video_url: null });
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'image_uploaded', entityId: 'user-1' }),
      })
    );

    mocks.updateProfile.mockRejectedValueOnce(new Error('avatar exploded'));
    await act(async () => {
      await result.current.linkAvatarFile('user-1', 'file-2');
    });
    expect(result.current.error).toBe('avatar exploded');

    mocks.updateProfile.mockRejectedValueOnce({ reason: 'not an Error' });
    await act(async () => {
      await result.current.linkAvatarFile('user-1', 'file-3');
    });
    expect(result.current.error).toContain('failed_to_update_avatar');
  });

  it('synchronizes complete profile hashtags and describes named and anonymous updates', async () => {
    const { result } = renderHook(() => useUserMutations());
    const junctions = [{ id: 'junction-1', hashtag_id: 'tag-1' }];
    const hashtags = [{ id: 'tag-1', tag: 'civic' }];

    await act(async () => {
      await result.current.updateCompleteProfile('user-1', {
        first_name: 'Ada',
        last_name: 'Lovelace',
        aboutPlainText: 'A'.repeat(120),
        hashtags: ['civic'],
        existingJunctions: junctions,
        allHashtags: hashtags,
      });
    });
    expect(mocks.syncHashtags).toHaveBeenCalledWith(
      'user',
      'user-1',
      ['civic'],
      junctions,
      hashtags
    );
    expect(mocks.createTimelineEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: expect.stringContaining('Ada Lovelace'),
          description: 'A'.repeat(100),
        }),
      })
    );

    await act(async () => {
      await result.current.updateCompleteProfile('user-1', {});
      await result.current.updateCompleteProfile('user-1', { hashtags: [] });
      await result.current.updateCompleteProfile('user-1', {
        hashtags: [],
        existingJunctions: [],
      });
      await result.current.updateCompleteProfile('user-1', { first_name: 'Ada' });
    });
    expect(mocks.syncHashtags).toHaveBeenCalledTimes(1);
    expect(mocks.createTimelineEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: undefined }),
      })
    );
  });

  it('returns complete-profile Error and translated fallback failures', async () => {
    const { result } = renderHook(() => useUserMutations());
    mocks.updateProfile.mockRejectedValueOnce(new Error('complete exploded'));
    await act(async () => {
      await result.current.updateCompleteProfile('user-1', {});
    });
    expect(result.current.error).toBe('complete exploded');

    mocks.updateProfile.mockRejectedValueOnce(null);
    await act(async () => {
      await result.current.updateCompleteProfile('user-1', {});
    });
    expect(result.current.error).toContain('failed_to_update_profile');
  });
});
