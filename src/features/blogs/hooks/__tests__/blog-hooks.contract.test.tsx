/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBlogEditorController } from '../useBlogEditorController';
import { useBlogEditPage } from '../useBlogEditPage';
import { useBlogModeSelectorController } from '../useBlogModeSelectorController';
import { useBlogNotificationsController } from '../useBlogNotificationsController';
import { useBlogPermissions } from '../useBlogPermissions';
import { useResolvedBlogRedirectController } from '../useResolvedBlogRedirectController';
import { useSubscribeBlog } from '../useSubscribeBlog';

const mocks = vi.hoisted(() => ({
  blogState: {} as any,
  commonState: {
    blogHashtags: [] as any[],
    allHashtags: [] as any[],
    isLoading: false,
  },
  authUser: { id: 'user-1' } as null | { id: string },
  recoveryDraft: null as any,
  updateBlog: vi.fn(),
  subscribeToBlog: vi.fn(),
  unsubscribeFromBlog: vi.fn(),
  syncEntityHashtags: vi.fn(),
  navigate: vi.fn(),
  createTimelineEvent: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  can: vi.fn(),
  isABlogger: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/zero/blogs/useBlogState', () => ({ useBlogState: () => mocks.blogState }));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({
    updateBlog: mocks.updateBlog,
    subscribeToBlog: mocks.subscribeToBlog,
    unsubscribeFromBlog: mocks.unsubscribeFromBlog,
  }),
}));
vi.mock('@/zero/common', () => ({
  useCommonState: () => mocks.commonState,
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncEntityHashtags }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/timeline/utils/createTimelineEvent', () => ({
  createTimelineEvent: mocks.createTimelineEvent,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => mocks.recoveryDraft,
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ can: mocks.can, isABlogger: mocks.isABlogger, isLoading: true }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blogState = {};
  mocks.commonState = { blogHashtags: [], allHashtags: [], isLoading: false };
  mocks.authUser = { id: 'user-1' };
  mocks.recoveryDraft = null;
  mocks.can.mockImplementation((action: string) => action !== 'delete');
  mocks.isABlogger.mockReturnValue(true);
  mocks.updateBlog.mockResolvedValue(undefined);
  mocks.subscribeToBlog.mockResolvedValue(undefined);
  mocks.unsubscribeFromBlog.mockResolvedValue(undefined);
  mocks.syncEntityHashtags.mockResolvedValue(undefined);
  mocks.createTimelineEvent.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('blog controller hooks', () => {
  it('hydrates editor content and exposes saving lifecycle and outcome notifications', async () => {
    mocks.blogState = { blog: { id: 'blog-1', title: 'Policy', content: 'Initial' } };
    const { result } = renderHook(() => useBlogEditorController({ blogId: 'blog-1' }));
    await waitFor(() => expect(result.current.content).toBe('Initial'));
    expect(result.current).toMatchObject({ blogTitle: 'Policy', isLoaded: true, isSaving: false });

    act(() => result.current.onContentChange('Updated'));
    await act(async () => result.current.onSave());
    expect(mocks.updateBlog).toHaveBeenCalledWith({ id: 'blog-1', content: 'Updated' });
    expect(mocks.toast.success).toHaveBeenCalledWith(
      'generated.inline.0265_blog_content_saved_successfully_53103bde'
    );
    expect(result.current.isSaving).toBe(false);

    mocks.updateBlog.mockRejectedValueOnce(new Error('save failed'));
    await act(async () => result.current.onSave());
    expect(console.error).toHaveBeenCalledWith('Error saving blog content:', expect.any(Error));
  });

  it('initializes editable metadata, syncs hashtags, emits changed media, and returns to contextual detail', async () => {
    mocks.blogState = {
      blogWithHashtags: {
        id: 'blog-1',
        title: 'Original',
        date: '2026-08-01',
        image_url: 'old.png',
        video_url: null,
        visibility: 'public',
        group_id: 'group-1',
      },
      isLoading: false,
    };
    mocks.commonState = {
      blogHashtags: [{ hashtag: { id: 'tag-1', tag: 'policy' } }],
      allHashtags: [{ id: 'tag-1', tag: 'policy' }],
      isLoading: false,
    };
    const { result } = renderHook(() =>
      useBlogEditPage('blog-1', 'actor-1', { groupId: 'group-context' })
    );
    await waitFor(() => expect(result.current.formData.hashtags).toEqual(['policy']));
    act(() => {
      result.current.updateField('title', 'Updated');
      result.current.updateField('imageURL', 'new.png');
      result.current.updateField('videoURL', 'video.mp4');
      result.current.updateField('hashtags', ['policy', 'budget']);
    });
    const preventDefault = vi.fn();
    await act(async () => result.current.handleSubmit({ preventDefault } as any));

    expect(preventDefault).toHaveBeenCalled();
    expect(mocks.updateBlog).toHaveBeenCalledWith({
      id: 'blog-1',
      title: 'Updated',
      date: '2026-08-01',
      image_url: 'new.png',
      video_url: 'video.mp4',
      visibility: 'public',
    });
    expect(mocks.createTimelineEvent).toHaveBeenCalledTimes(2);
    expect(mocks.syncEntityHashtags).toHaveBeenCalledWith(
      'blog',
      'blog-1',
      ['policy', 'budget'],
      mocks.commonState.blogHashtags,
      mocks.commonState.allHashtags
    );
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/group/$id/blog/$entryId',
      params: { id: 'group-context', entryId: 'blog-1' },
    });
    expect(result.current.isSubmitting).toBe(false);
    act(() => result.current.removeImage());
    expect(result.current.formData.imageURL).toBe('');
  });

  it('maps mode, notification, permission, and resolved redirect contracts for every owner surface', async () => {
    mocks.blogState = {
      blog: { title: 'News' },
      blogWithBloggers: {
        group_id: 'group-1',
        bloggers: [{ status: 'owner', user: { id: 'owner-1' } }],
      },
      isLoading: false,
    };
    const mode = renderHook(() => useBlogModeSelectorController({ blogId: 'blog-1' }));
    await act(async () => mode.result.current.handleModeChange('edit'));
    expect(mocks.updateBlog).toHaveBeenCalledWith({ id: 'blog-1', editing_mode: 'edit' });
    expect(mocks.toast.success).toHaveBeenCalledWith('features.blogs.modeSelector.title');

    const notification = renderHook(() => useBlogNotificationsController({ blogId: 'blog-1' }));
    expect(notification.result.current.entityName).toBe('News');
    const permissions = renderHook(() => useBlogPermissions('blog-1'));
    expect(permissions.result.current).toEqual({
      canEdit: true,
      canDelete: false,
      canManageMembers: true,
      isBlogger: true,
      isLoading: true,
    });
    const group = renderHook(() =>
      useResolvedBlogRedirectController({ blogId: 'blog-1', target: 'notifications' })
    );
    expect(group.result.current).toEqual({
      status: 'group',
      to: '/group/$id/blog/$entryId/notifications',
      params: { id: 'group-1', entryId: 'blog-1' },
    });

    mocks.blogState = {
      blogWithBloggers: { group_id: null, bloggers: [{ user: { id: 'owner-1' } }] },
      isLoading: false,
    };
    const user = renderHook(() =>
      useResolvedBlogRedirectController({ blogId: 'blog-1', target: 'edit' })
    );
    expect(user.result.current).toEqual({
      status: 'user',
      to: '/user/$id/blog/$entryId/edit',
      params: { id: 'owner-1', entryId: 'blog-1' },
    });
  });

  it('prioritizes recovery and loading before denying unresolved redirect ownership', () => {
    mocks.recoveryDraft = { id: 'draft-1' };
    mocks.blogState = { blogWithBloggers: null, isLoading: true };
    const recovery = renderHook(() => useResolvedBlogRedirectController({ blogId: 'blog-1' }));
    expect(recovery.result.current).toEqual({ status: 'recovery', draft: { id: 'draft-1' } });
    recovery.unmount();

    mocks.recoveryDraft = null;
    const loading = renderHook(() => useResolvedBlogRedirectController({ blogId: 'blog-1' }));
    expect(loading.result.current).toEqual({ status: 'loading' });
    loading.unmount();

    mocks.blogState = { blogWithBloggers: null, isLoading: false };
    const denied = renderHook(() => useResolvedBlogRedirectController({ blogId: 'blog-1' }));
    expect(denied.result.current).toEqual({ status: 'denied' });
  });

  it('optimistically subscribes, reconciles persisted rows, and unsubscribes exact duplicates', async () => {
    mocks.blogState = { subscribers: [], subscriberCount: 2 };
    const { result, rerender } = renderHook(() => useSubscribeBlog('blog-1'));
    await waitFor(() => expect(result.current.subscriberCount).toBe(2));
    expect(result.current.canSubscribe).toBe(true);

    await act(async () => result.current.subscribe());
    expect(result.current).toMatchObject({
      isSubscribed: true,
      subscriberCount: 3,
      isLoading: false,
    });
    expect(mocks.subscribeToBlog).toHaveBeenCalledWith(
      expect.objectContaining({ blog_id: 'blog-1', user_id: null })
    );

    mocks.blogState = {
      subscribers: [
        { id: 'subscription-1', subscriber_id: 'user-1' },
        { id: 'subscription-2', subscriber_user: { id: 'user-1' } },
      ],
      subscriberCount: 4,
    };
    rerender();
    await waitFor(() => expect(result.current.subscriberCount).toBe(4));
    await act(async () => result.current.toggleSubscribe());
    expect(mocks.unsubscribeFromBlog.mock.calls).toEqual([['subscription-1'], ['subscription-2']]);
    expect(result.current).toMatchObject({ isSubscribed: false, subscriberCount: 2 });
  });

  it('rolls back failed subscription mutations and guards missing users, targets, and duplicate rows', async () => {
    mocks.blogState = { subscribers: [], subscriberCount: 0 };
    mocks.subscribeToBlog.mockRejectedValueOnce(new Error('subscribe failed'));
    const { result } = renderHook(() => useSubscribeBlog('blog-1'));
    await act(async () => result.current.toggleSubscribe());
    expect(result.current).toMatchObject({ isSubscribed: false, subscriberCount: 0 });
    expect(mocks.toast.error).toHaveBeenCalledWith(
      'generated.inline.0224_failed_to_subscribe_to_blog_please_try_again_8f89bbc2'
    );

    mocks.authUser = null;
    const guarded = renderHook(() => useSubscribeBlog(undefined));
    expect(guarded.result.current.canSubscribe).toBe(false);
    await act(async () => guarded.result.current.subscribe());
    expect(mocks.subscribeToBlog).toHaveBeenCalledTimes(1);
  });
});
