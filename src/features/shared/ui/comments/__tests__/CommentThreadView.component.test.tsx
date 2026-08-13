/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentThreadView } from '../CommentThreadView';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('../CommentSortSelect', () => ({
  CommentSortSelect: ({ onSortChange }: { onSortChange: (value: string) => void }) => (
    <button onClick={() => onSortChange('newest')}>Sort</button>
  ),
}));
vi.mock('../CommentInput', () => ({
  CommentInput: ({
    onSubmit,
    onCancelReply,
  }: {
    onSubmit: (text: string) => void;
    onCancelReply: () => void;
  }) => (
    <>
      <button onClick={() => onSubmit('text')}>Submit comment</button>
      <button onClick={onCancelReply}>Cancel comment</button>
    </>
  ),
}));
vi.mock('../CommentItem', () => ({
  CommentItem: ({ comment }: { comment: { id: string } }) => <div>Comment:{comment.id}</div>,
}));

afterEach(cleanup);

const baseProps = {
  comments: [],
  threadedComments: [],
  onVote: vi.fn(async () => undefined),
  onReply: vi.fn(async () => undefined),
  sortBy: 'time' as const,
  onSortChange: vi.fn(),
  isCommenting: false,
  setIsCommenting: vi.fn(),
  onAddRootComment: vi.fn(async () => undefined),
};

describe('CommentThreadView', () => {
  it('renders the default and custom empty states', () => {
    const first = render(<CommentThreadView {...baseProps} />);
    expect(screen.getByText(/0395_no_comments/)).toBeTruthy();
    first.unmount();
    render(<CommentThreadView {...baseProps} emptyState="Nothing here" hideHeader />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('opens, submits, cancels, sorts, and renders comments for a signed-in user', () => {
    const setIsCommenting = vi.fn();
    const onSortChange = vi.fn();
    const first = render(
      <CommentThreadView
        {...baseProps}
        currentUserId="user-1"
        setIsCommenting={setIsCommenting}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByText(/0396_add_comment/));
    fireEvent.click(screen.getByText('Sort'));
    expect(setIsCommenting).toHaveBeenCalledWith(true);
    expect(onSortChange).toHaveBeenCalledWith('newest');
    first.unmount();

    render(
      <CommentThreadView
        {...baseProps}
        currentUserId="user-1"
        isCommenting
        setIsCommenting={setIsCommenting}
        threadedComments={[{ id: 'comment-1' } as never]}
      />
    );
    fireEvent.click(screen.getByText('Submit comment'));
    fireEvent.click(screen.getByText('Cancel comment'));
    expect(baseProps.onAddRootComment).toHaveBeenCalledWith('text');
    expect(setIsCommenting).toHaveBeenCalledWith(false);
    expect(screen.getByText('Comment:comment-1')).toBeTruthy();
  });
});
