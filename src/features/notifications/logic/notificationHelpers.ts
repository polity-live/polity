import type { Notification } from '../types/notification.types';

export interface MessageNavigationSearch {
  conversationId?: string;
  name?: string;
  new?: string;
  openAriaKai?: string;
  search?: string;
  userId?: string;
  userSearch?: string;
}

export type NotificationNavigationTarget =
  | { kind: 'messages'; search: MessageNavigationSearch }
  | { kind: 'route'; to: string };

function buildMessagesHref(search: MessageNavigationSearch): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/messages?${query}` : '/messages';
}

/**
 * Constructs a display name from a user's first/last name fields.
 */
export function getDisplayName(
  user:
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | undefined
    | null
): string {
  if (!user) return 'Unknown';
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.email ?? 'Unknown')
  );
}

function getSearchParamValue(searchParams: URLSearchParams, key: keyof MessageNavigationSearch) {
  const value = searchParams.get(key);
  return value && value.length > 0 ? value : undefined;
}

function getMessagesNavigationSearchFromActionUrl(
  actionUrl: string
): MessageNavigationSearch | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(actionUrl, 'https://polity.local');
  } catch {
    return null;
  }

  if (parsedUrl.pathname === '/messages') {
    const search: MessageNavigationSearch = {
      conversationId: getSearchParamValue(parsedUrl.searchParams, 'conversationId'),
      name: getSearchParamValue(parsedUrl.searchParams, 'name'),
      new: getSearchParamValue(parsedUrl.searchParams, 'new'),
      openAriaKai: getSearchParamValue(parsedUrl.searchParams, 'openAriaKai'),
      search: getSearchParamValue(parsedUrl.searchParams, 'search'),
      userId: getSearchParamValue(parsedUrl.searchParams, 'userId'),
      userSearch: getSearchParamValue(parsedUrl.searchParams, 'userSearch'),
    };

    return Object.values(search).some(Boolean) ? search : null;
  }

  if (parsedUrl.pathname.startsWith('/messages/')) {
    const conversationId = parsedUrl.pathname.slice('/messages/'.length);
    return conversationId.length > 0
      ? { conversationId: decodeURIComponent(conversationId) }
      : null;
  }

  return null;
}

function isMessageNotification(notification: Notification) {
  return (
    notification.type === 'direct_message' ||
    notification.type === 'conversation_request' ||
    notification.type === 'conversation_accepted'
  );
}

export function getNotificationNavigationTarget(
  notification: Notification
): NotificationNavigationTarget | null {
  if (notification.action_url) {
    const messagesSearch = getMessagesNavigationSearchFromActionUrl(notification.action_url);

    if (messagesSearch) {
      return {
        kind: 'messages',
        search: messagesSearch,
      };
    }
  }

  if (
    (notification.type === 'event_invite' || notification.type === 'participation_invite') &&
    notification.recipient_id
  ) {
    return {
      kind: 'route',
      to: `/user/${notification.recipient_id}/memberships`,
    };
  }

  if (isMessageNotification(notification) && notification.related_user_id) {
    return {
      kind: 'messages',
      search: {
        userId: notification.related_user_id,
        name: getDisplayName(notification.sender ?? notification.related_user),
      },
    };
  }

  if (notification.action_url) {
    return {
      kind: 'route',
      to: notification.action_url,
    };
  }

  return null;
}

export function getNotificationNavigationHref(notification: Notification): string | null {
  const navigationTarget = getNotificationNavigationTarget(notification);

  if (navigationTarget?.kind === 'messages') {
    return buildMessagesHref(navigationTarget.search);
  }

  if (navigationTarget?.kind === 'route') {
    return navigationTarget.to;
  }

  if (notification.related_entity_type) {
    switch (notification.related_entity_type) {
      case 'group':
        return notification.related_group?.id ? `/group/${notification.related_group.id}` : null;
      case 'event':
        return notification.related_event?.id ? `/event/${notification.related_event.id}` : null;
      case 'user':
        return notification.related_user?.id ? `/user/${notification.related_user.id}` : null;
      case 'message':
        return '/messages';
      case 'blog':
        if (!notification.related_blog?.id) {
          return null;
        }

        if (notification.on_behalf_of_group?.id) {
          return `/group/${notification.on_behalf_of_group.id}/blog/${notification.related_blog.id}`;
        }

        if (notification.related_user?.id) {
          return `/user/${notification.related_user.id}/blog/${notification.related_blog.id}`;
        }

        if (notification.sender?.id) {
          return `/user/${notification.sender.id}/blog/${notification.related_blog.id}`;
        }

        return null;
      case 'amendment':
        return notification.related_amendment?.id
          ? `/amendment/${notification.related_amendment.id}`
          : null;
      default:
        return null;
    }
  }

  if (notification.related_user_id) {
    return `/user/${notification.related_user_id}`;
  }

  return null;
}

/**
 * Filter notifications to only those the user has access to,
 * based on personal recipient or entity RBAC rights.
 * Shared between useNotificationFilters and useUnreadNotificationsCount.
 */
export function filterAccessibleNotifications(
  notifications: Notification[],
  userId?: string
): Notification[] {
  if (!userId) return [];

  const hasAnyRight = (
    actor:
      | {
          role?: {
            action_rights?: readonly { action?: string | null; resource?: string | null }[] | null;
          } | null;
          roles?:
            | readonly {
                action_rights?:
                  | readonly { action?: string | null; resource?: string | null }[]
                  | null;
              }[]
            | null;
          membership_roles?:
            | readonly {
                role?: {
                  action_rights?:
                    | readonly { action?: string | null; resource?: string | null }[]
                    | null;
                } | null;
              }[]
            | null;
          participant_roles?:
            | readonly {
                role?: {
                  action_rights?:
                    | readonly { action?: string | null; resource?: string | null }[]
                    | null;
                } | null;
              }[]
            | null;
        }
      | null
      | undefined,
    matcher: (right: { action?: string | null; resource?: string | null }) => boolean
  ) => {
    const roleCandidates = actor?.roles?.length
      ? actor.roles
      : actor?.membership_roles?.length
        ? actor.membership_roles.flatMap(link => (link.role ? [link.role] : []))
        : actor?.participant_roles?.length
          ? actor.participant_roles.flatMap(link => (link.role ? [link.role] : []))
          : actor?.role
            ? [actor.role]
            : [];

    return roleCandidates.some(role => role.action_rights?.some(right => matcher(right)));
  };

  const hasNotificationRight = (
    actor:
      | {
          role?: {
            action_rights?: readonly { action?: string | null; resource?: string | null }[] | null;
          } | null;
          roles?:
            | readonly {
                action_rights?:
                  | readonly { action?: string | null; resource?: string | null }[]
                  | null;
              }[]
            | null;
          membership_roles?:
            | readonly {
                role?: {
                  action_rights?:
                    | readonly { action?: string | null; resource?: string | null }[]
                    | null;
                } | null;
              }[]
            | null;
          participant_roles?:
            | readonly {
                role?: {
                  action_rights?:
                    | readonly { action?: string | null; resource?: string | null }[]
                    | null;
                } | null;
              }[]
            | null;
        }
      | null
      | undefined,
    resource: 'groupNotifications' | 'notifications'
  ) =>
    hasAnyRight(
      actor,
      right =>
        right.resource === resource &&
        (right.action === 'viewNotifications' || right.action === 'manageNotifications')
    );

  return notifications.filter(n => {
    // Personal notifications
    if (n.recipient?.id === userId) return true;

    // Entity notifications where the user currently has notification access rights
    if (n.recipient_group?.memberships && n.recipient_group.memberships.length > 0) {
      return hasNotificationRight(n.recipient_group.memberships[0], 'groupNotifications');
    }

    if (n.recipient_event?.participants && n.recipient_event.participants.length > 0) {
      return hasNotificationRight(n.recipient_event.participants[0], 'notifications');
    }

    if (n.recipient_amendment?.collaborators && n.recipient_amendment.collaborators.length > 0) {
      return hasNotificationRight(n.recipient_amendment.collaborators[0], 'notifications');
    }

    if (n.recipient_blog?.bloggers && n.recipient_blog.bloggers.length > 0) {
      return hasNotificationRight(n.recipient_blog.bloggers[0], 'notifications');
    }

    return false;
  });
}

export function formatTime(date: string | number): string {
  const now = new Date();
  const notifDate = new Date(date);
  const diffInHours = (now.getTime() - notifDate.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else if (diffInHours < 168) {
    // 7 days
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  } else {
    return notifDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
