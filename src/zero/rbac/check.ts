/**
 * Core Permission Checker
 *
 * Pure function that evaluates permissions against loaded permission data.
 * Used by both:
 *   - usePermissions (React hook, client-side)
 *   - can() (server-side, inside mutators)
 *
 * This is the SINGLE SOURCE OF TRUTH for permission evaluation logic.
 */

import { PERMISSION_IMPLIES } from './constants';
import type {
  ResourceType,
  ActionType,
  Membership,
  GuestAccess,
  Participation,
  BloggerRelation,
  Amendment,
} from './types';

// ============================================================================
// Types
// ============================================================================

/** All permission data needed to evaluate permission checks. */
export interface PermissionData {
  userId: string;
  memberships?: Membership[];
  guestAccesses?: GuestAccess[];
  participations?: Participation[];
  bloggerRelations?: BloggerRelation[];
  amendment?: Amendment;
  ownedGroupIds?: string[];
}

/** Identifies the scope a permission check targets. */
export interface PermissionScope {
  groupId?: string;
  eventId?: string;
  blogId?: string;
  amendment?: Amendment;
}

const ACTIVE_GROUP_MEMBERSHIP_STATUSES = new Set(['active', 'member', 'admin']);
const ACTIVE_GROUP_GUEST_ACCESS_STATUSES = new Set(['active']);
const ACTIVE_EVENT_PARTICIPANT_STATUSES = new Set(['active', 'confirmed', 'member', 'admin']);
const DISCOVERY_EVENT_PARTICIPANT_STATUSES = new Set([
  'invited',
  ...ACTIVE_EVENT_PARTICIPANT_STATUSES,
]);
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = new Set([
  'active',
  'collaborator',
  'member',
  'admin',
]);
const DISCOVERY_AMENDMENT_COLLABORATOR_STATUSES = new Set([
  'invited',
  ...ACTIVE_AMENDMENT_COLLABORATOR_STATUSES,
]);
const ACTIVE_BLOGGER_STATUSES = new Set(['owner', 'admin', 'member', 'writer']);
const DISCOVERY_BLOGGER_STATUSES = new Set(['invited', ...ACTIVE_BLOGGER_STATUSES]);

function hasActiveStatus(
  status: string | null | undefined,
  activeStatuses: ReadonlySet<string>
): boolean {
  return status == null || activeStatuses.has(status);
}

function hasExplicitStatus(
  status: string | null | undefined,
  allowedStatuses: ReadonlySet<string>
): boolean {
  return status != null && allowedStatuses.has(status);
}

// ============================================================================
// Core Check
// ============================================================================

/**
 * Check if a user has a specific permission within a scope.
 *
 * @returns true if the user has the permission, false otherwise.
 */
export function checkPermission(
  data: PermissionData,
  scope: PermissionScope,
  action: ActionType,
  resource: ResourceType
): boolean {
  if (!data.userId) return false;

  if (scope.groupId && data.ownedGroupIds?.includes(scope.groupId)) {
    return true;
  }

  if (
    scope.groupId &&
    (hasGroupPermission(data.memberships, scope.groupId, resource, action) ||
      hasGroupPermission(
        data.guestAccesses,
        scope.groupId,
        resource,
        action,
        ACTIVE_GROUP_GUEST_ACCESS_STATUSES
      ))
  ) {
    return true;
  }

  if (scope.eventId && hasEventPermission(data.participations, scope.eventId, resource, action)) {
    return true;
  }

  if (scope.blogId && hasBlogPermission(data.bloggerRelations, scope.blogId, resource, action)) {
    return true;
  }

  if (data.amendment && hasAmendmentPermission(data.amendment, data.userId, resource, action)) {
    return true;
  }

  if (scope.amendment && hasAmendmentPermission(scope.amendment, data.userId, resource, action)) {
    return true;
  }

  return false;
}

// ============================================================================
// Identity Checks
// ============================================================================

export function isSelf(targetUserId: string | undefined, authUserId: string | undefined): boolean {
  return Boolean(targetUserId && targetUserId === authUserId);
}

// ============================================================================
// Membership Checks
// ============================================================================

export function isGroupMember(memberships: Membership[] | undefined, groupId: string): boolean {
  if (!memberships) return false;
  return memberships.some(
    m => m.group?.id === groupId && hasActiveStatus(m.status, ACTIVE_GROUP_MEMBERSHIP_STATUSES)
  );
}

export function isEventParticipant(
  participations: Participation[] | undefined,
  eventId: string
): boolean {
  if (!participations) return false;
  return participations.some(
    p => p.event?.id === eventId && hasExplicitStatus(p.status, ACTIVE_EVENT_PARTICIPANT_STATUSES)
  );
}

export function isBlogger(
  bloggerRelations: BloggerRelation[] | undefined,
  blogId: string
): boolean {
  if (!bloggerRelations) return false;
  return bloggerRelations.some(
    b => b.blog?.id === blogId && b.status != null && ACTIVE_BLOGGER_STATUSES.has(b.status)
  );
}

