/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captures = vi.hoisted(() => ({
  dialogOpenChange: undefined as undefined | ((open: boolean) => void),
  survey: undefined as any,
  share: undefined as any,
}));

vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: () => 'theme' }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params: _params, search: _search, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div data-testid="access-denied" />,
}));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('private')}>
      visibility
    </button>
  ),
}));
vi.mock('@/features/create/ui/inputs/StatementStoryToggle', () => ({
  StatementStoryToggle: ({ onCheckedChange }: any) => (
    <button type="button" onClick={() => onCheckedChange(true)}>
      story-toggle
    </button>
  ),
}));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: ({ onImageChange, onVideoChange }: any) => (
    <div>
      <button type="button" onClick={() => onImageChange('image')}>
        image-change
      </button>
      <button type="button" onClick={() => onVideoChange('video')}>
        video-change
      </button>
    </div>
  ),
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton', () => ({
  ShareButton: (props: any) => {
    captures.share = props;
    return <button type="button">share</button>;
  },
}));
vi.mock('@/features/shared/ui/comments', () => ({ CommentThread: () => <div>comments</div> }));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableAlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
  FormControlInput: (props: any) => <input {...props} />,
  FormControlTextarea: (props: any) => <textarea {...props} />,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: ({ name, fallbackLabel }: any) => <span>{name ?? fallbackLabel}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ alt }: any) => <span>{alt}</span>,
}));
vi.mock('@/features/shared/ui/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: any) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, onOpenChange }: any) => {
    captures.dialogOpenChange = onOpenChange;
    return <div>{children}</div>;
  },
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/voting/VoteButtons', () => ({ VoteButtons: () => <div>votes</div> }));
vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: any) => <main>{children}</main>,
}));
vi.mock('../StatementMediaDisplay', () => ({ StatementMediaDisplay: () => <div>media</div> }));
vi.mock('../StatementSurvey', () => ({
  StatementSurvey: (props: any) => {
    captures.survey = props;
    return <div>survey</div>;
  },
}));
vi.mock('../StatementTextRenderer', () => ({
  StatementTextRenderer: ({ text }: any) => <span>{text}</span>,
}));

import { StatementDetail } from '../StatementDetail';

const labels = new Proxy({}, { get: (_target, property) => String(property) }) as Record<
  string,
  string
>;

function readyModel(overrides: Record<string, any> = {}) {
  const model = {
    status: 'ready',
    author: { id: 'author', avatar: 'avatar' },
    authorName: 'Ada Author',
    computedCommentCount: 2,
    computedDownvotes: 1,
    computedUpvotes: 3,
    currentVoteValue: 1,
    displayTitle: 'Statement title',
    editDialog: {
      deleteOpen: true,
      editTitle: 'Edit title',
      editText: 'Edit text',
      editImageUrl: 'image',
      editVideoUrl: 'video',
      editIsStory: false,
      editVisibility: 'public',
      editSurveyQuestion: 'Question?',
      editSurveyOptions: ['One', 'Two'],
      editSurveyDuration: 24,
    },
    group: { id: 'group', name: 'Group', image_url: 'group-image' },
    hashtags: ['civic'],
    isEditOpen: true,
    isExpiredStory: true,
    isOwner: true,
    labels,
    statement: {
      id: 'statement',
      user_id: 'fallback-author',
      text: 'Statement body',
      image_url: 'image',
      video_url: null,
      is_story: true,
    },
    statementId: 'statement',
    survey: {
      id: 'survey',
      question: 'Question?',
      ends_at: 100,
      options: [
        { id: 'one', label: 'One', vote_count: 1, position: 0, votes: [{ id: 'vote' }] },
        { id: 'two', label: 'Two', vote_count: 0, position: 1, votes: undefined },
      ],
    },
    timeDisplay: 'today',
    userId: 'viewer',
    canSaveEdit: true,
    comments: [],
    onVote: vi.fn(),
    onSurveyVote: vi.fn(),
    onSurveyRetract: vi.fn(),
    onAddComment: vi.fn(),
    onCommentVote: vi.fn(),
    onPrepareEdit: vi.fn(),
    onDeleteOpenChange: vi.fn(),
    onConfirmDelete: vi.fn(),
    onCloseEdit: vi.fn(),
    onUpdateEditTitle: vi.fn(),
    onUpdateEditText: vi.fn(),
    onUpdateEditImageUrl: vi.fn(),
    onUpdateEditVideoUrl: vi.fn(),
    onUpdateEditIsStory: vi.fn(),
    onUpdateEditVisibility: vi.fn(),
    onSurveyQuestionChange: vi.fn(),
    onSurveyOptionChange: vi.fn(),
    onAddSurveyOption: vi.fn(),
    onSurveyDurationChange: vi.fn(),
    onRemoveSurvey: vi.fn(),
    onSaveEdit: vi.fn(),
    ...overrides,
  };
  return model as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  captures.dialogOpenChange = undefined;
  captures.survey = undefined;
  captures.share = undefined;
});

