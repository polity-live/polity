/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBlogDetailController } from '../useBlogDetailController';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  state: {} as any,
  localPermissions: { canEdit: false, canDelete: false, isBlogger: true },
  groupCan: vi.fn(),
  recoveryDraft: { id: 'recovery-1' } as any,
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
  subscribe: {
    isSubscribed: true,
    subscriberCount: 7,
    toggleSubscribe: vi.fn(),
    isLoading: false,
  },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.zeroMutate }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => mocks.recoveryDraft,
}));
vi.mock('@/zero/blogs/useBlogState', () => ({ useBlogState: () => mocks.state }));
vi.mock('../useBlogPermissions', () => ({ useBlogPermissions: () => mocks.localPermissions }));
vi.mock('../useSubscribeBlog', () => ({ useSubscribeBlog: () => mocks.subscribe }));
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
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

function blog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blog-1',
    title: 'Policy update',
    visibility: 'public',
    group_id: 'group-1',
    upvotes: 4,
    downvotes: 1,
    supporter_count: null,
    comment_count: null,
    content: [{ type: 'p', children: [{ text: 'Article' }] }],
    bloggers: [
      {
        status: 'owner',
        user: {
          id: 'author-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          handle: 'ada',
          avatar: 'ada.png',
        },
      },
    ],
    support_votes: [],
    blog_hashtags: [{ hashtag: { id: 'tag-1', tag: 'policy' } }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.localPermissions = { canEdit: false, canDelete: false, isBlogger: true };
  mocks.groupCan.mockReturnValue(true);
  mocks.recoveryDraft = { id: 'recovery-1' };
  mocks.state = { blogWithDetails: blog(), comments: [], blogThread: { id: 'blog-1' } };
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

describe('useBlogDetailController', () => {
  it('maps authors, nested comments, votes, permissions, URLs, tags, and subscription state', () => {
    mocks.state.comments = [
      {
        id: 'comment-1',
        content: 'Comment',
        created_at: 10,
        upvotes: 2,
        downvotes: 1,
        user: { id: 'commenter-1', first_name: 'Grace', last_name: 'Hopper', handle: 'grace' },
        votes: [{ id: 'vote-1', vote: 1, user: { id: 'user-1' } }],
        replies: [
          {
            id: 'reply-1',
            content: 'Reply',
            created_at: 11,
            user: { id: 'author-1', handle: 'ada' },
            votes: [],
          },
        ],
      },
    ];
    const { result } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));

    expect(result.current).toMatchObject({
      author: { id: 'author-1', name: 'Ada Lovelace', handle: 'ada' },
      canEdit: true,
      canDelete: true,
      commentCount: 1,
      currentVoteValue: 0,
      editorUrl: '/group/group-1/blog/blog-1/editor',
      viewUrl: '/group/group-1/blog/blog-1',
      isLoaded: true,
      isSubscribed: true,
      subscriberCount: 7,
      supporterCount: 3,
    });
    expect(result.current.comments[0]).toMatchObject({
      id: 'comment-1',
      creator: { id: 'commenter-1', name: 'Grace Hopper' },
      replies: [{ id: 'reply-1', creator: { id: 'author-1', handle: 'ada' } }],
    });
    expect(result.current.hashtags).toEqual([{ id: 'tag-1', tag: 'policy' }]);
    expect(result.current.shareContextItem).toMatchObject({
      id: 'blog-1',
      type: 'blog',
      authorId: 'author-1',
      groupId: 'group-1',
    });
  });

  it('creates, removes, or switches support votes and recalculates counters', async () => {
    const { result, rerender } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));
    await act(async () => result.current.onVote(1));
    expect(mocks.createSupportVote).toHaveBeenCalledWith(
      expect.objectContaining({ vote: 1, blog_id: 'blog-1' })
    );
    expect(mocks.updateBlog).toHaveBeenCalledWith({ id: 'blog-1', upvotes: 5, downvotes: 1 });

    mocks.state = {
      ...mocks.state,
      blogWithDetails: blog({
        support_votes: [{ id: 'support-1', vote: 1, user: { id: 'user-1' } }],
      }),
    };
    rerender();
    await act(async () => result.current.onVote(1));
    expect(mocks.deleteSupportVote).toHaveBeenCalledWith('support-1');
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({ id: 'blog-1', upvotes: 3, downvotes: 1 });

    await act(async () => result.current.onVote(-1));
    expect(mocks.updateSupportVote).toHaveBeenCalledWith({ id: 'support-1', vote: -1 });
    expect(mocks.updateBlog).toHaveBeenLastCalledWith({ id: 'blog-1', upvotes: 3, downvotes: 2 });

    mocks.user = null;
    rerender();
    await act(async () => result.current.onVote(1));
    expect(mocks.toast.error).toHaveBeenLastCalledWith(
      'generated.inline.0138_please_log_in_to_vote_59574e84'
    );
  });

  it('creates missing threads before comments and preserves parent and comment-vote identity', async () => {
    mocks.state.blogThread = null;
    const { result } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));

    await act(async () => result.current.onAddComment(' New comment ', 'parent-1'));
    expect(mocks.createThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'blog-1', blog_id: 'blog-1', user_id: 'user-1' })
    );
    expect(mocks.zeroMutate).toHaveBeenCalled();
    expect(mocks.addComment).toHaveBeenCalledWith(
      expect.objectContaining({
        thread_id: 'blog-1',
        parent_id: 'parent-1',
        content: ' New comment ',
        user_id: 'user-1',
      })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith(
      'generated.inline.0263_comment_posted_successfully_eb634c77'
    );

    await act(async () => result.current.onCommentVote('comment-1', -1));
    expect(mocks.voteComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 'comment-1', user_id: 'user-1', vote: -1 })
    );
    await act(async () => result.current.onAddComment('   '));
    expect(mocks.addComment).toHaveBeenCalledTimes(1);
  });

  it('deletes to group or root destinations and keeps the dialog controllable on failure', async () => {
    const { result, rerender } = renderHook(() => useBlogDetailController({ blogId: 'blog-1' }));
    act(() => result.current.onDeleteOpenChange(true));
    expect(result.current.deleteOpen).toBe(true);
    await act(async () => result.current.onConfirmDelete());
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/group/$id/blogs-and-statements',
      params: { id: 'group-1' },
    });

    mocks.state = { ...mocks.state, blogWithDetails: blog({ group_id: null }) };
    rerender();
    await act(async () => result.current.onConfirmDelete());
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/' });

    mocks.deleteBlog.mockRejectedValueOnce(new Error('delete failed'));
    await act(async () => result.current.onConfirmDelete());
    expect(mocks.toast.error).toHaveBeenLastCalledWith('features.blogs.detail.blogDeleteFailed');
  });
});
