/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentItemView } from '../CommentItemView';

const mocks = vi.hoisted(() => ({ identityProps: [] as any[] }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: (props: any) => {
    mocks.identityProps.push(props);
    return <span data-testid="identity">{props.name}</span>;
  },
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span data-testid="avatar">{children}</span>,
  AvatarImage: ({ src }: any) => <span data-testid="avatar-image">{src}</span>,
  AvatarFallback: ({ children }: any) => <span data-testid="avatar-fallback">{children}</span>,
}));

vi.mock('../DiscussionActions', () => ({
  DiscussionCollapseToggle: ({ collapsed, onToggle }: any) => (
    <button onClick={onToggle}>collapse:{String(collapsed)}</button>
  ),
  DiscussionActionBar: ({ children, onUpvote, onDownvote }: any) => (
    <div>
      <button onClick={onUpvote}>upvote</button>
      <button onClick={onDownvote}>downvote</button>
      {children}
    </div>
  ),
}));

vi.mock('../CommentInput', () => ({
  CommentInput: ({ onSubmit, onCancelReply, replyTo }: any) => (
    <div>
      <span>reply-to:{replyTo}</span>
      <button onClick={() => onSubmit('Reply text')}>submit-reply</button>
      <button onClick={onCancelReply}>cancel-reply</button>
    </div>
  ),
}));

vi.mock('../DiscussionTimestamp', () => ({
  DiscussionTimestamp: ({ value }: any) => <time>{String(value)}</time>,
}));

afterEach(() => {
  cleanup();
  mocks.identityProps.length = 0;
});

const baseComment = {
  id: 'comment-1',
  text: 'Comment text',
  createdAt: 123,
  creator: { id: 'user-1', name: 'Ada', avatar: '/ada.png', handle: 'ada' },
  replies: [] as any[],
};

function renderComment(overrides: Record<string, unknown> = {}) {
  const props = {
    comment: baseComment,
    onVote: vi.fn().mockResolvedValue(undefined),
    onReply: vi.fn().mockResolvedValue(undefined),
    onReplySubmit: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    depth: 0,
    showReplyInput: false,
    hasUpvoted: false,
    hasDownvoted: false,
    score: 0,
    isOwner: false,
    isCollapsed: false,
    onToggleReplyInput: vi.fn(),
    onCancelReply: vi.fn(),
    onToggleCollapsed: vi.fn(),
    linkAuthors: false,
    renderReply: vi.fn((reply: any, depth: number) => (
      <span key={reply.id}>
        reply:{reply.id}:{depth}
      </span>
    )),
    ...overrides,
  } as any;
  return { ...render(<CommentItemView {...props} />), props };
}

describe('CommentItemView', () => {
  it('renders a linked author and all expanded owner actions', () => {
    const reply = { id: 'reply-1', text: 'Nested' };
    const { props } = renderComment({
      comment: { ...baseComment, replies: [reply] },
      depth: 1,
      linkAuthors: true,
      isOwner: true,
      showReplyInput: true,
    });

    expect(mocks.identityProps.at(-1)).toMatchObject({
      userId: 'user-1',
      avatarUrl: '/ada.png',
      name: 'Ada',
      handle: 'ada',
    });
    expect(screen.getByText('Comment text')).toBeTruthy();
    expect(screen.getByText('reply:reply-1:2')).toBeTruthy();
    expect(screen.getByText('reply-to:Ada')).toBeTruthy();
    fireEvent.click(screen.getByText('upvote'));
    fireEvent.click(screen.getByText('downvote'));
    fireEvent.click(screen.getByText('translated:generated.inline.0377_reply_6c2bb735'));
    fireEvent.click(screen.getByText('translated:generated.inline.0537_delete_f6fdbe48'));
    fireEvent.click(screen.getByText('submit-reply'));
    fireEvent.click(screen.getByText('cancel-reply'));
    fireEvent.click(screen.getByText('collapse:false'));

    expect(props.onVote.mock.calls).toEqual([[1], [-1]]);
    expect(props.onToggleReplyInput).toHaveBeenCalledOnce();
    expect(props.onDelete).toHaveBeenCalledWith('comment-1');
    expect(props.onReplySubmit).toHaveBeenCalledWith('Reply text');
    expect(props.onCancelReply).toHaveBeenCalledOnce();
    expect(props.onToggleCollapsed).toHaveBeenCalledOnce();
  });

  it('renders an unlinked author using image fallback and hides optional actions', () => {
    renderComment({
      comment: {
        ...baseComment,
        creator: {
          name: 'Grace',
          avatar: '/grace.png',
          imageURL: '/ignored.png',
          handle: 'grace',
        },
        replies: [],
      },
    });

    expect(screen.getByTestId('avatar-image').textContent).toBe('/grace.png');
    expect(screen.getByTestId('avatar-fallback').textContent).toBe('G');
    expect(screen.getByText('Grace')).toBeTruthy();
    expect(screen.queryByText('translated:generated.inline.0537_delete_f6fdbe48')).toBeNull();
  });

  it('uses anonymous fallbacks and suppresses expanded content while collapsed', () => {
    const anonymous = renderComment({
      comment: { ...baseComment, creator: undefined, replies: undefined },
      isCollapsed: true,
    });

    expect(screen.getByTestId('avatar-image').textContent).toBe('');
    expect(screen.getByTestId('avatar-fallback').textContent).toBe('U');
    expect(screen.getByText('translated:generated.inline.0056_anonymous_9bed5104')).toBeTruthy();
    expect(screen.queryByText('Comment text')).toBeNull();
    anonymous.unmount();

    const unnamed = renderComment({ comment: { ...baseComment, creator: {}, replies: [] } });
    expect(screen.getByTestId('avatar-fallback').textContent).toBe('U');
    unnamed.unmount();

    renderComment({ comment: { ...baseComment, creator: { name: '' }, replies: [] } });
    expect(screen.getByTestId('avatar-fallback').textContent).toBe('U');
  });

  it('uses the reply fallback when an owner has no creator or delete callback', () => {
    renderComment({
      comment: { ...baseComment, creator: { imageURL: '/fallback.png' }, replies: [] },
      isOwner: true,
      onDelete: undefined,
      showReplyInput: true,
      linkAuthors: true,
    });

    expect(screen.getByText('reply-to:this comment')).toBeTruthy();
    expect(screen.queryByText('translated:generated.inline.0537_delete_f6fdbe48')).toBeNull();
  });
});
