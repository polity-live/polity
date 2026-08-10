/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  state: {} as Record<string, unknown>,
  localPermissions: { canEdit: false, canDelete: false, isBlogger: false },
  groupCan: vi.fn(),
  recoveryDraft: { id: 'recovery-1' },
  navigate: vi.fn(),
  zeroMutate: vi.fn(),
  createThread: vi.fn((input: unknown) => input),
  updateBlog: vi.fn(),
  createSupportVote: vi.fn(),
  updateSupportVote: vi.fn(),
  deleteSupportVote: vi.fn(),
  deleteBlog: vi.fn(),
  addComment: vi.fn(),
  voteComment: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  toggleSubscribe: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
  checkEntityAccess: vi.fn((..._args: unknown[]) => false),
  extractHashtags: vi.fn((rows: unknown[]) => rows),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.zeroMutate }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => mocks.recoveryDraft,
}));
vi.mock('@/zero/blogs/useBlogState', () => ({ useBlogState: () => mocks.state }));
vi.mock('../useBlogPermissions', () => ({ useBlogPermissions: () => mocks.localPermissions }));
vi.mock('../useSubscribeBlog', () => ({
  useSubscribeBlog: () => ({
    isSubscribed: false,
    subscriberCount: 0,
    toggleSubscribe: mocks.toggleSubscribe,
    isLoading: true,
  }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ can: mocks.groupCan }),
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({
    updateBlog: mocks.updateBlog,
    createSupportVote: mocks.createSupportVote,
    updateSupportVote: mocks.updateSupportVote,
    deleteSupportVote: mocks.deleteSupportVote,
    deleteBlog: mocks.deleteBlog,
  }),
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({ addComment: mocks.addComment, voteComment: mocks.voteComment }),
}));
vi.mock('@/zero/mutators', () => ({
  mutators: { documents: { createThread: mocks.createThread } },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.waitForClientApply(value),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: (...args: unknown[]) => mocks.checkEntityAccess(...args),
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtags: (rows: unknown[]) => mocks.extractHashtags(rows),
}));

import { useBlogDetailController } from '../useBlogDetailController';

