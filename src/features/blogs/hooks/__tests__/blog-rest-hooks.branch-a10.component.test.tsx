/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blog: undefined as Record<string, unknown> | undefined,
  subscribers: undefined as Record<string, unknown>[] | undefined,
  subscriberCount: 0,
  user: undefined as { id: string } | undefined,
  updateBlog: vi.fn(),
  subscribeToBlog: vi.fn(),
  unsubscribeFromBlog: vi.fn(),
  createBlogFull: vi.fn(),
  waitForClientApply: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({
    blog: mocks.blog,
    subscribers: mocks.subscribers,
    subscriberCount: mocks.subscriberCount,
  }),
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({
    updateBlog: mocks.updateBlog,
    subscribeToBlog: mocks.subscribeToBlog,
    unsubscribeFromBlog: mocks.unsubscribeFromBlog,
    createBlogFull: mocks.createBlogFull,
  }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.waitForClientApply(value),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/logic/localDateTime', () => ({
  formatLocalDateInput: () => '2026-08-09',
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));

import { useBlogEditorController } from '../useBlogEditorController';
import { useBlogNotificationsController } from '../useBlogNotificationsController';
import { useSubscribeBlog } from '../useSubscribeBlog';
import { useCreateBlogFormController } from '../../ui/useCreateBlogFormController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blog = undefined;
  mocks.subscribers = undefined;
  mocks.subscriberCount = 0;
  mocks.user = undefined;
  mocks.waitForClientApply.mockImplementation(async value => value);
  mocks.updateBlog.mockReturnValue(Promise.resolve());
  mocks.subscribeToBlog.mockReturnValue(Promise.resolve());
  mocks.unsubscribeFromBlog.mockReturnValue(Promise.resolve());
  mocks.createBlogFull.mockReturnValue({ blogResult: Promise.resolve() });
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000010');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('remaining blog hooks A10', () => {
  it('loads and saves editor content, including empty and failed saves', async () => {
    const { result, rerender } = renderHook(() => useBlogEditorController({ blogId: 'blog-1' }));
    expect(result.current).toMatchObject({ content: '', isLoaded: false });

    mocks.blog = { title: 'Blog', content: '' };
    rerender();
    expect(result.current.content).toBe('');
    mocks.blog = { title: 'Blog', content: 'body' };
    rerender();
    await waitFor(() => expect(result.current.content).toBe('body'));

    act(() => result.current.onContentChange('changed'));
    await act(() => result.current.onSave());
    expect(mocks.updateBlog).toHaveBeenCalledWith({ id: 'blog-1', content: 'changed' });
    expect(mocks.toastSuccess).toHaveBeenCalled();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('save failed'));
    await act(() => result.current.onSave());
    expect(result.current.isSaving).toBe(false);
  });

  it('uses the blog notification title and fallback', () => {
    const { result, rerender } = renderHook(() =>
      useBlogNotificationsController({ blogId: 'blog-1' })
    );
    expect(result.current.entityName).toBe('Blog');
    mocks.blog = { title: 'Named' };
    rerender();
    expect(result.current.entityName).toBe('Named');
  });

  it('covers projected, persisted, optimistic, duplicate, fallback, and error subscriptions', async () => {
    mocks.user = { id: 'user-1' };
    const projected = {
      subscriptions: [{ id: 'nested', subscriber_user: { id: 'user-1' } }],
      subscriberCount: 7,
      isLoading: true,
    } as never;
    const projectedHook = renderHook(() => useSubscribeBlog('blog-1', projected));
    await waitFor(() => expect(projectedHook.result.current.isSubscribed).toBe(true));
    expect(projectedHook.result.current.subscriberCount).toBe(7);
    await act(() => projectedHook.result.current.subscribe());
    expect(mocks.subscribeToBlog).not.toHaveBeenCalled();
    await act(() => projectedHook.result.current.unsubscribe());
    projectedHook.unmount();

    const missingProjection = renderHook(() =>
      useSubscribeBlog('blog-1', {
        subscriptions: undefined,
        subscriberCount: undefined,
        isLoading: false,
      } as never)
    );
    await waitFor(() => expect(missingProjection.result.current.subscriberCount).toBe(0));
    await act(() => missingProjection.result.current.subscribe());
    await act(() => missingProjection.result.current.unsubscribe());
    missingProjection.unmount();

    mocks.subscribers = [];
    mocks.subscriberCount = 2;
    const hook = renderHook(() => useSubscribeBlog('blog-1'));
    await waitFor(() => expect(hook.result.current.subscriberCount).toBe(2));
    await act(() => hook.result.current.subscribe());
    expect(hook.result.current).toMatchObject({ isSubscribed: true, subscriberCount: 3 });
    expect(mocks.subscribeToBlog).toHaveBeenCalled();

    await act(() => hook.result.current.unsubscribe());
    expect(mocks.unsubscribeFromBlog).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000010');

    mocks.subscribers = [];
    hook.rerender();
    await act(() => hook.result.current.unsubscribe());

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('subscribe failed'));
    await act(() => hook.result.current.subscribe());
    expect(mocks.toastError).toHaveBeenCalled();

    mocks.subscribers = [{ id: 'persisted', subscriber_id: 'user-1' }];
    hook.rerender();
    await waitFor(() => expect(hook.result.current.isSubscribed).toBe(true));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('unsubscribe failed'));
    await act(() => hook.result.current.unsubscribe());
    expect(hook.result.current.isSubscribed).toBe(true);
    await act(() => hook.result.current.toggleSubscribe());
  });

  it('guards missing subscription identities and ignores toggles while loading', async () => {
    const anonymous = renderHook(() => useSubscribeBlog(undefined));
    expect(anonymous.result.current.canSubscribe).toBe(false);
    await act(() => anonymous.result.current.subscribe());
    await act(() => anonymous.result.current.unsubscribe());
    await act(() => anonymous.result.current.toggleSubscribe());
    anonymous.unmount();

    mocks.user = { id: 'user-1' };
    mocks.subscribers = [];
    let release: (() => void) | undefined;
    mocks.waitForClientApply.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        })
    );
    const hook = renderHook(() => useSubscribeBlog('blog-1'));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = hook.result.current.subscribe();
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
    await act(() => hook.result.current.toggleSubscribe());
    await act(async () => {
      release?.();
      await pending;
    });
  });

  it('handles carousel selection, unauthenticated, public/private, and failed blog creation', async () => {
    const { result, rerender } = renderHook(() => useCreateBlogFormController());
    await act(() => result.current.handleSubmit());
    expect(mocks.toastError).toHaveBeenCalled();

    const handlers: Record<string, () => void> = {};
    const carousel = {
      on: vi.fn((event: string, callback: () => void) => {
        handlers[event] = callback;
      }),
      selectedScrollSnap: vi.fn(() => 2),
    };
    act(() => result.current.setCarouselApi(carousel as never));
    act(() => handlers.select());
    expect(result.current.currentStep).toBe(2);

    mocks.user = { id: 'user-1' };
    rerender();
    act(() =>
      result.current.setFormData({
        ...result.current.formData,
        title: 'Public',
        visibility: 'public',
        imageURL: '',
        videoURL: '',
      })
    );
    await act(() => result.current.handleSubmit());
    expect(mocks.createBlogFull).toHaveBeenCalledWith(
      expect.objectContaining({
        timeline_event: expect.objectContaining({ image_url: '', video_url: '' }),
      })
    );
    expect(mocks.navigate).toHaveBeenCalled();

    act(() =>
      result.current.setFormData({
        ...result.current.formData,
        visibility: 'private',
        imageURL: 'image',
        videoURL: 'video',
      })
    );
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('create failed'));
    await act(() => result.current.handleSubmit());
    expect(mocks.createBlogFull).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeline_event: null })
    );
    expect(result.current.isSubmitting).toBe(false);
  });
});
