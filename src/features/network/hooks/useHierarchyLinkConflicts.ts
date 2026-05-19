import { useCallback, useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import type {
  GroupDirectMembershipRow,
  GroupMembershipWithRolesAndRightsRow,
} from '@/zero/groups/queries';
import {
  canActivateHierarchyLink,
  getHierarchyLinkConflictUserIds,
  isGroupLinkRelationship,
  type DirectMembershipShape,
} from '../logic/hierarchyLinkHelpers';
import { getPrimaryMembershipRole } from '@/features/shared/logic/membershipRoleHelpers';
import type { NormalizedGroupRelationship } from '../types/network.types';

export interface HierarchyConflictUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  membershipIdInCurrentGroup: string | null;
}

type MembershipWithUserRow = GroupDirectMembershipRow | GroupMembershipWithRolesAndRightsRow;

function isAdminRole(roleName: string | null | undefined): boolean {
  return roleName === 'Admin' || roleName === 'Board Member';
}

function isMemberRole(roleName: string | null | undefined): boolean {
  return roleName === 'Member' || isAdminRole(roleName);
}

function isActiveGroupMembership(row: GroupMembershipWithRolesAndRightsRow): boolean {
  return (
    row.status === 'active' ||
    row.status === 'member' ||
    row.status === 'admin' ||
    isMemberRole(getPrimaryMembershipRole(row)?.name)
  );
}

function hasNonMemberPartnerRole(row: GroupMembershipWithRolesAndRightsRow): boolean {
  const roleName = getPrimaryMembershipRole(row)?.name;
  return row.status === 'admin' || (!!roleName && roleName !== 'Member');
}

export function useHierarchyLinkConflicts(
  currentGroupId: string,
  allRelationships: NormalizedGroupRelationship[],
  partnerGroupId?: string
) {
  const [directMembershipsRaw] = useQuery(queries.groups.directMemberships({}));
  const [partnerGroupMembershipsRaw] = useQuery(
    partnerGroupId
      ? queries.groups.membershipsWithRolesAndRights({ groupId: partnerGroupId })
      : undefined
  );

  const directMemberships = useMemo<DirectMembershipShape[]>(
    () =>
      (directMembershipsRaw ?? []).map(row => ({
        group_id: row.group_id,
        user_id: row.user_id,
        source: row.source,
      })),
    [directMembershipsRaw]
  );

  const membershipsByUserInCurrentGroup = useMemo(() => {
    const map = new Map<string, GroupDirectMembershipRow>();
    for (const row of directMembershipsRaw ?? []) {
      if (row.group_id === currentGroupId && !map.has(row.user_id)) {
        map.set(row.user_id, row);
      }
    }
    return map;
  }, [currentGroupId, directMembershipsRaw]);

  const membershipWithUserByUserId = useMemo(() => {
    const map = new Map<string, MembershipWithUserRow>();
    for (const row of partnerGroupMembershipsRaw ?? []) {
      if (!map.has(row.user_id)) {
        map.set(row.user_id, row);
      }
    }
    for (const row of directMembershipsRaw ?? []) {
      if (!map.has(row.user_id)) {
        map.set(row.user_id, row);
      }
    }
    return map;
  }, [partnerGroupMembershipsRaw, directMembershipsRaw]);

  const buildConflictUser = useCallback(
    (userId: string, preferredMembership?: MembershipWithUserRow | null): HierarchyConflictUser => {
      const membershipInCurrentGroup = membershipsByUserInCurrentGroup.get(userId);
      const membership =
        preferredMembership ?? membershipInCurrentGroup ?? membershipWithUserByUserId.get(userId);
      const user = membership?.user;
      const displayName =
        [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.handle || userId;

      return {
        userId,
        displayName,
        avatarUrl: user?.avatar ?? null,
        membershipIdInCurrentGroup: membershipInCurrentGroup?.id ?? null,
      };
    },
    [membershipsByUserInCurrentGroup, membershipWithUserByUserId]
  );

  const getConflictUserIds = useCallback(
    (relationship: NormalizedGroupRelationship) =>
      getHierarchyLinkConflictUserIds(relationship, allRelationships, directMemberships),
    [allRelationships, directMemberships]
  );

  const canActivateLink = useCallback(
    (relationship: NormalizedGroupRelationship) =>
      canActivateHierarchyLink(relationship, allRelationships, directMemberships),
    [allRelationships, directMemberships]
  );

  const resolveConflictUsers = useCallback(
    (userIds: string[]): HierarchyConflictUser[] =>
      userIds.map(userId => buildConflictUser(userId)),
    [buildConflictUser]
  );

  const resolvePartnerUsers = useCallback((): HierarchyConflictUser[] => {
    const membershipsByUser = new Map<string, GroupMembershipWithRolesAndRightsRow>();

    for (const row of partnerGroupMembershipsRaw ?? []) {
      if (!isActiveGroupMembership(row) || !hasNonMemberPartnerRole(row)) {
        continue;
      }

      if (!membershipsByUser.has(row.user_id)) {
        membershipsByUser.set(row.user_id, row);
      }
    }

    const users = Array.from(membershipsByUser.values())
      .filter(isActiveGroupMembership)
      .map(row => buildConflictUser(row.user_id, row))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));

    return users;
  }, [buildConflictUser, partnerGroupMembershipsRaw]);

  const isLinkCheckApplicable = useCallback(
    (relationship: NormalizedGroupRelationship) => isGroupLinkRelationship(relationship),
    []
  );

  return {
    getConflictUserIds,
    canActivateLink,
    resolveConflictUsers,
    resolvePartnerUsers,
    isLinkCheckApplicable,
  };
}
