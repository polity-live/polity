/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
  TodoPriorityBadge: ({ priority }: any) => <span>badge-{priority}</span>,
  TodoPriorityIcon: ({ priority }: any) => <span>priority-{priority}</span>,
}));
vi.mock('@/features/shared/ui/form', async () => {
  const SelectContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    FormControlInput: (props: any) => <input {...props} />,
    FormControlLabel: ({ children }: any) => <label>{children}</label>,
    FormControlTextarea: (props: any) => <textarea {...props} />,
    FormControlSelect: ({ children, onValueChange }: any) => (
      <SelectContext.Provider value={onValueChange}>{children}</SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: any) => <div>{children}</div>,
    FormControlSelectItem: ({ children, value, ...props }: any) => {
      const select = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => select(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => <span>select-value</span>,
    VisibilitySelector: ({ onChange }: any) => (
      <button type="button" onClick={() => onChange('public')}>
        visibility-select
      </button>
    ),
  };
});
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <main>{children}</main>,
}));
vi.mock('@/features/shared/ui/ui/dialog.tsx', () => ({
  Dialog: ({ children, onOpenChange }: any) => (
    <div data-testid="dialog" onDoubleClick={() => onOpenChange(false)}>
      {children}
    </div>
  ),
  DialogClose: ({ children }: any) => <>{children}</>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/avatar.tsx', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span data-testid="avatar-fallback">{children}</span>,
  AvatarImage: ({ src }: any) => (src ? <img alt="avatar" src={src} /> : null),
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange(['updated'])}>
      hashtag-editor
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children, onOpenChange }: any) => (
    <div data-testid="popover" onDoubleClick={() => onOpenChange(false)}>
      {children}
    </div>
  ),
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/command.tsx', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ onValueChange, value, ...props }: any) => (
    <input {...props} value={value} onChange={event => onValueChange(event.target.value)} />
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: any) => <a href={`${to}:${params.id}`}>{children}</a>,
}));
vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? 'translated',
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('../utils/todoFormatters', () => ({ formatTodoDate: (value: number) => `date-${value}` }));
vi.mock('@/features/create/ui/inputs/TodoDeadlineInput', () => ({
  TodoDeadlineInput: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange({ dueDate: '2026-01-01' })}>
      deadline-input
    </button>
  ),
}));
vi.mock('@/features/shared/ui/comments', () => ({
  CommentThread: ({ comments }: any) => <section>comments-{comments.length}</section>,
}));
vi.mock('../TodoArchiveAction', () => ({
  TodoArchiveAction: ({ onArchive, onUnarchive }: any) => (
    <div>
      <button type="button" onClick={onArchive}>
        archive-action
      </button>
      <button type="button" onClick={onUnarchive}>
        unarchive-action
      </button>
    </div>
  ),
  TodoArchiveBadge: () => <span>archive-badge</span>,
}));

import { TodoDetailDialogView } from '../TodoDetailDialogView';

const t = (key: string) => key;

function props(overrides: Record<string, any> = {}) {
  const primary = {
    avatar: 'avatar.png',
    email: 'ada@example.test',
    first_name: 'Ada',
    id: 'primary',
    last_name: 'Lovelace',
  };
  const todo = {
    amendment_id: null,
    archived_at: null,
    assignments: [{ user: primary }],
    completed_at: null,
    created_at: 1,
    creator: primary,
    description: 'Description',
    due_date: 2,
    group: { id: 'group', image_url: 'group.png', name: 'Group' },
    id: 'todo',
    priority: 'medium',
    status: 'pending',
    tags: ['tag'],
    title: 'Todo',
    updated_at: 3,
    visibility: 'private',
    ...overrides.todo,
  };
  return {
    canManageTodos: true,
    activity: {
      activities: [],
      canViewActivity: false,
      isLoading: false,
      severity: 'all',
      setSeverity: vi.fn(),
    },
    discussion: {
      comments: [],
      currentUserId: 'actor',
      isSubmitting: false,
      onAddComment: vi.fn(),
      onVote: vi.fn(),
    },
    filteredMembers: [{ user: { email: 'new@example.test', handle: 'new-user', id: 'new' } }],
    formData: {
      description: 'Description',
      dueDate: '',
      dueTime: '',
      priority: 'medium',
      status: 'pending',
      tags: [],
      title: 'Todo',
      visibility: 'private',
    },
    handleAddAssignee: vi.fn(),
    handleArchive: vi.fn(),
    handleCancel: vi.fn(),
    handleDialogOpenChange: vi.fn(),
    handleRemoveAssignee: vi.fn(),
    handleSave: vi.fn(),
    handleUnarchive: vi.fn(),
    isArchiving: false,
    isEditing: false,
    isOverdue: false,
    isSaving: false,
    members: [{ user: primary }],
    membershipsRaw: [],
    onOpenChange: vi.fn(),
    open: true,
    popoverOpen: true,
    resetForm: vi.fn(),
    searchQuery: '',
    selectedUserIds: ['primary'],
    setFormData: vi.fn(),
    setIsEditing: vi.fn(),
    setIsSaving: vi.fn(),
    setPopoverOpen: vi.fn(),
    setSearchQuery: vi.fn(),
    setSelectedUserIds: vi.fn(),
    t,
    updateTodo: vi.fn(),
    assignUser: vi.fn(),
    unassignUser: vi.fn(),
    visibilityLabels: {
      authenticated: 'Authenticated',
      private: 'Private',
      public: 'Public',
    },
    ...overrides,
    todo,
  } as any;
}

