import { useQuery } from '@rocicorp/zero/react';
import { useMemo } from 'react';

import { queries } from '../queries';
import type { NotificationCountProjectionRow } from './queries';

export type NotificationEntityType = 'group' | 'event' | 'amendment' | 'blog';

interface UseEntityNotificationCountRowsOptions {
  entityId: string;
  entityType: NotificationEntityType;
  query?: string;
  enabled?: boolean;
}

type EntityNotificationCountRow = NotificationCountProjectionRow;

interface EntityWithNotificationRows {
  recipient_notifications?: readonly EntityNotificationCountRow[] | null;
}

interface AccessRow extends EntityWithNotificationRows {
  group?: EntityWithNotificationRows | null;
  event?: EntityWithNotificationRows | null;
  amendment?: EntityWithNotificationRows | null;
  blog?: EntityWithNotificationRows | null;
}

interface CountQueryBranch {
  rows: readonly unknown[] | undefined;
  result: { readonly type: string };
}

function collectNotificationRows(rows: readonly unknown[] | undefined) {
  const notifications: EntityNotificationCountRow[] = [];

  for (const rawRow of rows ?? []) {
    const row = rawRow as AccessRow;
    notifications.push(...(row.recipient_notifications ?? []));

    for (const entity of [row.group, row.event, row.amendment, row.blog]) {
      notifications.push(...(entity?.recipient_notifications ?? []));
    }
  }

  return notifications;
}

/**
 * Loads the exact notification rows for one entity through selective access paths.
 * Multiple access paths can return the same notification, so rows are deduplicated
 * before consumers derive their reactive read/unread counters.
 */
export function useEntityNotificationCountRows({
  entityId,
  entityType,
  query = '',
  enabled = true,
}: UseEntityNotificationCountRowsOptions) {
  const shouldQuery = enabled && Boolean(entityId);
  const args = { entityId, query };

  const [groupOwnerRows, groupOwnerResult] = useQuery(
    shouldQuery && entityType === 'group'
      ? queries.notifications.countByGroupOwner(args)
      : undefined
  );
  const [groupMembershipRows, groupMembershipResult] = useQuery(
    shouldQuery && entityType === 'group'
      ? queries.notifications.countByGroupMembership(args)
      : undefined
  );
  const [groupGuestRows, groupGuestResult] = useQuery(
    shouldQuery && entityType === 'group'
      ? queries.notifications.countByGroupGuest(args)
      : undefined
  );
  const [eventParticipantRows, eventParticipantResult] = useQuery(
    shouldQuery && entityType === 'event'
      ? queries.notifications.countByEventParticipant(args)
      : undefined
  );
  const [amendmentCreatorRows, amendmentCreatorResult] = useQuery(
    shouldQuery && entityType === 'amendment'
      ? queries.notifications.countByAmendmentCreator(args)
      : undefined
  );
  const [amendmentCollaboratorRows, amendmentCollaboratorResult] = useQuery(
    shouldQuery && entityType === 'amendment'
      ? queries.notifications.countByAmendmentCollaborator(args)
      : undefined
  );
  const [blogBloggerRows, blogBloggerResult] = useQuery(
    shouldQuery && entityType === 'blog'
      ? queries.notifications.countByBlogBlogger(args)
      : undefined
  );

  const relevantBranches: readonly CountQueryBranch[] =
    entityType === 'group'
      ? [
          { rows: groupOwnerRows, result: groupOwnerResult },
          { rows: groupMembershipRows, result: groupMembershipResult },
          { rows: groupGuestRows, result: groupGuestResult },
        ]
      : entityType === 'event'
        ? [{ rows: eventParticipantRows, result: eventParticipantResult }]
        : entityType === 'amendment'
          ? [
              { rows: amendmentCreatorRows, result: amendmentCreatorResult },
              { rows: amendmentCollaboratorRows, result: amendmentCollaboratorResult },
            ]
          : [{ rows: blogBloggerRows, result: blogBloggerResult }];

  return useMemo(() => {
    if (!shouldQuery) return { rows: [] as EntityNotificationCountRow[], isLoading: false };

    const byId = new Map<string, EntityNotificationCountRow>();
    for (const branch of relevantBranches) {
      for (const notification of collectNotificationRows(branch.rows)) {
        byId.set(notification.id, notification);
      }
    }

    return {
      rows: [...byId.values()],
      isLoading: relevantBranches.some(branch => branch.result.type === 'unknown'),
    };
  }, [relevantBranches, shouldQuery]);
}
