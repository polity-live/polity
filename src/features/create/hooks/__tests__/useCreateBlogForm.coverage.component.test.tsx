/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | undefined,
  search: {} as { groupId?: string },
  groupLoading: false,
  creatableIds: new Set<string>(),
  restore: null as any,
  navigate: vi.fn(),
  createBlogFull: vi.fn(),
  trackCreateFinalization: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({ createBlogFull: mocks.createBlogFull }),
}));
vi.mock('@/zero/common', () => ({ useCommonState: () => ({ userHashtags: [] }) }));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtagTags: () => ['civic'] }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupById: (id?: string) => ({
    group: id && id !== 'missing' ? { id, name: `Group ${id}` } : undefined,
  }),
}));
vi.mock('@/zero/rbac', () => ({
  useCreatableGroupIds: () => ({
    creatableGroupIds: mocks.creatableIds,
    isLoading: mocks.groupLoading,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string, values?: any) =>
    key === 'generated.inline.0030_public_61c9b2b1'
      ? 'public'
      : key === 'generated.inline.0031_authenticated_8fda38ce'
        ? 'authenticated'
        : values?.value2775
          ? `${key}:${values.value2775}`
          : key,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/features/create/logic/createSearchParams', () => ({
  mergeCreateSearchParams: (previous: any, updates: any) => ({ ...previous, ...updates }),
}));
vi.mock('@/features/create/logic/createSubmitTargets', () => ({
  createBlockedSubmitOutcome: () => ({ status: 'blocked' }),
  createRouteSubmitTarget: (_entity: string, target: unknown) => target,
  createSuccessSubmitOutcome: (target: unknown) => ({ status: 'success', target }),
}));
vi.mock('@/features/create/logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => mocks.restore,
  trackCreateFinalization: (...args: unknown[]) => mocks.trackCreateFinalization(...args),
}));
vi.mock('@/features/shared/logic/localDateTime', () => ({
  formatLocalDateInput: () => '2026-08-09',
}));

import { useCreateBlogForm } from '../useCreateBlogForm';

