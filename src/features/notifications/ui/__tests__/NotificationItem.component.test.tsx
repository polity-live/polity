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
      if (key === 'features.notifications.item.for') return 'for';
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
    for (const actionId of [
      'notifications.item.navigate.user-name',
      'notifications.item.navigate.user-avatar',
      'notifications.item.open.linked',
    ]) {
      expect(container.querySelector(`[data-action-id="${actionId}"]`)).toBeTruthy();
    }
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

  it('dispatches trash and unlinked-card actions through stable notification intents', () => {
    const item = notification({
      is_read: true,
      related_user: undefined,
      related_user_id: null,
    });
    const onRestoreNotification = vi.fn();
    const onPurgeNotification = vi.fn();
    const onNotificationClick = vi.fn();
    const { container, rerender } = render(
      <NotificationItem
        notification={item}
        mode="trash"
        onNotificationClick={onNotificationClick}
        onRestoreNotification={onRestoreNotification}
        onPurgeNotification={onPurgeNotification}
      />
    );

    fireEvent.click(
      container.querySelector('[data-action-id="notifications.item.restore.from-trash"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.item.purge.permanently"]')!
    );
    expect(onRestoreNotification).toHaveBeenCalledWith(item.id, expect.any(Object));
    expect(onPurgeNotification).toHaveBeenCalledWith(item.id, expect.any(Object));

    rerender(<NotificationItem notification={item} onNotificationClick={onNotificationClick} />);
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.item.open.unlinked"]')!
    );
    expect(onNotificationClick).toHaveBeenCalledWith(item);
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

  it('replaces leaked sender placeholders in previously stored notifications', () => {
    render(
      <NotificationItem
        notification={notification({
          type: 'group_new_subscriber',
          message: '{{senderName}} has subscribed to Civic Group',
        })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(screen.getByText('Ada Lovelace has subscribed to Civic Group')).toBeTruthy();
    expect(screen.queryByText(/\{\{senderName\}\}/)).toBeNull();
  });

  it('renders a duplicated actor as sender to recipient entity', () => {
    const actor = {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      avatar: null,
    } as NonNullable<Notification['sender']>;

    const { container } = render(
      <NotificationItem
        notification={notification({
          type: 'group_new_subscriber',
          message: 'Ada Lovelace has subscribed to Civic Group',
          sender: actor,
          related_user: actor,
          related_user_id: actor.id,
        })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1);
    expect(screen.getByText('->')).toBeTruthy();
    expect(screen.queryByText('for')).toBeNull();
    expect(container.textContent).not.toContain('Ada Lovelace->Ada Lovelace');
  });

  it('renders a duplicated actor as sender to the on-behalf entity in personal copies', () => {
    const actor = {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      avatar: null,
    } as NonNullable<Notification['sender']>;

    const { container } = render(
      <NotificationItem
        notification={notification({
          type: 'collaboration_request',
          message: 'Ada Lovelace has requested to collaborate on Civic Amendment',
          sender: actor,
          related_user: actor,
          related_user_id: actor.id,
          recipient_group: undefined,
          on_behalf_of_amendment: {
            id: 'amendment-1',
            title: 'Civic Amendment',
            image_url: null,
          } as NonNullable<Notification['on_behalf_of_amendment']>,
        })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1);
    expect(screen.getByText('->')).toBeTruthy();
    expect(screen.getAllByText('Civic Amendment').length).toBeGreaterThan(0);
    expect(screen.queryByText('for')).toBeNull();
    expect(
      container.querySelector('[data-action-id="notifications.item.navigate.entity-avatar"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-action-id="notifications.item.navigate.entity-name"]')
    ).toBeTruthy();
  });

  it('renders entity identity without navigation when the entity has no persistent id', () => {
    const { container } = render(
      <NotificationItem
        notification={notification({
          recipient_group: undefined,
          on_behalf_of_group: {
            id: '',
            name: 'Unsaved group',
            image_url: null,
          } as unknown as NonNullable<Notification['on_behalf_of_group']>,
        })}
        onNotificationClick={vi.fn()}
      />
    );

    expect(screen.getAllByText('Unsaved group')).toHaveLength(2);
    expect(
      container.querySelector('[data-action-id="notifications.item.navigate.entity-avatar"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-action-id="notifications.item.navigate.entity-name"]')
    ).toBeNull();
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

  it('selects entity scopes and dispatches bulk read through stable actions', () => {
    const item = notification({ id: 'notification-entity', is_read: false });
    const onMarkAllAsRead = vi.fn();
    const labels = {
      loading: 'Loading notifications',
      title: 'Civic Group notifications',
      statusDescription: 'Unread notifications',
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
        unreadNotifications={[item]}
        readNotifications={[]}
        searchQuery=""
        labels={labels}
        onSearchQueryChange={vi.fn()}
        onMarkAllAsRead={onMarkAllAsRead}
        onNotificationClick={vi.fn()}
        onMarkAsRead={vi.fn()}
        formatTime={() => 'now'}
      />
    );

    for (const value of ['all', 'unread', 'read']) {
      const tab = container.querySelector(
        `[data-action-id="notifications.entity-tabs.select.${value}"]`
      );
      expect(tab).toBeTruthy();
      expect(tab?.getAttribute('role')).toBe('tab');
    }
    expect(
      container
        .querySelector('[data-action-id="notifications.entity-tabs.select.all"]')
        ?.getAttribute('data-state')
    ).toBe('active');
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.entity.mark-all.read"]')!
    );
    expect(onMarkAllAsRead).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'event',
      { on_behalf_of_event: { id: 'event-1', title: 'Civic Event', image_url: 'event.png' } },
    ],
    [
      'amendment',
      {
        on_behalf_of_amendment: {
          id: 'amendment-1',
          title: 'Civic Amendment',
          image_url: null,
        },
      },
    ],
    ['blog', { on_behalf_of_blog: { id: 'blog-1', title: 'Civic Blog', image_url: null } }],
  ])('links %s notification entities to their detail page', (entityType, entity) => {
    const item = notification({
      recipient_group: undefined,
      ...entity,
    } as Partial<Notification>);
    const { container } = render(
      <NotificationItem notification={item} onNotificationClick={vi.fn()} />
    );
    const entityLink = container.querySelector(
      '[data-action-id="notifications.item.navigate.entity-name"]'
    ) as HTMLAnchorElement;
    expect(entityLink.getAttribute('href')).toContain(`/${entityType}/`);
  });

  it('covers entity fallbacks and actor layouts without persistent identities', () => {
    const idlessSender = {
      id: '',
      first_name: 'Idless',
      last_name: 'Sender',
      email: 'sender@example.com',
      avatar: 'sender.png',
    } as NonNullable<Notification['sender']>;
    const idlessRelated = {
      id: '',
      first_name: 'Idless',
      last_name: 'Related',
      email: 'related@example.com',
      avatar: 'related.png',
    } as NonNullable<Notification['related_user']>;
    const { container, rerender } = render(
      <NotificationItem
        notification={notification({
          sender: idlessSender,
          related_user: idlessRelated,
          related_user_id: '',
          recipient_group: undefined,
          on_behalf_of_event: { id: 'event-1', title: '', image_url: null } as NonNullable<
            Notification['on_behalf_of_event']
          >,
        })}
        onNotificationClick={vi.fn()}
      />
    );
    expect(container.textContent).toContain('generated.inline.0119_entity_c7fb3177');
    expect(
      container.querySelector('[data-action-id="notifications.item.navigate.entity-name"]')
    ).toBeTruthy();

    rerender(
      <NotificationItem
        notification={notification({
          sender: undefined,
          related_user: undefined,
          related_user_id: null,
          recipient_group: undefined,
          on_behalf_of_event: {
            id: 'event-2',
            title: 'Hosted event',
            image_url: null,
          } as NonNullable<Notification['on_behalf_of_event']>,
        })}
        onNotificationClick={vi.fn()}
      />
    );
    expect(screen.getAllByText('Hosted event').length).toBeGreaterThan(0);
  });

  it.each([
    'membership_rejected',
    'event_deleted',
    'invite_approved',
    'task_completed',
    'vote_required',
    'task_overdue',
    'election_started',
    'neutral_notice',
  ])('maps the %s notification type to a semantic icon tone', type => {
    const { container } = render(
      <NotificationItem
        notification={notification({
          type: type as Notification['type'],
          sender: undefined,
          related_user: undefined,
          related_user_id: null,
          recipient_group: undefined,
          message: undefined,
          is_read: true,
        })}
        onNotificationClick={vi.fn()}
        showRecipientBadge={false}
      />
    );
    expect(container.querySelector('[data-slot="notification-card"]')).toBeTruthy();
  });

  it('toggles read state and handles linked pointer modifiers before normal navigation', () => {
    const onToggleRead = vi.fn();
    const onNotificationClick = vi.fn();
    const item = notification({
      is_read: true,
      tutorial_run_id: 'tutorial-1',
    } as Partial<Notification>);
    const { container } = render(
      <NotificationItem
        notification={item}
        onNotificationClick={onNotificationClick}
        onToggleRead={onToggleRead}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'features.notifications.item.markUnread' }));
    expect(onToggleRead).toHaveBeenCalledWith(item, expect.any(Object));

    const link = container.querySelector(
      '[data-action-id="notifications.item.open.linked"]'
    ) as HTMLAnchorElement;
    fireEvent.click(link, { ctrlKey: true });
    expect(onNotificationClick).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onNotificationClick).toHaveBeenCalledWith(item);
    expect(container.innerHTML).toContain('tutorial-membership-notification');
    expect(container.innerHTML).toContain('tutorial-notification-read');
  });

  it('uses the generic entity label when globally deleting an unscoped notification', () => {
    const item = notification({
      is_read: true,
      sender: undefined,
      related_user: undefined,
      related_user_id: null,
      recipient_group: undefined,
    });
    render(
      <NotificationItem
        notification={item}
        onNotificationClick={vi.fn()}
        onDeleteForEveryone={vi.fn()}
        canDeleteForEveryone
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'features.notifications.item.deleteForEveryone' })
    );
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'features.notifications.globalDelete.description'
    );
  });

  it('falls back to a translated linked label and marks unlinked tutorial cards', () => {
    const linked = notification({ title: null as unknown as string });
    const onNotificationClick = vi.fn();
    const { container, rerender } = render(
      <NotificationItem notification={linked} onNotificationClick={onNotificationClick} />
    );
    expect(
      container
        .querySelector('[data-action-id="notifications.item.open.linked"]')
        ?.getAttribute('aria-label')
    ).toContain('common.entities.notification');

    rerender(
      <NotificationItem
        notification={notification({
          tutorial_run_id: 'tutorial-2',
          recipient_group: undefined,
          sender: undefined,
          related_user: undefined,
          related_user_id: null,
        } as Partial<Notification>)}
        onNotificationClick={onNotificationClick}
      />
    );
    expect(
      container
        .querySelector('[data-action-id="notifications.item.open.unlinked"]')
        ?.getAttribute('data-tutorial-anchor')
    ).toBe('tutorial-membership-notification');
  });
});
