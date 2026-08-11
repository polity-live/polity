/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  discussions: [] as any[],
  currentUserId: 'viewer',
  currentUser: { name: 'Viewer', avatarUrl: 'viewer.png' } as
    { name?: string; avatarUrl?: string } | undefined,
  users: {} as Record<string, { name?: string; avatarUrl?: string } | undefined>,
  commentId: undefined as string | undefined,
  nextValue: [{ type: 'p', children: [{ text: 'New comment' }] }] as any[],
  nodes: [] as [Record<string, unknown>, number[]][],
  currentDiscussions: undefined as any[] | undefined,
  editorChildren: [{ type: 'p', children: [{ text: 'Edited' }] }] as any[],
  setOption: vi.fn(),
  unsetMark: vi.fn(),
  setNodes: vi.fn(),
  unsetNodes: vi.fn(),
  replaceNodes: vi.fn(),
  focus: vi.fn(),
  reset: vi.fn(),
  alert: vi.fn(),
  nanoid: vi.fn(),
  diffMinutes: 0,
  diffHours: 0,
  diffDays: 0,
  format: vi.fn((_args: unknown[]) => '01/02/2025'),
}));

vi.mock('@platejs/comment', () => ({
  getCommentKey: (id: string) => `comment_${id}`,
  getDraftCommentKey: () => 'draft_comment',
}));

vi.mock('@platejs/comment/react', () => ({
  CommentPlugin: { key: 'comment' },
  useCommentId: () => state.commentId,
}));

vi.mock('date-fns', () => ({
  differenceInMinutes: () => state.diffMinutes,
  differenceInHours: () => state.diffHours,
  differenceInDays: () => state.diffDays,
  format: (...args: unknown[]) => state.format(args),
}));

vi.mock('lucide-react', () => ({
  ArrowUpIcon: () => <i data-icon="submit" />,
  CheckIcon: () => <i data-icon="check" />,
  MoreHorizontalIcon: () => <i data-icon="more" />,
  PencilIcon: () => <i data-icon="edit" />,
  TrashIcon: () => <i data-icon="trash" />,
  XIcon: () => <i data-icon="cancel" />,
}));

vi.mock('platejs', () => ({
  KEYS: { p: 'p' },
  NodeApi: {
    string: ({ children }: { children: any[] }) => children[0]?.children?.[0]?.text ?? '',
  },
  nanoid: () => state.nanoid(),
}));

const editor = {
  getOption: (_plugin: unknown, key: string) => {
    if (key === 'discussions') return state.currentDiscussions ?? state.discussions;
    if (key === 'currentUserId') return state.currentUserId;
    return undefined;
  },
  setOption: (...args: unknown[]) => state.setOption(...args),
  getApi: () => ({ comment: { nodes: () => state.nodes } }),
  tf: {
    setNodes: (...args: unknown[]) => state.setNodes(...args),
    unsetNodes: (...args: unknown[]) => state.unsetNodes(...args),
  },
};

