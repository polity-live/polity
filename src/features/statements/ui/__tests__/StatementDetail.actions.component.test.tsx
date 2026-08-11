/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatementDetail } from '../StatementDetail';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, ...props }: any) => (
    <a href={params?.id ? `/user/${params.id}` : '/'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton', () => ({
  ShareButton: ({ 'data-action-id': actionId, title, url }: any) => (
    <button type="button" data-action-id={actionId} data-title={title} data-url={url}>
      Share
    </button>
  ),
}));

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({ MediaUpload: () => null }));
vi.mock('@/features/shared/ui/comments', () => ({ CommentThread: () => null }));
vi.mock('@/features/shared/ui/voting/VoteButtons', () => ({ VoteButtons: () => null }));
vi.mock('@/features/statements/ui/StatementMediaDisplay', () => ({
  StatementMediaDisplay: () => null,
}));
vi.mock('@/features/statements/ui/StatementTextRenderer', () => ({
  StatementTextRenderer: ({ text }: any) => <span>{text}</span>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button type="button">{children}</button>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableAlertDialogContent: ({ children }: any) => <div>{children}</div>,
}));

afterEach(cleanup);

function readyModel(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready',
    author: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', avatar: null },
    authorName: 'Ada Lovelace',
    comments: [],
    computedCommentCount: 2,
    computedDownvotes: 0,
    computedUpvotes: 1,
    currentVoteValue: 0,
    editDialog: {
      deleteOpen: false,
      editImageUrl: '',
      editIsStory: false,
      editSurveyDuration: 24,
      editSurveyOptions: ['Yes', 'No'],
      editSurveyQuestion: '',
      editText: 'Statement text',
      editTitle: 'Statement title',
      editVideoUrl: '',
      editVisibility: 'public',
    },
    group: null,
    hashtags: [],
    isEditOpen: false,
    isOwner: true,
    labels: {
      addOption: 'Add option',
      addSurvey: 'Survey',
      authorByline: 'By Ada Lovelace',
      cancel: 'Cancel',
      charsRemaining: '260 remaining',
      comments: 'comments',
      delete: 'Confirm delete',
      deleteAction: 'Delete',
      deleteConfirmDescription: 'This cannot be undone',
      deleteConfirmTitle: 'Delete statement?',
      duration: 'Duration',
      edit: 'Edit',
      formText: 'Text',
      formTitle: 'Title',
      option: 'Option',
      question: 'Question',
      removeSurvey: 'Remove survey',
      save: 'Save',
      storyDescription: 'Story description',
      storyExpired: 'Expired',
      storyLabel: 'Story',
    },
    canSaveEdit: true,
    displayTitle: 'Statement title',
    isExpiredStory: false,
    statement: {
      id: 'statement-1',
      user_id: 'user-1',
      title: 'Statement title',
      text: 'Statement text',
      is_story: false,
    },
    statementId: 'statement-1',
    survey: null,
    timeDisplay: 'now',
    userId: 'user-1',
    onAddComment: vi.fn(),
    onAddSurveyOption: vi.fn(),
    onCloseEdit: vi.fn(),
    onCommentVote: vi.fn(),
    onConfirmDelete: vi.fn(),
    onDeleteOpenChange: vi.fn(),
    onPrepareEdit: vi.fn(),
    onRemoveSurvey: vi.fn(),
    onSaveEdit: vi.fn(),
    onSurveyDurationChange: vi.fn(),
    onSurveyOptionChange: vi.fn(),
    onSurveyQuestionChange: vi.fn(),
    onSurveyRetract: vi.fn(),
    onSurveyVote: vi.fn(),
    onUpdateEditImageUrl: vi.fn(),
    onUpdateEditIsStory: vi.fn(),
    onUpdateEditText: vi.fn(),
    onUpdateEditTitle: vi.fn(),
    onUpdateEditVideoUrl: vi.fn(),
    onUpdateEditVisibility: vi.fn(),
    onVote: vi.fn(),
    ...overrides,
  } as any;
}

describe('StatementDetail action contracts', () => {
  it('exposes stable statement author and share navigation contracts', () => {
    render(<StatementDetail model={readyModel()} />);

    const author = document.querySelector('[data-action-id="statements.detail.author.open"]');
    expect(author?.getAttribute('href')).toBe('/user/user-1');
    const share = document.querySelector('[data-action-id="statements.detail.share.open"]');
    expect(share?.getAttribute('data-url')).toContain('/statement/statement-1');
    expect(share?.getAttribute('data-title')).toBe('Statement title');
  });

  it('dispatches statement owner actions through stable intents', () => {
    const model = readyModel();
    render(<StatementDetail model={model} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(model.onPrepareEdit).toHaveBeenCalledOnce();
    expect(model.onDeleteOpenChange).toHaveBeenCalledWith(true);
  });

  it('dispatches statement delete confirmation through a stable intent', () => {
    const model = readyModel({
      editDialog: { ...readyModel().editDialog, deleteOpen: true },
    });
    render(<StatementDetail model={model} />);

    const confirm = screen.getByRole('button', { name: 'Confirm delete' });
    expect(confirm.dataset.actionId).toBe('statements.detail.delete.confirm');
    fireEvent.click(confirm);
    expect(model.onConfirmDelete).toHaveBeenCalledOnce();
  });

  it('dispatches statement edit dialog actions through stable intents', () => {
    const model = readyModel({ isEditOpen: true });
    render(<StatementDetail model={model} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Add option' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(model.onAddSurveyOption).toHaveBeenCalledOnce();
    expect(model.onCloseEdit).toHaveBeenCalledOnce();
    expect(model.onSaveEdit).toHaveBeenCalledOnce();
  });

  it('dispatches survey removal from the edit dialog through a stable intent', () => {
    const model = readyModel({
      isEditOpen: true,
      survey: { id: 'survey-1', question: 'Decision', options: [] },
    });
    render(<StatementDetail model={model} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove survey' }));
    expect(model.onRemoveSurvey).toHaveBeenCalledOnce();
  });
});
