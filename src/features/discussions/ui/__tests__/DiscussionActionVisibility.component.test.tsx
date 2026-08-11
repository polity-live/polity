/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentTreeView } from '../CommentTreeView';
import { ThreadCardView } from '../ThreadCardView';

const virtualListCapture = vi.hoisted(() => ({
  contexts: [] as unknown[],
  latestProps: null as Record<string, unknown> | null,
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: Record<string, unknown>) => {
    virtualListCapture.contexts.push(props.context);
    virtualListCapture.latestProps = props;
    return null;
  },
}));

vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: ({
    'data-action-id': actionId,
    userId,
    name,
    className,
    textContainerClassName,
  }: {
    'data-action-id'?: string;
    userId?: string;
    name?: string;
    className?: string;
    textContainerClassName?: string;
  }) => (
    <span
      data-testid="user-identity"
      data-action-id={actionId}
      data-user-id={userId}
      className={className}
    >
      <span className={textContainerClassName}>{name}</span>
    </span>
  ),
}));

afterEach(() => {
  cleanup();
  virtualListCapture.contexts = [];
  virtualListCapture.latestProps = null;
});

const sharedActions = {
  onCreateComment: vi.fn(),
  onVoteComment: vi.fn(),
  handleVote: vi.fn(),
  handleReply: vi.fn(),
  setIsReplying: vi.fn(),
  setReplyText: vi.fn(),
  setIsSubmitting: vi.fn(),
  isCollapsed: false,
  onToggleCollapsed: vi.fn(),
};

describe('discussion action visibility', () => {
  it('shows thread content but no vote or comment buttons to a guest', () => {
    render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'Public discussion',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Ada' },
        }}
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    expect(screen.getByText('Public discussion')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows comment content but no vote or reply buttons to a guest', () => {
    render(
      <CommentTreeView
        comment={{
          id: 'comment-1',
          content: 'Public comment',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Grace' },
        }}
        threadId="thread-1"
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        isReplying={false}
        replyText=""
        isSubmitting={false}
        score={2}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        {...sharedActions}
      />
    );

    expect(screen.getByText('Public comment')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByTitle('Upvote')).toBeNull();
    expect(screen.queryByText('Reply')).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();
  });
});

describe('discussion mobile layout', () => {
  it('separates a stored thread title and description on an app surface', () => {
    render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'Structured title\n\nReadable description',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Ada' },
        }}
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    const rootPost = screen.getByRole('article');

    expect(screen.getByRole('heading', { name: 'Structured title' })).toBeTruthy();
    expect(screen.getByText('Readable description')).toBeTruthy();
    expect(rootPost.className).toContain('bg-[var(--surface)]');
    expect(rootPost.className).toContain('rounded-lg');
    expect(rootPost.className.split(/\s+/)).not.toContain('border');
    expect(rootPost.querySelector('[data-slot="discussion-vote-group"]')).toBeNull();
  });

  it('keeps long thread content shrinkable and places secondary metadata below the author', () => {
    render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'AnUnusuallyLongThreadTitleWithoutNaturalBreakPoints',
          created_at: 1,
          user: {
            id: 'author-1',
            first_name: 'Alexandria',
            last_name: 'Montgomery-Wellington',
          },
        }}
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    const title = screen.getByRole('heading', {
      name: 'AnUnusuallyLongThreadTitleWithoutNaturalBreakPoints',
    });
    const content = title.parentElement;
    const identity = screen.getByTestId('user-identity');
    const metadata = identity.parentElement;
    const date = identity.nextElementSibling?.nextElementSibling;

    expect(title.className).toContain('break-words');
    expect(title.className).toContain('[overflow-wrap:anywhere]');
    expect(content?.className).toContain('min-w-0');
    expect(metadata?.className).toContain('flex-wrap');
    expect(identity.className).toContain('max-w-full');
    expect(date?.className).toContain('whitespace-nowrap');
  });

  it('places comment dates below the author on mobile and hides the desktop separator', () => {
    render(
      <CommentTreeView
        comment={{
          id: 'comment-1',
          content: 'ACommentWithAnUnusuallyLongUnbrokenValue',
          created_at: 1,
          user: {
            id: 'author-1',
            first_name: 'Alexandria',
            last_name: 'Montgomery-Wellington',
          },
        }}
        threadId="thread-1"
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        isReplying={false}
        replyText=""
        isSubmitting={false}
        score={2}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        {...sharedActions}
      />
    );

    const comment = screen.getByText('ACommentWithAnUnusuallyLongUnbrokenValue');
    const content = comment.parentElement;
    const identity = screen.getByTestId('user-identity');
    const metadata = identity.parentElement;
    const separator = identity.nextElementSibling;
    const date = separator?.nextElementSibling;

    expect(content?.className).toContain('min-w-0');
    expect(comment.className).toContain('[overflow-wrap:anywhere]');
    expect(metadata?.className).toContain('flex-wrap');
    expect(date?.className).toContain('whitespace-nowrap');
    expect(separator?.className).toContain('hidden');
    expect(separator?.className).toContain('sm:inline');
  });
});

