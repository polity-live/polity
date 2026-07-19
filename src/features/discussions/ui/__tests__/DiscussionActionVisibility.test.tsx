/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentTreeView } from '../CommentTreeView';
import { ThreadCardView } from '../ThreadCardView';

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: () => null,
}));

vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: ({ name }: { name?: string }) => <span>{name}</span>,
}));

afterEach(() => cleanup());

const sharedActions = {
  onCreateComment: vi.fn(),
  onVoteComment: vi.fn(),
  handleVote: vi.fn(),
  handleReply: vi.fn(),
  setIsReplying: vi.fn(),
  setReplyText: vi.fn(),
  setIsSubmitting: vi.fn(),
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
    expect(screen.queryByRole('button')).toBeNull();
  });
});
