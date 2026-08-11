import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';
import type { GroupConnectionListRow } from '../network/queries';
import {
  buildDerivedGroupNetworkMetaMap,
  type DerivedGroupNetworkMeta,
  deriveNormalizedGroupRelationships,
} from '@/features/network/logic/groupConnectionDerived';

interface GroupStateOptions {
  groupId?: string;
  userId?: string;
  includeSearch?: boolean;
  includeMemberships?: boolean;
  includeRoles?: boolean;
  includeScopedRoles?: boolean;
  includeAllRelationships?: boolean;
  includeByUser?: boolean;
  includeMembershipsWithUsers?: boolean;
  includeCurrentUserMembershipsWithGroups?: boolean;
  includeAllRelationshipsWithGroups?: boolean;
}

interface GroupRoleDisplayLike {
  name?: string | null;
  term_start_date?: number | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
}

interface GroupRoleLike {
  id: string;
  name?: string | null;
  sort_order?: number | null;
  action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
}

interface GroupMembershipRoleLinkLike<TRole extends GroupRoleLike = GroupRoleLike> {
  role?: TRole | null;
}

interface GroupGuestRoleLinkLike<TRole extends GroupRoleLike = GroupRoleLike> {
  role?: TRole | null;
}

interface GroupOfflineMembershipRoleLinkLike<TRole extends GroupRoleLike = GroupRoleLike> {
  role?: TRole | null;
}

export function selectPrimaryGroupRole<TRole extends GroupRoleLike>(roles: readonly TRole[]) {
  if (roles.length === 0) return null;

  return [...roles].sort(
    (left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1)
  )[0] as TRole;
}

