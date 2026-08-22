import type { Notification } from '../types/notification.types';
import type { ActionRight, Amendment, PermissionEvaluator, Role } from '@/zero/rbac';

type EntityType = 'group' | 'event' | 'amendment' | 'blog';

function mapActionRights(raw: readonly any[] | null | undefined): ActionRight[] {
  return (raw ?? []).map(right => ({
    id: String(right.id ?? ''),
    resource: right.resource,
    action: right.action,
    group: right.group_id ? { id: String(right.group_id) } : undefined,
    event: right.event_id ? { id: String(right.event_id) } : undefined,
    amendment: right.amendment_id ? { id: String(right.amendment_id) } : undefined,
    blog: right.blog_id ? { id: String(right.blog_id) } : undefined,
  }));
}

function mapRole(
  raw: any,
  fallbackScope: Role['scope'],
  fallbackScopeId: string
): Role | undefined {
  if (!raw?.id) return undefined;
  const scope = raw.scope ?? fallbackScope;
  return {
    id: raw.id,
    name: raw.name ?? '',
    description: raw.description ?? undefined,
    scope,
    group: scope === 'group' ? { id: String(raw.group_id ?? fallbackScopeId) } : undefined,
    event: scope === 'event' ? { id: String(raw.event_id ?? fallbackScopeId) } : undefined,
    amendment:
      scope === 'amendment' ? { id: String(raw.amendment_id ?? fallbackScopeId) } : undefined,
    blog: scope === 'blog' ? { id: String(raw.blog_id ?? fallbackScopeId) } : undefined,
    actionRights: mapActionRights(raw.action_rights),
  };
}

function mapAmendment(notification: Notification): Amendment | undefined {
  const amendment: any = notification.recipient_amendment;
  if (!amendment || amendment.id !== notification.recipient_entity_id) return undefined;

  return {
    id: amendment.id,
    owner: amendment.created_by_id ? { id: amendment.created_by_id } : undefined,
    user: amendment.created_by_id ? { id: amendment.created_by_id } : undefined,
    group: amendment.group_id ? { id: amendment.group_id } : undefined,
    amendmentRoleCollaborators: (amendment.collaborators ?? []).map((collaborator: any) => ({
      id: collaborator.id,
      user: collaborator.user_id ? { id: collaborator.user_id } : undefined,
      status: collaborator.status ?? undefined,
      role: mapRole(collaborator.role, 'amendment', amendment.id),
    })),
  };
}

function getCanonicalEntityTarget(notification: Notification) {
  if (notification.recipient_id || !notification.recipient_entity_id) return null;

  const entityType = notification.recipient_entity_type as EntityType | null | undefined;
  if (!entityType || !['group', 'event', 'amendment', 'blog'].includes(entityType)) return null;

  const typedTargets = [
    ['group', notification.recipient_group_id],
    ['event', notification.recipient_event_id],
    ['amendment', notification.recipient_amendment_id],
    ['blog', notification.recipient_blog_id],
  ].filter((entry): entry is [EntityType, string] => typeof entry[1] === 'string');

  if (typedTargets.length !== 1) return null;
  const [typedEntityType, typedEntityId] = typedTargets[0];
  if (typedEntityType !== entityType || typedEntityId !== notification.recipient_entity_id) {
    return null;
  }

  return { entityType, entityId: typedEntityId };
}

/** UI capability only. The mutator repeats the authoritative server check. */
export function canManageEntityNotification(
  notification: Notification,
  evaluator: PermissionEvaluator
): boolean {
  if (evaluator.isLoading || !evaluator.userId) return false;
  const target = getCanonicalEntityTarget(notification);
  if (!target) return false;

  switch (target.entityType) {
    case 'group':
      return evaluator.can(
        { groupId: target.entityId },
        'manageNotifications',
        'groupNotifications'
      );
    case 'event':
      return evaluator.can({ eventId: target.entityId }, 'manageNotifications', 'notifications');
    case 'blog':
      return evaluator.can({ blogId: target.entityId }, 'manageNotifications', 'notifications');
    case 'amendment': {
      const amendment = mapAmendment(notification);
      return amendment
        ? evaluator.can({ amendment }, 'manageNotifications', 'notifications')
        : false;
    }
  }
}