afterEach(cleanup);

describe('TodoDetailDialogView branches', () => {
  it('renders and invokes every editable field and assignee action', () => {
    const input = props({
      isEditing: true,
      members: [{ user: { email: 'member@example.test', id: 'member' } }, { user: null }],
      selectedUserIds: ['member', 'assigned', 'anonymous', 'missing'],
      todo: {
        assignments: [
          { user: { email: 'assigned@example.test', id: 'assigned' } },
          { user: { id: 'anonymous' } },
        ],
      },
      filteredMembers: [
        { user: null },
        { user: { id: 'member' } },
        { user: { email: 'available@example.test', id: 'available' } },
        { user: { id: 'available-empty' } },
      ],
    });
    render(<TodoDetailDialogView {...input} />);

    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'Changed title' } });
    fireEvent.click(
      document.querySelector('[data-action-id="todos.detail-dialog.status.completed"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="todos.detail-dialog.priority.urgent"]')!
    );
    fireEvent.change(screen.getAllByRole('textbox')[1]!, { target: { value: 'Changed body' } });
    fireEvent.click(screen.getByRole('button', { name: 'deadline-input' }));
    fireEvent.click(screen.getByRole('button', { name: 'visibility-select' }));
    fireEvent.click(
      document.querySelector('[data-action-id="todos.detail-dialog.assignee.remove"]')!
    );
    fireEvent.doubleClick(screen.getByTestId('popover'));
    fireEvent.change(screen.getByPlaceholderText('features.todos.assignee.searchMembers'), {
      target: { value: 'avail' },
    });
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.assignee.add"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'hashtag-editor' }));
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.cancel"]')!);
    fireEvent.doubleClick(screen.getByTestId('dialog'));

    expect(input.setFormData).toHaveBeenCalled();
    expect(input.handleAddAssignee).toHaveBeenCalledWith('available');
    expect(input.handleRemoveAssignee).toHaveBeenCalledWith('member');
    expect(input.handleSave).toHaveBeenCalled();
    expect(input.handleCancel).toHaveBeenCalled();
    expect(input.handleDialogOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    ['pending', 'public'],
    ['in_progress', 'authenticated'],
    ['completed', 'private'],
    ['cancelled', undefined],
  ])('renders non-editing status %s and visibility %s', (status, visibility) => {
    const input = props({ todo: { status, visibility } });
    render(<TodoDetailDialogView {...input} />);
    expect(screen.getByText(status.replace('_', ' '))).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.edit"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'archive-action' }));
    fireEvent.click(screen.getByRole('button', { name: 'unarchive-action' }));
    expect(input.setIsEditing).toHaveBeenCalledWith(true);
    cleanup();
  });

  it('renders archived, overdue and completed metadata', () => {
    const input = props({
      isOverdue: true,
      todo: { archived_at: 4, completed_at: 5, priority: undefined },
    });
    render(<TodoDetailDialogView {...input} />);
    expect(screen.getByText('archive-badge')).toBeTruthy();
    expect(screen.getByText('features.todos.status.overdue')).toBeTruthy();
    expect(screen.getByText('priority-medium')).toBeTruthy();
  });

  it('renders empty, unauthorized and anonymous fallbacks', () => {
    const input = props({
      canManageTodos: false,
      todo: {
        assignments: [],
        completed_at: null,
        created_at: null,
        creator: {
          avatar: null,
          email: null,
          first_name: null,
          id: 'anonymous',
          last_name: null,
        },
        description: '',
        due_date: null,
        group: { id: 'group', image_url: null, name: '' },
        priority: null,
        status: null,
        tags: [],
        updated_at: null,
        visibility: null,
      },
    });
    render(<TodoDetailDialogView {...input} />);
    expect(screen.getByText('features.todos.detail.noDescription')).toBeTruthy();
    expect(screen.getByText('features.todos.detail.noDueDateSet')).toBeTruthy();
    expect(screen.getByText('features.todos.assignee.noUsersAssigned')).toBeTruthy();
    expect(document.body.textContent?.match(/N\/A/g)).toHaveLength(2);
    expect(screen.queryByText('archive-action')).toBeNull();
  });

  it('renders assignment identity fallbacks without creator or group sections', () => {
    const input = props({
      todo: {
        assignments: [
          { user: { avatar: null, email: 'mail@example.test', first_name: '', id: 'mail' } },
          { user: undefined },
        ],
        creator: null,
        group: null,
        tags: undefined,
      },
    });
    render(<TodoDetailDialogView {...input} />);
    expect(screen.getByText('mail')).toBeTruthy();
    expect(screen.getByText('translated')).toBeTruthy();
    expect(screen.getByText('comments-0')).toBeTruthy();
  });
});