vi.mock('platejs/react', () => ({
  Plate: ({
    children,
    onChange,
  }: {
    children: ReactNode;
    onChange?: (input: { value: any[] }) => void;
  }) => (
    <div data-plate>
      {onChange ? (
        <button type="button" data-change onClick={() => onChange({ value: state.nextValue })}>
          change
        </button>
      ) : null}
      {children}
    </div>
  ),
  useEditorPlugin: () => ({ tf: { comment: { unsetMark: state.unsetMark } } }),
  useEditorRef: () => editor,
  usePlateEditor: () => ({
    children: state.editorChildren,
    tf: {
      replaceNodes: state.replaceNodes,
      focus: state.focus,
      reset: state.reset,
    },
  }),
  usePluginOption: (_plugin: unknown, key: string, id?: string) => {
    if (key === 'discussions') return state.discussions;
    if (key === 'currentUserId') return state.currentUserId;
    if (key === 'currentUser') return state.currentUser;
    if (key === 'user') return id ? state.users[id] : undefined;
    return undefined;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/avatar.tsx', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div data-avatar>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span data-fallback>{children}</span>,
  AvatarImage: ({ alt, src }: { alt?: string; src?: string }) => (
    <span data-avatar-alt={alt ?? 'none'} data-avatar-src={src ?? 'none'} />
  ),
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({
    children,
    onOpenChange,
  }: {
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-dropdown>
      <button type="button" data-open-menu onClick={() => onOpenChange(true)}>
        open
      </button>
      {children}
    </div>
  ),
  DropdownMenuContent: ({
    children,
    onCloseAutoFocus,
  }: {
    children: ReactNode;
    onCloseAutoFocus: (event: { preventDefault: () => void }) => void;
  }) => (
    <div>
      <button
        type="button"
        data-close-menu
        onClick={() => onCloseAutoFocus({ preventDefault: vi.fn() })}
      >
        close
      </button>
      {children}
    </div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick: (event: React.MouseEvent) => void;
  }) => (
    <div data-trigger onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

vi.mock('@/features/shared/ui/kit-platejs/basic-marks-kit.tsx', () => ({ BasicMarksKit: [] }));
vi.mock('@/features/shared/ui/kit-platejs/discussion-kit.tsx', () => ({
  discussionPlugin: { key: 'discussion' },
}));
vi.mock('./editor.tsx', () => ({}));
vi.mock('../editor.tsx', () => ({
  EditorContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Editor: ({
    onKeyDown,
    placeholder,
    autoFocus,
  }: {
    onKeyDown?: (event: React.KeyboardEvent) => void;
    placeholder?: string;
    autoFocus?: boolean;
  }) => <input data-editor placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown} />,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/comments/DiscussionActions', () => ({
  DiscussionActionBar: ({ children }: { children: ReactNode }) => (
    <div data-actions>{children}</div>
  ),
  DiscussionCollapseToggle: ({
    collapsed,
    onToggle,
  }: {
    collapsed: boolean;
    onToggle: () => void;
  }) => (
    <button type="button" data-collapsed={collapsed} onClick={onToggle}>
      collapse
    </button>
  ),
}));

vi.mock('@/features/shared/ui/comments/DiscussionTimestamp', () => ({
  DiscussionTimestamp: ({ value }: { value: Date }) => <span data-time={value.toISOString()} />,
}));

import { Comment, CommentCreateForm, formatCommentDate, type TComment } from '../comment';

const value = [{ type: 'p', children: [{ text: 'Original' }] }] as any;
const comment = (overrides: Partial<TComment> = {}): TComment => ({
  id: 'comment-1',
  contentRich: value,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  discussionId: 'discussion-1',
  isEdited: true,
  userId: 'viewer',
  ...overrides,
});

const discussion = (overrides: Record<string, unknown> = {}) => ({
  id: 'discussion-1',
  comments: [comment(), comment({ id: 'other-comment' })],
  isResolved: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.discussions = [
    discussion(),
    { id: 'other-discussion', comments: [comment({ id: 'outside' })] },
  ];
  state.currentDiscussions = undefined;
  state.currentUserId = 'viewer';
  state.currentUser = { name: 'Viewer', avatarUrl: 'viewer.png' };
  state.users = { viewer: { name: 'Viewer', avatarUrl: 'viewer.png' }, other: undefined };
  state.commentId = undefined;
  state.nextValue = [{ type: 'p', children: [{ text: 'New comment' }] }];
  state.nodes = [];
  state.editorChildren = [{ type: 'p', children: [{ text: 'Edited' }] }];
  let id = 0;
  state.nanoid.mockImplementation(() => `generated-${++id}`);
  vi.stubGlobal('alert', state.alert);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Comment branch contracts', () => {
  it('renders author, edit marker, quoted document, reply action, and collapse states', () => {
    const onReply = vi.fn();
    const view = render(
      <Comment
        comment={comment()}
        discussionLength={2}
        editingId={null}
        index={0}
        setEditingId={vi.fn()}
        showDocumentContent
        documentContent="Quoted"
        onReply={onReply}
      />
    );
    expect(screen.getByText('Viewer')).toBeDefined();
    expect(screen.getByText('plateJs.comment.edited')).toBeDefined();
    expect(screen.getByText('Quoted')).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: 'translated:generated.inline.0377_reply_6c2bb735' })
    );
    expect(onReply).toHaveBeenCalledOnce();

    fireEvent.click(view.container.querySelector('[data-collapsed]') as HTMLElement);
    expect(view.container.querySelector('[data-plate]')).toBeNull();
    fireEvent.click(view.container.querySelector('[data-collapsed]') as HTMLElement);
    expect(view.container.querySelector('[data-plate]')).not.toBeNull();
  });

  it('covers missing user metadata, hidden document content, last comment, and non-owner idle state', () => {
    const view = render(
      <Comment
        comment={comment({ userId: 'other', isEdited: false })}
        discussionLength={2}
        editingId="different"
        index={1}
        setEditingId={vi.fn()}
        showDocumentContent
        documentContent=""
      />
    );
    expect(view.container.querySelector('[data-avatar-src="none"]')).not.toBeNull();
    expect(view.container.querySelector('[data-actions]')).toBeNull();
    expect(screen.queryByText('plateJs.comment.edited')).toBeNull();
  });

  it('cancels and saves edits while preserving and replacing the intended comment only', () => {
    const setEditingId = vi.fn();
    state.discussions = [discussion(), { id: 'other-discussion', comments: [] }];
    render(
      <Comment
        comment={comment()}
        discussionLength={2}
        editingId="comment-1"
        index={0}
        setEditingId={setEditingId}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.comment.cancel' }));
    expect(state.replaceNodes).toHaveBeenCalledWith(value, { at: [], children: true });
    fireEvent.click(screen.getByRole('button', { name: 'plateJs.comment.save' }));
    expect(setEditingId).toHaveBeenLastCalledWith(null);
    expect(state.setOption).toHaveBeenCalledWith(
      expect.anything(),
      'discussions',
      expect.arrayContaining([
        expect.objectContaining({
          comments: [
            expect.objectContaining({ isEdited: true }),
            expect.objectContaining({ id: 'other-comment' }),
          ],
        }),
        expect.objectContaining({ id: 'other-discussion' }),
      ])
    );
  });

  it('opens owner controls from hover/dropdown, resolves first comments, and preserves unrelated discussions', () => {
    const view = render(
      <Comment
        comment={comment()}
        discussionLength={2}
        editingId={null}
        index={0}
        setEditingId={vi.fn()}
      />
    );
    expect(view.container.querySelector('[data-actions]')).toBeNull();
    fireEvent.mouseEnter(
      view.container.querySelector('[data-slot="discussion-comment"]') as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: /common.actions.done/ }));
    expect(state.unsetMark).toHaveBeenCalledWith({ id: 'discussion-1' });
    expect(state.setOption).toHaveBeenCalledWith(
      expect.anything(),
      'discussions',
      expect.arrayContaining([
        expect.objectContaining({ id: 'discussion-1', isResolved: true }),
        expect.objectContaining({ id: 'other-discussion' }),
      ])
    );
    fireEvent.click(view.container.querySelector('[data-open-menu]') as HTMLElement);
    fireEvent.click(view.container.querySelector('[data-trigger]') as HTMLElement);
    fireEvent.click(view.container.querySelector('[data-close-menu]') as HTMLElement);
    fireEvent.mouseLeave(
      view.container.querySelector('[data-slot="discussion-comment"]') as HTMLElement
    );
    expect(view.container.querySelector('[data-actions]')).not.toBeNull();
  });

  it('edits and deletes existing comments, focuses after edit close, and removes single-comment discussions', () => {
    vi.useFakeTimers();
    const setEditingId = vi.fn();
    state.discussions = [
      discussion({ comments: [comment()] }),
      { id: 'other-discussion', comments: [] },
    ];
    const view = render(
      <Comment
        comment={comment()}
        discussionLength={1}
        editingId={null}
        index={0}
        setEditingId={setEditingId}
      />
    );
    fireEvent.mouseEnter(
      view.container.querySelector('[data-slot="discussion-comment"]') as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: /plateJs.comment.edit/ }));
    expect(setEditingId).toHaveBeenCalledWith('comment-1');
    fireEvent.click(view.container.querySelector('[data-close-menu]') as HTMLElement);
    vi.runAllTimers();
    expect(state.focus).toHaveBeenCalledWith({ edge: 'endEditor' });

    fireEvent.click(screen.getByRole('button', { name: /plateJs.comment.delete/ }));
    expect(state.unsetMark).toHaveBeenCalledWith({ id: 'discussion-1' });
    expect(state.setOption).toHaveBeenLastCalledWith(expect.anything(), 'discussions', [
      expect.objectContaining({ id: 'other-discussion' }),
    ]);
    vi.useRealTimers();
  });

  it('alerts for empty ids and preserves discussions when comments are missing', () => {
    state.discussions = [discussion({ comments: [comment({ id: 'different' })] })];
    const view = render(
      <Comment
        comment={comment({ id: '' })}
        discussionLength={2}
        editingId={null}
        index={1}
        setEditingId={vi.fn()}
      />
    );
    fireEvent.mouseEnter(
      view.container.querySelector('[data-slot="discussion-comment"]') as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: /plateJs.comment.edit/ }));
    fireEvent.click(screen.getByRole('button', { name: /plateJs.comment.delete/ }));
    expect(state.alert).toHaveBeenCalledTimes(2);

    cleanup();
    const missing = render(
      <Comment
        comment={comment()}
        discussionLength={2}
        editingId={null}
        index={1}
        setEditingId={vi.fn()}
      />
    );
    fireEvent.mouseEnter(
      missing.container.querySelector('[data-slot="discussion-comment"]') as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: /plateJs.comment.delete/ }));
    expect(state.setOption).toHaveBeenCalledWith(
      expect.anything(),
      'discussions',
      state.discussions
    );
  });
});