function field(config: any, key: string) {
  for (const step of config.steps) {
    const found = step.fields.find((candidate: any) => candidate.key === key);
    if (found) return found;
  }
  throw new Error(`Missing ${key}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.search = {};
  mocks.groupLoading = false;
  mocks.creatableIds = new Set();
  mocks.restore = null;
  mocks.navigate.mockResolvedValue(undefined);
  mocks.createBlogFull.mockReturnValue({
    blogResult: { client: Promise.resolve(), server: Promise.resolve() },
  });
});

describe('useCreateBlogForm', () => {
  it('updates all fields, group search, review media, hashtags, and visibility', () => {
    mocks.creatableIds = new Set(['group-1']);
    const { result } = renderHook(() => useCreateBlogForm());
    expect(result.current.steps[0].isValid()).toBe(false);
    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.validation.titleRequired'
    );
    expect(result.current.steps.at(-1)?.isValid()).toBe(false);
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.validation.titleRequired'
    );
    result.current.steps.forEach(step => expect(step.isValid()).toBeTypeOf('boolean'));

    act(() => {
      field(result.current, 'title').onValueChange('Blog title');
      field(result.current, 'date').onValueChange('2026-09-01');
      field(result.current, 'media').props.onImageChange('image.png');
      field(result.current, 'media').props.onVideoChange('video.mp4');
      field(result.current, 'visibility').props.onChange('authenticated');
      field(result.current, 'hashtags').props.onChange(['civic']);
    });
    expect(result.current.steps[0].isValid()).toBe(true);
    expect(result.current.steps[0].getInvalidReason?.()).toBeNull();
    expect(result.current.steps.at(-1)?.isValid()).toBe(true);
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBeNull();

    const group = () => field(result.current, 'group').props;
    expect(group().filterFn({ id: 'group-1' })).toBe(true);
    expect(group().filterFn({ id: 'group-2' })).toBe(false);
    act(() => group().onChange({ id: 'group-1', label: 'Group One' }));
    expect(group().value).toBe('group-1');
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/create/blog-entry', replace: true })
    );
    act(() => group().onChange(null));
    expect(group().value).toBeUndefined();

    const review = field(result.current, 'review').props;
    expect(review).toMatchObject({
      title: 'Blog title',
      secondaryBadge: 'pages.create.common.authenticated',
      hashtags: ['civic'],
    });
    expect(review.media).toMatchObject({ imageUrl: 'image.png', videoUrl: 'video.mp4' });
  });

  it('covers pending and denied prefilled group permissions and unloaded group names', () => {
    mocks.search = { groupId: 'group-denied' };
    mocks.groupLoading = true;
    const { result, rerender } = renderHook(() => useCreateBlogForm());
    act(() => field(result.current, 'title').onValueChange('Permission test'));
    expect(result.current.steps[0].isValid()).toBe(false);
    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.blog.validation.groupPermissionPending'
    );

    mocks.groupLoading = false;
    rerender();
    expect(field(result.current, 'group').invalid).toBe(true);
    expect(field(result.current, 'group').error).toBe(
      'pages.create.blog.validation.groupPermissionDenied'
    );

    mocks.search = { groupId: 'missing' };
    mocks.creatableIds = new Set(['missing']);
    rerender();
    expect(field(result.current, 'group').props.value).toBe('missing');
  });

  it('restores complete and sparse drafts and clears a stale prefilled group name', () => {
    mocks.creatableIds = new Set(['group-1']);
    mocks.restore = {
      formState: {
        title: 'Restored',
        date: '2027-01-01',
        imageURL: 'image',
        videoURL: 'video',
        visibility: 'private',
        groupId: 'group-1',
        hashtags: ['restored'],
      },
    };
    const full = renderHook(() => useCreateBlogForm());
    expect(field(full.result.current, 'title').value).toBe('Restored');
    expect(field(full.result.current, 'review').props.sections[0].fields.at(-1).value).toBe(
      'Group group-1'
    );
    full.unmount();

    mocks.restore = { formState: {} };
    const sparse = renderHook(() => useCreateBlogForm());
    expect(field(sparse.result.current, 'date').value).toBe('2026-08-09');
    expect(field(sparse.result.current, 'hashtags').props.value).toEqual([]);

    sparse.unmount();
    mocks.restore = null;
    mocks.search = { groupId: 'group-1' };
    const synced = renderHook(() => useCreateBlogForm());
    expect(field(synced.result.current, 'review').props.sections[0].fields.at(-1).value).toBe(
      'Group group-1'
    );
    mocks.search = {};
    synced.rerender();
    expect(
      field(synced.result.current, 'review').props.sections[0].fields.some(
        (entry: any) => entry.label === 'pages.create.blog.attachTo'
      )
    ).toBe(false);
  });

  it('blocks invalid permissions and submits public group and private user targets', async () => {
    mocks.search = { groupId: 'group-denied' };
    const denied = renderHook(() => useCreateBlogForm());
    act(() => field(denied.result.current, 'title').onValueChange('Denied'));
    await expect(denied.result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    expect(mocks.toastError).toHaveBeenCalledWith(
      'pages.create.blog.validation.groupPermissionDenied'
    );
    denied.unmount();

    mocks.search = { groupId: 'group-1' };
    mocks.creatableIds = new Set(['group-1']);
    const grouped = renderHook(() => useCreateBlogForm());
    act(() => {
      field(grouped.result.current, 'title').onValueChange(' Public blog ');
      field(grouped.result.current, 'media').props.onImageChange('image');
      field(grouped.result.current, 'media').props.onVideoChange('video');
      field(grouped.result.current, 'hashtags').props.onChange(['civic']);
    });
    const reportProgress = vi.fn();
    const groupOutcome = await act(async () =>
      grouped.result.current.onSubmit({ reportProgress, setRecoveryTarget: vi.fn() })
    );
    expect(groupOutcome).toMatchObject({
      status: 'success',
      target: expect.objectContaining({ to: '/group/$id/blog/$entryId' }),
    });
    expect(mocks.createBlogFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blog: expect.objectContaining({ title: 'Public blog', group_id: 'group-1' }),
        timeline_event: expect.objectContaining({ image_url: 'image', video_url: 'video' }),
      }),
      { notificationMode: 'silent' }
    );
    expect(reportProgress).toHaveBeenCalledWith({ key: 'ready', status: 'active' });
    grouped.unmount();

    mocks.search = {};
    const personal = renderHook(() => useCreateBlogForm());
    act(() => {
      field(personal.result.current, 'title').onValueChange('Private blog');
      field(personal.result.current, 'visibility').props.onChange('private');
    });
    const userOutcome = await act(async () => personal.result.current.onSubmit());
    expect(userOutcome).toMatchObject({
      status: 'success',
      target: expect.objectContaining({ to: '/user/$id/blog/$entryId' }),
    });
    expect(mocks.createBlogFull).toHaveBeenLastCalledWith(
      expect.objectContaining({
        timeline_event: null,
        blog: expect.objectContaining({ image_url: null, video_url: null, group_id: null }),
      }),
      { notificationMode: 'silent' }
    );
  });

  it('blocks missing auth/title and reports client failures while resetting submission', async () => {
    mocks.user = undefined;
    const unauthorized = renderHook(() => useCreateBlogForm());
    await expect(unauthorized.result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    unauthorized.unmount();

    mocks.user = { id: 'user-1' };
    const { result } = renderHook(() => useCreateBlogForm());
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    act(() => field(result.current, 'title').onValueChange('Failure'));
    mocks.createBlogFull.mockReturnValueOnce({
      blogResult: { client: Promise.reject(new Error('client failed')) },
    });
    await expect(result.current.onSubmit()).rejects.toThrow('client failed');
    expect(mocks.toastError).toHaveBeenCalledWith('pages.create.error.createFailed');
    expect(result.current.isSubmitting).toBe(false);
  });
});
