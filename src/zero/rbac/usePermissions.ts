/**
 * usePermissions Hook
 *
 * Unified hook for checking permissions in React components.
 * Uses the shared checkPermission() logic from check.ts — the same logic
 * that can() uses on the server in mutators.
 *
 * @example
 * ```tsx
 * const { can, canManage, isLoading } = usePermissions({ groupId });
 *
 * if (isLoading) return <Spinner />;
 * {can('create', 'events') && <CreateEventButton />}
 * {canManage('roles') && <RoleManagementPanel />}
 * ```
 */

import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '../queries';
import {
  checkPermission,
  isSelf,
  isGroupMember,
  isEventParticipant,
  isBlogger,
  isAmendmentCollaborator,
  isAmendmentAuthor,
  hasActiveVotingRight,
  hasPassiveVotingRight,
  type PermissionScope,
} from './check';
import type {
  PermissionContext,
  ResourceType,
  ActionType,
  Membership,
  GuestAccess,
  Participation,
  BloggerRelation,
  ActionRight,
  Role,
} from './types';

// ============================================================================
// Data Loading (React hooks)
// ============================================================================

function useAuthUserId(): string | undefined {
  const { user } = useAuth();
  return user?.id;
}

interface UsePermissionsData {
  memberships: Membership[] | undefined;
  guestAccesses: GuestAccess[] | undefined;
  participations: Participation[] | undefined;
  bloggerRelations: BloggerRelation[] | undefined;
  ownedGroupIds: string[] | undefined;
  isLoading: boolean;
}

export interface PermissionEvaluator {
  can: (scope: PermissionScope, action: ActionType, resource: ResourceType) => boolean;
  isLoading: boolean;
  userId: string | undefined;
}

interface PermissionRoleLinkLike {
  role?: {
    id?: string | null;
    name?: string | null;
    description?: string | null;
    scope?: string | null;
    action_rights?: readonly Record<string, string | null | number>[];
  } | null;
}

function mapActionRights(
  raw: readonly Record<string, string | null | number>[] | undefined
): ActionRight[] {
  if (!raw) return [];
  return raw.map(ar => ({
    id: String(ar.id ?? ''),
    resource: String(ar.resource ?? '') as ActionRight['resource'],
    action: String(ar.action ?? '') as ActionRight['action'],
    group: ar.group_id ? { id: String(ar.group_id) } : undefined,
    event: ar.event_id ? { id: String(ar.event_id) } : undefined,
    amendment: ar.amendment_id ? { id: String(ar.amendment_id) } : undefined,
    blog: ar.blog_id ? { id: String(ar.blog_id) } : undefined,
  }));
}

function mapRolesFromLinks<T extends PermissionRoleLinkLike>(
  raw: readonly T[] | undefined,
  fallbackScope: Role['scope']
): Role[] {
  if (!raw) return [];

  return raw.flatMap(link => {
    if (!link.role?.id) return [];

    return [
      {
        id: link.role.id,
        name: link.role.name ?? '',
        description: link.role.description ?? undefined,
        scope: (link.role.scope ?? fallbackScope) as Role['scope'],
        actionRights: mapActionRights(link.role.action_rights),
      },
    ];
  });
}

function usePermissionsData(userId: string | undefined): UsePermissionsData {
  const [membershipsRaw, membershipsResult] = useQuery(
    userId ? queries.rbac.viewerMemberships({}) : undefined
  );

  const [guestAccessesRaw, guestAccessesResult] = useQuery(
    userId ? queries.rbac.viewerGuestAccesses({}) : undefined
  );

  const [participationsRaw, participationsResult] = useQuery(
    userId ? queries.rbac.viewerParticipations({}) : undefined
  );

  const [bloggerRelationsRaw, bloggerResult] = useQuery(
    userId ? queries.rbac.viewerBloggerRelations({}) : undefined
  );

  const [ownedGroupsRaw, ownedGroupsResult] = useQuery(
    userId ? queries.rbac.viewerOwnedGroups({}) : undefined
  );

  const isLoading =
    membershipsResult.type === 'unknown' ||
    guestAccessesResult.type === 'unknown' ||
    participationsResult.type === 'unknown' ||
    bloggerResult.type === 'unknown' ||
    ownedGroupsResult.type === 'unknown';

  const memberships = useMemo(() => {
    if (!membershipsRaw) return undefined;
    return membershipsRaw
      .filter(m => m.status === 'active' || m.status === 'member' || m.status === 'admin')
      .map(m => ({
        id: m.id,
        group: { id: m.group_id },
        roles: mapRolesFromLinks(m.membership_roles, 'group'),
        status: m.status,
      })) as Membership[];
  }, [membershipsRaw]);

  const participations = useMemo(() => {
    if (!participationsRaw) return undefined;
    return participationsRaw
      .filter(
        p =>
          p.status === 'active' ||
          p.status === 'confirmed' ||
          p.status === 'member' ||
          p.status === 'admin'
      )
      .map(p => ({
        id: p.id,
        event: { id: p.event_id },
        roles: mapRolesFromLinks(p.participant_roles, 'event'),
        status: p.status,
      })) as Participation[];
  }, [participationsRaw]);

  const bloggerRelations = useMemo(() => {
    if (!bloggerRelationsRaw) return undefined;
    return bloggerRelationsRaw.map(b => ({
      id: b.id,
      blog: { id: b.blog_id },
      role: b.role
        ? {
            id: b.role.id,
            name: b.role.name,
            description: b.role.description,
            scope: b.role.scope,
            actionRights: mapActionRights(b.role.action_rights),
          }
        : undefined,
    })) as BloggerRelation[];
  }, [bloggerRelationsRaw]);

  const guestAccesses = useMemo(() => {
    if (!guestAccessesRaw) return undefined;
    return guestAccessesRaw
      .filter(guestAccess => guestAccess.status === 'active')
      .map(guestAccess => ({
        id: guestAccess.id,
        group: { id: guestAccess.group_id },
        roles: mapRolesFromLinks(guestAccess.guest_roles, 'group'),
        status: guestAccess.status,
      })) as GuestAccess[];
  }, [guestAccessesRaw]);

  const ownedGroupIds = useMemo(
    () => ownedGroupsRaw?.map(group => group.id) ?? undefined,
    [ownedGroupsRaw]
  );

  return { memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds, isLoading };
}

