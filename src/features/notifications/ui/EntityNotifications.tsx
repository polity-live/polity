'use client';

import type { EntityType } from '@/features/notifications/utils/notification-helpers.ts';
import { useEntityNotificationsController } from '../hooks/useEntityNotificationsController';
import { EntityNotificationsView } from './EntityNotificationsView';

interface EntityNotificationsProps {
  entityId: string;
  entityType: EntityType;
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
    />
  );
}