afterEach(cleanup);

describe('StatementDetail exhaustive branch campaign A10', () => {
  it('renders loading, missing, and access-denied terminal states', () => {
    const view = render(<StatementDetail model={{ status: 'loading' } as any} />);
    expect(screen.getByTestId('page-skeleton')).toBeTruthy();
    view.rerender(
      <StatementDetail
        model={
          {
            status: 'not-found',
            labels: { notFound: 'missing', notFoundDescription: 'gone' },
          } as any
        }
      />
    );
    expect(screen.getByText('missing')).toBeTruthy();
    view.rerender(<StatementDetail model={{ status: 'access-denied' } as any} />);
    expect(screen.getByTestId('access-denied')).toBeTruthy();
  });

  it('renders and drives every rich detail, owner, survey, and edit action', () => {
    const model = readyModel();
    const { container } = render(<StatementDetail model={model} />);
    expect(screen.getByText('Statement body')).toBeTruthy();
    expect(captures.survey.survey.options).toEqual([
      expect.objectContaining({ votes: [{ id: 'vote' }] }),
      expect.objectContaining({ votes: undefined }),
    ]);
    expect(captures.share.url).toContain('/statement/statement');

    fireEvent.click(container.querySelector('[data-action-id="statements.detail.edit.open"]')!);
    fireEvent.click(container.querySelector('[data-action-id="statements.detail.delete.open"]')!);
    fireEvent.click(
      container.querySelector('[data-action-id="statements.detail.delete.confirm"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="statements.detail.survey-option.add"]')!
    );
    fireEvent.click(container.querySelector('[data-action-id="statements.detail.survey.remove"]')!);
    fireEvent.click(container.querySelector('[data-action-id="statements.detail.edit.cancel"]')!);
    fireEvent.click(container.querySelector('[data-action-id="statements.detail.edit.save"]')!);
    fireEvent.click(screen.getByText('story-toggle'));
    fireEvent.click(screen.getByText('visibility'));
    fireEvent.click(screen.getByText('image-change'));
    fireEvent.click(screen.getByText('video-change'));

    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'T'.repeat(130) } });
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'B'.repeat(300) } });
    fireEvent.change(inputs[1], { target: { value: 'New question' } });
    fireEvent.change(inputs[2], { target: { value: 'Updated option' } });
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '48' } });
    expect(model.onUpdateEditTitle).toHaveBeenCalledWith('T'.repeat(120));
    expect(model.onUpdateEditText).toHaveBeenCalledWith('B'.repeat(280));
    expect(model.onSurveyQuestionChange).toHaveBeenCalledWith('New question');
    expect(model.onSurveyOptionChange).toHaveBeenCalledWith(0, 'Updated option');
    expect(model.onSurveyDurationChange).toHaveBeenCalledWith(48);

    model.onCloseEdit.mockClear();
    captures.dialogOpenChange?.(true);
    expect(model.onCloseEdit).not.toHaveBeenCalled();
    captures.dialogOpenChange?.(false);
    expect(model.onCloseEdit).toHaveBeenCalled();
  });

  it('covers sparse author, group, time, text, story, survey, hashtag, and owner alternatives', () => {
    const sparse = readyModel({
      author: null,
      group: null,
      hashtags: [],
      isExpiredStory: false,
      isOwner: false,
      isEditOpen: false,
      statement: {
        id: 'statement',
        user_id: 'fallback-author',
        text: null,
        image_url: null,
        video_url: null,
        is_story: true,
      },
      survey: null,
      timeDisplay: '',
      editDialog: {
        ...readyModel().editDialog,
        editImageUrl: '',
        editVideoUrl: '',
        editSurveyOptions: ['One', 'Two', 'Three', 'Four'],
      },
    });
    const view = render(<StatementDetail model={sparse} />);
    expect(document.querySelector('[data-action-id="statements.detail.edit.open"]')).toBeNull();
    expect(
      document.querySelector('[data-action-id="statements.detail.survey-option.add"]')
    ).toBeNull();

    view.rerender(
      <StatementDetail
        model={readyModel({
          isExpiredStory: false,
          statement: { ...sparse.statement, is_story: false },
          survey: null,
          hashtags: [],
        })}
      />
    );
    expect(screen.queryByText('24h')).toBeNull();

    view.rerender(
      <StatementDetail
        model={readyModel({
          group: { id: 'group-nullable', name: null, image_url: null },
          survey: null,
          hashtags: [],
        })}
      />
    );
    expect(document.querySelector('a[href="/group/$id"]')).toBeTruthy();
  });

  it('builds a server-safe share URL when window is unavailable', () => {
    const savedWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    expect(() => StatementDetail({ model: readyModel() })).not.toThrow();
    vi.stubGlobal('window', savedWindow);
  });
});
