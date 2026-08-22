/* @vitest-environment jsdom */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: any) => <a href="#user">{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, optionsOrFallback?: string | { count?: number }, fallback?: string) => {
      const translations: Record<string, string> = {
        'components.activityLog.actions.assigned': 'assigned the todo to',
        'components.activityLog.actions.updated': 'updated details',
        'components.activityLog.emptyValue': 'Empty',
        'components.activityLog.filter.all': 'All',
        'components.activityLog.filter.high': 'High',
        'components.activityLog.filter.label': 'Filter activities',
        'components.activityLog.filter.normal': 'Normal',
        'components.activityLog.fields.assignees': 'Assignees',
        'components.activityLog.fields.status': 'Status',
        'components.activityLog.severity.high': 'High',
        'components.activityLog.values.status.completed': 'Completed',
        'components.activityLog.values.status.pending': 'Pending',
        'features.todos.activity.tabs.activity': 'Activity log',
        'features.todos.activity.tabs.comments': 'Comments',
        'features.todos.status.completed': 'Completed',
        'features.todos.status.pending': 'Pending',
      };
      const count = typeof optionsOrFallback === 'object' ? optionsOrFallback.count : undefined;
      return (
        translations[key] ??
        (typeof optionsOrFallback === 'string' ? optionsOrFallback : fallback) ??
        key.replace('{{count}}', String(count))
      );
    },
  }),
}));

vi.mock('@/features/shared/ui/comments', () => ({
  CommentThread: () => <div>Comment thread</div>,
}));

const SelectContext = React.createContext<(value: string) => void>(() => undefined);
vi.mock('@/features/shared/ui/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <SelectContext.Provider value={onValueChange}>{children}</SelectContext.Provider>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => {
    const onValueChange = React.useContext(SelectContext);
    return (
      <button type="button" onClick={() => onValueChange(value)}>
        {children}
      </button>
    );
  },
  SelectTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectValue: () => <span>All</span>,
}));

import { TodoDiscussionTabs } from '../TodoDiscussionTabs';

const discussion = {
  commentCount: 0,
  comments: [],
  currentUserId: 'actor',
  isSubmitting: false,
  onAddComment: vi.fn(),
  onVote: vi.fn(),
};

function activity(overrides: Record<string, unknown> = {}) {
  return {
    activities: [
      {
        action: 'updated',
        actor: { first_name: 'Ada', id: 'actor', last_name: 'Lovelace' },
        actor_id: 'actor',
        changes: [{ field: 'status', from: 'pending', to: 'completed' }],
        created_at: Date.UTC(2026, 7, 22, 12),
        id: 'activity-1',
        severity: 'high',
        subject_user: null,
        subject_user_id: null,
        todo_id: 'todo',
      },
    ],
    canViewActivity: true,
    isLoading: false,
    severity: 'all',
    setSeverity: vi.fn(),
    ...overrides,
  } as any;
}

afterEach(cleanup);

describe('TodoDiscussionTabs', () => {
  it('opens on comments and renders localized high-severity changes in the activity tab', () => {
    render(
      <TodoDiscussionTabs activity={activity()} discussion={discussion} resetKey="todo:open" />
    );

    expect(screen.getByText('Comment thread')).toBeTruthy();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity log' }), { button: 0 });

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('updated details')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('passes the selected severity to the controller', () => {
    const controller = activity();
    render(
      <TodoDiscussionTabs activity={controller} discussion={discussion} resetKey="todo:open" />
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity log' }), { button: 0 });
    fireEvent.click(
      document.querySelector('[data-action-id="activity-log.filter.high"]') as HTMLElement
    );
    expect(controller.setSeverity).toHaveBeenCalledWith('high');
  });

  it('localizes assignments and renders the subject name instead of a translation key or id', () => {
    const subjectId = '99ff35f9-9aba-4148-bc79-60518e0e9b7c';
    render(
      <TodoDiscussionTabs
        activity={activity({
          activities: [
            {
              action: 'assigned',
              actor: { first_name: 'Ada', id: 'actor', last_name: 'Lovelace' },
              changes: [{ field: 'assignees', from: [], to: [subjectId] }],
              created_at: Date.UTC(2026, 7, 22, 12),
              id: 'assignment-activity',
              severity: 'high',
              subject_user: { first_name: 'Grace', id: subjectId, last_name: 'Hopper' },
            },
          ],
        })}
        discussion={discussion}
        resetKey="todo:open"
      />
    );

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity log' }), { button: 0 });

    expect(screen.getByText('assigned the todo to')).toBeTruthy();
    expect(screen.getByText('Assignees')).toBeTruthy();
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('components.activityLog');
    expect(document.body.textContent).not.toContain(subjectId);
  });

  it('does not expose the activity tab to unauthorized readers', () => {
    render(
      <TodoDiscussionTabs
        activity={activity({ canViewActivity: false })}
        discussion={discussion}
        resetKey="todo:open"
      />
    );
    expect(screen.queryByRole('tab', { name: 'Activity log' })).toBeNull();
    expect(screen.getByText('Comment thread')).toBeTruthy();
  });
});
