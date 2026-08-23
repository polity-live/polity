/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
  updateCompleteProfile: vi.fn(),
  userHashtags: null as
    null | { id: string; hashtag_id: string; hashtag?: { id: string; tag: string } }[],
  allHashtags: null as null | { id: string; tag: string }[],
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../useUserMutations', () => ({
  useUserMutations: () => ({ updateCompleteProfile: mocks.updateCompleteProfile }),
}));
vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({
    userHashtags: mocks.userHashtags,
    allHashtags: mocks.allHashtags,
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/logic/richText', () => ({
  EMPTY_RICH_TEXT_VALUE: [{ type: 'p', children: [{ text: '' }] }],
  toRichTextValue: (value: string) => [{ type: 'p', children: [{ text: value }] }],
  richTextToPlainText: (value: unknown) => {
    if (typeof value === 'string') return value;
    const text = (value as { children?: { text?: string }[] }[])?.[0]?.children?.[0]?.text;
    return text ?? '';
  },
  toZeroRichTextValue: (value: unknown) => ({ normalized: value }),
}));

import { useUserProfileForm } from '../useUserProfileForm';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userHashtags = null;
  mocks.allHashtags = null;
  mocks.updateCompleteProfile.mockResolvedValue({ success: true });
});

afterEach(cleanup);

const submitEvent = { preventDefault: vi.fn() } as never;

describe('useUserProfileForm branch campaign A07', () => {
  it('keeps an empty form without a user and rejects submission safely', async () => {
    const { result } = renderHook(() => useUserProfileForm({ userId: 'user-1', user: null }));
    expect(result.current.formData.firstName).toBe('');
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('no_user_data'));
    expect(mocks.updateCompleteProfile).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('initializes valid fields and hashtags once, supports edits, and calls onSuccess', async () => {
    mocks.userHashtags = [
      { id: 'j-empty', hashtag_id: 'missing' },
      { id: 'j-civic', hashtag_id: 'tag-1', hashtag: { id: 'tag-1', tag: 'civic' } },
    ];
    mocks.allHashtags = [{ id: 'tag-1', tag: 'civic' }];
    const onSuccess = vi.fn();
    const user = {
      id: 'user-1',
      first_name: '',
      last_name: '',
      gender: 'male',
      about: 'Biography',
      bio: '',
      email: 'login@example.test',
      contact_email: 'contact@example.test',
      twitter: '',
      x: 'legacy-x',
      avatar: '',
      video_url: '',
      visibility: null,
    } as never;
    const view = renderHook(() => useUserProfileForm({ userId: 'user-1', user, onSuccess }));

    await waitFor(() => expect(view.result.current.formData.hashtags).toEqual(['civic']));
    expect(view.result.current.formData).toMatchObject({
      firstName: '',
      lastName: '',
      gender: 'male',
      contactEmail: 'contact@example.test',
      twitter: 'legacy-x',
      visibility: 'public',
      videoURL: '',
    });

    act(() => {
      view.result.current.updateField('firstName', 'Ada');
      view.result.current.updateField('contactEmail', 'public@example.test');
      view.result.current.updateAboutContent([
        { type: 'p', children: [{ text: 'Updated biography' }] },
      ] as never);
    });
    mocks.userHashtags = [
      { id: 'j-other', hashtag_id: 'tag-2', hashtag: { id: 'tag-2', tag: 'other' } },
    ];
    view.rerender();
    expect(view.result.current.formData.hashtags).toEqual(['civic']);

    await act(async () => view.result.current.handleSubmit(submitEvent));
    expect(mocks.updateCompleteProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        first_name: 'Ada',
        contact_email: 'public@example.test',
        gender: 'male',
        about: expect.any(Object),
        avatar: null,
        video_url: null,
        existingJunctions: mocks.userHashtags,
        allHashtags: mocks.allHashtags,
      })
    );
    expect(mocks.updateCompleteProfile.mock.calls[0]?.[1]).not.toHaveProperty('email');
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('normalizes invalid gender and empty about, handles unsuccessful mutation, then navigates', async () => {
    const user = {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      gender: 'unknown',
      about: null,
      avatar: 'avatar.png',
      video_url: 'video.mp4',
      visibility: 'private',
    } as never;
    mocks.updateCompleteProfile.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useUserProfileForm({ userId: 'user-1', user }));
    await waitFor(() => expect(result.current.formData.firstName).toBe('Ada'));
    expect(result.current.formData.gender).toBe('unspecified');

    await act(async () => result.current.handleSubmit(submitEvent));
    expect(mocks.updateCompleteProfile).toHaveBeenLastCalledWith(
      'user-1',
      expect.objectContaining({
        gender: null,
        about: null,
        avatar: 'avatar.png',
        video_url: 'video.mp4',
      })
    );
    expect(mocks.navigate).not.toHaveBeenCalled();

    mocks.updateCompleteProfile.mockResolvedValueOnce({ success: true });
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/user/user-1' });
  });

  it('reports mutation rejection and always clears submitting state', async () => {
    const user = { id: 'user-1', first_name: 'Ada' } as never;
    mocks.updateCompleteProfile.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useUserProfileForm({ userId: 'user-1', user }));
    await waitFor(() => expect(result.current.formData.firstName).toBe('Ada'));
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('failed_to_update_user'));
    expect(result.current.isSubmitting).toBe(false);
  });

  it('resets and hydrates profile fields and hashtags when the user id changes', async () => {
    mocks.userHashtags = [
      { id: 'first-junction', hashtag_id: 'first-tag', hashtag: { id: 'first-tag', tag: 'first' } },
    ];
    const firstUser = {
      id: 'first-user',
      first_name: 'First',
      contact_email: 'first@example.test',
      visibility: 'private',
    } as never;
    const view = renderHook(({ userId, user }) => useUserProfileForm({ userId, user }), {
      initialProps: { userId: 'first-user', user: firstUser },
    });
    await waitFor(() => expect(view.result.current.formData.hashtags).toEqual(['first']));

    mocks.userHashtags = [
      {
        id: 'second-junction',
        hashtag_id: 'second-tag',
        hashtag: { id: 'second-tag', tag: 'second' },
      },
    ];
    const secondUser = {
      id: 'second-user',
      first_name: 'Second',
      contact_email: 'second@example.test',
      visibility: 'authenticated',
    } as never;
    view.rerender({ userId: 'second-user', user: secondUser });

    await waitFor(() =>
      expect(view.result.current.formData).toMatchObject({
        firstName: 'Second',
        contactEmail: 'second@example.test',
        visibility: 'authenticated',
        hashtags: ['second'],
      })
    );
  });
});
