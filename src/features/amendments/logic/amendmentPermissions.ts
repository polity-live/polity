import { checkPermission } from '@/zero/rbac/check';
import type { ActionRight, Amendment as PermissionAmendment } from '@/zero/rbac/types';

export type RawAmendmentPermissionEntity = Record<string, any>;

export interface AmendmentPermissionFlags {
  canChangeMode: boolean;
  canManageChangeRequestVotes: boolean;
  canVoteOnChangeRequests: boolean;
}

const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = new Set([
  'active',
  'collaborator',
  'member',
  'admin',
]);

export function getAmendmentRoleCollaborators(
  amendment: RawAmendmentPermissionEntity | null | undefined
): RawAmendmentPermissionEntity[] {
  if (!amendment) return [];

  if (Array.isArray(amendment.amendmentRoleCollaborators)) {
    return amendment.amendmentRoleCollaborators;
  }

  return Array.isArray(amendment.collaborators) ? amendment.collaborators : [];
}

export function mapRoleActionRights(
  raw: readonly RawAmendmentPermissionEntity[] | undefined
): ActionRight[] {
  if (!raw) return [];

  return raw.flatMap(right => {
    if (!right.resource || !right.action) return [];

    return [
      {
        id: String(right.id ?? `${right.resource}:${right.action}`),
        resource: right.resource,
        action: right.action,
        group: right.group_id ? { id: String(right.group_id) } : undefined,
        event: right.event_id ? { id: String(right.event_id) } : undefined,
        amendment: right.amendment_id ? { id: String(right.amendment_id) } : undefined,
        blog: right.blog_id ? { id: String(right.blog_id) } : undefined,
      } as ActionRight,
    ];
  });
}

export function isActiveAmendmentCollaborator(collaborator: RawAmendmentPermissionEntity): boolean {
  return ACTIVE_AMENDMENT_COLLABORATOR_STATUSES.has(collaborator.status ?? '');
}

function buildPermissionAmendment(amendment: RawAmendmentPermissionEntity): PermissionAmendment {
  const ownerId = amendment.created_by_id ?? amendment.created_by?.id ?? amendment.user?.id;

  return {
    id: amendment.id,
    owner: ownerId ? { id: String(ownerId) } : undefined,
    user: ownerId ? { id: String(ownerId) } : undefined,
    group: amendment.group_id ? { id: String(amendment.group_id) } : undefined,
    amendmentRoleCollaborators: getAmendmentRoleCollaborators(amendment)
      .filter(collaborator => collaborator.user?.id && isActiveAmendmentCollaborator(collaborator))
      .map(collaborator => ({
        id: String(collaborator.id),
        user: { id: String(collaborator.user.id) },
        status: collaborator.status,
        role: collaborator.role
          ? {
              id: String(collaborator.role.id),
              name: collaborator.role.name ?? '',
              description: collaborator.role.description ?? undefined,
              scope: 'amendment',
              amendment: { id: String(amendment.id) },
              actionRights: mapRoleActionRights(collaborator.role.action_rights),
            }
          : undefined,
      })),
  };
}

export function getAmendmentPermissionFlags(
  amendment: RawAmendmentPermissionEntity | null | undefined,
  userId?: string
): AmendmentPermissionFlags {
  if (!amendment || !userId) {
    return {
      canChangeMode: false,
      canVoteOnChangeRequests: false,
      canManageChangeRequestVotes: false,
    };
  }

  const permissionAmendment = buildPermissionAmendment(amendment);
  const data = { userId };
  const scope = { amendment: permissionAmendment };

  return {
    canChangeMode: checkPermission(data, scope, 'update', 'amendments'),
    canVoteOnChangeRequests: checkPermission(data, scope, 'vote', 'amendments'),
    canManageChangeRequestVotes: checkPermission(data, scope, 'manage', 'amendments'),
  };
}
