import { VIEW_IMPLYING_ACTIONS } from '@/zero/rbac/constants';

type RelationshipStatus = string | null | undefined;
type DiscoveryEntity = 'group' | 'event' | 'amendment' | 'blog';

interface ScopedActionRightAccess {
  resource?: string | null;
  action?: string | null;
  group_id?: string | null;
  event_id?: string | null;
  amendment_id?: string | null;
  blog_id?: string | null;
}

interface ScopedRoleAccess {
  scope?: string | null;
  group_id?: string | null;
  event_id?: string | null;
  amendment_id?: string | null;
  blog_id?: string | null;
  action_rights?: readonly ScopedActionRightAccess[] | null;
}

export interface EntityRelationshipAccess {
  status?: RelationshipStatus;
  role?: ScopedRoleAccess | null;
  roles?: readonly ScopedRoleAccess[] | null;
}

export type GroupRelationshipAccess = EntityRelationshipAccess;

const ACTIVE_GROUP_MEMBER_STATUSES = new Set(['active', 'member', 'admin']);
const ACTIVE_GROUP_GUEST_STATUSES = new Set(['active']);
const DISCOVERABLE_GROUP_MEMBER_STATUSES = new Set(['invited', ...ACTIVE_GROUP_MEMBER_STATUSES]);
const DISCOVERABLE_GROUP_GUEST_STATUSES = new Set(['invited', ...ACTIVE_GROUP_GUEST_STATUSES]);
const DISCOVERABLE_EVENT_PARTICIPANT_STATUSES = new Set([
  'invited',
  'active',
  'confirmed',
  'member',
  'admin',
]);
const DISCOVERABLE_AMENDMENT_COLLABORATOR_STATUSES = new Set([
  'invited',
  'active',
  'collaborator',
  'member',
  'admin',
]);
const DISCOVERABLE_BLOG_BLOGGER_STATUSES = new Set(['invited', 'admin', 'member', 'writer']);
const VIEW_ACTIONS = new Set<string>(VIEW_IMPLYING_ACTIONS);

const resourceByEntity: Record<DiscoveryEntity, string> = {
  group: 'groups',
  event: 'events',
  amendment: 'amendments',
  blog: 'blogs',
};

function scopedEntityId(
  value: ScopedRoleAccess | ScopedActionRightAccess,
  entityType: DiscoveryEntity
): string | null | undefined {
  return value[`${entityType}_id` as keyof typeof value] as string | null | undefined;
}

function relationshipRoles(relationship: EntityRelationshipAccess): readonly ScopedRoleAccess[] {
  return [...(relationship.role ? [relationship.role] : []), ...(relationship.roles ?? [])];
}

function hasEntityViewRight(
  relationship: EntityRelationshipAccess,
  entityType: DiscoveryEntity,
  entityId: string
): boolean {
  return relationshipRoles(relationship).some(
    role =>
      role.scope === entityType &&
      scopedEntityId(role, entityType) === entityId &&
      role.action_rights?.some(
        right =>
          scopedEntityId(right, entityType) === entityId &&
          right.resource === resourceByEntity[entityType] &&
          VIEW_ACTIONS.has(right.action ?? '')
      )
  );
}

function hasDiscoverableRelationship(
  relationships: readonly EntityRelationshipAccess[],
  statuses: ReadonlySet<string>,
  entityType: DiscoveryEntity,
  entityId: string
): boolean {
  return relationships.some(
    relationship =>
      relationship.status != null &&
      statuses.has(relationship.status) &&
      hasEntityViewRight(relationship, entityType, entityId)
  );
}

export function hasActiveGroupRelationshipAccess(
  ownerId: string | null | undefined,
  userId: string | null | undefined,
  membershipStatuses: readonly RelationshipStatus[],
  guestStatuses: readonly RelationshipStatus[] = []
): boolean {
  return Boolean(
    userId &&
    (ownerId === userId ||
      membershipStatuses.some(status =>
        status == null ? false : ACTIVE_GROUP_MEMBER_STATUSES.has(status)
      ) ||
      guestStatuses.some(status =>
        status == null ? false : ACTIVE_GROUP_GUEST_STATUSES.has(status)
      ))
  );
}

export function hasPrivateGroupRouteAccess(
  groupId: string,
  ownerId: string | null | undefined,
  userId: string | null | undefined,
  memberships: readonly GroupRelationshipAccess[],
  guestAccesses: readonly GroupRelationshipAccess[] = []
): boolean {
  if (!userId) return false;

  return (
    ownerId === userId ||
    hasDiscoverableRelationship(
      memberships,
      DISCOVERABLE_GROUP_MEMBER_STATUSES,
      'group',
      groupId
    ) ||
    hasDiscoverableRelationship(guestAccesses, DISCOVERABLE_GROUP_GUEST_STATUSES, 'group', groupId)
  );
}

export function hasPrivateAmendmentRouteAccess(
  amendmentId: string,
  createdById: string | null | undefined,
  userId: string | null | undefined,
  collaborators: readonly EntityRelationshipAccess[],
  hasActiveParentAccess = false
): boolean {
  if (!userId) return false;

  return (
    createdById === userId ||
    hasActiveParentAccess ||
    hasDiscoverableRelationship(
      collaborators,
      DISCOVERABLE_AMENDMENT_COLLABORATOR_STATUSES,
      'amendment',
      amendmentId
    )
  );
}

export function hasPrivateEventRouteAccess(
  eventId: string,
  creatorId: string | null | undefined,
  userId: string | null | undefined,
  participants: readonly EntityRelationshipAccess[],
  hasActiveParentAccess = false
): boolean {
  if (!userId) return false;

  return (
    creatorId === userId ||
    hasActiveParentAccess ||
    hasDiscoverableRelationship(
      participants,
      DISCOVERABLE_EVENT_PARTICIPANT_STATUSES,
      'event',
      eventId
    )
  );
}

export function hasPrivateBlogRouteAccess(
  blogId: string,
  userId: string | null | undefined,
  bloggers: readonly EntityRelationshipAccess[],
  hasActiveParentAccess = false
): boolean {
  if (!userId) return false;

  return (
    hasActiveParentAccess ||
    bloggers.some(blogger => blogger.status === 'owner') ||
    hasDiscoverableRelationship(bloggers, DISCOVERABLE_BLOG_BLOGGER_STATUSES, 'blog', blogId)
  );
}
