// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailView } from '../TodoDetailView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to }: any) => (
    <a href={`${to}:${params.id}`} data-testid="detail-link">
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('../../utils/todoFormatters', () => ({
  formatTodoDate: (value: unknown) => `date:${String(value)}`,
  formatTodoDateTime: (value: unknown) => `date-time:${String(value)}`,
  isOverdue: (dueDate: unknown) => dueDate === 'late',
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <span data-testid="avatar-image">{src ?? 'no-image'}</span>,
}));

vi.mock('../TodoStatusIcon', () => ({
  TodoStatusIcon: ({ status }: any) => <span data-testid="status-icon">{status}</span>,
}));

vi.mock('../TodoPriorityBadge', () => ({
  TodoPriorityBadge: ({ priority }: any) => <span>{`badge:${priority}`}</span>,
  TodoPriorityIcon: ({ priority }: any) => <span>{`icon:${priority}`}</span>,
}));

function fullTodo() {
  return {
    id: 'todo-full',
    title: 'Full todo',
    description: 'A complete description',
    status: 'in_progress',
    priority: 'urgent',
    due_date: 'late',
    creator: { id: 'creator-1', avatar: 'creator.png', email: 'alice@example.test' },
    assignments: [
      { id: 'assignment-1', user: { id: 'user-1', avatar: 'user.png', email: 'bob@test' } },
      { id: 'assignment-2', user: { id: 'user-2', avatar: null, email: '' } },
      { id: 'assignment-3', user: null },
    ],
    group: { id: 'group-1', name: 'Working Group', image_url: 'group.png' },
    tags: ['one', 'two'],
    created_at: 'created',
    updated_at: 'updated',
    completed_at: 'completed',
  } as any;
}

describe('TodoDetailView branch coverage', () => {
  afterEach(cleanup);

  it('renders all populated, overdue sections and relation fallbacks', () => {
    render(<TodoDetailView todo={fullTodo()} />);

    expect(screen.getByText('A complete description')).toBeTruthy();
    expect(screen.getByText('date:late').className).toContain('text-destructive');
    expect(screen.getByText('generated.inline.1173_overdue_07217c77')).toBeTruthy();
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('bob')).toBeTruthy();
    expect(screen.getAllByText('generated.inline.0031_unknown_bc7819b3')).toHaveLength(2);
    expect(screen.getByText('Working Group')).toBeTruthy();
    expect(screen.getByText('one')).toBeTruthy();
    expect(document.body.textContent).toContain('date-time:completed');
  });

  it('renders defaults when optional todo data is absent', () => {
    render(
      <TodoDetailView
        todo={
          {
            id: 'todo-minimal',
            title: 'Minimal',
            description: '',
            status: null,
            priority: null,
            due_date: null,
            creator: null,
            assignments: null,
            group: null,
            tags: null,
            created_at: null,
            updated_at: null,
            completed_at: null,
          } as any
        }
      />
    );

    expect(screen.getByTestId('status-icon').textContent).toBe('pending');
    expect(screen.getByText('badge:medium')).toBeTruthy();
    expect(screen.getByText('generated.inline.0145_no_description_provided_2145e21d')).toBeTruthy();
    expect(screen.getByText('generated.inline.1174_no_due_date_set_7ae77ef5')).toBeTruthy();
    expect(screen.getAllByText(/N\/A/)).toHaveLength(2);
    expect(screen.queryByTestId('detail-link')).toBeNull();
  });

  it('renders non-overdue dates and empty collections plus missing relation details', () => {
    render(
      <TodoDetailView
        todo={
          {
            ...fullTodo(),
            id: 'todo-fallbacks',
            due_date: 'soon',
            creator: { id: 'creator-2', avatar: null, email: null },
            assignments: [],
            group: { id: 'group-2', name: null, image_url: null },
            tags: [],
            completed_at: null,
          } as any
        }
      />
    );

    expect(screen.getByText('date:soon').className).not.toContain('text-destructive');
    expect(screen.queryByText('generated.inline.1173_overdue_07217c77')).toBeNull();
    expect(screen.getByText('generated.inline.0031_unknown_bc7819b3')).toBeTruthy();
    expect(screen.getByText('G')).toBeTruthy();
  });
});
