/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { EntityNotificationsView } from '../EntityNotificationsView';
import { NotificationItem } from '../NotificationItem';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) => (key === 'features.notifications.item.notification' ? 'notification' : key),
  }),
}));

afterEach(() => {
  cleanup();
});

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-1',
    type: 'membership_request',
    title: 'Membership requested',
    message: 'Ada asked to join.',
    created_at: Date.now(),
    is_read: false,
    sender: {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      avatar: null,
    },
    related_user: {
      id: 'user-2',
      first_name: 'Grace',
      last_name: 'Hopper',
      email: 'grace@example.com',
      avatar: null,
    },
    related_user_id: 'user-2',
    recipient_group: {
      id: 'group-1',
      name: 'Civic Group',
      image_url: null,
    },
    ...overrides,
  } as Notification;
}

function expectNoLeftBorderClasses(container: HTMLElement) {
  expect(container.innerHTML).not.toContain('border-l-');
  expect(container.innerHTML).not.toContain('border-l ');
  expect(container.innerHTML).not.toContain('border-l"');
}

describe('NotificationItem', () => {
  it('renders unread notifications without left-border accent classes', () => {
    const { container } = render(
      <NotificationItem notification={notification()} onNotificationClick={vi.fn()} />
    );

    const card = container.querySelector('[data-slot="notification-card"]');

    expect(card).toBeTruthy();
    expect(card?.className).toContain('bg-card');
    expect(card?.className).toContain('border-border/70');
    expect(card?.className).toContain('shadow-[var(--shadow-panel)]');
    expectNoLeftBorderClasses(container);
    expect(screen.getAllByText('Membership requested').length).toBeGreaterThan(0);
    expect(screen.getByText(/Civic Group/)).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="badge-control"]').length).toBeGreaterThan(0);
  });

  it('only renders the delete action when a delete handler is provided', () => {
    const { container, rerender } = render(
      <NotificationItem
        notification={notification({ is_read: true })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(container.querySelector('button')).toBeNull();

    rerender(
      <NotificationItem
        notification={notification({ is_read: true })}
        onNotificationClick={vi.fn()}
        onDeleteNotification={vi.fn()}
      />
    );

    expect(container.querySelector('button')).toBeTruthy();
  });

  it('renders entity-page notifications through the same card slot', () => {
    const item = notification({ id: 'notification-entity', is_read: true });
    const labels = {
      loading: 'Loading notifications',
      title: 'Civic Group notifications',
      statusDescription: 'All caught up',
      markAllRead: 'Mark all read',
      searchPlaceholder: 'Search notifications',
      all: 'All',
      unread: 'Unread',
      read: 'Read',
      noNotificationsYet: 'No notifications yet',
      notificationsWillShowHere: 'Notifications will show here',
      allCaughtUp: 'All caught up',
      allRead: 'All read',
      noReadNotifications: 'No read notifications',
      readNotificationsAppearHere: 'Read notifications appear here',
    };

    const { container } = render(
      <EntityNotificationsView
        isLoading={false}
        notifications={[item]}
        filteredNotifications={[item]}
        unreadNotifications={[]}
        readNotifications={[item]}
        searchQuery=""
        labels={labels}
        onSearchQueryChange={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onNotificationClick={vi.fn()}
        formatTime={() => 'now'}
      />
    );

    const card = container.querySelector('[data-slot="notification-card"]');

    expect(card).toBeTruthy();
    expect(card?.getAttribute('data-mode')).toBe('entity');
    expect(container.querySelector('[data-slot="feed-list"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="notification-list-item"]')?.className).toContain(
      'civic-load-card-reveal'
    );
    expectNoLeftBorderClasses(container);
  });
});
