import { resolveChildBaseGroups } from '@/features/groups/logic/hierarchy';
import {
  resolveMembershipProvenance,
  supportsMembershipComposition,
  type MembershipCompositionGroupLike,
  type MembershipCompositionRelationshipLike,
} from '@/features/groups/logic/membershipComposition';
import type { ParticipationProvenanceGroupLike } from '@/features/shared/types/participation';

interface OfflineRosterGroupLike extends MembershipCompositionGroupLike {
  id: string;
  name?: string | null;
}

interface OfflineRosterMemberLike {
  id: string;
  group_id?: string | null;
  group?: OfflineRosterGroupLike | null;
}

interface OfflineRosterProvenanceResult {
  partGroup: ParticipationProvenanceGroupLike | null;
  baseGroup: ParticipationProvenanceGroupLike | null;
  provenanceBucketLabel: string | null;
}

function pickSourceRootGroupId(args: {
  baseGroupId: string;
  siblingRootGroupIds: readonly string[];
  relationships: readonly MembershipCompositionRelationshipLike[];
  groupsById: ReadonlyMap<string, OfflineRosterGroupLike>;
}) {
  const { baseGroupId, siblingRootGroupIds, relationships, groupsById } = args;

  return (
    siblingRootGroupIds.find(rootGroupId => {
      if (rootGroupId === baseGroupId) {
        return true;
      }

      const rootGroup = groupsById.get(rootGroupId);
      if (rootGroup?.group_type !== 'hierarchical') {
        return false;
      }

      return resolveChildBaseGroups(
        rootGroupId,
        [...relationships] as Parameters<typeof resolveChildBaseGroups>[1],
        groupsById
      ).includes(baseGroupId);
    }) ?? baseGroupId
  );
}

function buildPseudoMembership(args: {
  id: string;
  userId: string;
  sourceGroupId: string;
  sourceGroup: OfflineRosterGroupLike | null;
  groupId?: string;
  group?: OfflineRosterGroupLike | null;
}) {
  return {
    id: args.id,
    user_id: args.userId,
    user: { id: args.userId },
    group_id: args.groupId,
    group: args.group ?? null,
    status: 'active',
    source: 'derived',
    source_group_id: args.sourceGroupId,
    source_group: args.sourceGroup ?? null,
    roles: [],
    role: null,
  };
}

export function resolveOfflineRosterProvenance(args: {
  group: MembershipCompositionGroupLike | null | undefined;
  offlineMembers: readonly OfflineRosterMemberLike[];
  relationships: readonly MembershipCompositionRelationshipLike[];
  groupsById: ReadonlyMap<string, OfflineRosterGroupLike>;
  siblingRootGroupIds?: readonly string[];
}) {
  const { group, offlineMembers, relationships, groupsById, siblingRootGroupIds = [] } = args;
  const provenanceByOfflineMemberId = new Map<string, OfflineRosterProvenanceResult>();

  if (!group || !supportsMembershipComposition(group) || offlineMembers.length === 0) {
    return provenanceByOfflineMemberId;
  }

  const currentMemberships = offlineMembers.flatMap(offlineMember => {
    const baseGroupId = offlineMember.group_id || offlineMember.group?.id;
    if (!baseGroupId) {
      return [];
    }

    const baseGroup = groupsById.get(baseGroupId) ?? offlineMember.group ?? null;
    if (group.group_type === 'hierarchical') {
      return [
        buildPseudoMembership({
          id: offlineMember.id,
          userId: offlineMember.id,
          sourceGroupId: baseGroupId,
          sourceGroup: baseGroup,
        }),
      ];
    }

    const sourceRootGroupId = pickSourceRootGroupId({
      baseGroupId,
      siblingRootGroupIds,
      relationships,
      groupsById,
    });
    return [
      buildPseudoMembership({
        id: offlineMember.id,
        userId: offlineMember.id,
        sourceGroupId: sourceRootGroupId,
        sourceGroup: groupsById.get(sourceRootGroupId) ?? baseGroup,
      }),
    ];
  });

  const rootMemberships =
    group.group_type === 'sibling'
      ? offlineMembers.flatMap(offlineMember => {
          const baseGroupId = offlineMember.group_id || offlineMember.group?.id;
          if (!baseGroupId) {
            return [];
          }

          const sourceRootGroupId = pickSourceRootGroupId({
            baseGroupId,
            siblingRootGroupIds,
            relationships,
            groupsById,
          });

          if (sourceRootGroupId === baseGroupId) {
            return [];
          }

          return [
            buildPseudoMembership({
              id: `root:${offlineMember.id}`,
              userId: offlineMember.id,
              groupId: sourceRootGroupId,
              group: groupsById.get(sourceRootGroupId) ?? null,
              sourceGroupId: baseGroupId,
              sourceGroup: groupsById.get(baseGroupId) ?? offlineMember.group ?? null,
            }),
          ];
        })
      : [];

  const resolvedMemberships = resolveMembershipProvenance({
    group,
    memberships: currentMemberships,
    relationships,
    rootMemberships,
  });

  for (const membership of resolvedMemberships) {
    provenanceByOfflineMemberId.set(membership.id, {
      partGroup: membership.partGroup,
      baseGroup: membership.baseGroup,
      provenanceBucketLabel: membership.provenanceBucketLabel,
    });
  }

  return provenanceByOfflineMemberId;
}