export function isAmendmentCollaborator(amendment: Amendment | undefined, userId: string): boolean {
  if (amendment?.amendmentRoleCollaborators) {
    return amendment.amendmentRoleCollaborators.some(
      c =>
        c.user?.id === userId && hasExplicitStatus(c.status, ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
    );
  }
  if (!amendment?.collaborators) return false;
  return amendment.collaborators.some(
    c =>
      c.user?.id === userId && hasExplicitStatus(c.status, ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
  );
}

export function isAmendmentAuthor(amendment: Amendment | undefined, userId: string): boolean {
  if (amendment?.owner) return amendment.owner.id === userId;
  if (!amendment?.user) return false;
  return amendment.user.id === userId;
}

// ============================================================================
// Scope Permission Helpers (internal)
// ============================================================================

function checkWithInheritance(userAction: ActionType, requiredAction: ActionType): boolean {
  if (userAction === requiredAction) return true;
  return PERMISSION_IMPLIES[userAction]?.includes(requiredAction) ?? false;
}

function getRoleActionRights(role: any): any[] {
  return role?.actionRights ?? role?.action_rights ?? [];
}

function getActionRightAmendmentId(right: any): string | undefined {
  return right.amendment?.id ?? right.amendment_id;
}

function hasGroupPermission(
  memberships: (Membership | GuestAccess)[] | undefined,
  groupId: string,
  resource: ResourceType,
  action: ActionType,
  activeStatuses: ReadonlySet<string> = ACTIVE_GROUP_MEMBERSHIP_STATUSES
): boolean {
  if (!memberships) return false;
  return memberships.some(
    m =>
      m.group?.id === groupId &&
      hasActiveStatus(m.status, activeStatuses) &&
      m.roles?.some(
        role =>
          role.actionRights?.some(
            right =>
              right.resource === resource &&
              checkWithInheritance(right.action, action) &&
              right.group?.id === groupId
          ) ?? false
      )
  );
}

function hasEventPermission(
  participations: Participation[] | undefined,
  eventId: string,
  resource: ResourceType,
  action: ActionType
): boolean {
  if (!participations) return false;
  return participations.some(
    p =>
      p.event?.id === eventId &&
      hasExplicitStatus(
        p.status,
        action === 'view' ? DISCOVERY_EVENT_PARTICIPANT_STATUSES : ACTIVE_EVENT_PARTICIPANT_STATUSES
      ) &&
      p.roles?.some(
        role =>
          role.scope === 'event' &&
          role.event?.id === eventId &&
          (role.actionRights?.some(
            right =>
              right.resource === resource &&
              checkWithInheritance(right.action, action) &&
              right.event?.id === eventId
          ) ??
            false)
      )
  );
}

function hasBlogPermission(
  bloggerRelations: BloggerRelation[] | undefined,
  blogId: string,
  resource: ResourceType,
  action: ActionType
): boolean {
  if (!bloggerRelations) return false;
  return bloggerRelations.some(
    b =>
      b.blog?.id === blogId &&
      b.status != null &&
      (action === 'view'
        ? DISCOVERY_BLOGGER_STATUSES.has(b.status)
        : ACTIVE_BLOGGER_STATUSES.has(b.status)) &&
      b.role?.actionRights?.some(
        right =>
          b.role?.scope === 'blog' &&
          b.role.blog?.id === blogId &&
          right.resource === resource &&
          checkWithInheritance(right.action, action) &&
          right.blog?.id === blogId
      )
  );
}

function hasAmendmentPermission(
  amendment: Amendment,
  userId: string,
  resource: ResourceType,
  action: ActionType
): boolean {
  if (isAmendmentAuthor(amendment, userId)) {
    return true;
  }

  if (amendment.amendmentRoleCollaborators) {
    const collaborator = amendment.amendmentRoleCollaborators.find(
      c =>
        c.user?.id === userId &&
        hasExplicitStatus(
          c.status,
          action === 'view'
            ? DISCOVERY_AMENDMENT_COLLABORATOR_STATUSES
            : ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
        )
    );
    const actionRights = getRoleActionRights(collaborator?.role);
    if (actionRights.length > 0) {
      return actionRights.some(
        (right: any) =>
          collaborator?.role?.scope === 'amendment' &&
          collaborator.role.amendment?.id === amendment.id &&
          right.resource === resource &&
          checkWithInheritance(right.action, action) &&
          getActionRightAmendmentId(right) === amendment.id
      );
    }
  }

  const rawRoleCollaborator = (amendment.collaborators as any[] | undefined)?.find(
    collaborator =>
      collaborator.user?.id === userId &&
      hasExplicitStatus(
        collaborator.status,
        action === 'view'
          ? DISCOVERY_AMENDMENT_COLLABORATOR_STATUSES
          : ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
      ) &&
      collaborator.role
  );
  const rawRoleActionRights = getRoleActionRights(rawRoleCollaborator?.role);
  if (rawRoleActionRights.length > 0) {
    return rawRoleActionRights.some(
      (right: any) =>
        rawRoleCollaborator?.role?.scope === 'amendment' &&
        (rawRoleCollaborator.role.amendment?.id ?? rawRoleCollaborator.role.amendment_id) ===
          amendment.id &&
        right.resource === resource &&
        checkWithInheritance(right.action, action) &&
        getActionRightAmendmentId(right) === amendment.id
    );
  }

  if (!amendment.collaborators || !amendment.roles) return false;

  const collaboration = amendment.collaborators.find(
    c =>
      c.user?.id === userId &&
      hasExplicitStatus(
        c.status,
        action === 'view'
          ? DISCOVERY_AMENDMENT_COLLABORATOR_STATUSES
          : ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
      )
  );
  if (!collaboration?.roleName) return false;

  const role = amendment.roles.find(r => r.name === collaboration.roleName);
  if (!role?.actionRights) return false;

  return role.actionRights.some(
    right =>
      right.resource === resource &&
      checkWithInheritance(right.action, action) &&
      right.amendment?.id === amendment.id
  );
}

// Re-export voting helpers that use event permissions
export function hasActiveVotingRight(
  participations: Participation[] | undefined,
  eventId: string
): boolean {
  return hasEventPermission(participations, eventId, 'events', 'active_voting');
}

export function hasPassiveVotingRight(
  participations: Participation[] | undefined,
  eventId: string
): boolean {
  return hasEventPermission(participations, eventId, 'events', 'passive_voting');
}
