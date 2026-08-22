/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailDialogView } from '../TodoDetailDialogView';

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog.tsx', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/avatar.tsx', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/command.tsx', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: (props: any) => <input {...props} onChange={() => undefined} />,
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagEditor: () => null }));
vi.mock('@/features/create/ui/inputs/TodoDeadlineInput', () => ({
  TodoDeadlineInput: () => null,
}));
vi.mock('@/features/shared/ui/comments', () => ({ CommentThread: () => null }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('../TodoArchiveAction', () => ({
  TodoArchiveAction: () => null,
  TodoArchiveBadge: () => null,
}));
vi.mock('@/features/shared/ui/form', async () => {
  const { createContext, useContext } = await import('react');
  const SelectContext = createContext<(value: string) => void>(() => undefined);
  return {
    FormControlInput: (props: any) => <input {...props} />,
    FormControlLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    FormControlTextarea: (props: any) => <textarea {...props} />,
    VisibilitySelector: () => null,
    FormControlSelect: ({ children, onValueChange, ...props }: any) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectTrigger: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => <span>Select</span>,
    FormControlSelectItem: ({ children, value, ...props }: any) => {
      const onValueChange = useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
  };
});

afterEach(cleanup);

const t = (key: string) => key;

function viewProps(overrides: Record<string, unknown> = {}) {
  const member = {
    user: {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.test',
    },
  };
  return {
    canManageTodos: true,
    todo: {
      id: 'todo-1',
      title: 'Todo',
      description: '',
      status: 'pending',
      priority: 'medium',
      visibility: 'private',
      group: { id: 'group-1', name: 'Group' },
      assignments: [{ user: member.user }],
    },
    open: true,
    t,
    isEditing: true,
    setIsEditing: vi.fn(),
    isSaving: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    popoverOpen: true,
    setPopoverOpen: vi.fn(),
    selectedUserIds: ['user-1'],
    formData: {
      title: 'Todo',
      description: '',
      status: 'pending',
      priority: 'medium',
      visibility: 'private',
      dueDate: '',
      dueTime: '',
      tags: [],
    },
    setFormData: vi.fn(),
    isOverdue: false,
    visibilityLabels: {},
    members: [member],
    filteredMembers: [{ user: { ...member.user, id: 'user-2' } }],
    handleDialogOpenChange: vi.fn(),
    handleSave: vi.fn(),
    handleCancel: vi.fn(),
    handleRemoveAssignee: vi.fn(),
    handleAddAssignee: vi.fn(),
    activity: {
      activities: [],
      canViewActivity: false,
      isLoading: false,
      severity: 'all',
      setSeverity: vi.fn(),
    },
    discussion: {
      comments: [],
      currentUserId: 'user-current',
      onAddComment: vi.fn(),
      onVote: vi.fn(),
      isSubmitting: false,
    },
    isArchiving: false,
    handleArchive: vi.fn(),
    handleUnarchive: vi.fn(),
    ...overrides,
  } as any;
}

describe('TodoDetailDialogView action contracts', () => {
  it('edits status, priority, and assignees through stable dialog intents', () => {
    const props = viewProps();
    render(<TodoDetailDialogView {...props} />);

    for (const status of ['pending', 'in-progress', 'completed', 'cancelled']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="todos.detail-dialog.status.${status}"]`)!
      );
    }
    for (const priority of ['low', 'medium', 'high', 'urgent']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="todos.detail-dialog.priority.${priority}"]`)!
      );
    }
    const statusTrigger = document.querySelector(
      '[data-action-id="todos.detail-dialog.status.select"] button'
    ) as HTMLButtonElement;
    statusTrigger.focus();
    fireEvent.keyDown(statusTrigger, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(statusTrigger);

    fireEvent.click(
      document.querySelector('[data-action-id="todos.detail-dialog.assignee.remove"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="todos.detail-dialog.assignee.open"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.assignee.add"]')!);
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="todos.detail-dialog.cancel"]')!);

    expect(props.setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
    expect(props.setFormData).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent' }));
    expect(props.handleRemoveAssignee).toHaveBeenCalledWith('user-1');
    expect(props.handleAddAssignee).toHaveBeenCalledWith('user-2');
    expect(props.handleSave).toHaveBeenCalledOnce();
    expect(props.handleCancel).toHaveBeenCalledOnce();
  });

  it('opens editing and closes from stable focusable actions', () => {
    const props = viewProps({ isEditing: false });
    render(<TodoDetailDialogView {...props} />);
    const edit = document.querySelector(
      '[data-action-id="todos.detail-dialog.edit"]'
    ) as HTMLButtonElement;
    const close = document.querySelector(
      '[data-action-id="todos.detail-dialog.close"]'
    ) as HTMLButtonElement;
    edit.focus();
    expect(document.activeElement).toBe(edit);
    fireEvent.click(edit);
    fireEvent.click(close);
    expect(props.setIsEditing).toHaveBeenCalledWith(true);
  });
});
