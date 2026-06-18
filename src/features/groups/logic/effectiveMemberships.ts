import { resolveChildBaseGroups } from '@/features/groups/logic/hierarchy';
import type {
  ParticipationGroupLike,
  ParticipationLike,
} from '@/features/shared/types/participation';

type GroupLookup = ReadonlyMap<string, { group_type?: string | null | undefined }>;

export interface EffectiveHierarchyMembershipFields {
  effectiveReadOnly?: boolean;
  effectiveSourceMembershipId?: string;
}

interface SelectMaterializedHierarchicalMembershipsArgs<TMembership extends ParticipationLike> {
  targetGroup: ParticipationGroupLike;
  memberships: readonly TMembership[];
  relationships: Parameters<typeof resolveChildBaseGroups>[1];
  groupsById?: GroupLookup;
}

export function selectMaterializedHierarchicalMemberships<TMembership extends ParticipationLike>({
  targetGroup,
  memberships,
}: SelectMaterializedHierarchicalMembershipsArgs<TMembership>): (TMembership &
  EffectiveHierarchyMembershipFields)[] {
  const targetGroupId = targetGroup.id;
  if (!targetGroupId) {
    return [];
  }

  const activeMemberships = memberships.filter(isActiveMembership);
  return dedupeByUserId(
    sortTargetMembershipsForCanonicalPreference(
      activeMemberships.filter(membership => membership.group_id === targetGroupId)
    )
  );
}

export function countDistinctMembershipUsers(
  memberships: readonly Pick<ParticipationLike, 'user_id' | 'user'>[]
) {
  const seenUserKeys = new Set<string>();
  for (const membership of memberships) {
    const key = getMembershipUserKey(membership);
    if (key) {
      seenUserKeys.add(key);
    }
  }
  return seenUserKeys.size;
}

function sortTargetMembershipsForCanonicalPreference<TMembership extends ParticipationLike>(
  memberships: readonly TMembership[]
) {
  return [...memberships].sort((left, right) => getSourcePriority(left) - getSourcePriority(right));
}

function getSourcePriority(membership: Pick<ParticipationLike, 'source'>) {
  if (membership.source === 'derived') {
    return 0;
  }
  if (membership.source === 'direct' || membership.source == null) {
    return 1;
  }
  return 2;
}

function dedupeByUserId<TMembership extends ParticipationLike>(
  memberships: readonly TMembership[]
) {
  const selectedMemberships: TMembership[] = [];
  const seenUserKeys = new Set<string>();
  for (const membership of memberships) {
    addMembershipIfNewUser(selectedMemberships, seenUserKeys, membership);
  }
  return selectedMemberships;
}

function addMembershipIfNewUser<TMembership extends ParticipationLike>(
  selectedMemberships: TMembership[],
  seenUserKeys: Set<string>,
  membership: TMembership
) {
  const userKey = getMembershipUserKey(membership);
  if (!userKey || seenUserKeys.has(userKey)) {
    return;
  }

  seenUserKeys.add(userKey);
  selectedMemberships.push(membership);
}

function getMembershipUserKey(membership: Pick<ParticipationLike, 'user_id' | 'user'>) {
  return membership.user?.id || membership.user_id || null;
}

function isActiveMembership(membership: Pick<ParticipationLike, 'status' | 'role'>) {
  const status = membership.status?.toLowerCase() || '';
  return (
    status === 'active' || status === 'member' || status === 'admin' || isBoardMember(membership)
  );
}

function isBoardMember(membership: Pick<ParticipationLike, 'role'>) {
  return (membership.role?.name || '').toLowerCase() === 'board member';
}