/**
 * Evaluates arbitrary entity scopes with the same pure permission checker used
 * by the authoritative server-side can() helper. This loads permission data
 * once and is intended for lists that need to evaluate several entity rows.
 */
export function usePermissionEvaluator(): PermissionEvaluator {
  const userId = useAuthUserId();
  const { memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds, isLoading } =
    usePermissionsData(userId);

  return useMemo(
    () => ({
      isLoading,
      userId,
      can: (scope: PermissionScope, action: ActionType, resource: ResourceType) => {
        if (!userId || isLoading) return false;
        return checkPermission(
          { userId, memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds },
          scope,
          action,
          resource
        );
      },
    }),
    [bloggerRelations, guestAccesses, isLoading, memberships, ownedGroupIds, participations, userId]
  );
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePermissions(context: PermissionContext) {
  const userId = useAuthUserId();
  const { memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds, isLoading } =
    usePermissionsData(userId);

  return useMemo(() => {
    const can = (action: ActionType, resource: ResourceType): boolean => {
      if (!userId) return false;
      return checkPermission(
        { userId, memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds },
        {
          groupId: context.groupId,
          eventId: context.eventId,
          blogId: context.blogId,
          amendment: context.amendment,
        },
        action,
        resource
      );
    };

    const isMe = (targetUserId: string | undefined): boolean => {
      return isSelf(targetUserId, userId);
    };

    const isMember = (): boolean => {
      if (!context.groupId) return false;
      return isGroupMember(memberships, context.groupId);
    };

    const isParticipant = (): boolean => {
      if (!context.eventId) return false;
      return isEventParticipant(participations, context.eventId);
    };

    const isABlogger = (): boolean => {
      if (!context.blogId) return false;
      return isBlogger(bloggerRelations, context.blogId);
    };

    const isCollaborator = (): boolean => {
      if (!context.amendment || !userId) return false;
      return isAmendmentCollaborator(context.amendment, userId);
    };

    const isAuthor = (): boolean => {
      if (!context.amendment || !userId) return false;
      return isAmendmentAuthor(context.amendment, userId);
    };

    const canVote = (): boolean => {
      if (!context.eventId) return false;
      return hasActiveVotingRight(participations, context.eventId);
    };

    const canBeCandidate = (): boolean => {
      if (!context.eventId) return false;
      return hasPassiveVotingRight(participations, context.eventId);
    };

    return {
      isLoading,

      // Permission checks — same logic as server-side can()
      can,
      canView: (resource: ResourceType) => can('view', resource),
      canManage: (resource: ResourceType) => can('manage', resource),
      canCreate: (resource: ResourceType) => can('create', resource),
      canUpdate: (resource: ResourceType) => can('update', resource),
      canDelete: (resource: ResourceType) => can('delete', resource),

      // Identity checks
      isMe,
      userId,

      // Membership checks
      isMember,
      isParticipant,
      isABlogger,
      isCollaborator,
      isAuthor,

      // Voting permission checks
      canVote,
      canBeCandidate,

      // Raw data access (for advanced use cases)
      memberships,
      guestAccesses,
      participations,
      bloggerRelations,
      ownedGroupIds,
    };
  }, [
    memberships,
    guestAccesses,
    participations,
    bloggerRelations,
    ownedGroupIds,
    userId,
    context,
    isLoading,
  ]);
}

export function useCreatableGroupIds(resource: ResourceType) {
  const userId = useAuthUserId();
  const { memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds, isLoading } =
    usePermissionsData(userId);

  return useMemo(() => {
    const creatableGroupIds = new Set<string>();

    if (!userId) {
      return { creatableGroupIds, isLoading };
    }

    const candidateGroupIds = new Set<string>();
    for (const membership of memberships ?? []) {
      if (membership.group?.id) {
        candidateGroupIds.add(membership.group.id);
      }
    }
    for (const guestAccess of guestAccesses ?? []) {
      if (guestAccess.group?.id) {
        candidateGroupIds.add(guestAccess.group.id);
      }
    }
    for (const groupId of ownedGroupIds ?? []) {
      candidateGroupIds.add(groupId);
    }

    for (const groupId of candidateGroupIds) {
      if (
        checkPermission(
          { userId, memberships, guestAccesses, participations, bloggerRelations, ownedGroupIds },
          { groupId },
          'create',
          resource
        )
      ) {
        creatableGroupIds.add(groupId);
      }
    }

    return { creatableGroupIds, isLoading };
  }, [
    bloggerRelations,
    guestAccesses,
    isLoading,
    memberships,
    ownedGroupIds,
    participations,
    resource,
    userId,
  ]);
}
