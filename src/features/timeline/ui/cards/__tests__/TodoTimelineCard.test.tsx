/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/features/shared/ui/ui/button';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'user@example.com',
    },
  }),
}));

vi.mock('@/features/todos/hooks/useTodoMutations', () => ({
  useTodoMutations: () => ({
    updateTodo: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/zero/todos/useTodoActions', () => ({
  useTodoActions: () => ({
    assignUser: vi.fn(),
  }),
}));

vi.mock('@/zero/todos/useTodoState', () => ({
  useTodoState: () => ({
    assignments: [],
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/features/notifications/utils/notification-helpers.ts', () => ({
  notifyStandaloneTodoAssigned: vi.fn(),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <Button type="button">Share</Button>,
}));

vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <div data-testid="timeline-card-base" onClick={onClick}>
      {children}
    </div>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TimelineCardActionButton: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <Button type="button" onClick={onClick}>
      {label}
    </Button>
  ),
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
  TimelineCardHeader: ({
    children,
    title,
    subtitle,
  }: {
    children: ReactNode;
    title: string;
    subtitle?: string;
  }) => (
    <div>
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
      {children}
    </div>
  ),
}));

import { TodoTimelineCard } from '../TodoTimelineCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TodoTimelineCard', () => {
  it('hides mutating action buttons for view-only users', () => {
    render(
      <TodoTimelineCard
        canManageTodos={false}
        todo={{
          id: 'todo-1',
          title: 'Todo One',
          description: 'Description',
          isCompleted: false,
          status: 'pending',
        }}
      />
    );

    expect(screen.queryByText('features.todos.actions.markComplete')).toBeNull();
    expect(screen.queryByText('features.todos.assignee.assignToMe')).toBeNull();
    expect(screen.queryByText('Share')).not.toBeNull();
  });

  it('marks archived todos and hides their operative actions', () => {
    render(
      <TodoTimelineCard
        canManageTodos
        todo={{
          id: 'todo-archived',
          title: 'Archived todo',
          isCompleted: true,
          status: 'completed',
          archived: true,
        }}
      />
    );

    expect(screen.queryByText('features.todos.status.archived')).not.toBeNull();
    expect(screen.queryByText('features.todos.assignee.assignToMe')).toBeNull();
    expect(screen.queryByText('features.todos.status.completed')).toBeNull();
  });
});
