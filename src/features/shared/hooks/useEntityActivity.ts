import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';

import { queries } from '@/zero/queries';
import type { ActivitySeverityFilter } from '@/zero/activity/types';

export type ActivityEntityType = 'amendment' | 'group' | 'event';
const ACTIVE_STATUSES = new Set([
  'active',
  'accepted',
  'confirmed',
  'collaborator',
  'member',
  'admin',
]);
const GROUP_ACTIVITY_MANAGER_RESOURCES = new Set([
  'groups',
  'groupMemberships',
  'groupRoles',
  'groupAccessRoles',
  'groupRelationships',
]);
const PAGE_SIZE = 50;

export function canViewEntityActivity(
  type: ActivityEntityType,
  entity: any,
  userId: string | undefined | null
) {
  if (!entity || !userId) return false;
  if (type === 'amendment') {
    return (
      entity.created_by_id === userId ||
      entity.collaborators?.some(
        (item: any) => item.user_id === userId && ACTIVE_STATUSES.has(item.status)
      )
    );
  }
  if (type === 'group') {
    return (
      entity.owner_id === userId ||
      entity.memberships?.some(
        (item: any) => item.user_id === userId && ACTIVE_STATUSES.has(item.status)
      ) ||
      entity.guest_accesses?.some(
        (access: any) =>
          access.user_id === userId &&
          ACTIVE_STATUSES.has(access.status) &&
          access.guest_roles?.some((assignment: any) =>
            assignment.role?.action_rights?.some(
              (right: any) =>
                right.action === 'manage' && GROUP_ACTIVITY_MANAGER_RESOURCES.has(right.resource)
            )
          )
      )
    );
  }
  return (
    entity.creator_id === userId ||
    entity.participants?.some(
      (item: any) => item.user_id === userId && ACTIVE_STATUSES.has(item.status)
    )
  );
}

export function useEntityActivity(type: ActivityEntityType, entityId: string) {
  const [severity, setSeverity] = useState<ActivitySeverityFilter>('all');
  const [cursor, setCursor] = useState<{ id: string; created_at: number } | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    setSeverity('all');
    setCursor(null);
    setItems([]);
  }, [entityId, type]);

  useEffect(() => {
    setCursor(null);
    setItems([]);
  }, [severity]);

  const args = { entityId, severity, cursor, limit: PAGE_SIZE };
  const query =
    type === 'amendment'
      ? queries.amendments.activities(args)
      : type === 'group'
        ? queries.groups.activities(args)
        : queries.events.activities(args);
  const [page, result] = useQuery(query as any);

  useEffect(() => {
    if (result.type === 'unknown') return;
    const next = (page ?? []) as any[];
    setItems(previous => {
      if (!cursor) {
        const unchanged =
          previous.length === next.length &&
          previous.every((item, index) => item.id === next[index]?.id);
        return unchanged ? previous : next;
      }
      const seen = new Set(previous.map(item => item.id));
      const additions = next.filter(item => !seen.has(item.id));
      return additions.length > 0 ? [...previous, ...additions] : previous;
    });
  }, [cursor, page, result.type]);

  const hasMore = (page?.length ?? 0) === PAGE_SIZE;
  const loadMore = () => {
    const last = items.at(-1);
    if (last && hasMore) setCursor({ id: last.id, created_at: last.created_at });
  };

  return useMemo(
    () => ({
      activities: items,
      severity,
      setSeverity,
      isLoading: result.type === 'unknown',
      hasMore,
      loadMore,
    }),
    [hasMore, items, result.type, severity]
  );
}