function blog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blog-1',
    title: 'Policy update',
    visibility: 'private',
    group_id: null,
    upvotes: 0,
    downvotes: 0,
    supporter_count: null,
    comment_count: null,
    content: null,
    bloggers: [],
    support_votes: [],
    blog_hashtags: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.state = { blogWithDetails: blog(), comments: [], blogThread: { id: 'blog-1' } };
  mocks.localPermissions = { canEdit: false, canDelete: false, isBlogger: false };
  mocks.groupCan.mockReturnValue(false);
  for (const action of [
    mocks.updateBlog,
    mocks.createSupportVote,
    mocks.updateSupportVote,
    mocks.deleteSupportVote,
    mocks.deleteBlog,
    mocks.addComment,
    mocks.voteComment,
    mocks.zeroMutate,
  ]) {
    action.mockResolvedValue(undefined);
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useBlogDetailController A10 branch contracts', () => {
  it('maps empty and null comment/reply fields including anonymous votes', () => {
    mocks.state.comments = [
      {
        id: 'comment-null',
        content: null,
        created_at: null,
        upvotes: null,
        downvotes: null,
        user: null,
        votes: [{ id: 'vote-null', vote: null, user: null }],
        replies: [
          {
            id: 'reply-null',
            content: null,
            created_at: null,
            upvotes: null,
            downvotes: null,
            user: null,
            votes: [
              { id: 'reply-vote-null', vote: null, user: null },
              { id: 'reply-vote-user', vote: 1, user: { id: 'voter-1' } },
            ],
          },
          {
            id: 'reply-user',
            content: 'reply',
            user: { id: 'user-2', first_name: null, last_name: null, handle: null, avatar: null },
            votes: undefined,
          },
        ],
      },
      {
        id: 'comment-user',
        content: 'text',
        user: { id: 'user-3', first_name: null, last_name: null, handle: null, avatar: null },
        votes: undefined,
        replies: undefined,
      },
    ];
    const { result } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));

    expect(result.current.comments[0]).toMatchObject({
      text: '',
      createdAt: 0,
      upvotes: 0,
      downvotes: 0,
      creator: undefined,
      votes: [{ id: 'vote-null', vote: 0, user: undefined }],
      replies: [
        {
          text: '',
          createdAt: 0,
          upvotes: 0,
          downvotes: 0,
          creator: undefined,
          votes: [
            { id: 'reply-vote-null', vote: 0, user: undefined },
            { id: 'reply-vote-user', vote: 1, user: { id: 'voter-1' } },
          ],
        },
        { creator: { id: 'user-2', name: undefined, handle: undefined, avatar: undefined } },
      ],
    });
    expect(result.current.comments[1]).toMatchObject({
      creator: { id: 'user-3', name: undefined, handle: undefined, avatar: undefined },
      votes: [],
      replies: [],
    });
  });

  it('returns deterministic unloaded fallbacks and guards votes without a blog or user', async () => {
    mocks.state = { blogWithDetails: undefined, comments: undefined, blogThread: undefined };
    const { result, rerender } = renderHook(() =>
      useBlogDetailController({ blogId: 'missing-blog' })
    );
    expect(result.current).toMatchObject({
      author: undefined,
      bloggers: [],
      canAccess: true,
      commentCount: 0,
      comments: [],
      currentVoteValue: 0,
      downvotes: 0,
      isLoaded: false,
      recoveryDraft: { id: 'recovery-1' },
      supporterCount: 0,
      title: undefined,
      upvotes: 0,
    });
    expect(result.current.editorUrl).toBe('/user/user-1/blog/missing-blog/editor');
    expect(result.current.viewUrl).toBe('/user/user-1/blog/missing-blog');
    await act(async () => result.current.onVote(1));
    expect(mocks.createSupportVote).not.toHaveBeenCalled();

    mocks.user = null;
    rerender();
    await act(async () => result.current.onVote(1));
    expect(mocks.toast.error).toHaveBeenCalledWith(
      'generated.inline.0138_please_log_in_to_vote_59574e84'
    );
    expect(result.current.editorUrl).toBe('/user/undefined/blog/missing-blog/editor');
  });

  it('covers remove, switch and create vote counter directions with zero fallbacks', async () => {
    mocks.state.blogWithDetails = blog({
      support_votes: [{ id: 'downvote', vote: -1, user: { id: 'user-1' } }],
    });
    const { result, rerender } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));
    expect(result.current.currentVoteValue).toBe(-1);

    await act(async () => result.current.onVote(-1));
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({
      id: 'blog-1',
      upvotes: 0,
      downvotes: 0,
    });

    await act(async () => result.current.onVote(1));
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({
      id: 'blog-1',
      upvotes: 1,
      downvotes: 0,
    });

    mocks.state.blogWithDetails = blog({
      support_votes: [{ id: 'upvote', vote: 1, user: { id: 'user-1' } }],
    });
    rerender();
    await act(async () => result.current.onVote(1));
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({
      id: 'blog-1',
      upvotes: 0,
      downvotes: 0,
    });

    await act(async () => result.current.onVote(-1));
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({
      id: 'blog-1',
      upvotes: 0,
      downvotes: 1,
    });

    mocks.state.blogWithDetails = blog({ support_votes: [] });
    rerender();
    await act(async () => result.current.onVote(-1));
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({
      id: 'blog-1',
      upvotes: 0,
      downvotes: 1,
    });
  });

  it('reports vote mutation failures without leaking a rejected action', async () => {
    mocks.createSupportVote.mockRejectedValueOnce(new Error('vote failed'));
    const { result } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));
    await act(async () => result.current.onVote(1));
    expect(console.error).toHaveBeenCalledWith('Error voting:', expect.any(Error));
    expect(mocks.toast.error).toHaveBeenCalledWith('generated.inline.0140_failed_to_vote_68d9f4e2');
  });

  it('guards comments, defaults parent ids and reports add/vote failures', async () => {
    const { result, rerender } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));
    await act(async () => result.current.onAddComment('comment without parent'));
    expect(mocks.addComment).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: null, content: 'comment without parent' })
    );

    mocks.addComment.mockRejectedValueOnce(new Error('comment failed'));
    await act(async () => result.current.onAddComment('failing comment'));
    expect(mocks.toast.error).toHaveBeenCalledWith(
      'generated.inline.0264_failed_to_post_comment_9008b631'
    );

    mocks.voteComment.mockRejectedValueOnce(new Error('comment vote failed'));
    await act(async () => result.current.onCommentVote('comment-1', 1));
    expect(console.error).toHaveBeenCalledWith('Error voting on comment:', expect.any(Error));

    mocks.user = null;
    rerender();
    await act(async () => result.current.onAddComment('blocked'));
    await act(async () => result.current.onCommentVote('comment-1', -1));
    expect(mocks.addComment).toHaveBeenCalledTimes(2);
    expect(mocks.voteComment).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first blogger and user URLs while preserving explicit zero counts', () => {
    mocks.localPermissions = { canEdit: true, canDelete: true, isBlogger: false };
    mocks.state.blogWithDetails = blog({
      bloggers: [
        {
          status: 'member',
          user: {
            id: 'author-2',
            first_name: null,
            last_name: null,
            handle: null,
            avatar: null,
          },
        },
      ],
      comment_count: 0,
      supporter_count: 0,
    });
    const { result, rerender } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));
    expect(result.current).toMatchObject({
      author: {
        id: 'author-2',
        name: 'generated.inline.0031_unknown_bc7819b3',
      },
      canDelete: true,
      canEdit: true,
      commentCount: 0,
      supporterCount: 0,
    });
    expect(result.current.editorUrl).toBe('/user/author-2/blog/blog-1/editor');
    expect(result.current.shareContextItem).toMatchObject({
      authorAvatar: undefined,
      groupId: undefined,
    });

    mocks.state.blogWithDetails = blog({ bloggers: [], blog_hashtags: [] });
    rerender();
    expect(result.current.author).toBeUndefined();
    expect(result.current.editorUrl).toBe('/user/user-1/blog/blog-1/editor');
    expect(mocks.extractHashtags).toHaveBeenCalledWith([]);
  });
});
