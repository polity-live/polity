/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const action = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    mutate: vi.fn((descriptor: unknown) => ({ descriptor })),
    onServerError: vi.fn(),
    trackCreation: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    blogs: {
      create: action('create'),
      createFull: action('createFull'),
      update: action('update'),
      delete: action('delete'),
      createEntry: action('createEntry'),
      updateEntry: action('updateEntry'),
      deleteEntry: action('deleteEntry'),
      createSupportVote: action('createSupportVote'),
      updateSupportVote: action('updateSupportVote'),
      deleteSupportVote: action('deleteSupportVote'),
    },
    common: {
      subscribe: action('subscribe'),
      unsubscribe: action('unsubscribe'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { blogs: mocks.blogs, common: mocks.common } }));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (result: unknown, callback: (message: string) => void) => {
    mocks.onServerError(result);
    callback('server error');
  },
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useBlogActions } from '../useBlogActions';

describe('useBlogActions action facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('invokes every exposed action and its notification callback', () => {
    const { result } = renderHook(() => useBlogActions());
    const options = { notificationMode: 'silent' as const };

    result.current.createBlog({ id: 'blog' } as never, options);
    result.current.updateBlog({ id: 'blog' } as never);
    result.current.deleteBlog('blog');
    result.current.createEntry({ id: 'entry' } as never, options);
    result.current.updateEntry({ id: 'entry' } as never);
    result.current.deleteEntry('entry');
    result.current.createSupportVote({ id: 'support' } as never);
    result.current.updateSupportVote({ id: 'support' } as never);
    result.current.deleteSupportVote('support');
    result.current.updateBlogSilent({ id: 'silent' } as never);
    const full = result.current.createBlogFull({ blog: { id: 'full' } } as never, options);
    result.current.subscribeToBlog({ id: 'subscription' } as never);
    result.current.unsubscribeFromBlog('subscription');

    expect(mocks.mutate).toHaveBeenCalledTimes(13);
    expect(full).toEqual({ blogResult: expect.anything() });
    expect(mocks.trackCreation).toHaveBeenCalledWith(expect.anything(), 'blog', options, 'blog');
    expect(mocks.trackCreation).toHaveBeenCalledWith(
      expect.anything(),
      'blogEntry',
      options,
      'entry'
    );
    expect(mocks.trackCreation).toHaveBeenCalledWith(expect.anything(), 'blog', options, 'full');
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(4);
    expect(mocks.toastError).toHaveBeenCalledTimes(7);
    expect(console.error).toHaveBeenCalledTimes(3);
  });
});
