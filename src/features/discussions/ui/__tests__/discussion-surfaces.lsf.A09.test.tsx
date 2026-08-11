/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(cleanup);

const mocks = vi.hoisted(() => ({
  commentViewProps: undefined as any,
  threadViewProps: undefined as any,
  createViewProps: undefined as any,
  pageViewProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlTextarea: (props: any) => <textarea {...props} />,
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  FileUploadTrigger: ({ children, onFilesSelected }: any) => (
    <button
      data-testid="file-trigger"
      onClick={() => onFilesSelected?.([new File(['x'], 'x.txt')])}
    >
      {children}
    </button>
  ),
  FormControlSelect: ({ children, onValueChange }: any) => (
    <button data-testid="sort" onClick={() => onValueChange('time')}>
      {children}
    </button>
  ),
  FormControlSelectContent: ({ children }: any) => <div>{children}</div>,
  FormControlSelectItem: ({ children }: any) => <div>{children}</div>,
  FormControlSelectTrigger: ({ children }: any) => <div>{children}</div>,
  FormControlSelectValue: () => <span />,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/UserIdentityLink', () => ({ UserIdentityLink: () => <span /> }));
vi.mock('@/features/shared/ui/comments', () => ({
  DiscussionCollapseToggle: ({ onToggle }: any) => (
    <button data-testid="collapse" onClick={onToggle} />
  ),
  DiscussionTimestamp: () => <span />,
  DiscussionActionBar: ({ children, onUpvote, onDownvote }: any) => (
    <div>
      <button data-testid="upvote" onClick={onUpvote} />
      <button data-testid="downvote" onClick={onDownvote} />
      {children}
    </div>
  ),
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: any) => {
    const row = { id: 'comment', created_at: 1, content: 'Reply', user_id: 'user' };
    props.getRowKey(row);
    props.toStartRow(row);
    props.getPageQuery({ limit: 10, start: undefined, dir: 'forward', settled: true });
    props.getSingleQuery({ id: 'comment', settled: false });
    props.onTotalChange?.(1);
    return (
      <div>
        {props.renderRow(row)}
        {props.renderSkeleton()}
        {props.renderEmpty()}
      </div>
    );
  },
  usePolityZeroWindowList: (options: any) => {
    options.getScrollElement();
    options.estimateSize();
    options.getRowKey({ id: 'thread' });
    return { rowsEmpty: true, items: [], spaceBefore: 0, spaceAfter: 0 };
  },
  ZeroVirtualSpacer: () => <div />,
  rowAttributes: () => ({}),
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <div /> }));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div />,
  SectionSkeleton: () => <div />,
}));
vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      discussionCommentPage: vi.fn(),
      discussionCommentById: vi.fn(),
      discussionThreadPage: vi.fn(),
      discussionThreadById: vi.fn(),
    },
  },
}));
vi.mock('../useCommentTreeController', () => ({
  useCommentTreeController: (props: any) => ({
    ...props,
    isReplying: false,
    setIsReplying: vi.fn(),
    replyText: '',
    setReplyText: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
    isCollapsed: true,
    onToggleCollapsed: vi.fn(),
    score: 0,
    hasUpvoted: false,
    hasDownvoted: false,
    handleVote: vi.fn(),
    handleReply: vi.fn(),
  }),
}));
vi.mock('../useThreadCardController', () => ({
  useThreadCardController: (props: any) => ({
    ...props,
    isCommenting: false,
    setIsCommenting: vi.fn(),
    commentText: '',
    setCommentText: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
    score: 0,
    hasUpvoted: false,
    hasDownvoted: false,
    sortedComments: [],
    handleVote: vi.fn(),
    handleAddComment: vi.fn(),
  }),
}));
vi.mock('../../hooks/useCreateThreadDialogController', () => ({
  useCreateThreadDialogController: () => ({
    description: '',
    isSubmitting: false,
    isUploading: false,
    selectedFile: null,
    title: '',
    onDescriptionChange: vi.fn(),
    onFileChange: vi.fn(),
    onRemoveFile: vi.fn(),
    onSubmit: vi.fn(),
    onTitleChange: vi.fn(),
  }),
}));
vi.mock('../DiscussionsPageContainerView', () => ({
  DiscussionsPageContainerView: (props: any) => {
    mocks.pageViewProps = props;
    return <div />;
  },
}));
vi.mock('../useDiscussionsPageContainerController', () => ({
  useDiscussionsPageContainerController: (props: any) => props,
}));

import { CommentTree } from '../CommentTree';
import { CommentTreeView } from '../CommentTreeView';
import { CreateThreadDialog } from '../CreateThreadDialog';
import { CreateThreadDialogView } from '../CreateThreadDialogView';
import { DiscussionsPageContainer } from '../DiscussionsPageContainer';
import { DiscussionsView } from '../DiscussionsView';
import { ThreadCard } from '../ThreadCard';
import { ThreadCardView } from '../ThreadCardView';

const callbacks = {
  onCreateComment: vi.fn(async () => 'comment'),
  onVoteComment: vi.fn(async () => undefined),
  onVoteThread: vi.fn(async () => undefined),
};

it('renders controller wrappers for comments, threads, dialog, and page', () => {
  render(<CommentTree comment={{ id: 'comment' } as never} threadId="thread" {...callbacks} />);
  render(<ThreadCard thread={{ id: 'thread' } as never} {...callbacks} />);
  render(
    <CreateThreadDialog
      amendmentId="amendment"
      open
      onOpenChange={vi.fn()}
      onCreateThread={vi.fn()}
    />
  );
  render(<DiscussionsPageContainer amendmentId="amendment" userId="user" />);
  expect(mocks.pageViewProps).toEqual({ amendmentId: 'amendment', userId: 'user' });
});

