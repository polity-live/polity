'use client';

import type { NotificationEntityType } from '@/zero/notifications/useEntityNotificationCountRows';
import { useEntityNotificationsController } from '../hooks/useEntityNotificationsController';
import { EntityNotificationsView } from './EntityNotificationsView';

interface EntityNotificationsProps {
  entityId: string;
  entityType: NotificationEntityType;
  entityName: string;
}

export function EntityNotifications({
  entityId,
  entityType,
  entityName,
}: EntityNotificationsProps) {
  return (
    <EntityNotificationsView
      {...useEntityNotificationsController({
        entityId,
        entityType,
        entityName,
      })}
      entityId={entityId}
      entityType={entityType}
    />
  );
}
