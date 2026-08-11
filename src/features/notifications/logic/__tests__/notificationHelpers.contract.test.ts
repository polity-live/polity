import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import type { Notification } from '../../types/notification.types';
import {
  filterAccessibleNotifications,
  formatTime,
  getDisplayName,
  getNotificationNavigationHref,
  getNotificationNavigationTarget,
  isNotificationRead,
} from '../notificationHelpers';

function notification(overrides: Record<string, unknown> = {}): Notification {
  return {
    id: 'notification',
    type: 'membership_request',
    is_read: false,
    action_url: null,
    recipient_id: null,
    related_user_id: null,
    related_entity_type: null,
    ...overrides,
  } as unknown as Notification;
}

describe('notification navigation contracts', () => {
  it('builds display names from names, email, and absent users', () => {
    expect(getDisplayName(null)).toBe('Unknown');
    expect(getDisplayName({ first_name: 'Ada', last_name: 'Lovelace' })).toBe('Ada Lovelace');
    expect(getDisplayName({ first_name: null, last_name: null, email: 'ada@example.test' })).toBe(
      'ada@example.test'
    );
    expect(getDisplayName({})).toBe('Unknown');
  });

  it('preserves every supported messages query parameter in the href', () => {
    const href = getNotificationNavigationHref(
      notification({
        type: 'direct_message',
        action_url:
          '/messages?conversationId=conversation&name=Ada&new=1&openAriaKai=yes&search=hello&userId=user&userSearch=lovelace',
      })
    );

    expect(href).toBe(
      '/messages?conversationId=conversation&name=Ada&new=1&openAriaKai=yes&search=hello&userId=user&userSearch=lovelace'
    );
  });

  it('decodes path-based conversations and ignores empty message URLs', () => {
    expect(
      getNotificationNavigationHref(
        notification({ type: 'direct_message', action_url: '/messages?conversationId=only' })
      )
    ).toBe('/messages?conversationId=only');
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'direct_message', action_url: '/messages/team%20room' })
      )
    ).toEqual({ kind: 'messages', search: { conversationId: 'team room' } });
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'membership_request', action_url: '/messages/' })
      )
    ).toEqual({ kind: 'route', to: '/messages/' });
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'membership_request', action_url: '/messages?name=' })
      )
    ).toEqual({ kind: 'route', to: '/messages?name=' });
  });

  it('falls back from malformed and non-message action URLs to routes', () => {
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'membership_request', action_url: 'http://[' })
      )
    ).toEqual({ kind: 'route', to: 'http://[' });
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'membership_request', action_url: '/group/group-1' })
      )
    ).toEqual({ kind: 'route', to: '/group/group-1' });
    expect(
      getNotificationNavigationHref(
        notification({ type: 'membership_request', action_url: '/group/group-1' })
      )
    ).toBe('/group/group-1');
  });

  it.each(['direct_message', 'conversation_request', 'conversation_accepted'] as const)(
    'builds a sender-based message target for %s without an action URL',
    type => {
      expect(
        getNotificationNavigationTarget(
          notification({
            type,
            related_user_id: 'sender-id',
            sender: { first_name: 'Message', last_name: 'Sender' },
          })
        )
      ).toEqual({
        kind: 'messages',
        search: { userId: 'sender-id', name: 'Message Sender' },
      });
    }
  );

  it('uses the related user for message names and rejects incomplete targets', () => {
    expect(
      getNotificationNavigationTarget(
        notification({
          type: 'direct_message',
          related_user_id: 'related-id',
          sender: null,
          related_user: { email: 'related@example.test' },
        })
      )
    ).toEqual({
      kind: 'messages',
      search: { userId: 'related-id', name: 'related@example.test' },
    });
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'direct_message', related_user_id: null })
      )
    ).toBeNull();
    expect(
      getNotificationNavigationTarget(notification({ type: null, recipient_id: 'recipient-id' }))
    ).toBeNull();
    expect(
      getNotificationNavigationTarget(
        notification({ type: 'membership_invite', recipient_id: null })
      )
    ).toBeNull();
  });

  it.each([
    ['group', { related_group: { id: 'group-1' } }, '/group/group-1'],
    ['event', { related_event: { id: 'event-1' } }, '/event/event-1'],
    ['user', { related_user: { id: 'user-1' } }, '/user/user-1'],
    ['message', {}, '/messages'],
    ['amendment', { related_amendment: { id: 'amendment-1' } }, '/amendment/amendment-1'],
  ] as const)('derives a %s entity href', (relatedEntityType, relations, expected) => {
    expect(
      getNotificationNavigationHref(
        notification({ related_entity_type: relatedEntityType, ...relations })
      )
    ).toBe(expected);
  });

  it('derives each blog ownership route in priority order', () => {
    const base = {
      related_entity_type: 'blog',
      related_blog: { id: 'blog-1' },
    };
    expect(
      getNotificationNavigationHref(
        notification({ ...base, on_behalf_of_group: { id: 'group-1' } })
      )
    ).toBe('/group/group-1/blog/blog-1');
    expect(
      getNotificationNavigationHref(notification({ ...base, related_user: { id: 'user-1' } }))
    ).toBe('/user/user-1/blog/blog-1');
    expect(
      getNotificationNavigationHref(notification({ ...base, sender: { id: 'sender-1' } }))
    ).toBe('/user/sender-1/blog/blog-1');
    expect(getNotificationNavigationHref(notification(base))).toBeNull();
    expect(
      getNotificationNavigationHref(
        notification({ related_entity_type: 'blog', related_blog: null })
      )
    ).toBeNull();
  });

  it('returns null for missing entity relations, unknown entities, and no fallback', () => {
    for (const type of ['group', 'event', 'user', 'amendment', 'unknown']) {
      expect(getNotificationNavigationHref(notification({ related_entity_type: type }))).toBeNull();
    }
    expect(
      getNotificationNavigationHref(
        notification({ related_entity_type: null, related_user_id: 'user-fallback' })
      )
    ).toBe('/user/user-fallback');
    expect(getNotificationNavigationHref(notification())).toBeNull();
  });

  it('delegates personal and entity read-state semantics', () => {
    expect(isNotificationRead(notification({ is_read: true }))).toBe(true);
    expect(
      isNotificationRead(
        notification({ recipient_entity_type: 'group', is_read: false, reads: [{}] })
      )
    ).toBe(true);
  });
});

