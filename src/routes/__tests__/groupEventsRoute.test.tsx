/* @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ComponentType, ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type MockLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children?: ReactNode;
  to: string;
  search?: { groupId?: string };
};

const permissions = vi.hoisted(() => ({ canCreateEvents: true }));

vi.mock('@tanstack/react-router', async () => {
  const React = await import('react');

  return {
    createFileRoute: () => (config: { component: ComponentType }) => ({
      ...config,
      useParams: () => ({ id: 'group-1' }),
    }),
    Link: React.forwardRef<HTMLAnchorElement, MockLinkProps>(
      ({ children, to, search, ...props }, ref) => (
        <a
          ref={ref}
          href={`${to}${search?.groupId ? `?groupId=${search.groupId}` : ''}`}
          {...props}
        >
          {children}
        </a>
      )
    ),
  };
});

vi.mock('@/features/groups/hooks/useGroupEventsPage', () => ({
  useGroupEventsPage: () => ({
    viewMode: 'month',
    setViewMode: vi.fn(),
    currentViewTitle: 'August 2026',
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    goToToday: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    dateFilter: 'all',
    setDateFilter: vi.fn(),
    selectedDate: new Date('2026-08-02T00:00:00Z'),
    filteredEvents: [],
    events: [],
    setSelectedDate: vi.fn(),
    onEventSelect: vi.fn(),
    onCreateEventRange: vi.fn(),
    t: (key: string) => (key.endsWith('createEvent') ? 'Create event' : 'Calendar'),
  }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ canCreate: () => permissions.canCreateEvents }),
}));

vi.mock('@/features/events/ui/calendar/SharedCalendarHeader', () => ({
  SharedCalendarHeader: ({ actions }: { actions?: ReactNode }) => <header>{actions}</header>,
}));

vi.mock('@/features/events/ui/calendar/CalendarSearchFilter', () => ({
  CalendarSearchFilter: () => null,
}));

vi.mock('@/features/events/ui/calendar/CalendarViewContainer', () => ({
  CalendarViewContainer: () => null,
}));

import { Route } from '../_authed/group/$id/events';

afterEach(() => {
  cleanup();
  permissions.canCreateEvents = true;
});

describe('authenticated group events route', () => {
  it('renders the event creation action as a stable native deep link', () => {
    const Page = (Route as unknown as { component: ComponentType }).component;
    render(<Page />);

    const action = screen.getByRole('link', { name: 'Create event' });
    expect(action.getAttribute('data-action-id')).toBe('routes.group-events.event.create');
    expect(action.getAttribute('href')).toBe('/create/event?groupId=group-1');
    action.focus();
    expect(document.activeElement).toBe(action);
  });

  it('hides creation when the member cannot create events', () => {
    permissions.canCreateEvents = false;
    const Page = (Route as unknown as { component: ComponentType }).component;
    render(<Page />);

    expect(screen.queryByRole('link', { name: 'Create event' })).toBeNull();
  });
});
