// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateBlog: vi.fn(),
  waitForClientApply: vi.fn(),
  syncHashtags: vi.fn(),
  timeline: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  blog: null as any,
  blogHashtags: undefined as any,
  allHashtags: undefined as any,
  blogLoading: false,
  commonLoading: false,
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({ updateBlog: mocks.updateBlog }),
}));
vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({ blogWithHashtags: mocks.blog, isLoading: mocks.blogLoading }),
}));
vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncHashtags }),
  useCommonState: () => ({
    blogHashtags: mocks.blogHashtags,
    allHashtags: mocks.allHashtags,
    isLoading: mocks.commonLoading,
  }),
}));
vi.mock('@/features/timeline/utils/createTimelineEvent', () => ({
  createTimelineEvent: (...args: unknown[]) => mocks.timeline(...args),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(...args),
}));
vi.mock('@/features/shared/logic/localDateTime', () => ({
  formatLocalDateInput: () => '2026-08-09T12:00',
}));

import { useBlogEditPage } from '../useBlogEditPage';

const submitEvent = () => ({ preventDefault: vi.fn() }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.blog = null;
  mocks.blogHashtags = undefined;
  mocks.allHashtags = undefined;
  mocks.blogLoading = false;
  mocks.commonLoading = false;
  mocks.updateBlog.mockReturnValue({ client: 'mutation' });
  mocks.waitForClientApply.mockResolvedValue(undefined);
  mocks.syncHashtags.mockResolvedValue(undefined);
  mocks.timeline.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useBlogEditPage exhaustive branch campaign A10', () => {
  it('hydrates nullable metadata and late hashtag data only once across both loading sources', () => {
    mocks.blog = {
      id: 'blog',
      title: null,
      date: null,
      image_url: null,
      video_url: null,
      visibility: null,
    };
    mocks.blogHashtags = [{}, { hashtag: { tag: '' } }, { hashtag: { tag: 'civic' } }];
    mocks.blogLoading = true;
    const { result, rerender } = renderHook(() => useBlogEditPage('blog'));
    expect(result.current.formData).toEqual({
      title: '',
      date: '2026-08-09T12:00',
      imageURL: '',
      videoURL: '',
      visibility: 'public',
      hashtags: ['civic'],
    });
    expect(result.current.isLoading).toBe(true);

    mocks.blogLoading = false;
    mocks.commonLoading = true;
    mocks.blogHashtags = [{ hashtag: { tag: 'late' } }];
    rerender();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.formData.hashtags).toEqual(['civic']);

    mocks.commonLoading = false;
    rerender();
    expect(result.current.isLoading).toBe(false);
  });

  it('covers absent blog and empty hashtag initialization guards', () => {
    const absent = renderHook(() => useBlogEditPage('missing'));
    expect(absent.result.current.blog).toBeNull();
    absent.unmount();

    mocks.blog = { id: 'blog', title: 'Blog', date: 'date', visibility: 'private' };
    mocks.blogHashtags = [];
    const empty = renderHook(() => useBlogEditPage('blog'));
    expect(empty.result.current.formData.hashtags).toEqual([]);
  });

  it('resets and hydrates every field and hashtags when the blog id changes', () => {
    mocks.blog = {
      id: 'first',
      title: 'First',
      date: 'first-date',
      image_url: 'first-image',
      video_url: 'first-video',
      visibility: 'private',
    };
    mocks.blogHashtags = [{ hashtag: { tag: 'first-tag' } }];
    const view = renderHook(({ blogId }) => useBlogEditPage(blogId), {
      initialProps: { blogId: 'first' },
    });
    expect(view.result.current.formData.title).toBe('First');

    mocks.blog = {
      id: 'second',
      title: 'Second',
      date: 'second-date',
      image_url: '',
      video_url: '',
      visibility: 'authenticated',
    };
    mocks.blogHashtags = [{ hashtag: { tag: 'second-tag' } }];
    view.rerender({ blogId: 'second' });

    expect(view.result.current.formData).toMatchObject({
      title: 'Second',
      date: 'second-date',
      visibility: 'authenticated',
      hashtags: ['second-tag'],
    });
  });

  it('updates fields, removes images, and resolves every contextual navigation target', () => {
    mocks.blog = { id: 'blog', title: 'Blog', group_id: 'blog-group' };
    const grouped = renderHook(() =>
      useBlogEditPage('blog', 'actor', { groupId: 'route-group', userId: 'route-user' })
    );
    act(() => grouped.result.current.updateField('title', 'Changed'));
    act(() => grouped.result.current.updateField('imageURL', 'image'));
    act(() => grouped.result.current.removeImage());
    expect(grouped.result.current.formData.imageURL).toBe('');
    act(() => grouped.result.current.navigateToBlog());
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/group/$id/blog/$entryId',
      params: { id: 'route-group', entryId: 'blog' },
    });
    grouped.unmount();

    renderHook(() => useBlogEditPage('blog', 'actor')).result.current.navigateToBlog();
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: { id: 'blog-group', entryId: 'blog' } })
    );
    mocks.blog = { id: 'blog', title: 'Blog', group_id: null };
    renderHook(() =>
      useBlogEditPage('blog', 'actor', { userId: 'route-user' })
    ).result.current.navigateToBlog();
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: { id: 'route-user', entryId: 'blog' } })
    );
    renderHook(() => useBlogEditPage('blog', 'actor')).result.current.navigateToBlog();
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: { id: 'actor', entryId: 'blog' } })
    );
    renderHook(() => useBlogEditPage('blog')).result.current.navigateToBlog();
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/blog/$id',
      params: { id: 'blog' },
    });
  });

  it('submits changed public media, syncs hashtags, and tolerates timeline failure', async () => {
    mocks.blog = {
      id: 'blog',
      title: 'Old',
      date: 'old-date',
      image_url: 'old-image',
      video_url: 'old-video',
      visibility: 'public',
      group_id: 'group',
    };
    mocks.blogHashtags = [{ hashtag: { tag: 'old' } }];
    mocks.allHashtags = [{ id: 'tag' }];
    const { result } = renderHook(() => useBlogEditPage('blog', 'actor'));
    act(() => {
      result.current.setFormData({
        title: 'New',
        date: 'new-date',
        imageURL: 'new-image',
        videoURL: 'new-video',
        visibility: 'public',
        hashtags: ['new'],
      });
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.timeline).toHaveBeenCalledTimes(2);
    expect(mocks.syncHashtags).toHaveBeenCalledWith(
      'blog',
      'blog',
      ['new'],
      mocks.blogHashtags,
      mocks.allHashtags
    );
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);

    mocks.timeline.mockImplementationOnce(() => {
      throw new Error('timeline unavailable');
    });
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(mocks.syncHashtags).toHaveBeenCalledTimes(2);
  });

  it('handles missing data, unchanged/private media, null junctions, and update failure', async () => {
    const missing = renderHook(() => useBlogEditPage('missing'));
    await act(() => missing.result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0220_no_blog_data_to_update_2e040d48'
    );
    expect(missing.result.current.isSubmitting).toBe(false);
    missing.unmount();

    mocks.blog = {
      id: 'blog',
      title: 'Blog',
      date: 'date',
      image_url: 'same-image',
      video_url: 'same-video',
      visibility: 'public',
      group_id: null,
    };
    mocks.blogHashtags = undefined;
    mocks.allHashtags = undefined;
    const unchanged = renderHook(() => useBlogEditPage('blog', 'actor'));
    act(() =>
      unchanged.result.current.setFormData({
        title: 'Blog',
        date: 'date',
        imageURL: 'same-image',
        videoURL: 'same-video',
        visibility: 'public',
        hashtags: [],
      })
    );
    await act(() => unchanged.result.current.handleSubmit(submitEvent()));
    expect(mocks.timeline).not.toHaveBeenCalled();
    expect(mocks.syncHashtags).toHaveBeenCalledWith('blog', 'blog', [], [], []);
    unchanged.unmount();

    const noActor = renderHook(() => useBlogEditPage('blog'));
    act(() =>
      noActor.result.current.setFormData({
        title: 'Blog',
        date: 'date',
        imageURL: '',
        videoURL: '',
        visibility: 'public',
        hashtags: [],
      })
    );
    await act(() => noActor.result.current.handleSubmit(submitEvent()));
    expect(mocks.updateBlog).toHaveBeenLastCalledWith(
      expect.objectContaining({ image_url: null, video_url: null })
    );
    noActor.unmount();

    const privateBlog = renderHook(() => useBlogEditPage('blog'));
    act(() => privateBlog.result.current.updateField('visibility', 'private'));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('update failed'));
    await act(() => privateBlog.result.current.handleSubmit(submitEvent()));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0222_failed_to_update_blog_68056f92'
    );
    expect(privateBlog.result.current.isSubmitting).toBe(false);
  });
});