describe('notification accessibility contracts', () => {
  const right = (resource: string, action: string) => ({ resource, action });
  const entityNotification = (relations: Record<string, unknown>) =>
    notification({ id: JSON.stringify(relations), ...relations });

  it('requires a current user and keeps direct personal notifications', () => {
    const personal = entityNotification({ recipient: { id: 'user-1' } });
    expect(filterAccessibleNotifications([personal], undefined)).toEqual([]);
    expect(filterAccessibleNotifications([personal], 'user-1')).toEqual([personal]);
    expect(filterAccessibleNotifications([personal], 'user-2')).toEqual([]);
  });

  it('supports direct roles with view and manage group-notification rights', () => {
    const view = entityNotification({
      recipient_group: {
        memberships: [
          { roles: [{ action_rights: [right('groupNotifications', 'viewNotifications')] }] },
        ],
      },
    });
    const manage = entityNotification({
      recipient_group: {
        memberships: [
          { roles: [{ action_rights: [right('groupNotifications', 'manageNotifications')] }] },
        ],
      },
    });
    const wrong = entityNotification({
      recipient_group: {
        memberships: [{ roles: [{ action_rights: [right('groups', 'viewNotifications')] }] }],
      },
    });

    expect(filterAccessibleNotifications([view, manage, wrong], 'user-1')).toEqual([view, manage]);
  });

  it('supports membership-role, participant-role, and singular-role shapes', () => {
    const membership = entityNotification({
      recipient_group: {
        memberships: [
          {
            membership_roles: [
              { role: null },
              { role: { action_rights: [right('groupNotifications', 'viewNotifications')] } },
            ],
          },
        ],
      },
    });
    const participant = entityNotification({
      recipient_event: {
        participants: [
          {
            participant_roles: [
              { role: null },
              { role: { action_rights: [right('notifications', 'manageNotifications')] } },
            ],
          },
        ],
      },
    });
    const singular = entityNotification({
      recipient_blog: {
        bloggers: [{ role: { action_rights: [right('notifications', 'viewNotifications')] } }],
      },
    });

    expect(filterAccessibleNotifications([membership, participant, singular], 'user-1')).toEqual([
      membership,
      participant,
      singular,
    ]);
  });

  it('rejects empty, missing, and non-matching role shapes', () => {
    const candidates = [
      entityNotification({ recipient_group: { memberships: [] } }),
      entityNotification({ recipient_event: { participants: [{ roles: [] }] } }),
      entityNotification({ recipient_blog: { bloggers: [{ role: null }] } }),
      entityNotification({
        recipient_blog: { bloggers: [{ role: { action_rights: undefined } }] },
      }),
    ];
    expect(filterAccessibleNotifications(candidates, 'user-1')).toEqual([]);
  });

  it('matches amendment collaborators by direct, nested, and anonymous user IDs', () => {
    const direct = entityNotification({
      recipient_amendment: { collaborators: [{ user_id: 'user-1', status: 'active' }] },
    });
    const nested = entityNotification({
      recipient_amendment: {
        collaborators: [{ user_id: null, user: { id: 'user-1' }, status: 'member' }],
      },
    });
    const anonymous = entityNotification({
      recipient_amendment: { collaborators: [{ user_id: null, user: null, status: 'admin' }] },
    });
    const wrongUser = entityNotification({
      recipient_amendment: { collaborators: [{ user_id: 'user-2', status: 'active' }] },
    });
    const wrongStatus = entityNotification({
      recipient_amendment: { collaborators: [{ user_id: 'user-1', status: null }] },
    });
    const noCollaborators = entityNotification({
      recipient_amendment: { collaborators: null },
    });

    expect(
      filterAccessibleNotifications(
        [direct, nested, anonymous, wrongUser, wrongStatus, noCollaborators],
        'user-1'
      )
    ).toEqual([direct, nested, anonymous]);
  });
});

describe('notification time formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-08T12:00:00.000Z'));
    useLanguageStore.setState({ language: 'en' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats future, minute, hour, day, and old timestamps', () => {
    expect(formatTime('2026-01-08T12:01:00.000Z')).toBe('Just now');
    expect(formatTime('2026-01-08T12:00:00.000Z')).toBe('Just now');
    expect(formatTime('2026-01-08T11:30:00.000Z')).toBe('30 minutes ago');
    expect(formatTime('2026-01-08T10:00:00.000Z')).toBe('2 hours ago');
    expect(formatTime('2026-01-06T12:00:00.000Z')).toBe('2 days ago');
    expect(formatTime('2026-01-01T12:00:00.000Z')).toContain('Jan');

    useLanguageStore.setState({ language: 'de' });
    expect(formatTime('2026-01-01T12:00:00.000Z')).toContain('Jan');
  });
});
