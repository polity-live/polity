/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserProfileForm } from '../useUserProfileForm';

const mocks = vi.hoisted(() => ({ updateCompleteProfile: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../useUserMutations', () => ({
  useUserMutations: () => ({ updateCompleteProfile: mocks.updateCompleteProfile }),
}));
vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({ userHashtags: [], allHashtags: [] }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

beforeEach(() => {
  mocks.updateCompleteProfile.mockReset();
  mocks.updateCompleteProfile.mockResolvedValue({ success: true });
});

describe('useUserProfileForm primary media', () => {
  it('initializes a user video and normalizes empty media values on submit', async () => {
    const user = {
      id: 'user-id',
      first_name: 'Video',
      last_name: 'User',
      avatar: null,
      video_url: 'https://example.test/profile.mp4',
      visibility: 'public',
      user_hashtags: [],
    } as never;
    const { result } = renderHook(() => useUserProfileForm({ userId: 'user-id', user }));

    await waitFor(() => {
      expect(result.current.formData.videoURL).toBe('https://example.test/profile.mp4');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });

    expect(mocks.updateCompleteProfile).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({ avatar: null, video_url: 'https://example.test/profile.mp4' })
    );
  });
});
