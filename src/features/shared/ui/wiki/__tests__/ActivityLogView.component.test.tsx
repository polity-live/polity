/* @vitest-environment jsdom */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hookController: undefined as any,
  onValueChange: undefined as ((value: string) => void) | undefined,
  translations: {} as Record<string, string>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: any) => <a href="#user">{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, optionsOrFallback?: string | { count?: number }, fallback?: string) => {
      if (key === 'components.activityLog.context.count') {
        return `Count ${typeof optionsOrFallback === 'object' ? optionsOrFallback.count : '?'}`;
      }
      return (
        mocks.translations[key] ??
        (typeof optionsOrFallback === 'string' ? optionsOrFallback : fallback) ??
        key
      );
    },
  }),
}));

vi.mock('@/features/shared/hooks/useEntityActivity', () => ({
  useEntityActivity: () => mocks.hookController,
}));

vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterToggleGroupItem: ({ children, value, ...props }: any) => (
    <button type="button" onClick={() => mocks.onValueChange?.(value)} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/toggle-group', () => ({
  ToggleGroup: ({ children, onValueChange, ...props }: any) => {
    mocks.onValueChange = onValueChange;
    return (
      <div {...props}>
        <button type="button" onClick={() => onValueChange('invalid')}>
          Invalid filter
        </button>
        {children}
      </div>
    );
  },
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: () => null,
}));

vi.mock('@/features/shared/ui/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { ActivityLog } from '../ActivityLog';
import { ActivityLogView, type ActivityLogController } from '../ActivityLogView';

function controller(overrides: Partial<ActivityLogController> = {}): ActivityLogController {
  return {
    activities: [],
    hasMore: false,
    isLoading: false,
    loadMore: vi.fn(),
    setSeverity: vi.fn(),
    severity: 'all',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.onValueChange = undefined;
  mocks.translations = {
    'components.activityLog.deletedUser': '',
    'components.activityLog.empty': 'No activity',
    'components.activityLog.emptyValue': 'Empty value',
    'components.activityLog.filter.all': 'All',
    'components.activityLog.filter.high': 'High',
    'components.activityLog.filter.label': 'Activity filter',
    'components.activityLog.filter.normal': 'Normal',
    'components.activityLog.loadMore': 'Load more',
    'components.activityLog.loading': 'Loading activity',
    'components.activityLog.system': 'System',
  };
});

afterEach(cleanup);

describe('ActivityLogView', () => {
  it('renders loading and empty states while accepting only supported filters', () => {
    const loading = controller({ isLoading: true, hasMore: true });
    const { rerender } = render(<ActivityLogView activity={loading} />);
    expect(screen.getByText('Loading activity')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Load more' }) as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.click(screen.getByRole('button', { name: 'Invalid filter' }));
    expect(loading.setSeverity).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'High' }));
    expect(loading.setSeverity).toHaveBeenCalledWith('high');

    rerender(<ActivityLogView activity={controller()} />);
    expect(screen.getByText('No activity')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('formats actors, changes, dates, arrays, objects, contexts, and pagination', () => {
    const loadMore = vi.fn();
    const subjectId = 'subject-1';
    const activity = controller({
      activities: [
        {
          action: 'system_update',
          actor: null,
          actor_type: 'system',
          changes: [
            { field: 'scheduled_at', from: null, to: Date.UTC(2026, 7, 22, 12) },
            { field: 'metadata', from: { enabled: true }, to: [] },
          ],
          context: { count: 2, extra_value: 7 },
          created_at: Date.UTC(2026, 7, 22, 12),
          id: 'system',
          severity: 'high',
          subject_user: null,
        },
        {
          action: 'assigned',
          actor: { handle: 'ada', id: 'actor-1' },
          actor_type: 'user',
          changes: [
            { field: 'assignee_id', from: subjectId, to: '' },
            { field: 'owner_user_id', from: subjectId, to: 'other-user' },
            { field: 'tags', from: ['first_tag', 'second_tag'], to: undefined },
          ],
          context: { title: 'Titled context' },
          created_at: 1,
          id: 'user',
          severity: 'normal',
          subject_user: { handle: 'grace', id: subjectId },
        },
        {
          action: 'removed',
          actor: {},
          actor_type: 'user',
          changes: 'invalid',
          context: 'invalid',
          created_at: 2,
          id: 'fallback',
          severity: 'normal',
        },
        {
          action: 'renamed',
          actor: { first_name: 'Katherine', last_name: 'Johnson' },
          actor_type: 'user',
          changes: [],
          context: { name: 'Named context' },
          created_at: 3,
          id: 'named',
          severity: 'normal',
        },
      ],
      hasMore: true,
      loadMore,
    });

    render(<ActivityLogView activity={activity} />);

    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByText('ada')).toBeTruthy();
    expect(screen.getAllByText('grace').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Katherine Johnson')).toBeTruthy();
    expect(screen.getByText('Count 2')).toBeTruthy();
    expect(screen.getByText('Titled context')).toBeTruthy();
    expect(screen.getByText('Named context')).toBeTruthy();
    expect(screen.getAllByText('Empty value').length).toBeGreaterThan(1);
    expect(document.body.textContent).toContain('{"enabled":true}');
    expect(document.body.textContent).toContain('First tag, Second tag');
    expect(document.body.textContent).toContain('?');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('connects the entity hook through the ActivityLog wrapper', () => {
    mocks.hookController = controller();
    render(<ActivityLog entityId="group-1" type="group" />);
    expect(screen.getByText('No activity')).toBeTruthy();
  });
});
