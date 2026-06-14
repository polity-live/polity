import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import type {
  GroupAccessRoleWithRightsRow,
  GroupMembershipWithRolesAndRightsByGroupIdsRow,
} from '@/zero/groups/queries';
import type { MembershipCompositionBucket } from '../types/group.types';
import {
  buildMembershipCompositionBuckets,
  resolveMembershipProvenance,
  supportsMembershipComposition,
  type MembershipCompositionGroupLike,
  type MembershipProvenanceFields,
  type MembershipWithCompositionSource,
} from '../logic/membershipComposition';
import type { GroupConnectionListRow } from '@/zero/network/queries';
import { deriveNormalizedGroupRelationships } from '@/features/network/logic/groupConnectionDerived';

interface GroupMembershipRoleLinkLike {
  role?: GroupAccessRoleWithRightsRow | null;
}

function selectPrimaryGroupRole(roles: readonly GroupAccessRoleWithRightsRow[]) {
  if (roles.length === 0) {
    return null;
  }

  return (
    [...roles].sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1))[0] ?? null
  );
}

function normalizeMemberships(
  memberships: readonly GroupMembershipWithRolesAndRightsByGroupIdsRow[] | null | undefined
) {
  return (memberships || []).map(membership => {
    const roles: GroupAccessRoleWithRightsRow[] = [];
    for (const membershipRole of membership.membership_roles || []) {
      const role = (membershipRole as GroupMembershipRoleLinkLike).role;
      if (role) {
        roles.push(role);
      }
    }

    return {
      ...membership,
      roles,
      role: selectPrimaryGroupRole(roles),
    };
  });
}

export function useGroupMembershipComposition<TMembership extends MembershipWithCompositionSource>(
  group: MembershipCompositionGroupLike | null | undefined,
  memberships: readonly TMembership[]
) {
  const showComposition = supportsMembershipComposition(group);
  const sourceGroupIds = useMemo(() => {
    if (!showComposition || group?.group_type !== 'sibling') {
      return [];
    }

    return [
      ...new Set(
        memberships
          .map(membership => membership.source_group_id)
          .filter((groupId): groupId is string => Boolean(groupId))
      ),
    ];
  }, [group?.group_type, memberships, showComposition]);

  const [relationshipLinks, relationshipsResult] = useQuery(
    showComposition ? queries.network.allGroupConnections({}) : undefined
  );
  const [rootMembershipsData, rootMembershipsResult] = useQuery(
    showComposition && sourceGroupIds.length > 0
      ? queries.groups.membershipsWithRolesAndRightsByGroupIds({ groupIds: sourceGroupIds })
      : undefined
  );

  const rootMemberships = useMemo(
    () => normalizeMemberships(rootMembershipsData),
    [rootMembershipsData]
  );
  const isLoading =
    showComposition &&
    (relationshipsResult.type === 'unknown' ||
      (sourceGroupIds.length > 0 && rootMembershipsResult.type === 'unknown'));

  const membershipsWithProvenance = useMemo(() => {
    if (!showComposition || !group || isLoading) {
      return memberships as (TMembership & MembershipProvenanceFields)[];
    }

    return resolveMembershipProvenance({
      group,
      memberships,
      relationships: deriveNormalizedGroupRelationships(
        (relationshipLinks ?? []) as readonly GroupConnectionListRow[]
      ),
      rootMemberships,
    }) as (TMembership & MembershipProvenanceFields)[];
  }, [group, isLoading, memberships, relationshipLinks, rootMemberships, showComposition]);

  const compositionBuckets = useMemo<MembershipCompositionBucket[]>(() => {
    if (!showComposition || isLoading) {
      return [];
    }

    return buildMembershipCompositionBuckets(membershipsWithProvenance);
  }, [isLoading, membershipsWithProvenance, showComposition]);

  return {
    showComposition,
    membershipsWithProvenance,
    compositionBuckets,
    isLoading,
  };
}
