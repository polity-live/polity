import { useQuery } from '@rocicorp/zero/react';
import { useMemo } from 'react';
import { queries } from '../queries';

interface ReadableNotification {
  is_read: boolean;
  recipient_entity_type?: string | null;
  reads?: readonly unknown[] | null;
}

function applyEntityReadState<T extends ReadableNotification>(
  notifications: readonly T[] | undefined | null
) {
  return (notifications ?? []).map(notification =>
    notification.recipient_entity_type
      ? {
          ...notification,
          is_read: (notification.reads?.length ?? 0) > 0,
        }
      : notification
  );
}

/**
 * Reactive state hook for notification data.
 * Returns query-derived state — no mutations.
 *
 * Options:
 * - entityFilter: filter notifications by entity
 * - includeRelations: load notifications with all related entities
 * - includeUserNotifications: load cross-domain memberships + group notifications,
 *   combine with personal notifications, and deduplicate
 */
export function useNotificationState(options?: {
  entityFilter?: { entityId: string; entityType: string };
  entityId?: string;
  includeRelations?: boolean;
  includeUserNotifications?: boolean;
}) {
  const includeRelations = options?.includeRelations ?? false;
  const includeUserNotifications = options?.includeUserNotifications ?? false;

  // ── Basic notifications ────────────────────────────────────────────
  const [notifications, notificationsResult] = useQuery(queries.notifications.byUser({}));

  const [unread, unreadResult] = useQuery(queries.notifications.unreadCount({}));

  const [settings, settingsResult] = useQuery(queries.notifications.settings({}));

  const [pushSubscriptions, pushSubscriptionsResult] = useQuery(
    queries.notifications.pushSubscriptions({})
  );

  const [entityNotifications, entityNotificationsResult] = useQuery(
    queries.notifications.byEntity({
      entityId: options?.entityFilter?.entityId ?? '',
      entityType: options?.entityFilter?.entityType ?? '',
    })
  );

  // ── By entity ID only (no type needed) ─────────────────────────────
  const [entityByIdNotifications, entityByIdResult] = useQuery(
    options?.entityId
      ? queries.notifications.byEntityId({ entity_id: options.entityId })
      : undefined
  );

  // ── Rich notifications with relations (opt-in) ────────────────────
  const [notificationsWithRelations, notificationsWithRelationsResult] = useQuery(
    includeRelations || includeUserNotifications
      ? queries.notifications.byUserWithRelations({})
      : undefined
  );

  // ── Cross-domain membership queries (opt-in) ──────────────────────
  const [groupMemberships] = useQuery(
    includeUserNotifications ? queries.notifications.userGroupMemberships({}) : undefined
  );

  const [eventParticipations] = useQuery(
    includeUserNotifications ? queries.notifications.userEventParticipations({}) : undefined
  );

  const [amendmentCollaborations] = useQuery(
    includeUserNotifications ? queries.notifications.userAmendmentCollaborations({}) : undefined
  );

  const [blogRelations] = useQuery(
    includeUserNotifications ? queries.notifications.userBlogRelations({}) : undefined
  );

  // Compute entity IDs from memberships
  const entityIds = useMemo(() => {
    if (!includeUserNotifications) return null;
    return {
      groupIds: (groupMemberships ?? []).map(m => m.group?.id).filter(Boolean) as string[],
      eventIds: (eventParticipations ?? []).map(p => p.event?.id).filter(Boolean) as string[],
      amendmentIds: (amendmentCollaborations ?? [])
        .map(c => c.amendment?.id)
        .filter(Boolean) as string[],
      blogIds: (blogRelations ?? []).map(b => b.blog?.id).filter(Boolean) as string[],
    };
  }, [
    includeUserNotifications,
    groupMemberships,
    eventParticipations,
    amendmentCollaborations,
    blogRelations,
  ]);

  // ── Group notifications (opt-in, depends on entityIds) ─────────────
  const [groupNotifications, groupNotificationsResult] = useQuery(
    includeUserNotifications && entityIds && entityIds.groupIds.length > 0
      ? queries.notifications.byRecipientGroups({ groupIds: entityIds.groupIds })
      : undefined
  );

  const [eventNotifications, eventNotificationsResult] = useQuery(
    includeUserNotifications && entityIds && entityIds.eventIds.length > 0
      ? queries.notifications.byRecipientEvents({ eventIds: entityIds.eventIds })
      : undefined
  );

  const [amendmentNotifications, amendmentNotificationsResult] = useQuery(
    includeUserNotifications && entityIds && entityIds.amendmentIds.length > 0
      ? queries.notifications.byRecipientAmendments({ amendmentIds: entityIds.amendmentIds })
      : undefined
  );

  const [blogNotifications, blogNotificationsResult] = useQuery(
    includeUserNotifications && entityIds && entityIds.blogIds.length > 0
      ? queries.notifications.byRecipientBlogs({ blogIds: entityIds.blogIds })
      : undefined
  );

  const normalizedEntityNotifications = useMemo(
    () => applyEntityReadState(entityNotifications),
    [entityNotifications]
  );

  const normalizedNotificationsWithRelations = useMemo(
    () => applyEntityReadState(notificationsWithRelations),
    [notificationsWithRelations]
  );

  const normalizedGroupNotifications = useMemo(
    () => applyEntityReadState(groupNotifications),
    [groupNotifications]
  );

  const normalizedEventNotifications = useMemo(
    () => applyEntityReadState(eventNotifications),
    [eventNotifications]
  );

  const normalizedAmendmentNotifications = useMemo(
    () => applyEntityReadState(amendmentNotifications),
    [amendmentNotifications]
  );

  const normalizedBlogNotifications = useMemo(
    () => applyEntityReadState(blogNotifications),
    [blogNotifications]
  );

  // Combined user notifications (personal + entity, deduplicated)
  const userNotifications = useMemo(() => {
    if (!includeUserNotifications) return [];
    const all = [
      ...normalizedNotificationsWithRelations,
      ...normalizedGroupNotifications,
      ...normalizedEventNotifications,
      ...normalizedAmendmentNotifications,
      ...normalizedBlogNotifications,
    ];
    const seen = new Set<string>();
    return all
      .filter(n => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      })
      .sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0));
  }, [
    includeUserNotifications,
    normalizedAmendmentNotifications,
    normalizedBlogNotifications,
    normalizedEventNotifications,
    normalizedGroupNotifications,
    normalizedNotificationsWithRelations,
  ]);

  const isLoading =
    notificationsResult.type === 'unknown' ||
    unreadResult.type === 'unknown' ||
    settingsResult.type === 'unknown' ||
    pushSubscriptionsResult.type === 'unknown' ||
    entityNotificationsResult.type === 'unknown' ||
    ((includeRelations || includeUserNotifications) &&
      notificationsWithRelationsResult.type === 'unknown') ||
    (includeUserNotifications &&
      entityIds?.groupIds.length &&
      groupNotificationsResult.type === 'unknown') ||
    (includeUserNotifications &&
      entityIds?.eventIds.length &&
      eventNotificationsResult.type === 'unknown') ||
    (includeUserNotifications &&
      entityIds?.amendmentIds.length &&
      amendmentNotificationsResult.type === 'unknown') ||
    (includeUserNotifications &&
      entityIds?.blogIds.length &&
      blogNotificationsResult.type === 'unknown') ||
    (options?.entityId !== undefined && entityByIdResult.type === 'unknown');

  return {
    notifications,
    unread,
    settings,
    pushSubscriptions,
    entityNotifications: normalizedEntityNotifications,
    entityByIdNotifications: entityByIdNotifications ?? [],
    notificationsWithRelations: normalizedNotificationsWithRelations,
    userNotifications,
    groupNotifications: normalizedGroupNotifications,
    eventNotifications: normalizedEventNotifications,
    amendmentNotifications: normalizedAmendmentNotifications,
    blogNotifications: normalizedBlogNotifications,
    entityIds,
    isLoading,
  };
}