describe('discussion comment form and list updates', () => {
  it('dispatches comment reply actions through stable intents', () => {
    const actions = {
      ...sharedActions,
      setIsReplying: vi.fn(),
      handleReply: vi.fn(),
    };
    const props = {
      comment: {
        id: 'comment-1',
        content: 'Public comment',
        created_at: 1,
        user: { id: 'author-1', first_name: 'Grace' },
      },
      threadId: 'thread-1',
      userId: 'user-1',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment',
      senderName: undefined,
      replyText: 'A reply',
      isSubmitting: false,
      score: 2,
      userVote: undefined,
      hasUpvoted: false,
      hasDownvoted: false,
      ...actions,
    };
    const view = render(<CommentTreeView {...props} isReplying={false} />);

    expect(screen.getByTestId('user-identity').dataset.actionId).toBe(
      'discussions.comment.author.open'
    );
    const toggle = screen.getByRole('button', { name: 'Reply' });
    expect(toggle.dataset.actionId).toBe('discussions.comment.reply.toggle');
    fireEvent.click(toggle);
    expect(actions.setIsReplying).toHaveBeenCalledWith(true);

    view.rerender(<CommentTreeView {...props} isReplying />);
    const submit = screen.getByRole('button', { name: 'Post Reply' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(submit.dataset.actionId).toBe('discussions.comment.reply.submit');
    expect(cancel.dataset.actionId).toBe('discussions.comment.reply.cancel');
    fireEvent.click(submit);
    fireEvent.click(cancel);
    expect(actions.handleReply).toHaveBeenCalledOnce();
    expect(actions.setIsReplying).toHaveBeenLastCalledWith(false);
  });

  it('dispatches thread comment actions through stable intents', () => {
    const setIsCommenting = vi.fn();
    const handleAddComment = vi.fn();
    const props = {
      thread: {
        id: 'thread-1',
        content: 'Public discussion',
        created_at: 1,
        user: { id: 'author-1', first_name: 'Ada' },
      },
      userId: 'user-1',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment',
      senderName: undefined,
      onCreateComment: vi.fn(),
      onVoteThread: vi.fn(),
      onVoteComment: vi.fn(),
      setIsCommenting,
      commentText: 'A comment',
      setCommentText: vi.fn(),
      isSubmitting: false,
      setIsSubmitting: vi.fn(),
      score: 3,
      userVote: undefined,
      hasUpvoted: false,
      hasDownvoted: false,
      sortedComments: [],
      handleVote: vi.fn(),
      handleAddComment,
    };
    const view = render(<ThreadCardView {...props} isCommenting={false} />);

    expect(screen.getByTestId('user-identity').dataset.actionId).toBe(
      'discussions.thread.author.open'
    );
    const open = screen.getByRole('button', { name: 'Add Comment' });
    expect(open.dataset.actionId).toBe('discussions.thread.comment.open');
    fireEvent.click(open);
    expect(setIsCommenting).toHaveBeenCalledWith(true);

    view.rerender(<ThreadCardView {...props} isCommenting />);
    const submit = screen.getByRole('button', { name: 'Post Comment' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(submit.dataset.actionId).toBe('discussions.thread.comment.submit');
    expect(cancel.dataset.actionId).toBe('discussions.thread.comment.cancel');
    fireEvent.click(submit);
    fireEvent.click(cancel);
    expect(handleAddComment).toHaveBeenCalledOnce();
    expect(setIsCommenting).toHaveBeenLastCalledWith(false);
  });

  it('renders the root comment form without an outer card container', () => {
    const { container } = render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'Public discussion',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Ada' },
        }}
        userId="user-1"
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting
        setIsCommenting={vi.fn()}
        commentText="Draft comment"
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    const textarea = container.querySelector('[data-slot="form-control-textarea"]');
    const form = textarea?.parentElement;

    expect(form?.className).toContain('space-y-2');
    expect(form?.className).not.toContain('rounded-lg');
    expect(form?.className).not.toContain('border');
    expect(form?.className).not.toContain('p-4');
  });

  it('passes the created root comment ID to the virtualized comment list', () => {
    render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'Public discussion',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Ada' },
        }}
        userId="user-1"
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        createdCommentId="comment-new"
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    expect(virtualListCapture.latestProps?.permalinkID).toBe('comment-new');
  });

  it('updates the thread badge from the live root-comment total', () => {
    render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'Public discussion',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Ada' },
        }}
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    const onTotalChange = virtualListCapture.latestProps?.onTotalChange as
      ((total: number) => void) | undefined;
    act(() => onTotalChange?.(10));

    expect(screen.getByText((_content, node) => node?.textContent === '10 comments')).toBeTruthy();
  });

  it('renders anonymous legacy authors and the singular live comment total', () => {
    render(
      <ThreadCardView
        thread={{ id: 'thread-1', content: null, created_at: 1, user_id: 'legacy-author' }}
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={0}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    expect(screen.getByTestId('user-identity').dataset.userId).toBe('legacy-author');
    expect(screen.getByTestId('user-identity').textContent).toContain('Anonymous');

    const onTotalChange = virtualListCapture.latestProps?.onTotalChange as
      ((total: number) => void) | undefined;
    act(() => onTotalChange?.(1));
    expect(screen.getByText((_content, node) => node?.textContent === '1 comment')).toBeTruthy();
  });

  it('uses legacy comment authors and selects settled list cache policies', () => {
    render(
      <CommentTreeView
        comment={{ id: 'comment-1', content: 'Legacy comment', created_at: 1, user_id: 'legacy' }}
        threadId="thread-1"
        userId={undefined}
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        isReplying={false}
        replyText=""
        isSubmitting={false}
        score={0}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        {...sharedActions}
      />
    );

    expect(screen.getByTestId('user-identity').dataset.userId).toBe('legacy');
    expect(screen.getByTestId('user-identity').textContent).toContain('Anonymous');

    const getPageQuery = virtualListCapture.latestProps?.getPageQuery as (input: {
      limit: number;
      start: unknown;
      dir: 'forward';
      settled: boolean;
    }) => { options: { ttl: string } };
    const getSingleQuery = virtualListCapture.latestProps?.getSingleQuery as (input: {
      id: string;
      settled: boolean;
    }) => { options: { ttl: string } };

    expect(
      getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true }).options.ttl
    ).toBe('5m');
    expect(
      getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false }).options.ttl
    ).toBe('none');
    expect(getSingleQuery({ id: 'comment-1', settled: true }).options.ttl).toBe('5m');
    expect(getSingleQuery({ id: 'comment-1', settled: false }).options.ttl).toBe('none');
  });

  it('renders voting and add-comment actions in Reddit order', () => {
    const { container } = render(
      <ThreadCardView
        thread={{
          id: 'thread-1',
          content: 'Public discussion',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Ada' },
        }}
        userId="user-1"
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        onCreateComment={vi.fn()}
        onVoteThread={vi.fn()}
        onVoteComment={vi.fn()}
        isCommenting={false}
        setIsCommenting={vi.fn()}
        commentText=""
        setCommentText={vi.fn()}
        isSubmitting={false}
        setIsSubmitting={vi.fn()}
        score={3}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        sortedComments={[]}
        handleVote={vi.fn()}
        handleAddComment={vi.fn()}
      />
    );

    const actionBar = container.querySelector('[data-slot="discussion-action-bar"]');
    const voteGroup = actionBar?.querySelector(
      '[data-slot="vote-buttons"][data-presentation="surface"]'
    );
    const labels = [...(actionBar?.querySelectorAll('button, [data-slot="vote-score"]') ?? [])]
      .map(element => element.getAttribute('aria-label') || element.textContent?.trim())
      .filter(Boolean);

    expect(labels).toEqual(['Upvote', '3', 'Downvote', 'Add Comment']);
    expect(voteGroup?.className).toContain('bg-[var(--surface-muted)]');
  });

  it('renders a collapsed comment as metadata only and omits its reply list', () => {
    render(
      <CommentTreeView
        comment={{
          id: 'comment-1',
          content: 'Hidden comment body',
          created_at: 1,
          user: { id: 'author-1', first_name: 'Grace' },
        }}
        threadId="thread-1"
        userId="user-1"
        amendmentId="amendment-1"
        amendmentTitle="Amendment"
        senderName={undefined}
        isReplying={false}
        replyText=""
        isSubmitting={false}
        score={2}
        userVote={undefined}
        hasUpvoted={false}
        hasDownvoted={false}
        {...sharedActions}
        isCollapsed
      />
    );

    expect(screen.queryByText('Hidden comment body')).toBeNull();
    expect(screen.queryByText('Reply')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    expect(virtualListCapture.latestProps).toBeNull();
  });

  it('keeps the list context stable across parent rerenders and forwards a created reply ID', () => {
    const props = {
      comment: {
        id: 'comment-1',
        content: 'Public comment',
        created_at: 1,
        user: { id: 'author-1', first_name: 'Grace' },
      },
      threadId: 'thread-1',
      userId: 'user-1',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment',
      senderName: undefined,
      isReplying: false,
      replyText: '',
      isSubmitting: false,
      createdReplyId: 'reply-new',
      score: 2,
      userVote: undefined,
      hasUpvoted: false,
      hasDownvoted: false,
      ...sharedActions,
    };
    const { rerender } = render(<CommentTreeView {...props} />);
    const initialContext = virtualListCapture.contexts.at(-1);

    rerender(<CommentTreeView {...props} isReplying />);

    expect(virtualListCapture.contexts.at(-1)).toBe(initialContext);
    expect(virtualListCapture.latestProps?.permalinkID).toBe('reply-new');
  });
});