describe('CommentCreateForm branch contracts', () => {
  it('focuses on mount, stays disabled without content, and ignores non-submit keyboard input', () => {
    const view = render(<CommentCreateForm focusOnMount autoFocus />);
    expect(state.focus).toHaveBeenCalledOnce();
    expect(view.container.querySelector('button:disabled')).not.toBeNull();
    const input = view.container.querySelector('[data-editor]') as HTMLElement;
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(state.reset).not.toHaveBeenCalled();
  });

  it('creates a new named discussion and invokes the optional submitted callback', () => {
    const onSubmitted = vi.fn();
    const view = render(
      <CommentCreateForm discussionId="new-discussion" onSubmitted={onSubmitted} />
    );
    fireEvent.click(view.container.querySelector('[data-change]') as HTMLElement);
    fireEvent.click(
      view.container.querySelector('[data-icon="submit"]')?.closest('button') as HTMLElement
    );
    expect(state.reset).toHaveBeenCalledOnce();
    expect(state.setOption).toHaveBeenCalledWith(
      expect.anything(),
      'discussions',
      expect.arrayContaining([expect.objectContaining({ id: 'new-discussion', isResolved: false })])
    );
    expect(onSubmitted).toHaveBeenCalledOnce();
  });

  it('adds replies by click and Enter with both callback-presence paths', () => {
    state.discussions = [discussion()];
    const view = render(<CommentCreateForm discussionId="discussion-1" />);
    fireEvent.click(view.container.querySelector('[data-change]') as HTMLElement);
    const input = view.container.querySelector('[data-editor]') as HTMLElement;
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(state.setOption).toHaveBeenCalledWith(
      expect.anything(),
      'discussions',
      expect.arrayContaining([expect.objectContaining({ id: 'discussion-1' })])
    );
  });

  it('uses comment id, stops when draft marks are absent, and creates a draft-linked discussion', () => {
    state.commentId = 'comment-discussion';
    const missing = render(<CommentCreateForm />);
    fireEvent.click(missing.container.querySelector('[data-change]') as HTMLElement);
    fireEvent.click(
      missing.container.querySelector('[data-icon="submit"]')?.closest('button') as HTMLElement
    );
    expect(state.setOption).toHaveBeenCalled();
    cleanup();

    state.commentId = undefined;
    state.discussions = [];
    state.nodes = [];
    const emptyNodes = render(<CommentCreateForm />);
    fireEvent.click(emptyNodes.container.querySelector('[data-change]') as HTMLElement);
    fireEvent.click(
      emptyNodes.container.querySelector('[data-icon="submit"]')?.closest('button') as HTMLElement
    );
    expect(state.setNodes).not.toHaveBeenCalled();
    cleanup();

    state.nodes = [
      [{ text: 'A' }, [0]],
      [{ text: 'B' }, [1]],
    ];
    state.currentDiscussions = undefined;
    const draft = render(<CommentCreateForm />);
    fireEvent.click(draft.container.querySelector('[data-change]') as HTMLElement);
    fireEvent.click(
      draft.container.querySelector('[data-icon="submit"]')?.closest('button') as HTMLElement
    );
    expect(state.setNodes).toHaveBeenCalledTimes(2);
    expect(state.unsetNodes).toHaveBeenCalledTimes(2);
  });

  it('falls back to an empty current discussion list when editor state is unavailable', () => {
    state.nodes = [[{ text: 'A' }, [0]]];
    state.discussions = undefined as never;
    state.currentDiscussions = undefined;
    const view = render(<CommentCreateForm />);
    fireEvent.click(view.container.querySelector('[data-change]') as HTMLElement);
    fireEvent.click(
      view.container.querySelector('[data-icon="submit"]')?.closest('button') as HTMLElement
    );
    expect(state.setOption).toHaveBeenCalled();
  });
});

describe('formatCommentDate', () => {
  it('formats minute, hour, day, and calendar boundaries', () => {
    state.diffMinutes = 59;
    expect(formatCommentDate(new Date())).toBe('59m');
    state.diffMinutes = 60;
    state.diffHours = 23;
    expect(formatCommentDate(new Date())).toBe('23h');
    state.diffHours = 24;
    state.diffDays = 1;
    expect(formatCommentDate(new Date())).toBe('1d');
    state.diffDays = 2;
    expect(formatCommentDate(new Date())).toBe('01/02/2025');
    expect(state.format).toHaveBeenCalled();
  });
});