export function normalizeMembershipWithRoles<
  TMembership extends {
    membership_roles?: readonly GroupMembershipRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(membership: TMembership) {
  const roles: TRole[] = [];
  for (const link of membership.membership_roles || []) {
    if (link.role) {
      roles.push(link.role);
    }
  }
  const primaryRole = selectPrimaryGroupRole(roles) ?? membership.role ?? null;

  return {
    ...membership,
    roles,
    role: primaryRole,
  };
}

export function normalizeMemberships<
  TMembership extends {
    membership_roles?: readonly GroupMembershipRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(memberships: readonly TMembership[] | null | undefined) {
  return (memberships || []).map(membership => normalizeMembershipWithRoles(membership));
}

export function normalizeGuestAccesses<
  TGuestAccess extends {
    guest_roles?: readonly GroupGuestRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(guestAccesses: readonly TGuestAccess[] | null | undefined) {
  return (guestAccesses || []).map(guestAccess => {
    const roles: TRole[] = [];
    for (const link of guestAccess.guest_roles || []) {
      if (link.role) {
        roles.push(link.role);
      }
    }
    return {
      ...guestAccess,
      roles,
      role: selectPrimaryGroupRole(roles) ?? guestAccess.role ?? null,
    };
  });
}

export function normalizeOfflineMemberships<
  TMembership extends {
    user_id?: string | null;
    status?: string | null;
    group_offline_member_id?: string | null;
    group_offline_member?: {
      id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      connected_user_id?: string | null;
      connected_user?: {
        id?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        handle?: string | null;
        avatar?: string | null;
        email?: string | null;
      } | null;
      group?: { id?: string | null; name?: string | null; group_type?: string | null } | null;
    } | null;
    membership_roles?: readonly GroupOfflineMembershipRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(memberships: readonly TMembership[] | null | undefined) {
  return (memberships || [])
    .filter(
      membership =>
        (membership.status === 'active' ||
          membership.status === 'admin' ||
          membership.status === 'member') &&
        !membership.group_offline_member?.connected_user_id
    )
    .map(membership => {
      const roles: TRole[] = [];
      for (const link of membership.membership_roles || []) {
        if (link.role) {
          roles.push(link.role);
        }
      }

      const offlineMember = membership.group_offline_member;
      return {
        ...membership,
        user_id: membership.group_offline_member_id
          ? `offline:${membership.group_offline_member_id}`
          : membership.user_id,
        user: {
          id: null,
          first_name: offlineMember?.first_name ?? null,
          last_name: offlineMember?.last_name ?? null,
          handle: null,
          avatar: null,
          email: null,
        },
        roles,
        role: selectPrimaryGroupRole(roles) ?? membership.role ?? null,
      };
    });
}

export function mapRoleForDisplay<T extends GroupRoleDisplayLike>(role: T) {
  return {
    ...role,
    title: role.name,
    term:
      Boolean(role.is_recurring) && role.recurrence_pattern === 'yearly'
        ? String(role.recurrence_interval ?? 1)
        : null,
    first_term_start: role.term_start_date ?? null,
  };
}

export function isActiveConnectionStatus(status: string | null | undefined) {
  return status === 'active';
}

export function uniqueById<T extends { id?: string | null }>(items: readonly T[]) {
  const seenIds = new Set<string>();
  return items.filter(item => {
    if (!item.id || seenIds.has(item.id)) {
      return false;
    }
    seenIds.add(item.id);
    return true;
  });
}

type DerivedRelationshipRow = ReturnType<typeof deriveNormalizedGroupRelationships>[number];

interface GroupReferenceLike {
  id?: string | null;
  name?: string | null;
  description?: unknown;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
  memberships?: readonly unknown[] | null;
  amendments?: readonly unknown[] | null;
  events?: readonly unknown[] | null;
  group_type?: string | null;
}

export type AugmentedGroupWithDerivedNetworkMeta<TGroup extends { id?: string | null }> = Omit<
  TGroup,
  'id'
> & {
  id: string;
} & DerivedGroupNetworkMeta & {
    connected_group: GroupReferenceLike | null;
    sibling_groups: GroupReferenceLike[];
    sibling_sources: {
      id: string;
      group_id: string;
      source_group_id: string;
      source_group: GroupReferenceLike | null;
    }[];
    relationships_as_source: DerivedRelationshipRow[];
    relationships_as_target: DerivedRelationshipRow[];
  };

interface GroupNetworkMetaSource {
  id?: string | null;
  group_type?: string | null;
  has_hierarchy_children?: boolean | null;
  has_sibling_connections?: boolean | null;
  connected_group_id?: string | null;
  primary_sibling_membership_mode?: string | null;
  sibling_membership_mode?: string | null;
  sibling_role_id?: string | null;
}

export function augmentGroupWithDerivedNetworkMeta<TGroup extends GroupNetworkMetaSource>(
  group: TGroup,
  allConnections: readonly GroupConnectionListRow[],
  allGroups?: readonly GroupReferenceLike[]
): AugmentedGroupWithDerivedNetworkMeta<TGroup>;
export function augmentGroupWithDerivedNetworkMeta<TGroup extends GroupNetworkMetaSource>(
  group: TGroup | null | undefined,
  allConnections: readonly GroupConnectionListRow[],
  allGroups?: readonly GroupReferenceLike[]
): AugmentedGroupWithDerivedNetworkMeta<TGroup> | null;
export function augmentGroupWithDerivedNetworkMeta<TGroup extends GroupNetworkMetaSource>(
  group: TGroup | null | undefined,
  allConnections: readonly GroupConnectionListRow[],
  allGroups: readonly GroupReferenceLike[] = []
): AugmentedGroupWithDerivedNetworkMeta<TGroup> | null {
  if (!group?.id) {
    return null;
  }

  const groupId = group.id;
  const relevantConnections = allConnections.filter(
    connection =>
      connection.group_a_id === groupId ||
      connection.group_b_id === groupId ||
      connection.from_group_id === groupId ||
      connection.to_group_id === groupId
  );
  // The builder emits one entry for every explicit group ID.
  const networkMeta = buildDerivedGroupNetworkMetaMap(relevantConnections, [groupId]).get(
    groupId
  ) as DerivedGroupNetworkMeta;
  const derivedMeta: DerivedGroupNetworkMeta = {
    ...networkMeta,
    group_type:
      (group.group_type as DerivedGroupNetworkMeta['group_type'] | null) ?? networkMeta.group_type,
    has_hierarchy_children: group.has_hierarchy_children ?? networkMeta.has_hierarchy_children,
    has_sibling_connections: group.has_sibling_connections ?? networkMeta.has_sibling_connections,
    connected_group_id: group.connected_group_id ?? networkMeta.connected_group_id,
    primary_sibling_membership_mode:
      (group.primary_sibling_membership_mode as
        DerivedGroupNetworkMeta['primary_sibling_membership_mode'] | null) ??
      networkMeta.primary_sibling_membership_mode,
    sibling_membership_mode:
      (group.sibling_membership_mode as
        DerivedGroupNetworkMeta['sibling_membership_mode'] | null) ??
      networkMeta.sibling_membership_mode,
    sibling_role_id: group.sibling_role_id ?? networkMeta.sibling_role_id,
  };
  const relationshipRows = deriveNormalizedGroupRelationships(relevantConnections);
  const groupsById = new Map(
    allGroups
      .filter(candidate => candidate?.id)
      .map(candidate => [candidate.id as string, candidate])
  );

  for (const connection of relevantConnections) {
    if (connection.group_a?.id) {
      groupsById.set(connection.group_a.id, connection.group_a);
    }
    if (connection.group_b?.id) {
      groupsById.set(connection.group_b.id, connection.group_b);
    }
    if (connection.from_group?.id) {
      groupsById.set(connection.from_group.id, connection.from_group);
    }
    if (connection.to_group?.id) {
      groupsById.set(connection.to_group.id, connection.to_group);
    }
  }

  const connectedGroup =
    derivedMeta.connected_group_id != null
      ? (groupsById.get(derivedMeta.connected_group_id) ?? null)
      : null;

  const siblingGroups = uniqueById(
    relevantConnections
      .filter(
        connection =>
          (connection.connection_type === 'peer' || connection.connection_kind === 'sibling') &&
          isActiveConnectionStatus(connection.status)
      )
      .map(connection => {
        if (connection.group_a_id === groupId) {
          return connection.group_b ?? groupsById.get(connection.group_b_id) ?? null;
        }
        if (connection.group_b_id === groupId) {
          return connection.group_a ?? groupsById.get(connection.group_a_id) ?? null;
        }
        if (connection.from_group_id === groupId) {
          return connection.to_group ?? groupsById.get(connection.to_group_id ?? '') ?? null;
        }
        return connection.from_group ?? groupsById.get(connection.from_group_id ?? '') ?? null;
      })
      .filter(Boolean) as readonly { id?: string | null }[]
  );

  const sibling_sources = derivedMeta.parliament_source_group_ids.map(sourceGroupId => ({
    id: `${groupId}:${sourceGroupId}`,
    group_id: groupId,
    source_group_id: sourceGroupId,
    source_group: groupsById.get(sourceGroupId) ?? null,
  }));

  return {
    ...group,
    ...derivedMeta,
    connected_group: connectedGroup,
    sibling_groups: siblingGroups,
    sibling_sources,
    relationships_as_source: relationshipRows.filter(
      relationship => relationship.group_id === groupId
    ),
    relationships_as_target: relationshipRows.filter(
      relationship => relationship.related_group_id === groupId
    ),
  } as AugmentedGroupWithDerivedNetworkMeta<TGroup>;
}

/**
 * Reactive state hook for group data.
 * Returns all query-derived state — no mutations.
 */
export function useGroupState(options: GroupStateOptions = {}) {
  const {
    groupId,
    userId,
    includeSearch,
    includeMemberships,
    includeRoles,
    includeScopedRoles,
    includeAllRelationships,
    includeByUser,
    includeMembershipsWithUsers,
    includeCurrentUserMembershipsWithGroups,
    includeAllRelationshipsWithGroups,
  } = options;

  const [group, groupResult] = useQuery(groupId ? queries.groups.byId({ id: groupId }) : undefined);

  const [memberships, membershipsResult] = useQuery(
    groupId && includeMemberships ? queries.groups.memberships({ groupId }) : undefined
  );

  const [roles, rolesResult] = useQuery(
    groupId && includeRoles ? queries.groups.roles({ groupId }) : undefined
  );

  const [scopedRoles, scopedRolesResult] = useQuery(
    groupId && includeScopedRoles ? queries.groups.scopedRoles({ groupId }) : undefined
  );

  const shouldLoadGroupConnections = includeAllRelationships || includeAllRelationshipsWithGroups;
  const [allGroupConnections, allGroupConnectionsResult] = useQuery(
    shouldLoadGroupConnections ? queries.network.allGroupConnections({}) : undefined
  );

  // ── User memberships (opt-in) ──────────────────────────────────────
  const [userMemberships, userMembershipsResult] = useQuery(
    userId ? queries.groups.membershipsByUser({ user_id: userId }) : undefined
  );

  // ── Search all groups (opt-in) ─────────────────────────────────────
  const [searchResults, searchResult] = useQuery(
    includeSearch ? queries.groups.search({ query: '' }) : undefined
  );

  // ── All relationships (opt-in) ─────────────────────────────────────
  // ── Current user's groups via byUser (opt-in) ──────────────────────
  const [userGroupMemberships, userGroupMembershipsResult] = useQuery(
    includeByUser ? queries.groups.byUser({}) : undefined
  );

  // ── Memberships with user data (opt-in, needs groupId) ─────────────
  const [membershipsWithUsers, membershipsWithUsersResult] = useQuery(
    includeMembershipsWithUsers && groupId
      ? queries.groups.membershipsWithUsers({ groupId })
      : undefined
  );

  // ── Current user memberships with group data (opt-in) ──────────────
  const [currentUserMembershipsWithGroups, currentUserMembershipsWithGroupsResult] = useQuery(
    includeCurrentUserMembershipsWithGroups
      ? queries.groups.currentUserMembershipsWithGroups({})
      : undefined
  );

  const derivedRelationships = useMemo(
    () => deriveNormalizedGroupRelationships(allGroupConnections ?? []),
    [allGroupConnections]
  );
  const groupAugmentationBase = useMemo(() => {
    const groupsToAugment = [
      ...(group ? [group] : []),
      ...(searchResults ?? []),
      ...(currentUserMembershipsWithGroups ?? [])
        .map(membership => membership.group)
        .filter(Boolean),
      ...(userGroupMemberships ?? []).map(membership => membership.group).filter(Boolean),
    ];
    return uniqueById(
      groupsToAugment.filter(Boolean) as unknown as readonly { id?: string | null }[]
    );
  }, [currentUserMembershipsWithGroups, group, searchResults, userGroupMemberships]);
  const augmentedGroup = useMemo(
    () =>
      augmentGroupWithDerivedNetworkMeta(group, allGroupConnections ?? [], groupAugmentationBase),
    [allGroupConnections, group, groupAugmentationBase]
  );
  const relationships = useMemo(
    () =>
      groupId ? derivedRelationships.filter(relationship => relationship.group_id === groupId) : [],
    [derivedRelationships, groupId]
  );
  const relationshipsAsTarget = useMemo(
    () =>
      groupId
        ? derivedRelationships.filter(relationship => relationship.related_group_id === groupId)
        : [],
    [derivedRelationships, groupId]
  );
  const allRelationships = useMemo(
    () => (includeAllRelationships ? derivedRelationships : []),
    [derivedRelationships, includeAllRelationships]
  );
  const allRelationshipsWithGroups = useMemo(
    () => (includeAllRelationshipsWithGroups ? derivedRelationships : []),
    [derivedRelationships, includeAllRelationshipsWithGroups]
  );
  const augmentedSearchResults = useMemo(() => {
    const augmentedResults = (searchResults ?? [])
      .map(result =>
        augmentGroupWithDerivedNetworkMeta(result, allGroupConnections ?? [], searchResults)
      )
      .filter(result => result != null);

    return augmentedResults as NonNullable<(typeof augmentedResults)[number]>[];
  }, [allGroupConnections, searchResults]);
  const augmentedUserGroupMemberships = useMemo(
    () =>
      normalizeMemberships(userGroupMemberships).map(membership => ({
        ...membership,
        group: augmentGroupWithDerivedNetworkMeta(
          membership.group,
          allGroupConnections ?? [],
          groupAugmentationBase
        ),
      })),
    [allGroupConnections, groupAugmentationBase, userGroupMemberships]
  );
  const augmentedCurrentUserMembershipsWithGroups = useMemo(
    () =>
      normalizeMemberships(currentUserMembershipsWithGroups).map(membership => ({
        ...membership,
        group: augmentGroupWithDerivedNetworkMeta(
          membership.group,
          allGroupConnections ?? [],
          groupAugmentationBase
        ),
      })),
    [allGroupConnections, currentUserMembershipsWithGroups, groupAugmentationBase]
  );

  const isLoading =
    (groupId !== undefined && groupResult.type === 'unknown') ||
    (groupId !== undefined &&
      includeMemberships === true &&
      membershipsResult.type === 'unknown') ||
    (groupId !== undefined && includeRoles === true && rolesResult.type === 'unknown') ||
    (groupId !== undefined &&
      includeScopedRoles === true &&
      scopedRolesResult.type === 'unknown') ||
    (shouldLoadGroupConnections && allGroupConnectionsResult.type === 'unknown') ||
    (userId !== undefined && userMembershipsResult.type === 'unknown') ||
    (includeSearch === true && searchResult.type === 'unknown') ||
    (includeByUser === true && userGroupMembershipsResult.type === 'unknown') ||
    (includeMembershipsWithUsers === true &&
      groupId !== undefined &&
      membershipsWithUsersResult.type === 'unknown') ||
    (includeCurrentUserMembershipsWithGroups === true &&
      currentUserMembershipsWithGroupsResult.type === 'unknown');

  return {
    group: augmentedGroup,
    memberships: normalizeMemberships(memberships),
    roles,
    scopedRoles,
    relationships,
    relationshipsAsTarget,
    userMemberships: normalizeMemberships(userMemberships),
    searchResults: augmentedSearchResults,
    allRelationships,
    allRelationshipsWithGroups,
    userGroupMemberships: augmentedUserGroupMemberships,
    membershipsWithUsers: normalizeMemberships(membershipsWithUsers),
    currentUserMembershipsWithGroups: augmentedCurrentUserMembershipsWithGroups,
    isLoading,
  };
}

// ── Focused Query Hooks ─────────────────────────────────────────────
// (Migrated from hooks.ts — each wraps a single formal query)

// ── Group Wiki Data (deep relations for GroupWiki) ──────────────────

export function useGroupWikiData(groupId: string) {
  const [overviewData, overviewResult] = useQuery(queries.groups.wikiOverview({ id: groupId }));
  const [wikiNetworkData, wikiNetworkResult] = useQuery(queries.network.wikiNetwork({ groupId }));
  const [roleProjectionData, roleProjectionResult] = useQuery(
    queries.groups.wikiRoleProjection({ groupId })
  );

  const group = useMemo(() => {
    const currentGroup = overviewData?.[0];
    if (!currentGroup) return null;
    const projectedRoles = roleProjectionData?.[0]?.roles ?? [];

    const augmentedGroup = augmentGroupWithDerivedNetworkMeta(
      {
        ...currentGroup,
        memberships: [],
        roles: projectedRoles,
      },
      (wikiNetworkData ?? []) as unknown as GroupConnectionListRow[],
      overviewData
    );

    return {
      ...augmentedGroup,
      memberships: [],
      roles: augmentedGroup.roles.map(mapRoleForDisplay),
    };
  }, [overviewData, roleProjectionData, wikiNetworkData]);

  return {
    group,
    isLoading:
      overviewResult.type === 'unknown' ||
      wikiNetworkResult.type === 'unknown' ||
      roleProjectionResult.type === 'unknown',
  };
}

export function useViewerMembershipOverview(groupId: string | undefined) {
  const [rows, result] = useQuery(
    groupId ? queries.groups.viewerMembershipOverview({ groupId }) : undefined
  );

  const overview = useMemo(() => {
    const group = rows?.[0] ?? null;
    const connectedGroup = group?.connected_group ?? null;
    return {
      group,
      memberships: normalizeMemberships(group?.memberships),
      guestAccesses: group?.guest_accesses ?? [],
      connectedGroupMemberships: normalizeMemberships(connectedGroup?.memberships),
      connectedGroupGuestAccesses: connectedGroup?.guest_accesses ?? [],
    };
  }, [rows]);

  return {
    ...overview,
    isLoading: Boolean(groupId) && result.type === 'unknown',
  };
}

// ── User Membership in a specific Group ─────────────────────────────

export function useUserMembershipInGroup(userId: string | undefined, groupId?: string) {
  const [membershipsData, membershipsResult] = useQuery(
    userId && groupId ? queries.groups.userMembershipInGroup({ userId, groupId }) : undefined
  );

  const [allMembershipsData, allMembershipsResult] = useQuery(
    groupId ? queries.groups.allMembershipsInGroupWithRole({ groupId }) : undefined
  );

  return {
    memberships: normalizeMemberships(membershipsData),
    allMemberships: normalizeMemberships(allMembershipsData),
    isLoading:
      Boolean(groupId) &&
      ((userId !== undefined && membershipsResult.type === 'unknown') ||
        allMembershipsResult.type === 'unknown'),
  };
}

// ── Group Subscribers ───────────────────────────────────────────────

export function useGroupSubscribers(groupId: string | undefined) {
  const [groupsData, groupsResult] = useQuery(
    groupId ? queries.groups.byIdBasic({ id: groupId }) : undefined
  );

  const [subscribersData, subscribersResult] = useQuery(
    groupId ? queries.groups.subscribersByGroup({ groupId }) : undefined
  );

  const subscriberCount = subscribersData?.length ?? groupsData?.[0]?.subscriber_count ?? 0;

  return {
    groupName: groupsData?.[0]?.name || 'Group',
    subscriberCount,
    subscribers: subscribersData || [],
    isLoading: groupsResult.type === 'unknown' || subscribersResult.type === 'unknown',
  };
}

// ── All Groups ──────────────────────────────────────────────────────

export function useAllGroups() {
  const [groupsData, groupsResult] = useQuery(queries.groups.all({}));
  const [allGroupConnections, allGroupConnectionsResult] = useQuery(
    queries.network.allGroupConnections({})
  );

  const groups = useMemo(
    () =>
      (groupsData || []).map(group =>
        augmentGroupWithDerivedNetworkMeta(group, allGroupConnections ?? [], groupsData)
      ),
    [allGroupConnections, groupsData]
  );

  return {
    groups,
    isLoading: groupsResult.type === 'unknown' || allGroupConnectionsResult.type === 'unknown',
  };
}

// ── All Documents (with collaborators) ──────────────────────────────

export function useAllDocuments() {
  const [documentsData, documentsResult] = useQuery(queries.groups.allDocuments({}));

  return {
    documents: documentsData || [],
    isLoading: documentsResult.type === 'unknown',
  };
}

// ── Group by ID (full) ──────────────────────────────────────────────

export function useGroupById(groupId?: string) {
  const [groupsData, groupsResult] = useQuery(
    groupId ? queries.groups.byIdFull({ id: groupId }) : undefined
  );
  const [allGroupConnections, allGroupConnectionsResult] = useQuery(
    groupId ? queries.network.allGroupConnections({}) : undefined
  );

  const isLoading = groupsResult.type === 'unknown' || allGroupConnectionsResult.type === 'unknown';
  const group = useMemo(() => {
    const currentGroup = groupsData?.[0];
    if (!currentGroup) return null;

    const augmentedGroup = augmentGroupWithDerivedNetworkMeta(
      currentGroup,
      allGroupConnections ?? [],
      groupsData
    );

    return {
      ...augmentedGroup,
      memberships: normalizeMemberships(augmentedGroup.memberships),
      guest_accesses: normalizeGuestAccesses(augmentedGroup.guest_accesses),
    };
  }, [allGroupConnections, groupsData]);
  const memberships = useMemo(() => group?.memberships || [], [group]);
  const roles = useMemo(() => group?.roles || [], [group]);
  const events = useMemo(() => group?.events || [], [group]);
  const amendments = useMemo(() => group?.amendments || [], [group]);
  const conversation = useMemo(() => group?.conversations, [group]);

  const memberStats = useMemo(() => {
    const stats = { total: memberships.length, members: 0, admins: 0, invited: 0, requested: 0 };
    memberships.forEach(membership => {
      if (membership.status === 'active') stats.members++;
      if (membership.status === 'admin' || membership.role?.name === 'Board Member') stats.admins++;
      if (membership.status === 'invited') stats.invited++;
      if (membership.status === 'requested') stats.requested++;
    });
    return stats;
  }, [memberships]);

  return { group, memberships, roles, events, amendments, conversation, memberStats, isLoading };
}

// ── Group Memberships ───────────────────────────────────────────────

export function useGroupMemberships(groupId?: string) {
  const [membershipsData, membershipsResult] = useQuery(
    groupId ? queries.groups.membershipsWithRolesAndRights({ groupId }) : undefined
  );

  const isLoading = membershipsResult.type === 'unknown';
  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const { activeMemberships, invitedMemberships, requestedMemberships, pendingMemberships } =
    useMemo(() => {
      const active: (typeof memberships)[number][] = [];
      const invited: (typeof memberships)[number][] = [];
      const requested: (typeof memberships)[number][] = [];
      const pending: (typeof memberships)[number][] = [];
      memberships.forEach(m => {
        if (
          m.status === 'active' ||
          m.status === 'admin' ||
          m.status === 'member' ||
          m.role?.name === 'Board Member'
        ) {
          active.push(m);
        } else if (m.status === 'invited') {
          invited.push(m);
          pending.push(m);
        } else if (m.status === 'requested') {
          requested.push(m);
          pending.push(m);
        }
      });
      return {
        activeMemberships: active,
        invitedMemberships: invited,
        requestedMemberships: requested,
        pendingMemberships: pending,
      };
    }, [memberships]);

  return {
    memberships,
    activeMemberships,
    invitedMemberships,
    requestedMemberships,
    pendingMemberships,
    isLoading,
  };
}

export function useGroupMembershipsByGroupIds(groupIds?: readonly string[]) {
  const normalizedGroupIds = useMemo(
    () => (groupIds ? [...new Set(groupIds.filter(Boolean))] : []),
    [groupIds]
  );
  const [membershipsData, membershipsResult] = useQuery(
    normalizedGroupIds.length > 0
      ? queries.groups.membershipsWithRolesAndRightsByGroupIds({ groupIds: normalizedGroupIds })
      : undefined
  );

  const isLoading = normalizedGroupIds.length > 0 && membershipsResult.type === 'unknown';
  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const { activeMemberships, invitedMemberships, requestedMemberships, pendingMemberships } =
    useMemo(() => {
      const active: (typeof memberships)[number][] = [];
      const invited: (typeof memberships)[number][] = [];
      const requested: (typeof memberships)[number][] = [];
      const pending: (typeof memberships)[number][] = [];
      memberships.forEach(m => {
        if (
          m.status === 'active' ||
          m.status === 'admin' ||
          m.status === 'member' ||
          m.role?.name === 'Board Member'
        ) {
          active.push(m);
        } else if (m.status === 'invited') {
          invited.push(m);
          pending.push(m);
        } else if (m.status === 'requested') {
          requested.push(m);
          pending.push(m);
        }
      });
      return {
        activeMemberships: active,
        invitedMemberships: invited,
        requestedMemberships: requested,
        pendingMemberships: pending,
      };
    }, [memberships]);

  return {
    memberships,
    activeMemberships,
    invitedMemberships,
    requestedMemberships,
    pendingMemberships,
    isLoading,
  };
}

export function useGroupGuestAccesses(groupId?: string) {
  const [guestAccessesData, guestAccessesResult] = useQuery(
    groupId ? queries.groups.guestAccessesWithRolesAndRights({ groupId }) : undefined
  );

  const isLoading = guestAccessesResult.type === 'unknown';
  const guestAccesses = useMemo(
    () => normalizeGuestAccesses(guestAccessesData),
    [guestAccessesData]
  );

  const {
    activeGuestAccesses,
    requestedGuestAccesses,
    invitedGuestAccesses,
    revokedGuestAccesses,
  } = useMemo(() => {
    const active: (typeof guestAccesses)[number][] = [];
    const requested: (typeof guestAccesses)[number][] = [];
    const invited: (typeof guestAccesses)[number][] = [];
    const revoked: (typeof guestAccesses)[number][] = [];

    guestAccesses.forEach(guestAccess => {
      if (guestAccess.status === 'active') {
        active.push(guestAccess);
      } else if (guestAccess.status === 'requested') {
        requested.push(guestAccess);
      } else if (guestAccess.status === 'invited') {
        invited.push(guestAccess);
      } else if (guestAccess.status === 'revoked') {
        revoked.push(guestAccess);
      }
    });

    return {
      activeGuestAccesses: active,
      requestedGuestAccesses: requested,
      invitedGuestAccesses: invited,
      revokedGuestAccesses: revoked,
    };
  }, [guestAccesses]);

  return {
    guestAccesses,
    activeGuestAccesses,
    requestedGuestAccesses,
    invitedGuestAccesses,
    revokedGuestAccesses,
    isLoading,
  };
}

// ── Group Roles ─────────────────────────────────────────────────────

export function useGroupAccessRoles(groupId?: string) {
  const [rolesData, rolesResult] = useQuery(
    groupId ? queries.groups.accessRolesWithRights({ groupId }) : undefined
  );

  return {
    roles: useMemo(() => rolesData || [], [rolesData]),
    isLoading: rolesResult.type === 'unknown',
  };
}

// ── Group Network / Relationships ───────────────────────────────────

export function useGroupNetwork(groupId: string) {
  const [groupData, groupResult] = useQuery(queries.groups.byIdForNetwork({ id: groupId }));
  const [allGroupConnections, allGroupConnectionsResult] = useQuery(
    queries.network.allGroupConnections({})
  );
  const relationshipsData = useMemo(
    () => deriveNormalizedGroupRelationships(allGroupConnections ?? []),
    [allGroupConnections]
  );
  const group = useMemo(
    () =>
      augmentGroupWithDerivedNetworkMeta(
        groupData?.[0],
        allGroupConnections ?? [],
        groupData ?? []
      ),
    [allGroupConnections, groupData]
  );

  return {
    group,
    relationships: relationshipsData,
    isLoading: groupResult.type === 'unknown' || allGroupConnectionsResult.type === 'unknown',
  };
}

// ── Group Amendments ────────────────────────────────────────────────

export function useGroupAmendments(groupId: string) {
  const [amendments, amendmentsResult] = useQuery(queries.groups.amendmentsByGroup({ groupId }));

  return {
    amendments: amendments || [],
    isLoading: amendmentsResult.type === 'unknown',
  };
}

export function useGroupAmendmentEventStepRuns(eventIds: string[]) {
  const [stepRuns, stepRunsResult] = useQuery(
    eventIds.length > 0 ? queries.groups.amendmentEventStepRunsByEventIds({ eventIds }) : undefined
  );

  return {
    stepRuns: stepRuns || [],
    isLoading: eventIds.length > 0 && stepRunsResult.type === 'unknown',
  };
}

// ── Group Documents ─────────────────────────────────────────────────

export function useGroupDocuments(groupId: string) {
  const [amendmentsData, documentsResult] = useQuery(
    queries.groups.amendmentsWithDocuments({ groupId })
  );

  const documents = useMemo(
    () =>
      (amendmentsData || []).flatMap(a =>
        (a.documents || []).map(doc => ({ ...doc, title: a.title }))
      ),
    [amendmentsData]
  );

  return { documents, isLoading: documentsResult.type === 'unknown' };
}

// ── Group Roles ─────────────────────────────────────────────────────

export function useGroupRoles(groupId: string) {
  const [groupsData, rolesResult] = useQuery(queries.groups.roleManagementProjection({ groupId }));
  const rolesData = groupsData?.[0]?.roles;

  const roles = useMemo(
    () =>
      (rolesData || []).map(role => {
        const currentHistoryEntry = role.holder_history?.find(history => !history.end_date);
        const currentMembershipEntry = role.group_membership_roles?.find(
          membershipRole => membershipRole.group_membership?.user?.id
        )?.group_membership;
        const currentAssignee = currentHistoryEntry?.user ?? currentMembershipEntry?.user ?? null;
        return {
          ...role,
          title: role.name,
          term:
            role.is_recurring && role.recurrence_pattern === 'yearly'
              ? String(role.recurrence_interval ?? 1)
              : null,
          first_term_start: role.term_start_date ?? null,
          currentHolder: currentAssignee?.id
            ? {
                id: currentAssignee.id,
                fullName:
                  [currentAssignee.first_name, currentAssignee.last_name]
                    .filter(Boolean)
                    .join(' ') || null,
                handle: currentAssignee.handle ?? null,
                imageURL: currentAssignee.avatar ?? null,
                source: currentHistoryEntry?.user?.id ? 'incumbent' : 'membership',
              }
            : null,
        };
      }),
    [rolesData]
  );

  return {
    roles,
    isLoading: rolesResult.type === 'unknown',
  };
}

export function useGroupRoleOptions(groupId: string | undefined) {
  const [groupsData, result] = useQuery(
    groupId ? queries.groups.roleOptionProjection({ groupId }) : undefined
  );

  return {
    roles: groupsData?.[0]?.roles ?? [],
    isLoading: Boolean(groupId) && result.type === 'unknown',
  };
}

// ── Group Todos ─────────────────────────────────────────────────────

export function useGroupTodos(groupId: string) {
  const [todosData, todosResult] = useQuery(
    queries.groups.todosByGroup({ groupId, archive: 'active' })
  );
  const [archivedTodosData, archivedTodosResult] = useQuery(
    queries.groups.todosByGroup({ groupId, archive: 'archived' })
  );

  return {
    todos: todosData || [],
    archivedTodos: archivedTodosData || [],
    isLoading: todosResult.type === 'unknown' || archivedTodosResult.type === 'unknown',
  };
}

// ── Group Links ─────────────────────────────────────────────────────

export function useGroupLinks(groupId: string) {
  const [linksData, linksResult] = useQuery(queries.groups.linksByGroup({ groupId }));

  return {
    links: linksData || [],
    isLoading: linksResult.type === 'unknown',
  };
}

// ── Group Payments ──────────────────────────────────────────────────

export function useGroupPaymentsData(groupId: string) {
  const [paymentsData, paymentsResult] = useQuery(
    queries.groups.paymentsReceivedByGroup({ groupId })
  );
  const [payerPaymentsData, payerPaymentsResult] = useQuery(
    queries.groups.paymentsPaidByGroup({ groupId })
  );

  const payments = useMemo(() => {
    return [...(paymentsData || []), ...(payerPaymentsData || [])].filter(
      (p, i, arr) => arr.findIndex(x => x.id === p.id) === i
    );
  }, [paymentsData, payerPaymentsData]);

  return {
    payments,
    isLoading: paymentsResult.type === 'unknown' || payerPaymentsResult.type === 'unknown',
  };
}

// ── Group Active Members (for dialogs) ──────────────────────────────

export function useGroupActiveMembers(groupId: string) {
  const [membershipsData, membershipsResult] = useQuery(
    queries.groups.activeMembersByGroup({ groupId })
  );

  return {
    members: membershipsData || [],
    isLoading: membershipsResult.type === 'unknown',
  };
}

export function useAssignableGroupMembersByGroupIds(groupIds?: readonly string[]) {
  const normalizedGroupIds = useMemo(
    () => (groupIds ? [...new Set(groupIds.filter(Boolean))] : []),
    [groupIds]
  );
  const [membershipsData, membershipsResult] = useQuery(
    normalizedGroupIds.length > 0
      ? queries.groups.assignableActiveMembersByGroupIds({ groupIds: normalizedGroupIds })
      : undefined
  );

  return {
    members: membershipsData || [],
    isLoading: normalizedGroupIds.length > 0 && membershipsResult.type === 'unknown',
  };
}

export function useGroupOfflineMembers(groupId?: string) {
  const [offlineMembersData, offlineMembersResult] = useQuery(
    groupId ? queries.groups.offlineMembersByGroup({ groupId }) : undefined
  );

  return {
    offlineMembers: offlineMembersData || [],
    isLoading: groupId != null && offlineMembersResult.type === 'unknown',
  };
}

export function useGroupOfflineMemberships(groupId?: string) {
  const [offlineMembershipsData, offlineMembershipsResult] = useQuery(
    groupId ? queries.groups.offlineMembershipsWithRolesAndRights({ groupId }) : undefined
  );

  return {
    offlineMemberships: normalizeOfflineMemberships(offlineMembershipsData),
    isLoading: groupId != null && offlineMembershipsResult.type === 'unknown',
  };
}

export function useGroupOfflineMembershipsByGroupIds(groupIds?: readonly string[]) {
  const normalizedGroupIds = groupIds ? [...new Set(groupIds.filter(Boolean))] : [];
  const [offlineMembershipsData, offlineMembershipsResult] = useQuery(
    normalizedGroupIds.length > 0
      ? queries.groups.offlineMembershipsWithRolesAndRightsByGroupIds({
          groupIds: normalizedGroupIds,
        })
      : undefined
  );

  return {
    offlineMemberships: normalizeOfflineMemberships(offlineMembershipsData),
    isLoading: normalizedGroupIds.length > 0 && offlineMembershipsResult.type === 'unknown',
  };
}

// ── User Search ─────────────────────────────────────────────────────

export function useUserSearch(searchQuery: string, existingMemberIds: string[] = []) {
  const trimmedQuery = searchQuery.trim();

  const [usersData, usersResult] = useQuery(queries.groups.allUsersLimited({}));

  const users = useMemo(() => {
    const allUsers = usersData || [];
    const filtered = trimmedQuery
      ? allUsers.filter(
          user =>
            `${user.first_name || ''} ${user.last_name || ''}`
              .toLowerCase()
              .includes(trimmedQuery.toLowerCase()) ||
            user.handle?.toLowerCase().includes(trimmedQuery.toLowerCase())
        )
      : allUsers;
    return filtered.filter(user => !existingMemberIds.includes(user.id));
  }, [usersData, existingMemberIds, trimmedQuery]);

  return { users, isLoading: usersResult.type === 'unknown' };
}

// ── Public Groups ───────────────────────────────────────────────────

export function usePublicGroups() {
  const [groups, result] = useQuery(queries.groups.publicGroups({}));

  return {
    groups: groups ?? [],
    isLoading: result.type === 'unknown',
  };
}

// ── User Group Subscriptions (for timeline) ─────────────────────────

export function useUserGroupSubscriptions(userId?: string) {
  const [memberships, result] = useQuery(
    userId ? queries.groups.userMembershipsWithGroupRelations({ userId }) : undefined
  );

  return {
    memberships: memberships ?? [],
    isLoading: result.type === 'unknown',
  };
}

// ── Groups where current user has active membership ────────────────

export function useCurrentUserActiveGroupIds() {
  const [membershipsData, result] = useQuery(queries.groups.currentUserMembershipsWithGroups({}));

  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const activeGroupIds = useMemo(() => {
    if (memberships.length === 0) return new Set<string>();

    const ids = new Set<string>();
    for (const membership of memberships) {
      const status = membership.status;
      if (status !== 'active' && status !== 'admin' && status !== 'member') {
        continue;
      }

      if (membership.group_id) {
        ids.add(membership.group_id);
      }
    }

    return ids;
  }, [memberships]);

  return {
    activeGroupIds,
    isLoading: result.type === 'unknown',
  };
}

export function useCurrentUserActiveGroups() {
  const [membershipsData, result] = useQuery(
    queries.groups.currentUserActiveMembershipsWithGroups({})
  );

  const groups = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const membership of normalizeMemberships(membershipsData)) {
      const group = membership.group;
      if (!group?.id) continue;
      byId.set(group.id, { id: group.id, name: group.name?.trim() || group.id });
    }
    return [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    );
  }, [membershipsData]);

  return {
    groups,
    isLoading: result.type === 'unknown',
  };
}

// ── Groups where current user can manage events ─────────────────────

export function useUserGroupsWithManageEvents() {
  const [membershipsData, result] = useQuery(queries.groups.currentUserMembershipsWithRights({}));

  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const manageEventGroupIds = useMemo(() => {
    if (memberships.length === 0) return new Set<string>();
    const ids = new Set<string>();
    for (const m of memberships) {
      // Only consider active memberships (member/admin)
      const status = m.status;
      if (status !== 'active' && status !== 'admin') continue;

      const role = m.role;
      if (!role?.action_rights) continue;
      const canManage = role.action_rights.some(
        ar => ar.resource === 'events' && (ar.action === 'manage' || ar.action === 'create')
      );
      if (canManage && m.group_id) {
        ids.add(m.group_id);
      }
    }
    return ids;
  }, [memberships]);

  return {
    manageEventGroupIds,
    isLoading: result.type === 'unknown',
  };
}