it('executes every comment interaction and virtual-list callback', () => {
  const setIsReplying = vi.fn();
  const setReplyText = vi.fn();
  const handleVote = vi.fn();
  const view = render(
    <CommentTreeView
      comment={{ id: 'comment', content: 'Body', created_at: 1, user_id: 'user' }}
      threadId="thread"
      userId="user"
      amendmentId="amendment"
      amendmentTitle="Title"
      senderName="Sender"
      {...callbacks}
      isReplying
      setIsReplying={setIsReplying}
      replyText="Reply"
      setReplyText={setReplyText}
      isSubmitting={false}
      setIsSubmitting={vi.fn()}
      isCollapsed={false}
      onToggleCollapsed={vi.fn()}
      score={0}
      userVote={undefined}
      hasUpvoted={false}
      hasDownvoted={false}
      handleVote={handleVote}
      handleReply={vi.fn()}
    />
  );
  fireEvent.click(view.getAllByTestId('upvote')[0]);
  fireEvent.click(view.getAllByTestId('downvote')[0]);
  fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Changed' } });
  fireEvent.click(
    view.container.querySelector('[data-action-id="discussions.comment.reply.toggle"]')!
  );
  fireEvent.click(
    view.container.querySelector('[data-action-id="discussions.comment.reply.cancel"]')!
  );
  expect(handleVote).toHaveBeenCalledWith(1);
  expect(handleVote).toHaveBeenCalledWith(-1);
  expect(setReplyText).toHaveBeenCalledWith('Changed');
});

it('executes thread-card vote and comment handlers', () => {
  const setIsCommenting = vi.fn();
  const setCommentText = vi.fn();
  const handleVote = vi.fn();
  const view = render(
    <ThreadCardView
      thread={{ id: 'thread', content: 'Title\n\nDescription', created_at: 1, user_id: 'user' }}
      userId="user"
      amendmentId="amendment"
      amendmentTitle="Title"
      senderName="Sender"
      {...callbacks}
      isCommenting={false}
      setIsCommenting={setIsCommenting}
      commentText=""
      setCommentText={setCommentText}
      isSubmitting={false}
      setIsSubmitting={vi.fn()}
      score={0}
      userVote={undefined}
      hasUpvoted={false}
      hasDownvoted={false}
      sortedComments={[]}
      handleVote={handleVote}
      handleAddComment={vi.fn()}
    />
  );
  fireEvent.click(view.getByTestId('upvote'));
  fireEvent.click(view.getByTestId('downvote'));
  fireEvent.click(
    view.container.querySelector('[data-action-id="discussions.thread.comment.open"]')!
  );
  expect(handleVote).toHaveBeenCalledWith(1);
  expect(handleVote).toHaveBeenCalledWith(-1);
  expect(setIsCommenting).toHaveBeenCalledWith(true);

  const editing = render(
    <ThreadCardView
      thread={{ id: 'thread-edit', content: 'Title', created_at: 1, user_id: 'user' }}
      userId="user"
      amendmentId="amendment"
      amendmentTitle="Title"
      senderName="Sender"
      {...callbacks}
      isCommenting
      setIsCommenting={setIsCommenting}
      commentText="Draft"
      setCommentText={setCommentText}
      isSubmitting={false}
      setIsSubmitting={vi.fn()}
      score={0}
      userVote={undefined}
      hasUpvoted={false}
      hasDownvoted={false}
      sortedComments={[]}
      handleVote={handleVote}
      handleAddComment={vi.fn()}
    />
  );
  fireEvent.change(editing.container.querySelector('textarea')!, { target: { value: 'Changed' } });
  expect(setCommentText).toHaveBeenCalledWith('Changed');
});

it('executes create-thread text and file handlers', () => {
  const onTitleChange = vi.fn();
  const onDescriptionChange = vi.fn();
  const onFileChange = vi.fn();
  const view = render(
    <CreateThreadDialogView
      open
      onOpenChange={vi.fn()}
      description=""
      isSubmitting={false}
      isUploading={false}
      selectedFile={null}
      title="Title"
      onDescriptionChange={onDescriptionChange}
      onFileChange={onFileChange}
      onRemoveFile={vi.fn()}
      onSubmit={vi.fn()}
      onTitleChange={onTitleChange}
    />
  );
  fireEvent.change(view.container.querySelector('#title')!, { target: { value: 'New title' } });
  fireEvent.change(view.container.querySelector('#description')!, { target: { value: 'Details' } });
  fireEvent.click(view.getByTestId('file-trigger'));
  expect(onTitleChange).toHaveBeenCalledWith('New title');
  expect(onDescriptionChange).toHaveBeenCalledWith('Details');
  expect(onFileChange).toHaveBeenCalled();
});

it('executes discussion sort and create callbacks', () => {
  const onSortByChange = vi.fn();
  const onCreateDialogOpenChange = vi.fn();
  const view = render(
    <DiscussionsView
      amendmentId="amendment"
      hasAmendment
      authUserEmail="user@example.test"
      isCreateDialogOpen={false}
      isLoading={false}
      {...callbacks}
      onCreateDialogOpenChange={onCreateDialogOpenChange}
      onCreateThread={vi.fn()}
      onSortByChange={onSortByChange}
      sortBy="votes"
      userId="user"
    />
  );
  fireEvent.click(view.getByTestId('sort'));
  fireEvent.click(view.getAllByText('generated.inline.0392_new_thread_66826f91')[0]);
  expect(onSortByChange).toHaveBeenCalledWith('time');
  expect(onCreateDialogOpenChange).toHaveBeenCalledWith(true);
});
