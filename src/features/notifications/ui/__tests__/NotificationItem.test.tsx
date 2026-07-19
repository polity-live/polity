/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    t: (key: string) => {
      if (key === 'features.notifications.item.notification') return 'notification';
      if (key === 'features.notifications.item.new') return 'New';
      if (key === 'features.notifications.actions.markRead') return 'Mark as read';
      if (key === 'common.creationFinalization.entities.payment') return 'Payment';
      if (key === 'common.actions.delete') return 'Delete';
      return key;
    },
  }),
}));

vi.mock('@/features/shared/virtualization', () => ({
  rowAttributes: (index: number, key: string) => ({
    'data-vrow-index': index,
    'data-vrow-key': key,
  }),
  usePolityZeroWindowList: () => ({
    items: [
      {
        index: 0,
        key: 'notification-entity',
        row: notification({ id: 'notification-entity', is_read: true }),
      },
    ],
    spaceBefore: 0,
    spaceAfter: 0,
    rowsEmpty: false,
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
    expect(screen.getByText('Civic Group')).toBeTruthy();
    expect(screen.queryByText('Civic Group notification')).toBeNull();
    const newBadge = screen.getByText('New');
    expect(newBadge.className).toContain('bg-[var(--badge-success-bg)]');
    expect(newBadge.className).toContain('font-mono');
    expect(newBadge.className).toContain('uppercase');
    expect(container.querySelectorAll('[data-slot="badge-control"]').length).toBeGreaterThan(0);
  });

  it('only renders the delete action when a delete handler is provided', () => {
    const { container, rerender } = render(
      <NotificationItem
        notification={notification({ is_read: true })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'features.notifications.item.hideForMe' })
    ).toBeNull();

    rerender(
      <NotificationItem
        notification={notification({ is_read: true })}
        onNotificationClick={vi.fn()}
        onDeleteNotification={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'features.notifications.item.hideForMe' })
    ).toBeTruthy();
    expect(container.querySelector('.lucide-trash-2')).toBeTruthy();
  });

  it('marks only an unread notification as read without activating the card', () => {
    const onNotificationClick = vi.fn();
    const onMarkAsRead = vi.fn();
    const item = notification({
      related_user: undefined,
      related_user_id: null,
    });

    render(
      <NotificationItem
        notification={item}
        onNotificationClick={onNotificationClick}
        onMarkAsRead={onMarkAsRead}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));

    expect(onMarkAsRead).toHaveBeenCalledWith(item, expect.any(Object));
    expect(onNotificationClick).not.toHaveBeenCalled();
    expect(document.querySelector('.lucide-mail-open')).toBeTruthy();
  });

  it('deletes through a bin icon without activating the card', () => {
    const onNotificationClick = vi.fn();
    const onDeleteNotification = vi.fn();
    const item = notification({
      is_read: true,
      related_user: undefined,
      related_user_id: null,
    });

    const { container } = render(
      <NotificationItem
        notification={item}
        onNotificationClick={onNotificationClick}
        onDeleteNotification={onDeleteNotification}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'features.notifications.item.hideForMe' }));

    expect(onDeleteNotification).toHaveBeenCalledWith(item.id, expect.any(Object));
    expect(onNotificationClick).not.toHaveBeenCalled();
    expect(container.querySelector('.lucide-trash-2')).toBeTruthy();
  });

  it('shows the global delete action only with an explicit capability and opens its dialog', () => {
    const onDeleteForEveryone = vi.fn();
    const item = notification({ is_read: true });
    const { rerender } = render(
      <NotificationItem
        notification={item}
        onNotificationClick={vi.fn()}
        onDeleteForEveryone={onDeleteForEveryone}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'features.notifications.item.deleteForEveryone' })
    ).toBeNull();

    rerender(
      <NotificationItem
        notification={item}
        onNotificationClick={vi.fn()}
        onDeleteForEveryone={onDeleteForEveryone}
        canDeleteForEveryone
      />
    );

    expect(
      screen.getByRole('button', { name: 'features.notifications.item.deleteForEveryone' })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'features.notifications.item.deleteForEveryone' })
    );
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'features.notifications.item.deleteForEveryone',
      })
    );
    expect(onDeleteForEveryone).toHaveBeenCalledWith(item.id);
  });

  it('hides the single read action for personal and effectively read entity notifications', () => {
    const onMarkAsRead = vi.fn();
    const { rerender } = render(
      <NotificationItem
        notification={notification({ is_read: true })}
        onNotificationClick={vi.fn()}
        onMarkAsRead={onMarkAsRead}
      />
    );

    expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();

    rerender(
      <NotificationItem
        notification={notification({
          is_read: false,
          recipient_entity_type: 'group',
          recipient_entity_id: 'group-1',
          reads: [
            {
              id: 'read-1',
              notification_id: 'notification-1',
              entity_type: 'group',
              entity_id: 'group-1',
              read_by_user_id: 'user-1',
              read_at: Date.now(),
            },
          ],
        })}
        onNotificationClick={vi.fn()}
        onMarkAsRead={onMarkAsRead}
      />
    );

    expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();
  });

  it('replaces leaked payment placeholders in previously stored notifications', () => {
    render(
      <NotificationItem
        notification={notification({
          type: 'group_payment_created',
          message: 'A new payment "{{paymentDescription}}" has been created in Group One',
        })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(screen.getByText('A new payment "Payment" has been created in Group One')).toBeTruthy();
    expect(screen.queryByText(/\{\{paymentDescription\}\}/)).toBeNull();
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
        entityId="group-1"
        entityType="group"
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
        onMarkAsRead={vi.fn()}
        formatTime={() => 'now'}
      />
    );

    const card = container.querySelector('[data-slot="notification-card"]');
    const heading = screen.getByRole('heading', { name: labels.title });

    expect(card).toBeTruthy();
    expect(heading.closest('header')?.className).toContain('sr-only');
    expect(card?.getAttribute('data-mode')).toBe('entity');
    expect(container.querySelector('[data-slot="feed-list"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="notification-list-item"]')?.className).toContain(
      'civic-load-card-reveal'
    );
    expectNoLeftBorderClasses(container);
  });
});
